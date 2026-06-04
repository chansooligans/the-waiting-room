# The Waiting Room

An educational top-down RPG that teaches the US healthcare revenue cycle. You play Chloe, an analyst on her first shift at Mercy General. Walk the hospital, talk to your colleagues, and — when a denied claim slides across your desk — descend into the Waiting Room: the surreal place beneath the building where lost claims, missing modifiers, and unsigned authorizations go.

**[Play it](https://chansooligans.github.io/the-waiting-room/)** · **[Case Prototypes](https://chansooligans.github.io/the-waiting-room/prototypes.html)** · **[Dev Tools](https://chansooligans.github.io/the-waiting-room/dev.html)**

> **Glossary.** A **Case** is the player-side problem solved in a single encounter — what older notes called a "problem." A **Case Prototype** is one self-contained HTML page exercising that Case end-to-end. There are 32 of them; the catalog is the index.

## What you'll learn

The game progressively teaches across 10 levels:

- Claim forms (CMS-1500, UB-04) and X12 transactions (270/271 eligibility, 837 claim, 835 ERA, 278 prior auth)
- Coding (ICD-10-CM/PCS, CPT, HCPCS Level II, modifiers, NCCI edits)
- CARC/RARC denial codes — what they mean, what's appealable, what's a real billing error
- Prior authorization, coordination of benefits, the Medicare 2-midnight rule, the No Surprises Act + IDR
- Contract mechanics — case rates, per-diem, stoploss provisions, implant carve-outs, drug-pricing (ASP/WAC/340B)
- Compliance — HIPAA, RAC audits, MRF transparency, charity care under §501(r)

Each Case ends with a recap: the key concepts you just exercised + links to the canonical regulation or guidance (CMS / HHS / HRSA / eCFR).

## How to play

**Desktop**
- **Arrow keys / WASD** — Move
- **E / Space** — Talk to NPCs, interact with objects, advance dialogue
- **ESC** — Skip intro cutscene; back out of menus
- **Backtick (`~`)** — Open the in-game dev panel (auto-on in `npm run dev`)

**Mobile / touch**
- Virtual D-pad (bottom-left) for movement
- **E** button (bottom-right) to interact
- **ESC** button (top-right) to skip intro
- Dialogue choices, Case verbs, and inline glossary terms all respond to taps

Walk the lobby, take the stairs to the second floor, and keep your eyes open for objects to examine — every desk, cabinet, plant, parked car, and exam table has its own short flavor note in one of seven voice registers (procedural fragment, overheard quote, lowercase narrative, patient perspective, Lynchian aside, etc.). Talking to a colleague who hands you a Case will descend you into the Waiting Room for the encounter.

## Cases — the encounter framework

The 32 Case Prototypes share a chassis (`src/shared/prototype-base.ts`) and a common shape: a hospital intro, a brief register-flip into the Waiting Room, three issues to resolve via three verbs, and a recap on completion.

Cases are organized by **district**, each with its own accent color:

| District | Color | What it teaches |
|---|---|---|
| Eligibility (mint) | `#7ee2c1` | Coverage, COB, prior auth, identity matching, credentialing |
| Coding (orange) | `#f0a868` | Medical necessity, modifiers, HCC capture, form selection, CPT licensing |
| Billing (rose) | `#ef5b7b` | Underpayments, stoploss, drug pricing, NSA carve-outs, surprise bills |
| Appeals (purple) | `#b18bd6` | Timely filing, RAC defense, IDR, 340B, audit response |
| Release-valve (yellow) | `#e8c074` | Charity care, no-show policies — patient-facing, restorative |

Archetypes you'll meet: **Wraith** (medical-necessity citation chains), **Bundle** (modifier 25), **Reaper** (timely-filing countdowns), **Specter** (hidden underpayments behind CO-45), **Spider** (COB cascades), **Mire** (regulatory swamps), **Crucible** (baseball-arbitration IDR), **Phantom** (carve-out routing), **Audit Boss** (the finale). The names track real procedural failure modes — see the catalog for the full bestiary.

The map progresses in **phases**. At L1 you can only access the Lobby, Main Hub, and the Cafeteria. The stairwell to 2F is locked until you finish L4 — so the upstairs rooms (Audit Conference, Payer Office, Compliance, Turquoise Lounge, 2F Lounge) are out of reach for the first stretch of the game. The 2F rooms keep their own per-level locks (Lounge L6, Audit / Payer L7, Compliance L8). The **Turquoise Lounge** is a post-game reveal — Chris and Adam show up there only after you've beaten the audit boss. The other 1F rooms — Patient Services, Eligibility, Registration, HIM, Billing, the Cancer Center, the Auditorium where the boss waits — unlock as your `currentLevel` advances. You can see the locked doors on the minimap; you just can't enter them yet.

## Tech stack

- **Phaser 3** + **TypeScript** + **Vite**
- 16×16 procedural pixel-art for hospital props (drawn at runtime in `BootScene.makeHospitalTiles` via Phaser's `Graphics` API; per-tile tints + per-room floor variants reskin the same source textures)
- 64×64 PNG sprites for Chloe + NPCs, generated from a LoRA-trained Stable Diffusion pipeline and cleaned with `tools/sprite-sheet-to-frames.py` (chroma-key removal, halo erosion, blob filter, downscale)
- One MP3 per intro voiceover beat under `public/audio/intro/`; ambient music for Hospital + Waiting Room registers

### Adding a new NPC

The NPC pipeline expects a 4-row × 4-column contact sheet on a black, orange, or green chroma background. The current production prompt (drops into ChatGPT, output goes to `sprite-source/npcs/npcN.png`) is in `reference/sprite-cleanup.md` along with the cleanup parameter cheat-sheet. Workflow:

```bash
# 1. Generate sheet → sprite-source/npcs/npc27.png
# 2. Run the cleanup
bash tools/process-npc-sheets.sh
# 3. Add the slot mapping in src/scenes/npcSources.ts
# 4. Place the NPC in src/content/maps/level1.ts (npcPlacements[])
```

For warm-chroma sheets (orange), pass `--no-global-erase` to preserve face detail — the dominance-based pass eats skin pixels otherwise. See `reference/sprite-cleanup.md` for the full parameter notes.

## Development

```bash
npm install
npm run dev          # Dev server on localhost:5173
npm run build        # Production build to dist/
npx tsc --noEmit     # Type-check
```

## Dev tools

Single index page: **[`/dev.html`](https://chansooligans.github.io/the-waiting-room/dev.html)** — one card per tool, with descriptions. Bookmark it.

Everything ships alongside the game on the same Vite + GitHub Pages deploy:

| Page | What it does |
|---|---|
| **`/map-editor.html`** | Visual editor for `level1.ts`'s placed objects + NPCs. Drag to move, F flips, R cycles facing. Outputs paste-back `tileMeta` + `tileOverrides` + `npcPlacements`. |
| **`/intro-editor.html`** | Beat-by-beat intro cinematic editor. Voiceover scrubber per text beat, drag-and-drop cover art, "open game at this beat" deep-link, paste-back TS export. |
| **`/level-editor.html`** | Drag-reorder the 32 Cases. Planning surface for the "one level per case" narrative re-work. Reads `src/content/case-order.ts`; outputs paste-back `CASE_ORDER` array. |
| **`/sprites.html`** | Sprite library + mapping UI. NPC tab grouped by character type with active-in-game badges and per-cell remap dropdowns. |
| **`/prototypes.html`** | Case Prototypes catalog. One playable HTML per Case, with collapsible per-card recap content (key concepts + further-reading links). |
| **`/sprite-redraw-preview.html`** | Click-to-pick gallery of 16×16 sprite variants (cars, lampposts, recliners, etc.). Each variant rendered on canvas with the same Phaser primitives `BootScene` uses, so what you see is what the game renders. |
| **`/room-redraw-preview.html`** | Click-to-pick gallery of full-room layouts (parking lot, lecture hall, lobby, etc.). Walls + doors + props rendered to canvas at game scale. |
| **In-game dev panel** | Backtick (`~`) in any scene. Save presets per level, jump-to-room teleports, chart-pull toggles, copy/paste/clear save. Auto-on in `npm run dev`; append `?dev=1` on the deployed site if you need it. |

URL deep-links: `/?introBeat=N` jumps the cinematic to beat N (used by the intro editor's "open at this beat" button).

## Project structure

```
src/
├── main.ts                       # Phaser config, scene registry
├── types.ts                      # Game types
├── state.ts                      # Save/load via localStorage; level progression
├── scenes/                       # Phaser scenes
│   ├── BootScene.ts              # Procedural sprite generators (hospital tiles, NPCs)
│   ├── IntroScene.ts             # Comic-page cinematic + voiceover
│   ├── TitleScene.ts             # Title screen
│   ├── HospitalScene.ts          # Top-down hospital, NPC interaction, fog-of-war
│   ├── DialogueScene.ts          # Speaker-color dialogue overlay
│   ├── PuzzleBattleScene.ts      # In-game encounter mechanic dispatch
│   ├── FormScene.ts              # Claim-form workbench (CMS-1500 / UB-04)
│   ├── WaitingRoomScene.ts       # The supernatural register
│   ├── CodexScene.ts             # Concept reference / glossary
│   ├── TouchOverlay.ts           # Mobile virtual d-pad + interact button
│   ├── hospitalFlavor.ts         # Tile flavor text (~620 lines, 7 voice registers)
│   ├── objectSources.ts          # Object texture-key fallback colors
│   └── npcSources.ts             # NPC id → contact-sheet slot map
├── content/                      # Game data
│   ├── levels.ts                 # 10 levels: title, npcsActive, encounters, cases
│   ├── cases.ts                  # In-game Case data (claim forms, errors, etc.)
│   ├── case-recaps.ts            # Post-victory recap data — single source of
│   │                             #   truth for both the Case prototypes AND the
│   │                             #   prototype catalog cards
│   ├── enemies.ts                # In-game encounter / obstacle data
│   ├── dialogue.ts               # Dialogue trees keyed by speaker
│   ├── npcs.ts                   # NPC display names + descriptions
│   ├── codex.ts                  # Concept index for the Codex scene
│   ├── abilities.ts              # In-game player tools / abilities
│   ├── mapBuilder.ts             # MapDef compiler: rooms + corridors → tile grid
│   └── maps/level1.ts            # The hospital map (rooms, doors, items, NPCs)
├── runtime/puzzle/               # Verb-puzzle runtime + Case specs
├── shared/prototype-base.ts      # Shared chassis for the Case prototypes:
│                                 #   district colors, BASE_CSS, escape(),
│                                 #   renderCaseRecap()
├── prototypes/main.ts            # Case Prototypes catalog page
├── <case>-prototype/main.ts      # 32 Case prototypes — one dir each
│                                 #   (wraith, idr-crucible, two-midnight-mire, …)
├── map-editor/                   # Map-editor page
├── intro-editor/                 # Intro-editor page
├── level-editor/                 # Case-order editor page
├── dev/                          # In-game dev panel
└── store/                        # State store helpers

public/
├── sprites/                      # Player + NPC PNGs (LoRA pipeline)
├── intro/                        # Cinematic comic pages
├── audio/                        # Voiceover MP3s + ambient tracks
└── *.html                        # Dev-tool entry points

reference/                        # Authoring + design references
├── analysis/                     # Critical essays on the work
├── curriculum/                   # Learning-objective design
├── narrative/                    # Story design
├── puzzles/                      # Puzzle-design notes
└── sprite-cleanup.md             # NPC pipeline runbook + parameter cheatsheet

tools/                            # Build-time helpers (sprite cleanup, etc.)
```

## Deploy

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on every push to `main`. Pages source must be set to **GitHub Actions** in repo Settings → Pages.

## Reference

- **`reference/sprite-cleanup.md`** — full NPC pipeline including the LoRA prompt, chroma-key parameters, and per-character notes
- **`reference/CLAUDE.md`** — the working brief used while authoring the game
- **`reference/analysis/`** — critical essays (film-analyst register, literary-criticism register) on the work as a literary object
- **`reference/curriculum/`**, **`narrative/`**, **`puzzles/`** — design notes per discipline

## License

Open source educational game.
