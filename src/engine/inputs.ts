/**
 * Input catalogue: read, write, required-input gating and data coverage (v09 v6* functions).
 * Readers are pure. `writeInput` and `autoExtractInputs` MUTATE the draft passed in; call them only in reducers.
 */
import type { AiaTab, Asset, Competitor, Indication, InputConflict, InputValue } from '../types/domain';
import {
  DOC_SOURCES, EU_REFERENCE_COUNTRIES, grow, INPUT_ITEMS, INPUT_PHASES, LATE_PHASES, MODE_OF_ADMIN, indValues, isEmptyValue, phaseFrom, str, type InputItem
} from './inputCatalogue';
import { num } from './format';
import { aia, assetDocs, assetFields, docTypes, fieldVal, isUnlocked, setFieldValue, syncIndicationFields } from './workspace';
import type { Ctx } from './eligibility';

/** A year + month pair (US launch, submission and approval timing, EU MAA submission). */
export type YearMonth = { y: string; m: string };
export type RowValue = InputValue | YearMonth;
export interface InputRow { it: InputItem; ind?: Indication; comp?: Competitor; ci?: number; group: string; value: RowValue; req: boolean; cf?: InputConflict }
/** Page a missing required input is entered on. */
export type InputTab = 'submission' | 'indications' | 'fields' | 'judgment';

/** The extracted field that held the expected generic entry year before it became a catalogue input. */
const GENERIC_FIELD = 'Expected generic entry year';

const isYearMonth = (v: RowValue): v is YearMonth => !!v && typeof v === 'object' && !Array.isArray(v) && 'y' in v && 'm' in v;

/** Read one catalogue value. Year + month inputs are always returned as { y, m } (empty strings when not set). */
export function readInput(s: Ctx, a: Asset, it: InputItem, ind?: Indication, comp?: Competitor): RowValue {
  if (it.lvl === 'comp') return comp ? comp[it.k] : '';
  if (it.k === 'indications') return aia(a).setup.indications.filter(i => i.include !== false).map(i => i.name);
  if (it.lvl === 'ind' && !ind) return '';
  if (it.k === 'usLaunch') return { y: ind!.launchUS || '', m: ind!.launchUSMonth || '' };
  if (it.k === 'euLaunch') return ind!.launchEU || '';
  if (it.k === 'fdaOdd') return ind!.orphanUS || '';
  if (it.k === 'emaOd') {
    const v = indValues(ind).emaOd;
    return v != null && v !== '' ? v : ind!.orphanEU === 'Yes' ? 'Orphan' : ind!.orphanEU === 'No' ? 'No' : '';
  }
  if (it.field) return fieldVal(s, a, it.field);
  if (it.lvl === 'asset') {
    const v = aia(a).v6?.asset[it.k];
    // Assets built in the app keep this value as an extracted field until the catalogue value is entered.
    return (v == null || v === '') && it.k === 'generic' ? fieldVal(s, a, GENERIC_FIELD) : v;
  }
  const v = indValues(ind)[it.k];
  if (it.type === 'ym') { const ym = (v && typeof v === 'object' && 'y' in v ? v : {}) as Partial<YearMonth>; return { y: ym.y || '', m: ym.m || '' }; }
  return v;
}

/** Write a catalogue value. Mutates the draft; keeps the legacy indication/field values in step. */
export function writeInput(s: Ctx, a: Asset, it: InputItem, target: { ind?: Indication; comp?: Competitor }, val: RowValue, who: string, stamp: string) {
  const w = aia(a), { ind, comp } = target;
  w.v6 ??= { asset: {}, comp: [] };
  if (it.lvl === 'comp') { if (comp) comp[it.k] = val as InputValue; return; }
  if (it.lvl === 'ind' && !ind) return;
  const sync = () => syncIndicationFields(s, a, ind!, who, stamp);
  if (it.k === 'usLaunch' && isYearMonth(val)) { ind!.launchUS = val.y; ind!.launchUSMonth = val.m; sync(); return; }
  if (it.k === 'euLaunch') { ind!.launchEU = str(val); sync(); return; }
  if (it.k === 'fdaOdd') { ind!.orphanUS = str(val); sync(); return; }
  if (it.k === 'emaOd') {
    (ind!.v6 ??= {}).emaOd = str(val);
    ind!.orphanEU = val === '' ? '' : val === 'No' ? 'No' : 'Yes';
    sync();
    return;
  }
  if (it.field) {
    const f = assetFields(s, a).find(x => x.field === it.field);
    if (f) setFieldValue(f, str(val), who, stamp);
    return;
  }
  if (it.lvl === 'asset') {
    w.v6.asset[it.k] = val as InputValue;
    if (it.k === 'modality') w.setup.modality = str(val);
    if (it.k === 'generic') {
      const f = assetFields(s, a).find(x => x.field === GENERIC_FIELD);
      if (f) setFieldValue(f, str(val), who, stamp);
    }
    return;
  }
  (ind!.v6 ??= {})[it.k] = val as InputValue;
  // Unticking the option that asked the extra question clears the answer.
  if (it.extra && Array.isArray(val) && !(val as string[]).includes(it.extra.opt)) ind!.v6[it.extra.key] = '';
  if (it.k === 'trialDesign') clearInapplicable(a, ind!, ['h2h', 'notH2h']);
}

/**
 * When the answer a conditional input depends on changes, an input that no longer applies is emptied (with its extra answer),
 * so a value for a rule that is off does not stay behind. Example: Comparator Type only applies to a Head-to-head design.
 */
function clearInapplicable(a: Asset, ind: Indication, conds: InputItem['cond'][]) {
  INPUT_ITEMS.filter(x => x.lvl === 'ind' && x.cond && conds.includes(x.cond) && !isRequired(a, x, ind)).forEach(x => {
    ind.v6 ??= {};
    ind.v6[x.k] = x.type === 'multi' ? [] : '';
    if (x.extra) ind.v6[x.extra.key] = '';
  });
}

/** Store the answer to the extra question of a multi-select (for example the number of other EU countries). */
export function writeExtra(it: InputItem, ind: Indication | undefined, val: string | number) {
  if (it.extra && ind) (ind.v6 ??= {})[it.extra.key] = val;
}

/** The Launch Markets answer: "US", "EU" or "Global launch (including US and EU)" (older wording "US only launch" still works), or empty. */
export const launchMarketsOf = (a: Asset) => str(aia(a).v6?.asset.launchMarkets);

/** Is this input relevant for the launch markets? US-only inputs hide for an EU-only launch and the reverse; values already entered are kept. */
export function inputShown(a: Asset, it: InputItem): boolean {
  const lm = launchMarketsOf(a);
  if (/^US( only|$)/.test(lm)) return it.reg !== 'EU';
  if (/^EU( only|$)/.test(lm)) return it.reg !== 'US';
  return true;
}

/** Which region is out of scope for the chosen Launch Markets, or '' when both are shown. */
export function hiddenRegion(a: Asset): '' | 'US' | 'EU' {
  const lm = launchMarketsOf(a);
  return /^US( only|$)/.test(lm) ? 'EU' : /^EU( only|$)/.test(lm) ? 'US' : '';
}

/** The conflict recorded for an input, if any (competitor inputs have none). */
export function conflictOf(a: Asset, it: InputItem, ind?: Indication): InputConflict | undefined {
  if (it.lvl === 'comp') return undefined;
  return it.lvl === 'asset' ? aia(a).v6?.conflicts?.[it.k] : ind?.conflicts?.[it.k];
}

/** Pick one of the conflicting values (index) or enter the value manually. Mutates the draft; call only in reducers. */
export function resolveConflict(s: Ctx, a: Asset, it: InputItem, ind: Indication | undefined, choice: number | 'manual', who: string, stamp: string) {
  const cf = conflictOf(a, it, ind);
  if (!cf) return;
  if (choice === 'manual') { cf.state = 'manual'; cf.choice = null; return; }
  const o = cf.opts[choice];
  if (!o) return;
  writeInput(s, a, it, { ind }, o.v, who, stamp);
  cf.state = 'resolved';
  cf.choice = choice;
}

/** Typing a value settles an open conflict: the user's own value now stands. Mutates the draft. */
export function settleConflict(a: Asset, it: InputItem, ind?: Indication) {
  const cf = conflictOf(a, it, ind);
  if (cf?.state === 'open') { cf.state = 'manual'; cf.choice = null; }
}

/** Inputs with conflicting document values that the user has not reviewed yet (they never block the assessment). */
export function openConflicts(s: Ctx, a: Asset): InputRow[] {
  if (!a?.aia) return [];
  return [...inputRows(s, a, { noCalc: true }), ...inputRows(s, a, { judgment: true, noCalc: true })].filter(r => r.cf?.state === 'open');
}

/** Is this input required for this indication right now? Conditional inputs follow the rules in the input file's Note column. */
export function isRequired(a: Asset, it: InputItem, ind?: Indication): boolean {
  if (it.req) return true;
  if (!it.cond) return false;
  const iv = indValues(ind);
  switch (it.cond) {
    case 'h2h': return iv.trialDesign === 'Head-to-head';
    case 'notH2h': return !!iv.trialDesign && iv.trialDesign !== 'Head-to-head';
    case 'noUsShare': return isEmptyValue(iv.usShare);
    case 'noEuShare': return isEmptyValue(iv.euShare);
    case 'late': return aia(a).setup.indications.some(i => i.include !== false && LATE_PHASES.includes(str(indValues(i).phase)));
  }
}

/**
 * Rows for the Inputs tab (default: setup, indications and inputs locations) or the Assumptions tab (judgment).
 * Indication-level inputs repeat per included indication, competitor inputs per competitor.
 */
export function inputRows(s: Ctx, a: Asset, { judgment = false, noCalc = false } = {}): InputRow[] {
  const st = aia(a).setup, inds = st.indications.filter(i => i.include !== false), out: Omit<InputRow, 'value' | 'req' | 'cf'>[] = [];
  const keep = (it: InputItem) => (judgment ? it.loc === 'assumption' : it.loc !== 'assumption') && !(noCalc && it.src === 'Calc') && inputShown(a, it);
  INPUT_ITEMS.filter(it => it.lvl === 'asset' && keep(it)).forEach(it => {
    if (it.field && !assetFields(s, a).some(f => f.field === it.field)) return;
    out.push({ it, group: 'Asset' });
  });
  inds.forEach(ind => {
    const n = st.indications.indexOf(ind) + 1;
    INPUT_ITEMS.filter(it => it.lvl === 'ind' && keep(it)).forEach(it => out.push({ it, ind, group: `Indication ${n} · ${ind.name || 'New indication'}` }));
  });
  (aia(a).v6?.comp || []).forEach((c, ci) => {
    const vs = st.indications.find(i => i.id === c.vsId);
    INPUT_ITEMS.filter(it => it.lvl === 'comp' && keep(it)).forEach(it => out.push({ it, comp: c, ci, group: `Competitor · ${c.name}${vs ? ` (vs ${vs.name})` : ''}` }));
  });
  return out.map(r => ({ ...r, value: readInput(s, a, r.it, r.ind, r.comp), req: isRequired(a, r.it, r.ind), cf: conflictOf(a, r.it, r.ind) }));
}

export function isMissing(r: Pick<InputRow, 'it' | 'value'>): boolean {
  if (r.it.type === 'ym') return !isYearMonth(r.value) || !r.value.y || !r.value.m;
  return isEmptyValue(r.value);
}
export const isRequiredMissing = (r: InputRow) => r.req && r.it.src !== 'Calc' && isMissing(r);

/** Required-input gating applies to TEST-100 and to products added in the app. */
export const inputsGated = (a: Asset | null | undefined) => !!a && (a.id === 'TEST-100' || !!a.aia?.created);

const TAB_OF_LOC = { setup: 'submission', indications: 'indications', assumption: 'judgment', inputs: 'fields' } as const;
/** Page an input is entered on. */
export const tabOfInput = (it: InputItem): InputTab => TAB_OF_LOC[it.loc];

export function missingInputs(s: Ctx, a: Asset): (InputRow & { tab: InputTab })[] {
  if (!a?.aia) return [];
  const order = ['submission', 'indications', 'fields', 'judgment'];  // the page order: the first missing input is the earliest page
  return [...inputRows(s, a, { noCalc: true }), ...inputRows(s, a, { judgment: true, noCalc: true })]
    .filter(isRequiredMissing)
    .map(r => ({ ...r, tab: TAB_OF_LOC[r.it.loc] }))
    .sort((x, y) => order.indexOf(x.tab) - order.indexOf(y.tab));
}

const GATED_TABS: AiaTab[] = ['eligibility', 'impact', 'scenario'];
/** Missing required inputs keep Eligibility, Impact and Scenario Analysis locked (v07 isUnlocked). */
export const blockedByInputs = (s: Ctx, a: Asset, tab: AiaTab) =>
  inputsGated(a) && (
    (GATED_TABS.includes(tab) && missingInputs(s, a).length > 0) ||
    // Inputs and Assumptions needs the Data Submission set-up first (its own inputs can only be entered there).
    (tab === 'governance' && missingSetupInputs(s, a).length > 0)
  );

/** Required inputs entered on the Indications page that are still empty. */
export const missingIndicationInputs = (s: Ctx, a: Asset) => missingInputs(s, a).filter(m => m.tab === 'indications');

/** Required inputs still empty on the pages that come before a view: Inputs needs the Indications complete, Assumptions needs Indications and Inputs complete. */
export const missingBeforeView = (s: Ctx, a: Asset, view: string) => {
  if (!inputsGated(a) || (view !== 'fields' && view !== 'judgment')) return [];
  const before = view === 'fields' ? ['indications'] : ['indications', 'fields'];
  return missingInputs(s, a).filter(m => before.includes(m.tab));
};
export const viewBlockedByIndications = (s: Ctx, a: Asset, view: string) => missingBeforeView(s, a, view).length > 0;

/** Required inputs of the Data Submission set-up (asset name, modality, launch markets) that are still empty. */
export const missingSetupInputs = (s: Ctx, a: Asset) => missingInputs(s, a).filter(m => m.tab === 'submission');
export const isTabOpen = (s: Ctx, a: Asset, tab: AiaTab) => isUnlocked(a, tab) && !blockedByInputs(s, a, tab);

/** Confidence dot: NA for manual/calculated inputs, blank when nothing was found. */
export function inputConfidence(r: Pick<InputRow, 'it' | 'value' | 'cf'>): 'High' | 'Med' | 'Low' | 'NA' | '' {
  if (r.cf?.state === 'open') return 'Low';
  if (['Manual', 'Link', 'Calc'].includes(r.it.src)) return 'NA';
  if (r.it.src === 'None' || isMissing(r)) return '';
  return r.it.src === 'CDP' ? 'High' : 'Med';
}

/** Data coverage: document inputs that have a value. Manual and calculated inputs are not counted. */
export function inputCoverage(s: Ctx, a: Asset) {
  const rows = [...inputRows(s, a, { noCalc: true }), ...inputRows(s, a, { judgment: true, noCalc: true })].filter(r => DOC_SOURCES.includes(r.it.src));
  const found = rows.filter(r => !isMissing(r)), by: Record<string, number> = {};
  found.forEach(r => { by[r.it.src] = (by[r.it.src] || 0) + 1; });
  return { total: rows.length, covered: found.length, pct: rows.length ? Math.round(found.length / rows.length * 100) : 0, by };
}

/**
 * Demo extraction for a newly added product: fills the inputs whose source document type was uploaded
 * (illustrative values, v09 v6AutoExtract). Mutates the draft.
 */
export function autoExtractInputs(s: Ctx, a: Asset) {
  const w = aia(a), st = (w.v6 ??= { asset: {}, comp: [] }), types = new Set(assetDocs(s, a).flatMap(docTypes)), inds = w.setup.indications;
  if (types.has('CDP')) {
    if (!st.asset.modeAdmin) st.asset.modeAdmin = MODE_OF_ADMIN[1];
    inds.forEach(ind => {
      const v = (ind.v6 ??= {}), eu = num(ind.launchEU);
      if (!v.phase) v.phase = phaseFrom(w.setup.stage) || INPUT_PHASES[4];
      if (eu && !v.maaSub) v.maaSub = { y: String(eu - 1), m: 'Jan' };
      if (eu && !v.euApp) v.euApp = String(eu);
    });
  }
  if (types.has('Forecast')) {
    if (!Number(w.base?.peakUS) && !Number(w.base?.peakEU)) w.base = { peakUS: 420, peakEU: 180 };
    if (isEmptyValue(st.asset.generic)) { const g = fieldVal(s, a, GENERIC_FIELD); if (g) st.asset.generic = g; }
    if (isEmptyValue(st.asset.wac)) st.asset.wac = grow(150000, 0.03);
    if (isEmptyValue(st.asset.euPrice)) st.asset.euPrice = Object.fromEntries(EU_REFERENCE_COUNTRIES.map(c => [c, grow(80000, 0.02)]));
    inds.forEach(ind => {
      const v = (ind.v6 ??= {});
      if (v.duration == null || v.duration === '') v.duration = 12;
      if (isEmptyValue(v.usPop)) v.usPop = grow(6000, 0.02);
      if (isEmptyValue(v.usShare)) v.usShare = [2, 5, 8, 11, 13, 14, 15, 15, 15, 15, 15, 15, 15, 15, 13];
      if (isEmptyValue(v.euShare)) v.euShare = [1, 3, 5, 7, 9, 10, 11, 11, 11, 11, 11, 11, 11, 11, 10];
    });
  }
  if (types.has('Protocol')) inds.forEach(ind => {
    const v = (ind.v6 ??= {});
    if (!v.trialDesign) v.trialDesign = 'placebo-controlled';
    if (!v.pre) v.pre = 'Yes';
    if (!v.blinding) v.blinding = 'double-blind';
  });
  if (types.has('CI') && !st.comp.length) st.comp = [{ name: 'COMP-1', vsId: inds[0]?.id, cPhase: 'Launched', cApproval: '2025' }];
}
