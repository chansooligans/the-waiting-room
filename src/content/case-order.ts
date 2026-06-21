// Case ordering — the single source of truth for what order the 32
// Cases appear in the game's narrative arc.
//
// This is a planning surface. The /level-editor.html dev page reads
// this array, lets you drag-reorder, and emits a paste-back snippet
// that you can drop back here.
//
// The ordering mirrors the live 32-level sequence in
// `src/content/levels.ts` (one entry per level, same order). Keep the
// two in sync when reordering. Rearrange freely, then paste back.
//
// Each entry carries enough metadata for the editor to render a
// useful card: id, the human name, the archetype label, the district
// (drives the chip color), whether a runtime puzzle spec exists, and
// the legacy level the case sat on (if any).
//
// NOTE: levels.ts is now the runtime authority (32 entries). This
// file is the planning/editor layer kept in lockstep with that order;
// reorder here, then reconcile levels.ts to match.

export type District = 'eligibility' | 'coding' | 'billing' | 'appeals' | 'release-valve'

export interface CaseEntry {
  /** Stable id — matches the case-prototype directory name and
   *  the key in `src/content/case-recaps.ts`. */
  id: string
  /** Human name shown in the editor + catalog. */
  name: string
  /** Archetype label (Wraith, Bundle, Specter, etc.). */
  archetype: string
  /** District accent. Drives the editor's color chip. */
  district: District
  /** If true, the case has a runtime puzzle spec wired to an
   *  in-game encounter — it's actually playable inside the game
   *  (not just on the standalone catalog page). */
  hasRuntimeSpec: boolean
  /** The legacy level this case sat on in the 10-level shape, or
   *  null if it was catalog-only. Preserved for migration reference. */
  legacyLevel: number | null
  /** One-line gloss for the card subtitle. Pulled from the recap or
   *  the prototype's hospital-intro line. Kept short. */
  gloss: string
  /**
   * Difficulty rating on a 1-10 scale.
   *
   * Calibration:
   *   1   single-issue, single picker, no domain prereq (intro teaching)
   *   2-3 single new action OR 2 sequential simple issues
   *   4   2-3 issues, clear path, one new mechanic
   *   5   first real citation chain or multi-step procedural
   *   6   multi-issue + multi-action + meaningful domain depth
   *   7   complex domain (contract math, drug pricing, federal reg)
   *   8   multi-party + complex regulation
   *   9   strategic depth (math + adversarial choice)
   *  10   boss / capstone
   *
   * Ties are fine — the point is comparative ranking on a shared scale,
   * not unique slot per case. Edit freely; the level-editor renders
   * these as chips + can sort by difficulty.
   */
  difficulty: number
}

export const CASE_ORDER: CaseEntry[] = [
  // Ordering authored by the user via /level-editor.html.
  // Difficulty curve weaves easy/medium/hard across districts.
  {
    id: "intro",
    name: "The Wrong Card",
    archetype: "Wrong Card",
    district: "eligibility",
    hasRuntimeSpec: true,
    legacyLevel: 1,
    gloss: "Anjali handed her husband's insurance card at check-in. Subscriber ID mismatch.",
    difficulty: 1,
  },
  {
    id: "asp-wac-apothecary",
    name: "ASP / WAC Apothecary",
    archetype: "Apothecary",
    district: "billing",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "Part B drug pricing — ASP vs WAC, J-code unit dose, NDC↔HCPCS crosswalk.",
    difficulty: 7,
  },
  {
    id: "fog",
    name: "Eligibility Fog",
    archetype: "Fog",
    district: "eligibility",
    hasRuntimeSpec: true,
    legacyLevel: 2,
    gloss: "Stale insurance card; new plan since the patient changed jobs.",
    difficulty: 2,
  },
  {
    id: "stoploss-reckoner",
    name: "Stoploss Reckoner",
    archetype: "Reckoner",
    district: "billing",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "High-cost case crossing the stoploss threshold — % outlier vs charges audit.",
    difficulty: 8,
  },
  {
    id: "bundle",
    name: "Bundling Beast",
    archetype: "Bundle",
    district: "coding",
    hasRuntimeSpec: true,
    legacyLevel: 4,
    gloss: "CO-97 bundle. Modifier 25 + chart support for a separately identifiable E&M.",
    difficulty: 4,
  },
  {
    id: "outpatient-surgery-grouper",
    name: "Outpatient Surgery Grouper",
    archetype: "Grouper",
    district: "coding",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "APC grouping for outpatient surgery — packaging rules + status indicators.",
    difficulty: 7,
  },
  {
    id: "no-show-bill",
    name: "No-Show Bill",
    archetype: "Release Valve",
    district: "release-valve",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "No-show fee policy — when to waive, when to enforce, what the patient hears.",
    difficulty: 3,
  },
  {
    id: "gatekeeper",
    name: "Prior-Auth Gatekeeper",
    archetype: "Gatekeeper",
    district: "eligibility",
    hasRuntimeSpec: true,
    legacyLevel: 3,
    gloss: "No auth on file for an MRI. Polite, immovable, fixable.",
    difficulty: 3,
  },
  {
    id: "lighthouse",
    name: "Lighthouse",
    archetype: "Lighthouse",
    district: "release-valve",
    hasRuntimeSpec: true,
    legacyLevel: 8,
    gloss: "Charity-care / §501(r) financial assistance for a patient with no path to pay.",
    difficulty: 4,
  },
  {
    id: "gfe-oracle",
    name: "Good Faith Estimate Oracle",
    archetype: "Oracle",
    district: "appeals",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "GFE accuracy — patient billed over the threshold, opens the appeal path.",
    difficulty: 5,
  },
  {
    id: "wraith",
    name: "Medical Necessity Wraith",
    archetype: "Wraith",
    district: "appeals",
    hasRuntimeSpec: true,
    legacyLevel: 3,
    gloss: "CO-50 echo denial. Citation-chain appeal across three sources.",
    difficulty: 5,
  },
  {
    id: "swarm",
    name: "Documentation Sprite Swarm",
    archetype: "Swarm",
    district: "eligibility",
    hasRuntimeSpec: true,
    legacyLevel: 6,
    gloss: "CO-16 catch-all batch. Read the RARC, find the upstream break.",
    difficulty: 5,
  },
  {
    id: "doppelganger",
    name: "Doppelgänger",
    archetype: "Doppelgänger",
    district: "billing",
    hasRuntimeSpec: true,
    legacyLevel: 9,
    gloss: "CO-18 duplicate. Frequency-code-7 replacement referencing the original ICN.",
    difficulty: 5,
  },
  {
    id: "implant-carveout-specter",
    name: "Implant Carve-Out Specter",
    archetype: "Specter",
    district: "billing",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "Implant cost above stoploss — invoice carve-out missed by the contract.",
    difficulty: 7,
  },
  {
    id: "credentialing-lattice",
    name: "Credentialing Lattice",
    archetype: "Lattice",
    district: "eligibility",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "Provider credentialing gap — claim denied because the doc isn't credentialed with this plan yet.",
    difficulty: 5,
  },
  {
    id: "carveout-phantom",
    name: "Carve-Out Phantom",
    archetype: "Phantom",
    district: "billing",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "Two bills for one ER visit — NSA carve-out routes the OON physician fight to IDR.",
    difficulty: 6,
  },
  {
    id: "cpt-licensure-mire",
    name: "CPT Licensure Mire",
    archetype: "Mire",
    district: "coding",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "AMA CPT licensing edges — code mapping, derivative-work limits, public-domain alternatives.",
    difficulty: 7,
  },
  {
    id: "reaper",
    name: "Timely Filing Reaper",
    archetype: "Reaper",
    district: "appeals",
    hasRuntimeSpec: true,
    legacyLevel: 7,
    gloss: "CO-29 timely filing. 277CA evidence + extenuating-circumstances waiver.",
    difficulty: 6,
  },
  {
    id: "surprise-bill",
    name: "Surprise Bill Specter",
    archetype: "Specter",
    district: "billing",
    hasRuntimeSpec: true,
    legacyLevel: 8,
    gloss: "NSA-protected balance bill. Recalculate cost-share, route the OON fight to IDR.",
    difficulty: 6,
  },
  {
    id: "three-forty-b-specter",
    name: "340B Specter",
    archetype: "Specter",
    district: "billing",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "340B-eligible drug paid at non-340B rate post-Becerra clawback.",
    difficulty: 8,
  },
  {
    id: "phantom-patient",
    name: "Phantom Patient",
    archetype: "Phantom",
    district: "eligibility",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "Identity-matching collision — two patients, one demographic profile.",
    difficulty: 6,
  },
  {
    id: "risk-adj-hollow",
    name: "Risk Adjustment Hollow",
    archetype: "Hollow",
    district: "coding",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "HCC capture — chronic condition coded once a year, dropped the next, RAF score evaporates.",
    difficulty: 6,
  },
  {
    id: "chemo-bundle-specter",
    name: "Chemo Bundle Specter",
    archetype: "Specter",
    district: "billing",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "Chemotherapy bundled into the case rate; admin code dropped, claim under-pays.",
    difficulty: 7,
  },
  {
    id: "two-midnight-mire",
    name: "Two-Midnight Mire",
    archetype: "Mire",
    district: "coding",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "Inpatient vs observation — Medicare 2-midnight rule + medical-necessity overlay.",
    difficulty: 6,
  },
  {
    id: "specter",
    name: "Underpayment Specter",
    archetype: "Specter",
    district: "billing",
    hasRuntimeSpec: true,
    legacyLevel: null,
    gloss: "CO-45 underpayment — contract says one rate, payment shows another.",
    difficulty: 6,
  },
  {
    id: "cob-cascade-spider",
    name: "COB Cascade Spider",
    archetype: "Spider",
    district: "eligibility",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "Multi-payer coordination of benefits — Medicare + retiree + spouse plan cascade.",
    difficulty: 7,
  },
  {
    id: "case-rate-specter",
    name: "Case-Rate Specter",
    archetype: "Specter",
    district: "billing",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "Case-rate vs per-diem mismatch — multi-day stay paid as a single bundle.",
    difficulty: 7,
  },
  {
    id: "mrf-cartographer",
    name: "MRF Cartographer",
    archetype: "Cartographer",
    district: "appeals",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "Machine-Readable Files — read the payer rate sheet, find the negotiated rate hidden in 8 GB of JSON.",
    difficulty: 7,
  },
  {
    id: "idr-crucible",
    name: "IDR Crucible",
    archetype: "Crucible",
    district: "appeals",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "Baseball-style arbitration — submit one number, pick a number, defend the math.",
    difficulty: 9,
  },
  {
    id: "ob-perdiem-specter",
    name: "OB Per-Diem Specter",
    archetype: "Specter",
    district: "billing",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "OB per-diem with C-section escalator — payer paid the base rate only.",
    difficulty: 7,
  },
  {
    id: "hipaa-spider",
    name: "HIPAA Spider",
    archetype: "Spider",
    district: "appeals",
    hasRuntimeSpec: false,
    legacyLevel: null,
    gloss: "Breach response — four-factor assessment, notification thresholds, OCR follow-up.",
    difficulty: 8,
  },
  {
    id: "audit-boss",
    name: "The Quarterly Audit",
    archetype: "Audit Boss",
    district: "appeals",
    hasRuntimeSpec: true,
    legacyLevel: 10,
    gloss: "Three audit findings. RECEIPT vs AMEND. The reckoning.",
    difficulty: 10,
  },
]

/** Lookup helper. */
export function caseById(id: string): CaseEntry | undefined {
  return CASE_ORDER.find(c => c.id === id)
}

/** Sanity: at module load, confirm no duplicate ids. */
const _seenIds = new Set<string>()
for (const c of CASE_ORDER) {
  if (_seenIds.has(c.id)) {
    throw new Error(`Duplicate case id in CASE_ORDER: ${c.id}`)
  }
  _seenIds.add(c.id)
}
