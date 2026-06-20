// Case Rate Specter @ L27 — pricing-methodology sibling to the Specter.
//
// Same district (billing). Same dragon (underpayment hidden behind a
// CO-45 contractual adjustment). Different teeth: the underpayment
// here isn't a stale fee table — it's a payer applying the case-rate
// inlier formula when the contract's outlier provision says they
// should be paying 75% of charges.
//
// Actions:
//   - COMPARE-CONTRACT — read the three contract clauses, identify
//     which applies. Two are decoys; one (the outlier provision) is
//     the lever.
//   - REPRICE — apply the formula. The math is the puzzle: 75% of
//     $42,000 charges = $31,500 expected. Paid $14,000. Shortfall
//     $17,500.
//   - APPEAL — same as Specter. Pick shortfall + reason; only one
//     combo is correct.
//
// Demonstrates: a pricing-methodology dispute reads as RCM-real.
// Hospital contracts routinely contain inlier/outlier hybrids,
// stoploss provisions, and per-diem fallbacks; the puzzle is which
// clause governs *this* stay, not which CARC applies.
//
// Author: May 2026. Modeled on src/specter-prototype/main.ts —
// share the dragon, swap the lever.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

// ===== Domain types =====

interface ContractClause {
  id: string
  /** Section heading the clause appears under in the contract PDF. */
  section: string
  /** Plain-English label shown on the toggle. */
  label: string
  /** Full clause text (paraphrased; no real Anthem language). */
  text: string
  /** True iff applying this clause to the encounter is the right move. */
  governs: boolean
  /** Feedback when the player toggles this clause to "applies". */
  feedbackApplies: string
  /** Feedback when the player toggles to "does not apply". */
  feedbackRejects: string
}

interface RepriceFormula {
  id: string
  label: string
  /** Formula expression for display. */
  expr: string
  /** What this formula evaluates to against the encounter. */
  amount: number
  correct: boolean
  feedback: string
}

interface AppealOption {
  shortfall: string
  reason: string
  correct: boolean
  feedback: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'compare' | 'reprice' | 'appeal'
}

interface GlossaryEntry {
  term: string
  plain: string
}

// ===== Encounter data =====

const PATIENT = 'Eleanor Park'
const DOS_ADMIT = '2026-03-04'
const DOS_DISCHARGE = '2026-03-13'
const DRG = '470'
const DRG_LABEL = 'Major joint replacement of lower extremity, no MCC/CC'
const LOS_DAYS = 9
const INLIER_THRESHOLD_DAYS = 5
const TOTAL_CHARGES = 42_000
const CASE_RATE = 14_000
const OUTLIER_PCT = 0.75
const PAYER_PAID = 14_000
const EXPECTED_PAID = TOTAL_CHARGES * OUTLIER_PCT // 31,500
const SHORTFALL = EXPECTED_PAID - PAYER_PAID      // 17,500

const issues: Issue[] = [
  {
    id: 'threshold',
    label: 'Confirm length of stay tripped the inlier threshold; outlier provision governs.',
    recap: `You walked the contract: 9 inpatient days against the 5-day inlier ceiling. The outlier provision (Section 3.2(b)) takes over once the threshold trips — payment converts from the flat case rate to 75% of total billed charges. Anthem applied the inlier rate anyway.`,
    verb: 'compare',
  },
  {
    id: 'reprice',
    label: 'Reprice the stay under the outlier formula.',
    recap: `Total charges $${TOTAL_CHARGES.toLocaleString()} × 0.75 = $${EXPECTED_PAID.toLocaleString()}. Paid $${PAYER_PAID.toLocaleString()}. Shortfall $${SHORTFALL.toLocaleString()}. The math is the appeal.`,
    verb: 'reprice',
  },
  {
    id: 'appeal',
    label: 'File the underpayment appeal with the right shortfall and reason.',
    recap: `Right amount, right reason. Anthem's adjudication engine paid the inlier rate without checking the LOS; once compliance walks the contract, they reprocess. You'll see the difference on the next 835.`,
    verb: 'appeal',
  },
]

// Three clauses in the player's contract pack. Two are decoys.
const clauses: ContractClause[] = [
  {
    id: 'inlier-rate',
    section: 'Section 3.2(a) — Inlier Case Rate',
    label: 'Standard case rate for DRG 470',
    text: `For an admission grouping to MS-DRG 470 (Major joint replacement, lower extremity, no major or minor comorbidity), Plan shall pay a flat case rate of $${CASE_RATE.toLocaleString()} per Inlier Stay. "Inlier Stay" means an inpatient stay of five (5) days or fewer, exclusive of the day of admission.`,
    governs: false,
    feedbackApplies: `This is the inlier rate. It governs only when the stay is ≤ 5 days. Eleanor's stay was 9. Re-read the LOS and check 3.2(b).`,
    feedbackRejects: `Right call to set this aside — it only applies inside the 5-day window. The outlier provision is what governs once you cross the threshold.`,
  },
  {
    id: 'outlier-provision',
    section: 'Section 3.2(b) — Outlier Provision',
    label: 'Outlier provision once LOS exceeds the inlier ceiling',
    text: `When a covered stay exceeds the Inlier Stay length defined in 3.2(a), the case rate of 3.2(a) shall not apply. In its place, Plan shall pay seventy-five percent (75%) of the Provider's total billed charges for the entire stay. This payment basis governs notwithstanding any per-diem schedule elsewhere in the agreement.`,
    governs: true,
    feedbackApplies: `Yes. LOS = ${LOS_DAYS} days, inlier ceiling = ${INLIER_THRESHOLD_DAYS} days. Threshold tripped, outlier formula governs. Now reprice.`,
    feedbackRejects: `This is the lever. The stay tripped the threshold; this clause is exactly the one that re-bases payment to 75% of charges. Look again.`,
  },
  {
    id: 'stoploss',
    section: 'Section 3.7 — Stoploss',
    label: 'High-cost stoploss kicks in over 4× the case rate',
    text: `Where total billed charges exceed four (4) times the applicable case rate, Plan shall pay sixty-five percent (65%) of total billed charges. Stoploss is mutually exclusive with all other reimbursement bases in this Article.`,
    governs: false,
    feedbackApplies: `Stoploss is real but the trigger is 4× case rate = $${(4 * CASE_RATE).toLocaleString()}. Charges here are $${TOTAL_CHARGES.toLocaleString()} — under the trigger. Wrong clause.`,
    feedbackRejects: `Right — stoploss doesn't trip at this charge level. The outlier provision in 3.2(b) is what governs.`,
  },
]

// Reprice formulas — player picks one to apply to the stay.
const repriceFormulas: RepriceFormula[] = [
  {
    id: 'inlier-flat',
    label: 'Flat case rate (3.2(a))',
    expr: `$${CASE_RATE.toLocaleString()}`,
    amount: CASE_RATE,
    correct: false,
    feedback: `That's what Anthem paid. Applying it again gets you the same answer. The threshold tripped — you should be in 3.2(b).`,
  },
  {
    id: 'outlier-pct',
    label: '75% of total charges (3.2(b))',
    expr: `$${TOTAL_CHARGES.toLocaleString()} × 0.75`,
    amount: EXPECTED_PAID,
    correct: true,
    feedback: `$${EXPECTED_PAID.toLocaleString()} expected. Paid $${PAYER_PAID.toLocaleString()}. Shortfall $${SHORTFALL.toLocaleString()}.`,
  },
  {
    id: 'stoploss',
    label: '65% of total charges (3.7 stoploss)',
    expr: `$${TOTAL_CHARGES.toLocaleString()} × 0.65`,
    amount: TOTAL_CHARGES * 0.65,
    correct: false,
    feedback: `Stoploss math, but stoploss didn't trip ($${TOTAL_CHARGES.toLocaleString()} < 4× $${CASE_RATE.toLocaleString()} = $${(4 * CASE_RATE).toLocaleString()}). Wrong formula.`,
  },
  {
    id: 'percent-of-charge-full',
    label: '100% of total charges',
    expr: `$${TOTAL_CHARGES.toLocaleString()}`,
    amount: TOTAL_CHARGES,
    correct: false,
    feedback: `Asking for full billed is asking the contract to pay charges. Outlier provision is 75% of charges, not 100%.`,
  },
]

// Appeal modal — pick (a) shortfall and (b) reason. Only one is right.
const appealOptions: AppealOption[] = [
  {
    shortfall: `$${SHORTFALL.toLocaleString()}`,
    reason: 'LOS exceeded 5-day inlier ceiling; outlier provision (3.2(b)) sets payment at 75% of charges',
    correct: true,
    feedback: `Right shortfall, right citation. The compliance team will walk the contract section, confirm the LOS-trip, and Anthem reprocesses on the next 835. Recoupment posts the next cycle.`,
  },
  {
    shortfall: `$${TOTAL_CHARGES.toLocaleString()}`,
    reason: 'Anthem should have paid full billed charges',
    correct: false,
    feedback: `That's billed, not contracted. Outlier pays 75% of charges, not 100%. Filing for full billed gets the appeal denied for asking outside the contract.`,
  },
  {
    shortfall: `$${SHORTFALL.toLocaleString()}`,
    reason: 'Medical necessity for the extended stay was not adjudicated',
    correct: false,
    feedback: `Right amount, wrong queue. Med-nec arguments route to clinical review and stall for 30+ days. The shortfall here is *contractual*, not clinical.`,
  },
  {
    shortfall: `$${(EXPECTED_PAID).toLocaleString()}`,
    reason: 'LOS exceeded 5-day inlier ceiling; outlier provision (3.2(b)) sets payment at 75% of charges',
    correct: false,
    feedback: `That's the expected total — the right *outcome*, not the right *shortfall*. Shortfall = expected − paid = $${EXPECTED_PAID.toLocaleString()} − $${PAYER_PAID.toLocaleString()} = $${SHORTFALL.toLocaleString()}.`,
  },
  {
    shortfall: `$${(TOTAL_CHARGES * 0.65 - PAYER_PAID).toLocaleString()}`,
    reason: 'Stoploss provision (3.7) at 65% of charges should have applied',
    correct: false,
    feedback: `Stoploss is the wrong clause — it only trips above 4× case rate. Charges here ($${TOTAL_CHARGES.toLocaleString()}) are under the trigger. Filing the wrong clause earns a contractual-review denial.`,
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'DRG': {
    term: 'DRG (Diagnosis-Related Group)',
    plain: "How Medicare and most large commercial payers price an inpatient stay. The hospital codes the principal diagnosis, secondary diagnoses (comorbidities/complications), and procedures; a grouper assigns one DRG to the whole stay; the contract pays a fixed dollar amount per DRG (modulated by hospital weight). DRG 470 is one of the highest-volume inpatient DRGs nationwide — uncomplicated joint replacement.",
  },
  'case rate': {
    term: 'Case rate',
    plain: "Fixed dollar amount the payer agrees to pay for a given stay, regardless of length or services. Spreads risk: the hospital wins on short stays, payer wins on long ones. Most contracts pair a case rate with an outlier provision so that catastrophically long stays don't bankrupt the hospital.",
  },
  'outlier provision': {
    term: 'Outlier provision',
    plain: "The escape clause inside a case-rate contract. Once the stay exceeds an agreed length-of-stay or charge threshold, payment converts from the flat case rate to a percentage of total charges (or per-diem, or stoploss). The number itself doesn't matter — what matters is which formula governs. NOTE: this Case uses a pure LENGTH-OF-STAY trigger, which is one common shape but not the only one. Medicare's DRG outlier system, for contrast, is COST-OUTLIER based (charges × cost-to-charge ratio compared to a fixed-loss threshold). Most commercial outlier provisions are charge-threshold based (stoploss, see Stoploss Reckoner) or LOS-based; pure-LOS is a teaching simplification — the actual contract clause shape varies.",
  },
  'LOS outlier vs cost outlier': {
    term: 'LOS outlier vs cost outlier vs stoploss',
    plain: "Three flavors of escape clause: LOS outlier (stay length crosses inlier ceiling — this Case), cost outlier (charges × CCR exceeds fixed-loss threshold — Medicare DRG outlier), stoploss (charges exceed multiple of case rate — see Stoploss Reckoner). All three replace the case rate when triggered; each has a different trigger metric and a different post-trigger formula. Real contracts often have all three, applied in priority order. Reading the contract clause carefully matters; misciting the wrong outlier type even with right math gets the appeal denied.",
  },
  '835': {
    term: '835 (electronic remittance advice)',
    plain: "The X12 EDI transaction the payer sends back after adjudicating a claim. Carries the verdict per claim: how much paid, how much adjusted (contractual write-off), how much patient responsibility, plus CARCs/RARCs per line. The 835 is the legal document of payment.",
  },
  'CO-45': {
    term: 'CO-45 (charge exceeds fee schedule)',
    plain: "The most common CARC on commercial 835s. Says: 'we paid the contracted amount; the rest is a contractual write-off.' Looks innocuous. When the *contracted* amount is wrong — because the payer applied the wrong pricing formula — CO-45 quietly absorbs the variance. This is exactly where Specter and Case Rate Specter both hide.",
  },
  'underpayment': {
    term: 'Underpayment',
    plain: "When the payer paid less than the contract requires. Distinct from a denial — underpayments look like successful payments. AR analysts spend a huge chunk of their time hunting these. Industry estimates put the loss at 1-3% of net revenue for hospitals that don't actively chase variance.",
  },
  'AR analyst': {
    term: 'AR analyst (accounts receivable)',
    plain: "Provider-side staff who work unpaid and underpaid claims. Run aging buckets, prioritize the high-variance items, file appeals. The Specter family is what they hunt — Anthem paid 'something,' but not the right something.",
  },
  'inlier stay': {
    term: 'Inlier stay',
    plain: "A stay that fits within the contract's standard length-of-stay window for its DRG. Inlier stays get the flat case rate. Once a stay goes long enough to be 'outlier,' the contract's escape clause takes over.",
  },
  'LOS': {
    term: 'LOS (length of stay)',
    plain: "Days from admission to discharge. Counted differently across contracts — some include the admission day, some exclude it; some count midnights, some count calendar days. The contract definition wins. In this encounter, LOS is calculated exclusive of the admission day, per Section 3.2(a).",
  },
}

// ===== Runtime state =====

const state = {
  briefingDone: false,
  briefingOpen: false,
  /** id of the clause whose body is expanded; null if none. */
  openClauseId: null as string | null,
  /** clauses the player has affirmed as governing. */
  appliedClauseIds: new Set<string>(),
  /** clauses the player has affirmed as NOT governing. */
  rejectedClauseIds: new Set<string>(),
  /** id of the formula the player has applied. */
  appliedFormulaId: null as string | null,
  /** transient feedback for a wrong clause/formula click. */
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  appealOpen: false,
  appealSelectedIdx: null as number | null,
  appealFeedback: null as { idx: number; message: string } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  feedback: '' as string,
  feedbackKind: 'neutral' as 'neutral' | 'good' | 'bad',
  packetSubmitted: false,
  openTermId: null as string | null,
}

// ===== Render helpers =====

function term(termId: string, displayText?: string): string {
  const entry = glossary[termId]
  const text = displayText ?? termId
  if (!entry) return escape(text)
  return `<span class="term" data-action="open-term" data-term="${termId}" title="${escape(entry.plain)}">${escape(text)}<span class="term-icon">?</span></span>`
}

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString()
}

function render(): string {
  if (state.packetSubmitted) {
    return renderHeader() + renderVictory() + renderTermPopover() + renderBriefingPopover() + renderAppealModal()
  }
  return `
    ${renderHeader()}
    ${renderHospitalIntro()}
    ${!state.briefingDone ? renderBriefingInline() : `
      ${renderClaimSummary()}
      ${renderContractPanel()}
      ${renderRepricePanel()}
      ${renderAppealLauncher()}
      ${renderChecklist()}
    `}
    ${state.briefingDone ? '' : renderDesignNotes()}
    ${renderTermPopover()}
    ${renderBriefingPopover()}
    ${renderAppealModal()}
  `
}

function renderHeader(): string {
  const recallBtn = state.briefingDone
    ? `<button class="recall-btn" data-action="show-briefing">📜 Dana's note</button>`
    : ''
  return `
    <header class="page-h">
      <div class="title-row">
        <h1>Case Rate Specter <span class="muted">@ L27 — pricing-methodology sibling</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./prototypes.html">← back to catalog</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          A pricing-methodology sibling to the ${term('underpayment', 'Specter')}.
          Anthem's ${term('835')} posted a clean payment on a knee replacement
          — flat ${term('case rate')}, ${term('CO-45')} swallowing the rest.
          Looks paid. Isn't. The patient stayed nine days; the contract's
          ${term('outlier provision')} flipped payment to 75% of charges
          on day six. The puzzle is which clause governs, not which CARC
          applies. See the <a href="#design-notes">design notes</a>.
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
        Bola, the ${term('AR analyst')}, drops the chart and the ${term('835')}
        on your desk. "Eleanor Park, ${term('DRG')} 470 ${escape('— knee replacement.')}
        Charges $${TOTAL_CHARGES.toLocaleString()}. Anthem paid $${PAYER_PAID.toLocaleString()}.
        ${term('CO-45')} on the rest. Looks fine."
      </p>
      <p>
        "But she stayed ${LOS_DAYS} days. The contract's
        ${term('outlier provision')} is supposed to trip past five.
        Either Anthem's adjudicator missed it or the contract reads
        differently than I think it does. Walk me through which one."
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The contract clauses on
        Bola's printout slide a half-pixel left, then settle. You're
        somewhere else. The clauses are now toggleable. The math is
        on a card you can drag.</em>
      </div>
      <div class="register waiting-room">WAITING ROOM · now</div>
    </section>
  `
}

function renderBriefingInline(): string {
  return `
    <section class="briefing">
      ${briefingContent()}
      <button class="btn primary" data-action="dismiss-briefing">
        Got it — start the encounter
      </button>
    </section>
  `
}

function briefingContent(): string {
  return `
    <div class="briefing-h">
      <span class="briefing-tag">DANA, IN YOUR EAR</span>
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'Cousin to the Specter — different lever.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "Same dragon as the Specter — payer paid 'something,' hid
        the variance behind ${term('CO-45')}, walked away. Different
        lever. Last time it was a stale fee table. This time it's
        a ${term('case rate')} contract with an
        ${term('outlier provision')} that should have tripped."
      </p>
      <p>
        "Three issues:"
      </p>
      <ul>
        <li>
          Read the contract pack.
          Three clauses. Two are decoys. Mark the one that governs
          this stay.
        </li>
        <li>
          Apply the formula. The math is
          the appeal — payer paid as if she were inlier; she isn't.
          The number you compute is the number you ask for.
        </li>
        <li>
          File with the right shortfall and
          the right reason. Wrong shortfall gets the appeal denied.
          Wrong reason gets it routed to clinical review and lost
          for a month."
        </li>
      </ul>
      <p>
        "${term('LOS')} = ${LOS_DAYS} days. Inlier ceiling = ${INLIER_THRESHOLD_DAYS}.
        Charges = $${TOTAL_CHARGES.toLocaleString()}. Don't trust me; trust
        the contract."
      </p>
      <p class="briefing-sign">"LOS is the lever. — D."</p>
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
        <span class="cs-tag">CLAIM · Anthem PPO · ICN 2026-03-15-441</span>
        <span class="cs-sub">One stay, one ${term('835')} line. The variance hides in pricing methodology, not coding.</span>
      </div>
      <table class="cs-table">
        <tr><th>Patient</th><td>${escape(PATIENT)}</td></tr>
        <tr><th>${term('DRG')}</th><td><code>${DRG}</code> · ${escape(DRG_LABEL)}</td></tr>
        <tr><th>Admit / discharge</th><td>${DOS_ADMIT} → ${DOS_DISCHARGE}</td></tr>
        <tr><th>${term('LOS')}</th><td><strong class="los-value">${LOS_DAYS} inpatient days</strong> <span class="cs-hint">(exclusive of admission day per Section 3.2(a))</span></td></tr>
        <tr><th>Total charges</th><td class="right-cell">${money(TOTAL_CHARGES)}</td></tr>
        <tr><th>Anthem paid (835)</th><td class="right-cell">${money(PAYER_PAID)} <span class="cs-tag-mini">${term('CO-45')} ${money(TOTAL_CHARGES - PAYER_PAID)} adjusted</span></td></tr>
      </table>
    </section>
  `
}

function renderContractPanel(): string {
  const issueDone = state.resolvedIssues.has('threshold')
  return `
    <section class="contract-panel ${issueDone ? 'done' : ''}">
      <div class="cp-h">
        <span class="cp-tag">CONTRACT PACK · Anthem 2026-A · Article 3 · Inpatient Pricing</span>
        <span class="cp-sub">${issueDone
          ? 'Threshold trip confirmed. Outlier provision (3.2(b)) governs this stay.'
          : 'Three clauses. Click each to read. Apply the one that governs this stay; reject the ones that do not.'}</span>
      </div>
      <ul class="clause-list">
        ${clauses.map(c => renderClause(c)).join('')}
      </ul>
      ${state.transientFeedback && clauses.some(c => c.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${issueDone ? renderRecap('threshold') : ''}
    </section>
  `
}

function renderClause(c: ContractClause): string {
  const open = state.openClauseId === c.id
  const applied = state.appliedClauseIds.has(c.id)
  const rejected = state.rejectedClauseIds.has(c.id)
  const decided = applied || rejected
  return `
    <li class="clause ${open ? 'open' : ''} ${applied ? 'applied' : ''} ${rejected ? 'rejected' : ''}">
      <button class="clause-toggle" data-action="toggle-clause" data-id="${c.id}">
        <span class="clause-section">${escape(c.section)}</span>
        <span class="clause-label">${escape(c.label)}</span>
        ${applied ? '<span class="clause-badge applied">GOVERNS</span>' : ''}
        ${rejected ? '<span class="clause-badge rejected">decoy</span>' : ''}
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

function renderRepricePanel(): string {
  const unlocked = state.resolvedIssues.has('threshold')
  const issueDone = state.resolvedIssues.has('reprice')
  if (!unlocked) {
    return `
      <section class="reprice-panel locked">
        <div class="rp-h">
          <span class="rp-tag idle">REPRICE WORKBENCH</span>
          <span class="rp-sub">Locked until the threshold-trip clause is applied. Pick the clause that governs in the contract pack first.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="reprice-panel ${issueDone ? 'done' : 'active'}">
      <div class="rp-h">
        <span class="rp-tag ${issueDone ? 'done' : 'active'}">REPRICE WORKBENCH</span>
        <span class="rp-sub">${issueDone
          ? `Repriced. Expected ${money(EXPECTED_PAID)}. Paid ${money(PAYER_PAID)}. Shortfall ${money(SHORTFALL)}.`
          : 'Pick the formula the governing clause sets out. The math is the appeal — wrong formula, wrong shortfall, denied appeal.'}</span>
      </div>
      <div class="rp-inputs">
        <div class="rp-input"><span class="rp-label">Total charges</span><span class="rp-value">${money(TOTAL_CHARGES)}</span></div>
        <div class="rp-input"><span class="rp-label">${term('LOS')}</span><span class="rp-value">${LOS_DAYS} days</span></div>
        <div class="rp-input"><span class="rp-label">Inlier ceiling</span><span class="rp-value">${INLIER_THRESHOLD_DAYS} days</span></div>
        <div class="rp-input"><span class="rp-label">Anthem paid</span><span class="rp-value">${money(PAYER_PAID)}</span></div>
      </div>
      <ul class="formula-list">
        ${repriceFormulas.map(f => renderFormula(f)).join('')}
      </ul>
      ${state.transientFeedback && repriceFormulas.some(f => f.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${issueDone ? renderRecap('reprice') : ''}
    </section>
  `
}

function renderFormula(f: RepriceFormula): string {
  const applied = state.appliedFormulaId === f.id
  const rejected = state.appliedFormulaId !== null && !applied
  return `
    <li class="formula ${applied ? 'applied' : ''} ${rejected ? 'rejected' : ''}">
      <button class="formula-btn" data-action="apply-formula" data-id="${f.id}" ${state.appliedFormulaId !== null ? 'disabled' : ''}>
        <span class="formula-label">${escape(f.label)}</span>
        <span class="formula-expr">${escape(f.expr)} = ${money(f.amount)}</span>
        ${applied ? '<span class="formula-badge applied">applied</span>' : ''}
      </button>
    </li>
  `
}

function renderAppealLauncher(): string {
  const ready = state.resolvedIssues.has('threshold') && state.resolvedIssues.has('reprice')
  const done = state.resolvedIssues.has('appeal')
  const cls = !ready ? 'idle' : (done ? 'done' : 'active')
  return `
    <section class="appeal-launcher ${cls}">
      <div class="al-h">
        <span class="al-tag">${done ? 'APPEAL FILED' : 'APPEAL · WAITING ON YOU'}</span>
        <span class="al-sub">${done
          ? `Filed ${money(SHORTFALL)} short on the right reason.`
          : !ready
            ? 'Locked until the threshold trip is confirmed and the stay is repriced.'
            : 'Pick the right shortfall and the right reason. One combo only.'}</span>
      </div>
      <div class="al-body">
        ${done
          ? renderRecap('appeal')
          : `<button class="btn primary" data-action="open-appeal" ${ready ? '' : 'disabled'}>Open appeal form</button>`}
      </div>
    </section>
  `
}

function renderAppealModal(): string {
  if (!state.appealOpen) return ''
  return `
    <div class="amend-modal-backdrop">
      <div class="amend-modal">
        <button class="amend-modal-close" data-action="close-appeal" aria-label="Close">×</button>
        <div class="amend-modal-h">
          <span class="amend-tag">FILE UNDERPAYMENT APPEAL</span>
          <span class="amend-sub">${escape(PATIENT)} · DRG ${DRG} · ICN 2026-03-15-441</span>
        </div>
        <div class="amend-context">
          <strong>Anthem paid ${money(PAYER_PAID)}</strong> against expected ${money(EXPECTED_PAID)}
          (75% of ${money(TOTAL_CHARGES)} charges per Section 3.2(b) outlier provision).
          Pick the shortfall + reason combo that matches the contract.
        </div>
        <ul class="amend-options">
          ${appealOptions.map((o, i) => renderAppealOption(o, i)).join('')}
        </ul>
        <p class="amend-hint-text">Wrong shortfall = denied appeal. Wrong reason = routed to the wrong queue and lost for a month. Read the line carefully.</p>
      </div>
    </div>
  `
}

function renderAppealOption(o: AppealOption, idx: number): string {
  const fb = state.appealFeedback
  const showFb = fb && fb.idx === idx
  return `
    <li class="amend-option ${showFb ? 'rejected' : ''}" data-action="pick-appeal" data-idx="${idx}">
      <div class="amend-option-h">
        <span class="appeal-shortfall"><code>${escape(o.shortfall)}</code></span>
        <span class="appeal-reason">${escape(o.reason)}</span>
      </div>
      ${showFb ? `<div class="amend-option-fb">${escape(fb!.message)}</div>` : ''}
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
      <div class="checklist-h">DEFENSE PACKET · 3 issues to resolve</div>
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
        Submit corrected expected · ${money(SHORTFALL)} shortfall
      </button>
      ${state.feedback ? `<div class="feedback fb-${state.feedbackKind}">${escape(state.feedback)}</div>` : ''}
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

const RECAP: CaseRecap = CASE_RECAPS['case-rate-specter']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">CASE FILED</div>
      <h2>Underpayment appeal posted: ${money(SHORTFALL)}</h2>
      <p>
        Anthem's compliance desk picked up the appeal, walked Section 3.2(b),
        confirmed the LOS-trip, and reprocessed. The next 835 carries the
        ${money(SHORTFALL)} recoupment. Bola will see it on the variance
        report tomorrow morning.
      </p>
      <p class="muted">
        The Specter family is one dragon with several teeth. This one
        was the contract's outlier provision. The next will be a
        stoploss, or a per-diem fallback, or an implant carve-out —
        same shape, different clause.
      </p>
      <div class="register hospital">HOSPITAL · later that morning</div>
      <p>
        Bola flips the corrected 835 onto the stack and exhales. "I'd
        have just written it off as CO-45. Glad you walked it." She
        slides you the next case. "Stoploss this time. Different
        contract, same trick."
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
            <li><strong>Two new actions:</strong> comparing contracts and repricing.
            Both unlock with the third (appeal, shared with Specter).</li>
            <li><strong>The lever is the clause, not the code.</strong> No
            CARC argument here. ${term('CO-45')} stays on the line; the
            fight is over which contract section governs the stay.</li>
            <li><strong>The math is the appeal.</strong> Player computes
            the shortfall against a real formula; the number they compute
            is the number they file.</li>
            <li><strong>Decoys matter.</strong> Two of the three contract
            clauses look applicable — the inlier rate (which payer applied)
            and the stoploss (high-cost claim). Only one governs.</li>
          </ul>
        </div>
        <div>
          <h3>Sibling shape</h3>
          <ul>
            <li>Sibling to <a href="./specter-prototype.html">Specter</a>
            (same dragon — underpayment behind ${term('CO-45')} —
            different lever).</li>
            <li>Builds toward Stoploss Reckoner (4× threshold trip,
            65% of charges) and OB Per-Diem Specter (case rate +
            per-diem hybrid).</li>
            <li>The contract reader pattern (toggleable clauses with
            apply/reject) is reusable for Carve-out Phantom and Implant
            Carve-out Specter.</li>
          </ul>
        </div>
      </div>
      <p class="notes-cta">
        See the <a href="./prototypes.html">Case Prototypes catalog</a>
        for the full set.
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
function openAppeal() { state.appealOpen = true; state.appealFeedback = null }
function closeAppeal() { state.appealOpen = false; state.appealFeedback = null }

function toggleClause(id: string) {
  state.openClauseId = state.openClauseId === id ? null : id
  state.transientFeedback = null
}

function applyClause(id: string) {
  const c = clauses.find(x => x.id === id)
  if (!c) return
  state.transientFeedback = null
  if (c.governs) {
    state.appliedClauseIds.add(id)
    state.resolvedIssues.add('threshold')
    state.transientFeedback = { id, message: c.feedbackApplies, kind: 'good' }
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
    state.rejectedClauseIds.add(id)
    state.transientFeedback = { id, message: c.feedbackRejects, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: c.feedbackRejects, kind: 'bad' }
  }
}

function applyFormula(id: string) {
  const f = repriceFormulas.find(x => x.id === id)
  if (!f) return
  state.transientFeedback = null
  if (f.correct) {
    state.appliedFormulaId = id
    state.resolvedIssues.add('reprice')
    state.transientFeedback = { id, message: f.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: f.feedback, kind: 'bad' }
  }
}

function pickAppeal(idx: number) {
  const o = appealOptions[idx]
  if (!o) return
  state.appealFeedback = { idx, message: o.feedback }
  if (o.correct) {
    state.appealSelectedIdx = idx
    state.resolvedIssues.add('appeal')
    state.appealOpen = false
    state.appealFeedback = null
  } else {
    state.failedAttempts++
  }
}

function attemptSubmit() {
  if (issues.every(i => state.resolvedIssues.has(i.id))) {
    state.packetSubmitted = true
    notifyParentVictory('case-rate-specter')
    state.feedback = ''
  }
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  state.openClauseId = null
  state.appliedClauseIds = new Set()
  state.rejectedClauseIds = new Set()
  state.appliedFormulaId = null
  state.transientFeedback = null
  state.appealOpen = false
  state.appealSelectedIdx = null
  state.appealFeedback = null
  state.resolvedIssues = new Set()
  state.failedAttempts = 0
  state.feedback = ''
  state.feedbackKind = 'neutral'
  state.packetSubmitted = false
  state.openTermId = null
}

function handleClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.classList.contains('briefing-popover-backdrop')) {
    closeBriefing(); rerender(); return
  }
  if (target.classList.contains('term-popover-backdrop')) {
    closeTerm(); rerender(); return
  }
  if (target.classList.contains('amend-modal-backdrop')) {
    closeAppeal(); rerender(); return
  }
  const el = target.closest('[data-action]') as HTMLElement | null
  if (!el) return
  const action = el.dataset.action
  switch (action) {
    case 'toggle-clause': if (el.dataset.id) toggleClause(el.dataset.id); break
    case 'apply-clause':  if (el.dataset.id) applyClause(el.dataset.id);  break
    case 'reject-clause': if (el.dataset.id) rejectClause(el.dataset.id); break
    case 'apply-formula': if (el.dataset.id) applyFormula(el.dataset.id); break
    case 'open-appeal':   openAppeal();   break
    case 'close-appeal':  closeAppeal();  break
    case 'pick-appeal':   if (el.dataset.idx) pickAppeal(parseInt(el.dataset.idx, 10)); break
    case 'submit':        attemptSubmit(); break
    case 'reset':         reset(); break
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
  /* Claim summary */
  .claim-summary { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .cs-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .cs-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .cs-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .cs-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .cs-table th, .cs-table td { text-align: left; padding: 6px 10px; border-bottom: 1px dashed #232a36; vertical-align: top; }
  .cs-table th { font-size: 11px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; width: 180px; }
  .cs-table .right-cell { text-align: right; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .los-value { color: var(--bad); }
  .cs-hint { color: var(--ink-dim); font-size: 11.5px; font-style: italic; }
  .cs-tag-mini { font-size: 11px; color: var(--ink-dim); margin-left: 8px; }

  /* Contract panel */
  .contract-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent-2); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .contract-panel.done { border-left-color: var(--good); }
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
  .clause-body { padding: 0 14px 12px 14px; border-top: 1px dashed #2a3142; margin-top: 0; }
  .clause-text { margin: 12px 0 12px; font-size: 13px; line-height: 1.6; color: var(--ink); }
  .clause-actions { display: flex; gap: 10px; }
  .btn.small { padding: 4px 12px; font-size: 11.5px; }

  /* Reprice panel */
  .reprice-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent-2); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .reprice-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .reprice-panel.done   { border-left-color: var(--good); }
  .rp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .rp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .rp-tag.idle { color: var(--ink-dim); }
  .rp-tag.active { color: var(--accent-2); }
  .rp-tag.done { color: var(--good); }
  .rp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .rp-inputs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 12px; }
  @media (max-width: 720px) { .rp-inputs { grid-template-columns: repeat(2, 1fr); } }
  .rp-input { background: var(--panel-2); padding: 8px 10px; border-radius: 4px; display: flex; flex-direction: column; gap: 2px; }
  .rp-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-dim); }
  .rp-value { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 14px; color: var(--ink); }
  .formula-list { list-style: none; padding-left: 0; margin: 0; }
  .formula { margin-bottom: 6px; }
  .formula-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 10px 14px; text-align: left; display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; font: inherit; transition: all 0.15s; }
  .formula-btn:hover:not(:disabled) { background: #232b3a; border-color: var(--accent-2); }
  .formula-btn:disabled { cursor: default; opacity: 0.45; }
  .formula.applied .formula-btn { border-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); opacity: 1; }
  .formula-label { flex: 1; font-size: 13px; }
  .formula-expr { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 12.5px; color: var(--ink-dim); }
  .formula-badge { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; padding: 2px 8px; border-radius: 3px; background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; }

  /* Appeal launcher (mirrors Specter). */
  .appeal-launcher { background: var(--panel); border: 1px solid #232a36; border-left-width: 4px; border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .appeal-launcher.idle   { border-left-color: #2a3142; opacity: 0.6; }
  .appeal-launcher.active { border-left-color: var(--accent-2); }
  .appeal-launcher.done   { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126, 226, 193, 0.04), transparent); }
  .al-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
  .al-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .appeal-launcher.idle   .al-tag { color: var(--ink-dim); }
  .appeal-launcher.active .al-tag { color: var(--accent-2); }
  .appeal-launcher.done   .al-tag { color: var(--good); }
  .al-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }

  /* Wider amend modal for two-axis appeal picks (shortfall × reason). */
  .amend-modal { max-width: 760px; }
  .amend-option-h { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
  .appeal-shortfall { font-size: 14px; }
  .appeal-shortfall code { font-weight: 700; color: var(--ink); letter-spacing: 0.04em; }
  .appeal-reason { font-size: 12.5px; color: var(--ink); flex: 1; }

  /* Recap uses good-color since we're in success-feedback land. */
  .recap { background: rgba(126, 226, 193, 0.06); border-color: #2c5547; }
  .recap-h { color: var(--good); }
`

// ===== Mount =====

function rerender() {
  const root = document.getElementById('prototype-root')
  if (root) root.innerHTML = render()
}

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
      if (state.appealOpen) { closeAppeal(); changed = true }
      if (changed) rerender()
    }
  })
}

mount()
