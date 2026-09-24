// Item database.
//
// `value` is the *reference* value in Aurum. NPC vendors sell at `value`,
// and buy back at ~28% with a daily dampener (see shared/formulas.js), so
// grinding trash into an NPC is never a good income - player trade is.
//
// sprite: { layer, key, gendered } maps onto assets/lpc/<layer>/<gender|either>/<key>.png

const W = (o) => ({ type: 'weapon', slot: 'weapon', refinable: true, durability: 120, stack: 1, ...o });
const A = (o) => ({ type: 'armor', refinable: true, durability: 150, stack: 1, ...o });
const C = (o) => ({ type: 'consumable', stack: 99, weight: 4, ...o });
const M = (o) => ({ type: 'material', stack: 999, weight: 2, ...o });

/**
 * Items that no longer exist, and what a character still holding one gets
 * instead. Anything held that is neither here nor in ITEMS is dropped when
 * the character loads (server/game/player.js purgeUnknownItems).
 */
export const RETIRED_ITEMS = {};

/**
 * Every item in the game. The old set was cleared for the new item sheets;
 * they come back sheet by sheet, built with the helpers above (W weapon,
 * A armour, C consumable, M material, CARD).
 *
 * Systems that name an item by role - the refine stone, the gacha shard, a
 * skill reagent - look it up in KEY_ITEMS and switch themselves off while the
 * item it points at does not exist.
 */
export const ITEMS = {};

/* ================= POTIONS (assets/ui/source/potion_sheet.png) =================
   Forty bottles. `art` is the item's cell in assets/ui/potions.webp, in the
   sheet's reading order; server/game/consumables.js is what each field does.

   Healing keeps pace with the health curve in four sizes, each a little
   cheaper per point than buying the size below - so the next bottle is worth
   the trip to the next town. Buffs last minutes, not fights, and never stack
   with themselves: drinking a second refreshes the first. The luck and
   growth potions (EXP, drops, resets) are not sold by anyone: they drop,
   mostly from bosses, and that is what keeps them worth trading. */
const P = (art, o) => C({ art: 'potions#' + art, rarity: 'common', cooldown: 4, level: 1, ...o });
const MIN = 60;
const buff = (secs, mods, icon = '✦') => ({ buff: { secs, mods, icon } });
const RESIST = (art, el, nameTh, name) => P(art, {
  id: el + '_resist', name, nameTh, level: 20, value: 900, rarity: 'uncommon', cooldown: 30,
  ...buff(5 * MIN, { ['res_' + el]: 25 }, '🛡'),
  desc: `ลดดาเมจธาตุ${nameTh.replace('ยาต้าน', '')}ที่ได้รับ 25% นาน 5 นาที`,
});
export const POTIONS = {
  hp_potion_s: P(0, { id: 'hp_potion_s', name: 'HP Potion S', nameTh: 'ยาฟื้น HP (เล็ก)', heal: 90, value: 120, desc: 'ฟื้น 90 HP' }),
  hp_potion_m: P(1, { id: 'hp_potion_m', name: 'HP Potion M', nameTh: 'ยาฟื้น HP (กลาง)', heal: 260, level: 20, value: 380, cooldown: 5, desc: 'ฟื้น 260 HP' }),
  hp_potion_l: P(2, { id: 'hp_potion_l', name: 'HP Potion L', nameTh: 'ยาฟื้น HP (ใหญ่)', heal: 480, level: 40, value: 900, cooldown: 6, rarity: 'uncommon', desc: 'ฟื้น 480 HP' }),
  hp_potion_xl: P(3, { id: 'hp_potion_xl', name: 'HP Potion XL', nameTh: 'ยาฟื้น HP (พิเศษ)', heal: 760, level: 58, value: 2100, cooldown: 7, rarity: 'uncommon', desc: 'ฟื้น 760 HP' }),
  mp_potion_s: P(4, { id: 'mp_potion_s', name: 'MP Potion S', nameTh: 'ยาฟื้น MP (เล็ก)', healSp: 60, value: 180, cooldown: 6, desc: 'ฟื้น 60 SP' }),
  mp_potion_m: P(5, { id: 'mp_potion_m', name: 'MP Potion M', nameTh: 'ยาฟื้น MP (กลาง)', healSp: 130, level: 20, value: 480, cooldown: 7, desc: 'ฟื้น 130 SP' }),
  mp_potion_l: P(6, { id: 'mp_potion_l', name: 'MP Potion L', nameTh: 'ยาฟื้น MP (ใหญ่)', healSp: 220, level: 40, value: 1000, cooldown: 8, rarity: 'uncommon', desc: 'ฟื้น 220 SP' }),
  mp_potion_xl: P(7, { id: 'mp_potion_xl', name: 'MP Potion XL', nameTh: 'ยาฟื้น MP (พิเศษ)', healSp: 320, level: 58, value: 2000, cooldown: 9, rarity: 'uncommon', desc: 'ฟื้น 320 SP' }),

  heal_potion: P(8, { id: 'heal_potion', name: 'Heal Potion', nameTh: 'ยาสมุนไพรฟื้นฟู', heal: 100, level: 5, value: 300, cooldown: 30,
    regen: { hp: 10, duration: 60 }, desc: 'ฟื้น 100 HP แล้วฟื้นต่อเนื่องอีก 1 นาที — คุ้มกว่ายาขวดแดงถ้าไม่รีบ' }),
  full_restore: P(9, { id: 'full_restore', name: 'Full Restore', nameTh: 'ยาฟื้นฟูสมบูรณ์', healPct: 100, spPct: 100, cleanse: 'all',
    level: 30, value: 15000, cooldown: 180, rarity: 'rare', desc: 'ฟื้น HP/SP เต็ม และล้างสถานะผิดปกติทั้งหมด (คูลดาวน์ 3 นาที)' }),
  antidote: P(10, { id: 'antidote', name: 'Antidote', nameTh: 'ยาถอนพิษ', cleanse: ['poison', 'debuff'], value: 150, cooldown: 5, desc: 'ล้างพิษและคำสาป' }),
  stamina_potion: P(11, { id: 'stamina_potion', name: 'Stamina Potion', nameTh: 'ยาเพิ่มความอึด', level: 10, value: 600, cooldown: 60,
    ...buff(3 * MIN, { spRegenPct: 80, hpRegenPct: 40 }, '💧'), desc: 'ฟื้น SP เร็วขึ้น 80% และ HP 40% นาน 3 นาที' }),
  buff_potion: P(12, { id: 'buff_potion', name: 'Buff Potion', nameTh: 'ยาเสริมพลังรวม', level: 15, value: 1500, cooldown: 60, rarity: 'uncommon',
    ...buff(5 * MIN, { strFlat: 4, agiFlat: 4, vitFlat: 4, intFlat: 4, dexFlat: 4, lukFlat: 4 }, '✦'), desc: 'สเตตัสทุกตัว +4 นาน 5 นาที' }),
  atk_potion: P(13, { id: 'atk_potion', name: 'ATK Potion', nameTh: 'ยาเพิ่มพลังโจมตี', level: 15, value: 1200, cooldown: 60,
    ...buff(5 * MIN, { atkPct: 10, matkPct: 10 }, '⚔'), desc: 'ATK และ MATK +10% นาน 5 นาที' }),
  def_potion: P(14, { id: 'def_potion', name: 'DEF Potion', nameTh: 'ยาเพิ่มพลังป้องกัน', level: 15, value: 1200, cooldown: 60,
    ...buff(5 * MIN, { defPct: 15 }, '🛡'), desc: 'DEF +15% นาน 5 นาที' }),
  speed_potion: P(15, { id: 'speed_potion', name: 'Speed Potion', nameTh: 'ยาเร่งฝีเท้า', level: 5, value: 500, cooldown: 60,
    ...buff(2 * MIN, { speedPct: 20 }, '👟'), desc: 'เดินเร็วขึ้น 20% นาน 2 นาที' }),

  // the sheet's "Water Resist" guards against wind: the game has no water element
  ice_resist: RESIST(16, 'ice', 'ยาต้านน้ำแข็ง', 'Ice Resist'),
  fire_resist: RESIST(17, 'fire', 'ยาต้านไฟ', 'Fire Resist'),
  lightning_resist: RESIST(18, 'lightning', 'ยาต้านสายฟ้า', 'Lightning Resist'),
  wind_resist: RESIST(19, 'wind', 'ยาต้านลม', 'Wind Resist'),
  earth_resist: RESIST(20, 'earth', 'ยาต้านดิน', 'Earth Resist'),
  dark_resist: RESIST(21, 'dark', 'ยาต้านความมืด', 'Dark Resist'),
  holy_resist: RESIST(22, 'holy', 'ยาต้านแสง', 'Light Resist'),
  all_resist: P(23, { id: 'all_resist', name: 'All Resist', nameTh: 'ยาต้านทุกธาตุ', level: 35, value: 4000, cooldown: 30, rarity: 'rare',
    ...buff(5 * MIN, { res_all: 12 }, '🌈'), desc: 'ลดดาเมจทุกธาตุที่ได้รับ 12% นาน 5 นาที' }),

  crit_potion: P(24, { id: 'crit_potion', name: 'Critical Potion', nameTh: 'ยาคริติคอล', level: 20, value: 1400, cooldown: 60, rarity: 'uncommon',
    ...buff(5 * MIN, { critFlat: 8 }, '💥'), desc: 'อัตราคริติคอล +8 นาน 5 นาที' }),
  exp_potion: P(25, { id: 'exp_potion', name: 'EXP Potion', nameTh: 'ยาเพิ่ม EXP', value: 6000, cooldown: 10, rarity: 'rare',
    ...buff(30 * MIN, { expPct: 50 }, '📈'), desc: 'EXP จากมอนสเตอร์ +50% นาน 30 นาที' }),
  drop_rate_up: P(26, { id: 'drop_rate_up', name: 'Drop Rate Up', nameTh: 'ยาเพิ่มอัตราดรอป', value: 5000, cooldown: 10, rarity: 'rare',
    ...buff(30 * MIN, { dropPct: 30 }, '🎁'), desc: 'โอกาสดรอปของ +30% นาน 30 นาที' }),
  item_find: P(27, { id: 'item_find', name: 'Item Find', nameTh: 'ยานักล่าสมบัติ', value: 4000, cooldown: 10, rarity: 'uncommon',
    ...buff(30 * MIN, { aurumPct: 50 }, '🔍'), desc: 'ออรัมที่มอนสเตอร์ทิ้ง +50% นาน 30 นาที' }),
  rare_drop_up: P(28, { id: 'rare_drop_up', name: 'Rare Drop Up', nameTh: 'ยาดวงของหายาก', value: 9000, cooldown: 10, rarity: 'epic',
    ...buff(15 * MIN, { rareDropPct: 100 }, '⭐'), desc: 'ของที่มีโอกาสดรอปต่ำกว่า 5% ดรอปง่ายขึ้นเท่าตัว นาน 15 นาที' }),
  charm_potion: P(29, { id: 'charm_potion', name: 'Charm Potion', nameTh: 'ยาเสน่ห์', level: 10, value: 1200, cooldown: 60,
    ...buff(5 * MIN, { lukFlat: 10, fleePct: 10 }, '💗'), desc: 'LUK +10 และ FLEE +10% นาน 5 นาที' }),
  pet_exp_potion: P(30, { id: 'pet_exp_potion', name: 'Pet EXP Potion', nameTh: 'ยาเสริมสัตว์อัญเชิญ', level: 15, value: 1500, cooldown: 60, rarity: 'uncommon',
    ...buff(10 * MIN, { summonStatPct: 30 }, '🐾'), desc: 'สัตว์ที่อัญเชิญออกมาระหว่างนี้แข็งแกร่งขึ้น 30% (10 นาที)' }),
  pet_heal_potion: P(31, { id: 'pet_heal_potion', name: 'Pet Heal Potion', nameTh: 'ยารักษาสัตว์อัญเชิญ', level: 5, value: 400, cooldown: 10,
    petHeal: true, desc: 'ฟื้น HP สัตว์อัญเชิญทุกตัวของคุณจนเต็ม' }),

  rage_potion: P(32, { id: 'rage_potion', name: 'Rage Potion', nameTh: 'ยาคลั่ง', level: 25, value: 1600, cooldown: 90, rarity: 'uncommon',
    ...buff(MIN, { atkPct: 25, matkPct: 25, defPct: -20 }, '🔥'), desc: 'พลังโจมตี +25% แต่ DEF -20% นาน 1 นาที' }),
  stealth_potion: P(33, { id: 'stealth_potion', name: 'Stealth Potion', nameTh: 'ยาล่องหน', level: 15, value: 1800, cooldown: 120, rarity: 'uncommon',
    ...buff(20, { invisible: 1, speedPct: -10 }, '👤'), breakOnAttack: true, desc: 'มอนสเตอร์มองไม่เห็นคุณ 20 วินาที — หายเมื่อโจมตี' }),
  teleport_potion: P(34, { id: 'teleport_potion', name: 'Teleport Potion', nameTh: 'ยาวาร์ปกลับ', warp: 'save', value: 900, cooldown: 60,
    desc: 'กลับจุดบันทึกล่าสุดทันที' }),
  revive_potion: P(35, { id: 'revive_potion', name: 'Revive Potion', nameTh: 'ยาชุบชีวิต', revive: 0.5, value: 5000, cooldown: 0, rarity: 'rare',
    desc: 'ใช้ตอนล้ม: ฟื้นที่เดิมพร้อม HP/SP 50% (ใช้ในโซน PvP ไม่ได้)' }),
  curse_potion: P(36, { id: 'curse_potion', name: 'Curse Potion', nameTh: 'ยาสาป', level: 20, value: 1500, cooldown: 30, rarity: 'uncommon',
    throw: { range: 240, secs: 12, mods: { dmgTakenPct: 20 }, slowPct: 25 },
    desc: 'ขว้างใส่เป้าหมาย: รับดาเมจเพิ่ม 20% และช้าลง 25% นาน 12 วินาที' }),
  skill_reset: P(37, { id: 'skill_reset', name: 'Skill Reset', nameTh: 'ยารีเซ็ตสกิล', reset: 'skills', value: 60000, cooldown: 0, rarity: 'epic',
    desc: 'คืนแต้มสกิลทั้งหมดให้จัดใหม่' }),
  stat_reset: P(38, { id: 'stat_reset', name: 'Stat Reset', nameTh: 'ยารีเซ็ตสเตตัส', reset: 'stats', value: 60000, cooldown: 0, rarity: 'epic',
    desc: 'คืนแต้มสเตตัสทั้งหมดให้จัดใหม่' }),
  cooldown_reset: P(39, { id: 'cooldown_reset', name: 'Cooldown Reset', nameTh: 'ยาล้างคูลดาวน์', reset: 'cooldowns', level: 30, value: 4000, cooldown: 300, rarity: 'rare',
    desc: 'สกิลทุกสกิลพร้อมใช้ทันที (คูลดาวน์ของยาเอง 5 นาที)' }),
};
Object.assign(ITEMS, POTIONS);

/** Items that game systems use by role, not by drop table. */
export const KEY_ITEMS = {
  refineStone: 'runed_whetstone',   // spent on every refine attempt
  refineOil: 'blessing_oil',        // keeps a failed refine from breaking
  gachaShard: 'shard_dawn',         // what a shrine draw costs
  reviveReagent: null,              // the priest's revive costs SP alone
};
/** Whether a role item exists in this build of the item table. */
export const hasKeyItem = (role) => !!ITEMS[KEY_ITEMS[role]];

/**
 * Cards.
 *
 * `cards.size` and `cards.race` have been hooks in the damage formula since
 * it was written, with nothing anywhere filling them in. A card is what fills
 * them: a rare drop that goes into a socket and stays there.
 *
 * Socketing is permanent, and that is the point rather than a limitation. A
 * card you can pull back out is a card everybody owns one of and moves around
 * as needed; a card that commits is a decision, and the gear it went into
 * becomes a specific thing somebody made rather than a generic drop. It is
 * the same argument the refine system already makes, and the reason this
 * game's items are supposed to hold value.
 *
 * `fits` is which kind of gear takes it: 'weapon', 'armor', or 'any'.
 */
const CARD = (o) => ({ type: 'card', stack: 99, weight: 1, refinable: false, ...o });

export const CARDS = {};
Object.assign(ITEMS, CARDS);

/** How many cards a piece of gear can take. Only real gear has sockets. */
export function socketsOf(def) {
  if (!def) return 0;
  if (def.sockets != null) return def.sockets;
  if (def.type !== 'weapon' && def.type !== 'armor') return 0;
  // Everything a player can wear takes one, and the late epics take two -
  // which is what makes an endgame piece worth chasing a second time.
  return (def.level ?? 1) >= 60 ? 2 : 1;
}

/** Whether this card may go into this piece. */
export function cardFits(cardDef, gearDef) {
  if (!cardDef?.card || !gearDef) return false;
  const kind = gearDef.type === 'weapon' ? 'weapon' : gearDef.type === 'armor' ? 'armor' : null;
  if (!kind) return false;
  return cardDef.fits === 'any' || cardDef.fits === kind;
}

export const RARITY_COLORS = {
  common: '#cfd8dc', uncommon: '#66bb6a', rare: '#42a5f5', epic: '#ab47bc', legendary: '#ffa726',
};

export function item(id) { return ITEMS[id]; }
export function isEquip(it) { return it && (it.type === 'weapon' || it.type === 'armor'); }

/** Total weight of a stack */
export function stackWeight(id, qty) {
  const it = ITEMS[id];
  return it ? (it.weight ?? 1) * qty : 0;
}

/** Crafting: material -> product. Crafting is the *sink* that gives drops value. */
export const RECIPES = {};

/**
 * Everything that is an ingredient in some recipe.
 *
 * These are the goods the crafting economy runs on, so the NPC vendor must
 * not be a better customer for them than another player is. Deriving the set
 * from RECIPES rather than tagging items by hand means a new recipe takes its
 * inputs out of the coin faucet automatically, and nobody has to remember to.
 */
export const CRAFTING_INPUTS = new Set(
  Object.values(RECIPES).flatMap((r) => r.in.map((i) => i.id))
);
