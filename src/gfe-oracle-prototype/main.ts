// GFE Oracle @ L10 — pre-service Case under the No Surprises Act.
//
// Sibling to MRF Cartographer: same source-of-truth muscle (CDM
// for hard-coded lines, claim history for soft-coded), but the
// deliverable is patient-facing — a Good Faith Estimate (GFE)
// for a self-pay patient scheduling an elective procedure.
//
// Different from the post-encounter Surprise Bill Specter: this
// is *prevention*. Get the patient an honest number before the
// procedure, with the right co-provider disclosures, and the
// hospital is bound to bill within ±$400 of it under the NSA.
//
// Actions:
//   - ITEMIZE: 6 candidate line items; classify each as Mercy's
//     (goes on this GFE), co-provider's (separate GFE; mention but
//     don't price), or not applicable (ineligible service).
//   - ESTIMATE: for Mercy lines, pick the source — fixed CDM rate
//     vs claim-derived median per payer. Continuity with MRF
//     Cartographer's classification.
//   - COMMIT: assemble the GFE and commit to bill within ±$400.
//
// Demonstrates: the GFE is not "what we'd like to charge" — it's a
// regulatory commitment. Knowing what to include, what to disclose,
// and what to leave off is the whole skill.
//
// Author: May 2026. Modeled on MRF Cartographer with a co-provider
// classification axis added.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

// ===== Domain types =====

type LineKind = 'mercy' | 'co-provider' | 'not-applicable'

interface LineItem {
  id: string
  /** CPT/HCPCS/CDM code or descriptor. */
  code: string
  /** Plain-English service. */
  label: string
  /** Why this lands where it does (shown post-classify). */
  reason: string
  /** True classification. */
  kind: LineKind
  /** Pricing shape — only meaningful for Mercy lines. */
  shape?: string
  /** Source the player picks for Mercy lines: 'cdm' (hard-coded) or 'claims' (soft-coded). null = not yet picked. */
  correctSource?: 'cdm' | 'claims'
  /** CDM rate (always present; misleading for soft-coded). */
  cdmCharge: number
  /** Median per-payer rate from claim history. Empty for hard-coded. */
  claimMedian?: number
  /** What gets published on the GFE (the right number). */
  correctRate?: number
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'itemize' | 'estimate' | 'commit'
}

interface GlossaryEntry {
  term: string
  plain: string
}

// ===== Encounter data =====

const PATIENT = 'Maya Chen'
const PROCEDURE = 'Planned cesarean delivery (CPT 59514)'
const SCHEDULED_DATE = '2026-05-30'
const SCHEDULED_DAYS_OUT = 14
const NSA_GFE_DEADLINE_DAYS = 3
const NSA_VARIANCE_CAP = 400

const lineItems: LineItem[] = [
  {
    id: 'facility-or',
    code: 'REV 0360',
    label: 'OR services — facility (operating-room time)',
    kind: 'mercy',
    reason: "Mercy bills the OR-time line via the facility revenue code. Goes on this GFE.",
    shape: 'Facility per-minute or per-case; CDM rate is the contracted facility fee.',
    correctSource: 'cdm',
    cdmCharge: 4_800,
    correctRate: 4_800,
  },
  {
    id: 'roomboard',
    code: 'REV 0110',
    label: 'Room and board — postpartum, 2 nights',
    kind: 'mercy',
    reason: "Per-diem hospital line. CDM rate per night is the contracted facility fee. Hard-coded.",
    shape: 'Per-diem; fixed CDM per night.',
    correctSource: 'cdm',
    cdmCharge: 1_900, // total for 2 nights
    correctRate: 1_900,
  },
  {
    id: 'pharmacy',
    code: 'REV 0250',
    label: 'Pharmacy — perioperative meds, supplies',
    kind: 'mercy',
    reason: "Mercy's pharmacy bills these. Soft-coded — CDM is fiction; payers pay a fraction. Pull from claims.",
    shape: 'Soft-coded supply line; CDM unreliable. Use claim median per payer.',
    correctSource: 'claims',
    cdmCharge: 720,
    claimMedian: 240,
    correctRate: 240,
  },
  {
    id: 'lab-cmp',
    code: '80053',
    label: 'Comprehensive metabolic panel (pre-op)',
    kind: 'mercy',
    reason: "Mercy lab. Soft-coded (same shape as MRF Cartographer's CMP row). Use claim median.",
    shape: 'Soft-coded lab line.',
    correctSource: 'claims',
    cdmCharge: 48,
    claimMedian: 16,
    correctRate: 16,
  },
  {
    id: 'anesthesia',
    code: '01961',
    label: 'Anesthesia for cesarean — anesthesiologist',
    kind: 'co-provider',
    reason: "Anesthesia is staffed by an independent group, not Mercy employees. They bill separately and owe Maya their own GFE under the same NSA timeline.",
    cdmCharge: 0,
  },
  {
    id: 'newborn-pediatrics',
    code: '99460',
    label: 'Newborn evaluation — pediatrician',
    kind: 'co-provider',
    reason: "The pediatrician group is contracted, not employed. Separate co-provider GFE; we disclose the gap to Maya but don't price it.",
    cdmCharge: 0,
  },
  {
    id: 'doula',
    code: '—',
    label: 'Doula services (Maya wants to bring one)',
    kind: 'not-applicable',
    reason: "Doula services aren't billed through Mercy and aren't a covered NSA item — Maya pays the doula directly. Not on the GFE at all.",
    cdmCharge: 0,
  },
  {
    id: 'cord-blood',
    code: '—',
    label: 'Cord-blood banking — outside vendor',
    kind: 'not-applicable',
    reason: "Cord-blood banking is a third-party vendor service (not a healthcare service Mercy provides). Outside the NSA's scope. Not on the GFE.",
    cdmCharge: 0,
  },
]

const issues: Issue[] = [
  {
    id: 'itemize',
    label: "Itemize: classify each line as Mercy's, a co-provider's, or not applicable.",
    recap: `You sorted eight candidate lines. Four belong on Mercy's GFE (OR, room/board, pharmacy, lab); two are co-providers (anesthesia, pediatrics) — disclosed but priced separately; two are not applicable (doula, cord-blood) — outside the NSA's scope.`,
    verb: 'itemize',
  },
  {
    id: 'estimate',
    label: 'Estimate Mercy lines from the right source — CDM (hard-coded) or claim median (soft-coded).',
    recap: `Hard-coded lines (OR fee, room/board) pulled from CDM. Soft-coded lines (pharmacy, lab) pulled from the claim-history median per payer. Same source-of-truth puzzle as the MRF; same lever.`,
    verb: 'estimate',
  },
  {
    id: 'commit',
    label: `Commit the GFE — Mercy bills within ±$${NSA_VARIANCE_CAP} of total or Maya disputes under the NSA.`,
    recap: `GFE delivered within the 3-business-day window. Mercy committed to billing within ±$${NSA_VARIANCE_CAP} of the total estimate. Co-provider GFEs flagged to anesthesia + pediatrics groups for their own delivery.`,
    verb: 'commit',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'GFE': {
    term: 'GFE (Good Faith Estimate)',
    plain: "Pre-service price estimate that providers must give uninsured or self-pay patients under the federal No Surprises Act. Required within 3 business days of scheduling (or 1 business day if scheduled within 3 days). Lists every item or service expected to be furnished, with a reasonable estimated cost. Patients can dispute a final bill that exceeds the GFE by more than $400 through a federal patient-provider dispute resolution (PPDR) process.",
  },
  'AEOB': {
    term: 'AEOB (Advanced Explanation of Benefits)',
    plain: "The payer-side companion to the GFE. When a patient with insurance schedules an elective service, the payer is supposed to send an AEOB showing what the plan will cover, what the patient owes, and the network status of every co-provider. AEOB requirements were proposed in 2022 but **CMS deferred enforcement indefinitely** pending technical-standards rulemaking — as of 2024-2026 the AEOB is not actively enforced. The same enforcement-deferral applies to convening-provider GFE aggregation (the requirement that a hospital's GFE include co-provider expected charges). Currently, each provider gives the patient their own GFE separately; the convening provider just discloses *who* the co-providers are without pricing them.",
  },
  'deferred-enforcement': {
    term: 'NSA convening-provider GFE / AEOB — deferred enforcement',
    plain: "Two NSA pieces are in deferred-enforcement limbo: (a) the convening-provider GFE rule that would require a hospital's GFE to aggregate expected co-provider charges into a single document for the patient; and (b) the AEOB rule for insured patients. Both were proposed in 2022; CMS deferred enforcement pending technical standards. As of 2024-2026, this Case treats the deferred-enforcement state as the operative rule — Mercy gives Maya a GFE for Mercy lines only, names co-providers without pricing them, and each co-provider sends their own GFE on the same NSA timeline. If/when CMS finalizes the convening-provider rule, the bucket assignment for co-providers will change from \"disclose only\" to \"include in our GFE.\"",
  },
  'NSA': {
    term: 'NSA (No Surprises Act)',
    plain: "Federal law in effect since Jan 1, 2022. Caps patient cost-share at the in-network amount for emergency services and for non-emergency services at in-network facilities (so out-of-network anesthesiologists at an in-network hospital can't balance-bill the patient). The GFE requirement for self-pay patients is part of the same law — both target surprise bills, just from different angles.",
  },
  'co-provider': {
    term: 'Co-provider',
    plain: "An independent provider whose services accompany the primary procedure but who bills separately. Anesthesiologists, pathologists, radiologists, pediatricians, surgical assistants. The hospital's GFE lists them but doesn't price them — they owe the patient their own GFE on the same NSA timeline. The co-provider's status (in-network vs out-of-network for a non-self-pay patient) is what the NSA's surprise-bill protections actually hinge on.",
  },
  'CDM': {
    term: 'CDM (Chargemaster)',
    plain: "Hospital master price list. Source of truth for hard-coded lines (room/board, fixed-rate procedures); fiction for soft-coded ones (labs, pharmacy, supplies). Same dichotomy as MRF Cartographer.",
  },
  'soft-coded': {
    term: 'Soft-coded service',
    plain: "Service whose price varies per payer; CDM is unreliable. Pull the rate from the claim-history median. Pharmacy, lab, supply lines.",
  },
  'hard-coded': {
    term: 'Hard-coded service',
    plain: "Service whose price is the same across payers (within rounding). CDM is the source of truth. Room/board, facility OR fees, DRG case rates.",
  },
  'PPDR': {
    term: 'PPDR (Patient-Provider Dispute Resolution)',
    plain: "Federal process patients use when a final bill exceeds the GFE by more than $400. Patient submits the GFE + final bill to a CMS-certified Selected Dispute Resolution (SDR) entity, who decides what the patient actually owes. The SDR's decision is binding on the provider. The GFE isn't optional — it's the document that triggers (or prevents) PPDR.",
  },
  'self-pay': {
    term: 'Self-pay patient',
    plain: "Patient paying out of pocket — either uninsured or insured but not using insurance for this service. The NSA's GFE requirement applies to self-pay patients. (Insured patients using benefits get a different document — the AEOB — from their payer, not from the hospital.)",
  },
}

// ===== Runtime state =====

interface LineState {
  classification: LineKind | null
  /** For Mercy lines: which source the player picked. */
  appliedSource: 'cdm' | 'claims' | null
}

const state = {
  briefingDone: false,
  briefingOpen: false,
  lineStates: lineItems.reduce((m, l) => { m[l.id] = { classification: null, appliedSource: null }; return m }, {} as Record<string, LineState>),
  /** Line the player is inspecting for source-picking. */
  inspectingId: null as string | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isItemizeDone(): boolean {
  return lineItems.every(l => state.lineStates[l.id].classification === l.kind)
}

function mercyLines(): LineItem[] {
  return lineItems.filter(l => l.kind === 'mercy')
}

function isEstimateDone(): boolean {
  if (!isItemizeDone()) return false
  return mercyLines().every(l => state.lineStates[l.id].appliedSource === l.correctSource)
}

function totalEstimate(): number {
  return mercyLines().reduce((s, l) => s + (l.correctRate ?? 0), 0)
}

// ===== Render =====

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
    return renderHeader() + renderVictory() + renderTermPopover() + renderBriefingPopover()
  }
  return `
    ${renderHeader()}
    ${renderHospitalIntro()}
    ${!state.briefingDone ? renderBriefingInline() : `
      ${renderItemizePanel()}
      ${renderEstimatePanel()}
      ${renderInspector()}
      ${renderCommitPanel()}
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
        <h1>GFE Oracle <span class="muted">@ L10 — first sketch</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./prototypes.html">← back to catalog</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          A pre-service Case. Maya Chen scheduled a planned
          cesarean for ${SCHEDULED_DATE} (${SCHEDULED_DAYS_OUT} days
          out). She's ${term('self-pay')}; under the
          ${term('NSA')}, Mercy owes her a
          ${term('GFE')} within ${NSA_GFE_DEADLINE_DAYS}
          business days. The rate source is the MRF — same
          published rates, different deliverable format. See the
          <a href="#design-notes">design notes</a>.
        </p>
      `}
    </header>
  `
}

function renderHospitalIntro(): string {
  return `
    <section class="hospital-intro">
      <div class="register hospital">HOSPITAL · scheduling desk</div>
      <p>
        Maya Chen at the desk, 27 weeks. ${escape("She's")} switching jobs in two
        weeks; the new insurance ${escape("doesn't")} kick in until the second.
        ${escape("She'd")} rather pay cash than ride a gap. Theo, scheduling, hands
        you the request slip: ${escape(PATIENT)}, planned cesarean for
        ${SCHEDULED_DATE}.
      </p>
      <p>
        "${term('self-pay')}. ${term('NSA')} clock starts now —
        ${NSA_GFE_DEADLINE_DAYS} business days for the
        ${term('GFE')}. She wants the
        anesthesia + peds estimates too; tell her those are
        ${term('co-provider')} GFEs and not ours. Make sure ours
        is honest — if final billing comes in more than
        $${NSA_VARIANCE_CAP} over the GFE, she can dispute through
        ${term('PPDR')} and the SDR ruling is binding."
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. Maya's intake form
        slides a half-pixel left, then settles. Eight candidate
        line items appear in a queue. The patient is real; the
        document is regulatory; the math is the same.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'Patient-facing prevention. Different muscle from the appeal stuff.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "Different work than the appeals. The dragon hasn't
        arrived yet; we're closing the door before it does. Maya
        gets a number she can trust before she signs. If we hand her
        a number we can't honor, she disputes through
        ${term('PPDR')} and the binding ruling is whatever the
        SDR says — which is usually less than the bill."
      </p>
      <p>
        "Three issues:"
      </p>
      <ul>
        <li>
          Eight candidate lines. Sort
          them: Mercy's (we estimate),
          ${term('co-provider')}'s (we disclose, don't estimate),
          or not applicable (off the GFE). Get this wrong and we
          either over-promise (Mercy GFE includes anesthesia we
          don't bill) or under-disclose (no mention of the
          pediatrician).
        </li>
        <li>
          For the Mercy lines, same
          source-of-truth call as the
          <a href="./mrf-cartographer-prototype.html">MRF</a>:
          ${term('hard-coded')} from CDM, ${term('soft-coded')}
          from the claim median per payer.
        </li>
        <li>
          Sign the GFE. Mercy commits to
          billing within ±$${NSA_VARIANCE_CAP} of the total. Hand a
          copy to Maya, route the co-provider notice to anesthesia
          + pediatrics. Done."
        </li>
      </ul>
      <p>
        "Don't include the doula or the cord-blood vendor. Doulas
        aren't healthcare services under the NSA, cord-blood is a
        third-party vendor. They're not on this document."
      </p>
      <p class="briefing-sign">"Four hundred dollars is a door. — D."</p>
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

function renderItemizePanel(): string {
  const done = state.resolvedIssues.has('itemize')
  return `
    <section class="itemize-panel ${done ? 'done' : ''}">
      <div class="ip-h">
        <span class="ip-tag">CANDIDATE LINES · ${escape(PATIENT)} · ${escape(PROCEDURE)}</span>
        <span class="ip-sub">${done
          ? 'Sorted. Four Mercy lines, two co-providers, two not applicable.'
          : 'For each candidate, pick where it goes. Wrong picks read as failed disclosure or over-promised pricing.'}</span>
      </div>
      <table class="li-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Service</th>
            <th>Sort into</th>
          </tr>
        </thead>
        <tbody>
          ${lineItems.map(l => renderLineRow(l)).join('')}
        </tbody>
      </table>
      ${state.transientFeedback && lineItems.some(l => l.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('itemize') : ''}
    </section>
  `
}

function renderLineRow(l: LineItem): string {
  const ls = state.lineStates[l.id]
  const classified = ls.classification !== null
  return `
    <tr class="li-row ${classified ? 'classified ' + ls.classification : ''}">
      <td><code>${escape(l.code)}</code></td>
      <td>${escape(l.label)}</td>
      <td class="classify-cell">
        ${classified ? `
          <span class="kind-badge ${ls.classification}">${kindLabel(ls.classification!)}</span>
          <button class="btn ghost small" data-action="reset-classification" data-id="${l.id}">↺ undo</button>
        ` : `
          <button class="btn small ghost" data-action="classify" data-id="${l.id}" data-kind="mercy">Mercy</button>
          <button class="btn small ghost" data-action="classify" data-id="${l.id}" data-kind="co-provider">Co-provider</button>
          <button class="btn small ghost" data-action="classify" data-id="${l.id}" data-kind="not-applicable">N/A</button>
        `}
      </td>
    </tr>
  `
}

function kindLabel(k: LineKind): string {
  if (k === 'mercy') return "MERCY · we estimate"
  if (k === 'co-provider') return 'CO-PROVIDER · disclose only'
  return 'NOT APPLICABLE · off the GFE'
}

function renderEstimatePanel(): string {
  const unlocked = state.resolvedIssues.has('itemize')
  const done = state.resolvedIssues.has('estimate')
  if (!unlocked) {
    return `
      <section class="estimate-panel locked">
        <div class="ep-h">
          <span class="ep-tag idle">ESTIMATE WORKBENCH</span>
          <span class="ep-sub">Locked until itemization is done.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="estimate-panel ${done ? 'done' : 'active'}">
      <div class="ep-h">
        <span class="ep-tag ${done ? 'done' : 'active'}">ESTIMATE WORKBENCH · 4 Mercy lines</span>
        <span class="ep-sub">${done
          ? `Total Mercy estimate: ${money(totalEstimate())}. Hard-coded lines pulled from CDM; soft-coded from claim median per payer.`
          : 'For each Mercy line, pick the source. Hard-coded → CDM. Soft-coded → claim median.'}</span>
      </div>
      <table class="mercy-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Service</th>
            <th class="right">CDM</th>
            <th class="right">Claim median</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          ${mercyLines().map(l => renderMercyRow(l)).join('')}
        </tbody>
      </table>
      ${done ? renderRecap('estimate') : ''}
    </section>
  `
}

function renderMercyRow(l: LineItem): string {
  const ls = state.lineStates[l.id]
  const picked = ls.appliedSource
  const correct = picked === l.correctSource
  return `
    <tr class="mercy-row ${picked ? (correct ? 'correct' : 'wrong') : ''}">
      <td><code>${escape(l.code)}</code></td>
      <td>${escape(l.label)}<br><span class="li-shape">${escape(l.shape ?? '')}</span></td>
      <td class="right">${money(l.cdmCharge)}</td>
      <td class="right">${l.claimMedian !== undefined ? money(l.claimMedian) : '—'}</td>
      <td class="src-cell">
        ${picked && correct ? `
          <span class="src-badge applied">${picked === 'cdm' ? 'CDM' : 'CLAIMS'} · ${money(l.correctRate ?? 0)}</span>
        ` : `
          <button class="btn small ghost" data-action="apply-source" data-id="${l.id}" data-src="cdm">CDM</button>
          <button class="btn small ghost" data-action="apply-source" data-id="${l.id}" data-src="claims" ${l.claimMedian === undefined ? 'disabled' : ''}>Claims</button>
        `}
      </td>
    </tr>
  `
}

function renderInspector(): string {
  // GFE prototype shows reason as transient feedback inline.
  return ''
}

function renderCommitPanel(): string {
  const ready = state.resolvedIssues.has('itemize') && state.resolvedIssues.has('estimate')
  const done = state.resolvedIssues.has('commit')
  const cls = !ready ? 'idle' : (done ? 'done' : 'active')
  return `
    <section class="commit-panel ${cls}">
      <div class="cp-h">
        <span class="cp-tag">${done ? 'GFE DELIVERED' : 'COMMIT THE GFE'}</span>
        <span class="cp-sub">${done
          ? `Mercy committed to ${money(totalEstimate())} ±$${NSA_VARIANCE_CAP}. Co-provider GFEs flagged.`
          : !ready
            ? 'Locked until itemization + estimation are done.'
            : `Total Mercy estimate: ${money(totalEstimate())}. Mercy commits to billing within ±$${NSA_VARIANCE_CAP} or Maya can dispute through PPDR.`}</span>
      </div>
      ${ready && !done ? `
        <div class="commit-summary">
          <div class="cs-row"><span>Mercy lines (priced)</span><strong>${money(totalEstimate())}</strong></div>
          <div class="cs-row"><span>Anesthesia group</span><span class="muted">disclosed; co-provider GFE</span></div>
          <div class="cs-row"><span>Pediatrics group</span><span class="muted">disclosed; co-provider GFE</span></div>
          <div class="cs-row"><span>Doula / cord-blood</span><span class="muted">not on this document</span></div>
          <div class="cs-row total"><span>Mercy commits to bill within</span><strong>${money(totalEstimate() - NSA_VARIANCE_CAP)}–${money(totalEstimate() + NSA_VARIANCE_CAP)}</strong></div>
        </div>
      ` : ''}
      ${done ? renderRecap('commit') : ''}
    </section>
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
  // The sign/commit button gates on the two *prerequisite* issues
  // (itemize + estimate) — the same condition attemptSubmit enforces.
  // Gating on all three would be circular: the third issue ('commit')
  // is only resolved BY signing, so the button could never enable.
  const canSubmit = state.resolvedIssues.has('itemize') && state.resolvedIssues.has('estimate')
  return `
    <section class="checklist">
      <div class="checklist-h">GFE DELIVERABLE · 3 issues to resolve</div>
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
      <button class="btn submit ${canSubmit ? '' : 'disabled'}" data-action="submit" ${canSubmit ? '' : 'disabled'}>
        Sign GFE · Mercy commits to ${money(totalEstimate())} ±$${NSA_VARIANCE_CAP}
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

const RECAP: CaseRecap = CASE_RECAPS['gfe-oracle']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">GFE SIGNED</div>
      <h2>Mercy committed to ${money(totalEstimate())} ±$${NSA_VARIANCE_CAP}.</h2>
      <p>
        Maya took the printout, looked at it, nodded once. "${escape("That's")}
        less than I thought." She signed the acknowledgment and went
        home. Co-provider notices routed to the anesthesia group and
        the pediatrics group; both have ${NSA_GFE_DEADLINE_DAYS} days
        to deliver theirs.
      </p>
      <p class="muted">
        The interesting part: the GFE doesn't have to be the
        cheapest possible number. It has to be honest. We can bill
        ±$${NSA_VARIANCE_CAP} of it, and Maya knows that going in.
        The hospitals that get sued under the NSA aren't the ones
        with high estimates — they're the ones with low estimates
        that turn into eight-times-higher bills.
      </p>
      <div class="register hospital">HOSPITAL · later that morning</div>
      <p>
        Theo signs off the GFE packet to compliance and pulls the
        next docket. "${escape("She's")} going to deliver in two weeks. We need
        the AEOB-equivalent ready when her new insurance starts —
        same line items, different document, different audience."
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
            (classify by who bills it), estimate (returning from
            MRF Cartographer — pick the source), commit (sign the
            regulatory document).</li>
            <li><strong>Patient-facing prevention.</strong> First
            Case where the dragon hasn't arrived yet — we're
            closing the door. Companion to Surprise Bill Specter
            (post-encounter fight) and Lighthouse (post-encounter
            release).</li>
            <li><strong>Three sort-buckets, not two.</strong>
            Co-provider lines disclose-but-don't-price; doula /
            cord-blood don't even appear. Forces the player to
            think about scope, not just sourcing.</li>
            <li><strong>The GFE isn't aspirational.</strong>
            ±$${NSA_VARIANCE_CAP} is the bound. Patients with a
            higher final bill dispute through PPDR; the SDR's
            ruling is binding.</li>
          </ul>
        </div>
        <div>
          <h3>Sibling shape</h3>
          <ul>
            <li>Direct sibling to
            <a href="./mrf-cartographer-prototype.html">MRF Cartographer</a> —
            same hard/soft-coded source distinction, different
            deliverable + a third bucket for co-providers.</li>
            <li>Cousin to
            <a href="./surprise-bill-prototype.html">Surprise Bill Specter</a> —
            both about NSA-era patient billing, but post-encounter
            vs pre-encounter.</li>
            <li>Builds toward Carve-out Phantom @ L16 — same
            co-provider-vs-facility classification, applied to a
            two-bills-for-one-visit puzzle.</li>
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

function classify(id: string, kind: LineKind) {
  const l = lineItems.find(x => x.id === id)
  if (!l) return
  const ls = state.lineStates[id]
  state.transientFeedback = null
  if (l.kind === kind) {
    ls.classification = kind
    state.transientFeedback = { id, message: l.reason, kind: 'good' }
    if (isItemizeDone()) state.resolvedIssues.add('itemize')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: l.reason, kind: 'bad' }
  }
}

function resetClassification(id: string) {
  const ls = state.lineStates[id]
  if (!ls) return
  ls.classification = null
  ls.appliedSource = null
  state.resolvedIssues.delete('itemize')
  state.resolvedIssues.delete('estimate')
  state.resolvedIssues.delete('commit')
  state.transientFeedback = null
}

function applySource(id: string, src: 'cdm' | 'claims') {
  const l = lineItems.find(x => x.id === id)
  if (!l || l.kind !== 'mercy') return
  const ls = state.lineStates[id]
  state.transientFeedback = null
  if (l.correctSource === src) {
    ls.appliedSource = src
    state.transientFeedback = { id, message: `Right source — ${money(l.correctRate ?? 0)} for ${l.label}.`, kind: 'good' }
    if (isEstimateDone()) state.resolvedIssues.add('estimate')
  } else {
    state.failedAttempts++
    const msg = src === 'cdm'
      ? `CDM is the rack rate; for soft-coded ${l.label.toLowerCase()}, payers don't pay it. Pull from claim history.`
      : `Hard-coded line — there's no claim variance to summarize. Pull from CDM.`
    state.transientFeedback = { id, message: msg, kind: 'bad' }
  }
}

function attemptSubmit() {
  if (state.resolvedIssues.has('itemize') && state.resolvedIssues.has('estimate')) {
    state.resolvedIssues.add('commit')
    state.packetSubmitted = true
    notifyParentVictory('gfe-oracle')
  }
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  for (const id in state.lineStates) {
    state.lineStates[id] = { classification: null, appliedSource: null }
  }
  state.inspectingId = null
  state.transientFeedback = null
  state.resolvedIssues = new Set()
  state.failedAttempts = 0
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
  const el = target.closest('[data-action]') as HTMLElement | null
  if (!el) return
  const action = el.dataset.action
  switch (action) {
    case 'classify':
      if (el.dataset.id && el.dataset.kind) classify(el.dataset.id, el.dataset.kind as LineKind)
      break
    case 'reset-classification':
      if (el.dataset.id) resetClassification(el.dataset.id)
      break
    case 'apply-source':
      if (el.dataset.id && el.dataset.src) applySource(el.dataset.id, el.dataset.src as 'cdm' | 'claims')
      break
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
  /* Itemize panel */
  .itemize-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .itemize-panel.done { border-left-color: var(--good); }
  .ip-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .ip-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .ip-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .li-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .li-table th, .li-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #232a36; vertical-align: middle; }
  .li-table th { font-size: 10.5px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
  .li-row.classified.mercy td { background: rgba(126, 226, 193, 0.04); }
  .li-row.classified.co-provider td { background: rgba(240, 168, 104, 0.04); }
  .li-row.classified.not-applicable td { opacity: 0.6; }
  .classify-cell { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .kind-badge { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; font-weight: 700; }
  .kind-badge.mercy { background: rgba(126, 226, 193, 0.15); color: var(--good); border: 1px solid #2c5547; }
  .kind-badge.co-provider { background: rgba(240, 168, 104, 0.15); color: var(--accent-2); border: 1px solid #4a3a2a; }
  .kind-badge.not-applicable { background: rgba(138, 147, 163, 0.10); color: var(--ink-dim); border: 1px solid #2a3142; }
  .btn.small { padding: 4px 10px; font-size: 11.5px; }

  /* Estimate panel — Mercy lines table with per-row source picker */
  .estimate-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent-2); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .estimate-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .estimate-panel.done   { border-left-color: var(--good); }
  .ep-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .ep-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .ep-tag.idle { color: var(--ink-dim); }
  .ep-tag.active { color: var(--accent-2); }
  .ep-tag.done { color: var(--good); }
  .ep-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .mercy-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .mercy-table th, .mercy-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #232a36; vertical-align: middle; }
  .mercy-table th { font-size: 10.5px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
  .mercy-table th.right, .mercy-table td.right { text-align: right; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .mercy-row.correct td { background: rgba(126, 226, 193, 0.06); }
  .li-shape { font-size: 11.5px; color: var(--ink-dim); font-style: italic; }
  .src-cell { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .src-badge { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; font-weight: 700; }
  .src-badge.applied { background: rgba(126, 226, 193, 0.15); color: var(--good); border: 1px solid #2c5547; }

  /* Commit panel */
  .commit-panel { background: var(--panel); border: 1px solid #232a36; border-left-width: 4px; border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .commit-panel.idle   { border-left-color: #2a3142; opacity: 0.55; }
  .commit-panel.active { border-left-color: var(--accent-2); }
  .commit-panel.done   { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126, 226, 193, 0.04), transparent); }
  .cp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .cp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .commit-panel.idle   .cp-tag { color: var(--ink-dim); }
  .commit-panel.active .cp-tag { color: var(--accent-2); }
  .commit-panel.done   .cp-tag { color: var(--good); }
  .cp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .commit-summary { background: var(--panel-2); border-radius: 5px; padding: 10px 14px; font-size: 13px; }
  .cs-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed #2a3142; }
  .cs-row:last-child { border-bottom: 0; }
  .cs-row.total { margin-top: 6px; padding-top: 8px; border-top: 1px solid #2a3142; border-bottom: 0; font-size: 13px; }
  .cs-row.total strong { color: var(--accent-2); font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }

  /* Recap green */
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
      if (changed) rerender()
    }
  })
}

mount()
