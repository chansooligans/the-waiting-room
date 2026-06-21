// Hospital floor plan. Used for every level — different rooms become
// "active" depending on currentLevel via NPC placement filters and
// the per-level dialogue overrides in content/dialogue.ts.
//
// Layout intent:
//
//   NORTH (level 1-3 — orientation, registration, prior auth)
//     - LOBBY at the south-center (player spawn).
//     - L-shaped CORRIDOR exits north toward the MAIN HUB at the top.
//     - PATIENT SVC and REGISTRATION branch off the corridor.
//     - ELIGIBILITY hangs off Registration (sub-room).
//     - PRIOR AUTH GATE sits east of the Main Hub behind a LOCKED door.
//
//   SOUTH WING (level 4-10)
//     - HIM (Health Information Mgmt / coding)
//     - BILLING (claim queue / clearinghouse)
//     - PFS (Patient Financial Services / phone bank)
//     - LAB (pathology / micro — clinical-support overflow at the SE
//             corner; reached via the SW trough extended east past PFS)
//   (AUDIT used to live here — moved up to the second floor as part
//   of the "summoned to the top" reading: above = decisions, ground =
//   labor, below = where things go to die.)
//
//   EAST WING (atmosphere — explorable rooms, no level-specific cases)
//     - RADIOLOGY (imaging — referenced in some L4+ dialogue)
//     - PHARMACY  (formulary / dispense)
//     - MEDICAL RECORDS (chart room — overflow from HIM)
//   The east wing is reached via Registration's east door and a short
//   corridor to a vertical trunk that runs the length of the wing.
//
//   OUTDOOR — parking lot off the lobby. Reached via an 'O' teleport
//   tile inside the lobby (not a continuous corridor). Sparse for now;
//   to be filled with ambient NPCs (smoker, taxi-cab, security) later.
//
//   SECOND FLOOR — exec / compliance / payer interface.
//     - LANDING_2F (small foyer where the stairs deposit you)
//     - AUDIT (relocated)
//     - PAYER (the Aetna/Anthem-equivalent office; the missing fifth
//             actor from the intro's "Doctors document. Coders
//             translate. Billers submit. Payers decide. Patients pay.")
//     - COMPLIANCE (placeholder; HIPAA / audit binders / dragon at the
//             top of the tower)
//     - LOUNGE_2F (staff break room east of Payer; mirrors the LAB's
//             placement on 1F and gives the upstairs staff somewhere
//             to take ten minutes without going downstairs)
//     - TURQUOISE_LOUNGE (partner-vendor break room north of the
//             trunk; converted hallway holding Turquoise Health's
//             two embedded staff)
//   Reached via 'S' teleport in Main Hub. Floor 2 is laid out as a
//   separate region of the same big tilemap; teleport-tile pairs in
//   MapDef.stairs handle the fade-and-snap.
//
// All areas share a single map so the player feels Mercy General as
// one place — the WR layer auto-mirrors any expansion since both
// scenes consume the same MapDef. Per-level NPC placements (`levels`
// filter) put the right staffer in the right room for each level.

import { buildMap, applyTileOverrides, type MapDef, type RoomItem } from '../mapBuilder'

// =====================================================================
// TABLE OF CONTENTS — grep for any tag to jump:
//
//   ## ROOM_CONSTS           — Room bounding boxes by wing (north,
//                              east, south, west, public-event,
//                              outdoor, 2F). About 110 lines.
//   ## STAIR_AND_EXIT        — Stair / exit teleport pair coordinates.
//   ## CORRIDOR_ANCHORS      — Door + bend tile coords used by corridor
//                              polylines below.
//   ## ROOM_DEFS             — Full RoomDef[] (walls + doors +
//                              lockedUntilLevel + interior items).
//                              ~750 lines; the biggest section.
//   ## CORRIDORS             — Polyline corridor definitions.
//   ## LEVEL_1_MAP           — Final MapDef export. Composes the above
//                              with `buildMap()` + applyTileOverrides,
//                              then attaches rooms[] (label list),
//                              stairs[], npcPlacements[].
//   ## NPC_PLACEMENTS        — Inside LEVEL_1_MAP: per-NPC tileX/tileY/
//                              levels[] filter. ~250 lines. Often
//                              edited alone when level mapping shifts.
// =====================================================================

// ## ROOM_CONSTS ##
const WIDTH = 80   // bumped from 66 to fit outdoor + payer office
const HEIGHT = 130 // bumped from 72 to fit outdoor + second floor

// === North wing — level 1-3 ===
const MAIN_HUB     = { x: 20, y: 3,  w: 18, h: 10 } // interior 16×8
const PRIOR_AUTH   = { x: 37, y: 3,  w: 14, h: 10 } // shares east wall of Main Hub
const PATIENT_SVC  = { x: 2,  y: 17, w: 12, h: 8  }
const REGISTRATION = { x: 15, y: 17, w: 22, h: 8  }
const ELIGIBILITY  = { x: 24, y: 24, w: 10, h: 6  } // hangs off Registration's south wall
// Lobby: cozier than the original 52×14 cavern. Per user feedback the
// starting room read as too big — it's the player's first impression
// and should feel like a room you stand IN, not a corridor you cross.
// The corridor still lands at x=14, so the door offset of 10 keeps
// the geometry connected.
const LOBBY        = { x: 4,  y: 32, w: 26, h: 10 }

// === East wing — atmosphere rooms ===
// Three rooms stacked vertically east of Registration. Each opens west
// onto a single trunk corridor at x=50; the trunk connects to
// Registration's east wall via a short east-running spur.
const RADIOLOGY   = { x: 51, y: 15, w: 14, h: 10 } // imaging suite
const PHARMACY    = { x: 51, y: 27, w: 14, h: 8  } // dispense / formulary
const MED_RECORDS = { x: 51, y: 37, w: 14, h: 10 } // chart room

// === South wing — level 4-9 (AUDIT moved to second floor) ===
const HIM      = { x: 4,  y: 50, w: 14, h: 10 } // coding / CDI floor
const BILLING  = { x: 22, y: 50, w: 14, h: 10 } // clearinghouse / claim queue
const PFS      = { x: 40, y: 50, w: 16, h: 10 } // patient financial services / phones
// Lab is the SE corner of the south wing — reads as "clinical-support
// overflow" alongside the east-wing diagnostics (radiology / pharmacy /
// records). Adjacent to PFS on its east wall; reached via the SW
// trough corridor extended east past PFS.
const LAB      = { x: 56, y: 50, w: 12, h: 8  } // pathology / micro lab

// === West wing — north of Patient Services, west of MAIN_HUB.
//     Reached by extending the main north-south corridor past the
//     bend, then branching west. Three rooms cluster around that
//     branch:
//   - CAFETERIA: public dining area in the NW corner (big).
//   - KITCHEN:   back-of-house prep room below cafeteria. Used to
//                be a generic LAB before — kitchen reads more
//                naturally next to a cafeteria + lounge.
//   - LOUNGE:    staff break room east of the kitchen.
//
// Cafeteria expanded from 12×8 → 12×10 by pushing its south wall
// down two rows; kitchen + lounge shrunk from h=6 → h=4 to make
// room. Cross-corridor moved from y=10 → y=12 to keep the topology.
const CAFETERIA = { x: 2,  y: 2,  w: 12, h: 10 } // 10×8 interior
const KITCHEN   = { x: 2,  y: 13, w: 6,  h: 4  } // 4×2 interior
const LOUNGE    = { x: 8,  y: 13, w: 6,  h: 4  } // 4×2 interior

// === Outdoor — parking lot, reached via 'O' teleport from the lobby ===
const OUTDOOR  = { x: 4,  y: 65, w: 50, h: 22 } // big sparse exterior

// === Public-event rooms — auditorium, lecture hall, oncology suite.
//     Three large public-facing rooms added late in the build to host
//     grand-rounds presentations, M&M conferences, and the oncology
//     service line that's been canon since the Chemo Bundle Specter
//     Case (#200) but didn't have a physical room until now. ===
//
//   - AUDITORIUM: east of LOBBY, sharing its east wall. Big public-
//     event room; reads as "the door east of reception leads here."
//     Used for hospital-wide town halls, family meetings, vendor
//     conferences. 20×10.
//   - LECTURE_HALL: south of LAB, east of OUTDOOR. The clinical-
//     teaching room — grand rounds, residency conferences, M&M.
//     Tighter to LAB than the auditorium is to lobby; reads as
//     "back of the south wing, where teaching happens." 20×12.
//   - CANCER_CENTER: top-right corner above RADIOLOGY, east of
//     PRIOR_AUTH. The oncology infusion suite that hosts chemo
//     case-rate billing (cousin to Chemo Bundle Specter). Pharmacy
//     directly below makes the adjacency clinically realistic.
//     Reached via the east-wing trunk corridor extended NORTH past
//     Radiology's door row. 28×12.
const AUDITORIUM    = { x: 30, y: 32, w: 20, h: 10 }
const LECTURE_HALL  = { x: 56, y: 58, w: 20, h: 12 }
const CANCER_CENTER = { x: 51, y: 2,  w: 28, h: 12 }

// === Stairwells — small dedicated rooms holding the 'S' teleport
//     tiles, symmetric on both floors. STAIRWELL_1F is an annex on
//     Main Hub's west wall (5×6, shared east-west wall with Main
//     Hub via a connecting door). LANDING_2F is the equivalent on
//     the second floor — small foyer that opens onto the 2F
//     corridor leading to AUDIT / PAYER / COMPLIANCE.
const STAIRWELL_1F = { x: 16, y: 4,  w: 5,  h: 6  } // 1F stair annex
// === Second floor — reached via 'S' teleport from STAIRWELL_1F ===
// Spatially placed far south of the ground floor so the same big
// tilemap holds both. The player never walks the gap; teleport tiles
// in MapDef.stairs fade-and-snap.
const LANDING_2F  = { x: 30, y: 94,  w: 8,  h: 5  } // small stair foyer
const AUDIT       = { x: 4,  y: 100, w: 28, h: 10 } // relocated from y=62
const PAYER       = { x: 36, y: 100, w: 18, h: 10 } // Aetna/Anthem-equivalent office
// Second staff lounge — for the upstairs admin / payer / compliance
// crowd, who otherwise had nowhere to take a break without going
// downstairs. Sits east of PAYER along the same y as AUDIT/PAYER and
// hooks into the 2F east-west trunk extended east past PAYER.
const LOUNGE_2F   = { x: 56, y: 100, w: 12, h: 8  } // 2F staff lounge
// Turquoise Lounge — partner-vendor break room for Turquoise Health's
// two embedded staff (Chris on the business side, Adam on engineering).
// Sits north of the trunk corridor in the empty band between
// LANDING_2F and PAYER, so it reads as "we gave the partner team
// their own space, but only just barely." Shallow but wide.
const TURQUOISE_LOUNGE = { x: 38, y: 94, w: 22, h: 5 } // 20×3 interior
const COMPLIANCE  = { x: 18, y: 113, w: 28, h: 10 } // HIPAA / binders / boss-prep

// Door world-coords (used to plan corridor endpoints).
// ## CORRIDOR_ANCHORS ##
const HUB_SOUTH_DOOR    = { x: MAIN_HUB.x + 10,    y: MAIN_HUB.y + MAIN_HUB.h - 1 } // (30, 12)
const LOBBY_NORTH_DOOR  = { x: LOBBY.x + 10,        y: LOBBY.y }                    // (14, 32)
const LOBBY_SOUTH_DOOR  = { x: LOBBY.x + 14,        y: LOBBY.y + LOBBY.h - 1 }      // (18, 41)
const CORRIDOR_BEND     = { x: LOBBY_NORTH_DOOR.x,  y: HUB_SOUTH_DOOR.y + 1 }       // (14, 13)

// South-wing corridor anchor (audit stub gone with audit; trough still
// connects HIM/BILLING/PFS).
const SW_TROUGH_Y       = 49 // east-west corridor running just north of the south-wing rooms

// ## STAIR_AND_EXIT ##
// === Stair / exit teleport pairs ===
// Each entry is one-way; pair them to make round-trips. The 'S' / 'O'
// glyphs render as tinted floors and trigger teleport in
// HospitalScene.tryMove.
// Stair tile lives in STAIRWELL_1F (interior dx=1, dy=2 → world
// (18, 7)) — moved out of Main Hub once we gave it a dedicated
// stairwell room. The 2F landing tile stays where it was at (33, 96).
const STAIR_HUB_TO_2F   = { from: { x: 18, y: 7  }, to: { x: 33, y: 96 }, label: '↑ 2F' }
const STAIR_2F_TO_HUB   = { from: { x: 33, y: 96 }, to: { x: 18, y: 7  }, label: '↓ 1F' }
// Lobby ↔ outdoor parking-lot teleport. The lobby endpoint sits on
// the *west* interior column (LOBBY dx=1, dy=4 → world (5, 36)) so
// the parking-lot entrance reads as a side door, not a south
// corridor (the south door already leads to the south wing). The
// outdoor arrival tile stays where it was — geographically the
// parking lot is south of everything else, but the teleport hides
// that distance.
const EXIT_LOBBY_OUT    = { from: { x: 5,  y: 36 }, to: { x: 16, y: 67 }, label: '← EXIT' }
const EXIT_OUT_LOBBY    = { from: { x: 16, y: 67 }, to: { x: 5,  y: 36 }, label: '← LOBBY' }

/**
 * Compute the OUTDOOR (parking lot) item list. Pulled into a helper
 * so we can auto-generate parking-line stripes ('=') flanking each
 * parked car instead of hand-placing 50+ stripe entries.
 *
 * Layout:
 *   - Arrival mat at (11, 1) — lobby teleport partner
 *   - North trees at dy=2 (south trees dropped — replaced by the
 *     curb + street that runs along the south edge)
 *   - North row of cars at dy=4, middle row at dy=14
 *   - Each car gets stripes at dx-1 and dx+1 (auto, deduped against
 *     other cars and out-of-bounds dx)
 *   - Drop-off benches at dy=8
 *   - Lampposts at dy=10 (mid-lot drive aisle)
 *   - Curb row at dy=17 (full width)
 *   - Street at dy=18, dy=19 (2-row road, full width)
 */
function outdoorItems(): RoomItem[] {
  const cars: RoomItem[] = [
    // Arrival tile (teleport partner of the lobby 'O').
    // Outdoor origin is (4,65); dx=11/dy=1 → world (16, 67),
    // matching EXIT_OUT_LOBBY.from.
    { dx: 11, dy: 1, ch: 'O' },
    // North row of cars — mixed sedans, SUVs, one beater. Sit at
    // dy=4 (one row south of trees) so they don't overlap.
    { dx: 2,  dy: 4, ch: '1' }, { dx: 5,  dy: 4, ch: '2' },
    { dx: 8,  dy: 4, ch: '1' }, { dx: 14, dy: 4, ch: '3' },
    { dx: 17, dy: 4, ch: '2' }, { dx: 20, dy: 4, ch: '1' },
    { dx: 26, dy: 4, ch: '1' }, { dx: 29, dy: 4, ch: '2' },
    { dx: 35, dy: 4, ch: '3' }, { dx: 38, dy: 4, ch: '1' },
    { dx: 44, dy: 4, ch: '2' }, { dx: 47, dy: 4, ch: '1' },
    // Middle row of cars at dy=14 — denser, a couple beaters.
    { dx: 2,  dy: 14, ch: '2' }, { dx: 5,  dy: 14, ch: '1' },
    { dx: 8,  dy: 14, ch: '3' }, { dx: 14, dy: 14, ch: '1' },
    { dx: 17, dy: 14, ch: '1' }, { dx: 20, dy: 14, ch: '2' },
    { dx: 26, dy: 14, ch: '3' }, { dx: 29, dy: 14, ch: '1' },
    { dx: 35, dy: 14, ch: '2' }, { dx: 38, dy: 14, ch: '1' },
    { dx: 44, dy: 14, ch: '1' }, { dx: 47, dy: 14, ch: '3' },
  ]

  // Auto-stripes flanking each car. Skip cells that are themselves
  // cars or that fall outside the valid dx range (0..47 for w=50).
  const carCells = new Set(
    cars.filter(c => /^[123]$/.test(c.ch)).map(c => `${c.dx},${c.dy}`)
  )
  const stripeCells = new Set<string>()
  for (const car of cars) {
    if (!/^[123]$/.test(car.ch)) continue  // only cars get stripes
    for (const dx of [car.dx - 1, car.dx + 1]) {
      if (dx < 0 || dx > 47) continue
      const key = `${dx},${car.dy}`
      if (carCells.has(key)) continue
      stripeCells.add(key)
    }
  }
  const stripes: RoomItem[] = Array.from(stripeCells).map(k => {
    const [x, y] = k.split(',').map(Number)
    return { dx: x, dy: y, ch: '=' }
  })

  // Curb row at dy=17 + 2-row street at dy=18, dy=19. Replaces
  // the south perimeter trees that used to live at dy=18.
  const curbRow: RoomItem[] = Array.from({ length: 48 }, (_, i) => ({ dx: i, dy: 17, ch: 'C' }))
  const streetRows: RoomItem[] = [
    ...Array.from({ length: 48 }, (_, i) => ({ dx: i, dy: 18, ch: 'r' })),
    ...Array.from({ length: 48 }, (_, i) => ({ dx: i, dy: 19, ch: 'r' })),
  ]

  return [
    ...cars,
    ...stripes,
    // North-edge trees only (south trees dropped — curb + street
    // takes that row now).
    { dx: 2,  dy: 2, ch: 'P' }, { dx: 6,  dy: 2, ch: 'P' },
    { dx: 22, dy: 2, ch: 'P' }, { dx: 32, dy: 2, ch: 'P' },
    { dx: 42, dy: 2, ch: 'P' }, { dx: 46, dy: 2, ch: 'P' },
    // Drop-off benches mid-lot.
    { dx: 8,  dy: 8,  ch: 'h' }, { dx: 10, dy: 8,  ch: 'h' },
    { dx: 36, dy: 8,  ch: 'h' }, { dx: 38, dy: 8,  ch: 'h' },
    // Lampposts — variety. Arched globes near the entrance, twin
    // globes mid-lot, simple fixtures at the far edges.
    { dx: 4,  dy: 10, ch: '5' }, { dx: 14, dy: 10, ch: '5' },
    { dx: 25, dy: 10, ch: '6' }, { dx: 33, dy: 10, ch: '6' },
    { dx: 41, dy: 10, ch: '4' }, { dx: 47, dy: 10, ch: '4' },
    // South edge: curb + street.
    ...curbRow,
    ...streetRows,
  ]
}

// ## ROOM_DEFS ##
const { layout, tileMeta, rooms: BUILT_ROOMS } = buildMap({
  width: WIDTH,
  height: HEIGHT,
  background: 'W',
  rooms: [
    // ===== North wing =====
    {
      id: 'mainHub',
      ...MAIN_HUB,
      doors: [
        { side: 'S', offset: 10 },               // bottom door to corridor
        { side: 'E', offset: 5 },                 // east door → Prior Auth (phase-locked via priorAuth.lockedUntilLevel)
        { side: 'W', offset: 4 },                // west door → STAIRWELL_1F
      ],
      items: [
        { dx: 7,  dy: 3, ch: 'w' },  // fountain (water cooler stand-in)
        { dx: 2,  dy: 1, ch: 'P' },
        { dx: 13, dy: 1, ch: 'P' },
        { dx: 2,  dy: 6, ch: 'P' },
        { dx: 13, dy: 6, ch: 'P' },
        { dx: 5,  dy: 5, ch: 'b' },  // signage
        // (Stair-up tile moved out of Main Hub into STAIRWELL_1F —
        // see the stairwell room def.)
      ],
    },
    {
      id: 'stairwell1F',
      // L1-8 the stairs are closed off. Unlocks at L9 so the player
      // can climb up to the Data Sandbox (the team's documentation
      // terminal) right around when the south wing opens for HIM
      // (bundle case). Other 2F rooms keep their own per-room locks
      // (lounge2F L9, audit/payer L19, compliance L32,
      // turquoiseLounge post-boss) so the upstairs map still
      // phase-unlocks gradually. Locking the stairwell room itself
      // (rather than the stair tile) reuses the existing
      // applyUnlocks plumbing.
      lockedUntilLevel: 8,
      ...STAIRWELL_1F,
      // East door at offset 3 → world (20, 7). Same tile as the
      // Main Hub west door at offset 4 — they share the boundary
      // wall column. The builder is idempotent on this overlap.
      doors: [{ side: 'E', offset: 3 }],
      // Inside: the 'S' stair tile at the center, plus a couple of
      // plants for atmosphere. The stair tile is paired with the
      // 2F landing's 'S' in stairs[] above. Walking onto it fade-
      // and-snaps to LANDING_2F.
      items: [
        // Center: stair tile. Interior dx=1, dy=2 → world (18, 7),
        // matching STAIR_HUB_TO_2F.from.
        { dx: 1, dy: 2, ch: 'S' },
        // Stairwell is 5×6 (interior 3×4) — valid item dx is 1..2,
        // dy is 1..3. Two flanking plants for atmosphere.
        { dx: 1, dy: 1, ch: 'P' },
        { dx: 2, dy: 3, ch: 'P' },
      ],
    },
    {
      id: 'priorAuth',
      lockedUntilLevel: 8,
      ...PRIOR_AUTH,
      // West door is shared with Main Hub's east locked door — same world
      // tile. Re-declaring it keeps the room self-describing; the builder
      // will overwrite the same cell with 'L', which is idempotent.
      doors: [{ side: 'W', offset: 5 }],
      items: [
        { dx: 2, dy: 2, ch: 'c' }, { dx: 2, dy: 3, ch: 'h' },
        { dx: 5, dy: 2, ch: 'c' }, { dx: 5, dy: 3, ch: 'h' },
        { dx: 8, dy: 6, ch: 'X' }, // fax
        { dx: 1, dy: 6, ch: 'F' },
      ],
    },

    // ===== West wing — north of Patient Services =====
    {
      id: 'cafeteria',
      lockedUntilLevel: 1,
      ...CAFETERIA,
      // East door at offset 2 → world (13, 4). Connects to the
      // main north-south corridor (extended north from the bend
      // at (14, 13) up to (14, 4)).
      doors: [{ side: 'E', offset: 2 }],
      // Public dining area. Service line on the north interior row,
      // round dining tables filling the floor, vending + water on
      // the east column. 12×10 footprint = 10×8 interior;
      // valid item dx is 1..9, dy is 1..8.
      // 2026-05: replaced two-tile desk+chair "tables" with single-
      // tile round dining tables ('T'); replaced the F-cabinet hot
      // line with the modern stainless ('m') + brass buffet ('M')
      // pair so the service line reads as a real cafeteria.
      items: [
        // Service line — counter at the west, then steam tables
        // (modern + brass), then menu board, then bulletin.
        { dx: 1, dy: 1, ch: 'R' }, { dx: 2, dy: 1, ch: 'R' },
        { dx: 4, dy: 1, ch: 'm' }, // modern stainless steam table
        { dx: 5, dy: 1, ch: 'M' }, // brass buffet
        { dx: 7, dy: 1, ch: 'B' }, // whiteboard / daily menu
        { dx: 9, dy: 1, ch: 'b' }, // community bulletin
        // Round dining tables — six 1-tile tables in two rows of
        // three, with the second row offset for visual rhythm.
        // (Tables are solid; gaps between them are the dining aisles.)
        { dx: 1, dy: 4, ch: 'T' }, { dx: 4, dy: 4, ch: 'T' }, { dx: 7, dy: 4, ch: 'T' },
        { dx: 2, dy: 7, ch: 'T' }, { dx: 5, dy: 7, ch: 'T' },
        // East-side amenities: vending, water cooler, plant.
        { dx: 9, dy: 4, ch: 'V' },
        { dx: 9, dy: 6, ch: 'w' },
        { dx: 9, dy: 8, ch: 'P' },
      ],
    },
    {
      id: 'kitchen',
      lockedUntilLevel: 8,
      ...KITCHEN,
      // North door at offset 3 → world (5, 13). Opens onto the
      // east-west cross-corridor at y=12.
      doors: [{ side: 'N', offset: 3 }],
      // Back-of-house prep area for the cafeteria. Counter row
      // + fridge + ice machine. Door is at offset 3 → interior
      // dx=2 dy=0, so that cell stays open (player walks straight
      // through). Interior is 4×2 (valid dx 0..3, dy 0..1).
      items: [
        { dx: 0, dy: 0, ch: 'R' }, { dx: 1, dy: 0, ch: 'R' }, // prep counters (left of entry)
        { dx: 3, dy: 0, ch: 'F' },                            // fridge in the back corner
        { dx: 3, dy: 1, ch: 'V' },                            // ice / drinks machine
      ],
    },
    {
      id: 'lounge',
      lockedUntilLevel: 8,
      ...LOUNGE,
      // North door at offset 3 → world (11, 13).
      doors: [{ side: 'N', offset: 3 }],
      // Staff break room. Two soft chairs ('h' stand-in), a water
      // cooler in the corner, a plant in the back. Interior 4×2.
      items: [
        { dx: 0, dy: 0, ch: 'h' }, { dx: 1, dy: 0, ch: 'h' },
        { dx: 3, dy: 0, ch: 'w' }, // water cooler
        { dx: 3, dy: 1, ch: 'P' }, // corner plant
      ],
    },

    {
      id: 'patientServices',
      lockedUntilLevel: 3,
      ...PATIENT_SVC,
      doors: [{ side: 'E', offset: 3 }],
      items: [
        { dx: 1, dy: 1, ch: 'c' }, { dx: 1, dy: 2, ch: 'h' },
        { dx: 5, dy: 1, ch: 'B' },
        { dx: 8, dy: 5, ch: 'F' },
        { dx: 3, dy: 5, ch: 'P' },
      ],
    },
    {
      id: 'registration',
      lockedUntilLevel: 3,
      ...REGISTRATION,
      doors: [
        { side: 'W', offset: 3 },                                                  // west into corridor
        { side: 'S', offset: ELIGIBILITY.x + 4 - REGISTRATION.x },                 // south into Eligibility
        { side: 'E', offset: 4 },                                                  // east into the east-wing spur corridor
      ],
      items: [
        { dx: 1, dy: 1, ch: 'R' }, { dx: 2, dy: 1, ch: 'R' }, { dx: 3, dy: 1, ch: 'R' },
        { dx: 4, dy: 1, ch: 'R' }, { dx: 5, dy: 1, ch: 'R' }, { dx: 6, dy: 1, ch: 'R' },
        { dx: 1, dy: 5, ch: 'c' }, { dx: 1, dy: 6, ch: 'h' },
        { dx: 4, dy: 5, ch: 'c' }, { dx: 4, dy: 6, ch: 'h' },
        { dx: 14, dy: 1, ch: 'B' },
      ],
    },
    {
      id: 'eligibility',
      lockedUntilLevel: 3,
      ...ELIGIBILITY,
      // North door shared with Registration's south door — same world tile.
      doors: [{ side: 'N', offset: 4 }],
      items: [
        { dx: 1, dy: 1, ch: 'c' }, { dx: 1, dy: 2, ch: 'h' },
        { dx: 4, dy: 1, ch: 'X' }, // fax / kiosk terminal
        { dx: 6, dy: 3, ch: 'F' },
      ],
    },
    // ===== East wing =====
    {
      id: 'radiology',
      lockedUntilLevel: 8,
      ...RADIOLOGY,
      // West door at world y = 15+6 = 21, aligned with the spur corridor
      // running east from Registration's east door.
      doors: [{ side: 'W', offset: 6 }],
      // Imaging suite: a couple of read-stations (desk + chair),
      // file cabinets for film jackets, a hospital bed for patient
      // hand-off, plus plants for that "waiting just outside the
      // scanner" feel. (No imaging-specific glyphs exist; reusing the
      // 12 procedural keys.)
      items: [
        { dx: 1, dy: 1, ch: 'c' }, { dx: 1, dy: 2, ch: 'h' }, // read-station 1
        { dx: 4, dy: 1, ch: 'c' }, { dx: 4, dy: 2, ch: 'h' }, // read-station 2
        { dx: 8, dy: 1, ch: 'B' },                            // light-board / monitor
        { dx: 1, dy: 6, ch: 'F' }, { dx: 4, dy: 6, ch: 'F' }, // film cabinets
        { dx: 8, dy: 6, ch: 'H' },                            // exam bed (patient hand-off)
        { dx: 11, dy: 1, ch: 'P' },
        { dx: 11, dy: 7, ch: 'P' },
      ],
    },
    {
      id: 'pharmacy',
      lockedUntilLevel: 11,
      ...PHARMACY,
      // West door at world y = 27+3 = 30.
      doors: [{ side: 'W', offset: 3 }],
      // Dispense window + shelves of binders (formulary stand-in).
      items: [
        { dx: 1, dy: 1, ch: 'R' }, { dx: 2, dy: 1, ch: 'R' }, { dx: 3, dy: 1, ch: 'R' }, // dispense counter
        { dx: 5, dy: 1, ch: 'B' },                                                       // formulary board
        { dx: 1, dy: 5, ch: 'F' }, { dx: 4, dy: 5, ch: 'F' }, { dx: 7, dy: 5, ch: 'F' }, // shelves
        { dx: 11, dy: 1, ch: 'c' }, { dx: 11, dy: 2, ch: 'h' },                          // pharmacist desk
        { dx: 11, dy: 5, ch: 'P' },
      ],
    },
    {
      id: 'medRecords',
      // L5's bundle handoff sends the player here for Sarah Kim's
      // op-note before the Waiting Room descent.
      lockedUntilLevel: 5,
      ...MED_RECORDS,
      // West door at world y = 37+5 = 42.
      doors: [{ side: 'W', offset: 5 }],
      // Chart room — the wall-of-binders look. Two desks for staff
      // pulling charts, otherwise dense rows of file cabinets.
      items: [
        { dx: 1, dy: 1, ch: 'F' }, { dx: 2, dy: 1, ch: 'F' }, { dx: 3, dy: 1, ch: 'F' },
        { dx: 4, dy: 1, ch: 'F' }, { dx: 5, dy: 1, ch: 'F' }, { dx: 6, dy: 1, ch: 'F' },
        { dx: 8, dy: 1, ch: 'F' }, { dx: 9, dy: 1, ch: 'F' }, { dx: 10, dy: 1, ch: 'F' },
        { dx: 11, dy: 1, ch: 'F' }, { dx: 12, dy: 1, ch: 'F' },
        { dx: 1, dy: 7, ch: 'F' }, { dx: 2, dy: 7, ch: 'F' }, { dx: 3, dy: 7, ch: 'F' },
        { dx: 4, dy: 7, ch: 'F' }, { dx: 5, dy: 7, ch: 'F' }, { dx: 6, dy: 7, ch: 'F' },
        { dx: 8, dy: 7, ch: 'F' }, { dx: 9, dy: 7, ch: 'F' }, { dx: 10, dy: 7, ch: 'F' },
        { dx: 11, dy: 7, ch: 'F' }, { dx: 12, dy: 7, ch: 'F' },
        { dx: 4, dy: 4, ch: 'c' }, { dx: 4, dy: 5, ch: 'h' },
        { dx: 9, dy: 4, ch: 'c' }, { dx: 9, dy: 5, ch: 'h' },
        { dx: 12, dy: 4, ch: 'X' }, // fax / records terminal
      ],
    },

    {
      id: 'lobby',
      ...LOBBY,
      // North to the corridor / hospital interior, south to the new
      // south wing, east into the auditorium (added 2026-05).
      doors: [
        { side: 'N', offset: 10 },
        { side: 'S', offset: 14 },
        { side: 'E', offset: 5 }, // (29, 37) — pairs with auditorium W door
      ],
      // 70s-Lynch lobby — packed warmer + denser than the old cavern.
      // Reuses existing prop chars (lamps stand-in: water-cooler 'w';
      // side tables: 'c'; framed art: 'b'). The HospitalScene tints
      // give the room its register; the props give it its density.
      items: [
        // Counter spans three columns west of the door
        { dx: 1, dy: 1, ch: 'R' }, { dx: 2, dy: 1, ch: 'R' }, { dx: 3, dy: 1, ch: 'R' },
        // Bulletin board + a small framed print north wall
        { dx: 5,  dy: 1, ch: 'b' },
        { dx: 18, dy: 1, ch: 'b' }, // second bulletin (like a print)
        // Plants flanking — north corners + by the door
        { dx: 7,  dy: 1, ch: 'P' },
        { dx: 12, dy: 1, ch: 'P' }, // by door
        { dx: 22, dy: 1, ch: 'P' },
        // Side tables (with magazines / ashtrays — implied)
        { dx: 5,  dy: 4, ch: 'c' },
        { dx: 19, dy: 4, ch: 'c' },
        // Two rows of patient chairs flanking Chloe's intern station.
        // Chloe's desk sits at (dx=9, dy=5) — between the rows on
        // the player's spawn column — with her chair directly south
        // at (dx=9, dy=6). The patient row at dy=6 leaves dx=9 open
        // so it reads as "her chair," not part of public seating.
        // 2026-05: reverted from 'A' avocado armchairs back to 'h'
        // standard waiting-room chairs — keeps the seating walkable
        // and matches the rest of the hospital's chair vocabulary.
        { dx: 7,  dy: 4, ch: 'h' }, { dx: 9,  dy: 4, ch: 'h' }, { dx: 11, dy: 4, ch: 'h' },
        { dx: 14, dy: 4, ch: 'h' }, { dx: 16, dy: 4, ch: 'h' },
        { dx: 9,  dy: 5, ch: 'c' }, // Chloe's desk
        { dx: 7,  dy: 6, ch: 'h' },                              { dx: 11, dy: 6, ch: 'h' },
        { dx: 14, dy: 6, ch: 'h' }, { dx: 16, dy: 6, ch: 'h' },
        { dx: 9,  dy: 6, ch: 'h' }, // Chloe's chair (player spawns here)
        // South wall amenities — vending, water cooler ("lamp"), bulletin.
        { dx: 2,  dy: 7, ch: 'V' },
        { dx: 22, dy: 7, ch: 'w' }, // doubles as a tall lamp visually with the warm tint
        { dx: 24, dy: 7, ch: 'P' }, // corner plant
        // Side-door exit mat — teleports to the outdoor parking
        // lot (paired in stairs[]). Sits flush against the WEST
        // interior wall. The lobby's south door still leads to the
        // south wing; this 'O' tile is a separate side exit. Officer
        // Reyes stands one tile east, watching it.
        // 2026-05: was dx=1/dy=4 (world (6, 37)) which placed the
        // visible mat one tile IN from the wall AND mismatched the
        // teleport pair (EXIT_LOBBY_OUT.from = (5, 36)). Fixed to
        // dx=0/dy=3 → world (5, 36): mat lines up with the teleport
        // trigger and reads as a real exit door.
        { dx: 0, dy: 3, ch: 'O' },
      ],
    },

    // ===== South wing =====
    {
      id: 'him',
      lockedUntilLevel: 5,
      ...HIM,
      doors: [{ side: 'N', offset: 7 }],
      // Coding / CDI: monitors, code books, charts.
      items: [
        { dx: 1, dy: 1, ch: 'c' }, { dx: 1, dy: 2, ch: 'h' },
        { dx: 4, dy: 1, ch: 'c' }, { dx: 4, dy: 2, ch: 'h' },
        { dx: 8, dy: 1, ch: 'c' }, { dx: 8, dy: 2, ch: 'h' },
        { dx: 1, dy: 5, ch: 'F' }, { dx: 4, dy: 5, ch: 'F' }, // file cabinets w/ chart binders
        { dx: 8, dy: 5, ch: 'B' }, // whiteboard with code-of-the-week
        { dx: 11, dy: 1, ch: 'P' },
        { dx: 11, dy: 7, ch: 'P' },
      ],
    },
    {
      id: 'billing',
      lockedUntilLevel: 12,
      ...BILLING,
      doors: [{ side: 'N', offset: 7 }],
      // Clearinghouse / claim queue: terminals + scrubber screens.
      items: [
        { dx: 1, dy: 1, ch: 'c' }, { dx: 1, dy: 2, ch: 'h' },
        { dx: 4, dy: 1, ch: 'c' }, { dx: 4, dy: 2, ch: 'h' },
        { dx: 8, dy: 1, ch: 'c' }, { dx: 8, dy: 2, ch: 'h' },
        { dx: 1, dy: 5, ch: 'X' }, { dx: 4, dy: 5, ch: 'X' }, // fax / EDI terminals
        { dx: 8, dy: 5, ch: 'B' }, // claim-queue board
        { dx: 11, dy: 1, ch: 'F' },
        { dx: 11, dy: 7, ch: 'P' },
      ],
    },
    {
      id: 'pfs',
      lockedUntilLevel: 19,
      ...PFS,
      doors: [{ side: 'N', offset: 8 }],
      // Patient Financial Services: phone bank + paperwork mountain.
      items: [
        { dx: 1, dy: 1, ch: 'c' }, { dx: 1, dy: 2, ch: 'h' },
        { dx: 4, dy: 1, ch: 'c' }, { dx: 4, dy: 2, ch: 'h' },
        { dx: 8, dy: 1, ch: 'c' }, { dx: 8, dy: 2, ch: 'h' },
        { dx: 12, dy: 1, ch: 'c' }, { dx: 12, dy: 2, ch: 'h' },
        { dx: 1, dy: 5, ch: 'B' }, // hold-time / call-volume board
        { dx: 5, dy: 5, ch: 'F' },
        { dx: 9, dy: 5, ch: 'w' },
        { dx: 13, dy: 7, ch: 'P' },
      ],
    },
    {
      id: 'lab',
      lockedUntilLevel: 12,
      ...LAB,
      // North door at offset 4 → world (60, 50). Opens onto the SW
      // trough corridor at y=49 (extended east past PFS to reach
      // this room). LAB has only the one door — clinical lab
      // shouldn't be a thoroughfare to public-event rooms.
      doors: [{ side: 'N', offset: 4 }],
      // Pathology / microbiology: bench counter on the north wall
      // (broken at the door entry), three microscope work-stations
      // in the middle, sample cabinets + a fax for results
      // turn-around on the south wall. Interior 10×6; valid item
      // dx 0..9, dy 0..5. Door entry at interior dx=3 dy=0 stays
      // open so the player can walk straight through.
      items: [
        // North bench counter (skip dx=3 for door entry).
        { dx: 0, dy: 0, ch: 'R' }, { dx: 1, dy: 0, ch: 'R' }, { dx: 2, dy: 0, ch: 'R' },
        { dx: 5, dy: 0, ch: 'F' }, // sample binders
        { dx: 7, dy: 0, ch: 'B' }, // results / accession board
        { dx: 9, dy: 0, ch: 'P' },
        // Microscope desks — three pairs across the middle row.
        { dx: 1, dy: 2, ch: 'c' }, { dx: 1, dy: 3, ch: 'h' },
        { dx: 4, dy: 2, ch: 'c' }, { dx: 4, dy: 3, ch: 'h' },
        { dx: 8, dy: 2, ch: 'c' }, { dx: 8, dy: 3, ch: 'h' },
        // South wall — cabinets + fax for outgoing pathology
        // reports.
        { dx: 1, dy: 5, ch: 'F' }, { dx: 4, dy: 5, ch: 'F' }, { dx: 9, dy: 5, ch: 'F' },
        { dx: 7, dy: 5, ch: 'X' },
      ],
    },

    // ===== Public-event rooms =====
    {
      id: 'auditorium',
      lockedUntilLevel: 32,
      ...AUDITORIUM,
      // West door at offset 5 → world (30, 37) — pairs with lobby's
      // east door at (29, 37). They share adjacent wall columns; the
      // doors meet directly so no corridor is needed.
      doors: [{ side: 'W', offset: 5 }],
      // Big public-event room. Stage at the east end (R counter row
      // standing in for a raised platform); rows of seating across
      // the middle facing east toward the stage; aisle entry from
      // the west door. Interior 18×8 (dx 0..17, dy 0..7).
      items: [
        // East-end stage — three R counter tiles + a podium (c desk)
        // + a screen (B whiteboard).
        { dx: 17, dy: 1, ch: 'R' }, { dx: 17, dy: 3, ch: 'R' }, { dx: 17, dy: 5, ch: 'R' },
        { dx: 16, dy: 3, ch: 'c' }, // podium
        { dx: 17, dy: 6, ch: 'B' }, // screen / whiteboard at the back
        // Audience seating — five rows of chairs facing east. Aisle
        // running through dy=4 left open for the door entry path
        // (door at offset 5 → interior dx=0, dy=4).
        { dx: 2,  dy: 1, ch: 'h' }, { dx: 4,  dy: 1, ch: 'h' }, { dx: 6,  dy: 1, ch: 'h' },
        { dx: 8,  dy: 1, ch: 'h' }, { dx: 10, dy: 1, ch: 'h' }, { dx: 12, dy: 1, ch: 'h' },
        { dx: 2,  dy: 2, ch: 'h' }, { dx: 4,  dy: 2, ch: 'h' }, { dx: 6,  dy: 2, ch: 'h' },
        { dx: 8,  dy: 2, ch: 'h' }, { dx: 10, dy: 2, ch: 'h' }, { dx: 12, dy: 2, ch: 'h' },
        { dx: 2,  dy: 3, ch: 'h' }, { dx: 4,  dy: 3, ch: 'h' }, { dx: 6,  dy: 3, ch: 'h' },
        { dx: 8,  dy: 3, ch: 'h' }, { dx: 10, dy: 3, ch: 'h' }, { dx: 12, dy: 3, ch: 'h' },
        // Aisle row (dy=4) intentionally clear for the entry.
        { dx: 2,  dy: 5, ch: 'h' }, { dx: 4,  dy: 5, ch: 'h' }, { dx: 6,  dy: 5, ch: 'h' },
        { dx: 8,  dy: 5, ch: 'h' }, { dx: 10, dy: 5, ch: 'h' }, { dx: 12, dy: 5, ch: 'h' },
        { dx: 2,  dy: 6, ch: 'h' }, { dx: 4,  dy: 6, ch: 'h' }, { dx: 6,  dy: 6, ch: 'h' },
        { dx: 8,  dy: 6, ch: 'h' }, { dx: 10, dy: 6, ch: 'h' }, { dx: 12, dy: 6, ch: 'h' },
        // Corner plants for atmosphere.
        { dx: 0, dy: 0, ch: 'P' }, { dx: 0, dy: 7, ch: 'P' },
      ],
    },

    {
      id: 'lectureHall',
      lockedUntilLevel: 18,
      ...LECTURE_HALL,
      // North door at offset 12 → world (68, 58). Pairs with a
      // wraparound corridor that runs east from the SW trough past
      // LAB (x=56-67) and drops south at x=68 to (68, 57). Routing
      // east of LAB rather than through it — clinical labs aren't
      // public corridors.
      doors: [{ side: 'N', offset: 12 }],
      // Tiered teaching room — grand-rounds, M&Ms, residency
      // conferences. Same shape as the auditorium (rows facing a
      // stage) but smaller and more clinical-feeling. Stage at the
      // SOUTH end this time (door is north). Interior 18×10
      // (dx 0..17, dy 0..9). Door entry at interior dx=11 dy=0
      // stays open.
      items: [
        // North-wall plants flanking door entry.
        { dx: 0,  dy: 0, ch: 'P' },
        { dx: 17, dy: 0, ch: 'P' },
        // 2026-05 redraw — two-aisle stadium layout (stadium pick from
        // /room-redraw-preview.html). Denser seating: 6 rows of 15
        // seats each = 90 seats total. Three aisles keep navigation
        // open: vertical aisles at dx=4 + dx=11 (door entry path),
        // and a horizontal cross-aisle at dy=4. Stage runs the full
        // south wall — counter at dy=9 with lectern + chalkboard
        // centered at dy=8.
        // Audience rows (dy=1..3, dy=5..7), facing south toward stage.
        // Cols: [1,2,3,5,6,7,8,9,10,12,13,14,15,16,17] — skips dx=4
        // (left aisle), dx=11 (door entry aisle), dx=0/17 (plants).
        { dx: 1,  dy: 1, ch: 's' }, { dx: 2,  dy: 1, ch: 's' }, { dx: 3,  dy: 1, ch: 's' },
        { dx: 5,  dy: 1, ch: 's' }, { dx: 6,  dy: 1, ch: 's' }, { dx: 7,  dy: 1, ch: 's' },
        { dx: 8,  dy: 1, ch: 's' }, { dx: 9,  dy: 1, ch: 's' }, { dx: 10, dy: 1, ch: 's' },
        { dx: 12, dy: 1, ch: 's' }, { dx: 13, dy: 1, ch: 's' }, { dx: 14, dy: 1, ch: 's' },
        { dx: 15, dy: 1, ch: 's' }, { dx: 16, dy: 1, ch: 's' },
        { dx: 1,  dy: 2, ch: 's' }, { dx: 2,  dy: 2, ch: 's' }, { dx: 3,  dy: 2, ch: 's' },
        { dx: 5,  dy: 2, ch: 's' }, { dx: 6,  dy: 2, ch: 's' }, { dx: 7,  dy: 2, ch: 's' },
        { dx: 8,  dy: 2, ch: 's' }, { dx: 9,  dy: 2, ch: 's' }, { dx: 10, dy: 2, ch: 's' },
        { dx: 12, dy: 2, ch: 's' }, { dx: 13, dy: 2, ch: 's' }, { dx: 14, dy: 2, ch: 's' },
        { dx: 15, dy: 2, ch: 's' }, { dx: 16, dy: 2, ch: 's' },
        { dx: 1,  dy: 3, ch: 's' }, { dx: 2,  dy: 3, ch: 's' }, { dx: 3,  dy: 3, ch: 's' },
        { dx: 5,  dy: 3, ch: 's' }, { dx: 6,  dy: 3, ch: 's' }, { dx: 7,  dy: 3, ch: 's' },
        { dx: 8,  dy: 3, ch: 's' }, { dx: 9,  dy: 3, ch: 's' }, { dx: 10, dy: 3, ch: 's' },
        { dx: 12, dy: 3, ch: 's' }, { dx: 13, dy: 3, ch: 's' }, { dx: 14, dy: 3, ch: 's' },
        { dx: 15, dy: 3, ch: 's' }, { dx: 16, dy: 3, ch: 's' },
        // (cross-aisle at dy=4)
        { dx: 1,  dy: 5, ch: 's' }, { dx: 2,  dy: 5, ch: 's' }, { dx: 3,  dy: 5, ch: 's' },
        { dx: 5,  dy: 5, ch: 's' }, { dx: 6,  dy: 5, ch: 's' }, { dx: 7,  dy: 5, ch: 's' },
        { dx: 8,  dy: 5, ch: 's' }, { dx: 9,  dy: 5, ch: 's' }, { dx: 10, dy: 5, ch: 's' },
        { dx: 12, dy: 5, ch: 's' }, { dx: 13, dy: 5, ch: 's' }, { dx: 14, dy: 5, ch: 's' },
        { dx: 15, dy: 5, ch: 's' }, { dx: 16, dy: 5, ch: 's' },
        { dx: 1,  dy: 6, ch: 's' }, { dx: 2,  dy: 6, ch: 's' }, { dx: 3,  dy: 6, ch: 's' },
        { dx: 5,  dy: 6, ch: 's' }, { dx: 6,  dy: 6, ch: 's' }, { dx: 7,  dy: 6, ch: 's' },
        { dx: 8,  dy: 6, ch: 's' }, { dx: 9,  dy: 6, ch: 's' }, { dx: 10, dy: 6, ch: 's' },
        { dx: 12, dy: 6, ch: 's' }, { dx: 13, dy: 6, ch: 's' }, { dx: 14, dy: 6, ch: 's' },
        { dx: 15, dy: 6, ch: 's' }, { dx: 16, dy: 6, ch: 's' },
        { dx: 1,  dy: 7, ch: 's' }, { dx: 2,  dy: 7, ch: 's' }, { dx: 3,  dy: 7, ch: 's' },
        { dx: 5,  dy: 7, ch: 's' }, { dx: 6,  dy: 7, ch: 's' }, { dx: 7,  dy: 7, ch: 's' },
        { dx: 8,  dy: 7, ch: 's' }, { dx: 9,  dy: 7, ch: 's' }, { dx: 10, dy: 7, ch: 's' },
        { dx: 12, dy: 7, ch: 's' }, { dx: 13, dy: 7, ch: 's' }, { dx: 14, dy: 7, ch: 's' },
        { dx: 15, dy: 7, ch: 's' }, { dx: 16, dy: 7, ch: 's' },
        // Stage at dy=8..9: lectern + chalkboard centered, full-width
        // counter row south. 'k' (chalkboard) at dy=8 next to lectern
        // is solid — students see it from all rows.
        { dx: 8,  dy: 8, ch: 'c' }, // lectern
        { dx: 9,  dy: 8, ch: 'k' }, // chalkboard (was at dy=9)
        { dx: 0,  dy: 9, ch: 'R' }, { dx: 1,  dy: 9, ch: 'R' }, { dx: 2,  dy: 9, ch: 'R' },
        { dx: 3,  dy: 9, ch: 'R' }, { dx: 4,  dy: 9, ch: 'R' }, { dx: 5,  dy: 9, ch: 'R' },
        { dx: 6,  dy: 9, ch: 'R' }, { dx: 7,  dy: 9, ch: 'R' }, { dx: 8,  dy: 9, ch: 'R' },
        { dx: 9,  dy: 9, ch: 'R' }, { dx: 10, dy: 9, ch: 'R' }, { dx: 11, dy: 9, ch: 'R' },
        { dx: 12, dy: 9, ch: 'R' }, { dx: 13, dy: 9, ch: 'R' }, { dx: 14, dy: 9, ch: 'R' },
        { dx: 15, dy: 9, ch: 'R' }, { dx: 16, dy: 9, ch: 'R' }, { dx: 17, dy: 9, ch: 'R' },
      ],
    },

    {
      id: 'cancerCenter',
      lockedUntilLevel: 9,
      ...CANCER_CENTER,
      // South door at offset 5 → world (56, 14). The room sits on the
      // top edge of the map north of Prior Auth's footprint, so a west
      // door would have required a corridor at x=50 carving through
      // Prior Auth's east wall (PA spans y=3..12). Routing through the
      // south wall instead keeps Prior Auth sealed: the east-wing
      // trunk now tops out at (50, 14) and an east-going connector
      // at y=14 reaches the door at (56, 14).
      doors: [{ side: 'S', offset: 5 }],
      // Oncology infusion suite + supportive-care wing. The room
      // canon-named in the Chemo Bundle Specter Case (#200) finally
      // exists in the world. Layout: north row of infusion bays
      // (H beds), staff station mid-room (c/h pairs), pharmacy
      // counter at the east end (R), waiting/consult area south.
      // Interior 26×10 (dx 0..25, dy 0..9). Door entry at
      // (interior dx=0, dy=4) stays open.
      items: [
        // North row — infusion bays. Six recliner-style bays
        // (H beds stand in) across the wall.
        { dx: 1,  dy: 0, ch: 'H' }, { dx: 5,  dy: 0, ch: 'H' }, { dx: 9,  dy: 0, ch: 'H' },
        { dx: 13, dy: 0, ch: 'H' }, { dx: 17, dy: 0, ch: 'H' }, { dx: 21, dy: 0, ch: 'H' },
        // Per-bay nightstand (small c desks) for IV pump tablets.
        { dx: 2,  dy: 1, ch: 'c' }, { dx: 6,  dy: 1, ch: 'c' }, { dx: 10, dy: 1, ch: 'c' },
        { dx: 14, dy: 1, ch: 'c' }, { dx: 18, dy: 1, ch: 'c' }, { dx: 22, dy: 1, ch: 'c' },
        // Mid-room staff station — RN desk + chair pairs.
        { dx: 4,  dy: 4, ch: 'c' }, { dx: 4,  dy: 5, ch: 'h' },
        { dx: 12, dy: 4, ch: 'c' }, { dx: 12, dy: 5, ch: 'h' },
        { dx: 20, dy: 4, ch: 'c' }, { dx: 20, dy: 5, ch: 'h' },
        // East-end pharmacy + drug-prep counter + sample fridge.
        { dx: 25, dy: 1, ch: 'R' }, { dx: 25, dy: 2, ch: 'R' },
        { dx: 25, dy: 4, ch: 'F' }, // refrigerated storage
        { dx: 25, dy: 7, ch: 'V' }, // pneumatic-tube / dispense
        // South-end consult / waiting area — couches around a low
        // table; bulletin for support resources.
        { dx: 1,  dy: 7, ch: 'h' }, { dx: 2,  dy: 7, ch: 'h' }, { dx: 3,  dy: 7, ch: 'h' },
        { dx: 2,  dy: 8, ch: 'c' }, // coffee table
        { dx: 1,  dy: 9, ch: 'h' }, { dx: 2,  dy: 9, ch: 'h' }, { dx: 3,  dy: 9, ch: 'h' },
        { dx: 7,  dy: 9, ch: 'b' }, // bulletin / resources
        { dx: 11, dy: 9, ch: 'P' }, { dx: 17, dy: 9, ch: 'P' },
        // Whiteboard for treatment-plan posting.
        { dx: 22, dy: 9, ch: 'B' },
      ],
    },

    // ===== Outdoor — parking lot =====
    {
      id: 'outdoor',
      ...OUTDOOR,
      // No doors — the player arrives + leaves via 'O' teleport tile.
      // The room is a sealed walled rectangle so the perimeter reads
      // as building-edge / fence.
      // Floor fill: ',' = asphalt instead of the default '.' (cream
      // linoleum). Empty cells between cars + lampposts now read as
      // dark pavement, matching the tint already used under those
      // objects. Trees + benches still draw their own props on top.
      fill: ',',
      // 2026-05: cars (1=sedan, 2=SUV, 3=beater) and lampposts
      // (4=simple, 5=arched, 6=double) replaced the F-cabinet stand-ins
      // and water-cooler "lamps". 2026-05 follow-up: parking-line
      // stripes ('=') flank each car (auto-generated by withStripes
      // helper); a curb row + 2-row street runs along the south edge.
      // See /sprite-redraw-preview.html for the variant exploration.
      items: outdoorItems(),
    },

    // ===== Second floor =====
    {
      id: 'landing2F',
      ...LANDING_2F,
      // South door connects to the 2F corridor that runs out to
      // AUDIT, PAYER, and COMPLIANCE.
      doors: [{ side: 'S', offset: 4 }],
      items: [
        // Stair landing tile — teleport partner of the Main Hub 'S'.
        // Landing origin is (30,94); dx=2/dy=1 → world (33, 96),
        // matching STAIR_2F_TO_HUB.from.
        { dx: 2, dy: 1, ch: 'S' },
        { dx: 4, dy: 1, ch: 'P' },
        { dx: 4, dy: 2, ch: 'P' },
      ],
    },
    {
      id: 'audit',
      lockedUntilLevel: 32,
      ...AUDIT,
      // North door at offset 22 lines up with the 2F corridor running
      // east-west at y=99. Old (south wing) audit door + corridor stub
      // are gone with the move.
      doors: [{ side: 'N', offset: 22 }],
      // Conference room contents preserved from the south-wing era.
      items: [
        { dx: 4,  dy: 2, ch: 'h' }, { dx: 7,  dy: 2, ch: 'h' },
        { dx: 10, dy: 2, ch: 'h' }, { dx: 13, dy: 2, ch: 'h' },
        { dx: 16, dy: 2, ch: 'h' }, { dx: 19, dy: 2, ch: 'h' },
        { dx: 22, dy: 2, ch: 'h' },
        { dx: 4,  dy: 3, ch: 'c' }, { dx: 5,  dy: 3, ch: 'c' },
        { dx: 6,  dy: 3, ch: 'c' }, { dx: 7,  dy: 3, ch: 'c' },
        { dx: 8,  dy: 3, ch: 'c' }, { dx: 9,  dy: 3, ch: 'c' },
        { dx: 10, dy: 3, ch: 'c' }, { dx: 11, dy: 3, ch: 'c' },
        { dx: 12, dy: 3, ch: 'c' }, { dx: 13, dy: 3, ch: 'c' },
        { dx: 14, dy: 3, ch: 'c' }, { dx: 15, dy: 3, ch: 'c' },
        { dx: 16, dy: 3, ch: 'c' }, { dx: 17, dy: 3, ch: 'c' },
        { dx: 18, dy: 3, ch: 'c' }, { dx: 19, dy: 3, ch: 'c' },
        { dx: 20, dy: 3, ch: 'c' }, { dx: 21, dy: 3, ch: 'c' },
        { dx: 22, dy: 3, ch: 'c' },
        { dx: 4,  dy: 4, ch: 'h' }, { dx: 7,  dy: 4, ch: 'h' },
        { dx: 10, dy: 4, ch: 'h' }, { dx: 13, dy: 4, ch: 'h' },
        { dx: 16, dy: 4, ch: 'h' }, { dx: 19, dy: 4, ch: 'h' },
        { dx: 22, dy: 4, ch: 'h' },
        { dx: 1,  dy: 3, ch: 'B' },
        { dx: 25, dy: 3, ch: 'w' },
        { dx: 25, dy: 5, ch: 'P' },
        { dx: 1,  dy: 5, ch: 'F' },
      ],
    },
    {
      id: 'payer',
      lockedUntilLevel: 18,
      ...PAYER,
      // North door at offset 4 onto the 2F corridor.
      doors: [{ side: 'N', offset: 4 }],
      // Aetna/Anthem-equivalent: phone bank, fax wall, claim queue
      // monitors. The "missing fifth actor" from the intro narration
      // ("Doctors document. Coders translate. Billers submit. Payers
      // decide. Patients pay.") finally has a room.
      items: [
        { dx: 1, dy: 1, ch: 'c' }, { dx: 1, dy: 2, ch: 'h' },
        { dx: 4, dy: 1, ch: 'c' }, { dx: 4, dy: 2, ch: 'h' },
        { dx: 8, dy: 1, ch: 'c' }, { dx: 8, dy: 2, ch: 'h' },
        { dx: 12, dy: 1, ch: 'c' }, { dx: 12, dy: 2, ch: 'h' },
        // Wall of fax machines — payer's preferred denial-delivery
        // medium even in 2026.
        { dx: 1, dy: 7, ch: 'X' }, { dx: 4, dy: 7, ch: 'X' },
        { dx: 8, dy: 7, ch: 'X' }, { dx: 12, dy: 7, ch: 'X' },
        // Claim-queue / decision board.
        { dx: 15, dy: 4, ch: 'B' },
        { dx: 15, dy: 7, ch: 'F' },
      ],
    },
    {
      id: 'turquoiseLounge',
      ...TURQUOISE_LOUNGE,
      // Post-game / hidden reveal. Stays locked through the whole
      // main flow; opens after the player beats the audit boss,
      // letting Chris + Adam (the Turquoise crew, partner-vendor
      // side) appear as a "you finished the game" coda.
      lockedUntilDefeated: ['boss_audit'],
      // South door at offset 11 → world (49, 98). Just south of it
      // is (49, 99) — already on the existing 2F trunk between
      // AUDIT and PAYER, so no corridor extension is needed.
      // Interior 20×3 (dx 0..19, dy 0..2); door entry stays open
      // at interior dx=10 dy=2.
      doors: [{ side: 'S', offset: 11 }],
      // Vendor lounge — couches flanking a low coffee table on the
      // middle row, fridge + espresso bar on the south wall, wall-
      // mounted TV on the north. Wide and shallow on purpose: it's
      // a converted hallway, not a real lounge.
      items: [
        // North wall: TV + plants.
        { dx: 0, dy: 0, ch: 'P' },
        { dx: 9, dy: 0, ch: 'B' },                                                           // wall-mounted TV
        { dx: 19, dy: 0, ch: 'P' },
        // Couch row — three on the west, three on the east, with a
        // coffee table in the middle.
        { dx: 2, dy: 1, ch: 'h' }, { dx: 3, dy: 1, ch: 'h' }, { dx: 4, dy: 1, ch: 'h' },
        { dx: 9, dy: 1, ch: 'c' }, { dx: 10, dy: 1, ch: 'c' },                               // long coffee table
        { dx: 15, dy: 1, ch: 'h' }, { dx: 16, dy: 1, ch: 'h' }, { dx: 17, dy: 1, ch: 'h' },
        // South wall amenities (door entry at dx=10 dy=2 stays open).
        { dx: 1, dy: 2, ch: 'V' },                                                           // espresso/snack vending
        { dx: 5, dy: 2, ch: 'F' },                                                           // fridge / cabinets
        { dx: 18, dy: 2, ch: 'w' },                                                          // water cooler
      ],
    },
    {
      id: 'lounge2F',
      lockedUntilLevel: 8,
      ...LOUNGE_2F,
      // North door at offset 4 → world (60, 100). Opens onto the
      // 2F trunk corridor extended east past PAYER.
      doors: [{ side: 'N', offset: 4 }],
      // Staff break room for the upstairs crowd. Couches arranged
      // around a coffee table, vending + water cooler on the east
      // wall, TV-style whiteboard on the north, plants in the
      // corners. Interior 10×6; valid dx 0..9, dy 0..5.
      items: [
        // North wall: TV (whiteboard glyph) + flanking plants;
        // dx=3 left open for door entry.
        { dx: 1, dy: 0, ch: 'P' },
        { dx: 6, dy: 0, ch: 'B' },
        { dx: 9, dy: 0, ch: 'P' },
        // U-shaped seating around a coffee table (interior west
        // half). 'h' = upholstered chair / couch stand-in, 'c' =
        // low table.
        { dx: 2, dy: 2, ch: 'h' }, { dx: 3, dy: 2, ch: 'h' }, { dx: 4, dy: 2, ch: 'h' },
        { dx: 3, dy: 3, ch: 'c' },
        { dx: 2, dy: 4, ch: 'h' }, { dx: 3, dy: 4, ch: 'h' }, { dx: 4, dy: 4, ch: 'h' },
        // East cluster: vending + water cooler.
        { dx: 8, dy: 2, ch: 'V' },
        { dx: 8, dy: 4, ch: 'w' },
        // South corners.
        { dx: 1, dy: 5, ch: 'P' },
        { dx: 9, dy: 5, ch: 'P' },
      ],
    },
    {
      id: 'compliance',
      lockedUntilLevel: 31,
      ...COMPLIANCE,
      // North door at offset 16 onto a vertical stub from the 2F
      // corridor.
      doors: [{ side: 'N', offset: 16 }],
      // Compliance / HIPAA / binders. Sparse for now; meant to be a
      // dragon's-lair vibe with rows of audit binders. Real population
      // in a follow-up.
      items: [
        // North-wall binders (dx <= w-3 = 25 to stay inside interior).
        { dx: 1, dy: 1, ch: 'F' }, { dx: 2, dy: 1, ch: 'F' }, { dx: 3, dy: 1, ch: 'F' },
        { dx: 4, dy: 1, ch: 'F' }, { dx: 5, dy: 1, ch: 'F' },
        { dx: 21, dy: 1, ch: 'F' }, { dx: 22, dy: 1, ch: 'F' }, { dx: 23, dy: 1, ch: 'F' },
        { dx: 24, dy: 1, ch: 'F' }, { dx: 25, dy: 1, ch: 'F' },
        { dx: 5, dy: 4, ch: 'c' }, { dx: 5, dy: 5, ch: 'h' },
        { dx: 12, dy: 4, ch: 'c' }, { dx: 12, dy: 5, ch: 'h' },
        { dx: 20, dy: 4, ch: 'c' }, { dx: 20, dy: 5, ch: 'h' },
        { dx: 13, dy: 7, ch: 'B' }, // policy-of-the-week board
        { dx: 1, dy: 7, ch: 'P' }, { dx: 25, dy: 7, ch: 'P' },
      ],
    },
  ],
  // ## CORRIDORS ##
  corridors: [
    // L-shaped staff corridor: lobby door → north → bend east → Main Hub door.
    {
      points: [
        [LOBBY_NORTH_DOOR.x, LOBBY_NORTH_DOOR.y - 1], // (14, 29) — just north of lobby door
        [CORRIDOR_BEND.x,    CORRIDOR_BEND.y],        // (14, 13) — bend point
        [HUB_SOUTH_DOOR.x,   CORRIDOR_BEND.y],        // (30, 13) — just south of hub door
      ],
      width: 1,
    },
    // South-wing trough: a single east-west corridor at y=49 that
    // every south-wing room's north door opens onto, plus the
    // vertical run from the lobby's new south door down to it.
    {
      points: [
        [LOBBY_SOUTH_DOOR.x, LOBBY_SOUTH_DOOR.y + 1], // (18, 42) — just south of lobby south door
        [LOBBY_SOUTH_DOOR.x, SW_TROUGH_Y],             // (18, 49) — bend
      ],
      width: 1,
    },
    {
      points: [
        [HIM.x + 7, SW_TROUGH_Y],            // east-west cross-corridor, anchored to HIM's door col
        [LECTURE_HALL.x + 12, SW_TROUGH_Y],  // (68, 49) — extends east past LAB to the lecture-hall wraparound col
      ],
      width: 1,
    },
    // Lecture Hall wraparound: vertical run from SW trough to the
    // lecture hall's north door, going EAST of LAB (x=68) so the
    // path doesn't cut through the clinical lab.
    {
      points: [
        [LECTURE_HALL.x + 12, SW_TROUGH_Y],            // (68, 49) — junction with trough
        [LECTURE_HALL.x + 12, LECTURE_HALL.y - 1],     // (68, 57) — just north of the lecture hall door
      ],
      width: 1,
    },
    // West-wing corridors. The main lobby↔hub corridor used to dead-
    // end at the bend (14, 13). Two new segments extend it into the
    // new wing:
    //   1. North extension at x=14 from the bend (14, 13) up to
    //      (14, 4) — passes the cafeteria's east door at (13, 4).
    //   2. East-west cross-corridor at y=12, from the main corridor
    //      west to (5, 12) — connects the kitchen + lounge north
    //      doors. (Was y=10 when the cafeteria was shorter; moved
    //      with the cafeteria south wall when it expanded.)
    {
      points: [
        [CORRIDOR_BEND.x, CORRIDOR_BEND.y], // (14, 13) — bend (already on the lobby↔hub corridor)
        [CORRIDOR_BEND.x, CAFETERIA.y + 2], // (14, 4) — just east of the cafeteria east door
      ],
      width: 1,
    },
    {
      points: [
        [CORRIDOR_BEND.x, KITCHEN.y - 1], // (14, 12) — junction with the north-extension
        [KITCHEN.x + 3,   KITCHEN.y - 1], // (5, 12)  — just north of the kitchen N door
      ],
      width: 1,
    },
    // (Old AUDIT stub corridor removed — AUDIT moved to second floor.)

    // East-wing spur: from Registration's east door east to the trunk.
    // Registration east door world coords: (REGISTRATION.x + REGISTRATION.w - 1,
    // REGISTRATION.y + 4) = (37, 21). Trunk is at x=50.
    {
      points: [
        [REGISTRATION.x + REGISTRATION.w, REGISTRATION.y + 4], // (37, 21) — just east of door
        [RADIOLOGY.x - 1,                 REGISTRATION.y + 4], // (50, 21) — junction with trunk
      ],
      width: 1,
    },
    // East-wing trunk: vertical corridor at x=50 connecting all three
    // east-wing rooms' west doors. Top endpoint sits at y=14 — south
    // of Prior Auth's footprint (PA spans y=3..12) so its east wall
    // stays intact.
    {
      points: [
        [CANCER_CENTER.x - 1, CANCER_CENTER.y + 12], // (50, 14) — south of Prior Auth
        [MED_RECORDS.x - 1,   MED_RECORDS.y + 5],    // (50, 42) — med-records door row
      ],
      width: 1,
    },
    // Cancer Center connector: from the trunk's top endpoint east
    // along y=14 to Cancer Center's south door at (56, 14). Threads
    // just below Prior Auth (which ends at y=12).
    {
      points: [
        [CANCER_CENTER.x - 1, CANCER_CENTER.y + 12], // (50, 14) — trunk junction
        [CANCER_CENTER.x + 5, CANCER_CENTER.y + 12], // (56, 14) — cancer center S door
      ],
      width: 1,
    },
    // Second-floor connectors. The 2F is a separate region of the
    // tilemap reached via 'S' teleport; once you arrive at the
    // landing, you walk these corridors to the rooms.
    // Stub from landing's south door to the trunk.
    {
      points: [
        [LANDING_2F.x + 4, LANDING_2F.y + LANDING_2F.h], // (34, 99)
        [LANDING_2F.x + 4, AUDIT.y - 1],                 // (34, 99) — same tile (corridor stub anchor)
      ],
      width: 1,
    },
    // East-west trunk on 2F at y=99 connecting AUDIT-N + PAYER-N +
    // LOUNGE_2F-N doors, plus passing under TURQUOISE_LOUNGE's south
    // door at (49, 98).
    {
      points: [
        [AUDIT.x + 22,                         AUDIT.y - 1],     // (26, 99)
        [LOUNGE_2F.x + LOUNGE_2F.w - 1, LOUNGE_2F.y - 1],       // (67, 99)
      ],
      width: 1,
    },
    // Vertical drop from the trunk down to COMPLIANCE's N door.
    // Threads the gap between AUDIT (ends x=31) and PAYER (starts x=36).
    {
      points: [
        [LANDING_2F.x + 4, AUDIT.y - 1],         // (34, 99)
        [COMPLIANCE.x + 16, COMPLIANCE.y - 1],   // (34, 112) — just north of compliance door
      ],
      width: 1,
    },
  ],
})

// Per-cell layout overrides emitted from the map editor — empties out
// specific tiles' default obj layer (the editor's "delete" verb).
// Most maps don't need this; included here as Chansoo cleared a row
// of placeholder cells in registration + lobby during a layout pass
// (see /map-editor.html session export 2026-05-09).
const tileOverrides: Array<{ x: number; y: number; ch: string }> = [
  { x: 18, y: 19, ch: '' },
  { x: 19, y: 19, ch: '' },
  { x: 20, y: 19, ch: '' },
  { x: 21, y: 19, ch: '' },
  { x: 7,  y: 34, ch: '' },
]

// ## LEVEL_1_MAP ##
export const LEVEL_1_MAP: MapDef = {
  width: WIDTH,
  height: HEIGHT,
  layout: applyTileOverrides(layout, tileOverrides),
  tileMeta,
  roomDefs: BUILT_ROOMS,
  // Player spawns near the south of the lobby, looking up toward the chairs.
  playerStart: { x: LOBBY.x + 10, y: LOBBY.y + LOBBY.h - 3 },
  // Minimap labels — abbreviated by default, full names on click.
  rooms: [
    { name: 'MAIN HUB',         shortName: 'HUB',  ...MAIN_HUB },
    { name: 'STAIRWELL',        shortName: 'STR',  ...STAIRWELL_1F },
    { name: 'PRIOR AUTH',       shortName: 'AUTH', ...PRIOR_AUTH },
    // West wing (north-of-PS).
    { name: 'CAFETERIA',        shortName: 'CAF',  ...CAFETERIA },
    { name: 'KITCHEN',          shortName: 'KIT',  ...KITCHEN },
    { name: 'LOUNGE',           shortName: 'LNG',  ...LOUNGE },
    // Mid + south rows.
    { name: 'PATIENT SERVICES', shortName: 'PT',   ...PATIENT_SVC },
    { name: 'REGISTRATION',     shortName: 'REG',  ...REGISTRATION },
    { name: 'ELIGIBILITY',      shortName: 'ELIG', ...ELIGIBILITY },
    { name: 'LOBBY',            shortName: 'LBY',  ...LOBBY },
    { name: 'HIM / CODING',     shortName: 'HIM',  ...HIM },
    { name: 'BILLING',          shortName: 'BIL',  ...BILLING },
    { name: 'PFS / PHONES',     shortName: 'PFS',  ...PFS },
    { name: 'LAB',              shortName: 'LAB',  ...LAB },
    { name: 'RADIOLOGY',        shortName: 'RAD',  ...RADIOLOGY },
    { name: 'PHARMACY',         shortName: 'PHA',  ...PHARMACY },
    { name: 'MEDICAL RECORDS',  shortName: 'REC',  ...MED_RECORDS },
    { name: 'CANCER CENTER',    shortName: 'ONC',  ...CANCER_CENTER },
    // Public-event rooms.
    { name: 'AUDITORIUM',       shortName: 'AUD2', ...AUDITORIUM },
    { name: 'LECTURE HALL',     shortName: 'LEC',  ...LECTURE_HALL },
    // Outdoor — parking lot, reached via 'O' teleport from lobby.
    { name: 'PARKING LOT',      shortName: 'OUT',  ...OUTDOOR },
    // Second floor.
    { name: '2F LANDING',       shortName: '2F',   ...LANDING_2F },
    { name: 'AUDIT CONFERENCE', shortName: 'AUD',  ...AUDIT },
    { name: 'PAYER OFFICE',     shortName: 'PAY',  ...PAYER },
    { name: 'STAFF LOUNGE 2F',  shortName: 'LN2',  ...LOUNGE_2F },
    { name: 'TURQUOISE LOUNGE', shortName: 'TQ',   ...TURQUOISE_LOUNGE },
    { name: 'COMPLIANCE',       shortName: 'CMP',  ...COMPLIANCE },
  ],
  stairs: [
    STAIR_HUB_TO_2F, STAIR_2F_TO_HUB,
    EXIT_LOBBY_OUT,  EXIT_OUT_LOBBY,
  ],
  // ## NPC_PLACEMENTS ##
  npcPlacements: [
    // === Facing convention ===
    // `facing` defaults to 'down' (front-facing toward the camera)
    // when omitted. We avoid 'up' (back-of-head) on placement —
    // back-facing reads weird unless an NPC is genuinely working
    // at a wall-mounted thing, which none currently are. Facing
    // is static — applied once at spawn from this field.

    // === Always-present (level-agnostic) placements ===
    // Anjali walks in during the level-1 opening sequence and lands
    // on the player's column, three tiles north of spawn. Default
    // 'down' so she greets Chloe head-on.
    { npcId: 'anjali',   tileX: LOBBY.x + 10,       tileY: LOBBY.y + 4 },
    // === Per-level placements ===
    // Day-one mentor pass: at L1-2, Kim / Jordan gather in the front-
    // of-house (lobby + main hub) because their dedicated rooms
    // (Registration, Eligibility) don't unlock until L3. From L3
    // onwards they disperse to their stations.
    { npcId: 'kim',    tileX: LOBBY.x + 22, tileY: LOBBY.y + 5, facing: 'left',
      levels: [1, 2] },
    { npcId: 'jordan', tileX: MAIN_HUB.x + 9, tileY: MAIN_HUB.y + 5,
      levels: [1, 2] },

    // Dana — pulled from L1-32 because her in-game NPC presence
    // collided with the "Dana's notebook" briefing voice that runs
    // across every Case. She returns at L33 (and only L33) standing
    // on the auditorium stage where the boss intake plays out. The
    // auditorium — a public-facing event room, full house — frames
    // the audit as the company-wide reckoning it is, rather than
    // a private back-office meeting.
    { npcId: 'dana', tileX: AUDITORIUM.x + 17, tileY: AUDITORIUM.y + 4, facing: 'left',
      levels: [32] },

    // Kim — Registration counter (L3+, once the room unlocks).
    // Default 'down' so she faces the lobby-side approach.
    { npcId: 'kim', tileX: REGISTRATION.x + 4, tileY: REGISTRATION.y + 2,
      levels: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32] },

    // Jordan — Eligibility (L3-19) at the kiosk; PFS (L20+, when
    // PFS room opens) at the desk row. Both spots she's facing
    // right (the F cabinet at eligibility, the water cooler at PFS).
    { npcId: 'jordan', tileX: ELIGIBILITY.x + 5, tileY: ELIGIBILITY.y + 3, facing: 'right',
      levels: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] },
    { npcId: 'jordan', tileX: PFS.x + 6, tileY: PFS.y + 5, facing: 'right',
      levels: [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32] },

    // Pat — Registration (L3-4) faces left; HIM for L5 (bundling chart
    // handoff) and L7-32, default 'down' at the desk row.
    { npcId: 'pat', tileX: REGISTRATION.x + 14, tileY: REGISTRATION.y + 4, facing: 'left',
      levels: [3, 4] },
    { npcId: 'pat', tileX: HIM.x + 5, tileY: HIM.y + 5,
      levels: [5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32] },

    // Alex — Main Hub (L1-11, minus L4) faces right toward Martinez;
    // Billing (L13+, once the room unlocks and Cal clears the corridor)
    // default 'down' at the EDI desk row. At L4 (Stoploss Reckoner) he
    // steps out to the parking lot — see the OUTDOOR placement below and
    // alex_stoploss_intake for why.
    { npcId: 'alex', tileX: MAIN_HUB.x + 4, tileY: MAIN_HUB.y + 4, facing: 'right',
      levels: [1, 2, 3, 5, 6, 7, 8, 9, 10, 11] },
    // L4 only — Alex out in the parking lot (drive aisle, near the lobby
    // teleport arrival at (16, 67)), getting air over the trauma case.
    { npcId: 'alex', tileX: OUTDOOR.x + 18, tileY: OUTDOOR.y + 6, facing: 'down',
      levels: [4] },
    // Outdoor case-givers — each stands in the parking lot for their
    // level so the descent lands in the jungle WR parallel (like Alex at
    // L4). Non-ambient + listed before their ambient placements so they
    // win de-dup at their case level.
    { npcId: 'records_clerk', tileX: OUTDOOR.x + 16, tileY: OUTDOOR.y + 6, facing: 'down', levels: [6] },
    { npcId: 'payer_rep',     tileX: OUTDOOR.x + 22, tileY: OUTDOOR.y + 6, facing: 'down', levels: [10, 28] },
    { npcId: 'dr_ethan',      tileX: OUTDOOR.x + 28, tileY: OUTDOOR.y + 6, facing: 'down', levels: [16] },
    { npcId: 'dr_priya',      tileX: OUTDOOR.x + 12, tileY: OUTDOOR.y + 6, facing: 'down', levels: [22] },
    // Indoor givers needing an accessible spot at their case level
    // (home room locked / NPC filtered out). Placed in the case's
    // obstacle room so the descent spawns in-room.
    { npcId: 'liana',            tileX: MAIN_HUB.x + 6,    tileY: MAIN_HUB.y + 5,    facing: 'down',  levels: [2] },
    { npcId: 'payer_supervisor', tileX: PATIENT_SVC.x + 4, tileY: PATIENT_SVC.y + 3, facing: 'right', levels: [11] },
    { npcId: 'dr_park',          tileX: HIM.x + 8,         tileY: HIM.y + 5,         facing: 'down',  levels: [24] },
    { npcId: 'alex', tileX: BILLING.x + 5, tileY: BILLING.y + 5,
      levels: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32] },

    // Sam — Patient Services. Repositioned north of her old desk
    // tile (closer to the door) so Chloe meets her on entry rather
    // than at the back wall.
    { npcId: 'sam', tileX: PATIENT_SVC.x + 9, tileY: PATIENT_SVC.y + 2 },

    // L33 audit team — north chair row (AUDIT interior dy=2, world
    // y=102). Default 'down' faces south toward the conference
    // table where Chloe sits.
    { npcId: 'auditor_carl',   tileX: AUDIT.x + 7,  tileY: AUDIT.y + 2, levels: [32] },
    { npcId: 'auditor_chen',   tileX: AUDIT.x + 13, tileY: AUDIT.y + 2, levels: [32] },
    { npcId: 'auditor_rivera', tileX: AUDIT.x + 19, tileY: AUDIT.y + 2, levels: [32] },
    { npcId: 'auditor_eddi',   tileX: AUDIT.x + 22, tileY: AUDIT.y + 2, levels: [32] },

    // === Ambient populace — atmosphere NPCs spread across the
    //     hospital. `ambient: true` bypasses the per-level
    //     npcsActive filter so they appear at every level. Each
    //     gets a single one-line dialogue (see `dialogue.ts`). ===

    // Lobby — repositioned during the editor pass. Greta (flowers)
    // is now on the east side mid-conversation; Mr. Beck is near
    // the west wall; Officer Reyes covers the SW corner; Walter
    // occupies the northern half.
    { npcId: 'walter',         tileX: LOBBY.x + 20, tileY: LOBBY.y + 2, ambient: true },
    // Officer Reyes shifted one tile east of his old spot — the
    // 'O' exit-mat tile now sits at (LOBBY.x+1, LOBBY.y+4), and
    // having him on top of it would block the teleport. Faces
    // 'left' toward the door, watching who comes through.
    { npcId: 'officer_reyes',  tileX: LOBBY.x + 2,  tileY: LOBBY.y + 4, facing: 'left', ambient: true },
    { npcId: 'flower_visitor', tileX: LOBBY.x + 24, tileY: LOBBY.y + 5, facing: 'left', ambient: true },
    // Elder patient gated [1-9] so he falls through to the
    // CANCER_CENTER infusion-bay placement at L10+.
    { npcId: 'elder_patient',  tileX: LOBBY.x + 5,  tileY: LOBBY.y + 3, ambient: true, levels: [1, 2, 3, 4, 5, 6, 7, 8] },

    // PFS — Dev faces 'left' toward the water cooler at PFS dy=5
    // dx=9 (one tile west + one tile south of him).
    { npcId: 'dev', tileX: PFS.x + 11, tileY: PFS.y + 5, facing: 'left', ambient: true },

    // Main Hub — physician floor. Priya uses the editor-confirmed
    // tile and keeps facing the player-facing side of the room.
    { npcId: 'dr_priya', tileX: 31, tileY: 5, facing: 'down', ambient: true },
    // Ethan still looks left toward the physician cluster
    // (mid-conversation about a discharge).
    { npcId: 'dr_ethan', tileX: MAIN_HUB.x + 14, tileY: MAIN_HUB.y + 8, facing: 'left', ambient: true, levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] },

    // East wing.
    //  - Rad tech faces 'right' toward the H (hospital bed) on the
    //    east side of the imaging suite.
    //  - Liana defaults to 'down' (working at the dispense counter
    //    facing the patient side).
    //  - Joe (janitor) faces 'right' toward the pull-desks.
    //  - Marisol the records clerk faces 'right' toward the
    //    pull-desk one tile east (where charts get reviewed).
    { npcId: 'rad_tech',      tileX: RADIOLOGY.x + 6,   tileY: RADIOLOGY.y + 5,   facing: 'right', ambient: true },
    // Liana — Cancer Center is L10+, Pharmacy is L12+. Since
    // Cancer Center comes first in the new ordering, Liana lives
    // there from L10 on (see ambient block further down).
    // Pharmacy stays without a dedicated NPC for now.
    // (Old PHARMACY placement removed during the 33-level migration.)
    { npcId: 'joe',           tileX: MED_RECORDS.x + 7, tileY: MED_RECORDS.y + 5, facing: 'right', ambient: true },
    { npcId: 'records_clerk', tileX: MED_RECORDS.x + 4, tileY: MED_RECORDS.y + 5, facing: 'right', ambient: true },

    // 2F.
    //  - Theresa (payer rep) faces 'right' toward Diane.
    //  - Diane (supervisor) faces 'left' toward Theresa, mirror.
    //  - Theo faces 'right' toward the east cluster of binders.
    // payer_rep — payer office opens at L19, lives there through
    // the end. (No L33 auditorium fork in the 33-level remap —
    // the boss room is full enough with Dana + the auditors.)
    { npcId: 'payer_rep',          tileX: PAYER.x + 5,      tileY: PAYER.y + 3,      facing: 'right', ambient: true, levels: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32] },
    { npcId: 'payer_supervisor',   tileX: PAYER.x + 12,     tileY: PAYER.y + 3,      facing: 'left',  ambient: true },
    { npcId: 'compliance_officer', tileX: 41, tileY: 118, facing: 'right', ambient: true, levels: [31, 32] },

    // Outdoor — parking lot ambient. Smoker NPCs are *outdoor-only*
    // by design (cigarette is part of the sprite); placing them
    // indoors would read as a HIPAA violation, not atmosphere.
    //  - Earl looks 'left' (random — out into the lot).
    //  - Sandra looks 'right' (different direction from Earl for
    //    visual variety).
    //  - Cassie the paramedic looks 'right' across the lot.
    //  - Chase the bike EMT just rolled in on his bike — looks
    //    'left' away from Cassie's rig.
    { npcId: 'smoker_visitor',   tileX: OUTDOOR.x + 25, tileY: OUTDOOR.y + 10, facing: 'left',  ambient: true },
    { npcId: 'smoker_outdoor_b', tileX: OUTDOOR.x + 35, tileY: OUTDOOR.y + 14, facing: 'right', ambient: true },
    { npcId: 'paramedic',        tileX: OUTDOOR.x + 8,  tileY: OUTDOOR.y + 14, facing: 'right', ambient: true },
    { npcId: 'bike_emt',         tileX: OUTDOOR.x + 14, tileY: OUTDOOR.y + 8,  facing: 'left',  ambient: true },

    // Cafeteria — service staff behind the counter, a server
    // working the dining floor. Cafeteria moved from a 22×13 SE
    // footprint to a 12×8 NW one; positions resized to match.
    //  - Manny mans the hot line on the north counter row.
    //  - Yvette sits at the register on the same row, facing down.
    //  - Reggie roams the dining floor.
    { npcId: 'cafeteria_worker', tileX: CAFETERIA.x + 3, tileY: CAFETERIA.y + 2, ambient: true },
    { npcId: 'cashier',          tileX: 11, tileY: 4, facing: 'down', ambient: true },
    { npcId: 'server',           tileX: CAFETERIA.x + 7, tileY: CAFETERIA.y + 5, ambient: true },

    // Lab — Roni runs the bench. She's standing between the second
    // and third microscope desks (interior dx=5, dy=2 — clear floor
    // tile), facing 'right' toward the desk + sample binders.
    { npcId: 'lab_tech', tileX: LAB.x + 6, tileY: LAB.y + 3, facing: 'right', ambient: true },

    // Turquoise Lounge — partner-vendor break room. Chris and Adam
    // standing on the couch row at dy=1; both default 'down' so
    // they read as "facing the door / available to talk" rather
    // than locked in a side conversation. Editor-confirmed pose:
    // 2026-05-09. Gated behind the audit boss — the lounge is a
    // post-game reveal, so they only appear once the player has
    // beaten boss_audit (matches turquoiseLounge.lockedUntilDefeated).
    { npcId: 'chris', tileX: TURQUOISE_LOUNGE.x + 7,  tileY: TURQUOISE_LOUNGE.y + 2,
      ambient: true, requiresDefeated: ['boss_audit'] },
    { npcId: 'adam',  tileX: TURQUOISE_LOUNGE.x + 14, tileY: TURQUOISE_LOUNGE.y + 2,
      ambient: true, requiresDefeated: ['boss_audit'] },

    // 2026-05 cast pass — fill the late-game rooms (added in PR #217)
    // and the previously-unpopulated 1F break rooms / Prior Auth.
    // Most placements use `levels: [N+]` filters so they appear only
    // once the room phase-unlocks (matching the room's
    // `lockedUntilLevel`). Some duplicate existing roster NPCs into
    // these new rooms — acceptable while the cast is small; we'll
    // give the duplicates dedicated sprites in a follow-up if any
    // read as visibly twinned.

    // Cancer Center — oncology nurse + an infusion-bay patient.
    // Unlocks at L10 (Lighthouse).
    { npcId: 'liana',         tileX: CANCER_CENTER.x + 14, tileY: CANCER_CENTER.y + 5,  facing: 'down',  ambient: true, levels: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32] },
    { npcId: 'elder_patient', tileX: CANCER_CENTER.x + 5,  tileY: CANCER_CENTER.y + 1,  facing: 'down',  ambient: true, levels: [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32] },

    // Lecture Hall — attendee seated mid-audience.
    // Unlocks at L19 (Reaper).
    { npcId: 'dr_ethan',      tileX: LECTURE_HALL.x + 14,  tileY: LECTURE_HALL.y + 5,   facing: 'down',  ambient: true, levels: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32] },

    // Auditorium — only opens at L33 (boss). dr_park joins Dana on
    // stage; the auditors take the chairs (see AUDIT placements
    // above). compliance_officer + payer_rep are NOT in the
    // auditorium in the 33-level shape — they stay at their
    // primary stations.
    { npcId: 'dr_park',            tileX: AUDITORIUM.x + 5,  tileY: AUDITORIUM.y + 3, facing: 'down', ambient: true, levels: [32] },

    // Prior Auth — staff PA specialist at the desk. Unlocks at L5
    // (Gatekeeper).
    { npcId: 'martinez',      tileX: 48, tileY: 6, facing: 'left', ambient: true, levels: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32] },

    // 1F Lounge — break-room ambient. Unlocks at L9.
    { npcId: 'noah',          tileX: 9, tileY: 15, facing: 'right', ambient: true, levels: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32] },

    // SW-corridor blocker — Cal stands in the south-wing trough
    // corridor (y=49, the east-west run that connects HIM / Billing /
    // PFS / Lab / Lecture Hall) just east of where the lobby south-
    // door corridor descends at x=18. Blocks eastward passage at
    // L1-12; gone at L13 (Swarm) so the player can reach Alex in
    // Billing. HIM (west of the descent, L9) is reachable from L9
    // onwards regardless.
    { npcId: 'maintenance_worker', tileX: 21, tileY: SW_TROUGH_Y, facing: 'left',
      ambient: true, levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },

    // (Kitchen stays unpopulated — back-of-house is invisible-by-design.)

    // Main Hub — extra hospitalist, joins the existing physician
    // crowd. Faces 'right' toward the hub bulletin / colleagues.
    { npcId: 'dr_park',          tileX: MAIN_HUB.x + 3,  tileY: MAIN_HUB.y + 2, facing: 'right', ambient: true, levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17] },
  ],
}
