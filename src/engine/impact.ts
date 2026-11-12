/**
 * Impact, recommendation, yearly revenue and scenario model (illustrative).
 * Pure functions ported from the v05 HTML.
 */
import type { Asset, AssessmentWorkspace, PolicyCode, PolicyMap, Recommendation } from '../types/domain';
import { POLICY_CODES, SEQ_F } from './constants';
import { exposures, profile, type Ctx, type Profile } from './eligibility';
import { num } from './format';
import { ref } from './reference';
import { aia, isLegacyAsset } from './workspace';

const zeros = (): PolicyMap<number> => ({ IRA: 0, MFN: 0, JCA: 0, 'EU-GPL': 0 });

/* ---------------- EVAP feedback (28 Oct 2026) ---------------- */
// Year 1-15 revenue window from the first US launch; JCA and EU-GPL revenue impact is not modelled.
export const IRA_MFP_CUT = 0.15;
export const REVENUE_POLICIES: PolicyCode[] = ['IRA', 'MFN'];
export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface IraDates { launch: number | null; launchLabel?: string; negotiation: number | null; negotiationLabel?: string; publication: number | null; effective: number | null; generic: number | null }
/** TEST-100 IRA timeline from the feedback deck (slide 11). */
export const TEST100_IRA: IraDates = { launch: 2029, launchLabel: 'Q1 2029', negotiation: 2036, negotiationLabel: 'Q1 2036', publication: 2037, effective: 2038, generic: 2043 };
/** TEST-100 net revenue, Years 1-15 (2029-2043, $M), signed off 28 Oct 2026: the 15% MFP cut from 2038 sums to $187M; 2043 is 50% of 2042 (generic entry). */
export const TEST100_REVENUE = [25, 70, 120, 160, 195, 215, 225, 227, 227, 227, 227, 227, 227, 227, 114];

export interface RevWindow { y0: number; y1: number }
export function revWindow(s: Ctx, a: Asset): RevWindow {
  const p = profile(s, a), ys = p.inds.map(i => num(i.launchUS)).filter((y): y is number => !!y), y0 = ys.length ? Math.min(...ys) : (p.launchUS || 2029);
  return { y0, y1: y0 + 14 };
}
export const windowYears = (w: RevWindow) => Array.from({ length: w.y1 - w.y0 + 1 }, (_, i) => w.y0 + i);

/** Net revenue per year ($M) for the 15-year window: the user's entries, else TEST-100's signed-off values, else a curve from peak revenue. */
export function revenueSeries(s: Ctx, a: Asset): number[] {
  const v = aia(a);
  if (Array.isArray(v.revenue) && v.revenue.length === 15) return v.revenue;
  if (a.id === 'TEST-100') return TEST100_REVENUE;
  const w = revWindow(s, a), b = v.base || { peakUS: 0, peakEU: 0 }, p = profile(s, a), us = Number(b.peakUS) || 0, eu = Number(b.peakEU) || 0;
  const uL = p.launchUS || w.y0, eL = p.launchEU || w.y0 + 1, gen = Math.max(uL + 2, p.generic || uL + 7);
  const curve = (peak: number, start: number, y: number) => {
    if (!peak || y < start) return 0;
    const ramp = Math.min(1, (y - start + 1) / Math.max(1, gen - 1 - start));
    return y < gen ? peak * Math.min(1, ramp * 1.05) : peak * Math.max(0.1, Math.pow(0.55, y - gen + 1));
  };
  const raw = windowYears(w).map(y => curve(us, uL, y) + curve(eu, eL, y)), sum = raw.reduce((t, x) => t + x, 0), g = impactFor(s, a).gross;
  return raw.map(x => Math.round(sum ? x * g / sum : g / 15));
}

export const usLaunch = (a: Asset, p: Profile) => (a.id === 'TEST-100' ? TEST100_IRA.launch : p.launchUS);
export function iraDates(a: Asset, p: Profile): IraDates {
  return a.id === 'TEST-100' ? TEST100_IRA
    : { launch: p.launchUS, negotiation: p.negotiation, publication: p.negotiation ? p.negotiation + 1 : null, effective: p.negotiation ? p.negotiation + 2 : null, generic: p.generic };
}

export function impactFor(s: Ctx, a: Asset): { policyImpact: PolicyMap<number>; gross: number } {
  const exp = exposures(s, a);
  let r: { policyImpact: PolicyMap<number>; gross: number };
  if (a.id === 'TEST-100') {
    const S = revenueSeries(s, a), w = revWindow(s, a), after = S.reduce((t, x, i) => t + (w.y0 + i >= TEST100_IRA.effective! ? x : 0), 0);
    const t: Partial<PolicyMap<number>> = { IRA: -Math.round(after * IRA_MFP_CUT), MFN: -276 };
    r = { policyImpact: zeros(), gross: Math.round(S.reduce((x, y) => x + y, 0)) };
    exp.forEach(c => { if (t[c] !== undefined) r.policyImpact[c] = t[c]!; });
  } else if (aia(a).created || a.id === 'TAK-481') {
    r = { policyImpact: zeros(), gross: 2580 };
    exp.forEach(c => { r.policyImpact[c] = ref().sampleImpact[c]; });
  } else r = { policyImpact: { ...a.policyImpact }, gross: a.summaryMetrics.gross };
  r.policyImpact.JCA = 0;
  r.policyImpact['EU-GPL'] = 0;
  return r;
}

export function recsFor(s: Ctx, a: Asset): Recommendation[] {
  const exp = exposures(s, a);
  let list = ref().recommendations.filter(r => r.policies.some(c => exp.includes(c)));
  if (isLegacyAsset(a)) {
    list = list.slice(0, Math.max(1, a.recommendationCount));
    const sum = list.reduce((t, r) => t + r.value, 0) || 1;
    return list.map(r => ({ ...r, value: Math.max(1, Math.round(r.value * a.estimatedOpportunity / sum)) }));
  }
  if (a.id === 'TEST-100') return list.map(r => ({ ...r, value: Math.round(r.value * 3748 / 1900) }));
  return list.map(r => ({ ...r }));
}

export interface ValueModel {
  gross: number;
  deltas: { code: PolicyCode; val: number }[];
  sum: number;
  net: number;
  opp: number;
  mitigated: number;
  exp: PolicyCode[];
  f: number;
}

export function valueModel(s: Ctx, a: Asset): ValueModel {
  const im = impactFor(s, a), exp = exposures(s, a), v = aia(a), f = ({ Base: 1, Mitigated: 0.65, Downside: 1.3 } as Record<string, number>)[v.scenario] || 1;
  const deltas = REVENUE_POLICIES.map(code => {
    const on = exp.includes(code) && v.policiesOn[code], raw = on ? im.policyImpact[code] || 0 : 0;
    return { code, val: Math.round(raw < 0 ? raw * f : raw) };
  });
  const sum = deltas.reduce((t, d) => t + d.val, 0), net = im.gross + sum, opp = recsFor(s, a).reduce((t, r) => t + r.value, 0);
  return { gross: im.gross, deltas, sum, net, opp, mitigated: net + opp, exp, f };
}

/** Colour class for a judgment answer: adverse / favorable / Partial / Unknown. */
export const ansTone = (ans: string, adverse: string | null) =>
  ans === 'Partial' || ans === 'Medium' ? 'Partial' : ans === 'Unknown' ? 'Unknown' : ans === adverse ? 'adverse' : 'favorable';

/* ---------------- yearly revenue model ---------------- */
export interface YearRow { y: number; gross: number; ira: number; mfn: number; net: number }
export interface YearParams { usL: number | null; euL: number | null; iraMul: number; mfnMul: number; usScale?: number; euScale?: number }
/** Lifetime IRA and MFN effects ($M, negative = revenue at risk) spread over the years. */
export type YearTotals = { IRA: number; MFN: number };

/** Revenue per window year, with the US and EU shares shifted when a launch year moves. */
export function yearShape(s: Ctx, a: Asset, uL: number | null, eL: number | null, usK = 1, euK = 1) {
  const w = revWindow(s, a), S = revenueSeries(s, a), p = profile(s, a), b = aia(a).base || { peakUS: 0, peakEU: 0 };
  const us = Number(b.peakUS) || 0, eu = Number(b.peakEU) || 0, su = us + eu ? us / (us + eu) : 1, se = 1 - su;
  const L = usLaunch(a, p), dU = (uL ?? L ?? w.y0) - (L ?? w.y0), dE = (eL ?? p.launchEU ?? w.y0) - (p.launchEU ?? w.y0);
  const at = (y: number) => (y < w.y0 ? 0 : S[Math.min(S.length - 1, y - w.y0)]);
  return windowYears(w).map(y => ({ y, rev: su * usK * at(y - dU) + se * euK * at(y - dE) }));
}

export function yearly(s: Ctx, a: Asset, tot: YearTotals, par: YearParams): YearRow[] {
  const p = profile(s, a), d = iraDates(a, p), L = usLaunch(a, p), sh0 = yearShape(s, a, L, p.launchEU), sh = yearShape(s, a, par.usL, par.euL, par.usScale ?? 1, par.euScale ?? 1);
  const effB = d.effective, effS = effB ? effB + ((par.usL ?? L ?? 0) - (L ?? 0)) : null;
  const post = (from: number) => sh0.filter(r => r.y >= from).reduce((t, r) => t + r.rev, 0);
  const rate = (t: number, dn: number) => (dn > 0 ? Math.abs(t || 0) / dn : 0);
  const iraR = !tot.IRA || !effB ? 0 : a.id === 'TEST-100' ? IRA_MFP_CUT : rate(tot.IRA, post(effB)), mfnR = L ? rate(tot.MFN, post(L)) : 0;
  return sh.map(({ y, rev }) => {
    const ira = effS && y >= effS ? Math.min(0.9, iraR * par.iraMul) * rev : 0;
    const mfn = y >= (par.usL ?? 0) ?Math.min(0.9, mfnR * par.mfnMul) * rev : 0;
    return { y, gross: rev, ira, mfn, net: rev - ira - mfn };
  });
}

/* ---------------- scenario analysis ---------------- */
export type ScnKey = 'iraDisc' | 'share' | 'gap' | 'usL' | 'euL' | 'seq' | 'usPeak' | 'euPeak';
export type ScnValues = { [K in ScnKey]: K extends 'seq' ? string : number };

export interface ScnVar {
  k: ScnKey;
  l: string;
  u: string;
  ch: PolicyCode[];
  fmt: (x: number | string) => string;
  opts: (b: ScnValues) => (number | string)[];
}

const scnPct = (x: number | string) => `${x}%`;
export const SCN_DEFAULT: ScnKey[] = ['iraDisc', 'share', 'gap', 'usL', 'euL'];
export const SCN_MAX = 7;
export const SCN_VARS: ScnVar[] = [
  { k: 'iraDisc', l: 'IRA price discount', u: 'pts', ch: ['IRA'], fmt: scnPct, opts: () => [25, 40, 50, 60, 75] },
  { k: 'share', l: 'Medicare share of patients', u: 'pts', ch: ['IRA', 'MFN'], fmt: scnPct, opts: () => [50, 60, 70, 80, 90] },
  { k: 'gap', l: 'MFN U.S. vs. reference-price gap', u: 'pts', ch: ['MFN'], fmt: scnPct, opts: () => [20, 35, 50, 65] },
  { k: 'usL', l: 'U.S. launch timing', u: 'yr', ch: ['IRA', 'MFN'], fmt: String, opts: b => [b.usL - 1, b.usL, b.usL + 1, b.usL + 2, b.usL + 3].filter(y => y >= 2027) },
  { k: 'euL', l: 'EU launch timing', u: 'yr', ch: ['JCA', 'EU-GPL'], fmt: String, opts: b => [b.euL - 1, b.euL, b.euL + 1, b.euL + 2, b.euL + 3].filter(y => y >= 2027) },
  { k: 'seq', l: 'Regional launch sequencing', u: '', ch: ['MFN'], fmt: String, opts: () => Object.keys(SEQ_F) },
  { k: 'usPeak', l: 'Peak net revenue · US', u: '$M', ch: ['IRA', 'MFN'], fmt: x => `$${x}M`, opts: b => [0.8, 0.9, 1, 1.1, 1.2].map(q => Math.round(b.usPeak * q)) },
  { k: 'euPeak', l: 'Peak net revenue · EU', u: '$M', ch: ['JCA', 'EU-GPL'], fmt: x => `$${x}M`, opts: b => [0.8, 0.9, 1, 1.1, 1.2].map(q => Math.round(b.euPeak * q)) }
];

/** The variables shown in Scenario testing (valid, unique, at most SCN_MAX, defaulted). Pure. */
export function scnRowsOf(v: Pick<AssessmentWorkspace, 'scnRows'>): ScnKey[] {
  const ok = (v.scnRows || []).filter((k, i, arr) => SCN_VARS.some(d => d.k === k) && arr.indexOf(k) === i).slice(0, SCN_MAX) as ScnKey[];
  return ok.length ? ok : [...SCN_DEFAULT];
}

export function scenarioCompute(s: Ctx, a: Asset) {
  const p = profile(s, a), im = impactFor(s, a), exp = exposures(s, a), v = aia(a);
  const tot = { gross: im.gross } as { gross: number } & PolicyMap<number>;
  POLICY_CODES.forEach(c => { tot[c] = exp.includes(c) ? im.policyImpact[c] || 0 : 0; });
  const vv = (n: string) => { const x = v.variables.find(y => y.name.startsWith(n)); return x ? num(x.base) : null; };
  const seq = String(a.context?.sequence || '');
  const b: ScnValues = {
    iraDisc: vv('IRA price') || 40, share: vv('Medicare share') || 70, gap: vv('MFN') || 35, usL: usLaunch(a, p) || 2027, euL: p.launchEU || 2028,
    seq: SEQ_F[seq] ? seq : 'US-first', usPeak: Number(v.base?.peakUS) || 0, euPeak: Number(v.base?.peakEU) || 0
  };
  const scn = v.scn || {}, rowsK = scnRowsOf(v), sc: ScnValues = { ...b };
  rowsK.forEach(k => { if (scn[k] !== undefined) (sc as Record<string, number | string>)[k] = scn[k]; });
  const parOf = (x: ScnValues): YearParams => ({
    usL: x.usL, euL: x.euL, iraMul: (x.iraDisc / b.iraDisc) * (x.share / b.share), mfnMul: (x.gap / b.gap) * (SEQ_F[x.seq] / SEQ_F[b.seq]),
    usScale: b.usPeak ? x.usPeak / b.usPeak : 1, euScale: b.euPeak ? x.euPeak / b.euPeak : 1
  });
  const rowsOf = (x: ScnValues) => yearly(s, a, tot, parOf(x)), netOf = (rs: YearRow[]) => rs.reduce((t, r) => t + r.net, 0);
  const rb = rowsOf(b), rs = rowsOf(sc), nb = netOf(rb), ns = netOf(rs);
  return { p, tot, b, sc, rb, rs, nb, ns, rowsK, single: (k: ScnKey) => netOf(rowsOf({ ...b, [k]: sc[k] } as ScnValues)) - nb };
}
