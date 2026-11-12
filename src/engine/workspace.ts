/**
 * Assessment workspace: set-up, generated starter fields and judgment questions,
 * and accessors. Ported from the v03 HTML (ensureAia, generateFields, …).
 * Functions named ensureX, seedX, syncX and setX MUTATE the draft passed in; call them only
 * inside Redux reducers (Immer drafts), never during render. They are deterministic:
 * ids are derived from the data and timestamps are passed in, so reducers stay pure.
 */
import type { AppState } from '../store/appState';
import type {
  AiaTab, Asset, AssessmentRecord, AssessmentSetup, AssessmentWorkspace, ExtractedField, Indication, JudgmentQuestion,
  PolicyCode, SourceDocument
} from '../types/domain';
import { AIA_ORDER, MODALITIES, ROUTES } from './constants';
import { seedInputs } from './inputCatalogue';
import { ref } from './reference';

type FieldCtx = Pick<AppState, 'fields'>;
type QuestionCtx = Pick<AppState, 'questions'>;
type DocCtx = Pick<AppState, 'documents'>;

/** Stable ids: one generated field per (asset, group, field); one question per (asset, position). */
export const fieldIdOf = (assetId: string, group: string, field: string) => `${assetId}|${group}|${field}`;
export const questionIdOf = (assetId: string, index: number) => `${assetId}|Q${index + 1}`;

export const isLegacyAsset = (a: Asset | null | undefined) => !!a && !a.aia?.created && a.id !== 'TAK-481' && a.id !== 'TEST-100';

export function routeFrom(coverage = ''): string {
  if (ROUTES.includes(coverage)) return coverage;
  if (/part b/i.test(coverage)) return 'IV · Part B';
  return 'Oral · Part D';
}

export function classFrom(area = ''): string {
  return /onc/i.test(area) ? 'Antineoplastic' : /hemat/i.test(area) ? 'Hematologic' : /immun/i.test(area) ? 'Immunomodulator'
    : /neuro|cns/i.test(area) ? 'Neurologic' : /metab|endo/i.test(area) ? 'Endocrine' : 'Antineoplastic';
}

export const newSetup = (): AssessmentSetup => ({ name: '', area: '', stage: '', modality: '', route: '', tclass: '', indications: [] });

export const sampleIndications = (): Indication[] => [
  { name: '2L solid tumor', orphanUS: 'No', orphanEU: 'No', launchUS: '2027', launchEU: '2028', include: true, source: 'CDP' },
  { name: 'Rare hematologic cancer', orphanUS: 'Yes', orphanEU: 'Yes', launchUS: '2029', launchEU: '2030', include: true, source: 'CDP' }
];

export function baseAia(extra: Partial<AssessmentWorkspace> = {}): AssessmentWorkspace {
  return {
    created: false, unlocked: [...AIA_ORDER], govView: 'indications', govFilter: 'All', govSearch: '', govRow: null, impactView: 'policy',
    jcaInd: 0, check: 'IRA-3', priority: 62, variables: ref().defaultVariables.map(v => ({ ...v })),
    policiesOn: { IRA: true, MFN: true, JCA: true, 'EU-GPL': true }, scenario: 'Base', applyRecs: true, openMitigation: 'A',
    confirmedBy: '', confirmedAt: '', setup: newSetup(), base: { peakUS: 0, peakEU: 0 }, ...extra
  };
}

export function ensureIndIds(st: AssessmentSetup) {
  st.indSeq = st.indSeq || 0;
  (st.indications || []).forEach(i => { if (!i.id) i.id = 'IND-' + (++st.indSeq!); });
}

export const aia = (a: Asset): AssessmentWorkspace => {
  if (!a.aia) throw new Error(`Asset ${a.id} has no assessment workspace (call ensureAia first).`);
  return a.aia;
};

export const displayName = (a: Asset | null | undefined) => (a?.aia?.setup?.name || '').trim() || a?.assetName || '';
export const isUnlocked = (a: Asset, tab: AiaTab) => aia(a).unlocked.includes(tab) || (tab === 'scenario' && aia(a).unlocked.includes('impact'));
export function unlock(a: Asset, ...tabs: AiaTab[]) {
  tabs.forEach(t => { if (!aia(a).unlocked.includes(t)) aia(a).unlocked.push(t); });
}

/* ---------------- documents ---------------- */
export const docTypes = (d: SourceDocument) => (Array.isArray(d.types) && d.types.length ? d.types : [d.type]);
export const hasType = (d: SourceDocument, t: string) => docTypes(d).includes(t);
export const assetDocs = (s: DocCtx, a: Asset, competitor = false) => s.documents.filter(d => d.assetId === a.id && !!d.competitor === competitor);

export function guessDocType(name: string): string {
  const n = name.toLowerCase(), ext = n.split('.').pop() || '';
  if (/protocol|concept/.test(n)) return 'Protocol';
  if (/ci|competit|intelligence/.test(n)) return 'CI';
  if (/forecast|revenue/.test(n) || ['xls', 'xlsx', 'xlsm', 'csv'].includes(ext)) return 'Forecast';
  return 'CDP';
}

/* ---------------- fields & questions ---------------- */
export function assetFields(s: FieldCtx, a: Asset): ExtractedField[] {
  const ex = new Set((a.aia?.setup?.indications || []).filter(i => i.include === false).map(i => i.id));
  return s.fields.filter(f => f.assetId === a.id && !(f.indId && ex.has(f.indId)));
}

export function assetQuestions(s: QuestionCtx, a: Asset): JudgmentQuestion[] {
  return s.questions.filter(q => q.assetId === a.id && q.gen && !['Regulatory, supply & SKU', 'Trial population & subgroups'].includes(q.group)
    && !/priced at a premium|^robust head-to-head/i.test(q.text));
}

export function fieldVal(s: FieldCtx, a: Asset, name: string, groupPrefix?: string): string {
  const f = assetFields(s, a).find(x => x.field === name && (!groupPrefix || x.group.startsWith(groupPrefix)));
  return f ? String(f.value || '') : '';
}

/** Empty spend / generic ('') leave the value blank, as when the forecast was not uploaded. */
interface GenOptions { legacy?: boolean; noConflict?: boolean; spend: number | ''; prevSpend: number | ''; generic: number | ''; maa: string }

export function generateFields(a: Asset, o: GenOptions): ExtractedField[] {
  const s = aia(a).setup, part = s.route.includes('Part D') ? 'Part D' : 'Part B', list: ExtractedField[] = [];
  ensureIndIds(s);
  const f = (group: string, field: string, value: string, confidence: string, source: string, feeds: PolicyCode[], status: ExtractedField['status'] = 'AI-extracted', extra: Partial<ExtractedField> = {}) => {
    const m = /^Indication (\d+) ·/.exec(group), iid = m ? s.indications[Number(m[1]) - 1]?.id : undefined;
    list.push({
      id: fieldIdOf(a.id, group, field), assetId: a.id, gen: true, group, field, value, confidence, source, feeds, status,
      history: [{ time: '10 Oct, 14:09', who: 'AI', text: 'Extracted from source document' }], ...(iid ? { indId: iid } : {}), ...extra
    });
  };
  s.indications.forEach((ind, i) => {
    const g = `Indication ${i + 1} · ${ind.name || 'New indication'}`, ou = ind.orphanUS || 'No', oe = ind.orphanEU || 'No';
    f(g, 'Orphan designation', `${ou} (US) · ${oe} (EU)`, 'High', `CDP · p.${4 + i}`, ['IRA', 'JCA', 'EU-GPL']);
    f(g, 'US launch year', ind.launchUS || '', i === 0 ? 'High' : 'Med', `CDP · p.${6 + i}`, ['IRA', 'MFN']);
    if (i === 0 && ind.launchEU && !o.noConflict) {
      const alt = String(Number(ind.launchEU) + 1);
      f(g, 'EU launch year', ind.launchEU, 'Low', 'CDP · p.4 / Forecast · tab 1', ['JCA', 'EU-GPL'], 'Conflict', {
        alternate: alt,
        history: [{ time: '10 Oct, 14:18', who: 'System', text: `Conflict raised: CDP ${ind.launchEU} vs Forecast ${alt}` }, { time: '10 Oct, 14:09', who: 'AI', text: 'Extracted from 2 sources' }]
      });
    } else if (ind.launchEU && (i === 0 || o.noConflict)) f(g, 'EU launch year', ind.launchEU, 'Med', 'CDP (placeholder)', ['JCA', 'EU-GPL']);
  });
  if (o.legacy) f('Key Inputs', 'Assumed annual Medicare spend', o.spend === '' ? '' : `$${o.spend}M`, 'Med', 'Forecast · tab 3', ['IRA', 'MFN']);
  else f('Key Inputs', 'Assumed annual Medicare spend', `$${o.spend}M`, 'Med', 'Forecast · tab 3', ['IRA', 'MFN'], 'Edited', {
    prev: `$${o.prevSpend}M`,
    history: [{ time: '10 Oct, 14:21', who: 'Demo Admin', text: `Changed $${o.prevSpend}M → $${o.spend}M` }, { time: '10 Oct, 14:09', who: 'AI', text: `Extracted $${o.prevSpend}M from Forecast_v3.xlsx` }]
  });
  f('Key Inputs', 'Modality', s.modality, 'High', 'Manual', ['IRA', 'MFN']);
  f('Key Inputs', 'Medicare coverage', part, 'High', 'Manual', ['IRA', 'MFN']);
  f('Key Inputs', 'Expected generic entry year', String(o.generic), 'Med', 'Forecast · tab 1', ['IRA']);
  if (o.maa && o.legacy) f('Key Inputs', 'EU MAA year', o.maa, 'Med', 'Forecast · tab 1', ['JCA', 'EU-GPL']);
  else if (o.maa) f('Key Inputs', 'EU MAA year', o.maa, 'High', 'You entered', ['JCA', 'EU-GPL'], 'Edited', {
    prev: '', history: [{ time: '10 Oct, 14:24', who: 'Demo Admin', text: `Changed — → ${o.maa}` }, { time: '10 Oct, 14:18', who: 'System', text: 'Marked missing: not found in documents' }]
  });
  else f('Key Inputs', 'EU MAA year', '', '', 'Not found', ['JCA', 'EU-GPL'], 'Missing', { history: [{ time: '10 Oct, 14:18', who: 'System', text: 'Marked missing: not found in documents' }] });
  return list;
}

/** Judgment questions for a new asset, answered with the AI suggestion. */
export const starterQuestions = (assetId: string): JudgmentQuestion[] =>
  ref().judgmentQuestions.map((q, i) => ({ ...structuredClone(q), id: questionIdOf(assetId, i), assetId, answer: q.ai, gen: true }));

function test100Question(q: JudgmentQuestion): JudgmentQuestion {
  const set = (ai: string, evidence: string, source: string, confidence: string): JudgmentQuestion => ({ ...q, ai, answer: ai, evidence, source, confidence });
  if (/unmet need/i.test(q.text)) return set('Yes', 'No approved treatments for anemia in MF.', 'CDP · p.35', 'High');
  if (/clinical differentiation/i.test(q.text)) return set('Low', 'Set to Low per client guidance; confirm.', 'Client guidance', 'Med');
  if (/key stakeholders for JCA/i.test(q.text)) return set('No', 'Set to No per client guidance; confirm.', 'Client guidance', 'Med');
  if (/access challenge/i.test(q.text)) return set('Yes', 'Set to Yes per client guidance; confirm.', 'Client guidance', 'Med');
  if (/payer value recognition/i.test(q.text)) return set('Yes', 'Set to Yes per client guidance; confirm.', 'Client guidance', 'Med');
  if (/OS data/i.test(q.text)) return set('No', 'OS is not a CDP endpoint; primary endpoint is RBC-TI.', 'CDP · p.1', 'Med');
  return set('Unknown', 'Placeholder: to be confirmed from the TEST-100 documents.', 'Pending input', 'Low');
}

/**
 * Create the assessment workspace for an asset that has none, plus its starter
 * fields and judgment questions. Mutates `s`. No-op when `a.aia` exists.
 */
export function ensureAia(s: Pick<AppState, 'fields' | 'questions'>, a: Asset): Asset {
  if (!a || a.aia) return a;
  const c = a.context || {}, sample = a.id === 'TAK-481' || a.id === 'TEST-100';
  const indName = a.assetName.replace(`${a.assetCode} `, '');
  const rare = /rare|orphan/i.test(a.assetName + a.therapeuticArea) ? 'Yes' : 'No';
  const setup: AssessmentSetup = {
    name: a.assetName, area: a.therapeuticArea, stage: a.stage,
    modality: MODALITIES.includes(String(c.modality)) ? String(c.modality) : 'Small molecule',
    route: routeFrom(String(c.coverage || '')), tclass: classFrom(a.therapeuticArea),
    indications: a.id === 'TEST-100'
      ? [
        { name: '1L myelofibrosis (combination)', orphanUS: 'Yes', orphanEU: 'Yes', launchUS: '2031', launchEU: '2032', include: true, source: 'CDP' },
        { name: '2L LR-MDS', orphanUS: 'No', orphanEU: 'No', launchUS: '2029', launchEU: '2030', include: true, source: 'CDP' },
        { name: '1L LR-MDS', orphanUS: 'No', orphanEU: 'No', launchUS: '2032', launchEU: '2033', include: true, source: 'CDP' }
      ]
      : sample ? sampleIndications()
        : [{ name: indName, orphanUS: rare, orphanEU: rare, launchUS: c.launchUS ? String(c.launchUS) : '', launchEU: c.launchEU ? String(c.launchEU) : '' }]
  };
  if (!sample && a.eligibility?.MFN === 'In scope') {
    const thr = /part d/i.test(String(c.coverage || '')) ? 69 : 100;
    if ((c.medicareSpend || 0) <= thr) c.medicareSpend = thr + 12;
  }
  if (!sample && a.eligibility?.IRA === 'In scope' && (c.medicareSpend || 0) <= 200) c.medicareSpend = 215;
  a.context = c;
  ensureIndIds(setup);
  a.aia = baseAia({
    setup,
    base: { peakUS: a.summaryMetrics?.usRevenue ?? c.usRevenue ?? 0, peakEU: a.summaryMetrics?.euRevenue ?? c.euRevenue ?? 0 },
    priority: c.priority === 'Speed to market' ? 30 : 62
  });

  if (!s.fields.some(f => f.assetId === a.id && f.gen)) {
    s.fields.push(...generateFields(a, a.id === 'TEST-100'
      ? { legacy: true, noConflict: true, spend: 295, prevSpend: 0, generic: 2043, maa: '2032' }
      : sample ? { spend: 205, prevSpend: 190, generic: 2034, maa: '2029' }
        : { legacy: true, spend: c.medicareSpend || 0, prevSpend: 0, generic: (Number(c.launchUS) || 2028) + 7, maa: c.launchEU ? String(Number(c.launchEU) + 1) : '' }));
  }
  if (!s.questions.some(q => q.assetId === a.id && q.gen)) {
    const qs = starterQuestions(a.id);
    s.questions.push(...(a.id === 'TEST-100' ? qs.map(test100Question) : qs));
  }

  if (a.id === 'TEST-100') {
    const mine = s.fields.filter(x => x.assetId === a.id && x.gen);
    mine.forEach(x => {
      const fc = /^Forecast/.test(x.source);
      x.source = String(x.source).replace(/ · p\.\d+| · tab \d+/g, ' (placeholder)');
      if (fc) { x.source = 'Placeholder · forecast pending'; x.status = 'Needs review'; x.confidence = 'Low'; }
    });
    const firstInd = setup.indications[0]?.id;
    mine.forEach(x => {
      const needsReview = (src: string) => { x.source = src; x.status = 'Needs review'; x.confidence = 'Low'; };
      if (x.indId && x.indId !== firstInd) { x.source = 'CDP (illustrative)'; x.status = 'Needs review'; x.confidence = 'Low'; return; }
      if (x.field === 'Modality') x.source = 'Manual';
      else if (x.field === 'Orphan designation') needsReview('Manual');
      else if (x.field === 'Medicare coverage') needsReview('Manual');
      else if (x.field === 'US launch year') { x.source = 'CDP (illustrative)'; x.confidence = 'High'; x.status = 'AI-extracted'; }
      else if (x.field === 'EU launch year' || x.field === 'EU MAA year') { x.source = 'CDP (illustrative)'; x.confidence = 'Med'; x.status = 'AI-extracted'; }
      else if (x.field === 'Assumed annual Medicare spend') { x.source = 'Forecast (mock) · Outputs'; x.confidence = 'Med'; x.status = 'AI-extracted'; }
      else if (x.field === 'Expected generic entry year') { x.source = 'Forecast (mock) · Launch Assumptions'; x.confidence = 'Med'; x.status = 'AI-extracted'; }
    });
  }
  seedInputs(a, setup.stage);
  return a;
}

/* ---------------- per-indication judgment answers ---------------- */
export const summarizeAnswers = (ans: Record<string, string> | undefined) => {
  const v = Object.values(ans || {});
  return v.includes('Yes') ? 'Yes' : v.includes('Partial') ? 'Partial' : v.includes('No') ? 'No' : v.length ? 'Unknown' : '';
};
export const indsOf = (a: Asset) => (aia(a).setup.indications || []).filter(i => i.include !== false);

/** Give per-indication questions an answer per indication. Mutates the question. */
export function seedPerInd(a: Asset, q: JudgmentQuestion) {
  if (!q.perIndication || q.answers) return;
  q.answers = {};
  (aia(a).setup.indications || []).forEach((ind, i) => { q.answers![ind.id!] = a.id === 'TEST-100' ? (i === 0 ? q.ai : 'Unknown') : q.ai; });
  q.answer = summarizeAnswers(q.answers);
}

/* ---------------- indications ↔ fields ---------------- */
export function prepIndications(s: FieldCtx, a: Asset) {
  const st = aia(a).setup;
  ensureIndIds(st);
  s.fields.filter(x => x.assetId === a.id && !x.indId).forEach(x => {
    const m = /^Indication (\d+) ·/.exec(x.group), i = m ? st.indications[Number(m[1]) - 1] : null;
    if (i) x.indId = i.id;
  });
}

export function ensureIndicationFields(s: FieldCtx, a: Asset) {
  prepIndications(s, a);
  const st = aia(a).setup, have = new Set(s.fields.filter(x => x.assetId === a.id && x.indId).map(x => x.indId));
  const missing = new Set(st.indications.filter(i => !have.has(i.id)).map(i => i.id));
  if (!missing.size) return;
  s.fields.push(...generateFields(a, { spend: 0, prevSpend: 0, generic: 2034, maa: '' }).filter(x => x.indId && missing.has(x.indId)));
}

export function syncIndicationFields(s: FieldCtx, a: Asset, ind: Indication, who: string, stamp: string) {
  const setVal = (x: ExtractedField, v: string) => {
    if (String(x.value) === String(v)) return;
    x.prev = x.prev || x.value;
    x.history = [{ time: stamp, who, text: `Changed ${x.value || '—'} → ${v || '—'} (indication confirmation)` }, ...(x.history || [])];
    x.value = v;
    x.status = 'Edited';
  };
  s.fields.filter(x => x.assetId === a.id && x.indId === ind.id).forEach(x => {
    x.group = x.group.replace(/·.*$/, '· ' + (ind.name || 'New indication'));
    if (x.field === 'Orphan designation') setVal(x, `${ind.orphanUS} (US) · ${ind.orphanEU} (EU)`);
    if (x.field === 'US launch year') setVal(x, ind.launchUS);
    if (x.field === 'EU launch year' && x.status !== 'Conflict') setVal(x, ind.launchEU);
  });
}

/** Set a governed field value and record history. Mutates the field. Returns false when unchanged. */
export function setFieldValue(f: ExtractedField, value: string, who: string, stamp: string, note?: string): boolean {
  const old = f.value;
  if (String(old) === String(value)) return false;
  if (f.status === 'Conflict') { f.alternate = ''; f.confidence = 'High'; }
  if (f.status === 'Missing') { f.source = 'You entered'; f.confidence = 'High'; }
  if (!f.prev && f.status !== 'Missing' && f.status !== 'Conflict') f.prev = old;
  f.value = value;
  f.status = 'Edited';
  f.history = [{ time: stamp, who, text: note || `Changed ${old || '—'} → ${value}` }, ...(f.history || [])];
  return true;
}

/* ---------------- assessment history ---------------- */
export function ensureAssessments(a: Asset): AssessmentRecord[] {
  if (!a.assessments) {
    a.assessments = [{ id: 'AS-1', date: a.lastUpdatedAt, by: a.owner, status: 'Current', level: a.estimatedImpactLevel, atRisk: a.estimatedAtRisk, completeness: a.submissionCompleteness }];
    if (!a.createdByRole && a.id !== 'TEST-100') a.assessments.push({ id: 'AS-0', date: '08 Jul 2026', by: a.owner, status: 'Completed', level: a.estimatedImpactLevel, atRisk: Math.round(a.estimatedAtRisk * 1.08), completeness: Math.max(0, a.submissionCompleteness - 12) });
  }
  return a.assessments;
}

export const lastAssessmentDate = (a: Asset) => (a.assessments || []).find(x => x.status === 'Current')?.date || '—';
