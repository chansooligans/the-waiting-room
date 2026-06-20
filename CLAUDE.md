# The Waiting Room

## What This Is
A turn-based hospital RPG that teaches the US healthcare revenue cycle.
Built with Phaser 3 + TypeScript + Vite. Deployable on GitHub Pages.

## The Game
You're a revenue cycle analyst at Mercy General Hospital. A routine claim
vanishes. You discover "The Waiting Room" — a surreal bureaucratic
underworld beneath the hospital where every claim ever filed still
exists.

**Dual reality**: Hospital (Animal-Crossing cozy — dialogue, form
puzzles, codex; no combat). Waiting Room (Terry-Gilliam-meets-Spirited-
Away — battles against surreal procedural obstacles like Medical
Necessity Wraith, Timely Filing Reaper, Bundling Beast).

## Current State
Core engine + Level-1 vertical slice in `src/scenes/`. Twelve
standalone encounter-redesign prototypes in `src/<encounter>-prototype/`
that are the active design surface — the runtime battle
system in `src/battle/` is largely frozen while the
prototypes settle. Detailed history in `git log`.

### What's Done
- [x] Scenes: Boot, Intro (comic-page + click-to-advance), Title, Hospital, Dialogue, Form, Battle, WaitingRoom, Codex
- [x] Asymmetric Level-1 hospital with fog of war + mini-map
- [x] WaitingRoomScene visual treatment — Twin Peaks Red Room: burgundy stage, B&W checker floor, red curtain walls, gold-cream HUD
- [x] Game state with persistent stress + forward-compat save migration
- [x] Battle dispatch (`MechanicController`): simple, investigation, timed
- [x] `ClaimSheet` panel — realistic CMS-1500 with disputed boxes + payer note
- [x] 12 tools, 12 encounters, 5 PatientCases, 7 NPCs, 22 codex entries
- [x] **Twelve encounter-redesign prototypes** spanning L3 → L32 — see Prototype catalog below
- [x] Shared design system in `src/shared/prototype-base.ts` — four district colors + release-valve fifth, BASE_CSS, escape helper

### What's NOT Done
- [ ] Levels 2–10 content (encounters, cases, dialogue, NPCs) — **prototypes are upstream of this**; runtime build follows once shape settles
- [ ] Hospital intrusion glimpse + form-bridge mechanic
- [ ] Decouple hospital `triggerBattle` (battles only in Waiting Room)
- [ ] More mechanics: `block`, `mirror`, `multiHead`, `blind`
- [ ] Tools visibly modify ClaimSheet fields (Phase B)
- [ ] UB-04 layout in runtime ClaimSheet (Audit prototype mocks one inline)
- [ ] L1 (intentional — no fights) and L5 (Fee Schedule Cartographer — gap archetype) prototypes
- [ ] Sound design + art polish

## Key Design Docs
- `reference/CLAUDE.md` — design-docs orientation (curriculum + narrative + prototypes)
- `reference/journal/2026-05-03-v3-the-waiting-room.md` — original full game design
- `reference/aesthetic-inspirations.md` — mood board (Twin Peaks Red Room, Brazil, Spirited Away)
- `reference/curriculum/levels/L1.md` … `L10.md` — what each level teaches

## Architecture
```
src/
├── main.ts, types.ts, state.ts
├── battle/                        Runtime battle system (largely frozen
│   ├── index.ts                   while prototypes settle)
│   ├── types.ts
│   ├── ClaimSheet.ts              CMS-1500 panel renderer
│   ├── screens.ts                 Victory + defeat overlays
│   └── mechanics/                 simple.ts, investigation.ts, timed.ts
├── content/                       Game data
│   ├── abilities.ts, enemies.ts, npcs.ts, dialogue.ts
│   ├── cases.ts, codex.ts, levels.ts
│   ├── mapBuilder.ts              Structured map types
│   ├── maps.ts, maps/levelN.ts    Per-level hospital layouts (1..5)
├── scenes/                        Phaser scenes — Boot, Intro, Title,
│                                  Hospital, Dialogue, Battle, Form,
│                                  WaitingRoom (Red Room treatment), Codex
├── shared/                        Shared prototype design system
│   └── prototype-base.ts          BASE_CSS, DISTRICT_COLORS, districtVars,
│                                  escape helper — consumed by every
│                                  encounter prototype
├── prototypes/                    Catalog index page (lives at
│                                  /prototypes.html on GitHub Pages)
└── <encounter>-prototype/         Twelve standalone single-encounter
                                   prototypes — see Prototype catalog
public/intro/                      Hand-drawn comic pages
```

## Battle Architecture (legacy runtime)
`BattleScene` selects a `MechanicController` (`simple`, `investigation`,
`timed`) via `createMechanic()`; controller owns turn logic, scene owns
rendering. `ClaimSheet` renders `PatientCase.claim` with
`highlightedBoxes` + `payerNote` overlays. Largely frozen while the
prototypes settle on the next mechanics shape — when that happens, the
runtime adopts it.

## Case Prototypes
A **Case** is the player-side problem they solve in a single encounter
(formerly called a "problem"). A **Case Prototype** is the playable
HTML page exercising that Case end-to-end. Twelve are shipped in
`src/<encounter>-prototype/` (each at `/<encounter>-prototype.html`) and
fifteen are planned. They drop HP / tools-as-damage / multiple-choice
in favor of a real CMS-1500 form + verb-space tuned per Case. Catalog
index at `/prototypes.html` (URL kept for link stability; the visible
title is "Case Prototypes").

| Level | Prototype           | District       | Verb-space                       |
|-------|---------------------|----------------|----------------------------------|
| L3    | Fog                 | Eligibility    | REVEAL → AMEND                   |
| L5    | Bundle              | Coding         | AMEND-dominant + CITE            |
| L8    | Gatekeeper          | Eligibility    | REQUEST → AMEND                  |
| L9    | Lighthouse          | Release valve  | LISTEN + SCREEN + RELEASE        |
| L11   | Wraith              | Coding         | CITE-dominant + AMEND            |
| L12   | Swarm               | Eligibility    | BATCH + sweep + patch upstream   |
| L13   | Doppelgänger        | Billing        | REPLACE + CONFIRM                |
| L18   | Reaper              | Appeals        | TIME PRESSURE + CITE + AMEND     |
| L19   | Surprise Bill       | Billing        | CLASSIFY + CALCULATE + DISPUTE   |
| L25   | Specter             | Billing        | VARIANCE + APPEAL                |
| L32   | Audit Boss          | Appeals        | RECEIPT + AMEND                  |
| —     | Hydra               | Billing        | SEQUENCE + SUBMIT × 3 (planned)  |

Each prototype builds its CSS as `districtVars(district) + BASE_CSS + customCss`
where `BASE_CSS` carries the hospital intro / register flip / briefing /
term popover / claim form / amend modal / button family / checklist /
victory shape, and `customCss` only holds prototype-specific UI
(workbench, builder, clock, queue, ERA panel, etc.). Saves ~200 lines
of CSS duplication per prototype.

The four district accent colors come from `WaitingRoomScene.ts`:
Eligibility `#7ee2c1` (mint), Coding `#f0a868` (orange), Billing
`#ef5b7b` (coral), Appeals `#b18bd6` (lavender). Lighthouse sits
outside that system as a fifth "release-valve" category with a
warm-gold accent (`#e8c074`) — the encounter is restorative, not
combative.

Detailed per-prototype design rationale lives in each file's top
docstring + the design-notes section that renders inline below the
encounter when the briefing is still on screen.

## Map System
Maps are structured Room/Corridor data in `src/content/maps/levelN.ts`,
compiled to ASCII via `mapBuilder.buildMapLayout()`. Tile legend lives
in `mapBuilder.ts` + `HospitalScene.TILE_TEXTURES`. Player spawns in
the lobby (south), walks north to reach the gap (Waiting Room portal).

## Dev Commands
```bash
npm run dev              # Dev server on :5173
npm run build            # Production build
npx tsc --noEmit         # Type-check only
```

## Game Flow
Title → Hospital (walk, talk, take form puzzles, walk to the gap) →
Waiting Room (engage obstacle markers with E) → Battle → return to
Waiting Room or Hospital depending on entry point. Hospital dialogue
can also trigger battles (legacy path; will be decoupled).

Outside the runtime game, the prototype catalog is reachable directly
at `/prototypes.html`. Each prototype is a standalone single-encounter
sketch — they don't share state with the runtime game.

## Content Pillars
The game teaches: CMS-1500 / UB-04 forms, ICD-10-CM/PCS, CPT, HCPCS,
revenue codes, modifiers (25/59/76), APR-DRG / EAPG grouping, patient
cost share waterfall, 835/ERA reading, CARC/RARC codes, X12
transactions (270/271, 278, 837, 835, 277CA).

## Design Principles
- No company branding
- Face people in the hospital, codes/forms in the Waiting Room
- Warm + surreal, not grimdark — Twin Peaks Red Room is the canonical
  reference for the Waiting Room (see `reference/aesthetic-inspirations.md`)
- Progressive disclosure: simple → complex across 10 levels
- Decisions compound: shortcuts (shadow tools, losses) raise stress
  and audit risk for the rest of the run
- Codex should be useful as a standalone reference outside the game
- Battle pedagogy uses real codes — encounters populate `caseId` +
  `highlightedBoxes` + `payerNote` so the form is the experience
- Four districts in the Waiting Room: Eligibility, Coding, Billing,
  Appeals — each with its canonical accent color (see Prototype
  catalog). Lighthouse-style restorative encounters sit outside
  the four-district system as a fifth "release valve" category.
- Hospital register is warm orange (Dana, hospital warmth — consistent
  across districts); Waiting Room register is lavender (the dreamlike
  fall, the in-between quality). District accent only shows up in
  tags / borders / structural UI, not in the two registers.
