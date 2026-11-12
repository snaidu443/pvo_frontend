import { isMock } from '../../config/env';
import { endpoints } from '../endpoints';
import { http } from '../httpClient';
import { db, persist, respond, upsert } from '../mock/mockDb';
import type { Asset, DecisionTrace, ExtractedField, JudgmentQuestion } from '../../types/domain';

/** Payload for a newly created asset together with its generated starter records. */
export interface NewAssetPayload {
  asset: Asset;
  fields: ExtractedField[];
  questions: JudgmentQuestion[];
  trace: DecisionTrace;
}

export const assetService = {
  create(payload: NewAssetPayload): Promise<Asset> {
    if (!isMock()) return http.post<Asset>(endpoints.assets.create, payload);
    const saved = upsert(db.assets, payload.asset, a => a.id);
    db.fields.push(...structuredClone(payload.fields));
    db.questions.push(...structuredClone(payload.questions));
    db.decisionTraces[payload.asset.id] = structuredClone(payload.trace);
    persist();
    return respond(saved);
  },

  /** Saves the asset record, including its assessment workspace and assessment history. */
  update(asset: Asset): Promise<Asset> {
    if (!isMock()) return http.put<Asset>(endpoints.assets.byId(asset.id), asset);
    const saved = upsert(db.assets, asset, a => a.id);
    persist();
    return respond(saved);
  },

  remove(id: string): Promise<void> {
    if (!isMock()) return http.delete(endpoints.assets.byId(id));
    db.assets = db.assets.filter(a => a.id !== id);
    db.fields = db.fields.filter(f => f.assetId !== id);
    db.questions = db.questions.filter(q => q.assetId !== id);
    db.documents = db.documents.filter(d => d.assetId !== id);
    delete db.decisionTraces[id];
    persist();
    return respond(undefined);
  }
};
