// Builds the Greenmire bestiary page from the game's own data, so every
// number on it is the number the server uses.
//
//   node tools/bestiary/gen.mjs      -> dist/bestiary/bestiary.html (+ the images it shows)
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from 'node:fs';
const R = new URL('../../', import.meta.url).pathname;
const OUT = R + 'dist/bestiary/';
const { MONSTERS } = await import(R + 'shared/data/monsters.js');
const { MOB_ART } = await import(R + 'shared/data/mobart.js');
const { ITEMS } = await import(R + 'shared/data/items.js');
const { DROP_ART } = await import(R + 'shared/data/dropart.js');
const { MAPS } = await import(R + 'shared/data/maps.js');
const { TILE } = await import(R + 'shared/constants.js');

const ORDER = ['blue_slime', 'mushroom', 'caterpillar', 'forest_bee', 'wild_boar', 'forest_spirit', 'alpha_wolf', 'tree_guardian', 'guardian_sapling'];
const SHEET = {
  blue_slime: 'blue_slime_sheet.png', mushroom: 'mushroom_sheet.png', caterpillar: 'caterpillar_sheet.png',
  forest_bee: 'bee_sheet.png', wild_boar: 'boar_sheet.png', forest_spirit: 'spirit_sheet.png',
  alpha_wolf: 'alpha_wolf_sheet.png', tree_guardian: 'tree_guardian_sheet.png', guardian_sapling: 'tree_guardian_sheet.png',
};
const DROPSHEET = {
  blue_slime: 'slime_drops.png', mushroom: 'mushroom_drops.png', caterpillar: 'caterpillar_drops.png',
  forest_bee: 'bee_drops.png', wild_boar: 'boar_drops.png', forest_spirit: 'spirit_drops.png',
  alpha_wolf: 'wolf_drops.png', tree_guardian: 'guardian_drops.png',
};
const gm = MAPS.greenmire;
const cellOf = (art) => (typeof art === 'string' && art.startsWith('drops#') ? +art.slice(6) : null);

const mobs = ORDER.map((id) => {
  const d = MONSTERS[id];
  const art = MOB_ART[id];
  const drops = (d.drops ?? []).map((x) => {
    const it = ITEMS[x.id] ?? {};
    const kind = it.loot;
    return {
      id: x.id, name: it.name, th: it.nameTh, rarity: it.rarity ?? 'common', chance: x.chance, qty: x.qty ?? 1,
      icon: cellOf(it.art), kind, desc: it.desc ?? '', value: it.value ?? 0,
      fall: kind ? DROP_ART.cells['fall_' + kind] ?? null : null,
      box: !!it.box,
    };
  });
  const spawns = (gm.spawns ?? []).filter((s) => s.mob === id).map((s) => ({ count: s.count, area: s.area }));
  const burst = d.burst ? [].concat(d.burst) : [];
  return {
    id, name: d.name, th: d.nameTh, level: d.level, hp: d.hp, atk: d.atk, def: d.def, mdef: d.mdef, hit: d.hit, flee: d.flee,
    exp: d.exp, jobExp: d.jobExp, element: d.element, race: d.race, size: d.size, speed: d.speed,
    attackRange: d.attackRange, attackDelay: d.attackDelay, aggressive: d.aggressive, aggroRange: d.aggroRange,
    respawn: d.respawn, boss: !!d.boss, mini: !!d.mini, phases: d.phases ?? null, sprite: d.sprite,
    burst, charge: d.charge ?? null, shot: d.shot ?? null, kite: d.kite ?? null, leap: d.leap ?? null,
    howl: d.howl ?? null, enrage: d.enrage ?? null, calls: d.calls ?? null, claw: d.claw ?? null, mend: d.mend ?? null,
    aurum: d.aurum ?? null, drops, spawns, art,
    files: {
      sheet: 'assets/mob/source/' + SHEET[id],
      atlas: `assets/mob/${id}.webp`,
      fx: art?.fx ? `assets/mob/${id}_fx.webp` : null,
      dropSheet: DROPSHEET[id] ? 'assets/ui/source/' + DROPSHEET[id] : null,
    },
  };
});

const data = {
  mobs,
  map: { name: gm.name, th: gm.nameTh, w: gm.width, h: gm.height, tile: TILE, levelRange: gm.levelRange },
  drops: { cell: DROP_ART.cell, cols: DROP_ART.cols },
  gold: DROP_ART.cells.icon.gold_100,
};
const tpl = readFileSync(new URL('./template.html', import.meta.url), 'utf8');
mkdirSync(OUT + 'assets/mob', { recursive: true });
mkdirSync(OUT + 'assets/ui', { recursive: true });
mkdirSync(OUT + 'assets/maps', { recursive: true });
for (const f of readdirSync(R + 'assets/mob')) if (f.endsWith('.webp')) copyFileSync(R + 'assets/mob/' + f, OUT + 'assets/mob/' + f);
copyFileSync(R + 'assets/ui/drops.webp', OUT + 'assets/ui/drops.webp');
copyFileSync(R + 'assets/maps/greenmire.webp', OUT + 'assets/maps/greenmire.webp');
writeFileSync(OUT + 'bestiary.html', tpl.replace('/*DATA*/null', JSON.stringify(data)));
console.log('mobs', mobs.length, 'bytes', JSON.stringify(data).length);
