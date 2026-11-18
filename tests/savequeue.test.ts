/** The asset save queue: one save at a time per asset, always sending the latest state; one asset never blocks another. */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createSaveQueue } from '../src/actions/saveQueue.ts';

/** A send function whose calls finish only when the test says so. */
function controlled() {
  const calls: { key: string; done: () => void; fail: (e: Error) => void }[] = [];
  let concurrent = 0, peak = 0;
  const send = (key: string) => new Promise<void>((resolve, reject) => {
    concurrent++; peak = Math.max(peak, concurrent);
    calls.push({ key, done: () => { concurrent--; resolve(); }, fail: e => { concurrent--; reject(e); } });
  });
  return { calls, send, peak: () => peak };
}
const tick = () => new Promise(r => setTimeout(r, 0));

test('saves of one asset run one after another and extra requests while one is waiting are merged', async () => {
  const c = controlled(), errors: unknown[] = [], q = createSaveQueue(c.send, e => errors.push(e));
  assert.equal(q.request('TAK-226'), true);
  await tick();
  assert.equal(c.calls.length, 1, 'the first save starts at once');
  assert.equal(q.request('TAK-226'), true, 'an edit during a running save queues one more');
  assert.equal(q.request('TAK-226'), false, 'further edits ride along with the waiting save');
  assert.equal(q.request('TAK-226'), false);
  await tick();
  assert.equal(c.calls.length, 1, 'nothing is sent while the first save is running');
  c.calls[0].done();
  await tick();
  assert.equal(c.calls.length, 2, 'the waiting save starts after the first one finished');
  c.calls[1].done();
  await tick();
  assert.equal(c.calls.length, 2, 'three edits cost two requests');
  assert.equal(c.peak(), 1, 'never two requests of one asset at the same time');
  assert.equal(q.active, 0);
  assert.deepEqual(errors, []);
});

test('a failed save is reported and the next one still runs', async () => {
  const c = controlled(), errors: unknown[] = [], q = createSaveQueue(c.send, e => errors.push(e));
  q.request('A');
  await tick();
  q.request('A');
  c.calls[0].fail(new Error('server said no'));
  await tick();
  assert.equal(errors.length, 1);
  assert.equal(c.calls.length, 2, 'the following save is not blocked by the failure');
  c.calls[1].done();
  await tick();
  assert.equal(q.active, 0);
});

test('different assets are saved independently', async () => {
  const c = controlled(), q = createSaveQueue(c.send, () => undefined);
  q.request('A');
  q.request('B');
  await tick();
  assert.deepEqual(c.calls.map(x => x.key), ['A', 'B']);
  assert.equal(q.active, 2);
  c.calls.forEach(x => x.done());
  await tick();
  assert.equal(q.active, 0);
});

test('settled() says whether the last save of a key succeeded, once all of them have finished', async () => {
  let fails = false;
  const q = createSaveQueue(async () => { if (fails) throw new Error('x'); }, () => undefined);
  assert.equal(await q.settled('A'), true, 'nothing was saved');
  q.request('A');
  assert.equal(await q.settled('A'), true);
  fails = true;
  q.request('A');
  assert.equal(await q.settled('A'), false);
});
