import { isMock } from '../../config/env';
import { endpoints } from '../endpoints';
import { http } from '../httpClient';
import { db, referenceData, respond } from '../mock/mockDb';
import type {
  ActivityEntry, Asset, DecisionTrace, ExtractedField, JudgmentQuestion, PolicyDelta, PolicyMonitoring,
  PolicyVersion, ReferenceData, Rule, SourceDocument, User, WorkspaceData
} from '../../types/domain';

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
        http.get<User[]>(endpoints.users.list),
        http.get<PolicyVersion[]>(g.policyVersions),
        http.get<PolicyDelta[]>(g.deltas),
        http.get<Rule[]>(g.rules),
        http.get<Record<string, DecisionTrace>>(g.decisionTraces),
        http.get<ActivityEntry[]>(endpoints.activity),
        http.get<PolicyMonitoring>(g.policyMonitoring)
      ]);
    return { assets, documents, fields, questions, users, policyVersions, deltas, rules, decisionTraces, activity, monitoring };
  }
};
