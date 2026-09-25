// Item database.
//
// `value` is the *reference* value in Aurum. NPC vendors sell at `value`,
// and buy back at ~28% with a daily dampener (see shared/formulas.js), so
// grinding trash into an NPC is never a good income - player trade is.
//
// sprite: { layer, key, gendered } maps onto assets/lpc/<layer>/<gender|either>/<key>.png

import { DROP_ART } from './dropart.js';

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

/* ============ SCROLLS, BOOKS & TICKETS (assets/ui/source/scroll_sheet.png) ============
   Forty-eight pieces, in the sheet's reading order ('scrolls#n').

   Scrolls go places and last long: a scroll buff is weaker than the potion
   of the same kind and runs for half an hour, so the two stack as a
   "background plus burst". Refine scrolls are spent at the smith, not
   read: +1/+3/+5 add that many percentage points to one attempt - worth
   little at +5, a great deal at +13 where the odds are six in a hundred -
   and the two wards turn one failure into nothing. Books are read, not
   kept: each is a long buff, the elemental ones set your weapon's element.
   Tickets are the shrine's currency and a handful of passes. */
const S = (art, o) => C({ art: 'scrolls#' + art, rarity: 'common', cooldown: 3, level: 1, weight: 1, ...o });
const BOOK = (art, el, nameTh, name) => S(art, {
  id: 'book_' + el, name, nameTh, level: 15, value: 1500, rarity: 'uncommon', cooldown: 10, weight: 2,
  endow: el, ...buff(10 * MIN, {}, '📖'),
  desc: `อาวุธกลายเป็นธาตุ${nameTh.replace('ตำราธาตุ', '')} นาน 10 นาที`,
});
export const SCROLLS = {
  scroll_fly: S(0, { id: 'scroll_fly', name: 'Fly Scroll', nameTh: 'ม้วนเคลื่อนย้ายสุ่ม', randomTeleport: true, value: 60,
    desc: 'ย้ายไปจุดสุ่มในแผนที่เดียวกัน (ใช้ในดันเจียนและสนามรบไม่ได้)' }),
  scroll_capital: S(1, { id: 'scroll_capital', name: 'Capital Warp', nameTh: 'ม้วนวาร์ปเมืองหลวง', warpTo: 'emberhold', value: 700, cooldown: 60,
    desc: 'วาร์ปไปเอมเบอร์โฮลด์ทันที' }),
  scroll_return: S(2, { id: 'scroll_return', name: 'Return Scroll', nameTh: 'ม้วนกลับบ้าน', warp: 'save', value: 500, cooldown: 60,
    desc: 'กลับจุดบันทึกล่าสุด' }),
  treasure_map: S(3, { id: 'treasure_map', name: 'Treasure Map', nameTh: 'แผนที่สมบัติ', value: 2500, rarity: 'uncommon', box: true,
    opens: [
      { id: '__aurum', qty: [800, 4000], weight: 50 }, { id: 'hp_potion_m', qty: [3, 6], weight: 14 },
      { id: 'refine_luck_1', qty: [1, 3], weight: 14 }, { id: 'refine_luck_3', qty: 1, weight: 8 },
      { id: 'scroll_exp', qty: 1, weight: 6 }, { id: 'gacha_ticket', qty: 1, weight: 6 }, { id: 'guard_down', qty: 1, weight: 2 },
    ],
    desc: 'ขุดตามแผนที่ — ได้ออรัมหรือของมีค่าอย่างใดอย่างหนึ่ง' }),
  scroll_summon: S(4, { id: 'scroll_summon', name: 'Summoning Scroll', nameTh: 'ม้วนเรียกอสูร', summonMonster: true, level: 10, value: 400, cooldown: 30,
    desc: 'เรียกมอนสเตอร์ของพื้นที่นี้ออกมาหนึ่งตัว (ใช้ได้เฉพาะทุ่งล่า) — ฆ่าได้ EXP และของตามปกติ' }),
  scroll_resurrect: S(5, { id: 'scroll_resurrect', name: 'Resurrection Scroll', nameTh: 'ม้วนชุบชีวิต', reviveOther: 0.3, value: 3000,
    rarity: 'rare', cooldown: 20, desc: 'ชุบเพื่อนที่ล้มอยู่ใกล้ตัว (ในระยะ 5 ช่อง) ให้ลุกพร้อม HP 30%' }),
  scroll_beast: S(6, { id: 'scroll_beast', name: 'Beast Call', nameTh: 'ม้วนเรียกสัตว์คู่ใจ', summonPet: { id: 'companion_wolf', levelPct: 90, secs: 180 },
    level: 5, value: 800, cooldown: 60, desc: 'เรียกหมาป่าคู่ใจมาช่วยสู้ 3 นาที' }),
  scroll_voyage: S(7, { id: 'scroll_voyage', name: 'Voyage Scroll', nameTh: 'ม้วนเดินเรือ', warpTo: 'millhaven', value: 900, cooldown: 60,
    desc: 'ล่องเรือไปท่ามิลเฮเวนทันที' }),

  scroll_exp: S(8, { id: 'scroll_exp', name: 'EXP Scroll', nameTh: 'ม้วนเพิ่ม EXP', value: 3000, rarity: 'rare', cooldown: 10,
    ...buff(60 * MIN, { expPct: 25 }, '📜'), desc: 'EXP +25% นาน 1 ชั่วโมง (ใช้ร่วมกับยา EXP ได้)' }),
  scroll_gold: S(9, { id: 'scroll_gold', name: 'Fortune Scroll', nameTh: 'ม้วนโชคลาภ', value: 2500, rarity: 'uncommon', cooldown: 10,
    ...buff(60 * MIN, { aurumPct: 30 }, '📜'), desc: 'ออรัมจากมอนสเตอร์ +30% นาน 1 ชั่วโมง' }),
  scroll_atk: S(10, { id: 'scroll_atk', name: 'Might Scroll', nameTh: 'ม้วนพลังโจมตี', level: 10, value: 900, cooldown: 10,
    ...buff(30 * MIN, { atkPct: 6, matkPct: 6 }, '📜'), desc: 'ATK/MATK +6% นาน 30 นาที' }),
  scroll_def: S(11, { id: 'scroll_def', name: 'Guard Scroll', nameTh: 'ม้วนป้องกัน', level: 10, value: 900, cooldown: 10,
    ...buff(30 * MIN, { defPct: 8 }, '📜'), desc: 'DEF +8% นาน 30 นาที' }),
  scroll_speed: S(12, { id: 'scroll_speed', name: 'Swift Scroll', nameTh: 'ม้วนเร่งฝีเท้า', value: 700, cooldown: 10,
    ...buff(30 * MIN, { speedPct: 10 }, '📜'), desc: 'เดินเร็วขึ้น 10% นาน 30 นาที' }),
  scroll_vitality: S(13, { id: 'scroll_vitality', name: 'Vitality Scroll', nameTh: 'ม้วนพลังชีวิต', level: 10, value: 1100, cooldown: 10,
    ...buff(30 * MIN, { maxHpPct: 10 }, '📜'), desc: 'HP สูงสุด +10% นาน 30 นาที' }),
  scroll_spirit: S(14, { id: 'scroll_spirit', name: 'Spirit Scroll', nameTh: 'ม้วนพลังเวท', level: 10, value: 1100, cooldown: 10,
    ...buff(30 * MIN, { maxSpPct: 15 }, '📜'), desc: 'SP สูงสุด +15% นาน 30 นาที' }),
  scroll_blessing: S(15, { id: 'scroll_blessing', name: 'Blessing Scroll', nameTh: 'ม้วนพร', level: 15, value: 1500, rarity: 'uncommon', cooldown: 10,
    ...buff(30 * MIN, { strFlat: 2, agiFlat: 2, vitFlat: 2, intFlat: 2, dexFlat: 2, lukFlat: 2 }, '📜'), desc: 'สเตตัสทุกตัว +2 นาน 30 นาที' }),

  refine_luck_1: S(16, { id: 'refine_luck_1', name: 'Refine Scroll +1%', nameTh: 'ยันต์ตีบวก +1%', refineLuck: 0.01, value: 500,
    desc: 'ใช้ที่ช่างตีเหล็ก: เพิ่มโอกาสตีบวกสำเร็จ 1% ต่อครั้ง' }),
  refine_luck_3: S(17, { id: 'refine_luck_3', name: 'Refine Scroll +3%', nameTh: 'ยันต์ตีบวก +3%', refineLuck: 0.03, value: 2500, rarity: 'uncommon',
    desc: 'ใช้ที่ช่างตีเหล็ก: เพิ่มโอกาสตีบวกสำเร็จ 3% ต่อครั้ง' }),
  refine_luck_5: S(18, { id: 'refine_luck_5', name: 'Refine Scroll +5%', nameTh: 'ยันต์ตีบวก +5%', refineLuck: 0.05, value: 8000, rarity: 'rare',
    desc: 'ใช้ที่ช่างตีเหล็ก: เพิ่มโอกาสตีบวกสำเร็จ 5% ต่อครั้ง' }),
  guard_break: S(19, { id: 'guard_break', name: 'Anti-Break Ward', nameTh: 'ยันต์กันแตก', refineGuard: 'break', value: 12000, rarity: 'rare',
    desc: 'ใช้ที่ช่างตีเหล็ก (ช่วง +8 ขึ้นไป): ตีพลาดแล้วของไม่แตก ระดับคงเดิม' }),
  guard_down: S(20, { id: 'guard_down', name: 'Anti-Drop Ward', nameTh: 'ยันต์กันลดขั้น', refineGuard: 'down', value: 4000, rarity: 'uncommon',
    desc: 'ใช้ที่ช่างตีเหล็ก (ช่วง +5 ถึง +7): ตีพลาดแล้วระดับไม่ลด' }),
  scroll_daily_reset: S(21, { id: 'scroll_daily_reset', name: 'Renewal Scroll', nameTh: 'ม้วนรีเซ็ตเควสต์รายวัน', dailyReset: true, value: 5000,
    rarity: 'rare', cooldown: 0, desc: 'เควสต์รายวันที่ส่งไปแล้วรับใหม่ได้ทันที' }),
  scroll_identify: S(22, { id: 'scroll_identify', name: 'Identify Scroll', nameTh: 'ม้วนส่องศัตรู', identify: true, value: 150, cooldown: 2,
    desc: 'อ่านข้อมูลมอนสเตอร์ที่เลือกไว้: ธาตุ เผ่า ขนาด และของที่ดรอปพร้อมโอกาส' }),
  scroll_mystery: S(23, { id: 'scroll_mystery', name: 'Mystery Scroll', nameTh: 'ม้วนปริศนา', value: 1200, rarity: 'uncommon', box: true,
    opens: [
      { id: 'scroll_atk', qty: 1, weight: 14 }, { id: 'scroll_def', qty: 1, weight: 14 }, { id: 'scroll_speed', qty: 1, weight: 12 },
      { id: 'scroll_fly', qty: [3, 6], weight: 14 }, { id: 'refine_luck_1', qty: 1, weight: 14 }, { id: 'scroll_gold', qty: 1, weight: 8 },
      { id: 'scroll_exp', qty: 1, weight: 6 }, { id: 'refine_luck_3', qty: 1, weight: 6 }, { id: 'gacha_ticket', qty: 1, weight: 6 },
      { id: 'treasure_map', qty: 1, weight: 5 }, { id: 'refine_luck_5', qty: 1, weight: 1 },
    ],
    desc: 'ม้วนผนึกไว้ — แกะแล้วได้ม้วนหรือยันต์สุ่มหนึ่งอย่าง' }),

  book_fire: BOOK(24, 'fire', 'ตำราธาตุไฟ', 'Tome of Fire'),
  book_ice: BOOK(25, 'ice', 'ตำราธาตุน้ำแข็ง', 'Tome of Ice'),
  book_wind: BOOK(26, 'wind', 'ตำราธาตุลม', 'Tome of Wind'),
  book_lightning: BOOK(27, 'lightning', 'ตำราธาตุสายฟ้า', 'Tome of Lightning'),
  book_moon: S(28, { id: 'book_moon', name: 'Tome of Night', nameTh: 'ตำรารัตติกาล', level: 20, value: 2200, rarity: 'uncommon', cooldown: 10, weight: 2,
    ...buff(30 * MIN, { castPct: 15, spCostPct: -15 }, '📖'), desc: 'ร่ายเร็วขึ้น 15% และใช้ SP น้อยลง 15% นาน 30 นาที' }),
  book_holy: BOOK(29, 'holy', 'ตำราธาตุแสง', 'Tome of Light'),
  book_dark: BOOK(30, 'dark', 'ตำราธาตุมืด', 'Tome of Shadow'),
  book_earth: BOOK(31, 'earth', 'ตำราธาตุดิน', 'Tome of Earth'),

  book_beast: S(32, { id: 'book_beast', name: 'Beastmaster Tome', nameTh: 'ตำรานักฝึกสัตว์', level: 15, value: 1800, rarity: 'uncommon', cooldown: 10, weight: 2,
    ...buff(60 * MIN, { summonStatPct: 20 }, '📖'), desc: 'สัตว์ที่อัญเชิญแข็งแกร่งขึ้น 20% นาน 1 ชั่วโมง' }),
  book_party: S(33, { id: 'book_party', name: 'Leader\'s Tome', nameTh: 'ตำราผู้นำ', level: 15, value: 3000, rarity: 'rare', cooldown: 60, weight: 2,
    party: true, ...buff(30 * MIN, { expPct: 10 }, '📖'), desc: 'ปาร์ตี้ที่อยู่ใกล้ได้ EXP +10% นาน 30 นาที' }),
  book_combat: S(34, { id: 'book_combat', name: 'Warrior\'s Tome', nameTh: 'ตำรายุทธ์', level: 15, value: 2000, rarity: 'uncommon', cooldown: 10, weight: 2,
    ...buff(30 * MIN, { atkPct: 5, critFlat: 5 }, '📖'), desc: 'ATK +5% และคริติคอล +5 นาน 30 นาที' }),
  book_alchemy: S(35, { id: 'book_alchemy', name: 'Alchemist\'s Tome', nameTh: 'ตำรานักปรุงยา', level: 10, value: 1600, rarity: 'uncommon', cooldown: 10, weight: 2,
    ...buff(60 * MIN, { potionPct: 30 }, '📖'), desc: 'ยาฟื้น HP/SP ได้ผลมากขึ้น 30% นาน 1 ชั่วโมง' }),
  book_arcane: S(36, { id: 'book_arcane', name: 'Arcane Tome', nameTh: 'ตำรามนตรา', level: 15, value: 2000, rarity: 'uncommon', cooldown: 10, weight: 2,
    ...buff(30 * MIN, { matkPct: 12 }, '📖'), desc: 'MATK +12% นาน 30 นาที' }),
  book_windstep: S(37, { id: 'book_windstep', name: 'Windstep Tome', nameTh: 'ตำราฝีเท้าลม', level: 15, value: 2000, rarity: 'uncommon', cooldown: 10, weight: 2,
    ...buff(30 * MIN, { speedPct: 12, fleePct: 12 }, '📖'), desc: 'เดินเร็วขึ้น 12% และ FLEE +12% นาน 30 นาที' }),
  book_royal: S(38, { id: 'book_royal', name: 'Royal Tome', nameTh: 'ตำราราชันย์', level: 20, value: 20000, rarity: 'epic', cooldown: 10, weight: 2,
    ...buff(60 * MIN, { strFlat: 3, agiFlat: 3, vitFlat: 3, intFlat: 3, dexFlat: 3, lukFlat: 3, expPct: 10 }, '👑'),
    desc: 'สเตตัสทุกตัว +3 และ EXP +10% นาน 1 ชั่วโมง' }),
  scroll_party_blessing: S(39, { id: 'scroll_party_blessing', name: 'Party Blessing', nameTh: 'ม้วนอวยพรหมู่', level: 10, value: 1400, rarity: 'uncommon', cooldown: 60,
    party: true, ...buff(10 * MIN, { hpRegenPct: 60, defPct: 5 }, '🌸'), desc: 'ปาร์ตี้ที่อยู่ใกล้ฟื้น HP เร็วขึ้น 60% และ DEF +5% นาน 10 นาที' }),

  scroll_save: S(40, { id: 'scroll_save', name: 'Waypoint Scroll', nameTh: 'ม้วนบันทึกจุด', setSave: true, value: 400, cooldown: 10,
    desc: 'ตั้งจุดบันทึกตรงที่ยืนอยู่ (ใช้ในดันเจียนและสนามรบไม่ได้)' }),
  gacha_ticket: S(41, { id: 'gacha_ticket', name: 'Shrine Ticket', nameTh: 'ตั๋วสุ่มศาลรุ่งอรุณ', value: 3000, rarity: 'rare',
    desc: 'ใช้สุ่มที่ศาลรุ่งอรุณ 1 ครั้ง หรือแลกของที่ร้านแลกตั๋ว' }),
  gacha_ticket_rare: S(42, { id: 'gacha_ticket_rare', name: 'Radiant Ticket', nameTh: 'ตั๋วสุ่มพิเศษ', gachaRoll: 'rare', value: 15000, rarity: 'epic', cooldown: 0,
    desc: 'ฉีกแล้วสุ่มจากรางวัลระดับ SR ขึ้นไปของศาลทันที' }),
  vip_pass: S(43, { id: 'vip_pass', name: 'Royal Pass', nameTh: 'บัตรราชา', value: 12000, rarity: 'epic', cooldown: 10,
    ...buff(60 * MIN, { expPct: 20, dropPct: 20, aurumPct: 20 }, '👑'), desc: 'EXP ดรอป และออรัม +20% นาน 1 ชั่วโมง' }),
  warp_ticket: S(44, { id: 'warp_ticket', name: 'Travel Ticket', nameTh: 'ตั๋วเดินทาง', warpTicket: true, value: 600,
    desc: 'ยื่นให้ผู้ดูแลวาร์ปแทนค่าเดินทางได้หนึ่งเที่ยว ไปที่ไหนก็ได้' }),
  boss_ticket: S(45, { id: 'boss_ticket', name: 'Challenge Writ', nameTh: 'บัตรท้าบอส', lockoutReset: true, value: 30000, rarity: 'epic', cooldown: 0,
    desc: 'ล้างการรับรางวัลบอสประจำสัปดาห์ของคุณ — ตีบอสรับรางวัลได้อีกรอบ' }),
  arena_ticket: S(46, { id: 'arena_ticket', name: 'Arena Pass', nameTh: 'บัตรสนามรบ', warpTo: 'ashen_lists', level: 40, value: 500, cooldown: 60,
    desc: 'พาไปลานประลองเถ้า (เขต PvP) ทันที' }),
  dungeon_pass: S(47, { id: 'dungeon_pass', name: 'Reliquary Pass', nameTh: 'บัตรผ่านประตูหีบศพ', dungeonPass: true, level: 60, value: 8000, rarity: 'rare',
    desc: 'ผ่านประตูหีบศพได้แม้ไม่มีปาร์ตี้ครบ (ใช้แล้วหาย) — ข้างในยังโหดเท่าเดิม' }),
};
Object.assign(ITEMS, SCROLLS);

/* ================= SWORDS (assets/ui/source/sword_sheet.png) =================
   The swordsman's starter ladder: one plain sword every five levels, Lv.1 to
   Lv.120 (the last three wait for the level cap to reach them). These are
   the common floor that the rare, epic and legendary sheets drop on top of,
   so the curve is gentle - ATK = 15 + 2.6 x level^0.8, a slightly quicker
   swing as the tiers climb, and +1 STR every twenty levels - and the price
   climbs faster than the ATK so an upgrade is always a decision. */
const SWORD = (art, o) => W({ art: 'swords#' + art, wclass: 'sword', range: 46, rarity: 'common',
  weight: 40 + Math.round(o.level * 0.6), ...o });
export const SWORDS = {
  wooden_sword: SWORD(0, { id: 'wooden_sword', name: 'Wooden Sword', nameTh: 'ดาบไม้ฝึกหัด', level: 1, atk: 18, delay: 0.88, value: 340, desc: 'ดาบไม้สำหรับซ้อม เบาและปลอดภัย แต่ฟันได้จริง' }),
  iron_shortsword: SWORD(1, { id: 'iron_shortsword', name: 'Iron Shortsword', nameTh: 'ดาบเหล็กสั้น', level: 5, atk: 24, delay: 0.88, value: 830 }),
  steel_sword: SWORD(2, { id: 'steel_sword', name: 'Steel Sword', nameTh: 'ดาบเหล็กกล้า', level: 10, atk: 31, delay: 0.87, value: 1890 }),
  squire_sword: SWORD(3, { id: 'squire_sword', name: 'Squire Sword', nameTh: 'ดาบผู้ฝึกตน', level: 15, atk: 38, delay: 0.87, value: 3350 }),
  guard_sword: SWORD(4, { id: 'guard_sword', name: 'Guardsman Sword', nameTh: 'ดาบทหารยาม', level: 20, atk: 44, delay: 0.87, value: 5130, stats: { str: 1 } }),
  knight_sword: SWORD(5, { id: 'knight_sword', name: 'Knight Sword', nameTh: 'ดาบอัศวิน', level: 25, atk: 49, delay: 0.86, value: 7200, stats: { str: 1 } }),
  azure_sword: SWORD(6, { id: 'azure_sword', name: 'Azure Sword', nameTh: 'ดาบครามใส', level: 30, atk: 55, delay: 0.86, value: 9540, stats: { str: 1 } }),
  sapphire_sword: SWORD(7, { id: 'sapphire_sword', name: 'Sapphire Sword', nameTh: 'ดาบไพลิน', level: 35, atk: 60, delay: 0.86, value: 12120, stats: { str: 1 } }),
  griffin_sword: SWORD(8, { id: 'griffin_sword', name: 'Griffin Sword', nameTh: 'ดาบกริฟฟิน', level: 40, atk: 65, delay: 0.85, value: 14930, stats: { str: 2 } }),
  veteran_sword: SWORD(9, { id: 'veteran_sword', name: 'Veteran Sword', nameTh: 'ดาบทหารผ่านศึก', level: 45, atk: 70, delay: 0.85, value: 17970, stats: { str: 2 } }),
  thornguard_sword: SWORD(10, { id: 'thornguard_sword', name: 'Thornguard Sword', nameTh: 'ดาบด้ามหนาม', level: 50, atk: 74, delay: 0.85, value: 21210, stats: { str: 2 } }),
  crescent_sword: SWORD(11, { id: 'crescent_sword', name: 'Crescent Sword', nameTh: 'ดาบจันทร์เสี้ยว', level: 55, atk: 79, delay: 0.84, value: 24660, stats: { str: 2 } }),
  royal_sword: SWORD(12, { id: 'royal_sword', name: 'Royal Guard Sword', nameTh: 'ดาบองครักษ์', level: 60, atk: 84, delay: 0.84, value: 28300, stats: { str: 3 } }),
  serrated_sword: SWORD(13, { id: 'serrated_sword', name: 'Serrated Sword', nameTh: 'ดาบฟันเลื่อย', level: 65, atk: 88, delay: 0.84, value: 32120, stats: { str: 3 } }),
  warden_sword: SWORD(14, { id: 'warden_sword', name: 'Warden Sword', nameTh: 'ดาบผู้พิทักษ์', level: 70, atk: 93, delay: 0.83, value: 36130, stats: { str: 3 } }),
  stormguard_sword: SWORD(15, { id: 'stormguard_sword', name: 'Stormguard Sword', nameTh: 'ดาบพายุคราม', level: 75, atk: 97, delay: 0.83, value: 40310, stats: { str: 3 } }),
  dragonbone_sword: SWORD(16, { id: 'dragonbone_sword', name: 'Dragonbone Sword', nameTh: 'ดาบกระดูกมังกร', level: 80, atk: 102, delay: 0.83, value: 44660, stats: { str: 4 } }),
  sovereign_sword: SWORD(17, { id: 'sovereign_sword', name: 'Sovereign Sword', nameTh: 'ดาบจักรพรรดิเงิน', level: 85, atk: 106, delay: 0.82, value: 49180, stats: { str: 4 } }),
  bloodedge_sword: SWORD(18, { id: 'bloodedge_sword', name: 'Bloodedge Sword', nameTh: 'ดาบคมโลหิต', level: 90, atk: 110, delay: 0.82, value: 53860, stats: { str: 4 } }),
  crimson_sword: SWORD(19, { id: 'crimson_sword', name: 'Crimson Sword', nameTh: 'ดาบชาด', level: 95, atk: 114, delay: 0.82, value: 58700, stats: { str: 4 } }),
  ruby_warsword: SWORD(20, { id: 'ruby_warsword', name: 'Ruby Warsword', nameTh: 'ดาบทับทิมศึก', level: 100, atk: 119, delay: 0.81, value: 63700, stats: { str: 5 } }),
  sunflare_sword: SWORD(21, { id: 'sunflare_sword', name: 'Sunflare Sword', nameTh: 'ดาบสุริยะ', level: 105, atk: 123, delay: 0.81, value: 68840, stats: { str: 5 } }),
  dawnking_sword: SWORD(22, { id: 'dawnking_sword', name: 'Dawnking Sword', nameTh: 'ดาบราชันอรุณ', level: 110, atk: 127, delay: 0.81, value: 74140, stats: { str: 5 } }),
  phoenix_sword: SWORD(23, { id: 'phoenix_sword', name: 'Phoenix Sword', nameTh: 'ดาบวิหคเพลิง', level: 120, atk: 135, delay: 0.8, value: 85170, stats: { str: 6 } }),
};
Object.assign(ITEMS, SWORDS);

/* ================= BOWS (assets/ui/source/bows_common.png) =================
   The archer's starter ladder: twenty-one plain bows, Lv.1 to Lv.120. The
   board's plates skip Lv.10 (5 goes to 15); the pictures keep the board's
   order on the swords' five-level steps to Lv.80, then ten-level steps to
   Lv.120 as the board itself does. A bow hits a little softer than the sword
   of its level (nine tenths) and draws slower, and pays for it in reach:
   range 180 at Lv.1, 240 at the top. +1 DEX every twenty levels. */
const BOW = (art, o) => W({ art: 'bows#' + art, wclass: 'bow', rarity: 'common', twoHanded: true,
  weight: 45 + Math.round(o.level * 0.5), ...o });
export const BOWS = {
  practice_bow: BOW(0, { id: 'practice_bow', name: 'Practice Bow', nameTh: 'ธนูไม้ฝึกหัด', level: 1, atk: 16, delay: 0.95, range: 180, value: 350, desc: 'ธนูไม้เบา ๆ สำหรับหัดยิง ยิงได้ไกลกว่าดาบมาก' }),
  hunting_bow: BOW(1, { id: 'hunting_bow', name: 'Hunting Bow', nameTh: 'ธนูนายพราน', level: 5, atk: 22, delay: 0.95, range: 182, value: 640 }),
  ironbrace_bow: BOW(2, { id: 'ironbrace_bow', name: 'Ironbrace Bow', nameTh: 'ธนูรัดเหล็ก', level: 10, atk: 28, delay: 0.94, range: 185, value: 1260 }),
  scout_bow: BOW(3, { id: 'scout_bow', name: 'Scout Bow', nameTh: 'ธนูพลลาดตระเวน', level: 15, atk: 34, delay: 0.94, range: 188, value: 2160 }),
  longwood_bow: BOW(4, { id: 'longwood_bow', name: 'Longwood Bow', nameTh: 'ธนูไม้ยาว', level: 20, atk: 39, delay: 0.93, range: 190, value: 3340, stats: { dex: 1 } }),
  steelhorn_bow: BOW(5, { id: 'steelhorn_bow', name: 'Steelhorn Bow', nameTh: 'ธนูเขาเหล็ก', level: 25, atk: 44, delay: 0.93, range: 192, value: 4800, stats: { dex: 1 } }),
  ranger_bow: BOW(6, { id: 'ranger_bow', name: 'Ranger Bow', nameTh: 'ธนูเรนเจอร์', level: 30, atk: 49, delay: 0.93, range: 195, value: 6540, stats: { dex: 1 } }),
  silverstring_bow: BOW(7, { id: 'silverstring_bow', name: 'Silverstring Bow', nameTh: 'ธนูสายเงิน', level: 35, atk: 54, delay: 0.92, range: 198, value: 8560, stats: { dex: 1 } }),
  hawkeye_bow: BOW(8, { id: 'hawkeye_bow', name: 'Hawkeye Bow', nameTh: 'ธนูตาเหยี่ยว', level: 40, atk: 58, delay: 0.92, range: 200, value: 10860, stats: { dex: 2 } }),
  crescent_bow: BOW(9, { id: 'crescent_bow', name: 'Crescent Bow', nameTh: 'ธนูจันทร์เสี้ยว', level: 45, atk: 63, delay: 0.92, range: 202, value: 13440, stats: { dex: 2 } }),
  bladed_bow: BOW(10, { id: 'bladed_bow', name: 'Bladed Bow', nameTh: 'ธนูใบมีด', level: 50, atk: 67, delay: 0.91, range: 205, value: 16300, stats: { dex: 2 } }),
  warden_bow: BOW(11, { id: 'warden_bow', name: 'Warden Bow', nameTh: 'ธนูผู้คุม', level: 55, atk: 71, delay: 0.91, range: 208, value: 19440, stats: { dex: 2 } }),
  talon_bow: BOW(12, { id: 'talon_bow', name: 'Talon Bow', nameTh: 'ธนูกรงเล็บ', level: 60, atk: 75, delay: 0.9, range: 210, value: 22860, stats: { dex: 3 } }),
  stormstring_bow: BOW(13, { id: 'stormstring_bow', name: 'Stormstring Bow', nameTh: 'ธนูสายพายุ', level: 65, atk: 80, delay: 0.9, range: 212, value: 26560, stats: { dex: 3 } }),
  moonfang_bow: BOW(14, { id: 'moonfang_bow', name: 'Moonfang Bow', nameTh: 'ธนูเขี้ยวจันทร์', level: 70, atk: 84, delay: 0.9, range: 215, value: 30540, stats: { dex: 3 } }),
  knightwing_bow: BOW(15, { id: 'knightwing_bow', name: 'Knightwing Bow', nameTh: 'ธนูปีกอัศวิน', level: 75, atk: 88, delay: 0.89, range: 218, value: 34800, stats: { dex: 3 } }),
  frostglint_bow: BOW(16, { id: 'frostglint_bow', name: 'Frostglint Bow', nameTh: 'ธนูประกายเหมันต์', level: 80, atk: 91, delay: 0.89, range: 220, value: 39340, stats: { dex: 4 } }),
  skyreaver_bow: BOW(17, { id: 'skyreaver_bow', name: 'Skyreaver Bow', nameTh: 'ธนูผลาญนภา', level: 90, atk: 99, delay: 0.88, range: 225, value: 49260, stats: { dex: 4 } }),
  starpiercer_bow: BOW(18, { id: 'starpiercer_bow', name: 'Starpiercer Bow', nameTh: 'ธนูทะลวงดารา', level: 100, atk: 107, delay: 0.87, range: 230, value: 60300, stats: { dex: 5 } }),
  seraph_bow: BOW(19, { id: 'seraph_bow', name: 'Seraph Bow', nameTh: 'ธนูเทวทูต', level: 110, atk: 114, delay: 0.87, range: 235, value: 72460, stats: { dex: 5 } }),
  heavenbreaker_bow: BOW(20, { id: 'heavenbreaker_bow', name: 'Heavenbreaker Bow', nameTh: 'ธนูทลายสวรรค์', level: 120, atk: 121, delay: 0.86, range: 240, value: 85740, stats: { dex: 6 } }),
};
Object.assign(ITEMS, BOWS);

/* ============ RARE SWORDS (assets/ui/source/sword_rare_sheet.png) ============
   Twenty-five rare swords on the common ladder's own steps, Lv.1 to Lv.120.
   A rare sword is the common sword of its level plus a fifth more ATK, a
   faster swing, crit and STR/AGI. They drop, and are never on a smith's
   shelf; the ones above the last hunting ground are at the ticket counter. */
const RARE_SWORD = (art, o) => W({ art: 'swords_rare#' + art, wclass: 'sword', range: 47, rarity: 'rare',
  weight: 42 + Math.round(o.level * 0.6), ...o });
export const RARE_SWORDS = {
  sword_rare_1: RARE_SWORD(0, { id: 'sword_rare_1', name: 'Azure Warblade', nameTh: 'ดาบนักรบคราม', level: 1, atk: 21, delay: 0.86, value: 1020, crit: 2, stats: { str: 1 } }),
  sword_rare_5: RARE_SWORD(1, { id: 'sword_rare_5', name: 'Skycrescent Sword', nameTh: 'ดาบเสี้ยวฟ้า', level: 5, atk: 29, delay: 0.86, value: 2480, crit: 2, stats: { str: 1 } }),
  sword_rare_10: RARE_SWORD(2, { id: 'sword_rare_10', name: 'Sapphire Glint', nameTh: 'ดาบประกายไพลิน', level: 10, atk: 38, delay: 0.85, value: 5680, crit: 2, stats: { str: 1 } }),
  sword_rare_15: RARE_SWORD(3, { id: 'sword_rare_15', name: 'Azure Trooper', nameTh: 'ดาบทหารคราม', level: 15, atk: 45, delay: 0.85, value: 10040, crit: 2, stats: { str: 1 } }),
  sword_rare_20: RARE_SWORD(4, { id: 'sword_rare_20', name: 'Azurewing Sword', nameTh: 'ดาบปีกคราม', level: 20, atk: 52, delay: 0.85, value: 15380, crit: 2, stats: { str: 1 } }),
  sword_rare_25: RARE_SWORD(5, { id: 'sword_rare_25', name: 'Goldwing Azure', nameTh: 'ดาบปีกทองคราม', level: 25, atk: 59, delay: 0.84, value: 21600, crit: 2, stats: { str: 1 } }),
  sword_rare_30: RARE_SWORD(6, { id: 'sword_rare_30', name: 'Azure Warsword', nameTh: 'ดาบครามศึก', level: 30, atk: 65, delay: 0.84, value: 28610, crit: 3, stats: { str: 2, agi: 1 } }),
  sword_rare_35: RARE_SWORD(7, { id: 'sword_rare_35', name: 'Azurefang', nameTh: 'ดาบเขี้ยวคราม', level: 35, atk: 72, delay: 0.84, value: 36360, crit: 3, stats: { str: 2, agi: 1 } }),
  sword_rare_40: RARE_SWORD(8, { id: 'sword_rare_40', name: 'Azure Hawkwing', nameTh: 'ดาบปีกเหยี่ยวคราม', level: 40, atk: 78, delay: 0.83, value: 44800, crit: 3, stats: { str: 2, agi: 1 } }),
  sword_rare_45: RARE_SWORD(9, { id: 'sword_rare_45', name: 'Azure Guard', nameTh: 'ดาบองครักษ์คราม', level: 45, atk: 84, delay: 0.83, value: 53910, crit: 3, stats: { str: 3, agi: 1 } }),
  sword_rare_50: RARE_SWORD(10, { id: 'sword_rare_50', name: 'Bluemoon Sword', nameTh: 'ดาบจันทร์น้ำเงิน', level: 50, atk: 89, delay: 0.83, value: 63640, crit: 3, stats: { str: 3, agi: 1 } }),
  sword_rare_55: RARE_SWORD(11, { id: 'sword_rare_55', name: 'Skyhost Sword', nameTh: 'ดาบกองทัพฟ้า', level: 55, atk: 95, delay: 0.82, value: 73970, crit: 3, stats: { str: 3, agi: 1 } }),
  sword_rare_60: RARE_SWORD(12, { id: 'sword_rare_60', name: 'Blue Knight Sword', nameTh: 'ดาบอัศวินน้ำเงิน', level: 60, atk: 101, delay: 0.82, value: 84890, crit: 4, stats: { str: 4, agi: 2 } }),
  sword_rare_65: RARE_SWORD(13, { id: 'sword_rare_65', name: 'Skyguard Sword', nameTh: 'ดาบองครักษ์ฟ้า', level: 65, atk: 106, delay: 0.82, value: 96360, crit: 4, stats: { str: 4, agi: 2 } }),
  sword_rare_70: RARE_SWORD(14, { id: 'sword_rare_70', name: 'Silverwing Sword', nameTh: 'ดาบปีกเงิน', level: 70, atk: 111, delay: 0.81, value: 108380, crit: 4, stats: { str: 4, agi: 2 } }),
  sword_rare_75: RARE_SWORD(15, { id: 'sword_rare_75', name: 'Azure Heaven', nameTh: 'ดาบนภาคราม', level: 75, atk: 117, delay: 0.81, value: 120930, crit: 4, stats: { str: 5, agi: 2 } }),
  sword_rare_80: RARE_SWORD(16, { id: 'sword_rare_80', name: 'Azure Crown', nameTh: 'ดาบราชคราม', level: 80, atk: 122, delay: 0.81, value: 133980, crit: 4, stats: { str: 5, agi: 2 } }),
  sword_rare_85: RARE_SWORD(17, { id: 'sword_rare_85', name: 'Skygold Sword', nameTh: 'ดาบทองนภา', level: 85, atk: 127, delay: 0.8, value: 147540, crit: 4, stats: { str: 5, agi: 2 } }),
  sword_rare_90: RARE_SWORD(18, { id: 'sword_rare_90', name: 'Tidelord Sword', nameTh: 'ดาบจ้าวสมุทร', level: 90, atk: 132, delay: 0.8, value: 161580, crit: 5, stats: { str: 6, agi: 3 } }),
  sword_rare_95: RARE_SWORD(19, { id: 'sword_rare_95', name: 'Azure Tide', nameTh: 'ดาบคลื่นคราม', level: 95, atk: 137, delay: 0.8, value: 176100, crit: 5, stats: { str: 6, agi: 3 } }),
  sword_rare_100: RARE_SWORD(20, { id: 'sword_rare_100', name: 'Skydrake Scale', nameTh: 'ดาบเกล็ดมังกรฟ้า', level: 100, atk: 142, delay: 0.79, value: 191090, crit: 5, stats: { str: 6, agi: 3 } }),
  sword_rare_105: RARE_SWORD(21, { id: 'sword_rare_105', name: 'Azure Tempest', nameTh: 'ดาบพายุคราม', level: 105, atk: 147, delay: 0.79, value: 206530, crit: 5, stats: { str: 7, agi: 3 } }),
  sword_rare_110: RARE_SWORD(22, { id: 'sword_rare_110', name: 'Sky Sovereign', nameTh: 'ดาบราชันนภา', level: 110, atk: 152, delay: 0.79, value: 222420, crit: 5, stats: { str: 7, agi: 3 } }),
  sword_rare_115: RARE_SWORD(23, { id: 'sword_rare_115', name: 'Azure Emperor', nameTh: 'ดาบจักรพรรดิคราม', level: 115, atk: 157, delay: 0.78, value: 238750, crit: 5, stats: { str: 7, agi: 3 } }),
  sword_rare_120: RARE_SWORD(24, { id: 'sword_rare_120', name: 'Heavenly Azure', nameTh: 'ดาบเทพนภา', level: 120, atk: 162, delay: 0.78, value: 255510, crit: 6, stats: { str: 8, agi: 4 } }),
};
Object.assign(ITEMS, RARE_SWORDS);

/* ============ EPIC SWORDS (assets/ui/source/swords_epic.png) ============
   Twenty-three epic swords, Lv.1 to Lv.120. Epic is a grade, not a band:
   like rare, it runs the whole ladder, on the same five-level steps (it
   skips 105 and 115). The board's own plates say Lv.45-70 and are
   misnumbered besides, so the pictures keep the board's order, which is
   the order the art grows in. An epic sword is the common sword of its
   level plus two fifths more ATK (a rare one is a fifth), a faster swing,
   more crit and STR/AGI/DEX. Found only: rarer than rare from monsters, a
   bigger share of a boss's pouch, and in the weapon boxes. */
const EPIC_SWORD = (art, o) => W({ art: 'swords_epic#' + art, wclass: 'sword', range: 47, rarity: 'epic',
  weight: 46 + Math.round(o.level * 0.6), ...o });
export const EPIC_SWORDS = {
  sword_epic_1: EPIC_SWORD(0, { id: 'sword_epic_1', name: 'Amethyst Edge', nameTh: 'ดาบคมอเมทิสต์', level: 1, atk: 25, delay: 0.84, value: 2020, crit: 3, stats: { str: 2, agi: 1 } }),
  sword_epic_5: EPIC_SWORD(1, { id: 'sword_epic_5', name: 'Violet Oath', nameTh: 'ดาบคำสัตย์ม่วง', level: 5, atk: 34, delay: 0.84, value: 5610, crit: 3, stats: { str: 2, agi: 1 } }),
  sword_epic_10: EPIC_SWORD(2, { id: 'sword_epic_10', name: 'Duskfang', nameTh: 'ดาบเขี้ยวสนธยา', level: 10, atk: 44, delay: 0.83, value: 11880, crit: 3, stats: { str: 2, agi: 1 } }),
  sword_epic_15: EPIC_SWORD(3, { id: 'sword_epic_15', name: 'Nightbloom', nameTh: 'ดาบบุปผาราตรี', level: 15, atk: 53, delay: 0.83, value: 19880, crit: 3, stats: { str: 3, agi: 1 } }),
  sword_epic_20: EPIC_SWORD(4, { id: 'sword_epic_20', name: 'Voidguard', nameTh: 'ดาบองครักษ์ห้วงมืด', level: 20, atk: 61, delay: 0.83, value: 29280, crit: 3, stats: { str: 3, agi: 2, dex: 1 } }),
  sword_epic_25: EPIC_SWORD(5, { id: 'sword_epic_25', name: 'Twilight Warden', nameTh: 'ดาบผู้พิทักษ์สนธยา', level: 25, atk: 69, delay: 0.82, value: 40360, crit: 3, stats: { str: 4, agi: 2, dex: 1 } }),
  sword_epic_30: EPIC_SWORD(6, { id: 'sword_epic_30', name: 'Mystic Talon', nameTh: 'ดาบกรงเล็บมนตรา', level: 30, atk: 76, delay: 0.82, value: 52440, crit: 4, stats: { str: 4, agi: 2, dex: 1 } }),
  sword_epic_35: EPIC_SWORD(7, { id: 'sword_epic_35', name: 'Umbral Crest', nameTh: 'ดาบตราเงามืด', level: 35, atk: 84, delay: 0.82, value: 66780, crit: 4, stats: { str: 4, agi: 2, dex: 1 } }),
  sword_epic_40: EPIC_SWORD(8, { id: 'sword_epic_40', name: 'Amethyst Reaver', nameTh: 'ดาบอเมทิสต์ผลาญ', level: 40, atk: 91, delay: 0.81, value: 81900, crit: 4, stats: { str: 5, agi: 3, dex: 2 } }),
  sword_epic_45: EPIC_SWORD(9, { id: 'sword_epic_45', name: 'Shadeborn Blade', nameTh: 'ดาบกำเนิดเงา', level: 45, atk: 98, delay: 0.81, value: 98490, crit: 4, stats: { str: 5, agi: 3, dex: 2 } }),
  sword_epic_50: EPIC_SWORD(10, { id: 'sword_epic_50', name: 'Eclipse Thorn', nameTh: 'ดาบหนามสุริยคราส', level: 50, atk: 104, delay: 0.81, value: 115440, crit: 4, stats: { str: 6, agi: 3, dex: 2 } }),
  sword_epic_55: EPIC_SWORD(11, { id: 'sword_epic_55', name: 'Violet Tempest', nameTh: 'ดาบพายุม่วง', level: 55, atk: 111, delay: 0.8, value: 134860, crit: 4, stats: { str: 6, agi: 4, dex: 2 } }),
  sword_epic_60: EPIC_SWORD(12, { id: 'sword_epic_60', name: 'Abyssal Wing', nameTh: 'ดาบปีกห้วงลึก', level: 60, atk: 117, delay: 0.8, value: 154440, crit: 5, stats: { str: 7, agi: 4, dex: 3 } }),
  sword_epic_65: EPIC_SWORD(13, { id: 'sword_epic_65', name: 'Dusk Sovereign', nameTh: 'ดาบราชันย์สนธยา', level: 65, atk: 124, delay: 0.8, value: 176700, crit: 5, stats: { str: 7, agi: 4, dex: 3 } }),
  sword_epic_70: EPIC_SWORD(14, { id: 'sword_epic_70', name: 'Nether Spire', nameTh: 'ดาบยอดแหลมนรก', level: 70, atk: 130, delay: 0.79, value: 198900, crit: 5, stats: { str: 7, agi: 4, dex: 3 } }),
  sword_epic_75: EPIC_SWORD(15, { id: 'sword_epic_75', name: 'Starless Fang', nameTh: 'ดาบเขี้ยวไร้ดาว', level: 75, atk: 136, delay: 0.79, value: 222360, crit: 5, stats: { str: 8, agi: 5, dex: 3 } }),
  sword_epic_80: EPIC_SWORD(16, { id: 'sword_epic_80', name: 'Wraithcrown', nameTh: 'ดาบมงกุฎวิญญาณ', level: 80, atk: 142, delay: 0.79, value: 247080, crit: 5, stats: { str: 8, agi: 5, dex: 4 } }),
  sword_epic_85: EPIC_SWORD(17, { id: 'sword_epic_85', name: 'Amethyst Dragonfang', nameTh: 'ดาบเขี้ยวมังกรอเมทิสต์', level: 85, atk: 148, delay: 0.78, value: 273060, crit: 5, stats: { str: 9, agi: 5, dex: 4 } }),
  sword_epic_90: EPIC_SWORD(18, { id: 'sword_epic_90', name: 'Void Reaper', nameTh: 'ดาบเคียวห้วงมืด', level: 90, atk: 154, delay: 0.78, value: 300300, crit: 6, stats: { str: 9, agi: 6, dex: 4 } }),
  sword_epic_95: EPIC_SWORD(19, { id: 'sword_epic_95', name: 'Eventide Lord', nameTh: 'ดาบจ้าวรัตติกาล', level: 95, atk: 160, delay: 0.78, value: 328800, crit: 6, stats: { str: 9, agi: 6, dex: 4 } }),
  sword_epic_100: EPIC_SWORD(20, { id: 'sword_epic_100', name: 'Phantom Monarch', nameTh: 'ดาบกษัตริย์ภูต', level: 100, atk: 166, delay: 0.77, value: 358560, crit: 6, stats: { str: 10, agi: 6, dex: 5 } }),
  sword_epic_110: EPIC_SWORD(21, { id: 'sword_epic_110', name: 'Abyss Emperor', nameTh: 'ดาบจักรพรรดิห้วงลึก', level: 110, atk: 177, delay: 0.77, value: 419490, crit: 6, stats: { str: 11, agi: 7, dex: 5 } }),
  sword_epic_120: EPIC_SWORD(22, { id: 'sword_epic_120', name: 'Celestial Amethyst', nameTh: 'ดาบอเมทิสต์สวรรค์', level: 120, atk: 189, delay: 0.76, value: 487620, crit: 7, stats: { str: 12, agi: 7, dex: 6 } }),
};
Object.assign(ITEMS, EPIC_SWORDS);

/* ============ LEGENDARY SWORDS (assets/ui/source/swords_legendary.png) ============
   Twenty-five legendary swords on the rare ladder's steps, Lv.1 to Lv.120
   (the board's plates say Lv.45-70 and repeat 57 and 58; the pictures keep
   the board's order). A legendary sword is the common sword of its level
   plus three fifths more ATK (epic two fifths, rare one), the fastest swing,
   the most crit, and STR/AGI/DEX/LUK. The rarest find in the game: a boss
   or a weapon box is the likely source. */
const LEGEND_SWORD = (art, o) => W({ art: 'swords_legendary#' + art, wclass: 'sword', range: 47, rarity: 'legendary',
  weight: 50 + Math.round(o.level * 0.6), ...o });
export const LEGENDARY_SWORDS = {
  sword_legend_1: LEGEND_SWORD(0, { id: 'sword_legend_1', name: 'Crimson Oath', nameTh: 'ดาบคำสาบานโลหิต', level: 1, atk: 28, delay: 0.82, value: 3330, crit: 4, stats: { str: 3, agi: 2, dex: 1, luk: 1 } }),
  sword_legend_5: LEGEND_SWORD(1, { id: 'sword_legend_5', name: 'Scarlet Fang', nameTh: 'ดาบเขี้ยวชาด', level: 5, atk: 39, delay: 0.82, value: 9440, crit: 4, stats: { str: 3, agi: 2, dex: 1, luk: 1 } }),
  sword_legend_10: LEGEND_SWORD(2, { id: 'sword_legend_10', name: 'Bloodspire', nameTh: 'ดาบยอดโลหิต', level: 10, atk: 50, delay: 0.81, value: 19800, crit: 4, stats: { str: 4, agi: 2, dex: 1, luk: 1 } }),
  sword_legend_15: LEGEND_SWORD(3, { id: 'sword_legend_15', name: 'Emberwing', nameTh: 'ดาบปีกถ่านเพลิง', level: 15, atk: 60, delay: 0.81, value: 33000, crit: 4, stats: { str: 4, agi: 3, dex: 1, luk: 1 } }),
  sword_legend_20: LEGEND_SWORD(4, { id: 'sword_legend_20', name: 'Ruby Tyrant', nameTh: 'ดาบทรราชทับทิม', level: 20, atk: 70, delay: 0.81, value: 49280, crit: 4, stats: { str: 5, agi: 3, dex: 2, luk: 1 } }),
  sword_legend_25: LEGEND_SWORD(5, { id: 'sword_legend_25', name: 'Cinderclaw', nameTh: 'ดาบกรงเล็บเถ้าเพลิง', level: 25, atk: 79, delay: 0.8, value: 67780, crit: 5, stats: { str: 5, agi: 3, dex: 2, luk: 2 } }),
  sword_legend_30: LEGEND_SWORD(6, { id: 'sword_legend_30', name: 'Flameheart', nameTh: 'ดาบหัวใจเพลิง', level: 30, atk: 87, delay: 0.8, value: 88040, crit: 5, stats: { str: 6, agi: 4, dex: 2, luk: 2 } }),
  sword_legend_35: LEGEND_SWORD(7, { id: 'sword_legend_35', name: 'Hellfang', nameTh: 'ดาบเขี้ยวนรก', level: 35, atk: 96, delay: 0.8, value: 111940, crit: 5, stats: { str: 6, agi: 4, dex: 2, luk: 2 } }),
  sword_legend_40: LEGEND_SWORD(8, { id: 'sword_legend_40', name: 'Wyrmblood Edge', nameTh: 'ดาบคมเลือดวายุภักษ์', level: 40, atk: 104, delay: 0.79, value: 137280, crit: 5, stats: { str: 7, agi: 4, dex: 3, luk: 2 } }),
  sword_legend_45: LEGEND_SWORD(9, { id: 'sword_legend_45', name: 'Crimson Reaver', nameTh: 'ดาบผลาญแดงฉาน', level: 45, atk: 111, delay: 0.79, value: 163610, crit: 5, stats: { str: 7, agi: 5, dex: 3, luk: 2 } }),
  sword_legend_50: LEGEND_SWORD(10, { id: 'sword_legend_50', name: 'Pyre Sovereign', nameTh: 'ดาบราชันกองไฟ', level: 50, atk: 119, delay: 0.79, value: 193730, crit: 6, stats: { str: 8, agi: 5, dex: 3, luk: 3 } }),
  sword_legend_55: LEGEND_SWORD(11, { id: 'sword_legend_55', name: 'Scarlet Talon', nameTh: 'ดาบกรงเล็บแดง', level: 55, atk: 127, delay: 0.78, value: 226310, crit: 6, stats: { str: 8, agi: 5, dex: 4, luk: 3 } }),
  sword_legend_60: LEGEND_SWORD(12, { id: 'sword_legend_60', name: 'Inferno Crest', nameTh: 'ดาบตรานรกเพลิง', level: 60, atk: 134, delay: 0.78, value: 259420, crit: 6, stats: { str: 9, agi: 6, dex: 4, luk: 3 } }),
  sword_legend_65: LEGEND_SWORD(13, { id: 'sword_legend_65', name: 'Bloodmoon', nameTh: 'ดาบจันทร์โลหิต', level: 65, atk: 141, delay: 0.78, value: 294690, crit: 6, stats: { str: 9, agi: 6, dex: 4, luk: 3 } }),
  sword_legend_70: LEGEND_SWORD(14, { id: 'sword_legend_70', name: 'Dragonflame', nameTh: 'ดาบเพลิงมังกร', level: 70, atk: 149, delay: 0.77, value: 334360, crit: 6, stats: { str: 10, agi: 6, dex: 4, luk: 3 } }),
  sword_legend_75: LEGEND_SWORD(15, { id: 'sword_legend_75', name: 'Magma Lord', nameTh: 'ดาบจ้าวลาวา', level: 75, atk: 156, delay: 0.77, value: 374090, crit: 7, stats: { str: 10, agi: 7, dex: 5, luk: 4 } }),
  sword_legend_80: LEGEND_SWORD(16, { id: 'sword_legend_80', name: 'Crimson Wyrm', nameTh: 'ดาบวายุภักษ์แดง', level: 80, atk: 163, delay: 0.77, value: 415980, crit: 7, stats: { str: 11, agi: 7, dex: 5, luk: 4 } }),
  sword_legend_85: LEGEND_SWORD(17, { id: 'sword_legend_85', name: 'Blazeborn', nameTh: 'ดาบกำเนิดเปลวไฟ', level: 85, atk: 169, delay: 0.76, value: 457310, crit: 7, stats: { str: 11, agi: 7, dex: 5, luk: 4 } }),
  sword_legend_90: LEGEND_SWORD(18, { id: 'sword_legend_90', name: 'Phoenix Talon', nameTh: 'ดาบกรงเล็บหงส์เพลิง', level: 90, atk: 176, delay: 0.76, value: 503360, crit: 7, stats: { str: 12, agi: 8, dex: 6, luk: 4 } }),
  sword_legend_95: LEGEND_SWORD(19, { id: 'sword_legend_95', name: 'Hellfire Monarch', nameTh: 'ดาบกษัตริย์ไฟนรก', level: 95, atk: 183, delay: 0.76, value: 551560, crit: 7, stats: { str: 12, agi: 8, dex: 6, luk: 4 } }),
  sword_legend_100: LEGEND_SWORD(20, { id: 'sword_legend_100', name: 'Ruby Dragonfang', nameTh: 'ดาบเขี้ยวมังกรทับทิม', level: 100, atk: 190, delay: 0.75, value: 601920, crit: 8, stats: { str: 13, agi: 8, dex: 6, luk: 5 } }),
  sword_legend_105: LEGEND_SWORD(21, { id: 'sword_legend_105', name: 'Sanguine Emperor', nameTh: 'ดาบจักรพรรดิโลหิต', level: 105, atk: 196, delay: 0.75, value: 651110, crit: 8, stats: { str: 13, agi: 9, dex: 6, luk: 5 } }),
  sword_legend_110: LEGEND_SWORD(22, { id: 'sword_legend_110', name: 'Infernal Crown', nameTh: 'ดาบมงกุฎนรกันต์', level: 110, atk: 203, delay: 0.75, value: 705630, crit: 8, stats: { str: 14, agi: 9, dex: 7, luk: 5 } }),
  sword_legend_115: LEGEND_SWORD(23, { id: 'sword_legend_115', name: 'Dragonking Blade', nameTh: 'ดาบราชามังกร', level: 115, atk: 209, delay: 0.74, value: 758670, crit: 8, stats: { str: 14, agi: 9, dex: 7, luk: 5 } }),
  sword_legend_120: LEGEND_SWORD(24, { id: 'sword_legend_120', name: 'Heart of the Inferno', nameTh: 'ดาบหัวใจอัคคี', level: 120, atk: 216, delay: 0.74, value: 817340, crit: 8, stats: { str: 15, agi: 10, dex: 7, luk: 6 } }),
};
Object.assign(ITEMS, LEGENDARY_SWORDS);

/* ============ MYTHIC SWORDS (assets/ui/source/swords_mythic.png) ============
   Twenty-six mythic swords, the grade above legendary, Lv.1 to Lv.120. The
   board has 25 plates for 26 swords (the big one closing the third row has
   none, and there is no Lv.65 plate), all saying Lv.45-70; the pictures keep
   the board's order. The ladder is the rare one's five-level steps with one
   more at Lv.99, the level cap, so the best mythic a character can wear
   today is a step of its own. A mythic sword is the common sword of its
   level plus four fifths more ATK (legendary three fifths), the most crit,
   and five stats. Almost never seen: a boss, now and then; a box, rarely. */
const MYTHIC_SWORD = (art, o) => W({ art: 'swords_mythic#' + art, wclass: 'sword', range: 47, rarity: 'mythic',
  weight: 52 + Math.round(o.level * 0.6), ...o });
export const MYTHIC_SWORDS = {
  sword_mythic_1: MYTHIC_SWORD(0, { id: 'sword_mythic_1', name: 'Obsidian Oath', nameTh: 'ดาบคำสัตย์ออบซิเดียน', level: 1, atk: 32, delay: 0.8, value: 5180, crit: 5, stats: { str: 4, agi: 3, dex: 2, luk: 2, vit: 1 } }),
  sword_mythic_5: MYTHIC_SWORD(1, { id: 'sword_mythic_5', name: 'Gilded Night', nameTh: 'ดาบราตรีปิดทอง', level: 5, atk: 44, delay: 0.8, value: 14520, crit: 5, stats: { str: 4, agi: 3, dex: 2, luk: 2, vit: 1 } }),
  sword_mythic_10: MYTHIC_SWORD(2, { id: 'sword_mythic_10', name: 'Blackgold Fang', nameTh: 'ดาบเขี้ยวทองดำ', level: 10, atk: 57, delay: 0.79, value: 30780, crit: 5, stats: { str: 5, agi: 3, dex: 2, luk: 2, vit: 1 } }),
  sword_mythic_15: MYTHIC_SWORD(3, { id: 'sword_mythic_15', name: 'Eclipse Warden', nameTh: 'ดาบผู้พิทักษ์คราส', level: 15, atk: 68, delay: 0.79, value: 51000, crit: 5, stats: { str: 5, agi: 4, dex: 3, luk: 2, vit: 1 } }),
  sword_mythic_20: MYTHIC_SWORD(4, { id: 'sword_mythic_20', name: 'Onyx Talon', nameTh: 'ดาบกรงเล็บนิล', level: 20, atk: 78, delay: 0.79, value: 74880, crit: 6, stats: { str: 6, agi: 4, dex: 3, luk: 3, vit: 1 } }),
  sword_mythic_25: MYTHIC_SWORD(5, { id: 'sword_mythic_25', name: 'Umbral Regent', nameTh: 'ดาบผู้สำเร็จราชการเงา', level: 25, atk: 88, delay: 0.78, value: 102960, crit: 6, stats: { str: 6, agi: 5, dex: 3, luk: 3, vit: 1 } }),
  sword_mythic_30: MYTHIC_SWORD(6, { id: 'sword_mythic_30', name: 'Nightforged Edge', nameTh: 'ดาบหลอมราตรี', level: 30, atk: 98, delay: 0.78, value: 135240, crit: 6, stats: { str: 7, agi: 5, dex: 4, luk: 3, vit: 2 } }),
  sword_mythic_35: MYTHIC_SWORD(7, { id: 'sword_mythic_35', name: 'Void Aurum', nameTh: 'ดาบทองห้วงมืด', level: 35, atk: 107, delay: 0.78, value: 170130, crit: 6, stats: { str: 7, agi: 5, dex: 4, luk: 3, vit: 2 } }),
  sword_mythic_40: MYTHIC_SWORD(8, { id: 'sword_mythic_40', name: 'Shadowcrown', nameTh: 'ดาบมงกุฎเงา', level: 40, atk: 117, delay: 0.77, value: 210600, crit: 7, stats: { str: 8, agi: 6, dex: 4, luk: 4, vit: 2 } }),
  sword_mythic_45: MYTHIC_SWORD(9, { id: 'sword_mythic_45', name: 'Abyssal Gilt', nameTh: 'ดาบทองห้วงลึก', level: 45, atk: 125, delay: 0.77, value: 251250, crit: 7, stats: { str: 9, agi: 6, dex: 5, luk: 4, vit: 2 } }),
  sword_mythic_50: MYTHIC_SWORD(10, { id: 'sword_mythic_50', name: 'Dusk Tyrant', nameTh: 'ดาบทรราชสนธยา', level: 50, atk: 134, delay: 0.77, value: 297480, crit: 7, stats: { str: 9, agi: 7, dex: 5, luk: 4, vit: 2 } }),
  sword_mythic_55: MYTHIC_SWORD(11, { id: 'sword_mythic_55', name: 'Obsidian Wyrm', nameTh: 'ดาบวายุภักษ์ออบซิเดียน', level: 55, atk: 142, delay: 0.76, value: 345060, crit: 7, stats: { str: 10, agi: 7, dex: 5, luk: 4, vit: 2 } }),
  sword_mythic_60: MYTHIC_SWORD(12, { id: 'sword_mythic_60', name: 'Blackstar Reaver', nameTh: 'ดาบผลาญดาราดำ', level: 60, atk: 151, delay: 0.76, value: 398640, crit: 8, stats: { str: 10, agi: 8, dex: 6, luk: 5, vit: 3 } }),
  sword_mythic_65: MYTHIC_SWORD(13, { id: 'sword_mythic_65', name: 'Gloomthorn', nameTh: 'ดาบหนามอนธการ', level: 65, atk: 159, delay: 0.76, value: 453150, crit: 8, stats: { str: 11, agi: 8, dex: 6, luk: 5, vit: 3 } }),
  sword_mythic_70: MYTHIC_SWORD(14, { id: 'sword_mythic_70', name: 'Nether Sovereign', nameTh: 'ดาบราชันนรก', level: 70, atk: 167, delay: 0.75, value: 511020, crit: 8, stats: { str: 11, agi: 8, dex: 6, luk: 5, vit: 3 } }),
  sword_mythic_75: MYTHIC_SWORD(15, { id: 'sword_mythic_75', name: 'Midnight Crest', nameTh: 'ดาบตราเที่ยงคืน', level: 75, atk: 175, delay: 0.75, value: 572250, crit: 8, stats: { str: 12, agi: 9, dex: 7, luk: 5, vit: 3 } }),
  sword_mythic_80: MYTHIC_SWORD(16, { id: 'sword_mythic_80', name: 'Voidfang Emperor', nameTh: 'ดาบจักรพรรดิเขี้ยวห้วงมืด', level: 80, atk: 183, delay: 0.75, value: 636840, crit: 9, stats: { str: 12, agi: 9, dex: 7, luk: 6, vit: 3 } }),
  sword_mythic_85: MYTHIC_SWORD(17, { id: 'sword_mythic_85', name: 'Eternal Eclipse', nameTh: 'ดาบคราสนิรันดร์', level: 85, atk: 191, delay: 0.74, value: 704790, crit: 9, stats: { str: 13, agi: 10, dex: 7, luk: 6, vit: 3 } }),
  sword_mythic_90: MYTHIC_SWORD(18, { id: 'sword_mythic_90', name: 'Onyx Dragonlord', nameTh: 'ดาบจ้าวมังกรนิล', level: 90, atk: 198, delay: 0.74, value: 772200, crit: 9, stats: { str: 14, agi: 10, dex: 8, luk: 6, vit: 4 } }),
  sword_mythic_95: MYTHIC_SWORD(19, { id: 'sword_mythic_95', name: 'Worldrend', nameTh: 'ดาบฉีกพิภพ', level: 95, atk: 206, delay: 0.74, value: 846660, crit: 9, stats: { str: 14, agi: 10, dex: 8, luk: 6, vit: 4 } }),
  sword_mythic_99: MYTHIC_SWORD(20, { id: 'sword_mythic_99', name: 'Starless Throne', nameTh: 'ดาบบัลลังก์ไร้ดาว', level: 99, atk: 212, delay: 0.73, value: 906940, crit: 9, stats: { str: 15, agi: 11, dex: 8, luk: 6, vit: 4 } }),
  sword_mythic_100: MYTHIC_SWORD(21, { id: 'sword_mythic_100', name: 'Doomclaw', nameTh: 'ดาบกรงเล็บวิบัติ', level: 100, atk: 213, delay: 0.73, value: 920160, crit: 10, stats: { str: 15, agi: 11, dex: 8, luk: 7, vit: 4 } }),
  sword_mythic_105: MYTHIC_SWORD(22, { id: 'sword_mythic_105', name: 'Oblivion Crown', nameTh: 'ดาบมงกุฎลืมเลือน', level: 105, atk: 221, delay: 0.73, value: 1001130, crit: 10, stats: { str: 15, agi: 11, dex: 9, luk: 7, vit: 4 } }),
  sword_mythic_110: MYTHIC_SWORD(23, { id: 'sword_mythic_110', name: 'Chaos Aurelion', nameTh: 'ดาบทองโกลาหล', level: 110, atk: 228, delay: 0.73, value: 1080720, crit: 10, stats: { str: 16, agi: 12, dex: 9, luk: 7, vit: 4 } }),
  sword_mythic_115: MYTHIC_SWORD(24, { id: 'sword_mythic_115', name: 'Godslayer Night', nameTh: 'ดาบราตรีสังหารเทพ', level: 115, atk: 235, delay: 0.72, value: 1163250, crit: 10, stats: { str: 16, agi: 12, dex: 9, luk: 7, vit: 4 } }),
  sword_mythic_120: MYTHIC_SWORD(25, { id: 'sword_mythic_120', name: 'Mythbreaker', nameTh: 'ดาบทำลายตำนาน', level: 120, atk: 243, delay: 0.72, value: 1253880, crit: 11, stats: { str: 17, agi: 13, dex: 10, luk: 8, vit: 5 } }),
};
Object.assign(ITEMS, MYTHIC_SWORDS);

/* ============ WEAPON BOXES ============
   A sealed box of weapons for one band of levels - swords, and the plain
   bows among the commons. Every grade is in it, the
   better ones more rarely: common 62, rare 28, epic 8.5, legendary 1.2 and
   mythic 0.3 in a hundred, shared evenly among that grade's swords in the band. They drop
   from monsters of the band, from bosses, and are at the ticket counter. */
export const BOX_ODDS = { common: 62, rare: 28, epic: 8.5, legendary: 1.2, mythic: 0.3 };
const BOX_BANDS = [
  { id: 'box_weapon_1', from: 1, to: 39, name: "Novice's Weapon Box", nameTh: 'กล่องสุ่มอาวุธนักผจญภัย', value: 3000, rarity: 'uncommon' },
  { id: 'box_weapon_2', from: 40, to: 79, name: "Veteran's Weapon Box", nameTh: 'กล่องสุ่มอาวุธทหารผ่านศึก', value: 12000, rarity: 'rare' },
  { id: 'box_weapon_3', from: 80, to: 120, name: "Hero's Weapon Box", nameTh: 'กล่องสุ่มอาวุธวีรชน', value: 40000, rarity: 'epic' },
];
export const WEAPON_BOXES = {};
for (const band of BOX_BANDS) {
  const opens = [];
  for (const [grade, set] of [['common', { ...SWORDS, ...BOWS }], ['rare', RARE_SWORDS], ['epic', EPIC_SWORDS], ['legendary', LEGENDARY_SWORDS], ['mythic', MYTHIC_SWORDS]]) {
    const inBand = Object.values(set).filter((w) => w.level >= band.from && w.level <= band.to);
    for (const w of inBand) opens.push({ id: w.id, qty: 1, weight: BOX_ODDS[grade] / inBand.length });
  }
  WEAPON_BOXES[band.id] = C({
    id: band.id, name: band.name, nameTh: band.nameTh, value: band.value, rarity: band.rarity, box: true, weight: 10,
    level: 1, cooldown: 1, band: [band.from, band.to], opens,
    desc: `เปิดแล้วได้อาวุธ Lv.${band.from}–${band.to} หนึ่งชิ้น (ดาบหรือธนู) — ธรรมดา 62% · Rare 28% · Epic 8.5% · Legendary 1.2% · Mythic 0.3%`,
  });
}
Object.assign(ITEMS, WEAPON_BOXES);

/** Items that game systems use by role, not by drop table. */
export const KEY_ITEMS = {
  refineStone: 'runed_whetstone',   // spent on every refine attempt
  refineOil: 'blessing_oil',        // the old all-purpose ward, if it ever returns
  gachaShard: 'gacha_ticket',       // what a shrine draw costs
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

/** Materials, one monster sheet at a time. */
// `loot` names the drop sheet's row the thing falls, lies and is picked up as.
const DROP = (name) => 'drops#' + DROP_ART.cells.icon[name];
export const MATERIALS = {
  slime_jelly: M({ id: 'slime_jelly', name: 'Slime Jelly', nameTh: 'เจลลี่สไลม์', value: 6, weight: 1, rarity: 'common',
    art: DROP('jelly_1'), loot: 'jelly',
    desc: 'ก้อนเจลใส ๆ จากสไลม์น้ำ ยังเด้งอยู่เลย' }),
  water_crystal_s: M({ id: 'water_crystal_s', name: 'Small Water Crystal', nameTh: 'ผลึกน้ำ (เล็ก)', value: 24, weight: 1,
    rarity: 'uncommon', art: DROP('crystal_1'), loot: 'crystal',
    desc: 'ผลึกเล็ก ๆ ที่ก่อตัวในตัวสไลม์ เย็นเฉียบเมื่อจับ' }),
  // the mushroom's
  mushroom_cap: M({ id: 'mushroom_cap', name: 'Mushroom Cap', nameTh: 'หมวกเห็ด', value: 8, weight: 1, rarity: 'common',
    art: DROP('cap_1'), loot: 'cap',
    desc: 'หมวกเห็ดสีแดงจุดขาว นุ่มแต่เหนียว ใช้ทำยาและเควสต์' }),
  herb: M({ id: 'herb', name: 'Herb', nameTh: 'สมุนไพร', value: 12, weight: 1, rarity: 'common',
    art: DROP('herb_1'), loot: 'herb',
    desc: 'ใบไม้หอม ๆ ที่ขึ้นตามรากเห็ด หมอยาต้องการเสมอ' }),
  nature_crystal_s: M({ id: 'nature_crystal_s', name: 'Small Nature Crystal', nameTh: 'ผลึกธรรมชาติ (เล็ก)', value: 28, weight: 1,
    rarity: 'uncommon', art: DROP('ncrystal_1'), loot: 'ncrystal',
    desc: 'ผลึกสีเขียวอ่อนที่เห็ดเก็บพลังดินไว้ อุ่น ๆ เมื่อจับ' }),
};
Object.assign(ITEMS, MATERIALS);

export const RARITY_COLORS = {
  common: '#cfd8dc', uncommon: '#66bb6a', rare: '#42a5f5', epic: '#ab47bc', legendary: '#ffa726', mythic: '#ff4d5e',
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
