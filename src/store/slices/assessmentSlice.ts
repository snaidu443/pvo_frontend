/**
 * assessment slice: assets + assessment workspaces, the new-product draft,
 * documents, extracted fields and judgment answers.
 * Reducers are pure: ids, dates and the acting user arrive in the payload.
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { evaluate } from '../../engine/eligibility';
import { INPUT_ITEM, INPUT_ITEMS } from '../../engine/inputCatalogue';
import { autoExtractInputs, writeInput, type RowValue } from '../../engine/inputs';
import { ref } from '../../engine/reference';
import { syncAssetSummary } from '../../engine/summary';
import {
  assetFields, assetQuestions, baseAia, docTypes, ensureAia, ensureAssessments, ensureIndIds, ensureIndicationFields, fieldVal, generateFields,
  isUnlocked, newSetup, prepIndications, sampleIndications, seedPerInd, setFieldValue, starterQuestions, summarizeAnswers, syncIndicationFields, unlock
} from '../../engine/workspace';
import { num } from '../../engine/format';
import type { Asset, AssessmentRecord, AssessmentSetup, AssessmentWorkspace, ExtractionJob, Indication, SavedScenario, SourceDocument } from '../../types/domain';
import { initialAssessment, type AssessmentState } from '../appState';
import { assetCreated, assetDeleted, newAssetStarted, workflowAdvanced, workspaceLoaded } from '../sharedActions';

/** Workspace properties that are plain view state and can be patched directly. */
export type WorkspaceViewPatch = Partial<Pick<AssessmentWorkspace,
  'govView' | 'govFilter' | 'govSearch' | 'govRow' | 'impactView' | 'policyView' | 'jcaInd' | 'check' | 'policiesOn' | 'scn' | 'scnRows'>>;

export const DRAFT_ID = '__draft';
const subject = (state: AssessmentState, id: string): Asset | null =>
  id === DRAFT_ID ? state.draft : state.assets.find(a => a.id === id) ?? null;

const sync = (state: AssessmentState, id: string, today: string) => syncAssetSummary(state, subject(state, id), today);

/** Non-visual preparation v03 did while rendering: indication ids and per-indication answers. */
function prepare(state: AssessmentState, a: Asset) {
  if (!a.aia || a.id === DRAFT_ID) return;
  prepIndications(state, a);
  assetQuestions(state, a).forEach(q => seedPerInd(a, q));
}

function makeDraft(): Asset {
  return {
    id: DRAFT_ID, assetCode: '', assetName: '', therapeuticArea: '', stage: '', jurisdictions: [], policyExposures: [],
    submissionStatus: '', submissionCompleteness: 0, eligibilityStatus: '', businessContextStatus: '', impactStatus: '', owner: '',
    lastUpdatedAt: '', estimatedImpactLevel: '', estimatedAtRisk: 0, estimatedOpportunity: 0, recommendationStatus: '', governanceAlerts: 0,
    summaryMetrics: { gross: 0, net: 0, usRevenue: 0, euRevenue: 0 }, eligibility: {}, context: {},
    policyImpact: { IRA: 0, MFN: 0, JCA: 0, 'EU-GPL': 0 }, recommendationCount: 0, approvalCount: 0,
    aia: baseAia({ created: true, unlocked: ['submission'], setup: newSetup(), base: { peakUS: 0, peakEU: 0 } })
  };
}

/** Re-extract for a created asset that has not been assessed yet; keeps values the user edited. */
function regenerateFields(state: AssessmentState, a: Asset) {
  const old = assetFields(state, a);
  const fresh = generateFields(a, {
    legacy: true,
    spend: num(fieldVal(state, a, 'Assumed annual Medicare spend')) ?? '',
    prevSpend: '',
    generic: num(fieldVal(state, a, 'Expected generic entry year')) ?? '',
    maa: ''
  });
  const merged = fresh.map(f => old.find(o => o.gen && o.group === f.group && o.field === f.field && o.status !== 'AI-extracted') || f);
  state.fields = state.fields.filter(f => !(f.assetId === a.id && f.gen)).concat(merged);
}

type IndicationKey = keyof Pick<Indication, 'name' | 'orphanUS' | 'orphanEU' | 'launchUS' | 'launchUSMonth' | 'launchEU'>;

const assessmentSlice = createSlice({
  name: 'assessment',
  initialState: initialAssessment,
  reducers: {
    /** Build the workspace if needed and prepare it before opening an asset. */
    assetPrepared(state, action: PayloadAction<string>) {
      state.draft = null;
      const a = state.assets.find(x => x.id === action.payload);
      if (!a) return;
      ensureAia(state, a);
      prepare(state, a);
    },
    subjectPrepared(state, action: PayloadAction<string>) {
      const a = subject(state, action.payload);
      if (a) prepare(state, a);
    },
    viewChanged(state, { payload }: PayloadAction<{ assetId: string; patch: WorkspaceViewPatch }>) {
      const a = subject(state, payload.assetId);
      if (a?.aia) Object.assign(a.aia, payload.patch);
    },
    setupChanged(state, { payload }: PayloadAction<{ assetId: string; key: keyof Pick<AssessmentSetup, 'name' | 'area' | 'stage' | 'modality' | 'route'>; value: string; today: string }>) {
      const a = subject(state, payload.assetId);
      if (!a?.aia) return;
      a.aia.setup[payload.key] = payload.value;
      sync(state, payload.assetId, payload.today);
    },

    /* ----- documents ----- */
    documentsAdded(state, { payload }: PayloadAction<{ assetId: string; docs: SourceDocument[]; today: string }>) {
      state.documents.push(...payload.docs);
      sync(state, payload.assetId, payload.today);
    },
    documentUpdated(state, { payload }: PayloadAction<{ assetId: string; id: number; patch: Partial<SourceDocument>; today: string }>) {
      const d = state.documents.find(x => x.id === payload.id);
      if (!d) return;
      Object.assign(d, payload.patch);
      sync(state, payload.assetId, payload.today);
    },
    documentRemoved(state, { payload }: PayloadAction<{ assetId: string; id: number; today: string }>) {
      state.documents = state.documents.filter(d => d.id !== payload.id);
      sync(state, payload.assetId, payload.today);
    },
    /** Replace a locally created record with the server's copy (API mode). */
    documentSynced(state, { payload }: PayloadAction<{ localId: number; saved: SourceDocument }>) {
      const d = state.documents.find(x => x.id === payload.localId);
      if (d) Object.assign(d, payload.saved);
    },

    /** API mode: latest status of the server extraction job; mirrors it on the asset's workflow status. */
    extractionJobUpdated(state, { payload }: PayloadAction<ExtractionJob>) {
      state.extractionJobs[payload.assetId] = payload;
      const a = state.assets.find(x => x.id === payload.assetId);
      if (a) a.workflowStatus = payload.status === 'done' ? 'inputs_review' : payload.status === 'failed' ? 'extraction_failed' : 'extracting';
    },

    /* ----- indications ----- */
    indicationAdded(state, action: PayloadAction<{ assetId: string }>) {
      const a = subject(state, action.payload.assetId);
      if (!a?.aia) return;
      a.aia.setup.indications.push({ name: 'New indication', orphanUS: '', orphanEU: '', launchUS: '', launchEU: '', include: true, v6: {} });
      ensureIndIds(a.aia.setup);
    },
    indicationIncluded(state, { payload }: PayloadAction<{ assetId: string; index: number; include: boolean; today: string }>) {
      const a = subject(state, payload.assetId), ind = a?.aia?.setup.indications[payload.index];
      if (!a?.aia || !ind) return;
      ind.include = payload.include;
      a.aia.jcaInd = 0;
      sync(state, payload.assetId, payload.today);
    },
    indicationUpdated(state, { payload }: PayloadAction<{ assetId: string; index: number; key: IndicationKey; value: string; who: string; stamp: string; today: string }>) {
      const a = subject(state, payload.assetId), ind = a?.aia?.setup.indications[payload.index];
      if (!a || !ind) return;
      ind[payload.key] = payload.value;
      syncIndicationFields(state, a, ind, payload.who, payload.stamp);
      sync(state, payload.assetId, payload.today);
    },
    /** "Next: Inputs" – make sure every included indication has its fields, then show Inputs. */
    indicationFieldsEnsured(state, action: PayloadAction<{ assetId: string }>) {
      const a = subject(state, action.payload.assetId);
      if (!a?.aia) return;
      ensureIndicationFields(state, a);
      a.aia.govView = 'fields';
    },

    /* ----- consolidated input catalogue ----- */
    /** Set one catalogue input (asset, indication or competitor level). The action validates the value first. */
    inputChanged(state, { payload }: PayloadAction<{ assetId: string; key: string; indId?: string; compIndex?: number; value: RowValue; who: string; stamp: string; today: string }>) {
      const a = subject(state, payload.assetId), w = a?.aia;
      if (!a || !w) return;
      const it = payload.compIndex != null ? INPUT_ITEMS.find(x => x.lvl === 'comp' && x.k === payload.key) : INPUT_ITEM[payload.key];
      if (!it) return;
      const ind = payload.indId ? w.setup.indications.find(i => i.id === payload.indId) : undefined;
      const comp = payload.compIndex != null ? w.v6?.comp[payload.compIndex] : undefined;
      writeInput(state, a, it, { ind, comp }, payload.value, payload.who, payload.stamp);
      sync(state, payload.assetId, payload.today);
    },

    /* ----- inputs and answers ----- */
    fieldEdited(state, { payload }: PayloadAction<{ assetId: string; fieldId: string; value: string; who: string; stamp: string; today: string; note?: string }>) {
      const f = state.fields.find(x => x.id === payload.fieldId);
      if (!f) return;
      if (setFieldValue(f, payload.value, payload.who, payload.stamp, payload.note)) sync(state, payload.assetId, payload.today);
    },
    /** Net revenue for one window year ($M); starts from the current series so the other years keep their values. */
    revenueEdited(state, { payload }: PayloadAction<{ assetId: string; series: number[]; today: string }>) {
      const a = subject(state, payload.assetId);
      if (!a?.aia) return;
      a.aia.revenue = payload.series;
      sync(state, payload.assetId, payload.today);
    },
    questionAnswered(state, { payload }: PayloadAction<{ id: string; value: string; indId?: string; who: string }>) {
      const q = state.questions.find(x => x.id === payload.id);
      if (!q) return;
      if (payload.indId !== undefined && q.perIndication) {
        q.answers = q.answers || {};
        q.answers[payload.indId] = payload.value;
        q.answer = summarizeAnswers(q.answers);
      } else q.answer = payload.value;
      q.confirmedBy = payload.who;
    },

    /* ----- scenarios, assessments, asset admin ----- */
    scenarioSaved(state, { payload }: PayloadAction<{ assetId: string; saved: SavedScenario }>) {
      const a = subject(state, payload.assetId);
      if (a?.aia) (a.aia.savedScenarios ??= []).push(payload.saved);
    },
    assessmentStarted(state, { payload }: PayloadAction<{ assetId: string; who: string; today: string }>) {
      const a = state.assets.find(x => x.id === payload.assetId);
      if (!a) return;
      const list = ensureAssessments(a);
      list.forEach(x => { if (x.status === 'Current') x.status = 'Completed'; });
      const rec: AssessmentRecord = { id: `AS-${list.length + 1}`, date: payload.today, by: payload.who, status: 'Current', level: a.estimatedImpactLevel, atRisk: a.estimatedAtRisk, completeness: a.submissionCompleteness };
      list.unshift(rec);
      a.lastUpdatedAt = payload.today;
    },
    assetEdited(state, { payload }: PayloadAction<{ assetId: string; name: string; therapeuticArea: string; owner: string }>) {
      const a = state.assets.find(x => x.id === payload.assetId);
      if (!a) return;
      Object.assign(a, { assetName: `${a.assetCode} ${payload.name}`, therapeuticArea: payload.therapeuticArea, owner: payload.owner });
    }
  },
  extraReducers: builder => {
    builder
      .addCase(workspaceLoaded, (state, { payload: { data, today } }) => {
        state.assets = data.assets;
        state.documents = data.documents;
        state.fields = data.fields;
        state.questions = data.questions;
        state.extractionJobs = {};
        state.draft = null;
        state.assets.forEach(a => { ensureAia(state, a); ensureAssessments(a); });
        syncAssetSummary(state, state.assets.find(a => a.id === 'TEST-100'), today);
      })
      .addCase(newAssetStarted, state => {
        state.documents = state.documents.filter(d => d.assetId !== DRAFT_ID);
        state.draft = makeDraft();
      })
      .addCase(assetCreated, (state, { payload }) => {
        const d = state.draft;
        if (!d?.aia) return;
        const st = d.aia.setup;
        // Demo extraction: sample indications only when a CDP was uploaded (orphan status is entered by the user).
        const cdp = state.documents.some(doc => doc.assetId === DRAFT_ID && docTypes(doc).includes('CDP'));
        if (!st.indications.length && cdp) { st.indications = sampleIndications().map(i => ({ ...i, orphanUS: '', orphanEU: '' })); ensureIndIds(st); }
        const name = st.name.trim(), ind1 = (st.indications[0]?.name || '').trim();
        const asset: Asset = {
          id: payload.id, assetCode: name, assetName: ind1 ? `${name} ${ind1}` : name, therapeuticArea: st.area || 'Other', stage: st.stage,
          jurisdictions: [], policyExposures: [], submissionStatus: 'In progress', submissionCompleteness: 0, eligibilityStatus: 'Review pending',
          businessContextStatus: 'Draft', impactStatus: '—', owner: payload.owner, lastUpdatedAt: payload.today, estimatedImpactLevel: '—',
          estimatedAtRisk: 0, estimatedOpportunity: 0, recommendationStatus: '—', governanceAlerts: 0, summaryMetrics: { gross: 0, net: 0, usRevenue: 0, euRevenue: 0 },
          eligibility: Object.fromEntries(ref().policies.map(p => [p.code, 'Review pending'])),
          context: { modality: st.modality, coverage: st.route, medicareSpend: undefined, priority: 'Maximize value', sequence: 'US-first', appetite: 'Medium', marketArchetype: st.area || '', patientShare: '70%' },
          policyImpact: { IRA: 0, MFN: 0, JCA: 0, 'EU-GPL': 0 }, recommendationCount: 0, approvalCount: 0, createdByRole: payload.role,
          aia: { ...d.aia, created: true }
        };
        ensureAssessments(asset);
        state.assets.push(asset);
        state.documents.forEach(doc => { if (doc.assetId === DRAFT_ID) doc.assetId = payload.id; });
        const forecast = state.documents.some(doc => doc.assetId === payload.id && docTypes(doc).includes('Forecast'));
        state.fields.push(...generateFields(asset, { legacy: true, spend: forecast ? 205 : '', prevSpend: '', generic: forecast ? 2034 : '', maa: '' }));
        state.questions.push(...starterQuestions(asset.id));
        const created = state.assets[state.assets.length - 1];
        autoExtractInputs(state, created);
        unlock(created, 'governance');
        created.aia!.govView = 'indications';
        syncAssetSummary(state, created, payload.today);
        state.draft = null;
      })
      .addCase(assetDeleted, (state, { payload: { id } }) => {
        state.assets = state.assets.filter(a => a.id !== id);
        state.fields = state.fields.filter(f => f.assetId !== id);
        state.questions = state.questions.filter(q => q.assetId !== id);
        state.documents = state.documents.filter(d => d.assetId !== id);
        delete state.extractionJobs[id];
      })
      .addCase(workflowAdvanced, (state, { payload }) => {
        const a = subject(state, payload.assetId);
        if (!a?.aia) return;
        if (payload.tab === 'governance') {
          // "Extract data with AI" on an existing created asset that has not been assessed yet.
          if (a.aia.created && !isUnlocked(a, 'eligibility')) regenerateFields(state, a);
          autoExtractInputs(state, a);
          unlock(a, 'governance');
          a.aia.govView = 'indications';
        } else if (payload.tab === 'eligibility') {
          // "Confirm & run assessment".
          a.aia.confirmedBy = payload.who;
          a.aia.confirmedAt = payload.today;
          assetQuestions(state, a).forEach(q => { q.confirmedBy = payload.who; });
          unlock(a, 'eligibility');
          const failAt = evaluate(state, a).IRA.steps.findIndex(x => x.state === 'fail');
          a.aia.check = failAt >= 0 ? `IRA-${failAt}` : 'IRA-3';
        } else if (payload.tab === 'impact') {
          // "Run impact analysis".
          unlock(a, 'impact', 'scenario');
          a.aia.impactView = 'policy';
        }
        syncAssetSummary(state, a, payload.today);
      });
  }
});

export const {
  assetPrepared, subjectPrepared, viewChanged, setupChanged, documentsAdded, documentUpdated, documentRemoved, documentSynced, extractionJobUpdated,
  indicationAdded, indicationIncluded, indicationUpdated, indicationFieldsEnsured, inputChanged, fieldEdited, revenueEdited, questionAnswered, scenarioSaved,
  assessmentStarted, assetEdited
} = assessmentSlice.actions;
export default assessmentSlice.reducer;
