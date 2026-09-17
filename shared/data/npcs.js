// NPC services, shop stock and dialog.
//
// Shops stock *starter* gear and utility only. Nothing above uncommon is ever
// sold by an NPC: mid/late gear has to come from drops, crafting or players.

export const SHOPS = {
  general: {
    id: 'general', name: 'ร้านค้าทั่วไปเอมเบอร์โฮลด์',
    buysAnything: true,
    stock: [
      { id: 'lesser_salve', stock: 40, restock: 300 },
      { id: 'antidote', stock: 20, restock: 300 },
      { id: 'mana_draught', stock: 20, restock: 300 },
      { id: 'warp_scroll', stock: 10, restock: 600 },
      { id: 'wooden_arrow', stock: 4000, restock: 120 },
      { id: 'iron_arrow', stock: 1200, restock: 300 },
      { id: 'cloth_shirt', stock: 10 },
      { id: 'cloth_pants', stock: 10 },
      { id: 'worn_boots', stock: 10 },
      { id: 'training_blade', stock: 5 },
      { id: 'worn_spear', stock: 5 },
      { id: 'short_bow', stock: 5 },
      { id: 'apprentice_rod', stock: 5 },
      { id: 'wooden_shield', stock: 5 },
      { id: 'leather_belt', stock: 5 },
    ],
  },
  smith: {
    id: 'smith', name: 'โรงตีเหล็กบอร์ก',
    buysAnything: true, services: ['refine', 'repair', 'craft'],
    stock: [
      { id: 'brown_tunic', stock: 6 },
      { id: 'teal_tunic', stock: 6 },
      { id: 'mage_robe', stock: 6 },
      { id: 'leather_vest', stock: 4 },
      { id: 'leather_cap', stock: 6 },
      { id: 'cloth_hood', stock: 6 },
      { id: 'leather_bracers', stock: 6 },
      { id: 'scout_pants', stock: 6 },
      { id: 'traveler_boots', stock: 6 },
      { id: 'iron_shield', stock: 3 },
      { id: 'bronze_shortblade', stock: 3 },
      { id: 'iron_pike', stock: 3 },
      { id: 'recurve_bow', stock: 3 },
      { id: 'oak_rod', stock: 3 },
      { id: 'iron_ore', stock: 200, restock: 600 },
    ],
  },
};

export const NPC_DIALOG = {
  vendor: {
    greet: 'ยินดีต้อนรับสู่เอมเบอร์โฮลด์ ของที่นี่ไม่ถูกหรอกนะ แต่ของจริงทั้งนั้น',
    options: [{ label: 'ดูของขาย', action: 'shop', shop: 'general' }, { label: 'ขายของ', action: 'sell' }],
  },
  smith: {
    greet: 'อยากให้เหล็กชิ้นนี้แข็งขึ้นใช่ไหม? เตรียมใจไว้ด้วย มันพังได้',
    options: [
      { label: 'ดูของขาย', action: 'shop', shop: 'smith' },
      { label: 'ตีบวก (Refine)', action: 'refine' },
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
};

/** Warp destinations sold by the warp NPC. Travel is a real Aurum sink. */
export const WARP_ROUTES = [
  { to: 'greenmire', at: [40, 6], price: 150, label: 'ทุ่งกรีนไมร์' },
  { to: 'ashfen', at: [8, 32], price: 400, label: 'หนองเถ้า' },
  { to: 'gravebound', at: [30, 6], price: 900, label: 'สุสานกราฟบาวด์' },
  { to: 'orcwatch', at: [8, 8], price: 1800, label: 'สันเขาออร์ควอช' },
  { to: 'frostvault', at: [10, 10], price: 3200, label: 'ห้องนิรภัยเยือกแข็ง' },
];

export const HEAL_PRICE_PER_LEVEL = 18;
export const STORAGE_FEE = 200;        // per open
export const RESET_STAT_PRICE = 50000;
export const RESET_SKILL_PRICE = 50000;
