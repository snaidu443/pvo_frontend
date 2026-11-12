/** Pure Data Submission checks (no store, no UI), shared by the actions and the tests. Same rules as the server. */
import { ApiError } from '../api/httpClient';
import { SUBMISSION_FORMATS, SUBMISSION_LIMITS } from '../api/services/submissionService';
import { DOC_LABELS } from '../engine/constants';

export const fileExt = (name: string) => (name.split('.').pop() || '').toLowerCase();
export const mb = (bytes: number) => Math.round(bytes / 1024 / 1024);

/** The message the server sent ({detail: string} or {detail: {message}}), else the fallback. */
export function apiMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    const d = e.detail as { message?: unknown } | string | undefined;
    if (typeof d === 'string') return d;
    if (d && typeof d === 'object' && typeof d.message === 'string') return d.message;
    if (e.status === 0) return e.message;
  }
  return fallback;
}

/** Can this file go into this slot? Returns a message when it cannot. */
export function slotProblem(file: File, docType: string): string | null {
  const allowed = SUBMISSION_FORMATS[docType];
  if (!allowed) return `${file.name}: choose one of the four document types.`;
  if (!allowed.includes(fileExt(file.name))) return `${DOC_LABELS[docType] || docType} accepts ${allowed.join(', ')} files.`;
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > SUBMISSION_LIMITS.fileBytes) return `Files must be ${mb(SUBMISSION_LIMITS.fileBytes)} MB or smaller.`;
  return null;
}

/** First slot whose formats accept this file (for drag-and-drop when the guessed slot does not). */
export function slotFor(file: File, guessed: string): string | null {
  const ext = fileExt(file.name);
  if (SUBMISSION_FORMATS[guessed]?.includes(ext)) return guessed;
  return Object.keys(SUBMISSION_FORMATS).find(t => SUBMISSION_FORMATS[t].includes(ext)) ?? null;
}
