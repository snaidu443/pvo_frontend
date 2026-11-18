import { isMock } from '../../config/env';
import { endpoints } from '../endpoints';
import { ApiError, http } from '../httpClient';
import { db, referenceData, respond } from '../mock/mockDb';
import type {
  ActivityEntry, Asset, DecisionTrace, ExtractedField, JudgmentQuestion, PolicyDelta, PolicyMonitoring,
  PolicyVersion, ReferenceData, Rule, SourceDocument, User, WorkspaceData
} from '../../types/domain';

/**
 * The user list comes from structx.sqlite and needs an active user there. Someone without one (not added yet) is refused with
 * 403: that must not stop sign-in, they just see no users. Any other error (for example 401 signed out) still stops the load.
 */
const noUsersWhenRefused = (e: unknown): User[] => {
  if (e instanceof ApiError && e.status === 403) return [];
  throw e;
};

const text = (v: unknown) => (typeof v === 'string' ? v : '');

/**
 * The monitoring catalogue comes from the server and may be older or shorter than the screen expects (for example documents
 * without a publish date). Missing parts become empty text or lists, so the page shows what it has instead of failing.
 */
export function normalizeMonitoring(m: Partial<PolicyMonitoring> | null | undefined): PolicyMonitoring {
  const docs = Array.isArray(m?.documents) ? m.documents : [];
  return {
    ...(m as PolicyMonitoring),
    baselineDate: text(m?.baselineDate),
    lastRefresh: text(m?.lastRefresh),
    pipelines: Array.isArray(m?.pipelines) ? m.pipelines : [],
    documents: docs.filter(d => d && typeof d === 'object').map(d => ({ ...d, published: text(d.published), title: text(d.title), url: text(d.url), summary: text(d.summary) }))
  };
}

export const referenceService = {
  /** Static catalogues: policies, recommendation catalogue, tour, Co-Pilot KB, model constants. */
  get(): Promise<ReferenceData> {
    return isMock() ? respond(referenceData) : http.get<ReferenceData>(endpoints.reference);
  }
};

export const workspaceService = {
  /** Everything the signed-in user may see. The API must filter by the caller's asset access. */
  async load(): Promise<WorkspaceData> {
    if (isMock()) return respond(db);
    const g = endpoints.governance;
    const [assets, documents, fields, questions, users, policyVersions, deltas, rules, decisionTraces, activity, monitoring] =
      await Promise.all([
        http.get<Asset[]>(endpoints.assets.list),
        http.get<SourceDocument[]>(endpoints.documents.list),
        http.get<ExtractedField[]>(endpoints.inputs.fields),
        http.get<JudgmentQuestion[]>(endpoints.inputs.questions),
        http.get<User[]>(endpoints.users.list).catch(noUsersWhenRefused),
        http.get<PolicyVersion[]>(g.policyVersions),
        http.get<PolicyDelta[]>(g.deltas),
        http.get<Rule[]>(g.rules),
        http.get<Record<string, DecisionTrace>>(g.decisionTraces),
        http.get<ActivityEntry[]>(endpoints.activity),
        http.get<PolicyMonitoring>(g.policyMonitoring)
      ]);
    return { assets, documents, fields, questions, users, policyVersions, deltas, rules, decisionTraces, activity, monitoring: normalizeMonitoring(monitoring) };
  }
};
