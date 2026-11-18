/**
 * Shared helpers for the action modules. Pattern used by every action:
 *   1. read current state (getState) and validate / check permissions
 *   2. dispatch a slice action with a serializable payload (UI updates immediately)
 *   3. write through to the service (mock DB now, REST API later)
 *   4. on failure, tell the user with a toast (the server stays the source of truth)
 * Action functions are exported pre-bound to the store, so components simply call them.
 */
import { activityService, assetService, documentService, inputsService } from '../api';
import { nowStamp, todayLabel } from '../engine/format';
import { createSaveQueue } from './saveQueue';
import { userLabel } from '../engine/permissions';
import type { AppState } from '../store/appState';
import { DRAFT_ID } from '../store/slices/assessmentSlice';
import { activityRecorded } from '../store/slices/adminSlice';
import { dispatch, getState } from '../store/store';
import type { Asset } from '../types/domain';
import { toast } from '../ui/overlay';

export const fail = (fallback: string) => (e: unknown) => {
  const msg = e instanceof Error && e.message ? e.message : fallback;
  toast(msg);
};

/** Values that make reducers non-deterministic are produced here and passed in payloads. */
export const now = () => ({ stamp: nowStamp(), today: todayLabel() });

/** The asset being worked on: the draft when adding a new product, else the selected asset. */
export function subjectOf(s: AppState): Asset | null {
  if (s.aiaMode === 'new') return s.draft;
  return s.assets.find(a => a.id === s.selectedAssetId) ?? null;
}

/** Id of the current subject ('__draft' for a new product). */
export const subjectId = (s: AppState) => (s.aiaMode === 'new' ? DRAFT_ID : s.selectedAssetId);

export const isDraft = (a: Pick<Asset, 'id'> | null | undefined) => !a || a.id === DRAFT_ID;

/** Append to the activity log (store + service). */
export function record(event: string) {
  const entry = { event, user: userLabel(getState()), time: 'Just now' };
  dispatch(activityRecorded(entry));
  activityService.record(entry).catch(() => { /* audit trail is best effort in the demo */ });
}

/**
 * Saves started and still running, so a refresh from the server never overwrites a newer local edit (see refreshAsset).
 * Asset saves go through a queue: one at a time per asset, each sending the latest state (see saveQueue.ts).
 */
let saveCount = 0, savesRunning = 0;
const assetSaves = createSaveQueue(
  id => { const cur = getState().assets.find(x => x.id === id); return cur ? assetService.update(cur) : Promise.resolve(); },
  fail('The asset could not be saved.')
);
export const saveActivity = () => ({ started: saveCount, running: savesRunning + assetSaves.active });
function tracked<T>(p: Promise<T>): Promise<T> {
  saveCount++; savesRunning++;
  return p.finally(() => { savesRunning--; });
}

/** Write the asset (with its workspace) through to the service. Drafts are not saved until created. */
export function saveAsset(id: string) {
  const a = getState().assets.find(x => x.id === id);
  if (!a || isDraft(a)) return;
  saveCount++;
  assetSaves.request(id);
}

/** Resolves when the asset's saves have finished: true if the last one succeeded (a failure has already been reported). */
export const assetSaved = (id: string): Promise<boolean> => assetSaves.settled(id);

export function saveSubject() {
  const a = subjectOf(getState());
  if (a && !isDraft(a)) saveAsset(a.id);
}

export function saveFieldsFor(assetId: string) {
  if (assetId === DRAFT_ID) return;
  inputsService.replaceFields(assetId, getState().fields.filter(f => f.assetId === assetId)).catch(fail('Inputs could not be saved.'));
}

export function saveField(fieldId: string) {
  const f = getState().fields.find(x => x.id === fieldId);
  if (f && f.assetId !== DRAFT_ID) inputsService.updateField(f).catch(fail('The field could not be saved.'));
}

export function saveQuestion(questionId: string) {
  const q = getState().questions.find(x => x.id === questionId);
  if (q && q.assetId !== DRAFT_ID) inputsService.updateQuestion(q).catch(fail('The answer could not be saved.'));
}

export function saveDocument(docId: number) {
  const d = getState().documents.find(x => x.id === docId);
  if (d && d.assetId !== DRAFT_ID) tracked(documentService.update(d)).catch(fail('Document details could not be saved.'));
}
