// HIPAA Spider @ L31 — privacy breach Case set inside the audit window.
// Three lab reports were faxed to a wrong number two weeks before the
// quarterly audit lands. Player runs the four-factor breach risk
// assessment, picks the right immediate containment, and decides on
// the notification path.
//
// Actions:
//   - ASSESS: 4 statements about the four-factor risk assessment.
//   - CONTAIN: 4 immediate-containment options.
//   - NOTIFY: 4 notification paths.
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

interface AssessStatement {
  id: string
  text: string
  truth: boolean
  reason: string
}

interface ContainOption {
  id: string
  label: string
  detail: string
  correct: boolean
  feedback: string
}

interface NotifyOption {
  id: string
  label: string
  correct: boolean
  feedback: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'assess' | 'contain' | 'notify'
}

interface GlossaryEntry { term: string; plain: string }

// ===== Encounter data =====

const RECORDS_AFFECTED = 3
const WRONG_FAX_RECIPIENT = 'a small medical billing office two area-code prefixes off'

const assessStatements: AssessStatement[] = [
  {
    id: 'a1',
    text: 'The disclosed PHI included names, DOBs, and lab results — high-sensitivity content under HHS\'s four-factor framework.',
    truth: true,
    reason: 'Factor 1 (nature + extent of PHI). Lab results + identifiers are high-sensitivity by HHS guidance. This factor pushes risk *up*.',
  },
  {
    id: 'a2',
    text: 'The unintended recipient was Mercy\'s sister-hospital lab; same parent system, covered by the same HIPAA business associate agreement.',
    truth: false,
    reason: 'False — the actual recipient was ' + WRONG_FAX_RECIPIENT + ', a non-covered entity outside Mercy\'s network. Factor 2 (identity of recipient) is unfavorable: external, unrelated party. Don\'t assume covered-entity-to-covered-entity; that\'s a key compliance fiction.',
  },
  {
    id: 'a3',
    text: 'The wrong recipient confirmed in writing they shredded the fax and have not retained or disclosed any PHI.',
    truth: true,
    reason: 'Factor 3 (was PHI actually accessed/disclosed/retained). Written attestation reduces risk. Document it; the attestation is the artifact that supports a low-probability-of-compromise determination.',
  },
  {
    id: 'a4',
    text: 'Because written attestation was obtained, the breach is automatically a "low probability of compromise" and notification can be skipped.',
    truth: false,
    reason: 'Factor 3 reduces but doesn\'t eliminate risk. Factors 1 + 2 + 4 still apply. The four factors are weighed *together*; "low probability of compromise" is a holistic conclusion the Privacy Officer makes after considering all four. Don\'t skip the analysis.',
  },
]

const containOptions: ContainOption[] = [
  {
    id: 'log-and-attest',
    label: 'Log the breach in the incident log; obtain written attestation from the recipient that PHI was destroyed',
    detail: 'Time-stamp incident; capture date, time, sender, intended + actual recipient, content; request and file written destruction attestation.',
    correct: true,
    feedback: 'Right immediate containment. Logging triggers the 60-day notification clock; the destruction attestation supports the four-factor risk assessment. Both artifacts are exactly what the audit will look for.',
  },
  {
    id: 'do-nothing',
    label: 'Do nothing — the recipient said they\'d destroy it',
    detail: 'No log entry, no written attestation, no notification.',
    correct: false,
    feedback: 'Three problems: no documentation if the audit asks, no risk assessment, and no compliance with HIPAA\'s log-and-investigate requirements. Verbal "they said they\'d destroy it" doesn\'t survive an OCR audit. Document or it didn\'t happen.',
  },
  {
    id: 'over-notify',
    label: 'Send Notice to Affected Individuals letters immediately to all 3 patients without doing the four-factor assessment',
    detail: 'Skip the assessment; mail breach letters out today.',
    correct: false,
    feedback: 'Premature notification commits the hospital to a breach finding before assessment. If the four factors actually support low-probability-of-compromise, the breach may not require notification. Notify-when-not-required creates patient anxiety, attracts plaintiff attention, and is worse than a measured assessment.',
  },
  {
    id: 'sue-recipient',
    label: 'Threaten the recipient with legal action to recover damages',
    detail: 'Send a cease-and-desist; demand statutory damages for unauthorized PHI receipt.',
    correct: false,
    feedback: 'Mercy is the disclosing party; the recipient is an innocent unintended receiver. Threatening them is bad faith, gets you no information, and risks damaging the cooperation needed to confirm destruction. Cooperate, get the attestation, document.',
  },
]

const notifyOptions: NotifyOption[] = [
  {
    id: 'three-individuals',
    label: 'Notify the 3 affected individuals within 60 days. Log breach internally. No HHS public notice; no media notice (under 500 affected = annual reporting only).',
    correct: true,
    feedback: 'Right notification path. Under-500-record breach: notify individuals within 60 days, document in the internal log, report to HHS in the annual aggregate notification. No media notice required (that threshold is 500+ in a single state).',
  },
  {
    id: 'hhs-immediately',
    label: 'Notify HHS immediately + post in prominent media — assume worst case.',
    correct: false,
    feedback: 'Over-notification. HHS immediate-notice and prominent-media triggers fire at 500+ records affected (in a single state for media). Three records doesn\'t hit either threshold. Annual aggregate report is the right HHS path.',
  },
  {
    id: 'no-individual',
    label: 'Skip individual notice; just file the annual HHS aggregate report.',
    correct: false,
    feedback: 'Individual notice is required regardless of breach size unless the four-factor assessment concludes low-probability-of-compromise. Even then, document the conclusion. Skipping individual notice when risk isn\'t demonstrably low is the most-fined HIPAA failure mode.',
  },
  {
    id: 'oig-report',
    label: 'File a self-report to OIG.',
    correct: false,
    feedback: 'OIG handles fraud / abuse / kickbacks; not the right office for HIPAA breaches. HHS OCR (Office for Civil Rights) is the HIPAA enforcement arm. Wrong agency.',
  },
]

const issues: Issue[] = [
  {
    id: 'assess',
    label: 'Assess: walk the four-factor breach risk framework.',
    recap: 'Factors 1 + 2 push risk up (high-sensitivity PHI, external recipient); factor 3 (written destruction attestation) pulls risk down; factor 4 (3 records, low aggregate exposure) modest. Holistic conclusion: notification still warranted at the individual level.',
    verb: 'assess',
  },
  {
    id: 'contain',
    label: 'Contain: log + attest immediately.',
    recap: 'Incident log entry timestamped; written destruction attestation obtained from recipient. Both artifacts on file ahead of the audit.',
    verb: 'contain',
  },
  {
    id: 'notify',
    label: 'Notify: pick the right notification path.',
    recap: 'Individual letters within 60 days; internal log; annual aggregate report to HHS. No media notice; no immediate HHS notice (under 500-record threshold). No OIG (wrong agency).',
    verb: 'notify',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'HIPAA': {
    term: 'HIPAA (Health Insurance Portability and Accountability Act)',
    plain: "Federal law (1996, with subsequent rules) governing protected health information (PHI). Privacy Rule + Security Rule + Breach Notification Rule. Enforcement by HHS Office for Civil Rights (OCR). Maximum penalties run into millions per violation; OCR resolves most cases via corrective action plans but enforces aggressively against systemic failures.",
  },
  'PHI': {
    term: 'PHI (Protected Health Information)',
    plain: "Individually identifiable health information held or transmitted by a covered entity. Includes name + DOB + diagnosis + treatment + payment + identifiers (MRN, SSN, account number). De-identified data isn't PHI. The four-factor framework asks about the *nature* of the disclosed PHI to gauge risk.",
  },
  'four-factor': {
    term: 'Four-factor breach risk assessment',
    plain: "HIPAA-mandated framework for determining whether an impermissible disclosure is a 'breach' requiring notification. Four factors: (1) nature + extent of PHI; (2) identity of recipient; (3) was PHI actually acquired/viewed/retained; (4) extent of risk-mitigation. Weighed together; conclusion = 'low probability of compromise' (no notification) or 'breach' (notification required).",
  },
  '60-day notice': {
    term: '60-day individual notice',
    plain: "Affected individuals must be notified within 60 calendar days of the breach being discovered. Written notice (mail, with email-based delivery in some cases). Required regardless of breach size unless four-factor assessment concludes low-probability-of-compromise. Late notice is one of OCR's most-cited violations.",
  },
  'HHS / OCR': {
    term: 'HHS Office for Civil Rights (OCR)',
    plain: "Federal enforcer for HIPAA Privacy + Security + Breach Notification. Receives breach reports, conducts compliance reviews, settles cases via corrective action plans + monetary settlements. Reports under 500 affected go in an annual aggregate; 500+ require immediate report + posting on the public Wall of Shame.",
  },
  '500-record threshold': {
    term: '500-record threshold',
    plain: "Two notification triggers fire at 500+ affected records: (a) immediate (within 60 days) report to HHS, posted on the public OCR Breach Portal; (b) prominent media notice in the state(s) affected. Under 500 = individual notice + annual aggregate to HHS only. The threshold is per-breach, not annual.",
  },
  'business associate breach': {
    term: 'Business Associate (BA) breach',
    plain: "Most modern HIPAA breaches happen at vendors (EHR providers, billing companies, transcription services, cloud-storage providers) holding PHI under a Business Associate Agreement (BAA). The covered entity (Mercy) remains responsible for notifying patients even if the breach happened entirely on the BA's side. Containment is split: the BA does the technical investigation; the covered entity verifies the BA's notification, runs its own four-factor assessment using BA-supplied facts, and meets the 60-day individual-notice clock. This Case uses a fax breach for clarity, but in 2026 most real breaches are EHR access, ransomware, or BA breaches — not faxes.",
  },
}

// ===== Runtime state =====

interface StmtState { pick: boolean | null }

const state = {
  briefingDone: false,
  briefingOpen: false,
  stmtStates: assessStatements.reduce((m, s) => { m[s.id] = { pick: null }; return m }, {} as Record<string, StmtState>),
  appliedContainId: null as string | null,
  appliedNotifyId: null as string | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isAssessDone(): boolean {
  return assessStatements.every(s => state.stmtStates[s.id].pick === s.truth)
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
      ${renderAssessPanel()}
      ${renderContainPanel()}
      ${renderNotifyPanel()}
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
        <h1>HIPAA Spider <span class="muted">@ L31 — first sketch</span></h1>
        <div class="header-actions">${recallBtn}<a class="back-link" href="./prototypes.html">← back to catalog</a></div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          ${RECORDS_AFFECTED} lab reports faxed to ${escape(WRONG_FAX_RECIPIENT)}.
          Two weeks before the quarterly audit. Run the
          ${term('four-factor', 'four-factor risk assessment')},
          contain, decide on notification. ${term('PHI')}
          discipline; under-${term('500-record threshold', '500-record')}
          path. See the
          <a href="#design-notes">design notes</a>.
        </p>
      `}
    </header>
  `
}

function renderHospitalIntro(): string {
  return `
    <section class="hospital-intro">
      <div class="register hospital">HOSPITAL · compliance office</div>
      <p>
        Theo, Privacy Officer, walks the incident report over.
        "Three lab reports — names, DOBs, results — went to ${escape(WRONG_FAX_RECIPIENT)}.
        Discovered yesterday when the recipient called us. Audit
        in two weeks. Walk the ${term('four-factor')}; document
        everything; decide on notification."
      </p>
      <p>
        Three issues. Three different mistakes available, each
        of them costly.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The four factors
        slide a half-pixel left, then settle. The audit clock
        is on the wall.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'Compliance, not claims. Different muscle.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "First Case where there's no claim. ${term('HIPAA')} breach,
        three records, an OCR-defined process. The audit doesn't
        care about the outcome; it cares about whether we ran the
        process. Under-react = penalty. Over-react = self-inflicted
        breach finding. Calibrate."
      </p>
      <p>"Three issues:"</p>
      <ul>
        <li>Four statements about the four
        factors. Each one matters.</li>
        <li>Log + attestation. Don't
        sit on it; don't over-notify; don't sue the recipient.</li>
        <li>Under 500 records is its own
        path — individual letters + internal log + annual HHS
        aggregate. Not immediate HHS, not media, not OIG.</li>
      </ul>
      <p class="briefing-sign">"Four factors before you say breach. — D."</p>
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

function renderAssessPanel(): string {
  const done = state.resolvedIssues.has('assess')
  return `
    <section class="assess-panel ${done ? 'done' : ''}">
      <div class="ap-h"><span class="ap-tag">FOUR-FACTOR ASSESSMENT · 4 statements</span><span class="ap-sub">${done ? 'Holistic conclusion: notification warranted (factors 1, 2, 4 push up; factor 3 mitigates).' : 'Mark each true/false.'}</span></div>
      <ul class="stmt-list">
        ${assessStatements.map(s => renderStmt(s)).join('')}
      </ul>
      ${state.transientFeedback && assessStatements.some(s => s.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('assess') : ''}
    </section>
  `
}

function renderStmt(s: AssessStatement): string {
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

function renderContainPanel(): string {
  const unlocked = state.resolvedIssues.has('assess')
  const done = state.resolvedIssues.has('contain')
  if (!unlocked) return `<section class="contain-panel locked"><div class="cp-h"><span class="cp-tag idle">CONTAIN</span><span class="cp-sub">Locked.</span></div></section>`
  return `
    <section class="contain-panel ${done ? 'done' : 'active'}">
      <div class="cp-h"><span class="cp-tag ${done ? 'done' : 'active'}">CONTAIN · 4 immediate actions</span><span class="cp-sub">${done ? 'Logged + attestation obtained.' : 'Pick the action that documents and contains without over-reacting.'}</span></div>
      <ul class="opt-list">
        ${containOptions.map(o => renderOpt(o, 'contain')).join('')}
      </ul>
      ${state.transientFeedback && containOptions.some(o => o.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('contain') : ''}
    </section>
  `
}

function renderNotifyPanel(): string {
  const unlocked = state.resolvedIssues.has('contain')
  const done = state.resolvedIssues.has('notify')
  if (!unlocked) return `<section class="notify-panel locked"><div class="np-h"><span class="np-tag idle">NOTIFY</span><span class="np-sub">Locked.</span></div></section>`
  return `
    <section class="notify-panel ${done ? 'done' : 'active'}">
      <div class="np-h"><span class="np-tag ${done ? 'done' : 'active'}">NOTIFY · 4 paths</span><span class="np-sub">${done ? 'Individual letters + internal log + annual HHS aggregate.' : 'Pick the right path for an under-500-record breach.'}</span></div>
      <ul class="opt-list">
        ${notifyOptions.map(o => renderOpt(o, 'notify')).join('')}
      </ul>
      ${state.transientFeedback && notifyOptions.some(o => o.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('notify') : ''}
    </section>
  `
}

function renderOpt(o: ContainOption | NotifyOption, kind: 'contain' | 'notify'): string {
  const appliedId = kind === 'contain' ? state.appliedContainId : state.appliedNotifyId
  const applied = appliedId === o.id
  const isContain = 'detail' in o
  return `
    <li class="opt ${applied ? 'applied' : ''}">
      <button class="opt-btn" data-action="apply-${kind}" data-id="${o.id}" ${appliedId !== null && !applied ? 'disabled' : ''}>
        <span class="opt-label">${escape(o.label)}</span>
        ${isContain ? `<span class="opt-detail">${escape((o as ContainOption).detail)}</span>` : ''}
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
      <div class="checklist-h">BREACH RESPONSE · 3 issues to resolve</div>
      <ul>${issues.map(i => `<li class="${state.resolvedIssues.has(i.id) ? 'done' : ''}"><span class="check">${state.resolvedIssues.has(i.id) ? '✓' : '○'}</span><div class="issue-body"><div class="issue-label">${escape(i.label)}</div></div></li>`).join('')}</ul>
      ${state.failedAttempts > 0 ? `<p class="fail-counter">Wrong picks so far: ${state.failedAttempts}.</p>` : ''}
      <button class="btn submit ${allDone ? '' : 'disabled'}" data-action="submit" ${allDone ? '' : 'disabled'}>File breach response</button>
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

const RECAP: CaseRecap = CASE_RECAPS['hipaa-spider']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">BREACH RESPONSE FILED</div>
      <h2>Three patients notified. Internal log + HHS aggregate clean.</h2>
      <p>
        Individual notice letters mailed within the 60-day window.
        Internal log entry timestamped at discovery + assessment +
        notification. Destruction attestation on file. The annual
        HHS aggregate report will list this incident; OCR routes
        small incidents to aggregate review unless something
        escalates.
      </p>
      <p class="muted">
        HIPAA breach response is process discipline more than
        crisis management. The audit asks "did you follow the
        steps." If yes, even a real breach is recoverable. If
        no, even a near-miss is a finding.
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
            <li><strong>Three moves:</strong> assess (four-factor), contain (log + attest), notify (under-500 path).</li>
            <li><strong>First non-claim Case.</strong> No CARC; no payer. Compliance work pure.</li>
            <li><strong>Calibration as the puzzle.</strong> Under-react = OCR finding; over-react = self-inflicted breach. The right answer is in the middle.</li>
            <li><strong>Wrong-agency decoy.</strong> OIG vs HHS OCR — common confusion in the wild.</li>
          </ul>
        </div>
        <div>
          <h3>Sibling shape</h3>
          <ul>
            <li>L10 placement matches the Audit Boss prototype — process discipline + documentation as the muscle.</li>
            <li>Set in the 2F Compliance room (HIPAA dragon's lair).</li>
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

function pickStmt(id: string, pick: boolean) {
  const s = assessStatements.find(x => x.id === id); if (!s) return
  state.transientFeedback = null
  if (s.truth === pick) {
    state.stmtStates[id].pick = pick
    state.transientFeedback = { id, message: s.reason, kind: 'good' }
    if (isAssessDone()) state.resolvedIssues.add('assess')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: s.reason, kind: 'bad' }
  }
}

function resetStmt(id: string) {
  state.stmtStates[id].pick = null
  state.resolvedIssues.delete('assess')
  state.resolvedIssues.delete('contain')
  state.resolvedIssues.delete('notify')
  state.transientFeedback = null
}

function applyContain(id: string) {
  const o = containOptions.find(x => x.id === id); if (!o) return
  state.transientFeedback = null
  if (o.correct) {
    state.appliedContainId = id
    state.resolvedIssues.add('contain')
    state.transientFeedback = { id, message: o.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: o.feedback, kind: 'bad' }
  }
}

function applyNotify(id: string) {
  const o = notifyOptions.find(x => x.id === id); if (!o) return
  state.transientFeedback = null
  if (o.correct) {
    state.appliedNotifyId = id
    state.resolvedIssues.add('notify')
    state.transientFeedback = { id, message: o.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: o.feedback, kind: 'bad' }
  }
}

function attemptSubmit() {
  if (issues.every(i => state.resolvedIssues.has(i.id))) {
    state.packetSubmitted = true
    notifyParentVictory('hipaa-spider')
  }
}

function reset() {
  state.briefingDone = false; state.briefingOpen = false
  for (const id in state.stmtStates) state.stmtStates[id] = { pick: null }
  state.appliedContainId = null; state.appliedNotifyId = null
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
    case 'pick-stmt': if (el.dataset.id && el.dataset.pick) pickStmt(el.dataset.id, el.dataset.pick === 'true'); break
    case 'reset-stmt': if (el.dataset.id) resetStmt(el.dataset.id); break
    case 'apply-contain': if (el.dataset.id) applyContain(el.dataset.id); break
    case 'apply-notify': if (el.dataset.id) applyNotify(el.dataset.id); break
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

const css = districtVars('appeals') + BASE_CSS + `
  .assess-panel, .contain-panel, .notify-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .assess-panel.done, .contain-panel.done, .notify-panel.done { border-left-color: var(--good); }
  .contain-panel.locked, .notify-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .ap-h, .cp-h, .np-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .ap-tag, .cp-tag, .np-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .cp-tag.idle, .np-tag.idle { color: var(--ink-dim); }
  .ap-tag.done, .cp-tag.done, .np-tag.done { color: var(--good); }
  .ap-sub, .cp-sub, .np-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .stmt-list, .opt-list { list-style: none; padding-left: 0; margin: 0; }
  .stmt { display: flex; align-items: center; gap: 16px; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 6px; border-left: 3px solid transparent; }
  .stmt.correct { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .stmt-text { flex: 1; font-size: 13px; line-height: 1.5; }
  .stmt-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .stmt-badge { font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; }
  .stmt-badge.true  { background: rgba(126, 226, 193, 0.15); color: var(--good); border: 1px solid #2c5547; }
  .stmt-badge.false { background: rgba(239, 91, 123, 0.10); color: var(--bad); border: 1px solid #4a2a32; }
  .btn.small { padding: 4px 10px; font-size: 11.5px; }

  .opt { margin-bottom: 6px; }
  .opt-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 12px 14px; text-align: left; font: inherit; transition: all 0.15s; position: relative; display: flex; flex-direction: column; gap: 6px; }
  .opt-btn:hover:not(:disabled) { background: #232b3a; border-color: var(--accent); }
  .opt-btn:disabled { opacity: 0.45; cursor: default; }
  .opt.applied .opt-btn { border-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); opacity: 1; }
  .opt-label { font-size: 13px; font-weight: 600; padding-right: 80px; }
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
