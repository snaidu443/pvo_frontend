/** UI catalogues and model constants (ported from the v05 HTML). */
import type { AiaTab, PolicyCode, PolicyMap } from '../types/domain';

export type PageId = 'overview' | 'assetAnalysis' | 'governance' | 'users' | 'monitoring' | 'rules';

export interface NavItem {
  id: PageId;
  label: string;
  icon: string;
  badge?: 'invites' | 'ewsFindings';
  /** Admin or Editor. */
  admin?: boolean;
  /** Admin only. */
  adminOnly?: boolean;
  group?: 'settings';
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'assetAnalysis', label: 'Asset Impact Analysis', icon: 'impact' },
  { id: 'governance', label: 'Inputs and Assumptions', icon: 'governance' },
  { id: 'users', label: 'User Management', icon: 'users', badge: 'invites', admin: true, group: 'settings' },
  { id: 'monitoring', label: 'Policy Refresh Monitoring', icon: 'clock', badge: 'ewsFindings', admin: true, adminOnly: true, group: 'settings' },
  { id: 'rules', label: 'Rules Engine', icon: 'eligibility', admin: true, group: 'settings' }
];

export const ASSET_SUB_PAGES: [AiaTab, string, string][] = [
  ['submission', 'Data Submission', 'upload'],
  ['governance', 'Inputs and Assumptions', 'governance'],
  ['eligibility', 'Eligibility', 'eligibility'],
  ['impact', 'Impact & Recommendations', 'impact'],
  ['scenario', 'Scenario Analysis', 'sliders']
];
export const AIA_ORDER: AiaTab[] = ASSET_SUB_PAGES.map(x => x[0]);

export const MODALITIES = ['Small molecule', 'Large molecule', 'Biologic', 'Cell therapy', 'Gene therapy'];
export const ROUTES = ['Oral · Part D', 'IV · Part B', 'SC · Part B', 'Oral · Part B', 'IV · Part D'];
export const TCLASSES = ['Antineoplastic', 'Immunomodulator', 'Hematologic', 'Neurologic', 'Endocrine'];
export const ASSET_AREAS = ['Oncology', 'Rare hematology', 'Immunology', 'Cell therapy', 'Neuroscience', 'Metabolic disease', 'Other'];

export const DOC_TYPES = ['CI', 'Protocol', 'CDP', 'Forecast'];
export const DOC_LABELS: Record<string, string> = { CI: 'Competitive Intelligence', Protocol: 'Trial Protocol Concept Sheet', CDP: 'Clinical Development Plan (CDP)', Forecast: 'Forecast Assumptions' };
/** [type, label, example, formats, accept] */
export const DOC_SLOTS: [string, string, string, string, string][] = [
  ['CI', 'Competitive Intelligence', 'CI_Quarterly_Update.pdf', 'PDF, PowerPoint', '.pdf,.ppt,.pptx'],
  ['Protocol', 'Trial Protocol Concept Sheet', 'Protocol_Concept_Sheet.docx', 'PDF, Word', '.pdf,.doc,.docx'],
  ['CDP', 'Clinical Development Plan (CDP)', 'CDP_FY27-29.pptx', 'PDF, Word, PowerPoint', '.pdf,.doc,.docx,.ppt,.pptx'],
  ['Forecast', 'Forecast Assumptions', 'Forecast_v3.xlsx or Forecast.pptx', 'Excel or PowerPoint (format to be confirmed)', '.xls,.xlsx,.xlsm,.csv,.ppt,.pptx']
];
export const FILE_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.xlsm,.ppt,.pptx';
/** "What to upload" guidance: [document, what it should contain]. */
export const UPLOAD_GUIDANCE: [string, string][] = [
  ['Clinical Development Plan', 'Indications being pursued, clinical development timelines, and launch assumptions.'],
  ['Forecast Assumptions', 'Patient volumes by indication, region, and payer mix; regional pricing opportunities; and regional revenue projections for the first 15 years after launch.'],
  ['Trial Protocol Concept Sheet', 'Clinical trial design, comparator selection by region, study population, endpoints, and analyses planned during or after the trial.'],
  ['Competitive Intelligence (optional)', 'Competitor pipeline products, anticipated regulatory approval timelines, and expected generic or biosimilar entry dates, where applicable.']
];

export const POLICY_SUB: PolicyMap<string> = { IRA: 'US · Medicare negotiation', MFN: 'US · reference pricing', JCA: 'EU · clinical assessment', 'EU-GPL': 'EU · market protection' };
export const POLICY_ICON: PolicyMap<string> = { IRA: 'trend', MFN: 'globe', JCA: 'eligibility', 'EU-GPL': 'governance' };
export const POLICY_ACCENT: PolicyMap<string> = { IRA: '#d9482b', MFN: '#7a4fb5', JCA: '#3b8fd0', 'EU-GPL': '#3f8f5f' };
export const POLICY_CODES: PolicyCode[] = ['IRA', 'MFN', 'JCA', 'EU-GPL'];

export const SEQ_F: Record<string, number> = { 'US-first': 1, Simultaneous: 1.1, 'EU-first': 0.9 };

/** Judgment question → [pattern, unfavourable answer, recommendation lever]. */
export const QMETA: [RegExp, string, string | null][] = [
  [/clinical differentiation/i, 'Low', 'G'], [/unmet need/i, 'No', 'D'], [/payer value recognition/i, 'Yes', 'G'],
  [/endpoint mature/i, 'No', 'B'], [/therapeutic class/i, 'Yes', null], [/access challenge/i, 'Yes', 'I'], [/key stakeholders for JCA/i, 'No', 'I']
];
export const LEVER_NAMES: Record<string, string> = { A: 'Modality & asset selection', D: 'Indication sequencing', G: 'Pre-launch evidence package', B: 'Post-launch evidence', I: 'EMA, JCA & HTA planning' };

export const ANALYSIS_STEPS = ['Validating business rules', 'Loading revenue forecast', 'Simulating policy scenarios', 'Calculating value at risk', 'Generating recommendations', 'Finalizing insights'];
export const EXTRACT_STEPS = ['Validating uploaded documents', 'Reading program inputs', 'Extracting fields with AI', 'Cross-checking sources', 'Preparing governance review'];
export const ELIGIBILITY_STEPS = ['Validating judgment answers', 'Loading policy rule sets', 'Evaluating eligibility gates', 'Scoring each policy', 'Compiling results'];

export const DISCLAIMER_PARAGRAPHS = [
  'The Global Policy Framework is a decision-support tool designed to help cross-functional teams assess an asset’s exposure to key market access policies, understand potential development and commercial implications, and evaluate mitigation strategies and trade-offs across policies. It complements—not replaces—existing asset planning processes and policy workstreams.',
  'Use it to inform asset reviews, clinical development milestones, responses to policy or competitive changes, and business development due diligence; identify potential risks; and structure cross-functional discussion of development, evidence-generation, and commercial planning options.',
  'Do not use it as the sole basis for asset strategy or investment decisions, as a definitive interpretation of policy, or as a guarantee of future pricing, access, or financial outcomes. Outputs depend on the available evidence, asset-specific inputs, and underlying assumptions and should be interpreted accordingly.',
  'Before acting on outputs, validate key inputs, assumptions, and policy interpretations with the relevant functional experts. Resolve flagged uncertainties and obtain appropriate cross-functional review and endorsement before implementing changes. Reassess conclusions as policies, evidence, or asset plans evolve.'
];

export const RULE_FIELD_MAP: Record<string, string> = {
  us_launch_year: 'US launch year', annual_medicare_spend: 'Assumed annual Medicare spend', orphan_status: 'Orphan designation', generic_entry_year: 'Expected generic entry year', modality: 'Modality',
  negotiation_year: 'US launch year', price_effective_year: 'Expected generic entry year', medicare_share: 'Medicare share of patients', ira_discount: 'Reference-price gap',
  medicare_coverage: 'Medicare coverage', therapeutic_class: 'Therapeutic class', us_net_revenue: 'Peak net revenue · US', reference_price_gap: 'Reference-price gap',
  launch_sequence: 'EU launch sequencing', eu_launch_year: 'EU launch year', product_type: 'Therapeutic class', indication: 'Orphan designation',
  os_maturity: 'OS data maturity at filing', comparator_evidence: 'Comparator', jca_delay_range: 'EU launch sequencing', unmet_need: 'EU market protection gain',
  comparative_trial: 'Comparator', new_indication: 'Orphan designation', supply_status: 'EU market protection gain',
  member_state_supply_status: 'EU market protection gain', launch_plan: 'EU launch sequencing'
};
