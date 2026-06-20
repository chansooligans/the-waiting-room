// Outpatient Surgery Grouper @ L7 — UHC's Outpatient Procedure
// Grouper (OPG) Exhibit assigns CPT/HCPCS codes to grouper levels.
// Each level has a fixed reimbursement amount (similar in spirit to
// Medicare APCs, but UHC-specific). Critical detail: the grouper
// only fires when the claim carries an accepted revenue code.
// Wrong rev code → grouper bypassed → default fee schedule → quiet
// underpayment that looks like a CO-45 contractual write-off but
// is actually a routing failure.
//
// Reference: https://www.uhcprovider.com/en/resource-library/news/2025/outpatient-procedure-codes-for-reimbursement.html
//
// The 7/1/25 OPG Exhibit update changed only 0.08% of codes (all
// upward). Anyone chasing "the grouper changed" as the cause of an
// underpayment is almost always wrong; the variance lives elsewhere.
// Most often it's a chargemaster hard-coding mismatch — the right
// CPT but the wrong rev code, dropped from a CDM line written
// before OPG-aware billing was a thing.
//
// Action set:
//   - 4 statements about how OPG works + the 7/1/25 update.
//     Mark each true/false.
//   - 5 candidate causes of the underpayment. Only one
//     explains the variance.
//   - 5 resolution paths. Refile + chargemaster fix is right;
//     everything else is downstream-only or wrong direction.
//
// Sibling to Chemo Bundle Specter (#200) — same upstream-fix muscle
// applied to a different UHC mechanism.
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

// ===== Domain types =====

interface GrouperStatement {
  id: string
  text: string
  truth: boolean
  reason: string
}

interface VarianceCause {
  id: string
  label: string
  detail: string
  isCause: boolean
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
  verb: 'verify' | 'diagnose' | 'correct'
}

interface GlossaryEntry { term: string; plain: string }

// ===== Encounter data =====

const PATIENT = 'Renee Cordero'
const PROCEDURE = 'Outpatient colonoscopy with biopsy (CPT 45380)'
const FACILITY = 'OP Surg Group at Mercy'
const PAYER = 'UnitedHealthcare PPO'
const DOS = '2026-04-15'
const CPT = '45380'
const GROUPER_LEVEL = 4
const GROUPER_RATE = 1_400
const DEFAULT_FEE = 620
const VARIANCE = GROUPER_RATE - DEFAULT_FEE // 780
const WRONG_REV = '0750' // Gastrointestinal Services (non-surgical)
const RIGHT_REV = '0490' // Ambulatory Surgery Services

const grouperStatements: GrouperStatement[] = [
  {
    id: 'g1',
    text: `Per UHC's 7/1/25 OPG Exhibit, CPT ${CPT} is in Grouper Level ${GROUPER_LEVEL} with $${GROUPER_RATE.toLocaleString()} reimbursement.`,
    truth: true,
    reason: `Verified against the 7/1/25 OPG Exhibit. CPT ${CPT} → Level ${GROUPER_LEVEL} → $${GROUPER_RATE.toLocaleString()}. The hospital's expected was right; the actual paid was $${DEFAULT_FEE.toLocaleString()}. The variance is the puzzle.`,
  },
  {
    id: 'g2',
    text: `The 7/1/25 OPG update changed CPT ${CPT}'s grouper level — that's the cause of the underpayment.`,
    truth: false,
    reason: `False. UHC's 7/1/25 update changed only 0.08% of codes, all upward. CPT ${CPT}'s grouper level didn't move. "The grouper changed" is the most common wrong guess on OPG variance — almost never true. The cause lives elsewhere.`,
  },
  {
    id: 'g3',
    text: `OPG application requires the claim to carry an accepted revenue code in addition to the CPT.`,
    truth: true,
    reason: `True. UHC's adjudicator routes the claim through the OPG only when CPT + accepted rev code combo is present. For outpatient surgical procedures, ${term('rev codes', 'Rev ' + RIGHT_REV)} (Ambulatory Surgery Services) is standard. If a non-accepted rev code drops, the claim bypasses the grouper entirely.`,
  },
  {
    id: 'g4',
    text: `If the grouper doesn't fire, UHC pays at the contract's default fee schedule.`,
    truth: true,
    reason: `True. Default fee schedule is the fallback when the OPG doesn't apply. For ${CPT} the default is $${DEFAULT_FEE.toLocaleString()} — the grouper rate would have been more than 2× that. The variance hides as a CO-45 contractual write-off; same Specter trap as the others.`,
  },
]

const varianceCauses: VarianceCause[] = [
  {
    id: 'grouper-changed',
    label: '7/1/25 OPG update changed the grouper level',
    detail: `UHC moved CPT ${CPT} to a lower grouper tier in the most recent exhibit update.`,
    isCause: false,
    feedback: `Wrong. 7/1/25 update changed 0.08% of codes (all upward). ${CPT}'s level didn't change. "Grouper changed" is the most common wrong guess; UHC's exhibits are stable across releases.`,
  },
  {
    id: 'wrong-rev',
    label: `Wrong revenue code on the claim (Rev ${WRONG_REV} instead of Rev ${RIGHT_REV})`,
    detail: `The chargemaster dropped CPT ${CPT} with Rev ${WRONG_REV} (Gastrointestinal Services — non-surgical). UHC's adjudicator didn't route the claim through the OPG; it ran default fee schedule.`,
    isCause: true,
    feedback: `Right. Rev ${WRONG_REV} routes to GI services rate engine, not the OPG. CPT ${CPT} on Rev ${WRONG_REV} adjudicates at $${DEFAULT_FEE.toLocaleString()} default; CPT ${CPT} on Rev ${RIGHT_REV} would have run through OPG Level ${GROUPER_LEVEL} at $${GROUPER_RATE.toLocaleString()}. The bug is upstream in the chargemaster's CDM-to-rev-code mapping.`,
  },
  {
    id: 'multi-procedure',
    label: 'Multi-procedure reduction',
    detail: 'A second CPT on the claim triggered a 50% reduction on the secondary procedure.',
    isCause: false,
    feedback: `Wrong. The claim has only one CPT (${CPT}). Multi-procedure reduction can't apply to a single-procedure encounter. This decoy fits when there are 2+ surgical CPTs on the same DOS; here there isn't.`,
  },
  {
    id: 'ncci-bundle',
    label: 'NCCI procedure-pair bundling edit (CO-97)',
    detail: 'CPT 45380 was bundled into another procedure on the encounter.',
    isCause: false,
    feedback: `Wrong. NCCI bundling shows up as CO-97, not CO-45 / default-fee adjudication. The claim adjudicated to a *paid* amount (just lower than expected) — that's not how NCCI looks. Different mechanism, different CARC, different fix.`,
  },
  {
    id: 'stale-table',
    label: `Hospital's internal expected-rate table is stale`,
    detail: `Mercy's contract-rate table was generated against the 1/1/25 OPG and hasn't been refreshed.`,
    isCause: false,
    feedback: `Tempting but wrong. The 7/1/25 update barely moved any rates (0.08%); the hospital's January-vintage table is fine for ${CPT}. The variance isn't the table being stale — it's the rev-code mismatch keeping the grouper from firing in the first place.`,
  },
]

const resolutions: Resolution[] = [
  {
    id: 'fix-cdm',
    label: `Refile with Rev ${RIGHT_REV}, AND update the chargemaster: re-map the CDM line for CPT ${CPT} (and the other GI surgical procedures sharing this CDM section) to Rev ${RIGHT_REV}. Re-run charge-capture on affected accounts from the last 90 days.`,
    correct: true,
    feedback: `Right move. Refile is the immediate fix; the chargemaster update is the systemic one. CPT ${CPT} isn't the only outpatient surgical procedure miscoded under Rev ${WRONG_REV} — the audit will surface 30-50 similar accounts across GI / endo / urology / ortho. Fix once at the source; don't refile each one in isolation.`,
  },
  {
    id: 'appeal-grouper',
    label: `File an appeal disputing the OPG level assignment for CPT ${CPT}`,
    correct: false,
    feedback: `Wrong target. CPT ${CPT} *is* in the right grouper level — UHC's exhibit is correct, the hospital's expected was correct. The variance is on the rev-code side, not the grouper side. Appealing the grouper level earns a denial-of-the-appeal letter and burns 30 days.`,
  },
  {
    id: 'reconsider-original',
    label: `File reconsideration with the original Rev ${WRONG_REV}, asking UHC to apply OPG retroactively`,
    correct: false,
    feedback: `Half-right (reconsideration is a real path) but the wrong substance. UHC's adjudicator ran the contract correctly given Rev ${WRONG_REV}; asking them to apply the grouper without the right rev code is asking them to override their own routing logic. Refile with corrected Rev ${RIGHT_REV} on a frequency-7 corrected claim — that gives them the right inputs.`,
  },
  {
    id: 'bill-patient',
    label: 'Bill Renee for the variance',
    correct: false,
    feedback: `The variance is $${VARIANCE} between hospital expected and UHC paid; it's a payer-provider rate dispute, not patient cost-share. Renee's exposure was already adjudicated at her in-network amount. Billing her would be a violation of the in-network protections; aside from that, it's just wrong.`,
  },
  {
    id: 'recoup',
    label: `Recoup the $${DEFAULT_FEE.toLocaleString()} payment to UHC and rebill the entire claim`,
    correct: false,
    feedback: `Don't recoup what they correctly paid given the inputs they had. Refile a corrected claim (frequency 7, replacement of original) referencing the original ICN; UHC's system reverses the original adjudication and re-runs against the corrected rev code. Net payment moves from $${DEFAULT_FEE.toLocaleString()} to $${GROUPER_RATE.toLocaleString()}.`,
  },
]

const issues: Issue[] = [
  {
    id: 'verify',
    label: `Verify-grouper: confirm CPT ${CPT}'s level on UHC's 7/1/25 OPG Exhibit.`,
    recap: `Walked the OPG mechanics. CPT ${CPT} is in Level ${GROUPER_LEVEL} ($${GROUPER_RATE.toLocaleString()} reimbursement); didn't change in the 7/1/25 update; OPG only fires with an accepted rev code; default fee schedule is the fallback.`,
    verb: 'verify',
  },
  {
    id: 'diagnose',
    label: 'Diagnose-variance: identify why the OPG didn\'t fire on this claim.',
    recap: `Wrong revenue code. Rev ${WRONG_REV} (GI Services) on the claim instead of Rev ${RIGHT_REV} (Ambulatory Surgery). UHC routed to default fee schedule; OPG never ran. Other candidates (grouper changed, multi-procedure, NCCI bundle, stale table) all wrong for different reasons.`,
    verb: 'diagnose',
  },
  {
    id: 'correct',
    label: 'Correct: refile + update the chargemaster\'s CDM-to-rev-code mapping.',
    recap: `Frequency-7 corrected claim with Rev ${RIGHT_REV}; chargemaster update on the GI surgical CDM section so the next 30-50 claims don't re-create the same bug. Same upstream-fix muscle as Chemo Bundle Specter — refile is downstream; the CDM is where the cure lives.`,
    verb: 'correct',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'OPG': {
    term: 'OPG (Outpatient Procedure Grouper)',
    plain: "UHC's reimbursement mechanism for outpatient procedures. Maps CPT/HCPCS codes to grouper levels (similar to Medicare APCs); each level has a fixed reimbursement amount. Updated periodically — the 7/1/25 update changed 0.08% of codes (all upward). Source: uhcprovider.com / 'Outpatient procedure codes for reimbursement.' Tied to the contract; only applies on UHC-contracted plans.",
  },
  'OPG Exhibit': {
    term: 'OPG Exhibit',
    plain: "The published table mapping CPT/HCPCS codes to grouper levels. Hospitals reconcile their internal expected-rate table against this exhibit. CMS doesn't maintain it — it's UHC's proprietary list, available to providers via uhcprovider.com.",
  },
  'grouper level': {
    term: 'Grouper level',
    plain: "A reimbursement tier in UHC's OPG. Each level pays a fixed dollar amount; CPT codes are assigned to levels based on clinical complexity + UHC's actuarial weighting. Concept maps onto Medicare's APC tiers but with UHC-specific level numbering and rates.",
  },
  'rev codes': {
    term: 'Revenue code routing',
    plain: "Payers route claims through different rate engines based on revenue code. For UHC outpatient surgical procedures, Rev 0490 (Ambulatory Surgery Services) is the standard accepted rev code that triggers OPG application. Rev 0750 (Gastrointestinal Services) routes to GI services rate engine, which doesn't apply OPG. CDM hard-coding has to drop the right rev code or the grouper never fires. CAVEAT: real UHC routing is more complex than 'right rev code → grouper fires.' Some rev codes still trigger OPG with reduced grouping (partial fire); some routes deny outright (CO-95 wrong-claim-type) instead of falling back to default fee schedule. The full rev-code-to-engine map is in the contract appendix; the binary 'fires or doesn't' framing in this Case is a simplification.",
  },
  'CDM': {
    term: 'CDM (Chargemaster)',
    plain: "Hospital master price list and code-mapping table. For hard-coded services, the CDM auto-assigns CPT/HCPCS + revenue code + gross charge at the moment a charge drops. Cross-reference: Chemo Bundle Specter (PR #200) — same chargemaster mechanism, different downstream failure mode.",
  },
  'CO-45': {
    term: 'CO-45 (charge exceeds fee schedule)',
    plain: "Most common CARC on commercial 835s. \"We paid the contracted amount; the rest is a contractual write-off.\" When the contracted amount missed an applicable grouper because the wrong rev code routed the claim, CO-45 quietly absorbs the variance. Same Specter trap as the original Specter prototype.",
  },
  'frequency 7': {
    term: 'Frequency-7 corrected claim',
    plain: "Claim Frequency Type Code 7 (in CLM05-3) = 'replacement of prior claim.' Used when the original was adjudicated but had wrong info (here: wrong rev code). The corrected claim references the original ICN; the payer's system reverses the original adjudication and re-runs against the new inputs. Different from a fresh claim (frequency 1) and from an appeal (different track entirely).",
  },
  'OPG vs APC': {
    term: 'OPG vs APC (Ambulatory Payment Classification)',
    plain: "APC is Medicare's outpatient grouper — same idea (CPT-to-tier mapping with fixed reimbursement) under the OPPS (Outpatient Prospective Payment System). Commercial payers like UHC built their own equivalents (OPG); rates and tier counts differ from APC. Hospitals usually maintain separate expected-rate tables per payer because the groupers don't align.",
  },
}

// ===== Runtime state =====

interface StmtState { pick: boolean | null }

const state = {
  briefingDone: false,
  briefingOpen: false,
  stmtStates: grouperStatements.reduce((m, s) => { m[s.id] = { pick: null }; return m }, {} as Record<string, StmtState>),
  appliedCauseId: null as string | null,
  appliedResolutionId: null as string | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isVerifyDone(): boolean {
  return grouperStatements.every(s => state.stmtStates[s.id].pick === s.truth)
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
      ${renderClaimSummary()}
      ${renderVerifyPanel()}
      ${renderDiagnosePanel()}
      ${renderCorrectPanel()}
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
        <h1>Outpatient Surgery Grouper <span class="muted">@ L7 — first sketch (UHC OPG / wrong rev code)</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./prototypes.html">← back to catalog</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          ${escape(PATIENT)}'s outpatient colonoscopy at the OP Surg
          Group came back paid ${money(DEFAULT_FEE)} — but Mercy's
          expected against UHC's ${term('OPG')} Level ${GROUPER_LEVEL}
          rate was ${money(GROUPER_RATE)}. Variance ${money(VARIANCE)}.
          Looks like a CO-45 contractual write-off. Isn't —
          UHC's grouper didn't fire because the chargemaster dropped
          the wrong ${term('rev codes', 'revenue code')}. Same
          chargemaster-fix muscle as
          <a href="./chemo-bundle-specter-prototype.html">Chemo Bundle Specter</a>,
          different UHC mechanism. See the
          <a href="#design-notes">design notes</a>.
        </p>
      `}
    </header>
  `
}

function renderHospitalIntro(): string {
  return `
    <section class="hospital-intro">
      <div class="register hospital">HOSPITAL · OP Surg Group billing</div>
      <p>
        Bola walks ${escape(PATIENT)}'s account over. Outpatient
        colonoscopy with biopsy, ${escape(DOS)}, CPT ${CPT}. UHC paid
        ${money(DEFAULT_FEE)}. Mercy's expected: ${money(GROUPER_RATE)}.
        "${escape("Variance")} report flagged it. ${money(VARIANCE)} short. AR
        thinks UHC underpaid; I think the ${term('OPG')} didn't even
        fire. Walk it."
      </p>
      <p>
        ${term('OPG')} Level ${GROUPER_LEVEL} → ${money(GROUPER_RATE)}.
        Default fee schedule → ${money(DEFAULT_FEE)}. The gap is the
        difference between the grouper running and not. The grouper
        only runs when the right ${term('rev codes', 'revenue code')}
        is on the claim.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The OPG Exhibit slides
        a half-pixel left, then settles. The chargemaster's
        CDM-to-rev-code mapping drifts down beside it. Two layers,
        one bug.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'OPG variance. Bug is upstream — same shape as Chemo Bundle Specter, different UHC mechanism.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "${term('OPG')} variance. UHC's grouper assigns CPTs to
        levels with fixed reimbursement; Mercy's expected was right;
        the paid amount looks like a CO-45 write-off but it's actually
        the grouper *not firing* because the wrong
        ${term('rev codes', 'rev code')} dropped from the chargemaster."
      </p>
      <p>"Three issues:"</p>
      <ul>
        <li>
          Four statements about how OPG works. Watch the
          'grouper changed' decoy — UHC's 7/1/25 update barely
          moved anything, but rookies blame it for everything.
        </li>
        <li>
          Five candidate causes. Decoys are real-sounding
          (grouper update, multi-procedure reduction, NCCI
          bundling, stale table) but only the rev-code mismatch
          fits this claim.
        </li>
        <li>
          Five paths. Refile + chargemaster fix is right. Decoys:
          appeal the grouper (wrong target), reconsider with
          original rev code (wrong substance), bill the patient
          (wrong direction), recoup (don't — UHC paid correctly
          given the inputs).
        </li>
      </ul>
      <p>
        "Reference if you need it: UHC publishes the OPG Exhibit
        on uhcprovider.com — search 'outpatient procedure codes
        for reimbursement.' The 7/1/25 update is the latest."
      </p>
      <p class="briefing-sign">"Status indicators do the bundling. — D."</p>
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
        <span class="cs-tag">CLAIM · ${escape(PAYER)} · ICN 2026-04-22-559</span>
        <span class="cs-sub">${escape(FACILITY)}. ${escape(PROCEDURE)} on ${escape(DOS)}.</span>
      </div>
      <table class="cs-table">
        <tr><th>Patient</th><td>${escape(PATIENT)}</td></tr>
        <tr><th>CPT</th><td><code>${CPT}</code> · Colonoscopy with biopsy</td></tr>
        <tr><th>Revenue code on claim</th><td><strong class="bad-text"><code>${WRONG_REV}</code> (Gastrointestinal Services)</strong> ← the bug</td></tr>
        <tr><th>${term('OPG')} expected (Level ${GROUPER_LEVEL})</th><td>${money(GROUPER_RATE)}</td></tr>
        <tr><th>UHC paid (default fee schedule)</th><td>${money(DEFAULT_FEE)} <span class="cs-mini">${term('CO-45')} adjusted</span></td></tr>
        <tr><th>Variance</th><td><strong class="bad-text">${money(VARIANCE)}</strong></td></tr>
      </table>
    </section>
  `
}

function renderVerifyPanel(): string {
  const done = state.resolvedIssues.has('verify')
  return `
    <section class="verify-panel ${done ? 'done' : ''}">
      <div class="vp-h">
        <span class="vp-tag">UHC OPG · 4 statements</span>
        <span class="vp-sub">${done
          ? `CPT ${CPT} → Level ${GROUPER_LEVEL} → ${money(GROUPER_RATE)}; level didn't change in 7/1/25; rev code is required; default applies if grouper bypassed.`
          : 'Mark each true/false. Watch the "grouper changed" decoy.'}</span>
      </div>
      <ul class="stmt-list">
        ${grouperStatements.map(s => renderStmt(s)).join('')}
      </ul>
      ${state.transientFeedback && grouperStatements.some(s => s.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('verify') : ''}
    </section>
  `
}

function renderStmt(s: GrouperStatement): string {
  const ss = state.stmtStates[s.id]
  const decided = ss.pick !== null
  const correct = decided && ss.pick === s.truth
  return `
    <li class="stmt ${decided && correct ? 'correct' : ''}">
      <div class="stmt-text">${s.text}</div>
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

function renderDiagnosePanel(): string {
  const unlocked = state.resolvedIssues.has('verify')
  const done = state.resolvedIssues.has('diagnose')
  if (!unlocked) {
    return `
      <section class="diagnose-panel locked">
        <div class="dp-h">
          <span class="dp-tag idle">DIAGNOSE VARIANCE</span>
          <span class="dp-sub">Locked until OPG mechanics are verified.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="diagnose-panel ${done ? 'done' : 'active'}">
      <div class="dp-h">
        <span class="dp-tag ${done ? 'done' : 'active'}">DIAGNOSE VARIANCE · 5 candidates</span>
        <span class="dp-sub">${done
          ? `Wrong revenue code (Rev ${WRONG_REV} instead of Rev ${RIGHT_REV}). Grouper never fired.`
          : 'Pick the cause. Decoys are real-sounding but only one fits this claim.'}</span>
      </div>
      <ul class="cause-list">
        ${varianceCauses.map(c => renderCauseRow(c)).join('')}
      </ul>
      ${state.transientFeedback && varianceCauses.some(c => c.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('diagnose') : ''}
    </section>
  `
}

function renderCauseRow(c: VarianceCause): string {
  const applied = state.appliedCauseId === c.id
  const locked = state.appliedCauseId !== null && !applied
  return `
    <li class="cause ${applied ? 'applied' : ''}">
      <button class="cause-btn" data-action="apply-cause" data-id="${c.id}" ${locked ? 'disabled' : ''}>
        <span class="cause-label">${escape(c.label)}</span>
        <span class="cause-detail">${escape(c.detail)}</span>
        ${applied ? '<span class="cause-badge applied">APPLIED</span>' : ''}
      </button>
    </li>
  `
}

function renderCorrectPanel(): string {
  const unlocked = state.resolvedIssues.has('verify') && state.resolvedIssues.has('diagnose')
  const done = state.resolvedIssues.has('correct')
  if (!unlocked) {
    return `
      <section class="correct-panel locked">
        <div class="cp-h">
          <span class="cp-tag idle">CORRECT</span>
          <span class="cp-sub">Locked until verify + diagnose are done.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="correct-panel ${done ? 'done' : 'active'}">
      <div class="cp-h">
        <span class="cp-tag ${done ? 'done' : 'active'}">CORRECT · 5 paths</span>
        <span class="cp-sub">${done
          ? `Refile with Rev ${RIGHT_REV}; update CDM mapping for the GI surgical section; audit affected accounts.`
          : `Pick the upstream fix. Refile alone leaves the next 30-50 claims to recreate the bug.`}</span>
      </div>
      <ul class="res-list">
        ${resolutions.map(r => renderResolutionRow(r)).join('')}
      </ul>
      ${state.transientFeedback && resolutions.some(r => r.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('correct') : ''}
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
      <div class="checklist-h">OPG VARIANCE · 3 issues to resolve</div>
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
        Refile (Rev ${RIGHT_REV}) + update chargemaster
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

const RECAP: CaseRecap = CASE_RECAPS['outpatient-surgery-grouper']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">CLAIM REFILED · CHARGEMASTER UPDATED</div>
      <h2>${money(VARIANCE)} recovered. OPG fires on the next 30-50 claims.</h2>
      <p>
        Frequency-7 corrected claim filed with Rev ${RIGHT_REV}; UHC's
        adjudicator reverses the original and runs through ${term('OPG')}
        Level ${GROUPER_LEVEL} this time. Net payment moves from
        ${money(DEFAULT_FEE)} to ${money(GROUPER_RATE)}; recoupment posts
        on the next 835. The CDM line for CPT ${CPT} (and the other
        GI surgical CDM section entries) is re-mapped to Rev ${RIGHT_REV};
        the next outpatient surgery on this CDM section drops the right
        rev code from day one.
      </p>
      <p class="muted">
        Chargemaster bugs scale. Fixing one claim recovers ${money(VARIANCE)};
        fixing the CDM section recovers everything similar going forward.
        Same upstream-fix muscle as
        <a href="./chemo-bundle-specter-prototype.html">Chemo Bundle Specter</a>;
        different UHC mechanism (OPG vs case-rate-with-bundled-drug).
      </p>
      <div class="register hospital">HOSPITAL · later that morning</div>
      <p>
        Bola pulls 90 days of variance reports for the GI surgical
        section. "Twenty-eight more like Renee. Same Rev ${WRONG_REV}
        misfire, same OPG bypass, same ${money(VARIANCE)}-ish gap.
        Refile each, watch the recoupments roll in."
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
            <li><strong>Three new actions:</strong> verifying the
            grouper (read OPG mechanics), diagnosing the variance (five plausible
            decoys; only rev-code mismatch fits), and correcting (refile +
            chargemaster fix).</li>
            <li><strong>Routing as the lever.</strong> Same as
            Chemo Bundle Specter — payer's adjudication system did
            its job correctly given the inputs; the bug is what the
            chargemaster sent.</li>
            <li><strong>"The grouper changed" is almost never the
            answer.</strong> UHC's 7/1/25 update changed 0.08% of
            codes; rookies blame grouper updates for variance that
            actually lives in the rev-code mapping.</li>
            <li><strong>Refile is downstream; CDM is upstream.</strong>
            Fixing one claim recovers one claim's worth of variance;
            fixing the CDM section recovers all similar claims going
            forward.</li>
          </ul>
        </div>
        <div>
          <h3>Reference</h3>
          <p style="font-size: 13px; line-height: 1.55; color: var(--ink-dim);">
            Source: UnitedHealthcare provider news, "Outpatient procedure
            codes for reimbursement" (Aug 2025). The OPG Exhibit lives at
            <code>uhcprovider.com/en/resource-library/news/2025/outpatient-procedure-codes-for-reimbursement.html</code>.
            UHC publishes updated exhibits twice a year; the 7/1/25
            update is the most recent. Hospitals should reconcile their
            internal expected-rate tables against UHC's exhibit at each
            release, but most variance lives in the rev-code mapping,
            not the grouper levels.
          </p>
          <h3>Sibling shape</h3>
          <ul>
            <li>Direct sibling to
            <a href="./chemo-bundle-specter-prototype.html">Chemo Bundle Specter</a> —
            same chargemaster-fix muscle, different UHC mechanism
            (OPG bypass vs chemo bundling).</li>
            <li>Cousin to
            <a href="./case-rate-specter-prototype.html">Case Rate Specter</a> —
            same Specter family (CO-45 hides the variance);
            different UHC contract clause.</li>
            <li>Cousin to
            <a href="./mrf-cartographer-prototype.html">MRF Cartographer</a> —
            both involve chargemaster mappings; that one is about
            what to publish, this one is about what to bill.</li>
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

function pickStmt(id: string, pick: boolean) {
  const s = grouperStatements.find(x => x.id === id); if (!s) return
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
  state.resolvedIssues.delete('diagnose')
  state.resolvedIssues.delete('correct')
  state.transientFeedback = null
}

function applyCause(id: string) {
  const c = varianceCauses.find(x => x.id === id); if (!c) return
  state.transientFeedback = null
  if (c.isCause) {
    state.appliedCauseId = id
    state.resolvedIssues.add('diagnose')
    state.transientFeedback = { id, message: c.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: c.feedback, kind: 'bad' }
  }
}

function applyResolution(id: string) {
  const r = resolutions.find(x => x.id === id); if (!r) return
  state.transientFeedback = null
  if (r.correct) {
    state.appliedResolutionId = id
    state.resolvedIssues.add('correct')
    state.transientFeedback = { id, message: r.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: r.feedback, kind: 'bad' }
  }
}

function attemptSubmit() {
  if (issues.every(i => state.resolvedIssues.has(i.id))) {
    state.packetSubmitted = true
    notifyParentVictory('outpatient-surgery-grouper')
  }
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  for (const id in state.stmtStates) state.stmtStates[id] = { pick: null }
  state.appliedCauseId = null
  state.appliedResolutionId = null
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
    case 'pick-stmt': if (el.dataset.id && el.dataset.pick) pickStmt(el.dataset.id, el.dataset.pick === 'true'); break
    case 'reset-stmt': if (el.dataset.id) resetStmt(el.dataset.id); break
    case 'apply-cause': if (el.dataset.id) applyCause(el.dataset.id); break
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

const css = districtVars('billing') + BASE_CSS + `
  .claim-summary { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .cs-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .cs-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .cs-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .cs-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .cs-table th, .cs-table td { text-align: left; padding: 6px 10px; border-bottom: 1px dashed #232a36; vertical-align: top; }
  .cs-table th { font-size: 11px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; width: 240px; }
  .cs-mini { font-size: 11px; color: var(--ink-dim); margin-left: 8px; }
  .bad-text { color: var(--bad); }

  .verify-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent-2); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .verify-panel.done { border-left-color: var(--good); }
  .vp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .vp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent-2); }
  .vp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .stmt-list { list-style: none; padding-left: 0; margin: 0; }
  .stmt { display: flex; align-items: center; gap: 16px; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 6px; border-left: 3px solid transparent; }
  .stmt.correct { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .stmt-text { flex: 1; font-size: 13px; line-height: 1.5; }
  .stmt-text code { background: var(--bg); padding: 1px 6px; border-radius: 3px; font-size: 11.5px; }
  .stmt-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .stmt-badge { font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; }
  .stmt-badge.true  { background: rgba(126, 226, 193, 0.15); color: var(--good); border: 1px solid #2c5547; }
  .stmt-badge.false { background: rgba(239, 91, 123, 0.10); color: var(--bad); border: 1px solid #4a2a32; }
  .btn.small { padding: 4px 10px; font-size: 11.5px; }

  /* Diagnose panel — distinctive lavender to flag "this is upstream-routing analysis" */
  .diagnose-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid #c8b6e0; border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .diagnose-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .diagnose-panel.done   { border-left-color: var(--good); }
  .dp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .dp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #c8b6e0; }
  .dp-tag.idle { color: var(--ink-dim); }
  .dp-tag.done { color: var(--good); }
  .dp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .cause-list { list-style: none; padding-left: 0; margin: 0; }
  .cause { margin-bottom: 6px; }
  .cause-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 12px 14px; text-align: left; font: inherit; transition: all 0.15s; position: relative; display: flex; flex-direction: column; gap: 6px; }
  .cause-btn:hover:not(:disabled) { background: #232b3a; border-color: #c8b6e0; }
  .cause-btn:disabled { opacity: 0.45; cursor: default; }
  .cause.applied .cause-btn { border-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); opacity: 1; }
  .cause-label { font-size: 13px; font-weight: 600; padding-right: 80px; }
  .cause-detail { font-size: 12px; color: var(--ink-dim); line-height: 1.55; }
  .cause-badge.applied { position: absolute; top: 10px; right: 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; font-weight: 700; }

  .correct-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent-2); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .correct-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .correct-panel.done   { border-left-color: var(--good); }
  .cp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .cp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent-2); }
  .cp-tag.idle { color: var(--ink-dim); }
  .cp-tag.done { color: var(--good); }
  .cp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .res-list { list-style: none; padding-left: 0; margin: 0; }
  .res-opt { margin-bottom: 6px; }
  .res-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 11px 14px; text-align: left; font: inherit; transition: all 0.15s; position: relative; }
  .res-btn:hover:not(:disabled) { background: #232b3a; border-color: var(--accent-2); }
  .res-btn:disabled { opacity: 0.45; cursor: default; }
  .res-opt.applied .res-btn { border-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); opacity: 1; }
  .res-label { font-size: 13px; line-height: 1.5; display: block; padding-right: 80px; }
  .res-badge.applied { position: absolute; top: 10px; right: 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; font-weight: 700; }

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
