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
// Fifteen slots, described one place: shared/slots.js. Re-exported here
// because half the game already imports its constants from this file.
export { SLOTS, SLOT_INFO, NEW_SLOTS, slotName } from './slots.js';

/** Elements (rock-paper-scissors style, our own table) -------------------- */
export const ELEMENTS = ['neutral', 'fire', 'ice', 'lightning', 'earth', 'wind', 'holy', 'dark'];

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
//
// Eight elements, named after the art sheets so that nothing needs a
// translation table between what a thing looks like and what it does.
//
// Five of them run in one cycle, which is the part players have to learn:
//
//     fire > wind > earth > lightning > ice > fire
//
// Each beats the next at 1.5x and loses to it at 0.75x, and every element is
// weak against itself at 0.5x, so a fire sword is the wrong tool for a fire
// monster no matter how refined it is.
//
// Holy and dark sit outside the cycle and only answer each other, hard: 1.9x
// and 1.75x across, 0.25x into themselves. That pair is the spine of the
// endgame - the last thirty levels are dark, and a holy weapon is the answer
// to them - so it is deliberately the sharpest edge in the table.
export const ELEMENT_TABLE = {
  neutral:   { neutral: 1.00, fire: 1.00, ice: 1.00, lightning: 1.00, earth: 1.00, wind: 1.00, holy: 1.00, dark: 0.70 },
  fire:      { neutral: 1.00, fire: 0.50, ice: 0.75, lightning: 1.00, earth: 1.00, wind: 1.50, holy: 0.90, dark: 1.00 },
  wind:      { neutral: 1.00, fire: 0.75, ice: 1.00, lightning: 1.00, earth: 1.50, wind: 0.50, holy: 0.90, dark: 1.00 },
  earth:     { neutral: 1.00, fire: 1.00, ice: 1.00, lightning: 1.50, earth: 0.50, wind: 0.75, holy: 0.90, dark: 1.00 },
  lightning: { neutral: 1.00, fire: 1.00, ice: 1.50, lightning: 0.50, earth: 0.75, wind: 1.00, holy: 0.90, dark: 1.00 },
  ice:       { neutral: 1.00, fire: 1.50, ice: 0.50, lightning: 0.75, earth: 1.00, wind: 1.00, holy: 0.90, dark: 1.00 },
  holy:      { neutral: 1.00, fire: 1.00, ice: 1.00, lightning: 1.00, earth: 1.00, wind: 1.00, holy: 0.25, dark: 1.90 },
  dark:      { neutral: 1.10, fire: 1.00, ice: 1.00, lightning: 1.00, earth: 1.00, wind: 1.00, holy: 1.75, dark: 0.25 },
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
  SHOP_BUYBACK: 'shopBuyback',
  STORAGE_MOVE: 'storageMove',
  MARKET_LIST: 'marketList',
  STALL_OPEN: 'stallOpen',
  STALL_CLOSE: 'stallClose',
  STALL_BROWSE: 'stallBrowse',
  STALL_BUY: 'stallBuy',
  MARKET_POST: 'marketPost',
  MARKET_BUY: 'marketBuy',
  MARKET_CANCEL: 'marketCancel',
  SOCKET: 'socket',
  REFINE: 'refine',
  REPAIR: 'repair',
  PARTY: 'party',
  GUILD: 'guild',
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
  GUILD_STATE: 'guildState',
  TRADE_STATE: 'tradeState',
  QUEST_STATE: 'questState',
  DIED: 'died',
  PONG: 'pong',
};

/** Chat channels --------------------------------------------------------- */
export const CHANNELS = ['say', 'party', 'trade', 'world', 'system'];

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
