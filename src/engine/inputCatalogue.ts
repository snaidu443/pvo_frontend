/**
 * Input catalogue (v09 HTML, from "Input Fields 20261110.xlsm", sheets "Takeda Asset Inputs" + "Competitor Inputs").
 * Definitions and sample values only; no imports from other engine modules so eligibility,
 * workspace and impact can all use it without import cycles.
 */
import type { Asset, Competitor, Indication, InputValues, PolicyCode } from '../types/domain';

/** Where a value comes from. Link and None show as "Manual" / "to be confirmed". */
export type InputSource = 'CDP' | 'Forecast' | 'CI' | 'Protocol' | 'Manual' | 'Calc' | 'Link' | 'None';
export type InputLevel = 'asset' | 'ind' | 'comp';
export type InputType = 'inds' | 'multi' | 'sel' | 'year' | 'ym' | 'series' | 'eu' | 'text' | 'num' | 'pct' | 'calc';
/**
 * Page that owns the input (the file's "Input UI Location"): setup = Data Submission, indications = Indications tab,
 * inputs = Inputs tab, assumption = Assumptions tab.
 */
export type InputLoc = 'setup' | 'indications' | 'inputs' | 'assumption';
/** A conditional requirement (the file's Note column): required only while the condition holds. */
export type InputCond = 'h2h' | 'notH2h' | 'noUsShare' | 'noEuShare' | 'late';

export interface InputItem {
  k: string;
  label: string;
  /** Category in the input file (Asset Description, Clinical, Forecast, HTA Insights, Regulatory, Competitors, …). */
  cat: string;
  lvl: InputLevel;
  req: boolean;
  src: InputSource;
  type: InputType;
  feeds: PolicyCode[];
  loc: InputLoc;
  opts?: string[];
  unit?: string;
  /** Read from / written to this extracted field instead of the catalogue store. */
  field?: string;
  /** Question wording on the Assumptions tab. */
  q?: string;
  note?: string;
  srcNote?: string;
  calcNote?: string;
  cond?: InputCond;
  /** A multi-select option that asks one more question when ticked (stored under `key` on the indication). */
  extra?: { opt: string; key: string; type: 'num' | 'text'; label: string };
  /** Column title and region on the Indications tab (timing inputs). */
  col?: string;
  region?: 'US' | 'EU';
  /** Region tag (v10, draft until EVAP provides tags): US-only inputs hide for an EU-only launch, EU-only inputs for a US-only launch. */
  reg?: 'US' | 'EU' | 'Both';
}

export const INPUT_SOURCE_LABEL: Record<InputSource, string> = {
  CDP: 'CDP', Forecast: 'Forecast Assumptions', CI: 'Competitive Intelligence', Protocol: 'Trial Protocol Concept Sheet', Manual: 'Manual', Calc: 'Calculated', Link: 'Manual', None: ''
};
/** Sources that are documents (counted by Data coverage). */
export const DOC_SOURCES: InputSource[] = ['CDP', 'Forecast', 'CI', 'Protocol'];

/** Why a conditional input is required (shown on hover). */
export const INPUT_COND_LABEL: Record<InputCond, string> = {
  h2h: 'required because Comparator Design is Head-to-head',
  notH2h: 'required because Comparator Design is not Head-to-head',
  noUsShare: 'required because US market share is not provided',
  noEuShare: 'required because EU market share is not provided',
  late: 'required for late-stage assets (Phase II/III or Phase III)'
};

const YN = ['Yes', 'No'], YNNA = ['Yes', 'No', 'Not Applicable'], HMLU = ['High', 'Medium', 'Low', 'Unknown'];
export const INPUT_PHASES = ['Pre-clinical', 'Phase I', 'Phase II', 'Phase II/III', 'Phase III'];
export const COMPETITOR_PHASES = ['Pre-clinical', 'Phase I', 'Phase II', 'Phase III', 'Launched'];
export const LATE_PHASES = ['Phase II/III', 'Phase III'];
export const INPUT_MODALITIES = ['Small molecule', 'Biologic (other)', 'Biologic – plasma-derived', 'cell & gene therapy'];
export const THERAPEUTIC_CLASSES = ['None of the following', 'Analgesics', 'Anticonvulsants', 'Antidepressants', 'Antigout agents', 'Antimigraine agents', 'Antineoplastics', 'Antipsychotics', 'Antivirals', 'Bipolar agents', 'Blood glucose regulators', 'Blood products and modifiers', 'Cardiovascular agents', 'Central nervous system agents', 'Gastrointestinal agents', 'Genetic or enzyme or protein disorder replacement or modifiers or treatment', 'Immunological agents', 'Metabolic bone disease agents', 'Ophthalmic agents', 'Respiratory tract or pulmonary agents', 'Unknown'];
export const LAUNCH_MARKETS = ['US only launch', 'EU only launch', 'global launch (including US and EU)'];
export const MODE_OF_ADMIN = ['Inpatient (Medicare Part B)', 'Outpatient, HCP-administered (Medicare Part B)', 'Outpatient, patient-administered (Medicare Part D)'];
const TRIAL_SITES = ['United States', 'France', 'Germany', 'Italy', 'Spain', 'Other EU market'];
const COMPARATOR_TYPES = ['Fixed active comparator / treatment', "Investigator's treatment choice", 'Best supportive care', 'Best available therapy'];
/** EU MFN reference countries = the European countries in the CMS Method I/II reference list (rule citation CIT-MFN-01). */
export const EU_REFERENCE_COUNTRIES = ['Austria', 'Belgium', 'Czech Republic', 'Denmark', 'France', 'Germany', 'Ireland', 'Italy', 'Netherlands', 'Norway', 'Spain', 'Sweden', 'Switzerland', 'United Kingdom'];

type Extra = Partial<Pick<InputItem, 'opts' | 'unit' | 'field' | 'q' | 'note' | 'srcNote' | 'calcNote' | 'cond' | 'extra' | 'col' | 'region'>>;
const item = (k: string, label: string, cat: string, lvl: InputLevel, req: 0 | 1, src: InputSource, type: InputType, feeds: PolicyCode[], loc: InputLoc, extra: Extra = {}): InputItem =>
  ({ k, label, cat, lvl, req: req === 1, src, type, feeds, loc, ...extra });

/** All catalogue inputs, in the order of the input file. */
export const INPUT_ITEMS: InputItem[] = [
  // ---- Takeda asset inputs ----
  item('phase', 'Phase of Development', 'Asset Description', 'ind', 1, 'CDP', 'sel', ['IRA', 'MFN', 'JCA'], 'indications', { opts: INPUT_PHASES }),
  item('modality', 'Therapeutic Modality', 'Asset Description', 'asset', 1, 'Manual', 'sel', ['IRA', 'MFN', 'JCA'], 'setup', { opts: INPUT_MODALITIES }),
  item('moa', 'Mechanism of Action Differentiation', 'Asset Description', 'asset', 0, 'Manual', 'sel', ['EU-GPL'], 'assumption', { opts: ['First in class', 'Best in class', 'None'], q: 'Input the type of mechanism of action differentiation' }),
  item('indications', 'Indications', 'Asset Description', 'asset', 1, 'CDP', 'inds', ['IRA', 'MFN', 'JCA', 'EU-GPL'], 'indications'),
  item('tclass', 'Therapeutic Class', 'Asset Description', 'ind', 1, 'Manual', 'sel', ['MFN', 'JCA'], 'inputs', { opts: THERAPEUTIC_CLASSES }),
  item('modeAdmin', 'Mode of Administration & Medicare Coverage', 'Asset Description', 'asset', 1, 'CDP', 'sel', ['IRA', 'MFN'], 'inputs', { opts: MODE_OF_ADMIN }),
  item('usDiff', 'US Clinical Efficacy or Safety Differentiation', 'Clinical', 'ind', 0, 'Manual', 'sel', ['IRA', 'MFN'], 'assumption', { opts: HMLU, q: "Input the assumed clinical efficacy or safety differentiation between the asset and competitors within the product's approved indications in the US" }),
  item('euDiff', 'EU Clinical Efficacy or Safety Differentiation', 'Clinical', 'ind', 0, 'Manual', 'sel', ['MFN'], 'assumption', { opts: HMLU, q: "Input the assumed clinical efficacy or safety differentiation between the asset and competitors within the product's approved indications in the EU" }),
  item('trialPop', 'Trial Population Alignment', 'Clinical', 'ind', 0, 'Manual', 'sel', ['MFN', 'JCA'], 'assumption', { opts: ['Yes', 'Partially', 'No'], q: 'Clarify whether the trial population reflects real-world treated population in each country and corresponds to the intended label indication' }),
  item('rwSku', 'Trial vs. RW SKU Alignment', 'Clinical', 'ind', 0, 'Manual', 'sel', ['MFN'], 'assumption', { opts: YN, q: 'Clarify whether the planned SKU launches and evidence reflect real-world dosage and minimize wastage in each market' }),
  item('numSkus', 'Number of SKUs', 'Clinical', 'asset', 0, 'Manual', 'sel', ['MFN'], 'assumption', { opts: ['Consistent SKUs in all markets', 'Different regional SKUs'], q: 'Clarify whether a differential SKU launch strategy is planned or being considered' }),
  item('sites', 'Pivotal Trial Sites', 'Clinical', 'ind', 0, 'Manual', 'multi', ['MFN', 'EU-GPL'], 'inputs', { opts: TRIAL_SITES, extra: { opt: 'Other EU market', key: 'sitesOtherEu', type: 'num', label: 'How many other EU countries?' } }),
  item('trialDesign', 'Clinical Trial Comparator Design', 'Clinical', 'ind', 1, 'Protocol', 'sel', ['MFN', 'JCA', 'EU-GPL'], 'inputs', { opts: ['Head-to-head', 'placebo-controlled', 'single-arm study'] }),
  item('compType', 'Clinical Trial Comparator Type', 'Clinical', 'ind', 0, 'Protocol', 'multi', ['MFN', 'JCA', 'EU-GPL'], 'inputs', { opts: COMPARATOR_TYPES, cond: 'h2h', extra: { opt: "Investigator's treatment choice", key: 'compTypeSpecify', type: 'text', label: 'Specify the treatment(s)' } }),
  item('blinding', 'Clinical Trial Blinding', 'Clinical', 'ind', 0, 'Protocol', 'sel', ['MFN', 'JCA'], 'inputs', { opts: ['Open-label', 'single-blind', 'double-blind'] }),
  item('strat', 'Alignment of Stratification Factors', 'Clinical', 'ind', 0, 'Protocol', 'sel', ['MFN', 'JCA'], 'inputs', { opts: YNNA }),
  item('subgroup', 'Subgroup Endpoints', 'Clinical', 'ind', 0, 'Protocol', 'sel', ['MFN', 'JCA'], 'inputs', { opts: YNNA }),
  item('pre', 'Patient-Centered Outcomes', 'Clinical', 'ind', 0, 'Protocol', 'sel', ['MFN', 'JCA'], 'inputs', { opts: YN }),
  item('duration', 'Average Treatment Duration (months)', 'Forecast', 'ind', 0, 'Forecast', 'num', ['IRA'], 'inputs'),
  item('generic', 'Expected Date of Generic / Biosimilar Entry in USA', 'Forecast', 'asset', 1, 'Forecast', 'year', ['IRA'], 'inputs'),
  item('usPop', 'Size of USA YoY Addressable Population (Year 1-15)', 'Forecast', 'ind', 0, 'Forecast', 'series', ['IRA', 'MFN'], 'inputs', { unit: 'patients' }),
  item('usShare', 'Expected USA YoY Market Share (Year 1-15)', 'Forecast', 'ind', 0, 'Forecast', 'series', ['IRA', 'MFN'], 'inputs', { unit: '%' }),
  item('wac', 'Expected YoY WAC Pricing Opportunity (Year 1-15)', 'Forecast', 'asset', 1, 'Forecast', 'series', ['IRA', 'MFN'], 'inputs', { unit: 'USD' }),
  item('usRev', 'Expected USA YoY Revenue (Year 1-15)', 'Forecast', 'ind', 0, 'Forecast', 'series', ['IRA', 'MFN'], 'inputs', { unit: 'USD', cond: 'noUsShare' }),
  item('payer', 'Payer Mix (% Medicare)', 'Forecast', 'ind', 1, 'Manual', 'pct', ['IRA', 'MFN'], 'inputs'),
  item('euPop', 'Size of EU YoY Addressable Population (Year 1-15)', 'Forecast', 'ind', 0, 'Forecast', 'series', ['MFN'], 'inputs', { unit: 'patients' }),
  item('euShare', 'Expected EU YoY Market Share (Year 1-15)', 'Forecast', 'ind', 0, 'Forecast', 'series', ['MFN'], 'inputs', { unit: '%' }),
  item('euPrice', 'Expected YoY EU List Pricing Opportunity (Year 1-15)', 'Forecast', 'asset', 1, 'Forecast', 'eu', ['MFN'], 'inputs', { unit: 'USD' }),
  item('euRev', 'Expected EU YoY Revenue (Year 1-15)', 'Forecast', 'ind', 0, 'Forecast', 'series', ['MFN'], 'inputs', { unit: 'USD', cond: 'noEuShare' }),
  item('medSpend', 'Assumed annual Medicare spend', 'Forecast', 'asset', 0, 'Forecast', 'text', ['IRA', 'MFN'], 'inputs', { field: 'Assumed annual Medicare spend', note: 'Not in the input list; the IRA ($200M) and MFN ($100M / $69M) eligibility checks still read it.' }),
  item('euComp', 'EU Comparator Selection', 'HTA Insights', 'ind', 1, 'Manual', 'sel', ['JCA', 'EU-GPL'], 'assumption', { opts: ['Accepted SOC', 'not SOC'], q: "Clarify whether the clinical trial's comparator is optimized for the accepted SOC in the EU" }),
  item('pricing', 'EU Comparator Pricing Potential', 'HTA Insights', 'ind', 0, 'Manual', 'sel', ['MFN'], 'assumption', { opts: ['Comparator provides viable pricing anchor', 'comparator do not provide a viable pricing anchor'], q: 'Clarify whether the trial comparator chosen provides a viable pricing anchor for the asset' }),
  item('itc', 'Indirect Treatment Comparison', 'HTA Insights', 'ind', 0, 'Manual', 'sel', ['MFN', 'JCA'], 'assumption', { opts: YN, cond: 'notH2h', q: 'Clarify feasibility to build a network meta analysis to conduct methodologically robust ITCs against comparators not considered in the pivotal trial' }),
  item('jsc', 'JSC Scientific Advice', 'HTA Insights', 'asset', 0, 'Manual', 'sel', ['JCA'], 'assumption', { opts: YNNA, q: 'Clarify whether a scientific advice strategy through the JSC has been done or considered' }),
  item('localHta', 'Local HTA Scientific Advice', 'HTA Insights', 'asset', 0, 'Manual', 'sel', ['MFN', 'JCA'], 'assumption', { opts: YNNA, q: 'Clarify whether a scientific advice strategy with local HTA bodies in planned EU launch markets has been done or considered' }),
  item('launchMarkets', 'Launch Markets', 'Regulatory', 'asset', 1, 'Manual', 'sel', ['MFN'], 'setup', { opts: LAUNCH_MARKETS }),
  item('euAccess', 'EU Markets Access Challenge', 'Regulatory', 'asset', 0, 'Manual', 'sel', ['EU-GPL'], 'assumption', { opts: YN, q: 'Clarify whether there are any EU markets with predicted access challenges' }),
  item('cancer', 'Indicated in the Treatment of Cancer', 'Regulatory', 'ind', 1, 'Manual', 'sel', ['JCA'], 'assumption', { opts: ['Yes', 'No', 'Uncertain'], q: 'Clarify whether the product is indicated in the treatment of cancer' }),
  item('fdaOdd', 'FDA Orphan Drug Designation', 'Regulatory', 'ind', 1, 'Manual', 'sel', ['IRA', 'MFN'], 'assumption', { opts: YN, q: 'Denote if the product has received or has high probability to receive Orphan Drug Designation for each indication' }),
  item('emaOd', 'EMA Orphan Designation', 'Regulatory', 'ind', 1, 'Manual', 'sel', ['JCA', 'EU-GPL'], 'assumption', { opts: ['Orphan', 'Breakthrough Orphan', 'No'], q: 'Denote if the product has received or has high probability to receive Orphan or Breakthrough Orphan Designation for each indication' }),
  item('umn', 'Unmet Medical Need Addressed As Defined by the EMA', 'Regulatory', 'ind', 0, 'Manual', 'sel', ['EU-GPL'], 'assumption', { opts: YN, q: 'Denote if the product addresses an unmet medical need (UMN) as defined by the EMA' }),
  item('regStrategy', 'Regulatory Strategy Alignment', 'Regulatory', 'asset', 0, 'Manual', 'sel', ['JCA', 'EU-GPL'], 'assumption', { opts: YN, cond: 'late', q: 'Clarify whether the regulatory strategy has already taken account and planned alignment with JCA delivery (e.g., MAA filing timing, indication wording, label scenarios, and sequencing of subsequent indications)' }),
  item('fdaSa', 'FDA Scientific Advice', 'Regulatory', 'asset', 0, 'Manual', 'sel', ['IRA', 'MFN'], 'assumption', { opts: YNNA, q: 'Clarify whether a scientific advice strategy with the FDA has been done or considered' }),
  item('chmpSa', 'CHMP Scientific Advice', 'Regulatory', 'asset', 0, 'Manual', 'sel', ['EU-GPL'], 'assumption', { opts: YNNA, q: 'Clarify whether a scientific advice strategy with the CHMP has been done or considered' }),
  item('usSub', 'US FDA Submission Timing', 'Regulatory', 'ind', 0, 'CDP', 'ym', ['IRA', 'MFN'], 'indications', { col: 'Submission', region: 'US' }),
  item('maaSub', 'EU MAA Submission Timing', 'Regulatory', 'ind', 1, 'CDP', 'ym', ['EU-GPL'], 'indications', { col: 'MAA Submission', region: 'EU' }),
  item('usApp', 'US FDA Approval Timing', 'Regulatory', 'ind', 0, 'CDP', 'ym', ['IRA', 'MFN'], 'indications', { col: 'Approval', region: 'US' }),
  item('euApp', 'EU EMA Approval Timing', 'Regulatory', 'ind', 1, 'CDP', 'year', ['MFN', 'JCA', 'EU-GPL'], 'indications', { col: 'Approval', region: 'EU' }),
  item('usLaunch', 'US Launch Timing', 'Regulatory', 'ind', 1, 'CDP', 'ym', ['IRA', 'MFN'], 'indications', { col: 'Launch', region: 'US' }),
  item('euLaunch', 'EU Launch Timing', 'Regulatory', 'ind', 1, 'CDP', 'year', ['MFN', 'JCA', 'EU-GPL'], 'indications', { col: 'Launch', region: 'EU' }),
  // JCA Insights Availability is a competitor input at asset level (Competitor sheet, location Inputs)
  item('jcaInsights', 'JCA Insights Availability', 'Competitors', 'asset', 0, 'Manual', 'sel', ['JCA'], 'inputs', { opts: YN, note: 'Competitor input (asset level): are there published JCA assessment scopes and reports for competitor products in the same or adjacent indications?' }),
  // ---- Competitor inputs (per competitor) ----
  item('cPhase', 'Phase of Development', 'Asset Description', 'comp', 0, 'CI', 'sel', ['IRA', 'JCA'], 'inputs', { opts: COMPETITOR_PHASES }),
  item('cDiff', 'Level of Clinical Differentiation vs. Takeda Asset', 'Clinical', 'comp', 0, 'Manual', 'sel', ['IRA'], 'assumption', { opts: HMLU, q: 'Input expected magnitude of clinical differentiation vs. Takeda asset' }),
  item('cRisk', 'Level of MFP Negotiation Risk', 'Competitive Intelligence', 'comp', 0, 'Manual', 'sel', ['IRA'], 'inputs', { opts: ['Low', 'Medium', 'High'] }),
  item('cMfp', 'Expected MFP Negotiation Timing', 'Competitive Intelligence', 'comp', 0, 'Manual', 'year', ['IRA'], 'inputs'),
  item('cGeneric', 'Expected Date of Generic / Biosimilar Entry in USA', 'Forecast', 'comp', 0, 'CI', 'year', ['IRA'], 'inputs', { srcNote: 'CI deck or manual' }),
  item('cSpend', 'Non-Risk Adjusted Annual Medicare Expenditures (Year 1-15)', 'Forecast', 'comp', 0, 'Manual', 'series', ['IRA'], 'assumption', { unit: 'USD', q: 'Input the anticipated annual Medicare spend for the competitor within the indication assuming year 1 is the launch year' }),
  item('cWac', 'Expected Annual WAC Price at Takeda Asset Launch', 'Forecast', 'comp', 0, 'Manual', 'num', ['IRA'], 'inputs', { unit: 'USD' }),
  item('cTrial', 'Chance of Regulatory Trial Success', 'Regulatory', 'comp', 0, 'Manual', 'sel', ['IRA'], 'assumption', { opts: HMLU, q: 'Indicate the likelihood of the competitor having a successful regulatory trial' }),
  item('cApproval', 'Expected USA Regulatory Approval Timing', 'Regulatory', 'comp', 0, 'CI', 'year', ['IRA'], 'inputs')
];

/** Region tags: each input's Geography Scope (Global = shared) as set in the AI team's input catalogue (structx_db input.geography). */
const REG_US = ['usSub', 'usApp', 'usLaunch', 'modeAdmin', 'payer', 'generic', 'usPop', 'usShare', 'usRev', 'wac', 'usDiff', 'fdaOdd', 'fdaSa', 'medSpend', 'cApproval', 'cGeneric', 'cMfp', 'cRisk', 'cSpend', 'cWac'];
const REG_EU = ['maaSub', 'euApp', 'euLaunch', 'euPop', 'euShare', 'euRev', 'euDiff', 'euComp', 'pricing', 'emaOd', 'umn', 'regStrategy', 'euAccess', 'jsc', 'localHta', 'chmpSa', 'jcaInsights', 'euPrice'];
INPUT_ITEMS.forEach(it => { it.reg = REG_US.includes(it.k) ? 'US' : REG_EU.includes(it.k) ? 'EU' : 'Both'; });

/** Asset- and indication-level items by key (competitor keys are distinct: cPhase, cApproval, …). */
export const INPUT_ITEM: Record<string, InputItem> = Object.fromEntries(INPUT_ITEMS.filter(x => x.lvl !== 'comp').map(x => [x.k, x]));

/** Year 1 value grown by g a year, Years 1-15 (illustrative sample series). */
export const grow = (y1: number, g: number, n = 15) => Array.from({ length: n }, (_, i) => Math.round(y1 * Math.pow(1 + g, i)));

/** TEST-100 net revenue per year ($M), Years 1-15; the sample EU / US revenue series below are shares of it. */
const TEST100_REV_M = [25, 70, 120, 160, 195, 215, 225, 227, 227, 227, 227, 227, 227, 227, 114];

/** TEST-100 synthetic sample data (illustrative only; not taken from any Takeda document). */
export const TEST100_INPUTS: { asset: InputValues; inds: InputValues[]; comps: (InputValues & { name: string; vsInd: number })[] } = {
  asset: {
    modality: 'Small molecule', launchMarkets: 'global launch (including US and EU)', modeAdmin: 'Outpatient, HCP-administered (Medicare Part B)', moa: 'Best in class',
    wac: grow(210000, 0.03), euPrice: Object.fromEntries(EU_REFERENCE_COUNTRIES.map((c, i) => [c, grow(95000 + ((i * 7) % 12) * 5000, 0.02)])),
    regStrategy: 'No', euAccess: '', jcaInsights: 'No', jsc: 'Yes', fdaSa: 'Yes', generic: '2043'
  },
  inds: [
    { launchUSMonth: 'Jun', revShare: 0.45, phase: 'Phase III', usSub: { y: '2030', m: 'Jun' }, usApp: { y: '2031', m: 'Feb' }, maaSub: { y: '2030', m: 'Sep' }, euApp: '2031', tclass: 'Blood products and modifiers', cancer: 'Yes', emaOd: 'Orphan', duration: 14, usPop: grow(4200, 0.02), usShare: [2, 5, 9, 13, 16, 18, 19, 20, 20, 20, 20, 20, 20, 20, 18], payer: 60, euPop: grow(5100, 0.01), euShare: [1, 3, 6, 9, 11, 12, 13, 13, 13, 13, 13, 13, 13, 13, 12], usDiff: 'High', euDiff: 'Medium', umn: 'Yes', sites: ['United States', 'France', 'Germany', 'Italy', 'Spain', 'Other EU market'], sitesOtherEu: 4, trialDesign: 'Head-to-head', compType: ['Fixed active comparator / treatment'], blinding: 'double-blind', strat: 'Yes', euComp: 'Accepted SOC', pricing: 'Comparator provides viable pricing anchor', pre: 'No', trialPop: 'Yes' },
    { launchUSMonth: 'Oct', revShare: 0.40, phase: 'Phase III', usApp: { y: '2029', m: 'Jul' }, maaSub: { y: '2029', m: 'Jan' }, euApp: '2030', tclass: 'Blood products and modifiers', cancer: 'Yes', emaOd: 'No', duration: 18, usPop: grow(9000, 0.015), usShare: [3, 7, 11, 14, 16, 17, 18, 18, 18, 18, 18, 18, 18, 18, 16], payer: 65, euRev: TEST100_REV_M.map(v => Math.round(v * 0.40 * 0.3) * 1e6), usDiff: 'Medium', euDiff: 'Medium', umn: 'No', sites: ['United States', 'Germany'], trialDesign: 'placebo-controlled', itc: 'Yes', subgroup: 'No', euComp: 'Accepted SOC', pre: 'Yes', trialPop: 'Partially', rwSku: 'Yes' },
    { launchUSMonth: 'Mar', revShare: 0.15, phase: 'Phase II/III', maaSub: { y: '2031', m: 'Mar' }, euApp: '2032', tclass: 'Blood products and modifiers', cancer: 'Yes', emaOd: 'No', payer: 62, usRev: TEST100_REV_M.map(v => Math.round(v * 0.15 * 0.7 * 10) * 1e5), euRev: TEST100_REV_M.map(v => Math.round(v * 0.15 * 0.3 * 10) * 1e5), trialDesign: 'placebo-controlled', itc: 'No', euComp: 'not SOC' }
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
  if (/cell|gene|cgt/i.test(s)) return 'cell & gene therapy';
  if (/plasma/i.test(s)) return 'Biologic – plasma-derived';
  if (/biolog|large/i.test(s)) return 'Biologic (other)';
  return '';
}
export const phaseFrom = (stage: string) => ({ 'Phase 1': 'Phase I', 'Phase 2': 'Phase II', 'Phase 3': 'Phase III' } as Record<string, string>)[stage] || '';

/** Indication-level catalogue values (never undefined). */
export const indValues = (ind: Indication | undefined): InputValues => ind?.v6 || {};
export const str = (v: unknown) => (v == null ? '' : String(v));

export const isEmptyValue = (v: unknown) =>
  v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v as object).length);

/**
 * Seed the catalogue store for an asset workspace (v09 v6Seed). Mutates `a.aia`; call only in reducers.
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
    w.v6.conflicts = { generic: { state: 'open', choice: null, opts: [{ v: '2043', src: 'Forecast Assumptions · Launch tab' }, { v: '2042', src: 'Forecast Assumptions · Assumptions tab' }] } };
    if (s.indications[0]) s.indications[0].conflicts = { euLaunch: { state: 'open', choice: null, opts: [{ v: '2032', src: 'CDP · slide 7' }, { v: '2033', src: 'Forecast Assumptions · Launch tab' }] } };
    return;
  }
  const mode = /part d/i.test(s.route || '') ? MODE_OF_ADMIN[2] : /part b/i.test(s.route || '') ? MODE_OF_ADMIN[1] : '';
  w.v6 = { asset: { modality: normModality(a.context?.modality || s.modality), modeAdmin: mode }, comp: [] };
  s.indications.forEach(ind => { ind.v6 = ind.v6 || { phase: phaseFrom(stage), tclass: classToCatalogue(s.tclass) }; });
}
