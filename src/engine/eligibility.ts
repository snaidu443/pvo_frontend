/**
 * Deterministic eligibility engine (IRA, MFN, JCA, EU-GPL), data coverage and
 * governance helpers. Pure functions: they never mutate their inputs.
 */
import type { AppState } from '../store/appState';
import type { Asset, Indication, PolicyCode, Rule } from '../types/domain';
import { num } from './format';
import { indValues, str, THERAPEUTIC_CLASSES } from './inputCatalogue';
import { ref } from './reference';
import { aia, assetFields, displayName, fieldVal, isLegacyAsset, isUnlocked } from './workspace';

export type Ctx = Pick<AppState, 'fields' | 'questions' | 'documents'>;

export interface Profile {
  inds: Indication[];
  modality: string;
  part: string;
  routeLabel: string;
  launchUS: number | null;
  launchEU: number | null;
  spend: number;
  /** Null for an added product whose forecast gave no generic entry year. */
  generic: number | null;
  maa: number | null;
  maaEntered: boolean;
  bio: boolean;
  negotiation: number | null;
  tclass: string;
  name: string;
}

export function profile(s: Ctx, a: Asset): Profile {
  const st = aia(a).setup, inds = st.indications.filter(i => i.include !== false), firstIdx = Math.max(0, st.indications.findIndex(i => i.include !== false)), c = a.context || {};
  // Catalogue inputs (Data Submission / Indications / Inputs) win over the legacy extracted fields.
  const iv = indValues(inds[0]), mode = str(aia(a).v6?.asset.modeAdmin);
  const modality = str(aia(a).v6?.asset.modality) || fieldVal(s, a, 'Modality') || st.modality;
  const partField = mode ? (/Part D/.test(mode) ? 'Part D' : 'Part B') : fieldVal(s, a, 'Medicare coverage');
  const part = partField || (st.route.includes('Part D') ? 'Part D' : 'Part B');
  const routeWord = st.route.split(' · ')[0] || 'Oral', routeLabel = routeWord === 'Oral' ? 'oral' : routeWord;
  const launchUS = num(fieldVal(s, a, 'US launch year', 'Indication ' + (firstIdx + 1))) ?? num(inds[0]?.launchUS);
  const launchEU = num(fieldVal(s, a, 'EU launch year', 'Indication ' + (firstIdx + 1))) ?? num(inds[0]?.launchEU);
  const spend = num(fieldVal(s, a, 'Assumed annual Medicare spend')) ?? (c.medicareSpend || 0);
  const generic = num(aia(a).v6?.asset.generic) ?? num(fieldVal(s, a, 'Expected generic entry year')) ?? (aia(a).created ? null : (launchUS || 2028) + 7);
  const maaField = assetFields(s, a).find(f => f.field === 'EU MAA year');
  const maaEntered = !!(maaField && maaField.value && maaField.source === 'You entered');
  let maa = maaField && maaField.value ? num(maaField.value) : launchEU ? launchEU + 1 : null;
  // "EU MAA Submission Timing" (Indications) wins over the year derived from the launch.
  {
    const sub = iv.maaSub && typeof iv.maaSub === 'object' && 'y' in iv.maaSub ? num(iv.maaSub.y) : null;
    if (sub) maa = sub;
  }
  const bio = !!modality && !/small molecule/i.test(modality);
  const negotiation = launchUS ? launchUS + (bio ? 10 : 6) : null;
  return { inds, modality, part, routeLabel, launchUS, launchEU, spend, generic, maa, maaEntered, bio, negotiation, tclass: str(iv.tclass) || fieldVal(s, a, 'Therapeutic class') || st.tclass, name: displayName(a) };
}

export type Trigger = [string, boolean];

export function jcaTriggers(p: Profile, i: number): Trigger[] {
  const ind: Partial<Indication> = p.inds[i] || {}, eu = num(ind.launchEU) ?? p.launchEU;
  return [
    ['New oncology active substance', i === 0 && (indValues(p.inds[i]).cancer === 'Yes' || /antineoplastic/i.test(p.tclass))],
    ['Advanced therapy (ATMP)', /cell|gene|cgt/i.test(p.modality)],
    ['Orphan medicine (from 2028)', ind.orphanEU === 'Yes' && (eu || 0) >= 2028],
    ['Any new substance (from 2030)', i === 0 && (eu || 0) >= 2030],
    ['New indication of assessed product', i > 0]
  ];
}

export type StepState = 'pass' | 'fail' | 'grey';
export interface Step { label: string; value: string; state: StepState }
export interface PolicyResult { steps: Step[]; verdict: 'pass' | 'fail' | 'pending'; chip: string; tier?: 'full' | 'partial' | null; /** Out of scope only because of the Launch Markets input. */ launchOut?: boolean }
export interface EligibilityResult {
  IRA: PolicyResult;
  MFN: PolicyResult;
  'EU-GPL': PolicyResult;
  JCA: { triggers: Trigger[][]; verdict: 'pass' | 'fail' | 'pending'; chip: string; firstInd: number; launchOut?: boolean };
}

export function evaluate(s: Ctx, a: Asset): EligibilityResult {
  const p = profile(s, a), out: Record<'IRA' | 'MFN', [string, string, boolean][]> = { IRA: [], MFN: [] };
  const nonOrphan = p.inds.findIndex(i => i.orphanUS !== 'Yes'), D = p.part === 'Part D', thr = D ? 69 : 100;
  out.IRA = [
    ['Medicare population', 'Yes — 65+ heavy', true],
    ['Coverage (Part B/D)', aia(a).created ? p.part : `${p.part} (${p.routeLabel})`, true],
    ['Non-orphan indication', nonOrphan >= 0 ? `Ind. ${nonOrphan + 1} is non-orphan` : 'All orphan', nonOrphan >= 0],
    ['Medicare spend >$200M', p.spend > 200 ? `$${p.spend}M from ${(p.launchUS || 2027) + 4}` : `$${p.spend}M`, p.spend > 200],
    ['No generic before selection', `Generic ${p.generic ?? '—'}`, !p.negotiation || (p.generic != null && p.generic > p.negotiation)]
  ];
  const tq = s.questions.find(q => q.assetId === a.id && q.gen && /therapeutic class/i.test(q.text));
  out.MFN = [
    ['Launch region', p.launchUS ? `US ${p.launchUS}` : '—', !!p.launchUS],
    ['Medicare population', 'Yes', true],
    ['Coverage / model', `${p.part} → ${D ? 'GUARD' : 'GLOBE'}`, true],
    [`Spend >$${thr}M ${p.part}`, `$${p.spend}M`, p.spend > thr],
    THERAPEUTIC_CLASSES.includes(p.tclass)
      ? ['Therapeutic class', `${p.tclass}${['None of the following', 'Unknown'].includes(p.tclass) ? '' : ' (covered class)'}`, p.tclass !== 'None of the following']
      : ['Therapeutic class', tq ? `In covered class: ${tq.answer}` : p.tclass, !tq || tq.answer !== 'No'],
    ['Not CGT / plasma', p.modality, !/cell|gene|cgt|plasma/i.test(p.modality)]
  ];
  const legacy = isLegacyAsset(a);
  const res = {} as EligibilityResult;
  (['IRA', 'MFN'] as const).forEach(code => {
    const steps = out[code];
    let failAt = steps.findIndex(x => !x[2]);
    let verdict: PolicyResult['verdict'] = failAt < 0 ? 'pass' : 'fail', chip = '', neutral = false;
    if (legacy) {
      const st = a.eligibility?.[code] || '';
      if (st === 'In scope') { if (verdict !== 'pass') neutral = true; verdict = 'pass'; failAt = -1; }
      else if (['Not in scope', 'Orphan exception', 'At risk'].includes(st)) { if (verdict !== 'fail') neutral = true; verdict = 'fail'; chip = st; }
      else { verdict = 'pending'; failAt = -1; chip = st || 'Pending'; neutral = true; }
    }
    res[code] = {
      steps: steps.map((x, i) => ({ label: x[0], value: x[1], state: neutral ? 'grey' : failAt < 0 || i < failAt ? 'pass' : i === failAt ? 'fail' : 'grey' })),
      verdict, chip
    };
  });
  {
    const m = p.maa, st = a.eligibility?.['EU-GPL'] || '';
    let v1 = m != null && m >= 2026 && m <= 2028, v2 = (m || 0) >= 2029;
    let verdict: PolicyResult['verdict'] = v1 || v2 ? 'pass' : 'fail', chip = '';
    if (legacy) {
      if (st === 'In scope') { verdict = 'pass'; if (!v1 && !v2) v2 = true; }
      else if (['Not in scope', 'Orphan exception', 'At risk'].includes(st)) { verdict = 'fail'; chip = st; v1 = false; v2 = false; }
      else { verdict = 'pending'; chip = st || 'Pending'; v1 = false; v2 = false; }
    }
    const val = m ? (p.maaEntered ? `MAA ${m} (you entered)` : `MAA ${m}`) : '—';
    res['EU-GPL'] = {
      steps: [
        { label: 'New EU MAA from 2026–2028', value: (v1 ? `${val} · ` : '') + 'Partially in scope', state: v1 && !v2 ? 'pass' : 'grey' },
        { label: 'New EU MAA from 2029', value: (v2 ? `${val} · ` : '') + 'Fully in scope', state: v2 ? 'pass' : 'grey' }
      ],
      verdict, chip, tier: v2 ? 'full' : v1 ? 'partial' : null
    };
  }
  const inds = p.inds.map((_, i) => jcaTriggers(p, i)), hit = inds.findIndex(t => t.some(x => x[1]));
  let jv: PolicyResult['verdict'] = hit >= 0 && p.launchEU ? 'pass' : 'fail', jchip = '';
  if (legacy) {
    const st = a.eligibility?.JCA || '';
    if (st === 'In scope') jv = 'pass';
    else if (st === 'Not in scope') { jv = 'fail'; jchip = st; }
    else { jv = 'pending'; jchip = st || 'Pending'; }
  }
  res.JCA = { triggers: inds, verdict: jv, chip: jchip, firstInd: hit >= 0 ? hit : 0 };
  // Launch Markets (Data Submission): a US-only launch takes JCA and EU-GPL out of scope; an EU-only launch takes IRA and MFN out.
  // The option texts are the database's ("US", "EU", "Global launch (including US and EU)"); the older "US only launch" / "EU only launch" still match.
  const usOnly = /^US( only|$)/.test(str(aia(a).v6?.asset.launchMarkets)), euOnly = /^EU( only|$)/.test(str(aia(a).v6?.asset.launchMarkets));
  const off: PolicyCode[] = usOnly ? ['JCA', 'EU-GPL'] : euOnly ? ['IRA', 'MFN'] : [];
  if (!legacy) off.forEach(c => { res[c].verdict = 'fail'; res[c].chip = usOnly ? 'US-only launch' : 'EU-only launch'; res[c].launchOut = true; });
  return res;
}

export const inScope = (s: Ctx, a: Asset): PolicyCode[] => {
  const r = evaluate(s, a);
  return ref().policies.map(p => p.code).filter(c => r[c].verdict === 'pass');
};

/** Policies the asset is exposed to (computed for created assets, stored for sample assets). */
export const exposures = (s: Ctx, a: Asset): PolicyCode[] =>
  aia(a).created && !isUnlocked(a, 'eligibility') ? [] : aia(a).created ? inScope(s, a) : a.policyExposures;

export const REVIEW_STATUSES = ['Conflict', 'Missing', 'Edited', 'Needs review'];
export const needsReview = (s: Ctx, a: Asset) => assetFields(s, a).filter(f => REVIEW_STATUSES.includes(f.status)).length;

/* ---------------- check detail (eligibility drawer) ---------------- */
export interface CheckDetail { value: string; source: string; edited: boolean; fieldId: string | null }

export function checkDetail(s: Ctx, a: Asset, r: EligibilityResult, key: string): CheckDetail | null {
  const [code, i] = parseCheckKey(key), p = profile(s, a);
  if (code === 'JCA') {
    const t = r.JCA.triggers[aia(a).jcaInd] || [];
    const on = t.filter(x => x[1]).map(x => x[0]);
    return { value: on.length ? on.join(', ') : '—', source: 'Inputs confirmed on Inputs and Assumptions', edited: false, fieldId: null };
  }
  const step = (r as unknown as Record<string, PolicyResult>)[code]?.steps[i];
  if (!step) return null;
  const map: Record<string, [string, string?]> = {
    'Medicare spend >$200M': ['Assumed annual Medicare spend', `$${p.spend}M Medicare spend; crosses $200M in ${(p.launchUS || 2027) + 4}`],
    'Coverage (Part B/D)': ['Medicare coverage'], 'Non-orphan indication': ['Orphan designation'], 'No generic before selection': ['Expected generic entry year'],
    'Launch region': ['US launch year'], 'Coverage / model': ['Medicare coverage'], 'Therapeutic class': ['Therapeutic class'], 'Not CGT / plasma': ['Modality'],
    'New EU MAA from 2026–2028': ['EU MAA year'], 'New EU MAA from 2029': ['EU MAA year']
  };
  const m = map[step.label] || (step.label.startsWith('Spend >') ? ['Assumed annual Medicare spend'] : null);
  const f = m ? assetFields(s, a).find(x => x.field === m[0]) : undefined;
  const src = a.id === 'TEST-100'
    ? (f ? f.source : step.label === 'Therapeutic class' ? 'Assumptions' : 'CDP · p.29')
    : f ? (f.field === 'Assumed annual Medicare spend' ? 'Forecast v3 · tab 3' : f.source) : step.label === 'Therapeutic class' ? 'Assumptions' : 'Forecast · tab 3';
  return { value: m && m[1] && p.spend > 200 ? m[1] : step.value, source: src, edited: f?.status === 'Edited', fieldId: f ? f.id : null };
}

/** Split a check key such as "EU-GPL-1" or "IRA-3" into policy code and step index. */
export function parseCheckKey(key: string): [string, number] {
  const i = key.lastIndexOf('-');
  return [key.slice(0, i), Number(key.slice(i + 1))];
}

export function eligibilityRules(s: Pick<AppState, 'rules'>, code: PolicyCode): Rule[] {
  const act = s.rules.filter(r => r.policy === code && r.status === 'active'), el = act.filter(r => r.category === 'eligibility');
  return el.length ? el : act.slice(0, 1);
}

export function linkedRuleCount(s: Ctx & Pick<AppState, 'rules'>, a: Asset): number {
  const exp = aia(a).created ? inScope(s, a) : a.policyExposures;
  return aia(a).created ? s.rules.filter(r => exp.includes(r.policy)).length : s.rules.filter(r => r.impactedAssetIds?.includes(a.id)).length;
}
