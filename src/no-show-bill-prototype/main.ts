// No-Show Bill @ L7 — patient-facing release-valve Case. Companion
// to Lighthouse's later charity-care beat: not every encounter is a
// fight. Some are kindness wrapped in process. Patient calls about a $75
// no-show fee; she did call to cancel; the front desk just never
// logged it.
//
// Action set:
//   - 4 statements; mark each "supports cancellation" or
//     "doesn't bear on it." Right follow-up question, not assumption.
//   - 4 sources to pull. Pick the one that confirms.
//   - 4 resolution paths. Pick the right one.
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

interface Statement {
  id: string
  speaker: string
  text: string
  supports: boolean
  reason: string
}

interface Source {
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
  verb: 'listen' | 'investigate' | 'waive'
}

interface GlossaryEntry { term: string; plain: string }

// ===== Encounter data =====

const PATIENT = 'Marcia Devlin'
const FEE = 75
const APPT_DATE = '2026-04-02'
const CANCEL_CLAIMED = '2026-03-31 14:23 (Tuesday afternoon)'

const statements: Statement[] = [
  {
    id: 's1',
    speaker: 'Marcia',
    text: '"I called the front desk on Tuesday afternoon to cancel — I was sick and couldn\'t make it Thursday."',
    supports: true,
    reason: 'Direct claim — Marcia called more than 24 hours ahead of the appointment, which is what most cancellation policies require. If true, she shouldn\'t owe the fee. Worth checking the call log.',
  },
  {
    id: 's2',
    speaker: 'Marcia',
    text: '"The person I spoke to was named Jamie. They said they\'d update the appointment."',
    supports: true,
    reason: 'Specific detail — names a staff member. If Jamie was on the schedule that day and there\'s a call log, the claim is verifiable. Specificity tends to indicate truthfulness.',
  },
  {
    id: 's3',
    speaker: 'Marcia',
    text: '"My daughter has been sick too. She missed school all week."',
    supports: false,
    reason: 'Sympathetic context but doesn\'t bear on whether the cancellation was logged. Don\'t weight it as evidence; do listen with empathy. Patient experience and policy adjudication are separate.',
  },
  {
    id: 's4',
    speaker: 'Marcia',
    text: '"I wasn\'t sure I\'d get charged. I figured if there was a problem someone would call."',
    supports: false,
    reason: 'Reasonable assumption from the patient side, but doesn\'t support cancellation per se. The cancellation either happened or it didn\'t; the fee is contingent on that fact, not on what either party assumed about follow-up.',
  },
]

const sources: Source[] = [
  {
    id: 'call-log',
    label: 'Pull the front-desk call log for Tuesday afternoon',
    detail: 'The phone system logs every inbound call to the desk; cross-reference Marcia\'s number against entries near 14:23.',
    correct: true,
    feedback: 'Right source. Found it: 14:21, inbound from Marcia\'s number, 1m 47s, taken by Jamie at the desk. Now check whether Jamie logged the cancellation in the appointment system. Spoiler: she didn\'t.',
  },
  {
    id: 'patient-attestation',
    label: 'Ask Marcia for a written attestation that she called',
    detail: 'Have Marcia sign a statement that she called Jamie at the time she claims.',
    correct: false,
    feedback: 'Asking the patient to swear to her own claim doesn\'t verify anything; it just creates a paper trail of the same claim. The call log is the actual independent evidence; verify against that.',
  },
  {
    id: 'jamie-statement',
    label: 'Pull Jamie aside and ask if she remembers the call',
    detail: 'Jamie takes 30+ calls per shift; ask her to recall a specific one from two weeks ago.',
    correct: false,
    feedback: 'Memory is unreliable; the call log is documented. Asking Jamie what she remembers is also a low-grade accusation toward her — the bug is the *log* (she didn\'t enter the cancellation), not Jamie\'s memory. Pull the log; talk to Jamie second.',
  },
  {
    id: 'manager-meeting',
    label: 'Schedule a manager review meeting to discuss',
    detail: 'Add it to next week\'s ops review agenda.',
    correct: false,
    feedback: 'Marcia is on the phone now. Punting to next week\'s meeting answers nothing today and signals to the patient that her time isn\'t valued. The call log is a 30-second lookup; do the lookup.',
  },
]

const resolutions: Resolution[] = [
  {
    id: 'waive-and-train',
    label: `Waive the $${FEE} fee, post a $${FEE} adjustment to Marcia's account, file a brief note in the front-desk training queue: "log every cancel call in the appointment system at time of call."`,
    correct: true,
    feedback: 'Right resolution. Waive (the patient\'s right answer), adjust (the accounting right answer), retrain (the system right answer). Marcia hangs up satisfied; Jamie gets coached without being shamed; the next caller doesn\'t hit the same bug.',
  },
  {
    id: 'half-waive',
    label: `Offer to split the difference — waive $40, charge $35 as "good faith."`,
    correct: false,
    feedback: 'Splitting feels fair but it\'s a bad signal: "we believe you partly." If the cancellation happened, the fee shouldn\'t apply. If the cancellation didn\'t happen, full charge stands. Splitting trains future patients that the policy is negotiable, which is worse for everyone.',
  },
  {
    id: 'sorry-not-waive',
    label: `Apologize for the inconvenience but tell Marcia the policy is firm: $${FEE} stands.`,
    correct: false,
    feedback: 'Policy without verification: when the call log shows she did call, applying the fee anyway is unjust. Patient experience drops; she tells five people; one of them tells the local news. Policies that don\'t bend to verified facts cost more than the fee.',
  },
  {
    id: 'route-collections',
    label: `Refer Marcia's account to collections after 30 days if she doesn\'t pay.`,
    correct: false,
    feedback: 'Sending a verified-cancellation account to collections invites a patient-relations complaint and, if it escalates, a regulatory complaint. Don\'t escalate against the patient when the bug is internal.',
  },
]

const issues: Issue[] = [
  {
    id: 'listen',
    label: 'Listen: which of Marcia\'s statements actually bear on whether she canceled?',
    recap: 'Two specific (called Tuesday, spoke to Jamie) — verifiable claims that bear on the cancellation. Two sympathetic (sick daughter, assumption about follow-up) — relevant to empathy, not adjudication. Listen for the difference.',
    verb: 'listen',
  },
  {
    id: 'investigate',
    label: 'Investigate: pull the call log, not the people\'s memories.',
    recap: 'Phone system logs Marcia calling Jamie at 14:21 for 1m 47s on the day she said. Cancellation conversation happened. Jamie didn\'t enter it in the appointment system afterward — that\'s the bug.',
    verb: 'investigate',
  },
  {
    id: 'waive',
    label: 'Waive: post the adjustment, route a training note.',
    recap: '$' + FEE + ' adjusted off Marcia\'s account. Brief training note to the front desk: log every cancel call in the system at time of call. Marcia hangs up satisfied; Jamie gets coached without being shamed.',
    verb: 'waive',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'no-show fee': {
    term: 'No-show fee',
    plain: "Charge billed to a patient who misses an appointment without canceling within the cancellation window (often 24 or 48 hours). Designed to discourage no-shows and recover some lost-slot revenue. Most are between $25-$150. Insurance typically doesn't cover them — it's a patient-direct charge.",
  },
  'release valve': {
    term: 'Release valve (Case archetype)',
    plain: "A Case where the player practices kindness rather than fight. No-Show Bill is the L8 version; Lighthouse (charity care) returns to the pattern at L10. The action set leans toward listening, investigating, and waiving rather than citing, amending, and appealing. Release valves prove the framework supports restorative encounters as well as combative ones.",
  },
  'patient experience': {
    term: 'Patient experience (NPS / HCAHPS)',
    plain: "The hospital metric that captures how patients felt about their interactions. CMS ties Medicare reimbursement to HCAHPS scores via the Hospital Value-Based Purchasing program — patient experience isn't just nice-to-have; bad scores cost real money. A no-show fee fight is the kind of thing that lives in HCAHPS comments for months.",
  },
  'adjustment posting': {
    term: 'Adjustment posting',
    plain: "Accounting entry that reduces a patient's account balance without claiming payment. Different from a write-off (uncollectible); different from a contractual adjustment (CO-45). Adjustments require a reason code internally; \"front-desk error\" is a real adjustment category in most billing systems.",
  },
}

// ===== Runtime state =====

interface StmtState { pick: 'supports' | 'context' | null }

const state = {
  briefingDone: false,
  briefingOpen: false,
  stmtStates: statements.reduce((m, s) => { m[s.id] = { pick: null }; return m }, {} as Record<string, StmtState>),
  appliedSourceId: null as string | null,
  appliedResolutionId: null as string | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isListenDone(): boolean {
  return statements.every(s => {
    const ss = state.stmtStates[s.id]
    if (s.supports) return ss.pick === 'supports'
    return ss.pick === 'context'
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
      ${renderListenPanel()}
      ${renderInvestigatePanel()}
      ${renderWaivePanel()}
      ${renderChecklist()}
    `}
    ${state.briefingDone ? '' : renderDesignNotes()}
    ${renderTermPopover()}
    ${renderBriefingPopover()}
  `
}

function renderHeader(): string {
  const recallBtn = state.briefingDone ? `<button class="recall-btn" data-action="show-briefing">📜 Dana's note</button>` : ''
  return `
    <header class="page-h">
      <div class="title-row">
        <h1>No-Show Bill <span class="muted">@ L7 — release valve</span></h1>
        <div class="header-actions">${recallBtn}<a class="back-link" href="./prototypes.html">← back to catalog</a></div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          ${escape(PATIENT)} on the phone. $${FEE}
          ${term('no-show fee')}; she says she called to cancel.
          Mid-game ${term('release valve')} — companion to Lighthouse.
          See the <a href="#design-notes">design notes</a>.
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
        Phone rings. ${escape(PATIENT)}, increasingly polite-but-not.
        "I just got a $${FEE} no-show charge for an appointment on
        ${escape(APPT_DATE)}. I called to cancel on
        ${escape(CANCEL_CLAIMED)}. Why am I being charged?"
      </p>
      <p>
        She's not yelling. She's careful, which tells you she has had to be careful. Don't reach for
        the appeal templates; that's not what this is. Listen,
        verify, waive if she's right.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The phone slides
        a half-pixel left, then settles. Her statements unfold;
        the call log is one click away.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'Kindness, not fight.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "${term('release valve')}. Marcia is on the phone, she's
        right, and the next ten minutes set whether she trusts
        Mercy for the next ten years. Not every Case is a fight."
      </p>
      <p>"Three issues:"</p>
      <ul>
        <li>Four things she\'s saying. Two bear on the
        cancellation; two are sympathetic context. Difference
        matters.</li>
        <li>Pull the call log — not Jamie\'s memory, not
        Marcia\'s attestation, not next week\'s manager
        meeting.</li>
        <li>Adjust the account, route a training note. Don\'t
        split the difference; don\'t hide behind policy; don\'t
        escalate to collections.</li>
      </ul>
      <p class="briefing-sign">"The script IS the policy. — D."</p>
    </div>
  `
}

function renderBriefingPopover(): string {
  if (!state.briefingOpen) return ''
  return `
    <div class="briefing-popover-backdrop">
      <div class="briefing-popover">
        <button class="briefing-popover-close" data-action="close-briefing">×</button>
        ${briefingContent()}
        <button class="btn ghost" data-action="close-briefing">Back to the encounter</button>
      </div>
    </div>
  `
}

function renderListenPanel(): string {
  const done = state.resolvedIssues.has('listen')
  return `
    <section class="listen-panel ${done ? 'done' : ''}">
      <div class="lp-h">
        <span class="lp-tag">WHAT MARCIA IS SAYING · 4 statements</span>
        <span class="lp-sub">${done ? 'Two support cancellation; two are sympathetic context.' : 'Mark each "supports cancellation" or "context, not evidence."'}</span>
      </div>
      <ul class="stmt-list">
        ${statements.map(s => renderStmt(s)).join('')}
      </ul>
      ${state.transientFeedback && statements.some(s => s.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('listen') : ''}
    </section>
  `
}

function renderStmt(s: Statement): string {
  const ss = state.stmtStates[s.id]
  const decided = ss.pick !== null
  const correct = decided && ss.pick === (s.supports ? 'supports' : 'context')
  return `
    <li class="stmt ${decided && correct ? (s.supports ? 'supports' : 'context') : ''}">
      <div class="stmt-meta">
        <div class="stmt-speaker">${escape(s.speaker)}</div>
        <div class="stmt-text">${escape(s.text)}</div>
      </div>
      <div class="stmt-actions">
        ${decided && correct ? `
          <span class="stmt-badge ${s.supports ? 'supports' : 'context'}">${s.supports ? 'SUPPORTS' : 'context'}</span>
          <button class="btn small ghost" data-action="reset-stmt" data-id="${s.id}">↺ undo</button>
        ` : `
          <button class="btn small ghost" data-action="pick-stmt" data-id="${s.id}" data-pick="supports">Supports</button>
          <button class="btn small ghost" data-action="pick-stmt" data-id="${s.id}" data-pick="context">Context</button>
        `}
      </div>
    </li>
  `
}

function renderInvestigatePanel(): string {
  const unlocked = state.resolvedIssues.has('listen')
  const done = state.resolvedIssues.has('investigate')
  if (!unlocked) return `<section class="invest-panel locked"><div class="ip-h"><span class="ip-tag idle">INVESTIGATE</span><span class="ip-sub">Locked.</span></div></section>`
  return `
    <section class="invest-panel ${done ? 'done' : 'active'}">
      <div class="ip-h"><span class="ip-tag ${done ? 'done' : 'active'}">INVESTIGATE · 4 sources</span><span class="ip-sub">${done ? 'Call log confirms: Marcia called, Jamie answered, no log entry.' : 'Pull the right source. The call log is documented; memories aren\'t.'}</span></div>
      <ul class="opt-list">
        ${sources.map(s => renderOpt(s, 'source')).join('')}
      </ul>
      ${state.transientFeedback && sources.some(s => s.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('investigate') : ''}
    </section>
  `
}

function renderWaivePanel(): string {
  const unlocked = state.resolvedIssues.has('investigate')
  const done = state.resolvedIssues.has('waive')
  if (!unlocked) return `<section class="waive-panel locked"><div class="wp-h"><span class="wp-tag idle">WAIVE</span><span class="wp-sub">Locked.</span></div></section>`
  return `
    <section class="waive-panel ${done ? 'done' : 'active'}">
      <div class="wp-h"><span class="wp-tag ${done ? 'done' : 'active'}">RESOLVE · 4 paths</span><span class="wp-sub">${done ? 'Waive + adjust + retrain.' : 'Other paths: split the difference, hide behind policy, escalate to collections.'}</span></div>
      <ul class="opt-list">
        ${resolutions.map(r => renderOpt(r, 'resolution')).join('')}
      </ul>
      ${state.transientFeedback && resolutions.some(r => r.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('waive') : ''}
    </section>
  `
}

function renderOpt(o: Source | Resolution, kind: 'source' | 'resolution'): string {
  const appliedId = kind === 'source' ? state.appliedSourceId : state.appliedResolutionId
  const applied = appliedId === o.id
  const isSource = 'detail' in o
  return `
    <li class="opt ${applied ? 'applied' : ''}">
      <button class="opt-btn" data-action="apply-${kind}" data-id="${o.id}" ${appliedId !== null && !applied ? 'disabled' : ''}>
        <span class="opt-label">${escape(o.label)}</span>
        ${isSource ? `<span class="opt-detail">${escape((o as Source).detail)}</span>` : ''}
        ${applied ? '<span class="opt-badge">APPLIED</span>' : ''}
      </button>
    </li>
  `
}

function renderRecap(issueId: string): string {
  const issue = issues.find(i => i.id === issueId)
  if (!issue) return ''
  return `<div class="recap"><div class="recap-h">RECAP</div><p>${escape(issue.recap)}</p></div>`
}

function renderChecklist(): string {
  const allDone = issues.every(i => state.resolvedIssues.has(i.id))
  return `
    <section class="checklist">
      <div class="checklist-h">RESOLUTION · 3 issues to resolve</div>
      <ul>${issues.map(i => `<li class="${state.resolvedIssues.has(i.id) ? 'done' : ''}"><span class="check">${state.resolvedIssues.has(i.id) ? '✓' : '○'}</span><div class="issue-body"><div class="issue-label">${escape(i.label)}</div></div></li>`).join('')}</ul>
      ${state.failedAttempts > 0 ? `<p class="fail-counter">Wrong picks so far: ${state.failedAttempts}.</p>` : ''}
      <button class="btn submit ${allDone ? '' : 'disabled'}" data-action="submit" ${allDone ? '' : 'disabled'}>Adjust account · waive $${FEE}</button>
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
        <div class="term-popover-h"><span class="term-popover-name">${escape(entry.term)}</span><button class="term-popover-close" data-action="close-term">×</button></div>
        <p>${escape(entry.plain)}</p>
      </div>
    </div>
  `
}

const RECAP: CaseRecap = CASE_RECAPS['no-show-bill']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">CALL CLOSED · CASE WAIVED</div>
      <h2>$${FEE} adjusted. Marcia hangs up satisfied.</h2>
      <p>
        ${term('adjustment posting', 'Adjustment posted')} to
        Marcia\'s account with reason code "front-desk
        non-logged cancellation." Brief training note routed
        to the front-desk supervisor; Jamie gets the
        process refresher next shift, no shame.
      </p>
      <p class="muted">
        ${term('release valve', 'Release valves')} are the easiest
        Cases to do badly. Splitting the difference, hiding behind
        policy, escalating to collections — all of those feel
        process-correct and read as cruel. Listening + verifying +
        waiving when verification supports it is the entire skill.
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
            <li><strong>Three new actions:</strong> separating evidence from context, drawing on documented sources, and waiving the charge.</li>
            <li><strong>Mid-game release valve.</strong> Companion to Lighthouse (L10 charity care). Proves the framework supports restorative Cases too.</li>
            <li><strong>Sympathetic context isn\'t evidence.</strong> Both can be true at once — the patient deserves empathy AND the policy needs facts. Listen to both, weight only the evidence.</li>
            <li><strong>Decoys teach how kindness fails.</strong> Splitting the difference, policy-citing, collections — each feels process-correct and reads as cruel.</li>
          </ul>
        </div>
        <div>
          <h3>Sibling shape</h3>
          <ul>
            <li>Direct sibling to <a href="./lighthouse-prototype.html">Lighthouse</a> — same release-valve archetype.</li>
            <li>District: release-valve (yellow accent — special fifth category).</li>
            <li>Mid-game placement so the player meets the archetype before the L8 Lighthouse beat.</li>
          </ul>
        </div>
      </div>
      <p class="notes-cta">See the <a href="./prototypes.html">Case Prototypes catalog</a>.</p>
    </section>
  `
}

function dismissBriefing() { state.briefingDone = true; state.briefingOpen = false }
function showBriefing() { state.briefingOpen = true }
function closeBriefing() { state.briefingOpen = false }
function openTerm(termId: string) { state.openTermId = termId }
function closeTerm() { state.openTermId = null }

function pickStmt(id: string, pick: 'supports' | 'context') {
  const s = statements.find(x => x.id === id); if (!s) return
  state.transientFeedback = null
  const right = s.supports ? 'supports' : 'context'
  if (pick === right) {
    state.stmtStates[id].pick = pick
    state.transientFeedback = { id, message: s.reason, kind: 'good' }
    if (isListenDone()) state.resolvedIssues.add('listen')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: s.reason, kind: 'bad' }
  }
}

function resetStmt(id: string) {
  state.stmtStates[id].pick = null
  state.resolvedIssues.delete('listen')
  state.resolvedIssues.delete('investigate')
  state.resolvedIssues.delete('waive')
  state.transientFeedback = null
}

function applySource(id: string) {
  const s = sources.find(x => x.id === id); if (!s) return
  state.transientFeedback = null
  if (s.correct) {
    state.appliedSourceId = id
    state.resolvedIssues.add('investigate')
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
    state.resolvedIssues.add('waive')
    state.transientFeedback = { id, message: r.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: r.feedback, kind: 'bad' }
  }
}

function attemptSubmit() {
  if (issues.every(i => state.resolvedIssues.has(i.id))) {
    state.packetSubmitted = true
    notifyParentVictory('no-show-bill')
  }
}

function reset() {
  state.briefingDone = false; state.briefingOpen = false
  for (const id in state.stmtStates) state.stmtStates[id] = { pick: null }
  state.appliedSourceId = null; state.appliedResolutionId = null
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
    case 'pick-stmt': if (el.dataset.id && el.dataset.pick) pickStmt(el.dataset.id, el.dataset.pick as 'supports' | 'context'); break
    case 'reset-stmt': if (el.dataset.id) resetStmt(el.dataset.id); break
    case 'apply-source': if (el.dataset.id) applySource(el.dataset.id); break
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

// Release-valve uses billing district + a yellow accent override
const css = districtVars('billing') + BASE_CSS + `
  :root { --accent: #e8c074; --accent-hover: #f0d59c; }
  .listen-panel, .invest-panel, .waive-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .listen-panel.done, .invest-panel.done, .waive-panel.done { border-left-color: var(--good); }
  .invest-panel.locked, .waive-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .lp-h, .ip-h, .wp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .lp-tag, .ip-tag, .wp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .ip-tag.idle, .wp-tag.idle { color: var(--ink-dim); }
  .lp-tag.done, .ip-tag.done, .wp-tag.done { color: var(--good); }
  .lp-sub, .ip-sub, .wp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .stmt-list, .opt-list { list-style: none; padding-left: 0; margin: 0; }
  .stmt { display: flex; gap: 16px; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 6px; border-left: 3px solid transparent; flex-wrap: wrap; align-items: flex-start; }
  .stmt.supports { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .stmt.context { border-left-color: var(--ink-dim); opacity: 0.85; }
  .stmt-meta { flex: 2; min-width: 280px; }
  .stmt-speaker { font-size: 11px; color: var(--ink-dim); font-style: italic; text-transform: uppercase; letter-spacing: 0.06em; }
  .stmt-text { font-size: 13px; line-height: 1.55; margin-top: 4px; }
  .stmt-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .stmt-badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 3px; }
  .stmt-badge.supports { background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; }
  .stmt-badge.context { background: rgba(138,147,163,0.10); color: var(--ink-dim); border: 1px solid #2a3142; }
  .btn.small { padding: 4px 10px; font-size: 11.5px; }

  .opt { margin-bottom: 6px; }
  .opt-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 12px 14px; text-align: left; font: inherit; transition: all 0.15s; position: relative; display: flex; flex-direction: column; gap: 6px; }
  .opt-btn:hover:not(:disabled) { background: #232b3a; border-color: var(--accent); }
  .opt-btn:disabled { opacity: 0.45; cursor: default; }
  .opt.applied .opt-btn { border-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); opacity: 1; }
  .opt-label { font-size: 13px; font-weight: 600; padding-right: 80px; line-height: 1.5; }
  .opt-detail { font-size: 12px; color: var(--ink-dim); line-height: 1.55; }
  .opt-badge { position: absolute; top: 10px; right: 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; font-weight: 700; }

  .recap { background: rgba(126, 226, 193, 0.06); border-color: #2c5547; }
  .recap-h { color: var(--good); }
`

function rerender() { const root = document.getElementById('prototype-root'); if (root) root.innerHTML = render() }
function mount() {
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style); rerender()
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
