// Implant Carve-out Specter @ L6 — high-cost implant unflagged at
// billing, rolled into the DRG case rate when it should have
// carved out. Cousin to Case Rate Specter (same contract; different
// clause).
//
// Actions:
//   - ITEMIZE: sort 6 line items into "carve-out eligible" vs
//     "rolled into the DRG case rate."
//   - INVOICE-MATCH: 4 manufacturer invoices in the file; pick the
//     one that matches the carve-out item.
//   - APPEND: file the corrected claim with the invoice attached
//     and the right calculation.
//
// Demonstrates: implant carve-outs are buried in contract appendices
// and easy to miss at charge-capture. The fix isn't a coding change —
// it's a billing-side flag that triggers a different pricing path.
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

// ===== Domain types =====

type LineKind = 'carveout' | 'rolled-in'

interface LineItem {
  id: string
  /** CDM/HCPCS/REV identifier shown on the claim. */
  code: string
  description: string
  amount: number
  kind: LineKind
  reason: string
}

interface Invoice {
  id: string
  invoiceNum: string
  vendor: string
  description: string
  date: string
  patient: string
  amount: number
  /** True iff this invoice matches the carve-out line item for this case. */
  correct: boolean
  reason: string
}

interface AppendOption {
  id: string
  label: string
  amount: number
  correct: boolean
  feedback: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'itemize' | 'invoice' | 'append'
}

interface GlossaryEntry {
  term: string
  plain: string
}

// ===== Encounter data =====

const PATIENT = 'Greg Watson'
const DRG = '460'
const DRG_LABEL = 'Spinal fusion except cervical, no MCC'
const DOS = '2026-04-09'
const TOTAL_CHARGES = 87_500
const CASE_RATE = 18_500
const CARVEOUT_THRESHOLD = 5_000
const CARVEOUT_MARKUP = 1.20
const IMPLANT_INVOICE_COST = 24_000
const CARVEOUT_PAYMENT = IMPLANT_INVOICE_COST * CARVEOUT_MARKUP // 28,800
const PAID = CASE_RATE
const EXPECTED = CASE_RATE + CARVEOUT_PAYMENT
const SHORTFALL = CARVEOUT_PAYMENT

const lineItems: LineItem[] = [
  {
    id: 'spinal-hardware',
    code: 'CDM-IMPLANT-SPINAL-CAGE',
    description: 'Lumbar spinal fusion hardware (cage, pedicle screws, plates)',
    amount: 38_000,
    kind: 'carveout',
    reason: `This is the carve-out. Single implantable device above the $${CARVEOUT_THRESHOLD.toLocaleString()} threshold; per contract appendix, pays at invoice cost +20%. Charge-capture didn't flag it; it rolled silently into the DRG case rate.`,
  },
  {
    id: 'or-time',
    code: 'REV 0360',
    description: 'OR services, surgeon + anesthesia time',
    amount: 14_500,
    kind: 'rolled-in',
    reason: 'Standard OR time. Rolls into the DRG 460 case rate. Not implant-eligible — the carve-out is for the device itself, not the procedure that places it.',
  },
  {
    id: 'roomboard',
    code: 'REV 0110',
    description: 'Room and board, 3 days',
    amount: 8_400,
    kind: 'rolled-in',
    reason: 'Per-diem. Inlier stay (≤ 5 days), DRG case rate covers it. No carve-out applies.',
  },
  {
    id: 'pharmacy',
    code: 'REV 0250',
    description: 'Pharmacy — perioperative meds',
    amount: 1_900,
    kind: 'rolled-in',
    reason: 'Soft-coded pharmacy, rolls into DRG. Not an implantable; carve-out doesn\'t apply.',
  },
  {
    id: 'lab',
    code: 'REV 0300',
    description: 'Lab — pre-op + post-op panels',
    amount: 720,
    kind: 'rolled-in',
    reason: 'Lab work. Rolls into DRG case rate as routine ancillary. Carve-out is for high-cost implantables only.',
  },
  {
    id: 'pt',
    code: 'REV 0420',
    description: 'PT eval + 2 sessions',
    amount: 480,
    kind: 'rolled-in',
    reason: 'Inpatient PT. Rolls into DRG. Therapy services are not implants.',
  },
]

const invoices: Invoice[] = [
  {
    id: 'inv-correct',
    invoiceNum: 'STRYKER-2026-039841',
    vendor: 'Stryker Spine',
    description: 'TLIF cage + pedicle screw set (T1; for case lumbar fusion)',
    date: '2026-04-08',
    patient: PATIENT,
    amount: IMPLANT_INVOICE_COST,
    correct: true,
    reason: `Right invoice. Stryker Spine, dated one day before DOS, patient name matches, $${IMPLANT_INVOICE_COST.toLocaleString()} for the lumbar TLIF cage + screws used in this surgery. This is what gets attached to the corrected claim.`,
  },
  {
    id: 'inv-wrong-patient',
    invoiceNum: 'STRYKER-2026-039839',
    vendor: 'Stryker Spine',
    description: 'TLIF cage + pedicle screw set',
    date: '2026-04-08',
    patient: 'Marcia Webb',
    amount: 24_400,
    correct: false,
    reason: 'Same vendor, similar description, similar amount — but the patient name is wrong. Attaching this invoice to Greg Watson\'s claim is a fraud/audit issue. Read the patient name; the implant tracking system pairs each device with the recipient.',
  },
  {
    id: 'inv-wrong-vendor',
    invoiceNum: 'MEDTRONIC-2026-7741',
    vendor: 'Medtronic',
    description: 'Anterior cervical plate (level C5-C6)',
    date: '2026-04-09',
    patient: PATIENT,
    amount: 18_200,
    correct: false,
    reason: 'Right patient, right date, but the wrong device for this surgery. The DRG is *lumbar* fusion (DRG 460); a cervical plate is for a different procedure (DRG 471/472). Different vendor, different anatomy, different surgery.',
  },
  {
    id: 'inv-or-supplies',
    invoiceNum: 'CARDINAL-2026-A8821',
    vendor: 'Cardinal Health',
    description: 'OR supply pack — drapes, gloves, sutures, irrigation',
    date: '2026-04-09',
    patient: PATIENT,
    amount: 1_280,
    correct: false,
    reason: 'Right patient, right date — but OR consumables aren\'t carve-out items. The carve-out is for high-cost implantables above $5k. This invoice rolls into the DRG case rate alongside other OR supplies.',
  },
]

const appendOptions: AppendOption[] = [
  {
    id: 'invoice-plus-20',
    label: `Invoice cost +20% — $${IMPLANT_INVOICE_COST.toLocaleString()} × 1.20 = $${CARVEOUT_PAYMENT.toLocaleString()}`,
    amount: CARVEOUT_PAYMENT,
    correct: true,
    feedback: `Right formula. Contract appendix sets implant carve-out at invoice cost +20% above the $${CARVEOUT_THRESHOLD.toLocaleString()} threshold. Greg's hardware invoice was $${IMPLANT_INVOICE_COST.toLocaleString()}; the carve-out adds $${CARVEOUT_PAYMENT.toLocaleString()} on top of the DRG case rate.`,
  },
  {
    id: 'cdm-charge',
    label: `Chargemaster gross charge — $${(38_000).toLocaleString()}`,
    amount: 38_000,
    correct: false,
    feedback: 'CDM is the rack rate, not the contract basis. The carve-out pays *invoice +20%*, not the chargemaster line. Filing for $38,000 asks for what the contract doesn\'t allow.',
  },
  {
    id: 'invoice-only',
    label: `Invoice cost only — $${IMPLANT_INVOICE_COST.toLocaleString()} (no markup)`,
    amount: IMPLANT_INVOICE_COST,
    correct: false,
    feedback: 'Close — right basis (invoice), wrong markup. The contract markup is +20% explicitly. Filing for invoice-only undercounts the carve-out by 20%.',
  },
  {
    id: 'invoice-plus-50',
    label: `Invoice cost +50% — $${IMPLANT_INVOICE_COST.toLocaleString()} × 1.50 = $${(IMPLANT_INVOICE_COST * 1.5).toLocaleString()}`,
    amount: IMPLANT_INVOICE_COST * 1.5,
    correct: false,
    feedback: 'Wrong markup. Some contracts use +50% for implants but Anthem\'s appendix sets +20%. Read the appendix; don\'t guess.',
  },
]

const issues: Issue[] = [
  {
    id: 'itemize',
    label: 'Itemize: which line item qualifies for the implant carve-out?',
    recap: `One line qualifies — the spinal hardware (CDM-IMPLANT-SPINAL-CAGE) at $38,000 charge / $${IMPLANT_INVOICE_COST.toLocaleString()} invoice cost. Five other lines (OR time, room/board, pharmacy, lab, PT) roll into the DRG 460 case rate.`,
    verb: 'itemize',
  },
  {
    id: 'invoice',
    label: 'Invoice-match: pick the manufacturer invoice that pairs to the carve-out line.',
    recap: `Stryker Spine invoice STRYKER-2026-039841, $${IMPLANT_INVOICE_COST.toLocaleString()}, dated 2026-04-08, ${escape(PATIENT)}'s name. Right vendor, right anatomy (lumbar TLIF), right patient, right date.`,
    verb: 'invoice',
  },
  {
    id: 'append',
    label: 'Append: file the corrected claim with the invoice + right calculation.',
    recap: `Filed the carve-out at invoice cost +20% = $${CARVEOUT_PAYMENT.toLocaleString()}. Anthem reprocesses; the next 835 carries the carve-out payment on top of the existing DRG case rate.`,
    verb: 'append',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'implant carve-out': {
    term: 'Implant carve-out',
    plain: "Contract clause that pulls high-cost implantable devices out of the DRG case rate and pays them separately. Formula varies by contract: +20% over invoice (this Case), +15% or +25% in others, invoice-only (no markup) in some, capped at $25k or $50k per device in others. Threshold also varies ($5k-$10k per item). Common for spine, joint replacement, cardiac (pacemakers, ICDs), and high-cost neuro/ortho hardware. STACKING WITH STOPLOSS: many contracts net the implant carve-out from total charges *before* applying stoploss/outlier — so a $312k case with a $24k implant becomes a $288k base for the stoploss trigger calculation. Order of operations matters; misreading it skews the math.",
  },
  'DRG case rate': {
    term: 'DRG case rate',
    plain: "Fixed payment for an inpatient stay grouped to a specific DRG. Designed to cover routine costs (room, OR time, ancillaries) but NOT high-cost outliers like spinal hardware or implantable cardiac devices. Without an implant carve-out clause, those devices effectively bill at zero — the case rate is the payment in full.",
  },
  'invoice cost': {
    term: 'Invoice cost',
    plain: "What the manufacturer charged the hospital for the device. Different from CDM (the gross charge to the patient/payer) and from any negotiated discount the hospital has. Invoice cost is the basis the carve-out clause uses; the +20% markup approximates the hospital's cost of carrying inventory + handling.",
  },
  'CDM': {
    term: 'CDM (Chargemaster)',
    plain: "Hospital master price list. Carries the gross charge for every billable. Not the basis for implant carve-out reimbursement (which uses invoice cost), but does generate the line that triggers the carve-out flag in the first place.",
  },
  'CO-45': {
    term: 'CO-45 (charge exceeds fee schedule)',
    plain: "Most common CARC on commercial 835s. \"We paid the contracted amount; the rest is a contractual write-off.\" When the contracted amount missed an applicable carve-out, CO-45 quietly absorbs the variance. Same Specter trap.",
  },
  'DRG': {
    term: 'DRG (Diagnosis-Related Group)',
    plain: "Bundled inpatient classification. Greg's surgery groups to DRG 460 (Spinal fusion except cervical, no MCC). The grouper takes diagnoses + procedures + complications and outputs one DRG per stay. Most large payers pay a fixed amount per DRG, modulated by hospital weight.",
  },
  'TLIF': {
    term: 'TLIF (Transforaminal Lumbar Interbody Fusion)',
    plain: "Spine surgery technique that places an interbody cage + pedicle screws to fuse two adjacent lumbar vertebrae. The hardware (cage + screws + plates) is the implant; the surgery is the procedure. Carve-out is for the hardware, not the surgery.",
  },
}

// ===== Runtime state =====

interface LineState { pick: LineKind | null }
const state = {
  briefingDone: false,
  briefingOpen: false,
  lineStates: lineItems.reduce((m, l) => { m[l.id] = { pick: null }; return m }, {} as Record<string, LineState>),
  pickedInvoiceId: null as string | null,
  appliedAppendId: null as string | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isItemizeDone(): boolean {
  return lineItems.every(l => state.lineStates[l.id].pick === l.kind)
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
      ${renderItemizePanel()}
      ${renderInvoicePanel()}
      ${renderAppendPanel()}
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
        <h1>Implant Carve-out Specter <span class="muted">@ L6 — first sketch</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./prototypes.html">← back to catalog</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          ${escape(PATIENT)}'s lumbar fusion (${term('DRG')} 460).
          Anthem paid ${money(CASE_RATE)} on the case rate. The
          spinal hardware — ${money(IMPLANT_INVOICE_COST)} ${term('invoice cost', 'invoice')} — should
          have ${term('implant carve-out', 'carved out')} at
          invoice +20%, paid separately. It rolled into the DRG.
          Same Specter shape: underpayment behind ${term('CO-45')}.
          See the
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
        Bola walks ${escape(PATIENT)}'s file across. ${term('DRG')} 460,
        ${term('TLIF')} on a herniated L4-L5. Charges ${money(TOTAL_CHARGES)},
        Anthem paid ${money(PAID)} on the case rate, ${term('CO-45')} on
        the rest. "${escape("Charge-capture didn't flag the implant.")} The
        hardware was $${IMPLANT_INVOICE_COST.toLocaleString()} invoice and
        the contract appendix carves out anything over $${CARVEOUT_THRESHOLD.toLocaleString()}.
        We left $${CARVEOUT_PAYMENT.toLocaleString()} on the table."
      </p>
      <p>
        Three steps: identify the carve-out line on the claim,
        match it to the manufacturer invoice in the file, file
        the corrected claim with the invoice attached.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The line items
        slide a half-pixel left, then settle. Four invoices fan
        out beside them, waiting to be matched.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'Same Specter shape, different lever — the contract appendix.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "Sibling to <a href="./case-rate-specter-prototype.html">Case Rate Specter</a> —
        same contract, different clause. That one was the outlier
        provision; this one is the ${term('implant carve-out')}.
        DRG case rates don't cover $24k of hardware; the
        appendix carves it out so we don't eat the cost."
      </p>
      <p>
        "Three issues:"
      </p>
      <ul>
        <li>
          Six line items on the claim.
          Mark each as carve-out eligible or rolled into the DRG.
          Exactly one is eligible.
        </li>
        <li>
          Four invoices in the
          file. Pick the one for Greg's specific hardware. Decoys
          are real invoices for adjacent cases — wrong patient,
          wrong anatomy, or supplies-not-implants. The patient name
          and the device match are both required.
        </li>
        <li>
          Apply the contract formula:
          invoice cost +20%. Decoys are CDM gross charge (wrong
          basis), invoice-only (wrong markup), and +50% (wrong
          markup, different contract)."
        </li>
      </ul>
      <p>
        "The contract is right; ${escape(PAYER_SHORT())} adjudicated against what
        the claim said. We just didn't tell them about the
        carve-out line. Tell them now."
      </p>
      <p class="briefing-sign">"Pull the invoice. The math is in the invoice. — D."</p>
    </div>
  `
}

function PAYER_SHORT() { return 'Anthem' }

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
        <span class="cs-tag">CLAIM · Anthem PPO · ICN 2026-04-15-227</span>
        <span class="cs-sub">${escape(PATIENT)} · ${term('DRG')} ${DRG} · ${escape(DRG_LABEL)}</span>
      </div>
      <table class="cs-table">
        <tr><th>Stay</th><td>${escape(DOS)}, 3 days · inlier</td></tr>
        <tr><th>Total charges</th><td>${money(TOTAL_CHARGES)}</td></tr>
        <tr><th>Anthem paid (DRG case rate)</th><td>${money(PAID)} <span class="cs-mini">${term('CO-45')} ${money(TOTAL_CHARGES - PAID)} adjusted</span></td></tr>
        <tr><th>Hardware invoice cost</th><td><strong class="bad-text">${money(IMPLANT_INVOICE_COST)}</strong> · ${term('implant carve-out', 'carve-out eligible')}</td></tr>
        <tr><th>Carve-out threshold</th><td>${money(CARVEOUT_THRESHOLD)} (this exceeds it)</td></tr>
      </table>
    </section>
  `
}

function renderItemizePanel(): string {
  const done = state.resolvedIssues.has('itemize')
  return `
    <section class="itemize-panel ${done ? 'done' : ''}">
      <div class="ip-h">
        <span class="ip-tag">CLAIM LINE ITEMS · 6 lines</span>
        <span class="ip-sub">${done
          ? 'One carve-out (spinal hardware). Five rolled into DRG.'
          : 'For each line, mark "carve-out eligible" or "rolled into DRG case rate."'}</span>
      </div>
      <ul class="li-list">
        ${lineItems.map(l => renderLineRow(l)).join('')}
      </ul>
      ${state.transientFeedback && lineItems.some(l => l.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('itemize') : ''}
    </section>
  `
}

function renderLineRow(l: LineItem): string {
  const ss = state.lineStates[l.id]
  const decided = ss.pick !== null
  const correct = decided && ss.pick === l.kind
  return `
    <li class="li-row ${decided && correct ? 'correct ' + l.kind : ''}">
      <div class="li-meta">
        <code class="li-code">${escape(l.code)}</code>
        <div class="li-desc">${escape(l.description)}</div>
        <div class="li-amt">${money(l.amount)}</div>
      </div>
      <div class="li-actions">
        ${decided && correct ? `
          <span class="li-badge ${ss.pick}">${ss.pick === 'carveout' ? 'CARVE-OUT' : 'rolled into DRG'}</span>
          <button class="btn small ghost" data-action="reset-line" data-id="${l.id}">↺ undo</button>
        ` : `
          <button class="btn small ghost" data-action="pick-line" data-id="${l.id}" data-pick="carveout">Carve-out</button>
          <button class="btn small ghost" data-action="pick-line" data-id="${l.id}" data-pick="rolled-in">Rolled in</button>
        `}
      </div>
    </li>
  `
}

function renderInvoicePanel(): string {
  const unlocked = state.resolvedIssues.has('itemize')
  const done = state.resolvedIssues.has('invoice')
  if (!unlocked) {
    return `
      <section class="invoice-panel locked">
        <div class="iv-h">
          <span class="iv-tag idle">INVOICE FILE</span>
          <span class="iv-sub">Locked until the carve-out line is identified.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="invoice-panel ${done ? 'done' : 'active'}">
      <div class="iv-h">
        <span class="iv-tag ${done ? 'done' : 'active'}">INVOICE FILE · 4 invoices for the surgery week</span>
        <span class="iv-sub">${done
          ? `Stryker Spine invoice STRYKER-2026-039841 — right vendor, right device, right patient.`
          : `Pick the invoice that matches Greg's lumbar TLIF hardware. Decoys are real invoices from adjacent surgeries.`}</span>
      </div>
      <ul class="inv-list">
        ${invoices.map(i => renderInvoiceRow(i)).join('')}
      </ul>
      ${state.transientFeedback && invoices.some(i => i.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('invoice') : ''}
    </section>
  `
}

function renderInvoiceRow(i: Invoice): string {
  const picked = state.pickedInvoiceId === i.id
  const locked = state.pickedInvoiceId !== null && !picked
  return `
    <li class="inv-opt ${picked ? 'picked' : ''}">
      <button class="inv-btn" data-action="pick-invoice" data-id="${i.id}" ${locked ? 'disabled' : ''}>
        <div class="inv-h-row">
          <code class="inv-num">${escape(i.invoiceNum)}</code>
          <span class="inv-vendor">${escape(i.vendor)}</span>
          <span class="inv-amount">${money(i.amount)}</span>
        </div>
        <div class="inv-desc">${escape(i.description)}</div>
        <div class="inv-meta">${escape(i.date)} · patient: ${escape(i.patient)}</div>
        ${picked ? '<span class="inv-badge picked">SELECTED</span>' : ''}
      </button>
    </li>
  `
}

function renderAppendPanel(): string {
  const unlocked = state.resolvedIssues.has('itemize') && state.resolvedIssues.has('invoice')
  const done = state.resolvedIssues.has('append')
  if (!unlocked) {
    return `
      <section class="append-panel locked">
        <div class="ap-h">
          <span class="ap-tag idle">APPEND · CALCULATION</span>
          <span class="ap-sub">Locked until the line + invoice are confirmed.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="append-panel ${done ? 'done' : 'active'}">
      <div class="ap-h">
        <span class="ap-tag ${done ? 'done' : 'active'}">APPEND · APPLY THE CARVE-OUT FORMULA</span>
        <span class="ap-sub">${done
          ? `Filed at invoice +20% = ${money(CARVEOUT_PAYMENT)}.`
          : `Pick the contract formula. Decoys are nearby formulas from other contracts; only invoice +20% applies here.`}</span>
      </div>
      <ul class="append-list">
        ${appendOptions.map(o => renderAppendOption(o)).join('')}
      </ul>
      ${state.transientFeedback && appendOptions.some(o => o.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('append') : ''}
    </section>
  `
}

function renderAppendOption(o: AppendOption): string {
  const applied = state.appliedAppendId === o.id
  const locked = state.appliedAppendId !== null && !applied
  return `
    <li class="append-opt ${applied ? 'applied' : ''}">
      <button class="append-btn" data-action="apply-append" data-id="${o.id}" ${locked ? 'disabled' : ''}>
        <span class="append-label">${escape(o.label)}</span>
        ${applied ? '<span class="append-badge applied">APPLIED</span>' : ''}
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
      <div class="checklist-h">CARVE-OUT CORRECTION · 3 issues to resolve</div>
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
        Submit corrected claim · ${money(CARVEOUT_PAYMENT)} carve-out
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

const RECAP: CaseRecap = CASE_RECAPS['implant-carveout-specter']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">CARVE-OUT FILED</div>
      <h2>${money(CARVEOUT_PAYMENT)} recovered on top of the DRG case rate.</h2>
      <p>
        Stryker invoice attached, ${money(CARVEOUT_PAYMENT)} carve-out
        line added to the corrected claim. Anthem reprocesses on the
        appendix; the recoupment posts on the next 835. Total
        Anthem reimbursement on Greg's stay: ${money(EXPECTED)} —
        DRG case rate plus implant carve-out.
      </p>
      <p class="muted">
        Implant carve-outs live in contract appendices, get missed
        at charge-capture, and quietly underpay surgeries that
        should have paid for the hardware. The fix is mechanical
        once the carve-out flag is set; the muscle is reading the
        appendix in the first place.
      </p>
      <div class="register hospital">HOSPITAL · later that morning</div>
      <p>
        Bola pulls a stack of orthopedic + neuro DRGs from the
        last 90 days. "Twenty cases. We're going to find another
        Greg in here. Probably more."
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
            <li><strong>Three moves:</strong> itemize
            (sort lines into carve-out vs DRG), invoice-match
            (read manufacturer invoices and match patient + device),
            append (apply the right formula from the contract
            appendix).</li>
            <li><strong>The fix isn't coding.</strong> No CPT/CDM
            change. The carve-out flag is a billing-side
            decision; charge-capture should have set it.</li>
            <li><strong>Invoice fraud is real.</strong> The
            wrong-patient invoice decoy is a serious audit risk;
            attaching an invoice that doesn't match the patient
            is a False Claims Act exposure.</li>
            <li><strong>Markup is contract-specific.</strong>
            +20% (Anthem here) vs +50% (other contracts) vs +0%
            (some contracts pay invoice cost flat). Read the
            appendix — guessing costs the appeal.</li>
          </ul>
        </div>
        <div>
          <h3>Sibling shape</h3>
          <ul>
            <li>Direct sibling to
            <a href="./case-rate-specter-prototype.html">Case Rate Specter</a> —
            same contract; different clause (outlier vs implant
            carve-out).</li>
            <li>Cousin to
            <a href="./asp-wac-apothecary-prototype.html">ASP/WAC Apothecary</a> —
            same vendor-invoice / unit-math muscle.</li>
            <li>Cousin to
            <a href="./chemo-bundle-specter-prototype.html">Chemo Bundle Specter</a> —
            opposite shape: that one suppresses J-codes inside
            a case rate; this one elevates a hardware line
            outside the case rate.</li>
            <li>Builds toward Stoploss Reckoner @ L7 (same
            contract, different threshold-trip clause; math gets
            heavier).</li>
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

function pickLine(id: string, pick: LineKind) {
  const l = lineItems.find(x => x.id === id); if (!l) return
  state.transientFeedback = null
  if (l.kind === pick) {
    state.lineStates[id].pick = pick
    state.transientFeedback = { id, message: l.reason, kind: 'good' }
    if (isItemizeDone()) state.resolvedIssues.add('itemize')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: l.reason, kind: 'bad' }
  }
}

function resetLine(id: string) {
  state.lineStates[id].pick = null
  state.resolvedIssues.delete('itemize')
  state.resolvedIssues.delete('invoice')
  state.resolvedIssues.delete('append')
  state.transientFeedback = null
}

function pickInvoice(id: string) {
  const i = invoices.find(x => x.id === id); if (!i) return
  state.transientFeedback = null
  if (i.correct) {
    state.pickedInvoiceId = id
    state.resolvedIssues.add('invoice')
    state.transientFeedback = { id, message: i.reason, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: i.reason, kind: 'bad' }
  }
}

function applyAppend(id: string) {
  const o = appendOptions.find(x => x.id === id); if (!o) return
  state.transientFeedback = null
  if (o.correct) {
    state.appliedAppendId = id
    state.resolvedIssues.add('append')
    state.transientFeedback = { id, message: o.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: o.feedback, kind: 'bad' }
  }
}

function attemptSubmit() {
  if (issues.every(i => state.resolvedIssues.has(i.id))) {
    state.packetSubmitted = true
    notifyParentVictory('implant-carveout-specter')
  }
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  for (const id in state.lineStates) state.lineStates[id] = { pick: null }
  state.pickedInvoiceId = null
  state.appliedAppendId = null
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
    case 'pick-line': if (el.dataset.id && el.dataset.pick) pickLine(el.dataset.id, el.dataset.pick as LineKind); break
    case 'reset-line': if (el.dataset.id) resetLine(el.dataset.id); break
    case 'pick-invoice': if (el.dataset.id) pickInvoice(el.dataset.id); break
    case 'apply-append': if (el.dataset.id) applyAppend(el.dataset.id); break
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

  .itemize-panel, .invoice-panel, .append-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent-2); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .itemize-panel.done, .invoice-panel.done, .append-panel.done { border-left-color: var(--good); }
  .invoice-panel.locked, .append-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .ip-h, .iv-h, .ap-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .ip-tag, .iv-tag, .ap-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent-2); }
  .iv-tag.idle, .ap-tag.idle { color: var(--ink-dim); }
  .ip-tag.done, .iv-tag.done, .ap-tag.done { color: var(--good); }
  .ip-sub, .iv-sub, .ap-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .li-list, .inv-list, .append-list { list-style: none; padding-left: 0; margin: 0; }
  .li-row { display: flex; gap: 14px; align-items: center; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 6px; border-left: 3px solid transparent; flex-wrap: wrap; }
  .li-row.correct.carveout { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); }
  .li-row.correct.rolled-in { border-left-color: var(--ink-dim); opacity: 0.7; }
  .li-meta { flex: 2; min-width: 280px; display: flex; flex-direction: column; gap: 3px; }
  .li-code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 11.5px; color: var(--ink-dim); }
  .li-desc { font-size: 13px; }
  .li-amt { font-family: ui-monospace, monospace; font-size: 12px; color: var(--ink-dim); }
  .li-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .li-badge { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; }
  .li-badge.carveout { background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; }
  .li-badge.rolled-in { background: rgba(138,147,163,0.10); color: var(--ink-dim); border: 1px solid #2a3142; }
  .btn.small { padding: 4px 10px; font-size: 11.5px; }

  .inv-opt { margin-bottom: 6px; }
  .inv-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 12px 14px; text-align: left; font: inherit; transition: all 0.15s; position: relative; display: flex; flex-direction: column; gap: 4px; }
  .inv-btn:hover:not(:disabled) { background: #232b3a; border-color: var(--accent-2); }
  .inv-btn:disabled { opacity: 0.45; cursor: default; }
  .inv-opt.picked .inv-btn { border-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); opacity: 1; }
  .inv-h-row { display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
  .inv-num { font-family: ui-monospace, monospace; font-size: 12px; color: var(--accent-2); background: var(--bg); padding: 2px 8px; border-radius: 3px; }
  .inv-vendor { font-size: 13px; font-weight: 600; }
  .inv-amount { font-family: ui-monospace, monospace; margin-left: auto; font-size: 12.5px; color: var(--ink); }
  .inv-desc { font-size: 12.5px; color: var(--ink); }
  .inv-meta { font-size: 11px; color: var(--ink-dim); }
  .inv-badge.picked { position: absolute; top: 10px; right: 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; font-weight: 700; }

  .append-opt { margin-bottom: 6px; }
  .append-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 11px 14px; text-align: left; font: inherit; transition: all 0.15s; position: relative; }
  .append-btn:hover:not(:disabled) { background: #232b3a; border-color: var(--accent-2); }
  .append-btn:disabled { opacity: 0.45; cursor: default; }
  .append-opt.applied .append-btn { border-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); opacity: 1; }
  .append-label { font-size: 13px; padding-right: 80px; }
  .append-badge.applied { position: absolute; top: 10px; right: 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; font-weight: 700; }

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
      if (changed) rerender()
    }
  })
}

mount()
