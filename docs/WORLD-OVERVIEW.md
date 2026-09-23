# Game World Overview

This document provides a complete architectural view of the game world—how towns, zones, and systems interconnect to create a cohesive player progression experience.

## The Three Pillars of World Design

### 1. Towns (Safe Economic Hubs)
**Purpose:** Rest, trading, services, social gathering  
**Key Towns:** Millhaven (1-20), Ravenholm (25-50), Emberhold (all levels)  
**Characteristics:** Safe zones, NPC shops, guild halls, player markets

### 2. Hunting Zones (Progression Challenges)
**Purpose:** Monster combat, leveling, item farming  
**Key Areas:** Greenmire → Ashfen → Gravebound → Orcwatch → Frostvault  
**Characteristics:** Monster spawns, loot drops, level-gated difficulty

### 3. PvP Arenas (Player Combat)
**Purpose:** Guild warfare, competitive ranking, territorial control  
**Key Venues:** Ashen Lists (guild wars), Fortress (weekly siege)  
**Characteristics:** Tactical terrain, zero-consequence combat, coordinate strategy

---

## Complete World Map Topology

```
                    ┌─────────────────┐
                    │ Frostvault Deep │
                    │   (40-65 cave)  │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │ Orcwatch Ridge  │
                    │  (26-45 field)  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
    ┌───┴────┐        ┌──────┴──────┐        ┌────┴───┐
    │Gravebound       │ Ravenholm   │       │Ashfen  │
    │(18-32)          │ (25-50 hub) │       │(10-22) │
    │  cave           │    town     │       │ field  │
    └────┬────┘       └──────┬──────┘       └────┬───┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             │
                    ┌────────┴────────┐
                    │   Emberhold    │
                    │  (all levels,   │
                    │    hub)         │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │  Millhaven      │
                    │  (1-20 town)    │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │ Greenmire Flats │
                    │  (1-10 field)   │
                    └─────────────────┘

    Side Arena:
    ┌──────────────────────┐
    │  Ashen Lists (PvP)   │
    │ (40-70 guild wars)   │
    └──────────────────────┘
```

### Central Hub Architecture

**Emberhold** is the **universal hub**—every player can reach it at any level.

- **From Emberhold:** You can warp to Millhaven (starting experience), Ravenholm (economic center), or any dungeon zone
- **To Emberhold:** All zones have return paths to Emberhold via warps
- **Strategic Benefit:** New players never feel stranded; high-level players can access any content

---

## Level-Based Progression Paths

### New Player Journey (Levels 1-10)

**Day 1-2: Introduction**
```
Character Creation
    ↓ (choose Millhaven or Emberhold)
Town Orientation
    ├─ Visit Vendor (get basic supplies)
    ├─ Talk to Trainer (understand job system)
    └─ Talk to Healer (full heal before first fight)
    ↓
Greenmire Flats (first monster kills)
    ├─ Kill Slimes (levels 1-3)
    ├─ Collect drops (sell for Aurum)
    └─ Return to town (heal, sell, repeat)
    ↓
Level 10 Milestone
    ├─ Talk to Trainer (job class selection)
    ├─ Receive job-specific starter gear
    └─ Gain skill point for new job skills
```

**Playtime:** 2-4 hours  
**Aurum Earned:** 1,000-2,000  
**Next Stage:** Transition to Ashfen Marsh

### Tier 1 Mastery (Levels 10-20)

**Primary Activity: Ashfen Marsh grinding**
```
Ashfen Marsh (optimal farm zone)
    ├─ Kill Toads (level 10-12)
    ├─ Kill Basilisks (level 12-15, learn poison debuff)
    ├─ Fight Swamp Cultists (level 18-22, prep for caves)
    └─ Loot drops (equipment, crafting materials)
    ↓ (every 1-2 hours)
Millhaven Rest & Recovery
    ├─ Sell excess items to Vendor
    ├─ Repair worn equipment at Smith
    ├─ Store valuable items at Banker
    └─ Grab supplies at quest board
    ↓
Ashfen Return
    └─ Repeat cycle
```

**Secondary Activity: First guild quests**
- Guild members team up for 2-3 player Ashfen groups
- Shared loot, split Aurum (more efficient leveling)
- Experience guild chat and coordination

**Playtime:** 8-12 hours  
**Aurum Earned:** 8,000-12,000  
**Next Stage:** Dungeon introduction (Gravebound)

### Mid-Game Transition (Levels 20-30)

**Decision Point: Path Selection**
```
Choice A: Ashfen Marsh Continue
    ├─ Pro: Familiar zone, quick farming
    └─ Con: Slower scaling, weaker gear options

Choice B: Gravebound Hollow (Recommended)
    ├─ Pro: Better loot, cave experience, party quests
    ├─ Con: Requires 2-3 player coordination
    └─ Com: First team-focused milestone

Choice C: Ravenholm Move
    ├─ Pro: Better NPC services (smith, oracle)
    ├─ Con: Zone access not optimal until level 25
    └─ Com: Economic hub advantage
```

**Recommended Route:**
- Levels 20-25: Gravebound Hollow (north chambers, easier skeletons)
- Level 25+: Ravenholm relocation + Gravebound (south chambers, harder wights)
- Parallel: Join guild, participate in weekly wars

**Playtime:** 6-10 hours  
**Aurum Earned:** 12,000-18,000  
**Next Stage:** Open-field grinding (Orcwatch)

### Late-Game Grind (Levels 30-50)

**Primary Activity: Orcwatch Ridge**
```
Orcwatch Ridge (wide-open monster farm)
    ├─ Kill Orc Warriors (levels 28-32)
    ├─ Farm Dire Wolves (levels 32-38, high ATK training)
    ├─ Challenge Orc Warlords (levels 35-40, prep for dungeons)
    └─ Collect rare drops (card farming, refine materials)
    ↓
Ravenholm Hub (economic center)
    ├─ Sell loot in bulk (larger inventory)
    ├─ Access Oracle (gacha for rare items)
    ├─ Store guild loot (shared equipment management)
    └─ Participate in guild wars (PvP practice)
    ↓
Gravebound Hollow Revisit (levels 28-32 section, for cards)
    ├─ Farm specific skeleton types (drop-rate farming)
    └─ Collect quest rewards (weekly resets)
```

**Secondary Activity: Guild Dungeon Raiding**
- 4-6 player parties enter Gravebound
- Coordinate tactics (tank positioning, healer focus)
- Split legendary loot according to guild distribution rules
- Weekly war participation (Sunday 20:00 UTC)

**Playtime:** 20-30 hours  
**Aurum Earned:** 36,000-72,000  
**Next Stage:** Frostvault Deep

### Endgame Challenge (Levels 50-70)

**Primary Activity: Frostvault Deep**
```
Frostvault Depths (elite cave dungeon)
    ├─ Upper Chambers (levels 40-50, loot farming)
    ├─ Mid Chambers (levels 50-60, skill practice)
    └─ Deep Chamber (levels 60-65, near-boss difficulty)
    ↓
Weekly Raid Lockout: Vhaal's Throne
    ├─ Requires 6-person guild party
    ├─ Boss mechanics teach advanced combat
    ├─ Legendary loot (guaranteed weekly reward)
    └─ Limited to one kill per character per week
```

**Secondary Activity: Guild Warfare Ladder**
- Participate in weekly guild wars (Sundays 20:00 UTC)
- Train PvP tactics in Ashen Lists (tactical terrain)
- Compete for Fortress control (siege mechanics)
- Reach seasonal rankings (cosmetic rewards)

**Tertiary Activity: Gear Optimization**
- Refine equipment to +10 or higher
- Embed cards in rare items (permanent bonuses)
- Craft specialized builds for specific bosses
- Exchange rare materials for ultra-rare drops

**Playtime:** 40-80 hours (to level 70)  
**Aurum Earned:** 200,000+ (high-level grinding)  
**Final Milestone:** Level 70 (mastery)

---

## Economic Ecosystems by Zone

### Tier 1 Economy (Millhaven/Greenmire/Ashfen)

| Item Type | Drop Source | Sell Price | Buy Price | Use |
|-----------|------------|-----------|-----------|-----|
| Slime Juice | Slime (level 1) | 20 AU | 100 AU | Potion crafting |
| Boar Tusk | Boar (level 3) | 40 AU | 200 AU | Weapon upgrade |
| Marsh Moss | Toad (level 10) | 60 AU | 300 AU | Armor crafting |
| Basilisk Scale | Basilisk (level 12) | 100 AU | 500 AU | Rare gear |

**Economy Flow:**
1. Beginners kill weak mobs, sell drops (earn startup capital)
2. Vendors buy drops at 5x value (reward exploration)
3. Advanced players buy materials for crafting (value chain)
4. Smiths craft/refine materials into equipment (closes loop)

**Goldfarming Prevention:**
- NPC price dampening (daily sale caps per item)
- High-level farming in low zones (diminished returns)
- No mob drops for players 20+ levels above zone

### Tier 2 Economy (Ravenholm/Gravebound/Orcwatch)

| Item Type | Drop Source | Sell Price | Buy Price | Use |
|-----------|------------|-----------|-----------|-----|
| Spirit Shard | Wraith (level 25) | 500 AU | 2,500 AU | Boss summoning |
| Orc Helmet | Orc Warrior (level 28) | 800 AU | 4,000 AU | Armor set |
| Stone Core | Stone Giant (level 38) | 1,200 AU | 6,000 AU | Refine materials |
| Warlord's Axe | Orc Warlord (level 35) | 2,000 AU | 10,000 AU | Legendary quest |

**Economy Flow:**
1. Mid-tier players farm specific mobs (target drops)
2. Brokers sell high-value items (player-to-player market)
3. Crafters combine materials (multi-step recipes)
4. Oracle offers gacha (sink for excess Aurum)

**Market Dynamics:**
- Supply fluctuates based on guild activity
- Popular farming times = price crashes (competition)
- Off-peak times = prices spike (scarcity)
- Guilds coordinate farming to stabilize markets

### Tier 3 Economy (Frostvault/Vhaal)

| Item Type | Drop Source | Sell Price | Buy Price | Use |
|-----------|------------|-----------|-----------|-----|
| Eternal Ice | Permafrost Guardian | 5,000 AU | 25,000 AU | Legendary craft |
| Vhaal's Bones | Skeleton King | 10,000 AU | 50,000 AU | Quest item |
| Glacial Sword | Boss drop | 15,000 AU | 75,000 AU | End-game DPS |
| Aurora Rune | Weekly boss reward | — | 100,000 AU | Cosmetic only |

**Economy Flow:**
1. Elite players farm at guild level (6-person raids)
2. Legendary items become social status (not just stats)
3. Aurum becomes secondary currency (actual wealth = rare items)
4. Player market dominates (80% trading is player-to-player)

**Balance Mechanisms:**
- Weekly boss lockouts (prevent infinite grinding)
- Rune shards (cosmetic currency, gold sink)
- Guild maintenance costs (redistribute accumulated wealth)

---

## Service Coverage by Zone

### All Tiers Offered

| Service | Millhaven | Ravenholm | Emberhold |
|---------|-----------|-----------|-----------|
| Healing | ✓ | ✓ | ✓ |
| Equipment Vendor | ✓ | ✓ | ✓ |
| Refining/Smithing | ✓ | ✓ | ✓ |
| Job Change Trainer | ✓ | ✓ | ✓ |
| Storage/Vault | ✓ | ✓ | ✓ |
| Quest Board | ✓ | ✓ | ✓ |
| Warping | ✓ | ✓ | ✓ |
| Player Market | ✓ | ✓ | ✓ |

### Tier-Specific Services

| Service | Millhaven | Ravenholm | Emberhold |
|---------|-----------|-----------|-----------|
| Oracle/Gacha | — | ✓ | ✓ |
| Guild Hall | — | ✓ | ✓ |
| Admin Dashboard | — | ✓ | — |

---

## Seasonal Content & Events

### Year-Round Activities
- **Daily Quests:** Refreshed at 00:00 UTC (40-60 AU reward each)
- **Weekly Bosses:** Locked at first kill (legendary gear drop)
- **Guild Wars:** Sundays 20:00 UTC (siege mechanics)
- **Seasonal Quests:** Rotated every 2 weeks (limited-time rewards)

### Holiday Events (Planned)
- **Winter Solstice:** Frost-themed dungeon, ice equipment cosmetics
- **Spring Equinox:** Blooming field zone, life-steal card drops
- **Summer Festival:** Beach zone, water-based bosses
- **Autumn Harvest:** Harvest moon zone, crop-themed loot

---

## Social Systems & Integration

### Guild Progression
```
Level 1 Guild (5 members)
    ├─ Basic: Chat, party grouping
    └─ Benefit: +1% EXP (stacking)
         ↓
Level 5 Guild (25 members)
    ├─ Unlock: Guild dungeons, ranks
    ├─ Unlock: Guild storage (shared items)
    └─ Benefit: +2% EXP (stacking)
         ↓
Level 10 Guild (50 members)
    ├─ Unlock: Guild wars, fortress siege
    ├─ Unlock: Guild hall customization
    └─ Benefit: +3% EXP, +2% Gold farming
         ↓
Level 15 Guild (100+ members)
    ├─ Unlock: Seasonal events
    ├─ Unlock: Legendary guild banner
    └─ Benefit: +5% EXP, +5% Gold, weekly boss lockout immunity
```

### Party Systems
- **Solo:** Farm alone, slower XP but full loot
- **Duo:** Shared XP (95% each, 190% total to incentivize)
- **3-Player Party:** 90% each (270% total), optimal leveling
- **6-Player Raid:** 80% each (480% total), boss fights only
- **Guild War:** No XP scaling (pure PvP mechanics)

---

## Progression Velocity

### Expected Timeline (Average Player)

| Milestone | Hours | Playstyle |
|-----------|-------|-----------|
| Level 10 | 2-4 | Casual grinding |
| Level 20 | 8-12 | Farm + guild quests |
| Level 30 | 16-24 | Party dungeons |
| Level 40 | 24-36 | Guild warfare |
| Level 50 | 36-54 | Frostvault farming |
| Level 60 | 54-80 | Boss raids + PvP |
| Level 70 | 80-120 | Endgame mastery |

**Note:** Casual players take 3-6 months to reach level 70; hardcore players (8 hrs/day) reach it in 2-3 weeks.

---

## Future World Expansion

### Tier 4: Sky City (Levels 50+ endgame)
- **Floating island** above the world
- **Sky dungeons** (aerial combat zones)
- **Celestial bosses** (mythology-themed)
- **Ancient library** (lore/story repository)

### Regional Capitals (Tier 2 alternatives)
- **Western Port:** Trade-focused, merchant guilds
- **Eastern Temple:** Holy magic, priest training
- **Southern Fortress:** Military, warrior stronghold

### Instanced Dungeons
- **Personal Tower:** Solo progression challenge
- **Guild Halls:** Private raid practice spaces
- **Time Rifts:** Weekly rotating limited-time dungeons

---

## World Design Philosophy

### Core Principles

1. **Coherent Progression:** No dead ends—every zone leads forward
2. **Emergent Gameplay:** Terrain (pillars, lava) matters as much as stats
3. **Economic Depth:** Multiple paths to power (farming, crafting, trading, PvP)
4. **Social Incentives:** Leveling together beats solo leveling faster
5. **Respectful Time:** No infinite grinds; weekly lockouts respect playtime

### Design Decisions

- **Town Hubs:** Safe zones prevent death-run anxiety
- **Multiple Zones per Level:** Player choice (Ashfen vs. Gravebound at level 20)
- **Level Caps per Zone:** Prevent power-creep (level 20 cap in Ashfen)
- **Weekly Bosses:** Encourage repeated visits, not one-and-done farming
- **Guild Wars:** Competitive without PvE content gatekeeping

---

## Conclusion

The game world is designed as a **three-pillar system**: towns for rest, dungeons for growth, and PvP for competition. Each system feeds into the others (loot powers leveling, levels enable PvP, PvP rewards improve town services). No single path dominates—a farmer, a raider, and a warrior can all prosper at their own pace.

The world is **alive** because all three pillars work in concert.
