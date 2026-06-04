// Risk Adjustment Hollow @ L5 — incomplete HCC capture for a
// value-based contract. The chart documents diabetes with
// neuropathy, CKD stage 3, and morbid obesity. The encoder
// captured E11.9 (diabetes unspecified) and stopped. The Medicare
// Advantage contract is risk-adjusted; under-coded HCCs leave
// money — and accurate risk pictures — on the table.
//
// Verbs:
//   - REVIEW: read 4 chart snippets; mark each "supports specific
//     code" or "ambiguous → CDI query."
//   - ENRICH: pick the right ICD-10 / HCC code per documented item.
//   - QUERY: draft the right CDI query for ambiguous documentation.
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

interface ChartSnippet {
  id: string
  source: string
  text: string
  supportsCode: boolean
  reason: string
}

interface CodeOption {
  id: string
  code: string
  label: string
  /** RAF (risk adjustment factor) value for this HCC mapping. Approximate; for game color only. */
  raf: number
  /** True iff this is the right code for the snippet it pairs with. */
  correct: boolean
  feedback: string
  /** Which snippet this code pairs with. */
  snippetId: string
}

interface QueryOption {
  id: string
  label: string
  text: string
  correct: boolean
  feedback: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'review' | 'enrich' | 'query'
}

interface GlossaryEntry { term: string; plain: string }

// ===== Encounter data =====

const PATIENT = 'Frank Delaney'
const CONTRACT = 'Medicare Advantage (Anthem MA)'

const snippets: ChartSnippet[] = [
  {
    id: 'snip-dm',
    source: 'Endocrinology consult, 2026-04-08',
    text: '"Type 2 diabetes mellitus, longstanding (15+ years). Neuropathy in bilateral lower extremities — diminished sensation to monofilament; gabapentin titrated. A1c 8.2."',
    supportsCode: true,
    reason: 'Specific condition documented (diabetes with neuropathy). Direct ICD-10 mapping to E11.42 (T2DM with diabetic polyneuropathy). HCC 18 (diabetes with chronic complications) applies.',
  },
  {
    id: 'snip-ckd',
    source: 'Nephrology note, 2026-04-08',
    text: '"CKD stage 3a per most recent eGFR (54 ml/min/1.73m²). No acute change. Continue ACE inhibitor."',
    supportsCode: true,
    reason: 'Specific staging documented (CKD stage 3a). Direct ICD-10 mapping to N18.31. HCC 138 (CKD moderate) applies.',
  },
  {
    id: 'snip-obesity',
    source: 'Primary care H&P, 2026-04-08',
    text: '"Patient is obese, BMI 41.2. Counseled on weight loss. Notably has mobility difficulty."',
    supportsCode: false,
    reason: 'Ambiguous. BMI 41.2 is morbid-obesity territory but the chart says "obese" not "morbidly obese." Direct coding from BMI alone is not sufficient under most Medicare-MA risk-adjustment compliance frameworks — needs the provider\'s clinical statement of "morbid obesity" or the Z code combo. Send a CDI query.',
  },
  {
    id: 'snip-hf',
    source: 'Echocardiogram report, 2026-04-08',
    text: '"LV ejection fraction 35%. Wall motion abnormalities consistent with prior MI."',
    supportsCode: false,
    reason: 'Ambiguous. EF 35% suggests systolic heart failure, but the report doesn\'t state the clinical diagnosis. Risk-adjustment coding requires a provider-documented diagnosis (HF with reduced EF), not just imaging findings. Query the cardiologist for an explicit dx.',
  },
]

const codeOptions: CodeOption[] = [
  // For the diabetes snippet
  {
    id: 'dm-1',
    code: 'E11.9',
    label: 'Type 2 diabetes mellitus, without complications',
    raf: 0.105,
    correct: false,
    feedback: 'This is what the encoder captured — and exactly the under-code. Chart documents neuropathy; the right code is E11.42 (with diabetic polyneuropathy), which carries a much higher RAF.',
    snippetId: 'snip-dm',
  },
  {
    id: 'dm-2',
    code: 'E11.42',
    label: 'Type 2 diabetes mellitus with diabetic polyneuropathy',
    raf: 0.302,
    correct: true,
    feedback: 'Right code. Chart explicitly documents neuropathy in BLE with monofilament findings; specific code applies. HCC 18 maps. RAF jumps from 0.105 to 0.302 just on this one specificity catch.',
    snippetId: 'snip-dm',
  },
  {
    id: 'dm-3',
    code: 'E10.42',
    label: 'Type 1 diabetes mellitus with diabetic polyneuropathy',
    raf: 0.302,
    correct: false,
    feedback: 'E10 is type 1 diabetes; the chart says type 2. Right complication, wrong type — same RAF but documenting the wrong condition is an audit issue.',
    snippetId: 'snip-dm',
  },
  // For the CKD snippet
  {
    id: 'ckd-1',
    code: 'N18.9',
    label: 'CKD, unspecified',
    raf: 0.069,
    correct: false,
    feedback: 'Unspecified is the under-code. Chart explicitly documents stage 3a; specific code applies. CKD has the most variance across stages — coding to unspecified leaves the largest RAF gap.',
    snippetId: 'snip-ckd',
  },
  {
    id: 'ckd-2',
    code: 'N18.31',
    label: 'CKD, stage 3a',
    raf: 0.069,
    correct: true,
    feedback: 'Right specificity. CKD 3a documented; HCC 138 (CKD moderate) maps. The 2024 RAF for CKD 3a is similar to unspecified, but specificity is required for compliance even when the RAF doesn\'t move much.',
    snippetId: 'snip-ckd',
  },
  {
    id: 'ckd-3',
    code: 'N18.5',
    label: 'CKD, stage 5',
    raf: 0.421,
    correct: false,
    feedback: 'Up-coding to stage 5 (kidney failure) when the chart says 3a is fraud. RAF is much higher but the documentation doesn\'t support it. This is exactly what HHS-OIG audits look for in risk-adjustment fraud cases — coding above what the chart documents.',
    snippetId: 'snip-ckd',
  },
]

const queryOptions: QueryOption[] = [
  {
    id: 'leading',
    label: 'Leading query (suggests the answer)',
    text: 'Dr. Patel — patient\'s BMI is 41.2 and EF is 35%. Please confirm "morbid obesity" and "heart failure with reduced EF" so we can capture HCC 22 and HCC 85.',
    correct: false,
    feedback: 'Leading queries violate AHIMA query-practice standards and CMS risk-adjustment guidelines. You can\'t suggest the diagnosis to the provider; you can only present the clinical evidence and ask for clarification.',
  },
  {
    id: 'open-ended',
    label: 'Open-ended / non-leading query',
    text: 'Dr. Patel — chart documents BMI 41.2 with mobility difficulty (PCP note 4/8) and EF 35% with prior MI (echo 4/8). Per coding compliance, would you please clarify the patient\'s clinical diagnosis for each finding when documented?',
    correct: true,
    feedback: 'Right shape. Presents the chart evidence, asks for clinical clarification without suggesting a specific diagnosis. Compliant with AHIMA + ACDIS query standards. Provider can write "morbid obesity" / "HFrEF" if clinically true, or decline if not.',
  },
  {
    id: 'no-query',
    label: 'No query — code from BMI + EF directly',
    text: '(Skip the query; assign E66.01 morbid obesity from BMI alone and I50.30 HFrEF from EF alone.)',
    correct: false,
    feedback: 'Coding from imaging findings or BMI without a provider\'s clinical statement is non-compliant for Medicare risk adjustment. CMS audit frameworks require provider-documented diagnoses for HCC capture.',
  },
  {
    id: 'multi-query',
    label: 'Two separate single-condition queries',
    text: '(Send query 1 about obesity; send query 2 separately about HF.)',
    correct: false,
    feedback: 'Splitting clinically related questions into separate queries increases provider response burden and decreases response rate. AHIMA guidance: bundle related questions in one well-structured query when documentation supports it.',
  },
]

const issues: Issue[] = [
  {
    id: 'review',
    label: 'Review: which chart snippets support specific HCC codes vs need CDI clarification?',
    recap: 'Two snippets clearly support specific codes (diabetes with neuropathy, CKD 3a). Two are ambiguous — BMI alone doesn\'t code morbid obesity; EF alone doesn\'t code HF. Both need CDI queries.',
    verb: 'review',
  },
  {
    id: 'enrich',
    label: 'Enrich: pick the right ICD-10 code per documented condition.',
    recap: 'E11.42 for diabetes with diabetic polyneuropathy; N18.31 for CKD 3a. Avoid the unspecified codes (under-coding) and the up-coded versions (compliance risk).',
    verb: 'enrich',
  },
  {
    id: 'query',
    label: 'Query: draft a non-leading CDI query for the ambiguous documentation.',
    recap: 'Open-ended bundled query to Dr. Patel — presents chart evidence, asks for clinical clarification without suggesting the answer. Complies with AHIMA + CMS standards.',
    verb: 'query',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'HCC': {
    term: 'HCC (Hierarchical Condition Category)',
    plain: "Risk-adjustment categories used by Medicare Advantage and ACO contracts to set per-member capitated rates. ICD-10 codes map to HCCs; HCCs roll up into a Risk Adjustment Factor (RAF). Under-coding leaves payment on the table; over-coding gets you audited. ANNUAL RECAPTURE: every chronic condition has to be coded again each calendar year to count toward the next year's RAF — capture isn't a one-shot. Even diabetes, CKD, etc. need a fresh encounter-level claim each year. Missed recapture is the most common reason a stable patient's RAF drops.",
  },
  'CMS-HCC v24 vs v28': {
    term: 'CMS-HCC v24 vs v28',
    plain: "CMS is phasing in a new risk-adjustment model. v24 (used 2020-2023) and v28 (phasing in 2024-2027 with blended weights — 33%/67%/100% across the three years) renumber and redefine many HCC categories. This Case uses v24 numbering (HCC 18 diabetes-with-complications, HCC 138 CKD-moderate, HCC 22 morbid-obesity, HCC 85 HFrEF) for readability. Real 2026 work blends both models; the conditions and clinical reasoning stay the same but RAF weights and category boundaries shift. Verify against your plan's contract year for actual capture numbers.",
  },
  'RAF': {
    term: 'RAF (Risk Adjustment Factor)',
    plain: "The numeric output of the HCC model — patient's expected cost relative to the average Medicare beneficiary. Higher RAF = sicker patient = more capitation. RAF errors compound across panels: under-coding 1,000 patients by 0.10 RAF each costs the practice ~$700k/year on a typical MA contract.",
  },
  'CDI query': {
    term: 'CDI (Clinical Documentation Improvement) query',
    plain: "Written question from a coder/CDI specialist to a provider asking for documentation clarification. Required when the chart suggests a condition but doesn't explicitly document it. Strict practice standards from AHIMA and ACDIS: queries must be non-leading (don't suggest the diagnosis) and present clinical evidence the provider can confirm or deny.",
  },
  'leading query': {
    term: 'Leading query (forbidden)',
    plain: "A CDI query that suggests the desired diagnosis to the provider. Example: \"Patient's BMI is 41.2; please document morbid obesity.\" Violates AHIMA query practice standards because it influences the provider's clinical judgment toward a billable answer. Audited under risk-adjustment fraud frameworks. Don't.",
  },
  'risk adjustment': {
    term: 'Risk adjustment (Medicare Advantage)',
    plain: "Mechanism by which Medicare pays MA plans more for sicker patients. CMS calculates RAF from each patient's HCCs in the prior year; pays the plan a per-member per-month rate scaled by RAF. The plan and provider share the upside, which is why HCC capture is a quality-AND-revenue metric. Also the source of multi-billion-dollar fraud cases when plans game the codes.",
  },
}

// ===== Runtime state =====

interface SnipState { pick: 'specific' | 'query' | null }
interface CodeState { picked: boolean }

const state = {
  briefingDone: false,
  briefingOpen: false,
  snipStates: snippets.reduce((m, s) => { m[s.id] = { pick: null }; return m }, {} as Record<string, SnipState>),
  codePicks: codeOptions.reduce((m, c) => { m[c.id] = { picked: false }; return m }, {} as Record<string, CodeState>),
  appliedQueryId: null as string | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isReviewDone(): boolean {
  return snippets.every(s => {
    const ss = state.snipStates[s.id]
    return ss.pick === (s.supportsCode ? 'specific' : 'query')
  })
}

function isEnrichDone(): boolean {
  // For each snippet that supportsCode, exactly its correct code is picked.
  for (const s of snippets) {
    if (!s.supportsCode) continue
    const correct = codeOptions.find(c => c.snippetId === s.id && c.correct)
    if (!correct || !state.codePicks[correct.id].picked) return false
    // No incorrect code for this snippet should be picked
    for (const c of codeOptions) {
      if (c.snippetId === s.id && !c.correct && state.codePicks[c.id].picked) return false
    }
  }
  return true
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
      ${renderReviewPanel()}
      ${renderEnrichPanel()}
      ${renderQueryPanel()}
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
        <h1>Risk Adjustment Hollow <span class="muted">@ L5 — first sketch</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./prototypes.html">← back to catalog</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          ${escape(PATIENT)}, ${escape(CONTRACT)}. Chart documents
          diabetes with neuropathy, CKD 3a, BMI 41.2, EF 35% — the
          encoder captured E11.9 and stopped. ${term('HCC')} capture
          missed; ${term('RAF')} short. Two snippets need specific
          codes; two need ${term('CDI query', 'CDI queries')}. New
          verbs: REVIEW, ENRICH, QUERY. See the
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
        Pat from coding flips a chart open. ${escape(PATIENT)},
        annual wellness visit + endo + nephro + echo. "${escape("Encoder")}
        captured E11.9 — diabetes unspecified. Chart says
        neuropathy. Chart says CKD 3a. Chart says BMI 41.
        ${term('RAF')} on this panel is going to look anemic next
        quarter unless we recapture."
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. Four chart snippets
        slide a half-pixel left, then settle. Two are
        crisp; two are missing the provider's sentence.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'The piece is missing in the hospital, not the payer.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "Inverted Wraith. Most appeals fight the payer for what
        we already have. ${term('risk adjustment', 'Risk-adjustment')}
        fights the *chart* for what's already true clinically.
        Documentation is a mile ahead of coding here; we just
        need to close the gap."
      </p>
      <p>"Three issues:"</p>
      <ul>
        <li><strong>Review.</strong> Four chart snippets. Two
        support specific codes; two are ambiguous and need
        CDI queries. <em>New verb: REVIEW.</em></li>
        <li><strong>Enrich.</strong> For the supported snippets,
        pick the specific code. Don't under-code (E11.9, N18.9
        are easy traps); don't up-code (N18.5 when the chart
        says 3a is fraud). <em>New verb: ENRICH.</em></li>
        <li><strong>Query.</strong> For the ambiguous ones, draft
        a non-leading bundled CDI query. Leading queries
        violate AHIMA standards. <em>New verb: QUERY.</em></li>
      </ul>
      <p class="briefing-sign">"If it isn't documented this year, it isn't coded this year. — D."</p>
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

function renderReviewPanel(): string {
  const done = state.resolvedIssues.has('review')
  return `
    <section class="review-panel ${done ? 'done' : ''}">
      <div class="rp-h">
        <span class="rp-tag">REVIEW CHART · 4 snippets</span>
        <span class="rp-sub">${done ? 'Two specific; two need queries.' : 'Mark each "supports specific code" or "ambiguous → CDI query."'}</span>
      </div>
      <ul class="snippet-list">
        ${snippets.map(s => renderSnippet(s)).join('')}
      </ul>
      ${state.transientFeedback && snippets.some(s => s.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('review') : ''}
    </section>
  `
}

function renderSnippet(s: ChartSnippet): string {
  const ss = state.snipStates[s.id]
  const decided = ss.pick !== null
  const correct = decided && ss.pick === (s.supportsCode ? 'specific' : 'query')
  return `
    <li class="snippet ${decided && correct ? (s.supportsCode ? 'specific' : 'query') : ''}">
      <div class="snip-meta">
        <div class="snip-source">${escape(s.source)}</div>
        <div class="snip-text">${escape(s.text)}</div>
      </div>
      <div class="snip-actions">
        ${decided && correct ? `
          <span class="snip-badge ${s.supportsCode ? 'specific' : 'query'}">${s.supportsCode ? 'SPECIFIC CODE' : 'CDI QUERY'}</span>
          <button class="btn small ghost" data-action="reset-snip" data-id="${s.id}">↺ undo</button>
        ` : `
          <button class="btn small ghost" data-action="pick-snip" data-id="${s.id}" data-pick="specific">Specific code</button>
          <button class="btn small ghost" data-action="pick-snip" data-id="${s.id}" data-pick="query">CDI query</button>
        `}
      </div>
    </li>
  `
}

function renderEnrichPanel(): string {
  const unlocked = state.resolvedIssues.has('review')
  const done = state.resolvedIssues.has('enrich')
  if (!unlocked) {
    return `
      <section class="enrich-panel locked">
        <div class="ep-h"><span class="ep-tag idle">ENRICH</span><span class="ep-sub">Locked.</span></div>
      </section>
    `
  }
  // Group code options by snippet
  const supportedSnippets = snippets.filter(s => s.supportsCode)
  return `
    <section class="enrich-panel ${done ? 'done' : 'active'}">
      <div class="ep-h">
        <span class="ep-tag ${done ? 'done' : 'active'}">ENRICH · pick specific codes</span>
        <span class="ep-sub">${done ? 'E11.42 + N18.31 captured. RAF recovered.' : 'For each supported snippet, pick the right code. Avoid under-coding and up-coding.'}</span>
      </div>
      ${supportedSnippets.map(s => `
        <div class="enrich-group">
          <div class="enrich-source">${escape(s.source)}</div>
          <ul class="code-list">
            ${codeOptions.filter(c => c.snippetId === s.id).map(c => renderCodeRow(c)).join('')}
          </ul>
        </div>
      `).join('')}
      ${state.transientFeedback && codeOptions.some(c => c.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('enrich') : ''}
    </section>
  `
}

function renderCodeRow(c: CodeOption): string {
  const picked = state.codePicks[c.id].picked
  const correct = picked && c.correct
  return `
    <li class="code-row ${picked ? (correct ? 'correct' : 'wrong') : ''}">
      <button class="code-btn" data-action="pick-code" data-id="${c.id}" ${picked ? 'disabled' : ''}>
        <code class="code-icd">${escape(c.code)}</code>
        <span class="code-label">${escape(c.label)}</span>
        <span class="code-raf">RAF ${c.raf.toFixed(3)}</span>
        ${picked && correct ? '<span class="code-badge">CAPTURED</span>' : ''}
      </button>
    </li>
  `
}

function renderQueryPanel(): string {
  const unlocked = state.resolvedIssues.has('enrich')
  const done = state.resolvedIssues.has('query')
  if (!unlocked) {
    return `
      <section class="query-panel locked">
        <div class="qp-h"><span class="qp-tag idle">QUERY</span><span class="qp-sub">Locked.</span></div>
      </section>
    `
  }
  return `
    <section class="query-panel ${done ? 'done' : 'active'}">
      <div class="qp-h">
        <span class="qp-tag ${done ? 'done' : 'active'}">CDI QUERY · 4 candidates</span>
        <span class="qp-sub">${done ? 'Open-ended bundled query routed to Dr. Patel.' : 'Pick the query that complies with AHIMA standards.'}</span>
      </div>
      <ul class="query-list">
        ${queryOptions.map(q => renderQueryRow(q)).join('')}
      </ul>
      ${state.transientFeedback && queryOptions.some(q => q.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('query') : ''}
    </section>
  `
}

function renderQueryRow(q: QueryOption): string {
  const applied = state.appliedQueryId === q.id
  return `
    <li class="query-opt ${applied ? 'applied' : ''}">
      <button class="query-btn" data-action="apply-query" data-id="${q.id}" ${state.appliedQueryId !== null && !applied ? 'disabled' : ''}>
        <span class="query-label">${escape(q.label)}</span>
        <span class="query-text">"${escape(q.text)}"</span>
        ${applied ? '<span class="query-badge applied">APPLIED</span>' : ''}
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
      <div class="checklist-h">RECAPTURE · 3 issues to resolve</div>
      <ul>
        ${issues.map(i => {
          const done = state.resolvedIssues.has(i.id)
          return `<li class="${done ? 'done' : ''}"><span class="check">${done ? '✓' : '○'}</span><div class="issue-body"><div class="issue-label">${escape(i.label)}</div></div></li>`
        }).join('')}
      </ul>
      ${state.failedAttempts > 0 ? `<p class="fail-counter">Wrong picks so far: ${state.failedAttempts}.</p>` : ''}
      <button class="btn submit ${allDone ? '' : 'disabled'}" data-action="submit" ${allDone ? '' : 'disabled'}>Recapture HCCs · file CDI query</button>
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

const RECAP: CaseRecap = CASE_RECAPS['risk-adj-hollow']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">RECAPTURE FILED</div>
      <h2>HCC capture complete. CDI query out.</h2>
      <p>
        E11.42 + N18.31 captured for diabetes with neuropathy and
        CKD 3a. Bundled non-leading query routed to Dr. Patel for
        the ambiguous BMI + EF documentation. When she replies,
        morbid obesity (HCC 22) and HFrEF (HCC 85) recapture too.
        ${escape(PATIENT)}'s RAF moves from anemic to accurate.
      </p>
      <p class="muted">
        Risk-adjustment work is fighting the chart, not the payer.
        The clinical truth is usually documented; the codes lag.
        Annual recapture closes the gap; the CDI query is the bridge.
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
            <li><strong>Three new verbs:</strong> REVIEW (chart vs claim), ENRICH (specific codes), QUERY (CDI compliance).</li>
            <li><strong>Inverted Wraith.</strong> The missing piece is in the hospital, not the payer.</li>
            <li><strong>Up-coding decoy.</strong> N18.5 (CKD 5) when the chart says 3a is fraud — different category from under-coding.</li>
            <li><strong>Leading query is forbidden.</strong> AHIMA / ACDIS standards prohibit suggesting the diagnosis.</li>
          </ul>
        </div>
        <div>
          <h3>Sibling shape</h3>
          <ul>
            <li>Cousin to Wraith / Bundle (coding district) but inverted — the chart is ahead of the claim, not behind.</li>
            <li>RAF math is real revenue; under-coding 1,000 patients by 0.10 RAF costs ~\\$700k/year on a typical MA contract.</li>
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

function pickSnip(id: string, pick: 'specific' | 'query') {
  const s = snippets.find(x => x.id === id); if (!s) return
  state.transientFeedback = null
  const right = s.supportsCode ? 'specific' : 'query'
  if (pick === right) {
    state.snipStates[id].pick = pick
    state.transientFeedback = { id, message: s.reason, kind: 'good' }
    if (isReviewDone()) state.resolvedIssues.add('review')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: s.reason, kind: 'bad' }
  }
}

function resetSnip(id: string) {
  state.snipStates[id].pick = null
  state.resolvedIssues.delete('review')
  state.resolvedIssues.delete('enrich')
  state.resolvedIssues.delete('query')
  state.transientFeedback = null
}

function pickCode(id: string) {
  const c = codeOptions.find(x => x.id === id); if (!c) return
  state.transientFeedback = null
  state.codePicks[id].picked = true
  state.transientFeedback = { id, message: c.feedback, kind: c.correct ? 'good' : 'bad' }
  if (!c.correct) state.failedAttempts++
  if (isEnrichDone()) state.resolvedIssues.add('enrich')
}

function applyQuery(id: string) {
  const q = queryOptions.find(x => x.id === id); if (!q) return
  state.transientFeedback = null
  if (q.correct) {
    state.appliedQueryId = id
    state.resolvedIssues.add('query')
    state.transientFeedback = { id, message: q.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: q.feedback, kind: 'bad' }
  }
}

function attemptSubmit() {
  if (issues.every(i => state.resolvedIssues.has(i.id))) {
    state.packetSubmitted = true
    notifyParentVictory('risk-adj-hollow')
  }
}

function reset() {
  state.briefingDone = false; state.briefingOpen = false
  for (const id in state.snipStates) state.snipStates[id] = { pick: null }
  for (const id in state.codePicks) state.codePicks[id] = { picked: false }
  state.appliedQueryId = null
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
    case 'pick-snip': if (el.dataset.id && el.dataset.pick) pickSnip(el.dataset.id, el.dataset.pick as 'specific' | 'query'); break
    case 'reset-snip': if (el.dataset.id) resetSnip(el.dataset.id); break
    case 'pick-code': if (el.dataset.id) pickCode(el.dataset.id); break
    case 'apply-query': if (el.dataset.id) applyQuery(el.dataset.id); break
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

const css = districtVars('coding') + BASE_CSS + `
  .review-panel, .enrich-panel, .query-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .review-panel.done, .enrich-panel.done, .query-panel.done { border-left-color: var(--good); }
  .enrich-panel.locked, .query-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .rp-h, .ep-h, .qp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .rp-tag, .ep-tag, .qp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .ep-tag.idle, .qp-tag.idle { color: var(--ink-dim); }
  .rp-tag.done, .ep-tag.done, .qp-tag.done { color: var(--good); }
  .rp-sub, .ep-sub, .qp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .snippet-list, .code-list, .query-list { list-style: none; padding-left: 0; margin: 0; }
  .snippet { display: flex; gap: 14px; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 6px; border-left: 3px solid transparent; flex-wrap: wrap; }
  .snippet.specific { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .snippet.query { border-left-color: var(--accent-2); background: linear-gradient(180deg, rgba(240,168,104,0.06), transparent); }
  .snip-meta { flex: 2; min-width: 280px; }
  .snip-source { font-size: 11.5px; color: var(--ink-dim); font-style: italic; }
  .snip-text { font-size: 13px; line-height: 1.55; margin-top: 4px; }
  .snip-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .snip-badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 3px; }
  .snip-badge.specific { background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; }
  .snip-badge.query { background: rgba(240,168,104,0.15); color: var(--accent-2); border: 1px solid #4a3a2a; }
  .btn.small { padding: 4px 10px; font-size: 11.5px; }

  .enrich-group { margin-bottom: 14px; }
  .enrich-source { font-size: 11.5px; color: var(--ink-dim); font-style: italic; margin-bottom: 6px; }
  .code-row { margin-bottom: 4px; }
  .code-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 9px 12px; text-align: left; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font: inherit; transition: all 0.15s; position: relative; }
  .code-btn:hover:not(:disabled) { background: #232b3a; border-color: var(--accent); }
  .code-btn:disabled { cursor: default; }
  .code-row.correct .code-btn { border-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); opacity: 1; }
  .code-row.wrong .code-btn { border-color: var(--bad); background: rgba(239,91,123,0.04); opacity: 0.6; }
  .code-icd { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 12px; color: var(--accent); background: var(--bg); padding: 2px 8px; border-radius: 3px; flex-shrink: 0; }
  .code-label { font-size: 12.5px; flex: 1; }
  .code-raf { font-family: ui-monospace, monospace; font-size: 11.5px; color: var(--ink-dim); }
  .code-badge { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; font-weight: 700; }

  .query-opt { margin-bottom: 6px; }
  .query-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 11px 14px; text-align: left; font: inherit; transition: all 0.15s; position: relative; display: flex; flex-direction: column; gap: 6px; }
  .query-btn:hover:not(:disabled) { background: #232b3a; border-color: var(--accent); }
  .query-btn:disabled { opacity: 0.45; cursor: default; }
  .query-opt.applied .query-btn { border-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); opacity: 1; }
  .query-label { font-size: 13px; font-weight: 600; padding-right: 80px; }
  .query-text { font-size: 12px; color: var(--ink-dim); font-style: italic; line-height: 1.55; }
  .query-badge.applied { position: absolute; top: 10px; right: 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; font-weight: 700; }

  .recap { background: rgba(126, 226, 193, 0.06); border-color: #2c5547; }
  .recap-h { color: var(--good); }
`

function rerender() { const root = document.getElementById('prototype-root'); if (root) root.innerHTML = render() }
function mount() {
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style)
  rerender(); document.body.addEventListener('click', handleClick)
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
