// ASP/WAC Apothecary @ L5 — drug-pricing Case. Underpayment on a
// Part B J-code claim where the hospital billed in vials but the
// HCPCS billable unit is 10mg. Three different "prices" to
// reconcile (ASP, WAC, AWP) and a unit conversion that turns one
// vial into 40 billable units.
//
// Cousin to Specter (underpayment hiding behind CO-45) and Case
// Rate Specter (pick the right pricing formula). The lever here is
// the HCPCS billable unit definition and the quarterly ASP file.
//
// Actions:
//   - PRICE: identify which "price" governs (ASP, WAC, AWP, CDM) for
//     a Part B drug claim. Only one is right.
//   - CONVERT: turn the dose given (mg) into HCPCS billable units.
//     Wrong conversion = wrong shortfall = denied appeal.
//   - APPEAL: file with the corrected unit count + ASP-based
//     expected.
//
// Demonstrates: drug pricing has more "prices" than any other
// part of RCM. Reading the right column of the right file is the
// muscle.
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

// ===== Domain types =====

interface PriceOption {
  id: string
  label: string
  /** Per-unit (10mg) rate. */
  perUnit: number
  governs: boolean
  feedback: string
}

interface UnitOption {
  id: string
  label: string
  units: number
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
  verb: 'price' | 'convert' | 'appeal'
}

interface GlossaryEntry {
  term: string
  plain: string
}

// ===== Encounter data =====

const PATIENT = 'Audrey Chen'
const DRUG = 'Bevacizumab (Avastin)'
const HCPCS_CODE = 'J9035'
const HCPCS_DESCRIPTOR = 'Injection, bevacizumab, 10 mg' // i.e. 1 unit = 10mg
const DOSE_MG = 400
const UNIT_SIZE_MG = 10
const CORRECT_UNITS = DOSE_MG / UNIT_SIZE_MG // 40
const ASP_PER_UNIT = 21.50
const WAC_PER_UNIT = 28.40
const AWP_PER_UNIT = 32.10
const CDM_PER_UNIT = 36.00
const ASP_MULTIPLIER = 1.06 // contract follows ASP+6%
const BILLED_UNITS = 1     // hospital billed in vials
const EXPECTED_PAYMENT = CORRECT_UNITS * ASP_PER_UNIT * ASP_MULTIPLIER
const ACTUAL_PAYMENT = BILLED_UNITS * ASP_PER_UNIT * ASP_MULTIPLIER
const SHORTFALL = EXPECTED_PAYMENT - ACTUAL_PAYMENT

const priceOptions: PriceOption[] = [
  {
    id: 'asp',
    label: 'ASP +6% — Medicare/contract benchmark, quarterly file',
    perUnit: ASP_PER_UNIT,
    governs: true,
    feedback: `ASP is the Medicare Part B benchmark — drugs administered in the outpatient setting price at ASP+6%, updated quarterly. Anthem\'s contract mirrors this for J-codes. Per-unit rate ${money(ASP_PER_UNIT)} × 1.06 = ${money(ASP_PER_UNIT * ASP_MULTIPLIER)} per 10mg unit.`,
  },
  {
    id: 'wac',
    label: 'WAC — Wholesale Acquisition Cost (manufacturer published)',
    perUnit: WAC_PER_UNIT,
    governs: false,
    feedback: 'WAC is the manufacturer\'s list price before rebates and discounts. Used for pharmacy contracting and some Medicaid scenarios, but NOT what Medicare or Anthem pays for outpatient J-codes. Picking WAC overstates the expected by ~32% and gets the appeal denied for asking outside the contract.',
  },
  {
    id: 'awp',
    label: 'AWP — Average Wholesale Price (legacy)',
    perUnit: AWP_PER_UNIT,
    governs: false,
    feedback: 'AWP is the legacy "list price" still printed in the Red Book; called "Ain\'t What\'s Paid" in pharmacy circles because nobody actually pays AWP anymore. Some old retail-pharmacy contracts still reference it; modern Part B drug claims do not. Wrong column.',
  },
  {
    id: 'cdm',
    label: 'CDM — chargemaster gross charge',
    perUnit: CDM_PER_UNIT,
    governs: false,
    feedback: 'Chargemaster is the rack rate. For drugs, payers virtually never pay CDM — they pay ASP+6% (Medicare) or some negotiated equivalent. CDM is what shows on a self-pay sticker, not a basis for Part B reimbursement.',
  },
]

const unitOptions: UnitOption[] = [
  {
    id: 'one-vial',
    label: '1 unit (the dose was one vial)',
    units: 1,
    correct: false,
    feedback: 'This is what was billed and exactly the bug. HCPCS J-codes don\'t bill in vials — they bill in the descriptor unit. J9035\'s descriptor is "10 mg," so 1 unit = 10mg, regardless of vial size. The 400mg dose is 40 units.',
  },
  {
    id: 'forty-units',
    label: '40 units (400mg ÷ 10mg per unit)',
    units: 40,
    correct: true,
    feedback: `Right. HCPCS descriptor is "10 mg" — every 10mg administered is 1 billable unit. ${DOSE_MG}mg ÷ ${UNIT_SIZE_MG}mg/unit = ${CORRECT_UNITS} units. The conversion is the entire bug.`,
  },
  {
    id: 'four-units',
    label: '4 units (per 100mg, since the vial was 100mg)',
    units: 4,
    correct: false,
    feedback: 'The vial size doesn\'t matter for HCPCS unit math — only the descriptor matters. J9035 says 10mg per unit. Treating it as 100mg/unit divides the right answer by 10 and still underbills.',
  },
  {
    id: 'four-hundred-units',
    label: '400 units (1 unit per mg)',
    units: 400,
    correct: false,
    feedback: 'Treating 1 unit = 1mg ignores the descriptor entirely and inflates the units 10×. Anthem\'s adjudication system would either deny the line on max-units edits or recoup it later.',
  },
]

const appealOptions: AppealOption[] = [
  {
    shortfall: '$' + Math.round(SHORTFALL).toLocaleString(),
    reason: `J9035 billed in vials (1 unit) instead of HCPCS descriptor units (10mg = 1 unit); ${DOSE_MG}mg should bill ${CORRECT_UNITS} units. Reprice at ASP+6%.`,
    correct: true,
    feedback: `Right shortfall, right reason. ${CORRECT_UNITS} units × ${money(ASP_PER_UNIT)} × 1.06 = ${money(EXPECTED_PAYMENT)}. Paid ${money(ACTUAL_PAYMENT)}. Shortfall ${money(SHORTFALL)}. Anthem reprocesses on the corrected claim.`,
  },
  {
    shortfall: '$' + Math.round(WAC_PER_UNIT * CORRECT_UNITS - ACTUAL_PAYMENT).toLocaleString(),
    reason: 'Underpayment — should have paid WAC',
    correct: false,
    feedback: 'Wrong basis. Anthem\'s J-code rate is ASP+6%, not WAC. Filing for WAC asks for a reimbursement formula the contract doesn\'t use; appeal denied.',
  },
  {
    shortfall: '$' + Math.round(SHORTFALL).toLocaleString(),
    reason: 'Medical necessity for the bevacizumab dose was not adjudicated',
    correct: false,
    feedback: 'Right amount, wrong queue. Med-nec routes to clinical review for 30+ days. The shortfall is *unit-count*, not clinical.',
  },
  {
    shortfall: '$' + Math.round(EXPECTED_PAYMENT).toLocaleString(),
    reason: `J9035 billed in vials (1 unit) instead of HCPCS descriptor units (10mg = 1 unit); ${DOSE_MG}mg should bill ${CORRECT_UNITS} units. Reprice at ASP+6%.`,
    correct: false,
    feedback: `That\'s the expected total, not the shortfall. Shortfall = expected − paid = ${money(EXPECTED_PAYMENT)} − ${money(ACTUAL_PAYMENT)} = ${money(SHORTFALL)}.`,
  },
]

const issues: Issue[] = [
  {
    id: 'price',
    label: 'Price: which rate governs Part B J-codes?',
    recap: `ASP +6% governs. Medicare Part B drugs price at the quarterly Average Sales Price plus a 6% margin; Anthem\'s contract mirrors Medicare for J-codes. ${money(ASP_PER_UNIT)} per ${UNIT_SIZE_MG}mg unit × 1.06 = ${money(ASP_PER_UNIT * ASP_MULTIPLIER)}.`,
    verb: 'price',
  },
  {
    id: 'convert',
    label: `Convert: ${DOSE_MG}mg dose → HCPCS billable units.`,
    recap: `${DOSE_MG}mg ÷ ${UNIT_SIZE_MG}mg/unit = ${CORRECT_UNITS} units. The HCPCS descriptor governs — not the vial size, not the manufacturer's label.`,
    verb: 'convert',
  },
  {
    id: 'appeal',
    label: 'Appeal: file the corrected claim with the right shortfall.',
    recap: `Filed at ${money(SHORTFALL)} shortfall against the right reason (unit-count error, ASP+6% basis). Anthem reprocesses; the difference posts to next cycle's 835.`,
    verb: 'appeal',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'ASP': {
    term: 'ASP (Average Sales Price)',
    plain: "Quarterly average price drug manufacturers report to CMS, net of rebates and discounts. Medicare Part B drug payments are nominally set at ASP + 6% — that's the federal benchmark for outpatient drug reimbursement. **Real Medicare math is reduced by the BCA sequester** (2% reduction applied to the entire Part B payment), so net Medicare payment is closer to ASP + 4.3%. Commercial contracts mirror the nominal ASP+6% (no sequester). CMS publishes the ASP file every quarter; per-HCPCS-unit rates update January, April, July, October.",
  },
  'biosimilars': {
    term: 'Biosimilars (J9035 vs Q-codes)',
    plain: "Most large-molecule biologic drugs now have biosimilar versions with their own HCPCS J-code or Q-code. Bevacizumab originator is J9035; biosimilars include Mvasi (Q5107), Zirabev (Q5118), Vegzelma (Q5129), Alymsys (Q5126). Each has its own ASP rate; switching from originator to biosimilar can drop drug spend significantly. Real-world bevacizumab use in 2026 is dominated by biosimilars; the Case uses J9035 for clarity but in your environment the active code is likely a Q-code.",
  },
  'WAC': {
    term: 'WAC (Wholesale Acquisition Cost)',
    plain: "Manufacturer's published list price to wholesalers, before rebates and discounts. Used in some pharmacy contracts and Medicaid drug scenarios; NOT what Medicare or most commercial payers pay for outpatient J-codes. WAC is typically 20-40% higher than ASP because it doesn't reflect the rebate channel.",
  },
  'AWP': {
    term: 'AWP (Average Wholesale Price)',
    plain: "Legacy 'list price' published in the Red Book and Blue Book pricing compendia. Called \"Ain't What's Paid\" in pharmacy because nobody actually pays AWP anymore. Some legacy retail-pharmacy contracts still reference it; modern Part B drug claims don't. AWP is usually 20-25% above WAC, which means it's even further from what payers pay than WAC is.",
  },
  'J-code': {
    term: 'J-code (HCPCS drug code)',
    plain: "HCPCS Level II code for drugs administered other than oral — injectables, infusions, immunizations. Each J-code has a descriptor specifying the billable unit (\"10mg,\" \"1mg,\" \"per vial,\" \"50 units\"). The descriptor unit is what gets billed; vial size is irrelevant. Forgetting that is the most common drug-claim error.",
  },
  'billable unit': {
    term: 'Billable unit (HCPCS)',
    plain: "The dose specified in the HCPCS descriptor — what one \"unit\" represents on the claim. J9035 (bevacizumab) is \"10 mg\" — every 10mg administered is 1 unit. A 400mg dose bills 40 units, not 1 (the vial), not 4 (the vials, if it came in 100mg vials). The descriptor governs.",
  },
  'HCPCS': {
    term: 'HCPCS (Healthcare Common Procedure Coding System)',
    plain: "Two-level code set. Level I IS CPT (AMA-licensed). Level II is the CMS-maintained companion — drugs (J-codes), DME (E-codes), Medicare-specific services (G-codes), pending tech (K-codes). Level II is free and required for outpatient drugs and supplies that don't have a CPT.",
  },
  'CO-45': {
    term: 'CO-45 (charge exceeds fee schedule)',
    plain: "Most common CARC on commercial 835s. \"We paid the contracted amount; the rest is a contractual write-off.\" Usually innocuous, but when the contracted amount is wrong (right rate, wrong units; right units, wrong rate), CO-45 quietly absorbs the variance. Same Specter trap as in the original Specter prototype.",
  },
  'Part B': {
    term: 'Medicare Part B',
    plain: "Medicare's outpatient benefit. Covers physician services, outpatient hospital, durable medical equipment, and most outpatient drugs (administered drugs, not pharmacy fills — those are Part D). Part B drug claims price at ASP+6%. Roughly half of Medicare's drug spend rides on Part B.",
  },
}

// ===== Runtime state =====

const state = {
  briefingDone: false,
  briefingOpen: false,
  appliedPriceId: null as string | null,
  appliedUnitId: null as string | null,
  appealOpen: false,
  appealSelectedIdx: null as number | null,
  appealFeedback: null as { idx: number; message: string } | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

// ===== Render =====

function term(termId: string, displayText?: string): string {
  const entry = glossary[termId]
  const text = displayText ?? termId
  if (!entry) return escape(text)
  return `<span class="term" data-action="open-term" data-term="${termId}" title="${escape(entry.plain)}">${escape(text)}<span class="term-icon">?</span></span>`
}

function money(n: number): string { return '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',') }

function render(): string {
  if (state.packetSubmitted) {
    return renderHeader() + renderVictory() + renderTermPopover() + renderBriefingPopover() + renderAppealModal()
  }
  return `
    ${renderHeader()}
    ${renderHospitalIntro()}
    ${!state.briefingDone ? renderBriefingInline() : `
      ${renderClaimSummary()}
      ${renderPricePanel()}
      ${renderConvertPanel()}
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
        <h1>ASP/WAC Apothecary <span class="muted">@ L5 — first sketch (drug pricing)</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./prototypes.html">← back to catalog</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          ${escape(PATIENT)}'s Part B oncology infusion. ${escape(DRUG)},
          ${term('J-code')} ${HCPCS_CODE}. ${DOSE_MG}mg dose billed
          as 1 unit (interpreted as one vial). The
          ${term('billable unit')} per HCPCS descriptor is 10mg —
          so the right answer is 40 units. ${term('ASP')}+6%
          governs reimbursement; ${term('WAC')} doesn\'t. The math
          is the appeal. See the
          <a href="#design-notes">design notes</a>.
        </p>
      `}
    </header>
  `
}

function renderHospitalIntro(): string {
  return `
    <section class="hospital-intro">
      <div class="register hospital">HOSPITAL · oncology billing</div>
      <p>
        Liana from pharmacy walks the chart over: ${escape(PATIENT)}\'s
        third bevacizumab infusion. ${DOSE_MG}mg administered. Anthem
        ${term('Part B')} paid ${money(ACTUAL_PAYMENT)} on the line.
      </p>
      <p>
        "That\'s short. Either we billed wrong or they paid wrong.
        Half the J-code variance reports come back like this. Walk
        the unit math; tell me which side blew it."
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The HCPCS file slides
        a half-pixel left, then settles. Three columns of "prices"
        reveal themselves: ASP, WAC, AWP. Only one matters.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'Drugs have more "prices" than anything else in RCM. Read the right column.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "Drug pricing is a maze. ${term('ASP')}, ${term('WAC')},
        ${term('AWP')}, the chargemaster — they\'re all real
        numbers, only one matters per claim, and the wrong one
        just sits there looking authoritative. ${term('Part B')}
        J-codes price at ASP+6%, full stop."
      </p>
      <p>
        "Three issues:"
      </p>
      <ul>
        <li>
          Pick the right reimbursement
          basis. Decoys are real prices that don\'t apply.
        </li>
        <li>
          ${DOSE_MG}mg dose → how many
          ${term('billable unit', 'HCPCS billable units')}?
          The descriptor governs (10mg = 1 unit), not the vial,
          not the milligram. Most J-code variance is unit-math.
        </li>
        <li>
          Same modal as the Specters —
          pick the shortfall amount + the reason. One combo
          right, four wrong.
        </li>
      </ul>
      <p class="briefing-sign">"The unit is the appeal. — D."</p>
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
        <span class="cs-tag">CLAIM · Anthem PPO Part B · ICN 2026-04-22-114</span>
        <span class="cs-sub">${escape(DRUG)} infusion. Hospital billed 1 unit; expected 40.</span>
      </div>
      <table class="cs-table">
        <tr><th>Patient</th><td>${escape(PATIENT)}</td></tr>
        <tr><th>${term('J-code')}</th><td><code>${HCPCS_CODE}</code> · ${escape(HCPCS_DESCRIPTOR)}</td></tr>
        <tr><th>Dose administered</th><td>${DOSE_MG} mg</td></tr>
        <tr><th>${term('billable unit', 'Billable units billed')}</th><td><strong class="bad-text">${BILLED_UNITS} unit (vial)</strong></td></tr>
        <tr><th>Anthem paid</th><td>${money(ACTUAL_PAYMENT)} <span class="cs-tag-mini">${term('CO-45')} ${money(BILLED_UNITS * ASP_PER_UNIT * (ASP_MULTIPLIER - 1))} adjusted</span></td></tr>
      </table>
    </section>
  `
}

function renderPricePanel(): string {
  const done = state.resolvedIssues.has('price')
  return `
    <section class="price-panel ${done ? 'done' : ''}">
      <div class="pp-h">
        <span class="pp-tag">REIMBURSEMENT BASIS · 4 candidate "prices"</span>
        <span class="pp-sub">${done
          ? 'ASP +6% governs. WAC, AWP, CDM are decoys.'
          : 'Pick the price that governs Part B drug claims. The other three are real prices that don\'t apply here.'}</span>
      </div>
      <ul class="price-list">
        ${priceOptions.map(p => renderPriceRow(p)).join('')}
      </ul>
      ${state.transientFeedback && priceOptions.some(p => p.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('price') : ''}
    </section>
  `
}

function renderPriceRow(p: PriceOption): string {
  const applied = state.appliedPriceId === p.id
  const locked = state.appliedPriceId !== null && !applied
  return `
    <li class="price-opt ${applied ? 'applied' : ''}">
      <button class="price-btn" data-action="apply-price" data-id="${p.id}" ${locked ? 'disabled' : ''}>
        <span class="price-label">${escape(p.label)}</span>
        <span class="price-amount">${money(p.perUnit)} per ${UNIT_SIZE_MG}mg unit</span>
        ${applied ? '<span class="price-badge applied">APPLIED</span>' : ''}
      </button>
    </li>
  `
}

function renderConvertPanel(): string {
  const unlocked = state.resolvedIssues.has('price')
  const done = state.resolvedIssues.has('convert')
  if (!unlocked) {
    return `
      <section class="convert-panel locked">
        <div class="cv-h">
          <span class="cv-tag idle">UNIT CONVERSION</span>
          <span class="cv-sub">Locked until the reimbursement basis is set.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="convert-panel ${done ? 'done' : 'active'}">
      <div class="cv-h">
        <span class="cv-tag ${done ? 'done' : 'active'}">UNIT CONVERSION · ${DOSE_MG}mg → HCPCS units</span>
        <span class="cv-sub">${done
          ? `${DOSE_MG}mg ÷ ${UNIT_SIZE_MG}mg/unit = ${CORRECT_UNITS} units. The descriptor governs.`
          : `HCPCS descriptor: "${HCPCS_DESCRIPTOR}". Pick the right unit count.`}</span>
      </div>
      <ul class="unit-list">
        ${unitOptions.map(u => renderUnitRow(u)).join('')}
      </ul>
      ${state.transientFeedback && unitOptions.some(u => u.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('convert') : ''}
    </section>
  `
}

function renderUnitRow(u: UnitOption): string {
  const applied = state.appliedUnitId === u.id
  const locked = state.appliedUnitId !== null && !applied
  return `
    <li class="unit-opt ${applied ? 'applied' : ''}">
      <button class="unit-btn" data-action="apply-unit" data-id="${u.id}" ${locked ? 'disabled' : ''}>
        <span class="unit-label">${escape(u.label)}</span>
        <span class="unit-count">${u.units} unit${u.units === 1 ? '' : 's'}</span>
        ${applied ? '<span class="unit-badge applied">APPLIED</span>' : ''}
      </button>
    </li>
  `
}

function renderAppealLauncher(): string {
  const ready = state.resolvedIssues.has('price') && state.resolvedIssues.has('convert')
  const done = state.resolvedIssues.has('appeal')
  const cls = !ready ? 'idle' : (done ? 'done' : 'active')
  return `
    <section class="appeal-launcher ${cls}">
      <div class="al-h">
        <span class="al-tag">${done ? 'APPEAL FILED' : 'APPEAL · WAITING ON YOU'}</span>
        <span class="al-sub">${done
          ? `Filed ${money(SHORTFALL)} short on unit-count + ASP basis.`
          : !ready
            ? 'Locked until the price basis + unit count are set.'
            : `Expected ${money(EXPECTED_PAYMENT)}. Paid ${money(ACTUAL_PAYMENT)}. Pick the right shortfall and reason.`}</span>
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
          <span class="amend-sub">${escape(PATIENT)} · ${HCPCS_CODE} · ICN 2026-04-22-114</span>
        </div>
        <div class="amend-context">
          <strong>Anthem paid ${money(ACTUAL_PAYMENT)}</strong> against expected ${money(EXPECTED_PAYMENT)}
          (${CORRECT_UNITS} units × ${money(ASP_PER_UNIT)} × 1.06 ASP+6%).
          Pick the shortfall + reason combo that matches the contract.
        </div>
        <ul class="amend-options">
          ${appealOptions.map((o, i) => renderAppealOptionRow(o, i)).join('')}
        </ul>
        <p class="amend-hint-text">Wrong shortfall = denied appeal. Wrong reason = routed to the wrong queue.</p>
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
        Submit corrected claim · ${money(SHORTFALL)} shortfall
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

const RECAP: CaseRecap = CASE_RECAPS['asp-wac-apothecary']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">CORRECTED CLAIM POSTED</div>
      <h2>${money(SHORTFALL)} recovered. Anthem reprocessed on the right unit count.</h2>
      <p>
        ${CORRECT_UNITS} units × ${money(ASP_PER_UNIT)} × 1.06 = ${money(EXPECTED_PAYMENT)}.
        Anthem's adjudication system accepted the corrected claim, ran
        it through their J-code edit table, and posted the difference
        to the next 835.
      </p>
      <p class="muted">
        Drug pricing has more "prices" than any other part of RCM —
        ${term('ASP')}, ${term('WAC')}, ${term('AWP')}, the
        chargemaster, the 340B ceiling, the Medicaid Best Price.
        Reading the right column for the right payer is half the
        skill; the other half is unit math.
      </p>
      <div class="register hospital">HOSPITAL · later that morning</div>
      <p>
        Liana waves the corrected 835 from the pharmacy door. "${escape("Three more like it on the queue.")} Same drug, same pattern. Train
        the team or it just keeps happening."
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
            <li><strong>Three actions:</strong> picking which
            rate governs, converting HCPCS billable units from
            dose, and appealing (same modal pattern as the Specters).</li>
            <li><strong>Drugs have many prices.</strong> ASP, WAC,
            AWP, CDM all live in the same row — only one
            applies. Wrong column = wrong shortfall = denied
            appeal.</li>
            <li><strong>The descriptor governs.</strong> Vial size
            doesn\'t matter for HCPCS units — only the descriptor
            ("10 mg" for J9035) matters.</li>
            <li><strong>The math is the appeal.</strong> Once
            unit-count and price are right, the shortfall is
            mechanical.</li>
          </ul>
        </div>
        <div>
          <h3>Sibling shape</h3>
          <ul>
            <li>Cousin to
            <a href="./specter-prototype.html">Specter</a> and
            <a href="./case-rate-specter-prototype.html">Case Rate Specter</a> —
            same dragon (underpayment behind CO-45), different
            lever (unit math + reimbursement basis).</li>
            <li>Reuses the appeal modal pattern from Specter.</li>
            <li>Builds toward Implant Carve-out Specter @ L6 —
            same "find the line item, match the invoice, refile"
            shape with a different basis.</li>
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

function applyPrice(id: string) {
  const p = priceOptions.find(x => x.id === id)
  if (!p) return
  state.transientFeedback = null
  if (p.governs) {
    state.appliedPriceId = id
    state.resolvedIssues.add('price')
    state.transientFeedback = { id, message: p.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: p.feedback, kind: 'bad' }
  }
}

function applyUnit(id: string) {
  const u = unitOptions.find(x => x.id === id)
  if (!u) return
  state.transientFeedback = null
  if (u.correct) {
    state.appliedUnitId = id
    state.resolvedIssues.add('convert')
    state.transientFeedback = { id, message: u.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: u.feedback, kind: 'bad' }
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
    notifyParentVictory('asp-wac-apothecary')
  }
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  state.appliedPriceId = null
  state.appliedUnitId = null
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
    case 'apply-price': if (el.dataset.id) applyPrice(el.dataset.id); break
    case 'apply-unit':  if (el.dataset.id) applyUnit(el.dataset.id);  break
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

// ===== Per-prototype CSS =====

const css = districtVars('billing') + BASE_CSS + `
  .claim-summary { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .cs-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .cs-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .cs-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .cs-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .cs-table th, .cs-table td { text-align: left; padding: 6px 10px; border-bottom: 1px dashed #232a36; vertical-align: top; }
  .cs-table th { font-size: 11px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; width: 200px; }
  .bad-text { color: var(--bad); }
  .cs-tag-mini { font-size: 11px; color: var(--ink-dim); margin-left: 8px; }

  .price-panel, .convert-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent-2); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .price-panel.done, .convert-panel.done { border-left-color: var(--good); }
  .convert-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .pp-h, .cv-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .pp-tag, .cv-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent-2); }
  .cv-tag.idle { color: var(--ink-dim); }
  .pp-tag.done, .cv-tag.done { color: var(--good); }
  .pp-sub, .cv-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .price-list, .unit-list { list-style: none; padding-left: 0; margin: 0; }
  .price-opt, .unit-opt { margin-bottom: 6px; }
  .price-btn, .unit-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 12px 14px; text-align: left; display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; font: inherit; transition: all 0.15s; position: relative; }
  .price-btn:hover:not(:disabled), .unit-btn:hover:not(:disabled) { background: #232b3a; border-color: var(--accent-2); }
  .price-btn:disabled, .unit-btn:disabled { opacity: 0.45; cursor: default; }
  .price-opt.applied .price-btn, .unit-opt.applied .unit-btn { border-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); opacity: 1; }
  .price-label, .unit-label { flex: 1; font-size: 13px; padding-right: 80px; }
  .price-amount, .unit-count { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 12.5px; color: var(--ink-dim); }
  .price-badge.applied, .unit-badge.applied { position: absolute; top: 10px; right: 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; font-weight: 700; }

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
      if (state.appealOpen) { closeAppeal(); changed = true }
      if (changed) rerender()
    }
  })
}

mount()
