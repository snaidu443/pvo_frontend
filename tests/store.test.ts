/**
 * Redux store tests: drive the real store through the main workflow with plain
 * actions (no React, no network) and check the resulting state.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { setReference } from '../src/engine/reference.ts';
import { store, getState } from '../src/store/store.ts';
import { assetCreated, assetDeleted, newAssetStarted, signedOut, workflowAdvanced, workspaceLoaded } from '../src/store/sharedActions.ts';
import { assetPrepared, assetRefreshed, documentsAdded, fieldEdited, indicationAdded, indicationUpdated, inputChanged, revenueEdited, setupChanged, viewChanged } from '../src/store/slices/assessmentSlice.ts';
import { missingInputs, isTabOpen, type RowValue } from '../src/engine/inputs.ts';
import type { InputRow } from '../src/engine/inputs.ts';
import { loginStarted } from '../src/store/slices/sessionSlice.ts';
import { filterChanged, rulesPolicyChanged } from '../src/store/slices/uiSlice.ts';
import { activityRecorded } from '../src/store/slices/adminSlice.ts';
import type { ReferenceData, WorkspaceData } from '../src/types/domain.ts';

// Synthetic asset data lives in tests/fixtures (the app itself reads assets from structx.sqlite only); the rest is the app's catalogue JSON.
const FIXTURES = ['assets', 'documents', 'decisionTraces'];
const load = (name: string) => JSON.parse(readFileSync(new URL(`${FIXTURES.includes(name) ? '.' : '../src/mocks'}/${FIXTURES.includes(name) ? 'fixtures' : 'data'}/${name}.json`, import.meta.url), 'utf8'));
setReference({
  ...load('reference'), policies: load('policies'), recommendations: load('recommendations'), tour: load('tour'), copilot: load('copilot'),
  policyRules: load('policyRules'), iraConsiderations: load('iraConsiderations'), recommendationCards: load('recommendationCards')
} as ReferenceData);

const data = (): WorkspaceData => ({
  assets: load('assets'), documents: load('documents'), fields: [], questions: [], users: load('users'),
  policyVersions: load('policyVersions'), deltas: load('policyDeltas'), rules: load('rules'),
  decisionTraces: load('decisionTraces'), activity: load('activity'), monitoring: load('policyMonitoring')
});
const today = '26 Oct 2026', stamp = '26 Oct, 10:00';

function signIn() {
  store.dispatch(signedOut());
  store.dispatch(loginStarted({ name: 'Tester', role: 'Admin' }));
  store.dispatch(workspaceLoaded({ data: data(), today }));
}

test('sign-in loads the workspace and prepares every asset', () => {
  signIn();
  const s = getState();
  assert.equal(s.status, 'disclaimer');
  assert.equal(s.assets.length, 7);
  assert.ok(s.assets.every(a => a.aia && a.assessments?.length), 'workspace and history built');
  assert.ok(s.fields.length > 0 && s.questions.length > 0);
});

test('state stays serializable and reducers are deterministic', () => {
  signIn();
  const first = JSON.stringify(getState().fields.map(f => f.id));
  signIn();
  assert.equal(JSON.stringify(getState().fields.map(f => f.id)), first, 'same ids on every load');
  assert.doesNotThrow(() => structuredClone(store.getState()));
});

/** Synthetic answers for the required inputs of a test product (non-orphan oncology small molecule, Part B). */
const FILL: Record<string, RowValue> = {
  launchMarkets: 'global launch (including US and EU)', modality: 'Small molecule', tclass: 'Antineoplastics', cancer: 'Yes', fdaOdd: 'No', emaOd: 'No',
  modeAdmin: 'Outpatient, HCP-administered (Medicare Part B)', payer: 70, trialDesign: 'Head-to-head', euComp: 'Accepted SOC', usLaunch: { y: '2027', m: 'Jan' }, generic: '2034'
};
function fill(r: InputRow): RowValue {
  if (r.it.k in FILL) return FILL[r.it.k];
  if (r.it.type === 'series') return Array.from({ length: 15 }, () => 100);
  if (r.it.type === 'sel') return r.it.opts![0];
  if (r.it.type === 'multi') return [r.it.opts![0]];
  if (r.it.type === 'ym') return { y: '2030', m: 'Jan' };
  if (r.it.type === 'year') return '2030';
  return '1';
}

test('new product: draft → create → assess → impact', () => {
  signIn();
  store.dispatch(newAssetStarted());
  assert.equal(getState().aiaMode, 'new');
  store.dispatch(setupChanged({ assetId: '__draft', key: 'name', value: 'SMOKE-1', today }));
  const doc = (id: number, type: string, name: string) => ({ id, assetId: '__draft', name, size: '1.0 MB', type, scope: 'Program-wide', version: 'Latest', tag: '', pages: '—', added: today });
  store.dispatch(documentsAdded({ assetId: '__draft', docs: [doc(1, 'CDP', 'CDP_synthetic.pptx'), doc(2, 'Forecast', 'Forecast_synthetic.xlsx')], today }));
  store.dispatch(assetCreated({ id: 'NEW-001', code: 'SMOKE-1', assetName: 'SMOKE-1 2L solid tumor', owner: 'Maya Chen', role: 'Admin', today }));
  let s = getState(), a = s.assets.find(x => x.id === 'NEW-001')!;
  assert.equal(s.draft, null);
  assert.equal(s.selectedAssetId, 'NEW-001');
  assert.equal(s.assetSubPage, 'governance');
  assert.ok(a.aia!.unlocked.includes('governance'));
  assert.ok(s.users.find(u => u.name === 'Maya Chen')!.assetIds.includes('NEW-001'), 'owner gets access');
  assert.ok(s.decisionTraces['NEW-001'], 'decision trace created');

  // Nothing is made up on creation: the indications and inputs come from the AI extraction of the uploaded files.
  assert.equal(a.aia!.setup.indications.length, 0, 'a new product has no indications until the extraction has run');
  assert.ok(missingInputs(s, a).some(r => r.it.label === 'Indications'), 'the indications are required and still missing');
  // Stand in for the extraction result: one indication read from the CDP.
  store.dispatch(indicationAdded({ assetId: 'NEW-001' }));
  store.dispatch(indicationUpdated({ assetId: 'NEW-001', index: 0, key: 'name', value: 'Synthetic indication', who: 'Tester', stamp, today }));

  // v07: Eligibility stays locked until every required input is entered.
  store.dispatch(workflowAdvanced({ assetId: 'NEW-001', tab: 'eligibility', who: 'Tester', today }));
  s = getState(); a = s.assets.find(x => x.id === 'NEW-001')!;
  assert.ok(missingInputs(s, a).length > 0, 'a new product starts with required inputs missing');
  assert.equal(isTabOpen(s, a, 'eligibility'), false, 'eligibility gated by missing inputs');
  // Conditional inputs appear once their condition holds (Head-to-head makes Comparator Type required), so fill until nothing is missing.
  for (let pass = 0; pass < 4 && missingInputs(getState(), getState().assets.find(x => x.id === 'NEW-001')!).length; pass++) {
    const cur = getState(), now = cur.assets.find(x => x.id === 'NEW-001')!;
    missingInputs(cur, now).forEach(r => store.dispatch(inputChanged({ assetId: 'NEW-001', key: r.it.k, indId: r.ind?.id, compIndex: r.ci, value: fill(r), who: 'Tester', stamp, today })));
  }
  s = getState(); a = s.assets.find(x => x.id === 'NEW-001')!;
  assert.deepEqual(missingInputs(s, a).map(r => r.it.label), []);
  assert.equal(isTabOpen(s, a, 'eligibility'), true);
  store.dispatch(workflowAdvanced({ assetId: 'NEW-001', tab: 'eligibility', who: 'Tester', today }));
  s = getState(); a = s.assets.find(x => x.id === 'NEW-001')!;
  assert.equal(s.assetSubPage, 'eligibility');
  assert.deepEqual(a.policyExposures, ['IRA', 'MFN', 'JCA', 'EU-GPL']);

  store.dispatch(workflowAdvanced({ assetId: 'NEW-001', tab: 'impact', who: 'Tester', today }));
  a = getState().assets.find(x => x.id === 'NEW-001')!;
  assert.ok(a.aia!.unlocked.includes('scenario'));
  assert.equal(a.estimatedImpactLevel, 'High');
});

test('editing a governed field updates it and records history', () => {
  signIn();
  store.dispatch(assetPrepared('TAK-481'));
  const f = getState().fields.find(x => x.assetId === 'TAK-481' && x.field === 'Expected generic entry year')!;
  store.dispatch(fieldEdited({ assetId: 'TAK-481', fieldId: f.id, value: '2036', who: 'Tester', stamp, today }));
  const after = getState().fields.find(x => x.id === f.id)!;
  assert.equal(after.value, '2036');
  assert.equal(after.status, 'Edited');
  assert.equal(after.history![0].time, stamp);
});

test('yearly revenue edits are stored on the workspace', () => {
  signIn();
  const series = Array.from({ length: 15 }, (_, i) => 100 + i);
  store.dispatch(revenueEdited({ assetId: 'TEST-100', series, today }));
  assert.deepEqual(getState().assets.find(a => a.id === 'TEST-100')!.aia!.revenue, series);
});

test('monitoring and rules-engine view state', () => {
  signIn();
  assert.equal(getState().monitoring?.documents.length, 9);
  store.dispatch(rulesPolicyChanged({ policy: 'JCA', open: true }));
  assert.equal(getState().rulesPolicy, 'JCA');
  assert.equal(getState().page, 'rules');
});

test('ui filters, view patches and delete', () => {
  signIn();
  store.dispatch(filterChanged({ key: 'overviewSearch', value: 'TAK' }));
  assert.equal(getState().overviewSearch, 'TAK');
  store.dispatch(viewChanged({ assetId: 'TAK-481', patch: { govView: 'judgment' } }));
  assert.equal(getState().assets.find(a => a.id === 'TAK-481')!.aia!.govView, 'judgment');
  store.dispatch(assetDeleted({ id: 'TAK-315', nextSelectedId: 'TAK-481' }));
  const s = getState();
  assert.equal(s.assets.some(a => a.id === 'TAK-315'), false);
  assert.equal(s.page, 'overview');
  assert.equal(s.users.some(u => u.assetIds.includes('TAK-315')), false);
});

test('sign-out resets every slice', () => {
  signIn();
  store.dispatch(activityRecorded({ event: 'x', user: 'Tester', time: 'now' }));
  store.dispatch(signedOut());
  const s = getState();
  assert.equal(s.status, 'signed-out');
  assert.equal(s.assets.length, 0);
  assert.equal(s.activity.length, 0);
});

test('a server-built asset (structx.sqlite) keeps its saved workspace and gets the app defaults', () => {
  const server = {
    id: 'SYN-1', assetCode: 'SYN-1', assetName: 'SYN-1', stage: 'Phase 2', jurisdictions: ['US'], policyExposures: [],
    submissionStatus: 'Needs review', submissionCompleteness: 10, eligibilityStatus: 'Review pending', businessContextStatus: 'Draft', impactStatus: '—',
    owner: '—', lastUpdatedAt: '01 Jan 2026', estimatedImpactLevel: '—', estimatedAtRisk: 0, estimatedOpportunity: 0, recommendationStatus: '—',
    governanceAlerts: 0, summaryMetrics: { gross: 0, net: 0, usRevenue: 0, euRevenue: 0 }, eligibility: {}, context: {},
    policyImpact: { IRA: 0, MFN: 0, JCA: 0, 'EU-GPL': 0 }, recommendationCount: 0, approvalCount: 0,
    assessments: [{ id: 'AS-1', date: '01 Jan 2026', by: '—', status: 'Current', level: '—', atRisk: 0, completeness: 10 }],
    aia: {
      created: true, unlocked: ['submission', 'governance'], base: { peakUS: 0, peakEU: 0 }, priority: 62, confirmedBy: '', confirmedAt: '',
      setup: { name: 'SYN-1', stage: 'Phase 2', modality: 'Biologic', route: '', tclass: '', indSeq: 1,
        indications: [{ id: 'IND-1', name: 'Indication A', orphanUS: '', orphanEU: '', launchUS: '2030', launchUSMonth: 'May', launchEU: '2031', include: true, source: 'CDP', v6: { phase: 'Phase III' } }] },
      v6: { asset: { modality: 'Biologic' }, comp: [{ name: 'Comp X', vsId: 'IND-1', cPhase: 'Launched' }] }
    }
  };
  store.dispatch(signedOut());
  store.dispatch(loginStarted({ name: 'Tester', role: 'Admin' }));
  store.dispatch(workspaceLoaded({ data: { ...data(), assets: [server as never], documents: [] }, today }));
  const a = getState().assets[0], w = a.aia!;
  assert.equal(w.setup.indications[0].launchUS, '2030', 'saved set-up kept');
  assert.equal(w.v6?.comp[0].name, 'Comp X');
  assert.deepEqual(w.unlocked, ['submission', 'governance'], 'server decides which tabs are open');
  assert.ok(w.variables.length > 0 && w.policiesOn.IRA === true, 'defaults filled in');
  assert.equal(a.assessments?.length, 1, 'no invented past assessment');
  assert.equal(getState().fields.length + getState().questions.length, 0, 'no starter fields or questions invented');
});

test('opening an asset refreshes it from the server without losing what only the browser holds', () => {
  signIn();
  store.dispatch(assetPrepared('TEST-100'));
  store.dispatch(viewChanged({ assetId: 'TEST-100', patch: { govView: 'judgment', govFilter: 'Missing' } }));
  const cur = getState().assets.find(a => a.id === 'TEST-100')!;
  const fresh = structuredClone(cur);
  fresh.stage = 'Phase 3 (server)';
  fresh.submissionCompleteness = 42;
  fresh.aia!.setup.indications[0].launchUS = '2040';
  fresh.aia!.unlocked = ['submission'];
  const doc = { ...getState().documents.find(d => d.assetId === 'TEST-100')!, id: 987654, name: 'server-copy.pdf' };
  store.dispatch(assetRefreshed({ asset: fresh, documents: [doc] }));

  const a = getState().assets.find(x => x.id === 'TEST-100')!;
  assert.equal(a.stage, 'Phase 3 (server)');
  assert.equal(a.submissionCompleteness, 42);
  assert.equal(a.aia!.setup.indications[0].launchUS, '2040', 'indications come from the server');
  assert.equal(a.aia!.govView, 'judgment', 'view state stays');
  assert.equal(a.aia!.govFilter, 'Missing');
  assert.ok(a.aia!.unlocked.includes('impact'), 'a tab the user already opened stays open');
  assert.deepEqual(getState().documents.filter(d => d.assetId === 'TEST-100').map(d => d.name), ['server-copy.pdf'], "the asset's documents are replaced");
  assert.ok(getState().documents.some(d => d.assetId !== 'TEST-100'), 'other assets keep their documents');
  // an asset that is not in the loaded list is ignored
  store.dispatch(assetRefreshed({ asset: { ...fresh, id: 'NOPE-1' }, documents: [] }));
  assert.equal(getState().assets.some(x => x.id === 'NOPE-1'), false);
});
