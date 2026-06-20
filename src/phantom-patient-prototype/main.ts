// Phantom Patient @ L21 — wrong-MRN chart merge. Two patients
// with the same DOB at Mercy got their charts cross-merged at
// registration; the encounter ended up on the wrong MRN; the
// claim came back CO-31 (patient cannot be identified). The fix
// is to walk the audit trail backwards, find the merge point,
// split the records, and refile each claim against its correct MRN.
//
// Action set:
//   - Walk 5 audit-trail events; mark which is the merge point.
//   - 4 split-strategy options. Pick the right one.
//   - 4 resolution paths.
//
// Demonstrates: identity is upstream of every revenue-cycle
// process. When MRN goes wrong, every downstream step compounds
// the error.
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

interface AuditEvent {
  id: string
  timestamp: string
  step: string
  detail: string
  isMergePoint: boolean
  reason: string
}

interface SplitStrategy {
  id: string
  label: string
  detail: string
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
  verb: 'trace' | 'unmerge' | 'refile'
}

interface GlossaryEntry { term: string; plain: string }

// ===== Encounter data =====

const PATIENT_A = 'Maria Hernández (DOB 1985-03-12, MRN 0044-7821)'
const PATIENT_B = 'María Hernández (DOB 1985-03-12, MRN 0044-9112)'
const ENCOUNTER_DOS = '2026-04-04'

const events: AuditEvent[] = [
  {
    id: 'pre-reg',
    timestamp: '2026-04-04 06:48',
    step: 'Pre-registration phone call',
    detail: 'Pre-reg agent: caller is "Maria Hernández, DOB 1985-03-12"; agent searches MPI by DOB+last name; gets two hits.',
    isMergePoint: false,
    reason: 'Two-hit results are normal for common names with same DOB; the bug isn\'t here. Pre-reg flagged it correctly and queued for the registration desk to disambiguate.',
  },
  {
    id: 'reg-desk',
    timestamp: '2026-04-04 09:14',
    step: 'Registration desk · check-in',
    detail: 'Reg clerk picks ONE of the two MRN hits without confirming photo ID + address against the chart. Clicks "use existing MRN 0044-7821."',
    isMergePoint: true,
    reason: `THIS is the merge point. The clerk attached today's encounter to MRN 0044-7821 (Maria Hernández, the *other* patient). The Maria who showed up today is actually MRN 0044-9112 (María with the accent). One missed ID-check verifies into a chart cross-link that the rest of the workflow inherits.`,
  },
  {
    id: 'encounter',
    timestamp: '2026-04-04 09:30',
    step: 'Encounter / clinical care',
    detail: 'Clinical staff document care under MRN 0044-7821 — same MRN registration set. Care delivered correctly to the right human; documentation lands under the wrong identity.',
    isMergePoint: false,
    reason: 'Clinical staff didn\'t introduce the error; they used the MRN registration set. The wrong identity propagates here but doesn\'t originate.',
  },
  {
    id: 'coding',
    timestamp: '2026-04-04 14:20',
    step: 'Coding',
    detail: 'Coder pulls chart, codes the encounter accurately (ICD-10 + CPT match the clinical documentation). MRN 0044-7821 still on the encounter.',
    isMergePoint: false,
    reason: 'Coding is downstream of the bug. The codes are right; the MRN they\'re attached to is wrong. Coder didn\'t cause this.',
  },
  {
    id: 'claim',
    timestamp: '2026-04-04 18:42',
    step: 'Claim submission · Aetna',
    detail: 'Claim submitted with MRN 0044-7821, DOB 1985-03-12. Aetna eligibility check returns CO-31 (patient cannot be identified) because Maria-with-7821 isn\'t covered under this employer\'s plan; María-with-9112 is.',
    isMergePoint: false,
    reason: 'CO-31 is the *symptom*. Aetna couldn\'t identify the patient because the MRN/policy combo doesn\'t match anyone they have. The claim system did its job; the upstream identity error is what blew up here.',
  },
]

const splitStrategies: SplitStrategy[] = [
  {
    id: 'identity-verify',
    label: 'Re-verify identity at the desk',
    detail: `Pull both charts. Confirm photo ID + address + insurance card against MRN 0044-7821 (Maria, no accent) and MRN 0044-9112 (María, with accent). Today's encounter belongs to MRN 0044-9112.`,
    correct: true,
    feedback: 'Right move. Identity verification at the desk is the only authoritative way to disambiguate same-DOB twins. Photo ID + address match confirms MRN 0044-9112 is today\'s patient. Move the encounter to the correct MRN; flag MRN 0044-7821 as unaffected.',
  },
  {
    id: 'merge-to-one',
    label: 'Merge both MRNs into a single record',
    detail: 'Combine MRN 0044-7821 and MRN 0044-9112 into one consolidated chart since they share DOB.',
    correct: false,
    feedback: 'Catastrophic. These are two different humans who happen to share a DOB. Merging their charts contaminates both — Patient A would inherit Patient B\'s diagnoses, allergies, medication history. This is exactly the kind of error that triggers HIPAA breach notifications + safety incidents.',
  },
  {
    id: 'create-new-mrn',
    label: 'Issue a fresh MRN for today\'s encounter',
    detail: 'Spawn a new MRN to disambiguate; abandon both existing ones for this visit.',
    correct: false,
    feedback: 'In some MPI scenarios spawning a new MRN IS right — when both existing MRNs are confirmed-broken merges that need full unwind first, or when the patient genuinely has no prior chart at this facility. In Marisol\'s case, MRN 0044-9112 already exists and is hers; the right move is to identify-verify and route to that existing chart. Spawning a third MRN now duplicates her in the system; tomorrow\'s registration faces three hits instead of two. Don\'t spawn unnecessarily.',
  },
  {
    id: 'just-resubmit',
    label: 'Resubmit the claim with corrected DOB',
    detail: 'Edit the DOB on the claim until eligibility matches.',
    correct: false,
    feedback: 'Submitting a different DOB to make eligibility match is fraud — claim DOB has to match the patient\'s actual DOB. The DOB isn\'t wrong; the MRN/policy linkage is wrong. Don\'t paper over an identity error with a fictional birth date.',
  },
]

const resolutions: Resolution[] = [
  {
    id: 'split-and-refile',
    label: `Move today's encounter to MRN 0044-9112 (the correct María). Refile the claim under that MRN/policy. File an MPI-cleanup ticket flagging the same-DOB collision so reg-desk gets a hard-stop on the next check-in.`,
    correct: true,
    feedback: 'Right resolution. Encounter follows the correct human. Aetna eligibility now matches María\'s plan; the corrected claim adjudicates. The MPI-cleanup ticket prevents the next clerk from making the same pick blindfolded.',
  },
  {
    id: 'just-the-claim',
    label: `Move today's encounter to MRN 0044-9112 and refile. Skip the MPI ticket — it's not our job.`,
    correct: false,
    feedback: 'Half a fix. The current claim works, but the next time anyone with this DOB walks in, the same registration desk hits the same two-MRN ambiguity with no system-level guardrail. Identity errors recur until the system surfaces the conflict.',
  },
  {
    id: 'apologize-and-pay',
    label: 'Tell Aetna the patient changed coverage; refile under María\'s plan without correcting the MRN.',
    correct: false,
    feedback: 'You\'d be filing a Maria claim under a María plan. The clinical record still says Maria; the payer record says María; the chart audit will surface the mismatch in 30 days and Aetna will recoup the entire payment for misrepresentation.',
  },
  {
    id: 'ppdr-route',
    label: 'Refer the patient to PPDR.',
    correct: false,
    feedback: 'PPDR is for self-pay GFE disputes (cousin Case: GFE Oracle). María has insurance; the issue is internal identity management, not patient-provider billing dispute. Wrong forum.',
  },
]

const issues: Issue[] = [
  {
    id: 'trace',
    label: 'Trace the audit trail. Find the merge point.',
    recap: 'You walked the trail backwards. The registration desk\'s "use existing MRN 0044-7821" click — without ID re-verification against the chart — is the merge point. Pre-reg surfaced the ambiguity correctly; the desk failed to disambiguate.',
    verb: 'trace',
  },
  {
    id: 'unmerge',
    label: 'Pick the split strategy that doesn\'t make the MPI worse.',
    recap: 'Identity verification at the desk + move the encounter to the correct MRN. Don\'t merge charts (catastrophic). Don\'t spawn a new MRN (worsens MPI). Don\'t fudge the DOB (fraud).',
    verb: 'unmerge',
  },
  {
    id: 'refile',
    label: 'Refile and add the system-level guardrail.',
    recap: 'Encounter moved to MRN 0044-9112. Aetna eligibility matches; corrected claim refiles. MPI-cleanup ticket created so the next same-DOB collision triggers a hard stop at registration.',
    verb: 'refile',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'MRN': {
    term: 'MRN (Medical Record Number)',
    plain: "Hospital-assigned identifier for a patient. One MRN per human per facility, in theory; in practice, MPI errors, name changes, and same-DOB collisions create duplicate or merged records that take real work to clean up. The MRN is the spine of the chart — get it wrong and every downstream system (clinical, billing, eligibility) inherits the error.",
  },
  'MPI': {
    term: 'MPI (Master Patient Index)',
    plain: "The deduplicated list of patients across a facility (or health system). MPI software tries to detect duplicates using DOB + name + SSN + address, then either auto-merges high-confidence matches or flags ambiguous ones for human review. Same-DOB collisions are the classic ambiguity case — common surnames + shared birthdays defeat naive matching.",
  },
  'CO-31': {
    term: 'CO-31 (patient cannot be identified)',
    plain: "Eligibility-side rejection. Payer's system can't find the policy-MRN-DOB combo on the claim. Usually means: wrong DOB, wrong member ID, wrong patient name spelling, OR (this Case) wrong MRN entirely. Different from CO-95 (wrong claim type) and CO-45 (contractual write-off).",
  },
  'chart merge': {
    term: 'Chart merge',
    plain: "Combining two charts into one — either deliberately (when two MRNs are genuinely the same patient) or by mistake (when the registration desk picks the wrong existing MRN at check-in). Deliberate merges go through a clinical reconciliation process; accidental merges contaminate both records and are HIPAA-relevant when discovered.",
  },
  'identity verification': {
    term: 'Identity verification (registration)',
    plain: "Front-desk process for confirming that the human in front of the clerk matches the chart they're being checked in to. Photo ID, address, insurance card, sometimes prior visit confirmation. Becomes critical when MPI returns multiple hits — \"use existing\" without verification is the single most common cause of chart-merge errors.",
  },
}

// ===== Runtime state =====

interface EventState { picked: boolean | null }

const state = {
  briefingDone: false,
  briefingOpen: false,
  eventStates: events.reduce((m, e) => { m[e.id] = { picked: null }; return m }, {} as Record<string, EventState>),
  appliedSplitId: null as string | null,
  appliedResolutionId: null as string | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isTraceDone(): boolean {
  return events.every(e => {
    const s = state.eventStates[e.id]
    if (e.isMergePoint) return s.picked === true
    return s.picked === false
  })
}

function term(termId: string, displayText?: string): string {
  const entry = glossary[termId]
  const text = displayText ?? termId
  if (!entry) return escape(text)
  return `<span class="term" data-action="open-term" data-term="${termId}" title="${escape(entry.plain)}">${escape(text)}<span class="term-icon">?</span></span>`
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
      ${renderUnmergePanel()}
      ${renderRefilePanel()}
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
        <h1>Phantom Patient <span class="muted">@ L21 — first sketch</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./prototypes.html">← back to catalog</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          Two ${term('MRN', 'MRNs')} at Mercy share a DOB. The
          registration desk picked the wrong one at check-in;
          today's encounter rode that ${term('chart merge')}
          downstream until Aetna returned ${term('CO-31')} (patient
          cannot be identified). Walk the trail, find the merge,
          split the records, refile. See the
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
        Kim from registration walks over with two charts in one
        hand. "${escape(PATIENT_A)} and ${escape(PATIENT_B)}.
        Same DOB. Today's encounter went on the wrong one. Aetna
        returned ${term('CO-31')}. We need to walk the trail
        backwards and find where it crossed."
      </p>
      <p>
        Five audit-trail events between pre-reg and claim
        submission. One of them is the merge point.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The two charts
        slide a half-pixel apart. The audit log unfolds beside
        them, timestamps reading backwards.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'Identity is upstream. Walk it.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "Different shape from the Specters. The bug isn't on the
        claim, isn't in the chargemaster — it's in the
        ${term('MPI')}. Two same-DOB patients, registration desk
        clicked 'use existing MRN' without re-verifying ID, and
        every downstream system inherited the wrong identity."
      </p>
      <p>"Three issues:"</p>
      <ul>
        <li>Walk five audit events. Find the one where identity
        crossed.</li>
        <li>Pick the split strategy that doesn't make the MPI
        worse. Decoys are real anti-patterns: chart-merge
        (catastrophic), spawn-new-MRN (worsens MPI), fudge-DOB
        (fraud).</li>
        <li>Move the encounter to the right MRN, refile, and add
        a system-level guardrail."</li>
      </ul>
      <p class="briefing-sign">"Two patients, two MRNs. — D."</p>
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
        <span class="tp-tag">AUDIT TRAIL · ${escape(ENCOUNTER_DOS)}</span>
        <span class="tp-sub">${done
          ? 'Registration desk · 09:14 — clicked "use existing MRN" without re-verifying ID. Merge point.'
          : 'For each event, mark "merge point" or "not the merge." One event is the cause; the rest are propagation.'}</span>
      </div>
      <ul class="event-list">
        ${events.map(e => renderEventRow(e)).join('')}
      </ul>
      ${state.transientFeedback && events.some(e => e.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('trace') : ''}
    </section>
  `
}

function renderEventRow(e: AuditEvent): string {
  const ss = state.eventStates[e.id]
  const decided = ss.picked !== null
  const correct = decided && ss.picked === e.isMergePoint
  return `
    <li class="event ${decided && correct ? (e.isMergePoint ? 'merge' : 'ok') : ''}">
      <div class="event-meta">
        <div class="event-ts">${escape(e.timestamp)}</div>
        <div class="event-step">${escape(e.step)}</div>
        <div class="event-detail">${escape(e.detail)}</div>
      </div>
      <div class="event-actions">
        ${decided && correct ? `
          <span class="event-badge ${e.isMergePoint ? 'merge' : 'ok'}">${e.isMergePoint ? 'MERGE POINT' : 'not the merge'}</span>
          <button class="btn small ghost" data-action="reset-event" data-id="${e.id}">↺ undo</button>
        ` : `
          <button class="btn small ghost" data-action="pick-event" data-id="${e.id}" data-pick="merge">Merge point</button>
          <button class="btn small ghost" data-action="pick-event" data-id="${e.id}" data-pick="not">Not the merge</button>
        `}
      </div>
    </li>
  `
}

function renderUnmergePanel(): string {
  const unlocked = state.resolvedIssues.has('trace')
  const done = state.resolvedIssues.has('unmerge')
  if (!unlocked) {
    return `
      <section class="unmerge-panel locked">
        <div class="up-h">
          <span class="up-tag idle">SPLIT STRATEGY</span>
          <span class="up-sub">Locked until the merge point is found.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="unmerge-panel ${done ? 'done' : 'active'}">
      <div class="up-h">
        <span class="up-tag ${done ? 'done' : 'active'}">SPLIT STRATEGY · 4 options</span>
        <span class="up-sub">${done
          ? 'ID verification at desk; encounter moves to MRN 0044-9112.'
          : 'Three decoys are real anti-patterns. Only one is right.'}</span>
      </div>
      <ul class="strat-list">
        ${splitStrategies.map(s => renderStratRow(s)).join('')}
      </ul>
      ${state.transientFeedback && splitStrategies.some(s => s.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('unmerge') : ''}
    </section>
  `
}

function renderStratRow(s: SplitStrategy): string {
  const applied = state.appliedSplitId === s.id
  const locked = state.appliedSplitId !== null && !applied
  return `
    <li class="strat-opt ${applied ? 'applied' : ''}">
      <button class="strat-btn" data-action="apply-strat" data-id="${s.id}" ${locked ? 'disabled' : ''}>
        <span class="strat-label">${escape(s.label)}</span>
        <span class="strat-detail">${escape(s.detail)}</span>
        ${applied ? '<span class="strat-badge applied">APPLIED</span>' : ''}
      </button>
    </li>
  `
}

function renderRefilePanel(): string {
  const unlocked = state.resolvedIssues.has('trace') && state.resolvedIssues.has('unmerge')
  const done = state.resolvedIssues.has('refile')
  if (!unlocked) {
    return `
      <section class="refile-panel locked">
        <div class="rf-h">
          <span class="rf-tag idle">REFILE</span>
          <span class="rf-sub">Locked until trace + split are done.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="refile-panel ${done ? 'done' : 'active'}">
      <div class="rf-h">
        <span class="rf-tag ${done ? 'done' : 'active'}">REFILE · 4 paths</span>
        <span class="rf-sub">${done
          ? 'Encounter on correct MRN; claim refiled; MPI guardrail filed.'
          : 'Pick the path that fixes today AND prevents tomorrow.'}</span>
      </div>
      <ul class="res-list">
        ${resolutions.map(r => renderResolutionRow(r)).join('')}
      </ul>
      ${state.transientFeedback && resolutions.some(r => r.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('refile') : ''}
    </section>
  `
}

function renderResolutionRow(r: Resolution): string {
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
      <div class="checklist-h">PHANTOM CLEANUP · 3 issues to resolve</div>
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
        Refile encounter under MRN 0044-9112
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

const RECAP: CaseRecap = CASE_RECAPS['phantom-patient']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">PHANTOM RESOLVED</div>
      <h2>Encounter on the right MRN. Claim refiled. MPI guardrail filed.</h2>
      <p>
        Today's encounter moves to MRN 0044-9112. Aetna eligibility
        matches María's plan; the corrected claim adjudicates on
        first pass. The MPI-cleanup ticket adds a hard-stop: next
        time the registration desk hits two MRNs with the same DOB,
        the system requires manual disambiguation before the
        encounter creates.
      </p>
      <p class="muted">
        Identity is upstream of every revenue-cycle process.
        Same-DOB collisions are common; the merger isn't usually
        the patient or the clinical staff — it's a registration
        click that propagates downstream silently until the payer
        catches it.
      </p>
      <div class="register hospital">HOSPITAL · later that morning</div>
      <p>
        Kim flips through the MPI alerts. "Three more same-DOB
        ambiguities this week. Cleaner registration is the only
        fix that scales."
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
            <li><strong>Three new actions:</strong> tracing audit
            events, unmerging (pick split strategy without making
            MPI worse), and refiling.</li>
            <li><strong>Identity is upstream.</strong> First Case
            where the bug is in the MPI / registration, not the
            claim or chargemaster.</li>
            <li><strong>Decoy anti-patterns are real.</strong>
            Chart-merge, spawn-new-MRN, fudge-DOB — each shows
            up in the wild and each compounds the original error.</li>
          </ul>
        </div>
        <div>
          <h3>Sibling shape</h3>
          <ul>
            <li>Cousin to
            <a href="./carveout-phantom-prototype.html">Carve-out Phantom</a>
            (different "phantom"; same trace-the-chain muscle).</li>
            <li>Cousin to
            <a href="./form-mirror-prototype.html">Form Mirror</a>
            (both about routing problems, different layer).</li>
          </ul>
        </div>
      </div>
      <p class="notes-cta">
        See the <a href="./prototypes.html">Case Prototypes catalog</a>.
      </p>
    </section>
  `
}

function dismissBriefing() { state.briefingDone = true; state.briefingOpen = false }
function showBriefing() { state.briefingOpen = true }
function closeBriefing() { state.briefingOpen = false }
function openTerm(termId: string) { state.openTermId = termId }
function closeTerm() { state.openTermId = null }

function pickEvent(id: string, pickMerge: boolean) {
  const e = events.find(x => x.id === id); if (!e) return
  state.transientFeedback = null
  if (e.isMergePoint === pickMerge) {
    state.eventStates[id].picked = pickMerge
    state.transientFeedback = { id, message: e.reason, kind: 'good' }
    if (isTraceDone()) state.resolvedIssues.add('trace')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: e.reason, kind: 'bad' }
  }
}

function resetEvent(id: string) {
  state.eventStates[id].picked = null
  state.resolvedIssues.delete('trace')
  state.resolvedIssues.delete('unmerge')
  state.resolvedIssues.delete('refile')
  state.transientFeedback = null
}

function applyStrat(id: string) {
  const s = splitStrategies.find(x => x.id === id); if (!s) return
  state.transientFeedback = null
  if (s.correct) {
    state.appliedSplitId = id
    state.resolvedIssues.add('unmerge')
    state.transientFeedback = { id, message: s.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: s.feedback, kind: 'bad' }
  }
}

function applyResolution(id: string) {
  const r = resolutions.find(x => x.id === id); if (!r) return
  state.transientFeedback = null
  if (r.correct) {
    state.appliedResolutionId = id
    state.resolvedIssues.add('refile')
    state.transientFeedback = { id, message: r.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: r.feedback, kind: 'bad' }
  }
}

function attemptSubmit() {
  if (issues.every(i => state.resolvedIssues.has(i.id))) {
    state.packetSubmitted = true
    notifyParentVictory('phantom-patient')
  }
}

function reset() {
  state.briefingDone = false; state.briefingOpen = false
  for (const id in state.eventStates) state.eventStates[id] = { picked: null }
  state.appliedSplitId = null; state.appliedResolutionId = null
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
    case 'pick-event': if (el.dataset.id && el.dataset.pick) pickEvent(el.dataset.id, el.dataset.pick === 'merge'); break
    case 'reset-event': if (el.dataset.id) resetEvent(el.dataset.id); break
    case 'apply-strat': if (el.dataset.id) applyStrat(el.dataset.id); break
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

const css = districtVars('eligibility') + BASE_CSS + `
  .trace-panel, .unmerge-panel, .refile-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .trace-panel.done, .unmerge-panel.done, .refile-panel.done { border-left-color: var(--good); }
  .unmerge-panel.locked, .refile-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .tp-h, .up-h, .rf-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .tp-tag, .up-tag, .rf-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .up-tag.idle, .rf-tag.idle { color: var(--ink-dim); }
  .tp-tag.done, .up-tag.done, .rf-tag.done { color: var(--good); }
  .tp-sub, .up-sub, .rf-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .event-list, .strat-list, .res-list { list-style: none; padding-left: 0; margin: 0; }
  .event { display: flex; gap: 14px; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 6px; border-left: 3px solid transparent; flex-wrap: wrap; align-items: flex-start; }
  .event.merge { border-left-color: var(--bad); background: linear-gradient(180deg, rgba(239,91,123,0.08), transparent); }
  .event.ok { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.04), transparent); }
  .event-meta { flex: 2; min-width: 280px; display: flex; flex-direction: column; gap: 3px; }
  .event-ts { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 11px; color: var(--ink-dim); }
  .event-step { font-size: 13px; font-weight: 600; }
  .event-detail { font-size: 12.5px; color: var(--ink); line-height: 1.5; }
  .event-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .event-badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 3px; }
  .event-badge.merge { background: rgba(239,91,123,0.15); color: var(--bad); border: 1px solid #4a2a32; }
  .event-badge.ok { background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; }
  .btn.small { padding: 4px 10px; font-size: 11.5px; }

  .strat-opt, .res-opt { margin-bottom: 6px; }
  .strat-btn, .res-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 12px 14px; text-align: left; font: inherit; transition: all 0.15s; position: relative; display: flex; flex-direction: column; gap: 6px; }
  .strat-btn:hover:not(:disabled), .res-btn:hover:not(:disabled) { background: #232b3a; border-color: var(--accent); }
  .strat-btn:disabled, .res-btn:disabled { opacity: 0.45; cursor: default; }
  .strat-opt.applied .strat-btn, .res-opt.applied .res-btn { border-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); opacity: 1; }
  .strat-label, .res-label { font-size: 13px; font-weight: 600; padding-right: 80px; }
  .strat-detail { font-size: 12px; color: var(--ink-dim); line-height: 1.55; }
  .strat-badge.applied, .res-badge.applied { position: absolute; top: 10px; right: 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; font-weight: 700; }

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
