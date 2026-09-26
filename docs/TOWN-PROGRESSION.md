# Town Progression Guide

This document describes the three-tier town system designed to support player progression from level 1 to level 50.

## Town Hierarchy

### Tier 1: Millhaven (Levels 1-20)
**Role:** Intimate starting settlement for new players

- **Map Size:** 80×64 tiles (2,560×2,048 pixels)
- **Theme:** Cozy frontier town with clear districts
- **Spawn Point:** Central plaza [40, 32]
- **Safe Zone:** Yes

#### Districts:
1. **North:** Merchant & Blacksmith district (quaint shops)
2. **Central:** Services hub with fountain and plaza
3. **South:** Lodging & Commerce (inn, market)

#### Key Features:
- **Central Fountain:** Beautiful plaza centerpiece, warp hub
- **River Aesthetic:** Water features frame the landscape
- **Lantern Rings:** Mark service districts clearly
- **Market Stalls:** Row of 4 independent market stalls

#### NPCs & Services:
| Service | NPC | Role | Notes |
|---------|-----|------|-------|
| General Shop | Merchant | vendor | General supplies for new players |
| Refining/Crafting | Smith | smith | Basic equipment services |
| Healing | Healer | healer | Health/cleanse services |
| Job Change | Trainer | trainer | Class selection at level 10 |
| Storage | Banker | banker | Item vault access |
| Quests | Board | board | Daily/repeatable content |
| Warping | Warper | warper | Travel (premium) |
| Trading | Broker | broker | Player-to-player market |

#### Connections:
- **South Exit:** Greenmire Flats (level 1-10 field) - safe zone for new players
- **East Exit:** Ashfen Marsh (level 10-22 field) - mid-tier hunting
- **West Exit:** Ravenholm (level 25-50 capital) - next tier progression

#### Design Decisions:
- Smaller size keeps new players from feeling overwhelmed
- Clear, intuitive layout reduces navigation confusion
- Services clustered for easy access
- Water features add visual interest without cluttering
- Fewer NPCs = simpler economies to manage

---

### Tier 2: Ravenholm (Levels 25-50)
**Role:** Grand capital city for mid-to-late game

- **Map Size:** 88×72 tiles (2,816×2,304 pixels)
- **Theme:** Prosperous kingdom capital with grand architecture
- **Spawn Point:** Central plaza [44, 36]
- **Safe Zone:** Yes

#### Districts:
1. **North:** High-end merchant & legendary blacksmith (tier 2 gear)
2. **Central:** Grand plaza with twin fountains, training temple
3. **South:** Guild hall, oracle shrine (mystical services)

#### Key Features:
- **Twin Fountains:** Dual water landmarks in plaza corners
- **Grand Lantern Rings:** Multiple concentric lamp arrays
- **Market Rows:** Three dedicated marketplace zones
- **Wide Plazas:** Room for guild activities, PvP, social gatherings
- **Temple Architecture:** Training grounds & oracle shrine

#### NPCs & Services:
| Service | NPC | Role | Notes |
|---------|-----|------|-------|
| Advanced Shop | Merchant (town) | vendor | Mid-tier items |
| Legendary Smith | Smith (town) | smith | Advanced refinement, tier 2 gear |
| Combat Training | Trainer (town) | trainer | Re-spec and advanced training |
| Cleansing | Healer (town) | healer | Premium healing services |
| Vault Storage | Banker (town) | banker | Expanded storage tiers |
| Guild Operations | Board | board | Guild management quests |
| Premium Travel | Warper (town) | warper | High-speed warp network |
| Market Hub | Broker (town) | broker | Player market (high volume) |
| Fate & Fortunes | Oracle | oracle | Gacha system, Dawn Shards |

#### Connections:
- **South Exit:** Ashfen Marsh (level 10-22) - hunting grounds
- **East Exit:** Gravebound Hollow (level 18-32 cave) - mid-tier dungeon
- **West Exit:** Millhaven (level 1-20) - return to starter town
- **North Exit:** Orcwatch Ridge (level 26-45) - late-game field

#### Design Decisions:
- Grander architecture suits mid-tier player progression
- More NPCs = complex economies, player interaction hubs
- Twin fountains symbolize balance and duality
- Multiple warp points reduce congestion
- Guild hall placement encourages community gameplay
- Oracle shrine represents endgame content gateways

---

### Tier 3: Artaris (Hub/All Levels)
**Role:** Central universal hub connecting all zones

- **Map Size:** 64×48 tiles (2,048×1,536 pixels)
- **Theme:** Established trade hub
- **Spawn Point:** South of fountain [32, 28]
- **Safe Zone:** Yes

#### Purpose:
- **Universal Access:** Connection point to all major zones
- **Economic Hub:** Central marketplace for all player tiers
- **Guild Capital:** Fortress & siege system
- **PvP Arena Access:** Gateway to Ashen Lists

#### Design Note:
Artaris serves as the **world hub** - players of any level can reach any zone from here. Designed for versatility rather than tier-specific progression.

---

## Progression Path

### New Player Journey (Level 1-10):

1. **Millhaven** or **Artaris** (pick at character creation)
   - Learn combat basics
   - Farm starter gear
   - Access job change trainer (at level 10)
   - Participate in low-tier quests

2. **Greenmire Flats** (level 1-10 field)
   - First hunting ground
   - Safe north spawn zone
   - Returns to Millhaven for healing/restocking

### Early Progression (Level 10-20):

1. **Millhaven** (home base)
   - Refined equipment from smith
   - Full healing services
   - Storage management

2. **Ashfen Marsh** (level 10-22 field)
   - Mid-tier monsters (10-15)
   - Return to Millhaven/Artaris between sessions
   - Build experience for level 10 job class

### Mid-Game Transition (Level 20-30):

1. **Artaris** OR **Ravenholm** (hub choice)
   - Artaris: Traditional central hub (all zones accessible)
   - Ravenholm: Advanced capital (better services, more NPCs)

2. **Ashfen Marsh** → **Gravebound Hollow**
   - Graduate to cave dungeons
   - First party-optional content
   - Better loot tiers

### Late Game (Level 30-50):

1. **Ravenholm** (primary hub)
   - Advanced services: high-end refining, oracle
   - Guild operations
   - Market hub activity

2. **Gravebound** → **Orcwatch** → **Frostvault**
   - Cave & field progression
   - Boss encounters
   - Party dungeons (Reliquary at 60+)

3. **Ashen Lists** (optional)
   - PvP-only zone
   - Guild warfare
   - Siege mechanics

---

## Town Design Principles

### 1. Scale & Visibility
- Characters are 64px (2 tiles wide)
- Visibility radius: ~8-10 tiles
- Plaza sizes accommodate groups

### 2. Districts & Navigation
- Clear functional zones (merchant, healer, training, etc)
- Landmark features (fountains, lanterns) for orientation
- Logical NPC placement (grouped by service type)

### 3. Progression Signaling
- **Millhaven:** Cozy, intimate (signifies "starting zone")
- **Ravenholm:** Grand, organized (signifies "advancement")
- **Artaris:** Central hub (signifies "connection point")

### 4. Visual Density
- Town density: 0.07 props/tile (sparse, clear sightlines)
- Market clutter creates commerce atmosphere
- Water features add life without clutter

### 5. Service Availability

| Service | Tier 1 | Tier 2 | Hub |
|---------|--------|--------|-----|
| General Shop | ✓ | ✓ | ✓ |
| Blacksmith | ✓ | ✓ | ✓ |
| Healing | ✓ | ✓ | ✓ |
| Training | ✓ | ✓ | ✓ |
| Storage | ✓ | ✓ | ✓ |
| Quests | ✓ | ✓ | ✓ |
| Warping | ✓ | ✓ | ✓ |
| Market/Broker | ✓ | ✓ | ✓ |
| Oracle/Gacha | - | ✓ | ✓ |
| Guild Hall | - | ✓ | ✓ |

---

## Map Connections (Updated)

```
    NORTH: Orcwatch (level 26-45)
         |
    RAVENHOLM (level 25-50 capital)
    /    |    \
MILL    |    GRAVE (level 18-32 cave)
haven   |
(1-20)  ASHFEN (level 10-22 marsh)
    \    |    /
    ARTARIS (hub - all levels)
         |
      GREENMIRE (level 1-10 field)
```

**Detailed Warp Network:**
- Millhaven ↔ Greenmire (new players loop)
- Millhaven ↔ Ashfen (progression to mid-tier)
- Millhaven ↔ Ravenholm (tier advancement)
- Ravenholm ↔ Orcwatch (late-game)
- Ravenholm ↔ Gravebound (dungeon access)
- Artaris ↔ All major zones (universal hub)

---

## Future Expansion Possibilities

### Tier 4: Sky City (Levels 50+)
- Size: 96×80 tiles
- Theme: Floating ancient city
- Services: Ultimate-tier smithing, celestial library, legendary quests

### Regional Capitals:
- **Western Port:** Trade town, merchant-focused
- **Eastern Temple:** Spiritual hub, holy magic
- **Southern Fortress:** Military base, warrior training

### Seasonal Towns:
- **Winter Lodge:** Holiday-themed, temporary decorations
- **Spring Festival:** Celebration hub, limited-time events
- **Summer Camp:** Outdoor gathering, camping aesthetic

### Guild Towns:
- Player-controllable settlement
- Custom buildings/decorations
- Governance mechanics

---

## Technical Notes

### Character Creation Starting Point
Players now choose their starting town:
- **Artaris** (classic hub): Fast access to all zones
- **Millhaven** (intimate): Focused early-game experience

### Warp Pad Safety
- All arrival points verified to not land on warp pads
- Circular buffer around spawn and warp points
- Test: `nobody arrives standing on a warp pad` (194/194 passing)

### NPC Dialog System
- Each NPC must have dialog defined by role
- Roles: vendor, smith, healer, trainer, banker, board, warper, broker, oracle
- Each role offers unique interaction options

### Tileset Elements Used
- ✓ GRASS, PATH, FLOOR, WALL, WATER, BRIDGE (town-appropriate)
- ✗ TREE, ROCK, SAND, SNOW, LAVA, ASH, MOSS, FLOWER (reserved for fields/caves)
