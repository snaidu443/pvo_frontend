/**
 * In-memory mock backend seeded from src/mocks/data/*.json.
 * Only used when PVO_DATA_SOURCE=mock. It mimics what the FastAPI service will
 * do: hold the data, apply writes, and (like the HTML demo) keep user-created
 * assets and document records in this browser's localStorage.
 */
import { env } from '../../config/env';
import type {
  ActivityEntry, Asset, DecisionTrace, ExtractedField, JudgmentQuestion, PolicyDelta, PolicyMonitoring,
  PolicyVersion, ReferenceData, Rule, SourceDocument, User, WorkspaceData
} from '../../types/domain';

import assets from '../../mocks/data/assets.json';
import documents from '../../mocks/data/documents.json';
import users from '../../mocks/data/users.json';
import policies from '../../mocks/data/policies.json';
import recommendations from '../../mocks/data/recommendations.json';
import policyVersions from '../../mocks/data/policyVersions.json';
import policyDeltas from '../../mocks/data/policyDeltas.json';
import rules from '../../mocks/data/rules.json';
import decisionTraces from '../../mocks/data/decisionTraces.json';
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
  assets: clone(assets) as Asset[],
  documents: clone(documents) as SourceDocument[],
  fields: [] as ExtractedField[],
  questions: [] as JudgmentQuestion[],
  users: clone(users) as User[],
  policyVersions: clone(policyVersions) as PolicyVersion[],
  deltas: clone(policyDeltas) as PolicyDelta[],
  rules: clone(rules) as Rule[],
  decisionTraces: clone(decisionTraces) as Record<string, DecisionTrace>,
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

/* ---------- localStorage persistence (browser only, demo data only) ---------- */
const ASSET_KEY = 'pvo.customAssets';
const DOC_KEY = 'pvo.documents';
const isUserAssetId = (id: unknown) => typeof id === 'string' && /^NEW-\d+$/.test(id);
const str = (v: unknown, n: number) => String(v ?? '').slice(0, n);

interface StoredAsset {
  asset: Asset;
  fields: ExtractedField[];
  questions: JudgmentQuestion[];
  trace?: DecisionTrace;
}

function readJson(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

/** Values read back from storage are untrusted: keep only well-formed records. */
function restore() {
  const list = readJson(ASSET_KEY);
  if (Array.isArray(list)) {
    for (const item of list as StoredAsset[]) {
      const a = item?.asset;
      if (!a || !isUserAssetId(a.id) || !Array.isArray(a.jurisdictions) || !Array.isArray(a.policyExposures)) continue;
      if (db.assets.some(x => x.id === a.id)) continue;
      db.assets.push(a);
      if (Array.isArray(item.fields)) db.fields.push(...item.fields.filter(f => f && f.assetId === a.id && typeof f.id === 'string'));
      if (Array.isArray(item.questions)) db.questions.push(...item.questions.filter(q => q && q.assetId === a.id && typeof q.id === 'string'));
      if (item.trace && typeof item.trace === 'object') db.decisionTraces[a.id] = item.trace;
    }
  }
  const docs = readJson(DOC_KEY);
  if (docs && typeof docs === 'object' && !Array.isArray(docs)) {
    const known = new Set(db.assets.map(a => a.id));
    for (const [assetId, rows] of Object.entries(docs as Record<string, unknown>)) {
      if (!known.has(assetId) || !Array.isArray(rows)) continue;
      const clean: SourceDocument[] = rows
        .filter((d: SourceDocument) => d && typeof d.name === 'string' && typeof d.type === 'string' && Number.isFinite(Number(d.id)))
        .map((d: SourceDocument) => ({
          id: Number(d.id), assetId, name: str(d.name, 200), size: str(d.size, 20), type: str(d.type, 30),
          types: Array.isArray(d.types) ? d.types.slice(0, 5).map(t => str(t, 30)) : undefined,
          scope: str(d.scope, 40), version: str(d.version, 40), tag: str(d.tag, 30), slideRef: str(d.slideRef, 20),
          linkedDocId: d.linkedDocId == null ? undefined : Number(d.linkedDocId), pages: str(d.pages, 30),
          added: str(d.added, 40), addedStamp: str(d.addedStamp, 40), competitor: !!d.competitor
        }));
      db.documents = db.documents.filter(d => d.assetId !== assetId).concat(clean);
    }
  }
}

export function persist() {
  try {
    const custom: StoredAsset[] = db.assets.filter(a => isUserAssetId(a.id)).map(asset => ({
      asset,
      fields: db.fields.filter(f => f.assetId === asset.id),
      questions: db.questions.filter(q => q.assetId === asset.id),
      trace: db.decisionTraces[asset.id]
    }));
    localStorage.setItem(ASSET_KEY, JSON.stringify(custom));
    const byAsset: Record<string, SourceDocument[]> = {};
    db.assets.forEach(a => { byAsset[a.id] = []; });
    db.documents.forEach(d => { byAsset[d.assetId]?.push(d); });
    localStorage.setItem(DOC_KEY, JSON.stringify(byAsset));
  } catch {
    /* storage full or blocked: the demo keeps working in memory */
  }
}

if (typeof localStorage !== 'undefined') restore();

export { db };

/** Insert or replace by key; returns the stored copy. */
export function upsert<T>(list: T[], item: T, key: (x: T) => unknown): T {
  const i = list.findIndex(x => key(x) === key(item));
  const copy = clone(item);
  if (i >= 0) list[i] = copy;
  else list.push(copy);
  return copy;
}
