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

  /* ================= CONSUMABLES ================= */
  lesser_salve: C({ id: 'lesser_salve', name: 'Lesser Salve', nameTh: 'ยาสมานเล็ก', heal: 90, cooldown: 4, level: 1, value: 120, rarity: 'common', desc: 'ฟื้น 90 HP - แพงเมื่อเทียบกับรายได้ ใช้ให้คุ้ม' }),
  greater_salve: C({ id: 'greater_salve', name: 'Greater Salve', nameTh: 'ยาสมานใหญ่', heal: 320, cooldown: 6, level: 25, value: 700, rarity: 'common' }),
  mana_draught: C({ id: 'mana_draught', name: 'Mana Draught', nameTh: 'น้ำมานา', healSp: 80, cooldown: 8, level: 10, value: 400, rarity: 'common' }),
  roast_boar: C({ id: 'roast_boar', name: 'Roast Boar Ribs', nameTh: 'ซี่โครงหมูป่าย่าง', heal: 220, regen: { hp: 8, duration: 60 }, cooldown: 30, level: 8, value: 260, rarity: 'common', craftable: true, desc: 'อาหารทำเอง คุ้มกว่าซื้อยา' }),
  herbal_stew: C({ id: 'herbal_stew', name: 'Herbal Stew', nameTh: 'สตูว์สมุนไพร', heal: 140, healSp: 60, regen: { hp: 6, sp: 4, duration: 90 }, cooldown: 30, level: 12, value: 320, rarity: 'common', craftable: true }),
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
  orc_tooth: M({ id: 'orc_tooth', name: 'Orc Tooth', nameTh: 'ฟันออร์ค', value: 260, rarity: 'common' }),
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
  iron_arrow: { out: { id: 'iron_arrow', qty: 60 }, in: [{ id: 'iron_ore', qty: 2 }], fee: 30, station: 'forge' },
  ember_arrow_item: { out: { id: 'ember_arrow_item', qty: 30 }, in: [{ id: 'iron_arrow', qty: 30 }, { id: 'ember_cinder', qty: 1 }], fee: 120, station: 'forge' },
  runed_whetstone: { out: { id: 'runed_whetstone', qty: 1 }, in: [{ id: 'steel_ingot', qty: 2 }, { id: 'bone_chip', qty: 4 }], fee: 400, station: 'forge' },
  blessing_oil: { out: { id: 'blessing_oil', qty: 1 }, in: [{ id: 'shard_dawn', qty: 1 }, { id: 'runed_whetstone', qty: 2 }], fee: 2500, station: 'forge' },
  blessing_oil_seal: { out: { id: 'blessing_oil', qty: 1 }, in: [{ id: 'reliquary_seal', qty: 6 }], fee: 2000, station: 'forge' },
  hunters_fang: { out: { id: 'hunters_fang', qty: 1 }, in: [{ id: 'steel_ingot', qty: 4 }, { id: 'wolf_fang', qty: 6 }], fee: 1800, station: 'forge' },
  emberfang: { out: { id: 'emberfang', qty: 1 }, in: [{ id: 'hunters_fang', qty: 1 }, { id: 'ember_cinder', qty: 8 }, { id: 'steel_ingot', qty: 6 }], fee: 12000, station: 'forge' },
};
