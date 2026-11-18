/**
 * Adding source documents (Data Submission). A file goes to the API (POST /assets/{code}/documents), which checks it, saves it
 * in the upload folder and registers it in structx.sqlite. For a new product the files wait in memory (File objects are not
 * serialisable, so they stay out of Redux) and are sent right after the asset is created. They are lost on reload.
 */
import { ApiError } from '../api/httpClient';
import { documentService } from '../api';
import { DOC_LABELS } from '../engine/constants';
import { canEditAiaInputs } from '../engine/permissions';
import { docTypes, guessDocType } from '../engine/workspace';
import { DRAFT_ID, documentRemoved, documentSynced, documentsAdded } from '../store/slices/assessmentSlice';
import { dispatch, getState } from '../store/store';
import type { SourceDocument } from '../types/domain';
import { confirmAction, toast } from '../ui/overlay';
import { isDraft, now, record, subjectOf } from './core';
import { slotProblem } from './uploadRules';

const draftFiles = new Map<number, File>();
export const clearDraftFiles = () => { draftFiles.clear(); };
export const hasDraftFiles = () => draftFiles.size > 0;
const docId = () => Date.now() + Math.round(Math.random() * 1e6); // display-only until the server's id replaces it

/** The server's reason (it never echoes values), else the fallback. */
const why = (e: unknown, fallback: string) => (e instanceof ApiError && typeof e.detail === 'string' ? e.detail : fallback);

/** Add files from the browse button or a drop. `forcedType` is the slot whose "+ Add file" was used. One file per document type. */
export function addFiles(files: FileList | File[], forcedType?: string) {
  const st = getState(), a = subjectOf(st);
  if (st.page !== 'assetAnalysis' || !a || !canEditAiaInputs(st.role)) return;
  const { stamp, today } = now();
  const taken = new Set(st.documents.filter(d => d.assetId === a.id).map(d => docTypes(d)[0]));
  const accepted: { record: SourceDocument; file: File }[] = [];
  let problem: string | null = null;
  Array.from(files).forEach(file => {
    const type = forcedType || guessDocType(file.name);
    const bad = slotProblem(file, type) || (taken.has(type) ? `${DOC_LABELS[type]}: this asset already has a file. Remove it or relabel it first.` : null);
    if (bad) { problem ??= bad; return; }
    taken.add(type);
    accepted.push({
      file,
      record: { id: docId(), assetId: a.id, name: file.name.slice(0, 150), size: `${(file.size / 1024 / 1024).toFixed(1)} MB`, type, scope: 'Program-wide', version: 'Latest', tag: '', pages: '—', added: 'Just now', addedStamp: stamp }
    });
  });
  if (!accepted.length) { toast(problem || 'Accepted: PDF, Word, Excel (xlsx, xlsm), PowerPoint'); return; }
  if (isDraft(a)) {
    dispatch(documentsAdded({ assetId: a.id, docs: accepted.map(x => x.record), today }));
    accepted.forEach(({ record: r, file }) => draftFiles.set(r.id, file));
    toast(problem ? `${accepted.length} added. ${problem}` : `${accepted.length} file${accepted.length === 1 ? '' : 's'} ready. They upload when you click Extract data with AI.`);
    return;
  }
  accepted.forEach(({ record: r, file }) => {
    documentService.add(a.id, r.type, file).then(saved => {
      dispatch(documentsAdded({ assetId: a.id, docs: [saved], today }));
      record(`Added source document ${saved.name}`);
      toast(`${saved.name} uploaded.`);
    }).catch(e => toast(why(e, `${r.name} could not be uploaded. Please try again.`)));
  });
  if (problem) toast(problem);
}

/** Remove a saved file (for example to swap a Word protocol for its PDF). The server deletes the record and the file; extracted values stay. */
export function removeDocument(id: number) {
  const st = getState(), doc = st.documents.find(d => d.id === id), a = subjectOf(st);
  if (!doc || !a || isDraft(a) || !canEditAiaInputs(st.role)) return;
  confirmAction(
    `Remove ${doc.name}?`,
    'The file is deleted from the server. Values already extracted from it stay. Upload the replacement afterwards, then run the extraction again.',
    'Remove file',
    () => {
      documentService.remove(id).then(() => {
        dispatch(documentRemoved({ assetId: a.id, id, today: now().today }));
        record(`Removed source document ${doc.name}`);
        toast(`${doc.name} removed.`);
      }).catch(e => toast(why(e, `${doc.name} could not be removed. Please try again.`)));
    }
  );
}

/** A file picked for a new product can be taken back before the asset exists. Saved documents are not removed from here. */
export function removeDraftDocument(id: number) {
  const doc = getState().documents.find(d => d.id === id);
  if (!doc || doc.assetId !== DRAFT_ID) return;
  draftFiles.delete(id);
  dispatch(documentRemoved({ assetId: DRAFT_ID, id, today: now().today }));
}

/** After the asset exists: send the files picked on the form. Returns the messages of the ones that could not be uploaded. */
export async function uploadDraftFiles(assetId: string, localIds: number[]): Promise<{ failed: string[] }> {
  const failed: string[] = [];
  for (const id of localIds) {
    const file = draftFiles.get(id), doc = getState().documents.find(d => d.id === id);
    if (!file || !doc) continue;
    try {
      dispatch(documentSynced({ localId: id, saved: await documentService.add(assetId, docTypes(doc)[0], file) }));
    } catch (e) {
      failed.push(`${doc.name}: ${why(e, 'could not be uploaded')}`);
    }
    draftFiles.delete(id);
  }
  return { failed };
}
