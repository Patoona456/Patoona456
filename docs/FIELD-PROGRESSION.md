# Field & Dungeon Progression Guide

This document describes the hunting zones, caves, and endgame areas that form the backbone of character progression from level 1 to level 70.

## Zone Hierarchy

### Tier 1: Beginner Fields (Levels 1-20)

#### Greenmire Flats (Levels 1-10)
**Role:** First hunting ground for brand-new players

- **Map Size:** 64×48 tiles (2,048×1,536 pixels)
- **Theme:** Grass meadow with gentle landscape
- **Spawn Point:** Central [40, 8] (north of town warp)
- **Spawn System:** 8 low-tier monster types (~3-4 per type)

**Monster Roster:**
- Slime variants (level 1-3) - weakest, highest spawn density
- Boar family (level 3-5) - slightly tougher, group AI beginning
- Faerie (level 4-8) - introduces magic resistance concept
- Chipped Golem (level 5-8) - first armored enemy type

**Connections:**
- **North:** Millhaven or Emberhold (town return)
- **East:** Ashfen Marsh (progression to mid-tier at level 10+)

**Design Notes:**
- Tight monster levels (1-10 range) keep new players from accidental overlevel
- High spawn density in central grass area for quick loop farming
- Water features provide navigation landmarks
- Multiple exits encourage exploration without getting lost

#### Ashfen Marsh (Levels 10-22)
**Role:** Primary hunting ground for early-mid progression

- **Map Size:** 80×64 tiles (2,560×2,048 pixels)
- **Theme:** Swamp terrain with moss and murky water
- **Spawn Point:** Central [40, 32] (balanced for north/south access)
- **Spawn System:** 10 monster types (~3-4 per type)

**Monster Roster:**
- Toad family (level 10-12) - poison status introduction
- Mosquito swarm (level 11-14) - flying enemies, different AI
- Basilisk (level 12-15) - petrify status, first serious debuff
- Swamp Drowned (level 14-18) - hybrid physical/magic damage
- Bog Walker (level 16-20) - tank-class monsters, high DEF
- Marsh Cultist (level 18-22) - magic-focused, intricate patterns

**Connections:**
- **North:** Millhaven (town return for new players)
- **East:** Gravebound Hollow (cave progression at level 18+)
- **West:** Greenmire Flats (backwards to tutorial area)
- **South:** Ravenholm (capital city access at level 20+)

**Design Notes:**
- Larger zone allows more monster variety and farming variety
- Poison status teaches player debuff awareness early
- Marsh theme visually distinct from starter Greenmire
- Multiple zone connections keep players from feeling linear progression

---

### Tier 2: Mid-Game Zones (Levels 18-45)

#### Gravebound Hollow (Levels 18-32) — Cave Dungeon
**Role:** First dungeon experience, party-friendly

- **Map Size:** 64×64 tiles (2,048×2,048 pixels) 
- **Kind:** Hand-crafted cave (DUNGEON_ROOMS format)
- **Theme:** Crypt with skeletal remains
- **Spawn Point:** [30, 6] (north entrance)
- **Spawn System:** 20 Gravebound-type monsters (skeletal/undead)

**Monster Roster:**
- Skeleton Archer (level 18-20) - ranged threats
- Mummy (level 20-22) - curse status, slow effects
- Bone Golem (level 22-25) - tank variant, high HP
- Wraith (level 25-28) - magic damage, ethereal concept
- Death Knight (level 28-32) - boss-like behavior in packs

**Connections:**
- **North:** Ashfen Marsh (cave entrance from field)
- **East:** Orcwatch Ridge (field progression at level 26+)
- **South:** Orcwatch Ridge (alternative exit)

**Cave Layout:**
- 3 distinct chambers arranged with connecting corridors
- North chamber: skeletal archers (ranged)
- Central chamber: mixed mummy and bone golems
- South chamber: wraiths and death knights (dangerous)
- Each chamber has treasure scatter points for item drops

**Design Notes:**
- First dungeon teaches party coordination importance
- Undead theme visually cohesive (uses crypt tileset exclusively)
- Multiple enemy types encourage varied damage sources (physical, magic)
- Tight corridors create tactical bottlenecks for parties
- Boss-equivalent mobs can appear in south chamber

#### Orcwatch Ridge (Levels 26-45) — Open Field
**Role:** Late-mid progression grinding, wide-open zones

- **Map Size:** 80×64 tiles (2,560×2,048 pixels)
- **Theme:** Rocky highlands with ore deposits
- **Spawn Point:** [8, 8] (southwest entrance from caves)
- **Spawn System:** 12 monster types (~3-4 per type)

**Monster Roster:**
- Orc Scout (level 26-28) - fast attackers, hit-and-run tactics
- Orc Warrior (level 28-32) - physical DPS, straightforward
- Orc Shaman (level 30-35) - heal/buff allies (cooperative AI test)
- Dire Wolf (level 32-38) - chase AI, dangerous alone
- Orc Warlord (level 35-40) - high threat, boss-like behavior
- Stone Giant (level 38-45) - high HP, slow movement
- Magma Elemental (level 40-45) - fire magic, burn damage

**Connections:**
- **South:** Gravebound Hollow (cave entrance)
- **West:** Ravenholm (capital city for services)
- **North:** Frostvault Depths (ice cave at level 40+)

**Design Notes:**
- Orc-themed cohesive monster family (75% of spawns)
- Shaman teaches players about mob cooperation (buffs/heals allies)
- Stone Giant and Magma Elemental introduce elemental weaknesses
- Large open area suits high-level farming and guild PvE activities
- Two exit points reduce congestion during peak hours

---

### Tier 3: Endgame Zones (Levels 40-70)

#### Frostvault Depths (Levels 40-65) — Deep Cave
**Role:** Challenging late-game dungeon, high-value loot

- **Map Size:** 80×80 tiles (2,560×2,560 pixels)
- **Kind:** Hand-crafted dungeon (DUNGEON_ROOMS format)
- **Theme:** Ice cavern with frozen formations
- **Spawn Point:** [14, 14] (entrance from Orcwatch)
- **Spawn System:** 25 Frostvault monsters (ice/elemental themed)

**Monster Roster:**
- Frost Sprite (level 40-42) - ice mage, AoE spells
- Glacial Servant (level 42-45) - physical freeze damage
- Yeti (level 45-50) - boss-equivalent, high HP and ATK
- Winter Wraith (level 50-55) - ethereal ice damage
- Permafrost Guardian (level 55-60) - extreme tank variant
- Glacial Lord (level 60-65) - elite monster, rare spawn

**Connections:**
- **South:** Orcwatch Ridge (field exit/entry)
- **North:** Deeper chambers (internal progression)

**Cave Layout:**
- 4-5 interconnected chambers forming a vertical descent
- Upper chambers: Frost Sprites and Glacial Servants
- Middle chambers: Yeti spawns, challenging battles
- Deep chamber: Winter Wraiths and Permafrost Guardians
- Treasure chambers with ultra-rare item drops

**Design Notes:**
- Ice theme teaches elemental weakness mechanics
- Yeti encounters teach single-boss tactics before Vhaal's Throne
- Multiple player scaling (solo/small party viable)
- Permafrost Guardian serves as difficulty gatekeeper for deeper content
- High monster level variance (40-65) suits group grinding at various tiers

#### Vhaal's Throne (Levels 60-70) — Boss Dungeon
**Role:** Endgame pinnacle dungeon, party-only content

- **Map Size:** 48×48 tiles (1,536×1,536 pixels)
- **Kind:** Hand-crafted boss chamber (DUNGEON_ROOMS)
- **Theme:** Crypt throne room
- **Spawn Point:** [24, 44] (southern entrance)
- **Spawn System:** 1 unique boss + 5 support mob types

**Boss Encounter:**
- **Skeleton King (Vhaal):** Level 65, elite boss with phase mechanics
  - Phase 1: Direct combat with aura
  - Phase 2: Summons throne knights to divide party
  - Phase 3: Chains mechanics linking two players (coordination test)

**Support Mobs:**
- Throne Knight (level 60) - military units, coordinated formations
- Pyre Wisp (level 55) - fire damage, spreads damage around party
- Crown Thrall (level 58) - debuff curses, slows party
- Bone Choirmaster (level 60) - heals/buffs Skeleton King

**Connections:**
- **South:** Frostvault Depths (cave exit)
- Single entry/exit prevents escape mid-fight

**Fight Mechanics:**
- Requires coordinated 6-person party
- Weekly loot lockout per character (prevents farming)
- Runes/shards only drop on first kill of week per player
- Death has consequence (exit arena, re-enter fresh)

**Design Notes:**
- Triple-phase boss teaches mechanics layering
- Support mobs teach "add management" (priority targets)
- Throne Knight AI uses formations (guild coordination)
- Pyre Wisp spreads damage (teaches party positioning)
- Crown Thrall teaches debuff dispel importance
- Chainlink mechanic forces two players into buddy system

---

### Tier X: PvP Zone (Levels 40-70)

#### The Ashen Lists (Levels 40-70) — PvP Arena
**Role:** Guild warfare, tactical player combat

- **Map Size:** 44×44 tiles (1,408×1,408 pixels)
- **Theme:** Ember/volcanic battlefield
- **Spawn Point:** [22, 40] (southern entry)
- **PvP:** True, no EXP loss on death

**Current State:**
- Open field with no obstacles (flagged for future improvement)
- Volcanic theme creates visual distinction from PvE zones
- Single entry/exit point prevents ganking in entry area

**Planned Improvements:**
- Add tactical structures: pillars, lava pits, explosive terrain
- Create flanking routes for strategic positioning
- Add limited-use power-up locations (neutral zone)
- Destructible elements for dynamic battlefield changes

**Design Notes:**
- No EXP or item loss encourages guild participation
- 40+ level restriction prevents twinking/smurfing
- Separate spawn pool (no PvE monsters)
- Solo entry but guild warfare focus creates incentive for teams

---

## Progression Flow

### Level 1-10: Learning Phase
```
Character Creation
    ↓
[Millhaven/Emberhold]
    ↓
Greenmire Flats (tutorial loop)
    ↓
Return to town (healing/training)
    ↓
Level 10 → Job Class Selection
```

### Level 10-20: Tier 1 Mastery
```
Millhaven/Emberhold (base camp)
    ↓
Ashfen Marsh (primary farm)
    ↓
Return to town as needed
    ↓
Consider Greenmire revisit for side content
    ↓
Level 20 → Ready for mid-game
```

### Level 20-30: Transition Phase
```
Decision Point:
├─ Ashfen Marsh (field farming continues)
├─ Gravebound Hollow (cave introduction)
└─ Ravenholm (capital services upgrade)
    ↓
Form small parties (2-4 players)
    ↓
Gravebound becomes primary focus
```

### Level 30-40: Early Endgame
```
Orcwatch Ridge (new field tier)
    ↓
Gravebound Hollow revisit (higher levels)
    ↓
Ravenholm (economic hub)
    ↓
Optional: Ashen Lists PvP (guild activity)
```

### Level 40-70: Endgame Grind
```
Frostvault Depths (primary dungeon)
    ↓
Orcwatch Ridge (secondary farming)
    ↓
Weekly Vhaal's Throne (6-person raid lockout)
    ↓
Ashen Lists (guild warfare)
    ↓
Level 70 → Mastery (repeatable content only)
```

---

## Monster Ecology

### Respawn Mechanics
- **Field zones:** Creatures respawn in 30-60 seconds after death
- **Cave zones:** Creatures respawn in 45-90 seconds (tighter quarters)
- **Spawn density:** 3-4 creatures per type, spread across zone
- **Party scaling:** Monster HP/damage scales with party size (1.2x per extra player)

### Loot Distribution
- **Greenmire/Ashfen:** Common items, low Aurum (gold)
- **Gravebound:** Uncommon items, mid Aurum, rare cards (~0.4%)
- **Orcwatch:** Rare items, good Aurum, elemental cards
- **Frostvault:** Epic items, high Aurum, boss cards (5% drop)
- **Vhaal's Throne:** Legendary items, massive Aurum, guaranteed rare drops

### Monster Stat Progression
- **Health:** Exponential curve (8 HP level 1 → 500+ HP level 65+)
- **Damage:** Linear growth with spikes at elite types
- **Status Effects:** Increase in quantity/duration at higher levels
- **Elemental Resistances:** Introduced at level 20+, scale to tier 3 at level 50+

---

## Zone Safety & Access

### Safe Zones (No PvP)
- All field zones: Greenmire, Ashfen, Orcwatch
- All cave zones: Gravebound, Frostvault, Vhaal's Throne
- Towns: Millhaven, Ravenholm, Emberhold

### PvP Zones
- The Ashen Lists: Voluntary entry, no EXP loss

### Access Level Requirements
| Zone | Min Level | Recommended | Max Scaling |
|------|-----------|------------|------------|
| Greenmire | 1 | 1-8 | 15 |
| Ashfen | 5 | 10-20 | 25 |
| Gravebound | 15 | 18-32 | 40 |
| Orcwatch | 20 | 26-45 | 50 |
| Frostvault | 35 | 40-65 | 70 |
| Vhaal | 55 | 60-70 | 70 |
| Ashen Lists | 40 | 40-70 | 70 |

---

## Technical Features

### Map Generation
- **Terrain:** Seeded Perlin-style noise creates consistent zones across server restarts
- **Monster Spawns:** Deterministic placement based on zone seed
- **Item Drops:** Client-to-server RNG validated, no client trust
- **Warp Points:** All arrival zones verified collision-free (test suite covers this)

### Performance Characteristics
- **Area of Interest (AOI):** Each zone broadcasts to ~8-10 tile visibility radius
- **Update Frequency:** 20 Hz server snapshots, 10 Hz broadcast to clients
- **Monster Pathfinding:** BFS-based (client predictive) + server authoritative
- **Prop Density:** Field zones 0.17 (dense), creating visual clutter; cave zones 0.14 (tactical)

### Network Efficiency
- **Zone Size:** 44×44 to 80×80 tiles balanced for bandwidth efficiency
- **Monster Count:** 20-25 per zone keeps network load manageable
- **Snapshot Size:** ~60-100 KB per snapshot at full population

---

## Future Expansion Ideas

### Regional Content (Levels 50-70)
- **Western Swamp:** Poison-focused monsters, rare toxin cards
- **Eastern Temple:** Holy-element mobs, light damage dealers
- **Southern Fortress:** Military-themed, coordinated humanoid AIs

### Elemental Variants
- **Lava Cavern:** Fire element equivalents of existing zones
- **Storm Peak:** Lightning-based monsters (parallel to ice)
- **Void Abyss:** Shadow element tier 4 content

### Seasonal Events
- **Winter Wonderland:** Temporary ice field with holiday monsters
- **Spring Bloom:** Flower-themed zone with resurrection/rebirth mechanic
- **Summer Beach:** Sandy zone with water-based mobs

### Instanced Dungeons
- **Personal Tower:** Solo progression challenge ladder
- **Guild Halls:** Private spaces for guild-only raid prep
- **Time Rifts:** Weekly rotating boss encounters

---

## Testing & Validation

All zones verified for:
1. **Walkability:** All areas accessible from spawn point without wall-clipping
2. **Monster Distribution:** Spawn points not overlapping, balanced area coverage
3. **Warp Safety:** No arrival points land on other warps or solid objects
4. **Elemental Balance:** Monster type distribution matches level range curve
5. **Performance:** Prop count and monster count tested under load (`npm run load`)

Run zone validation:
```bash
npm test        # General data validation
npm run test:e2e  # Full zone rendering and connectivity tests
npm run balance   # Monster difficulty curve verification
```

---

## Integration with Towns

This zone progression is designed to work seamlessly with the town system:

- **Millhaven:** Hub for levels 1-20 (Greenmire + Ashfen)
- **Ravenholm:** Hub for levels 25-50 (Ashfen + Gravebound + Orcwatch)
- **Emberhold:** Universal hub accessible from any zone at any level
- **Service Loops:** Return to towns for healing, gear repair, market trade

Players naturally flow through zones as they level, with towns providing rest points and economic systems that scale with zone difficulty.
