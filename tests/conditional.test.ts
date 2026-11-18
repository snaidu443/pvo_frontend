/** The five conditional "required" rules of the input file (Requirement + Note columns). Synthetic data only. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { setReference } from '../src/engine/reference.ts';
import { ensureAia, ensureAssessments } from '../src/engine/workspace.ts';
import { INPUT_ITEM } from '../src/engine/inputCatalogue.ts';
import { isRequired, isRequiredMissing, inputRows, writeInput } from '../src/engine/inputs.ts';
import type { Asset, ReferenceData, WorkspaceData } from '../src/types/domain.ts';

const FIXTURES = ['assets', 'documents', 'decisionTraces'];
const load = (name: string) => JSON.parse(readFileSync(new URL(`${FIXTURES.includes(name) ? '.' : '../src/mocks'}/${FIXTURES.includes(name) ? 'fixtures' : 'data'}/${name}.json`, import.meta.url), 'utf8'));
setReference({
  ...load('reference'), policies: load('policies'), recommendations: load('recommendations'), tour: load('tour'), copilot: load('copilot'),
  policyRules: load('policyRules'), iraConsiderations: load('iraConsiderations'), recommendationCards: load('recommendationCards')
} as ReferenceData);

function fresh() {
  const s = { assets: load('assets'), documents: load('documents'), fields: [], questions: [], users: [], role: 'Admin' } as unknown as WorkspaceData & { role: 'Admin' };
  s.assets.forEach((a: Asset) => { ensureAia(s, a); ensureAssessments(a); });
  const a = s.assets.find((x: Asset) => x.id === 'TEST-100')!;
  const [i1, i2] = a.aia!.setup.indications;
  for (const i of a.aia!.setup.indications) { i.v6 = { ...(i.v6 || {}), trialDesign: '', compType: [], usShare: '', euShare: '', phase: 'Phase I' }; i.include = true; }
  return { s, a, i1, i2 };
}
const req = (a: Asset, key: string, ind?: ReturnType<typeof fresh>['i1']) => isRequired(a, INPUT_ITEM[key], ind);

test('1. Comparator Type is required only when the design is Head-to-head', () => {
  const { a, i1 } = fresh();
  assert.equal(req(a, 'compType', i1), false, 'no design yet');
  i1.v6!.trialDesign = 'Placebo-controlled';
  assert.equal(req(a, 'compType', i1), false, 'placebo design');
  i1.v6!.trialDesign = 'Head-to-head';
  assert.equal(req(a, 'compType', i1), true, 'head-to-head');
});

test('2. Indirect Treatment Comparison is required when the design is chosen and is not Head-to-head', () => {
  const { a, i1 } = fresh();
  assert.equal(req(a, 'itc', i1), false, 'no design yet');
  i1.v6!.trialDesign = 'Head-to-head';
  assert.equal(req(a, 'itc', i1), false, 'head-to-head');
  i1.v6!.trialDesign = 'Single-arm study';
  assert.equal(req(a, 'itc', i1), true, 'not head-to-head');
});

test('3. USA YoY Revenue is required when USA market share is not provided', () => {
  const { a, i1 } = fresh();
  assert.equal(req(a, 'usRev', i1), true, 'no share');
  i1.v6!.usShare = Array(15).fill('10');
  assert.equal(req(a, 'usRev', i1), false, 'share provided');
});

test('4. EU YoY Revenue is required when EU market share is not provided', () => {
  const { a, i1 } = fresh();
  assert.equal(req(a, 'euRev', i1), true, 'no share');
  i1.v6!.euShare = Array(15).fill('10');
  assert.equal(req(a, 'euRev', i1), false, 'share provided');
});

test('5. Regulatory Strategy Alignment is required when any included indication is Phase II/III or Phase III', () => {
  const { a, i1, i2 } = fresh();
  assert.equal(req(a, 'regStrategy'), false, 'all Phase I');
  i2.v6!.phase = 'Phase II';
  assert.equal(req(a, 'regStrategy'), false, 'Phase II alone is not late-stage');
  i2.v6!.phase = 'Phase II/III';
  assert.equal(req(a, 'regStrategy'), true, 'Phase II/III');
  i2.v6!.phase = 'Phase III';
  assert.equal(req(a, 'regStrategy'), true, 'Phase III');
  i2.include = false;
  assert.equal(req(a, 'regStrategy'), false, 'the Phase III indication is unticked');
  i1.v6!.phase = 'Phase III';
  i1.include = true;
  assert.equal(req(a, 'regStrategy'), true, 'another included indication is Phase III');
});

test('a conditional input that becomes required is reported as missing until it is filled', () => {
  const { s, a, i1 } = fresh();
  i1.v6!.trialDesign = 'Head-to-head';
  const row = () => inputRows(s, a).find(r => r.it === INPUT_ITEM.compType && r.ind === i1)!;
  assert.equal(isRequiredMissing(row()), true);
  i1.v6!.compType = ['Best supportive care'];
  assert.equal(isRequiredMissing(row()), false);
});

test('a file must fit its document slot before it is uploaded', async () => {
  const { slotProblem } = await import('../src/actions/uploadRules.ts');
  const file = (name: string, bytes = 10) => new File([new Uint8Array(bytes)], name);
  assert.equal(slotProblem(file('ci.pdf'), 'CI'), null);
  assert.equal(slotProblem(file('forecast.xlsx'), 'Forecast'), null);
  assert.match(slotProblem(file('ci.xlsx'), 'CI')!, /accepts/);
  assert.match(slotProblem(file('run.exe'), 'CDP')!, /accepts/);
  assert.match(slotProblem(file('empty.pdf', 0), 'CDP')!, /empty/);
  assert.match(slotProblem(file('x.pdf'), 'TPP')!, /four document types/);
});

test("Launch Markets hides the other region's inputs and drops them from the required list", async () => {
  const { inputShown, inputRows, missingInputs } = await import('../src/engine/inputs.ts');
  const { s, a } = fresh();
  const v = a.aia!.v6!.asset, sh = (k: string) => inputShown(a, INPUT_ITEM[k]);
  v.launchMarkets = 'Global launch (including US and EU)';
  assert.ok(sh('usLaunch') && sh('euLaunch') && sh('trialDesign'));
  // the database's own wording: "US" and "EU"; the older "US only launch" / "EU only launch" work the same way
  for (const us of ['US', 'US only launch']) {
    v.launchMarkets = us;
    assert.ok(sh('usLaunch') && sh('trialDesign') && !sh('euLaunch') && !sh('emaOd') && !sh('euPrice'), us);
    assert.ok(!inputRows(s, a).some(r => r.it.k === 'euLaunch'));
    assert.ok(!missingInputs(s, a).some(r => r.it.reg === 'EU'));
  }
  for (const eu of ['EU', 'EU only launch']) {
    v.launchMarkets = eu;
    assert.ok(!sh('usLaunch') && !sh('generic') && sh('euLaunch') && sh('trialDesign') && sh('euPrice'), eu);
    assert.ok(!missingInputs(s, a).some(r => r.it.reg === 'US'));
  }
});

test("region tags follow the AI team's Geography Scope: shared (Global) inputs stay for either market", async () => {
  const { inputShown } = await import('../src/engine/inputs.ts');
  const { INPUT_ITEMS } = await import('../src/engine/inputCatalogue.ts');
  const { a } = fresh(), item = (k: string) => INPUT_ITEMS.find(x => x.k === k)!;
  for (const lm of ['US', 'EU']) {
    a.aia!.v6!.asset.launchMarkets = lm;
    for (const k of ['moa', 'cancer', 'duration', 'cPhase', 'cDiff', 'cTrial']) assert.ok(inputShown(a, item(k)), `${k} is Global and shows for ${lm}`);
  }
  a.aia!.v6!.asset.launchMarkets = 'US';
  assert.equal(inputShown(a, item('cMfp')), true, 'competitor MFP timing is a US input');
  a.aia!.v6!.asset.launchMarkets = 'EU';
  assert.equal(inputShown(a, item('cMfp')), false, 'competitor MFP timing is hidden for an EU-only launch');
});

test('conflicting values: the first is used, they never block the assessment, and the user can pick or type', async () => {
  const { conflictOf, resolveConflict, settleConflict, openConflicts, missingInputs, inputConfidence } = await import('../src/engine/inputs.ts');
  const { s, a, i1 } = fresh();
  const gen = INPUT_ITEM.generic, eu = INPUT_ITEM.euLaunch;
  a.aia!.v6!.conflicts = { generic: { state: 'open', choice: null, opts: [{ v: '2043', src: 'A' }, { v: '2042', src: 'B' }] } };
  i1.conflicts = { euLaunch: { state: 'open', choice: null, opts: [{ v: '2032', src: 'C' }, { v: '2033', src: 'D' }] } };
  assert.equal(openConflicts(s, a).length, 2);
  assert.equal(missingInputs(s, a).some(r => r.cf), false, 'a conflict is not a missing input');
  assert.equal(inputConfidence({ it: gen, value: '2043', cf: conflictOf(a, gen) }), 'Low');
  resolveConflict(s, a, gen, undefined, 1, 'T', 'now');
  assert.equal(conflictOf(a, gen)!.state, 'resolved');
  assert.equal(a.aia!.v6!.asset.generic, '2042');
  settleConflict(a, eu, i1);
  assert.equal(conflictOf(a, eu, i1)!.state, 'manual');
  assert.equal(openConflicts(s, a).length, 0);
});

test('Changing the design away from Head-to-head empties Comparator Type and its extra answer', () => {
  const { s, a, i1 } = fresh();
  writeInput(s, a, INPUT_ITEM.trialDesign, { ind: i1 }, 'Head-to-head', 'Tester', 'now');
  writeInput(s, a, INPUT_ITEM.compType, { ind: i1 }, ["Fixed active comparator / treatment, Investigator's treatment choice"], 'Tester', 'now');
  i1.v6!.compTypeSpecify = 'synthetic text';
  writeInput(s, a, INPUT_ITEM.trialDesign, { ind: i1 }, 'placebo-controlled', 'Tester', 'now');
  assert.deepEqual(i1.v6!.compType, []);
  assert.equal(i1.v6!.compTypeSpecify, '');
  writeInput(s, a, INPUT_ITEM.itc, { ind: i1 }, 'Yes', 'Tester', 'now');
  writeInput(s, a, INPUT_ITEM.trialDesign, { ind: i1 }, 'Head-to-head', 'Tester', 'now'); // ITC applies only to a non-H2H design
  assert.equal(i1.v6!.itc, '');
});
