/**
 * Data Submission in API mode: nothing is sent while the user fills in the form. "Extract data with AI"
 * sends the set-up fields and every file in one request (POST /assets/submissions); the server saves it all
 * in one transaction and starts an extraction job, which is polled here.
 *
 * Files picked for a new product are kept in memory in this module (File objects are not serialisable, so
 * they stay out of Redux). They are gone on reload; the page warns before the user leaves.
 */
import { ApiError } from '../api/httpClient';
import { SUBMISSION_LIMITS, submissionService, type SubmissionSetup } from '../api/services/submissionService';
import { DOC_LABELS } from '../engine/constants';
import { apiMessage, mb, slotProblem } from './submissionRules';
import { INPUT_ITEM, str } from '../engine/inputCatalogue';
import { readInput } from '../engine/inputs';
import { docTypes } from '../engine/workspace';
import { DRAFT_ID, extractionJobUpdated } from '../store/slices/assessmentSlice';
import { dispatch, getState } from '../store/store';
import type { ExtractionJob, SourceDocument } from '../types/domain';
import { toast } from '../ui/overlay';

export { apiMessage, slotFor, slotProblem } from './submissionRules';

/* ---------------- files picked for the draft ---------------- */

const draftFiles = new Map<number, File>();

export const keepDraftFile = (docId: number, file: File) => { draftFiles.set(docId, file); };
export const dropDraftFile = (docId: number) => { draftFiles.delete(docId); };
export const clearDraftFiles = () => { draftFiles.clear(); };
export const hasDraftFiles = () => draftFiles.size > 0;

interface Ready { setup: SubmissionSetup; items: { doc: SourceDocument; docType: string; file: File }[] }

/** Check the draft before sending; returns the request or a message for the user. */
function prepare(): Ready | string {
  const s = getState(), d = s.draft;
  if (!d?.aia) return 'Start a new product first.';
  const st = d.aia.setup, read = (k: string) => str(readInput(s, d, INPUT_ITEM[k])) || undefined;
  const modality = read('modality');
  if (!modality) return 'Select the Therapeutic Modality.';
  const docs = s.documents.filter(x => x.assetId === DRAFT_ID);
  if (!docs.length) return 'Upload at least one document.';
  if (docs.length > SUBMISSION_LIMITS.total) return `Upload at most ${SUBMISSION_LIMITS.total} files.`;

  const items: Ready['items'] = [], perType: Record<string, number> = {};
  let total = 0;
  for (const doc of docs) {
    const file = draftFiles.get(doc.id);
    if (!file) return `${doc.name} needs to be added again (files are not kept after a page reload).`;
    const docType = docTypes(doc)[0];
    const problem = slotProblem(file, docType);
    if (problem) return problem;
    perType[docType] = (perType[docType] || 0) + 1;
    if (perType[docType] > SUBMISSION_LIMITS.perType) return `${DOC_LABELS[docType]}: at most ${SUBMISSION_LIMITS.perType} files.`;
    total += file.size;
    items.push({ doc, docType, file });
  }
  if (total > SUBMISSION_LIMITS.totalBytes) return `All files together must be ${mb(SUBMISSION_LIMITS.totalBytes)} MB or smaller.`;
  return {
    setup: { name: st.name.trim(), area: st.area || undefined, modality, jcaInsights: read('jcaInsights'), regStrategy: read('regStrategy'), euAccess: read('euAccess') },
    items
  };
}

export type SubmitOutcome =
  | { ok: true; assetId: string; jobId: number; saved: { localId: number; doc: SourceDocument }[] }
  | { ok: false; message: string };

/** Send the draft. Nothing is created on the server unless every check passes there too. */
export async function sendSubmission(): Promise<SubmitOutcome> {
  const ready = prepare();
  if (typeof ready === 'string') return { ok: false, message: ready };
  try {
    const res = await submissionService.submit(ready.setup, ready.items.map(i => ({ docType: i.docType, file: i.file })));
    return { ok: true, assetId: res.assetId, jobId: res.jobId, saved: ready.items.map((i, k) => ({ localId: i.doc.id, doc: res.documents[k] })) };
  } catch (e) {
    return { ok: false, message: apiMessage(e, 'The submission could not be sent. Please try again.') };
  }
}

/** Fails fast in the browser (before the loader starts) for problems the user can fix on the form. */
export function submissionProblem(): string | null {
  const ready = prepare();
  return typeof ready === 'string' ? ready : null;
}

/* ---------------- extraction job polling ---------------- */

const timers = new Map<string, number>();
const ACTIVE: ExtractionJob['status'][] = ['queued', 'waiting_for_scan', 'running'];

export function stopWatching(assetId?: string) {
  const ids = assetId ? [assetId] : [...timers.keys()];
  ids.forEach(id => { window.clearTimeout(timers.get(id)); timers.delete(id); });
}

/** Poll one job until it is done or failed: every 3 s at first, slowing to every 30 s. */
export function watchExtraction(assetId: string, jobId: number) {
  stopWatching(assetId);
  let delay = 3000, tries = 0;
  const tick = async () => {
    try {
      const job = await submissionService.job(assetId, jobId);
      dispatch(extractionJobUpdated(job));
      if (job.status === 'done') { timers.delete(assetId); toast('Server extraction finished.'); return; }
      if (job.status === 'failed') { timers.delete(assetId); toast(job.error || 'Extraction failed. Try again.'); return; }
    } catch (e) {
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) { timers.delete(assetId); return; }
    }
    if (++tries > 120 || !timers.has(assetId)) { timers.delete(assetId); return; }
    delay = Math.min(30000, Math.round(delay * 1.4));
    timers.set(assetId, window.setTimeout(tick, delay));
  };
  timers.set(assetId, window.setTimeout(tick, 1500));
}

/** After a page reload: pick up the latest job of a submitted asset and keep polling it if it is still active. */
export function resumeExtraction(assetId: string) {
  if (timers.has(assetId) || getState().extractionJobs[assetId]) return;
  submissionService.latest(assetId).then(job => {
    dispatch(extractionJobUpdated(job));
    if (ACTIVE.includes(job.status)) watchExtraction(assetId, job.jobId);
  }).catch(() => { /* no job yet, or no access: nothing to show */ });
}

export async function retryExtraction(assetId: string) {
  try {
    const res = await submissionService.retry(assetId);
    const st = getState().extractionJobs[assetId];
    dispatch(extractionJobUpdated({ ...(st || { error: null, fieldsFound: 0, createdAt: null, startedAt: null, finishedAt: null }), assetId, jobId: res.jobId, status: 'queued', error: null }));
    watchExtraction(assetId, res.jobId);
    toast('Extraction started again.');
  } catch (e) {
    toast(apiMessage(e, 'Extraction could not be started again.'));
  }
}
