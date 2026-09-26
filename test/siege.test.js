// The fortress.
//
// Everything about a siege is a schedule and a rule about who is standing
// where, and both are the kind of thing that breaks without anybody noticing
// until a Sunday evening goes wrong in front of forty people.
import './fixtures/maps.js';           // the old maps the systems under test were built on
import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../server/persistence.js';
import * as Siege from '../server/game/siege.js';
import { MAPS } from '../shared/data/maps.js';
import { readFileSync } from 'node:fs';

/** A Sunday inside the window, and one outside it. */
const openAt = Date.UTC(2026, 8, 20, Siege.WINDOW.hour, 5, 0);   // Sunday
const shutAt = Date.UTC(2026, 8, 20, Siege.WINDOW.hour + 3, 0, 0);
const weekdayAt = Date.UTC(2026, 8, 17, Siege.WINDOW.hour, 5, 0); // Thursday

function ground(guildOf = {}) {
  db.siege = { owner: null, since: 0, holder: null, progress: 0, window: null };
  const players = new Map();
  for (const [id, g] of Object.entries(guildOf)) {
    players.set(id, { id, alive: true, record: { guild: g }, x: Siege.THRONE.x * 32, y: Siege.THRONE.y * 32 });
  }
  return { players, events: [], pushEvent(e) { this.events.push(e); } };
}

test('the window is one hour of one day, the same instant for everyone', () => {
  assert.ok(Siege.windowKey(openAt), 'the window was shut during its own hour');
  assert.equal(Siege.windowKey(shutAt), null, 'the window was open three hours late');
  assert.equal(Siege.windowKey(weekdayAt), null, 'the window opened on a weekday');
  // No local time anywhere: the key is derived in UTC, so a guild cannot take
  // the fortress while another timezone is asleep.
  assert.equal(Siege.windowKey(openAt), Siege.windowKey(openAt + 60000));
  assert.notEqual(Siege.windowKey(openAt), Siege.windowKey(openAt + 7 * 86400000));
});

test('the next window is always in the future and always a Sunday', () => {
  for (const from of [openAt, shutAt, weekdayAt, Date.now()]) {
    const next = Siege.nextWindowAt(from);
    assert.ok(next > from, 'the countdown pointed backwards');
    assert.equal(new Date(next).getUTCDay(), Siege.WINDOW.day);
    assert.equal(new Date(next).getUTCHours(), Siege.WINDOW.hour);
  }
});

test('the throne cannot be touched outside the window', () => {
  const zone = ground({ A: 1 });
  for (let i = 0; i < Siege.CAPTURE_SECONDS + 10; i++) Siege.tick(zone, weekdayAt);
  assert.equal(db.siege.owner, null, 'a guild took the fortress on a Thursday');
  assert.equal(db.siege.progress, 0, 'progress accrued outside the window');
});

test('standing on it alone for long enough takes it', () => {
  const zone = ground({ A: 1 });
  let taken = null;
  for (let i = 0; i < Siege.CAPTURE_SECONDS + 2; i++) taken = Siege.tick(zone, openAt) ?? taken;
  assert.equal(String(db.siege.owner), '1', 'nobody took the fortress');
  assert.ok(taken && taken.phase === 'taken', 'the room was never told');
});

test('a rival on the floor stops the clock, and resets it', () => {
  const zone = ground({ A: 1, B: 2 });
  for (let i = 0; i < Siege.CAPTURE_SECONDS * 2; i++) Siege.tick(zone, openAt);
  assert.equal(db.siege.owner, null, 'a contested throne was captured anyway');

  // Clear the rival: the bar starts from zero, not from where it stalled.
  zone.players.delete('B');
  Siege.tick(zone, openAt);
  assert.ok(db.siege.progress <= 1, 'the bar carried over from a contested fight');
});

test('progress does not bank from one week to the next', () => {
  const zone = ground({ A: 1 });
  for (let i = 0; i < Siege.CAPTURE_SECONDS - 5; i++) Siege.tick(zone, openAt);
  assert.ok(db.siege.progress > 0);
  Siege.tick(zone, shutAt);                       // the window shuts
  assert.equal(db.siege.progress, 0, 'the bar survived the window closing');
  const nextWeek = openAt + 7 * 86400000;
  Siege.tick(zone, nextWeek);
  assert.ok(db.siege.progress <= 1, 'last week counted toward this week');
});

test('the owner keeps it between windows', () => {
  const zone = ground({ A: 1 });
  for (let i = 0; i < Siege.CAPTURE_SECONDS + 2; i++) Siege.tick(zone, openAt);
  Siege.tick(zone, shutAt);
  assert.equal(String(db.siege.owner), '1', 'the fortress was given up when the window shut');
  assert.ok(Siege.waivesUpkeep(1), 'the owner is still being billed');
  assert.ok(!Siege.waivesUpkeep(2), 'a guild that owns nothing got a free week');
});

test('the prize is a waived bill, not a payment', () => {
  // A siege that paid coin would make the strongest guild richer every week.
  const src = readFileSync(new URL('../server/game/siege.js', import.meta.url), 'utf8');
  assert.ok(!/\bmint\s*\(/.test(src), 'the siege mints Aurum');
  assert.ok(!/aurum\s*\+=/.test(src), 'the siege pays out Aurum');
});

test('the fortress stands in the one zone where players may fight', () => {
  const map = MAPS[Siege.SIEGE_MAP];
  assert.ok(map, 'the siege map does not exist');
  assert.ok(map.pvp, 'the fortress is somewhere players cannot fight over it');
  assert.ok(Siege.THRONE.x < map.width && Siege.THRONE.y < map.height, 'the throne is off the map');
});

test('the holder gains experience, and still no Aurum', () => {
  const zone = ground({ A: 1 });
  for (let i = 0; i < Siege.CAPTURE_SECONDS + 2; i++) Siege.tick(zone, openAt);
  assert.ok(Siege.HOLDER_EXP_BONUS > 0, 'holding the fortress is worth nothing');
  assert.ok(Siege.HOLDER_EXP_BONUS <= 0.15, 'the holder bonus is large enough to distort the curve');

  // The prize has to stay outside the currency, or the strongest guild
  // compounds. Experience is not currency; everything else here would be.
  const src = readFileSync(new URL('../server/game/siege.js', import.meta.url), 'utf8');
  assert.ok(!/\baurum\b/i.test(src), 'the siege module touches Aurum');
});
