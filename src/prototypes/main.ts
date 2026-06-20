// Case Prototypes — index page for the per-encounter playable
// sketches. Replaces the older battles.html / "prototype catalog"
// nomenclature; the things in this catalog are now called *Cases*
// (each Case is the player-side problem they solve in one
// encounter — what we used to call a "problem").
//
// Each Case Prototype is a standalone single-encounter sketch
// testing what battles look like in this game once HP / tools-as-
// damage / multiple choice are off the table. They share a
// framework (Hospital intro → dreamlike fall → claim form +
// workbench + builder) but each tunes the action set to the
// encounter.
//
// New Cases get added to PROTOTYPES below; the page renders itself
// from that list. URL stays at /prototypes.html for link
// stability — only the visible labels change.

import { CASE_RECAPS } from '../content/case-recaps'
import type { CaseRecap } from '../shared/prototype-base'

interface Prototype {
  id: string
  title: string
  subtitle: string
  archetype: string
  carc: string
  /**
   * Roadmap target level — when this Case is intended to land in
   * the in-game progression (`LEVELS[]` in src/content/levels.ts).
   * NOT a binding — the catalog is the design backlog; only a
   * subset of Cases are currently wired into `LEVELS[].cases`. The
   * pill in the catalog UI prefixes this with "→" to keep the
   * asymmetry visible.
   *
   * Renamed from `level` (May 2026) to make the catalog/in-game
   * gap explicit.
   */
  targetLevel: number
  status: 'shipped' | 'planned'
  /** What the action set looks like for this encounter. */
  verbs: string
  /** What this prototype tests beyond the wraith. */
  testing: string
  /** Path to the prototype's HTML page. */
  href?: string
  /**
   * Curriculum district — matches the four district markers in
   * `src/scenes/WaitingRoomScene.ts`. 'release-valve' is the
   * special fifth category for restorative, non-combat
   * encounters (the Lighthouse). The accent below should
   * be the district's canonical color.
   */
  district: 'eligibility' | 'coding' | 'billing' | 'appeals' | 'release-valve'
  /** District accent — pinned to one of five canonical colors. */
  accent: string
}

const prototypes: Prototype[] = [
  {
    id: 'wraith',
    title: 'Medical Necessity Wraith',
    subtitle: '@ L4',
    archetype: 'Wraith',
    carc: 'CO-50',
    targetLevel: 4,
    status: 'shipped',
    verbs: 'CITE-dominant + AMEND',
    testing: 'The base framework. No HP, no tools-as-damage, no multiple choice. Player builds citations from chart + policy against payer phrases; resolves three issues; submits a defense packet.',
    href: './wraith-prototype.html',
    district: 'coding',
    accent: '#f0a868',
  },
  {
    id: 'bundle',
    title: 'Bundling Beast',
    subtitle: '@ L4 — sibling prototype',
    archetype: 'Bundle',
    carc: 'CO-97',
    targetLevel: 4,
    status: 'shipped',
    verbs: 'AMEND-dominant + CITE',
    testing: 'Quick surgical fixes. Modifier 25 on Box 24 (not dx in Box 21). Different field, different rhythm — proves the framework holds for "fix and resubmit" encounters as well as protracted appeals.',
    href: './bundle-prototype.html',
    district: 'coding',
    accent: '#f0a868',
  },
  {
    id: 'reaper',
    title: 'Timely Filing Reaper',
    subtitle: '@ L7 — third-sibling prototype',
    archetype: 'Reaper',
    carc: 'CO-29',
    targetLevel: 7,
    status: 'shipped',
    verbs: 'TIME PRESSURE + CITE + AMEND',
    testing: 'A real countdown. The appeal window is 14 days; every action burns 1–4 of them; running out closes the file. Tests whether pressure reads as urgency rather than punishment when costs are visible up front.',
    href: './reaper-prototype.html',
    district: 'appeals',
    accent: '#b18bd6',
  },
  {
    id: 'swarm',
    title: 'CO-16 Sprite Swarm',
    subtitle: '@ L2 — seventh-sibling prototype',
    archetype: 'Swarm',
    carc: 'CO-16',
    targetLevel: 2,
    status: 'shipped',
    verbs: 'BATCH + sweep + patch upstream',
    testing: 'Eighteen weekend CO-16 rejections, fourteen sharing one root cause (a misconfigured NPI on a provider profile). Fix the cluster as a group, sweep the outliers individually (one is a clearinghouse false positive — correct move is "no action"), then file an EHR ticket so the same 14 claims don\'t come back next Monday. First prototype that operates on a queue, not a single claim.',
    href: './swarm-prototype.html',
    district: 'eligibility',
    accent: '#7ee2c1',
  },
  {
    id: 'fog',
    title: 'Eligibility Fog',
    subtitle: '@ L2 — fifth-sibling prototype',
    archetype: 'Fog',
    carc: 'pre-submit',
    targetLevel: 2,
    status: 'shipped',
    verbs: 'REVEAL + AMEND',
    testing: 'Discrepant claim fields are literally fogged over until you run a 270 inquiry; the 271 response burns the fog off and reveals which fields differ from what the payer actually has on file. First prototype where the fight happens upstream — before submit, not after denial.',
    href: './fog-prototype.html',
    district: 'eligibility',
    accent: '#7ee2c1',
  },
  {
    id: 'specter',
    title: 'Underpayment Specter',
    subtitle: '@ L7 — eighth-sibling prototype',
    archetype: 'Specter',
    carc: 'CO-45 (hidden)',
    targetLevel: 7,
    status: 'shipped',
    verbs: 'VARIANCE + APPEAL',
    testing: 'The 835 ERA arrived showing four claims paid; one hides a $28 underpayment because the payer\'s fee table was never updated for the 2026 contract. Verify each claim line-by-line against the contract, flag the underpayment, file the appeal with the right shortfall + reason. First prototype where the input is a successful payment, not a denial.',
    href: './specter-prototype.html',
    district: 'billing',
    accent: '#ef5b7b',
  },
  {
    id: 'audit-boss',
    title: 'The Quarterly Audit',
    subtitle: '@ L10 — twelfth-sibling prototype · the finale',
    archetype: 'Audit Boss',
    carc: 'RAC defense',
    targetLevel: 10,
    status: 'shipped',
    verbs: 'RECEIPT + AMEND',
    testing: 'The finale. Different shape from every prior encounter — this is a *defense* of work already done. The auditor walks in with three findings on Margaret Holloway\'s UB-04. For each, the player chooses RECEIPT (defend with chart evidence) or AMEND (concede + recoupment). Two of the findings are defensible; one is a real billing error best conceded fast. Total exposure is $11,970; a clean run lands at $340 recouped.',
    href: './audit-boss-prototype.html',
    district: 'appeals',
    accent: '#b18bd6',
  },
  {
    id: 'surprise-bill',
    title: 'Surprise Bill Specter',
    subtitle: '@ L8 — eleventh-sibling prototype',
    archetype: 'Specter',
    carc: 'NSA-protected',
    targetLevel: 8,
    status: 'shipped',
    verbs: 'CLASSIFY + CALCULATE + DISPUTE',
    testing: 'Patient-facing fight (companion to Lighthouse\'s patient-facing kindness). $4,200 OON balance bill from a contracted radiologist who read the patient\'s in-network ER scan; under the No Surprises Act that bill is prohibited. Three sequential gates: classify the scenario, calculate true patient cost-share, file the protective statement + initiate IDR. Each wrong pick names a real-world failure mode the law was passed to prevent.',
    href: './surprise-bill-prototype.html',
    district: 'billing',
    accent: '#ef5b7b',
  },
  {
    id: 'lighthouse',
    title: 'Charity Lighthouse',
    subtitle: '@ L8 — tenth-sibling prototype',
    archetype: 'Release Valve',
    carc: 'patient-facing',
    targetLevel: 8,
    status: 'shipped',
    verbs: 'LISTEN + SCREEN + RELEASE',
    testing: 'First prototype that isn\'t a fight. Patient-facing, not payer-facing. A patient with a $87,420 bill she can\'t pay; the actions are LISTEN (pick the right follow-up question, not paternalism), SCREEN (FPL math + tier), RELEASE (file as charity care, not bad debt). Sits outside the four-district action set — the Lighthouse is restorative; it doesn\'t disappear when the encounter resolves.',
    href: './lighthouse-prototype.html',
    district: 'release-valve',
    accent: '#e8c074',
  },
  {
    id: 'doppelganger',
    title: 'Duplicate Claim Doppelgänger',
    // Promoted from free-roam → L9 main flow (took Hydra's old slot)
    // because the prototype is shipped and the rest of L9's
    // story (registration, Kim) fits cleanly.
    subtitle: '@ L9 — promoted from free-roam',
    archetype: 'Doppelgänger',
    carc: 'CO-18',
    targetLevel: 9,
    status: 'shipped',
    verbs: 'REPLACE + CONFIRM',
    testing: 'A claim came back denied for a transposed subscriber ID; the biller fixed it and resubmitted as a fresh 837 instead of a frequency-7 replacement; now both claims are flagged duplicate. Resolution: set Box 22 to frequency 7 + reference the original ICN. First version-control encounter — the puzzle isn\'t what\'s on the claim, it\'s how the claim relates to other claims that already exist.',
    href: './doppelganger-prototype.html',
    district: 'billing',
    accent: '#ef5b7b',
  },
  // Coordination Hydra — REMOVED from catalog 2026-05 in favor of
  // COB Cascade Spider (#213). Hydra's three-payer SEQUENCE mechanic
  // was a thin sketch; COB Cascade Spider replaces it with the full
  // cascade (birthday rule, MSP working-aged, payer-of-last-resort,
  // court orders) across multiple patients on one household policy.
  // The Hydra prototype HTML is no longer linked from the catalog;
  // source files retained for git history at src/hydra-prototype/.

  {
    id: 'three-forty-b-specter',
    title: '340B Drug Pricing Specter',
    subtitle: '@ L8 — duplicate-discount + HRSA self-disclosure',
    archetype: 'Specter',
    carc: 'compliance event (no CARC; HRSA review)',
    targetLevel: 8,
    status: 'shipped',
    verbs: 'QUALIFY + MARK + DISCLOSE',
    testing: 'Aaron Burnett, Medicaid managed-care patient, outpatient bevacizumab biosimilar (Q5107) at Mercy oncology. Drug came from 340B inventory ($312 acquisition vs $845 ASP+6%). Claim went out without modifier UD (state Medicaid 340B identifier); manufacturer paid the Medicaid rebate AND provided the 340B discount on the same dose → duplicate discount → manufacturer reports → HRSA opens compliance review. Player walks 4 program-rule statements (covered-entity qualification, drug eligibility carve-outs, duplicate-discount prohibition, GPO prohibition), picks the right modifier from 4 (UD correct; JG is Medicare; TB is DME; no-modifier was the original bug), and picks the right resolution from 5 (refile + refund + self-disclose is correct; decoys teach the wrong moves: skip-disclosure when review already open, abandon 340B, switch primary to Medicare = fraud, recoup-and-rebill instead of Frequency-7). Cousin to ASP/WAC Apothecary (drug-pricing complexity) and HIPAA Spider (self-disclosure shape).',
    href: './three-forty-b-specter-prototype.html',
    district: 'appeals',
    accent: '#b18bd6',
  },

  {
    id: 'idr-crucible',
    title: 'IDR Crucible',
    subtitle: '@ L9 — NSA Independent Dispute Resolution',
    archetype: 'Crucible',
    carc: 'no CARC — IDR submission under 45 CFR 149.510',
    targetLevel: 9,
    status: 'shipped',
    verbs: 'AUDIT + REBUCKET + OFFER',
    testing: "Maria Vargas, BlueCross PPO, emergency cath at Mercy ED performed by Dr. Patel of CardioCare Group (OON). NSA carve-out applies: patient pays in-network cost-sharing; provider/plan dispute the rate. CardioCare billed $5,200; BlueCross paid the QPA ($1,840) — but used cardiology-elective bucket for an emergency-ED procedure. Methodology disclosure requested 14 days ago, still unanswered. 30-day open negotiation lapsed. Provider must file IDR within 4 business days. Player walks 4 QPA-methodology statements (median-of-contracts rule, SCA-exclusion trap, risk-bearing-payments exclusion, baseball-arbitration mechanic), picks the right specialty+setting bucket from 4 (cardiology-emergency-ED correct → corrected QPA $2,800; cardiology-elective is what payer used; anesthesiology-emergency is wrong specialty; all-specialty blend is invalid methodology per TMA v HHS), and picks the right final offer from 5 ($2,950 market median correct — backed by CardioCare contracts + Fair Health benchmark; $5,200 billed too high → arbitrator picks payer; $4,200 split-the-baby has no place in baseball arbitration; $1,900 just-above-QPA leaves money on the table; $1,840 accept-QPA is capitulation). Cousin to Surprise Bill Specter (NSA-dispute family, patient-side vs provider-side flip) and Carve-out Phantom (NSA universe).",
    href: './idr-crucible-prototype.html',
    district: 'appeals',
    accent: '#b18bd6',
  },

  {
    id: 'two-midnight-mire',
    title: '2-Midnight Mire',
    subtitle: '@ L8 — Medicare 2-midnight rule + RAC observation reclassification',
    archetype: 'Mire',
    carc: 'RAC recoupment finding (no CARC; post-payment audit)',
    targetLevel: 8,
    status: 'shipped',
    verbs: 'CLOCK + CLASSIFY + RECLASSIFY',
    testing: "Lawrence Mitchell, 65, chest-pain rule-out admitted inpatient, 39-hour stay, ruled out NSTEMI. RAC returned a finding: stay didn\'t meet the 2-midnight benchmark (admitting H&P said \"expect 24-36 hour stay\" — observation territory by the doc\'s own documentation). $8,200 Part A on the line; $2,140 Part B observation as the rebill recovery; net loss $6,060. Player walks 4 clock statements (with the clock-start trap — clock starts at hospital-care arrival, not when the inpatient order is written), classifies 5 chart facts as supporting inpatient or observation (4 observation-shaped, 1 inpatient — the order itself), and picks the right resolution from 5 paths (Part A → Part B rebill correct; CC 44 wrong because patient already discharged; appeal-the-RAC wrong because chart genuinely doesn\'t support inpatient; inpatient-only-list wrong because no procedure performed; full write-off leaves $2,140 on the table). Cousin to Audit Boss (audit defense framework).",
    href: './two-midnight-mire-prototype.html',
    district: 'appeals',
    accent: '#b18bd6',
  },

  {
    id: 'cob-cascade-spider',
    title: 'COB Cascade Spider',
    subtitle: '@ L9 — birthday rule + MSP + payer-of-last-resort',
    archetype: 'Spider',
    carc: 'CO-22 (covered by another payer per COB)',
    targetLevel: 9,
    status: 'shipped',
    verbs: 'VERIFY-ELIGIBILITY + APPLY-CASCADE + REFILE',
    testing: 'Three Reyes-household patients, three CO-22 denials, three different primary payers on the same household policy. Mateo (dependent kid) → Aetna (Mom\'s plan, birthday rule, March birthday wins). Sofia (working 67-year-old wife) → Aetna (MSP working-aged: 65+, current employer, 20+ employees). Jorge (dual-eligible grandfather) → Medicare (Medicaid is statutory payer of last resort). Player walks 4 COB rule statements (birthday rule, MSP working-aged, court-order override, CO-22 = wrong primary), picks the right primary per patient (12 options across 3 patients), and picks the right resolution (5 paths; cascade-walk-and-refile is correct). Goes deeper than Hydra: COB isn\'t one rule, it\'s a per-patient cascade through relationship × age × Medicare entitlement × employer size × court orders.',
    href: './cob-cascade-spider-prototype.html',
    district: 'eligibility',
    accent: '#7ee2c1',
  },

  {
    id: 'gatekeeper',
    title: 'Prior Auth Gatekeeper',
    subtitle: '@ L3 — fourth-sibling prototype',
    archetype: 'Gatekeeper',
    carc: 'CO-197',
    targetLevel: 3,
    status: 'shipped',
    verbs: 'REQUEST + AMEND',
    testing: 'File a retroactive 278; wait for the response; transcribe the auth number to Box 23. The citation builder is gone — replaced by a real 278 form (locked CPT + dx, picker for clinical rationale) and a response panel that animates back from the payer. Process, not argument.',
    href: './gatekeeper-prototype.html',
    district: 'eligibility',
    accent: '#7ee2c1',
  },

  // ===== Planned — concept sketches, not yet built =====
  // Five new cases pitched 2026-05 to fill thematic gaps and give the
  // new 2F rooms (Payer office, Compliance) load-bearing gameplay
  // reasons to exist. None has a prototype HTML yet; mark `shipped`
  // and add `href` once the encounter is built.

  {
    id: 'phantom-patient',
    title: 'Phantom Patient',
    subtitle: '@ L9 — wrong-MRN identity merge',
    archetype: 'Phantom',
    carc: 'CO-31 (patient cannot be identified)',
    targetLevel: 9,
    status: 'shipped',
    verbs: 'TRACE + UNMERGE + REFILE',
    testing: 'Two patients (Maria + María) at Mercy share a DOB. Registration desk picked wrong MRN at check-in; encounter rode the chart-merge through coding into the claim; Aetna returned CO-31. Player walks 5 audit-trail events to find the merge point (registration desk failed ID re-verify), picks the right split strategy from 4 (decoys are real anti-patterns: chart-merge, spawn-new-MRN, fudge-DOB), and refiles + adds an MPI guardrail. First Case where the bug is in the MPI / registration, not the claim or chargemaster.',
    href: './phantom-patient-prototype.html',
    district: 'eligibility',
    accent: '#7ee2c1',
  },

  {
    id: 'risk-adj-hollow',
    title: 'Risk Adjustment Hollow',
    subtitle: '@ L5 — HCC under-capture for Medicare Advantage',
    archetype: 'Hollow',
    carc: 'RAF gap (no denial)',
    targetLevel: 5,
    status: 'shipped',
    verbs: 'REVIEW + ENRICH + QUERY',
    testing: 'Frank Delaney, MA panel. Chart: diabetes with neuropathy, CKD 3a, BMI 41.2, EF 35%. Encoder captured E11.9 only. Player reviews 4 chart snippets (2 specific, 2 ambiguous); enriches with right ICD-10 (E11.42 + N18.31, avoiding under-codes E11.9/N18.9 and the up-code N18.5 = fraud); drafts a non-leading bundled CDI query for the BMI + EF ambiguity. Tests AHIMA query standards (leading queries forbidden) and the up-coding decoy. Inverted Wraith — the missing piece is in the hospital, not in the payer.',
    href: './risk-adj-hollow-prototype.html',
    district: 'coding',
    accent: '#f0a868',
  },

  {
    id: 'credentialing-lattice',
    title: 'Credentialing Lattice',
    subtitle: '@ L9 — provider not in-network for DOS',
    archetype: 'Lattice',
    carc: 'CO-242 (services not provided by network provider)',
    targetLevel: 9,
    status: 'shipped',
    verbs: 'VERIFY-NETWORK + ENROLL + BACKDATE',
    testing: 'Dr. Patel started 3/15; CAQH processed; Anthem effective date lagged to 4/2. Hannah Beck saw her 3/22 — inside the gap. CO-242 returns. Player walks 4 payer cells in the credentialing matrix (Aetna/Cigna/UHC in-network, Anthem in-gap), picks the right enrollment action from 4 (backdate request — decoys: bill the patient, fudge tax ID, wait), files reconsideration with the corrected effective-date confirmation (decoys: claim-only, level-2 appeal, member appeal). Provider-side eligibility — same family as Phantom Patient (patient identity) and Carve-out Phantom (network status) but the actor is the doctor, not the patient.',
    href: './credentialing-lattice-prototype.html',
    district: 'eligibility',
    accent: '#7ee2c1',
  },

  {
    id: 'hipaa-spider',
    title: 'HIPAA Spider',
    subtitle: '@ L10 — HIPAA breach response (under-500 path)',
    archetype: 'Spider',
    carc: 'compliance event (no claim)',
    targetLevel: 10,
    status: 'shipped',
    verbs: 'ASSESS + CONTAIN + NOTIFY',
    testing: '3 lab reports faxed to a wrong number 2 weeks before the audit. Player walks the four-factor breach risk assessment (4 statements true/false; recipient identity + retention attestation are key factors), picks the right immediate containment from 4 options (log + attestation; decoys: do-nothing, over-notify, sue-recipient), and chooses the right notification path from 4 (under-500: individual letters + internal log + annual HHS aggregate; decoys: immediate HHS, skip individual, OIG wrong agency). First non-claim Case; calibration as the puzzle.',
    href: './hipaa-spider-prototype.html',
    district: 'appeals',
    accent: '#b18bd6',
  },

  {
    id: 'no-show-bill',
    title: 'No-Show Bill',
    subtitle: '@ L8 — release valve (Lighthouse companion)',
    archetype: 'Lighthouse',
    carc: 'patient-facing (no CARC)',
    targetLevel: 8,
    status: 'shipped',
    verbs: 'LISTEN + INVESTIGATE + WAIVE',
    testing: 'Marcia Devlin calls about a $75 no-show fee. She says she canceled by phone Tuesday afternoon. Player listens to 4 statements (2 verifiable evidence, 2 sympathetic context — separate them), pulls the right source from 4 (call log; decoys: patient attestation, Jamie\'s memory, manager meeting), picks the right resolution from 4 (waive + adjust + retrain; decoys: split-the-difference, hide-behind-policy, escalate-to-collections). Mid-game release valve — proves the Lighthouse pattern scales beyond the L10 charity beat.',
    href: './no-show-bill-prototype.html',
    district: 'release-valve',
    accent: '#e8c074',
  },

  // === Round 2 of planned Cases — pricing-methodology, MRF /
  //     transparency, and contract-interpretation puzzles. Mostly
  //     billing-district; they fill out the under-populated
  //     billing column on the catalog. Each is set in a real
  //     payer/contract artifact (chargemaster, MRF, GFE, contract
  //     stoploss clause) so the player learns the document, not
  //     just the action. Author: Chansoo, May 2026. ===

  {
    id: 'case-rate-specter',
    title: 'Case Rate Specter',
    subtitle: '@ L7 — pricing-methodology sibling to the Specter',
    archetype: 'Specter',
    carc: 'contractual underpayment (no CARC)',
    targetLevel: 7,
    status: 'shipped',
    verbs: 'COMPARE-CONTRACT + REPRICE + APPEAL',
    testing: 'Anthem contract pays a $14k case rate for DRG 470 (joint replacement, no comp/comorb). This claim is DRG 470 with a 9-day stay (5-day inlier threshold). The contract\'s outlier provision flips payment to 75% of charges over the threshold. Player walks three clauses (two are decoys), picks the formula that governs, computes the shortfall, files the appeal. Same dragon as the Specter (underpayment hidden behind CO-45); different lever (contract clause vs stale fee table).',
    href: './case-rate-specter-prototype.html',
    district: 'billing',
    accent: '#ef5b7b',
  },

  {
    id: 'mrf-cartographer',
    title: 'MRF Cartographer',
    subtitle: '@ L8 — pricing-transparency Case (two axes: coding mode × rate source)',
    archetype: 'Cartographer',
    carc: 'pricing transparency compliance (no claim)',
    targetLevel: 8,
    status: 'shipped',
    verbs: 'CLASSIFY + SOURCE + AGGREGATE',
    testing: 'Mercy\'s machine-readable file (MRF) is overdue under the federal price-transparency rule. Player walks four service rows on TWO independent axes: (1) coding mode — hard-coded (CDM auto-assigns CPT at charge drop) vs soft-coded (HIM coder reviews chart manually); (2) rate source for the MRF — CDM/fee schedule vs claim history. The axes are correlated but distinct: hard-coded services can be claim-priced (CMP lab, IV saline); soft-coded services can be CDM-priced (DRG case rate, contractually fixed once HIM assigns the grouping). Then for claim-priced rows, pick the right aggregation (median per payer beats mean, mode, max, CDM). First Case where the deliverable is a regulatory file. Tightly paired with Chemo Bundle Specter (#200), which introduced the proper RCM definition of hard-coding.',
    href: './mrf-cartographer-prototype.html',
    district: 'billing',
    accent: '#ef5b7b',
  },

  {
    id: 'gfe-oracle',
    title: 'GFE Oracle',
    subtitle: '@ L8 — pre-service patient-facing prevention',
    archetype: 'Oracle',
    carc: 'NSA pre-service compliance',
    targetLevel: 8,
    status: 'shipped',
    verbs: 'ITEMIZE + ESTIMATE + COMMIT',
    testing: 'Maya Chen, self-pay, scheduled cesarean in 14 days. NSA requires a Good Faith Estimate within 3 business days. Player walks 8 candidate line items: classify each as Mercy\'s (estimate), a co-provider\'s (disclose-don\'t-price — anesthesia + pediatrics), or not applicable (doula, cord-blood). For Mercy lines, pick the source — CDM (hard-coded) or claim median (soft-coded), continuity from MRF Cartographer. Mercy commits to bill within ±$400 or Maya disputes through PPDR. First Case where the dragon hasn\'t arrived yet — patient-facing prevention, companion to Surprise Bill Specter.',
    href: './gfe-oracle-prototype.html',
    district: 'billing',
    accent: '#ef5b7b',
  },

  {
    id: 'carveout-phantom',
    title: 'Carve-out Phantom',
    subtitle: '@ L9 — two-bills-for-one-visit; walk the contract chain',
    archetype: 'Phantom',
    carc: 'dual billing (patient complaint, no CARC)',
    targetLevel: 9,
    status: 'shipped',
    verbs: 'TRACE-CONTRACT + APPLY-NSA + RESOLVE',
    testing: 'Marcus Webb came to Mercy\'s ER for chest pain. Mercy is in-network with Anthem; the ER physician staffing group inside Mercy isn\'t. Marcus paid his $620 in-network cost-share at Mercy — then got a $2,840 surprise bill from the staffing group. Player walks 5 contract-chain statements (true/false), applies the right NSA citation (4 options; emergency carve-out at 2799A-1(a) is correct), and picks the right resolution (5 options; cap-and-IDR is correct). Cousin to Surprise Bill Specter (same NSA mechanic, different framing) and GFE Oracle (same co-provider-vs-facility classification, post- vs pre-encounter).',
    href: './carveout-phantom-prototype.html',
    district: 'billing',
    accent: '#ef5b7b',
  },

  {
    id: 'form-mirror',
    title: 'Form Mirror — UB-04 vs CMS-1500',
    subtitle: '@ L4 — wrong-form Case (facility on a 1500)',
    archetype: 'Mirror',
    carc: 'CO-95 (wrong claim type)',
    targetLevel: 4,
    status: 'shipped',
    verbs: 'DETECT + MAP + REROUTE',
    testing: 'Aiyana Roberts\' inpatient stay was filed on a CMS-1500 (837P) and bounced CO-95 at the clearinghouse. Player walks five lines on the rejected claim (revenue codes, DRG, CPTs, occurrence code, ICD-10 — three are institutional-only, two appear on both forms), maps four data elements to the correct UB-04 form locators (FL 42, FL 71, FL 6, FL 31-34) with real-FL decoys, and refiles as 837I. First Case where the answer is "you filed the wrong form," not "you used the wrong code." Demonstrates rejection-vs-denial — CO-95 is a clearinghouse return, not an adjudicated decision.',
    href: './form-mirror-prototype.html',
    district: 'coding',
    accent: '#f0a868',
  },

  {
    id: 'cpt-licensure-mire',
    title: 'CPT Licensure Mire',
    subtitle: '@ L6 — meta-Case on AMA\'s CPT licensing system',
    archetype: 'Mire',
    carc: 'meta — coding compliance audit',
    targetLevel: 6,
    status: 'shipped',
    verbs: 'SOURCE + LICENSE + ALTERNATIVE',
    testing: 'Mercy Charity Clinic audited on CPT licensing. Player walks 4 true/false statements about how the licensing chain actually works (AMA copyright, CMS requirement, HCPCS scope, distribution rights), picks the right license tier from 4 (Pro Edition × 5 + EHR pass-through + distribution add-on), and for 4 specific services decides whether to use CPT or its HCPCS Level II equivalent (most have none; G-codes work for some Medicare-specific services). First Case where the puzzle pushes against the system rather than working within it; the design notes openly critique the licensing model.',
    href: './cpt-licensure-mire-prototype.html',
    district: 'coding',
    accent: '#f0a868',
  },

  {
    id: 'asp-wac-apothecary',
    title: 'ASP / WAC Apothecary',
    subtitle: '@ L5 — drug pricing reconciliation (Part B J-codes)',
    archetype: 'Apothecary',
    carc: 'CO-45 / CO-204 (J-code unit-count + basis)',
    targetLevel: 5,
    status: 'shipped',
    verbs: 'PRICE + CONVERT + APPEAL',
    testing: 'Audrey Chen, oncology infusion. 400mg bevacizumab (J9035, descriptor "10 mg") billed as 1 unit (interpreted as one vial); Anthem paid the case at ASP+6% × 1 unit = $22.79 against an expected $911.60 (40 units). Player picks the right reimbursement basis from 4 candidates (ASP+6%, WAC, AWP, CDM), the right unit conversion from 4 (1, 4, 40, 400 units), and files an underpayment appeal with the right shortfall + reason from 4 options. Demonstrates: drug pricing has more "prices" than any other part of RCM; reading the right column and doing the unit math is the muscle.',
    href: './asp-wac-apothecary-prototype.html',
    district: 'billing',
    accent: '#ef5b7b',
  },

  {
    id: 'chemo-bundle-specter',
    title: 'Chemo Bundle Specter',
    subtitle: '@ L6 — UHC chemo case rate bundles drug; CDM doesn\'t know',
    archetype: 'Specter',
    carc: 'CO-234 (correctly bundled — fix is upstream)',
    targetLevel: 6,
    status: 'shipped',
    verbs: 'READ-CLAUSE + EXAMINE-CDM + HARD-CODE',
    testing: 'Sarah Khan\'s chemo session at Mercy Cancer Center came back with two CO-234 denials on the J-code drugs (paclitaxel, carboplatin). Looks like an underpayment, isn\'t — UHC\'s contract section 8.3(c) bundles the drug into a chemo case rate when CPT 96413 + Rev 0335 are present. The bug is in the chargemaster: it hard-codes the drugs as separate billable lines instead of folding them into a bundled case-rate charge entry. Player walks 4 contract clauses (only 8.3(c) governs), inspects 4 chargemaster entries (3 misconfigured, 1 right), and picks the right resolution from 5 paths (only "update CDM, suppress J-code drops on UHC chemo" is correct). First Case where the bug is in the chargemaster, not the claim. Demonstrates: most underpayments AR analysts chase are upstream config, not downstream adjudication.',
    href: './chemo-bundle-specter-prototype.html',
    district: 'billing',
    accent: '#ef5b7b',
  },

  {
    id: 'outpatient-surgery-grouper',
    title: 'Outpatient Surgery Grouper',
    subtitle: '@ L7 — UHC OPG bypassed by wrong rev code',
    archetype: 'Specter',
    carc: 'CO-45 (default-fee adjudication; OPG never fired)',
    targetLevel: 7,
    status: 'shipped',
    verbs: 'VERIFY-GROUPER + DIAGNOSE-VARIANCE + CORRECT',
    testing: "Renee Cordero, outpatient colonoscopy with biopsy at the OP Surg Group. UHC paid $620 against Mercy's $1,400 expected (UHC's Outpatient Procedure Grouper Level 4). Looks like a CO-45 contractual write-off; isn't — UHC's adjudicator routes claims through the OPG only when an accepted revenue code is present, and Mercy's chargemaster dropped Rev 0750 (Gastrointestinal Services, non-surgical) instead of Rev 0490 (Ambulatory Surgery). The grouper bypassed; default fee schedule applied. Player walks 4 OPG-mechanic statements (with the 'grouper changed in 7/1/25' decoy — actually only 0.08% of codes moved), picks the right cause from 5 candidates (4 plausible decoys: grouper update, multi-procedure reduction, NCCI bundle, stale internal table), and picks the right resolution from 5 paths (refile + update CDM is correct; appeal-the-grouper, reconsider-with-original-rev, bill-patient, recoup are decoys). Reference: UHC's 7/1/25 OPG Exhibit (uhcprovider.com). Direct sibling to Chemo Bundle Specter — same upstream-fix muscle, different UHC mechanism.",
    href: './outpatient-surgery-grouper-prototype.html',
    district: 'billing',
    accent: '#ef5b7b',
  },

  {
    id: 'implant-carveout-specter',
    title: 'Implant Carve-out Specter',
    subtitle: '@ L6 — high-cost implant outside the case rate',
    archetype: 'Specter',
    carc: 'contractual line-level underpayment',
    targetLevel: 6,
    status: 'shipped',
    verbs: 'ITEMIZE + INVOICE-MATCH + APPEND',
    testing: 'Greg Watson, lumbar fusion (DRG 460), $24k spinal hardware unflagged at billing and silently rolled into the case rate. Contract appendix carves out implants at invoice +20% above the $5k threshold. Player itemizes 6 claim lines (1 carve-out, 5 rolled-in), matches the right Stryker invoice from a 4-invoice file (decoys: wrong patient = audit risk, wrong anatomy, OR consumables), applies the right formula (invoice +20%, not CDM gross, not invoice-only, not +50%). Sibling to Case Rate Specter — same contract, different clause.',
    href: './implant-carveout-specter-prototype.html',
    district: 'billing',
    accent: '#ef5b7b',
  },

  {
    id: 'stoploss-reckoner',
    title: 'Stoploss Reckoner',
    subtitle: '@ L4 — high-cost ICU stay trips the stoploss',
    archetype: 'Reckoner',
    carc: 'contractual underpayment',
    targetLevel: 4,
    status: 'shipped',
    verbs: 'TRIP + RECALCULATE + APPEAL',
    testing: 'Lucia Romero, 22-day ICU sepsis stay (DRG 871). $312k charges, $48k case rate paid. Anthem contract has a stoploss provision: charges > 4× case rate ($192k threshold) flips payment to 65% of charges ($202,800). Player walks 4 trip statements (math + mutual-exclusivity), picks the right formula (4 candidates; 65% is correct, 75% outlier and 100% billed are decoys), and files the appeal with the right shortfall ($154,800) on the right citation. First Case where the math is the puzzle, not the lookup. Re-leveled to L4 (was L7) so the contract-math archetype lands earlier in the run, before the long L8 stretch — gives players a billing-district math fight before the late-game appeals avalanche. SPATIAL HOME: when wired into LEVELS[4], stage the encounter at Patient Services (Sam routes the underpayment EOB) rather than Billing — the Billing room is locked until L6 in the phase plan.',
    href: './stoploss-reckoner-prototype.html',
    district: 'billing',
    accent: '#ef5b7b',
  },

  {
    id: 'ob-perdiem-specter',
    title: 'OB Per-Diem Specter',
    subtitle: '@ L7 — case rate + per-diem hybrid contract',
    archetype: 'Specter',
    carc: 'contractual underpayment (low-acuity OB)',
    targetLevel: 7,
    status: 'shipped',
    verbs: 'PARSE-CONTRACT + SPLIT-DAYS + APPEAL',
    testing: 'Imani Carter, vaginal delivery DRG 775, 5-day stay (chorioamnionitis complication). Contract: case rate $7,200 covers days 1-2; per-diem $1,400/day for days 3+. Hospital applied case rate alone; per-diem days never billed. Player parses 4 statements (mutually-INclusive vs exclusive trap), allocates 5 days into case-rate-window vs per-diem-days, files corrected claim with $4,200 shortfall. Sibling to Case Rate Specter / Stoploss Reckoner — same Anthem contract, different threshold mechanic. Demonstrates: complications can extend a stay without re-DRG\'ing it; per-diem clauses exist precisely for that case.',
    href: './ob-perdiem-specter-prototype.html',
    district: 'billing',
    accent: '#ef5b7b',
  },
]

function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function renderHeader(): string {
  return `
    <header class="page-h">
      <div class="title-row">
        <h1>The Waiting Room · Case Prototypes</h1>
        <a class="back-link" href="./">← back to game</a>
      </div>
      <p class="lede">
        One playable sketch per <em>Case</em> — the player-side
        problem they solve in a single encounter. Each prototype
        tests what battles look like in this game without HP,
        without tools-as-damage, and without multiple choice.
        They share a framework
        (<em>Hospital intro → dreamlike fall → claim form +
        middle work + checklist</em>); they differ in action set
        and rhythm.
      </p>
      <p class="meta">
        ${prototypes.filter(p => p.status === 'shipped').length} shipped ·
        ${prototypes.filter(p => p.status === 'planned').length} planned
      </p>
    </header>
  `
}

function renderDistrictKey(): string {
  const districts: Array<{ key: Prototype['district']; label: string; color: string; gloss: string }> = [
    { key: 'eligibility',   label: 'Eligibility',   color: '#7ee2c1', gloss: 'who is covered, by what, with what number' },
    { key: 'coding',        label: 'Coding',        color: '#f0a868', gloss: 'what was done, in what document, with what code' },
    { key: 'billing',       label: 'Billing',       color: '#ef5b7b', gloss: 'how it adjudicates and how it gets paid' },
    { key: 'appeals',       label: 'Appeals',       color: '#b18bd6', gloss: 'how denials get unwound' },
    { key: 'release-valve', label: 'Release valve', color: '#e8c074', gloss: 'patient-facing kindness — restorative, not combative' },
  ]
  return `
    <section class="district-key">
      <div class="dk-h">
        <span class="dk-tag">DISTRICT KEY</span>
        <span class="dk-sub">Four Waiting Room districts plus a special fifth category for restorative, non-combat encounters.</span>
      </div>
      <div class="dk-row">
        ${districts.map(d => {
          const count = prototypes.filter(p => p.district === d.key).length
          return `
            <div class="dk-item" style="--dk-color: ${d.color};">
              <span class="dk-swatch"></span>
              <div class="dk-text">
                <span class="dk-name">${escape(d.label.toUpperCase())}</span>
                <span class="dk-gloss">${escape(d.gloss)}</span>
                <span class="dk-count">${count} prototype${count === 1 ? '' : 's'}</span>
              </div>
            </div>
          `
        }).join('')}
      </div>
    </section>
  `
}

function renderCard(p: Prototype): string {
  const isShipped = p.status === 'shipped'
  const recap = CASE_RECAPS[p.id]
  return `
    <article class="card ${isShipped ? 'shipped' : 'planned'}" style="--card-accent: ${p.accent};">
      <div class="card-accent"></div>
      <div class="card-body">
        <div class="card-district">${p.district === 'release-valve' ? 'RELEASE VALVE' : p.district.toUpperCase() + ' · DISTRICT'}</div>
        <div class="card-pills">
          <span class="pill carc">${escape(p.carc)}</span>
          <span class="pill level" title="Roadmap target level — when this Case is intended to land in the in-game progression. Not all catalog Cases are wired into LEVELS[].cases yet.">→L${p.targetLevel}</span>
          <span class="pill verbs">${escape(p.verbs)}</span>
          <span class="pill status ${p.status}">${p.status}</span>
        </div>
        <h2 class="card-title">${escape(p.title)}</h2>
        <p class="card-subtitle">${escape(p.subtitle)}</p>
        <p class="card-testing"><strong>Tests:</strong> ${escape(p.testing)}</p>
        ${recap ? renderCardRecap(recap) : ''}
        ${p.href
          ? `<a class="card-cta" href="${p.href}">Open prototype →</a>`
          : '<span class="card-cta disabled">Not yet built</span>'}
      </div>
    </article>
  `
}

function renderCardRecap(recap: CaseRecap): string {
  return `
    <details class="card-recap">
      <summary>What this Case teaches <span class="card-recap-caret">▾</span></summary>
      <div class="card-recap-body">
        <p class="card-recap-lede">${escape(recap.oneLineRecap)}</p>
        <div class="card-recap-block">
          <h4>Key concepts</h4>
          <ul class="card-recap-concepts">
            ${recap.keyConcepts.map(c => `
              <li><strong>${escape(c.term)}.</strong> ${escape(c.gist)}</li>
            `).join('')}
          </ul>
        </div>
        <p class="card-recap-go-deeper">
          Play the Case, then use the post-victory recap page to open
          the concepts in an AI assistant.
        </p>
      </div>
    </details>
  `
}

function renderFramework(): string {
  return `
    <section class="framework">
      <h2>The framework these Cases share</h2>
      <ol>
        <li>
          <strong>Hospital intro.</strong> Warm, slow,
          human-scaled. A patient or doctor brings the player a
          stuck claim. Heavy emotional weight lives here.
        </li>
        <li>
          <strong>The dreamlike fall.</strong> The world ripples;
          the fluorescent flickers; the player is somewhere else.
          Not a button. Not a menu. The Waiting Room <em>takes</em>
          them.
        </li>
        <li>
          <strong>Claim form as playing field.</strong> The
          CMS-1500 sits at the top. Disputed boxes are flagged
          DISPUTED. Margin callouts point at fixable rows.
        </li>
        <li>
          <strong>Workbench: payer note + chart + reference doc.</strong>
          Three columns of pieces the player connects. Plain-
          English first; technical (chart language, policy
          quotes) below as a smaller reference.
        </li>
        <li>
          <strong>Citation builder.</strong> Three slots — payer
          asserts / chart cites / per policy. CITE when ready.
        </li>
        <li>
          <strong>Defense packet checklist.</strong> Issues to
          resolve. AMEND for fields you can fix; CITE for
          arguments you have to make.
        </li>
        <li>
          <strong>Submit.</strong> "Submit Defense Packet" or
          "Submit Corrected Claim" depending on what the
          encounter asks for.
        </li>
      </ol>
      <p class="framework-cta">
        Each Case tunes <em>what's in</em> each part to its own
        encounter. The shape stays the same; the rhythm doesn't.
        That's the framework working.
      </p>
    </section>
  `
}

function renderFooter(): string {
  return `
    <footer class="page-f">
      <p>
        Case-prototype source lives in
        <code>src/wraith-prototype/</code>,
        <code>src/bundle-prototype/</code>, etc. — one folder per
        Case. Design notes for each Case live in
        <a href="https://github.com/chansooligans/the-waiting-room/tree/main/reference/puzzles">reference/puzzles/</a>;
        the curriculum spine is in
        <a href="https://github.com/chansooligans/the-waiting-room/tree/main/reference/curriculum">reference/curriculum/</a>.
      </p>
    </footer>
  `
}

function render(): string {
  return `
    ${renderHeader()}
    ${renderDistrictKey()}
    <section class="cards">
      ${prototypes.map(renderCard).join('')}
    </section>
    ${renderFramework()}
    ${renderFooter()}
  `
}

const css = `
  :root {
    --bg: #0a0d12; --panel: #161b24; --panel-2: #1d2330;
    --ink: #d8dee9; --ink-dim: #8a93a3;
    --accent: #7ee2c1; --accent-2: #f0a868;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    background: var(--bg); color: var(--ink);
    font: 14.5px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, system-ui, sans-serif;
    padding: 32px 20px 80px;
    max-width: 1180px; margin: 0 auto;
    position: relative;
  }
  body::before {
    content: ""; position: fixed; inset: 0; pointer-events: none;
    background:
      radial-gradient(ellipse at 20% 20%, rgba(126, 226, 193, 0.04), transparent 50%),
      radial-gradient(ellipse at 80% 80%, rgba(177, 139, 214, 0.04), transparent 50%);
    z-index: 0;
  }
  #catalog-root { position: relative; z-index: 1; }

  a { color: var(--accent); }
  h1, h2, h3 { color: var(--ink); margin: 0 0 8px; }
  h1 { font-size: 28px; letter-spacing: -0.01em; }
  h2 { font-size: 20px; }
  code { background: #0a0d12; padding: 1px 6px; border-radius: 4px; font-size: 0.92em; }

  .page-h { margin-bottom: 28px; }
  .title-row { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .lede { color: var(--ink-dim); margin: 6px 0 4px; max-width: 800px; }
  .meta { color: var(--ink-dim); font-size: 12px; margin: 0; text-transform: uppercase; letter-spacing: 0.08em; }
  .back-link { font-size: 13px; }

  .district-key {
    background: var(--panel);
    border: 1px solid #232a36;
    border-radius: 10px;
    padding: 16px 20px;
    margin-bottom: 22px;
  }
  .dk-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .dk-tag {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: var(--ink-dim);
  }
  .dk-sub { font-size: 12.5px; color: var(--ink-dim); font-style: italic; line-height: 1.5; }
  .dk-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
  @media (max-width: 880px) { .dk-row { grid-template-columns: repeat(2, 1fr); } }
  .dk-item {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 10px 12px;
    background: var(--panel-2);
    border-left: 3px solid var(--dk-color);
    border-radius: 4px;
  }
  .dk-swatch {
    width: 12px; height: 12px;
    background: var(--dk-color);
    border-radius: 2px;
    flex-shrink: 0;
    margin-top: 3px;
  }
  .dk-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
  .dk-name {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--dk-color);
  }
  .dk-gloss { font-size: 12px; color: var(--ink); line-height: 1.4; }
  .dk-count { font-size: 10.5px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 16px;
    margin-bottom: 48px;
  }
  .card {
    display: flex;
    background: var(--panel);
    border: 1px solid #232a36;
    border-radius: 10px;
    overflow: hidden;
    transition: transform 0.15s, box-shadow 0.15s;
    position: relative;
  }
  .card.shipped:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4); }
  .card.planned { opacity: 0.6; }
  .card-accent {
    width: 6px;
    flex-shrink: 0;
    background: var(--card-accent);
  }
  .card-body { padding: 16px 18px; flex: 1; }
  .card-district {
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.14em;
    color: var(--card-accent);
    margin-bottom: 6px;
  }
  .card-pills { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .pill {
    font-size: 10.5px;
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--panel-2);
    border: 1px solid #2a3142;
    color: var(--ink-dim);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .pill.carc { color: #f3a4b6; border-color: #4a2a32; }
  .pill.level { color: var(--accent); border-color: #2c5547; }
  .pill.verbs { color: #a3c5ff; border-color: #2c3a55; font-family: ui-monospace, monospace; text-transform: none; letter-spacing: normal; font-size: 10px; }
  .pill.status.shipped { color: var(--accent); border-color: #2c5547; }
  .pill.status.planned { color: var(--ink-dim); }
  .card-title { font-size: 18px; margin-bottom: 4px; }
  .card-subtitle { color: var(--ink-dim); font-size: 12.5px; margin: 0 0 10px; font-style: italic; }
  .card-testing {
    color: var(--ink);
    font-size: 13px;
    line-height: 1.55;
    margin: 10px 0 12px;
  }
  /* Per-card recap (collapsible). Default closed so cards stay
     scannable; expanding shows key concepts + further-reading
     links pulled from CASE_RECAPS (single source of truth — same
     data the in-prototype victory page uses). */
  .card-recap { margin: 6px 0 14px; border-top: 1px dashed #232a36; }
  .card-recap summary {
    cursor: pointer;
    list-style: none;
    padding: 8px 0 6px;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--card-accent);
    user-select: none;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .card-recap summary::-webkit-details-marker { display: none; }
  .card-recap-caret { font-size: 10px; transition: transform 0.15s; }
  .card-recap[open] .card-recap-caret { transform: rotate(180deg); }
  .card-recap-body { padding: 4px 0 12px; }
  .card-recap-lede { font-size: 13px; line-height: 1.55; color: var(--ink); margin: 0 0 14px; }
  .card-recap-block h4 {
    font-size: 10.5px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--ink-dim);
    margin: 0 0 6px;
    font-weight: 700;
  }
  .card-recap-concepts { list-style: none; padding-left: 0; margin: 0; }
  .card-recap-concepts li {
    font-size: 12px;
    line-height: 1.5;
    color: var(--ink);
    padding: 5px 0;
    border-bottom: 1px dashed #232a36;
  }
  .card-recap-concepts li:last-child { border-bottom: none; }
  .card-recap-concepts li strong { color: var(--card-accent); font-weight: 600; }
  .card-recap-go-deeper {
    font-size: 11.5px; color: var(--ink-dim); line-height: 1.5;
    margin: 14px 0 0; font-style: italic;
  }
  .card-cta {
    display: inline-block;
    padding: 6px 14px;
    background: var(--accent);
    color: #0a0d12;
    border-radius: 4px;
    text-decoration: none;
    font-size: 12.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    transition: background 0.15s;
  }
  .card-cta:hover { background: #a8efd4; }
  .card-cta.disabled {
    background: var(--panel-2);
    color: var(--ink-dim);
    cursor: not-allowed;
    border: 1px dashed #2a3142;
  }

  .framework {
    background: var(--panel);
    border: 1px solid #232a36;
    border-radius: 10px;
    padding: 24px 28px;
    margin-bottom: 36px;
  }
  .framework h2 { margin-bottom: 14px; }
  .framework ol { padding-left: 24px; }
  .framework li {
    font-size: 13.5px;
    line-height: 1.6;
    margin: 8px 0;
  }
  .framework strong { color: var(--accent); }
  .framework-cta {
    margin-top: 16px;
    padding: 12px 14px;
    background: rgba(126, 226, 193, 0.06);
    border-left: 3px solid var(--accent);
    font-size: 13px;
    color: var(--ink);
    border-radius: 3px;
  }

  .page-f { color: var(--ink-dim); font-size: 12.5px; margin-top: 60px; }
  .page-f p { margin: 0; }
`

function mount() {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  const root = document.getElementById('catalog-root')
  if (root) root.innerHTML = render()
}

mount()
