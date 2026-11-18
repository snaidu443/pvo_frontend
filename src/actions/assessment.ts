/**
 * Asset Impact Analysis actions (v03 aiaClick / aiaChange handlers as named functions).
 * Each validates against current state, dispatches an assessment-slice action and
 * writes through to the services.
 */
import { assessmentService, assetService, inputsService } from '../api';
import { ANALYSIS_STEPS, DOC_TYPES, ELIGIBILITY_STEPS } from '../engine/constants';
import { MONTHS, revenueSeries, scenarioCompute, SCN_MAX, SCN_VARS, scnRowsOf, type ScnKey } from '../engine/impact';
import { canEdit, canEditAiaInputs, canEditGoverned, userLabel } from '../engine/permissions';
import { num } from '../engine/format';
import { INPUT_ITEM, INPUT_ITEMS, str } from '../engine/inputCatalogue';
import { inputsGated, missingBeforeView, missingInputs, readInput, viewBlockedByIndications, type RowValue } from '../engine/inputs';
import { docTypes, isUnlocked } from '../engine/workspace';
import { assetCreated, workflowAdvanced } from '../store/sharedActions';
import {
  DRAFT_ID, documentUpdated, fieldEdited, indicationAdded, indicationFieldsEnsured, inputChanged, conflictChosen,
  indicationIncluded, indicationUpdated, questionAnswered, revenueEdited, scenarioSaved, setupChanged, viewChanged, type WorkspaceViewPatch
} from '../store/slices/assessmentSlice';
import { dispatch, getState } from '../store/store';
import type { Indication, PolicyCode } from '../types/domain';
import { closeDrawer, isLoaderRunning, runLoader, toast } from '../ui/overlay';
import { assetSaved, fail, isDraft, now, record, saveAsset, saveDocument, saveField, saveFieldsFor, saveQuestion, saveSubject, subjectId, subjectOf } from './core';
import { uploadDraftFiles } from './documents';
import { extractAfterCreate } from './extraction';
import { goTab } from './navigation';

const toTop = () => window.scrollTo(0, 0);
const patchView = (patch: WorkspaceViewPatch) => dispatch(viewChanged({ assetId: subjectId(getState()), patch }));

/* ======================= Data Submission ======================= */

export function updateSetup(key: 'name', value: string) {
  dispatch(setupChanged({ assetId: subjectId(getState()), key, value: value.slice(0, 80), today: now().today }));
  saveSubject();
}

/** Tick or untick a document label. Returns false when the change is rejected (last label). */
export function setDocumentLabel(id: number, type: string, checked: boolean): boolean {
  const st = getState();
  if (!canEditAiaInputs(st.role) || !DOC_TYPES.includes(type)) return true;
  const doc = st.documents.find(d => d.id === id);
  if (!doc) return true;
  const t = [...docTypes(doc)];
  if (checked) { if (!t.includes(type)) t.push(type); }
  else { const i = t.indexOf(type); if (i >= 0) t.splice(i, 1); }
  if (!t.length) { toast('A document needs at least one label.'); return false; }
  dispatch(documentUpdated({ assetId: subjectId(st), id, patch: { types: t, type: t[0], ...(doc.tag === 'AI-suggested' ? { tag: '' } : {}) }, today: now().today }));
  record(`Updated labels for ${doc.name}`);
  saveDocument(id);
  return true;
}

/**
 * "Create asset" on a new product: adds the asset to structx.sqlite (POST /assets), then saves what was entered on the form
 * (PUT /assets/{code}). Documents and AI extraction come from the AI team's pipeline, not from here. Returns 'name-required' for form validation.
 */
export async function createAsset(): Promise<'ok' | 'name-required' | 'blocked'> {
  const st = getState(), a = subjectOf(st);
  if (!a?.aia || !isDraft(a)) return 'blocked';
  if (!canEditAiaInputs(st.role)) { toast('Only Admin and Editor roles can add a product.'); return 'blocked'; }
  const name = a.aia.setup.name.trim();
  if (!name) return 'name-required';
  if (st.assets.some(x => x.assetCode.toLowerCase() === name.toLowerCase())) { toast('An asset with this name already exists.'); return 'blocked'; }
  if (isLoaderRunning()) return 'blocked';
  try {
    await assetService.create(name);
  } catch (e) {
    fail('The new asset could not be created. Please try again.')(e);
    return 'blocked'; // nothing was created; the form is kept
  }
  const { today } = now(), s = getState();
  dispatch(assetCreated({ id: name, code: name, assetName: name, owner: s.session?.name || userLabel(s), role: s.role, today }));
  record(`Created asset ${name}`);
  saveAsset(name); // the set-up entered on the form
  toTop();
  const draftDocs = s.documents.filter(d => d.assetId === DRAFT_ID);
  const files = await uploadDraftFiles(name, draftDocs.map(d => d.id));
  const saved = await assetSaved(name);
  toast(!saved ? `${name} was created, but the set-up could not be saved. Please try again.`
    : files.failed.length ? `${name} was created. ${files.failed[0]}${files.failed.length > 1 ? ` (and ${files.failed.length - 1} more)` : ''}`
    : `${name} was created and saved.`);
  // The indications and inputs come from the AI: start the extraction once everything is uploaded and saved.
  if (saved && !files.failed.length && draftDocs.some(d => ['CDP', 'CI', 'Protocol'].includes(docTypes(d)[0]))) extractAfterCreate(name);
  return 'ok';
}

/* ======================= Inputs and Assumptions ======================= */

/** Returns the index of the new indication (for focusing its name), or -1. */
export function addIndication(): number {
  const st = getState(), a = subjectOf(st);
  if (!canEditGoverned(st.role) || !a?.aia) return -1;
  const index = a.aia.setup.indications.length;
  dispatch(indicationAdded({ assetId: subjectId(st) }));
  record('Added indication');
  saveSubject();
  return index;
}

export function setIndicationIncluded(index: number, include: boolean) {
  const st = getState(), a = subjectOf(st);
  if (!canEditGoverned(st.role) || !a?.aia) return;
  const ind = a.aia.setup.indications[index];
  if (!ind) return;
  if (!include && a.aia.setup.indications.filter(i => i.include !== false).length <= 1) { toast('At least one indication must be included.'); return; }
  dispatch(indicationIncluded({ assetId: subjectId(st), index, include, today: now().today }));
  record(`${include ? 'Included' : 'Excluded'} indication: ${ind.name}`);
  saveSubject();
}

/** Returns false when the value is rejected (the input reverts). */
export function updateIndication(index: number, key: keyof Pick<Indication, 'name' | 'orphanUS' | 'orphanEU' | 'launchUS' | 'launchUSMonth' | 'launchEU'>, raw: string): boolean {
  const st = getState();
  if (!canEditGoverned(st.role)) return false;
  const val = raw.trim();
  if ((key === 'launchUS' || key === 'launchEU') && val && !/^\d{4}$/.test(val)) { toast('Enter a 4-digit launch year.'); return false; }
  if (key === 'name' && !val) { toast('Indication name is required.'); return false; }
  if ((key === 'orphanUS' || key === 'orphanEU') && !['Yes', 'No'].includes(val)) return false;
  if (key === 'launchUSMonth' && val && !MONTHS.includes(val)) return false;
  const id = subjectId(st), { stamp, today } = now();
  dispatch(indicationUpdated({ assetId: id, index, key, value: key === 'name' ? val.slice(0, 80) : val, who: userLabel(st), stamp, today }));
  saveSubject();
  saveFieldsFor(id);
  return true;
}

export function goToFields() {
  const st = getState(), a = subjectOf(st);
  if (!a?.aia) return;
  if (!a.aia.setup.indications.some(i => i.include !== false)) { toast('Include at least one indication to continue.'); return; }
  if (viewBlockedByIndications(st, a, 'fields')) { toast(`Enter the ${missingBeforeView(st, a, 'fields').length} required indication inputs first.`); return; }
  dispatch(indicationFieldsEnsured({ assetId: subjectId(st) }));
  saveFieldsFor(subjectId(st));
  toTop();
}

export function goToJudgment() {
  const st = getState(), a = subjectOf(st);
  if (a?.aia && viewBlockedByIndications(st, a, 'judgment')) { toast(`Enter the ${missingBeforeView(st, a, 'judgment').length} required inputs first.`); return; }
  patchView({ govView: 'judgment' });
  toTop();
}

export const setGovFilter = (filter: string) => patchView({ govFilter: filter });
export const selectGovRow = (fieldId: string | null) => patchView({ govRow: fieldId });

/** Which catalogue value an editor changes: item key plus the indication or competitor it belongs to. */
export interface InputTarget { key: string; indId?: string; compIndex?: number }
/** How the editor changed it: a whole value, one checkbox of a list, one year of a series, or the year/month half of US launch. */
export type InputEdit =
  | { kind: 'value'; raw: string }
  | { kind: 'toggle'; option: string; checked: boolean }
  | { kind: 'year'; index: number; raw: string; country?: string }
  | { kind: 'ym'; part: 'y' | 'm'; raw: string }
  | { kind: 'extra'; raw: string };

/** Inputs entered on Data Submission may be edited by every role (as in v07); the rest need Admin or Editor. */
const SUBMISSION_INPUTS = ['modality', 'launchMarkets'];

function nextValue(cur: RowValue, it: { type: string; opts?: string[]; extra?: { type: 'num' | 'text' } }, edit: InputEdit): RowValue | undefined {
  if (edit.kind === 'extra') {
    const raw = edit.raw.trim();
    if (it.extra?.type === 'num') {
      const n = num(raw);
      if (raw && (n == null || n < 0 || n > 30)) { toast('Enter a number of countries (0-30).'); return undefined; }
      return raw === '' ? '' : n;
    }
    return it.extra ? raw.slice(0, 200) : undefined;
  }
  if (edit.kind === 'toggle') {
    if (!it.opts?.includes(edit.option)) return undefined;
    const set = new Set(Array.isArray(cur) ? cur.map(String) : []);
    if (edit.checked) set.add(edit.option); else set.delete(edit.option);
    return it.opts.filter(o => set.has(o));
  }
  if (edit.kind === 'year') {
    const raw = edit.raw.trim(), n = raw === '' ? null : num(raw);
    if (edit.index < 0 || edit.index > 14) return undefined;
    if (raw !== '' && (n == null || n < 0 || n > 1e12)) { toast('Enter a number (0 or more).'); return undefined; }
    if (it.type === 'eu') {
      if (!edit.country) return undefined;
      const obj = { ...((cur && typeof cur === 'object' && !Array.isArray(cur) ? cur : {}) as Record<string, (number | null)[]>) };
      const arr = [...(obj[edit.country] || Array(15).fill(null))];
      arr[edit.index] = n;
      obj[edit.country] = arr;
      return obj;
    }
    const arr: (number | null)[] = Array.isArray(cur) ? [...(cur as (number | null)[])] : Array(15).fill(null);
    arr[edit.index] = n;
    return arr;
  }
  if (edit.kind === 'ym') {
    const raw = edit.raw.trim();
    if (edit.part === 'y' && raw && !/^\d{4}$/.test(raw)) { toast('Enter a 4-digit year.'); return undefined; }
    if (edit.part === 'm' && raw && !MONTHS.includes(raw)) return undefined;
    const ym = (cur && typeof cur === 'object' && 'y' in cur ? cur : { y: '', m: '' }) as { y: string; m: string };
    return { ...ym, [edit.part]: raw };
  }
  const raw = edit.raw.trim().slice(0, 200);
  if (it.type === 'year') {
    if (raw && !/^\d{4}$/.test(raw)) { toast('Enter a 4-digit year.'); return undefined; }
    return raw;
  }
  if (it.type === 'pct' || it.type === 'num') {
    const n = num(raw), max = it.type === 'pct' ? 100 : Infinity;
    if (raw && (n == null || n < 0 || n > max)) { toast(it.type === 'pct' ? 'Enter a percentage between 0 and 100.' : 'Enter a number (0 or more).'); return undefined; }
    return raw === '' ? '' : n;
  }
  if (it.type === 'sel' && raw && !it.opts?.includes(raw)) return undefined;
  return raw;
}

/**
 * Validate and save one catalogue input (v07 v6ApplyInput). Returns false when the value is rejected,
 * so the editor shows the stored value again.
 */
export function setInput(target: InputTarget, edit: InputEdit): boolean {
  const st = getState(), a = subjectOf(st);
  if (!a?.aia) return false;
  const allowed = SUBMISSION_INPUTS.includes(target.key) ? canEditAiaInputs(st.role) : canEditGoverned(st.role);
  if (!allowed) { toast('View only for your role'); return false; }
  const it = target.compIndex != null ? INPUT_ITEMS.find(x => x.lvl === 'comp' && x.k === target.key) : INPUT_ITEM[target.key];
  const ind = target.indId ? a.aia.setup.indications.find(i => i.id === target.indId) : undefined;
  const comp = target.compIndex != null ? a.aia.v6?.comp[target.compIndex] : undefined;
  if (!it || (it.lvl === 'ind' && !ind) || (it.lvl === 'comp' && !comp)) return false;
  const val = nextValue(readInput(st, a, it, ind, comp), it, edit);
  if (val === undefined) return false;
  const { stamp, today } = now(), id = subjectId(st);
  dispatch(inputChanged({ assetId: id, ...target, value: val, extra: edit.kind === 'extra', who: userLabel(st), stamp, today }));
  record(`Updated ${it.label}`);
  saveSubject();
  if (it.field || ['usLaunch', 'euLaunch', 'fdaOdd', 'emaOd'].includes(it.k)) saveFieldsFor(id);
  return true;
}

/** Resolve a conflict between document values: use one of them (index) or enter the value manually. */
export function chooseConflict(target: InputTarget, choice: number | 'manual') {
  const st = getState(), a = subjectOf(st), it = INPUT_ITEM[target.key];
  if (!a?.aia || !it) return;
  if (!canEditGoverned(st.role)) { toast('View only for your role'); return; }
  const { stamp, today } = now(), id = subjectId(st);
  dispatch(conflictChosen({ assetId: id, key: target.key, indId: target.indId, choice, who: userLabel(st), stamp, today }));
  record(choice === 'manual' ? `Conflict on ${it.label}: entered manually` : `Conflict on ${it.label}: used a document value`);
  saveSubject();
  if (it.field || ['usLaunch', 'euLaunch', 'fdaOdd', 'emaOd'].includes(it.k)) saveFieldsFor(id);
}

/** Clicking the selected Key Assumptions answer clears it; any other answer selects it. */
export function toggleAnswer(target: InputTarget, option: string) {
  const st = getState(), a = subjectOf(st), it = target.compIndex != null ? INPUT_ITEMS.find(x => x.lvl === 'comp' && x.k === target.key) : INPUT_ITEM[target.key];
  if (!a?.aia || !it) return;
  const ind = target.indId ? a.aia.setup.indications.find(i => i.id === target.indId) : undefined;
  const comp = target.compIndex != null ? a.aia.v6?.comp[target.compIndex] : undefined;
  setInput(target, { kind: 'value', raw: str(readInput(st, a, it, ind, comp)) === option ? '' : option });
}

/** Edit a governed value. Returns true when handled (the input keeps the stored value otherwise). */
export function editField(fieldId: string, raw: string): boolean {
  const st = getState();
  if (!canEditGoverned(st.role)) { toast('View only for your role'); return false; }
  const f = st.fields.find(x => x.id === fieldId), value = raw.trim().slice(0, 200);
  if (!f || String(f.value) === value) return true;
  const { stamp, today } = now();
  dispatch(fieldEdited({ assetId: subjectId(st), fieldId, value, who: userLabel(st), stamp, today }));
  record(`Updated ${f.field}`);
  saveField(fieldId);
  saveSubject();
  return true;
}

/** Net revenue for one year of the 15-year window ($M). Returns false when the value is rejected (the input reverts). */
export function editRevenueYear(index: number, raw: string): boolean {
  const st = getState(), a = subjectOf(st);
  if (!a?.aia || !canEditGoverned(st.role)) return false;
  const val = num(raw);
  if (val == null || val < 0 || val > 1e6 || index < 0 || index > 14) { toast('Enter net revenue in $M (0 or more).'); return false; }
  const series = [...revenueSeries(st, a)];
  series[index] = val;
  dispatch(revenueEdited({ assetId: subjectId(st), series, today: now().today }));
  record(`Updated net revenue Year ${index + 1}`);
  saveSubject();
  return true;
}

export function resolveConflict(fieldId: string, which: 'primary' | 'alternate') {
  const st = getState();
  if (!canEditGoverned(st.role)) return;
  const f = st.fields.find(x => x.id === fieldId);
  if (!f) return;
  const val = which === 'alternate' ? f.alternate || '' : f.value, { stamp, today } = now();
  dispatch(fieldEdited({ assetId: subjectId(st), fieldId, value: val, who: userLabel(st), stamp, today, note: `Changed conflict → ${val} (${which === 'alternate' ? 'Forecast' : 'CDP'})` }));
  record(`Updated ${f.field}`);
  saveField(fieldId);
  saveSubject();
  closeDrawer();
  toast('Source conflict resolved and recorded.');
}

/** "Edit in Inputs and Assumptions" from an eligibility check drawer. */
export function editInGovernance(fieldId: string | null) {
  closeDrawer();
  patchView({ govView: 'fields', govFilter: 'All' });
  goTab('governance', 'fields');
  if (fieldId) {
    setTimeout(() => {
      const row = document.querySelector(`[data-gov-row="${CSS.escape(fieldId)}"]`);
      row?.scrollIntoView({ block: 'center' });
      row?.querySelector<HTMLInputElement>('input')?.focus();
    }, 50);
  }
}

export function answerQuestion(questionId: string, value: string, indId?: string) {
  const st = getState(), q = st.questions.find(x => x.id === questionId);
  if (!q) return;
  dispatch(questionAnswered({ id: questionId, value, indId, who: userLabel(st) }));
  record(`Updated judgment: ${q.text}`);
  saveQuestion(questionId);
}

/** "Confirm & run assessment" → unlocks Eligibility. Says what happened: missing inputs, a failed save, or success once the data is saved. */
export async function runAssessment() {
  const st = getState(), a = subjectOf(st);
  if (!a || isLoaderRunning()) return;
  if (!canEditAiaInputs(st.role)) { toast('Only Admin and Editor roles can run the assessment.'); return; }
  const missing = inputsGated(a) ? missingInputs(st, a) : [];
  if (missing.length) {
    const names = missing.map(r => r.it.label + (r.ind ? ' · ' + r.ind.name : ''));
    const shown = names.slice(0, 3).join('; '), more = names.length > 3 ? ` and ${names.length - 3} more` : '';
    toast(`Cannot run the assessment: ${missing.length} required input${missing.length === 1 ? '' : 's'} missing (${shown}${more}).`);
    toTop();
    return;
  }
  assessmentService.runEligibility(a.id).catch(fail('The assessment could not be run.'));
  await runLoader('Running eligibility assessment…', ELIGIBILITY_STEPS);
  dispatch(workflowAdvanced({ assetId: a.id, tab: 'eligibility', who: userLabel(getState()), today: now().today }));
  record('Saved judgment review');
  saveSubject();
  inputsService.replaceQuestions(a.id, getState().questions.filter(q => q.assetId === a.id)).catch(fail('Answers could not be saved.'));
  toTop();
  // Say so only once the data is really saved (a failed save has already shown its own message).
  if (await assetSaved(a.id)) toast('Assessment confirmed. Your inputs and assumptions were saved.');
  else toast('Your changes are still on screen but could not be saved. Please try again.');
}

/* ======================= Eligibility ======================= */

export const selectCheck = (key: string) => patchView({ check: key });
export const setJcaIndication = (index: number) => patchView({ jcaInd: index, check: 'JCA-0' });

/** "Run impact analysis →" (or go straight to Impact if it already ran). */
export async function runImpact() {
  const st = getState(), a = subjectOf(st);
  if (!a?.aia) return;
  if (isUnlocked(a, 'impact')) { goTab('impact'); return; }
  if (!canEdit(st.role)) { toast('Only Admin and Editor roles can run the impact analysis.'); return; }
  if (isLoaderRunning()) return;
  assessmentService.runImpact(a.id).catch(fail('The impact analysis could not be run.'));
  await runLoader('Running impact analysis…', ANALYSIS_STEPS);
  dispatch(workflowAdvanced({ assetId: a.id, tab: 'impact', who: userLabel(getState()), today: now().today }));
  record('Ran impact analysis');
  saveSubject();
  toTop();
}

/* ======================= Impact & Recommendations ======================= */

export const setPolicyView = (code: PolicyCode) => patchView({ policyView: code });

export function togglePolicyOn(code: PolicyCode, inScopeCodes: PolicyCode[]) {
  const a = subjectOf(getState());
  if (!a?.aia) return;
  const on = Object.entries(a.aia.policiesOn).filter(([c, v]) => v && inScopeCodes.includes(c as PolicyCode));
  if (a.aia.policiesOn[code] && on.length <= 1) { toast('Keep at least one policy selected'); return; }
  patchView({ policiesOn: { ...a.aia.policiesOn, [code]: !a.aia.policiesOn[code] } });
}

/* ======================= Scenario Analysis ======================= */

export const resetScenario = () => patchView({ scn: {} });

export function addScenarioRow() {
  const a = subjectOf(getState());
  if (!a?.aia) return;
  const rows = scnRowsOf(a.aia);
  if (rows.length < SCN_MAX) {
    const next = SCN_VARS.find(d => !rows.includes(d.k));
    if (next) rows.push(next.k);
  }
  patchView({ scnRows: rows });
}

export function removeScenarioRow(index: number) {
  const a = subjectOf(getState());
  if (!a?.aia) return;
  const rows = scnRowsOf(a.aia), scn = { ...(a.aia.scn || {}) };
  if (rows.length > 1 && index >= 0 && index < rows.length) {
    const [k] = rows.splice(index, 1);
    delete scn[k];
  }
  patchView({ scnRows: rows, scn });
}

export function setScenarioVariable(index: number, key: string) {
  const a = subjectOf(getState());
  if (!a?.aia) return;
  const rows = scnRowsOf(a.aia), scn = { ...(a.aia.scn || {}) };
  if (SCN_VARS.some(d => d.k === key) && index >= 0 && index < rows.length && !rows.some((k, j) => j !== index && k === key)) {
    delete scn[rows[index]];
    rows[index] = key as ScnKey;
  }
  patchView({ scnRows: rows, scn });
}

export function setScenarioValue(key: ScnKey, raw: string) {
  const a = subjectOf(getState());
  if (!a?.aia) return;
  const val = key === 'seq' ? raw : Number(raw);
  if (typeof val === 'number' && Number.isNaN(val)) return;
  patchView({ scn: { ...(a.aia.scn || {}), [key]: val } });
}

export function saveScenario() {
  const st = getState(), a = subjectOf(st);
  if (!a?.aia) return;
  if (!canEdit(st.role)) { toast('Only Admin and Editor roles can save scenarios.'); return; }
  const c = scenarioCompute(st, a);
  const saved = { name: `Scenario ${(a.aia.savedScenarios || []).length + 1}`, time: now().stamp, by: userLabel(st), vals: { ...(a.aia.scn || {}) }, delta: c.ns - c.nb };
  dispatch(scenarioSaved({ assetId: subjectId(st), saved }));
  record(`Saved scenario for ${a.assetCode || a.aia.setup.name}`);
  if (!isDraft(a)) assessmentService.saveScenario(a.id, saved).catch(fail('The scenario could not be saved.'));
  toast('Scenario saved.');
}
