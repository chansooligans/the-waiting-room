// Carve-out Phantom @ L16 — directly contracted facility, indirect
// physician group. Two bills for one ER visit; the patient never
// chose the second one and isn't supposed to owe it.
//
// Cousin to Surprise Bill Specter (same NSA protections, different
// shape: that one classifies a single bill; this one walks the
// contract chain to *find* the boundary). Cousin to GFE Oracle
// (same co-provider classification axis; that one is pre-service,
// this one is post-encounter cleanup).
//
// Actions:
//   - TRACE-CONTRACT: 5 contract-relationship statements; player
//     marks each true / false. The "true" pattern reveals that
//     Mercy is in-network with Anthem but the ER physician group
//     inside Mercy isn't. That gap is the Phantom.
//   - APPLY-NSA: pick the right NSA protection category from a
//     small lattice (emergency carve-out, in-network-facility-OON-
//     staff, opt-out consent, no protection).
//   - RESOLVE: pick the right action from five options. Only one
//     applies the in-network cost cap, files IDR between payer +
//     OON physician group, and zeroes Marcus's exposure on the
//     phantom bill.
//
// Demonstrates: "two bills for one visit" is rarely about coding
// — it's about who contracted with whom. Reading the contract
// chain is the core action.
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

// ===== Domain types =====

interface ContractStatement {
  id: string
  text: string
  /** Truth value the player should mark. */
  truth: boolean
  /** Why this is true / false. Shown as feedback after the player picks. */
  reason: string
}

interface NsaCategory {
  id: string
  /** Federal section / common name. */
  label: string
  /** Plain-English summary. */
  summary: string
  correct: boolean
  feedback: string
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
  verb: 'trace' | 'classify' | 'resolve'
}

interface GlossaryEntry {
  term: string
  plain: string
}

// ===== Encounter data =====

const PATIENT = 'Marcus Webb'
const FACILITY = 'Mercy General Hospital'
const PHYSICIAN_GROUP = 'Riverside Emergency Physicians, P.C.'
const PAYER = 'Anthem PPO'
const FACILITY_BILL = 620   // Marcus's in-network ER cost-share (already paid)
const PHANTOM_BILL = 2_840  // surprise bill from the OON physician group
const VISIT_DATE = '2026-03-08'

const contractStatements: ContractStatement[] = [
  {
    id: 's1',
    text: `Mercy General Hospital is in-network with ${PAYER}.`,
    truth: true,
    reason: 'Mercy and Anthem have a direct facility contract — the ER visit was at an in-network facility from Marcus\'s perspective. This is the foundation: in-network facility is what makes the NSA carve-out apply.',
  },
  {
    id: 's2',
    text: `${PHYSICIAN_GROUP} is in-network with ${PAYER}.`,
    truth: false,
    reason: 'Riverside is the staffing contractor at Mercy\'s ER, but they negotiate their own payer contracts separately — and they are NOT contracted with Anthem. This gap is the Phantom: same building, same patient, different network status.',
  },
  {
    id: 's3',
    text: `Mercy General employs the ER physicians directly.`,
    truth: false,
    reason: 'Most US hospitals don\'t employ ER physicians directly — they contract with a staffing group like Riverside. The patient sees a doctor at Mercy; the patient owes Riverside. That structural separation is what creates surprise bills.',
  },
  {
    id: 's4',
    text: `Marcus knowingly chose to receive care from an out-of-network provider.`,
    truth: false,
    reason: 'Marcus walked into Mercy\'s ER with chest pain. He did not see a Riverside intake form, did not consent to OON care, and could not have shopped for an alternative provider in an emergency. NSA protections turn entirely on this point.',
  },
  {
    id: 's5',
    text: `The visit was an emergency under federal law.`,
    truth: true,
    reason: 'Chest pain triaged as ESI 2 ("emergent") in Mercy\'s ER. The federal definition of "emergency services" (PHSA §2799A-1) sweeps in any service furnished after a prudent layperson would conclude they need emergency care. Confirmed.',
  },
]

const nsaCategories: NsaCategory[] = [
  {
    id: 'er-carveout',
    label: 'NSA Emergency Carve-Out (PHSA §2799A-1(a))',
    summary: 'Patient owes only the in-network cost-share for emergency services. OON provider must accept in-network rate (or QPA) less patient cost-share; payer + provider settle the rest via federal IDR.',
    correct: true,
    feedback: 'Right category. ER visit at an in-network facility delivered by an OON provider. Marcus\'s liability is capped at his in-network ER copay + coinsurance — the $620 he already paid. The $2,840 phantom bill is between Anthem and Riverside.',
  },
  {
    id: 'innet-facility-oon-staff',
    label: 'NSA In-Network Facility / OON Staff (PHSA §2799A-1(b))',
    summary: 'Non-emergency ancillary services (anesthesia, radiology, pathology, hospitalist) at an in-network facility, delivered by an OON provider. Same patient cost cap; same IDR mechanism. Excludes ER visits (those go under (a)).',
    correct: false,
    feedback: 'Close — same protection mechanic, but the wrong subsection. (b) covers non-emergency ancillary services like anesthesia at a planned surgery. ER chest pain falls under (a). The cap is the same, the IDR is the same, but the legal citation matters when filing.',
  },
  {
    id: 'patient-consent',
    label: 'Patient consent to OON (NSA opt-out, sec. 2799B-2)',
    summary: 'Non-emergency, non-ancillary services where the OON provider gave the patient at least 72 hours advance notice and obtained written consent. Consent waives the NSA protections.',
    correct: false,
    feedback: 'Consent waivers can\'t apply to emergencies (federal law explicitly bars them for emergency services). Even if Riverside had a consent form, it wouldn\'t be valid for a chest-pain ER visit. Wrong category.',
  },
  {
    id: 'no-protection',
    label: 'No NSA protection — standard balance billing rules',
    summary: 'Patient knowingly went out-of-network for a non-emergency, non-ancillary service. Patient owes the full OON balance subject to state law.',
    correct: false,
    feedback: 'Picking this category leaves Marcus on the hook for $2,840. Marcus walked into an ER for chest pain — by definition not a knowing OON choice. NSA absolutely applies.',
  },
]

const resolutions: Resolution[] = [
  {
    id: 'apply-nsa',
    label: 'Apply NSA: cap Marcus\'s cost at the in-network amount; file IDR between Anthem + Riverside; send Marcus a written notice that he owes nothing further.',
    correct: true,
    feedback: 'Right move. Marcus already paid his $620 in-network cost-share at the facility window. The phantom $2,840 invoice gets reversed; Riverside files Federal IDR with Anthem to settle the rate dispute. Marcus is whole.',
  },
  {
    id: 'pay-the-bill',
    label: 'Tell Marcus to pay Riverside the $2,840 directly and file a complaint with the state insurance commissioner if he disagrees.',
    correct: false,
    feedback: 'NSA prohibits balance billing for emergency services full stop. Telling Marcus to pay first and complain later is a reportable NSA violation — and the kind of thing OIG enforcement is actively pursuing.',
  },
  {
    id: 'refund-everything',
    label: 'Refund Marcus the $620 he paid Mercy and waive the Riverside bill entirely.',
    correct: false,
    feedback: 'Marcus does owe the in-network cost-share — that\'s what the $620 was. Refunding it gives him a discount he isn\'t entitled to and creates an audit finding for the hospital. The $2,840 isn\'t Mercy\'s to waive (it\'s Riverside\'s); the cap is the answer.',
  },
  {
    id: 'route-to-ppdr',
    label: 'Route Marcus to the federal Patient-Provider Dispute Resolution (PPDR) process for relief.',
    correct: false,
    feedback: 'PPDR is for self-pay GFE-vs-final-bill disputes (cousin Case: GFE Oracle). Marcus is insured — wrong forum. The right mechanism here is the NSA cost-share cap + provider-payer IDR.',
  },
  {
    id: 'send-to-collections',
    label: 'Tell Marcus the bill is valid and route the unpaid balance to collections after 90 days.',
    correct: false,
    feedback: 'The bill itself violates the NSA — it should never have reached Marcus in this form. Sending him to collections compounds the violation and exposes the hospital to FDCPA + state-law liability on top of the federal NSA exposure.',
  },
]

const issues: Issue[] = [
  {
    id: 'trace',
    label: 'Trace the contract chain. Mark each statement true or false.',
    recap: 'You walked the chain. Mercy is in-network with Anthem; Riverside is not. Marcus didn\'t consent to OON care. The visit was an emergency. The Phantom is exactly the gap between the facility contract and the staffing contract.',
    verb: 'trace',
  },
  {
    id: 'classify',
    label: 'Apply the right NSA protection category.',
    recap: 'Emergency carve-out — PHSA §2799A-1(a). ER service at an in-network facility delivered by an OON provider. Marcus\'s exposure is capped at the in-network cost-share; Anthem + Riverside fight the rest through federal IDR.',
    verb: 'classify',
  },
  {
    id: 'resolve',
    label: 'Resolve the patient\'s account and route the dispute correctly.',
    recap: 'Phantom $2,840 reversed at Riverside. Anthem pays Riverside the in-network rate (or QPA) less Marcus\'s already-collected cost-share. Marcus gets a written notice his account is settled. The dispute lives downstream between payer and group.',
    verb: 'resolve',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'NSA': {
    term: 'NSA (No Surprises Act)',
    plain: "Federal law in effect since Jan 1, 2022. Caps patient cost-share at the in-network amount for emergency services and for non-emergency services at in-network facilities. Removes the patient from balance-billing disputes between payers and out-of-network providers. The disputes themselves still happen — they just happen between the payer and the provider through federal Independent Dispute Resolution (IDR), without the patient in the middle.",
  },
  'state surprise-billing laws': {
    term: 'State surprise-billing laws (CA / NY / TX / others)',
    plain: "Many states had surprise-billing protection laws BEFORE the federal NSA, and most kept their state laws in force. Common patterns: California AB-72 (uses state IDR for fully-insured commercial; NSA preempts for self-funded ERISA plans), New York DFS Surprise Bill law, Texas HB-1714 / SB-1264 (state IDR for state-regulated plans). When a Case lands in California or NY, the state law and federal NSA layer; the right forum can be state IDR, federal IDR, or both. This Case treats federal NSA as the only framework for clarity; reality involves checking state law first and filing in the right forum (state vs federal IDR mechanism) based on whether the plan is state-regulated or self-funded.",
  },
  'IDR': {
    term: 'IDR (Independent Dispute Resolution)',
    plain: "Federal arbitration process for payer-provider rate disputes under the NSA. Either side initiates; both submit best-and-final offers; a CMS-certified IDR entity picks one. The decision is binding for 90 days. Most disputes settle before IDR; a meaningful chunk go through. The patient is never a party to IDR — that's the whole point.",
  },
  'QPA': {
    term: 'QPA (Qualifying Payment Amount)',
    plain: "The median in-network rate the payer paid for that service in that geographic area in the prior year. Used as the default benchmark for what an out-of-network provider gets paid under NSA, and as the patient's cost-share basis. The payer calculates QPA; the provider can challenge it through IDR. QPA is the central number in every NSA dispute.",
  },
  'in-network facility': {
    term: 'In-network facility',
    plain: "A hospital, ASC, or freestanding ER that has a direct contract with the patient's payer. The NSA protections turn on the *facility's* network status — even when the providers practicing inside the facility are on different contracts.",
  },
  'OON': {
    term: 'Out-of-network (OON)',
    plain: "A provider that doesn't have a direct contract with the patient's payer. Without NSA, OON providers can balance-bill the patient for the difference between their charge and what the payer pays. Under NSA, balance billing is prohibited for emergency services and for ancillary services at in-network facilities — the whole point of the law.",
  },
  'staffing contract': {
    term: 'Staffing contract / contracted physician group',
    plain: "Most US hospitals don't employ their ER physicians, anesthesiologists, radiologists, or pathologists directly. They contract with a third-party staffing group (TeamHealth, Envision, USACS, regional groups like Riverside). The hospital is in-network; the group is on its own payer contracts. When the group's contracts don't align with the hospital's, the patient gets two bills — one in-network, one out — for the same visit. This is the structural setup that makes the Phantom possible.",
  },
  'PPDR': {
    term: 'PPDR (Patient-Provider Dispute Resolution)',
    plain: "Cousin to IDR. Federal process for self-pay patients whose final bill exceeds the Good Faith Estimate by more than $400. Different audience, different document, different mechanism. PPDR is for GFE disputes; IDR is for payer-provider rate disputes. Don't conflate them — picking the wrong forum loses the case.",
  },
  'balance billing': {
    term: 'Balance billing',
    plain: "Provider charging the patient for the difference between the provider's full charge and what the payer paid. Standard practice for OON care before NSA; mostly prohibited under NSA for emergency + in-network-facility scenarios. The Phantom is a balance bill that the NSA invalidates — but only if someone walks the contract chain and applies the right citation.",
  },
}

// ===== Runtime state =====

interface StatementState {
  pick: boolean | null
  feedbackKind: 'good' | 'bad' | null
}

const state = {
  briefingDone: false,
  briefingOpen: false,
  statementStates: contractStatements.reduce((m, s) => { m[s.id] = { pick: null, feedbackKind: null }; return m }, {} as Record<string, StatementState>),
  appliedCategoryId: null as string | null,
  appliedResolutionId: null as string | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isTraceDone(): boolean {
  return contractStatements.every(s => state.statementStates[s.id].pick === s.truth)
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
      ${renderTracePanel()}
      ${renderClassifyPanel()}
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
        <h1>Carve-out Phantom <span class="muted">@ L16 — first sketch</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./prototypes.html">← back to catalog</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          A two-bills-for-one-visit Case. ${escape(PATIENT)} got an
          ${money(FACILITY_BILL)} bill from Mercy and a separate
          ${money(PHANTOM_BILL)} bill from
          ${escape(PHYSICIAN_GROUP)} for the same ER visit. Mercy
          is ${term('in-network facility')} with Anthem.
          The physician group isn't. The puzzle is which contract
          chain governs and which ${term('NSA')} protection applies.
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
      <div class="register hospital">HOSPITAL · billing office · this morning</div>
      <p>
        ${escape(PATIENT)} on the line. Polite, increasingly less so.
        "I came to your ER for chest pain on ${VISIT_DATE}. I paid my
        copay at the window — ${money(FACILITY_BILL)}. Anthem said
        you were in-network. Now I'm holding a separate bill from
        ${escape(PHYSICIAN_GROUP)} for ${money(PHANTOM_BILL)} that
        says I'm out-of-network. I never met that group. I never
        chose them. Why is this on me?"
      </p>
      <p>
        He's not wrong. He's also not the first. ER staffing
        ${term('staffing contract', 'contracts')} run separately from
        facility contracts; ${term('NSA')} closed most of this gap
        in 2022, but Marcus's bill says nobody at Riverside got the
        memo.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The two bills slide
        a half-pixel left, then settle. The contract chain
        appears, statement by statement, waiting for you to walk it.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'Two bills, one visit, no warning. Walk it.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "Marcus is on the phone, mad, and right to be. The Phantom
        is the gap between Mercy's payer contract and Riverside's
        payer contract. Same building. Same shift. Different network
        status. Standard issue for ER staffing in this country."
      </p>
      <p>
        "Three issues:"
      </p>
      <ul>
        <li>
          Five statements about who is
          contracted with whom. Mark each true or false. The
          pattern reveals the gap.
        </li>
        <li>
          Pick the right protection
          category. Four options; only one matches. Wrong cite =
          wrong forum, wrong remedy.
        </li>
        <li>
          Five action options. One zeros
          Marcus's exposure and routes the dispute correctly. The
          others either over-refund, under-protect, or send the
          right answer to the wrong forum."
        </li>
      </ul>
      <p>
        "The patient is never the right party in an
        ${term('IDR')} dispute. The whole NSA was passed to make
        sure of that. Marcus pays his in-network cost-share —
        ${money(FACILITY_BILL)}, already done — and walks. The fight
        between Anthem and Riverside is a different room."
      </p>
      <p class="briefing-sign">"Patient first, IDR second. — D."</p>
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

function renderTracePanel(): string {
  const done = state.resolvedIssues.has('trace')
  return `
    <section class="trace-panel ${done ? 'done' : ''}">
      <div class="tp-h">
        <span class="tp-tag">CONTRACT CHAIN · 5 statements</span>
        <span class="tp-sub">${done
          ? 'Walked. Mercy in-network; Riverside not; Marcus didn\'t consent; visit was emergency. The Phantom is the gap.'
          : 'For each statement, mark true or false. Get every one right to map the chain.'}</span>
      </div>
      <ul class="stmt-list">
        ${contractStatements.map(s => renderStatementRow(s)).join('')}
      </ul>
      ${state.transientFeedback && contractStatements.some(s => s.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('trace') : ''}
    </section>
  `
}

function renderStatementRow(s: ContractStatement): string {
  const ss = state.statementStates[s.id]
  const decided = ss.pick !== null
  const correct = ss.pick === s.truth
  return `
    <li class="stmt ${decided ? (correct ? 'correct' : 'wrong') : ''}">
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

function renderClassifyPanel(): string {
  const unlocked = state.resolvedIssues.has('trace')
  const done = state.resolvedIssues.has('classify')
  if (!unlocked) {
    return `
      <section class="classify-panel locked">
        <div class="cl-h">
          <span class="cl-tag idle">NSA PROTECTION CATEGORY</span>
          <span class="cl-sub">Locked until the contract chain is walked.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="classify-panel ${done ? 'done' : 'active'}">
      <div class="cl-h">
        <span class="cl-tag ${done ? 'done' : 'active'}">NSA PROTECTION CATEGORY · 4 options</span>
        <span class="cl-sub">${done
          ? 'Emergency carve-out — PHSA §2799A-1(a). Marcus\'s cost capped at in-network cost-share.'
          : 'Pick the right citation. Wrong cite = wrong forum, wrong remedy.'}</span>
      </div>
      <ul class="nsa-list">
        ${nsaCategories.map(c => renderNsaOption(c)).join('')}
      </ul>
      ${state.transientFeedback && nsaCategories.some(c => c.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('classify') : ''}
    </section>
  `
}

function renderNsaOption(c: NsaCategory): string {
  const applied = state.appliedCategoryId === c.id
  const locked = state.appliedCategoryId !== null && !applied
  return `
    <li class="nsa-opt ${applied ? 'applied' : ''} ${locked ? 'locked' : ''}">
      <button class="nsa-btn" data-action="apply-category" data-id="${c.id}" ${state.appliedCategoryId !== null && !applied ? 'disabled' : ''}>
        <span class="nsa-label">${escape(c.label)}</span>
        <span class="nsa-summary">${escape(c.summary)}</span>
        ${applied ? '<span class="nsa-badge applied">APPLIED</span>' : ''}
      </button>
    </li>
  `
}

function renderResolvePanel(): string {
  const unlocked = state.resolvedIssues.has('classify')
  const done = state.resolvedIssues.has('resolve')
  if (!unlocked) {
    return `
      <section class="resolve-panel locked">
        <div class="rp-h">
          <span class="rp-tag idle">RESOLUTION</span>
          <span class="rp-sub">Locked until the NSA category is applied.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="resolve-panel ${done ? 'done' : 'active'}">
      <div class="rp-h">
        <span class="rp-tag ${done ? 'done' : 'active'}">RESOLUTION · 5 options</span>
        <span class="rp-sub">${done
          ? 'Phantom reversed. IDR filed. Marcus\'s account closed.'
          : 'One option zeros Marcus\'s exposure and routes the dispute correctly.'}</span>
      </div>
      <ul class="res-list">
        ${resolutions.map(r => renderResolutionOption(r)).join('')}
      </ul>
      ${state.transientFeedback && resolutions.some(r => r.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('resolve') : ''}
    </section>
  `
}

function renderResolutionOption(r: Resolution): string {
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
      <div class="checklist-h">PATIENT ACCOUNT · 3 issues to resolve</div>
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
        Close ${escape(PATIENT)}'s account · ${money(PHANTOM_BILL)} reversed
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

const RECAP: CaseRecap = CASE_RECAPS['carveout-phantom']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">CASE CLOSED</div>
      <h2>${money(PHANTOM_BILL)} phantom reversed. Marcus's account is whole.</h2>
      <p>
        Riverside reversed the OON balance bill. Anthem opened a federal
        ${term('IDR')} case against Riverside; the rate dispute lives between
        them now. Marcus got a written notice that his account is settled
        and a copy of the NSA disclosure he should have received at intake.
      </p>
      <p class="muted">
        The trick wasn't the math — there was barely any. The trick was
        knowing the contract chain runs sideways across the building, not
        in a straight line through it. Mercy and Riverside are the same
        ER from the patient's chair. Different contracts, different
        network status, same patient — that's the gap NSA closes, but
        only if someone reads the chain.
      </p>
      <div class="register hospital">HOSPITAL · billing office · later</div>
      <p>
        Marcus called back to thank you. "I thought I was going to have
        to fight this in court." Not anymore. The next call is already
        on hold — a different patient, a different staffing group, the
        same Phantom.
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
            <li><strong>Three actions:</strong> tracing the
            contract chain (walk who-contracts-with-whom), applying the
            NSA citation, and resolving (route the dispute).</li>
            <li><strong>Two bills are not always two errors.</strong>
            Sometimes the second bill is structurally inevitable
            (separate staffing contract); the puzzle is whether
            it's NSA-protected or balance-billable.</li>
            <li><strong>The patient is never the right party
            in an IDR dispute.</strong> NSA's whole architecture
            takes the patient out of the middle; the player's
            job is to honor that.</li>
            <li><strong>Wrong forum, wrong remedy.</strong> PPDR
            (cousin Case: GFE Oracle) is the wrong forum here.
            Reading the right citation is half the work.</li>
          </ul>
        </div>
        <div>
          <h3>Sibling shape</h3>
          <ul>
            <li>Cousin to
            <a href="./surprise-bill-prototype.html">Surprise Bill Specter</a> —
            same NSA mechanic, different framing (one bill vs
            two; classification vs contract-tracing).</li>
            <li>Cousin to
            <a href="./gfe-oracle-prototype.html">GFE Oracle</a> —
            same co-provider classification axis; pre- vs
            post-encounter.</li>
            <li>The contract-chain trace + NSA-citation lattice
            is reusable for any "who's contracted with whom"
            puzzle.</li>
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

function pickStatement(id: string, pick: boolean) {
  const s = contractStatements.find(x => x.id === id)
  if (!s) return
  const ss = state.statementStates[id]
  state.transientFeedback = null
  if (s.truth === pick) {
    ss.pick = pick
    ss.feedbackKind = 'good'
    state.transientFeedback = { id, message: s.reason, kind: 'good' }
    if (isTraceDone()) state.resolvedIssues.add('trace')
  } else {
    state.failedAttempts++
    ss.feedbackKind = 'bad'
    state.transientFeedback = { id, message: s.reason, kind: 'bad' }
  }
}

function resetStmt(id: string) {
  const ss = state.statementStates[id]
  if (!ss) return
  ss.pick = null
  ss.feedbackKind = null
  state.resolvedIssues.delete('trace')
  state.resolvedIssues.delete('classify')
  state.resolvedIssues.delete('resolve')
  state.transientFeedback = null
}

function applyCategory(id: string) {
  const c = nsaCategories.find(x => x.id === id)
  if (!c) return
  state.transientFeedback = null
  if (c.correct) {
    state.appliedCategoryId = id
    state.resolvedIssues.add('classify')
    state.transientFeedback = { id, message: c.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: c.feedback, kind: 'bad' }
  }
}

function applyResolution(id: string) {
  const r = resolutions.find(x => x.id === id)
  if (!r) return
  state.transientFeedback = null
  if (r.correct) {
    state.appliedResolutionId = id
    state.resolvedIssues.add('resolve')
    state.transientFeedback = { id, message: r.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: r.feedback, kind: 'bad' }
  }
}

function attemptSubmit() {
  if (issues.every(i => state.resolvedIssues.has(i.id))) {
    state.packetSubmitted = true
    notifyParentVictory('carveout-phantom')
  }
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  for (const id in state.statementStates) {
    state.statementStates[id] = { pick: null, feedbackKind: null }
  }
  state.appliedCategoryId = null
  state.appliedResolutionId = null
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
    case 'pick-stmt':
      if (el.dataset.id && el.dataset.pick) pickStatement(el.dataset.id, el.dataset.pick === 'true')
      break
    case 'reset-stmt':
      if (el.dataset.id) resetStmt(el.dataset.id)
      break
    case 'apply-category':
      if (el.dataset.id) applyCategory(el.dataset.id)
      break
    case 'apply-resolution':
      if (el.dataset.id) applyResolution(el.dataset.id)
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
  /* Trace panel */
  .trace-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .trace-panel.done { border-left-color: var(--good); }
  .tp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .tp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .tp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .stmt-list { list-style: none; padding-left: 0; margin: 0; }
  .stmt { display: flex; align-items: center; gap: 16px; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 6px; border-left: 3px solid transparent; }
  .stmt.correct { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .stmt.wrong   { border-left-color: var(--bad); }
  .stmt-text { flex: 1; font-size: 13px; line-height: 1.5; }
  .stmt-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .stmt-badge { font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; }
  .stmt-badge.true  { background: rgba(126, 226, 193, 0.15); color: var(--good); border: 1px solid #2c5547; }
  .stmt-badge.false { background: rgba(239, 91, 123, 0.10); color: var(--bad); border: 1px solid #4a2a32; }
  .btn.small { padding: 4px 10px; font-size: 11.5px; }

  /* Classify panel */
  .classify-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent-2); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .classify-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .classify-panel.done   { border-left-color: var(--good); }
  .cl-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .cl-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .cl-tag.idle { color: var(--ink-dim); }
  .cl-tag.active { color: var(--accent-2); }
  .cl-tag.done { color: var(--good); }
  .cl-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .nsa-list { list-style: none; padding-left: 0; margin: 0; }
  .nsa-opt { margin-bottom: 6px; }
  .nsa-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 12px 14px; text-align: left; display: flex; flex-direction: column; gap: 6px; font: inherit; transition: all 0.15s; position: relative; }
  .nsa-btn:hover:not(:disabled) { background: #232b3a; border-color: var(--accent-2); }
  .nsa-btn:disabled { opacity: 0.45; cursor: default; }
  .nsa-opt.applied .nsa-btn { border-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); opacity: 1; }
  .nsa-label { font-size: 13px; font-weight: 600; color: var(--ink); }
  .nsa-summary { font-size: 12px; color: var(--ink-dim); line-height: 1.55; }
  .nsa-badge.applied { position: absolute; top: 10px; right: 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; font-weight: 700; }

  /* Resolve panel */
  .resolve-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent-2); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .resolve-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .resolve-panel.done   { border-left-color: var(--good); }
  .rp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .rp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .rp-tag.idle { color: var(--ink-dim); }
  .rp-tag.active { color: var(--accent-2); }
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
