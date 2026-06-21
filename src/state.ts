import type { GameState } from './types'
import { firstActiveLevel, nextActiveLevel, activeLevelsBefore } from './content/levels'

const SAVE_KEY = 'denial_dungeon_save'

const DEFAULT_STATE: GameState = {
  currentLevel: firstActiveLevel(),
  levelComplete: Array(33).fill(false),
  levelStars: Array(33).fill(0),
  resources: {
    hp: 100,
    maxHp: 100,
    cash: 0,
    reputation: 50,
    auditRisk: 0,
    stress: 0,
  },
  // Day-one toolkit: the basics every analyst has on their first shift.
  // Additional tools unlock from defeating obstacles (encounter
  // unlocksOnDefeat) and dialogue choices (effect.addTool).
  tools: [
    'submit_837p',
    'eligibility_270',
    'claim_scrubber',
    'cdi_query',
    'appeal_letter',
  ],
  codexUnlocked: [],
  decisions: [],
  inWaitingRoom: false,
  activeTickets: [],
  defeatedObstacles: [],
  // L1 starts with only the Eligibility wing open; later levels unlock more.
  wingsUnlocked: ['eligibility'],
  obstaclesSeen: [],
  formsPerfected: [],
  introOpeningPlayed: false,
  firstWrArrivalNarrationPlayed: false,
  anjaliThanked: false,
  pendingAnjaliLeave: false,
  pendingClaimSubmitted: null,
  chartsPulled: {},
  chartsHinted: {},
}

let currentState: GameState = loadFromStorage() ?? structuredClone(DEFAULT_STATE)

function loadFromStorage(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) return migrateState(JSON.parse(raw))
  } catch { /* ignore */ }
  return null
}

/**
 * Forward-compat migration for older saves: fill in any fields that
 * didn't exist when this save was first persisted. Idempotent.
 */
function migrateState(loaded: Partial<GameState> & Record<string, unknown>): GameState {
  const base = structuredClone(DEFAULT_STATE)
  const merged: GameState = {
    ...base,
    ...loaded,
    resources: { ...base.resources, ...(loaded.resources ?? {}) },
  }
  // Defensive: ensure new arrays exist even if the old save was partial.
  merged.activeTickets ??= []
  merged.defeatedObstacles ??= []
  merged.obstaclesSeen ??= []
  merged.formsPerfected ??= []
  merged.introOpeningPlayed ??= false
  merged.firstWrArrivalNarrationPlayed ??= false
  merged.anjaliThanked ??= false
  merged.pendingAnjaliLeave ??= false
  merged.pendingClaimSubmitted ??= null
  merged.chartsPulled ??= {}
  merged.chartsHinted ??= {}
  merged.wingsUnlocked ??= base.wingsUnlocked
  merged.tools ??= []
  // Top up the tool list with any missing default tools. Players don't
  // lose the new day-one kit just because their save predates it.
  for (const toolId of base.tools) {
    if (!merged.tools.includes(toolId)) merged.tools.push(toolId)
  }
  // Top up the per-level arrays in case the save predates a level-count
  // expansion (e.g. the 10→33 migration). Length never shrinks; missing
  // slots fill with the default value.
  while (merged.levelComplete.length < base.levelComplete.length) {
    merged.levelComplete.push(false)
  }
  while (merged.levelStars.length < base.levelStars.length) {
    merged.levelStars.push(0)
  }
  return merged
}

export function getState(): GameState {
  return currentState
}

export function setState(partial: Partial<GameState>) {
  Object.assign(currentState, partial)
}

export function updateResources(deltas: Partial<GameState['resources']>) {
  const r = currentState.resources
  if (deltas.hp !== undefined) r.hp = Math.max(0, Math.min(r.maxHp, r.hp + deltas.hp))
  if (deltas.cash !== undefined) r.cash += deltas.cash
  if (deltas.reputation !== undefined) r.reputation = Math.max(0, Math.min(100, r.reputation + deltas.reputation))
  if (deltas.auditRisk !== undefined) r.auditRisk = Math.max(0, Math.min(100, r.auditRisk + deltas.auditRisk))
  if (deltas.stress !== undefined) r.stress = Math.max(0, Math.min(100, r.stress + deltas.stress))
}

export function unlockTool(toolId: string) {
  if (!currentState.tools.includes(toolId)) {
    currentState.tools.push(toolId)
  }
}

export function unlockCodex(entryId: string) {
  if (!currentState.codexUnlocked.includes(entryId)) {
    currentState.codexUnlocked.push(entryId)
  }
}

export function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(currentState))
  } catch { /* localStorage may be unavailable */ }
}

export function loadGame(): boolean {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) {
      currentState = migrateState(JSON.parse(raw))
      return true
    }
  } catch { /* ignore */ }
  return false
}

export function newGame() {
  currentState = structuredClone(DEFAULT_STATE)
  saveGame()
}

/**
 * Level-progression thresholds. Defeating this many obstacles in
 * total advances the player to the next level. Tuned so L1 caps at
 * 2 (orientation), L2 at 4 (registration), L3 at 6 (auth), etc.
 *
 * Indexed by level — completing `LEVEL_DEFEAT_THRESHOLD[i]` defeats
 * means level (i+1) is done. So the player advances out of level 1
 * after 2 defeats, out of level 2 after 4 cumulative defeats, etc.
 */
export const LEVEL_DEFEAT_THRESHOLD: number[] = [
  1,  // L1  intro / wrong-card
  2,  // L2  asp-wac-apothecary
  3,  // L3  fog
  4,  // L4  stoploss-reckoner
  5,  // L5  bundle (Bundling Beast — swapped in from old L9)
  6,  // L6  outpatient-surgery-grouper
  7,  // L7  no-show-bill
  8,  // L8  gatekeeper (Prior-Auth — swapped in from old L5)
  9,  // L9  lighthouse
  10, // L10 gfe-oracle
  11, // L11 wraith
  12, // L12 swarm
  13, // L13 doppelganger
  14, // L14 implant-carveout-specter
  15, // L15 credentialing-lattice
  16, // L16 carveout-phantom
  17, // L17 cpt-licensure-mire
  18, // L18 reaper
  19, // L19 surprise-bill
  20, // L20 ob-perdiem-specter
  21, // L21 phantom-patient
  22, // L22 risk-adj-hollow
  23, // L23 chemo-bundle-specter
  24, // L24 two-midnight-mire
  25, // L25 specter (underpayment)
  26, // L26 cob-cascade-spider
  27, // L27 case-rate-specter
  28, // L28 mrf-cartographer
  29, // L29 idr-crucible
  30, // L30 three-forty-b-specter
  31, // L31 hipaa-spider
  32, // L32 audit-boss — capstone (form-mirror removed)
]

/**
 * Check whether the current cumulative defeat count crosses the
 * threshold for the player's current level. If so, advance
 * `currentLevel` (capped at the LEVEL_DEFEAT_THRESHOLD length) and
 * mark the prior level complete.
 *
 * Returns the new level if advanced, else null. Callers can show a
 * banner / play a sting based on the return value.
 *
 * Call this after pushing onto `defeatedObstacles` and saving.
 */
export function checkLevelProgression(): number | null {
  const defeats = currentState.defeatedObstacles.length
  const lvl = currentState.currentLevel
  // Progression walks ACTIVE_LEVELS (the enabled-level toggle in
  // levels.ts), skipping disabled levels entirely. The player only ever
  // engages active-level obstacles, so `defeats` == the number of active
  // levels cleared. To leave the active level at position `pos`
  // (0-based) the player needs `pos + 1` defeats; clearing it advances
  // to the next enabled level.
  const next = nextActiveLevel(lvl)
  if (next === null) return null            // capstone / last active level
  // `activeLevelsBefore(lvl)` is this level's 0-based position when lvl
  // is enabled; +1 is the cumulative defeats required to clear it.
  const threshold = activeLevelsBefore(lvl) + 1
  if (defeats < threshold) return null
  // Advance.
  currentState.levelComplete[lvl - 1] = true
  currentState.currentLevel = next
  // Drop a banner-pending marker — HospitalScene reads + clears
  // this on entry to surface the "Level N — <Title>" banner.
  currentState.pendingLevelBanner = currentState.currentLevel
  saveGame()
  return currentState.currentLevel
}

/**
 * Read the pending level-advance banner (if any) and clear it. Returns
 * the level number to announce, or null if no banner is pending.
 */
export function consumePendingLevelBanner(): number | null {
  const lvl = currentState.pendingLevelBanner ?? null
  if (lvl !== null) {
    currentState.pendingLevelBanner = null
    saveGame()
  }
  return lvl
}
