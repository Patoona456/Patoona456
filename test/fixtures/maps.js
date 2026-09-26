// The zones the game had before its painted maps, kept for the tests of the
// systems built on them - the party door and the dungeon (reliquary1-3), the
// weekly boss (vhaal), pathfinding in a cave (gravebound), the warp service
// (millhaven, orcwatch) - until new maps carry those systems. Importing this
// puts them back into MAPS; the game itself does not have them.
import { MAPS } from '../../shared/data/maps.js';

export const LEGACY_MAPS = {
  millhaven: {
    id: 'millhaven', name: 'Millhaven', nameTh: 'มิลเฮเวน', kind: 'town',
    width: 80, height: 64, seed: 1002, safe: true, theme: 'town', levelRange: [1, 20],
    spawnPoint: [40, 32],
    warps: [
      { x: 40, y: 61, w: 4, h: 2, to: 'greenmire', at: [87, 7], label: 'ทุ่งกรีนไมร์' },
      { x: 76, y: 32, w: 2, h: 4, to: 'ashfen', at: [8, 32], label: 'หนองเถ้า' },
      { x: 2, y: 32, w: 2, h: 4, to: 'ravenholm', at: [4, 36], label: 'เรเวนโฮล์ม' },
      { x: 38, y: 2, w: 4, h: 2, to: 'artaris', at: [86, 30], label: 'อาร์ทาริส' },
    ],
    npcs: [
      // North district (Merchant area)
      { id: 'merchant', name: 'ผู้ค้าร็อก', role: 'vendor', x: 20, y: 14, shop: 'general', look: { pic: 'grocer' } },
      { id: 'mh_smith', name: 'ช่างตีเหล็กกอร์ด', role: 'smith', x: 60, y: 14, look: { pic: 'blacksmith' } },
      // Central plaza (Services)
      { id: 'mh_healer', name: 'พยาบาลแมร์', role: 'healer', x: 40, y: 24, look: { pic: 'florist' } },
      { id: 'mh_trainer', name: 'มาสเตอร์ ยูเร', role: 'guide', x: 40, y: 18, look: { pic: 'ranger' } },
      { id: 'mh_banker', name: 'คำนายตัง', role: 'banker', x: 40, y: 40, look: { pic: 'grandma' } },
      { id: 'mh_board', name: 'กระดานภารกิจ', role: 'board', x: 36, y: 28, look: { pic: 'postman' } },
      { id: 'mh_warper', name: 'นักท่องเที่ยวเลิน', role: 'warper', x: 44, y: 28, look: { pic: 'traveller' } },
      { id: 'mh_broker', name: 'นายหน้าวิลเลียม', role: 'broker', x: 20, y: 50, look: { pic: 'catgirl' } },
    ],
    spawns: [],
    structures: [
      // North zone: merchant & blacksmith
      { kind: 'house', x: 12, y: 8, w: 8, h: 5, roof: '#8c4a3a', sign: 'ร้านค้า' },
      { kind: 'house', x: 56, y: 8, w: 8, h: 5, roof: '#6d4a3a', sign: 'โรงตีเหล็ก' },
      // Central zone: services
      { kind: 'house', x: 32, y: 6, w: 6, h: 4, roof: '#5a6a8c', sign: 'ศาลาฝึก' },
      { kind: 'house', x: 32, y: 36, w: 6, h: 4, roof: '#4a7a6a', sign: 'คลัง' },
      { kind: 'house', x: 44, y: 36, w: 6, h: 4, roof: '#7a6a4a', sign: 'ตลาด' },
      // South zone: inns & guild
      { kind: 'house', x: 12, y: 44, w: 7, h: 5, roof: '#8c7a3a', sign: 'โรงแรม' },
      { kind: 'house', x: 56, y: 44, w: 7, h: 5, roof: '#6a5a8c', sign: 'สมาคม' },
      // Stalls & decorative
      { kind: 'stall', x: 28, y: 24, w: 3, h: 2, variant: 0 },
      { kind: 'stall', x: 48, y: 24, w: 3, h: 2, variant: 1 },
      { kind: 'stall', x: 20, y: 32, w: 3, h: 2, variant: 2 },
      { kind: 'stall', x: 57, y: 32, w: 3, h: 2, variant: 3 },
      // Central fountain
      { kind: 'fountain', x: 37, y: 26, w: 6, h: 6 },
      // Water feature: river running through
      { kind: 'fountain', x: 5, y: 20, w: 3, h: 3 },
      { kind: 'fountain', x: 72, y: 44, w: 4, h: 4 },
    ],
    decor: [
      // Lantern rings around plaza and zones
      ['lamp', 32, 20], ['lamp', 48, 20], ['lamp', 32, 36], ['lamp', 48, 36],
      ['lamp', 14, 14], ['lamp', 66, 14], ['lamp', 14, 50], ['lamp', 66, 50],
      // Benches around plaza
      ['bench', 35, 22], ['bench', 45, 22], ['bench', 35, 38], ['bench', 45, 38],
      // Planters scattered
      ['planter', 38, 16], ['planter', 42, 16], ['planter', 40, 44],
      ['planter', 20, 30], ['planter', 60, 30],
      // Market clutter: barrels, crates, sacks
      ['barrel', 18, 14], ['barrel', 62, 14], ['crate', 22, 12], ['crate', 64, 12],
      ['sack', 20, 16], ['sack', 66, 18], ['cart', 16, 50], ['cart', 64, 50],
      ['barrel', 18, 50], ['barrel', 68, 50], ['crate', 14, 48], ['crate', 70, 48],
      // Signs and banners at entry points
      ['banner', 35, 60], ['banner', 45, 60], ['sign', 2, 32], ['sign', 78, 32],
      ['sign', 40, 10], ['banner', 14, 40], ['banner', 66, 40],
      // Well features
      ['well', 10, 22], ['well', 70, 46],
      // Trees framing edges (sparse)
      ['tree', 8, 10], ['tree', 72, 10], ['tree', 8, 54], ['tree', 72, 54],
    ],
  },

  ravenholm: {
    id: 'ravenholm', name: 'Ravenholm', nameTh: 'เรเวนโฮล์ม', kind: 'town',
    width: 88, height: 72, seed: 1003, safe: true, theme: 'town', levelRange: [25, 50],
    spawnPoint: [44, 36],
    warps: [
      { x: 44, y: 69, w: 4, h: 2, to: 'ashfen', at: [40, 8], label: 'หนองเถ้า' },
      { x: 84, y: 36, w: 2, h: 4, to: 'gravebound', at: [12, 36], label: 'สุสานกราฟบาวด์' },
      { x: 2, y: 36, w: 2, h: 4, to: 'millhaven', at: [4, 32], label: 'มิลเฮเวน' },
      { x: 44, y: 4, w: 4, h: 2, to: 'orcwatch', at: [44, 12], label: 'สันเขาออร์ควอช' },
    ],
    npcs: [
      // North district: High-end shops
      { id: 'rh_vendor', name: 'ผู้ค้าเมืองอลฮัลลา', role: 'vendor', x: 24, y: 16, shop: 'general', look: { pic: 'chef' } },
      { id: 'rh_smith', name: 'หลักแรงแห่งเรเวนโฮล์ม', role: 'smith', x: 64, y: 16, look: { pic: 'dwarf' } },
      // Central North: Training & jobs
      { id: 'rh_trainer', name: 'คุณพ่อแก่วยืนกราน', role: 'guide', x: 44, y: 12, look: { pic: 'swordmaiden' } },
      // Central plaza: Services
      { id: 'rh_healer', name: 'บาทหลวงอิเรน', role: 'healer', x: 24, y: 36, look: { pic: 'maid' } },
      { id: 'rh_banker', name: 'ผู้เฝ้าธนคลังแองเชล', role: 'banker', x: 64, y: 36, look: { pic: 'panda' } },
      { id: 'rh_board', name: 'กระดานภารกิจหลัก', role: 'board', x: 35, y: 32, look: { pic: 'postman' } },
      { id: 'rh_warper', name: 'พ่อค้ารถบัสเสน', role: 'warper', x: 48, y: 32, look: { pic: 'witch' } },
      // East: Guild & broker
      { id: 'rh_broker', name: 'สำนักนายหน้าตรึนดัล', role: 'broker', x: 75, y: 37, look: { pic: 'rogue' } },
      // South district: Oracle & premium services
      { id: 'rh_oracle', name: 'สูตรนางกายา', role: 'oracle', x: 20, y: 56, look: { pic: 'princess' } },
    ],
    spawns: [],
    structures: [
      // North zone: High-end merchant & blacksmith
      { kind: 'house', x: 8, y: 8, w: 10, h: 6, roof: '#8c4a3a', sign: 'บ้านค้าหลัก' },
      { kind: 'house', x: 56, y: 8, w: 10, h: 6, roof: '#6d4a3a', sign: 'โรงเชื่อมแชมเบอร์' },
      // Central north: Training temple
      { kind: 'house', x: 36, y: 4, w: 8, h: 5, roof: '#5a6a8c', sign: 'วิหารสงคราม' },
      // Central: Service buildings
      { kind: 'house', x: 8, y: 30, w: 10, h: 7, roof: '#4a7a6a', sign: 'ศาสตร์สงคราม' },
      { kind: 'house', x: 70, y: 30, w: 10, h: 7, roof: '#7a6a4a', sign: 'สมาคมพ่อค้า' },
      // South zone: Guild hall & Oracle shrine
      { kind: 'house', x: 8, y: 50, w: 12, h: 7, roof: '#8c7a3a', sign: 'สมาคมสามัญ' },
      { kind: 'house', x: 68, y: 50, w: 12, h: 7, roof: '#6a5a8c', sign: 'ศาลรุ่งอรุณ' },
      // Marketplace stalls: Three rows
      { kind: 'stall', x: 30, y: 24, w: 4, h: 2, variant: 0 },
      { kind: 'stall', x: 54, y: 24, w: 4, h: 2, variant: 1 },
      { kind: 'stall', x: 30, y: 44, w: 4, h: 2, variant: 2 },
      { kind: 'stall', x: 54, y: 44, w: 4, h: 2, variant: 3 },
      // Central fountain plaza
      { kind: 'fountain', x: 38, y: 28, w: 8, h: 8 },
      // Water features: Twin ponds
      { kind: 'fountain', x: 14, y: 20, w: 4, h: 4 },
      { kind: 'fountain', x: 70, y: 20, w: 4, h: 4 },
    ],
    decor: [
      // Grand lantern setup: Inner circle
      ['lamp', 36, 24], ['lamp', 52, 24], ['lamp', 36, 44], ['lamp', 52, 44],
      // Outer lantern ring
      ['lamp', 18, 16], ['lamp', 70, 16], ['lamp', 18, 56], ['lamp', 70, 56],
      // Zone markers
      ['lamp', 14, 36], ['lamp', 74, 36],
      // Benches at plazas
      ['bench', 34, 20], ['bench', 54, 20], ['bench', 34, 48], ['bench', 54, 48],
      ['bench', 40, 28], ['bench', 48, 28], ['bench', 40, 44], ['bench', 48, 44],
      // Planters: abundant greenery
      ['planter', 42, 12], ['planter', 46, 12], ['planter', 40, 52], ['planter', 48, 52],
      ['planter', 20, 24], ['planter', 68, 24], ['planter', 20, 48], ['planter', 68, 48],
      // Market scene: chaos of commerce
      ['barrel', 16, 16], ['barrel', 72, 16], ['barrel', 16, 56], ['barrel', 72, 56],
      ['crate', 20, 14], ['crate', 76, 14], ['crate', 20, 58], ['crate', 76, 58],
      ['sack', 14, 20], ['sack', 74, 20], ['sack', 14, 52], ['sack', 74, 52],
      ['cart', 12, 36], ['cart', 76, 36], ['awning', 32, 28], ['awning', 56, 28],
      // Signage at main entrances
      ['banner', 40, 62], ['banner', 48, 62], ['sign', 2, 36], ['sign', 86, 36],
      ['banner', 40, 2], ['sign', 44, 68],
      // Wells as gathering points
      ['well', 20, 28], ['well', 68, 28], ['well', 44, 16],
      // Trees framing perimeter
      ['tree', 6, 12], ['tree', 82, 12], ['tree', 6, 60], ['tree', 82, 60],
      ['bush', 10, 8], ['bush', 78, 8], ['bush', 10, 64], ['bush', 78, 64],
    ],
  },

  ashfen: {
    id: 'ashfen', name: 'Ashfen Marsh', nameTh: 'หนองเถ้า', kind: 'field',
    width: 80, height: 64, seed: 3003, theme: 'marsh', levelRange: [10, 22],
    spawnPoint: [8, 32],
    warps: [
      { x: 2, y: 30, w: 2, h: 4, to: 'greenmire', at: [45, 56], label: 'ทุ่งกรีนไมร์' },
      { x: 76, y: 38, w: 2, h: 4, to: 'artaris', at: [3, 30], label: 'อาร์ทาริส' },
      { x: 40, y: 60, w: 4, h: 2, to: 'gravebound', at: [30, 6], label: 'สุสานกราฟบาวด์' },
    ],
    spawns: [],
  },

  gravebound: {
    id: 'gravebound', name: 'Gravebound Hollow', nameTh: 'สุสานกราฟบาวด์', kind: 'cave',
    width: 72, height: 72, seed: 4004, theme: 'crypt', levelRange: [18, 32],
    spawnPoint: [30, 6],
    warps: [
      { x: 28, y: 2, w: 4, h: 2, to: 'ashfen', at: [40, 56], label: 'หนองเถ้า' },
      { x: 60, y: 64, w: 4, h: 2, to: 'orcwatch', at: [8, 8], label: 'สันเขาออร์ควอช' },
    ],
    spawns: [],
  },

  orcwatch: {
    id: 'orcwatch', name: 'Orcwatch Ridge', nameTh: 'สันเขาออร์ควอช', kind: 'field',
    width: 88, height: 72, seed: 5005, theme: 'rock', levelRange: [26, 45],
    spawnPoint: [8, 8],
    warps: [
      { x: 4, y: 4, w: 4, h: 2, to: 'gravebound', at: [60, 60], label: 'สุสานกราฟบาวด์' },
      { x: 82, y: 60, w: 4, h: 4, to: 'frostvault', at: [14, 14], label: 'ห้องนิรภัยเยือกแข็ง' },
    ],
    spawns: [],
  },

  frostvault: {
    id: 'frostvault', name: 'Frostvault Depths', nameTh: 'ห้องนิรภัยเยือกแข็ง', kind: 'cave',
    width: 80, height: 80, seed: 6006, theme: 'ice', levelRange: [40, 60],
    spawnPoint: [14, 14],
    warps: [
      { x: 6, y: 6, w: 4, h: 4, to: 'orcwatch', at: [78, 58], label: 'สันเขาออร์ควอช' },
      { x: 70, y: 70, w: 4, h: 4, to: 'vhaal', at: [24, 41], label: 'ห้องบัลลังก์วาล' },
      { x: 8, y: 70, w: 4, h: 4, to: 'reliquary1', at: [9, 24], label: 'หีบศพจม (ปาร์ตี้ 2 คน)' },
    ],
    spawns: [],
  },

  /* ---------------- The Sunken Reliquary: a party dungeon, three floors ----
     Hand-drawn rather than generated. Corridors are two tiles wide so a
     party moves in file and the person in front is the person who gets hit,
     and every hall has pillars: cover to break line of sight, and something
     the monsters' pathfinding has to actually solve. */
  reliquary1: {
    id: 'reliquary1', name: 'Sunken Reliquary - Cloister', nameTh: 'หีบศพจม - ระเบียงคด',
    kind: 'dungeon', width: 64, height: 48, seed: 8001, theme: 'crypt', levelRange: [60, 70],
    party: 2,                       // the door will not open for fewer
    spawnPoint: [9, 24],
    warps: [
      { x: 4, y: 22, w: 3, h: 4, to: 'frostvault', at: [13, 71], label: 'ห้องนิรภัยเยือกแข็ง' },
      { x: 58, y: 22, w: 3, h: 4, to: 'reliquary2', at: [9, 30], label: 'ชั้นสอง — ห้องสวด' },
    ],
    rooms: [
      { x: 3, y: 20, w: 9, h: 9 },                       // entry
      { x: 18, y: 8, w: 16, h: 14, pillars: 4 },         // north hall
      { x: 18, y: 28, w: 16, h: 14, pillars: 4 },        // south hall
      { x: 40, y: 18, w: 18, h: 14, pillars: 5 },        // west approach
    ],
    halls: [
      { from: [12, 23], to: [18, 13] },
      { from: [12, 24], to: [18, 33] },
      { from: [33, 14], to: [40, 23] },
      { from: [33, 34], to: [40, 25] },
      { from: [25, 21], to: [25, 29], vfirst: true },    // a shortcut between halls
    ],
    spawns: [],
  },
  reliquary2: {
    id: 'reliquary2', name: 'Sunken Reliquary - Choir', nameTh: 'หีบศพจม - ห้องสวด',
    kind: 'dungeon', width: 64, height: 64, seed: 8002, theme: 'crypt', levelRange: [62, 70],
    party: 2,
    spawnPoint: [9, 30],
    warps: [
      { x: 4, y: 28, w: 3, h: 4, to: 'reliquary1', at: [55, 24], label: 'ชั้นหนึ่ง — ระเบียงคด' },
      { x: 57, y: 30, w: 3, h: 4, to: 'reliquary3', at: [26, 52], label: 'ชั้นสาม — ห้องหีบ' },
    ],
    rooms: [
      { x: 4, y: 26, w: 8, h: 9 },
      { x: 16, y: 6, w: 14, h: 12, pillars: 4 },
      { x: 16, y: 44, w: 14, h: 14, pillars: 4 },
      { x: 24, y: 24, w: 18, h: 14, pillars: 6 },        // the long room, most of the fight
      { x: 46, y: 26, w: 12, h: 12, pillars: 4 },
    ],
    halls: [
      { from: [12, 29], to: [24, 29] },
      { from: [22, 17], to: [30, 25], vfirst: true },
      { from: [22, 43], to: [30, 36], vfirst: true },
      { from: [41, 30], to: [46, 30] },
      { from: [52, 37], to: [52, 44], vfirst: true },
      { from: [30, 44], to: [52, 44] },
    ],
    hazards: [
      { x: 33, y: 29, w: 4, h: 4, tile: 'LAVA' },        // the brazier pit in the middle
    ],
    spawns: [],
  },
  reliquary3: {
    id: 'reliquary3', name: 'Sunken Reliquary - Vault', nameTh: 'หีบศพจม - ห้องหีบ',
    kind: 'dungeon', width: 52, height: 60, seed: 8003, theme: 'crypt', levelRange: [64, 70],
    party: 2,
    spawnPoint: [26, 52],
    warps: [
      { x: 24, y: 55, w: 4, h: 3, to: 'reliquary2', at: [54, 31], label: 'ชั้นสอง — ห้องสวด' },
    ],
    rooms: [
      { x: 22, y: 50, w: 8, h: 8 },                      // the way in
      { x: 10, y: 10, w: 32, h: 32, pillars: 8 },        // the arena: wide, four pillars
    ],
    halls: [
      { from: [25, 49], to: [25, 42], vfirst: true },
    ],
    spawns: [],
  },

  // The only ground in the world where players may swing at each other, and
  // the only way in is a door you walk through on purpose. Opting in by
  // geography rather than by a toggle means nobody is ever jumped in a field
  // they went to for experience, and the fortress the guilds contest sits
  // here, so the siege and the duelling ground are the same place.
  ashen_lists: {
    id: 'ashen_lists', name: 'The Ashen Lists', nameTh: 'ลานประลองเถ้า',
    width: 44, height: 44, seed: 4411, theme: 'ember', levelRange: [40, 70],
    pvp: true,
    spawnPoint: [22, 40],
    warps: [{ x: 20, y: 41, w: 4, h: 2, to: 'artaris', at: [76, 5], label: 'อาร์ทาริส' }],
    spawns: [],
  },

  vhaal: {
    id: 'vhaal', name: "Vhaal's Throne", nameTh: 'ห้องบัลลังก์วาล', kind: 'boss',
    width: 48, height: 48, seed: 7007, theme: 'crypt', levelRange: [60, 70],
    spawnPoint: [24, 44],
    warps: [{ x: 22, y: 45, w: 4, h: 2, to: 'frostvault', at: [70, 68], label: 'ห้องนิรภัยเยือกแข็ง' }],
    spawns: [],
  },
};

for (const [id, m] of Object.entries(LEGACY_MAPS)) if (!MAPS[id]) MAPS[id] = m;
