/**
 * Data Submission (API mode) helpers: slot formats, server messages and the extraction-job state.
 * Files are tiny synthetic File objects; nothing is sent over the network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { apiMessage, slotFor, slotProblem } from '../src/actions/submissionRules.ts';
import { ApiError } from '../src/api/httpClient.ts';
import { extractionJobUpdated } from '../src/store/slices/assessmentSlice.ts';
import { getState, store } from '../src/store/store.ts';

const file = (name: string, bytes = 10) => new File([new Uint8Array(bytes)], name);

test('each slot accepts only its formats (same rules as the server)', () => {
  assert.equal(slotProblem(file('ci.pdf'), 'CI'), null);
  assert.equal(slotProblem(file('cdp.pptx'), 'CDP'), null);
  assert.equal(slotProblem(file('forecast.xlsx'), 'Forecast'), null);
  assert.match(slotProblem(file('ci.xlsx'), 'CI')!, /accepts pdf, ppt, pptx/);
  assert.match(slotProblem(file('macro.xlsm'), 'Forecast')!, /accepts/);
  assert.match(slotProblem(file('empty.pdf', 0), 'CDP')!, /empty/);
  assert.match(slotProblem(file('x.pdf'), 'TPP')!, /four document types/);
});

test('drag and drop moves a file to the first slot that accepts it', () => {
  assert.equal(slotFor(file('Protocol_v2.docx'), 'Protocol'), 'Protocol');
  assert.equal(slotFor(file('Forecast.xlsx'), 'CDP'), 'Forecast'); // guessed CDP, but CDP does not take Excel
  assert.equal(slotFor(file('run.exe'), 'CDP'), null);
  assert.equal(slotFor(file('data.csv'), 'Forecast'), null);
});

test('server messages are shown, raw bodies are not', () => {
  assert.equal(apiMessage(new ApiError(409, 'x', 'An asset with this name already exists.'), 'fallback'), 'An asset with this name already exists.');
  assert.equal(apiMessage(new ApiError(422, 'x', { message: 'CI_Q3.pdf: the content is not a valid .pdf file.', file: 0 }), 'fallback'),
    'CI_Q3.pdf: the content is not a valid .pdf file.');
  assert.equal(apiMessage(new ApiError(500, 'x', { trace: 'internal' }), 'fallback'), 'fallback');
  assert.equal(apiMessage(new Error('boom'), 'fallback'), 'fallback');
});

test('extraction job status is kept per asset and mirrored on the asset', () => {
  const job = { jobId: 7, assetId: 'PVO-TEST0001', status: 'waiting_for_scan' as const, error: null, fieldsFound: 0, createdAt: null, startedAt: null, finishedAt: null };
  store.dispatch(extractionJobUpdated(job));
  assert.equal(getState().extractionJobs['PVO-TEST0001'].status, 'waiting_for_scan');
  store.dispatch(extractionJobUpdated({ ...job, status: 'failed', error: 'Extraction failed. Try again.' }));
  assert.equal(getState().extractionJobs['PVO-TEST0001'].error, 'Extraction failed. Try again.');
});
