// The twelve weapon classes.
//
// Four classes became twelve because the art sheets are drawn for twelve, and
// that is only half the job: a class is real when somebody can hold one at
// every level they play, use their own skills while holding it, and still
// have something to swing at the end of the game. These tests are the half
// that the item table cannot state on its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPON_CLASSES, WEAPON_ALIASES, canonicalWeapon, jobCanHold, weaponAllows, swingAnim } from '../shared/weapons.js';
import { ITEMS, isEquip } from '../shared/data/items.js';
import { JOBS, availableSkills } from '../shared/data/jobs.js';
import { SKILLS } from '../shared/data/skills.js';
import { ANIM } from '../shared/constants.js';
import { LEVEL_CAP } from '../tools/balance.js';

// These check the whole item set - gear at every level, a weapon for every job,
// what fights cost wearing it. The old set was cleared for the new item
// sheet, so they wait until the table has gear in it again.
const WAITING_FOR_ITEMS = !Object.values(ITEMS).some((it) => it.type === 'armor')
  && 'the item set is only partly in (no armour yet): waiting for the rest of the sheets';

const weapons = Object.values(ITEMS).filter((it) => it.slot === 'weapon');
const holdable = (job, level) => weapons.filter((w) => (w.level ?? 1) <= level && jobCanHold(job, w.wclass));

test('the classes are the ones the art sheets are drawn for', () => {
  assert.deepEqual(Object.keys(WEAPON_CLASSES), [
    'sword', 'greatsword', 'dagger', 'axe', 'spear', 'bow',
    'staff', 'wand', 'knuckle', 'throwing', 'shield', 'special',
  ]);
  for (const [id, w] of Object.entries(WEAPON_CLASSES)) {
    assert.equal(w.id, id, `${id} disagrees with its own key`);
    assert.ok(w.nameTh && w.nameEn, `${id} is missing a name`);
    assert.ok(w.hands === 1 || w.hands === 2, `${id} has ${w.hands} hands`);
    assert.ok(ANIM[w.anim], `${id} swings with an animation the sheets do not have: ${w.anim}`);
  }
});

test('every class the item table uses is a class that exists', () => {
  const unknown = [...new Set(Object.values(ITEMS).map((it) => it.wclass).filter(Boolean))]
    .filter((w) => !WEAPON_CLASSES[w]);
  assert.deepEqual(unknown, [], `items name classes nothing knows about: ${unknown.join(', ')}`);
});

test('a shield is an offhand and everything else is a weapon', () => {
  for (const it of Object.values(ITEMS)) {
    if (!it.wclass) continue;
    const offhand = WEAPON_CLASSES[it.wclass].offhand === true;
    assert.equal(it.slot, offhand ? 'offhand' : 'weapon',
      `${it.id} is a ${it.wclass} in the ${it.slot} slot`);
  }
});

test('a two-handed class does not have one-handed weapons in it', () => {
  // The offhand is the whole reason wand exists next to staff and throwing
  // next to bow. If a two-hander quietly left the offhand free, the trade the
  // split is built on would not be a trade.
  const bad = [];
  for (const w of weapons) {
    const cls = WEAPON_CLASSES[w.wclass];
    if (cls?.hands === 2 && !w.twoHanded) bad.push(`${w.id} is a ${w.wclass} but leaves a hand free`);
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

test('no job is ever left bare-handed', { skip: WAITING_FOR_ITEMS }, () => {
  // A job's allow-list is a promise that something in it can be bought or
  // dropped at the level you are. A gap in that list is a job that cannot
  // attack for as long as the gap lasts.
  const bad = [];
  for (const job of Object.values(JOBS)) {
    for (let lv = 1; lv <= LEVEL_CAP; lv++) {
      if (!holdable(job, lv).length) { bad.push(`${job.id} has nothing to hold at level ${lv}`); break; }
    }
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

test('every job reaches the end of the game with a current weapon', { skip: WAITING_FOR_ITEMS }, () => {
  const bad = [];
  for (const job of Object.values(JOBS)) {
    const best = Math.max(...holdable(job, LEVEL_CAP).map((w) => w.level ?? 1));
    if (best < LEVEL_CAP - 12) bad.push(`${job.id} finishes on a level ${best} weapon`);
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

test('no job learns a skill it can never hold the weapon for', { skip: WAITING_FOR_ITEMS }, () => {
  // The restriction lists and the allow-lists are written in different files
  // by hand. When they disagree the skill is not weakened, it is dead: the
  // server refuses it with "wrong weapon type" every single time.
  const bad = [];
  for (const job of Object.values(JOBS)) {
    for (const id of availableSkills(job.id)) {
      const sk = SKILLS[id];
      if (!sk?.weapon) continue;
      const ok = holdable(job, LEVEL_CAP).some((w) => weaponAllows(sk.weapon, w.wclass));
      if (!ok) bad.push(`${job.id} learns ${id} but can hold no ${sk.weapon.join('/')}`);
    }
  }
  assert.deepEqual(bad, [], bad.join('; '));
});

test('a special weapon belongs to everyone, and to no ladder', { skip: WAITING_FOR_ITEMS }, () => {
  const specials = weapons.filter((w) => w.wclass === 'special');
  assert.ok(specials.length, 'the board has a Special sheet and the world has nothing to put on it');
  for (const job of Object.values(JOBS)) {
    for (const w of specials) assert.ok(jobCanHold(job, w.wclass), `${job.id} cannot hold ${w.id}`);
    assert.ok(!(job.weapons ?? []).includes('special'), `${job.id} lists special, which no job needs to`);
  }
  // and it never locks the holder out of their own skill bar
  for (const sk of Object.values(SKILLS)) {
    if (sk.weapon) assert.ok(weaponAllows(sk.weapon, 'special'), `${sk.id} refuses a special weapon`);
  }
});

test('the names the game had before the sheets still mean something', () => {
  // Characters were saved holding a `blade` and a `rod`. Those words survive
  // in old records, in the demo build, and in anything a player exported.
  assert.deepEqual(WEAPON_ALIASES, { blade: 'dagger', rod: 'wand' });
  assert.equal(canonicalWeapon('blade'), 'dagger');
  assert.equal(canonicalWeapon('rod'), 'wand');
  assert.equal(canonicalWeapon('sword'), 'sword');
  assert.equal(canonicalWeapon(null), null);
  assert.equal(swingAnim('blade'), swingAnim('dagger'));
  assert.equal(swingAnim('rod'), swingAnim('wand'));
  // an old name still satisfies a restriction written in new names
  assert.ok(weaponAllows(['dagger'], 'blade'));
});

test('a job with no allow-list is not accidentally disarmed', () => {
  // `jobCanHold` is called for monsters-turned-players, test doubles and any
  // record whose job predates a rename. None of those should be unable to
  // swing the thing already in their hand.
  assert.ok(jobCanHold({}, null), 'an unclassed weapon should not be refused');
  assert.ok(!jobCanHold({ weapons: ['bow'] }, 'greatsword'));
  assert.ok(jobCanHold({ weapons: ['bow'] }, 'bow'));
  assert.ok(weaponAllows(undefined, 'bow'), 'a skill with no restriction restricts nothing');
  assert.ok(weaponAllows([], 'bow'));
});
