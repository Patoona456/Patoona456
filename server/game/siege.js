// The fortress the guilds fight over.
//
// A guild in this game already costs 250,000 to found and 40,000 a week to
// keep, and until now it bought a chat channel and a shared bag. That is a
// standing bill for a social convenience, and it is why the roadmap has
// listed "guilds have nothing to fight over" as known debt since they were
// built: people do not keep showing up on Thursday for a bag.
//
// So there is one fortress, in the one zone where players may attack each
// other, and it is contested on a schedule everyone can read off a clock:
//
//   The window opens on Sunday and runs for an hour. Outside it the throne
//   cannot be touched at all, which means a guild in one timezone cannot take
//   it while another sleeps - everybody's Sunday edge is the same UTC instant.
//
//   Inside the window, standing on the throne with no rival standing on it
//   fills a bar. Fill it and your guild holds the fortress. The bar resets
//   when a rival contests it, so holding is about keeping the floor clear,
//   not about arriving first.
//
//   The guild that owns it when the window shuts keeps it until the next one,
//   and pays no upkeep that week. That is the prize: not a coin faucet, which
//   would make the strongest guild richer forever, but relief from a drain
//   every other guild is still paying. The economy loses nothing it was not
//   already losing, and the reward is still worth organising an evening for.
import { db, markDirty } from '../persistence.js';
import * as Guild from './guild.js';

// The fort's map. The old arena it stood in is gone with the old maps; until
// a new one is drawn there is no zone by this name, and the siege sleeps
// (world.js skips it when the zone is missing).
export const SIEGE_MAP = 'ashen_lists';
/** Where the throne stands, in tiles, and how close counts as standing on it. */
export const THRONE = { x: 22, y: 14, r: 96 };
/** Sunday, 20:00 UTC, for one hour. */
export const WINDOW = { day: 0, hour: 20, minutes: 60 };
/** What members of the holding guild gain, on top of the waived upkeep. */
export const HOLDER_EXP_BONUS = 0.05;
/** Seconds of uncontested standing needed to take it. */
export const CAPTURE_SECONDS = 90;

const state = () => (db.siege ??= { owner: null, since: 0, holder: null, progress: 0, window: null });

/** Which weekly window an instant falls in, or null between them. */
export function windowKey(at = Date.now()) {
  const d = new Date(at);
  if (d.getUTCDay() !== WINDOW.day) return null;
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), WINDOW.hour, 0, 0);
  if (at < start || at >= start + WINDOW.minutes * 60000) return null;
  return new Date(start).toISOString().slice(0, 13);
}

/** When the next window opens, so the client can show a countdown. */
export function nextWindowAt(at = Date.now()) {
  const d = new Date(at);
  const ahead = (WINDOW.day - d.getUTCDay() + 7) % 7;
  let start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + ahead, WINDOW.hour, 0, 0);
  if (start <= at) start += 7 * 86400000;
  return start;
}

/** The guild that owns the fortress right now, or null. */
export function owner() {
  const id = state().owner;
  return id ? Guild.byId(id) : null;
}

/** Owning the fortress waives the week's upkeep - see chargeUpkeep. */
export function waivesUpkeep(guildId) {
  return state().owner != null && String(state().owner) === String(guildId);
}

/**
 * One tick of the siege, driven by the zone that holds the throne.
 *
 * Returns an event to broadcast, or null. Everything it decides is derived
 * from who is standing where: there is no command to capture, so there is
 * nothing to spoof.
 */
export function tick(zone, at = Date.now()) {
  const s = state();
  const key = windowKey(at);

  if (!key) {
    // Between windows the bar is not just paused, it is thrown away: a guild
    // should not bank fifty seconds from last Sunday.
    if (s.window !== null) {
      s.window = null; s.holder = null; s.progress = 0;
      markDirty();
      return { t: 'siege', phase: 'closed', owner: s.owner };
    }
    return null;
  }

  if (s.window !== key) {
    s.window = key; s.holder = null; s.progress = 0;
    markDirty();
    return { t: 'siege', phase: 'open', owner: s.owner, seconds: CAPTURE_SECONDS };
  }

  // Who is on the throne, by guild.
  const onIt = new Map();
  for (const p of zone.players.values()) {
    if (!p.alive) continue;
    const g = p.record?.guild;
    if (!g) continue;
    const dx = p.x - THRONE.x * 32, dy = p.y - THRONE.y * 32;
    if (dx * dx + dy * dy > THRONE.r * THRONE.r) continue;
    onIt.set(String(g), (onIt.get(String(g)) ?? 0) + 1);
  }

  if (onIt.size !== 1) {
    // Empty, or contested by more than one guild: nobody makes progress.
    if (s.holder !== null || s.progress !== 0) {
      s.holder = null; s.progress = 0;
      markDirty();
      return onIt.size > 1 ? { t: 'siege', phase: 'contested' } : null;
    }
    return null;
  }

  const [gid] = [...onIt.keys()];
  if (s.holder !== gid) { s.holder = gid; s.progress = 0; }
  s.progress += 1;
  markDirty();

  if (s.progress >= CAPTURE_SECONDS && String(s.owner) !== gid) {
    s.owner = gid;
    s.since = at;
    const g = Guild.byId(gid);
    return { t: 'siege', phase: 'taken', owner: gid, name: g?.name ?? '?' };
  }
  return null;
}

/** What the client shows: who holds it, and when it can next be taken. */
export function status(at = Date.now()) {
  const s = state();
  const g = owner();
  return {
    map: SIEGE_MAP,
    throne: THRONE,
    owner: g ? { id: g.id, name: g.name } : null,
    since: s.since,
    open: windowKey(at) != null,
    nextAt: nextWindowAt(at),
    need: CAPTURE_SECONDS,
    progress: windowKey(at) ? s.progress : 0,
    holder: windowKey(at) ? s.holder : null,
  };
}
