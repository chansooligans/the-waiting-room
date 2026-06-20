// Chemo Bundle Specter @ L23 — UnitedHealthcare chemo bundling Case.
//
// First Case where the bug isn't on the claim — it's upstream in
// the chargemaster. Hard-coding (CDM auto-mapping of charges to
// CPT/HCPCS codes) is correct in the abstract, but the Cancer
// Center's chargemaster doesn't know that under UHC's contract
// section 8.3(c), CPT 96413 + Revenue Code 0335 triggers a chemo
// case rate that *includes* the chemotherapy drug (J-codes).
//
// So the chargemaster drops the J-codes as separate billable lines,
// UHC denies them CO-234 (bundled into primary procedure), and the
// AR analyst's first instinct is to appeal. That instinct is wrong.
// The contract is right; the chargemaster is the bug.
//
// Actions:
//   - READ-CLAUSE: walk 4 contract sections; mark which governs.
//   - EXAMINE-CDM: 4 charge entries; identify the misconfigured
//     hard-coding that drops drug J-codes independently.
//   - HARD-CODE: 5 resolution paths; fix is upstream, not a claim
//     appeal.
//
// Demonstrates: hard-coding is invisible right up until it isn't.
// Most RCM bugs that get blamed on the payer live in the
// chargemaster's mapping table.
//
// Reference: hard-coding (RCM context) — chargemaster auto-assigns
// CPT/HCPCS based on charge entry; soft-coding = HIM coder reviews
// chart and assigns codes manually after encounter. mdclarity
// glossary covers the broader software-engineering definition;
// here we mean the RCM-domain version.
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

// ===== Domain types =====

interface ContractClause {
  id: string
  section: string
  label: string
  text: string
  governs: boolean
  feedbackApplies: string
  feedbackRejects: string
}

interface CdmEntry {
  id: string
  /** CDM charge code as it appears in the chargemaster. */
  chargeCode: string
  /** Plain-English description of the charge. */
  description: string
  /** What CPT/HCPCS the chargemaster auto-assigns when this charge fires. */
  hardCodedTo: string
  /** Revenue code attached. */
  revCode: string
  /** Gross charge. */
  amount: number
  /** True iff this entry is correctly hard-coded for the case-rate contract. */
  correct: boolean
  /** Why this entry is right or wrong. */
  reason: string
}

interface Resolution {
  id: string
  label: string
  correct: boolean
  feedback: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'read' | 'examine' | 'hardcode'
}

interface GlossaryEntry {
  term: string
  plain: string
}

// ===== Encounter data =====

const PATIENT = 'Sarah Khan'
const PAYER = 'UnitedHealthcare PPO'
const FACILITY = 'Mercy Cancer Center'
const DOS = '2026-04-18'
const ADMIN_CPT = '96413'
const ADMIN_DESCRIPTOR = 'Chemotherapy administration, IV infusion, up to 1 hour'
const ADD_HOUR_CPT = '96415'
const REV_CODE = '0335'
const CASE_RATE = 4_200
const J9267_BILLED = 2_800 // paclitaxel
const J9045_BILLED = 1_650 // carboplatin

const clauses: ContractClause[] = [
  {
    id: 'case-rate',
    section: 'Section 8.3(c) — Chemotherapy Case Rate',
    label: 'Chemo case rate (96413 + Rev 0335) bundles infused drugs',
    text: `When CPT ${ADMIN_CPT} is billed under revenue code ${REV_CODE} for outpatient oncology services, payment shall be the contracted chemotherapy case rate of $${CASE_RATE.toLocaleString()} per session. This case rate constitutes payment in full for the chemotherapy session including all infused or injected chemotherapy drugs reported with HCPCS Level II J-codes (J9000–J9999). Separate billing of bundled drug J-codes is not reimbursable.`,
    governs: true,
    feedbackApplies: `Yes — this is the lever. Section 8.3(c) is exactly the case-rate provision: chemo admin under Rev ${REV_CODE} triggers the case rate, drug J-codes are bundled. UHC's CO-234 denials are correct.`,
    feedbackRejects: `This IS the governing clause. It explicitly bundles the drug. Look again — the chemo case-rate language is unambiguous.`,
  },
  {
    id: 'prior-auth',
    section: 'Section 4.2 — Prior Authorization',
    label: 'Pre-treatment prior auth required for J-code drugs',
    text: 'Provider must obtain prior authorization from Plan for any infused or injected chemotherapy drug with reportable charge above $1,000 prior to administration. Failure to obtain prior auth results in claim denial.',
    governs: false,
    feedbackApplies: 'Prior auth is a separate (real) requirement, but it doesn\'t govern the bundling. The denials are CO-234 (bundled), not prior-auth. Right idea, wrong clause.',
    feedbackRejects: 'Right call to set this aside. Prior auth would generate a different CARC; the issue here is contractual bundling, not authorization.',
  },
  {
    id: 'standard-rate',
    section: 'Section 6.1 — Standard Outpatient Rate Schedule',
    label: 'Default outpatient fee schedule',
    text: 'Outpatient services not covered under a specialty case rate, bundled rate, or carve-out shall pay at the standard fee schedule appended as Exhibit C, with line-item adjudication and contractual write-off.',
    governs: false,
    feedbackApplies: 'This is the default; it would govern if no case rate applied. But Section 8.3(c) carves chemo out into a case rate, which displaces this clause for chemo encounters. Wrong layer.',
    feedbackRejects: 'Right — the standard schedule is the default and gets displaced by the chemo case-rate clause.',
  },
  {
    id: 'appeals',
    section: 'Section 11.4 — Appeals Timeline',
    label: 'Provider appeals must be filed within 90 days',
    text: 'Provider may dispute Plan adjudications by filing a written appeal with supporting documentation within 90 days of the remit date. Late appeals may be administratively denied.',
    governs: false,
    feedbackApplies: 'This is a procedural clause. It tells you how long you have to appeal — not whether you should. The bundling here is contractually correct, so an appeal is the wrong move regardless of timing.',
    feedbackRejects: 'Right. Appeals timing is procedural; the substantive answer is "don\'t appeal — fix the chargemaster."',
  },
]

const cdmEntries: CdmEntry[] = [
  {
    id: 'admin-1hr',
    chargeCode: 'CDM-CHEMO-ADMIN-1HR',
    description: 'Chemotherapy admin, first hour — solo charge',
    hardCodedTo: ADMIN_CPT,
    revCode: REV_CODE,
    amount: 1_400,
    correct: false,
    reason: 'Drops admin as an isolated line. When this charge fires, the CDM auto-creates a 96413 line — but it doesn\'t suppress the separately-dropped drug charges. Half the bug.',
  },
  {
    id: 'admin-add-hr',
    chargeCode: 'CDM-CHEMO-ADMIN-ADDLHR',
    description: 'Chemotherapy admin, each additional hour',
    hardCodedTo: ADD_HOUR_CPT,
    revCode: REV_CODE,
    amount: 700,
    correct: false,
    reason: 'Same shape as the first-hour entry. Drops 96415 as a separate billable. UHC bundles it into the case rate too. Drop the separate hard-coding; rely on the bundled session entry.',
  },
  {
    id: 'drug-paclitaxel',
    chargeCode: 'CDM-J9267-PACLITAXEL',
    description: 'Paclitaxel injectable, 1mg billable unit',
    hardCodedTo: 'J9267',
    revCode: '0636', // detailed/non-bundled drug rev code (i.e. NOT 0335)
    amount: J9267_BILLED,
    correct: false,
    reason: `This is the misfire. The chargemaster drops J9267 on every chemo session under rev code 0636 (separately billable drugs). UHC's contract says when rev ${REV_CODE} is on the encounter, drug J-codes are bundled. The CDM is dropping a J-code that the contract has already paid for.`,
  },
  {
    id: 'session-bundle',
    chargeCode: 'CDM-CHEMO-SESSION-BUNDLE',
    description: 'Chemotherapy session — bundled case-rate charge (96413 + Rev 0335 anchor; suppresses individual drug + admin lines on UHC contracts)',
    hardCodedTo: ADMIN_CPT,
    revCode: REV_CODE,
    amount: CASE_RATE,
    correct: true,
    reason: 'This is the right hard-coding. One charge entry per chemo session; the CDM rule attaches CPT 96413 + Rev 0335 as the case-rate anchor and suppresses the individual drug and additional-admin entries on contracts where the case rate applies. Configurable per payer (UHC bundles; some payers don\'t).',
  },
]

const resolutions: Resolution[] = [
  {
    id: 'fix-cdm',
    label: 'Update the chargemaster: switch the Cancer Center chemo session to the bundled case-rate charge entry on UHC contracts. Suppress the individual J-code line drops when CPT 96413 + Rev 0335 are present. Re-run the charge-capture audit on the affected accounts.',
    correct: true,
    feedback: 'Right move. The chargemaster fix is the actual answer; the claim adjudication was correct. Going forward, chemo sessions on UHC drop a single case-rate line and the J-codes don\'t get billed at all (much less denied). Existing accounts get cleaned via re-bill, not appeal.',
  },
  {
    id: 'appeal-co234',
    label: 'File a formal appeal on the CO-234 denials. Cite J-code ASP+6% reimbursement guidelines and ask UHC to reverse the bundling.',
    correct: false,
    feedback: 'CO-234 here is contractually correct — Section 8.3(c) bundles the drug into the case rate. Appealing earns the appeal a denial-of-the-appeal letter and burns 30+ days of AR aging. The fix is upstream.',
  },
  {
    id: 'modifier-59',
    label: 'Resubmit the J-codes with modifier 59 (distinct procedural service) to break the bundling edit.',
    correct: false,
    feedback: 'Modifier 59 is for NCCI procedure-pair edits — completely different mechanism. The bundling here is contractual (UHC\'s chemo case rate), not NCCI. Modifier 59 won\'t move it; if anything it triggers payer-side fraud heuristics.',
  },
  {
    id: 'ppdr',
    label: 'Refer the patient to the federal Patient-Provider Dispute Resolution (PPDR) process for surprise-bill relief.',
    correct: false,
    feedback: 'PPDR is for self-pay GFE-vs-final-bill disputes (cousin Case: GFE Oracle). Sarah is an insured patient; UHC paid the contracted case rate; there\'s nothing for the patient to dispute. Wrong forum.',
  },
  {
    id: 'recoup-payment',
    label: 'Recoup the $4,200 case-rate payment to UHC and rebill the session line-by-line.',
    correct: false,
    feedback: 'You\'d be giving back the right amount and asking for less. Section 8.3(c) explicitly sets the case rate at $4,200 — billing line-by-line gets the entire session denied as out-of-contract. This is the kind of "fix" that turns a non-issue into an audit finding.',
  },
]

const issues: Issue[] = [
  {
    id: 'read',
    label: 'Read the contract: which clause governs the chemo session?',
    recap: 'You walked the four sections. Section 8.3(c) — the chemo case-rate clause — governs. Prior auth is a separate procedural requirement; standard schedule is the default that gets displaced; appeals timing is procedural and doesn\'t apply because the bundling is contractually correct.',
    verb: 'read',
  },
  {
    id: 'examine',
    label: 'Examine the chargemaster: which entry is correctly hard-coded?',
    recap: `Three entries broke the case rate by dropping admin + drugs as separate hard-coded lines (CDM-CHEMO-ADMIN-1HR, CDM-CHEMO-ADMIN-ADDLHR, CDM-J9267-PACLITAXEL). One entry is right: CDM-CHEMO-SESSION-BUNDLE — a single charge that anchors to CPT ${ADMIN_CPT} + Rev ${REV_CODE} and suppresses the line-item drops on contracts where the case rate applies.`,
    verb: 'examine',
  },
  {
    id: 'hardcode',
    label: 'Hard-code: switch to the bundled case-rate charge entry on UHC contracts.',
    recap: 'The fix is upstream. Future chemo sessions drop a single bundled charge, not an admin line + a drug line. The CO-234 denials weren\'t an underpayment — they were the contract working as written; the chargemaster wasn\'t.',
    verb: 'hardcode',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'hard-coding': {
    term: 'Hard-coding (RCM context)',
    plain: "When the chargemaster automatically assigns a CPT/HCPCS code to a charge as it's dropped — no human review per encounter. Most outpatient ancillaries (lab, radiology, pharmacy) are hard-coded because the service-to-code mapping is stable. The chargemaster is the configuration table; getting it right is half the RCM battle. The mdclarity-glossary version of \"hard-coding\" (values baked into source code) is the same idea applied to software architecture — when CDM rules are baked too rigidly to adapt to per-payer contract terms, you get this Case.",
  },
  'soft-coding': {
    term: 'Soft-coding',
    plain: "When a HIM (Health Information Management) coder reads the chart after the encounter and assigns CPT/HCPCS/ICD-10 codes manually. Used for inpatient stays (DRG assignment), complex outpatient surgeries, and any encounter where the codes can't be reliably auto-derived from the charge entry. Slower and more expensive than hard-coding, but necessary when documentation drives coding rather than the other way around. Not to be confused with the MRF Cartographer's \"soft-coded services\" (services without stable rates) — same word, different RCM context.",
  },
  'CDM': {
    term: 'CDM (Chargemaster)',
    plain: "Hospital master price list and configuration table. Every billable service has a CDM line specifying: charge description, gross charge, revenue code, default CPT/HCPCS, and sometimes per-payer bundling rules. When charges drop into an encounter, the CDM determines what claim lines get generated. The CDM is where hard-coding rules live; misconfigured CDM = misconfigured claims at scale. NOTE: in many real hospital tech stacks, the per-payer bundling rules actually live in a separate Contract Management System rather than in the CDM directly — the CDM just drops the lines and the contract engine reconciles against the 835. The Case treats them as the same surface for simplicity; in your actual environment, check both.",
  },
  'contract management system': {
    term: 'Contract management system (CMS — confusingly)',
    plain: "Software downstream of the chargemaster that holds payer-specific contract terms (case rates, bundling rules, fee schedules, carve-out clauses) and reconciles 835 adjudications against expected. Larger hospital systems separate the chargemaster (does the charge drop right?) from contract management (was this paid right?). The fix in this Case lives at one of those two layers depending on your stack — the chargemaster (if it drops payer-aware lines) or the contract management system (if it tells the chargemaster what to drop on each payer). Don't confuse with CDM or with CMS the federal agency.",
  },
  'case rate': {
    term: 'Case rate',
    plain: "Fixed dollar amount the payer agrees to pay for a defined session/encounter, regardless of what's done inside it. Spreads risk: provider wins on cheaper sessions, payer wins on expensive ones. Common in oncology (chemo session), surgery (surgical case rate per DRG), and obstetrics (delivery case rate). Most case rates have inclusions explicitly listed in the contract — drugs, supplies, anesthesia, recovery — to avoid line-item disputes downstream.",
  },
  'CO-234': {
    term: 'CO-234 (procedure or service is not separately reimbursable)',
    plain: "CARC indicating the line is bundled into another service on the claim and not separately payable. Different from CO-97 (procedure or service is bundled per NCCI edit — usually fixable with a modifier) and CO-45 (charge exceeds fee schedule — usually a contractual write-off). CO-234 most often signals a contractual bundling rule that no modifier will break; the fix is to stop billing the bundled line in the first place, or to accept the bundling as designed.",
  },
  'Cancer Center': {
    term: 'Mercy Cancer Center',
    plain: "Mercy's outpatient oncology service line. Handles infused/injected chemotherapy administration, supportive infusions, and oncology follow-up visits. Contracts negotiated separately from the inpatient hospital because the cost structure (per-session case rates with bundled drug coverage) doesn't fit a DRG model.",
  },
  'revenue code': {
    term: 'Revenue code (UB-04 FL 42)',
    plain: "4-digit code on the UB-04 (form locator 42) classifying the service category — pharmacy (025x), lab (030x), chemo (033x — including 0331 chemo by injection, 0335 chemo by infusion), ER (045x). Pairs with CPT/HCPCS in FL 44. Critical here: payers route claims through different rate engines based on revenue code, so 0335 vs 0636 (separate drug) flips the entire pricing path.",
  },
  'J-code': {
    term: 'J-code (HCPCS drug code)',
    plain: "HCPCS Level II code for injected/infused drugs. Each J-code has a descriptor specifying the billable unit (10mg, 1mg, etc.). Normally separately billable at ASP+6% under Medicare and most commercial contracts — but inside a case rate, the J-code is bundled and the case rate covers the drug. Reading the contract for case-rate inclusions is the muscle.",
  },
  'NCCI': {
    term: 'NCCI (National Correct Coding Initiative)',
    plain: "CMS's procedure-pair bundling rules. Two CPT codes that shouldn't usually bill together get bundled by NCCI edits (CO-97). Most NCCI bundles are breakable with a modifier (25, 59, 76) when documentation supports separate services. NCCI is procedural; contractual bundling (CO-234) is contractual. Different mechanisms; different fixes.",
  },
}

// ===== Runtime state =====

interface ClauseState { applied: boolean | null; rejected: boolean | null }
interface CdmState { picked: boolean | null }

const state = {
  briefingDone: false,
  briefingOpen: false,
  clauseStates: clauses.reduce((m, c) => { m[c.id] = { applied: null, rejected: null }; return m }, {} as Record<string, ClauseState>),
  openClauseId: null as string | null,
  cdmStates: cdmEntries.reduce((m, c) => { m[c.id] = { picked: null }; return m }, {} as Record<string, CdmState>),
  appliedResolutionId: null as string | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isReadDone(): boolean {
  return clauses.every(c => {
    const s = state.clauseStates[c.id]
    if (c.governs) return s.applied === true
    return s.rejected === true
  })
}

function isExamineDone(): boolean {
  return cdmEntries.every(c => {
    const s = state.cdmStates[c.id]
    if (c.correct) return s.picked === true
    return s.picked === false
  })
}

// ===== Render =====

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
      ${renderClausePanel()}
      ${renderCdmPanel()}
      ${renderResolvePanel()}
      ${renderChecklist()}
    `}
    ${state.briefingDone ? '' : renderDesignNotes()}
    ${renderTermPopover()}
    ${renderBriefingPopover()}
  `
}

function renderHeader(): string {
  const recallBtn = state.briefingDone
    ? `<button class="recall-btn" data-action="show-briefing">📜 Dana's note</button>`
    : ''
  return `
    <header class="page-h">
      <div class="title-row">
        <h1>Chemo Bundle Specter <span class="muted">@ L23 — UHC chemo bundling (chargemaster fix)</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./prototypes.html">← back to catalog</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          ${escape(PATIENT)}'s chemo session at the
          ${term('Cancer Center')} came back with two
          ${term('CO-234')} denials on the chemo drug
          ${term('J-code', 'J-codes')}.
          Looks like an underpayment. It isn't —
          ${escape(PAYER)}'s contract bundles the drug into
          a chemo ${term('case rate')} when ${term('hard-coding', 'CPT 96413 + Rev 0335')} are
          present. The bug is in the ${term('CDM')}, not the
          claim.
          See the <a href="#design-notes">design notes</a>.
        </p>
      `}
    </header>
  `
}

function renderHospitalIntro(): string {
  return `
    <section class="hospital-intro">
      <div class="register hospital">HOSPITAL · Cancer Center billing</div>
      <p>
        The variance report flagged ${escape(PATIENT)}'s chemo session
        ${escape(DOS)}. ${escape(PAYER)} paid ${money(CASE_RATE)} on
        the admin line and denied both
        ${term('J-code', 'drug J-codes')} ${term('CO-234')}.
        Bola, the AR analyst, walks it over. "Looks underpaid by
        ${money(J9267_BILLED + J9045_BILLED)}. We should appeal,
        right?"
      </p>
      <p>
        Maybe. But the contract has a ${term('case rate')} clause
        for chemo at the ${term('Cancer Center')}, and the
        denials are CO-234 — bundled, not contractually short-paid.
        Before filing anything, walk the contract. Then walk the
        ${term('CDM')}.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The contract sections
        slide a half-pixel left, then settle. The chargemaster's
        rule table drifts down beside them. Two layers; same bug.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'The bug isn\'t on the claim. It\'s upstream.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "Different shape from the other Specters. There's no hidden
        underpayment — the contract is right and the payer is paying
        what the contract says. The drug J-codes were never supposed
        to bill in the first place. The bug is the
        ${term('CDM')}'s ${term('hard-coding')}: it drops the
        drugs as separate lines instead of folding them into the
        ${term('case rate')} the way ${escape(PAYER)} contracted them."
      </p>
      <p>
        "Three issues:"
      </p>
      <ul>
        <li>
          Four contract sections.
          Mark the one that governs (8.3(c) — chemo case rate).
          Three are decoys: prior auth, standard schedule, appeals
          timing.
        </li>
        <li>
          Four chargemaster entries.
          Three are misconfigured — they hard-code admin and drugs
          as separate billables. One is right: a single bundled
          case-rate charge entry.
        </li>
        <li>
          Five resolution paths. Only
          one (update the CDM, suppress the J-code drops on UHC
          contracts) is right. The others appeal a contractually
          correct denial, file under the wrong NCCI mechanism, or
          give back the case-rate payment we did receive."
        </li>
      </ul>
      <p>
        "Most RCM bugs that get blamed on payers live in the
        chargemaster. ${term('hard-coding', 'Hard-coding')} is
        invisible right up until it isn't."
      </p>
      <p class="briefing-sign">"Admin code or it didn't happen. — D."</p>
    </div>
  `
}

function renderBriefingPopover(): string {
  if (!state.briefingOpen) return ''
  return `
    <div class="briefing-popover-backdrop">
      <div class="briefing-popover">
        <button class="briefing-popover-close" data-action="close-briefing" aria-label="Close">×</button>
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
        <span class="cs-tag">CLAIM · ${escape(PAYER)} · ICN 2026-04-22-771</span>
        <span class="cs-sub">${escape(FACILITY)}. Chemo session ${escape(DOS)}. Drug J-codes denied ${term('CO-234')}; admin paid the case rate.</span>
      </div>
      <table class="cs-table">
        <tr><th>Patient</th><td>${escape(PATIENT)}</td></tr>
        <tr><th>Encounter</th><td>Chemotherapy session, ${escape(DOS)}</td></tr>
        <tr><th>${ADMIN_CPT} <span class="cs-mini">${escape(ADMIN_DESCRIPTOR)}</span></th><td><strong>Paid ${money(CASE_RATE)}</strong> · ${term('revenue code', 'Rev ' + REV_CODE)}</td></tr>
        <tr><th>${ADD_HOUR_CPT} (additional hour)</th><td class="muted-cell">Bundled into case rate (no separate payment)</td></tr>
        <tr><th>J9267 paclitaxel</th><td><strong class="bad-text">${term('CO-234')}</strong> denied · billed ${money(J9267_BILLED)}</td></tr>
        <tr><th>J9045 carboplatin</th><td><strong class="bad-text">${term('CO-234')}</strong> denied · billed ${money(J9045_BILLED)}</td></tr>
      </table>
    </section>
  `
}

function renderClausePanel(): string {
  const done = state.resolvedIssues.has('read')
  return `
    <section class="clause-panel ${done ? 'done' : ''}">
      <div class="cp-h">
        <span class="cp-tag">CONTRACT · ${escape(PAYER)} ↔ ${escape(FACILITY)}</span>
        <span class="cp-sub">${done
          ? 'Section 8.3(c) governs. Three other sections are decoys.'
          : 'Click each clause to read. Mark the one that governs the chemo session. Reject the decoys.'}</span>
      </div>
      <ul class="clause-list">
        ${clauses.map(c => renderClauseRow(c)).join('')}
      </ul>
      ${state.transientFeedback && clauses.some(c => c.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('read') : ''}
    </section>
  `
}

function renderClauseRow(c: ContractClause): string {
  const open = state.openClauseId === c.id
  const ss = state.clauseStates[c.id]
  const decided = (ss.applied === true) || (ss.rejected === true)
  return `
    <li class="clause ${open ? 'open' : ''} ${ss.applied ? 'applied' : ''} ${ss.rejected ? 'rejected' : ''}">
      <button class="clause-toggle" data-action="toggle-clause" data-id="${c.id}">
        <span class="clause-section">${escape(c.section)}</span>
        <span class="clause-label">${escape(c.label)}</span>
        ${ss.applied ? '<span class="clause-badge applied">GOVERNS</span>' : ''}
        ${ss.rejected ? '<span class="clause-badge rejected">decoy</span>' : ''}
      </button>
      ${open ? `
        <div class="clause-body">
          <p class="clause-text">${escape(c.text)}</p>
          ${decided ? '' : `
            <div class="clause-actions">
              <button class="btn small primary" data-action="apply-clause" data-id="${c.id}">This clause governs</button>
              <button class="btn small ghost"   data-action="reject-clause" data-id="${c.id}">Doesn't apply</button>
            </div>
          `}
        </div>
      ` : ''}
    </li>
  `
}

function renderCdmPanel(): string {
  const unlocked = state.resolvedIssues.has('read')
  const done = state.resolvedIssues.has('examine')
  if (!unlocked) {
    return `
      <section class="cdm-panel locked">
        <div class="cm-h">
          <span class="cm-tag idle">CHARGEMASTER ENTRIES</span>
          <span class="cm-sub">Locked until the contract clause is resolved.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="cdm-panel ${done ? 'done' : 'active'}">
      <div class="cm-h">
        <span class="cm-tag ${done ? 'done' : 'active'}">CHARGEMASTER · 4 entries</span>
        <span class="cm-sub">${done
          ? 'CDM-CHEMO-SESSION-BUNDLE is correctly hard-coded. Three other entries break the case rate.'
          : 'For each entry, mark whether it\'s correctly hard-coded for the UHC chemo case-rate contract.'}</span>
      </div>
      <ul class="cdm-list">
        ${cdmEntries.map(e => renderCdmRow(e)).join('')}
      </ul>
      ${state.transientFeedback && cdmEntries.some(e => e.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('examine') : ''}
    </section>
  `
}

function renderCdmRow(e: CdmEntry): string {
  const ss = state.cdmStates[e.id]
  const decided = ss.picked !== null
  const correct = decided && ss.picked === e.correct
  return `
    <li class="cdm-entry ${decided && correct ? 'correct' : ''}">
      <div class="cdm-meta">
        <code class="cdm-code">${escape(e.chargeCode)}</code>
        <div class="cdm-desc">${escape(e.description)}</div>
        <div class="cdm-line">
          <span class="cdm-tag-mini">→ ${escape(e.hardCodedTo)} · Rev ${escape(e.revCode)} · ${money(e.amount)}</span>
        </div>
      </div>
      <div class="cdm-actions">
        ${decided && correct ? `
          <span class="cdm-badge ${ss.picked ? 'right' : 'broken'}">${ss.picked ? 'CORRECT' : 'BREAKS CASE RATE'}</span>
          <button class="btn small ghost" data-action="reset-cdm" data-id="${e.id}">↺ undo</button>
        ` : `
          <button class="btn small ghost" data-action="pick-cdm" data-id="${e.id}" data-pick="true">Correct</button>
          <button class="btn small ghost" data-action="pick-cdm" data-id="${e.id}" data-pick="false">Breaks case rate</button>
        `}
      </div>
    </li>
  `
}

function renderResolvePanel(): string {
  const unlocked = state.resolvedIssues.has('read') && state.resolvedIssues.has('examine')
  const done = state.resolvedIssues.has('hardcode')
  if (!unlocked) {
    return `
      <section class="resolve-panel locked">
        <div class="rp-h">
          <span class="rp-tag idle">HARD-CODE THE FIX</span>
          <span class="rp-sub">Locked until contract reading + CDM examination are done.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="resolve-panel ${done ? 'done' : 'active'}">
      <div class="rp-h">
        <span class="rp-tag ${done ? 'done' : 'active'}">RESOLUTION · 5 paths</span>
        <span class="rp-sub">${done
          ? 'Chargemaster updated. UHC chemo sessions now drop a single bundled case-rate charge.'
          : 'One path is upstream (the right answer). Four are downstream — appealing the wrong target, breaking the wrong edit, or refunding the right payment.'}</span>
      </div>
      <ul class="res-list">
        ${resolutions.map(r => renderResolutionRow(r)).join('')}
      </ul>
      ${state.transientFeedback && resolutions.some(r => r.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('hardcode') : ''}
    </section>
  `
}

function renderResolutionRow(r: Resolution): string {
  const applied = state.appliedResolutionId === r.id
  return `
    <li class="res-opt ${applied ? 'applied' : ''}">
      <button class="res-btn" data-action="apply-resolution" data-id="${r.id}" ${state.appliedResolutionId !== null && !applied ? 'disabled' : ''}>
        <span class="res-label">${escape(r.label)}</span>
        ${applied ? '<span class="res-badge applied">APPLIED</span>' : ''}
      </button>
    </li>
  `
}

function renderRecap(issueId: string): string {
  const issue = issues.find(i => i.id === issueId)
  if (!issue) return ''
  return `
    <div class="recap">
      <div class="recap-h">RECAP</div>
      <p>${escape(issue.recap)}</p>
    </div>
  `
}

function renderChecklist(): string {
  const allDone = issues.every(i => state.resolvedIssues.has(i.id))
  return `
    <section class="checklist">
      <div class="checklist-h">CHARGEMASTER FIX · 3 issues to resolve</div>
      <ul>
        ${issues.map(i => {
          const done = state.resolvedIssues.has(i.id)
          return `
            <li class="${done ? 'done' : ''}">
              <span class="check">${done ? '✓' : '○'}</span>
              <div class="issue-body">
                <div class="issue-label">${escape(i.label)}</div>
              </div>
            </li>
          `
        }).join('')}
      </ul>
      ${state.failedAttempts > 0 ? `<p class="fail-counter">Wrong picks so far: ${state.failedAttempts}.</p>` : ''}
      <button class="btn submit ${allDone ? '' : 'disabled'}" data-action="submit" ${allDone ? '' : 'disabled'}>
        Update chargemaster · suppress drug J-code drops on UHC chemo
      </button>
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
        <div class="term-popover-h">
          <span class="term-popover-name">${escape(entry.term)}</span>
          <button class="term-popover-close" data-action="close-term" aria-label="Close">×</button>
        </div>
        <p>${escape(entry.plain)}</p>
      </div>
    </div>
  `
}

const RECAP: CaseRecap = CASE_RECAPS['chemo-bundle-specter']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">CHARGEMASTER UPDATED</div>
      <h2>UHC chemo sessions drop a single bundled case-rate charge.</h2>
      <p>
        The CDM rule for ${escape(FACILITY)} chemo now anchors on
        CPT ${ADMIN_CPT} + Rev ${REV_CODE} for UHC contracts and
        suppresses the individual drug + additional-admin lines.
        ${escape(PATIENT)}'s account doesn't need an appeal —
        ${escape(PAYER)} paid the case rate as written. Going
        forward, the J-codes won't bill, won't deny, and won't
        muddy the variance report.
      </p>
      <p class="muted">
        The Specter wasn't a payer underpayment. It was the
        chargemaster dropping charges the contract had already
        paid. Most "underpayments" that AR analysts chase are this
        shape — upstream configuration, not downstream
        adjudication.
      </p>
      <div class="register hospital">HOSPITAL · later that morning</div>
      <p>
        Bola pulls the variance report fresh: ${escape("the Cancer Center's")}
        last 90 days have 47 sessions with the same pattern.
        "${escape("That's")} 47 phantom appeals we don't have to file
        anymore. And another 80% reduction in CO-234 noise on the
        AR aging."
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
            <li><strong>Three actions:</strong> reading the clause
            (contract section reading; cousin to Case Rate
            Specter's contract comparison), examining the CDM (chargemaster
            inspection), and hard-coding (configure the upstream rule).</li>
            <li><strong>The bug isn't on the claim.</strong>
            First Case where the answer is upstream — fix the
            chargemaster, not the rejection. Most "appeal the
            denial" instincts are wrong here.</li>
            <li><strong>${term('hard-coding', 'Hard-coding')}
            is invisible.</strong> Chargemaster rules are
            mostly right; when they're wrong, they're wrong at
            scale across every encounter that fires them.</li>
            <li><strong>Contractual bundling vs NCCI
            bundling.</strong> CO-234 is contractual; CO-97 is
            NCCI. Different mechanisms, different fixes.
            Modifier 59 won't break a contractual case rate.</li>
            <li><strong>Frequency caveat:</strong> bundled-drug
            chemo case rates exist (capitated arrangements, some
            commercial contracts, CMMI episode-based payment
            demos) but are <em>uncommon</em>. Most chemo in the
            wild bills admin (96413) at OPG/APC tier separately
            and J-codes at ASP+6%. Don't leave this Case thinking
            bundled-drug is the default — it isn't. The
            chargemaster-fix muscle generalizes; the bundle
            structure is one specific shape it can take.</li>
          </ul>
        </div>
        <div>
          <h3>Sibling shape</h3>
          <ul>
            <li>Cousin to
            <a href="./case-rate-specter-prototype.html">Case Rate Specter</a>
            (same contract-clause-as-lever; that one classifies
            inlier/outlier, this one classifies bundled/separate).</li>
            <li>Cousin to
            <a href="./mrf-cartographer-prototype.html">MRF Cartographer</a>
            (both involve chargemaster mappings; that one is about
            what to publish, this one is about what to bill).</li>
            <li>Cousin to
            <a href="./asp-wac-apothecary-prototype.html">ASP/WAC Apothecary</a>
            (both involve J-code drug lines; that one fights for
            the right unit count, this one suppresses the line
            entirely under the case rate).</li>
            <li>Sets up the chargemaster-as-mutable-configuration
            theme that recurs in any future Case where the fix is
            "update the CDM" rather than "fix the claim."</li>
          </ul>
        </div>
      </div>
      <p class="notes-cta">
        See the <a href="./prototypes.html">Case Prototypes catalog</a>
        for the full set. Hard-coding glossary reference:
        <a href="https://www.mdclarity.com/glossary/hard-coding" target="_blank" rel="noopener">mdclarity</a>
        (broader software-engineering definition; the RCM-domain
        version is what governs in this Case).
      </p>
    </section>
  `
}

// ===== State mutations =====

function dismissBriefing() { state.briefingDone = true; state.briefingOpen = false }
function showBriefing() { state.briefingOpen = true }
function closeBriefing() { state.briefingOpen = false }
function openTerm(termId: string) { state.openTermId = termId }
function closeTerm() { state.openTermId = null }

function toggleClause(id: string) {
  state.openClauseId = state.openClauseId === id ? null : id
  state.transientFeedback = null
}

function applyClause(id: string) {
  const c = clauses.find(x => x.id === id)
  if (!c) return
  state.transientFeedback = null
  if (c.governs) {
    state.clauseStates[id].applied = true
    state.clauseStates[id].rejected = null
    state.transientFeedback = { id, message: c.feedbackApplies, kind: 'good' }
    if (isReadDone()) state.resolvedIssues.add('read')
    state.openClauseId = null
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: c.feedbackApplies, kind: 'bad' }
  }
}

function rejectClause(id: string) {
  const c = clauses.find(x => x.id === id)
  if (!c) return
  state.transientFeedback = null
  if (!c.governs) {
    state.clauseStates[id].rejected = true
    state.clauseStates[id].applied = null
    state.transientFeedback = { id, message: c.feedbackRejects, kind: 'good' }
    if (isReadDone()) state.resolvedIssues.add('read')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: c.feedbackRejects, kind: 'bad' }
  }
}

function pickCdm(id: string, pick: boolean) {
  const e = cdmEntries.find(x => x.id === id)
  if (!e) return
  state.transientFeedback = null
  if (e.correct === pick) {
    state.cdmStates[id].picked = pick
    state.transientFeedback = { id, message: e.reason, kind: 'good' }
    if (isExamineDone()) state.resolvedIssues.add('examine')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: e.reason, kind: 'bad' }
  }
}

function resetCdm(id: string) {
  state.cdmStates[id].picked = null
  state.resolvedIssues.delete('examine')
  state.resolvedIssues.delete('hardcode')
  state.transientFeedback = null
}

function applyResolution(id: string) {
  const r = resolutions.find(x => x.id === id)
  if (!r) return
  state.transientFeedback = null
  if (r.correct) {
    state.appliedResolutionId = id
    state.resolvedIssues.add('hardcode')
    state.transientFeedback = { id, message: r.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: r.feedback, kind: 'bad' }
  }
}

function attemptSubmit() {
  if (issues.every(i => state.resolvedIssues.has(i.id))) {
    state.packetSubmitted = true
    notifyParentVictory('chemo-bundle-specter')
  }
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  state.openClauseId = null
  for (const id in state.clauseStates) state.clauseStates[id] = { applied: null, rejected: null }
  for (const id in state.cdmStates) state.cdmStates[id] = { picked: null }
  state.appliedResolutionId = null
  state.transientFeedback = null
  state.resolvedIssues = new Set()
  state.failedAttempts = 0
  state.packetSubmitted = false
  state.openTermId = null
}

function handleClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.classList.contains('briefing-popover-backdrop')) { closeBriefing(); rerender(); return }
  if (target.classList.contains('term-popover-backdrop')) { closeTerm(); rerender(); return }
  const el = target.closest('[data-action]') as HTMLElement | null
  if (!el) return
  switch (el.dataset.action) {
    case 'toggle-clause': if (el.dataset.id) toggleClause(el.dataset.id); break
    case 'apply-clause':  if (el.dataset.id) applyClause(el.dataset.id);  break
    case 'reject-clause': if (el.dataset.id) rejectClause(el.dataset.id); break
    case 'pick-cdm': if (el.dataset.id && el.dataset.pick) pickCdm(el.dataset.id, el.dataset.pick === 'true'); break
    case 'reset-cdm': if (el.dataset.id) resetCdm(el.dataset.id); break
    case 'apply-resolution': if (el.dataset.id) applyResolution(el.dataset.id); break
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

// ===== Per-prototype CSS =====

const css = districtVars('billing') + BASE_CSS + `
  .claim-summary { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .cs-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .cs-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .cs-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .cs-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .cs-table th, .cs-table td { text-align: left; padding: 6px 10px; border-bottom: 1px dashed #232a36; vertical-align: top; }
  .cs-table th { font-size: 11px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; width: 220px; }
  .cs-mini { display: block; color: var(--ink-dim); font-style: italic; font-weight: normal; font-size: 10.5px; text-transform: none; letter-spacing: normal; margin-top: 2px; }
  .bad-text { color: var(--bad); }
  .muted-cell { color: var(--ink-dim); font-style: italic; }

  /* Clause panel (re-uses the Case Rate Specter pattern) */
  .clause-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent-2); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .clause-panel.done { border-left-color: var(--good); }
  .cp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .cp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent-2); }
  .cp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .clause-list { list-style: none; padding-left: 0; margin: 0; }
  .clause { background: var(--panel-2); border-radius: 5px; margin-bottom: 8px; border-left: 3px solid transparent; transition: border-left-color 0.15s; }
  .clause.applied { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .clause.rejected { border-left-color: #2a3142; opacity: 0.55; }
  .clause-toggle { width: 100%; background: transparent; border: 0; color: var(--ink); cursor: pointer; padding: 12px 14px; text-align: left; display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; font: inherit; }
  .clause-toggle:hover { background: rgba(255,255,255,0.025); }
  .clause-section { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 11.5px; color: var(--ink-dim); }
  .clause-label { font-size: 13px; flex: 1; }
  .clause-badge { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; padding: 2px 8px; border-radius: 3px; font-weight: 700; }
  .clause-badge.applied { background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; }
  .clause-badge.rejected { background: rgba(138,147,163,0.10); color: var(--ink-dim); border: 1px solid #2a3142; }
  .clause-body { padding: 0 14px 12px 14px; border-top: 1px dashed #2a3142; }
  .clause-text { margin: 12px 0 12px; font-size: 13px; line-height: 1.6; color: var(--ink); }
  .clause-actions { display: flex; gap: 10px; }
  .btn.small { padding: 4px 12px; font-size: 11.5px; }

  /* CDM panel — distinctive lavender to visually flag "this is upstream config" */
  .cdm-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid #c8b6e0; border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .cdm-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .cdm-panel.done   { border-left-color: var(--good); }
  .cm-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .cm-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #c8b6e0; }
  .cm-tag.idle { color: var(--ink-dim); }
  .cm-tag.done { color: var(--good); }
  .cm-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .cdm-list { list-style: none; padding-left: 0; margin: 0; }
  .cdm-entry { display: flex; gap: 14px; align-items: center; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 6px; border-left: 3px solid transparent; flex-wrap: wrap; }
  .cdm-entry.correct { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .cdm-meta { flex: 2; min-width: 320px; }
  .cdm-code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 12px; color: #c8b6e0; background: var(--bg); padding: 2px 8px; border-radius: 3px; }
  .cdm-desc { font-size: 13px; margin-top: 4px; }
  .cdm-line { font-size: 11.5px; color: var(--ink-dim); margin-top: 2px; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .cdm-tag-mini { font-style: normal; }
  .cdm-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .cdm-badge { font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 3px; letter-spacing: 0.04em; }
  .cdm-badge.right  { background: rgba(126, 226, 193, 0.15); color: var(--good); border: 1px solid #2c5547; }
  .cdm-badge.broken { background: rgba(239, 91, 123, 0.10); color: var(--bad); border: 1px solid #4a2a32; }

  /* Resolve panel */
  .resolve-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent-2); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .resolve-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .resolve-panel.done   { border-left-color: var(--good); }
  .rp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .rp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent-2); }
  .rp-tag.idle { color: var(--ink-dim); }
  .rp-tag.done { color: var(--good); }
  .rp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .res-list { list-style: none; padding-left: 0; margin: 0; }
  .res-opt { margin-bottom: 6px; }
  .res-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 11px 14px; text-align: left; font: inherit; transition: all 0.15s; position: relative; }
  .res-btn:hover:not(:disabled) { background: #232b3a; border-color: var(--accent-2); }
  .res-btn:disabled { opacity: 0.45; cursor: default; }
  .res-opt.applied .res-btn { border-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); opacity: 1; }
  .res-label { font-size: 13px; line-height: 1.5; display: block; padding-right: 80px; }
  .res-badge.applied { position: absolute; top: 10px; right: 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; font-weight: 700; }

  .recap { background: rgba(126, 226, 193, 0.06); border-color: #2c5547; }
  .recap-h { color: var(--good); }
`

// ===== Mount =====

function rerender() { const root = document.getElementById('prototype-root'); if (root) root.innerHTML = render() }

function mount() {
  const style = document.createElement('style')
  style.textContent = css
  document.head.appendChild(style)
  rerender()
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
