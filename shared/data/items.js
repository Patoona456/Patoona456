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
 * Every item in the game. Empty on purpose: the old set was cleared out to
 * make room for the new item sheet, which is added here piece by piece with
 * the builders above (W weapon, A armour, C consumable, M material, CARD).
 *
 * Systems that name an item by role - the refine stone, the gacha shard, a
 * skill reagent - look it up in KEY_ITEMS and switch themselves off while the
 * item it points at does not exist.
 */
export const ITEMS = {};

/** Items that game systems use by role, not by drop table. */
export const KEY_ITEMS = {
  refineStone: 'runed_whetstone',   // spent on every refine attempt
  refineOil: 'blessing_oil',        // keeps a failed refine from breaking
  gachaShard: 'shard_dawn',         // what a shrine draw costs
  reviveReagent: 'shard_dawn',      // the priest's revive burns one
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
