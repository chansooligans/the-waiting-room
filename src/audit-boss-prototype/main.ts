// Audit Boss @ L32 (the finale).
//
// The Quarterly Audit. Different shape from every prior
// encounter: this isn't a fight against a payer or a kindness
// to a patient. It's a *defense* of work the player (or
// someone before them) has already done. The auditor walks in
// with three findings on Margaret Holloway's case file. For
// each, the player has to choose:
//
//   - RECEIPT — defend the original coding with chart evidence
//   - AMEND — concede the finding and accept the recoupment
//
// The trick is knowing which is which. Two of the auditor's
// findings are defensible (the chart actually supports the
// codes that were assigned); one is a real billing error
// (duplicate antibiotic charge) that should be conceded
// quickly to avoid a worse outcome later.
//
// Actions: RECEIPT, AMEND. The choice between them is the
// pedagogy — bluffing on a real error reads as compounding;
// folding on defensible coding gives away revenue that was
// rightfully earned.
//
// L10 narrative beat: the audit is the door home. Dana's
// L10 reveal is teased lightly here (a faded photo on the
// auditor's desk, mentioned in passing) per the design doc.
// The prototype keeps focus on the mechanic; the Dana arc
// is the runtime game's job to land.

import { CASES } from '../content/cases'
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

interface Evidence {
  id: string
  source: string
  text: string
  /** Whether attaching this evidence supports the original coding. */
  defends: boolean
  feedback: string
}

interface Finding {
  id: string
  auditorClaim: string
  auditorTone: string
  /** What the original claim coded vs what the auditor is challenging. */
  originalCoding: string
  auditorPosition: string
  /** Recoupment if conceded. */
  recoupmentAmount: number
  /** Right answer. */
  correctVerb: 'receipt' | 'amend'
  /** Available chart evidence to attach if defending. */
  evidenceOptions: Evidence[]
  /** Applied when the player picks RECEIPT correctly. */
  receiptRecap: string
  /** Applied when the player picks AMEND correctly. */
  amendRecap: string
  /** Feedback when the player tries to defend something they should concede. */
  wrongReceiptFeedback: string
  /** Feedback when the player tries to concede something they should defend. */
  wrongAmendFeedback: string
}

interface GlossaryEntry {
  term: string
  plain: string
}

const findings: Finding[] = [
  {
    id: 'principal-dx',
    auditorClaim: "Principal diagnosis A41.01 (sepsis due to MSSA) appears to have been added after the initial admission coding (A41.9). The post-CDI revision is not supported in real-time documentation.",
    auditorTone: "polite, formal",
    originalCoding: 'A41.01 — Sepsis due to MSSA',
    auditorPosition: 'Wants to recoup the DRG difference — argues only A41.9 (sepsis, unspecified) was documented at admission.',
    recoupmentAmount: 8420,
    correctVerb: 'receipt',
    evidenceOptions: [
      {
        id: 'culture-day1',
        source: 'Microbiology — culture report',
        text: 'Blood culture × 2, drawn 2026-04-25 04:30. Preliminary read 2026-04-26 06:00: gram-positive cocci in clusters; final 2026-04-27 09:14: Staphylococcus aureus, methicillin-susceptible (MSSA).',
        defends: true,
        feedback: "This is the receipt. The culture documented MSSA on the day of admission, with final speciation by hospital day 3 — well before the claim was coded. A41.01 was supportable at the time of coding; the auditor's claim that it was added 'after the fact' is wrong.",
      },
      {
        id: 'progress-note-day3',
        source: 'Hospitalist progress note · day 3',
        text: 'Patient afebrile × 24 hr, lactate normalized, transitioning to oral antibiotics. Will discharge to home tomorrow with PO Augmentin × 7 days.',
        defends: false,
        feedback: "Not the right document. This is a discharge-readiness note; it doesn't bear on whether MSSA was documented at admission. The auditor will accept it as background but not as a defense against the principal-dx finding.",
      },
      {
        id: 'discharge-summary',
        source: 'Discharge summary',
        text: 'Final dx: sepsis due to MSSA (A41.01), severe (R65.20), with secondary pneumonia. Patient stable, ambulating, discharged home with outpatient ID follow-up.',
        defends: false,
        feedback: "Right diagnosis, but documenting it on the discharge summary doesn't prove it was supported at the time the principal dx was coded. The auditor's claim is specifically about real-time documentation. The culture report is what answers them.",
      },
    ],
    receiptRecap: "You attached the day-1 blood culture report showing MSSA growth. The auditor reviews it, nods once, marks the finding closed. The DRG difference stays earned.",
    amendRecap: "(You shouldn't have conceded this one — the chart supported A41.01.) Recoupment processed: $8,420. The DRG drops from 870 back to 871; the hospital writes off the difference.",
    wrongReceiptFeedback: "(N/A — this finding's correct action is RECEIPT.)",
    wrongAmendFeedback: "Wait — the chart actually supports A41.01. The day-1 culture report shows MSSA growth from admission. Conceding this one gives up revenue you legitimately earned. Defend it with the culture documentation; don't fold on a defensible position.",
  },
  {
    id: 'severity-mcc',
    auditorClaim: "Severity coding R65.20 (severe sepsis) drives the DRG from 871 to 870. The clinical evidence supporting 'severe' is unclear in the documentation. Recommend review.",
    auditorTone: "data-driven, almost apologetic",
    originalCoding: 'R65.20 — Severe sepsis without septic shock',
    auditorPosition: 'Wants to remove R65.20 → DRG drops from 870 (w/ MCC) to 871 (no MCC). Recoupment: ~$3,200.',
    recoupmentAmount: 3210,
    correctVerb: 'receipt',
    evidenceOptions: [
      {
        id: 'icu-flowsheet',
        source: 'ICU step-down flowsheet · day 1',
        text: 'BP 86/52 on admission, MAP 63 (below 65 threshold). Lactate 4.8 mmol/L. HR 124. UOP 22 mL/hr × 2 hr. Norepinephrine started 0.05 mcg/kg/min, titrated to 0.12.',
        defends: true,
        feedback: "Receipt locked in. MAP < 65 + lactate > 4 + pressor requirement = textbook severe sepsis criteria, all documented in real-time. R65.20 is defensible; DRG 870 stays.",
      },
      {
        id: 'admission-orders',
        source: 'Admission orders',
        text: 'Admit to ICU step-down. NS bolus 30 mL/kg over 60 min. Empiric vanc + zosyn pending cultures. Continuous SpO2 + telemetry monitoring.',
        defends: false,
        feedback: "Standard sepsis admission orders, but doesn't document the *severity*. The auditor will accept this as evidence the patient was being treated for sepsis but not as evidence of severe sepsis specifically. The flowsheet with the actual hemodynamic numbers is what proves R65.20.",
      },
      {
        id: 'pneumonia-cxr',
        source: 'Chest x-ray · day 1',
        text: 'Patchy right lower lobe opacity consistent with bronchopneumonia. Recommend clinical correlation.',
        defends: false,
        feedback: "Documents the pneumonia (a secondary dx) but not the severe sepsis criteria. Wrong receipt — pneumonia doesn't lift the DRG; severe sepsis does.",
      },
    ],
    receiptRecap: "You attached the ICU flowsheet showing MAP < 65, lactate > 4, and pressor requirement. The auditor's analyst checks the boxes one by one, then signs off on R65.20 as supported. The MCC stays.",
    amendRecap: "(Conceding here gives away a defensible code.) Recoupment processed: $3,210. R65.20 is removed; DRG drops to 871.",
    wrongReceiptFeedback: "(N/A — this finding's correct action is RECEIPT.)",
    wrongAmendFeedback: "The flowsheet has all three severe-sepsis criteria documented in real time — MAP < 65, lactate > 4, pressor requirement. Conceding this one is leaving $3,210 on the table that the documentation supports. Don't fold on a defensible severity code.",
  },
  {
    id: 'duplicate-charge',
    auditorClaim: "Pharmacy revenue code 0250 shows two doses of vancomycin on 2026-04-25 at the same time-stamp. Likely double-charge.",
    auditorTone: "matter-of-fact",
    originalCoding: 'Pharmacy charges, day 1: 2 × vancomycin 1g IV @ 06:00',
    auditorPosition: 'Wants to remove the second charge as a duplicate. Recoupment: $340.',
    recoupmentAmount: 340,
    correctVerb: 'amend',
    evidenceOptions: [
      {
        id: 'mar',
        source: 'Medication administration record (MAR) · 2026-04-25',
        text: 'Vancomycin 1g IV — administered 06:00 (RN: K. Patel). Next dose scheduled 18:00.',
        defends: false,
        feedback: "Single dose at 06:00 — only one administration. The pharmacy charge of 2 × vanc at the same time is a billing error, not a clinical one. The chart doesn't defend this; trying to attach the MAR makes the discrepancy worse.",
      },
      {
        id: 'pharmacy-orders',
        source: 'Pharmacy order entry',
        text: 'Vancomycin 1g IV q12h — first dose 06:00. Order placed by Dr. Okafor at 04:48.',
        defends: false,
        feedback: "Order is for a single dose at 06:00, not two. Attaching this would just confirm what the auditor already suspects — the pharmacy charge was duplicated.",
      },
      {
        id: 'second-dose-justification',
        source: '(no chart documentation supports a second 06:00 dose)',
        text: '— no documentation found —',
        defends: false,
        feedback: "There isn't any. The chart shows one dose at 06:00, the order was for one dose at 06:00, but the pharmacy charge sheet shows two. This is a real billing error — concede it cleanly.",
      },
    ],
    receiptRecap: "(N/A — RECEIPT was the wrong call here. Trying to defend a duplicate charge with no supporting documentation usually triggers a more thorough audit.)",
    amendRecap: "You voided the duplicate vancomycin charge. The auditor closes the finding; recoupment is small and clean ($340), and the audit doesn't expand. This is what 'concede the small thing fast' looks like.",
    wrongReceiptFeedback: "There's no documentation that supports a second 06:00 dose — because there wasn't one. The MAR shows one dose; the order was for one dose; the second pharmacy line is a billing error. Trying to defend it would either fail or trigger a deeper audit looking for similar errors. Concede this one cleanly: AMEND.",
    wrongAmendFeedback: "(N/A — this finding's correct action is AMEND.)",
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'RAC': {
    term: 'RAC (Recovery Audit Contractor)',
    plain: "A Medicare-side contractor whose job is to find improper payments — both overpayments (where the provider was paid for something not supportable in the chart) and underpayments (rare; the providers usually find these themselves). RAC audits operate post-payment; the contractor reviews paid claims, identifies findings, and triggers recoupments. RACs are paid a percentage of what they recover, which gives them a strong incentive to find findings.",
  },
  'DRG': {
    term: 'DRG (diagnosis-related group)',
    plain: "Medicare's inpatient bundled-payment unit. Each admission is grouped into a DRG based on the principal diagnosis, secondary diagnoses, procedures, and severity. The DRG determines the payment amount, regardless of the actual length of stay or specific charges. Severity matters: DRG 870 (sepsis w/ MCC) pays substantially more than 871 (sepsis w/o MCC). Audits frequently target DRG severity coding because the financial swing is large.",
  },
  'MCC': {
    term: 'MCC (major complication or comorbidity)',
    plain: "A coded diagnosis flagged as significantly increasing the resource intensity of an admission. Adding an MCC to a DRG usually lifts the payment by $3-10K depending on the base DRG. Severe sepsis (R65.20), acute respiratory failure (J96.0x), acute renal failure (N17.x) are common MCCs. Auditors closely scrutinize MCC coding — the financial swing makes it a frequent finding.",
  },
  'CDI': {
    term: 'CDI (clinical documentation integrity)',
    plain: "The hospital function that bridges medicine and coding — making sure the chart's clinical narrative supports the codes that get assigned. CDI specialists query physicians for clarification ('the patient had pneumonia AND a positive blood culture; can you confirm sepsis?'), update documentation in real time, and prevent the kind of vague-coding that becomes audit findings later. Most hospitals expanded their CDI teams in the 2010s for exactly this reason.",
  },
  'recoupment': {
    term: 'Recoupment',
    plain: "When a payer takes back money already paid. Triggered by audit findings, post-payment reviews, or coding errors discovered after the fact. The amount comes off the next remittance (the payer just reduces what they pay this month) or, for larger amounts, gets billed back to the provider directly. Recoupments are the financial consequence of a finding standing.",
  },
  'IDR': {
    term: 'IDR (Independent Dispute Resolution)',
    plain: "Different mechanism from RAC — IDR is the No Surprises Act process for OON payment disputes between providers and payers. The audit process here is RAC-side: a Medicare contractor reviewing paid claims for documentation defensibility.",
  },
  'documentation defense': {
    term: 'Documentation defense',
    plain: "The skill of pointing at the right page of the chart at the right moment. Most audit findings come down to: was the diagnosis supported in real-time documentation? was the severity proven by hemodynamic numbers? was the service the chart says was rendered actually rendered? Hospitals that do documentation defense well retain most of their findings; hospitals that don't lose 30-40% of audited revenue.",
  },
}

const auditCase = CASES.case_audit_finale

// === Runtime state ===

interface FindingState {
  resolved: boolean
  /** Player's verb choice, once made. */
  verb: 'receipt' | 'amend' | null
  /** Evidence picked for receipts. */
  evidenceId: string | null
  /** Recoupment applied (if any). */
  recoupmentApplied: number
  /** Whether the receipt held (correct evidence) or failed. */
  receiptHeld: boolean
  /** Per-finding feedback during interaction. */
  feedback: string | null
}

const state = {
  briefingDone: false,
  briefingOpen: false,
  /** Modal currently open for which finding. */
  modalFindingId: null as string | null,
  /** Per-finding state. */
  findings: Object.fromEntries(findings.map(f => [f.id, {
    resolved: false,
    verb: null,
    evidenceId: null,
    recoupmentApplied: 0,
    receiptHeld: false,
    feedback: null,
  } as FindingState])) as Record<string, FindingState>,
  /** Whether the player is in the evidence-pick step within the modal. */
  inReceiptStep: false,
  failedAttempts: 0,
  feedback: '' as string,
  feedbackKind: 'neutral' as 'neutral' | 'good' | 'bad',
  lastRecap: '' as string,
  packetSubmitted: false,
  openTermId: null as string | null,
}

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

function totalRecoupment(): number {
  return Object.values(state.findings).reduce((s, f) => s + f.recoupmentApplied, 0)
}

function allResolved(): boolean {
  return Object.values(state.findings).every(f => f.resolved)
}

function render(): string {
  if (state.packetSubmitted) {
    return renderHeader() + renderVictory() + renderTermPopover() + renderBriefingPopover() + renderModal()
  }
  return `
    ${renderHeader()}
    ${renderHospitalIntro()}
    ${!state.briefingDone ? renderBriefingInline() : `
      ${renderClaim()}
      ${renderFindingsList()}
      ${renderChecklist()}
    `}
    ${state.briefingDone ? '' : renderDesignNotes()}
    ${renderTermPopover()}
    ${renderBriefingPopover()}
    ${renderModal()}
  `
}

function renderHeader(): string {
  const recallBtn = state.briefingDone
    ? `<button class="recall-btn" data-action="show-briefing">📜 Dana's note</button>`
    : ''
  return `
    <header class="page-h">
      <div class="title-row">
        <h1>Audit <span class="muted">@ L32 · the finale</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./">← back to game</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          A twelfth prototype, the finale. Different shape from
          every prior encounter: this isn't a fight against a
          payer or a kindness to a patient. It's a
          <em>${term('documentation defense', 'defense')}</em>
          of work already done. The auditor walks in with three
          findings on Margaret Holloway's case file. For each,
          you choose: ${term('documentation defense', 'RECEIPT')}
          (defend with chart evidence) or AMEND (concede and
          accept the ${term('recoupment')}). See the
          <a href="#design-notes">design notes</a>.
        </p>
      `}
    </header>
  `
}

function renderHospitalIntro(): string {
  return `
    <section class="hospital-intro">
      <div class="register hospital">HOSPITAL · conference room · this morning</div>
      <p>
        The auditor arrived at 8 AM. She is small, exact, and
        impeccably dressed. Her badge says <em>Riley Tan,
        ${term('RAC')} reviewer</em>. She has set up at the
        long conference table with a single thin laptop and
        three thin file folders. She is polite. She is
        unsympathetic. She is good at her job.
      </p>
      <p>
        The first folder is Margaret Holloway. Five-day
        inpatient stay last month — ${term('CDI', 'sepsis admission')},
        MSSA on cultures, ICU step-down, discharged stable.
        Three findings flagged for review.
        ${money(8420 + 3210 + 340)} of revenue is exposed if
        every finding stands.
      </p>
      <p>
        On the corner of Riley's notebook, half-hidden under
        a folder, there is a faded photograph in a small frame.
        You don't get a clear look. You're not supposed to.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the conference room loses one wall, then
        another. The chairs become red velvet. The floor
        becomes the chevron you've seen before, only larger;
        the table stretches; the auditor doesn't move. The
        lights don't flicker. They never have, here. You're
        somewhere else.</em>
      </div>
      <div class="register waiting-room">WAITING ROOM · the mirror room</div>
    </section>
  `
}

function renderBriefingInline(): string {
  return `
    <section class="briefing">
      ${briefingContent()}
      <button class="btn primary" data-action="dismiss-briefing">
        Got it — start the audit
      </button>
    </section>
  `
}

function briefingContent(): string {
  return `
    <div class="briefing-h">
      <span class="briefing-tag">DANA, IN YOUR EAR</span>
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : "The last fight. And a different shape."}</span>
    </div>
    <div class="briefing-body">
      <p>
        "This is the audit. It's not a fight against a payer
        — it's a defense of work that's already been done.
        Three findings. For each one you have to decide: do I
        have the chart evidence to back this up, or is this a
        real error I should concede before the auditor digs
        deeper?"
      </p>
      <p>
        "Two ways to respond:"
      </p>
      <ul>
        <li>
          <strong>RECEIPT.</strong> Defend the original
          coding. Pick the right chart document and attach it.
          The auditor reviews; if the document supports the
          code, the finding closes; if it doesn't, the
          finding stands AND the auditor gets suspicious.
          Don't bluff.
        </li>
        <li>
          <strong>AMEND.</strong> Concede the finding. Accept
          the ${term('recoupment')}. This is what you do when
          the chart actually doesn't support the code, or
          when the error is small and conceding fast keeps
          the audit narrow.
        </li>
      </ul>
      <p>
        "On Margaret's case: two of these findings are
        defensible — the principal dx is supported by the
        day-1 culture; the ${term('MCC')} severity is
        supported by the ICU flowsheet. One is a real billing
        error — a duplicate vancomycin charge that just
        shouldn't have been on the bill. Defend the two real
        ones. Concede the small one cleanly. Total exposure
        drops from ${money(8420 + 3210 + 340)} to
        ${money(340)}."
      </p>
      <p>
        "Bluffing on the duplicate compounds. Folding on the
        two defensible ones gives the auditor a free win.
        Read each chart carefully before you choose."
      </p>
      <p class="briefing-sign">"This one is the door home. — D."</p>
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

function renderClaim(): string {
  const claim = auditCase.claim
  if (!claim || claim.type !== 'ub04') return ''
  return `
    <section class="claim ub-claim">
      <div class="claim-h">
        UB-04 · ${escape(claim.claimId)} · ${term('DRG')} ${escape(claim.drg ?? '')}
        <span class="claim-explainer">(under audit · ${escape(claim.statementPeriod?.from ?? '')}${claim.statementPeriod?.through ? ' — ' + escape(claim.statementPeriod.through) : ''})</span>
      </div>
      <div class="claim-grid">
        <div><b>Patient:</b> ${escape(claim.patient.name)} · ${escape(claim.patient.dob)}</div>
        <div><b>Insurer:</b> ${escape(claim.insured.name ?? '')} · ${escape(claim.insured.id)}</div>
      </div>
      <div class="claim-section">
        <div class="claim-section-h">Diagnoses</div>
        <ul class="dx">
          ${claim.diagnoses.map((d, i) => `
            <li><b>${i === 0 ? 'PRINCIPAL' : 'SECONDARY ' + i}.</b> ${escape(d.code)}${d.label ? ' — ' + escape(d.label) : ''}</li>
          `).join('')}
        </ul>
      </div>
      <div class="claim-section">
        <div class="claim-section-h">Service Lines</div>
        <table class="lines">
          <thead><tr><th>Rev</th><th>Description</th><th>Date</th><th>Units</th><th class="right">Charges</th></tr></thead>
          <tbody>
            ${claim.serviceLines.map(line => `
              <tr>
                <td><code>${escape(line.revCode)}</code></td>
                <td>${escape(line.description ?? '')}</td>
                <td>${escape(line.serviceDate ?? '')}</td>
                <td>${escape(line.units ?? '')}</td>
                <td class="right">${escape(line.totalCharges)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderFindingsList(): string {
  return `
    <section class="findings-list">
      <div class="fl-h">
        <span class="fl-tag">AUDIT FINDINGS · ${findings.length}</span>
        <span class="fl-sub">${allResolved()
          ? `All findings resolved. Total recoupment: ${money(totalRecoupment())}.`
          : `Walk through each finding. Choose RECEIPT or AMEND. Read the chart before you decide.`}</span>
      </div>
      ${findings.map((f, i) => {
        const fs = state.findings[f.id]
        const status = fs.resolved
          ? (fs.verb === 'receipt'
              ? (fs.receiptHeld ? 'defended' : 'failed-receipt')
              : 'amended')
          : 'pending'
        return `
          <div class="finding ${status}">
            <div class="finding-h">
              <span class="finding-num">${i + 1}</span>
              <div class="finding-h-text">
                <div class="finding-title">${escape(f.originalCoding)}</div>
                <div class="finding-tone">Auditor (${escape(f.auditorTone)}):</div>
              </div>
              ${renderFindingStatus(status, fs)}
            </div>
            <div class="finding-quote">${escape(f.auditorClaim)}</div>
            ${fs.resolved ? `
              <div class="finding-recap">
                ${escape(fs.verb === 'receipt' ? (fs.receiptHeld ? f.receiptRecap : '(receipt rejected — finding stood. recoupment: ' + money(f.recoupmentAmount) + ')') : f.amendRecap)}
              </div>
            ` : `
              <div class="finding-actions">
                <button class="btn primary" data-action="open-finding" data-id="${f.id}">
                  Address finding
                </button>
                <span class="finding-stakes">If conceded: −${money(f.recoupmentAmount)}</span>
              </div>
            `}
          </div>
        `
      }).join('')}
    </section>
  `
}

function renderFindingStatus(status: string, _fs: FindingState): string {
  switch (status) {
    case 'pending': return '<span class="finding-status pending">PENDING</span>'
    case 'defended': return '<span class="finding-status defended">DEFENDED ✓</span>'
    case 'amended': return '<span class="finding-status amended">CONCEDED · recoup applied</span>'
    case 'failed-receipt': return '<span class="finding-status failed">RECEIPT FAILED · recoup applied</span>'
    default: return ''
  }
}

function renderModal(): string {
  if (!state.modalFindingId) return ''
  const finding = findings.find(f => f.id === state.modalFindingId)
  if (!finding) return ''
  const fs = state.findings[finding.id]
  return `
    <div class="amend-modal-backdrop">
      <div class="amend-modal audit-modal">
        <button class="amend-modal-close" data-action="close-finding" aria-label="Close">×</button>
        <div class="amend-modal-h">
          <span class="amend-tag">FINDING · ${escape(finding.originalCoding)}</span>
          <span class="amend-sub">Riley's claim — and the chart on file. Pick RECEIPT to defend, AMEND to concede.</span>
        </div>
        <div class="amend-context">
          <strong>Auditor's position:</strong> ${escape(finding.auditorPosition)}<br>
          <strong>Recoupment if conceded:</strong> ${money(finding.recoupmentAmount)}.
        </div>
        ${state.inReceiptStep ? `
          <div class="b22-section">
            <div class="b22-h">PICK YOUR RECEIPT — chart evidence to attach</div>
            <ul class="amend-options">
              ${finding.evidenceOptions.map(ev => {
                const fb = fs.feedback && fs.evidenceId === ev.id ? fs.feedback : null
                return `
                  <li class="amend-option ${fb && !ev.defends ? 'rejected' : ''}"
                      data-action="pick-evidence" data-finding="${finding.id}" data-evidence="${ev.id}">
                    <div class="amend-option-h">
                      <span class="amend-option-label"><strong>${escape(ev.source)}</strong></span>
                    </div>
                    <div class="evidence-text">${escape(ev.text)}</div>
                    ${fb ? `<div class="amend-option-fb">${escape(fb)}</div>` : ''}
                  </li>
                `
              }).join('')}
            </ul>
            <button class="btn ghost" data-action="cancel-receipt-step" data-finding="${finding.id}">
              ← Back · choose again
            </button>
          </div>
        ` : `
          <div class="audit-verbs">
            <button class="btn primary verb-btn" data-action="pick-verb-receipt" data-finding="${finding.id}">
              <strong>RECEIPT</strong>
              <span class="verb-sub">Defend with chart evidence</span>
            </button>
            <button class="btn primary verb-btn amend" data-action="pick-verb-amend" data-finding="${finding.id}">
              <strong>AMEND</strong>
              <span class="verb-sub">Concede · accept ${money(finding.recoupmentAmount)} recoupment</span>
            </button>
          </div>
          ${fs.feedback ? `<div class="feedback fb-bad">${escape(fs.feedback)}</div>` : ''}
        `}
      </div>
    </div>
  `
}

function renderChecklist(): string {
  const allDone = allResolved()
  const total = totalRecoupment()
  const totalExposure = findings.reduce((s, f) => s + f.recoupmentAmount, 0)
  return `
    <section class="checklist">
      <div class="checklist-h">Audit packet — ${Object.values(state.findings).filter(f => f.resolved).length} of ${findings.length} findings resolved</div>
      ${allDone ? `
        <div class="audit-summary">
          <div class="as-row"><span class="as-label">Total exposure</span><span class="as-value mono">${money(totalExposure)}</span></div>
          <div class="as-row"><span class="as-label">Recoupment applied</span><span class="as-value mono ${total < 1000 ? 'good' : total < 5000 ? 'warn' : 'bad'}">${money(total)}</span></div>
          <div class="as-row"><span class="as-label">Revenue defended</span><span class="as-value mono good">${money(totalExposure - total)}</span></div>
        </div>
      ` : ''}
      <button class="btn submit ${allDone ? '' : 'disabled'}"
              ${allDone ? '' : 'disabled'}
              data-action="submit">
        ${allDone ? 'CLOSE THE AUDIT PACKET' : 'Address each finding first'}
      </button>
      ${state.failedAttempts > 0 ? `<div class="fail-counter">Wrong calls so far: ${state.failedAttempts}.</div>` : ''}
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

const RECAP: CaseRecap = CASE_RECAPS['audit-boss']

function renderVictory(): string {
  const total = totalRecoupment()
  const totalExposure = findings.reduce((s, f) => s + f.recoupmentAmount, 0)
  const defended = totalExposure - total
  const cleanRun = total === 340 // ideal: only the duplicate conceded
  return `
    <section class="victory">
      <h2>${cleanRun ? 'The audit closes clean.' : 'The audit closes.'}</h2>
      <p class="register hospital">Hospital, the next morning.</p>
      <p>
        Riley packs her thin laptop into her thin bag and
        leaves the conference room. ${cleanRun
          ? `Her closing note in the system reads <em>"Documentation
            defended; one minor billing correction. Audit closed
            without expansion."</em> Mercy's RAC defense team
            counts ${money(defended)} of revenue retained against
            ${money(340)} recouped.`
          : `Her closing note logs ${money(total)} in recoupments
            and flags Mercy for follow-up review next quarter.
            ${money(defended)} of revenue retained.`}
        The compliance officer signs off the packet.
      </p>
      <p class="register waiting-room">Waiting Room · the mirror room.</p>
      <p>
        ${cleanRun
          ? `The chevron floor is steady. The red curtain doesn't
            stir. There's no enemy to vanish — the audit was
            never a fight, and the room knows it. Somewhere far
            off, you can hear a small bell that has nothing to
            do with this encounter, ringing softly.`
          : `Some of the curtains shift. Two of Margaret's
            findings stand in the audit log; the room has
            absorbed them and won't give them back. Riley's
            faded photo, when you look for it again, is gone
            — the auditor took it with her.`}
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
            <li><b>The finale shape.</b> Not a fight against a payer; not a kindness to a patient. A *defense* of work already done. The two actions (RECEIPT / AMEND) are about what you do with someone else's accusation, not how you assemble your own argument.</li>
            <li><b>Three findings, three independent decisions.</b> Each one has its own RECEIPT-vs-AMEND call. The pedagogy is in knowing which is which: defending a defensible finding retains revenue; conceding a real error fast keeps the audit narrow.</li>
            <li><b>Bluffing has a real cost.</b> Picking RECEIPT on the duplicate-charge finding and attaching wrong evidence still costs the recoupment AND sets the audit up to expand. The prototype models this as a failed-receipt status (vs. a clean amend).</li>
            <li><b>The numbers add up.</b> Total exposure $11,970. A clean run lands at $340 recouped. Failing one defensible finding loses $3,210 or $8,420; bluffing on the duplicate doesn't get the $340 back. The summary table makes this legible.</li>
            <li><b>L10 mood.</b> The auditor (Riley Tan) is a person, not a system — polite, exact, unsympathetic. Reds and curtains stay in the prototype's color language; the mirror-room frame is hinted at via the "lose one wall, then another" register flip. Dana's L10 reveal beat (the door home) is teased lightly via the faded photo on Riley's desk; the prototype doesn't try to land that arc.</li>
          </ul>
        </div>
        <div>
          <h3>What this prototype proves (or tries to)</h3>
          <ul>
            <li>The framework absorbs a defense-shaped encounter without breaking — same hospital intro, fall, Dana voice, claim-form, checklist, submit. The middle holds three independent finding-modals instead of a single workbench/builder.</li>
            <li>RECEIPT-as-action is teachable: the player learns to read chart evidence for whether it actually supports the original coding, vs. just being adjacent to it (the "right diagnosis on the discharge summary doesn't prove it was supported at admission" beat).</li>
            <li>"Concede small things fast to avoid bigger findings" is a real-world RAC defense lesson that's almost never named in healthcare-system games. The duplicate-charge finding is the prototype's vehicle for it.</li>
            <li>A summary table (exposure / recouped / defended) at the end of the encounter makes the financial logic of the audit legible — it's not just whether you "won," it's how much revenue was at stake and how much survived the review.</li>
            <li>Dana's voice scales to the heaviest encounter in the curriculum without breaking. Sign-off shifts to "This one is the door home."</li>
          </ul>
        </div>
      </div>
      <p class="notes-cta">
        Companions: open the patient-facing pair —
        <a href="./lighthouse-prototype.html">Lighthouse</a>
        (charity care, the kindness path) and
        <a href="./surprise-bill-prototype.html">Surprise Bill</a>
        (NSA dispute, the patient-facing fight). The audit is
        what closes the year; the L8 patient-facing encounters
        are what the year was actually about.
      </p>
    </section>
  `
}

// === Interactions ===

function setFeedback(text: string, kind: 'good' | 'bad' | 'neutral' = 'neutral') {
  state.feedback = text
  state.feedbackKind = kind
}

function openFinding(id: string) {
  state.modalFindingId = id
  state.inReceiptStep = false
  // Clear stale per-finding feedback when reopening.
  state.findings[id].feedback = null
}

function closeFinding() {
  state.modalFindingId = null
  state.inReceiptStep = false
}

function pickVerbReceipt(findingId: string) {
  const finding = findings.find(f => f.id === findingId)
  if (!finding) return
  state.inReceiptStep = true
  state.findings[findingId].feedback = null
}

function cancelReceiptStep(_findingId: string) {
  state.inReceiptStep = false
}

function pickEvidence(findingId: string, evidenceId: string) {
  const finding = findings.find(f => f.id === findingId)
  if (!finding) return
  const ev = finding.evidenceOptions.find(e => e.id === evidenceId)
  if (!ev) return
  const fs = state.findings[findingId]
  fs.evidenceId = evidenceId
  if (!ev.defends) {
    state.failedAttempts += 1
    fs.feedback = ev.feedback
    return
  }
  // Correct evidence — but is RECEIPT the right action at all?
  if (finding.correctVerb !== 'receipt') {
    // Player tried to defend something that should be amended; receipt fails.
    fs.resolved = true
    fs.verb = 'receipt'
    fs.receiptHeld = false
    fs.recoupmentApplied = finding.recoupmentAmount
    state.failedAttempts += 1
    setFeedback(finding.wrongReceiptFeedback, 'bad')
    state.lastRecap = ''
    state.modalFindingId = null
    state.inReceiptStep = false
    return
  }
  // Correct action + correct evidence: receipt holds.
  fs.resolved = true
  fs.verb = 'receipt'
  fs.receiptHeld = true
  fs.recoupmentApplied = 0
  setFeedback(`Receipt accepted. ${finding.receiptRecap.split('.')[0]}.`, 'good')
  state.lastRecap = finding.receiptRecap
  state.modalFindingId = null
  state.inReceiptStep = false
}

function pickVerbAmend(findingId: string) {
  const finding = findings.find(f => f.id === findingId)
  if (!finding) return
  const fs = state.findings[findingId]
  if (finding.correctVerb !== 'amend') {
    state.failedAttempts += 1
    fs.feedback = finding.wrongAmendFeedback
    return
  }
  // Correct call: concede.
  fs.resolved = true
  fs.verb = 'amend'
  fs.recoupmentApplied = finding.recoupmentAmount
  setFeedback(`Conceded cleanly. Recoupment ${money(finding.recoupmentAmount)} applied.`, 'good')
  state.lastRecap = finding.amendRecap
  state.modalFindingId = null
}

function attemptSubmit() {
  if (!allResolved()) return
  state.packetSubmitted = true
  notifyParentVictory('audit-boss')
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  state.modalFindingId = null
  state.inReceiptStep = false
  state.findings = Object.fromEntries(findings.map(f => [f.id, {
    resolved: false,
    verb: null,
    evidenceId: null,
    recoupmentApplied: 0,
    receiptHeld: false,
    feedback: null,
  } as FindingState])) as Record<string, FindingState>
  state.failedAttempts = 0
  state.feedback = ''
  state.feedbackKind = 'neutral'
  state.lastRecap = ''
  state.packetSubmitted = false
}

function dismissBriefing() { state.briefingDone = true; state.briefingOpen = false }
function showBriefing() { state.briefingOpen = true }
function closeBriefing() { state.briefingOpen = false }
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
    closeFinding(); rerender(); return
  }
  const el = target.closest('[data-action]') as HTMLElement | null
  if (!el) return
  const action = el.dataset.action
  switch (action) {
    case 'open-finding': if (el.dataset.id) openFinding(el.dataset.id); break
    case 'close-finding': closeFinding(); break
    case 'pick-verb-receipt': if (el.dataset.finding) pickVerbReceipt(el.dataset.finding); break
    case 'cancel-receipt-step': if (el.dataset.finding) cancelReceiptStep(el.dataset.finding); break
    case 'pick-evidence':
      if (el.dataset.finding && el.dataset.evidence) pickEvidence(el.dataset.finding, el.dataset.evidence)
      break
    case 'pick-verb-amend': if (el.dataset.finding) pickVerbAmend(el.dataset.finding); break
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

const css = districtVars('appeals') + BASE_CSS + `
  .ub-claim { font-size: 12px; }
  .claim table.lines th.right, .claim table.lines td.right { text-align: right; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }

  /* Findings list — three audit findings, each with a RECEIPT/AMEND choice. */
  .findings-list { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .fl-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
  .fl-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .fl-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .finding { background: var(--panel-2); border-radius: 6px; padding: 14px 16px; margin-bottom: 10px; border-left: 3px solid #2a3142; transition: border-color 0.3s, background 0.3s; }
  .finding.pending { border-left-color: var(--accent-2); }
  .finding.defended { border-left-color: var(--good); background: rgba(126, 226, 193, 0.04); }
  .finding.amended { border-left-color: var(--accent); background: rgba(177, 139, 214, 0.04); }
  .finding.failed-receipt { border-left-color: var(--bad); background: rgba(239, 91, 123, 0.04); }
  .finding-h { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
  .finding-num { background: var(--panel); color: var(--ink-dim); width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; border: 1px solid #2a3142; font-family: ui-monospace, monospace; }
  .finding-h-text { flex: 1; min-width: 200px; }
  .finding-title { font-size: 13.5px; font-weight: 700; color: var(--ink); }
  .finding-tone { font-size: 10.5px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; font-style: italic; }
  .finding-status { font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 8px; border-radius: 3px; }
  .finding-status.pending { background: rgba(240, 168, 104, 0.12); color: var(--accent-2); border: 1px solid #4a3a2a; }
  .finding-status.defended { background: rgba(126, 226, 193, 0.12); color: var(--good); border: 1px solid #2c5547; }
  .finding-status.amended { background: rgba(177, 139, 214, 0.12); color: var(--accent); border: 1px solid #3a324a; }
  .finding-status.failed { background: rgba(239, 91, 123, 0.12); color: var(--bad); border: 1px solid #4a2a32; }
  .finding-quote { font-size: 13px; color: var(--ink); line-height: 1.55; padding: 10px 14px; background: rgba(0,0,0,0.2); border-left: 2px solid #2a3142; margin: 8px 0; font-style: italic; }
  .finding-actions { display: flex; align-items: center; gap: 14px; margin-top: 10px; flex-wrap: wrap; }
  .finding-stakes { font-size: 11.5px; color: var(--ink-dim); font-style: italic; }
  .finding-recap { margin-top: 8px; font-size: 12.5px; color: var(--ink-dim); line-height: 1.55; padding: 10px 12px; background: rgba(0,0,0,0.18); border-radius: 4px; }

  /* RECEIPT vs AMEND action picker — two big buttons. */
  .audit-modal { max-width: 740px; }
  .audit-verbs { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
  @media (max-width: 700px) { .audit-verbs { grid-template-columns: 1fr; } }
  .verb-btn { padding: 18px 16px !important; display: flex; flex-direction: column; align-items: flex-start; gap: 6px; text-align: left; }
  .verb-btn strong { font-size: 14px; letter-spacing: 0.08em; }
  .verb-btn .verb-sub { font-size: 11.5px; opacity: 0.85; font-weight: 400; }
  .verb-btn.amend { background: var(--ink-dim); color: var(--bg); }
  .verb-btn.amend:hover { background: var(--ink); }

  .b22-section { margin-bottom: 16px; }
  .b22-h { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 8px; }
  .evidence-text { margin-top: 4px; padding-left: 0; font-size: 12px; color: var(--ink-dim); line-height: 1.55; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; background: rgba(0,0,0,0.2); padding: 8px 10px; border-radius: 3px; border-left: 2px solid #2a3142; }
  .amend-option-label strong { font-size: 13px; }

  /* Audit summary at end. */
  .audit-summary { background: var(--panel-2); border-radius: 5px; padding: 12px 14px; margin-bottom: 10px; }
  .as-row { display: grid; grid-template-columns: 200px 1fr; gap: 8px; padding: 5px 0; align-items: baseline; }
  .as-label { font-size: 11px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
  .as-value { font-size: 14px; color: var(--ink); text-align: right; }
  .as-value.mono { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-weight: 700; }
  .as-value.good { color: var(--good); }
  .as-value.warn { color: var(--accent-2); }
  .as-value.bad { color: var(--bad); }

  .recap { background: rgba(177, 139, 214, 0.06); border-color: #3a324a; }
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
      if (state.modalFindingId) { closeFinding(); changed = true }
      if (changed) rerender()
    }
  })
}

mount()
