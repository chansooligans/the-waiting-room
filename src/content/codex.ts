import type { CodexEntry } from '../types'

export const CODEX_ENTRIES: Record<string, CodexEntry> = {
  // === Codes ===
  co_109: {
    id: 'co_109',
    name: 'CO-109',
    category: 'codes',
    description: 'Claim not covered by this payer per coordination of benefits.',
    detail: 'CARC CO-109 means the payer says the patient is not their member, or another payer is primary. Usually caused by stale insurance info at registration. Fix: run a 270 eligibility check before billing.',
  },
  co_11: {
    id: 'co_11',
    name: 'CO-11',
    category: 'codes',
    description: 'Diagnosis is inconsistent with the procedure.',
    detail: 'CARC CO-11 fires when the ICD-10 diagnosis code does not medically support the CPT procedure code billed. A CDI query before coding can prevent this by ensuring the clinical documentation explicitly links the condition to the procedure.',
  },
  co_16: {
    id: 'co_16',
    name: 'CO-16',
    category: 'codes',
    description: 'Claim lacks required information.',
    detail: 'CARC CO-16 is a catch-all for missing or invalid data. Common causes: blank fields in the 837, invalid taxonomy codes, missing NPI. Often appears as a 277CA front-end reject before the payer even sees the claim.',
  },
  co_22: {
    id: 'co_22',
    name: 'CO-22',
    category: 'codes',
    description: 'This care may be covered by another payer per coordination of benefits.',
    detail: 'CARC CO-22 means another insurance plan should be billed first. The coordination of benefits (COB) order is set by the employer and member services, not the provider. Run COB checks before billing.',
  },
  co_50: {
    id: 'co_50',
    name: 'CO-50',
    category: 'codes',
    description: 'These are non-covered services because this is not deemed a medical necessity.',
    detail: 'CARC CO-50 is the medical necessity denial. The payer says the service was not necessary for the documented condition. CDI before coding is the best prevention. Appeals work but cost 45+ minutes each.',
  },
  co_97: {
    id: 'co_97',
    name: 'CO-97',
    category: 'codes',
    description: 'The benefit for this service is included in the payment for another service.',
    detail: 'CARC CO-97 means the payer bundled two procedures together. CCI edits define which CPT codes are bundled. Modifier 59 (distinct procedural service) or modifier 25 (significant E/M) can unbundle when clinically appropriate.',
  },
  co_197: {
    id: 'co_197',
    name: 'CO-197',
    category: 'codes',
    description: 'Precertification/authorization/notification absent.',
    detail: 'CARC CO-197 means the service required prior authorization and none was on file. The 278 transaction is how auths are submitted electronically, though many providers still fax. Only fixable upstream — get the auth before the visit.',
  },
  pr_204: {
    id: 'pr_204',
    name: 'PR-204',
    category: 'codes',
    description: 'This service is not covered under the patient\'s current benefit plan.',
    detail: 'CARC PR-204 is a benefit exclusion. The patient\'s specific plan design does not cover the service. No appeal will change this. The correct response is a cost estimate before the visit so the patient knows what they will owe.',
  },
  oa_23: {
    id: 'oa_23',
    name: 'OA-23',
    category: 'codes',
    description: 'The impact of prior payer adjudication.',
    detail: 'CARC OA-23 appears when the primary payer has already processed the claim and adjusted payment. This is not a denial — it\'s a workflow signal. Send the ERA from the primary to the secondary payer with the claim.',
  },

  // === Forms ===
  cms1500: {
    id: 'cms1500',
    name: 'CMS-1500',
    category: 'forms',
    description: 'The standard paper claim form for professional (physician) services.',
    detail: 'CMS-1500 has 33 boxes covering patient info, insurance, diagnosis codes (ICD-10-CM), procedure codes (CPT/HCPCS), modifiers, place of service, charges, and provider info. The electronic equivalent is the 837P transaction.',
  },
  ub04: {
    id: 'ub04',
    name: 'UB-04',
    category: 'forms',
    description: 'The standard paper claim form for institutional (hospital) services.',
    detail: 'UB-04 has 81 form locators covering patient info, type of bill, admission/discharge info, revenue codes, ICD-10-PCS procedure codes, diagnosis codes, charges, and provider info. The electronic equivalent is the 837I transaction.',
  },

  // === Transactions ===
  x12_270_271: {
    id: 'x12_270_271',
    name: '270/271 Eligibility',
    category: 'transactions',
    description: 'Electronic eligibility inquiry (270) and response (271).',
    detail: 'The 270 asks: "Is this patient covered by this plan?" The 271 answers with coverage details, copay amounts, deductible status, and COB info. Takes seconds. Prevents CO-109 and CO-22 denials. Should run before every visit.',
  },
  x12_278: {
    id: 'x12_278',
    name: '278 Prior Auth',
    category: 'transactions',
    description: 'Electronic prior authorization request and response.',
    detail: 'The 278 transaction submits a prior authorization request to the payer and receives an approval, denial, or pend response. Most providers still fax auth requests, but electronic 278s are faster and create an audit trail.',
  },
  x12_837: {
    id: 'x12_837',
    name: '837 Claim',
    category: 'transactions',
    description: 'Electronic claim submission (837P for professional, 837I for institutional).',
    detail: 'The 837 is the electronic version of the CMS-1500 (837P) or UB-04 (837I). It goes from the provider to the clearinghouse to the payer. Loops and segments carry all the data from the paper form plus additional fields.',
  },
  x12_835: {
    id: 'x12_835',
    name: '835 Remittance',
    category: 'transactions',
    description: 'Electronic remittance advice (ERA) — the payer\'s payment explanation.',
    detail: 'The 835/ERA is the payer\'s response to a claim. It shows what was paid, what was adjusted, and why (via CARC/RARC codes). It\'s the electronic equivalent of the paper EOB. Payment posting reads the 835 to update the patient account.',
  },
  x12_277ca: {
    id: 'x12_277ca',
    name: '277CA',
    category: 'transactions',
    description: 'Claim acknowledgment — the clearinghouse\'s front-end validation result.',
    detail: 'The 277CA tells you whether the clearinghouse accepted or rejected the 837 before it reached the payer. Front-end rejects (277CA rejections) are not denials — they mean the claim had format or data errors. Fix and resubmit fast.',
  },

  // === Concepts ===
  denial_rate: {
    id: 'denial_rate',
    name: 'Denial Rate',
    category: 'concepts',
    description: 'The percentage of claims denied on first submission.',
    detail: 'Industry average denial rate is 10-15%. Every denied claim costs $25-118 to rework. A 1% reduction in denial rate at a mid-size hospital saves $1M+ annually. Most denials are preventable with upstream fixes.',
  },
  cdi: {
    id: 'cdi',
    name: 'CDI (Clinical Documentation Improvement)',
    category: 'concepts',
    description: 'The process of improving clinical documentation to support accurate coding.',
    detail: 'CDI specialists review charts while the patient is still in the hospital and send queries to physicians asking them to clarify diagnoses, specify conditions, and document severity. This happens BEFORE coding, preventing CO-11 and CO-50 denials downstream.',
  },
  medical_necessity: {
    id: 'medical_necessity',
    name: 'Medical Necessity',
    category: 'concepts',
    description: 'The payer\'s determination that a service was clinically appropriate.',
    detail: 'Payers publish medical policies defining what they consider necessary for each diagnosis. If the documentation doesn\'t meet the policy criteria, the claim is denied CO-50. The physician may have done the right thing clinically, but the documentation must prove it to the payer.',
  },
  cost_share: {
    id: 'cost_share',
    name: 'Patient Cost Share',
    category: 'concepts',
    description: 'The portion of a medical bill the patient is responsible for.',
    detail: 'Patient cost share flows: deductible first (patient pays 100% until met), then coinsurance (patient pays a percentage, e.g. 20%), with an out-of-pocket maximum cap. Copays are flat fees per visit. Same procedure, same plan, different deductible = different bill.',
  },
  icd10_cm: {
    id: 'icd10_cm',
    name: 'ICD-10-CM',
    category: 'codes',
    description: 'International Classification of Diseases, 10th Revision, Clinical Modification.',
    detail: 'ICD-10-CM has ~70,000 diagnosis codes. Used on every claim to describe WHY the patient needed care. Format: letter + digits (e.g., E11.9 = Type 2 diabetes). Specificity matters — an unspecified code may trigger a denial when a more specific code exists.',
  },
  modifiers: {
    id: 'modifiers',
    name: 'Modifiers',
    category: 'codes',
    description: 'Two-digit codes appended to CPT codes to provide additional information.',
    detail: 'Key modifiers: 25 (significant, separately identifiable E/M), 59 (distinct procedural service — unbundles), 76 (repeat procedure by same physician), 26 (professional component only), TC (technical component only). Wrong modifier = wrong payment or denial.',
  },

  // === Obstacles (archetype encounters in the Waiting Room) ===
  // Prefixed with `obstacle_` so they don't collide with the
  // `category: 'codes'` CARC entries above (which share short names like
  // co_50). Encounters route to these via `codexOnSight` so the right
  // entry unlocks on first sight and another (the CARC code) on defeat.
  obstacle_co_50: {
    id: 'obstacle_co_50',
    name: 'Medical Necessity Wraith',
    category: 'obstacles',
    description: 'A semi-transparent figure of half-finished documentation. CO-50 denials.',
    detail: 'The Wraith uses the investigation mechanic — turn budget instead of HP. You assemble facts from the chart and LCD; weak facts must be Documented to count toward the win threshold. Distractor facts feed it. Real-world parallel: medical necessity denials are won upstream, in CDI, before the claim drops. Appeals work, but the time cost is the real story.',
  },
  obstacle_co_197: {
    id: 'obstacle_co_197',
    name: 'Prior Auth Gatekeeper',
    category: 'obstacles',
    description: 'A bureaucratic gate. CO-197 denials.',
    detail: 'The Gatekeeper runs on the block mechanic — every odd turn the gate is shut and your tool does 0 damage. Filing the 278 (prior_auth_278) opens the gate permanently for the rest of the fight. Real-world parallel: precertification is enforced contractually. Once the gate is closed, every other tool just bounces.',
  },
  obstacle_co_29_reaper: {
    id: 'obstacle_co_29_reaper',
    name: 'Timely Filing Reaper',
    category: 'obstacles',
    description: 'A robed bureaucrat with an hourglass-blade. CO-29 denials.',
    detail: 'The Reaper uses the timed mechanic — HP plus a Days Remaining countdown. Each turn the days tick down and the Reaper\'s damage escalates. Hit zero days and the fight is auto-loss regardless of HP. Real-world parallel: timely filing is contractual; once the deadline passes, no appeal will recover the claim.',
  },
  obstacle_co_18_doppelganger: {
    id: 'obstacle_co_18_doppelganger',
    name: 'Duplicate Claim Doppelgänger',
    category: 'obstacles',
    description: 'A perfect copy of the claim already in the queue. CO-18 denials.',
    detail: 'The Doppelgänger uses the mirror mechanic — the same tool used twice in a row does 0 damage and kicks back. Vary your approach. The canonical fix is submit_837p with frequency code 7 (replacement). Real-world parallel: same submission twice = the same denial twice; never resubmit, replace.',
  },
  obstacle_co_97: {
    id: 'obstacle_co_97',
    name: 'Bundling Beast',
    category: 'obstacles',
    description: 'Two services on the same day fused into one. CO-97 denials.',
    detail: 'The Bundle is a straight HP fight with a teaching emphasis on modifier 25 / 59. CDI Query stamps the +25 modifier onto the E&M line. Real-world parallel: most bundling denials are not really bundled — they\'re a missing modifier that signals significant, separately identifiable service.',
  },
  obstacle_eligibility_fog: {
    id: 'obstacle_eligibility_fog',
    name: 'Eligibility Fog',
    category: 'obstacles',
    description: 'A swirling gray cloud hiding coverage details.',
    detail: 'The Fog uses the blind mechanic — every tool\'s accuracy is reduced by 30 while the fog is up. Running eligibility_270 burns it off permanently. Real-world parallel: 270/271 verification is cheap and prevents most "denials" from ever happening; flying blind is expensive.',
  },
  obstacle_co_16_swarm: {
    id: 'obstacle_co_16_swarm',
    name: 'Documentation Sprite Swarm',
    category: 'obstacles',
    description: 'A leaking chart spawning missing-info gremlins. CO-16 / 277CA rejects.',
    detail: 'The Swarm uses the spawn mechanic — the Source has an HP pool but spawns a sprite every 2 enemy turns (cap 3). claim_scrubber sweeps the active swarm but doesn\'t patch the source; cdi_query patches the chart upstream and stops further spawns. The mechanic is the lesson: fight the rejects all you want, but until you patch the chart, more keep coming.',
  },
  obstacle_boss_audit: {
    id: 'obstacle_boss_audit',
    name: 'The Quarterly Audit',
    category: 'obstacles',
    description: 'Pre-payment review. Every shortcut surfaces.',
    detail: 'The audit mechanic reads your run-long state.resources.auditRisk and inflates the boss\'s starting HP and base damage. Shadow tools (upcode, aggressive_collections) HEAL the boss during the fight — the auditor pulls another receipt. Documentation tools (cdi_query, medical_policy, claim_scrubber) are super-effective. Real-world parallel: pre-payment audits are not random; they\'re triggered by your billing patterns. The shortcut taken six months ago is the audit cost today.',
  },
}

export const CODEX_LIST = Object.values(CODEX_ENTRIES)
