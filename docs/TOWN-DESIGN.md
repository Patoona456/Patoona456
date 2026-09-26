# Town Map Design Guide

This document outlines the design principles and tileset element choices for town-level maps in the 1-20 level progression range.

## Map Dimensions & Character Scale

Character sprites in this game are **64 pixels wide** (LPC standard).
Each map tile is **32 pixels**, meaning characters occupy **2 tiles** in width.

For town maps:
- **Visibility radius**: Characters can see roughly 8-10 tiles in any direction (256-320px)
- **NPC interaction distance**: 1-2 tiles
- **Plaza clearance**: At least 4x4 tiles (128x128px) to accommodate groups

### Recommended Town Sizes
- **Small towns** (starting/satellite): 56x44 tiles = 1,792x1,408 pixels (Millhaven model)
- **Medium towns** (hubs): 64x48 tiles = 2,048x1,536 pixels (Artaris model)  
- **Large towns** (endgame): 72x56 tiles = 2,304x1,792 pixels (not yet implemented)

Smaller towns feel more intimate and manageable for low-level players; larger towns provide more NPCs and services for high-level players.

## Tileset Element Selection

### Include in Town Maps
✓ **GRASS** - Ground base, natural appearance
✓ **PATH** - Roads, walkways, connections between areas
✓ **FLOOR** - Building interiors, stone plazas, carved areas  
✓ **WALL** - Structures, buildings, fences
✓ **WATER** - Decorative wells, fountains, small ponds
✓ **BRIDGE** - Optional, for water features that need crossing

### Exclude from Town Maps
✗ **TREE** - Use sparingly in decor only (via PROP_SETS), not terrain
✗ **ROCK** - Field/wilderness element, clutters town feeling
✗ **SAND** - Beach/desert element, inappropriate for settlement
✗ **SNOW** - Ice cave theme only
✗ **LAVA** - Dangerous cave theme only  
✗ **ASH** - Swamp/crypt theme only
✗ **MOSS** - Marsh theme only
✗ **FLOWER** - Field decoration only

### Theme-Based Variation
Each town declares its `theme` in the map definition. The theme affects:
- **Procedural terrain generation**: Ground tiles chosen based on theme
- **Prop sets**: Random decorative elements suited to setting
- **Atmosphere**: Player expectation of environment

Currently available themes:
- `town` - Generic settlement (used by Artaris, Millhaven)
- `grass` - Wilderness/meadow (used by field maps)
- `marsh` - Swampy terrain (used by Ashfen)
- `rock` - Rocky highlands (used by Orcwatch)
- `crypt` - Underground/dungeon (used by caves)
- `ice` - Frozen cavern (used by Frostvault)
- `ember` - Volcanic battlefield (used by Ashen Lists)

## Layout Principles

### Plaza-First Design
Every town should have a central plaza where key services cluster:
- Central fountain or landmark (visual anchor)
- Ring of important NPCs (vendor, healer, trainer, banker)
- Surrounding market stalls and service buildings
- Lanterns/signposts marking entry/exit points

### Connective Roads
- **Primary road**: Runs N-S or E-W through town center (width: 2-3 tiles)
- **Secondary paths**: Connect plazas to districts (width: 1-2 tiles)
- **Natural edges**: Roads should not form perfect grids (breaking symmetry keeps towns feeling organic)

### Service Districts
Organize by function rather than random placement:
- **Merchant District**: Shops, vendors, market stalls
- **Healer's Quarter**: Healing NPCs, prayer rooms
- **Training Grounds**: Combat trainers, sparring areas
- **Banking/Services**: Storage, market, warping

### Entry/Exit Points
- Warps positioned at town edges (not center)
- Clear visual markers (gates, bridges, signs) at entry points
- Multiple warps to different zones prevent congestion

## NPC Placement Strategy

### Core NPCs (All Towns)
Every town must have at least these services:
1. **Vendor** (role: `vendor`) - Shop common items
2. **Healer** (role: `healer`) - Full heal and cleanse
3. **Trainer** (role: `trainer`) - Job change and stat/skill reset
4. **Banker** (role: `banker`) - Storage vault access
5. **Quest Board** (role: `board`) - Daily/repeatable quests

### Optional NPC Roles
- **Smith** (role: `smith`) - Refine, socket, repair, craft services
- **Broker** (role: `broker`) - Player market access
- **Warper** (role: `warper`) - Premium teleportation
- **Oracle** (role: `oracle`) - Gacha drawing and shard exchange

### Placement Radius
Position NPCs in a rough circle around the central plaza:
- Vendor & healer on opposite sides (E & W)
- Trainer at north entrance (new players come here first)
- Banker & quest board near south/center
- Smith/broker/warper around edges or secondary plazas

Spacing: At least 4-6 tiles between major NPCs to avoid crowding.

## Decor & Atmosphere

### Props (from PROP_SETS)
Towns use this curated set of props:
- `barrel`, `crate`, `lamp`, `bench`, `flowerpot` - Common
- `sign`, `cart`, `banner` - Landmark features  
- (Trees and nature props used sparingly via hand-placed decor)

### Hand-Placed Decor
In addition to procedural props, towns can have carefully positioned decorations:
- Lanterns marking plazas
- Benches for sitting (visual breaks)
- Planters with flowers (non-blocking)
- Trees/bushes at edges (frame the map)
- Barrels/crates near shops
- Signposts at major junctions
- Banners marking town identity

### Generation Density
- **Town prop density**: 0.07 (sparse, keeps visibility clear)
- **Field prop density**: 0.17 (denser, more cluttered feeling)

This ensures towns feel open and navigable while forests/fields feel dense.

## Map Data Example: Millhaven

```javascript
millhaven: {
  id: 'millhaven', name: 'Millhaven', nameTh: 'มิลเฮเวน', 
  kind: 'town',
  width: 56, height: 44, 
  seed: 1002, 
  safe: true, 
  theme: 'town', 
  levelRange: [1, 20],
  spawnPoint: [28, 22],
  warps: [
    { x: 28, y: 41, w: 4, h: 2, to: 'greenmire', at: [40, 8] },
    { x: 52, y: 20, w: 2, h: 4, to: 'ashfen', at: [8, 32] },
  ],
  npcs: [
    // Placed in circle around central plaza
    { id: 'merchant', role: 'vendor', x: 17, y: 16 },
    { id: 'mh_healer', role: 'healer', x: 37, y: 16 },
    { id: 'mh_trainer', role: 'trainer', x: 28, y: 12 },
    { id: 'mh_banker', role: 'banker', x: 28, y: 28 },
    { id: 'mh_board', role: 'board', x: 24, y: 20 },
  ],
  structures: [
    // Hand-placed buildings
    { kind: 'house', x: 12, y: 8, w: 6, h: 4, roof: '#8c4a3a' },
    // ... more buildings ...
    { kind: 'fountain', x: 25, y: 18, w: 4, h: 4 },  // Central landmark
  ],
  decor: [
    // Lanterns, benches, planters, props
    ['lamp', 22, 16], ['lamp', 34, 16],
    ['bench', 20, 16], ['bench', 32, 17],
    // ... more decor ...
  ],
}
```

## Testing & Validation

Before considering a town map complete, verify:
1. **Walkability**: All areas accessible from spawn point
2. **NPC coverage**: Required services present (vendor, healer, trainer, banker, board)
3. **Visual clarity**: Spawn area visible from multiple tile distances
4. **Performance**: Prop count reasonable (goal: <150 props in town proper)
5. **Connection integrity**: Warps have clear visual entry/exit points
6. **Sprite validation**: All NPC and building sprites exist and render correctly

Run the test suite:
```bash
npm test        # General data validation
npm run test:e2e  # Full rendering and connectivity tests
```

## Future Expansion

As you scale the game world, consider:
- **Capital City**: 88x64 tiles, full suite of all NPC types
- **Seasonal Towns**: Temporary or rotating towns for events
- **Guild Towns**: Player-controlled settlements with guild member NPCs
- **Dungeon Hubs**: Small safe zones just before major dungeons (level 18+, 30+, 50+)
