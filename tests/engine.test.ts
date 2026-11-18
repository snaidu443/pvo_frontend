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

// Synthetic asset data lives in tests/fixtures (the app itself reads assets from structx.sqlite only); the rest is the app's catalogue JSON.
const FIXTURES = ['assets', 'documents', 'decisionTraces'];
const load = (name: string) => JSON.parse(readFileSync(new URL(`${FIXTURES.includes(name) ? '.' : '../src/mocks'}/${FIXTURES.includes(name) ? 'fixtures' : 'data'}/${name}.json`, import.meta.url), 'utf8'));
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
  // v09: recommendation answers name the card, not an owner or timing
  assert.equal(chatReply(s, a, 'who owns these?'), null);
  assert.match(chatReply(s, a, 'recommendation d') || '', /^Optimize indication sequencing: \+\$\d+M at stake\./);
  assert.match(chatReply(s, a, 'any synergies or trade-offs?') || '', /Interdependency: MFN, JCA, and EU-GPL requires optimized pre-launch evidence.*\(Consider evidence generation priorities\)/);
  assert.match(pilotReply(s, null, 'Is TEST-100 eligible for MFP negotiation, and why?'), /passes all four eligibility criteria/);
  assert.match(pilotReply(s, null, 'Does orphan status protect TEST-100 from MFN exposure?'), /^Orphan status will exclude TEST-100/);
  assert.match(pilotReply(s, null, "What is TEST-100's revenue impact under IRA?"), /-\$187M/);
  assert.match(pilotReply(s, null, "What is TEST-100's revenue at risk under IRA?"), /-\$187M/, 'the older wording still finds the answer');
  assert.equal(starterQuestions('X').every(q => q.answer === q.ai), true);
});

test('set-up dropdown options come from the server lists and can be replaced', async () => {
  const { setLookups } = await import('../src/engine/lookups.ts');
  const { INPUT_ITEM, INPUT_MODALITIES } = await import('../src/engine/inputCatalogue.ts');
  const builtIn = { modalities: [...INPUT_MODALITIES] };
  try {
    setLookups({ modalities: ['Small molecule', 'CGT'] });
    assert.deepEqual(INPUT_ITEM.modality.opts, ['Small molecule', 'CGT'], 'the modality editor and its validation read this list');
    assert.ok(!INPUT_ITEM.modality.opts!.includes('Biologic (other)'), 'built-in demo options are gone');
  } finally {
    setLookups(builtIn); // other tests in this file use the built-in lists
  }
  assert.deepEqual(INPUT_ITEM.modality.opts, INPUT_MODALITIES);
});

test('input catalogue follows the v09 input file: 60 inputs, page locations, conditional requirements', async () => {
  const { INPUT_ITEMS, INPUT_ITEM } = await import('../src/engine/inputCatalogue.ts');
  const { inputRows, isMissing, isRequired } = await import('../src/engine/inputs.ts');
  assert.equal(INPUT_ITEMS.length, 60);
  assert.deepEqual([...new Set(INPUT_ITEMS.map(i => i.loc))].sort(), ['assumption', 'indications', 'inputs', 'setup']);
  assert.deepEqual(INPUT_ITEMS.filter(i => i.loc === 'setup').map(i => i.k), ['modality', 'launchMarkets'], 'Data Submission asks only these two');
  assert.deepEqual(INPUT_ITEMS.filter(i => i.loc === 'indications' && i.lvl === 'ind').map(i => i.k), ['phase', 'usSub', 'maaSub', 'usApp', 'euApp', 'usLaunch', 'euLaunch']);

  const s = workspace(), a = get(s, 'TEST-100'), [i1, i2, i3] = a.aia!.setup.indications;
  // TEST-100: indication 1 is head-to-head, 2 and 3 are placebo-controlled; indication 3 is Phase II/III and has no US share (only revenue)
  assert.equal(isRequired(a, INPUT_ITEM.compType, i1), true, 'Head-to-head makes the comparator type required');
  assert.equal(isRequired(a, INPUT_ITEM.compType, i2), false);
  assert.equal(isRequired(a, INPUT_ITEM.itc, i2), true, 'an ITC is required when the design is not head-to-head');
  assert.equal(isRequired(a, INPUT_ITEM.itc, i1), false);
  assert.equal(isRequired(a, INPUT_ITEM.usRev, i3), true, 'revenue is required when the US market share is not provided');
  assert.equal(isRequired(a, INPUT_ITEM.usRev, i1), false);
  assert.equal(isRequired(a, INPUT_ITEM.regStrategy), true, 'a late-stage indication requires the regulatory strategy answer');

  // Year + month inputs count as missing until both parts are given.
  const maa = () => inputRows(s, a).find(r => r.it.k === 'maaSub' && r.ind === i1)!;
  assert.equal(isMissing(maa()), false);
  i1.v6!.maaSub = { y: '2030', m: '' };
  assert.equal(isMissing(maa()), true);
});

test('Launch Markets takes policies out of scope: US-only removes JCA and EU-GPL, EU-only removes IRA and MFN', () => {
  const s = workspace(), a = get(s, 'TEST-100');
  const base = evaluate(s, a);
  assert.ok(base.JCA.verdict === 'pass' && base['EU-GPL'].verdict === 'pass' && base.IRA.verdict === 'pass', 'a global launch keeps TEST-100 in all four');
  a.aia!.v6!.asset.launchMarkets = 'US only launch';
  let r = evaluate(s, a);
  assert.deepEqual([r.JCA.verdict, r['EU-GPL'].verdict, r.IRA.verdict, r.MFN.verdict], ['fail', 'fail', 'pass', 'pass']);
  assert.equal(r.JCA.chip, 'US-only launch');
  assert.equal(r.JCA.launchOut, true);
  a.aia!.v6!.asset.launchMarkets = 'EU only launch';
  r = evaluate(s, a);
  assert.deepEqual([r.IRA.verdict, r.MFN.verdict, r.JCA.verdict, r['EU-GPL'].verdict], ['fail', 'fail', 'pass', 'pass']);
  assert.equal(r.IRA.chip, 'EU-only launch');
  // The database's own option texts ("US", "EU", "Global launch (including US and EU)") work the same way.
  a.aia!.v6!.asset.launchMarkets = 'US';
  r = evaluate(s, a);
  assert.deepEqual([r.JCA.verdict, r['EU-GPL'].verdict, r.IRA.verdict], ['fail', 'fail', 'pass']);
  a.aia!.v6!.asset.launchMarkets = 'EU';
  r = evaluate(s, a);
  assert.deepEqual([r.IRA.verdict, r.MFN.verdict, r.JCA.verdict], ['fail', 'fail', 'pass']);
  a.aia!.v6!.asset.launchMarkets = 'Global launch (including US and EU)';
  r = evaluate(s, a);
  assert.deepEqual([r.IRA.verdict, r.JCA.verdict, r['EU-GPL'].verdict], ['pass', 'pass', 'pass']);
});

test('server option lists replace the built-in lists of the catalogue selects; keys the server omits keep theirs', async () => {
  const { setLookups } = await import('../src/engine/lookups.ts');
  const { INPUT_ITEM, INPUT_ITEMS, INPUT_MODALITIES } = await import('../src/engine/inputCatalogue.ts');
  const builtIn = INPUT_ITEM.trialDesign.opts!, phase = INPUT_ITEM.phase.opts!, cPhase = INPUT_ITEMS.find(x => x.k === 'cPhase')!.opts!;
  try {
    setLookups({
      modalities: ['Small molecule'],
      options: { trialDesign: ['Head-to-head', 'Placebo-controlled', 'Single-arm study'], launchMarkets: ['US only launch', 'EU only launch', 'Global launch (including US and EU)'] }
    });
    assert.deepEqual(INPUT_ITEM.trialDesign.opts, ['Head-to-head', 'Placebo-controlled', 'Single-arm study'], "the server's spelling is used");
    assert.equal(INPUT_ITEM.launchMarkets.opts![2], 'Global launch (including US and EU)');
    assert.deepEqual(INPUT_ITEM.modality.opts, ['Small molecule'], 'modality comes from the modalities list when options has no entry');
    assert.deepEqual(INPUT_ITEM.phase.opts, phase, 'a key the server does not list keeps the built-in list');
    assert.deepEqual(INPUT_ITEMS.find(x => x.k === 'cPhase')!.opts, cPhase);
    // a later call without options goes back to the built-in lists
    setLookups({ modalities: [...INPUT_MODALITIES] });
    assert.deepEqual(INPUT_ITEM.trialDesign.opts, builtIn);
  } finally {
    setLookups({ modalities: [...INPUT_MODALITIES] });
  }
});

test('Overview stage: the set-up stage, else the most advanced phase of the included indications', async () => {
  const { syncAssetSummary } = await import('../src/engine/summary.ts');
  const s = workspace(), a = get(s, 'TEST-100'), w = a.aia!;
  w.created = true;
  w.setup.stage = 'Phase 2 (set up)';
  syncAssetSummary(s, a, '12 Nov 2026');
  assert.equal(a.stage, 'Phase 2 (set up)', 'a stage that was set stays');
  w.setup.stage = '';
  const [i1, i2, i3] = w.setup.indications;
  i1.v6!.phase = 'Phase II'; i2.v6!.phase = 'Phase I'; i3.v6!.phase = 'Phase III'; i3.include = false;
  syncAssetSummary(s, a, '12 Nov 2026');
  assert.equal(a.stage, 'Phase II', 'an unticked indication does not count');
  i3.include = true;
  syncAssetSummary(s, a, '12 Nov 2026');
  assert.equal(a.stage, 'Phase III');
  i1.v6!.phase = ''; i2.v6!.phase = ''; i3.v6!.phase = '';
  syncAssetSummary(s, a, '12 Nov 2026');
  assert.equal(a.stage, '', 'nothing to derive it from');
});
