// Wraith @ L11.
//
// Standalone single-encounter sketch demonstrating the action set:
// no HP, no tools-as-damage, no multiple choice. Player connects
// payer phrases ↔ chart facts ↔ LCD clauses to build a defense
// packet against a CO-50 medical-necessity denial.
//
// Designed for someone with no revenue-cycle background:
//   - Plain-English summary on every chart fact + LCD clause
//   - Glossary tooltips on technical terms (click to reveal)
//   - Dana's briefing before the encounter explains the actions
//   - Post-citation recap explains what argument the player made
//
// (An Expert mode that strips this scaffolding is a future toggle.)

import { CASES } from '../content/cases'
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

interface PayerPhrase {
  id: string
  text: string
  /** Plain-English version shown alongside the technical phrase. */
  plain: string
  issueId: string
}

interface ChartFact {
  id: string
  /** What the player reads first — plain-English summary. */
  plain: string
  /** The actual chart language, shown smaller below the plain text. */
  technical: string
  /** Which issue this fact addresses (null = distractor). */
  issueId: string | null
  distractorReason?: string
}

interface LcdClause {
  id: string
  /** What the player reads first — plain-English summary. */
  plain: string
  /** The actual policy language, shown smaller below the plain text. */
  technical: string
  issueId: string
}

interface Issue {
  id: string
  /** Plain-English label (this is what the player sees). */
  label: string
  /** Plain-English recap of what the player did when this resolves. */
  recap: string
  /**
   * How this issue gets resolved:
   *   'amend' — change a field on the claim directly (cheap fix)
   *   'cite'  — argue with chart fact + LCD clause (real appeal)
   */
  verb: 'amend' | 'cite'
}

interface DxOption {
  code: string
  label: string
  /**
   * Whether the chart actually supports this code:
   *   'current' — what's currently on the claim (don't pick this)
   *   'wrong'   — chart contradicts (e.g. systolic chart, diastolic code)
   *   'partial' — better than current, but not what chart best supports
   *   'correct' — best match given documented evidence
   */
  support: 'current' | 'wrong' | 'partial' | 'correct'
  /** Why this is right (or what's wrong with it). */
  feedback: string
}

interface GlossaryEntry {
  term: string
  plain: string
}

const issues: Issue[] = [
  {
    id: 'specificity',
    label: 'Replace the vague diagnosis on the claim with a specific one.',
    recap: "Fixed at the source. The chart documented systolic dysfunction all along; the original biller just used the unspecific code. Once the dx is right, the policy's specificity rule no longer applies. No argument needed.",
    verb: 'amend',
  },
  {
    id: 'criterion',
    label: "Use the policy's kidney-function alternative path.",
    recap: "You just argued: even without the heart-pumping measurement, the patient's poor kidney function (per the chart) qualifies them under an *alternative path* the policy itself spells out.",
    verb: 'cite',
  },
  {
    id: 'symptomatology',
    label: "Show the chart documents qualifying symptoms.",
    recap: "You just argued: the chart documents specific symptoms (fatigue, swelling, declining kidneys). The policy explicitly accepts documented symptoms in place of the heart-pumping measurement.",
    verb: 'cite',
  },
]

const dxOptions: DxOption[] = [
  {
    code: 'I50.9',
    label: 'Heart failure, unspecified',
    support: 'current',
    feedback: "This is what's already on the claim — the vague code that triggered the denial.",
  },
  {
    code: 'I50.20',
    label: 'Systolic heart failure, unspecified',
    support: 'partial',
    feedback: "Better than I50.9 — at least it's systolic. But the chart documents this as *chronic*, so we can be more specific.",
  },
  {
    code: 'I50.22',
    label: 'Chronic systolic (congestive) heart failure',
    support: 'correct',
    feedback: "Matches the chart: documented systolic dysfunction, long-standing. This is what the chart actually supports.",
  },
  {
    code: 'I50.30',
    label: 'Diastolic heart failure, unspecified',
    support: 'wrong',
    feedback: "The chart documents *systolic* dysfunction, not diastolic. This would be wrong — and arguably worse than the current code.",
  },
]

const payerPhrases: PayerPhrase[] = [
  {
    id: 'lvef',
    text: 'without supporting evidence of LVEF<35%',
    plain: 'No proof of how poorly the heart was pumping (LVEF is a measurement of heart function).',
    issueId: 'criterion',
  },
  {
    id: 'no-evidence',
    text: 'absent supporting documentation',
    plain: "The chart didn't include enough evidence of the patient's symptoms.",
    issueId: 'symptomatology',
  },
]

const chartFacts: ChartFact[] = [
  {
    id: 'creat',
    plain: "Kidney function is poor. (High creatinine reading from a few months ago.)",
    technical: 'Labs (3 mo prior): creatinine 2.8 mg/dL',
    issueId: 'criterion',
  },
  {
    id: 'sx',
    plain: "The patient has clear symptoms — tired, swelling, kidneys getting worse.",
    technical: 'Documented fatigue, edema, declining GFR',
    issueId: 'symptomatology',
  },
  {
    id: 'ckd',
    plain: "The patient has long-standing kidney disease (moderate stage).",
    technical: 'Patient has chronic kidney disease, stage 3',
    issueId: 'criterion',
  },
  {
    id: 'referrer',
    plain: "The doctor who ordered the test is in the insurance company's network.",
    technical: 'Referring provider is in-network',
    issueId: null,
    distractorReason: "Network status doesn't address whether the test was medically necessary.",
  },
]

const lcdClauses: LcdClause[] = [
  {
    id: 'creat-alt',
    plain: "Alternate path: poor kidney function plus documented symptoms also qualifies — even without the heart-pumping measurement.",
    technical: 'Alternative criterion: creatinine > 2.5 mg/dL with documented symptomatology.',
    issueId: 'criterion',
  },
  {
    id: 'sx-required',
    plain: "If the heart-pumping measurement isn't on file, documented symptoms can stand in.",
    technical: 'Documented symptomatology required for coverage when LVEF data not on file.',
    issueId: 'symptomatology',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'CO-50': {
    term: 'CO-50',
    plain: 'A "denial code" insurance companies use. CO-50 means: "we won\'t pay because we don\'t think this was medically necessary." It\'s one of the most common denials.',
  },
  'LCD': {
    term: 'LCD (Local Coverage Determination)',
    plain: 'A document the insurance company writes that says, in detail, the conditions under which they will and won\'t cover a particular service. Public; the player can read them.',
  },
  'LCD L33457': {
    term: 'LCD L33457 (Echocardiography)',
    plain: 'A real Medicare policy from Novitas (one of the contractors that processes Medicare claims). It defines when an echocardiogram counts as "medically necessary" and when it doesn\'t. Public; the full policy runs about 20+ pages. Real revenue-cycle analysts read these documents directly when fighting denials. The criteria you see in this encounter — LVEF thresholds, alternative kidney-function paths, documented-symptom requirements — are drawn from real LCD patterns.',
  },
  'CDI specialist': {
    term: 'CDI specialist',
    plain: 'A nurse or coder who reviews charts before claims drop, and writes "queries" to doctors asking for clarification. The most upstream defense against medical-necessity denials.',
  },
  'I50.9': {
    term: 'I50.9 (Heart failure, unspecified)',
    plain: 'A diagnosis code. The "unspecified" version of heart failure — meaning the chart didn\'t say what kind. Insurance companies often deny unspecified codes because they don\'t prove medical necessity.',
  },
  '93306': {
    term: 'CPT 93306',
    plain: 'The specific billing code for "echocardiogram, complete with Doppler" — the test Walker had.',
  },
  'CMS-1500': {
    term: 'CMS-1500',
    plain: 'The standard claim form doctors\' offices use to bill insurance. It has numbered boxes; the one we care about is Box 21 (diagnoses).',
  },
  'BCBS': {
    term: 'BCBS (Blue Cross Blue Shield)',
    plain: 'A large network of insurance companies. Walker\'s plan is BCBS of North Carolina.',
  },
}

// === Runtime state ===

interface SelectionState {
  payerId: string | null
  chartId: string | null
  lcdId: string | null
}

const state = {
  briefingDone: false,
  briefingOpen: false,
  amendOpen: false,
  /** Current dx code on the claim (changes when player amends). */
  currentDxCode: 'I50.9',
  /** Feedback message attached to a specific dx code in the amend modal. */
  amendFeedback: null as { code: string; message: string } | null,
  selection: { payerId: null, chartId: null, lcdId: null } as SelectionState,
  resolvedIssues: new Set<string>(),
  citationCount: 0,
  failedAttempts: 0,
  feedback: '' as string,
  feedbackKind: 'neutral' as 'neutral' | 'good' | 'bad',
  lastRecap: '' as string,
  packetSubmitted: false,
  openTermId: null as string | null,
}

// === Rendering ===

const wraithCase = CASES.case_wraith_walker

/** Wrap a phrase in a glossary tooltip span. */
function term(termId: string, displayText?: string): string {
  const entry = glossary[termId]
  const text = displayText ?? termId
  if (!entry) return escape(text)
  return `<span class="term" data-action="open-term" data-term="${termId}" title="${escape(entry.plain)}">${escape(text)}<span class="term-icon">?</span></span>`
}

function render(): string {
  if (state.packetSubmitted) {
    return renderVictory() + renderTermPopover() + renderBriefingPopover() + renderAmendModal()
  }
  return `
    ${renderHeader()}
    ${renderHospitalIntro()}
    ${!state.briefingDone ? renderBriefingInline() : `
      ${renderClaim()}
      ${renderWorkbench()}
      ${renderCitationBuilder()}
      ${renderChecklist()}
      ${renderWraith()}
    `}
    ${state.briefingDone ? '' : renderDesignNotes()}
    ${renderTermPopover()}
    ${renderBriefingPopover()}
    ${renderAmendModal()}
  `
}

function renderHeader(): string {
  const recallBtn = state.briefingDone
    ? `<button class="recall-btn" data-action="show-briefing">📜 Dana's note</button>`
    : ''
  return `
    <header class="page-h">
      <div class="title-row">
        <h1>Wraith <span class="muted">@ L11</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./">← back to game</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          A redesign sketch of the Medical Necessity Wraith
          encounter (${term('CO-50')}). Drops HP, tools-as-damage,
          and multiple choice. First answer to "what does a battle
          look like in this game." See the
          <a href="#design-notes">design notes</a> for what's
          intentional vs placeholder.
        </p>
      `}
    </header>
  `
}

function renderHospitalIntro(): string {
  return `
    <section class="hospital-intro">
      <div class="register hospital">HOSPITAL · earlier today</div>
      <p>
        Mrs. Walker's daughter called this morning. Her mother's
        echocardiogram (a heart ultrasound) came back denied —
        ${term('CO-50')}, "not medically necessary." She's 67 and
        her cardiologist is worried.
      </p>
      <p>
        The ${term('CDI specialist')}, Martinez, is on vacation.
        The case is on your desk.
      </p>
      <p>
        You walk to the CDI workroom to read the chart. You pull
        the file, sit down, open it &mdash;
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the floor ripples. The fluorescent above flickers
        once. You're somewhere else.</em>
      </div>
      <div class="register waiting-room">WAITING ROOM · now</div>
    </section>
  `
}

function briefingContent(): string {
  return `
    <div class="briefing-h">
      <span class="briefing-tag">DANA, IN YOUR EAR</span>
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'First time, so listen up.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "Walker's claim got denied. Insurance said it wasn't
        medically necessary. Your job is to <strong>argue
        back</strong> — make the case that they should pay
        anyway."
      </p>
      <p>"There are three places you can argue from:"</p>
      <ul>
        <li>
          <strong>The denial letter.</strong> What the insurance
          company specifically said when they refused.
        </li>
        <li>
          <strong>The patient's chart.</strong> What the doctor
          actually wrote — symptoms, lab results, history.
        </li>
        <li>
          <strong>The insurance company's own policy</strong>
          (called an ${term('LCD')}). Their public rules for
          when they cover this kind of test.
        </li>
      </ul>
      <p>
        "Two ways to address an issue, and you need to know
        which to reach for:"
      </p>
      <ul>
        <li>
          Sometimes the issue
          is just that the wrong code was billed. The chart
          supports something more specific; you change it.
          Click directly on a disputed box on the claim form
          (Box 21 is the diagnosis) to amend it. <em>This is
          the cheap fix.</em> Always try it first.
        </li>
        <li>
          When there's
          nothing simple to fix — when the policy has an
          alternative path, or when the chart's evidence
          supports a real argument — connect a chart fact
          and a policy clause to the payer's specific
          assertion. That's an <strong>appeal</strong>."
        </li>
      </ul>
      <p>
        "Some chart facts won't help any single issue. The
        tools will tell you why. There's no penalty for
        trying."
      </p>
      <p>
        "Click any underlined term for a plain-English
        explanation. There's a lot of jargon in this work; I
        got tired of pretending it's intuitive."
      </p>
      <p class="briefing-sign">"Chart fact + policy clause + payer line. Three pieces, one issue. — D."</p>
    </div>
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
  const claim = wraithCase.claim
  if (!claim || claim.type !== 'cms1500') return ''
  const amended = state.currentDxCode !== 'I50.9'
  const currentDx = dxOptions.find(d => d.code === state.currentDxCode)
  const dxDisplay = amended && currentDx
    ? `${escape(currentDx.code)} — ${escape(currentDx.label)}`
    : `${escape(claim.diagnoses[0].code)}${claim.diagnoses[0].label ? ' — ' + escape(claim.diagnoses[0].label) : ''}`
  const specificityResolved = state.resolvedIssues.has('specificity')
  return `
    <div class="claim-with-annotations">
      <section class="claim">
        <div class="claim-h">
          ${term('CMS-1500')} · ${escape(claim.claimId)}
          <span class="claim-explainer">(this is the bill the doctor's office sent to insurance)</span>
        </div>
        <div class="claim-grid">
          <div><b>Patient:</b> ${escape(claim.patient.name)} · ${escape(claim.patient.dob)}</div>
          <div><b>Insurer:</b> ${term('BCBS', claim.insured.name ?? '')} · ${escape(claim.insured.id)}</div>
        </div>
        <div class="claim-section dx-section">
          <div class="claim-section-h">
            Box 21 · Diagnoses
            ${specificityResolved
              ? '<span class="claim-status amended">AMENDED</span>'
              : '<span class="claim-status disputed">DISPUTED</span>'}
          </div>
          <ul class="dx">
            <li class="${specificityResolved ? 'amended' : 'hi'}">
              <b>A.</b> ${specificityResolved ? escape(dxDisplay) : term('I50.9', dxDisplay)}
              ${specificityResolved ? '' : '<span class="dx-arrow" aria-hidden="true">⟶</span>'}
            </li>
          </ul>
        </div>
        <div class="claim-section">
          <div class="claim-section-h">Box 24 · Service Lines</div>
          <table class="lines">
            <thead><tr><th>DOS</th><th>POS</th><th>CPT</th><th>Charges</th></tr></thead>
            <tbody>
              ${claim.serviceLines.map(sl => `
                <tr class="hi">
                  <td>${escape(sl.dos)}</td>
                  <td>${escape(sl.pos)}</td>
                  <td>${term('93306', sl.cpt.code + (sl.cpt.label ? ' — ' + sl.cpt.label : ''))}</td>
                  <td>${escape(sl.charges)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
      ${specificityResolved ? '' : `
        <aside class="claim-annotations">
          <button class="amend-callout" data-action="open-amend">
            <span class="amend-callout-arrow" aria-hidden="true">⟵</span>
            <span class="amend-callout-body">
              <span class="amend-callout-main">✎ Fix this diagnosis</span>
              <span class="amend-callout-sub">The diagnosis on the claim is too vague. Click to amend Box 21.</span>
            </span>
          </button>
        </aside>
      `}
    </div>
  `
}

function renderAmendModal(): string {
  if (!state.amendOpen) return ''
  return `
    <div class="amend-modal-backdrop">
      <div class="amend-modal">
        <button class="amend-modal-close" data-action="close-amend" aria-label="Close">×</button>
        <div class="amend-modal-h">
          <span class="amend-tag">AMEND BOX 21 · DIAGNOSIS</span>
          <span class="amend-sub">Pick the code the chart actually supports.</span>
        </div>
        <div class="amend-context">
          <strong>The chart says:</strong> documented systolic dysfunction, long-standing CKD, fatigue + edema.
        </div>
        <ul class="amend-options">
          ${dxOptions.map(opt => {
            const fb = state.amendFeedback?.code === opt.code ? state.amendFeedback : null
            return `
              <li class="amend-option ${opt.support === 'current' ? 'current' : ''} ${fb ? 'rejected' : ''}"
                  ${opt.support === 'current' ? '' : `data-action="pick-dx" data-code="${opt.code}"`}>
                <div class="amend-option-h">
                  <code>${escape(opt.code)}</code>
                  <span class="amend-option-label">${escape(opt.label)}</span>
                  ${opt.support === 'current' ? '<span class="amend-option-badge current">currently on claim</span>' : ''}
                </div>
                ${fb ? `<div class="amend-option-fb">${escape(fb.message)}</div>` : ''}
              </li>
            `
          }).join('')}
        </ul>
        <p class="amend-hint-text">
          Picking a code that doesn't fit gives you feedback (and no penalty).
          The chart is the source of truth.
        </p>
      </div>
    </div>
  `
}

function renderWorkbench(): string {
  // Payer phrases embedded into actual prose — phrases by id so the
  // sentence reads coherently while keeping each phrase clickable.
  const phraseById = (id: string) => {
    const p = payerPhrases.find(pp => pp.id === id)
    return p ? phraseSpan(p) : ''
  }
  return `
    <section class="workbench">
      <div class="col col-payer">
        <div class="col-h">
          <span class="col-tag">PAYER NOTE</span>
          <span class="col-sub">The insurance company's denial letter. Hover a red phrase to see what it means; click to select it.</span>
        </div>
        <p class="col-prose">
          The insurance company denied this claim. They flagged
          the diagnosis on file (I50.9, "heart failure,
          unspecified") as too vague — fix that on the claim form
          above. On top of that: there's no proof of
          ${phraseById('lvef')}, and the chart is
          ${phraseById('no-evidence')} of why this test was
          needed. They cited ${term('LCD L33457')}.
        </p>
      </div>
      <div class="col col-chart">
        <div class="col-h">
          <span class="col-tag">CHART (Walker, A.)</span>
          <span class="col-sub">What the doctor wrote about this patient. Click a fact to cite it.</span>
        </div>
        <ul class="facts">
          ${chartFacts.map(f => `
            <li class="fact ${state.selection.chartId === f.id ? 'selected' : ''}"
                data-action="select-chart" data-id="${f.id}">
              <div class="fact-plain">${escape(f.plain)}</div>
              <div class="fact-technical"><span class="src">from chart:</span> ${escape(f.technical)}</div>
            </li>
          `).join('')}
        </ul>
      </div>
      <div class="col col-lcd">
        <div class="col-h">
          <span class="col-tag">${term('LCD L33457')}</span>
          <span class="col-sub">Excerpts from the insurance company's coverage policy. Click a clause to back a citation.</span>
        </div>
        <ul class="clauses">
          ${lcdClauses.map(c => `
            <li class="clause ${state.selection.lcdId === c.id ? 'selected' : ''}"
                data-action="select-lcd" data-id="${c.id}">
              <div class="clause-plain">${escape(c.plain)}</div>
              <div class="clause-technical"><span class="src">policy reads:</span> ${escape(c.technical)}</div>
            </li>
          `).join('')}
        </ul>
      </div>
    </section>
  `
}

function phraseSpan(p: PayerPhrase): string {
  const sel = state.selection.payerId === p.id ? 'selected' : ''
  const resolved = state.resolvedIssues.has(p.issueId) ? 'resolved' : ''
  return `<span class="phrase ${sel} ${resolved}" data-action="select-payer" data-id="${p.id}">${escape(p.text)}<span class="hover-tip phrase-tip">${escape(p.plain)}</span></span>`
}

function renderCitationBuilder(): string {
  const sel = state.selection
  const payer = sel.payerId ? payerPhrases.find(p => p.id === sel.payerId) : null
  const chart = sel.chartId ? chartFacts.find(f => f.id === sel.chartId) : null
  const lcd = sel.lcdId ? lcdClauses.find(c => c.id === sel.lcdId) : null
  const ready = !!(sel.payerId && sel.chartId && sel.lcdId)
  const fbClass = state.feedback ? `fb-${state.feedbackKind}` : ''
  return `
    <section class="builder">
      <div class="builder-h">Citation builder</div>
      <div class="builder-row">
        <div class="slot ${payer ? 'filled' : ''}">
          <div class="slot-label">PAYER ASSERTS</div>
          <div class="slot-text">${payer ? '"' + escape(payer.text) + '"' : '<span class="placeholder">Click a payer phrase</span>'}</div>
        </div>
        <div class="connector">cited by</div>
        <div class="slot ${chart ? 'filled' : ''}">
          <div class="slot-label">CHART FACT</div>
          <div class="slot-text">${chart ? escape(chart.plain) : '<span class="placeholder">Click a chart fact</span>'}</div>
        </div>
        <div class="connector">per</div>
        <div class="slot ${lcd ? 'filled' : ''}">
          <div class="slot-label">LCD CLAUSE</div>
          <div class="slot-text">${lcd ? escape(lcd.plain) : '<span class="placeholder">Click an LCD clause</span>'}</div>
        </div>
      </div>
      <div class="builder-actions">
        <button class="btn primary ${ready ? '' : 'disabled'}" ${ready ? '' : 'disabled'} data-action="cite">CITE</button>
        <button class="btn ghost" data-action="clear">Clear</button>
      </div>
      ${state.feedback ? `<div class="feedback ${fbClass}">${escape(state.feedback)}</div>` : ''}
      ${state.lastRecap ? `
        <div class="recap">
          <div class="recap-h">What you just argued</div>
          <p>${escape(state.lastRecap)}</p>
        </div>
      ` : ''}
    </section>
  `
}

function renderChecklist(): string {
  const allResolved = state.resolvedIssues.size === issues.length
  return `
    <section class="checklist">
      <div class="checklist-h">Defense packet — ${state.resolvedIssues.size} of ${issues.length} issues addressed</div>
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
      <button class="btn submit ${allResolved ? '' : 'disabled'}"
              ${allResolved ? '' : 'disabled'}
              data-action="submit">
        SUBMIT DEFENSE PACKET
      </button>
      ${state.failedAttempts > 0 ? `<div class="fail-counter">Tried citations that didn't fit: ${state.failedAttempts}. (No penalty — it's how you learn.)</div>` : ''}
    </section>
  `
}

function renderWraith(): string {
  const total = issues.length
  const resolved = state.resolvedIssues.size
  const ratio = resolved / total
  const opacity = 0.25 + ratio * 0.6
  const blur = 6 - ratio * 5
  return `
    <aside class="wraith">
      <div class="wraith-svg" style="opacity: ${opacity.toFixed(2)}; filter: blur(${blur.toFixed(1)}px);">
        ${wraithSvg()}
      </div>
      <div class="wraith-line">
        ${ratio === 0 ? '<em>The Wraith. She is not done yet, and neither are you.</em>' : ''}
        ${ratio > 0 && ratio < 1 ? '<em>She watches as the packet builds. Her edges are easier to read now.</em>' : ''}
        ${ratio === 1 ? '<em>She is fully here. Whatever you do next, she will accept it as final.</em>' : ''}
      </div>
    </aside>
  `
}

function wraithSvg(): string {
  return `
    <svg viewBox="0 0 120 180" xmlns="http://www.w3.org/2000/svg" aria-label="Medical Necessity Wraith">
      <defs>
        <linearGradient id="paper" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#f5f1e6" stop-opacity="0.9"/>
          <stop offset="100%" stop-color="#a8967a" stop-opacity="0.4"/>
        </linearGradient>
      </defs>
      <ellipse cx="60" cy="35" rx="22" ry="28" fill="url(#paper)"/>
      <rect x="35" y="60" width="50" height="80" fill="url(#paper)" rx="6"/>
      <line x1="38" y1="72" x2="80" y2="72" stroke="#5a4d2b" stroke-width="0.8" opacity="0.5"/>
      <line x1="38" y1="80" x2="76" y2="80" stroke="#5a4d2b" stroke-width="0.8" opacity="0.5"/>
      <line x1="38" y1="88" x2="80" y2="88" stroke="#5a4d2b" stroke-width="0.8" opacity="0.5"/>
      <line x1="38" y1="96" x2="72" y2="96" stroke="#5a4d2b" stroke-width="0.8" opacity="0.5"/>
      <line x1="38" y1="104" x2="80" y2="104" stroke="#5a4d2b" stroke-width="0.8" opacity="0.5"/>
      <ellipse cx="50" cy="38" rx="3" ry="4" fill="#1a1a1a" opacity="0.6"/>
      <ellipse cx="70" cy="38" rx="3" ry="4" fill="#1a1a1a" opacity="0.6"/>
      <path d="M 50 50 Q 60 53 70 50" fill="none" stroke="#1a1a1a" stroke-width="0.8" opacity="0.5"/>
      <line x1="20" y1="80" x2="35" y2="100" stroke="#a8967a" stroke-width="2" opacity="0.4"/>
      <line x1="100" y1="80" x2="85" y2="100" stroke="#a8967a" stroke-width="2" opacity="0.4"/>
    </svg>
  `
}

const RECAP: CaseRecap = CASE_RECAPS['wraith']

function renderVictory(): string {
  return `
    ${renderHeader()}
    <section class="victory">
      <h2>The packet submits.</h2>
      <p class="register hospital">Hospital, the next morning.</p>
      <p>
        Walker's appeal is approved. The TTE is covered. Her
        daughter calls back to say thank you. You don't tell her
        about the room you fell into.
      </p>
      <p class="register waiting-room">Waiting Room.</p>
      <p>
        The Wraith is not where she was. The chair where she sat is
        empty. There are still <em>so many</em> chairs.
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
      <h2>Design notes — what's intentional vs placeholder</h2>
      <div class="notes-grid">
        <div>
          <h3>Intentional</h3>
          <ul>
            <li><b>No HP.</b> Wraith doesn't take damage; she becomes more <em>readable</em> as the packet builds.</li>
            <li><b>No tools-as-buttons.</b> The player <em>selects a payer phrase / chart fact / LCD clause</em>, then <em>cites</em>, then <em>submits</em>.</li>
            <li><b>No multiple choice.</b> Connections are drawn freely from real text.</li>
            <li><b>Distractors give feedback, not damage.</b> Pick a chart fact that doesn't fit and the builder explains why.</li>
            <li><b>Designed for someone with no revenue-cycle background.</b> Plain-English summaries on every fact, glossary tooltips on every code, Dana's briefing up front, recaps after each citation. (An "Expert mode" toggle to strip this scaffolding is a future improvement.)</li>
            <li><b>Real case data.</b> Imported from <code>src/content/cases.ts</code> — Walker, the dx, the LCD reference.</li>
            <li><b>Heavy → light register flip.</b> Hospital intro carries patient weight; Waiting Room is the catharsis.</li>
            <li><b>The dreamlike fall.</b> Hospital intro ends with "the floor ripples"; the Waiting Room begins immediately.</li>
          </ul>
        </div>
        <div>
          <h3>Placeholder / first-draft</h3>
          <ul>
            <li><b>Three issues, three citations.</b> Number is arbitrary; could be 2 or 4.</li>
            <li><b>No time pressure.</b> Filing window not modeled. Open question.</li>
            <li><b>Form-bridge buff not wired.</b> Pre-fixing the dx in FormScene would auto-resolve issue 1.</li>
            <li><b>Wraith art is a sketch.</b> Real version would be evocative.</li>
            <li><b>No surreal humor in Wraith's voice.</b> She doesn't speak yet; real version probably does.</li>
            <li><b>No shortcut paths.</b> Player can't fabricate or upcode (with audit-risk cost) per existing shadow-tool econ.</li>
            <li><b>Submit is final.</b> Player can't walk away and come back. Open question.</li>
            <li><b>Glossary is short.</b> Only covers terms in this encounter. Real version probably builds across the run.</li>
          </ul>
        </div>
      </div>
      <p class="notes-cta">
        Open <code>src/wraith-prototype/main.ts</code> to see the
        encounter data and interaction logic. The full design
        process lives at <a href="./reference/puzzles/wraith-redesign.md">reference/puzzles/wraith-redesign.md</a>.
      </p>
    </section>
  `
}

// === Interactions ===

function findFact(id: string) { return chartFacts.find(f => f.id === id) }
function findPayer(id: string) { return payerPhrases.find(p => p.id === id) }
function findLcd(id: string) { return lcdClauses.find(c => c.id === id) }

function setFeedback(text: string, kind: 'good' | 'bad' | 'neutral' = 'neutral') {
  state.feedback = text
  state.feedbackKind = kind
}

function clearSelection() {
  state.selection = { payerId: null, chartId: null, lcdId: null }
}

function attemptCite() {
  const sel = state.selection
  if (!sel.payerId || !sel.chartId || !sel.lcdId) return

  const payer = findPayer(sel.payerId)!
  const chart = findFact(sel.chartId)!
  const lcd = findLcd(sel.lcdId)!

  if (chart.issueId === null) {
    state.failedAttempts += 1
    setFeedback(
      `That fact doesn't follow. ${chart.distractorReason ?? ''} Try another.`,
      'bad'
    )
    state.lastRecap = ''
    return
  }

  if (payer.issueId === chart.issueId && chart.issueId === lcd.issueId) {
    const issue = issues.find(i => i.id === chart.issueId)!

    // If this issue is solved by amending the claim, citing it is the
    // wrong tool — redirect the player to the amend path.
    if (issue.verb === 'amend') {
      state.failedAttempts += 1
      setFeedback(
        "These pieces all line up — but this one doesn't need an argument. The chart supports a more specific code; just *amend* the dx on the claim. Click Box 21 in the form above.",
        'bad'
      )
      state.lastRecap = ''
      return
    }

    if (state.resolvedIssues.has(chart.issueId)) {
      setFeedback(
        'Already cited. Try a different issue — there are still gaps in the packet.',
        'neutral'
      )
      state.lastRecap = ''
      return
    }
    state.resolvedIssues.add(chart.issueId)
    state.citationCount += 1
    setFeedback(
      `Citation accepted. Issue addressed: ${issue.label}`,
      'good'
    )
    state.lastRecap = issue.recap
    clearSelection()
    return
  }

  state.failedAttempts += 1
  setFeedback(buildMismatchFeedback(payer, chart, lcd), 'bad')
  state.lastRecap = ''
}

/**
 * Pedagogical mismatch feedback — names which issue each picked
 * piece actually addresses so the player learns the structure.
 * Doesn't give away which fact maps to which issue in the
 * abstract; just decodes what they picked.
 */
function buildMismatchFeedback(
  payer: PayerPhrase,
  chart: ChartFact,
  lcd: LcdClause,
): string {
  const lines: string[] = []
  lines.push("Those three don't fit together yet. Here's where each one points:")
  lines.push('')
  lines.push(`• Payer phrase: addresses "${issueDescription(payer.issueId)}".`)
  if (chart.issueId === null) {
    lines.push(`• Chart fact: distractor — true but not relevant. ${chart.distractorReason ?? ''}`)
  } else {
    const issue = issues.find(i => i.id === chart.issueId)!
    if (issue.verb === 'amend') {
      lines.push(`• Chart fact: this fact is the evidence for *amending the diagnosis*, not for a citation. Use the "Fix this diagnosis" button on the claim above.`)
    } else {
      lines.push(`• Chart fact: addresses "${issueDescription(chart.issueId)}".`)
    }
  }
  const lcdIssue = issues.find(i => i.id === lcd.issueId)!
  if (lcdIssue.verb === 'amend') {
    lines.push(`• Policy clause: this clause is about *amending the diagnosis*, not a citation argument.`)
  } else {
    lines.push(`• Policy clause: addresses "${issueDescription(lcd.issueId)}".`)
  }
  lines.push('')
  lines.push('A citation works when all three address the same issue. Pick a payer complaint, then find the chart fact and policy clause that both answer it.')
  return lines.join('\n')
}

function issueDescription(issueId: string): string {
  const issue = issues.find(i => i.id === issueId)
  if (!issue) return '(unknown)'
  return issue.label
}

function attemptAmend(code: string) {
  const opt = dxOptions.find(d => d.code === code)
  if (!opt) return

  if (opt.support === 'wrong' || opt.support === 'partial') {
    state.failedAttempts += 1
    state.amendFeedback = { code: opt.code, message: opt.feedback }
    return
  }

  // 'correct' — apply the amendment
  state.currentDxCode = opt.code
  state.amendOpen = false
  state.amendFeedback = null
  if (!state.resolvedIssues.has('specificity')) {
    state.resolvedIssues.add('specificity')
    const issue = issues.find(i => i.id === 'specificity')!
    setFeedback(
      `Claim amended. Box 21 now reads ${opt.code} (${opt.label}). Issue addressed.`,
      'good'
    )
    state.lastRecap = issue.recap
  }
}

function openAmend() {
  state.amendOpen = true
  state.amendFeedback = null
}

function closeAmend() {
  state.amendOpen = false
  state.amendFeedback = null
}

function attemptSubmit() {
  if (state.resolvedIssues.size < issues.length) return
  state.packetSubmitted = true
  notifyParentVictory('wraith')
}

function reset() {
  state.selection = { payerId: null, chartId: null, lcdId: null }
  state.resolvedIssues = new Set()
  state.citationCount = 0
  state.failedAttempts = 0
  state.feedback = ''
  state.feedbackKind = 'neutral'
  state.lastRecap = ''
  state.packetSubmitted = false
  state.briefingDone = false
  state.amendOpen = false
  state.currentDxCode = 'I50.9'
}

function dismissBriefing() {
  state.briefingDone = true
  state.briefingOpen = false
}

function showBriefing() {
  state.briefingOpen = true
}

function closeBriefing() {
  state.briefingOpen = false
}

function openTerm(termId: string) {
  state.openTermId = termId
}

function closeTerm() {
  state.openTermId = null
}

function handleClick(e: MouseEvent) {
  const target = e.target as HTMLElement

  // Backdrop-as-close: only fires when the click is *directly* on the
  // backdrop element, not when it bubbled up from a descendant. This
  // is why we don't put data-action on the backdrop — we'd close on
  // every click inside the popover.
  if (target.classList.contains('briefing-popover-backdrop')) {
    closeBriefing()
    rerender()
    return
  }
  if (target.classList.contains('term-popover-backdrop')) {
    closeTerm()
    rerender()
    return
  }
  if (target.classList.contains('amend-modal-backdrop')) {
    closeAmend()
    rerender()
    return
  }

  const el = target.closest('[data-action]') as HTMLElement | null
  if (!el) return
  const action = el.dataset.action
  const id = el.dataset.id

  switch (action) {
    case 'select-payer':
      state.selection.payerId = id ?? null
      setFeedback('')
      break
    case 'select-chart':
      state.selection.chartId = id ?? null
      setFeedback('')
      break
    case 'select-lcd':
      state.selection.lcdId = id ?? null
      setFeedback('')
      break
    case 'cite':
      attemptCite()
      break
    case 'clear':
      clearSelection()
      setFeedback('')
      state.lastRecap = ''
      break
    case 'submit':
      attemptSubmit()
      break
    case 'reset':
      reset()
      break
    case 'dismiss-briefing':
      dismissBriefing()
      break
    case 'show-briefing':
      showBriefing()
      break
    case 'close-briefing':
      closeBriefing()
      break
    case 'open-amend':
      openAmend()
      break
    case 'close-amend':
      closeAmend()
      break
    case 'pick-dx':
      if (el.dataset.code) attemptAmend(el.dataset.code)
      break
    case 'open-term':
      if (el.dataset.term) openTerm(el.dataset.term)
      break
    case 'close-term':
      closeTerm()
      break
    default:
      return
  }

  rerender()
}

// === Mount ===

// Wraith-specific CSS only — base styles (page chrome, register
// flip, briefing, term popover, claim form, amend modal, buttons,
// feedback, recap, checklist, design-notes, victory) come from
// `BASE_CSS` in src/shared/prototype-base.ts.
const css = districtVars('coding') + BASE_CSS + `
  /* Three-column workbench: payer phrases / chart facts / LCD clauses. */
  .workbench { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 22px; }
  @media (max-width: 980px) { .workbench { grid-template-columns: 1fr; } }
  .col { background: var(--panel); border: 1px solid #232a36; border-radius: 8px; padding: 14px 16px; }
  .col-h { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
  .col-tag { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
  .col-payer .col-tag { color: var(--bad); }
  .col-chart .col-tag { color: var(--accent); }
  .col-lcd .col-tag { color: #a3c5ff; }
  .col-sub { font-size: 11.5px; color: var(--ink-dim); }
  .col-prose { font-size: 13.5px; line-height: 1.7; margin: 0; }

  /* Payer phrases inline in prose — clickable, with hover tooltip. */
  .phrase {
    cursor: pointer;
    background: rgba(239, 91, 123, 0.15);
    border-bottom: 1px dashed var(--bad);
    padding: 2px 5px; border-radius: 3px;
    transition: background 0.15s, transform 0.1s;
    position: relative; display: inline;
  }
  .phrase:hover { background: rgba(239, 91, 123, 0.32); }
  .phrase.selected {
    background: rgba(239, 91, 123, 0.5);
    border-bottom-style: solid; color: #fff;
    box-shadow: inset 0 0 0 1px var(--bad);
  }
  .phrase.resolved {
    text-decoration: line-through;
    text-decoration-color: rgba(126, 226, 193, 0.7);
    text-decoration-thickness: 2px;
    color: rgba(216, 222, 233, 0.55);
    background: rgba(126, 226, 193, 0.08);
    border-bottom: 1px solid rgba(126, 226, 193, 0.4);
    opacity: 0.85;
  }
  .phrase.resolved:hover { background: rgba(126, 226, 193, 0.14); }
  .phrase.resolved.selected {
    /* Selected wins visually if both apply — but resolved suppresses the
       bright red look since the issue's already addressed. */
    background: rgba(126, 226, 193, 0.18);
    color: rgba(216, 222, 233, 0.7);
    box-shadow: inset 0 0 0 1px rgba(126, 226, 193, 0.5);
  }

  /* Hover tooltip pattern — chart facts, LCD clauses, payer phrases. */
  .hover-tip {
    position: absolute; bottom: calc(100% + 8px); left: 0;
    z-index: 50; min-width: 200px; max-width: 320px;
    padding: 10px 14px;
    background: var(--panel); color: var(--ink);
    border: 1px solid var(--accent); border-radius: 6px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
    font-size: 12.5px; line-height: 1.5;
    font-style: italic; font-weight: 400;
    text-transform: none; letter-spacing: normal; white-space: normal;
    pointer-events: none;
    opacity: 0; transform: translateY(6px);
    transition: opacity 0.18s, transform 0.18s;
  }
  .hover-tip::after {
    content: ""; position: absolute; top: 100%; left: 18px;
    border: 7px solid transparent; border-top-color: var(--accent);
  }
  .fact:hover .hover-tip,
  .clause:hover .hover-tip,
  .phrase:hover .hover-tip { opacity: 1; transform: translateY(0); }
  .phrase-tip {
    border-color: var(--bad); color: var(--ink);
    font-weight: 400; font-style: normal;
  }
  .phrase-tip::after { border-top-color: var(--bad); }

  /* Chart fact / LCD clause cards. */
  .facts, .clauses { list-style: none; padding-left: 0; margin: 0; }
  .fact, .clause {
    padding: 10px 12px; margin: 6px 0;
    background: var(--panel-2); border-radius: 5px;
    border-left: 3px solid transparent;
    cursor: pointer; transition: all 0.15s;
    position: relative;
  }
  .fact:hover, .clause:hover { background: #232b3a; }
  .fact.selected { border-left-color: var(--accent); background: rgba(126, 226, 193, 0.1); }
  .clause.selected { border-left-color: #a3c5ff; background: rgba(163, 197, 255, 0.08); }
  .fact-text, .clause-text { font-size: 13px; }
  .fact-plain, .clause-plain { font-size: 13.5px; color: var(--ink); line-height: 1.45; }
  .fact-technical, .clause-technical {
    font-size: 11px; color: rgba(138, 147, 163, 0.65);
    margin-top: 6px; padding-top: 5px;
    border-top: 1px dashed rgba(138, 147, 163, 0.15);
    line-height: 1.4;
    font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  }
  .fact-technical .src, .clause-technical .src {
    color: rgba(138, 147, 163, 0.45);
    text-transform: uppercase; letter-spacing: 0.06em;
    font-size: 10px; margin-right: 4px;
    font-family: inherit;
  }

  /* Citation builder — three-slot drag/click pattern. */
  .builder { background: var(--panel); border: 1px solid #232a36; border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .builder-h { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-dim); margin-bottom: 10px; }
  .builder-row { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 10px; align-items: stretch; }
  @media (max-width: 980px) { .builder-row { grid-template-columns: 1fr; } .connector { text-align: center; padding: 4px 0; } }
  .slot { padding: 10px 12px; background: var(--panel-2); border: 1px dashed #2a3142; border-radius: 5px; min-height: 60px; }
  .slot.filled { border-style: solid; border-color: #3a4658; }
  .slot-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-dim); margin-bottom: 4px; }
  .slot-text { font-size: 13px; }
  .placeholder { color: var(--ink-dim); font-style: italic; }
  .connector { color: var(--ink-dim); font-size: 12px; align-self: center; padding: 0 6px; font-style: italic; }
  .builder-actions { margin-top: 12px; display: flex; gap: 10px; }

  /* Floating wraith ghost SVG (bottom-right corner). */
  .wraith { position: fixed; bottom: 28px; right: 28px; width: 140px; z-index: 5; text-align: center; pointer-events: none; }
  .wraith-svg { transition: opacity 0.6s, filter 0.6s; }
  .wraith-svg svg { width: 100%; height: auto; }
  .wraith-line { margin-top: 8px; font-size: 11.5px; color: var(--ink-dim); line-height: 1.4; }
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
      if (state.amendOpen) { closeAmend(); changed = true }
      if (changed) rerender()
    }
  })
}

mount()
