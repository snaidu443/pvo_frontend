import { endpoints } from '../endpoints';
import { http } from '../httpClient';

/** One stage of a run: the CDP, the CI, the Protocol, then saving the result. */
export interface ExtractionStep {
  name: 'CDP' | 'CI' | 'Protocol' | 'Save';
  state: 'waiting' | 'running' | 'done' | 'failed';
  startedAt: string | null;
  finishedAt: string | null;
}

/** The state of the last AI extraction run for an asset. `message` is a fixed, user-safe text (never document content). */
export interface ExtractionJobState {
  state: 'idle' | 'running' | 'succeeded' | 'failed';
  message: string;
  startedAt: string | null;
  finishedAt: string | null;
  steps?: ExtractionStep[];
  /** True once the indications and CDP values are saved (the CI and Protocol may still be running). */
  cdpSaved?: boolean;
  /** On failure: the error class and where it happened (no document text), for support. */
  detail?: string;
}

export const extractionService = {
  /** Starts the extraction on the server (202). `replace` confirms that earlier extracted and entered values may be overwritten. */
  start(assetId: string, replace: boolean): Promise<{ state: string }> {
    return http.post<{ state: string }>(`${endpoints.assets.extraction(assetId)}${replace ? '?replace=true' : ''}`);
  },

  /** The state of the last run. */
  status(assetId: string): Promise<{ job: ExtractionJobState }> {
    return http.get<{ job: ExtractionJobState }>(endpoints.assets.extraction(assetId));
  }
};
