import { KEY_ITEMS } from './items.js';

// NPC services, shop stock and dialog.
//
// Shops stock *starter* gear and utility only. Nothing above uncommon is ever
// sold by an NPC: mid/late gear has to come from drops, crafting or players.
// Every shelf is empty until the new item sheet is in (shared/data/items.js).

export const SHOPS = {
  general: {
    id: 'general', name: 'ร้านค้าทั่วไปเอมเบอร์โฮลด์',
    buysAnything: true,
    stock: [
      { id: 'hp_potion_s', stock: 40, restock: 300 },
      { id: 'mp_potion_s', stock: 20, restock: 300 },
      { id: 'antidote', stock: 20, restock: 300 },
      { id: 'speed_potion', stock: 10, restock: 600 },
      { id: 'teleport_potion', stock: 10, restock: 600 },
    ],
  },
  smith: {
    id: 'smith', name: 'โรงตีเหล็กบอร์ก',
    buysAnything: true, services: ['refine', 'socket', 'repair', 'craft'],
    stock: [],
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
    ],
  },
  dawn: {
    id: 'dawn', name: 'ร้านแลกเศษรุ่งอรุณ', currency: KEY_ITEMS.gachaShard,
    stock: [],
  },
};

export const NPC_DIALOG = {
  townsfolk: {
    greet: 'อากาศดีนะวันนี้ เดินเล่นรอบน้ำพุสักรอบไหม',
    options: [],
  },
  vendor: {
    greet: 'ยินดีต้อนรับสู่เอมเบอร์โฮลด์ ของที่นี่ไม่ถูกหรอกนะ แต่ของจริงทั้งนั้น',
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
  board: {
    greet: 'กระดานภารกิจของเมือง',
    options: [{ label: 'ดูภารกิจ', action: 'quests' }],
  },
  oracle: {
    greet: 'เศษรุ่งอรุณในมือเจ้า… อยากรู้ไหมว่ามันจะกลายเป็นอะไร?',
    options: [
      { label: 'เสี่ยงทายที่ศาล', action: 'gacha' },
      { label: 'ร้านแลกเศษรุ่งอรุณ', action: 'shop', shop: 'dawn' },
    ],
  },
};

/** Warp destinations sold by the warp NPC. Travel is a real Aurum sink. */
// Fast travel. Towns are open to everyone; a field or cave only once you
// have walked into it yourself (`needVisit`), so the map is still learned on
// foot the first time. Dungeons and the boss room are never on the list -
// their doors are the point.
export const WARP_ROUTES = [
  { to: 'emberhold', at: [30, 23], price: 100, label: 'เอมเบอร์โฮลด์', kind: 'town' },
  { to: 'millhaven', at: [40, 32], price: 300, label: 'มิลเฮเวน', kind: 'town' },
  { to: 'ravenholm', at: [44, 36], price: 1200, label: 'เรเวนโฮล์ม', kind: 'town' },
  { to: 'greenmire', at: [40, 6], price: 150, label: 'ทุ่งกรีนไมร์', kind: 'field', needVisit: true },
  { to: 'ashfen', at: [8, 32], price: 400, label: 'หนองเถ้า', kind: 'field', needVisit: true },
  { to: 'gravebound', at: [30, 6], price: 900, label: 'สุสานกราฟบาวด์', kind: 'field', needVisit: true },
  { to: 'orcwatch', at: [8, 8], price: 1800, label: 'สันเขาออร์ควอช', kind: 'field', needVisit: true },
  { to: 'frostvault', at: [14, 14], price: 3200, label: 'ห้องนิรภัยเยือกแข็ง', kind: 'field', needVisit: true },
];

export const HEAL_PRICE_PER_LEVEL = 18;
export const STORAGE_FEE = 200;        // per open
export const RESET_STAT_PRICE = 50000;
export const RESET_SKILL_PRICE = 50000;
