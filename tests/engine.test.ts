/**
 * Engine unit tests (Node built-in runner): `npm test`.
 * They pin the deterministic results of the ported v05 logic on the mock data,
 * so the same checks can later be run against the Python engine's API output.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { setReference } from '../src/engine/reference.ts';
import { ensureAia, ensureAssessments, starterQuestions } from '../src/engine/workspace.ts';
import { evaluate, exposures, profile } from '../src/engine/eligibility.ts';
import { inputCoverage, missingInputs } from '../src/engine/inputs.ts';
import { impactFor, recsFor, valueModel, scenarioCompute, ansTone, iraDates, revenueSeries, revWindow, yearly } from '../src/engine/impact.ts';
import { documentsForPolicy, lastRefreshDate, newDocumentCount, publishedTime, safeDocUrl, governedFieldsForRule, policyRuleById } from '../src/engine/monitoring.ts';
import { pilotReply, chatReply } from '../src/engine/copilot.ts';
import { visibleAssets, canEdit, canManage, canSeeUsers } from '../src/engine/permissions.ts';
import { fmtM, fmtB, num } from '../src/engine/format.ts';
import type { ReferenceData, WorkspaceData, Asset } from '../src/types/domain.ts';

const load = (name: string) => JSON.parse(readFileSync(new URL(`../src/mocks/data/${name}.json`, import.meta.url), 'utf8'));
const reference = load('reference');
setReference({
  ...reference, policies: load('policies'), recommendations: load('recommendations'), tour: load('tour'), copilot: load('copilot'),
  policyRules: load('policyRules'), iraConsiderations: load('iraConsiderations'), recommendationCards: load('recommendationCards')
} as ReferenceData);

function workspace() {
  const s = {
    assets: load('assets'), documents: load('documents'), fields: [], questions: [], users: load('users'), policyVersions: [],
    deltas: load('policyDeltas'), rules: load('rules'), decisionTraces: {}, activity: [], monitoring: load('policyMonitoring'), role: 'Admin' as const
  } as unknown as WorkspaceData & { role: 'Admin' | 'Editor' | 'Viewer' };
  s.assets.forEach((a: Asset) => { ensureAia(s, a); ensureAssessments(a); });
  return s;
}
const get = (s: WorkspaceData, id: string) => s.assets.find(a => a.id === id)!;

test('format helpers', () => {
  assert.equal(fmtM(-353), '−$353M');
  assert.equal(fmtM(60), '+$60M');
  assert.equal(fmtB(2580), '$2.58B');
  assert.equal(num('$205M'), 205);
  assert.equal(num(''), null);
});

test('every asset gets a workspace, fields and questions', () => {
  const s = workspace();
  for (const a of s.assets) {
    assert.ok(a.aia, `${a.id} has a workspace`);
    assert.ok(s.fields.some(f => f.assetId === a.id), `${a.id} has fields`);
    assert.ok(s.questions.some(q => q.assetId === a.id), `${a.id} has questions`);
  }
  assert.equal(new Set(s.fields.map(f => f.id)).size, s.fields.length, 'field ids are unique');
});

test('TAK-481 (sample) is in scope for all four policies', () => {
  const s = workspace(), a = get(s, 'TAK-481'), r = evaluate(s, a);
  assert.equal(r.IRA.verdict, 'pass');
  assert.equal(r.MFN.verdict, 'pass');
  assert.equal(r.JCA.verdict, 'pass');
  assert.equal(r['EU-GPL'].verdict, 'pass');
  assert.deepEqual(exposures(s, a), ['IRA', 'MFN', 'JCA', 'EU-GPL']);
  const p = profile(s, a);
  assert.equal(p.spend, 205);
  assert.equal(p.negotiation, 2033); // small molecule: launch 2027 + 6
});

test('TEST-100 profile, IRA timeline and impact (EVAP feedback 28 Oct 2026)', () => {
  const s = workspace(), a = get(s, 'TEST-100'), p = profile(s, a);
  assert.equal(p.bio, false); // v07: TEST-100 is a small molecule
  assert.equal(p.launchUS, 2031);
  assert.deepEqual(revWindow(s, a), { y0: 2029, y1: 2043 }); // first US launch is Ind. 2 (2029)
  const d = iraDates(a, p);
  assert.deepEqual([d.launch, d.negotiation, d.publication, d.effective, d.generic], [2029, 2036, 2037, 2038, 2043]);
  const im = impactFor(s, a);
  assert.equal(im.gross, 2713); // sum of the signed-off Year 1-15 series
  assert.equal(im.policyImpact.IRA, -187); // 15% MFP cut on 2038-2043 revenue
  assert.equal(im.policyImpact.MFN, -276);
  assert.equal(im.policyImpact.JCA, 0); // JCA and EU-GPL revenue impact is not modelled
  assert.equal(im.policyImpact['EU-GPL'], 0);
  const rows = yearly(s, a, { IRA: im.policyImpact.IRA, MFN: 0 }, { usL: 2029, euL: p.launchEU, iraMul: 1, mfnMul: 1 });
  assert.equal(rows.length, 15);
  assert.equal(rows.find(r => r.y === 2037)!.ira, 0);
  assert.equal(Math.round(rows.reduce((t, r) => t + r.ira, 0)), 187);
});

test('edited yearly revenue drives the impact', () => {
  const s = workspace(), a = get(s, 'TEST-100'), series = [...revenueSeries(s, a)];
  series[14] = 227; // no generic erosion in the last year
  a.aia!.revenue = series;
  const im = impactFor(s, a);
  assert.equal(im.gross, 2713 + 113);
  assert.equal(im.policyImpact.IRA, -Math.round((227 * 6) * 0.15));
});

test('EU-GPL tiers: 2026–2028 partial, 2029+ full', () => {
  const s = workspace(), a = structuredClone(get(s, 'TAK-481'));
  a.aia!.created = true; // evaluate on inputs, not stored status
  const maa = s.fields.find(f => f.assetId === a.id && f.field === 'EU MAA year')!;
  maa.value = '2027';
  assert.equal(evaluate(s, a)['EU-GPL'].tier, 'partial');
  maa.value = '2030';
  assert.equal(evaluate(s, a)['EU-GPL'].tier, 'full');
});

test('IRA fails when Medicare spend is below $200M', () => {
  const s = workspace(), a = get(s, 'TAK-481');
  s.fields.find(f => f.assetId === a.id && f.field === 'Assumed annual Medicare spend')!.value = '$150M';
  const r = evaluate(s, a);
  assert.equal(r.IRA.verdict, 'fail');
  assert.equal(r.IRA.steps[3].state, 'fail');
  assert.equal(r.IRA.steps[4].state, 'grey');
});

test('value model and recommendations', () => {
  const s = workspace(), a = get(s, 'TAK-481'), m = valueModel(s, a);
  assert.equal(m.gross, 2580);
  assert.deepEqual(m.deltas.map(d => d.code), ['IRA', 'MFN']); // revenue model covers IRA and MFN only
  assert.equal(m.sum, -353 - 210);
  assert.equal(m.net, 2580 + m.sum);
  assert.equal(recsFor(s, a).length, 5);
  assert.equal(ansTone('Low', 'Low'), 'adverse');
  assert.equal(ansTone('Medium', 'Low'), 'Partial');
});

test('scenario with no changes equals the base case', () => {
  const s = workspace(), a = get(s, 'TAK-481'), c = scenarioCompute(s, a);
  assert.equal(Math.round(c.ns), Math.round(c.nb));
  assert.equal(c.rowsK.length, 5);
  a.aia!.scn = { gap: 50 };
  const c2 = scenarioCompute(s, a);
  assert.ok(c2.ns < c2.nb, 'a wider MFN reference-price gap lowers net value');
  a.aia!.scn = { iraDisc: 60 };
  assert.ok(scenarioCompute(s, a).ns <= c.nb, 'a deeper IRA discount never raises net value');
  assert.ok(!c.rowsK.some(k => (k as string) === 'jcaDelay' || (k as string) === 'gplYears'), 'JCA / EU-GPL scenario variables were removed');
});

test('policy refresh monitoring: new documents per pipeline, newest first, https links only', () => {
  const s = workspace(), m = s.monitoring;
  assert.equal(newDocumentCount(m), 9);
  assert.equal(newDocumentCount(null), 0);
  assert.equal(lastRefreshDate(m), '27 Oct 2026');
  assert.deepEqual(m.pipelines.map(p => documentsForPolicy(m, p.policy).length), [3, 2, 2, 2]);
  assert.deepEqual(documentsForPolicy(m, 'IRA').map(d => d.published), ['24 Oct 2026', '21 Oct 2026', '17 Oct 2026']);
  assert.equal(publishedTime({ published: 'not a date' }), 0);
  assert.ok(m.documents.every(d => safeDocUrl(d.url)), 'sample links are https');
  for (const bad of ['javascript:alert(1)', 'http://example.org/doc', 'data:text/html,x', '/relative/path', 'https://user:pw@example.org/', 42]) assert.equal(safeDocUrl(bad), null);
});

test('rules catalogue: citations and governed fields', () => {
  const s = workspace();
  const rule = policyRuleById('IRA-I-04')!;
  assert.equal(rule.policy, 'IRA');
  assert.equal(rule.citations.length, 1);
  assert.deepEqual(governedFieldsForRule(s, rule).map(r => r.name), ['Assumed annual Medicare spend']);
  assert.equal(policyRuleById('IRA-II-03')!.noCitation, 'NA');
  for (const r of [policyRuleById('MFN-IA-01')!, policyRuleById('JCA-IA-01')!]) assert.ok(r.citations.every(c => c.url.startsWith('https://')), 'citation links are https');
});

test('coverage counts inputs from labelled documents', () => {
  const s = workspace(), cov = inputCoverage(s, get(s, 'TAK-481'));
  assert.ok(cov.total > 0 && cov.covered > 0 && cov.covered <= cov.total && cov.pct <= 100);
  // TEST-100 ships with every required catalogue input filled (synthetic sample values).
  assert.deepEqual(missingInputs(s, get(s, 'TEST-100')).map(r => r.it.k), []);
});

test('role permissions and asset visibility', () => {
  const s = workspace();
  assert.equal(canEdit('Viewer'), false);
  assert.equal(canManage('Editor'), false);
  assert.equal(canSeeUsers('Viewer'), false);
  assert.equal(visibleAssets({ ...s, role: 'Admin' }).length, s.assets.length);
  const viewer = visibleAssets({ ...s, role: 'Viewer' });
  assert.ok(viewer.length < s.assets.length, 'viewers only see assigned assets');
});

test('PolicyPilot answers from the knowledge base and asset context', () => {
  const s = workspace(), a = get(s, 'TAK-481');
  assert.match(pilotReply(s, null, 'Which Medicare Part B drugs are included in the GLOBE Model?'), /GLOBE Model covers/);
  assert.match(pilotReply(s, null, 'Tell me about JCA'), /^JCA \(EU Joint Clinical Assessment\)/);
  assert.match(chatReply(s, a, 'who owns these?') || '', /A: Takeda/);
  assert.match(pilotReply(s, null, 'Is TEST-100 eligible for MFP negotiation, and why?'), /passes all four eligibility criteria/);
  assert.match(pilotReply(s, null, 'Does orphan status protect TEST-100 from MFN exposure?'), /^Orphan status will exclude TEST-100/);
  assert.match(pilotReply(s, null, "What is TEST-100's revenue at risk under IRA?"), /-\$187M/);
  assert.equal(starterQuestions('X').every(q => q.answer === q.ai), true);
});
