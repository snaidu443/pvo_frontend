import { isMock } from '../../config/env';
import { endpoints } from '../endpoints';
import { http } from '../httpClient';
import { db, persist, respond, upsert } from '../mock/mockDb';
import type { SourceDocument } from '../../types/domain';

export const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'xlsm', 'ppt', 'pptx', 'csv'] as const;
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const documentService = {
  /**
   * Mock: records the file name and size only; file bytes are never read or stored.
   * API: multipart upload. The backend must re-validate type/size, virus-scan, and
   * must never execute macros (xlsm).
   */
  add(record: SourceDocument, file?: File): Promise<SourceDocument> {
    if (!isMock()) {
      const form = new FormData();
      form.append('metadata', JSON.stringify(record));
      if (file) form.append('file', file);
      return http.post<SourceDocument>(endpoints.documents.forAsset(record.assetId), form);
    }
    const saved = upsert(db.documents, record, d => d.id);
    persist();
    return respond(saved);
  },

  update(record: SourceDocument): Promise<SourceDocument> {
    if (!isMock()) return http.patch<SourceDocument>(endpoints.documents.byId(record.id), record);
    const saved = upsert(db.documents, record, d => d.id);
    persist();
    return respond(saved);
  },

  remove(id: number): Promise<void> {
    if (!isMock()) return http.delete(endpoints.documents.byId(id));
    db.documents = db.documents.filter(d => d.id !== id);
    persist();
    return respond(undefined);
  },

  /** Move draft documents onto a newly created asset (mock only; the API links them on create). */
  reassign(fromAssetId: string, toAssetId: string): Promise<void> {
    if (!isMock()) return Promise.resolve();
    db.documents.forEach(d => { if (d.assetId === fromAssetId) d.assetId = toAssetId; });
    persist();
    return respond(undefined);
  }
};
