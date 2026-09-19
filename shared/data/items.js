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

export const ITEMS = {
  /* ================= BOXES & SCROLLS =================
     A box is opened, not consumed for stats: `opens` is a weighted table,
     rolled on the server. Scrolls drop from ordinary monsters and pay in
     materials; boss caskets are where wings actually come from. */

  mystery_scroll: C({
    id: 'mystery_scroll', name: 'Mystery Scroll', nameTh: 'ม้วนปริศนา', level: 1,
    weight: 1, value: 900, rarity: 'uncommon', stack: 99, cooldown: 0, box: true,
    desc: 'ม้วนกระดาษผนึกไว้ ไม่มีใครรู้ว่าข้างในเป็นอะไรจนกว่าจะแกะ',
    opens: [
      { id: 'lesser_salve', qty: [3, 6], weight: 22 },
      { id: 'herb_bundle', qty: [5, 12], weight: 18 },
      { id: 'iron_ore', qty: [2, 6], weight: 16 },
      { id: 'greater_salve', qty: [2, 4], weight: 12 },
      { id: 'mana_draught', qty: [2, 4], weight: 10 },
      { id: 'steel_ingot', qty: [1, 2], weight: 8 },
      { id: 'runed_whetstone', qty: 1, weight: 7 },
      { id: 'blessing_oil', qty: 1, weight: 4 },
      { id: 'shard_dawn', qty: 1, weight: 3 },
    ],
  }),
  boss_casket: C({
    id: 'boss_casket', name: "Warlord's Casket", nameTh: 'หีบของจอมทัพ', level: 1,
    weight: 3, value: 24000, rarity: 'epic', stack: 99, cooldown: 0, box: true,
    desc: 'หีบที่บอสหวงไว้ — ข้างในมีตั้งแต่ของดีไปจนถึงปีก',
    opens: [
      { id: 'runed_whetstone', qty: [2, 4], weight: 24 },
      { id: 'blessing_oil', qty: [1, 2], weight: 20 },
      { id: 'shard_dawn', qty: [2, 5], weight: 18 },
      { id: 'steel_ingot', qty: [4, 8], weight: 14 },
      { id: 'emberheart_amulet', qty: 1, weight: 8 },
      { id: 'wings_feather', qty: 1, weight: 6 },
      { id: 'wings_raven', qty: 1, weight: 6 },
      { id: 'wings_bat', qty: 1, weight: 3 },
      { id: 'wings_frost', qty: 1, weight: 1 },
    ],
  }),
  dawn_casket: C({
    id: 'dawn_casket', name: 'Dawn Casket', nameTh: 'หีบรุ่งอรุณ', level: 1,
    weight: 3, value: 90000, rarity: 'legendary', stack: 99, cooldown: 0, box: true,
    desc: 'หีบที่เปิดได้ด้วยแสงแรกของวัน — ของข้างในไม่มีของธรรมดาเลย',
    opens: [
      { id: 'shard_dawn', qty: [5, 10], weight: 26 },
      { id: 'blessing_oil', qty: [2, 4], weight: 20 },
      { id: 'runed_whetstone', qty: [4, 8], weight: 18 },
      { id: 'wings_frost', qty: 1, weight: 12 },
      { id: 'wings_bat', qty: 1, weight: 10 },
      { id: 'wings_ember', qty: 1, weight: 8 },
      { id: 'wings_dawn', qty: 1, weight: 3 },
      { id: 'ashguard_plate', qty: 1, weight: 3 },
    ],
  }),

  /* ================= WINGS =================
     Cosmetic first, useful second: small stats, no refining, and the only
     way to get them is the gacha, a boss box or a scroll. They are what the
     shard economy exists to chase. `wing` names the style wings.js draws. */
  wings_feather: A({
    id: 'wings_feather', name: 'Seraph Wings', nameTh: 'ปีกนางฟ้า', slot: 'wings', level: 20,
    weight: 6, value: 60000, rarity: 'rare', refinable: false, durability: undefined,
    wing: { style: 'feather', scale: 1 }, stats: { agi: 2 }, speed: 3,
    desc: 'ขนนกสีนวล เบาจนแทบไม่รู้สึกว่ามีอะไรอยู่บนหลัง',
  }),
  wings_raven: A({
    id: 'wings_raven', name: 'Raven Wings', nameTh: 'ปีกอีกา', slot: 'wings', level: 20,
    weight: 6, value: 60000, rarity: 'rare', refinable: false, durability: undefined,
    wing: { style: 'raven', scale: 1 }, stats: { agi: 2, luk: 1 }, flee: 8,
    desc: 'ดำสนิทจนกลืนไปกับกลางคืน',
  }),
  wings_bat: A({
    id: 'wings_bat', name: 'Duskfang Wings', nameTh: 'ปีกค้างคาวสนธยา', slot: 'wings', level: 30,
    weight: 7, value: 120000, rarity: 'epic', refinable: false, durability: undefined,
    wing: { style: 'bat', scale: 1.05 }, stats: { str: 2, agi: 2 }, crit: 2,
    desc: 'หนังปีกบางเฉียบ ได้ยินเสียงลมทุกครั้งที่ขยับ',
  }),
  wings_frost: A({
    id: 'wings_frost', name: 'Rimeglass Wings', nameTh: 'ปีกแก้วน้ำแข็ง', slot: 'wings', level: 40,
    weight: 8, value: 220000, rarity: 'epic', refinable: false, durability: undefined,
    wing: { style: 'frost', scale: 1.05 }, stats: { int: 3, vit: 2 }, sp: 60, mdef: 4,
    desc: 'ผลึกที่ไม่ละลาย แม้จะอยู่ในมือของคนเป็น',
  }),
  wings_ember: A({
    id: 'wings_ember', name: 'Emberfall Wings', nameTh: 'ปีกเปลวอังคาร', slot: 'wings', level: 50,
    weight: 8, value: 380000, rarity: 'legendary', refinable: false, durability: undefined,
    wing: { style: 'ember', scale: 1.1 }, stats: { str: 3, agi: 3 }, atk: 12, speed: 4,
    desc: 'ไฟที่ไม่ไหม้เจ้าของ — แต่ไหม้ทุกอย่างที่เข้ามาใกล้',
  }),
  wings_dawn: A({
    id: 'wings_dawn', name: 'Dawnbringer Wings', nameTh: 'ปีกผู้นำรุ่งอรุณ', slot: 'wings', level: 60,
    weight: 8, value: 700000, rarity: 'legendary', refinable: false, durability: undefined,
    wing: { style: 'dawn', scale: 1.15 }, stats: { str: 2, agi: 2, int: 2, vit: 2 }, hp: 200, sp: 80, speed: 5,
    desc: 'แสงแรกของวัน ที่มีคนเพียงไม่กี่คนในเซิร์ฟเวอร์เคยได้ถือ',
  }),

  /* ================= WEAPONS ================= */
  training_blade: W({
    id: 'training_blade', name: 'Training Blade', nameTh: 'มีดฝึกหัด', wclass: 'blade',
    atk: 12, delay: 0.85, range: 40, level: 1, weight: 40, value: 180, rarity: 'common',
    sprite: { layer: 'weapon', key: 'dagger', gendered: true }, desc: 'มีดสั้นสำหรับผู้เริ่มต้น',
  }),
  bronze_shortblade: W({
    id: 'bronze_shortblade', name: 'Bronze Shortblade', nameTh: 'มีดสั้นสำริด', wclass: 'blade',
    atk: 26, delay: 0.80, range: 40, level: 8, weight: 55, value: 1400, rarity: 'common',
    sprite: { layer: 'weapon', key: 'dagger', gendered: true },
  }),
  hunters_fang: W({
    id: 'hunters_fang', name: "Hunter's Fang", nameTh: 'เขี้ยวนายพราน', wclass: 'blade',
    atk: 41, delay: 0.72, range: 40, level: 20, weight: 60, value: 6800, rarity: 'uncommon',
    stats: { agi: 2 }, crit: 4, sprite: { layer: 'weapon', key: 'dagger', gendered: true },
    desc: 'เบาและเร็ว เหมาะกับสายคริติคอล',
  }),
  emberfang: W({
    id: 'emberfang', name: 'Emberfang', nameTh: 'เขี้ยวอังคาร', wclass: 'blade',
    atk: 63, delay: 0.72, range: 40, level: 40, weight: 70, value: 42000, rarity: 'rare',
    element: 'ember', stats: { str: 3, agi: 2 }, crit: 6,
    sprite: { layer: 'weapon', key: 'dagger', gendered: true }, desc: 'มีดที่ยังอุ่นอยู่เสมอ ธาตุไฟ',
  }),
  ashen_edge: W({
    id: 'ashen_edge', name: 'Ashen Edge', nameTh: 'คมเถ้าธุลี', wclass: 'blade',
    atk: 86, delay: 0.68, range: 40, level: 60, weight: 75, value: 168000, rarity: 'epic',
    element: 'shade', stats: { agi: 4, luk: 3 }, crit: 10, lifesteal: 3,
    sprite: { layer: 'weapon', key: 'dagger', gendered: true },
    desc: 'ตกจากราชันโครงกระดูกเท่านั้น',
  }),

  // Blades had a rung at level 8 and nothing else did, so for four levels a
  // spear, a bow or a rod user was still swinging the weapon they started
  // with while a blade user had already upgraded. The balance report showed
  // it as a caster killing things four times slower than a vanguard.
  ashwood_pike: W({
    id: 'ashwood_pike', name: 'Ashwood Pike', nameTh: 'ทวนไม้เถ้า', wclass: 'spear',
    atk: 30, delay: 1.02, range: 72, level: 9, weight: 90, value: 1500, rarity: 'common',
    sprite: { layer: 'weapon', key: 'spear', gendered: true },
  }),
  hunting_bow: W({
    id: 'hunting_bow', name: 'Hunting Bow', nameTh: 'ธนูล่าสัตว์', wclass: 'bow',
    atk: 25, delay: 0.94, range: 220, level: 9, weight: 55, value: 1450, rarity: 'common',
    sprite: { layer: 'weapon', key: 'bow', gendered: true },
  }),
  birch_rod: W({
    id: 'birch_rod', name: 'Birchbark Rod', nameTh: 'ไม้เท้าเปลือกเบิร์ช', wclass: 'rod',
    atk: 11, matk: 25, delay: 1.0, range: 60, level: 9, weight: 36, value: 1500, rarity: 'common',
    stats: { int: 1 }, sprite: { layer: 'weapon', key: 'wand', gendered: true },
  }),
  worn_spear: W({
    id: 'worn_spear', name: 'Worn Spear', nameTh: 'หอกเก่า', wclass: 'spear',
    atk: 18, delay: 1.05, range: 66, level: 1, weight: 90, value: 260, rarity: 'common',
    sprite: { layer: 'weapon', key: 'spear', gendered: true },
  }),
  iron_pike: W({
    id: 'iron_pike', name: 'Iron Pike', nameTh: 'หอกเหล็ก', wclass: 'spear',
    atk: 38, delay: 1.02, range: 68, level: 12, weight: 110, value: 3100, rarity: 'common',
    sprite: { layer: 'weapon', key: 'spear', gendered: true },
  }),
  warden_halberd: W({
    id: 'warden_halberd', name: 'Warden Halberd', nameTh: 'ง้าวผู้พิทักษ์', wclass: 'spear',
    atk: 62, delay: 1.10, range: 76, level: 30, weight: 140, value: 21000, rarity: 'uncommon',
    stats: { str: 3, vit: 2 }, twoHanded: true,
    sprite: { layer: 'weapon', key: 'longspear', gendered: false },
  }),
  ridgebreaker_pike: W({
    id: 'ridgebreaker_pike', name: 'Ridgebreaker Pike', nameTh: 'ทวนทลายสันเขา', wclass: 'spear',
    atk: 62, delay: 1.04, range: 74, level: 42, weight: 140, value: 46000, rarity: 'uncommon',
    stats: { str: 3 }, sprite: { layer: 'weapon', key: 'spear', gendered: true, tint: '#9a8a6a' },
  }),
  marshwood_bow: W({
    id: 'marshwood_bow', name: 'Marshwood Bow', nameTh: 'ธนูไม้หนอง', wclass: 'bow',
    atk: 48, delay: 0.93, range: 228, level: 26, weight: 62, value: 19000, rarity: 'common',
    stats: { dex: 2 }, sprite: { layer: 'weapon', key: 'bow', gendered: true, tint: '#7f6b4e' },
  }),
  glacier_lance: W({
    id: 'glacier_lance', name: 'Glacier Lance', nameTh: 'ทวนธารน้ำแข็ง', wclass: 'spear',
    atk: 95, delay: 1.06, range: 78, level: 55, weight: 150, value: 138000, rarity: 'epic',
    element: 'frost', stats: { str: 4, vit: 3 }, twoHanded: true,
    sprite: { layer: 'weapon', key: 'longspear', gendered: false },
  }),

  short_bow: W({
    id: 'short_bow', name: 'Short Bow', nameTh: 'ธนูสั้น', wclass: 'bow',
    atk: 16, delay: 0.95, range: 180, level: 1, weight: 50, value: 320, rarity: 'common',
    twoHanded: true, sprite: { layer: 'weapon', key: 'bow', gendered: false },
  }),
  recurve_bow: W({
    id: 'recurve_bow', name: 'Recurve Bow', nameTh: 'ธนูโค้งกลับ', wclass: 'bow',
    atk: 36, delay: 0.92, range: 195, level: 15, weight: 60, value: 5200, rarity: 'common',
    twoHanded: true, stats: { dex: 2 }, sprite: { layer: 'weapon', key: 'recurvebow', gendered: false },
  }),
  stormcaller_bow: W({
    id: 'stormcaller_bow', name: 'Stormcaller Bow', nameTh: 'ธนูเรียกพายุ', wclass: 'bow',
    atk: 68, delay: 0.88, range: 215, level: 38, weight: 70, value: 46000, rarity: 'rare',
    twoHanded: true, element: 'storm', stats: { dex: 4, agi: 2 },
    sprite: { layer: 'weapon', key: 'greatbow', gendered: false },
  }),
  // Spears stopped at level 55 while every other class had something in the
  // sixties, so a vanguard's last fifteen levels were spent on a weapon the
  // rest of the game had already left behind.
  vhaal_warpike: W({
    id: 'vhaal_warpike', name: 'Warpike of Vhaal', nameTh: 'ทวนศึกวาล', wclass: 'spear',
    atk: 118, delay: 1.02, range: 76, level: 62, weight: 210, value: 235000, rarity: 'epic',
    element: 'radiant', stats: { str: 4, vit: 2 },
    sprite: { layer: 'weapon', key: 'spear', gendered: true },
  }),
  // The bow ladder jumped from 38 to 62 and the rod from 32 to 58, which is
  // most of the back half of the game spent on the same weapon. It showed up
  // as the sharpshooter killing things twice as slowly as anyone else at 50.
  vault_longbow: W({
    id: 'vault_longbow', name: 'Vaultwatch Longbow', nameTh: 'ธนูยาวยามนิรภัย', wclass: 'bow',
    atk: 84, delay: 0.90, range: 236, level: 50, weight: 78, value: 108000, rarity: 'rare',
    element: 'frost', stats: { dex: 3, agi: 2 },
    sprite: { layer: 'weapon', key: 'bow', gendered: true },
  }),
  hoarfrost_rod: W({
    id: 'hoarfrost_rod', name: 'Hoarfrost Rod', nameTh: 'คทาเหมันต์', wclass: 'rod',
    atk: 22, matk: 74, delay: 0.97, range: 62, level: 46, weight: 42, value: 96000, rarity: 'rare',
    element: 'frost', stats: { int: 4 },
    sprite: { layer: 'weapon', key: 'wand', gendered: true, fallback: 'wand' },
  }),
  // Bows reached the endgame with a radiant weapon and blades did not, so a
  // blade-only job spent the last ten levels swinging neutral into a world
  // made of shade - a flat 0.7x, against the bow's 1.9x. That is where the
  // Nightblade's two-to-one gap against its own sibling branch came from: not
  // its skills, the element table.
  dawnbrand: W({
    id: 'dawnbrand', name: 'Dawnbrand', nameTh: 'ดาบอรุณ', wclass: 'blade',
    atk: 92, delay: 0.70, range: 46, level: 62, weight: 120, value: 228000, rarity: 'epic',
    element: 'radiant', stats: { str: 3, agi: 2 },
    sprite: { layer: 'weapon', key: 'dagger', gendered: true, tint: '#f6dc9c' },
  }),
  dawnpiercer: W({
    id: 'dawnpiercer', name: 'Dawnpiercer', nameTh: 'ธนูเจาะอรุณ', wclass: 'bow',
    atk: 98, delay: 0.85, range: 235, level: 62, weight: 78, value: 195000, rarity: 'epic',
    twoHanded: true, element: 'radiant', stats: { dex: 6, luk: 2 }, crit: 8,
    sprite: { layer: 'weapon', key: 'greatbow', gendered: false },
  }),

  apprentice_rod: W({
    id: 'apprentice_rod', name: 'Apprentice Rod', nameTh: 'ไม้เท้าฝึกหัด', wclass: 'rod',
    atk: 8, matk: 16, delay: 1.0, range: 60, level: 1, weight: 35, value: 300, rarity: 'common',
    sprite: { layer: 'weapon', key: 'wand', gendered: true },
  }),
  oak_rod: W({
    id: 'oak_rod', name: 'Oakheart Rod', nameTh: 'ไม้เท้าใจโอ๊ก', wclass: 'rod',
    atk: 14, matk: 34, delay: 1.0, range: 60, level: 14, weight: 40, value: 4800, rarity: 'common',
    stats: { int: 2 }, sprite: { layer: 'weapon', key: 'wand', gendered: true },
  }),
  runesteel_rod: W({
    id: 'runesteel_rod', name: 'Runesteel Rod', nameTh: 'คทาเหล็กรูน', wclass: 'rod',
    atk: 20, matk: 58, delay: 0.98, range: 62, level: 32, weight: 45, value: 27000, rarity: 'rare',
    stats: { int: 4, dex: 2 }, sprite: { layer: 'weapon', key: 'steelwand', gendered: true, fallback: 'wand' },
  }),
  emberfall_scepter: W({
    id: 'emberfall_scepter', name: 'Emberfall Scepter', nameTh: 'คทาเอมเบอร์ฟอลล์', wclass: 'rod',
    atk: 26, matk: 92, delay: 0.95, range: 66, level: 58, weight: 50, value: 176000, rarity: 'epic',
    element: 'ember', stats: { int: 7 }, cast: 5,
    sprite: { layer: 'weapon', key: 'steelwand', gendered: true, fallback: 'wand' },
  }),

  /* ================= OFFHAND ================= */
  wooden_shield: A({
    id: 'wooden_shield', name: 'Wooden Shield', nameTh: 'โล่ไม้', slot: 'offhand',
    def: 8, level: 1, weight: 60, value: 400, rarity: 'common',
    sprite: { layer: 'offhand', key: 'shield', gendered: true },
  }),
  iron_shield: A({
    id: 'iron_shield', name: 'Iron Shield', nameTh: 'โล่เหล็ก', slot: 'offhand',
    def: 22, level: 14, weight: 130, value: 4200, rarity: 'common', stats: { vit: 1 },
    sprite: { layer: 'offhand', key: 'shield', gendered: true },
  }),
  bulwark_shield: A({
    id: 'bulwark_shield', name: 'Bulwark of Vows', nameTh: 'โล่คำสาบาน', slot: 'offhand',
    def: 48, mdef: 18, level: 45, weight: 180, value: 88000, rarity: 'rare', stats: { vit: 4 },
    sprite: { layer: 'offhand', key: 'shield', gendered: true },
  }),

  /* ================= ARMOR ================= */
  cloth_shirt: A({ id: 'cloth_shirt', name: 'Cloth Shirt', nameTh: 'เสื้อผ้าฝ้าย', slot: 'torso', def: 6, level: 1, weight: 30, value: 150, rarity: 'common', sprite: { layer: 'torso', key: 'shirt_white', gendered: true } }),
  brown_tunic: A({ id: 'brown_tunic', name: 'Traveler Tunic', nameTh: 'เสื้อนักเดินทาง', slot: 'torso', def: 10, level: 5, weight: 35, value: 700, rarity: 'common', sprite: { layer: 'torso', key: 'shirt_brown', gendered: true } }),
  teal_tunic: A({ id: 'teal_tunic', name: 'Scout Tunic', nameTh: 'เสื้อหน่วยสอดแนม', slot: 'torso', def: 12, level: 10, weight: 35, value: 1600, rarity: 'common', stats: { agi: 1 }, sprite: { layer: 'torso', key: 'shirt_teal', gendered: true } }),
  mage_robe: A({ id: 'mage_robe', name: 'Runecloth Robe', nameTh: 'เสื้อคลุมรูน', slot: 'torso', def: 9, mdef: 12, level: 10, weight: 32, value: 2100, rarity: 'common', stats: { int: 2 }, sprite: { layer: 'torso', key: 'shirt_maroon', gendered: true } }),
  leather_vest: A({ id: 'leather_vest', name: 'Leather Vest', nameTh: 'เสื้อหนัง', slot: 'torso', def: 20, level: 16, weight: 90, value: 4400, rarity: 'common', sprite: { layer: 'torso', key: 'leather', gendered: true } }),
  chainmail: A({ id: 'chainmail', name: 'Chainmail', nameTh: 'เกราะโซ่', slot: 'torso', def: 34, level: 28, weight: 220, value: 15000, rarity: 'uncommon', stats: { vit: 2 }, sprite: { layer: 'torso', key: 'chain', gendered: true } }),
  plate_cuirass: A({ id: 'plate_cuirass', name: 'Plate Cuirass', nameTh: 'เกราะอกเหล็กหนา', slot: 'torso', def: 52, level: 45, weight: 380, value: 72000, rarity: 'rare', stats: { vit: 4, str: 2 }, speed: -3, sprite: { layer: 'torso', key: 'plate', gendered: true } }),
  ashguard_plate: A({ id: 'ashguard_plate', name: 'Ashguard Plate', nameTh: 'เกราะเถ้าผู้พิทักษ์', slot: 'torso', def: 74, mdef: 24, level: 62, weight: 400, value: 240000, rarity: 'epic', stats: { vit: 6, str: 3 }, element: 'ember', sprite: { layer: 'torso', key: 'plate', gendered: true } }),

  cloth_pants: A({ id: 'cloth_pants', name: 'Cloth Pants', nameTh: 'กางเกงผ้า', slot: 'legs', def: 5, level: 1, weight: 25, value: 130, rarity: 'common', sprite: { layer: 'legs', key: 'pants_white', gendered: true } }),
  scout_pants: A({ id: 'scout_pants', name: 'Scout Pants', nameTh: 'กางเกงสอดแนม', slot: 'legs', def: 9, level: 10, weight: 30, value: 1200, rarity: 'common', stats: { agi: 1 }, sprite: { layer: 'legs', key: 'pants_teal', gendered: true } }),
  crimson_pants: A({ id: 'crimson_pants', name: 'Crimson Breeches', nameTh: 'กางเกงแดงเลือด', slot: 'legs', def: 12, level: 18, weight: 40, value: 3600, rarity: 'common', stats: { str: 1 }, sprite: { layer: 'legs', key: 'pants_red', gendered: true } }),
  metal_greaves: A({ id: 'metal_greaves', name: 'Metal Greaves', nameTh: 'สนับขาเหล็ก', slot: 'legs', def: 26, level: 32, weight: 170, value: 17000, rarity: 'uncommon', speed: -2, sprite: { layer: 'legs', key: 'metal', gendered: true } }),
  golden_greaves: A({ id: 'golden_greaves', name: 'Gilded Greaves', nameTh: 'สนับขาทองคำ', slot: 'legs', def: 38, mdef: 10, level: 52, weight: 190, value: 96000, rarity: 'rare', stats: { vit: 3 }, sprite: { layer: 'legs', key: 'golden', gendered: true } }),

  worn_boots: A({ id: 'worn_boots', name: 'Worn Boots', nameTh: 'รองเท้าเก่า', slot: 'feet', def: 3, level: 1, weight: 20, value: 110, rarity: 'common', sprite: { layer: 'feet', key: 'shoes_brown', gendered: true } }),
  traveler_boots: A({ id: 'traveler_boots', name: 'Traveler Boots', nameTh: 'รองเท้านักเดินทาง', slot: 'feet', def: 7, level: 12, weight: 28, value: 1900, rarity: 'common', speed: 3, sprite: { layer: 'feet', key: 'shoes_black', gendered: true } }),
  metal_boots: A({ id: 'metal_boots', name: 'Metal Boots', nameTh: 'รองเท้าเหล็ก', slot: 'feet', def: 18, level: 30, weight: 120, value: 13000, rarity: 'uncommon', sprite: { layer: 'feet', key: 'metal', gendered: true } }),
  golden_boots: A({ id: 'golden_boots', name: 'Gilded Boots', nameTh: 'รองเท้าทองคำ', slot: 'feet', def: 28, level: 50, weight: 130, value: 84000, rarity: 'rare', stats: { agi: 2 }, speed: 4, sprite: { layer: 'feet', key: 'golden', gendered: true } }),

  leather_cap: A({ id: 'leather_cap', name: 'Leather Cap', nameTh: 'หมวกหนัง', slot: 'head', def: 6, level: 6, weight: 30, value: 900, rarity: 'common', sprite: { layer: 'head', key: 'leather_cap', gendered: true } }),
  cloth_hood: A({ id: 'cloth_hood', name: 'Cloth Hood', nameTh: 'ฮู้ดผ้า', slot: 'head', def: 4, mdef: 8, level: 6, weight: 25, value: 1100, rarity: 'common', stats: { int: 1 }, sprite: { layer: 'head', key: 'cloth_hood', gendered: true } }),
  chain_coif: A({ id: 'chain_coif', name: 'Chain Coif', nameTh: 'หมวกโซ่', slot: 'head', def: 14, level: 22, weight: 90, value: 6400, rarity: 'common', sprite: { layer: 'head', key: 'chainhat', gendered: true } }),
  metal_helm: A({ id: 'metal_helm', name: 'Metal Helm', nameTh: 'หมวกเหล็ก', slot: 'head', def: 22, level: 36, weight: 150, value: 22000, rarity: 'uncommon', stats: { vit: 2 }, sprite: { layer: 'head', key: 'metal_helm', gendered: true } }),
  golden_helm: A({ id: 'golden_helm', name: 'Gilded Helm', nameTh: 'หมวกทองคำ', slot: 'head', def: 33, mdef: 14, level: 56, weight: 160, value: 112000, rarity: 'rare', stats: { vit: 3, int: 2 }, sprite: { layer: 'head', key: 'golden_helm', gendered: true } }),

  leather_bracers: A({ id: 'leather_bracers', name: 'Leather Bracers', nameTh: 'สนับแขนหนัง', slot: 'hands', def: 5, level: 8, weight: 30, value: 850, rarity: 'common', sprite: { layer: 'hands', key: 'leather_bracers', gendered: true } }),
  metal_gauntlets: A({ id: 'metal_gauntlets', name: 'Metal Gauntlets', nameTh: 'ถุงมือเหล็ก', slot: 'hands', def: 15, level: 30, weight: 110, value: 12500, rarity: 'uncommon', stats: { str: 2 }, sprite: { layer: 'hands', key: 'metal_gloves', gendered: true } }),
  golden_gauntlets: A({ id: 'golden_gauntlets', name: 'Gilded Gauntlets', nameTh: 'ถุงมือทองคำ', slot: 'hands', def: 24, level: 54, weight: 120, value: 92000, rarity: 'rare', stats: { str: 3, dex: 2 }, sprite: { layer: 'hands', key: 'golden_gloves', gendered: true } }),

  // --- ปลายเกม: ของที่เคยไม่มีให้ไล่ล่า -----------------------------------
  // Every slot but the torso stopped in the low fifties while the cap is 70,
  // and the belt had exactly one item in the whole game, at level 4. From 62
  // onward there were three pieces of gear left to want, so refining was the
  // only progression an capped character had. None of this needs new art: the
  // sheets top out at one gilded tier, and `sprite.tint` recolours it.
  studded_belt: A({ id: 'studded_belt', name: 'Studded Belt', nameTh: 'เข็มขัดหมุด', slot: 'belt', def: 6, level: 18, weight: 26, value: 4200, rarity: 'common', weightCapBonus: 340, sprite: { layer: 'belt', key: 'leather', gendered: true, tint: '#7d6a55' } }),
  warband_girdle: A({ id: 'warband_girdle', name: 'Warband Girdle', nameTh: 'เข็มขัดหมู่รบ', slot: 'belt', def: 11, level: 34, weight: 32, value: 21000, rarity: 'uncommon', weightCapBonus: 520, stats: { str: 2 }, sprite: { layer: 'belt', key: 'leather', gendered: true, tint: '#8c3f34' } }),
  rimebound_sash: A({ id: 'rimebound_sash', name: 'Rimebound Sash', nameTh: 'ผ้าคาดเหมันต์', slot: 'belt', def: 16, mdef: 10, level: 50, weight: 30, value: 74000, rarity: 'rare', weightCapBonus: 700, stats: { vit: 2, int: 2 }, sprite: { layer: 'belt', key: 'leather', gendered: true, tint: '#6ea8c8' } }),
  dawnforged_belt: A({ id: 'dawnforged_belt', name: 'Dawnforged Belt', nameTh: 'เข็มขัดตีอรุณ', slot: 'belt', def: 22, mdef: 14, level: 62, weight: 36, value: 175000, rarity: 'epic', weightCapBonus: 900, stats: { str: 3, vit: 3 }, hp: 120, element: 'radiant', sprite: { layer: 'belt', key: 'leather', gendered: true, tint: '#e8c877' } }),

  banded_shield: A({ id: 'banded_shield', name: 'Banded Shield', nameTh: 'โล่รัดเหล็ก', slot: 'offhand', def: 33, level: 30, weight: 150, value: 17000, rarity: 'common', sprite: { layer: 'offhand', key: 'shield', gendered: true, tint: '#8d9199' } }),
  dawnward_aegis: A({ id: 'dawnward_aegis', name: 'Dawnward Aegis', nameTh: 'โล่กำบังอรุณ', slot: 'offhand', def: 68, mdef: 26, level: 63, weight: 240, value: 210000, rarity: 'epic', stats: { vit: 5 }, hp: 200, element: 'radiant', sprite: { layer: 'offhand', key: 'shield', gendered: true, tint: '#f0d08a' } }),

  vow_signet: A({ id: 'vow_signet', name: 'Signet of Vows', nameTh: 'แหวนคำสาบาน', slot: 'accessory', level: 34, weight: 5, value: 32000, rarity: 'rare', refinable: false, stats: { vit: 2, dex: 2 }, hp: 60, sp: 30 }),
  choirbone_torc: A({ id: 'choirbone_torc', name: 'Choirbone Torc', nameTh: 'สร้อยคอกระดูกขับร้อง', slot: 'accessory', level: 64, weight: 7, value: 195000, rarity: 'epic', refinable: false, stats: { int: 4, dex: 3, luk: 2 }, hp: 180, sp: 120, mdef: 18 }),

  dawnplate_helm: A({ id: 'dawnplate_helm', name: 'Dawnplate Helm', nameTh: 'หมวกเกราะอรุณ', slot: 'head', def: 44, mdef: 16, level: 64, weight: 130, value: 190000, rarity: 'epic', stats: { vit: 4, str: 2 }, hp: 140, element: 'radiant', sprite: { layer: 'head', key: 'golden_helm', gendered: true, tint: '#f2d79a' } }),
  dawnplate_greaves: A({ id: 'dawnplate_greaves', name: 'Dawnplate Greaves', nameTh: 'สนับขาอรุณ', slot: 'legs', def: 50, mdef: 16, level: 62, weight: 205, value: 178000, rarity: 'epic', stats: { vit: 4 }, hp: 130, element: 'radiant', sprite: { layer: 'legs', key: 'golden', gendered: true, tint: '#f2d79a' } }),
  dawnplate_sabatons: A({ id: 'dawnplate_sabatons', name: 'Dawnplate Sabatons', nameTh: 'รองเท้าเกราะอรุณ', slot: 'feet', def: 37, mdef: 14, level: 62, weight: 150, value: 152000, rarity: 'epic', stats: { agi: 3, vit: 2 }, hp: 110, element: 'radiant', sprite: { layer: 'feet', key: 'golden', gendered: true, tint: '#f2d79a' } }),
  dawnplate_gauntlets: A({ id: 'dawnplate_gauntlets', name: 'Dawnplate Gauntlets', nameTh: 'ถุงมือเกราะอรุณ', slot: 'hands', def: 33, mdef: 13, level: 64, weight: 120, value: 160000, rarity: 'epic', stats: { str: 3, dex: 2 }, hp: 100, element: 'radiant', sprite: { layer: 'hands', key: 'golden_gloves', gendered: true, tint: '#f2d79a' } }),

  leather_belt: A({ id: 'leather_belt', name: 'Leather Belt', nameTh: 'เข็มขัดหนัง', slot: 'belt', def: 3, level: 4, weight: 20, value: 500, rarity: 'common', weightCapBonus: 200, sprite: { layer: 'belt', key: 'leather', gendered: true } }),

  /* accessories have no sprite layer - they are stat sticks */
  copper_ring: A({ id: 'copper_ring', name: 'Copper Ring', nameTh: 'แหวนทองแดง', slot: 'accessory', level: 5, weight: 5, value: 1200, rarity: 'common', refinable: false, stats: { luk: 1 } }),
  ring_of_focus: A({ id: 'ring_of_focus', name: 'Ring of Focus', nameTh: 'แหวนสมาธิ', slot: 'accessory', level: 20, weight: 5, value: 14000, rarity: 'uncommon', refinable: false, stats: { int: 3 }, sp: 30 }),
  band_of_vigor: A({ id: 'band_of_vigor', name: 'Band of Vigor', nameTh: 'กำไลพละกำลัง', slot: 'accessory', level: 20, weight: 8, value: 14000, rarity: 'uncommon', refinable: false, stats: { str: 3 }, hp: 60 }),
  emberheart_amulet: A({ id: 'emberheart_amulet', name: 'Emberheart Amulet', nameTh: 'จี้หัวใจอังคาร', slot: 'accessory', level: 48, weight: 6, value: 130000, rarity: 'epic', refinable: false, stats: { str: 3, int: 3, vit: 2 }, hp: 150, sp: 60 }),

  /* ================= AMMO ================= */
  wooden_arrow: { id: 'wooden_arrow', name: 'Wooden Arrow', nameTh: 'ลูกธนูไม้', type: 'ammo', ammoFor: 'bow', atk: 3, stack: 2000, weight: 0.2, value: 2, rarity: 'common', sprite: { layer: 'weapon', key: 'arrow', gendered: false } },
  iron_arrow: { id: 'iron_arrow', name: 'Iron Arrow', nameTh: 'ลูกธนูเหล็ก', type: 'ammo', ammoFor: 'bow', atk: 9, stack: 2000, weight: 0.3, value: 7, rarity: 'common', sprite: { layer: 'weapon', key: 'arrow', gendered: false } },
  ember_arrow_item: { id: 'ember_arrow_item', name: 'Ember Arrow', nameTh: 'ลูกธนูไฟ', type: 'ammo', ammoFor: 'bow', atk: 14, element: 'ember', stack: 2000, weight: 0.3, value: 22, rarity: 'uncommon', sprite: { layer: 'weapon', key: 'arrow', gendered: false } },
  frost_arrow_item: { id: 'frost_arrow_item', name: 'Frost Arrow', nameTh: 'ลูกธนูน้ำแข็ง', type: 'ammo', ammoFor: 'bow', atk: 14, element: 'frost', stack: 2000, weight: 0.3, value: 22, rarity: 'uncommon', sprite: { layer: 'weapon', key: 'arrow', gendered: false } },
  storm_arrow_item: { id: 'storm_arrow_item', name: 'Storm Arrow', nameTh: 'ลูกธนูพายุ', type: 'ammo', ammoFor: 'bow', atk: 14, element: 'storm', stack: 2000, weight: 0.3, value: 24, rarity: 'uncommon', sprite: { layer: 'weapon', key: 'arrow', gendered: false } },

  /* ================= CONSUMABLES ================= */
  lesser_salve: C({ id: 'lesser_salve', name: 'Lesser Salve', nameTh: 'ยาสมานเล็ก', heal: 90, cooldown: 4, level: 1, value: 120, rarity: 'common', desc: 'ฟื้น 90 HP - แพงเมื่อเทียบกับรายได้ ใช้ให้คุ้ม' }),
  greater_salve: C({ id: 'greater_salve', name: 'Greater Salve', nameTh: 'ยาสมานใหญ่', heal: 260, cooldown: 6, level: 25, value: 470, rarity: 'common' }),
  mana_draught: C({ id: 'mana_draught', name: 'Mana Draught', nameTh: 'น้ำมานา', healSp: 80, cooldown: 8, level: 10, value: 400, rarity: 'common' }),
  roast_boar: C({ id: 'roast_boar', name: 'Roast Boar Ribs', nameTh: 'ซี่โครงหมูป่าย่าง', heal: 170, regen: { hp: 8, duration: 60 }, cooldown: 30, level: 8, value: 190, rarity: 'common', craftable: true, desc: 'อาหารทำเอง คุ้มกว่าซื้อยา' }),
  // Healing has to keep pace with the health curve, or the last forty levels
  // are played without any usable recovery at all: the greater salve was the
  // best thing in the game from level 25 to 70, by which point it refilled
  // under a fifth of the bar. These are craftable rather than stocked, so
  // late-game recovery stays a sink for drops instead of a coin faucet.
  marrow_tonic: C({ id: 'marrow_tonic', name: 'Marrow Tonic', nameTh: 'ยาไขกระดูก', heal: 300, cooldown: 7, level: 34, value: 950, rarity: 'common', craftable: true }),
  rimewater_flask: C({ id: 'rimewater_flask', name: 'Rimewater Flask', nameTh: 'ขวดน้ำเหมันต์', heal: 450, healSp: 110, cooldown: 8, level: 48, value: 1450, rarity: 'uncommon', craftable: true }),
  vaultlight_philtre: C({ id: 'vaultlight_philtre', name: 'Vaultlight Philtre', nameTh: 'ยาแสงนิรภัย', heal: 580, healSp: 140, cooldown: 8, level: 55, value: 2000, rarity: 'uncommon', craftable: true }),
  dawnblood_draught: C({ id: 'dawnblood_draught', name: 'Dawnblood Draught', nameTh: 'ยาโลหิตอรุณ', heal: 740, healSp: 190, cooldown: 9, level: 62, value: 2900, rarity: 'uncommon', craftable: true }),
  herbal_stew: C({ id: 'herbal_stew', name: 'Herbal Stew', nameTh: 'สตูว์สมุนไพร', heal: 200, healSp: 60, regen: { hp: 6, sp: 4, duration: 90 }, cooldown: 30, level: 12, value: 320, rarity: 'common', craftable: true }),
  antidote: C({ id: 'antidote', name: 'Antidote', nameTh: 'ยาถอนพิษ', cleanse: ['poison'], cooldown: 5, level: 1, value: 150, rarity: 'common' }),
  warp_scroll: C({ id: 'warp_scroll', name: 'Warp Scroll', nameTh: 'ม้วนวาร์ป', warp: 'lastTown', cast: 3, cooldown: 60, level: 1, value: 900, rarity: 'common', desc: 'กลับเมืองล่าสุด - ค่าเดินทางคือหนึ่งในบ่อดูดเงินหลัก' }),
  reliquary_seal: M({
    id: 'reliquary_seal', name: 'Reliquary Seal', nameTh: 'ตราผนึกหีบศพ', value: 4200,
    rarity: 'rare', element: 'radiant',
    desc: 'ตราที่ผนึกหีบศพไว้ ใช้หลอมเป็นน้ำมันศักดิ์สิทธิ์ได้ — หาได้จากหีบศพจมเท่านั้น',
  }),
  shard_dawn: M({ id: 'shard_dawn', name: 'Dawn Shard', nameTh: 'เศษรุ่งอรุณ', value: 8000, rarity: 'rare', desc: 'ใช้ชุบชีวิต และเป็นวัตถุดิบตีบวกขั้นสูง' }),

  /* ================= MATERIALS ================= */
  rat_pelt: M({ id: 'rat_pelt', name: 'Coarse Pelt', nameTh: 'หนังหยาบ', value: 24, rarity: 'common' }),
  boar_tusk: M({ id: 'boar_tusk', name: 'Boar Tusk', nameTh: 'เขี้ยวหมูป่า', value: 70, rarity: 'common' }),
  wolf_fang: M({ id: 'wolf_fang', name: 'Wolf Fang', nameTh: 'เขี้ยวหมาป่า', value: 130, rarity: 'common' }),
  bandit_rope: M({ id: 'bandit_rope', name: 'Frayed Rope', nameTh: 'เชือกขาดรุ่ย', value: 90, rarity: 'common' }),
  bone_chip: M({ id: 'bone_chip', name: 'Bone Chip', nameTh: 'เศษกระดูก', value: 110, rarity: 'common' }),
  orc_tooth: M({ id: 'orc_tooth', name: 'Orc Tooth', nameTh: 'ฟันออร์ค', value: 70, rarity: 'common', desc: 'ของขายทิ้ง - ไม่มีสูตรไหนใช้ จึงตั้งราคาไว้อย่างของขายทิ้งจริงๆ' }),
  ghoul_sinew: M({ id: 'ghoul_sinew', name: 'Ghoul Sinew', nameTh: 'เอ็นผีดิบ', value: 420, rarity: 'uncommon' }),
  ember_cinder: M({ id: 'ember_cinder', name: 'Ember Cinder', nameTh: 'ถ่านอังคาร', value: 900, rarity: 'uncommon', element: 'ember' }),
  frost_tear: M({ id: 'frost_tear', name: 'Frost Tear', nameTh: 'หยาดน้ำแข็ง', value: 900, rarity: 'uncommon', element: 'frost' }),
  storm_quill: M({ id: 'storm_quill', name: 'Storm Quill', nameTh: 'ขนพายุ', value: 950, rarity: 'uncommon', element: 'storm' }),
  herb_bundle: M({ id: 'herb_bundle', name: 'Herb Bundle', nameTh: 'มัดสมุนไพร', value: 45, rarity: 'common' }),
  iron_ore: M({ id: 'iron_ore', name: 'Iron Ore', nameTh: 'แร่เหล็ก', value: 160, rarity: 'common' }),
  steel_ingot: M({ id: 'steel_ingot', name: 'Steel Ingot', nameTh: 'แท่งเหล็กกล้า', value: 750, rarity: 'common', craftable: true }),
  runed_whetstone: M({ id: 'runed_whetstone', name: 'Runed Whetstone', nameTh: 'หินลับรูน', value: 2600, rarity: 'uncommon', desc: 'วัตถุดิบตีบวก +4 ขึ้นไป' }),
  blessing_oil: M({ id: 'blessing_oil', name: 'Blessing Oil', nameTh: 'น้ำมันศักดิ์สิทธิ์', value: 12000, rarity: 'rare', desc: 'กันของหายเมื่อตีบวกล้มเหลว 1 ครั้ง' }),
  skeleton_crown: M({ id: 'skeleton_crown', name: 'Cracked Crown', nameTh: 'มงกุฎร้าว', value: 60000, rarity: 'epic', desc: 'ของจากบอส - มีค่ามากในตลาดผู้เล่น' }),
};

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

export const CARDS = {
  card_husk: CARD({ id: 'card_husk', name: 'Husk Card', nameTh: 'การ์ดซากเถ้า', value: 42000, rarity: 'rare',
    fits: 'weapon', card: { race: { undead: 0.2 } }, desc: 'ดาเมจต่ออันเดด +20%' }),
  card_orc: CARD({ id: 'card_orc', name: 'Orc Card', nameTh: 'การ์ดออร์ค', value: 46000, rarity: 'rare',
    fits: 'weapon', card: { race: { demon: 0.2 }, stats: { str: 2 } }, desc: 'ดาเมจต่อปีศาจ +20% และ STR +2' }),
  card_grub: CARD({ id: 'card_grub', name: 'Stone Grub Card', nameTh: 'การ์ดหนอนหิน', value: 52000, rarity: 'rare',
    fits: 'weapon', card: { size: { large: 0.25 } }, desc: 'ดาเมจต่อเป้าหมายขนาดใหญ่ +25%' }),
  card_moth: CARD({ id: 'card_moth', name: 'Grave Moth Card', nameTh: 'การ์ดผีเสื้อสุสาน', value: 48000, rarity: 'rare',
    fits: 'weapon', card: { size: { small: 0.25 } }, desc: 'ดาเมจต่อเป้าหมายขนาดเล็ก +25%' }),
  card_wight: CARD({ id: 'card_wight', name: 'Frost Wight Card', nameTh: 'การ์ดภูตเยือกแข็ง', value: 64000, rarity: 'epic',
    fits: 'armor', card: { stats: { vit: 3 }, mdef: 12 }, desc: 'VIT +3 และ MDEF +12' }),
  card_stalker: CARD({ id: 'card_stalker', name: 'Hoar Stalker Card', nameTh: 'การ์ดนักล่าเกล็ดน้ำแข็ง', value: 70000, rarity: 'epic',
    fits: 'armor', card: { flee: 14, stats: { agi: 2 } }, desc: 'FLEE +14 และ AGI +2' }),
  card_choir: CARD({ id: 'card_choir', name: 'Choirmaster Card', nameTh: 'การ์ดผู้นำขับร้อง', value: 140000, rarity: 'epic',
    fits: 'any', card: { stats: { int: 4 }, sp: 120 }, desc: 'INT +4 และ SP +120' }),
  card_thrall: CARD({ id: 'card_thrall', name: 'Crown Thrall Card', nameTh: 'การ์ดข้ารับใช้มงกุฎ', value: 160000, rarity: 'epic',
    fits: 'any', card: { stats: { str: 3, vit: 2 }, hp: 160 }, desc: 'STR +3 VIT +2 และ HP +160' }),
  card_warlord: CARD({ id: 'card_warlord', name: 'Warlord Card', nameTh: 'การ์ดจอมทัพ', value: 320000, rarity: 'legendary',
    fits: 'weapon', card: { race: { undead: 0.15, demon: 0.15, beast: 0.15 }, stats: { str: 4 } },
    desc: 'ดาเมจต่ออันเดด/ปีศาจ/สัตว์ร้าย +15% และ STR +4' }),
  card_king: CARD({ id: 'card_king', name: 'Skeleton King Card', nameTh: 'การ์ดราชันโครงกระดูก', value: 380000, rarity: 'legendary',
    fits: 'armor', card: { stats: { vit: 4, int: 3 }, hp: 240, mdef: 18 },
    desc: 'VIT +4 INT +3 HP +240 และ MDEF +18' }),
};
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
export const RECIPES = {
  steel_ingot: { out: { id: 'steel_ingot', qty: 1 }, in: [{ id: 'iron_ore', qty: 3 }], fee: 60, station: 'forge' },
  roast_boar: { out: { id: 'roast_boar', qty: 3 }, in: [{ id: 'boar_tusk', qty: 1 }, { id: 'herb_bundle', qty: 2 }], fee: 40, station: 'campfire' },
  herbal_stew: { out: { id: 'herbal_stew', qty: 3 }, in: [{ id: 'herb_bundle', qty: 4 }, { id: 'rat_pelt', qty: 1 }], fee: 40, station: 'campfire' },
  marrow_tonic: { out: { id: 'marrow_tonic', qty: 3 }, in: [{ id: 'bone_chip', qty: 5 }, { id: 'herb_bundle', qty: 6 }, { id: 'ghoul_sinew', qty: 1 }], fee: 300, station: 'campfire' },
  rimewater_flask: { out: { id: 'rimewater_flask', qty: 3 }, in: [{ id: 'frost_tear', qty: 1 }, { id: 'herb_bundle', qty: 10 }, { id: 'ghoul_sinew', qty: 2 }], fee: 900, station: 'campfire' },
  vaultlight_philtre: { out: { id: 'vaultlight_philtre', qty: 3 }, in: [{ id: 'frost_tear', qty: 2 }, { id: 'herb_bundle', qty: 12 }, { id: 'runed_whetstone', qty: 1 }], fee: 1600, station: 'campfire' },
  dawnblood_draught: { out: { id: 'dawnblood_draught', qty: 3 }, in: [{ id: 'shard_dawn', qty: 1 }, { id: 'herb_bundle', qty: 14 }, { id: 'ember_cinder', qty: 2 }], fee: 2200, station: 'campfire' },
  iron_arrow: { out: { id: 'iron_arrow', qty: 60 }, in: [{ id: 'iron_ore', qty: 2 }], fee: 30, station: 'forge' },
  ember_arrow_item: { out: { id: 'ember_arrow_item', qty: 30 }, in: [{ id: 'iron_arrow', qty: 30 }, { id: 'ember_cinder', qty: 1 }], fee: 120, station: 'forge' },
  frost_arrow_item: { out: { id: 'frost_arrow_item', qty: 30 }, in: [{ id: 'iron_arrow', qty: 30 }, { id: 'frost_tear', qty: 1 }], fee: 120, station: 'forge' },
  storm_arrow_item: { out: { id: 'storm_arrow_item', qty: 30 }, in: [{ id: 'iron_arrow', qty: 30 }, { id: 'storm_quill', qty: 1 }], fee: 120, station: 'forge' },
  runed_whetstone: { out: { id: 'runed_whetstone', qty: 1 }, in: [{ id: 'steel_ingot', qty: 2 }, { id: 'bone_chip', qty: 4 }], fee: 400, station: 'forge' },
  blessing_oil: { out: { id: 'blessing_oil', qty: 1 }, in: [{ id: 'shard_dawn', qty: 1 }, { id: 'runed_whetstone', qty: 2 }], fee: 2500, station: 'forge' },
  blessing_oil_seal: { out: { id: 'blessing_oil', qty: 1 }, in: [{ id: 'reliquary_seal', qty: 6 }], fee: 2000, station: 'forge' },
  // A gear ladder that is drops only is a ladder made of luck. These give the
  // endgame pieces a deterministic path as well, priced in the materials the
  // party dungeon and the weekly boss actually pay out.
  vow_signet: { out: { id: 'vow_signet', qty: 1 }, in: [{ id: 'runed_whetstone', qty: 3 }, { id: 'steel_ingot', qty: 4 }], fee: 9000, station: 'forge' },
  dawnforged_belt: { out: { id: 'dawnforged_belt', qty: 1 }, in: [{ id: 'shard_dawn', qty: 4 }, { id: 'steel_ingot', qty: 8 }, { id: 'runed_whetstone', qty: 3 }], fee: 36000, station: 'forge' },
  dawnward_aegis: { out: { id: 'dawnward_aegis', qty: 1 }, in: [{ id: 'reliquary_seal', qty: 8 }, { id: 'steel_ingot', qty: 12 }, { id: 'shard_dawn', qty: 3 }], fee: 48000, station: 'forge' },
  dawnplate_helm: { out: { id: 'dawnplate_helm', qty: 1 }, in: [{ id: 'reliquary_seal', qty: 6 }, { id: 'steel_ingot', qty: 10 }, { id: 'shard_dawn', qty: 4 }], fee: 42000, station: 'forge' },
  dawnplate_greaves: { out: { id: 'dawnplate_greaves', qty: 1 }, in: [{ id: 'reliquary_seal', qty: 6 }, { id: 'steel_ingot', qty: 10 }, { id: 'shard_dawn', qty: 3 }], fee: 40000, station: 'forge' },
  dawnplate_sabatons: { out: { id: 'dawnplate_sabatons', qty: 1 }, in: [{ id: 'reliquary_seal', qty: 5 }, { id: 'steel_ingot', qty: 8 }, { id: 'shard_dawn', qty: 3 }], fee: 34000, station: 'forge' },
  dawnplate_gauntlets: { out: { id: 'dawnplate_gauntlets', qty: 1 }, in: [{ id: 'reliquary_seal', qty: 5 }, { id: 'steel_ingot', qty: 8 }, { id: 'shard_dawn', qty: 4 }], fee: 36000, station: 'forge' },
  vhaal_warpike: { out: { id: 'vhaal_warpike', qty: 1 }, in: [{ id: 'skeleton_crown', qty: 1 }, { id: 'steel_ingot', qty: 14 }, { id: 'shard_dawn', qty: 6 }], fee: 60000, station: 'forge' },
  hunters_fang: { out: { id: 'hunters_fang', qty: 1 }, in: [{ id: 'steel_ingot', qty: 4 }, { id: 'wolf_fang', qty: 6 }], fee: 1800, station: 'forge' },
  emberfang: { out: { id: 'emberfang', qty: 1 }, in: [{ id: 'hunters_fang', qty: 1 }, { id: 'ember_cinder', qty: 8 }, { id: 'steel_ingot', qty: 6 }], fee: 12000, station: 'forge' },
};

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
