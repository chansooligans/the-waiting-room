// COB Cascade Spider @ L9 — coordination-of-benefits cascade with
// commercial primary/secondary AND Medicare Secondary Payer
// (working-aged) wrinkle. Cousin to Hydra (the original COB Case)
// but goes deeper into the rules: birthday rule for dependent kids,
// MSP working-aged for the grandparent on the plan, and the
// gotcha that "primary" varies by patient on the same family
// policy.
//
// Verbs:
//   - VERIFY-ELIGIBILITY: 4 statements about the policy structure +
//     COB rules. True/false.
//   - APPLY-CASCADE: pick the right primary/secondary order for
//     each of three patients on the same household.
//   - REFILE: pick the right resolution path for the misfiled claim.
//
// The teaching beat: COB isn't one rule — it's a cascade where the
// answer depends on patient relationship to the subscriber + age +
// Medicare-entitlement status + employer size + court orders. Same
// household, three patients, three different "primary" payers.
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

// ===== Domain types =====

interface CobStatement {
  id: string
  text: string
  truth: boolean
  reason: string
}

interface PatientCascade {
  id: string
  name: string
  relationship: string
  age: string
  /** What the player picks (primary payer name). */
  correctPrimary: string
  /** All payer options shown. */
  options: { id: string; payer: string; correct: boolean; feedback: string }[]
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
  verb: 'verify' | 'cascade' | 'refile'
}

interface GlossaryEntry { term: string; plain: string }

// ===== Encounter data =====

const HOUSEHOLD = 'Reyes household'
const FACILITY_BILL = 1_840
const MISFILED_PRIMARY = 'Aetna'

const cobStatements: CobStatement[] = [
  {
    id: 's1',
    text: 'For a dependent child covered under both parents\' employer plans, the parent whose birthday falls EARLIER in the calendar year provides primary coverage.',
    truth: true,
    reason: 'The "birthday rule" — most-broadly-adopted COB tiebreaker for dependent kids on two parental plans. Year of birth doesn\'t matter; only month + day. Annual cycle, not parent-age-based. Both NAIC model regs and most state COB statutes adopt this.',
  },
  {
    id: 's2',
    text: 'Medicare is always the primary payer for any patient who has Medicare and an employer plan.',
    truth: false,
    reason: 'Wrong, this is the working-aged MSP rule\'s opposite. When the patient is 65+ AND covered by a current-employment employer plan AND the employer has 20+ employees, the EMPLOYER PLAN is primary, Medicare is secondary. Smaller employers (<20) flip the order. ESRD, end-stage renal disease, has its own 30-month coordination-period rule. MSP is "Medicare second" precisely because Medicare often isn\'t first.',
  },
  {
    id: 's3',
    text: 'A court order specifying which parent must provide health coverage for a child overrides the birthday rule.',
    truth: true,
    reason: 'Yes — the QMCSO (Qualified Medical Child Support Order) or similar state-court order takes priority over birthday rule. The plan named in the order is primary regardless of which parent has the earlier birthday. Common in divorce situations.',
  },
  {
    id: 's4',
    text: `Misfiling a claim to the wrong primary payer is the most common cause of CO-22 ("This care may be covered by another payer per coordination of benefits").`,
    truth: true,
    reason: 'CO-22 says "we think someone else is primary." It usually means the COB cascade was wrong on the claim. Real COB-driven denials are roughly half "wrong primary on file" and half "secondary not yet billed." The correct response is to re-walk the cascade against the patient\'s actual eligibility on the DOS.',
  },
]

const cascadePatients: PatientCascade[] = [
  {
    id: 'mateo',
    name: 'Mateo Reyes',
    relationship: 'Dependent child, age 8',
    age: 'Both parents work; both employer plans cover him.',
    correctPrimary: 'Aetna (Mom\'s plan — Mom\'s birthday is March 14)',
    options: [
      { id: 'aetna-mom', payer: 'Aetna (Mom\'s plan)', correct: true, feedback: 'Right. Mom\'s birthday March 14; Dad\'s birthday August 22. Mom\'s plan is primary under the birthday rule. Aetna processes first; UHC (Dad\'s) secondary.' },
      { id: 'uhc-dad', payer: 'UHC (Dad\'s plan)', correct: false, feedback: 'Birthday rule: earlier calendar birthday wins. Mom (March) before Dad (August). Mom\'s plan = Aetna = primary.' },
      { id: 'longer', payer: 'Whichever plan has been in effect longer', correct: false, feedback: 'That\'s the tiebreaker for ADULTS covered under their own plan + a spouse\'s plan, not dependent kids. For kids on two parental plans, birthday rule is first.' },
      { id: 'older-parent', payer: 'The older parent\'s plan', correct: false, feedback: 'Common misconception. Birthday rule is about CALENDAR birthday (month + day), not parent age. A parent born March 1985 has earlier birthday than a parent born February 1980 — the 1985 plan wins for COB even though that parent is younger.' },
    ],
  },
  {
    id: 'sofia',
    name: 'Sofia Reyes',
    relationship: 'Spouse / age 67',
    age: 'On Mom\'s Aetna employer plan + Medicare Part A & B (turned 65 two years ago, kept working).',
    correctPrimary: 'Aetna (employer plan; MSP working-aged makes employer primary)',
    options: [
      { id: 'aetna-employer', payer: 'Aetna (employer plan)', correct: true, feedback: 'Right. MSP working-aged: when the patient is 65+ AND covered by a current-employment plan AND the employer has 20+ employees, employer is primary. Mom\'s firm has 200 employees; Aetna is primary, Medicare is secondary.' },
      { id: 'medicare-primary', payer: 'Medicare', correct: false, feedback: 'Wrong on the working-aged rule. Medicare is secondary when (a) patient is 65+, (b) employer plan is current-employment-based (not retiree), (c) employer has 20+ employees. Sofia checks all three boxes.' },
      { id: 'uhc-spouse', payer: 'UHC (Dad\'s plan)', correct: false, feedback: 'UHC isn\'t in the picture for Sofia — she\'s covered under her own employer (Aetna) + Medicare, not Dad\'s plan.' },
      { id: 'medicaid', payer: 'Medicaid', correct: false, feedback: 'Sofia isn\'t on Medicaid. Distractor.' },
    ],
  },
  {
    id: 'jorge',
    name: 'Jorge Reyes (grandfather)',
    relationship: 'Disabled adult, age 72',
    age: 'Lives with the family; on Medicare + Medicaid (dual-eligible). No employer plan.',
    correctPrimary: 'Medicare',
    options: [
      { id: 'medicare', payer: 'Medicare', correct: true, feedback: 'Right. No current-employment employer plan on Jorge — MSP working-aged doesn\'t apply. Medicare is primary; Medicaid pays remaining cost-share as the always-last payer (Medicaid is payer of last resort by federal law).' },
      { id: 'medicaid-primary', payer: 'Medicaid', correct: false, feedback: 'Medicaid is ALWAYS payer of last resort by federal law (42 USC §1396a). It pays after every other source, including Medicare. Filing Medicaid as primary on a dual-eligible patient is a common error.' },
      { id: 'family-plan', payer: 'Aetna (Mom\'s plan)', correct: false, feedback: 'Jorge isn\'t a dependent on Aetna — he\'s the grandfather, not Mom\'s spouse or child. The household policy doesn\'t cover him.' },
      { id: 'self-pay', payer: 'Self-pay', correct: false, feedback: 'Jorge has Medicare AND Medicaid. He shouldn\'t be processed as self-pay.' },
    ],
  },
]

const resolutions: Resolution[] = [
  {
    id: 're-walk-and-refile',
    label: `Re-walk the COB cascade for each patient against eligibility-on-DOS, refile each claim against the right primary, queue secondaries to bill after primary 835s post.`,
    correct: true,
    feedback: 'Right move. Mateo\'s claim refiles with Aetna primary (Mom\'s birthday). Sofia\'s refiles with Aetna primary (MSP working-aged). Jorge\'s refiles with Medicare primary (Medicaid as payer of last resort). Each secondary picks up after primary 835 posts.',
  },
  {
    id: 'just-resubmit',
    label: 'Resubmit all three claims as filed; CO-22 will resolve once payers cross-check.',
    correct: false,
    feedback: 'CO-22 doesn\'t self-resolve. Payers don\'t cross-check coverage in real time on rejected claims; they wait for the provider to file against the right primary. "Resubmit and hope" sits in AR aging until somebody works it.',
  },
  {
    id: 'bill-patient',
    label: 'Send all three balances to the patient as self-pay; let them work the COB.',
    correct: false,
    feedback: 'Federal and state laws bar billing the patient when COB hasn\'t been resolved on a covered service. Sending these to self-pay generates patient complaints, audit findings, and potential FCA exposure.',
  },
  {
    id: 'one-cascade-fits-all',
    label: 'Pick one primary payer and use it for all three patients on the household policy.',
    correct: false,
    feedback: 'COB is per-patient, not per-household. Same family policy, three different primaries: Mateo → Aetna (birthday rule), Sofia → Aetna (MSP working-aged on her own employer), Jorge → Medicare (no employer plan). The cascade walks differently for each patient.',
  },
  {
    id: 'medicaid-everywhere',
    label: 'File Medicaid as primary on Jorge\'s claim; he\'s dual-eligible.',
    correct: false,
    feedback: 'Medicaid is payer of last resort under 42 USC §1396a. ALWAYS files last, never first. Filing Medicaid primary on a dual-eligible patient is one of the most common COB errors and one of the easiest audit findings.',
  },
]

const issues: Issue[] = [
  {
    id: 'verify',
    label: 'Verify-eligibility: walk the COB rules. 4 statements true/false.',
    recap: 'You walked the cascade rules. Birthday rule for dependent kids (true); Medicare ALWAYS primary (false — MSP working-aged flips it); court orders override birthday rule (true); CO-22 = wrong primary on file (true).',
    verb: 'verify',
  },
  {
    id: 'cascade',
    label: 'Apply the cascade: pick the right primary for each of three Reyes patients.',
    recap: 'Three different primaries on the same household policy. Mateo → Aetna (birthday rule, Mom\'s March birthday wins). Sofia → Aetna (MSP working-aged: 65+, current employer, 20+ employees). Jorge → Medicare (Medicaid is payer of last resort, never primary). The cascade is per-patient, not per-household.',
    verb: 'cascade',
  },
  {
    id: 'refile',
    label: 'Refile: re-walk the cascade and refile against the right primary per patient.',
    recap: 'All three claims refiled correctly. Aetna processes Mateo + Sofia primary; Medicare processes Jorge primary. Secondaries (UHC for Mateo, Medicare for Sofia, Medicaid for Jorge) pick up after primary 835s post.',
    verb: 'refile',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'COB': {
    term: 'COB (Coordination of Benefits)',
    plain: "Rules for ordering payment when a patient has multiple coverage sources. Determines primary, secondary, tertiary payers. Lives in NAIC model regulations + state COB statutes + federal Medicare Secondary Payer rules + ERISA plan provisions. The patient has the same coverage either way; what changes is who pays first and how the others coordinate around that.",
  },
  'birthday rule': {
    term: 'Birthday rule',
    plain: "Tiebreaker for dependent children covered under both parents' plans: the parent whose birthday falls earlier in the CALENDAR year (month + day, not year of birth) provides primary coverage. Adopted by NAIC model regulations and most state COB statutes. Doesn't apply to spouses on each other's plans (different rule), and is overridden by court orders (QMCSO).",
  },
  'MSP': {
    term: 'MSP (Medicare Secondary Payer)',
    plain: "Federal rules establishing when Medicare is NOT the first payer. Six MSP categories: (1) working-aged 65+ with employer plan ≥20 employees; (2) disabled with large group health plan ≥100 employees; (3) ESRD during 30-month coordination period; (4) workers' compensation; (5) auto / no-fault liability; (6) Veterans Administration overlap. Medicare's name is literally 'Medicare Secondary Payer' for this reason — the assumption that Medicare is always primary is wrong far more often than people think.",
  },
  'working-aged': {
    term: 'Working-aged MSP rule',
    plain: "When all three apply, employer plan is primary and Medicare is secondary: (a) patient is 65+; (b) covered by a current-employment-based group health plan (not retiree); (c) employer has 20+ employees. If any condition fails, Medicare is primary. Most-common MSP situation; affects ~10 million Medicare beneficiaries.",
  },
  'payer of last resort': {
    term: 'Payer of last resort (Medicaid)',
    plain: "Medicaid is statutorily required to pay only after all other sources have paid (42 USC §1396a). Always files last. Filing Medicaid as primary on a dual-eligible (Medicare + Medicaid) patient is a common error and an easy audit finding. Even private insurance, workers' comp, and TRICARE come before Medicaid; Medicaid sweeps up whatever's left.",
  },
  'CO-22': {
    term: 'CO-22 (this care may be covered by another payer per COB)',
    plain: "CARC indicating the payer thinks they aren't primary. Most common COB-driven denial. Real-world causes: wrong primary on file (this Case), secondary billed before primary, member self-reported new coverage that wasn't in the system, employer-plan termination not yet reflected. Working CO-22 means re-walking eligibility on the DOS.",
  },
  'QMCSO': {
    term: 'QMCSO (Qualified Medical Child Support Order)',
    plain: "Court order requiring a parent's group health plan to cover a specified dependent child. Overrides the birthday rule for COB purposes. Common in divorce settlements; the plan named in the order is primary regardless of which parent has the earlier calendar birthday. Federal ERISA/PHSA framework requires plans to honor QMCSOs.",
  },
  'eligibility on DOS': {
    term: 'Eligibility on DOS (Date of Service)',
    plain: "The patient's coverage status the day the service was rendered, not the day the claim is processed. Eligibility can change between DOS and claim submission (employer plan terms, member adds Medicare, COB-on-file updates). Real-world COB work re-runs a 270/271 eligibility check against eligibility-on-DOS, not eligibility-today.",
  },
}

// ===== Runtime state =====

interface StmtState { pick: boolean | null }
interface CascadeState { picked: string | null }

const state = {
  briefingDone: false,
  briefingOpen: false,
  stmtStates: cobStatements.reduce((m, s) => { m[s.id] = { pick: null }; return m }, {} as Record<string, StmtState>),
  cascadeStates: cascadePatients.reduce((m, p) => { m[p.id] = { picked: null }; return m }, {} as Record<string, CascadeState>),
  appliedResolutionId: null as string | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isVerifyDone(): boolean {
  return cobStatements.every(s => state.stmtStates[s.id].pick === s.truth)
}

function isCascadeDone(): boolean {
  return cascadePatients.every(p => {
    const ss = state.cascadeStates[p.id]
    if (!ss.picked) return false
    const opt = p.options.find(o => o.id === ss.picked)
    return !!opt && opt.correct
  })
}

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
      ${renderVerifyPanel()}
      ${renderCascadePanel()}
      ${renderRefilePanel()}
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
        <h1>COB Cascade Spider <span class="muted">@ L9 — birthday rule + MSP + dual-eligibility</span></h1>
        <div class="header-actions">${recallBtn}<a class="back-link" href="./prototypes.html">← back to catalog</a></div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          Three Reyes-household patients, three claims, three different
          primary payers. Mateo (kid) needs the ${term('birthday rule')};
          Sofia (working 67-year-old) needs ${term('MSP', 'MSP working-aged')};
          Jorge (dual-eligible grandfather) needs the
          ${term('payer of last resort')} rule. Same household
          policy, completely different cascades. Goes deeper than
          <a href="./hydra-prototype.html">Hydra</a>. New verbs:
          VERIFY-ELIGIBILITY, APPLY-CASCADE, REFILE. See the
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
        Three claims came back ${term('CO-22')} from yesterday's
        ${escape(HOUSEHOLD)} encounters. Same household policy, three
        different patients, three different denials. ${money(FACILITY_BILL)}
        each. Eligibility flagged "review COB" on all three.
      </p>
      <p>
        Kim from registration walks them across. "Same family, same
        ID card. The cascade walks differently per patient. ${escape("I'll")}
        log eligibility-on-DOS for each; you walk the rules."
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The three claims slide
        a half-pixel apart. Each carries its own primary-payer puzzle.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'COB isn\'t one rule. It\'s a cascade per patient.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "${term('COB')} cascade. You'd think same household, same
        ID card, same primary — wrong. The rules cascade through
        relationship + age + Medicare-entitlement + employer size +
        court orders. Same household, three patients, three different
        primaries."
      </p>
      <p>"Three issues:"</p>
      <ul>
        <li>
          <strong>Verify-eligibility.</strong> Four COB statements,
          true/false. Watch the "${term('MSP', 'Medicare always primary')}" decoy —
          MSP rules flip it for working-aged + ESRD + a few others.
          <em>New verb: VERIFY-ELIGIBILITY.</em>
        </li>
        <li>
          <strong>Apply-cascade.</strong> Three patients on the
          same household; pick primary per patient. Mateo (kid)
          uses ${term('birthday rule')}; Sofia (working 67) uses
          ${term('working-aged', 'MSP working-aged')}; Jorge (grandfather)
          uses ${term('payer of last resort')}. <em>New verb:
          APPLY-CASCADE.</em>
        </li>
        <li>
          <strong>Refile.</strong> Re-walk eligibility on DOS, file
          against the right primary per patient, queue secondaries
          for the post-primary 835. Don't bill the patient; don't
          file Medicaid first; don't pick one primary for the whole
          household."
        </li>
      </ul>
      <p class="briefing-sign">"Primary, then secondary. Run the inquiry. — D."</p>
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
        <span class="vp-tag">COB RULES · 4 statements</span>
        <span class="vp-sub">${done
          ? 'Walked the rules. Birthday rule, MSP working-aged, court-order override, CO-22 → wrong primary on file.'
          : 'Mark each true/false. Watch the "Medicare always primary" decoy.'}</span>
      </div>
      <ul class="stmt-list">
        ${cobStatements.map(s => renderStmt(s)).join('')}
      </ul>
      ${state.transientFeedback && cobStatements.some(s => s.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('verify') : ''}
    </section>
  `
}

function renderStmt(s: CobStatement): string {
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

function renderCascadePanel(): string {
  const unlocked = state.resolvedIssues.has('verify')
  const done = state.resolvedIssues.has('cascade')
  if (!unlocked) {
    return `
      <section class="cascade-panel locked">
        <div class="cp-h"><span class="cp-tag idle">CASCADE · 3 patients</span><span class="cp-sub">Locked.</span></div>
      </section>
    `
  }
  return `
    <section class="cascade-panel ${done ? 'done' : 'active'}">
      <div class="cp-h">
        <span class="cp-tag ${done ? 'done' : 'active'}">CASCADE · 3 patients · same household</span>
        <span class="cp-sub">${done
          ? 'Three different primaries: Aetna (Mateo, birthday rule), Aetna (Sofia, MSP working-aged), Medicare (Jorge, payer of last resort puts Medicaid last).'
          : 'For each patient, pick the right primary payer. Same household, three different cascades.'}</span>
      </div>
      ${cascadePatients.map(p => renderPatientCascade(p)).join('')}
      ${state.transientFeedback && cascadePatients.some(p => p.options.some(o => o.id === state.transientFeedback!.id))
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('cascade') : ''}
    </section>
  `
}

function renderPatientCascade(p: PatientCascade): string {
  const ss = state.cascadeStates[p.id]
  const correct = ss.picked && p.options.find(o => o.id === ss.picked)?.correct
  return `
    <div class="cascade-card ${correct ? 'resolved' : ''}">
      <div class="cc-h">
        <strong>${escape(p.name)}</strong>
        <span class="cc-rel">${escape(p.relationship)}</span>
      </div>
      <div class="cc-context">${escape(p.age)}</div>
      <div class="cc-options">
        ${correct ? `
          <span class="cc-badge resolved">Primary: ${escape(p.correctPrimary)}</span>
          <button class="btn small ghost" data-action="reset-cascade" data-id="${p.id}">↺ undo</button>
        ` : p.options.map(o => `
          <button class="btn small ghost" data-action="pick-cascade" data-pid="${p.id}" data-oid="${o.id}">${escape(o.payer)}</button>
        `).join('')}
      </div>
    </div>
  `
}

function renderRefilePanel(): string {
  const unlocked = state.resolvedIssues.has('verify') && state.resolvedIssues.has('cascade')
  const done = state.resolvedIssues.has('refile')
  if (!unlocked) {
    return `
      <section class="refile-panel locked">
        <div class="rf-h"><span class="rf-tag idle">REFILE</span><span class="rf-sub">Locked.</span></div>
      </section>
    `
  }
  return `
    <section class="refile-panel ${done ? 'done' : 'active'}">
      <div class="rf-h">
        <span class="rf-tag ${done ? 'done' : 'active'}">REFILE · 5 paths</span>
        <span class="rf-sub">${done ? 'Three claims refiled per the right cascade.' : 'Pick the path that fixes today AND respects the cascade rules.'}</span>
      </div>
      <ul class="opt-list">
        ${resolutions.map(r => renderResolution(r)).join('')}
      </ul>
      ${state.transientFeedback && resolutions.some(r => r.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('refile') : ''}
    </section>
  `
}

function renderResolution(r: Resolution): string {
  const applied = state.appliedResolutionId === r.id
  return `
    <li class="opt ${applied ? 'applied' : ''}">
      <button class="opt-btn" data-action="apply-resolution" data-id="${r.id}" ${state.appliedResolutionId !== null && !applied ? 'disabled' : ''}>
        <span class="opt-label">${escape(r.label)}</span>
        ${applied ? '<span class="opt-badge">APPLIED</span>' : ''}
      </button>
    </li>
  `
}

function renderRecap(issueId: string): string {
  const issue = issues.find(i => i.id === issueId)
  if (!issue) return ''
  return `<div class="recap"><div class="recap-h">RECAP · ${issue.verb.toUpperCase()}</div><p>${escape(issue.recap)}</p></div>`
}

function renderChecklist(): string {
  const allDone = issues.every(i => state.resolvedIssues.has(i.id))
  return `
    <section class="checklist">
      <div class="checklist-h">COB RESOLUTION · 3 issues to resolve</div>
      <ul>${issues.map(i => `<li class="${state.resolvedIssues.has(i.id) ? 'done' : ''}"><span class="check">${state.resolvedIssues.has(i.id) ? '✓' : '○'}</span><div class="issue-body"><div class="issue-label">${escape(i.label)}</div></div></li>`).join('')}</ul>
      ${state.failedAttempts > 0 ? `<p class="fail-counter">Wrong picks so far: ${state.failedAttempts}.</p>` : ''}
      <button class="btn submit ${allDone ? '' : 'disabled'}" data-action="submit" ${allDone ? '' : 'disabled'}>Refile all three</button>
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

const RECAP: CaseRecap = CASE_RECAPS['cob-cascade-spider']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">CASCADE WALKED</div>
      <h2>Three claims refiled per the right primary per patient.</h2>
      <p>
        Aetna processed Mateo (birthday rule) + Sofia (MSP working-aged)
        primary. Medicare processed Jorge primary; Medicaid sweeping
        secondary as payer of last resort. Total recovered:
        ${money(FACILITY_BILL * 3)}. Secondaries queued; ${term('CO-22')}
        denials cleared.
      </p>
      <p class="muted">
        Same household, three patients, three different primaries.
        COB isn't one rule — it's a per-patient cascade through
        relationship + age + Medicare entitlement + employer size +
        court orders. Most rookie COB errors come from treating
        "same family policy" as "same primary."
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
            <li><strong>Three new verbs:</strong> VERIFY-ELIGIBILITY (COB rule statements), APPLY-CASCADE (per-patient primary pick), REFILE.</li>
            <li><strong>COB is a cascade, not a rule.</strong> Same household, three different cascades — relationship × age × Medicare entitlement × employer size × court orders.</li>
            <li><strong>MSP is a category, not an exception.</strong> Six MSP categories total; this Case touches working-aged. Future Cases could expand into ESRD-coordination, workers' comp, auto/no-fault.</li>
            <li><strong>Payer-of-last-resort trap.</strong> Filing Medicaid primary on a dual-eligible is one of the most common audit findings.</li>
          </ul>
        </div>
        <div>
          <h3>Sibling shape</h3>
          <ul>
            <li>Direct sibling to <a href="./hydra-prototype.html">Hydra</a> — Hydra introduced COB as a concept; this Case goes deeper into the rules.</li>
            <li>Cousin to <a href="./fog-prototype.html">Fog</a> (eligibility), <a href="./carveout-phantom-prototype.html">Carve-out Phantom</a> (network status as a related axis).</li>
            <li>Builds toward future MSP-specific Cases (ESRD coordination period, workers' comp / auto / no-fault, VA overlap).</li>
          </ul>
        </div>
      </div>
      <p class="notes-cta">See the <a href="./prototypes.html">Case Prototypes catalog</a> for the full set.</p>
    </section>
  `
}

function dismissBriefing() { state.briefingDone = true; state.briefingOpen = false }
function showBriefing() { state.briefingOpen = true }
function closeBriefing() { state.briefingOpen = false }
function openTerm(termId: string) { state.openTermId = termId }
function closeTerm() { state.openTermId = null }

function pickStmt(id: string, pick: boolean) {
  const s = cobStatements.find(x => x.id === id); if (!s) return
  state.transientFeedback = null
  if (s.truth === pick) {
    state.stmtStates[id].pick = pick
    state.transientFeedback = { id, message: s.reason, kind: 'good' }
    if (isVerifyDone()) state.resolvedIssues.add('verify')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: s.reason, kind: 'bad' }
  }
}

function resetStmt(id: string) {
  state.stmtStates[id].pick = null
  state.resolvedIssues.delete('verify')
  state.resolvedIssues.delete('cascade')
  state.resolvedIssues.delete('refile')
  state.transientFeedback = null
}

function pickCascade(pid: string, oid: string) {
  const p = cascadePatients.find(x => x.id === pid); if (!p) return
  const opt = p.options.find(o => o.id === oid); if (!opt) return
  state.transientFeedback = null
  if (opt.correct) {
    state.cascadeStates[pid].picked = oid
    state.transientFeedback = { id: oid, message: opt.feedback, kind: 'good' }
    if (isCascadeDone()) state.resolvedIssues.add('cascade')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id: oid, message: opt.feedback, kind: 'bad' }
  }
}

function resetCascade(pid: string) {
  state.cascadeStates[pid].picked = null
  state.resolvedIssues.delete('cascade')
  state.resolvedIssues.delete('refile')
  state.transientFeedback = null
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
    notifyParentVictory('cob-cascade-spider')
  }
}

function reset() {
  state.briefingDone = false; state.briefingOpen = false
  for (const id in state.stmtStates) state.stmtStates[id] = { pick: null }
  for (const id in state.cascadeStates) state.cascadeStates[id] = { picked: null }
  state.appliedResolutionId = null
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
    case 'pick-cascade': if (el.dataset.pid && el.dataset.oid) pickCascade(el.dataset.pid, el.dataset.oid); break
    case 'reset-cascade': if (el.dataset.id) resetCascade(el.dataset.id); break
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
  .verify-panel, .cascade-panel, .refile-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .verify-panel.done, .cascade-panel.done, .refile-panel.done { border-left-color: var(--good); }
  .cascade-panel.locked, .refile-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .vp-h, .cp-h, .rf-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .vp-tag, .cp-tag, .rf-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .cp-tag.idle, .rf-tag.idle { color: var(--ink-dim); }
  .vp-tag.done, .cp-tag.done, .rf-tag.done { color: var(--good); }
  .vp-sub, .cp-sub, .rf-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .stmt-list, .opt-list { list-style: none; padding-left: 0; margin: 0; }
  .stmt { display: flex; align-items: center; gap: 16px; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 6px; border-left: 3px solid transparent; }
  .stmt.correct { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .stmt-text { flex: 1; font-size: 13px; line-height: 1.5; }
  .stmt-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .stmt-badge { font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 3px; }
  .stmt-badge.true  { background: rgba(126, 226, 193, 0.15); color: var(--good); border: 1px solid #2c5547; }
  .stmt-badge.false { background: rgba(239, 91, 123, 0.10); color: var(--bad); border: 1px solid #4a2a32; }
  .btn.small { padding: 4px 10px; font-size: 11.5px; }

  .cascade-card { background: var(--panel-2); border-radius: 5px; padding: 12px 14px; margin-bottom: 10px; border-left: 3px solid transparent; }
  .cascade-card.resolved { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .cc-h { display: flex; align-items: baseline; gap: 12px; margin-bottom: 4px; flex-wrap: wrap; }
  .cc-h strong { font-size: 14px; }
  .cc-rel { font-size: 11.5px; color: var(--ink-dim); font-style: italic; }
  .cc-context { font-size: 12.5px; line-height: 1.55; color: var(--ink); margin-bottom: 8px; }
  .cc-options { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .cc-badge { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 3px; letter-spacing: 0.04em; background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; }

  .opt { margin-bottom: 6px; }
  .opt-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 11px 14px; text-align: left; font: inherit; transition: all 0.15s; position: relative; }
  .opt-btn:hover:not(:disabled) { background: #232b3a; border-color: var(--accent); }
  .opt-btn:disabled { opacity: 0.45; cursor: default; }
  .opt.applied .opt-btn { border-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); opacity: 1; }
  .opt-label { font-size: 13px; line-height: 1.5; display: block; padding-right: 80px; }
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
