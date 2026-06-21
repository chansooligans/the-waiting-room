// Data Sandbox tips library — the team's documentation page.
//
// Surfaced in-game by the Sandbox terminal (the 'B' whiteboard at
// the north wall of DATA_SANDBOX): walk up to it and press E to
// open the TipsTerminalScene overlay. The overlay shows:
//
//   1. Per-level orientation — where to go, who hands the case, what
//      the case teaches. Always rendered for the player's current
//      currentLevel.
//   2. Per-encounter hints — short bullet-list playbooks for every
//      encounter. Only rendered for encounters the player has seen
//      (`state.obstaclesSeen`) but not yet defeated. Solved
//      encounters collapse to a "✓ done" line.
//
// Voice: collaborative, first-person plural, slightly tech-witty.
// The terminal is the team's wiki, not Dana's notebook — different
// register on purpose.
//
// Authored against the 33-level case order in `case-order.ts`.
// Catalog encounters (the 21 that mount via PrototypeIframeScene)
// get briefer hints; their full puzzle content lives in the
// standalone prototype HTML page.

/** Per-level orientation. Rendered as bullets. */
export const LEVEL_GUIDANCE: Record<number, string[]> = {
  1: [
    "Anjali walks up to your desk in the lobby. Talk to her — she's holding the case.",
    "Click the disputed field on the claim, pick the value the chart actually supports, and resubmit.",
    "The 271 eligibility response on file is the source of truth. The card was stale; the 271 is the record that matters.",
  ],
  2: [
    "Alex flagged a J-code denial in the Main Hub — ASP / WAC / NDC↔HCPCS territory.",
    "Part B drugs pay at ASP+6% (Average Sales Price plus six percent). New drugs pay WAC+3% until ASP data exists.",
    "J-code units count actual dose, not packages. 50mg J3490 = 1 unit; billing 50 units is the dispute.",
  ],
  3: [
    "Kim's at the Registration counter. Stale insurance card after a job change.",
    "Run a fresh 270 eligibility inquiry. The 271 carries the patient's current plan, ID, group — the source of truth.",
    "Amend the subscriber ID + group number from the 271 response.",
  ],
  4: [
    "Alex stepped out to the parking lot over a stoploss case — take the lobby EXIT teleport to reach him.",
    "Stoploss provisions kick in when charges exceed a contracted threshold. Calculation: charges × outlier % vs. the contract's stoploss formula.",
    "Common error: the contract's stoploss threshold is on TOTAL charges, not just the line item that triggered.",
  ],
  5: [
    "South wing opens up. Pat moved down to HIM / Coding.",
    "CO-97 bundled-service denial. Modifier 25 + chart support for a separately identifiable E&M.",
    "Pull Sarah Kim's op-note from Med Records first. Pat won't hand off until you've got it.",
  ],
  6: [
    "Pat at Registration. Outpatient surgery grouper case — APC packaging.",
    "APC = Ambulatory Payment Classification. Bundles outpatient services into payment groups based on resource intensity.",
    "Status indicators drive packaging behavior. 'T' = significant procedure paid separately; 'N' = packaged into the primary service.",
  ],
  7: [
    "Jordan in Eligibility. A no-show fee policy call.",
    "When to waive: clinically urgent follow-up, financial hardship, first-time miss. When to enforce: repeat no-show pattern, no contact attempt.",
    "Patient-facing language matters more than the math here. The script is the policy.",
  ],
  8: [
    "Martinez is in Prior Auth. CO-197 — no auth on file for an MRI.",
    "File a retroactive 278 with proper clinical rationale. Pick the rationale that matches both the chart AND the payer's UM criteria.",
    "Once the 278 returns the auth number, amend Box 23 on the claim. Single-amend close.",
  ],
  9: [
    "Jordan in Eligibility. A patient with no path to pay.",
    "Charity care under §501(r). Financial assistance policy + presumptive eligibility screen.",
    "Patient-facing case. The system you're operating is the safety net.",
  ],
  10: [
    "Sam in Patient Services. GFE-vs-bill mismatch.",
    "GFE = Good Faith Estimate. NSA requires uninsured/self-pay patients to receive one in advance.",
    "If the bill exceeds the GFE by >$400, the patient has appeal rights via the patient-provider dispute resolution process.",
  ],
  11: [
    "Sam has the Walker echo. Pull the chart at Med Records first.",
    "CO-50 medical-necessity denial. Citation-chain appeal across three sources.",
    "All three pieces (payer phrase, chart fact, policy clause) must address the SAME issue. Mismatch is the test.",
  ],
  12: [
    "Cal cleared the back-wing corridor. Alex is in Billing. The clearinghouse is bleeding.",
    "CO-16 catch-all. Read the RARC + 277CA detail — that's where the real reason lives.",
    "Frequency-code-7 replacement for corrected resubmits so you don't dupe-flag.",
  ],
  13: [
    "Kim at Registration. A duplicate that shouldn't exist.",
    "CO-18: exact duplicate. The payer's matching algorithm flagged this as identical to one on file.",
    "Frequency codes (0/7/8). Replacement claims must reference the original ICN.",
  ],
  14: [
    "Alex in Billing. Implant carve-out went sideways.",
    "When implant cost exceeds the stoploss threshold, the contract carves it out from the case rate as an invoice-based add-on.",
    "Pull the manufacturer invoice and the contract's stoploss section. The math is in the deltas.",
  ],
  15: [
    "Kim at Registration. A new hire whose credentialing isn't finished yet.",
    "Provider credentialing = the payer's process for approving a doc to bill under their network.",
    "Retro-credentialing is sometimes available. If not, the bill goes through under a covering credentialed provider OR self-pay.",
  ],
  16: [
    "Alex in Billing. Two bills for one ER visit — the facility billed in-network, the physician group OON.",
    "NSA carve-out: patient owes in-network cost-share on the OON physician bill at an in-network facility.",
    "Recalculate cost-share. The OON physician and the payer route to IDR. Patient is out of the rate fight.",
  ],
  17: [
    "Pat in HIM. AMA CPT licensing edge case.",
    "AMA owns CPT and licenses it. Derivative works (code mappings, crosswalks) need licensing or a public-domain alternative (HCPCS Level II).",
    "Internal use vs. publication has different licensing tiers. Read the actual terms; don't assume.",
  ],
  18: [
    "Sam in Patient Services. The reaper has surfaced.",
    "CO-29 timely filing. Find the first-submit timestamp on the 277CA chain.",
    "Subscriber-ID typo is the most common reason a timely claim gets denied 'not on file.' Amend the ID + attach the 277CA evidence.",
  ],
  19: [
    "Jordan is now at the PFS phone bank. Surprise-bill territory.",
    "NSA caps patient cost-share to in-network levels for emergency + ancillary services at in-network facilities.",
    "OON provider and payer fight in IDR. Patient is out once cost-share is calculated correctly.",
  ],
  20: [
    "Alex in Billing. OB per-diem with a C-section escalator.",
    "OB per-diem contracts usually have escalators for cesarean delivery, NICU, multiples.",
    "Check that the escalator triggered. Often a coding-side miss (procedure code didn't propagate to the per-diem rate calc).",
  ],
  21: [
    "Kim at Registration. Two patients matched into the same demographic profile.",
    "Identity matching collision — same name + DOB + zip code, different patients.",
    "Pull the chart history. Look for treatment timeline gaps that prove these are distinct people. Resolve at the source.",
  ],
  22: [
    "Pat in HIM. HCC capture annual review.",
    "HCC (Hierarchical Condition Categories) drive Medicare Advantage risk-adjusted payment.",
    "Chronic conditions must be coded every year. Drops one year, the RAF score evaporates. Pull the chart, capture what's actually documented.",
  ],
  23: [
    "Alex in Billing. Chemo bundled into the case rate; admin code dropped.",
    "Chemotherapy admin (96413, 96415) is often bundled with the drug + case rate. The breakdown matters for revenue capture.",
    "Pull the contract's chemo carve-out terms + the actual claim. Find the missing admin units.",
  ],
  24: [
    "Pat in HIM. Two-midnight inpatient vs observation question.",
    "Medicare 2-midnight rule: an inpatient admission is presumed appropriate if it spans ≥2 midnights AND is medically necessary.",
    "<2 midnights = observation unless physician documents a clinically-justified reason for inpatient.",
  ],
  25: [
    "Alex in Billing. CO-45 underpayment streak.",
    "CO-45 = charges exceed fee schedule / allowed amount. Common but worth scrutinizing — sometimes the fee schedule is wrong.",
    "Compare paid amount to the contract's negotiated rate. If there's a delta, file the dispute.",
  ],
  26: [
    "Kim at Registration. Multi-payer COB cascade.",
    "Three coverages = three potential primaries. Birthday rule, employer-vs-retiree, Medicare secondary, spouse plan order.",
    "Run a fresh COB inquiry. The 271 will tell you what each payer currently thinks the order is — and they often disagree.",
  ],
  27: [
    "Alex in Billing. Case-rate vs per-diem mismatch.",
    "Case rate = one bundled payment for the whole stay. Per-diem = paid per day.",
    "Multi-day stays paid as case rate often underpay vs. per-diem. Check the contract's case-rate threshold and the actual LOS.",
  ],
  28: [
    "Sam in Patient Services. Mapping a payer's MRF.",
    "MRF = Machine-Readable File. CMS rule requires payers to publish negotiated rates. Files are huge JSON.",
    "Find the negotiated rate for the disputed CPT in the payer's MRF. Use jq + a grep — the rate is there if the rule was followed.",
  ],
  29: [
    "Sam in Patient Services. An IDR submission.",
    "IDR = Independent Dispute Resolution. NSA arbitration. Baseball-style: each side submits one number, the arbiter picks one.",
    "Defend the math. QPA (Qualifying Payment Amount), historical rates, complexity factors. The closer your number is to QPA, the more often you win.",
  ],
  30: [
    "Alex in Billing. 340B rate clawback.",
    "340B program lets eligible hospitals buy outpatient drugs at deep discount. After Becerra v. AHA, post-2023 reimbursement rules changed.",
    "Check the drug's 340B eligibility + the date of service. Some clawbacks were retroactive; some are forward-looking.",
  ],
  31: [
    "Sam in Patient Services. A faxed PHI page went to the wrong number.",
    "HIPAA breach response: four-factor assessment (nature of PHI, who received, was it actually viewed, mitigation).",
    "Under 500 individuals = annual report to HHS. Over 500 = notify HHS + media within 60 days.",
  ],
  32: [
    "Dana is on the Auditorium stage. Talking to her starts the boss encounter.",
    "The audit covers everything you've touched in the last 90 days. Documentation, modifiers, medical necessity, the whole stack.",
    "RECEIPT vs AMEND: defend the original work with chart evidence (RECEIPT), or concede + accept the recoupment (AMEND). Pick the right one per finding.",
  ],

}

/** Per-encounter hints. Keyed by encounter id (matches `enemies.ts`).
 *  Rendered only for encounters the player has seen but not defeated;
 *  defeated ones collapse to a one-line "✓ solved" entry. */
export const ENCOUNTER_HINTS: Record<string, { name: string; level: number; hints: string[] }> = {
  // ----- Core story encounters (in-game playable via their Case prototype) -----
  intro_wrong_card: {
    name: "The Wrong Card (L1)",
    level: 1,
    hints: [
      "Anjali handed her husband's insurance card at check-in. Different subscriber id than hers.",
      "The 271 eligibility response shows her on the plan as a dependent under her own id (AET447821491).",
      "Amend Box 1a to her id and resubmit. Single-issue case.",
    ],
  },
  eligibility_fog: {
    name: "Eligibility Fog (L3)",
    level: 3,
    hints: [
      "The patient changed jobs three months ago. The card she handed over is from her old plan.",
      "Run a fresh 270. The 271 carries her current plan, ID, group — the source of truth.",
      "Amend Box 1a (subscriber ID) and the group field from the 271 response.",
    ],
  },
  co_197: {
    name: "Gatekeeper · Prior Auth (L8)",
    level: 5,
    hints: [
      "CO-197: prior authorization absent or invalid. File a retroactive 278 with proper clinical rationale.",
      "Pick the rationale that matches both the chart AND UHC's UM criteria.",
      "Once the 278 returns the auth number, amend Box 23 on the claim.",
    ],
  },
  co_50: {
    name: "Wraith · Medical Necessity (L11)",
    level: 12,
    hints: [
      "CO-50: not deemed medically necessary. The payer doesn't think the diagnosis supports the procedure.",
      "Pull the echo report from Med Records first — Sam won't hand off the case until you have it.",
      "Citation chain: payer's denial phrase + chart fact + policy clause. All three must address the same issue.",
    ],
  },
  co_97: {
    name: "Bundle · Modifier 25 (L5)",
    level: 9,
    hints: [
      "CO-97: bundled service. The payer rolled the E&M into the procedure.",
      "Pull Sarah Kim's op-note from Med Records — it shows the E&M was significant + separately identifiable.",
      "Modifier 25 goes on the E&M line, not the procedure. NCCI edits with indicator '1' allow modifier override.",
    ],
  },
  co_16_swarm: {
    name: "Swarm · Clearinghouse (L12)",
    level: 13,
    hints: [
      "277CA waves — clearinghouse rejecting batches before they reach the payer.",
      "Each rejection has its own STC code. Read them; some are real billing errors, some are formatting.",
      "Resubmit corrected claims with frequency code 7 (replacement) so you don't dupe-flag.",
    ],
  },
  co_29_reaper: {
    name: "Reaper · Timely Filing (L18)",
    level: 19,
    hints: [
      "CO-29: timely filing limit exceeded. Look for the first-submit timestamp in the 277CA chain.",
      "Subscriber-id typos are the most common reason a timely claim gets denied as 'not on file.' Amend + attach evidence.",
      "If the original WAS timely, the appeal is procedural, not substantive. Keep the citation tight.",
    ],
  },
  surprise_bill_specter: {
    name: "Specter · Surprise Bill (L19)",
    level: 20,
    hints: [
      "NSA territory — caps cost-share to in-network levels for emergency + ancillary services at in-network facilities.",
      "Recalculate cost-share at the in-network rate. The patient owes that, not the OON rate.",
      "The OON provider and the payer fight in IDR. The patient is out once cost-share is correct.",
    ],
  },
  lighthouse_charity: {
    name: "Lighthouse · Charity Care (L9)",
    level: 10,
    hints: [
      "§501(r) — non-profit hospitals must screen patients for financial assistance.",
      "Presumptive eligibility lets the hospital approve assistance without a full application when external indicators match.",
      "Document the screen. The chart + the screen result are the audit defense.",
    ],
  },
  co_18_doppelganger: {
    name: "Doppelgänger · Duplicate (L13)",
    level: 14,
    hints: [
      "CO-18: exact duplicate. Two claims look identical to the payer's matching algorithm.",
      "Check frequency codes. 0 = original, 7 = replacement, 8 = void. The duplicate is usually a missing 7.",
      "ICN (internal control number) matters — always reference the original ICN on the replacement.",
    ],
  },
  underpayment_specter: {
    name: "Underpayment Specter (L25)",
    level: 26,
    hints: [
      "CO-45: paid amount under the contract rate. The payer's adjudication landed below the contract math.",
      "Compare the EOR's allowed amount to the negotiated rate in the contract or the MRF.",
      "File the underpayment dispute with the contract clause cited.",
    ],
  },
  boss_audit: {
    name: "Audit · The Reckoning (L32)",
    level: 33,
    hints: [
      "Three findings. For each one, you choose RECEIPT (defend with chart evidence) or AMEND (concede + accept the recoupment).",
      "Concede fast on real errors. Don't burn goodwill defending the indefensible.",
      "Documentation > argumentation. If it's in the chart, lead with the chart. If it's not in the chart, you don't have an argument.",
    ],
  },

  // ----- 21 catalog-only encounters (in-game playable via PrototypeIframeScene) -----
  catalog_asp_wac_apothecary: {
    name: "ASP / WAC Apothecary (L2)",
    level: 2,
    hints: [
      "Part B drugs reimburse at ASP+6% (Average Sales Price). New drugs pay WAC+3% until ASP data lands.",
      "Check J-code units against actual dose. 50mg J3490 = 1 unit, not 50.",
      "If the NDC↔HCPCS crosswalk is off, the entire claim line misroutes.",
    ],
  },
  catalog_stoploss_reckoner: {
    name: "Stoploss Reckoner (L4)",
    level: 4,
    hints: [
      "Stoploss provisions: contracted threshold + outlier % above which charges revert to charge-based pricing.",
      "Run the math on total charges vs. the case-rate ceiling. The delta is the dispute.",
      "Implant + drug carve-outs interact with stoploss. Read the contract carefully.",
    ],
  },
  catalog_form_mirror: {
    name: "Form Mirror (catalog)",
    level: 6,
    hints: [
      "CMS-1500 = professional (837P, individual practitioner billing). UB-04 = institutional (837I, hospital/facility).",
      "Same service can belong on either depending on the billing entity.",
      "If the form is wrong, the payer's intake routes the claim to the wrong adjudication path.",
    ],
  },
  catalog_outpatient_surgery_grouper: {
    name: "Outpatient Surgery Grouper (L6)",
    level: 7,
    hints: [
      "APC packaging: outpatient services group into payment classifications based on resource intensity.",
      "Status indicators drive behavior. 'T' = significant procedure, paid separately. 'N' = packaged into the primary.",
      "Mismatched status indicators are the most common APC-grouper denial.",
    ],
  },
  catalog_no_show_bill: {
    name: "No-Show Bill (L7)",
    level: 8,
    hints: [
      "Waive criteria: clinically urgent follow-up, financial hardship, first-time miss, miscommunication.",
      "Enforce criteria: repeat no-show pattern, no contact attempt, scheduled procedure block-out.",
      "Patient-facing language matters more than the math. The script is the policy.",
    ],
  },
  catalog_gfe_oracle: {
    name: "Good Faith Estimate Oracle (L10)",
    level: 11,
    hints: [
      "GFE = Good Faith Estimate. NSA requires it for uninsured/self-pay patients in advance.",
      "If actual bill exceeds GFE by >$400, the patient gets appeal rights via patient-provider dispute resolution.",
      "Check the GFE itemization. Missing line items vs. the actual claim are the most common gap.",
    ],
  },
  catalog_implant_carveout_specter: {
    name: "Implant Carve-Out Specter (L14)",
    level: 15,
    hints: [
      "When implant cost exceeds the stoploss threshold, most contracts carve it out from the case rate.",
      "Pull the manufacturer invoice. The reimbursement is invoice + markup, not the bundled case rate.",
      "Common miss: the carve-out clause triggers only above a threshold the contract management team didn't flag.",
    ],
  },
  catalog_credentialing_lattice: {
    name: "Credentialing Lattice (L15)",
    level: 16,
    hints: [
      "Credentialing = the payer's approval to bill under their network.",
      "Retro-credentialing is sometimes available for new hires. Check the payer's policy + the effective date.",
      "If not retro-able, the bill goes through under a covering credentialed provider OR self-pay.",
    ],
  },
  catalog_carveout_phantom: {
    name: "Carve-Out Phantom (L16)",
    level: 17,
    hints: [
      "In-network facility + OON physician group at the same ER visit = NSA carve-out applies.",
      "Patient owes in-network cost-share on the OON physician bill. Recalculate.",
      "OON physician + payer fight in IDR. Patient is out of the rate dispute.",
    ],
  },
  catalog_cpt_licensure_mire: {
    name: "CPT Licensure Mire (L17)",
    level: 18,
    hints: [
      "AMA owns CPT and licenses it. Derivative works (crosswalks, mappings) need a license.",
      "HCPCS Level II is public-domain for some equivalents. Sometimes the right answer is to switch.",
      "Internal use vs. publication has different licensing tiers. Read the actual terms.",
    ],
  },
  catalog_ob_perdiem_specter: {
    name: "OB Per-Diem Specter (L20)",
    level: 21,
    hints: [
      "OB per-diem contracts have escalators for C-section, NICU, multiple births.",
      "Check that the procedure code propagated to the per-diem rate calc. Most underpayments are upstream of the rate.",
      "Pull the L&D chart + the contract's escalator clause. The math is in the delta.",
    ],
  },
  catalog_phantom_patient: {
    name: "Phantom Patient (L21)",
    level: 22,
    hints: [
      "Identity-matching collision: same name + DOB + zip, different patients.",
      "Pull the chart history. Look for timeline gaps that prove these are distinct people.",
      "Resolve at the MRN level. Merging two charts wrongly is worse than the original collision.",
    ],
  },
  catalog_risk_adj_hollow: {
    name: "Risk Adjustment Hollow (L22)",
    level: 23,
    hints: [
      "HCC = Hierarchical Condition Categories. Drives Medicare Advantage risk-adjusted payment.",
      "Chronic conditions must be coded every year. Drops one year, the RAF score evaporates.",
      "Pull the chart. Capture what's actually documented in this year's encounters.",
    ],
  },
  catalog_chemo_bundle_specter: {
    name: "Chemo Bundle Specter (L23)",
    level: 24,
    hints: [
      "Chemo admin (96413, 96415) often bundles with the drug + case rate.",
      "If the admin code didn't propagate, the claim under-pays.",
      "Pull the contract's chemo carve-out terms + the actual claim. Find the missing units.",
    ],
  },
  catalog_two_midnight_mire: {
    name: "Two-Midnight Mire (L24)",
    level: 25,
    hints: [
      "Medicare 2-midnight rule: inpatient is presumed appropriate if it spans ≥2 midnights AND is medically necessary.",
      "<2 midnights = observation unless the physician documents a clinically-justified inpatient reason.",
      "Pull the H&P, progress notes, and the discharge summary. The clinical narrative is the defense.",
    ],
  },
  catalog_cob_cascade_spider: {
    name: "COB Cascade Spider (L26)",
    level: 27,
    hints: [
      "Three coverages = three potential primaries. Birthday rule, employer-vs-retiree, Medicare secondary, spouse plan.",
      "Run a fresh COB inquiry. The 271s often disagree about who's primary.",
      "Resolve at the source. Re-route the claim once COB order is established.",
    ],
  },
  catalog_case_rate_specter: {
    name: "Case-Rate Specter (L27)",
    level: 28,
    hints: [
      "Case rate = one bundled payment for the whole stay. Per-diem = paid per day.",
      "Multi-day stays paid as case rate often underpay vs. per-diem.",
      "Check the contract's case-rate threshold and the actual LOS. The math is in the delta.",
    ],
  },
  catalog_mrf_cartographer: {
    name: "MRF Cartographer (L28)",
    level: 29,
    hints: [
      "MRF = Machine-Readable File. CMS rule requires payers to publish negotiated rates.",
      "Files are huge JSON. jq + grep on the disputed CPT will find the rate.",
      "The rate is there if the rule was followed. Some payers publish in formats that are technically compliant but practically useless.",
    ],
  },
  catalog_idr_crucible: {
    name: "IDR Crucible (L29)",
    level: 30,
    hints: [
      "IDR = Independent Dispute Resolution. NSA arbitration, baseball-style.",
      "Each side submits one number. The arbiter picks one. Defend the math.",
      "QPA (Qualifying Payment Amount) is the benchmark. The closer to QPA, the more often you win.",
    ],
  },
  catalog_three_forty_b_specter: {
    name: "340B Specter (L30)",
    level: 31,
    hints: [
      "340B program: eligible hospitals buy outpatient drugs at deep discount.",
      "After Becerra v. AHA, post-2023 reimbursement rules changed. Some clawbacks were retroactive.",
      "Check the drug's 340B eligibility, the date of service, and the payer's clawback policy.",
    ],
  },
  catalog_hipaa_spider: {
    name: "HIPAA Spider (L31)",
    level: 32,
    hints: [
      "Four-factor assessment: nature of PHI, who received it, was it actually viewed, mitigation steps.",
      "For this training case: under 500 goes on the annual HHS log; 500+ triggers HHS and media notice timelines. Verify the current rule before treating it as live guidance.",
      "Don't say 'breach' until the four-factor assessment is complete. The word does work on its own.",
    ],
  },
}
