/**
 * Consolidated input catalogue (v07 HTML, from "Input Fields 20261027.xlsm", sheet "Consolidated Inputs").
 * Definitions and sample values only; no imports from other engine modules so eligibility,
 * workspace and impact can all use it without import cycles.
 */
import type { Asset, Competitor, Indication, InputValues, PolicyCode } from '../types/domain';

/** Where a value comes from. Link and None show as "Manual" / "to be confirmed". */
export type InputSource = 'CDP' | 'Forecast' | 'CI' | 'Protocol' | 'Manual' | 'Calc' | 'Link' | 'None';
export type InputLevel = 'asset' | 'ind' | 'comp';
export type InputType = 'inds' | 'multi' | 'sel' | 'year' | 'ym' | 'series' | 'eu' | 'text' | 'num' | 'pct' | 'calc';
/** Page that owns the input: submission = Data Submission, indications = Indications tab, judgment = Key Assumptions; default = Inputs tab. */
export type InputWhere = 'submission' | 'indications' | 'judgment';

export interface InputItem {
  k: string;
  label: string;
  lvl: InputLevel;
  req: boolean;
  src: InputSource;
  type: InputType;
  feeds: PolicyCode[];
  opts?: string[];
  unit?: string;
  /** Read from / written to this extracted field instead of the catalogue store. */
  field?: string;
  where?: InputWhere;
  /** Question wording on the Key Assumptions tab. */
  q?: string;
  note?: string;
  srcNote?: string;
  calcNote?: string;
}

export const INPUT_SOURCE_LABEL: Record<InputSource, string> = {
  CDP: 'CDP', Forecast: 'Forecast Assumptions', CI: 'Competitive Intelligence', Protocol: 'Trial Protocol Concept Sheet', Manual: 'Manual', Calc: 'Calculated', Link: 'Manual', None: ''
};
/** Sources that are documents (counted by Data coverage). */
export const DOC_SOURCES: InputSource[] = ['CDP', 'Forecast', 'CI', 'Protocol'];

const YN = ['Yes', 'No'], HMLU = ['High', 'Medium', 'Low', 'Unknown'];
export const INPUT_PHASES = ['Pre-clinical', 'Phase I', 'Phase II', 'Phase III', 'Launched'];
export const INPUT_MODALITIES = ['Small molecule', 'Biologic (other)', 'Biologic – plasma-derived', 'CGT'];
export const THERAPEUTIC_CLASSES = ['None of the following', 'Analgesics', 'Anticonvulsants', 'Antidepressants', 'Antigout agents', 'Antimigraine agents', 'Antineoplastics', 'Antipsychotics', 'Antivirals', 'Bipolar agents', 'Blood glucose regulators', 'Blood products and modifiers', 'Cardiovascular agents', 'Central nervous system agents', 'Gastrointestinal agents', 'Genetic or enzyme or protein disorder replacement or modifiers or treatment', 'Immunological agents', 'Metabolic bone disease agents', 'Ophthalmic agents', 'Respiratory tract or pulmonary agents'];
/** EU MFN reference countries = the European countries in the CMS Method I/II reference list (rule citation CIT-MFN-01). */
export const EU_REFERENCE_COUNTRIES = ['Austria', 'Belgium', 'Czech Republic', 'Denmark', 'France', 'Germany', 'Ireland', 'Italy', 'Netherlands', 'Norway', 'Spain', 'Sweden', 'Switzerland', 'United Kingdom'];
export const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Austria', 'Switzerland', 'Sweden', 'Denmark', 'Norway', 'Ireland', 'Czech Republic', 'Poland', 'Japan', 'China', 'South Korea', 'Australia', 'Brazil', 'Mexico', 'India', 'Israel'];

const item = (k: string, label: string, lvl: InputLevel, req: 0 | 1, src: InputSource, type: InputType, feeds: PolicyCode[], extra: Partial<InputItem> = {}): InputItem =>
  ({ k, label, lvl, req: req === 1, src, type, feeds, ...extra });

export const INPUT_ITEMS: InputItem[] = [
  // Asset level
  item('indications', 'Indications', 'asset', 1, 'CDP', 'inds', ['IRA', 'MFN', 'JCA', 'EU-GPL']),
  item('launchMarkets', 'Launch Markets', 'asset', 1, 'None', 'multi', ['MFN'], { opts: COUNTRIES }),
  item('modality', 'Therapeutic Modality', 'asset', 1, 'Manual', 'sel', ['IRA', 'MFN', 'JCA'], { opts: INPUT_MODALITIES, where: 'submission' }),
  item('generic', 'Expected Date of Generic / Biosimilar Entry in USA', 'asset', 1, 'Forecast', 'year', ['IRA'], { field: 'Expected generic entry year' }),
  item('wac', 'Expected YoY WAC Pricing Opportunity (Year 1-15)', 'asset', 1, 'Forecast', 'series', ['IRA', 'MFN'], { unit: 'USD' }),
  item('euPrice', 'Expected YoY EU List Pricing Opportunity (Year 1-15)', 'asset', 1, 'Forecast', 'eu', ['MFN'], { unit: 'USD' }),
  item('medSpend', 'Assumed annual Medicare spend', 'asset', 0, 'Forecast', 'text', ['IRA', 'MFN'], { field: 'Assumed annual Medicare spend', note: 'Carried over from v05 (not in the 27 Oct input list); the eligibility engine still reads it.' }),
  item('jcaInsights', 'JCA Insights Availability', 'asset', 0, 'Manual', 'sel', ['JCA'], { opts: YN, where: 'submission', note: 'Competitor input (asset level): are there published JCA assessment scopes and reports for competitor products in the same or adjacent indications?' }),
  item('regStrategy', 'Regulatory Strategy Alignment', 'asset', 0, 'Manual', 'sel', ['JCA'], { opts: YN, where: 'submission', q: 'Has the regulatory strategy already taken account of, and planned alignment with, JCA delivery (e.g., MAA filing timing, indication wording, label scenarios, sequencing of subsequent indications)?' }),
  item('euAccess', 'EU Markets Access Challenge', 'asset', 0, 'Manual', 'sel', ['EU-GPL'], { opts: YN, where: 'submission', q: 'Are there any EU markets with predicted access challenges?' }),
  // Indication level
  item('usLaunch', 'US FDA Approval Launch Timing', 'ind', 1, 'CDP', 'ym', ['IRA', 'MFN'], { where: 'indications' }),
  item('euLaunch', 'EU EMA Approval Launch Timing', 'ind', 1, 'CDP', 'year', ['MFN', 'JCA', 'EU-GPL'], { where: 'indications' }),
  item('maa', 'EU MAA Submission Timing', 'ind', 1, 'CDP', 'sel', ['EU-GPL'], { opts: ['Not pursuing', 'December 2026-December 2028', 'January 2029 and beyond'] }),
  item('phase', 'Phase of Development', 'ind', 1, 'CDP', 'sel', ['IRA', 'MFN', 'JCA'], { opts: INPUT_PHASES }),
  item('tclass', 'Therapeutic Class', 'ind', 1, 'Manual', 'sel', ['MFN', 'JCA'], { opts: THERAPEUTIC_CLASSES }),
  item('cancer', 'Treats Cancer', 'ind', 1, 'Manual', 'sel', ['JCA'], { opts: YN }),
  item('fdaOdd', 'FDA Orphan Drug Designation', 'ind', 1, 'Manual', 'sel', ['IRA', 'MFN'], { opts: YN }),
  item('emaOd', 'EMA Orphan Designation', 'ind', 1, 'Manual', 'sel', ['JCA', 'EU-GPL'], { opts: ['Orphan', 'Breakthrough Orphan', 'No'] }),
  item('duration', 'Average Treatment Duration (months)', 'ind', 0, 'Forecast', 'num', ['IRA']),
  item('usPop', 'Size of USA YoY Addressable Population (Year 1-15)', 'ind', 0, 'Forecast', 'series', ['IRA', 'MFN'], { unit: 'patients' }),
  item('usShare', 'Expected USA YoY Market Share (Year 1-15)', 'ind', 0, 'Forecast', 'series', ['IRA', 'MFN'], { unit: '%' }),
  item('coverage', 'Expected Medicare Coverage', 'ind', 1, 'Manual', 'sel', ['IRA', 'MFN'], { opts: ['Part A', 'Part B', 'Part D', 'Part B&D'] }),
  item('payer', 'Payer Mix (% Medicare)', 'ind', 1, 'Manual', 'pct', ['IRA', 'MFN']),
  item('medRev', 'Medicare Revenue Forecast (Year 1-15)', 'ind', 0, 'Calc', 'calc', ['IRA', 'MFN'], { unit: '$M' }),
  item('euPop', 'Size of EU YoY Addressable Population (Year 1-15)', 'ind', 0, 'Forecast', 'series', ['MFN'], { unit: 'patients' }),
  item('euShare', 'Expected EU YoY Market Share (Year 1-15)', 'ind', 0, 'Forecast', 'series', ['MFN'], { unit: '%' }),
  item('usDiff', 'US Clinical Differentiation', 'ind', 0, 'Manual', 'sel', ['IRA', 'MFN'], { opts: HMLU }),
  item('euDiff', 'EU Clinical Differentiation', 'ind', 0, 'Manual', 'sel', ['MFN'], { opts: HMLU }),
  item('umn', 'Unmet Medical Need Addressed As Defined by the EMA', 'ind', 0, 'Manual', 'sel', ['EU-GPL'], { opts: YN }),
  item('sites', 'Pivotal Trial Sites', 'ind', 0, 'Link', 'multi', ['MFN', 'EU-GPL'], { opts: COUNTRIES }),
  item('trialDesign', 'Clinical Trial Design', 'ind', 1, 'Protocol', 'sel', ['MFN', 'JCA', 'EU-GPL'], { opts: ['Head-to-head', 'placebo-controlled', 'single-arm study'], where: 'judgment', q: 'What is the design of the pivotal trial (is the comparator optimized)?' }),
  item('usComp', 'US Comparator Selection', 'ind', 0, 'Manual', 'sel', ['JCA', 'EU-GPL'], { opts: ['Accepted SOC', 'not SOC'], q: 'Is the trial comparator optimized for the accepted SOC in the US?' }),
  item('euComp', 'EU Comparator Selection', 'ind', 1, 'Manual', 'sel', ['JCA', 'EU-GPL'], { opts: ['Accepted SOC', 'not SOC'], q: 'Is the trial comparator optimized for the accepted SOC in the EU?' }),
  item('itc', 'Indirect Treatment Comparison', 'ind', 0, 'Manual', 'sel', ['MFN', 'JCA'], { opts: YN, q: 'Will the asset have planned indirect treatment comparisons (ITCs)?' }),
  item('pre', 'Patient-Relevant Endpoints', 'ind', 0, 'Protocol', 'sel', ['MFN', 'JCA'], { opts: YN, where: 'judgment', q: 'Does the trial contain patient-relevant endpoints (e.g., OS)?' }),
  item('rwPop', 'Trial vs. RW Population Alignment', 'ind', 0, 'Protocol', 'sel', ['MFN', 'JCA'], { opts: YN, where: 'judgment', q: 'Does the trial population reflect the real-world treated population in each country?' }),
  item('rwSku', 'Trial vs. RW SKU Alignment', 'ind', 0, 'Manual', 'sel', ['MFN'], { opts: YN, q: 'Do the planned SKU launches and evidence reflect real-world dosage and minimize wastage?' }),
  // Competitor inputs
  item('cPhase', 'Phase of Development', 'comp', 0, 'CI', 'sel', ['IRA', 'JCA'], { opts: INPUT_PHASES }),
  item('cApproval', 'Expected USA Regulatory Approval Timing', 'comp', 0, 'CI', 'year', ['IRA']),
  item('cGeneric', 'Expected Date of Generic / Biosimilar Entry in USA', 'comp', 0, 'CI', 'year', ['IRA'], { srcNote: 'CI deck or manual' }),
  item('cSpend', 'Non-Risk Adjusted Annual Medicare Expenditures (Year 1-15)', 'comp', 0, 'None', 'series', ['IRA'], { unit: 'USD' }),
  item('cRisk', 'Level of MFP Negotiation Risk', 'comp', 0, 'Manual', 'sel', ['IRA'], { opts: ['Low', 'Medium', 'High'] }),
  item('cMfp', 'Expected MFP Negotiation Timing', 'comp', 0, 'Calc', 'year', ['IRA'], { calcNote: 'Calculation rule to be confirmed' }),
  item('cWac', 'Expected Annual WAC Price at Takeda Asset Launch', 'comp', 0, 'Manual', 'num', ['IRA'], { unit: 'USD' }),
  item('cDiff', 'Level of Clinical Differentiation vs. Takeda Asset', 'comp', 0, 'Manual', 'sel', ['IRA'], { opts: HMLU }),
  item('cTrial', 'Chance of Regulatory Trial Success', 'comp', 0, 'Manual', 'sel', ['IRA'], { opts: HMLU })
];

/** Asset- and indication-level items by key (competitor keys are distinct: cPhase, cApproval, …). */
export const INPUT_ITEM: Record<string, InputItem> = Object.fromEntries(INPUT_ITEMS.map(x => [x.k, x]));

/** Year 1 value grown by g a year, Years 1-15 (illustrative sample series). */
export const grow = (y1: number, g: number, n = 15) => Array.from({ length: n }, (_, i) => Math.round(y1 * Math.pow(1 + g, i)));

/** TEST-100 synthetic sample data (illustrative only; not taken from any Takeda document). */
export const TEST100_INPUTS: { asset: InputValues; inds: InputValues[]; comps: (InputValues & { name: string; vsInd: number })[] } = {
  asset: {
    modality: 'Small molecule', launchMarkets: ['United States', 'Canada', 'Germany', 'France', 'Italy', 'Spain', 'United Kingdom', 'Japan'], wac: grow(210000, 0.03),
    euPrice: Object.fromEntries(EU_REFERENCE_COUNTRIES.map((c, i) => [c, grow(95000 + ((i * 7) % 12) * 5000, 0.02)])), regStrategy: 'No', euAccess: '', jcaInsights: 'No'
  },
  inds: [
    { launchUSMonth: 'Jun', revShare: 0.45, maa: 'January 2029 and beyond', phase: 'Phase III', tclass: 'Blood products and modifiers', cancer: 'Yes', emaOd: 'Orphan', duration: 14, usPop: grow(4200, 0.02), usShare: [2, 5, 9, 13, 16, 18, 19, 20, 20, 20, 20, 20, 20, 20, 18], coverage: 'Part B', payer: 60, euPop: grow(5100, 0.01), euShare: [1, 3, 6, 9, 11, 12, 13, 13, 13, 13, 13, 13, 13, 13, 12], usDiff: 'High', euDiff: 'Medium', umn: 'Yes', sites: ['United States', 'Germany', 'France', 'Italy', 'Spain', 'United Kingdom', 'Japan'], trialDesign: 'Head-to-head', euComp: 'Accepted SOC', pre: 'No', rwPop: 'Yes', usComp: 'Accepted SOC', itc: 'Yes' },
    { launchUSMonth: 'Oct', revShare: 0.40, maa: 'January 2029 and beyond', phase: 'Phase III', tclass: 'Blood products and modifiers', cancer: 'Yes', emaOd: 'No', duration: 18, usPop: grow(9000, 0.015), usShare: [3, 7, 11, 14, 16, 17, 18, 18, 18, 18, 18, 18, 18, 18, 16], coverage: 'Part B', payer: 65, usDiff: 'Medium', euDiff: 'Medium', umn: 'No', sites: ['United States', 'Germany', 'France'], trialDesign: 'placebo-controlled', euComp: 'Accepted SOC', pre: 'Yes', rwPop: 'No', rwSku: 'Yes' },
    { launchUSMonth: 'Mar', revShare: 0.15, maa: 'January 2029 and beyond', phase: 'Phase III', tclass: 'Blood products and modifiers', cancer: 'Yes', emaOd: 'No', coverage: 'Part B', payer: 62, trialDesign: 'placebo-controlled', euComp: 'not SOC', rwPop: 'Yes' }
  ],
  comps: [
    { name: 'COMP-A', vsInd: 1, cPhase: 'Launched', cApproval: '2024', cGeneric: '2036', cRisk: 'Medium', cWac: 180000, cDiff: 'Medium' },
    { name: 'COMP-B', vsInd: 0, cPhase: 'Phase III', cApproval: '2030', cRisk: 'Low', cDiff: 'High', cTrial: 'Medium' }
  ]
};

const CLASS_MAP: Record<string, string> = { Antineoplastic: 'Antineoplastics', Hematologic: 'Blood products and modifiers', Immunomodulator: 'Immunological agents', Neurologic: 'Central nervous system agents' };
export const classToCatalogue = (tclass: string) => CLASS_MAP[tclass] || '';

export function normModality(m: unknown): string {
  const s = String(m || '');
  if (INPUT_MODALITIES.includes(s)) return s;
  if (/small/i.test(s)) return 'Small molecule';
  if (/cell|gene|cgt/i.test(s)) return 'CGT';
  if (/plasma/i.test(s)) return 'Biologic – plasma-derived';
  if (/biolog|large/i.test(s)) return 'Biologic (other)';
  return '';
}
export const phaseFrom = (stage: string) => ({ 'Phase 1': 'Phase I', 'Phase 2': 'Phase II', 'Phase 3': 'Phase III', Launched: 'Launched' } as Record<string, string>)[stage] || '';

/** Indication-level catalogue values (never undefined). */
export const indValues = (ind: Indication | undefined): InputValues => ind?.v6 || {};
export const str = (v: unknown) => (v == null ? '' : String(v));

export const isEmptyValue = (v: unknown) =>
  v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v as object).length);

/**
 * Seed the catalogue store for an asset workspace (v07 v6Seed). Mutates `a.aia`; call only in reducers.
 * TEST-100 gets the synthetic sample values; other assets get what can be mapped from their set-up, the rest stays empty.
 */
export function seedInputs(a: Asset, stage: string): void {
  const w = a.aia;
  if (!w || w.v6) return;
  const s = w.setup;
  if (a.id === 'TEST-100') {
    w.v6 = { asset: structuredClone(TEST100_INPUTS.asset), comp: TEST100_INPUTS.comps.map(({ vsInd, ...c }) => ({ ...structuredClone(c), vsId: s.indications[vsInd]?.id })) as Competitor[] };
    s.indications.forEach((ind, i) => {
      const d = structuredClone(TEST100_INPUTS.inds[i] || {});
      ind.launchUSMonth = str(d.launchUSMonth);
      delete d.launchUSMonth;
      ind.v6 = d;
    });
    return;
  }
  const part = /part d/i.test(s.route || '') ? 'Part D' : /part b/i.test(s.route || '') ? 'Part B' : '';
  w.v6 = { asset: { modality: normModality(a.context?.modality || s.modality) }, comp: [] };
  s.indications.forEach(ind => { ind.v6 = ind.v6 || { phase: phaseFrom(stage), coverage: part, tclass: classToCatalogue(s.tclass) }; });
}
