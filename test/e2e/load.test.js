// Capacity, as a test rather than as a memory.
//
// The snapshot path is the one piece of this server that every player pays
// for on every tick, and it is the easiest place in the codebase to make
// something quadratic by accident - shop signs managed it in a single commit,
// by being computed per player inside a loop that already runs per player.
//
// This runs a smaller crowd than `npm run load` so the suite stays quick. It
// is not here to find the ceiling; it is here to fail when somebody puts
// something expensive on the hot path, which is what actually happens.
import test from 'node:test';
import assert from 'node:assert/strict';
import { run, TARGET } from '../../tools/load.js';

const CLIENTS = Number(process.env.EMBERFALL_LOAD_CLIENTS ?? 40);
const SECONDS = Number(process.env.EMBERFALL_LOAD_SECONDS ?? 8);
/** Static appearance is sent once, so the steady state is small. */
const KB_PER_CLIENT_PER_SECOND = 140;

test('a crowd in one town still gets its snapshots', async (t) => {
  t.diagnostic(`${CLIENTS} clients for ${SECONDS}s`);
  const r = await run({ clients: CLIENTS, seconds: SECONDS, port: 8311 });

  assert.ok(r.entered >= CLIENTS * 0.8,
    `only ${r.entered}/${CLIENTS} got into the world`);
  assert.equal(r.receiving, r.entered, 'somebody entered and then heard nothing');
  assert.ok(r.rate.p10 >= TARGET.snapshotsPerSecond,
    `the slowest tenth saw ${r.rate.p10.toFixed(1)} snapshots a second`);
  assert.ok(r.worstGapMs <= TARGET.worstGapMs,
    `somebody waited ${r.worstGapMs}ms between snapshots`);

  // The number that actually caps this server. Everyone in the load test
  // stands in one town, so they are all in each other's interest radius -
  // the worst case, and the one that matters, because that is where players
  // congregate. Four hundred kilobytes a second each was the cost of sending
  // names, faces and equipment ten times a second to people who already had
  // them; if this climbs back there, that is what happened.
  assert.ok(r.kbPerClientPerSecond <= KB_PER_CLIENT_PER_SECOND,
    `${r.kbPerClientPerSecond.toFixed(0)} KB/s per client, over the ${KB_PER_CLIENT_PER_SECOND} budget`);
});
