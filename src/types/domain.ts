/**
 * Domain model. These shapes match the JSON in src/mocks/data and are the
 * contract the FastAPI backend should return (see docs/API_INTEGRATION.md).
 */

export type Role = 'Admin' | 'Editor' | 'Viewer';
export type PolicyCode = 'IRA' | 'MFN' | 'JCA' | 'EU-GPL';
export type PolicyMap<T> = Record<PolicyCode, T>;

export interface Policy {
  code: PolicyCode;
  name: string;
  region: string;
  color: string;
  impact: string;
  value: string;
  summary: string;
  trigger: string;
  implication: string;
}

export interface Indication {
  id?: string;
  name: string;
  orphanUS: string;
  orphanEU: string;
  launchUS: string;
  launchUSMonth?: string;
  launchEU: string;
  include?: boolean;
  source?: string;
  /** Indication-level values of the consolidated input catalogue (engine/inputCatalogue.ts), keyed by input key. */
  v6?: InputValues;
}

/**
 * A value in the consolidated input catalogue: text or number, a country list,
 * a Year 1-15 series, or one Year 1-15 series per EU reference country.
 */
export type InputValue = string | number | string[] | (number | null)[] | Record<string, (number | null)[]> | null | undefined;
export type InputValues = Record<string, InputValue>;

/** A competitor product entered on the Inputs tab (competitor-level catalogue inputs). */
export interface Competitor extends InputValues {
  name: string;
  /** Indication id the competitor is compared against. */
  vsId?: string;
}

export interface AssessmentSetup {
  name: string;
  area: string;
  stage: string;
  modality: string;
  route: string;
  tclass: string;
  indications: Indication[];
  indSeq?: number;
}

export interface ScenarioVariable {
  name: string;
  policy: PolicyCode;
  low: string;
  base: string;
  high: string;
}

export interface SavedScenario {
  name: string;
  time: string;
  by: string;
  vals: Record<string, number | string>;
  delta: number;
}

export type AiaTab = 'submission' | 'governance' | 'eligibility' | 'impact' | 'scenario';
export type GovView = 'indications' | 'fields' | 'judgment';
export type ImpactView = 'policy' | 'value' | 'recs';

/**
 * Per-asset assessment workspace. `setup`, `base`, `unlocked`, `variables`,
 * `priority`, `confirmed*` and `savedScenarios` are persisted data; the rest are
 * view preferences kept on the client (see services/assessmentService toDto).
 */
export interface AssessmentWorkspace {
  created: boolean;
  unlocked: AiaTab[];
  setup: AssessmentSetup;
  base: { peakUS: number; peakEU: number };
  variables: ScenarioVariable[];
  priority: number;
  confirmedBy: string;
  confirmedAt: string;
  savedScenarios?: SavedScenario[];
  /** Net revenue per year ($M), Years 1-15 from the first US launch, as confirmed on Inputs. */
  revenue?: number[];
  /** Asset-level catalogue inputs and competitors (v06/v07 consolidated input list). */
  v6?: { asset: InputValues; comp: Competitor[] };
  // view state
  govView: GovView;
  govFilter: string;
  govSearch: string;
  govRow: string | null;
  impactView: ImpactView;
  policyView?: PolicyCode;
  jcaInd: number;
  check: string;
  policiesOn: PolicyMap<boolean>;
  scenario: 'Base' | 'Mitigated' | 'Downside';
  applyRecs: boolean;
  openMitigation: string;
  scn?: Record<string, number | string>;
  scnRows?: string[];
}

export interface AssessmentRecord {
  id: string;
  date: string;
  by: string;
  status: 'Current' | 'Completed';
  level: string;
  atRisk: number;
  completeness: number;
}

export interface AssetContext {
  modality?: string;
  coverage?: string;
  medicareSpend?: number;
  launchUS?: number | null;
  launchEU?: number | null;
  priority?: string;
  sequence?: string;
  appetite?: string;
  marketArchetype?: string;
  patientShare?: string;
  usRevenue?: number;
  euRevenue?: number;
  [key: string]: unknown;
}

export interface Asset {
  id: string;
  assetCode: string;
  assetName: string;
  legacyAlias?: string;
  therapeuticArea: string;
  stage: string;
  jurisdictions: string[];
  policyExposures: PolicyCode[];
  submissionStatus: string;
  submissionCompleteness: number;
  eligibilityStatus: string;
  businessContextStatus: string;
  impactStatus: string;
  owner: string;
  lastUpdatedAt: string;
  estimatedImpactLevel: string;
  estimatedAtRisk: number;
  estimatedOpportunity: number;
  recommendationStatus: string;
  governanceAlerts: number;
  summaryMetrics: { gross: number; net: number; usRevenue: number; euRevenue: number };
  eligibility: Partial<PolicyMap<string>>;
  context: AssetContext;
  policyImpact: PolicyMap<number>;
  recommendationCount: number;
  approvalCount: number;
  createdByRole?: Role;
  /** API mode, server-owned: extracting | inputs_review | extraction_failed | active. Sent back on save and ignored. */
  workflowStatus?: string;
  assessments?: AssessmentRecord[];
  aia?: AssessmentWorkspace;
}

export type DocType = 'CI' | 'Protocol' | 'CDP' | 'Forecast' | string;

export interface SourceDocument {
  id: number;
  assetId: string;
  name: string;
  size: string;
  type: DocType;
  types?: DocType[];
  scope: string;
  version: string;
  tag: string;
  slideRef?: string;
  linkedDocId?: number;
  pages: string;
  added: string;
  addedStamp?: string;
  competitor?: boolean;
  /** API mode, server-owned: no_file | pending_scan | clean | infected | failed. */
  scanStatus?: string;
}

/** One "Extract data with AI" run on the server (API mode). */
export interface ExtractionJob {
  jobId: number;
  assetId: string;
  status: 'queued' | 'waiting_for_scan' | 'running' | 'done' | 'failed';
  error: string | null;
  fieldsFound: number;
  createdAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export type FieldStatus = 'AI-extracted' | 'Edited' | 'Conflict' | 'Missing' | 'Needs review';

export interface FieldHistory {
  time: string;
  who: string;
  text: string;
}

export interface ExtractedField {
  id: string;
  assetId: string;
  gen?: boolean;
  group: string;
  field: string;
  value: string;
  alternate?: string;
  prev?: string;
  confidence: string;
  source: string;
  feeds: PolicyCode[];
  status: FieldStatus;
  history?: FieldHistory[];
  indId?: string;
  confirmedBy?: string;
}

export interface JudgmentQuestion {
  id: string;
  assetId: string;
  gen?: boolean;
  group: string;
  text: string;
  options?: string[];
  perIndication?: boolean;
  ai: string;
  answer: string;
  answers?: Record<string, string>;
  evidence: string;
  source: string;
  confidence: string;
  policies: PolicyCode[];
  confirmedBy?: string;
}

export type JudgmentTemplate = Omit<JudgmentQuestion, 'id' | 'assetId' | 'answer' | 'gen'> & { answer?: string };

export interface Recommendation {
  rank: string;
  title: string;
  priority: string;
  rationale: string;
  policies: PolicyCode[];
  owner: string;
  timing: string;
  value: number;
  driver: string;
  detail: string;
}

export interface Synergy {
  kind: 'Synergy' | 'Tradeoff';
  text: string;
  policies: PolicyCode[];
  rank: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  roleCode?: string;
  active: boolean;
  status: 'active' | 'inactive' | 'pending';
  last: string;
  asset: string;
  assetIds: string[];
  assignedAssets?: string[];
  permissions?: string[];
}

export interface PolicyVersion {
  id: string;
  policySourceId: string;
  policyCode?: PolicyCode;
  versionLabel: string;
  detectedAt: string;
  effectiveDate: string;
  checksum: string;
  status: string;
  summary: string;
  materiality: string;
  changedSections: string[];
  impactedRuleIds: string[];
  submittedBy: string;
  approvedBy: string;
}

export interface PolicyDelta {
  id: string;
  policy: PolicyCode;
  sourceId: string;
  previousVersionId: string;
  versionId: string;
  detectedAt: string;
  materiality: string;
  status: string;
  summary: string;
  changedClauses: string[];
  recommendedAction: string;
  impactedRuleIds: string[];
  impactedAssetIds?: string[];
}

export interface RuleTestCase {
  name: string;
  input: string;
  expected: string;
  actual: string;
  pass: boolean;
}

export interface Rule {
  id: string;
  code: string;
  name: string;
  policy: PolicyCode;
  category: string;
  description: string;
  plainEnglishLogic: string;
  formalLogic: string;
  inputFields: string[];
  outputFields: string[];
  status: string;
  version: string;
  effectiveFrom: string;
  effectiveTo: string;
  owner: string;
  linkedPolicyVersionIds: string[];
  linkedApprovalId: string;
  lastUpdatedBy: string;
  lastUpdatedAt: string;
  lastTestedAt?: string;
  testCases: RuleTestCase[];
  impactedAssetIds?: string[];
}

export interface DecisionTrace {
  assetId: string;
  activePolicyVersions: Record<string, string>;
  activeRuleVersions: Record<string, string>;
  firedRules: string[];
  skippedRules: string[];
  failedRules: string[];
  outputSummary: string;
  explanationLog: string[];
}

/* ---------------- rules catalogue (read-only) ---------------- */

export interface RuleCitation {
  id: string;
  quote: string;
  doc: string;
  docType: string;
  url: string;
  illustrative: boolean;
}

export interface PolicyRule {
  id: string;
  policy: PolicyCode;
  category: string;
  name: string;
  text: string;
  inputFields?: string[];
  citations: RuleCitation[];
  /** Why a rule has no citation: 'NA' = business knowledge, 'Pending' = citation still to come. */
  noCitation?: 'NA' | 'Pending';
}

/* ---------------- policy refresh monitoring (read-only) ---------------- */

export interface MonitoringPipeline {
  policy: PolicyCode;
  name: string;
  lastRun: string;
  status: 'ok' | 'failed';
  failReason?: string;
}

/** A new policy document found by a source pipeline since the baseline (v07: listed only, no comparison). */
export interface MonitoredDocument {
  policy: PolicyCode;
  /** Publish date, e.g. "17 Oct 2026". */
  published: string;
  title: string;
  /** Official source page; only https: links are rendered (see safeDocUrl). */
  url: string;
  /** Short AI summary (illustrative). */
  summary: string;
}

export interface PolicyMonitoring {
  baselineDate: string;
  lastRefresh: string;
  pipelines: MonitoringPipeline[];
  documents: MonitoredDocument[];
}

export interface IraConsideration {
  q: string;
  context: string;
  cats: { cat: string; strategies: string[] }[];
}

export interface RecommendationCard {
  rank?: string;
  title: string;
  copy: string;
  policies: PolicyCode[];
  synergy?: string;
  owner: string;
  timing: string;
}

export interface TourSlide {
  title: string;
  text: string;
  points: string[];
  icon: string;
}

export interface ActivityEntry {
  event: string;
  user: string;
  time: string;
}

export interface CopilotEntry {
  question: string;
  answer: string;
  pattern: string;
  flags: string;
}

/** Static reference data the backend serves once (GET /reference). */
export interface ReferenceData {
  policies: Policy[];
  recommendations: Recommendation[];
  tour: TourSlide[];
  judgmentQuestions: JudgmentTemplate[];
  defaultVariables: ScenarioVariable[];
  sampleImpact: PolicyMap<number>;
  synergies: Synergy[];
  initialDecisionTrace: DecisionTrace;
  copilot: { questionOrder: string[]; knowledgeBase: CopilotEntry[] };
  /** Current active rules from the policy framework (read-only catalogue). */
  policyRules: PolicyRule[];
  /** IRA Part II considerations shown on Impact by Policy (framework workbook wording). */
  iraConsiderations: IraConsideration[];
  /** Recommendation card overrides from the feedback mock, keyed by recommendation rank. */
  recommendationCards: Record<string, RecommendationCard>;
}

/** Everything the workspace loads after sign-in. */
export interface WorkspaceData {
  assets: Asset[];
  documents: SourceDocument[];
  fields: ExtractedField[];
  questions: JudgmentQuestion[];
  users: User[];
  policyVersions: PolicyVersion[];
  deltas: PolicyDelta[];
  rules: Rule[];
  decisionTraces: Record<string, DecisionTrace>;
  activity: ActivityEntry[];
  /** Policy refresh monitoring: new policy documents per pipeline (read-only). */
  monitoring: PolicyMonitoring;
}

export interface SessionUser {
  name: string;
  role: Role;
}
