import { endpoints } from '../endpoints';
import { http } from '../httpClient';
import type { SourceDocument } from '../../types/domain';

/** Documents are read, added (multipart) and relabelled through the API, which keeps them in structx.sqlite. */
export const documentService = {
  /** The documents of one asset, freshly read. */
  listForAsset(assetId: string): Promise<SourceDocument[]> {
    return http.get<SourceDocument[]>(endpoints.documents.forAsset(assetId));
  },

  /** Uploads one file into a document slot (type = CI, Protocol, CDP or Forecast). The server checks the type, size and content. */
  add(assetId: string, type: string, file: File): Promise<SourceDocument> {
    const form = new FormData();
    form.append('type', type);
    form.append('file', file, file.name);
    return http.post<SourceDocument>(endpoints.documents.forAsset(assetId), form);
  },

  /** Removes a document (DELETE /documents/{id}): its record and its file on the server. Values extracted from it stay. */
  remove(id: number): Promise<void> {
    return http.delete(endpoints.documents.byId(id));
  },

  /** Saves the document's labels (PATCH /documents/{id}). */
  update(record: SourceDocument): Promise<SourceDocument> {
    return http.patch<SourceDocument>(endpoints.documents.byId(record.id), record);
  }
};
