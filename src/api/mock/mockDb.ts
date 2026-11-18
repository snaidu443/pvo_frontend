/**
 * In-memory mock backend seeded from src/mocks/data/*.json (users, policies and the other catalogues).
 * Only used when PVO_DATA_SOURCE=mock. Assets, documents, inputs and assessments are NOT mocked: they come from the API
 * (structx.sqlite) only, so in mock mode those lists are empty.
 */
import { env } from '../../config/env';
import type {
  ActivityEntry, Asset, DecisionTrace, ExtractedField, JudgmentQuestion, PolicyDelta, PolicyMonitoring,
  PolicyVersion, ReferenceData, Rule, SourceDocument, User, WorkspaceData
} from '../../types/domain';

import users from '../../mocks/data/users.json';
import policies from '../../mocks/data/policies.json';
import recommendations from '../../mocks/data/recommendations.json';
import policyVersions from '../../mocks/data/policyVersions.json';
import policyDeltas from '../../mocks/data/policyDeltas.json';
import rules from '../../mocks/data/rules.json';
import tour from '../../mocks/data/tour.json';
import activity from '../../mocks/data/activity.json';
import reference from '../../mocks/data/reference.json';
import copilot from '../../mocks/data/copilot.json';
import policyRules from '../../mocks/data/policyRules.json';
import policyMonitoring from '../../mocks/data/policyMonitoring.json';
import iraConsiderations from '../../mocks/data/iraConsiderations.json';
import recommendationCards from '../../mocks/data/recommendationCards.json';

const clone = <T>(v: T): T => structuredClone(v);

/** Resolve after the configured mock latency with a deep copy (like a real response). */
export const respond = <T>(value: T): Promise<T> =>
  new Promise(resolve => setTimeout(() => resolve(clone(value)), env.mockLatencyMs));

const db: WorkspaceData = {
  assets: [] as Asset[],
  documents: [] as SourceDocument[],
  fields: [] as ExtractedField[],
  questions: [] as JudgmentQuestion[],
  users: clone(users) as User[],
  policyVersions: clone(policyVersions) as PolicyVersion[],
  deltas: clone(policyDeltas) as PolicyDelta[],
  rules: clone(rules) as Rule[],
  decisionTraces: {} as Record<string, DecisionTrace>,
  activity: clone(activity) as ActivityEntry[],
  monitoring: clone(policyMonitoring) as PolicyMonitoring
};

export const referenceData: ReferenceData = {
  policies: policies as ReferenceData['policies'],
  recommendations: recommendations as ReferenceData['recommendations'],
  tour: tour as ReferenceData['tour'],
  ...(reference as Omit<ReferenceData, 'policies' | 'recommendations' | 'tour' | 'copilot' | 'policyRules' | 'iraConsiderations' | 'recommendationCards'>),
  copilot: copilot as ReferenceData['copilot'],
  policyRules: policyRules as ReferenceData['policyRules'],
  iraConsiderations: iraConsiderations as ReferenceData['iraConsiderations'],
  recommendationCards: recommendationCards as ReferenceData['recommendationCards']
};

export { db };

/** Insert or replace by key; returns the stored copy. */
export function upsert<T>(list: T[], item: T, key: (x: T) => unknown): T {
  const i = list.findIndex(x => key(x) === key(item));
  const copy = clone(item);
  if (i >= 0) list[i] = copy;
  else list.push(copy);
  return copy;
}
