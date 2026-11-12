import { endpoints } from '../endpoints';
import { http } from '../httpClient';
import type { Asset, ExtractionJob, SourceDocument } from '../../types/domain';

/**
 * Data Submission (API mode only; mock mode keeps the in-browser demo flow).
 * Limits and formats mirror the FastAPI backend (app/files.py, app/config.py); the server re-checks everything.
 */
export const SUBMISSION_LIMITS = { perType: 5, total: 20, fileBytes: 50 * 1024 * 1024, totalBytes: 200 * 1024 * 1024 } as const;
export const SUBMISSION_FORMATS: Record<string, string[]> = {
  CI: ['pdf', 'ppt', 'pptx'],
  Protocol: ['pdf', 'doc', 'docx'],
  CDP: ['pdf', 'doc', 'docx', 'ppt', 'pptx'],
  Forecast: ['xls', 'xlsx', 'ppt', 'pptx']
};

export interface SubmissionSetup {
  name: string;
  area?: string;
  modality: string;
  jcaInsights?: string;
  regStrategy?: string;
  euAccess?: string;
}

export interface SubmissionResult {
  assetId: string;
  jobId: number;
  status: string;
  asset: Asset;
  /** Saved documents, in the same order as the files that were sent. */
  documents: SourceDocument[];
}

export const submissionService = {
  /** One multipart request: `metadata` JSON plus one `files` part per document, in the same order. */
  submit(setup: SubmissionSetup, items: { docType: string; file: File }[]): Promise<SubmissionResult> {
    const form = new FormData();
    form.append('metadata', JSON.stringify({ ...setup, documents: items.map(i => ({ docType: i.docType })) }));
    items.forEach(i => form.append('files', i.file, i.file.name));
    return http.post<SubmissionResult>(endpoints.submissions.create, form);
  },

  job(assetId: string, jobId: number): Promise<ExtractionJob> {
    return http.get<ExtractionJob>(endpoints.submissions.job(assetId, jobId));
  },

  latest(assetId: string): Promise<ExtractionJob> {
    return http.get<ExtractionJob>(endpoints.submissions.latest(assetId));
  },

  retry(assetId: string): Promise<{ assetId: string; jobId: number; status: string }> {
    return http.post(endpoints.submissions.retry(assetId));
  }
};
