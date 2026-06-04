// IDR Crucible @ L9 — Independent Dispute Resolution Case.
//
// Under the No Surprises Act (45 CFR 149.140 + 149.510), when a
// patient gets emergency care at an in-network facility but is
// treated by an out-of-network clinician, the patient pays only
// in-network cost-sharing. The plan's payment to the OON provider
// is benchmarked to the Qualifying Payment Amount (QPA) — the
// plan's median contracted in-network rate for the same service,
// same specialty, same geographic region, same plan type. If the
// provider thinks the QPA is too low, they have 30 business days
// of "open negotiation" with the plan, and if no agreement is
// reached, they can escalate to Independent Dispute Resolution
// (IDR) — baseball-style arbitration where each side submits a
// FINAL offer and the arbitrator picks ONE. No splitting, no
// averaging, no compromise.
//
// Encounter: Maria Vargas, 47, came to Mercy ED for chest pain.
// Emergency cath (CPT 93458) performed by Dr. Patel from
// CardioCare Group — OON to her BlueCross plan. NSA carve-out
// applies: Maria pays in-network cost-sharing only; provider/plan
// dispute the rate. BlueCross paid CardioCare's QPA ($1,840),
// computed off the wrong specialty+setting bucket (cardiology-
// elective instead of cardiology-emergency-ED), and possibly
// inflated by single-case agreements that should have been
// excluded. Open negotiation lapsed. Player must file the IDR.
//
// Three verbs:
//   - AUDIT: 4 true/false statements on QPA methodology rules
//     (what's IN, what's OUT, disclosure requirements, baseball
//     arbitration mechanic).
//   - REBUCKET: 4 specialty+setting bucket options. Payer used
//     "cardiology, elective" — the right bucket is "cardiology,
//     emergency ED setting." Specialty matters. Setting matters.
//   - OFFER: 5 final-offer dollar amounts. Baseball arbitration
//     means too high → arbitrator picks QPA; too low → leaves
//     money on the table. The defensible market median wins.
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

// ===== Domain types =====

interface AuditStatement {
  id: string
  text: string
  truth: boolean
  reason: string
}

interface BucketOption {
  id: string
  label: string
  detail: string
  qpa: number
  correct: boolean
  feedback: string
}

interface OfferOption {
  id: string
  label: string
  detail: string
  amount: number
  correct: boolean
  feedback: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'audit' | 'rebucket' | 'offer'
}

interface GlossaryEntry { term: string; plain: string }

// ===== Encounter data =====

const PATIENT = 'Maria Vargas'
const PROVIDER = 'CardioCare Group'
const CLINICIAN = 'Dr. Patel (interventional cardiology)'
const FACILITY = 'Mercy ED'
const PAYER = 'BlueCross Commercial PPO'
const SERVICE = 'Emergency cardiac catheterization (CPT 93458)'
const PLACE_OF_SERVICE = 'POS 23 — Emergency Department'

const BILLED_CHARGE = 5200
const QPA_AS_PAID = 1840         // payer used wrong bucket
const QPA_CORRECT_BUCKET = 2800  // emergency-ED bucket would have been
const MARKET_MEDIAN = 2950       // CardioCare's own contracts + Fair Health benchmark

const auditStatements: AuditStatement[] = [
  {
    id: 'a1',
    text: 'The QPA must be calculated as the median of the plan\'s contracted in-network rates for the same service code, same specialty, same geographic region, and same plan type — using only contracts that were actually in effect during the QPA reference year.',
    truth: true,
    reason: 'Right. 45 CFR 149.140(a)(1)–(3) sets the four-axis key (service code + specialty + region + plan type) and requires the contracts to be in effect during the reference year. Stale contracts and contracts that never went live can\'t be in the median. This is the technical foundation of every QPA challenge — if the methodology fails any axis, the QPA is invalid.',
  },
  {
    id: 'a2',
    text: 'Single-case agreements (SCAs) and letters of agreement (LOAs) ARE included in the QPA median because they\'re negotiated rates between the plan and a provider.',
    truth: false,
    reason: 'Wrong — SCAs are explicitly EXCLUDED from the QPA per 45 CFR 149.140(a)(5). Reason: SCAs are typically inflated emergency-fix rates negotiated under duress (the patient is on the table; the plan needs the OON provider; the provider names a price). Including them would skew the median upward and make IDR look unnecessary. Watch for plans that quietly include SCAs to inflate their QPA when convenient — request the methodology disclosure to verify.',
  },
  {
    id: 'a3',
    text: 'Risk-bearing payments — capitation, bonus pool, withhold returns, shared-savings — are excluded from the QPA calculation.',
    truth: true,
    reason: 'Right. 45 CFR 149.140(a)(4) excludes risk-bearing arrangements. Reason: a capitated PMPM payment isn\'t a per-service rate; including it in a per-service median is apples-to-oranges. Plans with heavily-capitated networks would otherwise post artificially low per-service QPAs. The exclusion keeps the median commensurate with the fee-for-service rate the OON provider is being benchmarked against.',
  },
  {
    id: 'a4',
    text: 'IDR is "baseball-style" arbitration — each party submits a FINAL offer, and the arbitrator must pick exactly one. No splitting the difference; no averaging; no compromise number.',
    truth: true,
    reason: 'Right. 45 CFR 149.510 sets the baseball-arbitration mechanic. The arbitrator looks at both final offers, the QPA, and any "additional credible information" (provider complexity, training, market rates, prior negotiations) and picks ONE offer. The mechanic is designed to push both parties toward reasonable numbers — submit something the arbitrator can\'t justify and you lose. Strategic implication: too high → arbitrator picks the QPA; too low → leave money on the table.',
  },
]

const bucketOptions: BucketOption[] = [
  {
    id: 'cardio-elective',
    label: 'Cardiology — elective / outpatient setting',
    detail: 'The bucket BlueCross used. QPA = $1,840.',
    qpa: 1840,
    correct: false,
    feedback: 'This is what BlueCross used and it\'s the wrong bucket. Maria\'s cath was an EMERGENCY procedure performed in the ED (POS 23) on a patient with active chest pain — that\'s a different acuity and setting than a scheduled outpatient cath at a freestanding lab. The QPA must match the actual service\'s specialty + setting. 45 CFR 149.140(a)(3) keys QPA to the service AS PERFORMED, not how the plan would prefer to bucket it.',
  },
  {
    id: 'cardio-emergency',
    label: 'Cardiology — emergency / ED setting',
    detail: 'CPT 93458 + POS 23. QPA = $2,800 in this geographic region.',
    qpa: 2800,
    correct: true,
    feedback: 'Right. Service was an emergency cath performed in the ED. The correct QPA bucket is cardiology-emergency-ED. In this MSA, that QPA is $2,800 — about 52% higher than the cardiology-elective number BlueCross used. This becomes the corrected QPA the arbitrator should consider; combined with the AUDIT findings (SCA contamination + methodology disclosure missing), it materially weakens BlueCross\'s position.',
  },
  {
    id: 'anesthesia-emergency',
    label: 'Anesthesiology — emergency / ED setting',
    detail: 'For emergency ED procedures, use the anesthesia bucket since cardiac caths require anesthesia support.',
    qpa: 3100,
    correct: false,
    feedback: 'Wrong specialty. Dr. Patel is the interventional cardiologist performing the cath, not the anesthesiologist supporting it. The QPA is keyed to the BILLING clinician\'s specialty for the service code billed. Trying to inherit the anesthesia QPA for a cardiology service code looks like gaming the bucket and would be flagged immediately by IDR review.',
  },
  {
    id: 'all-specialty-blend',
    label: 'Blended median across ALL specialties for CPT 93458',
    detail: 'A single market-wide median, no specialty axis. Removes the specialty bucketing question entirely.',
    qpa: 2400,
    correct: false,
    feedback: 'This isn\'t a valid QPA methodology. 45 CFR 149.140(a)(3) requires the median to be keyed to specialty (Taxonomy code) along with service, region, and plan type. A specialty-blind median is what the original 2021 interim final rule tried — Texas Medical Association v HHS struck the QPA-presumption portions of that rule down. Don\'t propose a methodology the regulation explicitly rejects.',
  },
]

const offerOptions: OfferOption[] = [
  {
    id: 'billed',
    label: `Submit ${money(BILLED_CHARGE)} — the full billed charge.`,
    amount: BILLED_CHARGE,
    detail: 'The billed charge on the original CMS-1500. CardioCare\'s sticker price for emergency cath services.',
    correct: false,
    feedback: `Too high. Billed charges aren\'t a credible benchmark for the IDR — they\'re list prices, not what anyone actually pays. The arbitrator weighs each side\'s offer against the QPA + additional credible information; ${money(BILLED_CHARGE)} is so far above defensible market data that the arbitrator picks BlueCross\'s ${money(QPA_AS_PAID)} as the closer-to-reasonable number. Worst-case outcome: IDR confirms the original (wrong-bucket) QPA. AND CardioCare loses the IDR fee.`,
  },
  {
    id: 'split',
    label: `Submit ${money(4200)} — split the difference between billed (${money(BILLED_CHARGE)}) and QPA (${money(QPA_AS_PAID)}).`,
    amount: 4200,
    detail: 'Compromise position. Mid-point between the two extremes.',
    correct: false,
    feedback: `Wrong mental model. IDR is BASEBALL arbitration — there\'s no splitting. The arbitrator picks ONE offer. Submitting a split-the-difference number means submitting a price that isn\'t justified by any specific market data: not the corrected QPA (${money(QPA_CORRECT_BUCKET)}), not the regional market median (${money(MARKET_MEDIAN)}), not your contract data. Unjustified offers lose. The arbitrator picks the side with the more defensible number — and ${money(4200)} is defensible by neither the data nor the methodology.`,
  },
  {
    id: 'market-median',
    label: `Submit ${money(MARKET_MEDIAN)} — CardioCare\'s contract median + Fair Health regional benchmark.`,
    amount: MARKET_MEDIAN,
    detail: `Defensible market median. CardioCare\'s own in-network contracts in this region average ${money(2880)}; Fair Health\'s 80th percentile for CPT 93458 in this MSA is ${money(3100)}. Median lands at ${money(MARKET_MEDIAN)}.`,
    correct: true,
    feedback: `Right. Combined with the AUDIT findings (SCA contamination + methodology disclosure gap) and the REBUCKET correction (cardiology-emergency-ED, QPA = ${money(QPA_CORRECT_BUCKET)}), ${money(MARKET_MEDIAN)} is the defensible market median: above the corrected QPA but supportable by external benchmarks and CardioCare\'s own contract data. The arbitrator picks this over BlueCross\'s wrong-bucket ${money(QPA_AS_PAID)} or any "fixed" QPA they might submit. Net gain to CardioCare: ${money(MARKET_MEDIAN - QPA_AS_PAID)} per case + the IDR fee back.`,
  },
  {
    id: 'just-above-qpa',
    label: `Submit ${money(1900)} — just above BlueCross\'s QPA.`,
    amount: 1900,
    detail: 'Conservative. Show willingness to accept close to the QPA. Reduce IDR risk.',
    correct: false,
    feedback: `Leaves money on the table. Even if the arbitrator picks ${money(1900)} (which they would — it\'s closer to the QPA than the billed charge), CardioCare gives up ${money(MARKET_MEDIAN - 1900)} per case for no good reason. The market data and the corrected QPA both support a higher number. IDR isn\'t a "show good faith" exercise; it\'s a one-shot final-offer pick. Submit your defensible best number, not your discount-from-best number.`,
  },
  {
    id: 'accept-qpa',
    label: `Withdraw — accept the ${money(QPA_AS_PAID)} QPA. Don\'t submit an IDR offer.`,
    amount: QPA_AS_PAID,
    detail: 'No IDR. Accept the original payment as final.',
    correct: false,
    feedback: `Capitulation. The QPA was computed off the wrong specialty+setting bucket; AUDIT also surfaced potential SCA contamination. CardioCare has affirmative grounds to challenge — letting them stand sets a worst-case precedent for the next 50 emergency caths this quarter. The provider community is in IDR cases like this BECAUSE accepting wrong-bucket QPAs is how plans normalize them.`,
  },
]

const issues: Issue[] = [
  {
    id: 'audit',
    label: 'Audit: walk QPA methodology rules. 4 statements true/false.',
    recap: 'Walked the rules. QPA must be keyed by service+specialty+region+plan-type using contracts in effect during the reference year. SCAs and risk-bearing payments are EXCLUDED. Plan must disclose methodology on request within 30 days. IDR is baseball arbitration — one offer wins, no splitting.',
    verb: 'audit',
  },
  {
    id: 'rebucket',
    label: 'Rebucket: pick the right specialty+setting bucket for QPA.',
    recap: `Cardiology — emergency / ED setting (POS 23). The correct QPA in this region is ${money(QPA_CORRECT_BUCKET)} — about 52% higher than the cardiology-elective number BlueCross used. The mismatch is grounds for the IDR challenge.`,
    verb: 'rebucket',
  },
  {
    id: 'offer',
    label: 'Offer: pick the IDR final offer. Baseball-style.',
    recap: `${money(MARKET_MEDIAN)} — defensible market median backed by CardioCare\'s in-network contracts + Fair Health regional benchmark. Above the corrected QPA (${money(QPA_CORRECT_BUCKET)}), supportable by data, well below the unrealistic billed charge.`,
    verb: 'offer',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'NSA': {
    term: 'No Surprises Act (NSA)',
    plain: 'Federal law (effective Jan 2022) that protects patients from balance billing in three scenarios: emergency care at any facility, non-emergency care at an in-network facility delivered by an OON clinician, and air ambulance services. The patient pays only in-network cost-sharing; the dispute over the actual rate is between the OON provider and the plan, mediated by the QPA + IDR mechanism. Codified at 42 USC §300gg-111 et seq. and implemented through 45 CFR 149.110–149.520.',
  },
  'QPA': {
    term: 'Qualifying Payment Amount (QPA)',
    plain: 'The plan\'s median in-network contracted rate for the same service, same specialty, same geographic region, same plan type. Defined at 45 CFR 149.140. It\'s the plan\'s reference price under the NSA — what they pay the OON provider in the absence of a negotiated rate. Methodology rules: must use contracts in effect during the reference year; excludes single-case agreements; excludes risk-bearing payments (capitation, bonus pool, etc.); must be keyed to all four axes. Plans must disclose the methodology to providers on request within 30 days. The QPA is the input to IDR — it\'s NOT presumptively the right rate (that part of the rule was struck down in Texas Medical Association v HHS).',
  },
  'IDR': {
    term: 'Independent Dispute Resolution (IDR)',
    plain: 'Baseball-style arbitration mechanism for resolving payment disputes between OON providers and plans under the NSA. Defined at 45 CFR 149.510. Process: 30 business days of "open negotiation" first; if no agreement, either party can initiate IDR within 4 business days of negotiation expiration. Each side submits a FINAL offer + supporting documentation; the IDR entity (a certified arbitrator) reviews the offers, the QPA, and "additional credible information" (provider training/experience, complexity of patient/service, prior contracted rates, market data); picks ONE offer. Winner takes their offer; loser pays the IDR administrative fee. The mechanic incentivizes both sides to submit reasonable numbers — extreme offers lose.',
  },
  'open negotiation': {
    term: 'Open negotiation period (NSA)',
    plain: '30 business-day window between the OON provider receiving the initial payment and the deadline to file IDR. Either party can initiate; both parties must engage in good faith. If agreement is reached, no IDR. If 30 days pass with no agreement, either party can file IDR within 4 business days of expiration. Many disputes resolve here — payers prefer to negotiate up rather than risk losing IDR + paying the IDR fee. CardioCare\'s open negotiation lapsed without movement from BlueCross; IDR is the next step.',
  },
  'baseball arbitration': {
    term: 'Baseball arbitration',
    plain: 'Final-offer arbitration. Each party submits one number; the arbitrator picks one — no splitting, no averaging. Originally designed for MLB salary disputes (each side files; arbitrator picks one); adopted by NSA IDR because it forces both sides to submit reasonable offers. Submit too high → arbitrator picks the other side\'s lower number; submit too low → leave money on the table. The defensible-best-number wins.',
  },
  'methodology disclosure': {
    term: 'QPA methodology disclosure',
    plain: 'Required by 45 CFR 149.140(d). On the provider\'s request, the plan must disclose, within 30 days: (a) the QPA itself; (b) whether the QPA is based on the plan\'s own contracts or a third-party database (used only when the plan has insufficient contracts); (c) the # of contracts included in the median; (d) the geographic region used; (e) confirmation that risk-bearing payments and SCAs were excluded; (f) the methodology for adjusting prior-year contracts to the current year. Failure to disclose is itself an IDR defense — providers can challenge a QPA whose derivation is opaque.',
  },
  'specialty bucket': {
    term: 'Specialty + setting bucket (QPA)',
    plain: 'The QPA is keyed to the service code AND the billing clinician\'s specialty (NUCC taxonomy) AND the place-of-service code AND the plan type. Same CPT code can have different QPAs depending on who\'s billing (cardiologist vs internist) and where (ED vs outpatient lab vs inpatient). 45 CFR 149.140(a)(3). Plans sometimes use a less-specific bucket to lower the QPA — a frequent IDR challenge ground. Always verify the bucket matches the actual service rendered.',
  },
  'SCA': {
    term: 'Single-case agreement (SCA)',
    plain: 'A one-off rate negotiated between a plan and an OON provider for a specific patient or admission, typically under emergency or specialty-shortage conditions. SCAs are usually inflated relative to network contracts because they\'re negotiated under time pressure. 45 CFR 149.140(a)(5) explicitly EXCLUDES SCAs from the QPA calculation. Plans that quietly include SCAs in their QPA medians inflate the QPA — making the IDR look unnecessary — but providers can challenge this through methodology disclosure (149.140(d)).',
  },
  'TMA v HHS': {
    term: 'Texas Medical Association v HHS (2022–2023)',
    plain: 'Three lawsuits brought by TMA against HHS challenging the original NSA IDR regulations. The 2021 Interim Final Rule had created a "QPA presumption" — arbitrators were required to give the QPA presumptive weight unless other factors clearly outweighed it. TMA argued this exceeded statutory authority; the statute (42 USC §300gg-111(c)(5)(C)) lists multiple factors the arbitrator must consider WITHOUT giving QPA primacy. TMA won three rounds (TMA I, II, III) in the E.D. Tex.; HHS rewrote the rules to remove the QPA presumption. Current rule: arbitrator weighs QPA + additional credible info equally; can pick the offer farther from QPA if the additional info supports it.',
  },
  'additional credible information': {
    term: 'Additional credible information (ACI)',
    plain: '45 CFR 149.510(c)(4)(iii) — factors the IDR arbitrator considers alongside the QPA: (a) provider\'s level of training, experience, quality, and outcomes; (b) market share of provider and plan; (c) acuity of the patient/service complexity; (d) teaching status, case mix, scope of services of facility (if applicable); (e) prior contracted rate history between the parties (last 4 years); (f) good-faith effort of either party to negotiate. Strong ACI can pull the arbitrator toward the provider\'s offer even when QPA is closer to the plan\'s offer.',
  },
}

// ===== Runtime state =====

interface StmtState { pick: boolean | null }

const state = {
  briefingDone: false,
  briefingOpen: false,
  stmtStates: auditStatements.reduce((m, s) => { m[s.id] = { pick: null }; return m }, {} as Record<string, StmtState>),
  appliedBucketId: null as string | null,
  appliedOfferId: null as string | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isAuditDone(): boolean {
  return auditStatements.every(s => state.stmtStates[s.id].pick === s.truth)
}

function term(termId: string, displayText?: string): string {
  const entry = glossary[termId]
  const text = displayText ?? termId
  if (!entry) return escape(text)
  return `<span class="term" data-action="open-term" data-term="${termId}" title="${escape(entry.plain)}">${escape(text)}<span class="term-icon">?</span></span>`
}
function money(n: number): string { return '$' + Math.round(n).toLocaleString() }

function render(): string {
  if (state.packetSubmitted) {
    return renderHeader() + renderVictory() + renderTermPopover() + renderBriefingPopover()
  }
  return `
    ${renderHeader()}
    ${renderHospitalIntro()}
    ${!state.briefingDone ? renderBriefingInline() : `
      ${renderClaimSummary()}
      ${renderAuditPanel()}
      ${renderRebucketPanel()}
      ${renderOfferPanel()}
      ${renderChecklist()}
    `}
    ${state.briefingDone ? '' : renderDesignNotes()}
    ${renderTermPopover()}
    ${renderBriefingPopover()}
  `
}

function renderHeader(): string {
  const recallBtn = state.briefingDone ? `<button class="recall-btn" data-action="show-briefing">📜 Dana's note</button>` : ''
  return `
    <header class="page-h">
      <div class="title-row">
        <h1>IDR Crucible <span class="muted">@ L9 — Independent Dispute Resolution Case</span></h1>
        <div class="header-actions">${recallBtn}<a class="back-link" href="./prototypes.html">← back to catalog</a></div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          ${escape(PATIENT)}'s emergency cath at ${escape(FACILITY)}. Treated
          by ${term('NSA', 'OON')} clinician ${escape(CLINICIAN)} from
          ${escape(PROVIDER)}. ${escape(PAYER)} paid CardioCare\'s
          ${term('QPA')} (${money(QPA_AS_PAID)}) — but the bucket was
          wrong. ${term('open negotiation')} lapsed. Time to file
          ${term('IDR')}. ${term('baseball arbitration')} mechanic:
          one offer wins. Audit the QPA methodology; rebucket to
          the right specialty + setting; submit the defensible market
          median. New verbs: AUDIT, REBUCKET, OFFER. See the
          <a href="#design-notes">design notes</a>.
        </p>
      `}
    </header>
  `
}

function renderHospitalIntro(): string {
  return `
    <section class="hospital-intro">
      <div class="register hospital">HOSPITAL · this morning</div>
      <p>
        Dana drops a payment-correspondence packet on Chloe\'s desk.
        ${escape(PATIENT)} — emergency cath three weeks back at the
        Mercy ED. ${escape(CLINICIAN)} performed it; he\'s in
        CardioCare Group, OON to BlueCross PPO. Maria pays in-network
        cost-sharing under ${term('NSA')} carve-out. CardioCare billed
        ${money(BILLED_CHARGE)}; BlueCross paid ${money(QPA_AS_PAID)}
        as the ${term('QPA')}.
      </p>
      <p>
        "Open negotiation lapsed Friday. They never moved off the
        QPA. The bucket they used is cardiology-elective — for an
        emergency cath in the ED. Wrong specialty+setting. We file
        ${term('IDR')} this week. Final-offer baseball arbitration —
        one number wins, no compromise. Audit the QPA, rebucket the
        specialty, pick the offer."
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The payment EOB
        lengthens; the QPA methodology disclosure CardioCare
        requested two weeks ago, still unanswered, drifts in beside
        it.</em>
      </div>
      <div class="register waiting-room">WAITING ROOM · now</div>
    </section>
  `
}

function renderBriefingInline(): string {
  return `
    <section class="briefing">
      ${briefingContent()}
      <button class="btn primary" data-action="dismiss-briefing">Got it — start the encounter</button>
    </section>
  `
}

function briefingContent(): string {
  return `
    <div class="briefing-h">
      <span class="briefing-tag">DANA, IN YOUR EAR</span>
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'Baseball arbitration. One number wins. Make it the right one.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "${term('IDR')} is the No Surprises Act\'s endgame. When
        open negotiation fails, both sides submit a FINAL offer and
        an arbitrator picks one — ${term('baseball arbitration')}.
        No splitting. No averaging. No compromise number. The
        arbitrator weighs each side\'s offer against the
        ${term('QPA')} plus
        ${term('additional credible information')} — provider
        training, complexity, market data, prior negotiations — and
        picks the more defensible offer."
      </p>
      <p>"Three issues:"</p>
      <ul>
        <li><strong>Audit.</strong> Four statements about QPA
        methodology rules. Watch the
        ${term('SCA')} contamination trap, the risk-bearing exclusion,
        and the ${term('methodology disclosure', 'methodology-disclosure')}
        deadline. <em>New verb: AUDIT.</em></li>
        <li><strong>Rebucket.</strong> Four
        ${term('specialty bucket', 'specialty+setting bucket')} options.
        BlueCross used cardiology-elective; the right bucket is
        cardiology-emergency-ED (POS 23). Mismatch = QPA challenge.
        <em>New verb: REBUCKET.</em></li>
        <li><strong>Offer.</strong> Five final-offer dollar amounts.
        Too high → arbitrator picks the QPA. Too low → leave money
        on the table. The ${money(MARKET_MEDIAN)} market median —
        backed by CardioCare\'s contracts + Fair Health — is the
        defensible number. <em>New verb: OFFER.</em></li>
      </ul>
      <p>
        "${term('TMA v HHS')} killed the QPA-presumption in 2022.
        The arbitrator no longer treats the QPA as automatically
        right; it\'s one input among several. Provider-friendly
        regulatory environment — but only if you submit a credible
        offer. Submit the billed charge and you lose."
      </p>
      <p class="briefing-sign">"Defensible best number. — D."</p>
    </div>
  `
}

function renderBriefingPopover(): string {
  if (!state.briefingOpen) return ''
  return `
    <div class="briefing-popover-backdrop">
      <div class="briefing-popover">
        <button class="briefing-popover-close" data-action="close-briefing">×</button>
        ${briefingContent()}
        <button class="btn ghost" data-action="close-briefing">Back to the encounter</button>
      </div>
    </div>
  `
}

function renderClaimSummary(): string {
  return `
    <section class="claim-summary">
      <div class="cs-h">
        <span class="cs-tag">DISPUTE · ${escape(PAYER)} · ICN 2026-04-30-077</span>
        <span class="cs-sub">${escape(SERVICE)} · ${escape(PLACE_OF_SERVICE)} · ${escape(PROVIDER)}.</span>
      </div>
      <table class="cs-table">
        <tr><th>Patient</th><td>${escape(PATIENT)} (BlueCross PPO, in-network for facility, OON for clinician)</td></tr>
        <tr><th>Service</th><td>${escape(SERVICE)}</td></tr>
        <tr><th>Place of service</th><td>${escape(PLACE_OF_SERVICE)}</td></tr>
        <tr><th>NSA carve-out</th><td>Patient pays in-network cost-sharing; rate dispute is provider ↔ plan</td></tr>
        <tr><th>CardioCare billed</th><td>${money(BILLED_CHARGE)}</td></tr>
        <tr><th>BlueCross paid (QPA)</th><td>${money(QPA_AS_PAID)} <strong class="bad-text">← cardiology-elective bucket (wrong)</strong></td></tr>
        <tr><th>QPA methodology disclosure</th><td><strong class="bad-text">requested 14 days ago, still unanswered</strong></td></tr>
        <tr><th>Open negotiation</th><td><strong class="bad-text">lapsed Friday — no agreement</strong></td></tr>
        <tr><th>IDR deadline</th><td>4 business days from open-negotiation expiration</td></tr>
      </table>
    </section>
  `
}

function renderAuditPanel(): string {
  const done = state.resolvedIssues.has('audit')
  return `
    <section class="audit-panel ${done ? 'done' : ''}">
      <div class="ap-h">
        <span class="ap-tag">QPA METHODOLOGY · 4 statements</span>
        <span class="ap-sub">${done
          ? 'Walked the rules. SCAs and risk-bearing payments are excluded; methodology disclosure required; baseball arbitration mechanic.'
          : 'Mark each true/false. Watch the SCA inclusion trap and the disclosure deadline.'}</span>
      </div>
      <ul class="stmt-list">
        ${auditStatements.map(s => renderStmt(s)).join('')}
      </ul>
      ${state.transientFeedback && auditStatements.some(s => s.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('audit') : ''}
    </section>
  `
}

function renderStmt(s: AuditStatement): string {
  const ss = state.stmtStates[s.id]
  const decided = ss.pick !== null
  const correct = decided && ss.pick === s.truth
  return `
    <li class="stmt ${decided && correct ? 'correct' : ''}">
      <div class="stmt-text">${escape(s.text)}</div>
      <div class="stmt-actions">
        ${decided && correct ? `
          <span class="stmt-badge ${ss.pick ? 'true' : 'false'}">${ss.pick ? 'TRUE' : 'FALSE'}</span>
          <button class="btn small ghost" data-action="reset-stmt" data-id="${s.id}">↺ undo</button>
        ` : `
          <button class="btn small ghost" data-action="pick-stmt" data-id="${s.id}" data-pick="true">True</button>
          <button class="btn small ghost" data-action="pick-stmt" data-id="${s.id}" data-pick="false">False</button>
        `}
      </div>
    </li>
  `
}

function renderRebucketPanel(): string {
  const unlocked = state.resolvedIssues.has('audit')
  const done = state.resolvedIssues.has('rebucket')
  if (!unlocked) {
    return `<section class="rebucket-panel locked"><div class="rp-h"><span class="rp-tag idle">REBUCKET</span><span class="rp-sub">Locked.</span></div></section>`
  }
  return `
    <section class="rebucket-panel ${done ? 'done' : 'active'}">
      <div class="rp-h">
        <span class="rp-tag ${done ? 'done' : 'active'}">REBUCKET · pick the right specialty+setting · 4 options</span>
        <span class="rp-sub">${done
          ? `Cardiology — emergency / ED setting. Corrected QPA: ${money(QPA_CORRECT_BUCKET)}.`
          : 'Service was an emergency cath in the ED (POS 23). Match the QPA bucket to the service AS PERFORMED.'}</span>
      </div>
      <ul class="opt-list">
        ${bucketOptions.map(b => renderBucket(b)).join('')}
      </ul>
      ${state.transientFeedback && bucketOptions.some(b => b.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('rebucket') : ''}
    </section>
  `
}

function renderBucket(b: BucketOption): string {
  const applied = state.appliedBucketId === b.id
  const locked = state.appliedBucketId !== null && !applied
  return `
    <li class="opt ${applied ? 'applied' : ''}">
      <button class="opt-btn" data-action="apply-bucket" data-id="${b.id}" ${locked ? 'disabled' : ''}>
        <span class="opt-label">${escape(b.label)}</span>
        <span class="opt-detail">${escape(b.detail)}</span>
        ${applied ? '<span class="opt-badge">APPLIED</span>' : ''}
      </button>
    </li>
  `
}

function renderOfferPanel(): string {
  const unlocked = state.resolvedIssues.has('audit') && state.resolvedIssues.has('rebucket')
  const done = state.resolvedIssues.has('offer')
  if (!unlocked) {
    return `<section class="offer-panel locked"><div class="op-h"><span class="op-tag idle">OFFER</span><span class="op-sub">Locked.</span></div></section>`
  }
  return `
    <section class="offer-panel ${done ? 'done' : 'active'}">
      <div class="op-h">
        <span class="op-tag ${done ? 'done' : 'active'}">OFFER · pick the IDR final offer · 5 options</span>
        <span class="op-sub">${done
          ? `${money(MARKET_MEDIAN)} — defensible market median, backed by CardioCare contracts + Fair Health.`
          : 'Baseball arbitration: arbitrator picks one. Too high → loses to QPA. Too low → leaves money on table.'}</span>
      </div>
      <ul class="opt-list">
        ${offerOptions.map(o => renderOffer(o)).join('')}
      </ul>
      ${state.transientFeedback && offerOptions.some(o => o.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('offer') : ''}
    </section>
  `
}

function renderOffer(o: OfferOption): string {
  const applied = state.appliedOfferId === o.id
  return `
    <li class="opt ${applied ? 'applied' : ''}">
      <button class="opt-btn" data-action="apply-offer" data-id="${o.id}" ${state.appliedOfferId !== null && !applied ? 'disabled' : ''}>
        <span class="opt-label">${escape(o.label)}</span>
        <span class="opt-detail">${escape(o.detail)}</span>
        ${applied ? '<span class="opt-badge">APPLIED</span>' : ''}
      </button>
    </li>
  `
}

function renderRecap(issueId: string): string {
  const issue = issues.find(i => i.id === issueId)
  if (!issue) return ''
  return `<div class="recap"><div class="recap-h">RECAP · ${issue.verb.toUpperCase()}</div><p>${escape(issue.recap)}</p></div>`
}

function renderChecklist(): string {
  const allDone = issues.every(i => state.resolvedIssues.has(i.id))
  return `
    <section class="checklist">
      <div class="checklist-h">IDR SUBMISSION · 3 issues to resolve</div>
      <ul>${issues.map(i => `<li class="${state.resolvedIssues.has(i.id) ? 'done' : ''}"><span class="check">${state.resolvedIssues.has(i.id) ? '✓' : '○'}</span><div class="issue-body"><div class="issue-label">${escape(i.label)}</div></div></li>`).join('')}</ul>
      ${state.failedAttempts > 0 ? `<p class="fail-counter">Wrong picks so far: ${state.failedAttempts}.</p>` : ''}
      <button class="btn submit ${allDone ? '' : 'disabled'}" data-action="submit" ${allDone ? '' : 'disabled'}>File the IDR submission</button>
    </section>
  `
}

function renderTermPopover(): string {
  if (!state.openTermId) return ''
  const entry = glossary[state.openTermId]
  if (!entry) return ''
  return `
    <div class="term-popover-backdrop" data-action="close-term">
      <div class="term-popover">
        <div class="term-popover-h"><span class="term-popover-name">${escape(entry.term)}</span><button class="term-popover-close" data-action="close-term">×</button></div>
        <p>${escape(entry.plain)}</p>
      </div>
    </div>
  `
}

const RECAP: CaseRecap = CASE_RECAPS['idr-crucible']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">IDR FILED · CARDIOCARE PREVAILS</div>
      <h2>${money(MARKET_MEDIAN)} final offer accepted by the arbitrator.</h2>
      <p>
        Submission packet to the certified IDR entity included: the
        AUDIT findings (SCA contamination + missing methodology
        disclosure), the corrected QPA bucket
        (cardiology-emergency-ED, ${money(QPA_CORRECT_BUCKET)}), and
        the ${money(MARKET_MEDIAN)} final offer backed by CardioCare\'s
        in-network contracts + Fair Health regional benchmark. The
        arbitrator picked CardioCare\'s offer over BlueCross\'s
        ${money(QPA_AS_PAID)} wrong-bucket QPA. Net gain to
        CardioCare: ${money(MARKET_MEDIAN - QPA_AS_PAID)} on this
        case + the ${money(115)} IDR administrative fee back. Plan
        will likely move on the next 50 emergency caths this quarter
        without going to IDR.
      </p>
      <p class="muted">
        ${term('IDR')} only works because both sides face real
        pressure: providers risk losing the IDR fee if they submit
        an unrealistic number; plans risk losing if their QPA was
        derived sloppily. The right play is the defensible best
        number — supported by the ${term('QPA')} methodology rules,
        the ${term('specialty bucket')} corrections, and the
        ${term('additional credible information')} the regulation
        explicitly invites.
      </p>
      <button class="btn primary" data-action="reset">Run it again</button>
      <a class="back-link inline" href="./prototypes.html">← back to catalog</a>
    </section>
    ${renderCaseRecap(RECAP)}
  `
}

function renderDesignNotes(): string {
  return `
    <section class="design-notes" id="design-notes">
      <h2>Design notes</h2>
      <div class="notes-grid">
        <div>
          <h3>What this Case tests</h3>
          <ul>
            <li><strong>Three new verbs:</strong> AUDIT (QPA methodology rules — what\'s in the median, what\'s excluded, disclosure obligations), REBUCKET (specialty + setting axes, the most-litigated QPA challenge ground), OFFER (baseball-arbitration strategy: defensible best number wins).</li>
            <li><strong>Baseball arbitration is the central mechanic.</strong> Other Cases let you split the difference, escalate, or compromise. IDR doesn\'t — the arbitrator picks one offer. The Case forces the player to commit to a number they can defend with data.</li>
            <li><strong>Methodology disclosure is leverage.</strong> 45 CFR 149.140(d) gives providers a 30-day right to demand the QPA derivation. Plans that don\'t respond within 30 days hand the provider an affirmative IDR defense. The Case includes the unanswered disclosure as a key piece of leverage.</li>
            <li><strong>TMA v HHS context matters.</strong> The 2022 Texas Medical Association lawsuits killed the original "QPA presumption" — arbitrators no longer give the QPA automatic primacy. Provider-friendly regulatory environment, but only if you submit a credible offer. The Case bottles that — submit billed charges and you still lose.</li>
          </ul>
        </div>
        <div>
          <h3>Sibling shape</h3>
          <ul>
            <li>Cousin to <a href="./surprise-bill-prototype.html">Surprise Bill Specter</a> — same NSA-dispute family, but PATIENT-side (defending against the OON balance bill). IDR Crucible is PROVIDER-side (CardioCare disputing the QPA payment). Both lean on the NSA carve-out + QPA framework but the verbs and stakes flip.</li>
            <li>Cousin to <a href="./carveout-phantom-prototype.html">Carve-out Phantom</a> — same NSA universe; that one ROUTES the dispute (figures out who pays whom and through what channel), this one IS the dispute (final-offer arbitration after open negotiation fails).</li>
            <li>Cousin to <a href="./case-rate-specter-prototype.html">Case Rate Specter</a> in the contract-data shape — both require the player to assemble defensible market data; that one applies it to a contract-vs-fee-table mismatch, this one applies it to a baseball-arbitration final offer.</li>
            <li>District: appeals (purple). The dispute IS the encounter — arbitration mechanics, evidence weighting, strategic offer-setting. Levels 9 because the IDR sophistication assumes the player has already learned QPA / OON / NSA basics from earlier Cases (Surprise Bill, Carve-out Phantom).</li>
          </ul>
        </div>
      </div>
      <p class="notes-cta">See the <a href="./prototypes.html">Case Prototypes catalog</a>.</p>
    </section>
  `
}

function dismissBriefing() { state.briefingDone = true; state.briefingOpen = false }
function showBriefing() { state.briefingOpen = true }
function closeBriefing() { state.briefingOpen = false }
function openTerm(termId: string) { state.openTermId = termId }
function closeTerm() { state.openTermId = null }

function pickStmt(id: string, pick: boolean) {
  const s = auditStatements.find(x => x.id === id); if (!s) return
  state.transientFeedback = null
  if (s.truth === pick) {
    state.stmtStates[id].pick = pick
    state.transientFeedback = { id, message: s.reason, kind: 'good' }
    if (isAuditDone()) state.resolvedIssues.add('audit')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: s.reason, kind: 'bad' }
  }
}

function resetStmt(id: string) {
  state.stmtStates[id].pick = null
  state.resolvedIssues.delete('audit'); state.resolvedIssues.delete('rebucket'); state.resolvedIssues.delete('offer')
  state.transientFeedback = null
}

function applyBucket(id: string) {
  const b = bucketOptions.find(x => x.id === id); if (!b) return
  state.transientFeedback = null
  if (b.correct) {
    state.appliedBucketId = id
    state.resolvedIssues.add('rebucket')
    state.transientFeedback = { id, message: b.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: b.feedback, kind: 'bad' }
  }
}

function applyOffer(id: string) {
  const o = offerOptions.find(x => x.id === id); if (!o) return
  state.transientFeedback = null
  if (o.correct) {
    state.appliedOfferId = id
    state.resolvedIssues.add('offer')
    state.transientFeedback = { id, message: o.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: o.feedback, kind: 'bad' }
  }
}

function attemptSubmit() {
  if (issues.every(i => state.resolvedIssues.has(i.id))) {
    state.packetSubmitted = true
    notifyParentVictory('idr-crucible')
  }
}

function reset() {
  state.briefingDone = false; state.briefingOpen = false
  for (const id in state.stmtStates) state.stmtStates[id] = { pick: null }
  state.appliedBucketId = null; state.appliedOfferId = null
  state.transientFeedback = null
  state.resolvedIssues = new Set(); state.failedAttempts = 0
  state.packetSubmitted = false; state.openTermId = null
}

function handleClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.classList.contains('briefing-popover-backdrop')) { closeBriefing(); rerender(); return }
  if (target.classList.contains('term-popover-backdrop')) { closeTerm(); rerender(); return }
  const el = target.closest('[data-action]') as HTMLElement | null
  if (!el) return
  switch (el.dataset.action) {
    case 'pick-stmt': if (el.dataset.id && el.dataset.pick) pickStmt(el.dataset.id, el.dataset.pick === 'true'); break
    case 'reset-stmt': if (el.dataset.id) resetStmt(el.dataset.id); break
    case 'apply-bucket': if (el.dataset.id) applyBucket(el.dataset.id); break
    case 'apply-offer': if (el.dataset.id) applyOffer(el.dataset.id); break
    case 'submit': attemptSubmit(); break
    case 'reset': reset(); break
    case 'dismiss-briefing': dismissBriefing(); break
    case 'show-briefing': showBriefing(); break
    case 'close-briefing': closeBriefing(); break
    case 'open-term': if (el.dataset.term) openTerm(el.dataset.term); break
    case 'close-term': closeTerm(); break
    default: return
  }
  rerender()
}

const css = districtVars('appeals') + BASE_CSS + `
  .claim-summary { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .cs-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .cs-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .cs-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .cs-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .cs-table th, .cs-table td { text-align: left; padding: 6px 10px; border-bottom: 1px dashed #232a36; vertical-align: top; }
  .cs-table th { font-size: 11px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; width: 240px; }
  .bad-text { color: var(--bad); }

  .audit-panel, .rebucket-panel, .offer-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .audit-panel.done, .rebucket-panel.done, .offer-panel.done { border-left-color: var(--good); }
  .rebucket-panel.locked, .offer-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .ap-h, .rp-h, .op-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .ap-tag, .rp-tag, .op-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .rp-tag.idle, .op-tag.idle { color: var(--ink-dim); }
  .ap-tag.done, .rp-tag.done, .op-tag.done { color: var(--good); }
  .ap-sub, .rp-sub, .op-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .stmt-list, .opt-list { list-style: none; padding-left: 0; margin: 0; }
  .stmt { display: flex; align-items: center; gap: 16px; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 6px; border-left: 3px solid transparent; }
  .stmt.correct { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .stmt-text { flex: 1; font-size: 13px; line-height: 1.5; }
  .stmt-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .stmt-badge { font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 3px; }
  .stmt-badge.true  { background: rgba(126, 226, 193, 0.15); color: var(--good); border: 1px solid #2c5547; }
  .stmt-badge.false { background: rgba(239, 91, 123, 0.10); color: var(--bad); border: 1px solid #4a2a32; }
  .btn.small { padding: 4px 10px; font-size: 11.5px; }

  .opt { margin-bottom: 6px; }
  .opt-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 12px 14px; text-align: left; font: inherit; transition: all 0.15s; position: relative; display: flex; flex-direction: column; gap: 6px; }
  .opt-btn:hover:not(:disabled) { background: #232b3a; border-color: var(--accent); }
  .opt-btn:disabled { opacity: 0.45; cursor: default; }
  .opt.applied .opt-btn { border-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); opacity: 1; }
  .opt-label { font-size: 13px; font-weight: 600; padding-right: 80px; }
  .opt-detail { font-size: 12px; color: var(--ink-dim); line-height: 1.55; }
  .opt-badge { position: absolute; top: 10px; right: 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; font-weight: 700; }

  .recap { background: rgba(126, 226, 193, 0.06); border-color: #2c5547; }
  .recap-h { color: var(--good); }
`

function rerender() { const root = document.getElementById('prototype-root'); if (root) root.innerHTML = render() }
function mount() {
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style); rerender()
  document.body.addEventListener('click', handleClick)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      let changed = false
      if (state.openTermId) { closeTerm(); changed = true }
      if (state.briefingOpen) { closeBriefing(); changed = true }
      if (changed) rerender()
    }
  })
}
mount()
