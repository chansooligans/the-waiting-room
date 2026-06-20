// Specter @ L25 (underpayment detection).
//
// Sibling to wraith / bundle / reaper / gatekeeper / fog /
// hydra / swarm. Same shape (Hospital intro → dreamlike fall →
// Waiting Room → middle work → checklist), tuned to a
// payment-side action set:
//
//   - Contract-vs-paid variance drives it. The 835 ERA arrived and
//     looks paid. Most of the claims on it are correct. One
//     hides an underpayment — the payer paid less than the
//     contract requires. Detection is the puzzle; the appeal
//     is the follow-through.
//   - First prototype where the input is a *successful* 835,
//     not a denial. The Specter looks like everything is
//     fine. It isn't.
//
// Demonstrates: a math/comparison puzzle can carry the same
// teaching weight as form-fixing, and reads as RCM-real (AR
// analysts spend half their time hunting these).

import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

interface FeeScheduleLine {
  cpt: string
  label: string
  contractAllowed: number
  notes?: string
}

interface EraServiceLine {
  /** CPT code on this service line. */
  cpt: string
  /** What the provider billed for this line. */
  billed: number
  /** What the payer paid for this line. */
  paid: number
  /** What the payer wrote off as contractual adjustment (CO-45 etc). */
  adjusted: number
  /** CARC list per line, for the per-line detail view. */
  carcs: string[]
  /** Optional payer-side note on this line. */
  payerNote?: string
}

interface EraClaim {
  id: string
  patient: string
  dos: string
  lines: EraServiceLine[]
  /** Once verified, what the variance check returned. */
  varianceCents?: number  // 0 = match; positive = underpaid by N cents
  /** Player's verification status. */
  verified: boolean
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
  verb: 'detect' | 'appeal'
}

interface GlossaryEntry {
  term: string
  plain: string
}

const issues: Issue[] = [
  {
    id: 'detect',
    label: 'Find the underpayment hidden in the 835 — verify each claim against the contract.',
    recap: "You spotted it: Patient C's chest x-ray line was paid $14 against a contracted $42. The ERA's overall pay total looked plausible, but the line-level math told the truth. Underpayment of $28.",
    verb: 'detect',
  },
  {
    id: 'appeal',
    label: 'File the underpayment appeal with the correct shortfall and reason.',
    recap: "You filed with the right shortfall ($28) and the right reason — BCBS's fee schedule for 71046 is $42 per the 2026-A contract; their adjudication engine paid $14, which matches the *prior year's* schedule. Their fee table didn't update on Jan 1. They'll reprocess; you'll see the recoupment in next cycle's 835.",
    verb: 'appeal',
  },
]

// Fee schedule (the contract's source of truth).
const feeSchedule: FeeScheduleLine[] = [
  { cpt: '99213', label: 'Office E&M, est, low', contractAllowed: 98 },
  { cpt: '99214', label: 'Office E&M, est, mod', contractAllowed: 145 },
  { cpt: '99203', label: 'Office E&M, new, low', contractAllowed: 135 },
  { cpt: '71046', label: 'Chest x-ray, 2 views', contractAllowed: 42, notes: 'rate revised upward 2026-01-01 (was $14 in 2025-A)' },
]

const feeMap: Record<string, FeeScheduleLine> = Object.fromEntries(feeSchedule.map(f => [f.cpt, f]))

// The ERA from BCBS. Four claims; one carries an underpayment hidden in line 2.
const initialEra: EraClaim[] = [
  {
    id: 'clm-A',
    patient: 'Yuki Tanaka',
    dos: '2026-03-12',
    lines: [
      { cpt: '99213', billed: 150, paid: 98, adjusted: 52, carcs: ['CO-45'] },
    ],
    verified: false,
  },
  {
    id: 'clm-B',
    patient: 'Daniel Okonkwo',
    dos: '2026-03-14',
    lines: [
      { cpt: '99214', billed: 200, paid: 145, adjusted: 55, carcs: ['CO-45'] },
    ],
    verified: false,
  },
  {
    id: 'clm-C',
    patient: 'Halima Saleh',
    dos: '2026-03-15',
    lines: [
      { cpt: '99213', billed: 150, paid: 98, adjusted: 52, carcs: ['CO-45'] },
      // The hidden underpayment — paid $14 against contract $42.
      // BCBS's fee table was never updated for the 2026-A schedule.
      { cpt: '71046', billed: 60, paid: 14, adjusted: 46, carcs: ['CO-45'], payerNote: 'allowed amount per fee table' },
    ],
    verified: false,
  },
  {
    id: 'clm-D',
    patient: 'Marisol Espinoza',
    dos: '2026-03-18',
    lines: [
      { cpt: '99203', billed: 190, paid: 135, adjusted: 55, carcs: ['CO-45'] },
    ],
    verified: false,
  },
]

// Appeal modal options. The player picks (a) the shortfall amount and
// (b) the reason. Only one combo is correct.
const appealOptions: AppealOption[] = [
  {
    shortfall: '$28',
    reason: '71046 paid against 2025 fee table; 2026-A contract sets allowed at $42',
    correct: true,
    feedback: "Right shortfall, right reason. BCBS's adjudication engine still has the prior year's $14 rate cached. Filing the appeal with the contract reference triggers a manual review and a corrected 835.",
  },
  {
    shortfall: '$46',
    reason: 'CO-45 adjustment exceeded contracted amount on chest x-ray line',
    correct: false,
    feedback: "$46 is the *adjustment* (billed minus paid: $60 - $14). The shortfall is contract-vs-paid: $42 - $14 = $28. Rejecting CO-45 entirely would mean asking BCBS to pay $60 — that's not the contract.",
  },
  {
    shortfall: '$28',
    reason: 'Medical necessity on 71046 not supported',
    correct: false,
    feedback: "Right shortfall, wrong reason — they didn't deny medical necessity (the line paid; the issue is the rate). A med-nec argument here would confuse the appeals queue and slow it down.",
  },
  {
    shortfall: '$60',
    reason: '71046 line should have paid in full per contract',
    correct: false,
    feedback: "$60 is what was *billed*, not what's contracted. Contract allows $42; they paid $14; shortfall is $28. We're not asking for full charge — we're asking for the contracted rate.",
  },
  {
    shortfall: '$42',
    reason: '71046 underpaid; contract allows $42',
    correct: false,
    feedback: "$42 is the *contracted rate*, not the shortfall. Shortfall is what they owe us beyond what they paid: $42 - $14 = $28. The reason is closer to right but the math is off.",
  },
]

const glossary: Record<string, GlossaryEntry> = {
  '835': {
    term: '835 (electronic remittance advice)',
    plain: "The X12 EDI transaction the payer sends back after adjudicating one or more claims. Carries the verdict for each claim: how much paid, how much adjusted (contractual write-off), how much patient responsibility, and which CARC/RARC codes apply per line. The 835 is the legal document of payment — read it line by line.",
  },
  'ERA': {
    term: 'ERA (electronic remittance advice)',
    plain: "The provider-side shorthand for an 835. Same transaction, different name — the payer's EDI team calls it an 835 because that's the X12 transaction number; the provider's AR team calls it an ERA because that's what it is in plain English. When somebody says \"the ERA came in\" or \"check the ERA,\" they mean the 835 file the payer sent back. Used interchangeably in the wild.",
  },
  'fee schedule': {
    term: 'Fee schedule',
    plain: "The contracted price list. For each CPT/HCPCS code, the contract specifies an allowed amount the payer agrees to pay (or use as the cap for cost-share calculation). When the payer's adjudication engine pays less than the fee schedule says, that's an underpayment — and yes, payers' fee tables get out of date all the time.",
  },
  'CO-45': {
    term: 'CO-45 (charge exceeds fee schedule)',
    plain: "The most common CARC on commercial 835s. Says: 'we paid the contracted amount; the rest is a contractual write-off.' Looks innocuous, but if the *contracted* amount is wrong — because the payer didn't update their fee table — CO-45 quietly swallows the variance. This is where most underpayments hide.",
  },
  'underpayment': {
    term: 'Underpayment',
    plain: "When the payer paid less than the contract requires. Distinct from a denial (where the payer paid nothing for explicit reasons) — underpayments look like successful payments. AR analysts spend a huge chunk of their time hunting these. Industry estimates put underpayment loss at 1-3% of net revenue for hospitals that don't actively chase variance.",
  },
  'AR analyst': {
    term: 'AR analyst (accounts receivable)',
    plain: "The person on the provider side responsible for working unpaid and underpaid claims. AR analysts run aging buckets (0-30 / 31-60 / 61-90 / 90+ days), prioritize the high-variance items, and file appeals. The Specter is what they hunt.",
  },
  'contract-vs-paid variance': {
    term: 'Contract-vs-paid variance',
    plain: "The metric: what the contract says the payer should have paid, minus what they actually paid. Positive variance = underpayment to chase. Many hospital RCM systems run a contract-vs-paid report nightly; the ones that don't are leaving money on the table.",
  },
}

// === Runtime state ===

const state = {
  briefingDone: false,
  briefingOpen: false,
  era: initialEra.map(c => ({ ...c, lines: c.lines.map(l => ({ ...l })) })),
  /** Per-claim row expansion (line-level detail). */
  expandedClaimId: null as string | null,
  /** The ID of the claim the player has flagged as the underpayment. */
  flaggedClaimId: null as string | null,
  /** Wrong flags get a beat of feedback then clear. */
  flagFeedback: null as { id: string; message: string } | null,
  appealOpen: false,
  appealSelectedIdx: null as number | null,
  appealFeedback: null as { idx: number; message: string } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  feedback: '' as string,
  feedbackKind: 'neutral' as 'neutral' | 'good' | 'bad',
  lastRecap: '' as string,
  packetSubmitted: false,
  openTermId: null as string | null,
}

// The "true" answer keys — keep them tucked here so the rendering
// code doesn't accidentally leak them into the DOM before the
// player verifies a row.
const TRUE_FLAGGED_ID = 'clm-C'

// === Rendering ===

function term(termId: string, displayText?: string): string {
  const entry = glossary[termId]
  const text = displayText ?? termId
  if (!entry) return escape(text)
  return `<span class="term" data-action="open-term" data-term="${termId}" title="${escape(entry.plain)}">${escape(text)}<span class="term-icon">?</span></span>`
}

function money(n: number): string {
  return '$' + n.toLocaleString()
}

function expectedPaidFor(claim: EraClaim): number {
  return claim.lines.reduce((s, l) => {
    const fee = feeMap[l.cpt]
    return s + (fee ? fee.contractAllowed : 0)
  }, 0)
}

function actualPaidFor(claim: EraClaim): number {
  return claim.lines.reduce((s, l) => s + l.paid, 0)
}

function render(): string {
  if (state.packetSubmitted) {
    return renderHeader() + renderVictory() + renderTermPopover() + renderBriefingPopover() + renderAppealModal()
  }
  return `
    ${renderHeader()}
    ${renderHospitalIntro()}
    ${!state.briefingDone ? renderBriefingInline() : `
      ${renderEraPanel()}
      ${renderFeeSchedulePanel()}
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
        <h1>Specter <span class="muted">@ L25</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./">← back to game</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          An eighth prototype, sibling to the others. This one
          hinges on contract-vs-paid variance: an ${term('835')} arrived
          showing four claims paid. They <em>look</em> paid.
          One isn't — the payer paid against the prior year's
          ${term('fee schedule')} on a chest-x-ray line and
          quietly absorbed the difference into a
          ${term('CO-45')} adjustment. First prototype where
          the input is a successful payment, not a denial.
          See the <a href="#design-notes">design notes</a>.
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
        The April ${term('835')} from BCBS posted overnight.
        Four claims in one ${term('ERA')} — three small E&Ms and a chest
        x-ray. Bola, the ${term('AR analyst')}, drops the
        printout on your desk. "Looks fine. But the
        contract-vs-paid report flagged this batch. Something's
        underpaid; I can't tell which one."
      </p>
      <p>
        You spread the ${term('ERA')} next to BCBS's 2026-A
        ${term('fee schedule')}. The total paid looks roughly
        right. The line-level numbers will tell you where the
        variance is.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The numbers on
        the page slide a half-pixel left, then settle. You're
        somewhere else.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : "Different shape from the others. Listen up."}</span>
    </div>
    <div class="briefing-body">
      <p>
        "This one is the Specter. ${term('underpayment', 'Underpayment')}.
        Hardest fight in the building because the claim
        already <em>paid</em> — there's no denial letter to
        read, no CARC to argue with. The payer paid <em>less
        than they owe</em>, hid the difference inside a
        ${term('CO-45')} adjustment, and walked away."
      </p>
      <p>
        "AR analysts call this a ${term('contract-vs-paid variance')}.
        The contract says X, the ${term('ERA')} says Y, X minus Y is what
        you fight for. It's small per claim — $28 here. It
        adds up to millions across a hospital."
      </p>
      <p>
        "Two issues:"
      </p>
      <ul>
        <li>
          Verify each claim against
          the ${term('fee schedule')} below. Click 'Verify'
          on each row — the math will surface the variance,
          if any. Three of these are clean. One isn't.
        </li>
        <li>
          Once you've found the
          underpayment, file with the right shortfall and the
          right reason. Wrong shortfall = denied appeal.
          Wrong reason = routed to the wrong queue and lost
          for a month. Read the line carefully.
        </li>
      </ul>
      <p>
        "The Specter looks like nothing's wrong. That's the
        whole game. Look closer."
      </p>
      <p class="briefing-sign">"The Specter looks like nothing's wrong. That's the whole game. — D."</p>
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

function renderEraPanel(): string {
  return `
    <section class="era-panel">
      <div class="era-h">
        <span class="era-tag">${term('835')} · BCBS PPO · ICN 2026-04-15-883</span>
        <span class="era-sub">Four claims. Click any row to expand line-level detail. Use 'Verify' to check against the contract.</span>
      </div>
      <table class="era-table">
        <thead>
          <tr>
            <th>Patient</th>
            <th>DOS</th>
            <th>CPTs</th>
            <th class="right">Billed</th>
            <th class="right">Paid</th>
            <th class="right">Adjusted</th>
            <th>Verify</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${state.era.map(c => renderEraRow(c)).join('')}
        </tbody>
      </table>
    </section>
  `
}

function renderEraRow(c: EraClaim): string {
  const cpts = c.lines.map(l => l.cpt).join(' + ')
  const billed = c.lines.reduce((s, l) => s + l.billed, 0)
  const paid = actualPaidFor(c)
  const adjusted = c.lines.reduce((s, l) => s + l.adjusted, 0)
  const expanded = state.expandedClaimId === c.id
  const flagged = state.flaggedClaimId === c.id
  let verifyCell = ''
  if (!c.verified) {
    verifyCell = `<button class="btn small" data-action="verify-claim" data-id="${c.id}">Verify</button>`
  } else if (c.varianceCents === 0 || c.varianceCents === undefined) {
    verifyCell = `<span class="verify-result match">✓ match</span>`
  } else {
    verifyCell = `<span class="verify-result variance">⚠ ${money(c.varianceCents)} short</span>`
  }
  let flagCell = ''
  if (c.verified && c.varianceCents && c.varianceCents > 0) {
    flagCell = flagged
      ? `<span class="flagged-badge">FLAGGED</span>`
      : `<button class="btn small primary" data-action="flag-claim" data-id="${c.id}">Flag underpayment</button>`
  } else if (c.verified) {
    flagCell = `<span class="muted-cell">—</span>`
  } else {
    flagCell = `<span class="muted-cell">—</span>`
  }
  const variantClass = flagged ? 'flagged' : c.verified && (c.varianceCents ?? 0) > 0 ? 'variance' : c.verified ? 'verified' : ''
  return `
    <tr class="era-row ${variantClass} ${expanded ? 'open' : ''}" data-action="toggle-era" data-id="${c.id}">
      <td>${escape(c.patient)}</td>
      <td>${escape(c.dos)}</td>
      <td><code>${escape(cpts)}</code></td>
      <td class="right">${money(billed)}</td>
      <td class="right">${money(paid)}</td>
      <td class="right">${money(adjusted)}</td>
      <td>${verifyCell}</td>
      <td>${flagCell}</td>
    </tr>
    ${expanded ? `
      <tr class="era-detail-row">
        <td colspan="8">
          ${renderClaimDetail(c)}
        </td>
      </tr>
    ` : ''}
  `
}

function renderClaimDetail(c: EraClaim): string {
  return `
    <div class="claim-detail">
      <div class="detail-h">Service lines · ${escape(c.id)}</div>
      <table class="line-table">
        <thead>
          <tr><th>CPT</th><th>Description</th><th class="right">Billed</th><th class="right">Paid</th><th class="right">Adjusted</th><th class="right">Contract</th><th class="right">Variance</th><th>CARC</th></tr>
        </thead>
        <tbody>
          ${c.lines.map(l => {
            const fee = feeMap[l.cpt]
            const contract = fee ? fee.contractAllowed : null
            const variance = (contract !== null && c.verified) ? contract - l.paid : null
            return `
              <tr>
                <td><code>${escape(l.cpt)}</code></td>
                <td>${fee ? escape(fee.label) : '<span class="muted-cell">—</span>'}</td>
                <td class="right">${money(l.billed)}</td>
                <td class="right">${money(l.paid)}</td>
                <td class="right">${money(l.adjusted)}</td>
                <td class="right ${c.verified ? 'visible' : 'hidden-until-verify'}">${contract !== null ? money(contract) : '—'}</td>
                <td class="right ${c.verified ? 'visible' : 'hidden-until-verify'} ${variance !== null && variance > 0 ? 'shortfall' : ''}">${variance !== null && variance !== 0 ? money(variance) : '—'}</td>
                <td>${l.carcs.map(cc => `<span class="carc">${escape(cc)}</span>`).join(' ')}</td>
              </tr>
            `
          }).join('')}
        </tbody>
      </table>
      ${c.verified ? '' : `
        <div class="detail-hint">
          Click <strong>Verify</strong> on the row above to compute contract-vs-paid for these line items.
        </div>
      `}
    </div>
  `
}

function renderFeeSchedulePanel(): string {
  return `
    <section class="fee-panel">
      <div class="fee-h">
        <span class="fee-tag">CONTRACT · BCBS PPO 2026-A · ${term('fee schedule')}</span>
        <span class="fee-sub">The contracted allowed amount per CPT. This is the source of truth for what BCBS owes you.</span>
      </div>
      <table class="fee-table">
        <thead><tr><th>CPT</th><th>Description</th><th class="right">Allowed</th><th>Notes</th></tr></thead>
        <tbody>
          ${feeSchedule.map(f => `
            <tr>
              <td><code>${escape(f.cpt)}</code></td>
              <td>${escape(f.label)}</td>
              <td class="right">${money(f.contractAllowed)}</td>
              <td class="notes">${f.notes ? escape(f.notes) : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </section>
  `
}

function renderAppealLauncher(): string {
  const detected = state.resolvedIssues.has('detect')
  const appealed = state.resolvedIssues.has('appeal')
  if (!detected) {
    return `
      <section class="appeal-launcher idle">
        <div class="al-h">
          <span class="al-tag">UNDERPAYMENT APPEAL</span>
          <span class="al-sub">Available after you flag the underpayment. Verify each row, find the variance, then flag it.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="appeal-launcher ${appealed ? 'done' : 'active'}">
      <div class="al-h">
        <span class="al-tag">UNDERPAYMENT APPEAL · ${appealed ? 'FILED' : 'READY'}</span>
        <span class="al-sub">${appealed
          ? 'Appeal lodged with BCBS. Recoupment will appear in next cycle\'s 835.'
          : 'File the appeal with the right shortfall amount and the right reason.'}</span>
      </div>
      ${appealed ? '' : `
        <div class="al-body">
          <button class="btn primary" data-action="open-appeal">
            File underpayment appeal
          </button>
        </div>
      `}
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
          <span class="amend-tag">UNDERPAYMENT APPEAL · BCBS · CLM-C</span>
          <span class="amend-sub">Pick the shortfall + reason combination that matches the contract.</span>
        </div>
        <div class="amend-context">
          <strong>Patient C — Halima Saleh — DOS 2026-03-15.</strong>
          71046 (chest x-ray) was paid $14 against a 2026-A contracted rate of $42.
        </div>
        <ul class="amend-options">
          ${appealOptions.map((opt, i) => {
            const fb = state.appealFeedback?.idx === i ? state.appealFeedback : null
            return `
              <li class="amend-option ${fb && !opt.correct ? 'rejected' : ''}"
                  data-action="pick-appeal" data-idx="${i}">
                <div class="amend-option-h">
                  <span class="appeal-shortfall"><code>${escape(opt.shortfall)}</code></span>
                  <span class="appeal-reason">${escape(opt.reason)}</span>
                </div>
                ${fb ? `<div class="amend-option-fb">${escape(fb.message)}</div>` : ''}
              </li>
            `
          }).join('')}
        </ul>
        <p class="amend-hint-text">
          Both the shortfall amount and the reason matter. Wrong reason routes the appeal to the wrong queue at BCBS.
        </p>
      </div>
    </div>
  `
}

function renderChecklist(): string {
  const allResolved = state.resolvedIssues.size === issues.length
  return `
    <section class="checklist">
      <div class="checklist-h">Specter checklist — ${state.resolvedIssues.size} of ${issues.length} steps complete</div>
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
      <button class="btn submit ${allResolved ? '' : 'disabled'}"
              ${allResolved ? '' : 'disabled'}
              data-action="submit">
        CLOSE OUT — APPEAL ON FILE
      </button>
      ${state.failedAttempts > 0 ? `<div class="fail-counter">Wrong picks so far: ${state.failedAttempts}.</div>` : ''}
      ${state.feedback ? `<div class="feedback fb-${state.feedbackKind}">${escape(state.feedback)}</div>` : ''}
      ${state.lastRecap ? `
        <div class="recap">
          <div class="recap-h">What you just did</div>
          <p>${escape(state.lastRecap)}</p>
        </div>
      ` : ''}
    </section>
  `
}

const RECAP: CaseRecap = CASE_RECAPS['specter']

function renderVictory(): string {
  return `
    <section class="victory">
      <h2>The Specter pays the difference.</h2>
      <p class="register hospital">Hospital, two weeks later.</p>
      <p>
        BCBS reprocesses the chest x-ray line at the 2026-A
        rate. The corrected 835 lands with a $28 recoupment
        line. Bola adds the find to her log: thirty-fifth
        underpayment caught this quarter, $4,200 recovered.
        The contract-vs-paid report keeps catching them; you
        keep filing.
      </p>
      <p class="register waiting-room">Waiting Room.</p>
      <p>
        The Specter is gone. Where it was, a small ledger is
        sitting open on a table — a single line in green ink:
        <em>BCBS · clm-C · 71046 · $28 recovered · 2026-04-30</em>.
        The page turns itself.
      </p>
      <button class="btn primary" data-action="reset">Run it again</button>
      <a class="back-link inline" href="./">← back to game</a>
    </section>
    ${renderCaseRecap(RECAP)}
  `
}

function renderTermPopover(): string {
  if (!state.openTermId) return ''
  const entry = glossary[state.openTermId]
  if (!entry) return ''
  return `
    <div class="term-popover-backdrop">
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

function renderDesignNotes(): string {
  return `
    <section class="design-notes" id="design-notes">
      <h2>Design notes — what this prototype tests</h2>
      <div class="notes-grid">
        <div>
          <h3>What's different from the others</h3>
          <ul>
            <li><b>Hunting contract-vs-paid variance.</b> First prototype where the input is a successful 835, not a denial. The Specter looks like everything is fine. The puzzle is finding what isn't.</li>
            <li><b>The math is the puzzle.</b> Compare contract-allowed to actually-paid, line by line. Three claims match; one shows a $28 short. No form to fix — a number to find.</li>
            <li><b>Detection precedes appeal.</b> The appeal launcher is locked until the player has flagged the right claim. Models the AR analyst's actual workflow: variance report first, appeal second.</li>
            <li><b>Pedagogically distinctive distractor in the appeal modal.</b> Wrong shortfall ($46) is the *adjustment* (billed - paid). Right answer is contract - paid. Players who confuse the two get gentle correction.</li>
            <li><b>Reason matters as much as math.</b> Right shortfall + wrong reason = appeal goes to the wrong queue. Mirrors real life: a med-nec appeal on a rate-mismatch issue stalls for a month.</li>
            <li><b>Late-curriculum mood.</b> By L7 the player has seen Dana's voice grow shorter and sharper. The Specter is one of the harder fights — quiet, careful, unforgiving.</li>
          </ul>
        </div>
        <div>
          <h3>What this prototype proves (or tries to)</h3>
          <ul>
            <li>The framework absorbs payment-side encounters without breaking — same hospital intro, fall, Dana voice, checklist, submit; only the middle changed.</li>
            <li>A line-level math comparison can carry teaching weight equal to a citation builder, with very different game-feel.</li>
            <li>Hidden-until-verified columns (contract / variance) make the player do the comparison rather than read it; small but real difference in pedagogy.</li>
            <li>"Looks paid" is teachable as a default mode the AR analyst has to actively distrust.</li>
            <li>A two-axis appeal pick (shortfall × reason) reads as more nuanced than a single-axis pick without bloating the UI.</li>
          </ul>
        </div>
      </div>
      <p class="notes-cta">
        Side-by-side comparison: open
        <a href="./cob-cascade-spider-prototype.html">COB Cascade Spider</a>
        for the other payment-side prototype (multi-payer coordination
        cascade) — the Spider is about getting the payer order right;
        Specter is about catching what got paid wrong. Same shape,
        different math.
      </p>
    </section>
  `
}

// === Interactions ===

function setFeedback(text: string, kind: 'good' | 'bad' | 'neutral' = 'neutral') {
  state.feedback = text
  state.feedbackKind = kind
}

function toggleEra(id: string) {
  state.expandedClaimId = state.expandedClaimId === id ? null : id
}

function verifyClaim(id: string) {
  const c = state.era.find(e => e.id === id)
  if (!c) return
  if (c.verified) return
  const expected = expectedPaidFor(c)
  const actual = actualPaidFor(c)
  c.verified = true
  c.varianceCents = expected - actual
  // Open the detail row so the player sees the variance column populate.
  state.expandedClaimId = id
}

function flagClaim(id: string) {
  if (state.resolvedIssues.has('detect')) return
  if (id !== TRUE_FLAGGED_ID) {
    state.failedAttempts += 1
    state.flagFeedback = {
      id,
      message: `That row's variance is $0 — it paid at contract. Look at the line-level table for any row with a positive variance column.`,
    }
    setFeedback(state.flagFeedback.message, 'bad')
    state.lastRecap = ''
    return
  }
  state.flaggedClaimId = id
  state.resolvedIssues.add('detect')
  const issue = issues.find(i => i.id === 'detect')!
  setFeedback("Underpayment flagged. Appeal launcher is now active.", 'good')
  state.lastRecap = issue.recap
}

function pickAppeal(idx: number) {
  if (state.resolvedIssues.has('appeal')) return
  const opt = appealOptions[idx]
  if (!opt) return
  if (!opt.correct) {
    state.failedAttempts += 1
    state.appealFeedback = { idx, message: opt.feedback }
    return
  }
  state.appealOpen = false
  state.appealFeedback = null
  state.resolvedIssues.add('appeal')
  const issue = issues.find(i => i.id === 'appeal')!
  setFeedback(`Appeal filed: ${opt.shortfall} shortfall · ${opt.reason}`, 'good')
  state.lastRecap = issue.recap
}

function attemptSubmit() {
  if (state.resolvedIssues.size < issues.length) return
  state.packetSubmitted = true
  notifyParentVictory('specter')
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  state.era = initialEra.map(c => ({ ...c, lines: c.lines.map(l => ({ ...l })) }))
  state.expandedClaimId = null
  state.flaggedClaimId = null
  state.flagFeedback = null
  state.appealOpen = false
  state.appealSelectedIdx = null
  state.appealFeedback = null
  state.resolvedIssues = new Set()
  state.failedAttempts = 0
  state.feedback = ''
  state.feedbackKind = 'neutral'
  state.lastRecap = ''
  state.packetSubmitted = false
}

function dismissBriefing() { state.briefingDone = true; state.briefingOpen = false }
function showBriefing() { state.briefingOpen = true }
function closeBriefing() { state.briefingOpen = false }
function openAppeal() { state.appealOpen = true; state.appealFeedback = null }
function closeAppeal() { state.appealOpen = false; state.appealFeedback = null }
function openTerm(termId: string) { state.openTermId = termId }
function closeTerm() { state.openTermId = null }

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
    case 'toggle-era':
      // Don't toggle expansion when clicking the verify or flag buttons themselves.
      if (target.tagName === 'BUTTON' || target.closest('button')) return
      if (el.dataset.id) toggleEra(el.dataset.id)
      break
    case 'verify-claim':
      e.stopPropagation()
      if (el.dataset.id) verifyClaim(el.dataset.id)
      break
    case 'flag-claim':
      e.stopPropagation()
      if (el.dataset.id) flagClaim(el.dataset.id)
      break
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

// === Mount ===

// Specter-specific CSS — ERA panel + line table + verify badges, fee
// schedule reference, appeal launcher, two-axis appeal modal.
// Base styles via BASE_CSS.
const css = districtVars('billing') + BASE_CSS + `
  /* ERA panel */
  .era-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .era-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .era-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .era-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .era-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .era-table th, .era-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #232a36; }
  .era-table th { font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-dim); }
  .era-table th.right, .era-table td.right { text-align: right; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .era-row { cursor: pointer; transition: background 0.15s; }
  .era-row:hover { background: rgba(255,255,255,0.025); }
  .era-row.open { background: rgba(255,255,255,0.04); }
  .era-row.verified td { color: var(--ink); }
  .era-row.variance td { color: var(--ink); background: rgba(239, 91, 123, 0.06); }
  .era-row.flagged td { background: rgba(126, 226, 193, 0.08); border-bottom-color: #2c5547; }
  .verify-result { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 3px 8px; border-radius: 3px; }
  .verify-result.match { color: var(--good); background: rgba(126, 226, 193, 0.12); border: 1px solid #2c5547; }
  .verify-result.variance { color: var(--bad); background: rgba(239, 91, 123, 0.12); border: 1px solid #4a2a32; }
  .flagged-badge { font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); background: rgba(138, 217, 196, 0.12); border: 1px solid #2c5547; padding: 3px 8px; border-radius: 3px; }
  .muted-cell { color: var(--ink-dim); }

  .btn.small { padding: 4px 10px; font-size: 11.5px; }

  .era-detail-row td { padding: 0; background: rgba(0,0,0,0.18); }
  .claim-detail { padding: 12px 16px; border-left: 3px solid var(--accent); margin: 0 8px; }
  .detail-h { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin-bottom: 8px; }
  .line-table { width: 100%; border-collapse: collapse; font-size: 12px; }
  .line-table th, .line-table td { text-align: left; padding: 5px 8px; border-bottom: 1px dashed #232a36; }
  .line-table th { font-size: 10px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; }
  .line-table th.right, .line-table td.right { text-align: right; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .hidden-until-verify { color: var(--ink-dim); opacity: 0.4; font-style: italic; }
  .hidden-until-verify::before { content: "?"; color: var(--ink-dim); }
  .hidden-until-verify { font-style: italic; }
  td.right.hidden-until-verify { /* keep as-is */ }
  .visible.shortfall { color: var(--bad); font-weight: 700; }
  .carc { font-size: 10px; color: var(--ink-dim); background: rgba(138, 147, 163, 0.1); padding: 1px 6px; border-radius: 2px; margin-right: 3px; font-family: ui-monospace, monospace; }
  .detail-hint { margin-top: 10px; padding: 8px 12px; background: var(--panel-2); border-radius: 4px; font-size: 12px; color: var(--ink-dim); font-style: italic; line-height: 1.5; }

  /* Fee schedule */
  .fee-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent-2); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .fee-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .fee-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent-2); }
  .fee-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .fee-table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .fee-table th, .fee-table td { text-align: left; padding: 7px 10px; border-bottom: 1px solid #232a36; }
  .fee-table th { font-size: 10.5px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; }
  .fee-table th.right, .fee-table td.right { text-align: right; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-weight: 600; }
  .fee-table td.notes { color: var(--ink-dim); font-size: 11.5px; font-style: italic; }

  /* Appeal launcher */
  .appeal-launcher { background: var(--panel); border: 1px solid #232a36; border-left-width: 4px; border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .appeal-launcher.idle { border-left-color: #2a3142; opacity: 0.6; }
  .appeal-launcher.active { border-left-color: var(--accent-2); }
  .appeal-launcher.done { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126, 226, 193, 0.04), transparent); }
  .al-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
  .al-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .appeal-launcher.idle .al-tag { color: var(--ink-dim); }
  .appeal-launcher.active .al-tag { color: var(--accent-2); }
  .appeal-launcher.done .al-tag { color: var(--good); }
  .al-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .al-body { margin-top: 6px; }

  /* Wider amend modal for two-axis appeal picks (shortfall × reason). */
  .amend-modal { max-width: 720px; }
  .amend-option-h { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
  .appeal-shortfall { font-size: 14px; }
  .appeal-shortfall code { font-weight: 700; color: var(--ink); letter-spacing: 0.04em; }
  .appeal-reason { font-size: 12.5px; color: var(--ink); flex: 1; }

  /* Recap uses Specter coral-mint instead of warm orange. */
  .recap { background: rgba(138, 217, 196, 0.06); border-color: #2c5547; }
  .recap-h { color: var(--accent); }
`

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
