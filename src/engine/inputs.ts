/**
 * Consolidated input catalogue: read, write, required-input gating and data coverage (v07 v6* functions).
 * Readers are pure. `writeInput` and `autoExtractInputs` MUTATE the draft passed in; call them only in reducers.
 */
import type { AiaTab, Asset, Competitor, Indication, InputValue } from '../types/domain';
import { revenueSeries } from './impact';
import { DOC_SOURCES, EU_REFERENCE_COUNTRIES, grow, INPUT_ITEMS, indValues, isEmptyValue, phaseFrom, str, type InputItem } from './inputCatalogue';
import { num } from './format';
import { aia, assetDocs, assetFields, docTypes, fieldVal, isUnlocked, setFieldValue, syncIndicationFields } from './workspace';
import type { Ctx } from './eligibility';

/** US launch is a year + month pair; everything else is a plain catalogue value. */
export type YearMonth = { y: string; m: string };
export type RowValue = InputValue | YearMonth;
export interface InputRow { it: InputItem; ind?: Indication; comp?: Competitor; ci?: number; group: string; value: RowValue }
/** Page a missing required input is entered on. */
export type InputTab = 'submission' | 'indications' | 'fields' | 'judgment';

const isYearMonth = (v: RowValue): v is YearMonth => !!v && typeof v === 'object' && !Array.isArray(v) && 'y' in v && 'm' in v;

/** Medicare revenue per year ($M) for one indication: its share of the asset revenue × payer mix. Null without a payer mix. */
export function medicareRevenue(s: Ctx, a: Asset, ind: Indication): number[] | null {
  const v = indValues(ind), pm = num(v.payer);
  if (pm == null) return null;
  const inds = aia(a).setup.indications.filter(i => i.include !== false), share = num(v.revShare) ?? 1 / Math.max(1, inds.length);
  return revenueSeries(s, a).map(x => Math.round(x * share * pm) / 100);
}

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
  if (it.k === 'medRev') return medicareRevenue(s, a, ind!);
  if (it.field) return fieldVal(s, a, it.field);
  if (it.lvl === 'asset') return aia(a).v6?.asset[it.k];
  return indValues(ind)[it.k];
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
    return;
  }
  (ind!.v6 ??= {})[it.k] = val as InputValue;
}

/** Rows for the Inputs tab (default) or the Key Assumptions tab (judgment). */
export function inputRows(s: Ctx, a: Asset, { judgment = false, noCalc = false } = {}): InputRow[] {
  const st = aia(a).setup, inds = st.indications.filter(i => i.include !== false), out: InputRow[] = [];
  const keep = (it: InputItem) => (judgment ? it.where === 'judgment' : it.where !== 'judgment') && !(noCalc && it.src === 'Calc');
  INPUT_ITEMS.filter(it => it.lvl === 'asset' && keep(it)).forEach(it => {
    if (it.field && !assetFields(s, a).some(f => f.field === it.field)) return;
    out.push({ it, group: 'Asset', value: '' });
  });
  inds.forEach(ind => {
    const n = st.indications.indexOf(ind) + 1;
    INPUT_ITEMS.filter(it => it.lvl === 'ind' && keep(it)).forEach(it => out.push({ it, ind, group: `Indication ${n} · ${ind.name || 'New indication'}`, value: '' }));
  });
  if (!judgment) {
    (aia(a).v6?.comp || []).forEach((c, ci) => {
      const vs = st.indications.find(i => i.id === c.vsId);
      INPUT_ITEMS.filter(it => it.lvl === 'comp').forEach(it => out.push({ it, comp: c, ci, group: `Competitor · ${c.name}${vs ? ` (vs ${vs.name})` : ''}`, value: '' }));
    });
  }
  return out.map(r => ({ ...r, value: readInput(s, a, r.it, r.ind, r.comp) }));
}

export function isMissing(r: Pick<InputRow, 'it' | 'value'>): boolean {
  if (r.it.type === 'ym') return !isYearMonth(r.value) || !r.value.y || !r.value.m;
  if (r.it.type === 'calc') return r.value == null;
  return isEmptyValue(r.value);
}
export const isRequiredMissing = (r: InputRow) => r.it.req && r.it.type !== 'calc' && isMissing(r);

/** Required-input gating applies to TEST-100 and to products added in the app. */
export const inputsGated = (a: Asset | null | undefined) => !!a && (a.id === 'TEST-100' || !!a.aia?.created);

export function missingInputs(s: Ctx, a: Asset): (InputRow & { tab: InputTab })[] {
  if (!a?.aia) return [];
  return [...inputRows(s, a, { noCalc: true }), ...inputRows(s, a, { judgment: true, noCalc: true })]
    .filter(isRequiredMissing)
    .map(r => ({
      ...r,
      tab: r.it.where === 'judgment' ? 'judgment' : r.it.where === 'submission' ? 'submission'
        : r.it.where === 'indications' || (r.it.lvl === 'ind' && ['Manual', 'Link'].includes(r.it.src)) ? 'indications' : 'fields'
    }));
}

const GATED_TABS: AiaTab[] = ['eligibility', 'impact', 'scenario'];
/** Missing required inputs keep Eligibility, Impact and Scenario Analysis locked (v07 isUnlocked). */
export const blockedByInputs = (s: Ctx, a: Asset, tab: AiaTab) => GATED_TABS.includes(tab) && inputsGated(a) && missingInputs(s, a).length > 0;
export const isTabOpen = (s: Ctx, a: Asset, tab: AiaTab) => isUnlocked(a, tab) && !blockedByInputs(s, a, tab);

/** Confidence dot: NA for manual/calculated inputs, blank when nothing was found. */
export function inputConfidence(r: InputRow): 'High' | 'Med' | 'Low' | 'NA' | '' {
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
 * (illustrative values, v07 v6AutoExtract). Mutates the draft.
 */
export function autoExtractInputs(s: Ctx, a: Asset) {
  const w = aia(a), st = (w.v6 ??= { asset: {}, comp: [] }), types = new Set(assetDocs(s, a).flatMap(docTypes)), inds = w.setup.indications;
  if (types.has('CDP')) inds.forEach(ind => {
    const v = (ind.v6 ??= {}), eu = num(ind.launchEU);
    if (!v.phase) v.phase = phaseFrom(w.setup.stage) || 'Phase III';
    if (!v.maa && eu) v.maa = eu - 1 >= 2029 ? 'January 2029 and beyond' : 'December 2026-December 2028';
  });
  if (types.has('Forecast')) {
    if (!Number(w.base?.peakUS) && !Number(w.base?.peakEU)) w.base = { peakUS: 420, peakEU: 180 };
    if (isEmptyValue(st.asset.wac)) st.asset.wac = grow(150000, 0.03);
    if (isEmptyValue(st.asset.euPrice)) st.asset.euPrice = Object.fromEntries(EU_REFERENCE_COUNTRIES.map(c => [c, grow(80000, 0.02)]));
    inds.forEach(ind => {
      const v = (ind.v6 ??= {});
      if (v.duration == null || v.duration === '') v.duration = 12;
      if (isEmptyValue(v.usPop)) v.usPop = grow(6000, 0.02);
      if (isEmptyValue(v.usShare)) v.usShare = [2, 5, 8, 11, 13, 14, 15, 15, 15, 15, 15, 15, 15, 15, 13];
    });
  }
  if (types.has('Protocol')) inds.forEach(ind => {
    const v = (ind.v6 ??= {});
    if (!v.trialDesign) v.trialDesign = 'placebo-controlled';
    if (!v.pre) v.pre = 'Yes';
  });
  if (types.has('CI') && !st.comp.length) st.comp = [{ name: 'COMP-1', vsId: inds[0]?.id, cPhase: 'Launched', cApproval: '2025' }];
}
