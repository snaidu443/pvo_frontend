import type {
  ActivityEntry, AiaTab, Asset, DecisionTrace, ExtractedField, ExtractionJob, JudgmentQuestion, PolicyCode, PolicyDelta, PolicyMonitoring,
  PolicyVersion, Role, Rule, SessionUser, SourceDocument, User
} from '../types/domain';
import type { PageId } from '../engine/constants';

/* ---------------- slice states ---------------- */

/** session slice: who is signed in and where they are in the sign-in flow. */
export interface SessionState {
  status: 'signed-out' | 'loading' | 'disclaimer' | 'ready';
  session: SessionUser | null;
  role: Role;
}

/** ui slice: navigation, selection and filters (browser-only, never sent to the API). */
export interface UiState {
  page: PageId;
  assetSubPage: AiaTab;
  selectedAssetId: string;
  aiaMode: 'asset' | 'new';

  overviewSearch: string;
  overviewPolicy: string;
  overviewStatus: string;
  overviewRisk: string;
  overviewGeography: string;
  overviewStage: string;
  overviewOwner: string;
  overviewSort: keyof Asset;

  /** Policy shown in the Rules engine catalogue. */
  rulesPolicy: PolicyCode;

  userSearch: string;
  userRoleFilter: string;
  userAssetFilter: string;
}

/** Text filters that can be set with the generic `filterChanged` action. */
export type FilterKey =
  | 'overviewSearch' | 'overviewPolicy' | 'overviewStatus' | 'overviewRisk' | 'overviewGeography' | 'overviewStage' | 'overviewOwner'
  | 'userSearch' | 'userRoleFilter' | 'userAssetFilter';

/** assessment slice: assets with their assessment workspace, the new-product draft and asset inputs. */
export interface AssessmentState {
  assets: Asset[];
  draft: Asset | null;
  documents: SourceDocument[];
  fields: ExtractedField[];
  questions: JudgmentQuestion[];
  /** API mode: latest server extraction job per asset id. */
  extractionJobs: Record<string, ExtractionJob>;
}

/** admin slice: users, policy versions and deltas, engine rules, decision traces, policy refresh monitoring (new documents) and the activity log. */
export interface AdminState {
  users: User[];
  policyVersions: PolicyVersion[];
  deltas: PolicyDelta[];
  rules: Rule[];
  decisionTraces: Record<string, DecisionTrace>;
  activity: ActivityEntry[];
  monitoring: PolicyMonitoring | null;
}

/** Flat read-only view of all slices, used by pages and the engine (see selectApp in store.ts). */
export type AppState = SessionState & UiState & AssessmentState & AdminState;

/* ---------------- initial values ---------------- */

export const initialSession = (): SessionState => ({ status: 'signed-out', session: null, role: 'Admin' });

export const initialUi = (): UiState => ({
  page: 'overview',
  assetSubPage: 'impact',
  selectedAssetId: 'TAK-481',
  aiaMode: 'asset',
  overviewSearch: '',
  overviewPolicy: 'All policies',
  overviewStatus: 'All statuses',
  overviewRisk: 'All risks',
  overviewGeography: 'All geographies',
  overviewStage: 'All stages',
  overviewOwner: 'All owners',
  overviewSort: 'assetName',
  rulesPolicy: 'IRA',
  userSearch: '',
  userRoleFilter: 'All roles',
  userAssetFilter: 'All assets'
});

export const initialAssessment = (): AssessmentState => ({ assets: [], draft: null, documents: [], fields: [], questions: [], extractionJobs: {} });

export const initialAdmin = (): AdminState => ({
  users: [], policyVersions: [], deltas: [], rules: [], decisionTraces: {}, activity: [], monitoring: null
});
