// 340B Drug Pricing Specter @ L30 — duplicate-discount Case.
//
// 340B is the federal program (42 USC §256b) that lets eligible
// safety-net providers buy outpatient drugs at deeply discounted
// prices from manufacturers. The deal: in exchange, providers
// expand access for low-income patients. The catch: the
// duplicate-discount prohibition — manufacturers can't be required
// to provide BOTH the 340B discount AND a Medicaid drug rebate on
// the same dose.
//
// Encounter: Mercy is 340B-eligible. State Medicaid managed-care
// patient. Outpatient bevacizumab biosimilar infusion, dose came
// from 340B inventory. Claim submitted to Medicaid without the
// state's UD modifier (340B identifier). Medicaid paid + the
// manufacturer paid the Medicaid rebate later — duplicate
// discount on the same dose. Manufacturer reports it; HRSA opens
// a compliance review.
//
// Actions:
//   - QUALIFY: 4 statements about 340B eligibility (provider, drug,
//     patient, GPO prohibition).
//   - MARK: pick the right modifier for this state Medicaid claim.
//   - DISCLOSE: pick the resolution path including HRSA self-disclosure.
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

// ===== Domain types =====

interface QualifyStatement {
  id: string
  text: string
  truth: boolean
  reason: string
}

interface ModifierOption {
  id: string
  label: string
  detail: string
  correct: boolean
  feedback: string
}

interface Resolution {
  id: string
  label: string
  detail: string
  correct: boolean
  feedback: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'qualify' | 'mark' | 'disclose'
}

interface GlossaryEntry { term: string; plain: string }

// ===== Encounter data =====

const PATIENT = 'Aaron Burnett'
const DRUG = 'Bevacizumab biosimilar (Mvasi, HCPCS Q5107)'
const PAYER = 'State Medicaid Managed Care'
const FACILITY = 'Mercy outpatient oncology'
const ACQ_PRICE_340B = 312
const ASP_PLUS_6 = 845
const STATE_MOD = 'UD'

const qualifyStatements: QualifyStatement[] = [
  {
    id: 'q1',
    text: 'Mercy qualifies as a 340B "covered entity" because its DSH percentage exceeds the threshold (11.75% for general acute hospitals).',
    truth: true,
    reason: 'Right. 340B eligibility for general acute hospitals requires DSH (Disproportionate Share Hospital) percentage above 11.75% (or other qualifying categories: critical access, rural referral centers, sole community hospitals, freestanding cancer hospitals, etc.). Mercy\'s DSH is 18.4% — comfortably qualifying.',
  },
  {
    id: 'q2',
    text: 'All outpatient drugs purchased by Mercy are eligible for 340B pricing.',
    truth: false,
    reason: 'Wrong. Several carve-outs: (a) orphan drugs for orphan indications at rural referral centers, critical access hospitals, sole community hospitals, free-standing cancer hospitals (note general acute hospitals like Mercy DON\'T have this orphan carve-out — orphan drugs ARE 340B-eligible at Mercy); (b) drugs purchased through GPO (Group Purchasing Organization) for inpatient use; (c) certain vaccines. Mercy bevacizumab biosimilar use here is outpatient + on the 340B-eligible list.',
  },
  {
    id: 'q3',
    text: '340B savings can be earned on the same dose that Medicaid will later pay a manufacturer rebate on.',
    truth: false,
    reason: 'Wrong — this is the **duplicate-discount prohibition** (42 USC §256b(a)(5)(A)). A manufacturer can\'t be required to provide both the 340B discount and a Medicaid drug rebate on the same dose. Each state has a 340B carve-in or carve-out policy to prevent this. Most states require the covered entity to identify 340B-acquired drugs on Medicaid claims (this state uses Modifier UD); when correctly identified, Medicaid excludes the dose from rebate billing. Failure to identify = duplicate discount = HRSA exposure for the covered entity.',
  },
  {
    id: 'q4',
    text: 'GPO-purchased outpatient drugs at general acute hospitals can be billed under 340B.',
    truth: false,
    reason: 'Wrong. The "GPO prohibition" is a 340B program rule for hospital covered entities: outpatient drugs purchased through GPO (instead of 340B or wholesale) cannot be re-flagged as 340B at billing. Drugs must be acquired through the 340B program to be billed as 340B. Mercy\'s biosimilar in this Case was bought directly through 340B; the GPO prohibition doesn\'t apply here, but the rule is a frequent compliance trap.',
  },
]

const modifierOptions: ModifierOption[] = [
  {
    id: 'ud',
    label: `Modifier ${STATE_MOD}`,
    detail: '340B identifier required by this state Medicaid program for outpatient claims. Triggers the carve-out flag in the state Medicaid system; manufacturer rebate is excluded for the dose; duplicate-discount avoided.',
    correct: true,
    feedback: `Right. Modifier ${STATE_MOD} on the line tells state Medicaid \"this dose came from 340B inventory; don't bill the manufacturer for a rebate.\" The state's MMIS system flags the carve-out automatically; manufacturer's rebate report excludes the dose; HRSA finds nothing to compliance-review.`,
  },
  {
    id: 'jg',
    label: 'Modifier JG',
    detail: '340B drug identifier for Medicare claims (post-Becerra still required for tracking even though payment is ASP+6% either way).',
    correct: false,
    feedback: 'JG is the Medicare modifier, not Medicaid. Wrong payer. State Medicaid uses UD (or a state-specific identifier — varies by state). Filing JG on a Medicaid claim is a tracking error and won\'t trigger the state\'s duplicate-discount avoidance flag.',
  },
  {
    id: 'tb',
    label: 'Modifier TB',
    detail: '340B drug for which a discount was provided at the time of acquisition (Medicare DME context for some scenarios).',
    correct: false,
    feedback: 'TB is a Medicare DME-related modifier, not the Medicaid 340B identifier. Wrong context for an outpatient hospital infusion claim to a state Medicaid program.',
  },
  {
    id: 'none',
    label: 'No modifier — bill at ASP+6% the same as non-340B drugs',
    detail: 'Skip the 340B identifier; let the claim adjudicate at standard rates.',
    correct: false,
    feedback: `This is what was originally done. State Medicaid paid ${money(ASP_PLUS_6)} as if the drug were non-340B. Manufacturer later got billed for a Medicaid rebate on the dose AND was already obligated to provide the 340B discount → duplicate discount → manufacturer reports → HRSA opens a compliance review on Mercy. The bug being fixed.`,
  },
]

const resolutions: Resolution[] = [
  {
    id: 'refile-and-disclose',
    label: `Refile the claim with Modifier ${STATE_MOD}; refund the duplicate discount to the manufacturer; self-disclose to HRSA.`,
    detail: `Frequency-7 corrected claim with the ${STATE_MOD} modifier; coordinate with the manufacturer to reverse the rebate billing on the disputed dose; file a 340B self-disclosure with HRSA documenting the inadvertent duplicate discount + the corrective action.`,
    correct: true,
    feedback: 'Right path. HRSA strongly favors self-disclosure with corrective action over discovered violations. Self-disclosure typically avoids program-removal sanctions and limits remediation to refund + corrective action plan. Refiling + refund + disclosure is the textbook 340B compliance response.',
  },
  {
    id: 'just-refile',
    label: `Refile with Modifier ${STATE_MOD}; skip the HRSA self-disclosure (it's a one-off).`,
    detail: 'Fix the immediate claim; don\'t escalate.',
    correct: false,
    feedback: 'The manufacturer already reported the duplicate discount (that\'s how this came to attention). HRSA review is open; \"skip the disclosure\" doesn\'t make the review go away. Self-disclosure during an open review still helps; failing to disclose makes the review punitive instead of remedial.',
  },
  {
    id: 'switch-supplier',
    label: 'Switch the Mercy oncology pharmacy off 340B supply to avoid the issue.',
    detail: 'Re-source bevacizumab biosimilar through wholesale; abandon 340B savings on this drug.',
    correct: false,
    feedback: `Defeats the purpose. 340B saves Mercy ${money(ASP_PLUS_6 - ACQ_PRICE_340B)} per dose; abandoning the program over one billing error costs orders of magnitude more than fixing the modifier mapping. The bug is the modifier, not the program.`,
  },
  {
    id: 'bill-medicare',
    label: 'Bill Medicare instead — Aaron has secondary Medicare coverage; that bypasses the duplicate-discount issue.',
    detail: 'Switch the claim from Medicaid primary to Medicare; use modifier JG.',
    correct: false,
    feedback: 'Wrong primary. Aaron is Medicaid-primary (managed-care plan); Medicare is secondary if present at all. Switching primary to evade the duplicate-discount rule is fraud — and even if it were allowed, COB rules would make Medicaid primary anyway for low-income beneficiaries on Medicaid managed care.',
  },
  {
    id: 'recoup-state',
    label: `Recoup the ${money(ASP_PLUS_6)} payment from the state; rebill from scratch.`,
    detail: 'Reverse the original payment; submit a fresh claim with the modifier.',
    correct: false,
    feedback: 'Net effect is the same as Frequency-7 corrected claim but with more friction. State MMIS systems handle Frequency-7 more cleanly than full recoup-and-rebill. Use the standard mechanism.',
  },
]

const issues: Issue[] = [
  {
    id: 'qualify',
    label: 'Qualify: walk 340B eligibility rules. 4 statements true/false.',
    recap: `Walked the rules. Mercy qualifies (DSH 18.4% > 11.75% threshold). Not all drugs are 340B-eligible (orphan + GPO carve-outs). Duplicate-discount prohibition applies to Medicaid. GPO-purchased outpatient drugs CAN'T be re-flagged as 340B at billing.`,
    verb: 'qualify',
  },
  {
    id: 'mark',
    label: 'Mark: pick the right modifier for this state Medicaid claim.',
    recap: `Modifier ${STATE_MOD} (state's 340B identifier). Triggers the duplicate-discount carve-out in state MMIS; manufacturer rebate excluded; clean. JG is Medicare-specific (wrong payer). TB is DME context (wrong context). No modifier (= original bug).`,
    verb: 'mark',
  },
  {
    id: 'disclose',
    label: 'Disclose: refile + refund duplicate + self-disclose to HRSA.',
    recap: `Frequency-7 corrected claim with ${STATE_MOD} modifier; manufacturer reimbursed for the duplicate rebate paid on the disputed dose; HRSA self-disclosure with corrective-action plan filed. Self-disclosure during compliance review is remedial; non-disclosure makes review punitive.`,
    verb: 'disclose',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  '340B': {
    term: '340B Drug Pricing Program',
    plain: "Federal program (42 USC §256b, established 1992) that requires drug manufacturers to provide deeply discounted outpatient drugs to specified safety-net providers (the \"covered entities\"). The deal: providers receive ~25-50% discounts on outpatient drugs; in exchange, they're expected to expand access for low-income and uninsured patients. Administered by HRSA's Office of Pharmacy Affairs. Covered entities include: DSH hospitals (≥11.75% DSH), critical access hospitals, rural referral centers, sole community hospitals, free-standing cancer hospitals, federally qualified health centers, Ryan White HIV clinics, family planning clinics, and others.",
  },
  'covered entity': {
    term: 'Covered entity (340B)',
    plain: "A provider eligible to participate in 340B. For hospitals: must be a non-profit / public hospital with DSH ≥ 11.75%, OR a critical access hospital, rural referral center, sole community hospital, or free-standing cancer hospital. The covered entity registers with HRSA quarterly; eligibility is reviewed annually. Loss of eligibility (DSH dropping below threshold, ownership change) requires re-evaluation of all 340B billing.",
  },
  'duplicate discount': {
    term: 'Duplicate discount prohibition (42 USC §256b(a)(5)(A))',
    plain: "Manufacturers can't be required to provide BOTH the 340B discount and a Medicaid drug rebate on the same dose. Each state has a 340B carve-in or carve-out policy to prevent this. Carve-out states require providers to identify 340B-acquired drugs on Medicaid claims (using a state-specific modifier — UD is most common); the state then excludes those doses from manufacturer rebate billing. Carve-in states require the opposite — provider doesn't use 340B drugs for Medicaid patients at all. Failure to identify correctly = duplicate discount = HRSA compliance review for the covered entity.",
  },
  'GPO prohibition': {
    term: 'GPO prohibition (340B)',
    plain: "Rule for hospital covered entities: outpatient drugs purchased through Group Purchasing Organizations (GPOs) cannot be re-flagged as 340B at billing time. Drugs must be acquired through the 340B program directly to be billed as 340B. The prohibition exists because the GPO discount and the 340B discount come from the same manufacturer; allowing both would create a double-discount the program isn't designed to support. Note: the prohibition applies to outpatient drugs only; inpatient GPO purchases are unaffected.",
  },
  'orphan drug carve-out': {
    term: 'Orphan drug carve-out (340B)',
    plain: "Some 340B covered-entity types (rural referral centers, critical access hospitals, sole community hospitals, free-standing cancer hospitals) lose 340B eligibility on orphan drugs when used for orphan indications. General acute hospitals like Mercy DON'T have this carve-out — orphan drugs are 340B-eligible at Mercy. The carve-out is one of the most-misunderstood 340B rules; covered entity type drives whether it applies.",
  },
  'JG modifier': {
    term: 'Modifier JG (Medicare 340B)',
    plain: "Medicare-specific modifier identifying a drug as 340B-acquired. Required on Medicare Part B outpatient drug claims for tracking purposes. After SCOTUS Becerra v AHA (2022) and the OPPS final rule remedy, Medicare pays 340B drugs at ASP+6% (same as non-340B); JG is now a tracking flag rather than a payment modifier, but it's still required.",
  },
  'UD modifier': {
    term: 'Modifier UD (state Medicaid 340B)',
    plain: "Most common state-specific 340B identifier on Medicaid outpatient drug claims. Triggers the duplicate-discount carve-out in state MMIS systems. Rules vary by state — some use UD, some use a state-specific code, some require a billing flag rather than a modifier. The Case uses UD as a representative example; check the actual state contract.",
  },
  'HRSA self-disclosure': {
    term: 'HRSA 340B self-disclosure',
    plain: "Voluntary disclosure of a 340B program violation by the covered entity to HRSA's Office of Pharmacy Affairs. Strongly favored by HRSA; self-disclosure with corrective action plan typically results in remediation (refund + corrective measures) rather than program-removal sanctions. Failure to disclose discovered violations risks more severe penalties — entity termination, repayment of the entire duplicate-discount amount, plus potential FCA exposure.",
  },
  'Becerra v AHA': {
    term: 'Becerra v AHA (2022)',
    plain: "Supreme Court ruling that CMS\'s 2018-2022 reduction of 340B drug payment to ASP-22.5% (vs ASP+6% for non-340B drugs) was unlawful. CMS reverted to ASP+6% for 340B drugs going forward and issued retroactive remedy payments for the 2018-2022 period via the 2023 OPPS final rule. Net effect: in 2026, 340B and non-340B drugs both pay ASP+6% from Medicare's perspective. Modifier JG remains required for tracking.",
  },
}

// ===== Runtime state =====

interface StmtState { pick: boolean | null }

const state = {
  briefingDone: false,
  briefingOpen: false,
  stmtStates: qualifyStatements.reduce((m, s) => { m[s.id] = { pick: null }; return m }, {} as Record<string, StmtState>),
  appliedModifierId: null as string | null,
  appliedResolutionId: null as string | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isQualifyDone(): boolean {
  return qualifyStatements.every(s => state.stmtStates[s.id].pick === s.truth)
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
      ${renderQualifyPanel()}
      ${renderMarkPanel()}
      ${renderDisclosePanel()}
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
        <h1>340B Drug Pricing Specter <span class="muted">@ L30 — duplicate-discount Case</span></h1>
        <div class="header-actions">${recallBtn}<a class="back-link" href="./prototypes.html">← back to catalog</a></div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          ${escape(PATIENT)}'s outpatient bevacizumab biosimilar
          infusion. Mercy bought the dose through ${term('340B')}
          (saved ${money(ASP_PLUS_6 - ACQ_PRICE_340B)}); state
          Medicaid claim went out without modifier
          ${escape(STATE_MOD)} (the state's 340B identifier);
          manufacturer paid the Medicaid rebate AND provided the
          340B discount on the same dose →
          ${term('duplicate discount')}. Manufacturer reported it.
          HRSA opened a compliance review. Walk the rules; mark
          the modifier; self-disclose. See the
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
        Theo from compliance brings a HRSA letter over.
        ${escape(PATIENT)}'s bevacizumab biosimilar infusion 6 weeks
        ago — billed to state Medicaid managed care without
        modifier ${escape(STATE_MOD)}. Drug came from ${term('340B')}
        inventory. Manufacturer's quarterly Medicaid rebate report
        flagged the dose; the rebate AND the 340B discount were both
        applied to the same vial. Duplicate discount.
      </p>
      <p>
        "Self-disclose. We refile with the modifier, we refund the
        manufacturer for the duplicate rebate, we file a 340B
        self-disclosure with HRSA documenting the corrective action.
        That's textbook. The wrong move is hoping it goes away —
        manufacturer already filed."
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The HRSA letter
        slides a half-pixel left, then settles. The state Medicaid
        modifier list drifts in beside it.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : '340B duplicate discount. Self-disclose; don\'t hide.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "${term('340B')} is the safety-net program that lets us buy
        Aaron's bevacizumab biosimilar for ${money(ACQ_PRICE_340B)}
        instead of ${money(ASP_PLUS_6)} — that's the deal we get for
        running the charity infusion clinic. The catch: we can't
        let the manufacturer pay BOTH the 340B discount AND a
        Medicaid rebate on the same dose. That's the
        ${term('duplicate discount')} rule."
      </p>
      <p>"Three issues:"</p>
      <ul>
        <li>Four statements about 340B
        rules. Watch the orphan-drug carve-out trap (covered-entity
        type matters), the GPO prohibition, the duplicate-discount
        rule.</li>
        <li>Four modifier options. Right
        answer: state Medicaid uses ${escape(STATE_MOD)}.
        ${term('JG modifier', 'JG')} is Medicare; ${term('TB')} is
        DME-context; no-modifier is the original bug.</li>
        <li>Five resolution paths.
        ${term('HRSA self-disclosure', 'Self-disclose')} +
        refile + refund the manufacturer is right. Decoys: skip
        disclosure (review is already open), abandon 340B (defeats
        the purpose), bill Medicare (fraud), recoup-and-rebill
        (use Frequency-7 instead).</li>
      </ul>
      <p>
        "HRSA strongly favors self-disclosure. The covered entities
        that get terminated are the ones who got caught hiding —
        not the ones who walked in and said \"we found this; we're
        fixing it.\""
      </p>
      <p class="briefing-sign">"Eligibility, then DOS, then policy. — D."</p>
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
        <span class="cs-tag">CLAIM · ${escape(PAYER)} · ICN 2026-04-22-114</span>
        <span class="cs-sub">${escape(FACILITY)}. ${escape(DRUG)} infusion.</span>
      </div>
      <table class="cs-table">
        <tr><th>Patient</th><td>${escape(PATIENT)} (Medicaid managed-care)</td></tr>
        <tr><th>Drug</th><td>${escape(DRUG)}</td></tr>
        <tr><th>340B acquisition price</th><td>${money(ACQ_PRICE_340B)} (purchased through 340B inventory)</td></tr>
        <tr><th>Medicaid paid (ASP+6%)</th><td>${money(ASP_PLUS_6)}</td></tr>
        <tr><th>Mercy net margin</th><td>${money(ASP_PLUS_6 - ACQ_PRICE_340B)} per dose (legitimate 340B savings)</td></tr>
        <tr><th>Modifier on claim</th><td><strong class="bad-text">none</strong> ← the bug</td></tr>
        <tr><th>Manufacturer rebate paid to state</th><td>${money(168)} (separate Medicaid rebate cycle)</td></tr>
        <tr><th>Status</th><td><strong class="bad-text">${term('duplicate discount')} flagged; HRSA compliance review opened</strong></td></tr>
      </table>
    </section>
  `
}

function renderQualifyPanel(): string {
  const done = state.resolvedIssues.has('qualify')
  return `
    <section class="qualify-panel ${done ? 'done' : ''}">
      <div class="qp-h">
        <span class="qp-tag">340B PROGRAM RULES · 4 statements</span>
        <span class="qp-sub">${done
          ? 'Walked the rules. Mercy qualifies; not all drugs are eligible; duplicate-discount prohibition applies; GPO prohibition applies.'
          : 'Mark each true/false. Watch the carve-out traps.'}</span>
      </div>
      <ul class="stmt-list">
        ${qualifyStatements.map(s => renderStmt(s)).join('')}
      </ul>
      ${state.transientFeedback && qualifyStatements.some(s => s.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('qualify') : ''}
    </section>
  `
}

function renderStmt(s: QualifyStatement): string {
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

function renderMarkPanel(): string {
  const unlocked = state.resolvedIssues.has('qualify')
  const done = state.resolvedIssues.has('mark')
  if (!unlocked) {
    return `<section class="mark-panel locked"><div class="mp-h"><span class="mp-tag idle">MARK MODIFIER</span><span class="mp-sub">Locked.</span></div></section>`
  }
  return `
    <section class="mark-panel ${done ? 'done' : 'active'}">
      <div class="mp-h">
        <span class="mp-tag ${done ? 'done' : 'active'}">MARK · pick the right modifier · 4 options</span>
        <span class="mp-sub">${done
          ? `Modifier ${escape(STATE_MOD)} for state Medicaid 340B. Carve-out fires; duplicate-discount avoided going forward.`
          : 'State Medicaid 340B identifier. JG is Medicare; TB is DME; no-modifier was the original bug.'}</span>
      </div>
      <ul class="opt-list">
        ${modifierOptions.map(m => renderModifier(m)).join('')}
      </ul>
      ${state.transientFeedback && modifierOptions.some(m => m.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('mark') : ''}
    </section>
  `
}

function renderModifier(m: ModifierOption): string {
  const applied = state.appliedModifierId === m.id
  const locked = state.appliedModifierId !== null && !applied
  return `
    <li class="opt ${applied ? 'applied' : ''}">
      <button class="opt-btn" data-action="apply-modifier" data-id="${m.id}" ${locked ? 'disabled' : ''}>
        <span class="opt-label">${escape(m.label)}</span>
        <span class="opt-detail">${escape(m.detail)}</span>
        ${applied ? '<span class="opt-badge">APPLIED</span>' : ''}
      </button>
    </li>
  `
}

function renderDisclosePanel(): string {
  const unlocked = state.resolvedIssues.has('qualify') && state.resolvedIssues.has('mark')
  const done = state.resolvedIssues.has('disclose')
  if (!unlocked) {
    return `<section class="disclose-panel locked"><div class="dp-h"><span class="dp-tag idle">DISCLOSE</span><span class="dp-sub">Locked.</span></div></section>`
  }
  return `
    <section class="disclose-panel ${done ? 'done' : 'active'}">
      <div class="dp-h">
        <span class="dp-tag ${done ? 'done' : 'active'}">DISCLOSE · resolution path · 5 options</span>
        <span class="dp-sub">${done
          ? 'Refile + refund manufacturer + HRSA self-disclosure. Remedial outcome.'
          : 'Self-disclosure during open review = remedial. Hiding makes review punitive.'}</span>
      </div>
      <ul class="opt-list">
        ${resolutions.map(r => renderResolution(r)).join('')}
      </ul>
      ${state.transientFeedback && resolutions.some(r => r.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('disclose') : ''}
    </section>
  `
}

function renderResolution(r: Resolution): string {
  const applied = state.appliedResolutionId === r.id
  return `
    <li class="opt ${applied ? 'applied' : ''}">
      <button class="opt-btn" data-action="apply-resolution" data-id="${r.id}" ${state.appliedResolutionId !== null && !applied ? 'disabled' : ''}>
        <span class="opt-label">${escape(r.label)}</span>
        <span class="opt-detail">${escape(r.detail)}</span>
        ${applied ? '<span class="opt-badge">APPLIED</span>' : ''}
      </button>
    </li>
  `
}

function renderRecap(issueId: string): string {
  const issue = issues.find(i => i.id === issueId)
  if (!issue) return ''
  return `<div class="recap"><div class="recap-h">RECAP</div><p>${escape(issue.recap)}</p></div>`
}

function renderChecklist(): string {
  const allDone = issues.every(i => state.resolvedIssues.has(i.id))
  return `
    <section class="checklist">
      <div class="checklist-h">340B COMPLIANCE · 3 issues to resolve</div>
      <ul>${issues.map(i => `<li class="${state.resolvedIssues.has(i.id) ? 'done' : ''}"><span class="check">${state.resolvedIssues.has(i.id) ? '✓' : '○'}</span><div class="issue-body"><div class="issue-label">${escape(i.label)}</div></div></li>`).join('')}</ul>
      ${state.failedAttempts > 0 ? `<p class="fail-counter">Wrong picks so far: ${state.failedAttempts}.</p>` : ''}
      <button class="btn submit ${allDone ? '' : 'disabled'}" data-action="submit" ${allDone ? '' : 'disabled'}>Refile, refund, self-disclose</button>
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

const RECAP: CaseRecap = CASE_RECAPS['three-forty-b-specter']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">DUPLICATE DISCOUNT REMEDIATED</div>
      <h2>Refile + manufacturer refund + HRSA self-disclosure filed.</h2>
      <p>
        Frequency-7 corrected claim with modifier ${escape(STATE_MOD)}
        on file. Manufacturer reimbursed for the duplicate rebate paid
        on the disputed dose. HRSA self-disclosure documenting the
        modifier-mapping bug + the corrective action plan submitted.
        Mercy's 340B status remains intact; the HRSA review concludes
        as remedial rather than punitive.
      </p>
      <p class="muted">
        ${term('340B')} is the program that lets safety-net hospitals
        afford to treat low-income patients with high-cost drugs. The
        program lives or dies on covered entities self-policing the
        rules — ${term('duplicate discount', 'duplicate-discount')}
        prohibitions, GPO prohibitions, eligible-patient definitions.
        HRSA enforces, but the lift is operational: get the modifier
        right; track the inventory carefully; self-disclose when
        something slips.
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
            <li><strong>Three actions:</strong> QUALIFY (340B program rules), MARK (state-specific Medicaid 340B modifier), DISCLOSE (HRSA self-disclosure mechanic).</li>
            <li><strong>Self-disclosure beats discovery.</strong> Covered entities that walk in and say "we found this; we're fixing it" get remediation. Ones that get caught hiding get terminated. The Case bottles that lesson.</li>
            <li><strong>State variation matters.</strong> Modifier UD is the most common state Medicaid 340B identifier, but states vary — some use a different code, some require a flag rather than a modifier. The Case uses UD as a representative example; in your environment, check the state contract.</li>
            <li><strong>Becerra v AHA matters historically.</strong> 2018-2022 Medicare 340B payment was reduced; SCOTUS reversed; remedy paid through 2023 OPPS final rule. Historical context for any current 340B-Medicare conversation.</li>
          </ul>
        </div>
        <div>
          <h3>Sibling shape</h3>
          <ul>
            <li>Cousin to <a href="./asp-wac-apothecary-prototype.html">ASP/WAC Apothecary</a> — both involve drug pricing complexity; that one is about Part B unit math, this one is about 340B duplicate-discount.</li>
            <li>Cousin to <a href="./hipaa-spider-prototype.html">HIPAA Spider</a> in the self-disclosure shape — both are compliance-program Cases where voluntary disclosure is the right answer.</li>
            <li>District: appeals (purple) — feels closest to compliance/audit work even though strictly speaking it's also billing.</li>
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
  const s = qualifyStatements.find(x => x.id === id); if (!s) return
  state.transientFeedback = null
  if (s.truth === pick) {
    state.stmtStates[id].pick = pick
    state.transientFeedback = { id, message: s.reason, kind: 'good' }
    if (isQualifyDone()) state.resolvedIssues.add('qualify')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: s.reason, kind: 'bad' }
  }
}

function resetStmt(id: string) {
  state.stmtStates[id].pick = null
  state.resolvedIssues.delete('qualify'); state.resolvedIssues.delete('mark'); state.resolvedIssues.delete('disclose')
  state.transientFeedback = null
}

function applyModifier(id: string) {
  const m = modifierOptions.find(x => x.id === id); if (!m) return
  state.transientFeedback = null
  if (m.correct) {
    state.appliedModifierId = id
    state.resolvedIssues.add('mark')
    state.transientFeedback = { id, message: m.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: m.feedback, kind: 'bad' }
  }
}

function applyResolution(id: string) {
  const r = resolutions.find(x => x.id === id); if (!r) return
  state.transientFeedback = null
  if (r.correct) {
    state.appliedResolutionId = id
    state.resolvedIssues.add('disclose')
    state.transientFeedback = { id, message: r.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: r.feedback, kind: 'bad' }
  }
}

function attemptSubmit() {
  if (issues.every(i => state.resolvedIssues.has(i.id))) {
    state.packetSubmitted = true
    notifyParentVictory('three-forty-b-specter')
  }
}

function reset() {
  state.briefingDone = false; state.briefingOpen = false
  for (const id in state.stmtStates) state.stmtStates[id] = { pick: null }
  state.appliedModifierId = null; state.appliedResolutionId = null
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
    case 'apply-modifier': if (el.dataset.id) applyModifier(el.dataset.id); break
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

const css = districtVars('appeals') + BASE_CSS + `
  .claim-summary { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .cs-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .cs-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .cs-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .cs-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .cs-table th, .cs-table td { text-align: left; padding: 6px 10px; border-bottom: 1px dashed #232a36; vertical-align: top; }
  .cs-table th { font-size: 11px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; width: 240px; }
  .bad-text { color: var(--bad); }

  .qualify-panel, .mark-panel, .disclose-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .qualify-panel.done, .mark-panel.done, .disclose-panel.done { border-left-color: var(--good); }
  .mark-panel.locked, .disclose-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .qp-h, .mp-h, .dp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .qp-tag, .mp-tag, .dp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .mp-tag.idle, .dp-tag.idle { color: var(--ink-dim); }
  .qp-tag.done, .mp-tag.done, .dp-tag.done { color: var(--good); }
  .qp-sub, .mp-sub, .dp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
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
