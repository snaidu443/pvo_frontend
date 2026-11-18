/** Pure checks for a file going into a document slot (no store, no network), shared by the action and the tests. */
import { DOC_LABELS, DOC_SLOTS } from '../engine/constants';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Message for a file that cannot go into this slot, or null. The server checks the same things again. */
export function slotProblem(file: File, type: string): string | null {
  const slot = DOC_SLOTS.find(s => s[0] === type);
  const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
  if (!slot) return `${file.name}: choose one of the four document types.`;
  if (!slot[4].split(',').includes(ext)) return `${DOC_LABELS[type]} accepts ${slot[4].replace(/\./g, '').split(',').join(', ')} files.`;
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > MAX_UPLOAD_BYTES) return `Files must be ${MAX_UPLOAD_BYTES / 1024 / 1024} MB or smaller.`;
  return null;
}
