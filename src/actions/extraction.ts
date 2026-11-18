/**
 * "Extract data with AI" for a saved asset (Data Submission). The server reads the asset's uploaded CDP / CI / Protocol files
 * with the AI module and saves the result in structx.sqlite (POST /assets/{code}/extraction). The run takes minutes, so the
 * server answers at once and this code asks for the state every few seconds until it ends.
 */
import { useSyncExternalStore } from 'react';
import { ApiError } from '../api/httpClient';
import { extractionService, type ExtractionStep } from '../api';
import { isMock } from '../config/env';
import { missingSetupInputs } from '../engine/inputs';
import { canEditAiaInputs } from '../engine/permissions';
import { getState } from '../store/store';
import { confirmAction, toast } from '../ui/overlay';
import { isDraft, record, subjectId, subjectOf } from './core';
import { goTab, refreshAsset } from './navigation';

const POLL_MS = 1500;
const GIVE_UP_MS = 20 * 60 * 1000;

let running = false;
let steps: ExtractionStep[] = [];
let failure = '';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());
let background = false; // the CDP is saved and the user was moved on to the indications; the CI and Protocol are still running
const setRunning = (v: boolean) => { running = v; if (v) { steps = []; failure = ''; background = false; } notify(); };
const setSteps = (s: ExtractionStep[] | undefined) => { steps = s ?? []; notify(); };
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };

/** True while an extraction started from this page is running (the button shows "Extracting…"). */
export const useExtracting = () => useSyncExternalStore(subscribe, () => running);
/** The stages of the current (or last) run: CDP first, then CI and Protocol together, then saving. Empty before the first poll. */
export const useExtractionSteps = () => useSyncExternalStore(subscribe, () => steps);
/** True from the moment the CDP is saved: the page shows a small progress bar for the remaining files and the user can edit the indications. */
export const useExtractionBackground = () => useSyncExternalStore(subscribe, () => background);
/** Hides the small bar after a failed run. */
export function dismissExtraction() { if (!running) { background = false; steps = []; failure = ''; notify(); } }

/** Why the last run stopped (the server's fixed message); empty when it did not fail. */
export const useExtractionFailure = () => useSyncExternalStore(subscribe, () => failure);

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
/** The server's reason (it never echoes document content), else the fallback. */
const why = (e: unknown, fallback: string) => (e instanceof ApiError && typeof e.detail === 'string' ? e.detail : fallback);
const needsConfirm = (e: unknown) => e instanceof ApiError && e.status === 409 && typeof e.detail === 'string' && e.detail.includes('replace=true');

async function watch(id: string) {
  const until = Date.now() + GIVE_UP_MS;
  try {
    while (Date.now() < until) {
      await sleep(POLL_MS);
      const { job } = await extractionService.status(id);
      setSteps(job.steps);
      if (job.cdpSaved && !background) {
        // The CDP is read and saved: open the indications for editing now; the CI and Protocol continue in the background.
        background = true; notify();
        await refreshAsset(id);
        const s = getState();
        if (s.page === 'assetAnalysis' && subjectId(s) === id && s.assetSubPage === 'submission') goTab('governance', 'indications');
        if (job.state === 'running') toast('CDP done. You can edit the indications while the CI and Protocol are read.');
      }
      if (job.state === 'running') continue;
      if (job.state === 'succeeded') {
        record(`Ran AI extraction for ${id}`);
        await refreshAsset(id); // the extracted values are on screen before the tab opens
        toast(background ? 'Extraction completed: the CDP, CI and Protocol are done. Review the Inputs and Key Assumptions.'
          : 'Extraction completed. Review the indications, then the Inputs and Key Assumptions.', 7000);
        if (!background) { // no CDP step ran: move on to the Indications tab, unless the user has gone to another asset or page
          const s = getState();
          if (s.page === 'assetAnalysis' && subjectId(s) === id && s.assetSubPage === 'submission') goTab('governance', 'indications');
        }
        background = false; notify();
      } else if (job.state === 'failed') {
        failure = (job.message || 'The extraction failed. Nothing was saved.') + (job.detail ? `  [Detail: ${job.detail}]` : ''); notify();
        toast(job.message || 'The extraction failed. Nothing was saved.');
      } else {
        toast('The extraction state is unknown (the server may have restarted). Reload the page to check.');
      }
      return;
    }
    toast('The extraction is taking longer than expected. Check again in a few minutes.');
  } catch (e) {
    toast(why(e, 'The extraction state could not be read. Reload the page to check.'));
  } finally {
    setRunning(false);
  }
}

async function begin(id: string, replace: boolean) {
  if (running) return;
  setRunning(true);
  try {
    await extractionService.start(id, replace);
  } catch (e) {
    setRunning(false);
    if (needsConfirm(e)) {
      confirmAction(
        'Run the extraction again?',
        'This asset already has extracted or entered values. Running again replaces them, including values typed in for the indications.',
        'Replace and run',
        () => { void begin(id, true); }
      );
      return;
    }
    toast(why(e, 'The extraction could not be started. Please try again.'));
    return;
  }
  toast('Extraction started. This can take a few minutes.');
  await watch(id);
}

/** After "Create asset" has uploaded the files: start the extraction for the new asset (a new asset has nothing to replace). */
export function extractAfterCreate(id: string) {
  if (!isMock()) void begin(id, false);
}

/** The button handler. Does nothing for a new product (its files upload and extract when the asset is created) or for view-only roles. */
export function extractAsset() {
  const st = getState(), a = subjectOf(st);
  if (!a || isDraft(a) || !canEditAiaInputs(st.role)) return;
  if (isMock()) { toast('AI extraction runs on the server. Set PVO_DATA_SOURCE=api to use it.'); return; }
  const missing = missingSetupInputs(st, a);
  if (missing.length) {
    toast(`Fill the required fields first: ${missing.map(m => m.it.label).join(', ')}.`);
    return;
  }
  void begin(a.id, false);
}
