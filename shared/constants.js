// Shared between the authoritative server and the browser client.
// Keep this file dependency-free: it is imported by Node and by the browser.

export const GAME_NAME = 'Emberfall Online';
export const PROTOCOL_VERSION = 1;

/** World geometry ------------------------------------------------------- */
export const TILE = 32;              // logical tile size in world pixels
export const SPRITE = 64;            // LPC frame size
export const SHEET_COLS = 13;
export const SHEET_ROWS = 21;

/** Simulation ----------------------------------------------------------- */
export const TICK_HZ = 20;
export const TICK_MS = 1000 / TICK_HZ;
export const SNAPSHOT_HZ = 10;
export const AOI_RADIUS = 20 * TILE; // area of interest for snapshots

/** Movement ------------------------------------------------------------- */
export const BASE_MOVE_SPEED = 108;  // px/s at AGI 1, before modifiers
export const MAX_MOVE_SPEED = 260;

/** Directions (matches LPC row order inside an animation group) ---------- */
export const DIR = { UP: 0, LEFT: 1, DOWN: 2, RIGHT: 3 };
export const DIR_VECTORS = [
  [0, -1], [-1, 0], [0, 1], [1, 0],
];

/** LPC animation table --------------------------------------------------- */
export const ANIM = {
  spellcast: { row: 0, frames: 7, fps: 12 },
  thrust:    { row: 4, frames: 8, fps: 14 },
  walk:      { row: 8, frames: 9, fps: 10 },
  slash:     { row: 12, frames: 6, fps: 14 },
  shoot:     { row: 16, frames: 13, fps: 16 },
  hurt:      { row: 20, frames: 6, fps: 8, single: true },
  idle:      { row: 8, frames: 1, fps: 1 },
};

/** Equipment slots ------------------------------------------------------- */
export const SLOTS = ['weapon', 'offhand', 'head', 'torso', 'hands', 'legs', 'feet', 'belt', 'accessory', 'wings'];

/** Elements (rock-paper-scissors style, our own table) -------------------- */
export const ELEMENTS = ['neutral', 'ember', 'frost', 'storm', 'verdant', 'shade', 'radiant'];

/**
 * How far above you a monster has to be before it stops minding its own
 * business. Anything more than this many levels over a player hunts them on
 * sight, whether or not its definition says `aggressive`.
 *
 * This is the fence around the level bands. Without it a level 5 character
 * can walk to the ice fields, stand next to something that would kill them
 * in one hit, and loot whatever a passing party leaves behind. With it, the
 * high zones push back on their own and the map teaches its own order.
 */
export const LEVEL_AGGRO_GAP = 10;

// ELEMENT_TABLE[attack][defense] = damage multiplier.
export const ELEMENT_TABLE = {
  neutral: { neutral: 1.00, ember: 1.00, frost: 1.00, storm: 1.00, verdant: 1.00, shade: 0.70, radiant: 1.00 },
  ember:   { neutral: 1.00, ember: 0.50, frost: 1.75, storm: 1.00, verdant: 1.50, shade: 1.00, radiant: 0.90 },
  frost:   { neutral: 1.00, ember: 1.50, frost: 0.50, storm: 1.25, verdant: 0.75, shade: 1.00, radiant: 0.90 },
  storm:   { neutral: 1.00, ember: 1.00, frost: 0.75, storm: 0.50, verdant: 1.50, shade: 1.10, radiant: 0.90 },
  verdant: { neutral: 1.00, ember: 0.75, frost: 1.25, storm: 0.75, verdant: 0.50, shade: 1.10, radiant: 0.90 },
  shade:   { neutral: 1.10, ember: 1.00, frost: 1.00, storm: 1.00, verdant: 1.00, shade: 0.25, radiant: 1.75 },
  radiant: { neutral: 1.00, ember: 1.00, frost: 1.00, storm: 1.00, verdant: 1.00, shade: 1.90, radiant: 0.25 },
};

/** Currency -------------------------------------------------------------- */
// One hard currency only: Aurum (AU). It is deliberately scarce, see docs/ECONOMY.md
export const CURRENCY = { code: 'AU', name: 'Aurum', nameTh: 'ออรัม' };

/** Progression ----------------------------------------------------------- */
export const MAX_BASE_LEVEL = 99;
export const MAX_JOB_LEVEL = 50;
export const STAT_CAP = 99;

/** Sizes / races used by damage cards ------------------------------------ */
export const SIZES = ['small', 'medium', 'large'];
export const RACES = ['human', 'beast', 'undead', 'demon', 'plant', 'spirit'];

/** Networking op codes --------------------------------------------------- */
export const OP = {
  // client -> server
  HELLO: 'hello',
  LOGIN: 'login',
  REGISTER: 'register',
  CHAR_LIST: 'charList',
  CHAR_CREATE: 'charCreate',
  CHAR_DELETE: 'charDelete',
  ENTER: 'enter',
  INPUT: 'input',
  ATTACK: 'attack',
  TARGET: 'target',
  SKILL: 'skill',
  PICKUP: 'pickup',
  USE_ITEM: 'useItem',
  EQUIP: 'equip',
  UNEQUIP: 'unequip',
  DROP_ITEM: 'dropItem',
  CHAT: 'chat',
  ALLOC_STAT: 'allocStat',
  LEARN_SKILL: 'learnSkill',
  SET_HOTBAR: 'setHotbar',
  NPC_INTERACT: 'npcInteract',
  NPC_ACTION: 'npcAction',
  SHOP_BUY: 'shopBuy',
  SHOP_SELL: 'shopSell',
  STORAGE_MOVE: 'storageMove',
  MARKET_LIST: 'marketList',
  MARKET_POST: 'marketPost',
  MARKET_BUY: 'marketBuy',
  MARKET_CANCEL: 'marketCancel',
  REFINE: 'refine',
  REPAIR: 'repair',
  PARTY: 'party',
  TRADE: 'trade',
  WARP: 'warp',
  RESPAWN: 'respawn',
  QUEST: 'quest',
  PING: 'ping',

  // server -> client
  WELCOME: 'welcome',
  ERROR: 'error',
  NOTICE: 'notice',
  CHARS: 'chars',
  SPAWN: 'spawn',        // full state for the controlled character
  ZONE: 'zone',          // map payload
  SNAPSHOT: 'snapshot',
  EVENT: 'event',        // combat text, level up, ...
  SELF: 'self',          // authoritative state of own character
  INVENTORY: 'inventory',
  SKILLS: 'skills',
  CHAT_MSG: 'chatMsg',
  NPC_DIALOG: 'npcDialog',
  SHOP: 'shop',
  STORAGE: 'storage',
  MARKET: 'market',
  PARTY_STATE: 'partyState',
  TRADE_STATE: 'tradeState',
  QUEST_STATE: 'questState',
  DIED: 'died',
  PONG: 'pong',
};

/** Chat channels --------------------------------------------------------- */
export const CHANNELS = ['say', 'party', 'trade', 'world', 'system'];

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
