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
