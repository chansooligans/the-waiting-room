// Stoploss Reckoner @ L4 — math-heavy stoploss-provision Case (re-leveled from L7).
// Sibling to Case Rate Specter and Implant Carve-out Specter (same
// Anthem contract; different threshold-trip clause). The player
// computes the trip, the new payment basis, and the shortfall.
//
// Actions:
//   - TRIP: verify the stoploss provision triggered (threshold:
//     charges > 4× case rate). 4 statements true/false.
//   - RECALCULATE: apply 65%-of-charges formula. Decoys are
//     adjacent percent-of-charge formulas from other contracts.
//   - APPEAL: file with the right shortfall + reason.
//
// Demonstrates: real arithmetic against the sheet. The number the
// player computes IS the number they file.
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

// ===== Domain types =====

interface TripStatement {
  id: string
  text: string
  truth: boolean
  reason: string
}

interface FormulaOption {
  id: string
  label: string
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
  verb: 'trip' | 'recalculate' | 'appeal'
}

interface GlossaryEntry {
  term: string
  plain: string
}

// ===== Encounter data =====

const PATIENT = 'Lucia Romero'
const DRG = '871'
const DRG_LABEL = 'Septicemia or severe sepsis with MV ≥96 hrs, no MCC'
const ADMIT = '2026-03-18'
const DISCHARGE = '2026-04-09' // 22-day ICU stay
const CASE_RATE = 48_000
const TOTAL_CHARGES = 312_000
const STOPLOSS_MULTIPLIER = 4
const STOPLOSS_THRESHOLD = CASE_RATE * STOPLOSS_MULTIPLIER // 192,000
const STOPLOSS_PCT = 0.65
const EXPECTED = TOTAL_CHARGES * STOPLOSS_PCT // 202,800
const PAID = CASE_RATE
const SHORTFALL = EXPECTED - PAID // 154,800

const tripStatements: TripStatement[] = [
  {
    id: 's1',
    text: `Total billed charges (${money(TOTAL_CHARGES)}) exceed the stoploss threshold of ${STOPLOSS_MULTIPLIER}× case rate (${money(STOPLOSS_THRESHOLD)}).`,
    truth: true,
    reason: `${money(TOTAL_CHARGES)} > ${money(STOPLOSS_THRESHOLD)}. The threshold is tripped — payment converts from the flat case rate to ${STOPLOSS_PCT * 100}% of charges. The math is settled before the contract is read; the contract just confirms it.`,
  },
  {
    id: 's2',
    text: `The case rate (${money(CASE_RATE)}) and the stoploss provision can both apply to the same stay.`,
    truth: false,
    reason: 'They\'re mutually exclusive. The contract specifies that once stoploss trips, it *replaces* the case rate as the payment basis — Lucia doesn\'t get $48k case rate plus 65% of charges; she gets 65% of charges, full stop. Common contract-reading mistake.',
  },
  {
    id: 's3',
    text: `Length of stay (22 days) is what triggers the stoploss provision.`,
    truth: false,
    reason: 'Some contracts use LOS triggers (Case Rate Specter\'s outlier provision is one); the stoploss here is charge-based, not day-based. A 4-day ICU stay with $200k of charges would also trip it; a 30-day stay with $50k of charges wouldn\'t.',
  },
  {
    id: 's4',
    text: `The stoploss formula here pays Mercy 65% of total billed charges — which works out to ${money(EXPECTED)}.`,
    truth: true,
    reason: `${money(TOTAL_CHARGES)} × 0.65 = ${money(EXPECTED)}. Anthem paid ${money(PAID)} on the case rate alone; the difference (${money(SHORTFALL)}) is the underpayment.`,
  },
]

const formulaOptions: FormulaOption[] = [
  {
    id: 'flat-case-rate',
    label: `Flat case rate (${money(CASE_RATE)})`,
    amount: CASE_RATE,
    correct: false,
    feedback: 'That\'s what Anthem paid. Applying it again gets you the same answer. The threshold tripped — the case rate doesn\'t apply.',
  },
  {
    id: 'stoploss-65',
    label: `Stoploss: ${STOPLOSS_PCT * 100}% of total charges (${money(TOTAL_CHARGES)} × 0.65)`,
    amount: EXPECTED,
    correct: true,
    feedback: `${money(EXPECTED)} expected. Paid ${money(PAID)}. Shortfall ${money(SHORTFALL)}. The math is the appeal.`,
  },
  {
    id: 'outlier-75',
    label: `Outlier: 75% of total charges (${money(TOTAL_CHARGES)} × 0.75)`,
    amount: TOTAL_CHARGES * 0.75,
    correct: false,
    feedback: '75% is the LOS-based outlier provision (Case Rate Specter). This stay isn\'t outlier-tripped on LOS; it\'s stoploss-tripped on charges. Two different clauses, two different percents.',
  },
  {
    id: 'percent-of-charge-full',
    label: `Full charges (${money(TOTAL_CHARGES)})`,
    amount: TOTAL_CHARGES,
    correct: false,
    feedback: 'Asking for billed-as-paid. The contract pays a percentage; not billed full. Filing for charges asks for what no contract allows.',
  },
]

const appealOptions: AppealOption[] = [
  {
    shortfall: money(SHORTFALL),
    reason: `Stoploss provision tripped (charges ${money(TOTAL_CHARGES)} > 4× case rate ${money(STOPLOSS_THRESHOLD)}); payment basis converts to 65% of charges = ${money(EXPECTED)}.`,
    correct: true,
    feedback: `Right shortfall, right citation. Anthem reprocesses on the stoploss basis; the recoupment posts on the next 835.`,
  },
  {
    shortfall: money(EXPECTED),
    reason: `Stoploss provision tripped; payment basis converts to 65% of charges = ${money(EXPECTED)}.`,
    correct: false,
    feedback: `That\'s the expected total, not the shortfall. Shortfall = expected − paid = ${money(EXPECTED)} − ${money(PAID)} = ${money(SHORTFALL)}.`,
  },
  {
    shortfall: money(SHORTFALL),
    reason: `Length of stay (22 days) exceeds the inlier ceiling; outlier provision (3.2(b)) at 75% of charges should have applied.`,
    correct: false,
    feedback: 'Right amount, wrong clause. The outlier provision is LOS-based and pays 75%; the stoploss is charge-based and pays 65%. Filing the wrong clause earns a contractual-review denial that fixes itself eventually but burns 60+ days of AR aging.',
  },
  {
    shortfall: money(SHORTFALL),
    reason: 'Medical necessity for the extended ICU course was not adjudicated.',
    correct: false,
    feedback: 'Right amount, wrong queue. Med-nec routes to clinical review for 30+ days. The shortfall is contractual (stoploss), not clinical.',
  },
]

const issues: Issue[] = [
  {
    id: 'trip',
    label: 'Trip: did the stoploss provision trigger? Mark each statement true/false.',
    recap: `Tripped. Charges ${money(TOTAL_CHARGES)} > 4× case rate ${money(STOPLOSS_THRESHOLD)}. Stoploss replaces the case rate as the payment basis (mutually exclusive, not stacked).`,
    verb: 'trip',
  },
  {
    id: 'recalculate',
    label: 'Recalculate: apply the right percent-of-charge formula.',
    recap: `${money(TOTAL_CHARGES)} × 0.65 = ${money(EXPECTED)}. Decoys (75% outlier, full charges, flat case rate) are nearby formulas that don\'t apply.`,
    verb: 'recalculate',
  },
  {
    id: 'appeal',
    label: 'Appeal: file with the right shortfall + reason.',
    recap: `Filed at ${money(SHORTFALL)} on the stoploss-trip citation. Anthem reprocesses; the recoupment posts on next cycle\'s 835.`,
    verb: 'appeal',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'stoploss': {
    term: 'Stoploss provision',
    plain: "Contract clause that protects the provider from catastrophic losses on individual cases. When total billed charges on a single stay exceed a threshold (typically 3-5× the contracted case rate, or a flat dollar amount like $150k or $200k), the payment basis converts from case rate to a percentage of charges (typically 60-75%). Stoploss is mutually exclusive with the case rate — once it trips, the case rate doesn't apply at all. Catastrophic ICU stays, multi-organ transplants, and burn cases are common stoploss territory. NOTE: this Case demonstrates PER-CLAIM stoploss (one stay trips it). Many contracts also have an AGGREGATE stoploss clause (if total losses on this contract year exceed $X, the payer kicks in additional payments) — that's a different mechanism, calculated annually rather than per-stay. Real contracts often have both layers.",
  },
  'DRG case rate': {
    term: 'DRG case rate',
    plain: "Fixed payment per inpatient stay grouped to a specific DRG. Designed to cover routine costs but not catastrophic outliers. The stoploss provision exists precisely because case rates can't price all stays — Lucia's $312k of charges would be nowhere near Mercy's actual costs at the $48k case rate.",
  },
  'CO-45': {
    term: 'CO-45 (charge exceeds fee schedule)',
    plain: "Most common CARC on commercial 835s. \"We paid the contracted amount; the rest is a contractual write-off.\" When the contracted amount missed an applicable stoploss trip, CO-45 quietly absorbs the variance. Same Specter trap as the original.",
  },
  'mutually exclusive': {
    term: 'Mutually exclusive (contract clauses)',
    plain: "When two payment bases can't both apply to the same stay. Stoploss explicitly displaces case rate; outlier explicitly displaces case rate; case rate displaces fee-for-service for that DRG. Most provider-payer contracts spell out which clauses are mutually exclusive in the appendix; misreading this is a common appeals-side error.",
  },
  'outlier vs stoploss': {
    term: 'Outlier provision vs stoploss provision',
    plain: "Both replace the case rate when triggered. Outlier triggers on LOS (length of stay > some inlier ceiling); stoploss triggers on charges (charges > some multiple of case rate). Same effect (payment converts to percent-of-charges), different trigger, often different percentages (75% outlier vs 65% stoploss in this contract). Picking the wrong one to cite gets the appeal denied even if the math is right.",
  },
}

// ===== Runtime state =====

interface StmtState { pick: boolean | null }
const state = {
  briefingDone: false,
  briefingOpen: false,
  stmtStates: tripStatements.reduce((m, s) => { m[s.id] = { pick: null }; return m }, {} as Record<string, StmtState>),
  appliedFormulaId: null as string | null,
  appealOpen: false,
  appealSelectedIdx: null as number | null,
  appealFeedback: null as { idx: number; message: string } | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isTripDone(): boolean {
  return tripStatements.every(s => state.stmtStates[s.id].pick === s.truth)
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
    return renderHeader() + renderVictory() + renderTermPopover() + renderBriefingPopover() + renderAppealModal()
  }
  return `
    ${renderHeader()}
    ${renderHospitalIntro()}
    ${!state.briefingDone ? renderBriefingInline() : `
      ${renderClaimSummary()}
      ${renderTripPanel()}
      ${renderRecalcPanel()}
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
        <h1>Stoploss Reckoner <span class="muted">@ L4 — first sketch</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./prototypes.html">← back to catalog</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          ${escape(PATIENT)}'s 22-day ICU stay. ${money(TOTAL_CHARGES)} charges,
          ${money(PAID)} case rate paid. Anthem's contract has a
          ${term('stoploss', 'stoploss provision')} that trips when
          charges exceed 4× the case rate (${money(STOPLOSS_THRESHOLD)}).
          They tripped. Payment converts to 65% of charges = ${money(EXPECTED)}.
          The math IS the appeal. See the
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
        Bola walks in with the chart. ${escape(PATIENT)}'s
        ${term('DRG')}-${DRG} stay — septicemia, ${term('mutually exclusive', 'mechanically ventilated 96+ hours')},
        ICU days 1–22. ${money(TOTAL_CHARGES)} charges. Anthem paid the
        ${term('DRG case rate')} of ${money(PAID)} and ${term('CO-45')}'d
        the rest. "${escape("That's not the contract.")} Stoploss should have
        tripped at four times the case rate."
      </p>
      <p>
        Three steps: confirm the trip, run the new formula, file
        with the right cite.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The numbers slide
        a half-pixel left, then settle. The stoploss math
        unfolds: $312k versus $192k threshold, ratio above 1.6,
        provision tripped.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'Math-heavy. The number you compute is the number you file.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "Same Anthem contract, different threshold clause. Lucia's
        stay tripped the ${term('stoploss')}, not the LOS outlier
        and not the implant carve-out. Three triggers in the same
        contract; only one applies per stay."
      </p>
      <p>
        "Three issues:"
      </p>
      <ul>
        <li>
          Four statements about the
          stoploss math + mechanics. Mark each true/false.
          The tricky one: stoploss and case rate are
          ${term('mutually exclusive')} — once stoploss trips,
          case rate is gone. Don't try to stack them.
        </li>
        <li>
          Four formulas. Only one
          applies (65% of charges). Decoys are real percent-of-
          charge formulas that govern other contracts or other
          clauses in this same contract.
        </li>
        <li>
          Same modal as the other
          Specters. Pick shortfall + reason. Wrong cite even
          with right math = denied. The math IS the appeal."
        </li>
      </ul>
      <p class="briefing-sign">"Contracts have edges. Find them. — D."</p>
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
        <span class="cs-tag">CLAIM · Anthem PPO · ICN 2026-04-12-883</span>
        <span class="cs-sub">${escape(PATIENT)} · ${term('DRG')} ${DRG} · ${escape(DRG_LABEL)}</span>
      </div>
      <table class="cs-table">
        <tr><th>Stay</th><td>${escape(ADMIT)} → ${escape(DISCHARGE)} · 22 days ICU</td></tr>
        <tr><th>Total charges</th><td><strong class="bad-text">${money(TOTAL_CHARGES)}</strong></td></tr>
        <tr><th>Anthem paid</th><td>${money(PAID)} · ${term('CO-45')} ${money(TOTAL_CHARGES - PAID)} adjusted</td></tr>
        <tr><th>${term('stoploss', 'Stoploss threshold')}</th><td>${STOPLOSS_MULTIPLIER}× case rate = ${money(STOPLOSS_THRESHOLD)}</td></tr>
        <tr><th>Trip status</th><td><strong class="good-text">${money(TOTAL_CHARGES)} > ${money(STOPLOSS_THRESHOLD)} → TRIPPED</strong></td></tr>
      </table>
    </section>
  `
}

function renderTripPanel(): string {
  const done = state.resolvedIssues.has('trip')
  return `
    <section class="trip-panel ${done ? 'done' : ''}">
      <div class="tp-h">
        <span class="tp-tag">STOPLOSS TRIP · 4 statements</span>
        <span class="tp-sub">${done
          ? 'Tripped. Stoploss replaces case rate (mutually exclusive). Charge-based trigger (not LOS-based).'
          : 'Mark each true/false. The tricky pair: stoploss + case rate don\'t stack; LOS doesn\'t trip stoploss.'}</span>
      </div>
      <ul class="stmt-list">
        ${tripStatements.map(s => renderStmtRow(s)).join('')}
      </ul>
      ${state.transientFeedback && tripStatements.some(s => s.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('trip') : ''}
    </section>
  `
}

function renderStmtRow(s: TripStatement): string {
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

function renderRecalcPanel(): string {
  const unlocked = state.resolvedIssues.has('trip')
  const done = state.resolvedIssues.has('recalculate')
  if (!unlocked) {
    return `
      <section class="recalc-panel locked">
        <div class="rp-h">
          <span class="rp-tag idle">RECALCULATE</span>
          <span class="rp-sub">Locked until the trip is verified.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="recalc-panel ${done ? 'done' : 'active'}">
      <div class="rp-h">
        <span class="rp-tag ${done ? 'done' : 'active'}">APPLY THE FORMULA · 4 candidates</span>
        <span class="rp-sub">${done
          ? `${money(TOTAL_CHARGES)} × 0.65 = ${money(EXPECTED)}. Shortfall ${money(SHORTFALL)}.`
          : 'Pick the formula the stoploss provision sets. Decoys are nearby clauses that don\'t apply.'}</span>
      </div>
      <ul class="formula-list">
        ${formulaOptions.map(f => renderFormulaRow(f)).join('')}
      </ul>
      ${state.transientFeedback && formulaOptions.some(f => f.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('recalculate') : ''}
    </section>
  `
}

function renderFormulaRow(f: FormulaOption): string {
  const applied = state.appliedFormulaId === f.id
  const locked = state.appliedFormulaId !== null && !applied
  return `
    <li class="formula ${applied ? 'applied' : ''}">
      <button class="formula-btn" data-action="apply-formula" data-id="${f.id}" ${locked ? 'disabled' : ''}>
        <span class="formula-label">${escape(f.label)}</span>
        <span class="formula-amount">= ${money(f.amount)}</span>
        ${applied ? '<span class="formula-badge applied">APPLIED</span>' : ''}
      </button>
    </li>
  `
}

function renderAppealLauncher(): string {
  const ready = state.resolvedIssues.has('trip') && state.resolvedIssues.has('recalculate')
  const done = state.resolvedIssues.has('appeal')
  const cls = !ready ? 'idle' : (done ? 'done' : 'active')
  return `
    <section class="appeal-launcher ${cls}">
      <div class="al-h">
        <span class="al-tag">${done ? 'APPEAL FILED' : 'APPEAL · WAITING ON YOU'}</span>
        <span class="al-sub">${done
          ? `Filed ${money(SHORTFALL)} short on the stoploss-trip citation.`
          : !ready
            ? 'Locked until trip + recalculate are confirmed.'
            : 'Pick the right shortfall + reason combo.'}</span>
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
          <span class="amend-sub">${escape(PATIENT)} · DRG ${DRG} · ICN 2026-04-12-883</span>
        </div>
        <div class="amend-context">
          <strong>Anthem paid ${money(PAID)}</strong> against expected ${money(EXPECTED)}
          (65% of ${money(TOTAL_CHARGES)} charges per stoploss provision).
          Pick the shortfall + reason combo.
        </div>
        <ul class="amend-options">
          ${appealOptions.map((o, i) => renderAppealOptionRow(o, i)).join('')}
        </ul>
        <p class="amend-hint-text">Wrong shortfall = denied. Wrong reason = wrong queue.</p>
      </div>
    </div>
  `
}

function renderAppealOptionRow(o: AppealOption, idx: number): string {
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

const RECAP: CaseRecap = CASE_RECAPS['stoploss-reckoner']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">STOPLOSS APPEAL FILED</div>
      <h2>${money(SHORTFALL)} recovered. Stoploss math accepted.</h2>
      <p>
        Anthem reprocessed on the stoploss basis. ${money(TOTAL_CHARGES)} ×
        65% = ${money(EXPECTED)} expected; less ${money(PAID)} paid;
        ${money(SHORTFALL)} recoupment posts to the next 835.
      </p>
      <p class="muted">
        Stoploss provisions exist because case rates can't price
        every stay. ICUs, multi-organ transplants, burns — these
        are why the threshold clause is in the appendix in the
        first place. The math is mechanical once the trip is
        confirmed; the muscle is recognizing which clause governs.
      </p>
      <div class="register hospital">HOSPITAL · later that morning</div>
      <p>
        Bola flips through the AR aging report. Three more high-
        charge ICU stays from last quarter. "Same Anthem contract.
        Same trip pattern. We've got more Reckoners to file."
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
            <li><strong>Three moves:</strong> verify the
            threshold tripped, apply the formula to recalculate,
            and file the appeal with the right cite.</li>
            <li><strong>The math is the appeal.</strong> Real
            arithmetic against the sheet — first Case where the
            shortfall isn't given, it's computed.</li>
            <li><strong>Mutually exclusive clauses.</strong>
            Stoploss and case rate don't stack. LOS-based outlier
            and charge-based stoploss are different triggers, often
            different percentages. Read the contract.</li>
            <li><strong>Right math, wrong cite = denied.</strong>
            The appeal's reason has to match the clause that
            actually triggered.</li>
          </ul>
        </div>
        <div>
        </div>
      </div>
      <p class="notes-cta">
        See the <a href="./prototypes.html">Case Prototypes catalog</a>.
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

function pickStmt(id: string, pick: boolean) {
  const s = tripStatements.find(x => x.id === id); if (!s) return
  state.transientFeedback = null
  if (s.truth === pick) {
    state.stmtStates[id].pick = pick
    state.transientFeedback = { id, message: s.reason, kind: 'good' }
    if (isTripDone()) state.resolvedIssues.add('trip')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: s.reason, kind: 'bad' }
  }
}

function resetStmt(id: string) {
  state.stmtStates[id].pick = null
  state.resolvedIssues.delete('trip')
  state.resolvedIssues.delete('recalculate')
  state.resolvedIssues.delete('appeal')
  state.transientFeedback = null
}

function applyFormula(id: string) {
  const f = formulaOptions.find(x => x.id === id); if (!f) return
  state.transientFeedback = null
  if (f.correct) {
    state.appliedFormulaId = id
    state.resolvedIssues.add('recalculate')
    state.transientFeedback = { id, message: f.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: f.feedback, kind: 'bad' }
  }
}

function pickAppeal(idx: number) {
  const o = appealOptions[idx]; if (!o) return
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
    notifyParentVictory('stoploss-reckoner')
  }
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  for (const id in state.stmtStates) state.stmtStates[id] = { pick: null }
  state.appliedFormulaId = null
  state.appealOpen = false
  state.appealSelectedIdx = null
  state.appealFeedback = null
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
  if (target.classList.contains('amend-modal-backdrop')) { closeAppeal(); rerender(); return }
  const el = target.closest('[data-action]') as HTMLElement | null
  if (!el) return
  switch (el.dataset.action) {
    case 'pick-stmt': if (el.dataset.id && el.dataset.pick) pickStmt(el.dataset.id, el.dataset.pick === 'true'); break
    case 'reset-stmt': if (el.dataset.id) resetStmt(el.dataset.id); break
    case 'apply-formula': if (el.dataset.id) applyFormula(el.dataset.id); break
    case 'open-appeal': openAppeal(); break
    case 'close-appeal': closeAppeal(); break
    case 'pick-appeal': if (el.dataset.idx) pickAppeal(parseInt(el.dataset.idx, 10)); break
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

const css = districtVars('billing') + BASE_CSS + `
  .claim-summary { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .cs-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .cs-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .cs-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .cs-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .cs-table th, .cs-table td { text-align: left; padding: 6px 10px; border-bottom: 1px dashed #232a36; vertical-align: top; }
  .cs-table th { font-size: 11px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; width: 220px; }
  .bad-text { color: var(--bad); }
  .good-text { color: var(--good); }

  .trip-panel, .recalc-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent-2); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .trip-panel.done, .recalc-panel.done { border-left-color: var(--good); }
  .recalc-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .tp-h, .rp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .tp-tag, .rp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent-2); }
  .rp-tag.idle { color: var(--ink-dim); }
  .tp-tag.done, .rp-tag.done { color: var(--good); }
  .tp-sub, .rp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .stmt-list, .formula-list { list-style: none; padding-left: 0; margin: 0; }
  .stmt { display: flex; align-items: center; gap: 16px; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 6px; border-left: 3px solid transparent; }
  .stmt.correct { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .stmt-text { flex: 1; font-size: 13px; line-height: 1.5; }
  .stmt-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .stmt-badge { font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; }
  .stmt-badge.true  { background: rgba(126, 226, 193, 0.15); color: var(--good); border: 1px solid #2c5547; }
  .stmt-badge.false { background: rgba(239, 91, 123, 0.10); color: var(--bad); border: 1px solid #4a2a32; }
  .btn.small { padding: 4px 10px; font-size: 11.5px; }

  .formula { margin-bottom: 6px; }
  .formula-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 11px 14px; text-align: left; display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; font: inherit; transition: all 0.15s; position: relative; }
  .formula-btn:hover:not(:disabled) { background: #232b3a; border-color: var(--accent-2); }
  .formula-btn:disabled { opacity: 0.45; cursor: default; }
  .formula.applied .formula-btn { border-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); opacity: 1; }
  .formula-label { flex: 1; font-size: 13px; padding-right: 90px; }
  .formula-amount { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 13px; color: var(--ink); }
  .formula-badge.applied { position: absolute; top: 10px; right: 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; font-weight: 700; }

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

  .amend-modal { max-width: 760px; }
  .amend-option-h { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
  .appeal-shortfall { font-size: 14px; }
  .appeal-shortfall code { font-weight: 700; color: var(--ink); letter-spacing: 0.04em; }
  .appeal-reason { font-size: 12.5px; color: var(--ink); flex: 1; }

  .recap { background: rgba(126, 226, 193, 0.06); border-color: #2c5547; }
  .recap-h { color: var(--good); }
`

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
      if (state.appealOpen) { closeAppeal(); changed = true }
      if (changed) rerender()
    }
  })
}

mount()
