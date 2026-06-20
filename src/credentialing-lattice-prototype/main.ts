// Credentialing Lattice @ L15 — provider-enrollment Case. Dr. Patel
// joined Mercy in March; her payer enrollments lag her start date.
// One DOS landed inside the gap with Anthem; CO-242 (services not
// provided by network provider) returns. Walk the credentialing
// matrix, find the gap, file a backdated enrollment + reconsideration.
//
// Action set:
//   - Verify network: 4 cells in the credentialing matrix; mark
//     each "in-network for DOS" or "in-gap for DOS."
//   - Enroll: 4 enrollment-action options.
//   - Backdate: 4 reconsideration paths.
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

interface MatrixCell {
  id: string
  payer: string
  effectiveDate: string
  /** True iff Dr. Patel was in-network for this payer on the DOS. */
  inNetwork: boolean
  reason: string
}

interface EnrollOption {
  id: string
  label: string
  detail: string
  correct: boolean
  feedback: string
}

interface BackdateOption {
  id: string
  label: string
  correct: boolean
  feedback: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'verify' | 'enroll' | 'backdate'
}

interface GlossaryEntry { term: string; plain: string }

// ===== Encounter data =====

const PROVIDER = 'Dr. Pranesh Patel'
const PROVIDER_START = '2026-03-15'
const DOS = '2026-03-22'
const PATIENT = 'Hannah Beck'

const matrix: MatrixCell[] = [
  {
    id: 'aetna',
    payer: 'Aetna PPO',
    effectiveDate: '2026-03-15',
    inNetwork: true,
    reason: 'Aetna processed Dr. Patel\'s enrollment fast — effective date matches her start. In-network on the DOS. No issue here.',
  },
  {
    id: 'anthem',
    payer: 'Anthem BCBS',
    effectiveDate: '2026-04-02',
    inNetwork: false,
    reason: 'Anthem\'s effective date is 2026-04-02, eleven days *after* Hannah\'s DOS. Dr. Patel was treating an Anthem patient before her enrollment processed. CO-242 follows. This is the gap to fix.',
  },
  {
    id: 'cigna',
    payer: 'Cigna',
    effectiveDate: '2026-03-10',
    inNetwork: true,
    reason: 'Cigna onboarded Dr. Patel during pre-employment credentialing. Effective 5 days before her start; in-network from day one. Fine.',
  },
  {
    id: 'uhc',
    payer: 'UnitedHealthcare',
    effectiveDate: '2026-03-21',
    inNetwork: true,
    reason: 'UHC effective date is 2026-03-21, one day before the DOS. Tight, but in-network. Fine.',
  },
]

const enrollOptions: EnrollOption[] = [
  {
    id: 'backdate-anthem',
    label: 'Submit a backdated enrollment effective-date correction with Anthem',
    detail: 'CAQH profile + Mercy roster + Dr. Patel\'s start-date letter; request retroactive effective date of 2026-03-15 (her actual start date).',
    correct: true,
    feedback: 'Right move. Anthem\'s provider-enrollment department processes retroactive effective-date corrections when the provider was credentialed under the group contract and the only delay was their internal processing. Mercy\'s contract has Dr. Patel as a covered provider from 3/15.',
  },
  {
    id: 'do-nothing',
    label: 'Accept CO-242; bill the patient',
    detail: 'Tell Hannah she saw an out-of-network provider on her in-network facility visit; collect her OON cost-share.',
    correct: false,
    feedback: 'Hannah went to an in-network facility (Mercy) for a scheduled appointment and saw the provider she was assigned. The NSA in-network-facility carve-out (cousin: Carve-out Phantom) protects her from balance billing — and even outside NSA, this is a credentialing failure on the provider side, not the patient\'s.',
  },
  {
    id: 'create-new-tax-id',
    label: 'Resubmit under Mercy\'s group tax ID instead of Dr. Patel\'s NPI',
    detail: 'Treat the encounter as facility-only and bill Anthem under the hospital\'s contract.',
    correct: false,
    feedback: 'Misrepresents the rendering provider. Dr. Patel rendered the service; the claim has to identify her. Submitting under Mercy alone is a billing-compliance violation and won\'t address the underlying enrollment gap.',
  },
  {
    id: 'wait-it-out',
    label: 'Wait for Anthem\'s 4/2 effective date and refile then',
    detail: 'No backdate request — just resubmit after the calendar passes.',
    correct: false,
    feedback: 'Anthem\'s effective date is 4/2; refiling on 4/3 still leaves the 3/22 DOS *outside* the effective window. Forward effective dates don\'t make backward DOS in-network. The retroactive correction is what closes the gap.',
  },
]

const backdateOptions: BackdateOption[] = [
  {
    id: 'recon-with-letter',
    label: 'File a corrected claim + reconsideration packet with Anthem (proof of CAQH enrollment, Mercy roster letter dated 3/15, retroactive effective-date confirmation from Anthem)',
    correct: true,
    feedback: 'Right packet. Reconsideration with documentation of the retroactive correction reverses the CO-242 denial. Anthem reprocesses the claim against the corrected effective date; in-network adjudication runs.',
  },
  {
    id: 'no-letter',
    label: 'File a corrected claim only (no reconsideration packet)',
    correct: false,
    feedback: 'Anthem\'s adjudication system will check the claim against the original effective date (4/2) and deny CO-242 again. The reconsideration packet is what tells the human reviewer to use the corrected date.',
  },
  {
    id: 'level-2-appeal',
    label: 'Skip reconsideration; go straight to a level-2 formal appeal',
    correct: false,
    feedback: 'Level 2 appeals are for adjudicated decisions you disagree with — not for credentialing gaps. Reconsideration with the corrected effective date is the right path; a formal appeal earns "premature appeal" routing and burns 30+ days.',
  },
  {
    id: 'patient-appeal',
    label: 'Have Hannah file a member-side appeal with Anthem',
    correct: false,
    feedback: 'Wrong party. The credentialing gap is provider-side; member-appeals address coverage decisions. Hannah has no information to dispute and shouldn\'t be in the middle of a Mercy/Anthem enrollment process.',
  },
]

const issues: Issue[] = [
  {
    id: 'verify',
    label: 'Verify network: which payer was Dr. Patel in-network with on 3/22?',
    recap: 'Aetna, Cigna, UHC — all in-network on the DOS. Anthem effective date was 4/2, eleven days after Hannah\'s visit. The Anthem cell is the gap.',
    verb: 'verify',
  },
  {
    id: 'enroll',
    label: 'Enroll: pick the right action.',
    recap: 'Backdated effective-date correction with Anthem. CAQH + Mercy roster + start-date letter as supporting docs; request retroactive 3/15 effective date.',
    verb: 'enroll',
  },
  {
    id: 'backdate',
    label: 'Backdate: file the right reconsideration.',
    recap: 'Reconsideration packet with the corrected effective-date confirmation. Anthem reprocesses; in-network adjudication runs; CO-242 reverses.',
    verb: 'backdate',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'CAQH': {
    term: 'CAQH (Council for Affordable Quality Healthcare)',
    plain: "Single source-of-truth for provider credentialing data. Providers maintain one CAQH profile (NPI, license, malpractice, work history, etc.); payers pull from CAQH instead of asking each provider for the same paperwork. Doesn't enroll the provider in a contract — just supplies the data the payer\'s enrollment team needs.",
  },
  'CO-242': {
    term: 'CO-242 (services not provided by network/primary care providers)',
    plain: "Payer rejection: the rendering provider isn't in the patient's network on the DOS. Three common causes: (1) actually OON, (2) credentialing not yet processed, (3) provider mis-identified on claim. CO-242 is provider-credentialing-side; CO-31 is patient-identity-side; CO-95 is form-type-side. All eligibility-family.",
  },
  'effective date': {
    term: 'Effective date (provider enrollment)',
    plain: "The date a provider is in-network with a specific payer. Set by the payer's enrollment team based on credentialing approval. Often 30-90 days after the provider's actual start date because credentialing is paperwork-heavy. Retroactive corrections are common when the provider was actively credentialed but the payer's processing lagged.",
  },
  'reconsideration': {
    term: 'Reconsideration (vs formal appeal)',
    plain: "Light-touch first step in payer dispute resolution. Faster than a formal appeal (5-15 days vs 30-60), more constrained scope (single claim, single decision), and usually doesn't require a full appeal letter — just the corrected information and a brief explanation. Right path for credentialing/effective-date corrections.",
  },
  'backdating': {
    term: 'Backdating (effective date correction)',
    plain: "Asking the payer to retroactively change a provider's enrollment effective date. Allowed when the provider was credentialed under the group contract and the delay was internal payer processing. Most major payers process backdating routinely with the right documentation; **most impose 90-day or 180-day caps on retroactivity** — beyond that window, backdating is denied and the claim has to be written off or pursued through escalation. This Case's 11-day gap is well within the typical cap; real-world backdating fights run longer when the gap is older than the cap.",
  },
  'NCQA': {
    term: 'NCQA credentialing standards',
    plain: "National Committee for Quality Assurance maintains the standard credentialing framework most commercial payers follow. Three-year recredentialing cycle, primary-source verification (verify license and education directly with the issuing institutions, not through the provider), sanctions monitoring (OIG / SAM / state board exclusion lists). Hospitals and group practices operate inside the NCQA framework even when individual payers add their own twists. Background context for this Case; the actual gap here is internal payer processing speed, not NCQA-side delay.",
  },
}

// ===== Runtime state =====

interface CellState { picked: boolean | null }

const state = {
  briefingDone: false,
  briefingOpen: false,
  cellStates: matrix.reduce((m, c) => { m[c.id] = { picked: null }; return m }, {} as Record<string, CellState>),
  appliedEnrollId: null as string | null,
  appliedBackdateId: null as string | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isVerifyDone(): boolean {
  return matrix.every(c => state.cellStates[c.id].picked === c.inNetwork)
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
      ${renderVerifyPanel()}
      ${renderEnrollPanel()}
      ${renderBackdatePanel()}
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
        <h1>Credentialing Lattice <span class="muted">@ L15 — first sketch</span></h1>
        <div class="header-actions">${recallBtn}<a class="back-link" href="./prototypes.html">← back to catalog</a></div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          ${escape(PROVIDER)} joined Mercy on ${escape(PROVIDER_START)}.
          ${term('CAQH')} processed; some payers onboarded fast; others
          lagged. Hannah Beck saw Dr. Patel on ${escape(DOS)};
          Anthem's ${term('effective date')} for Dr. Patel was 4/2 —
          eleven days after the DOS. ${term('CO-242')} returned.
          Walk the matrix, file the backdate, file the
          ${term('reconsideration')}. See the
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
        Theresa from Anthem's provider relations is on the line.
        "${escape(PROVIDER)} — your March 22 claim came back ${term('CO-242')}.
        Effective date in our system is 4/2. That's a
        ${term('backdating', 'backdate')} request. Let's walk the
        documentation."
      </p>
      <p>
        Four payers, four effective dates, one DOS in the gap.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The matrix slides
        a half-pixel left, then settles. Three cells are green;
        one is the gap.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'Provider-side eligibility. Walk the matrix.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "Eligibility-side, but provider-flavored. Hannah was eligible
        — that's not the issue. Her doctor wasn't yet in-network with
        her payer on the DOS. Different gap, different fix."
      </p>
      <p>"Three issues:"</p>
      <ul>
        <li>Four payers in the
        credentialing matrix. Check which were active on 3/22.</li>
        <li>Backdate the Anthem effective
        date. Don't bill Hannah, don't fudge the tax ID, don't
        wait.</li>
        <li>Reconsideration with the
        corrected effective date. Skip reconsideration and the
        adjudicator denies again.</li>
      </ul>
      <p class="briefing-sign">"Retro-credentialing is a real thing. Ask. — D."</p>
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

function renderVerifyPanel(): string {
  const done = state.resolvedIssues.has('verify')
  return `
    <section class="verify-panel ${done ? 'done' : ''}">
      <div class="vp-h">
        <span class="vp-tag">CREDENTIALING MATRIX · ${escape(PROVIDER)} · DOS ${escape(DOS)}</span>
        <span class="vp-sub">${done ? 'Anthem cell is the gap (effective 4/2 vs DOS 3/22).' : 'Mark each cell "in-network" (effective ≤ DOS) or "in gap" (effective > DOS).'}</span>
      </div>
      <ul class="cell-list">
        ${matrix.map(c => renderCell(c)).join('')}
      </ul>
      ${state.transientFeedback && matrix.some(c => c.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('verify') : ''}
    </section>
  `
}

function renderCell(c: MatrixCell): string {
  const ss = state.cellStates[c.id]
  const decided = ss.picked !== null
  const correct = decided && ss.picked === c.inNetwork
  return `
    <li class="cell ${decided && correct ? (c.inNetwork ? 'in-network' : 'gap') : ''}">
      <div class="cell-meta">
        <div class="cell-payer">${escape(c.payer)}</div>
        <div class="cell-eff">Effective: ${escape(c.effectiveDate)}</div>
      </div>
      <div class="cell-actions">
        ${decided && correct ? `
          <span class="cell-badge ${c.inNetwork ? 'in-network' : 'gap'}">${c.inNetwork ? 'IN-NETWORK' : 'IN GAP'}</span>
          <button class="btn small ghost" data-action="reset-cell" data-id="${c.id}">↺ undo</button>
        ` : `
          <button class="btn small ghost" data-action="pick-cell" data-id="${c.id}" data-pick="in">In-network</button>
          <button class="btn small ghost" data-action="pick-cell" data-id="${c.id}" data-pick="gap">In gap</button>
        `}
      </div>
    </li>
  `
}

function renderEnrollPanel(): string {
  const unlocked = state.resolvedIssues.has('verify')
  const done = state.resolvedIssues.has('enroll')
  if (!unlocked) return `<section class="enroll-panel locked"><div class="ep-h"><span class="ep-tag idle">ENROLL</span><span class="ep-sub">Locked.</span></div></section>`
  return `
    <section class="enroll-panel ${done ? 'done' : 'active'}">
      <div class="ep-h"><span class="ep-tag ${done ? 'done' : 'active'}">ENROLL · 4 actions</span><span class="ep-sub">${done ? 'Backdated effective-date correction submitted.' : 'Pick the right action.'}</span></div>
      <ul class="opt-list">
        ${enrollOptions.map(o => renderEnrollRow(o)).join('')}
      </ul>
      ${state.transientFeedback && enrollOptions.some(o => o.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('enroll') : ''}
    </section>
  `
}

function renderEnrollRow(o: EnrollOption): string {
  const applied = state.appliedEnrollId === o.id
  const locked = state.appliedEnrollId !== null && !applied
  return `
    <li class="opt ${applied ? 'applied' : ''}">
      <button class="opt-btn" data-action="apply-enroll" data-id="${o.id}" ${locked ? 'disabled' : ''}>
        <span class="opt-label">${escape(o.label)}</span>
        <span class="opt-detail">${escape(o.detail)}</span>
        ${applied ? '<span class="opt-badge">APPLIED</span>' : ''}
      </button>
    </li>
  `
}

function renderBackdatePanel(): string {
  const unlocked = state.resolvedIssues.has('enroll')
  const done = state.resolvedIssues.has('backdate')
  if (!unlocked) return `<section class="backdate-panel locked"><div class="bp-h"><span class="bp-tag idle">BACKDATE</span><span class="bp-sub">Locked.</span></div></section>`
  return `
    <section class="backdate-panel ${done ? 'done' : 'active'}">
      <div class="bp-h"><span class="bp-tag ${done ? 'done' : 'active'}">BACKDATE / RECONSIDERATION · 4 paths</span><span class="bp-sub">${done ? 'Reconsideration packet submitted with corrected effective date.' : 'Pick the right path.'}</span></div>
      <ul class="opt-list">
        ${backdateOptions.map(b => renderBackdateRow(b)).join('')}
      </ul>
      ${state.transientFeedback && backdateOptions.some(b => b.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('backdate') : ''}
    </section>
  `
}

function renderBackdateRow(b: BackdateOption): string {
  const applied = state.appliedBackdateId === b.id
  return `
    <li class="opt ${applied ? 'applied' : ''}">
      <button class="opt-btn" data-action="apply-backdate" data-id="${b.id}" ${state.appliedBackdateId !== null && !applied ? 'disabled' : ''}>
        <span class="opt-label">${escape(b.label)}</span>
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
      <div class="checklist-h">CREDENTIALING FIX · 3 issues to resolve</div>
      <ul>${issues.map(i => `<li class="${state.resolvedIssues.has(i.id) ? 'done' : ''}"><span class="check">${state.resolvedIssues.has(i.id) ? '✓' : '○'}</span><div class="issue-body"><div class="issue-label">${escape(i.label)}</div></div></li>`).join('')}</ul>
      ${state.failedAttempts > 0 ? `<p class="fail-counter">Wrong picks so far: ${state.failedAttempts}.</p>` : ''}
      <button class="btn submit ${allDone ? '' : 'disabled'}" data-action="submit" ${allDone ? '' : 'disabled'}>File reconsideration</button>
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

const RECAP: CaseRecap = CASE_RECAPS['credentialing-lattice']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">RECONSIDERATION FILED</div>
      <h2>Anthem effective date backdated to 3/15. Claim refiled.</h2>
      <p>
        Anthem provider-relations confirmed the retroactive
        effective-date correction (CAQH + Mercy roster + start-date
        letter on file). Reconsideration packet routes Hannah's
        3/22 claim through in-network adjudication. CO-242 reverses
        on the next 835.
      </p>
      <p class="muted">
        Credentialing is provider-side eligibility — same DNA as
        patient-side eligibility, different actor. Most CO-242
        denials in the wild are administrative gaps, not actual
        OON care. Backdating is the routine fix.
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
            <li><strong>Three actions:</strong> verify network, enroll, backdate.</li>
            <li><strong>Provider-side eligibility.</strong> CO-242 ≠ CO-31 (patient identity) ≠ CO-95 (form type). All eligibility-family but different actors.</li>
            <li><strong>Reconsideration ≠ formal appeal.</strong> Light touch for credentialing fixes; formal appeals are for adjudicated decisions.</li>
            <li><strong>Don't bill the patient.</strong> Credentialing gaps are administrative, not member-facing.</li>
          </ul>
        </div>
        <div>
          <h3>Sibling shape</h3>
          <ul>
            <li>Cousin to <a href="./carveout-phantom-prototype.html">Carve-out Phantom</a> (also network-status as the lever).</li>
            <li>Cousin to <a href="./phantom-patient-prototype.html">Phantom Patient</a> (both eligibility-family, different sides).</li>
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

function pickCell(id: string, pick: 'in' | 'gap') {
  const c = matrix.find(x => x.id === id); if (!c) return
  state.transientFeedback = null
  const right = c.inNetwork ? 'in' : 'gap'
  if (pick === right) {
    state.cellStates[id].picked = c.inNetwork
    state.transientFeedback = { id, message: c.reason, kind: 'good' }
    if (isVerifyDone()) state.resolvedIssues.add('verify')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: c.reason, kind: 'bad' }
  }
}

function resetCell(id: string) {
  state.cellStates[id].picked = null
  state.resolvedIssues.delete('verify')
  state.resolvedIssues.delete('enroll')
  state.resolvedIssues.delete('backdate')
  state.transientFeedback = null
}

function applyEnroll(id: string) {
  const o = enrollOptions.find(x => x.id === id); if (!o) return
  state.transientFeedback = null
  if (o.correct) {
    state.appliedEnrollId = id
    state.resolvedIssues.add('enroll')
    state.transientFeedback = { id, message: o.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: o.feedback, kind: 'bad' }
  }
}

function applyBackdate(id: string) {
  const b = backdateOptions.find(x => x.id === id); if (!b) return
  state.transientFeedback = null
  if (b.correct) {
    state.appliedBackdateId = id
    state.resolvedIssues.add('backdate')
    state.transientFeedback = { id, message: b.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: b.feedback, kind: 'bad' }
  }
}

function attemptSubmit() {
  if (issues.every(i => state.resolvedIssues.has(i.id))) {
    state.packetSubmitted = true
    notifyParentVictory('credentialing-lattice')
  }
}

function reset() {
  state.briefingDone = false; state.briefingOpen = false
  for (const id in state.cellStates) state.cellStates[id] = { picked: null }
  state.appliedEnrollId = null; state.appliedBackdateId = null
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
    case 'pick-cell': if (el.dataset.id && el.dataset.pick) pickCell(el.dataset.id, el.dataset.pick as 'in' | 'gap'); break
    case 'reset-cell': if (el.dataset.id) resetCell(el.dataset.id); break
    case 'apply-enroll': if (el.dataset.id) applyEnroll(el.dataset.id); break
    case 'apply-backdate': if (el.dataset.id) applyBackdate(el.dataset.id); break
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
  .verify-panel, .enroll-panel, .backdate-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .verify-panel.done, .enroll-panel.done, .backdate-panel.done { border-left-color: var(--good); }
  .enroll-panel.locked, .backdate-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .vp-h, .ep-h, .bp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .vp-tag, .ep-tag, .bp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .ep-tag.idle, .bp-tag.idle { color: var(--ink-dim); }
  .vp-tag.done, .ep-tag.done, .bp-tag.done { color: var(--good); }
  .vp-sub, .ep-sub, .bp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .cell-list, .opt-list { list-style: none; padding-left: 0; margin: 0; }
  .cell { display: flex; gap: 14px; align-items: center; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 6px; border-left: 3px solid transparent; flex-wrap: wrap; }
  .cell.in-network { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .cell.gap { border-left-color: var(--bad); background: linear-gradient(180deg, rgba(239,91,123,0.06), transparent); }
  .cell-meta { flex: 2; min-width: 220px; }
  .cell-payer { font-size: 13px; font-weight: 600; }
  .cell-eff { font-family: ui-monospace, monospace; font-size: 11.5px; color: var(--ink-dim); }
  .cell-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .cell-badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 3px; }
  .cell-badge.in-network { background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; }
  .cell-badge.gap { background: rgba(239,91,123,0.10); color: var(--bad); border: 1px solid #4a2a32; }
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
