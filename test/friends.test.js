// Friends, whispers, blocking, and the party leader's two powers.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as Friends from '../server/game/friends.js';
import * as Party from '../server/game/party.js';
import { db } from '../server/persistence.js';

let nextId = 9000;
function person(name) {
  const id = String(nextId++);
  const record = { id, name, level: 20, job: 'novice', map: 'emberhold', friends: [], blocked: [] };
  db.characters[id] = record;
  const sent = [];
  return { id: 'p' + id, name, record, party: null, conn: { send: (m) => sent.push(m) }, sent };
}
function worldOf(...ps) {
  return {
    playerByName: (n) => ps.find((p) => p.name.toLowerCase() === String(n).toLowerCase()) ?? null,
    playerByCharId: (c) => ps.find((p) => p.record.id === String(c)) ?? null,
  };
}

test('a friend request, accepted, lists both sides; removing clears both', () => {
  const a = person('Aria'), b = person('Brom');
  const w = worldOf(a, b);
  assert.ok(Friends.request(w, a, 'brom').ok);
  assert.equal(Friends.state(w, b).requests.length, 1, 'the request did not arrive');
  assert.ok(Friends.accept(w, b, a.record.id).ok);
  assert.deepEqual(a.record.friends, [b.record.id]);
  assert.deepEqual(b.record.friends, [a.record.id]);
  assert.ok(Friends.request(w, a, 'Brom').error, 'asked twice');
  Friends.remove(a, b.record.id);
  assert.deepEqual(a.record.friends, []);
  assert.deepEqual(b.record.friends, []);
});

test('blocking silences whispers, requests and party invites', () => {
  const a = person('Cass'), b = person('Dune');
  const w = worldOf(a, b);
  assert.ok(Friends.block(w, b, 'Cass').ok);
  assert.ok(Friends.blocks(b, a));
  assert.ok(Friends.whisper(w, a, 'Dune', 'hi').error, 'a whisper got through');
  assert.ok(Friends.request(w, a, 'Dune').error, 'a friend request got through');
  assert.ok(Party.invite(w, a, 'Dune').error, 'a party invite got through');
  Friends.unblock(b, a.record.id);
  assert.ok(Friends.whisper(w, a, 'Dune', 'hi again').ok);
  assert.equal(b.sent.at(-1).ch, 'whisper');
});

test('only the leader kicks and promotes', () => {
  const a = person('Eld'), b = person('Fen'), c = person('Gil');
  const w = worldOf(a, b, c);
  assert.ok(Party.invite(w, a, 'Fen').ok);
  assert.ok(Party.accept(w, b).ok);
  assert.ok(Party.invite(w, a, 'Gil').ok);
  assert.ok(Party.accept(w, c).ok);
  assert.ok(Party.kick(w, b, c.record.id).error, 'a member kicked someone');
  assert.ok(Party.promote(w, a, b.record.id).ok);
  assert.ok(Party.kick(w, a, c.record.id).error, 'the old leader still kicks');
  assert.ok(Party.kick(w, b, c.record.id).ok);
  assert.equal(c.party, null);
  assert.equal(Party.state(w, a).party.members.length, 2);
});
