// OB Per-Diem Specter @ L7 — obstetrics case rate + per-diem hybrid.
// Contract pays a flat case rate for the first N inpatient days and
// per-diem for subsequent days. Hospital applied the case rate alone
// and missed the per-diem days for a complicated delivery.
//
// Sibling to Case Rate Specter / Stoploss Reckoner (same Anthem
// contract; different threshold-trip clause). Same hybrid pattern
// shows up in OB, NICU, behavioral health, rehab.
//
// Verbs:
//   - PARSE-CONTRACT: 4 statements about the case-rate + per-diem
//     mechanics. Mark each true/false.
//   - SPLIT-DAYS: allocate each inpatient day to "case-rate window"
//     (days 1-2) or "per-diem days" (days 3+). Click per day.
//   - APPEAL: file with the right per-diem-days × per-diem-rate
//     shortfall.
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

// ===== Domain types =====

type DayBucket = 'case-rate' | 'per-diem'

interface ParseStatement {
  id: string
  text: string
  truth: boolean
  reason: string
}

interface InpatientDay {
  /** Day number (1-indexed). */
  num: number
  /** Plain-English day notes. */
  notes: string
  /** Correct bucket. */
  correct: DayBucket
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
  verb: 'parse' | 'split' | 'appeal'
}

interface GlossaryEntry {
  term: string
  plain: string
}

// ===== Encounter data =====

const PATIENT = 'Imani Carter'
const PROCEDURE = 'Vaginal delivery (DRG 775), extended for newborn phototherapy'
const ADMIT = '2026-04-02'
const DISCHARGE = '2026-04-07' // 5-day stay
const CASE_RATE = 7_200
const CASE_RATE_DAYS = 2
const PER_DIEM = 1_400
const STAY_DAYS = 5
const PER_DIEM_DAYS = STAY_DAYS - CASE_RATE_DAYS // 3
const PER_DIEM_TOTAL = PER_DIEM_DAYS * PER_DIEM   // 4,200
const EXPECTED = CASE_RATE + PER_DIEM_TOTAL       // 11,400
const PAID = CASE_RATE
const SHORTFALL = EXPECTED - PAID                  // 4,200

const parseStatements: ParseStatement[] = [
  {
    id: 's1',
    text: `The case rate (${money(CASE_RATE)}) covers all inpatient days regardless of length.`,
    truth: false,
    reason: `False. The contract is explicit: case rate covers the first ${CASE_RATE_DAYS} inpatient days. Day 3 onward bills at the per-diem rate. Treating the case rate as all-inclusive is exactly the bug — it leaves ${money(PER_DIEM_TOTAL)} on the table for a 5-day stay.`,
  },
  {
    id: 's2',
    text: `Days 3 onward bill at ${money(PER_DIEM)} per inpatient day under the per-diem provision.`,
    truth: true,
    reason: `Right. Per-diem rate is ${money(PER_DIEM)}/day, applied to each day of inpatient stay beyond day ${CASE_RATE_DAYS}. ${escape(PATIENT)}'s stay = 5 days; per-diem days = 3 (days 3, 4, 5); per-diem total = ${money(PER_DIEM_TOTAL)}.`,
  },
  {
    id: 's3',
    text: `The case rate and per-diem stack on the same stay (the contract pays both, not one-or-the-other).`,
    truth: true,
    reason: `True — and this is what makes OB different from Case Rate Specter / Stoploss Reckoner. Those Cases had mutually-exclusive clauses (one displaces the other). Here the case rate covers the first ${CASE_RATE_DAYS} days AND the per-diem covers the rest. Stack them; don't choose between them.`,
  },
  {
    id: 's4',
    text: `A maternal complicating diagnosis on day 3 promoted the stay to a higher-DRG case rate.`,
    truth: false,
    reason: 'No maternal complication on the chart. The extended stay is *newborn-driven* — baby Carter required phototherapy for hyperbilirubinemia, and Imani stayed bedside until the newborn cleared. Mother\'s coding is unchanged (no new maternal Dx); DRG 775 holds. Per-diem applies because mother\'s stay extended past the inlier ceiling, not because anything maternal changed.',
  },
]

const inpatientDays: InpatientDay[] = [
  { num: 1, notes: 'Admission, labor + delivery', correct: 'case-rate' },
  { num: 2, notes: 'Postpartum recovery, mother + newborn', correct: 'case-rate' },
  { num: 3, notes: 'Newborn jaundice flagged; phototherapy started for baby; mother stays bedside (no new maternal Dx)', correct: 'per-diem' },
  { num: 4, notes: 'Newborn continues phototherapy; mother stable', correct: 'per-diem' },
  { num: 5, notes: 'Newborn bilirubin clearing; mother + baby cleared for joint discharge', correct: 'per-diem' },
]

const appealOptions: AppealOption[] = [
  {
    shortfall: money(SHORTFALL),
    reason: `Case rate covered days 1-2 ($${CASE_RATE.toLocaleString()}); 3 per-diem days at $${PER_DIEM.toLocaleString()}/day = $${PER_DIEM_TOTAL.toLocaleString()} not billed. Refile with per-diem days appended.`,
    correct: true,
    feedback: `Right shortfall, right citation. Anthem reprocesses on the corrected line items; the recoupment posts on the next 835.`,
  },
  {
    shortfall: money(EXPECTED),
    reason: `Total contract reimbursement is $${EXPECTED.toLocaleString()}.`,
    correct: false,
    feedback: `That's the expected total, not the shortfall. Anthem already paid the case rate ($${CASE_RATE.toLocaleString()}); the gap is just the per-diem portion ($${SHORTFALL.toLocaleString()}).`,
  },
  {
    shortfall: money(STAY_DAYS * PER_DIEM),
    reason: `5 days × $${PER_DIEM.toLocaleString()} per-diem = $${(STAY_DAYS * PER_DIEM).toLocaleString()}.`,
    correct: false,
    feedback: `You can't reprice the whole stay as per-diem — the case rate covers days 1-2 and is already paid. Only days 3+ bill per-diem. Asking for full-stay per-diem rejects the case rate Anthem already paid.`,
  },
  {
    shortfall: money(SHORTFALL),
    reason: 'Medical necessity for the extended postpartum stay was not adjudicated.',
    correct: false,
    feedback: 'Right amount, wrong queue. Med-nec routes to clinical review; this is contractual (per-diem days). Wrong path slows it.',
  },
]

const issues: Issue[] = [
  {
    id: 'parse',
    label: 'Parse: walk the case-rate + per-diem mechanics. Mark each statement true/false.',
    recap: `Parsed. Case rate covers days 1-${CASE_RATE_DAYS}; per-diem covers days ${CASE_RATE_DAYS + 1}+. Both stack (mutually inclusive — different from Case Rate Specter / Stoploss). Maternal DRG didn't move because there's no new maternal Dx — the extension is newborn-driven.`,
    verb: 'parse',
  },
  {
    id: 'split',
    label: 'Split-days: allocate each inpatient day to case-rate window or per-diem.',
    recap: `Split. Days 1-2 in the case-rate window; days 3-5 in per-diem. ${PER_DIEM_DAYS} × ${money(PER_DIEM)} = ${money(PER_DIEM_TOTAL)} per-diem owed.`,
    verb: 'split',
  },
  {
    id: 'appeal',
    label: 'Appeal: file the per-diem days as a corrected claim.',
    recap: `Filed at ${money(SHORTFALL)} on per-diem-days citation. Anthem reprocesses; recoupment posts next cycle.`,
    verb: 'appeal',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'per-diem': {
    term: 'Per-diem rate',
    plain: "Fixed dollar amount the payer pays per inpatient day. Common in psych, rehab, NICU, and OB stays where case rates don't price the typical clinical course well. Often used in hybrid contracts: case rate for the first N days, per-diem for days beyond N. Different from a pure case rate (where days are immaterial) and from outlier provisions (where percent-of-charge replaces the case rate above a threshold).",
  },
  'case rate + per-diem hybrid': {
    term: 'Case rate + per-diem hybrid',
    plain: "Contract structure where the first N inpatient days price at a flat case rate (covering routine labor + delivery, or routine surgery, etc.) and subsequent days price at a per-diem rate. Designed for service lines where most stays are short but a tail of complications drives longer stays. OB and NICU use this shape constantly. Different from stoploss / outlier — those clauses *displace* the case rate; this one *extends* it.",
  },
  'mutually inclusive': {
    term: 'Mutually inclusive (clauses)',
    plain: "When two contract clauses both apply to the same stay, with their payments adding together (rather than one displacing the other). Case rate + per-diem hybrid is mutually inclusive: case rate pays days 1-2, per-diem pays days 3+, both stack. Compare to mutually exclusive (Case Rate Specter / Stoploss Reckoner) where one clause replaces another.",
  },
  'newborn-driven extension': {
    term: 'Newborn-driven maternal stay extension',
    plain: "When the mother\'s discharge is delayed by the newborn\'s clinical needs (most often phototherapy for hyperbilirubinemia, NICU observation, or feeding establishment), her hospital days extend without any new *maternal* diagnosis. Mother\'s DRG stays put (no new maternal Dx → no re-grouping); newborn is on a separate claim with their own DRG. Per-diem clauses apply to mother\'s extra days because her LOS exceeded the inlier ceiling, even though clinically she's well.",
  },
  'CO-45': {
    term: 'CO-45 (charge exceeds fee schedule)',
    plain: "Most common CARC on commercial 835s. \"We paid the contracted amount; the rest is a contractual write-off.\" Same Specter trap as the others — when the contracted amount missed a per-diem clause, CO-45 absorbs the variance.",
  },
  'DRG 775': {
    term: 'DRG 775 (Vaginal delivery without complicating diagnoses)',
    plain: "MS-DRG for routine vaginal delivery. Roughly 800,000 cases per year nationally — by far the highest-volume inpatient DRG. Most stays are 1-2 days; the per-diem clause exists for the long tail of complicated deliveries.",
  },
}

// ===== Runtime state =====

interface StmtState { pick: boolean | null }
interface DayState { bucket: DayBucket | null }

const state = {
  briefingDone: false,
  briefingOpen: false,
  stmtStates: parseStatements.reduce((m, s) => { m[s.id] = { pick: null }; return m }, {} as Record<string, StmtState>),
  dayStates: inpatientDays.reduce((m, d) => { m[d.num] = { bucket: null }; return m }, {} as Record<number, DayState>),
  appealOpen: false,
  appealSelectedIdx: null as number | null,
  appealFeedback: null as { idx: number; message: string } | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isParseDone(): boolean {
  return parseStatements.every(s => state.stmtStates[s.id].pick === s.truth)
}
function isSplitDone(): boolean {
  return inpatientDays.every(d => state.dayStates[d.num].bucket === d.correct)
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
      ${renderParsePanel()}
      ${renderSplitPanel()}
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
        <h1>OB Per-Diem Specter <span class="muted">@ L7 — first sketch</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./prototypes.html">← back to catalog</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          ${escape(PATIENT)}'s 5-day delivery (extended by
          ${term('newborn-driven extension', 'newborn phototherapy')}). Anthem paid the case rate
          alone; the contract is a ${term('case rate + per-diem hybrid', 'hybrid')}
          — case rate covers days 1-${CASE_RATE_DAYS}, ${term('per-diem')} covers
          days ${CASE_RATE_DAYS + 1}+. ${PER_DIEM_DAYS} per-diem days at
          ${money(PER_DIEM)}/day = ${money(PER_DIEM_TOTAL)} unbilled.
          New verbs: PARSE-CONTRACT, SPLIT-DAYS, APPEAL. See the
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
        Bola walks ${escape(PATIENT)}'s file across. Day 5 discharge,
        newborn phototherapy days 3-5 keeping mother bedside. No new
        maternal Dx; mother coded as a clean DRG 775. Anthem paid the
        ${money(CASE_RATE)} case rate. "${escape("Days 3–5 are missing.")}
        We bill those at the per-diem rate, not zero."
      </p>
      <p>
        Three steps: parse the contract math, split the stay days
        into case-rate-window vs per-diem, file the per-diem
        portion as a corrected claim.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The five days
        slide into a row, waiting to be sorted. Days 1-2 read
        case-rate green; days 3-5 are still unmarked.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'Sibling to the Case Rate Specter family — different trap.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "Sibling to <a href="./case-rate-specter-prototype.html">Case Rate Specter</a>
        and <a href="./stoploss-reckoner-prototype.html">Stoploss Reckoner</a> — same
        Anthem contract, different threshold mechanics. The trap
        is different too: those clauses are mutually exclusive
        (one displaces the other). Per-diem is mutually inclusive
        — case rate AND per-diem both apply, in their own day windows."
      </p>
      <p>
        "Three issues:"
      </p>
      <ul>
        <li>
          <strong>Parse-contract.</strong> Four statements about
          the case-rate + per-diem math. The trap: thinking case
          rate covers everything, or treating it as mutually
          exclusive with per-diem. <em>New verb: PARSE-CONTRACT.</em>
        </li>
        <li>
          <strong>Split-days.</strong> Five inpatient days. Click
          each to assign to case-rate window or per-diem.
          Days 1-${CASE_RATE_DAYS} are case-rate; the newborn
          phototherapy starting day 3 doesn't change the maternal
          DRG (no new maternal Dx) — just extends mother's stay
          into per-diem territory.
          <em>New verb: SPLIT-DAYS.</em>
        </li>
        <li>
          <strong>Appeal.</strong> Pick the right shortfall +
          reason. Wrong combo = denied even with right math."
        </li>
      </ul>
      <p class="briefing-sign">"The escalator either fired or didn't. — D."</p>
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
        <span class="cs-tag">CLAIM · Anthem PPO · ICN 2026-04-09-642</span>
        <span class="cs-sub">${escape(PATIENT)} · ${escape(PROCEDURE)}</span>
      </div>
      <table class="cs-table">
        <tr><th>Stay</th><td>${escape(ADMIT)} → ${escape(DISCHARGE)} · ${STAY_DAYS} days</td></tr>
        <tr><th>Case rate (days 1-${CASE_RATE_DAYS})</th><td>${money(CASE_RATE)} <span class="cs-mini">paid</span></td></tr>
        <tr><th>Per-diem (days ${CASE_RATE_DAYS + 1}+)</th><td><strong class="bad-text">${money(PER_DIEM)}/day × ${PER_DIEM_DAYS} days = ${money(PER_DIEM_TOTAL)}</strong> · not billed</td></tr>
        <tr><th>Anthem paid</th><td>${money(PAID)} · ${term('CO-45')} adjusted; per-diem days never appeared on the claim</td></tr>
      </table>
    </section>
  `
}

function renderParsePanel(): string {
  const done = state.resolvedIssues.has('parse')
  return `
    <section class="parse-panel ${done ? 'done' : ''}">
      <div class="pp-h">
        <span class="pp-tag">PARSE CONTRACT · 4 statements</span>
        <span class="pp-sub">${done
          ? 'Parsed. Case rate covers days 1-2; per-diem stacks on days 3+; maternal DRG didn\'t change (newborn-driven extension, no new maternal Dx).'
          : 'Mark each true/false. Watch the mutually-inclusive trap.'}</span>
      </div>
      <ul class="stmt-list">
        ${parseStatements.map(s => renderStmtRow(s)).join('')}
      </ul>
      ${state.transientFeedback && parseStatements.some(s => s.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('parse') : ''}
    </section>
  `
}

function renderStmtRow(s: ParseStatement): string {
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

function renderSplitPanel(): string {
  const unlocked = state.resolvedIssues.has('parse')
  const done = state.resolvedIssues.has('split')
  if (!unlocked) {
    return `
      <section class="split-panel locked">
        <div class="sp-h">
          <span class="sp-tag idle">SPLIT THE STAY</span>
          <span class="sp-sub">Locked until contract math is parsed.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="split-panel ${done ? 'done' : 'active'}">
      <div class="sp-h">
        <span class="sp-tag ${done ? 'done' : 'active'}">SPLIT THE STAY · ${STAY_DAYS} days</span>
        <span class="sp-sub">${done
          ? `Days 1-${CASE_RATE_DAYS} → case rate. Days ${CASE_RATE_DAYS + 1}-${STAY_DAYS} → per-diem (${money(PER_DIEM_TOTAL)}).`
          : 'Click each day to assign to case-rate window or per-diem.'}</span>
      </div>
      <div class="day-grid">
        ${inpatientDays.map(d => renderDayCard(d)).join('')}
      </div>
      ${state.transientFeedback && inpatientDays.some(d => `day-${d.num}` === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('split') : ''}
    </section>
  `
}

function renderDayCard(d: InpatientDay): string {
  const ss = state.dayStates[d.num]
  const decided = ss.bucket !== null
  const correct = decided && ss.bucket === d.correct
  return `
    <div class="day-card ${decided && correct ? 'correct ' + ss.bucket : ''}">
      <div class="day-h">Day ${d.num}</div>
      <div class="day-notes">${escape(d.notes)}</div>
      <div class="day-actions">
        ${decided && correct ? `
          <span class="day-badge ${ss.bucket}">${ss.bucket === 'case-rate' ? 'CASE RATE' : 'PER-DIEM'}</span>
          <button class="btn small ghost" data-action="reset-day" data-num="${d.num}">↺ undo</button>
        ` : `
          <button class="btn small ghost" data-action="pick-day" data-num="${d.num}" data-bucket="case-rate">Case rate</button>
          <button class="btn small ghost" data-action="pick-day" data-num="${d.num}" data-bucket="per-diem">Per-diem</button>
        `}
      </div>
    </div>
  `
}

function renderAppealLauncher(): string {
  const ready = state.resolvedIssues.has('parse') && state.resolvedIssues.has('split')
  const done = state.resolvedIssues.has('appeal')
  const cls = !ready ? 'idle' : (done ? 'done' : 'active')
  return `
    <section class="appeal-launcher ${cls}">
      <div class="al-h">
        <span class="al-tag">${done ? 'APPEAL FILED' : 'APPEAL · WAITING ON YOU'}</span>
        <span class="al-sub">${done
          ? `Filed ${money(SHORTFALL)} per-diem on the days-3-5 citation.`
          : !ready
            ? 'Locked until parse + split are done.'
            : `${PER_DIEM_DAYS} per-diem days × ${money(PER_DIEM)}/day = ${money(SHORTFALL)} unbilled. Pick the right shortfall + reason.`}</span>
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
          <span class="amend-tag">FILE PER-DIEM CORRECTED CLAIM</span>
          <span class="amend-sub">${escape(PATIENT)} · ICN 2026-04-09-642</span>
        </div>
        <div class="amend-context">
          <strong>Anthem paid ${money(PAID)}</strong> against expected ${money(EXPECTED)}
          (case rate ${money(CASE_RATE)} + per-diem ${money(PER_DIEM_TOTAL)}).
        </div>
        <ul class="amend-options">
          ${appealOptions.map((o, i) => renderAppealOptionRow(o, i)).join('')}
        </ul>
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
      <div class="recap-h">RECAP · ${issue.verb.toUpperCase()}</div>
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
              <div class="issue-body"><div class="issue-label">${escape(i.label)}</div></div>
            </li>
          `
        }).join('')}
      </ul>
      ${state.failedAttempts > 0 ? `<p class="fail-counter">Wrong picks so far: ${state.failedAttempts}.</p>` : ''}
      <button class="btn submit ${allDone ? '' : 'disabled'}" data-action="submit" ${allDone ? '' : 'disabled'}>
        Submit corrected claim · ${money(SHORTFALL)} per-diem
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

const RECAP: CaseRecap = CASE_RECAPS['ob-perdiem-specter']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">PER-DIEM CORRECTED CLAIM FILED</div>
      <h2>${money(SHORTFALL)} recovered. Days 3-5 billed at ${money(PER_DIEM)}/day.</h2>
      <p>
        Anthem reprocessed the per-diem days. Total reimbursement
        on ${escape(PATIENT)}'s stay: ${money(EXPECTED)} (case rate
        + per-diem stack). Recoupment posts on the next 835.
      </p>
      <p class="muted">
        OB stays look like one of the simpler service lines from
        the outside — short stays, predictable cases. The hybrid
        contracts are where the variance hides. Same shape pops up
        in NICU, psych, rehab.
      </p>
      <div class="register hospital">HOSPITAL · later that morning</div>
      <p>
        Bola pulls the OB AR queue. "Twelve more deliveries with
        per-diem-eligible days from last quarter. We've got the
        pattern now."
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
            <li><strong>Three new verbs:</strong> PARSE-CONTRACT
            (mutually-inclusive math), SPLIT-DAYS (allocate days
            across windows), APPEAL.</li>
            <li><strong>Mutually inclusive ≠ mutually
            exclusive.</strong> Stoploss/outlier displace case
            rate; per-diem stacks with case rate. Different
            mechanic.</li>
            <li><strong>Complications ≠ DRG change.</strong>
            Chorioamnionitis extended the stay but didn't
            re-group the case. The per-diem clause exists to
            handle exactly that.</li>
          </ul>
        </div>
        <div>
          <h3>Sibling shape</h3>
          <ul>
            <li>Direct sibling to
            <a href="./case-rate-specter-prototype.html">Case Rate Specter</a>
            and
            <a href="./stoploss-reckoner-prototype.html">Stoploss Reckoner</a>.</li>
            <li>Hybrid pattern recurs in NICU / psych / rehab —
            same shape, different service line.</li>
          </ul>
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
  const s = parseStatements.find(x => x.id === id); if (!s) return
  state.transientFeedback = null
  if (s.truth === pick) {
    state.stmtStates[id].pick = pick
    state.transientFeedback = { id, message: s.reason, kind: 'good' }
    if (isParseDone()) state.resolvedIssues.add('parse')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: s.reason, kind: 'bad' }
  }
}

function resetStmt(id: string) {
  state.stmtStates[id].pick = null
  state.resolvedIssues.delete('parse')
  state.resolvedIssues.delete('split')
  state.resolvedIssues.delete('appeal')
  state.transientFeedback = null
}

function pickDay(num: number, bucket: DayBucket) {
  const d = inpatientDays.find(x => x.num === num); if (!d) return
  state.transientFeedback = null
  if (d.correct === bucket) {
    state.dayStates[num].bucket = bucket
    state.transientFeedback = { id: `day-${num}`, message: `Day ${num} → ${bucket === 'case-rate' ? 'case rate' : 'per-diem'}.`, kind: 'good' }
    if (isSplitDone()) state.resolvedIssues.add('split')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id: `day-${num}`, message: `Day ${num} should be ${d.correct === 'case-rate' ? 'case rate' : 'per-diem'} (covered by ${d.correct === 'case-rate' ? 'the first ' + CASE_RATE_DAYS + '-day case-rate window' : 'the per-diem provision for days ' + (CASE_RATE_DAYS + 1) + '+'}).`, kind: 'bad' }
  }
}

function resetDay(num: number) {
  state.dayStates[num].bucket = null
  state.resolvedIssues.delete('split')
  state.resolvedIssues.delete('appeal')
  state.transientFeedback = null
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
    notifyParentVictory('ob-perdiem-specter')
  }
}

function reset() {
  state.briefingDone = false; state.briefingOpen = false
  for (const id in state.stmtStates) state.stmtStates[id] = { pick: null }
  for (const num in state.dayStates) state.dayStates[+num] = { bucket: null }
  state.appealOpen = false; state.appealSelectedIdx = null; state.appealFeedback = null
  state.transientFeedback = null
  state.resolvedIssues = new Set(); state.failedAttempts = 0
  state.packetSubmitted = false; state.openTermId = null
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
    case 'pick-day':
      if (el.dataset.num && el.dataset.bucket)
        pickDay(parseInt(el.dataset.num, 10), el.dataset.bucket as DayBucket)
      break
    case 'reset-day': if (el.dataset.num) resetDay(parseInt(el.dataset.num, 10)); break
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
  .cs-mini { font-size: 11px; color: var(--ink-dim); margin-left: 8px; }
  .bad-text { color: var(--bad); }

  .parse-panel, .split-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent-2); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .parse-panel.done, .split-panel.done { border-left-color: var(--good); }
  .split-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .pp-h, .sp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .pp-tag, .sp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent-2); }
  .sp-tag.idle { color: var(--ink-dim); }
  .pp-tag.done, .sp-tag.done { color: var(--good); }
  .pp-sub, .sp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .stmt-list { list-style: none; padding-left: 0; margin: 0; }
  .stmt { display: flex; align-items: center; gap: 16px; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 6px; border-left: 3px solid transparent; }
  .stmt.correct { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .stmt-text { flex: 1; font-size: 13px; line-height: 1.5; }
  .stmt-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .stmt-badge { font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; }
  .stmt-badge.true  { background: rgba(126, 226, 193, 0.15); color: var(--good); border: 1px solid #2c5547; }
  .stmt-badge.false { background: rgba(239, 91, 123, 0.10); color: var(--bad); border: 1px solid #4a2a32; }
  .btn.small { padding: 4px 10px; font-size: 11.5px; }

  .day-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
  .day-card { background: var(--panel-2); border-radius: 5px; padding: 10px 12px; border-left: 3px solid transparent; display: flex; flex-direction: column; gap: 6px; }
  .day-card.correct.case-rate { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); }
  .day-card.correct.per-diem  { border-left-color: var(--accent-2); background: linear-gradient(180deg, rgba(240,168,104,0.08), transparent); }
  .day-h { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-dim); }
  .day-notes { font-size: 12px; color: var(--ink); line-height: 1.45; }
  .day-actions { display: flex; gap: 4px; flex-wrap: wrap; align-items: center; margin-top: auto; }
  .day-badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 3px; }
  .day-badge.case-rate { background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; }
  .day-badge.per-diem  { background: rgba(240,168,104,0.15); color: var(--accent-2); border: 1px solid #4a3a2a; }

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
