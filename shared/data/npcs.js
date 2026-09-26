import { KEY_ITEMS } from './items.js';

// NPC services, shop stock and dialog.
//
// Shops stock *starter* gear and utility only. Nothing above uncommon is ever
// sold by an NPC: mid/late gear has to come from drops, crafting or players.
// Every shelf is empty until the new item sheet is in (shared/data/items.js).

export const SHOPS = {
  general: {
    id: 'general', name: 'ร้านค้าทั่วไปอาร์ทาริส',
    buysAnything: true,
    stock: [
      { id: 'hp_potion_s', stock: 40, restock: 300 },
      { id: 'mp_potion_s', stock: 20, restock: 300 },
      { id: 'antidote', stock: 20, restock: 300 },
      { id: 'speed_potion', stock: 10, restock: 600 },
      { id: 'teleport_potion', stock: 10, restock: 600 },
      { id: 'scroll_fly', stock: 60, restock: 300 },
      { id: 'scroll_return', stock: 20, restock: 600 },
      { id: 'scroll_capital', stock: 10, restock: 600 },
      { id: 'scroll_save', stock: 10, restock: 600 },
      { id: 'scroll_identify', stock: 30, restock: 300 },
      { id: 'warp_ticket', stock: 10, restock: 900 },
      { id: 'wooden_sword', stock: 10, restock: 600 },
    ],
  },
  smith: {
    id: 'smith', name: 'โรงตีเหล็กบอร์ก',
    buysAnything: true, services: ['refine', 'socket', 'repair', 'craft'],
    stock: [
      { id: 'refine_luck_1', stock: 30, restock: 600 },
      { id: 'refine_luck_3', stock: 6, restock: 1800 },
      { id: 'guard_down', stock: 3, restock: 3600 },
      { id: 'iron_shortsword', stock: 5, restock: 1800 },
      { id: 'steel_sword', stock: 5, restock: 1800 },
      { id: 'squire_sword', stock: 4, restock: 1800 },
      { id: 'guard_sword', stock: 4, restock: 1800 },
      { id: 'knight_sword', stock: 3, restock: 1800 },
      { id: 'azure_sword', stock: 3, restock: 1800 },
      { id: 'sapphire_sword', stock: 2, restock: 1800 },
      { id: 'griffin_sword', stock: 2, restock: 1800 },
      { id: 'veteran_sword', stock: 2, restock: 1800 },
      { id: 'thornguard_sword', stock: 1, restock: 1800 },
      { id: 'crescent_sword', stock: 1, restock: 3600 },
      { id: 'royal_sword', stock: 1, restock: 3600 },
      { id: 'serrated_sword', stock: 1, restock: 3600 },
      { id: 'warden_sword', stock: 1, restock: 3600 },
      { id: 'stormguard_sword', stock: 1, restock: 3600 },
      { id: 'dragonbone_sword', stock: 1, restock: 3600 },
      { id: 'sovereign_sword', stock: 1, restock: 3600 },
      { id: 'bloodedge_sword', stock: 1, restock: 3600 },
      { id: 'crimson_sword', stock: 1, restock: 3600 },
      { id: 'ruby_warsword', stock: 1, restock: 3600 },
      // the swordsman's plain helmets, the same ladder
      { id: 'leather_cap', stock: 5, restock: 1800 },
      { id: 'banded_cap', stock: 5, restock: 1800 },
      { id: 'iron_helm', stock: 5, restock: 1800 },
      { id: 'crested_helm', stock: 5, restock: 1800 },
      { id: 'guard_helm', stock: 3, restock: 1800 },
      { id: 'knight_helm', stock: 3, restock: 1800 },
      { id: 'sentinel_helm', stock: 3, restock: 1800 },
      { id: 'gilded_helm', stock: 3, restock: 1800 },
      { id: 'veteran_helm', stock: 2, restock: 1800 },
      { id: 'crimson_helm', stock: 2, restock: 1800 },
      { id: 'wingguard_helm', stock: 1, restock: 1800 },
      { id: 'griffin_helm', stock: 1, restock: 3600 },
      { id: 'royal_helm', stock: 1, restock: 3600 },
      { id: 'valor_helm', stock: 1, restock: 3600 },
      { id: 'ruby_helm', stock: 1, restock: 3600 },
      { id: 'warlord_helm', stock: 1, restock: 3600 },
      { id: 'dragon_helm', stock: 1, restock: 3600 },
      { id: 'sovereign_helm', stock: 1, restock: 3600 },
      { id: 'seraph_helm', stock: 1, restock: 3600 },
      { id: 'heroic_helm', stock: 1, restock: 3600 },
      { id: 'paragon_helm', stock: 1, restock: 3600 },
      { id: 'celestial_helm', stock: 1, restock: 3600 },
      // the archer's plain bows, the same ladder as the swords
      { id: 'hunting_bow', stock: 5, restock: 1800 },
      { id: 'ironbrace_bow', stock: 5, restock: 1800 },
      { id: 'scout_bow', stock: 4, restock: 1800 },
      { id: 'longwood_bow', stock: 4, restock: 1800 },
      { id: 'steelhorn_bow', stock: 3, restock: 1800 },
      { id: 'ranger_bow', stock: 3, restock: 1800 },
      { id: 'silverstring_bow', stock: 2, restock: 1800 },
      { id: 'hawkeye_bow', stock: 2, restock: 1800 },
      { id: 'crescent_bow', stock: 2, restock: 1800 },
      { id: 'bladed_bow', stock: 1, restock: 1800 },
      { id: 'warden_bow', stock: 1, restock: 3600 },
      { id: 'talon_bow', stock: 1, restock: 3600 },
      { id: 'stormstring_bow', stock: 1, restock: 3600 },
      { id: 'moonfang_bow', stock: 1, restock: 3600 },
      { id: 'knightwing_bow', stock: 1, restock: 3600 },
      { id: 'frostglint_bow', stock: 1, restock: 3600 },
      { id: 'skyreaver_bow', stock: 1, restock: 3600 },
      { id: 'starpiercer_bow', stock: 1, restock: 3600 },
      { id: 'seraph_bow', stock: 1, restock: 3600 },
      { id: 'sunflare_sword', stock: 1, restock: 3600 },
      { id: 'dawnking_sword', stock: 1, restock: 3600 },
      { id: 'phoenix_sword', stock: 1, restock: 3600 },
    ],
  },
  // Paid for in Dawn Shards, not coin: the sure-thing counterpart to the
  // shrine's gamble. Anything the gacha can roll can also simply be bought
  // here, for more shards than the average draw costs - so nobody is ever
  // forced to gamble for a wing they want.
  // Rosa's counter beside the grocer: every potion the general store has,
  // plus the greater salve, which otherwise only comes from quests and boxes.
  // It is sold at its full reference value and in small batches, so the shop
  // saves a trip rather than making the quest reward pointless.
  apothecary: {
    id: 'apothecary', name: 'ร้านยาโรซ่า',
    buysAnything: true,
    stock: [
      { id: 'hp_potion_s', stock: 60, restock: 300 },
      { id: 'hp_potion_m', stock: 40, restock: 300 },
      { id: 'hp_potion_l', stock: 25, restock: 600 },
      { id: 'hp_potion_xl', stock: 15, restock: 900 },
      { id: 'mp_potion_s', stock: 30, restock: 300 },
      { id: 'mp_potion_m', stock: 25, restock: 300 },
      { id: 'mp_potion_l', stock: 15, restock: 600 },
      { id: 'mp_potion_xl', stock: 10, restock: 900 },
      { id: 'heal_potion', stock: 20, restock: 300 },
      { id: 'antidote', stock: 30, restock: 300 },
      { id: 'stamina_potion', stock: 10, restock: 600 },
      { id: 'buff_potion', stock: 6, restock: 900 },
      { id: 'atk_potion', stock: 8, restock: 900 },
      { id: 'def_potion', stock: 8, restock: 900 },
      { id: 'crit_potion', stock: 6, restock: 900 },
      { id: 'charm_potion', stock: 6, restock: 900 },
      { id: 'fire_resist', stock: 6, restock: 900 },
      { id: 'ice_resist', stock: 6, restock: 900 },
      { id: 'lightning_resist', stock: 6, restock: 900 },
      { id: 'wind_resist', stock: 6, restock: 900 },
      { id: 'earth_resist', stock: 6, restock: 900 },
      { id: 'dark_resist', stock: 6, restock: 900 },
      { id: 'holy_resist', stock: 6, restock: 900 },
      { id: 'pet_heal_potion', stock: 10, restock: 600 },
      { id: 'pet_exp_potion', stock: 5, restock: 900 },
      { id: 'rage_potion', stock: 4, restock: 1200 },
      { id: 'stealth_potion', stock: 3, restock: 1200 },
      { id: 'revive_potion', stock: 2, restock: 3600 },
      { id: 'scroll_atk', stock: 8, restock: 900 },
      { id: 'scroll_def', stock: 8, restock: 900 },
      { id: 'scroll_speed', stock: 8, restock: 900 },
      { id: 'scroll_vitality', stock: 6, restock: 900 },
      { id: 'scroll_spirit', stock: 6, restock: 900 },
    ],
  },
  dawn: {
    id: 'dawn', name: 'ร้านแลกตั๋วศาลรุ่งอรุณ', currency: KEY_ITEMS.gachaShard,
    stock: [
      { id: 'refine_luck_3', stock: 99, restock: 60, price: 2 },
      { id: 'guard_down', stock: 99, restock: 60, price: 3 },
      { id: 'refine_luck_5', stock: 99, restock: 60, price: 5 },
      { id: 'guard_break', stock: 99, restock: 60, price: 8 },
      { id: 'scroll_exp', stock: 99, restock: 60, price: 2 },
      { id: 'vip_pass', stock: 99, restock: 60, price: 6 },
      { id: 'book_royal', stock: 99, restock: 60, price: 12 },
      { id: 'scroll_daily_reset', stock: 99, restock: 60, price: 3 },
      // the weapon boxes, one per band: the top one is the way to the late epics and legendaries
      { id: 'box_weapon_1', stock: 99, restock: 60, price: 2 },
      { id: 'box_weapon_2', stock: 99, restock: 60, price: 4 },
      { id: 'box_weapon_3', stock: 99, restock: 60, price: 8 },
      // rare swords past the last hunting ground's level: the ticket counter is the only door
      { id: 'sword_rare_70', stock: 99, restock: 60, price: 4 },
      { id: 'sword_rare_75', stock: 99, restock: 60, price: 5 },
      { id: 'sword_rare_80', stock: 99, restock: 60, price: 6 },
      { id: 'sword_rare_85', stock: 99, restock: 60, price: 6 },
      { id: 'sword_rare_90', stock: 99, restock: 60, price: 7 },
      { id: 'sword_rare_95', stock: 99, restock: 60, price: 8 },
      { id: 'sword_rare_100', stock: 99, restock: 60, price: 9 },
      { id: 'sword_rare_105', stock: 99, restock: 60, price: 10 },
      { id: 'sword_rare_110', stock: 99, restock: 60, price: 11 },
      { id: 'sword_rare_115', stock: 99, restock: 60, price: 12 },
      { id: 'sword_rare_120', stock: 99, restock: 60, price: 12 },
    ],
  },
};

export const NPC_DIALOG = {
  townsfolk: {
    greet: 'อากาศดีนะวันนี้ เดินเล่นรอบน้ำพุสักรอบไหม',
    options: [],
  },
  vendor: {
    greet: 'ยินดีต้อนรับสู่อาร์ทาริส ของที่นี่ไม่ถูกหรอกนะ แต่ของจริงทั้งนั้น',
    options: [{ label: 'ดูของขาย', action: 'shop', shop: 'general' }, { label: 'ขายของ', action: 'sell' }],
  },
  apothecary: {
    greet: 'ยินดีต้อนรับค่ะ! ยาทุกขวดโรซ่าต้มเองกับมือ ก่อนออกไปล่าอย่าลืมพกติดตัวนะคะ',
    options: [{ label: 'ดูยา', action: 'shop', shop: 'apothecary' }, { label: 'ขายของ', action: 'sell' }],
  },
  smith: {
    greet: 'อยากให้เหล็กชิ้นนี้แข็งขึ้นใช่ไหม? เตรียมใจไว้ด้วย มันพังได้',
    options: [
      { label: 'ดูของขาย', action: 'shop', shop: 'smith' },
      { label: 'ตีบวก (Refine)', action: 'refine' },
      { label: 'ฝังการ์ด', action: 'socket' },
      { label: 'ซ่อมอุปกรณ์', action: 'repair' },
      { label: 'คราฟต์ของ', action: 'craft' },
      { label: 'ขายของ', action: 'sell' },
    ],
  },
  armorer: {
    greet: 'ชุดเกราะล็อตใหม่กำลังเดินทางมาจากเมืองหลวง! ระหว่างนี้มีของจะขายก็เอามาได้นะ ราคาดี',
    options: [{ label: 'ขายของ', action: 'sell' }],
  },
  weaponer: {
    greet: 'ดาบ ธนู ของดีทั้งนั้น! ถ้าจะตีบวกหรือซ่อม ไปหาบอร์กที่โรงตีเหล็กนะ',
    options: [{ label: 'ดูอาวุธ', action: 'shop', shop: 'smith' }, { label: 'ขายของ', action: 'sell' }],
  },
  banker: {
    greet: 'ฝากของไว้กับข้าได้ ค่าธรรมเนียมครั้งละนิดหน่อยเท่านั้น',
    options: [{ label: 'เปิดคลังเก็บของ', action: 'storage' }],
  },
  broker: {
    greet: 'ตลาดผู้เล่นอยู่ตรงนี้ ขายได้ ซื้อได้ หักภาษี 5% ทุกดีล',
    options: [{ label: 'เปิดตลาด', action: 'market' }],
  },
  healer: {
    greet: 'บาดเจ็บมาเหรอ? นั่งพักก่อนก็ได้ ฟรี แต่ถ้ารีบก็มีค่าใช้จ่าย',
    options: [
      { label: 'รักษาเต็ม (ค่าบริการตามเลเวล)', action: 'heal' },
      { label: 'ล้างสถานะผิดปกติ (ฟรี)', action: 'cleanse' },
    ],
  },
  // the town trainers of old: job changes, the trials and respecs are the
  // castle's now, and they send you there
  guide: {
    greet: 'เรื่องเปลี่ยนอาชีพ บททดสอบของแต่ละสาย และการรีเซ็ต ตอนนี้ต้องไปที่ปราสาทอาร์ทาริสแล้ว ปรมาจารย์เอเลนเดียรออยู่ที่ปีกตะวันตก เข้าทางประตูใหญ่ทางเหนือของเมือง',
    options: [],
  },
  trainer: {
    greet: 'พร้อมจะเลือกทางของตัวเองหรือยัง?',
    options: [
      { label: 'เปลี่ยนอาชีพ', action: 'jobChange' },
      { label: 'รีเซ็ตสเตตัส (แพงมาก)', action: 'resetStats' },
      { label: 'รีเซ็ตสกิล (แพงมาก)', action: 'resetSkills' },
    ],
  },
  warper: {
    greet: 'จะไปไหน? เดินเองก็ได้นะ ประหยัดกว่า',
    options: [{ label: 'ดูปลายทาง', action: 'warpMenu' }],
  },
  princess: {
    greet: 'ยินดีต้อนรับสู่ปราสาทอาร์ทาริส ถ้าจะเลือกเส้นทางของตัวเอง ไปหาท่านเอเลนเดียทางปีกตะวันตก ส่วนงานของราชวังอยู่กับเอลวินทางปีกตะวันออก',
    options: [],
  },
  royal_board: {
    greet: 'ภารกิจจากราชวัง ทุกงานมีรางวัลจากคลังหลวง',
    options: [{ label: 'ดูภารกิจ', action: 'quests' }],
  },
  board: {
    greet: 'กระดานภารกิจของเมือง',
    options: [{ label: 'ดูภารกิจ', action: 'quests' }],
  },
  oracle: {
    greet: 'เศษรุ่งอรุณในมือเจ้า… อยากรู้ไหมว่ามันจะกลายเป็นอะไร?',
    options: [
      { label: 'เสี่ยงทายที่ศาล', action: 'gacha' },
      { label: 'ร้านแลกตั๋วศาลรุ่งอรุณ', action: 'shop', shop: 'dawn' },
    ],
  },
};

/** Warp destinations sold by the warp NPC. Travel is a real Aurum sink. */
// Fast travel. Towns are open to everyone; a field or cave only once you
// have walked into it yourself (`needVisit`), so the map is still learned on
// foot the first time. Dungeons and the boss room are never on the list -
// their doors are the point.
export const WARP_ROUTES = [
  { to: 'artaris', at: [45, 35], price: 100, label: 'อาร์ทาริส', kind: 'town' },
  { to: 'castle', at: [23, 27], price: 50, label: 'ปราสาทอาร์ทาริส', kind: 'town' },
  { to: 'greenmire', at: [44, 4], price: 150, label: 'ทุ่งกรีนไมร์', kind: 'field', needVisit: true },
  { to: 'amberwood', at: [4, 28], price: 400, label: 'ป่าอำพันชายแดน', kind: 'field', needVisit: true },
  { to: 'obsidian', at: [4, 16], price: 900, label: 'ที่ราบสูงออบซิเดียน', kind: 'field', needVisit: true },
  { to: 'frostfall', at: [4, 19], price: 1500, label: 'ช่องเขามังกรน้ำแข็ง', kind: 'field', needVisit: true },
];

export const HEAL_PRICE_PER_LEVEL = 18;
export const STORAGE_FEE = 200;        // per open
export const RESET_STAT_PRICE = 50000;
export const RESET_SKILL_PRICE = 50000;
