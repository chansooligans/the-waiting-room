// === Factions ===

export type Faction =
  | 'payer'
  | 'provider'
  | 'vendor'
  | 'patient'
  | 'employer'
  | 'system'

export const FACTION_LABEL: Record<Faction, string> = {
  payer: 'Payer',
  provider: 'Provider',
  vendor: 'Vendor',
  patient: 'Patient',
  employer: 'Employer',
  system: 'System',
}

export const FACTION_COLOR: Record<Faction, number> = {
  payer: 0x6da9e3,
  provider: 0xec8f6e,
  vendor: 0x6cd49a,
  patient: 0xf4d06f,
  employer: 0xb18bd6,
  system: 0xa3aab5,
}

// === Tools (player actions in battle) ===

export interface Tool {
  id: string
  name: string
  faction: Faction
  damage: number
  accuracy: number
  turnCost: number
  effectiveFactions: Faction[]
  effect: string
  teaches: string
  shadow?: boolean
  reputationDelta?: number
  auditDelta?: number
  cashDelta?: number
}

// === Waiting Room geography ===

/**
 * The Waiting Room is divided into thematic wings, each housing the
 * obstacles that personify that part of the revenue cycle.
 */
export type Wing =
  | 'eligibility'      // 270/271, COB, plan basics
  | 'coding'           // ICD-10, CPT, modifiers, CDI
  | 'billing'          // 837, scrubber, clearinghouse, 277CA
  | 'appeals'          // medical necessity, prior auth, timely filing
  | 'reconsideration'  // contract / fee schedule disputes
  | 'patient_services' // NSA, estimates, cost share
  | 'miracles'         // endgame / surreal

export const WING_LABEL: Record<Wing, string> = {
  eligibility: 'Eligibility',
  coding: 'Coding',
  billing: 'Billing',
  appeals: 'Appeals',
  reconsideration: 'Reconsideration',
  patient_services: 'Patient Services',
  miracles: 'Miracles',
}

// === Encounters (what you face in battle) ===

/**
 * An Encounter is the data behind a Waiting Room obstacle. It carries
 * codex/lore fields (CARC code, archetype, watchpoint, etc.) plus a
 * pointer to the standalone Case prototype the player solves:
 * `prototypeIframeUrl`. Encounters without one exist as codex/lore
 * data only — they are not engageable.
 */
export interface Encounter {
  id: string
  title: string
  description: string
  surfaceSymptom: string
  rootCause: Faction
  /** CARC code if this obstacle wraps a real denial code. Optional. */
  carcCode?: string
  carcName?: string
  watchpoint: string
  level: number
  /** Display name + flavor of the procedural obstacle. */
  archetype?: string
  /** Where in the Waiting Room this obstacle lives. */
  wing?: Wing
  /** Tools that auto-unlock to the player on first defeat of this encounter. */
  unlocksOnDefeat?: string[]
  /** Codex entry id auto-unlocked the first time the player sees this encounter. */
  codexOnSight?: string
  /** Approximate dollar amount recovered on win (display + cash delta). */
  cashRecovered?: number
  /** References a PatientCase whose `claim` data backs this encounter's puzzle. */
  caseId?: string
  /** Box ids on the linked claim disputed by this encounter (codex display). */
  highlightedBoxes?: string[]
  /** The payer's denial language as it would appear on the 835 ERA or letter. */
  payerNote?: string
  /**
   * Required for engagement. Each playable encounter is a standalone
   * Case prototype HTML page (under `src/<encounter>-prototype/`),
   * mounted in an iframe via PrototypeIframeScene. The embedded
   * prototype posts a `case-completed` message back via postMessage
   * when the player submits, and the scene runs the victory plumbing
   * (defeatedObstacles, resources, codex, level progression).
   * Encounters without this field are codex/lore data only.
   */
  prototypeIframeUrl?: string
}

// === Tickets ===

/**
 * A "stuck claim" handed to the player by a hospital NPC. Anchors the
 * descend → form-bridge → battle → return loop. Free wandering
 * encounters do not require a ticket.
 */
export interface Ticket {
  id: string
  patientName: string
  /** Which encounter (obstacle) is keeping the claim in limbo. */
  encounterId: string
  /** Optional form puzzle whose perfect completion buffs the matching battle. */
  formCaseId?: string
  /** Has the form already been solved (perfectly)? Drives the full-HP buff. */
  formPerfected?: boolean
  /** Issuing NPC, for return dialogue. */
  fromNpc: string
  /** Set after the matching battle is won. */
  resolved?: boolean
}

// === NPCs ===

export interface NPC {
  id: string
  name: string
  department: string
  spriteKey: string
  dialogueKey: string
  description: string
}

// === Dialogue ===

export interface DialogueChoice {
  text: string
  next?: string
  effect?: DialogueEffect
  /**
   * Optional gate on choice visibility. Evaluated at render time
   * against game state — choices whose condition isn't satisfied are
   * filtered out before the player sees them. Used to gate descent on
   * a chart having been pulled (or not yet pulled, for the "you need
   * to go grab it first" branch). Add new fields here as new gating
   * mechanics appear.
   */
  condition?: {
    /** Show only if `state.chartsPulled[encounterId]` is true. */
    chartPulled?: string
    /** Show only if `state.chartsPulled[encounterId]` is NOT true. */
    chartNotPulled?: string
  }
}

export interface DialogueEffect {
  reputationDelta?: number
  auditDelta?: number
  cashDelta?: number
  addTool?: string
  unlockCodex?: string
  triggerForm?: string
  /**
   * Drop the player into the Waiting Room with one specific obstacle
   * active. Used for NPC-handed cases — the conversation summons the
   * descent, the player walks the WR to the lit obstacle, engages it,
   * and the encounter's prototype launches from there (looked up via
   * ENCOUNTERS[encounterId].prototypeIframeUrl).
   */
  triggerDescent?: { encounterId: string }
  /** Mark that the quest-giver has directed the player to pull this
   *  encounter's chart. Drives the mini-map quest chain (NPC → Medical
   *  Records → NPC) — set when the player accepts the chart errand. */
  markChartHinted?: string
}

export interface DialogueNode {
  id: string
  speaker: string
  text: string
  choices?: DialogueChoice[]
  next?: string
}

// === Codex ===

export type CodexCategory = 'codes' | 'forms' | 'transactions' | 'concepts' | 'stats' | 'obstacles'

export interface CodexEntry {
  id: string
  name: string
  category: CodexCategory
  description: string
  detail: string
  levelDiscovered?: number
}

// === Patient Cases (form puzzles) ===

export interface PatientCase {
  id: string
  patientName: string
  age: number
  insurance: string
  diagnosis: string
  diagnosisCode: string
  procedure: string
  procedureCode: string
  modifiers?: string[]
  revenueCode?: string
  formType: 'cms1500' | 'ub04'
  errors?: FormError[]
  level: number
  /**
   * Realistic box-by-box claim data for the ClaimSheet renderer. When
   * present, both FormScene and BattleScene draw from this to keep the
   * stuck claim visually consistent across the form puzzle and the
   * battle. Optional so legacy cases keep working.
   */
  claim?: ClaimSheetData
}

// === Claim sheet (realistic CMS-1500 / UB-04 rendering) ===

/**
 * A code+label pair. Many CMS-1500 fields are short codes (ICD-10, CPT,
 * place-of-service) where the label is what the player needs to learn.
 */
export interface ClaimFieldValue {
  code: string
  /** Optional human-readable label, e.g. "Heart failure, unspecified". */
  label?: string
}

/** One row in box 24 of a CMS-1500 (a single billable service). */
export interface ServiceLine {
  /** Box 24A — date of service (YYYY-MM-DD or display string). */
  dos: string
  /** Box 24B — place of service (numeric, e.g. '11' = office). */
  pos: string
  /** Box 24D — procedure code (CPT/HCPCS). */
  cpt: ClaimFieldValue
  /** Box 24D — modifier(s), e.g. '25', '59', or '25, 59'. */
  modifier?: string
  /** Box 24E — diagnosis pointer (letters A-D pointing into box 21). */
  dxPointer: string
  /** Box 24F — charged amount (display string, e.g. '$2,150.00'). */
  charges: string
}

/** One row in boxes 42-47 of a UB-04 (institutional service line). */
export interface UB04ServiceLine {
  /** Box 42 — Revenue code (4-digit, e.g. '0250' Pharmacy, '0360' OR). */
  revCode: string
  /** Box 43 — Revenue code description (e.g. 'Operating Room'). */
  description: string
  /** Box 44 — HCPCS / Rate / HIPPS (where applicable). */
  hcpcs?: string
  /** Box 45 — Service date (institutional claims also have line dates). */
  serviceDate?: string
  /** Box 46 — Service units. */
  units?: string
  /** Box 47 — Total charges. */
  totalCharges: string
}

/**
 * Realistic CMS-1500 field data for the ClaimSheet renderer. Field
 * naming mirrors the actual form's box numbers so `highlightedBoxes`
 * ids on an Encounter line up with what's drawn.
 */
export interface CMS1500Data {
  type: 'cms1500'
  claimId: string
  /** Box 1 — insurance program type (e.g. 'Group', 'Medicare'). */
  insuranceType?: string
  /** Box 2 + 3. */
  patient: {
    name: string
    dob: string
    sex?: 'M' | 'F'
  }
  /** Box 1a (id) + 4 (name) + 11 (group #). */
  insured: {
    id: string
    name?: string
    group?: string
  }
  /** Box 21 A-D — diagnoses (typically 1-4 entries). */
  diagnoses: ClaimFieldValue[]
  /** Box 24 — one or more service lines. */
  serviceLines: ServiceLine[]
  /** Box 31 — rendering provider signature. */
  provider: {
    name: string
    npi?: string
  }
}

/**
 * Realistic UB-04 (institutional / hospital billing) field data.
 * Different fields and box numbers from the CMS-1500 — type-of-bill,
 * admission, revenue codes, attending provider, DRG.
 *
 * Box id convention for `highlightedBoxes`:
 *   '4'  = type of bill, '6' = statement period, '14' = admission type,
 *   '42-N' / '43-N' / '44-N' / '47-N' = service line N revcode/desc/hcpcs/charges,
 *   '67' = principal dx, '67A'..'67Q' = other dx,
 *   '76' = attending provider, '80' = DRG.
 */
export interface UB04Data {
  type: 'ub04'
  claimId: string
  /** Box 4 — type of bill (e.g. '111' inpatient, '131' outpatient). */
  typeOfBill: string
  patient: {
    name: string
    dob: string
    sex?: 'M' | 'F'
  }
  insured: {
    id: string
    name?: string
    group?: string
  }
  /** Box 6 — statement period covered by this bill. */
  statementPeriod?: { from: string; through: string }
  /** Box 14 — type of admission (e.g. 'EMG', 'URG', 'ELC'). */
  admissionType?: string
  /** Box 67 + 67A..67Q — diagnoses. First entry is principal. */
  diagnoses: ClaimFieldValue[]
  /** Box 42-47 — service line table. */
  serviceLines: UB04ServiceLine[]
  /** Box 76 — attending provider. */
  attendingProvider: {
    name: string
    npi?: string
  }
  /** Box 80 — DRG / occurrence remark. */
  drg?: string
}

/**
 * Discriminated union over the two claim form types. ClaimSheet
 * dispatches its render based on `data.type`.
 */
export type ClaimSheetData = CMS1500Data | UB04Data

export interface FormError {
  field: string
  currentValue: string
  correctValue: string
  explanation: string
}

// === Level ===

/** A single waypoint in a level's mini-map quest chain. The mini-map
 *  highlights the current step and advances as the player completes it.
 *  - `npc`   — go to a named NPC (resolved to its placed sprite tile).
 *  - `chart` — go pull an encounter's chart in Medical Records
 *              (resolved to the MedRecords cabinet); satisfied once the
 *              chart for `encounterId` has been pulled. */
export interface QuestStep {
  kind: 'npc' | 'chart'
  label: string
  npcId?: string
  encounterId?: string
}

export interface LevelDef {
  id: number
  title: string
  subtitle: string
  hospitalDescription: string
  waitingRoomDescription: string
  concepts: string[]
  encounters: string[]
  cases: string[]
  npcsActive: string[]
  /** Optional ordered mini-map waypoints for multi-step levels (e.g. the
   *  L5 bundling retrieval: Pat → Medical Records → Pat). */
  questChain?: QuestStep[]
  bossEncounter?: string
}

// === Game State ===

export interface GameState {
  currentLevel: number
  levelComplete: boolean[]
  levelStars: number[]
  resources: {
    hp: number
    maxHp: number
    cash: number
    reputation: number
    auditRisk: number
    /**
     * Stress accumulates across battles; persists for the whole run.
     * Drives a soft penalty when high (slower tools, weaker first turn).
     * Distinct from auditRisk (consequences) and reputation (NPCs).
     */
    stress: number
  }
  tools: string[]
  codexUnlocked: string[]
  decisions: Decision[]
  inWaitingRoom: boolean
  /**
   * Stuck-claim tickets the player has picked up but not yet resolved.
   * Anchored battles read from this list to wire form-bridge buffs and
   * post-battle NPC reactions.
   */
  activeTickets: Ticket[]
  /** Encounter ids the player has defeated at least once. */
  defeatedObstacles: string[]
  /** Wings of the Waiting Room currently accessible to the player. */
  wingsUnlocked: Wing[]
  /** Encounter ids the player has seen (for codex auto-unlock on sight). */
  obstaclesSeen: string[]
  /**
   * PatientCase ids the player has solved with every error caught.
   * Drives the form-bridge buff: any obstacle whose `caseId` is in this
   * list starts the matching battle at full HP.
   */
  formsPerfected: string[]
  /**
   * One-shot level-advance banner trigger. Set by
   * `checkLevelProgression()` when a defeat threshold is crossed,
   * read + cleared by `consumePendingLevelBanner()` from
   * HospitalScene's create() to surface the "Level N — <Title>"
   * announcement on next entry.
   */
  pendingLevelBanner?: number | null
  /**
   * One-shot signal from a dialogue handoff. When set, HospitalScene
   * picks it up on the next `resume` and plays the descent animation
   * into WaitingRoomScene with this encounter as the active one.
   * Cleared after consumption.
   */
  pendingDescent?: { encounterId: string } | null
  /**
   * Player tile to spawn at on the next Hospital `create()`. Set
   * before descending so the player returns to where they were
   * standing, not to the level's `playerStart`. Cleared after use.
   */
  pendingHospitalSpawn?: { x: number; y: number } | null
  /**
   * Has the level-1 in-game opening sequence (intern narration +
   * Anjali walking in + auto-dialogue) played yet? Set true once the
   * sequence finishes so it never replays. Distinct from the cinematic
   * IntroScene (which is replayable from the title screen).
   */
  introOpeningPlayed?: boolean
  /** First time the player ever lands in the WR — show the surreal-
   *  reveal narration ("You are somewhere else…") on arrival. */
  firstWrArrivalNarrationPlayed?: boolean
  /** Has Anjali said her thanks after the intro case was solved?
   *  One-shot — once true, she's left the lobby. */
  anjaliThanked?: boolean
  /** Set when the thanks dialogue closes; the next Hospital `resume`
   *  picks it up and animates Anjali walking out. */
  pendingAnjaliLeave?: boolean
  /** Set when a puzzle is submitted; consumed by HospitalScene's
   *  create() to play a blur-to-unblur "wake-up" transition with a
   *  CLAIM SUBMITTED indicator before the thanks dialogue fires. */
  pendingClaimSubmitted?: { encounterId: string; claimId: string | null } | null
  /**
   * Encounter ids the player has pulled the chart for. Some cases gate
   * descent on having pulled the relevant chart from Medical Records
   * (op-note, echo report, etc.) so the appeal has documentation
   * grounding. The chart-pull is a tile interaction inside MedRecords
   * (any 'F' cabinet when the current level matches a gated case);
   * the dialogue choice that triggers descent reads this map via a
   * DialogueChoice.condition.
   */
  chartsPulled?: Record<string, boolean>

  /** Per-encounter flag: the quest-giver has pointed the player at the
   *  chart (the middle step of a mini-map quest chain). */
  chartsHinted?: Record<string, boolean>

  /**
   * DEV ONLY — when true, every room in the hospital map is treated
   * as unlocked regardless of `lockedUntilLevel`. Toggled from the
   * dev panel ("Full map access"). Persisted with the rest of the
   * save so it survives reloads, but never set in production code
   * paths.
   */
  devFullMapAccess?: boolean
}

export interface Decision {
  level: number
  description: string
  choice: string
  consequence: string
}

// === Constants ===

export const PHASE_NAMES = [
  'Orientation',
  'The Front Door',
  'The Gate',
  'The Copy',
  'The Library',
  'The Conveyor',
  'The Courtroom',
  'The River',
  'The Maze',
  'The Audit',
] as const

export const EFFECTIVENESS_BONUS = 1.6
