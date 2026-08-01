// NPC id → contact-sheet slot mapping. Sheets live in
// `sprite-source/npcs/` (npc1.png … npc20.png); the build script
// `tools/process-npc-sheets.sh` extracts each cell into
// `public/sprites/npcs-raw/{slot}_{0..3}.png` (4 directional poses).
//
// BootScene reads this map at preload-time and registers each NPC's
// front-facing PNG as `npc_<id>` (plus _down/_left/_right/_up for
// future use). The map editor + sprite-library page also import
// this module so they can resolve "which sheet cell does this NPC
// live in" without dragging Phaser into their bundles.
//
// Keep this file in sync when:
//   - A new contact sheet drops (extend the table below)
//   - A new NPC role is cast (add an entry mapping id → slot)
//   - An NPC's sprite is reassigned (change the slot)
//
// SMOKER WARNING: any sprite where the cigarette is part of the
// pose (npc14_4, npc16_1, npc18_1, npc20_2) is *outdoor-only* by
// design. Indoor placement reads as a HIPAA violation, not
// atmosphere. NPC ids that prefix `smoker_` flag the constraint.

export const NPC_SOURCES: Record<string, string> = {
  // Canonical roster — drives existing dialogue + placement.
  dana:     'npc5_1',
  kim:      'npc3_1',
  jordan:   'npc3_2',
  pat:      'npc5_0',
  alex:     'npc5_2',
  sam:      'npc3_3',
  martinez: 'npc1_0',
  anjali:   'npc2_1',
  carl:     'npc5_3',
  chen:     'npc2_2',
  rivera:   'npc3_0',
  eddi:     'npc2_3',
  // Round 1 — sheets npc1.png … npc5.png ambient roster.
  liana:         'npc1_1', // nurse (blue scrubs)
  dr_priya:      'npc1_2', // surgeon (green scrubs)
  dev:           'npc1_3', // orderly (teal scrubs)
  walter:        'npc2_0', // elderly patient
  dr_ethan:      'npc4_0', // physician (white coat)
  officer_reyes: 'npc4_1', // security
  joe:           'npc4_2', // janitor
  noah:          'npc4_3', // visitor
  // SW-corridor blocker. Reuses joe's janitor slot — both read as
  // facilities staff, and the player only ever sees one of them in
  // frame at a time (Cal in the SW trough corridor at L1-6, Joe in
  // Med Records at all levels but L1 doesn't unlock Med Records yet).
  maintenance_worker: 'npc4_2',
  // Round 2 — sheets npc6.png … npc15.png (May 2026 batch).
  rad_tech:           'npc7_0',  // Radiology: female tech, white coat + pony-tail
  records_clerk:      'npc11_0', // Med Records: woman in tan jacket
  payer_rep:          'npc15_4', // 2F Payer: woman with headset (phones)
  payer_supervisor:   'npc14_3', // 2F Payer: woman in navy + bun (admin)
  compliance_officer: 'npc11_3', // 2F Compliance: silver-haired in blazer
  smoker_visitor:     'npc14_4', // Outdoor: bearded man in cap (smoker — outdoor only)
  // Round 3 — sheets npc16.png … npc20.png (May 2026 batch 2).
  smoker_outdoor_b:   'npc20_2', // Outdoor: woman in overalls (smoker — outdoor only)
  paramedic:          'npc19_1', // Outdoor: female EMT with EMS bag
  flower_visitor:     'npc17_1', // Lobby: visitor with bouquet
  elder_patient:      'npc20_3', // Lobby: elderly bearded man with cane
  // Round 4 — Cafeteria + a few back-fills from the uncast pool.
  cafeteria_worker:   'npc9_3',  // white apron + cap (cook)
  cashier:            'npc13_1', // apron, runs the register
  server:             'npc13_4', // waiter vest
  bike_emt:           'npc17_2', // Outdoor (alt EMT, helmet + green jacket)
  dr_park:            'npc7_1',  // Main Hub: physician with glasses, white coat
  lab_tech:           'npc10_2', // West wing LAB: dark scrubs, glasses
  // Round 5 — single-character sheets (npc21–26). Each sheet has
  // exactly one character, so the slot row is always _0. The build
  // script (process-npc-sheets.sh) re-shapes the python output into
  // the canonical `npc<N>_0_<dir>.png` filename, regardless of
  // whether the source sheet was a 4×1 strip (orange chroma) or
  // a 2×2 grid (green chroma).
  chansoo:  'npc21_0', // Data Sandbox: bearded glasses + dark coat
  nicole:   'npc22_0', // Data Sandbox: blonde, navy cardigan + ID
  nick:     'npc23_0', // Data Sandbox: stubble, dark sweater + ID
  monika:   'npc24_0', // Data Sandbox: brunette, black turtleneck + lanyard
}
