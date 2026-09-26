// Auto-travel: work out where a quest wants you, and walk there.
//
// Everything here is client side. The server still validates every step of
// the movement it receives, so this is a convenience - the same walk the
// player could do by hand, without the holding down of a direction.
import { TILE } from '../../shared/constants.js';
import { MAPS } from '../../shared/data/maps.js';
import { MONSTERS } from '../../shared/data/monsters.js';
import { findPath } from '../../shared/pathfind.js';

export { findPath };

/** Shortest hop list between two maps, following the warps that connect them. */
export function zoneRoute(fromMap, toMap) {
  if (fromMap === toMap) return [fromMap];
  const seen = new Set([fromMap]);
  let queue = [[fromMap]];
  while (queue.length) {
    const next = [];
    for (const route of queue) {
      const here = route[route.length - 1];
      for (const w of MAPS[here]?.warps ?? []) {
        if (seen.has(w.to)) continue;
        const grown = [...route, w.to];
        if (w.to === toMap) return grown;
        seen.add(w.to);
        next.push(grown);
      }
    }
    queue = next;
  }
  return null;
}

/** The middle of the warp pad in `zone` that leads to `toMap`. */
export function warpTo(zone, toMap) {
  const w = (zone?.warps ?? []).find((x) => x.to === toMap);
  if (!w) return null;
  return { x: (w.x + w.w / 2) * TILE, y: (w.y + w.h / 2) * TILE };
}

/** Which monster a quest item comes from, preferring one that lives here. */
export function sourceOf(itemId, mapId) {
  const here = new Set((MAPS[mapId]?.spawns ?? []).map((s) => s.mob));
  let fallback = null;
  for (const [id, def] of Object.entries(MONSTERS)) {
    if (!(def.drops ?? []).some((d) => d.id === itemId)) continue;
    if (here.has(id)) return id;
    fallback ??= id;
  }
  return fallback;
}

/** Where a given monster is expected to be in a map: its spawn box, or the middle. */
export function huntingGround(mapId, mobId) {
  const map = MAPS[mapId];
  if (!map) return null;
  const sp = (map.spawns ?? []).find((s) => s.mob === mobId);
  if (sp?.area) {
    return { x: (sp.area[0] + sp.area[2] / 2) * TILE, y: (sp.area[1] + sp.area[3] / 2) * TILE };
  }
  if (!sp) return null;
  return { x: (map.width / 2) * TILE, y: (map.height / 2) * TILE };
}

/** The map a monster is native to, for cross-zone routing. */
export function homeOf(mobId) {
  for (const [id, map] of Object.entries(MAPS)) {
    if ((map.spawns ?? []).some((s) => s.mob === mobId)) return id;
  }
  return null;
}
