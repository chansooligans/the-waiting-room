// Dev jump panel. Toggled by `~` (backtick) or the small DEV chip.
// Lists level presets + room/scene shortcuts and a "clear save"
// button.
//
// Available automatically in dev (`vite dev`). In production builds
// it can be opted-in by appending `?dev=1` to the URL — useful for
// QA on the deployed site without shipping a new build. Anything
// other than `0`/`false`/empty enables it.

import { getState, loadGame, newGame, saveGame } from '../state'
import { clearHospitalFog } from '../scenes/HospitalScene'
import { ACTIVE_LEVELS } from '../content/levels'
import type { GameState } from '../types'

const PANEL_ID = '__dev_panel__'
const TOGGLE_ID = '__dev_panel_toggle__'
const STYLE_ID = '__dev_panel_style__'

function isDevPanelEnabled(): boolean {
  if (import.meta.env.DEV) return true
  try {
    const v = new URLSearchParams(location.search).get('dev')
    if (v === null) return false
    return v !== '0' && v.toLowerCase() !== 'false' && v !== ''
  } catch {
    return false
  }
}

export function installDevPanel() {
  if (!isDevPanelEnabled()) return
  if (document.getElementById(STYLE_ID)) return

  const style = document.createElement('style')
  style.id = STYLE_ID
  style.textContent = CSS
  document.head.appendChild(style)

  // Tiny always-on FAB for mobile (and as a desktop discoverability
  // hint). Clicking it has the same effect as pressing backtick.
  const toggle = document.createElement('button')
  toggle.id = TOGGLE_ID
  toggle.textContent = 'DEV'
  toggle.setAttribute('aria-label', 'Toggle dev panel')
  document.body.appendChild(toggle)

  const panel = document.createElement('div')
  panel.id = PANEL_ID
  panel.className = 'devp hidden'
  panel.innerHTML = renderPanel()
  document.body.appendChild(panel)

  const togglePanel = () => {
    panel.classList.toggle('hidden')
    // When opening, refresh the state inspector so it reflects what's
    // happening RIGHT NOW (rather than what was true at panel mount).
    if (!panel.classList.contains('hidden')) {
      const slot = panel.querySelector('#__devp_state__') as HTMLElement | null
      if (slot) slot.innerHTML = renderStateInspector()
    }
  }

  panel.addEventListener('click', e => {
    const target = e.target as HTMLElement
    const action = target.closest('[data-dev-action]') as HTMLElement | null
    if (!action) return
    handleAction(action.dataset.devAction!, action.dataset.devArg)
  })

  toggle.addEventListener('click', e => {
    e.preventDefault()
    e.stopPropagation()
    togglePanel()
  })

  document.addEventListener('keydown', e => {
    // `~` (or backtick) toggles the panel. Skip when the player is
    // typing somewhere — though there are no inputs in-game today.
    if (e.key !== '`' && e.key !== '~') return
    const t = e.target as HTMLElement | null
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return
    e.preventDefault()
    togglePanel()
  })
}

function renderPanel(): string {
  return `
    <div class="devp-h">
      <span class="devp-tag">DEV PANEL</span>
      <span class="devp-hint">\` to toggle</span>
    </div>
    <section>
      <div class="devp-section-h">State inspector
        <button class="devp-mini-btn" data-dev-action="refresh-state">refresh</button>
      </div>
      <div class="devp-state" id="__devp_state__">${renderStateInspector()}</div>
    </section>
    <section>
      <div class="devp-section-h">Save presets</div>
      ${LEVEL_PRESETS.map(p => {
        const off = !ACTIVE_LEVELS.includes(p.level)
        return `
        <button class="devp-btn" data-dev-action="preset" data-dev-arg="${p.level}"${off ? ' style="opacity:0.5"' : ''}>
          ${p.label} <span class="devp-id">(${p.note})</span>${off ? ' <span class="devp-id" style="color:#ef5b7b">· skipped</span>' : ''}
        </button>
      `}).join('')}
    </section>
    <section>
      <div class="devp-section-h">Jump to scene</div>
      <button class="devp-btn" data-dev-action="scene" data-dev-arg="Title">Title</button>
      <button class="devp-btn" data-dev-action="scene" data-dev-arg="Hospital">Hospital</button>
      <button class="devp-btn" data-dev-action="scene" data-dev-arg="WaitingRoom">Waiting Room (free-roam)</button>
      <button class="devp-btn" data-dev-action="wr-boss">Waiting Room @ AUDIT (boss)</button>
    </section>
    <section>
      <div class="devp-section-h">Jump to room</div>
      ${ROOM_JUMPS.map(r => `
        <button class="devp-btn" data-dev-action="jump-room" data-dev-arg="${r.id}">
          ${r.label} <span class="devp-id">(${r.x},${r.y})</span>
        </button>
      `).join('')}
    </section>
    <section>
      <div class="devp-section-h">Chart pulls</div>
      <button class="devp-btn" data-dev-action="charts" data-dev-arg="pull-all">Pull all charts</button>
      <button class="devp-btn" data-dev-action="charts" data-dev-arg="pull-co_97">Pull L5 op-note (co_97)</button>
      <button class="devp-btn" data-dev-action="charts" data-dev-arg="pull-co_50">Pull L11 echo (co_50)</button>
      <button class="devp-btn warn" data-dev-action="charts" data-dev-arg="clear">Clear all charts</button>
    </section>
    <section>
      <div class="devp-section-h">Skip into intro</div>
      ${INTRO_BEATS.map(b => `
        <button class="devp-btn" data-dev-action="intro-skip" data-dev-arg="${b.beat}">
          ${b.label} <span class="devp-id">(beat ${b.beat})</span>
        </button>
      `).join('')}
    </section>
    <section>
      <div class="devp-section-h">Map</div>
      <button class="devp-btn" data-dev-action="toggle-full-map">
        ${renderFullMapToggleLabel()}
      </button>
    </section>
    <section>
      <div class="devp-section-h">Save</div>
      <button class="devp-btn" data-dev-action="copy-save">Copy save (JSON)</button>
      <button class="devp-btn" data-dev-action="paste-save">Load save (paste JSON)</button>
      <button class="devp-btn warn" data-dev-action="clear-save">Clear save</button>
    </section>
  `
}

/** Label for the full-map-access toggle. Reads the live state so the
 *  button reflects what's currently set. Re-rendered when the panel
 *  re-renders (toggle action below restarts the Hospital scene which
 *  also re-mounts the panel — but we also overwrite the label
 *  in-place after the click). */
function renderFullMapToggleLabel(): string {
  let on = false
  try { on = !!getState().devFullMapAccess } catch { /* not booted */ }
  const tag = on ? '<b style="color:#7ee2c1">ON</b>' : '<span style="color:#5a6a7a">off</span>'
  return `Full map access ${tag} <span class="devp-id">(unlock every room)</span>`
}

/** Snapshot the most-debug-relevant fields of GameState as compact
 *  HTML rows. Re-render on demand via the 'refresh' button — auto-
 *  refresh would conflict with input focus. */
function renderStateInspector(): string {
  let s: GameState | null = null
  try { s = getState() } catch { /* not booted yet */ }
  if (!s) return `<div class="devp-row"><em>game not booted yet</em></div>`
  const row = (label: string, value: string) =>
    `<div class="devp-row"><span class="devp-row-l">${label}</span><span class="devp-row-v">${value}</span></div>`
  const truthy = (v: any) => (v ? '<b style="color:#7ee2c1">yes</b>' : '<span style="color:#5a6a7a">—</span>')
  const lastDefeat = s.defeatedObstacles[s.defeatedObstacles.length - 1] ?? '—'
  const pcs = s.pendingClaimSubmitted
    ? `${s.pendingClaimSubmitted.encounterId}` + (s.pendingClaimSubmitted.claimId ? ` · ${s.pendingClaimSubmitted.claimId}` : '')
    : '—'
  const pd = s.pendingDescent ? s.pendingDescent.encounterId : '—'
  const phs = s.pendingHospitalSpawn ? `(${s.pendingHospitalSpawn.x},${s.pendingHospitalSpawn.y})` : '—'
  const plb = s.pendingLevelBanner ?? '—'
  const charts = s.chartsPulled ?? {}
  const chartIds = Object.keys(charts).filter(k => charts[k])
  const chartsLabel = chartIds.length ? chartIds.join(', ') : '—'
  return [
    row('currentLevel', String(s.currentLevel)),
    row('defeats', `${s.defeatedObstacles.length} · last: ${lastDefeat}`),
    row('chartsPulled', chartsLabel),
    row('pendingClaimSubmitted', pcs),
    row('pendingDescent', String(pd)),
    row('pendingHospitalSpawn', phs),
    row('pendingLevelBanner', String(plb)),
    row('introOpeningPlayed', truthy(s.introOpeningPlayed)),
    row('firstWrArrivalNarration', truthy(s.firstWrArrivalNarrationPlayed)),
    row('anjaliThanked', truthy(s.anjaliThanked)),
    row('hp / maxHp', `${s.resources.hp} / ${s.resources.maxHp}`),
    row('reputation', String(s.resources.reputation)),
    row('audit', `${s.resources.auditRisk}%`),
    row('stress', String(s.resources.stress)),
  ].join('')
}

/** Save-state presets so QA can land on any level instantly without
 *  playing through. Each preset injects a save with `defeatedObstacles`
 *  populated to satisfy `LEVEL_DEFEAT_THRESHOLD` and clears any pending
 *  flags. Reloads the page so BootScene picks up the fresh state. */
type LevelPreset = {
  level: number
  label: string
  note: string
  /** Tile coords the player drops onto when this preset loads.
   *  Should land the player in (or adjacent to) the room hosting
   *  the case-handing NPC for that level — so QA isn't stuck
   *  hunting for Alex/Kim/etc. through corridors after a jump.
   *  Coords mirror level1.ts room centers; verify if rooms move. */
  spawn: { x: number; y: number }
}
// Tile coords cribbed from ROOM_JUMPS below so the two stay in sync.
// L8 (Martinez · gatekeeper) lives in PRIOR_AUTH which isn't in
// ROOM_JUMPS — coord (44, 8) is the room interior from level1.ts.
const LEVEL_PRESETS: LevelPreset[] = [
  { level: 1 , label: 'L1 — The Wrong Card'                     , note: 'Anjali · intro'          , spawn: { x: 14, y: 39 } },
  { level: 2 , label: 'L2 — ASP / WAC Apothecary'               , note: 'Liana · Main Hub'          , spawn: { x: 28, y: 8 } },
  { level: 3 , label: 'L3 — Eligibility Fog'                    , note: 'Kim · fog'               , spawn: { x: 22, y: 21 } },
  { level: 4 , label: 'L4 — Stoploss Reckoner'                  , note: 'Alex · parking lot'      , spawn: { x: 8, y: 37 } },
  { level: 5 , label: 'L5 — Bundling Beast'                     , note: 'Pat · bundle'            , spawn: { x: 11, y: 55 } },
  { level: 6 , label: 'L6 — Outpatient Surgery Grouper'         , note: 'Marisol · parking lot'   , spawn: { x: 8, y: 37 } },
  { level: 7 , label: 'L7 — No-Show Bill'                       , note: 'Jordan · catalog'        , spawn: { x: 28, y: 27 } },
  { level: 8 , label: 'L8 — Prior-Auth Gatekeeper'              , note: 'Martinez · gatekeeper'   , spawn: { x: 44, y: 8 } },
  { level: 9 , label: 'L9 — Lighthouse'                         , note: 'Jordan · Eligibility'        , spawn: { x: 28, y: 27 } },
  { level: 10, label: 'L10 — GFE Oracle'                        , note: 'Theresa · parking lot'   , spawn: { x: 8, y: 37 } },
  { level: 11, label: 'L11 — Medical Necessity Wraith'          , note: 'Diane · Patient Svc'            , spawn: { x: 8, y: 21 } },
  { level: 12, label: 'L12 — Documentation Sprite Swarm'        , note: 'Roni · Lab'            , spawn: { x: 29, y: 55 } },
  { level: 13, label: 'L13 — Doppelgänger'                      , note: 'Joe · Med Records'            , spawn: { x: 22, y: 21 } },
  { level: 14, label: 'L14 — Implant Carve-Out'                 , note: 'Adaeze · Radiology'          , spawn: { x: 29, y: 55 } },
  { level: 15, label: 'L15 — Credentialing Lattice'             , note: 'Dr. Park · Main Hub'           , spawn: { x: 22, y: 21 } },
  { level: 16, label: 'L16 — Carve-Out Phantom'                 , note: 'Dr. Ethan · parking lot' , spawn: { x: 8, y: 37 } },
  { level: 17, label: 'L17 — CPT Licensure Mire'                , note: 'Pat · catalog'           , spawn: { x: 11, y: 55 } },
  { level: 18, label: 'L18 — Timely Filing Reaper'              , note: 'Sam · reaper'            , spawn: { x: 8, y: 21 } },
  { level: 19, label: 'L19 — Surprise Bill Specter'             , note: 'Yvette · PFS'            , spawn: { x: 48, y: 55 } },
  { level: 20, label: 'L20 — 340B Specter'                      , note: 'Liana · Auditorium'             , spawn: { x: 35, y: 37 } },
  { level: 21, label: 'L21 — Phantom Patient'                   , note: 'Marisol · Med Records'           , spawn: { x: 22, y: 21 } },
  { level: 22, label: 'L22 — Risk Adjustment Hollow'            , note: 'Dr. Priya · parking lot' , spawn: { x: 8, y: 37 } },
  { level: 23, label: 'L23 — Chemo Bundle Specter'              , note: 'Dr. Ethan · Lecture Hall'          , spawn: { x: 29, y: 55 } },
  { level: 24, label: 'L24 — Two-Midnight Mire'                 , note: 'Dr. Park · HIM'           , spawn: { x: 11, y: 55 } },
  { level: 25, label: 'L25 — Underpayment Specter'              , note: 'Alex · CO-45'            , spawn: { x: 29, y: 55 } },
  { level: 26, label: 'L26 — COB Cascade Spider'                , note: 'Kim · catalog'           , spawn: { x: 22, y: 21 } },
  { level: 27, label: 'L27 — Case-Rate Specter'                 , note: 'Diane · Payer'          , spawn: { x: 29, y: 55 } },
  { level: 28, label: 'L28 — MRF Cartographer'                  , note: 'Theresa · parking lot'   , spawn: { x: 8, y: 37 } },
  { level: 29, label: 'L29 — IDR Crucible'                      , note: 'Sam · catalog'           , spawn: { x: 8, y: 21 } },
  { level: 30, label: 'L30 — OB Per-Diem Specter'               , note: 'Dr. Priya · Main Hub'         , spawn: { x: 31, y: 8 } },
  { level: 31, label: 'L31 — HIPAA Spider'                      , note: 'Theo · Compliance'           , spawn: { x: 8, y: 21 } },
  { level: 32, label: 'L32 — The Quarterly Audit'               , note: 'Dana · Audit Rm (2F)'        , spawn: { x: 18, y: 105 } },
]

/** Hospital-scene room teleports. Each entry sets
 *  `state.pendingHospitalSpawn` to a known interior tile then restarts
 *  the Hospital scene — the scene's create() reads pendingHospitalSpawn
 *  and drops the player there. Coordinates mirror level1.ts; verify
 *  these stay inside room interiors when rooms move.
 *
 *  All charted encounters that need the chart pull live near
 *  MED_RECORDS so the dev workflow is: jump to Med Records, press
 *  E on any F binder, jump to the relevant case-handing NPC's room. */
const ROOM_JUMPS: { id: string; label: string; x: number; y: number }[] = [
  // Ground floor
  { id: 'lobby',         label: 'Lobby (spawn)',     x: 14, y: 39 },
  { id: 'mainHub',       label: 'Main Hub',          x: 28, y: 8  },
  { id: 'patientSvc',    label: 'Patient Services',  x: 8,  y: 21 },
  { id: 'registration',  label: 'Registration',      x: 22, y: 21 },
  { id: 'eligibility',   label: 'Eligibility',       x: 28, y: 27 },
  { id: 'him',           label: 'HIM / Coding',      x: 11, y: 55 },
  { id: 'billing',       label: 'Billing',           x: 29, y: 55 },
  { id: 'pfs',           label: 'PFS / Phones',      x: 48, y: 55 },
  // East wing
  { id: 'radiology',     label: 'Radiology',         x: 58, y: 20 },
  { id: 'pharmacy',      label: 'Pharmacy',          x: 58, y: 31 },
  { id: 'medRecords',    label: 'Medical Records',   x: 58, y: 42 },
  // Second floor
  { id: 'landing2F',     label: '2F Landing',        x: 32, y: 96 },
  { id: 'audit',         label: 'AUDIT Conference',  x: 18, y: 105 },
  { id: 'payer',         label: 'Payer Office',      x: 44, y: 105 },
  { id: 'compliance',    label: 'Compliance',        x: 32, y: 117 },
  // Outdoor
  { id: 'outdoor',       label: 'Parking Lot',       x: 16, y: 78 },
]

/** Encounter id used to mark the "previous level done" for each
 *  level transition. Order matches LEVEL_DEFEAT_THRESHOLD = [1,2,…]. */
const PRESET_DEFEAT_SEQUENCE = [
  'intro_wrong_card',                   // L1  The Wrong Card
  'catalog_asp_wac_apothecary',         // L2  ASP / WAC Apothecary
  'eligibility_fog',                    // L3  Eligibility Fog
  'catalog_stoploss_reckoner',          // L4  Stoploss Reckoner
  'co_97',                              // L5  Bundling Beast
  'catalog_outpatient_surgery_grouper', // L6  Outpatient Surgery Grouper
  'catalog_no_show_bill',               // L7  No-Show Bill
  'co_197',                             // L8  Prior-Auth Gatekeeper
  'lighthouse_charity',                 // L9  Lighthouse
  'catalog_gfe_oracle',                 // L10  GFE Oracle
  'co_50',                              // L11  Medical Necessity Wraith
  'co_16_swarm',                        // L12  Documentation Sprite Swarm
  'co_18_doppelganger',                 // L13  Doppelgänger
  'catalog_implant_carveout_specter',   // L14  Implant Carve-Out
  'catalog_credentialing_lattice',      // L15  Credentialing Lattice
  'catalog_carveout_phantom',           // L16  Carve-Out Phantom
  'catalog_cpt_licensure_mire',         // L17  CPT Licensure Mire
  'co_29_reaper',                       // L18  Timely Filing Reaper
  'surprise_bill_specter',              // L19  Surprise Bill Specter
  'catalog_three_forty_b_specter',      // L20  340B Specter (swapped with L30)
  'catalog_phantom_patient',            // L21  Phantom Patient
  'catalog_risk_adj_hollow',            // L22  Risk Adjustment Hollow
  'catalog_chemo_bundle_specter',       // L23  Chemo Bundle Specter
  'catalog_two_midnight_mire',          // L24  Two-Midnight Mire
  'underpayment_specter',               // L25  Underpayment Specter
  'catalog_cob_cascade_spider',         // L26  COB Cascade Spider
  'catalog_case_rate_specter',          // L27  Case-Rate Specter
  'catalog_mrf_cartographer',           // L28  MRF Cartographer
  'catalog_idr_crucible',               // L29  IDR Crucible
  'catalog_ob_perdiem_specter',         // L30  OB Per-Diem Specter (swapped with L20)
  'catalog_hipaa_spider',               // L31  HIPAA Spider
  'boss_audit',                         // L32  The Quarterly Audit
]

/** Intro skip-to anchors. Indexes into BEATS in introBeats.ts — pick
 *  a beat and IntroScene.init reads `skipToBeat: N` from the scene-
 *  start payload and jumps in. Voice counter is pre-advanced so the
 *  right narration MP3 still fires.
 *
 *  Indices were stale (off by 2–4) after showGap was removed from the
 *  beat list and the WR-section narration was rewritten — these now
 *  map to the actual scene-action / cover beat positions in
 *  introBeats.ts.BEATS as of 2026-05. Re-verify whenever beats
 *  change. */
const INTRO_BEATS: { beat: number; label: string }[] = [
  { beat: 0,  label: 'Cover splash' },
  { beat: 1,  label: '"$215" hook' },
  { beat: 5,  label: 'Hospital pan' },
  { beat: 12, label: 'Your desk' },
  { beat: 17, label: 'The vanishing' },
  { beat: 26, label: 'Waiting Room reveal' },
  { beat: 35, label: '"They call it"' },
  { beat: 37, label: 'End covers' },
]

function buildPresetSave(targetLevel: number): string {
  const lvl = Math.max(1, Math.min(33, targetLevel))
  // Progression only counts enabled levels (the ENABLED_LEVELS toggle in
  // levels.ts). To land the player AT `lvl` ready to take its case, seed
  // one defeat per *enabled* level below it — that satisfies
  // checkLevelProgression's position-based threshold. Disabled levels
  // below `lvl` contribute no defeat (they're skipped in the flow).
  const enabledBelow = ACTIVE_LEVELS.filter(a => a < lvl)
  const defeats = enabledBelow.map(a => PRESET_DEFEAT_SEQUENCE[a - 1])
  const levelComplete = Array(33).fill(false)
  for (const a of enabledBelow) levelComplete[a - 1] = true
  // Drop the player at the room that hosts this level's case NPC so QA
  // isn't hunting through corridors after every jump. Falls back to the
  // lobby if a preset is missing its spawn (shouldn't happen — type is
  // required — but defensive in case the table goes out of sync).
  const preset = LEVEL_PRESETS.find(p => p.level === lvl)
  const spawn = preset?.spawn ?? { x: 14, y: 39 }
  const state = {
    currentLevel: lvl,
    levelComplete,
    levelStars: Array(33).fill(0),
    resources: { hp: 100, maxHp: 100, cash: 0, reputation: 50, auditRisk: 0, stress: 0 },
    tools: ['submit_837p', 'eligibility_270', 'claim_scrubber', 'cdi_query', 'appeal_letter'],
    codexUnlocked: [],
    decisions: [],
    inWaitingRoom: false,
    activeTickets: [],
    defeatedObstacles: defeats,
    wingsUnlocked: ['eligibility'],
    obstaclesSeen: [],
    formsPerfected: [],
    introOpeningPlayed: lvl > 1,
    firstWrArrivalNarrationPlayed: lvl > 1,
    anjaliThanked: lvl > 1,
    pendingAnjaliLeave: false,
    // Pending level banner so Hospital surfaces the orientation hint
    // ('Find Kim at the Registration desk', etc.) the moment the
    // preset takes effect — otherwise the player lands in the lobby
    // with no signal about where the level's case lives. Skip for
    // L1 since the L1 banner has nothing to advertise (Anjali walks
    // up to you).
    pendingLevelBanner: lvl > 1 ? lvl : null,
    pendingClaimSubmitted: null,
    // Preset starts with no charts pulled — QA testing the gated
    // descent loop should walk to Medical Records explicitly. Use
    // the "Pull all charts" button to bypass when that's the goal.
    chartsPulled: {},
    // Land the player at the case room's spawn tile (see LEVEL_PRESETS).
    // HospitalScene.create() consumes this on next mount.
    pendingHospitalSpawn: spawn,
  }
  return JSON.stringify(state)
}

const SAVE_KEY = 'denial_dungeon_save'

function handleAction(action: string, arg?: string) {
  const game = (window as any).__PHASER_GAME__ as Phaser.Game | undefined
  if (!game) return
  const sm = game.scene
  switch (action) {
    case 'intro-skip': {
      if (!arg) return
      const beat = parseInt(arg, 10)
      if (Number.isNaN(beat)) return
      stopAllScenes(sm)
      sm.start('Intro', { skipToBeat: beat })
      hidePanel()
      return
    }
    case 'scene': {
      if (!arg) return
      stopAllScenes(sm)
      sm.start(arg)
      hidePanel()
      return
    }
    case 'clear-save': {
      try {
        localStorage.removeItem(SAVE_KEY)
        // Reset the in-memory state to defaults so the running game
        // doesn't keep behaving like the cleared save was still there.
        newGame()
        // Also clear the in-memory fog-of-war cache so the next
        // Hospital entry starts fully hidden.
        clearHospitalFog()
        stopAllScenes(sm)
        sm.start('Title')
        hidePanel()
      } catch (err) {
        alert('Could not clear save: ' + (err as Error).message)
      }
      return
    }
    case 'copy-save': {
      try {
        const raw = localStorage.getItem(SAVE_KEY) ?? ''
        if (!raw) {
          alert('No save in localStorage.')
          return
        }
        // Pretty-print so it's readable when pasted into a doc/snippet.
        const pretty = JSON.stringify(JSON.parse(raw), null, 2)
        navigator.clipboard.writeText(pretty).then(
          () => alert('Save copied to clipboard.'),
          () => {
            // Fallback: show in a textarea the user can manually copy
            // from. Some browsers (or non-https contexts) reject
            // navigator.clipboard.
            promptCopyFallback(pretty)
          },
        )
      } catch (err) {
        alert('Could not read save: ' + (err as Error).message)
      }
      return
    }
    case 'paste-save': {
      const incoming = prompt('Paste a save JSON blob:')
      if (!incoming) return
      try {
        // Validate it's parseable JSON before writing.
        JSON.parse(incoming)
        localStorage.setItem(SAVE_KEY, incoming)
        // Refresh in-memory state from the new save and jump to
        // Hospital so the change takes effect without a page reload.
        loadGame()
        stopAllScenes(sm)
        sm.start('Hospital')
        hidePanel()
      } catch (err) {
        alert('Invalid JSON: ' + (err as Error).message)
      }
      return
    }
    case 'preset': {
      if (!arg) return
      const lvl = parseInt(arg, 10)
      if (Number.isNaN(lvl)) return
      try {
        localStorage.setItem(SAVE_KEY, buildPresetSave(lvl))
        // Refresh in-memory state from the just-written save (so the
        // running game uses it without a page reload — page reload
        // would bounce through Intro / Title) and jump straight to
        // Hospital with the active level applied.
        loadGame()
        stopAllScenes(sm)
        sm.start('Hospital')
        hidePanel()
      } catch (err) {
        alert('Could not save preset: ' + (err as Error).message)
      }
      return
    }
    case 'refresh-state': {
      const slot = document.getElementById('__devp_state__')
      if (slot) slot.innerHTML = renderStateInspector()
      return
    }
    case 'jump-room': {
      if (!arg) return
      const room = ROOM_JUMPS.find(r => r.id === arg)
      if (!room) return
      try {
        const state = getState()
        state.pendingHospitalSpawn = { x: room.x, y: room.y }
        // Save so the new spawn survives a reload — also lets the
        // running Hospital.create() pick it up via getState() rather
        // than relying on a side channel.
        // (saveGame imported below.)
        saveGame()
        stopAllScenes(sm)
        sm.start('Hospital')
        hidePanel()
      } catch (err) {
        alert('Could not jump: ' + (err as Error).message)
      }
      return
    }
    case 'wr-boss': {
      // 2F obstacles are unreachable from WR free-roam (WR doesn't
      // process stairs), so the boss has its own jump that starts
      // WR with the boss as the active encounter and spawns the
      // player inside the audit mirror room.
      try {
        stopAllScenes(sm)
        sm.start('WaitingRoom', {
          activeEncounterId: 'boss_audit',
          spawnTileX: 18,
          spawnTileY: 105,
        })
        hidePanel()
      } catch (err) {
        alert('Could not jump to boss: ' + (err as Error).message)
      }
      return
    }
    case 'toggle-full-map': {
      try {
        const state = getState()
        state.devFullMapAccess = !state.devFullMapAccess
        saveGame()
        // Restart Hospital so applyUnlocks() picks up the new flag —
        // the layout flip happens in HospitalScene.create().
        stopAllScenes(sm)
        sm.start('Hospital')
        hidePanel()
      } catch (err) {
        alert('Could not toggle full map access: ' + (err as Error).message)
      }
      return
    }
    case 'charts': {
      if (!arg) return
      const state = getState()
      state.chartsPulled ??= {}
      if (arg === 'pull-all') {
        for (const id of GATED_CHART_ENCOUNTERS) state.chartsPulled[id] = true
      } else if (arg === 'clear') {
        state.chartsPulled = {}
      } else if (arg.startsWith('pull-')) {
        const id = arg.slice('pull-'.length)
        state.chartsPulled[id] = true
      }
      saveGame()
      const slot = document.getElementById('__devp_state__')
      if (slot) slot.innerHTML = renderStateInspector()
      return
    }
  }
}

/** Encounter ids whose descent is gated on a chart pull. Mirrors the
 *  `PULL_BY_LEVEL` map in HospitalScene.tryChartPull — keep in sync
 *  when adding new gated cases. */
const GATED_CHART_ENCOUNTERS: string[] = ['co_97', 'co_50']

function promptCopyFallback(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.cssText =
    'position:fixed; inset:50% 0 0 50%; transform:translate(-50%,-50%); ' +
    'width:560px; height:300px; z-index:9999; padding:8px; ' +
    'font:11px/1.4 ui-monospace, Menlo, monospace; background:#0e1420; ' +
    'color:#d8dee9; border:1px solid #2a3142;'
  document.body.appendChild(ta)
  ta.select()
  alert("Couldn't copy automatically. Hit Cmd/Ctrl-C to copy from the textarea, then click OK to dismiss.")
  ta.remove()
}

function stopAllScenes(sm: Phaser.Scenes.SceneManager) {
  // Stop everything that's currently active so the destination starts
  // clean. Otherwise overlays from the previous scene linger.
  const active = sm.getScenes(true)
  for (const s of active) sm.stop(s.scene.key)
}

function hidePanel() {
  document.getElementById(PANEL_ID)?.classList.add('hidden')
}

const CSS = `
  #${TOGGLE_ID} {
    position: fixed;
    top: 8px;
    right: 8px;
    z-index: 9998;
    background: rgba(14, 20, 32, 0.85);
    color: #f0a868;
    border: 1px solid #2a3142;
    border-radius: 999px;
    padding: 4px 10px;
    font: 700 10px/1 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    letter-spacing: 0.12em;
    cursor: pointer;
    opacity: 0.5;
    transition: opacity 0.15s;
  }
  #${TOGGLE_ID}:hover, #${TOGGLE_ID}:active {
    opacity: 1;
  }
  /* Touch devices: bump the chip up to a real tap target so it
     doesn't require fingertip surgery to hit. ~44pt-ish. */
  @media (pointer: coarse) {
    #${TOGGLE_ID} {
      top: 10px;
      right: 10px;
      padding: 10px 16px;
      font-size: 14px;
      opacity: 0.85;
    }
  }
  /* Touch panel buttons get bigger too — small mono buttons are
     basically untappable on a phone. */
  @media (pointer: coarse) {
    #${PANEL_ID} {
      width: min(92vw, 360px);
      font-size: 14px;
    }
    #${PANEL_ID} .devp-btn {
      padding: 10px 12px;
      margin-bottom: 6px;
      font-size: 13px;
    }
    #${PANEL_ID} .devp-section-h {
      font-size: 12px;
    }
  }
  #${PANEL_ID} {
    position: fixed;
    top: 12px;
    right: 12px;
    width: 280px;
    max-height: calc(100vh - 24px);
    overflow: auto;
    z-index: 9999;
    background: #0e1420;
    color: #d8dee9;
    border: 1px solid #2a3142;
    border-radius: 8px;
    padding: 12px 14px;
    font: 12px/1.4 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    box-shadow: 0 12px 32px rgba(0,0,0,0.5);
  }
  #${PANEL_ID}.hidden { display: none; }
  #${PANEL_ID} .devp-h {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px dashed #2a3142;
  }
  #${PANEL_ID} .devp-tag {
    font-weight: 700;
    color: #f0a868;
    letter-spacing: 0.08em;
  }
  #${PANEL_ID} .devp-hint {
    color: #6c7585;
    font-size: 10px;
  }
  #${PANEL_ID} section {
    margin-bottom: 10px;
  }
  #${PANEL_ID} .devp-section-h {
    color: #6c7585;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 6px;
  }
  #${PANEL_ID} .devp-btn {
    display: block;
    width: 100%;
    text-align: left;
    background: #1a2030;
    color: #d8dee9;
    border: 1px solid #2a3142;
    border-radius: 4px;
    padding: 6px 10px;
    margin-bottom: 4px;
    cursor: pointer;
    font: inherit;
  }
  #${PANEL_ID} .devp-btn:hover {
    background: #232b3a;
    border-color: #3a4658;
  }
  #${PANEL_ID} .devp-btn.warn {
    color: #ef5b7b;
    border-color: #4a2530;
  }
  #${PANEL_ID} .devp-id {
    color: #6c7585;
    font-size: 10.5px;
    margin-left: 4px;
  }
  #${PANEL_ID} .devp-mini-btn {
    float: right;
    background: transparent;
    color: #7ee2c1;
    border: 1px solid #2a3142;
    border-radius: 3px;
    padding: 1px 6px;
    margin-top: -2px;
    cursor: pointer;
    font: 9px/1 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    letter-spacing: 0.06em;
    text-transform: lowercase;
  }
  #${PANEL_ID} .devp-mini-btn:hover { background: #1a2030; }
  #${PANEL_ID} .devp-state {
    background: #07090e;
    border: 1px solid #1f2632;
    border-radius: 4px;
    padding: 6px 8px;
    font: 10.5px/1.4 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    color: #b8c0cc;
  }
  #${PANEL_ID} .devp-row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 1px 0;
    border-bottom: 1px dotted #1f2632;
  }
  #${PANEL_ID} .devp-row:last-child { border-bottom: none; }
  #${PANEL_ID} .devp-row-l { color: #6c7585; }
  #${PANEL_ID} .devp-row-v {
    color: #d8dee9;
    text-align: right;
    font-feature-settings: "tnum";
    overflow-wrap: anywhere;
  }
  @media (pointer: coarse) {
    #${PANEL_ID} .devp-state { font-size: 12px; }
    #${PANEL_ID} .devp-mini-btn { font-size: 12px; padding: 4px 10px; }
  }
`
