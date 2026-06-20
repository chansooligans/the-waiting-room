// 2-Midnight Mire @ L24 — Medicare's 2-midnight rule decides
// whether a stay pays as inpatient (Part A, DRG-based) or
// outpatient observation (Part B, OPPS-paid). The revenue
// impact is large; the audit attention is high (RACs target this
// continuously).
//
// Encounter: chest pain admission, 36-hour stay (Tue 8pm → Thu
// 11am crosses 2 midnights). Doc wrote inpatient order on
// admission. RAC audit returned a finding: stay didn't meet
// inpatient medical necessity; should have been observation.
//
// Actions:
//   - CLOCK: 4 statements about how the 2-midnight rule actually
//     works (benchmark, presumption, severe-illness exception,
//     order-required).
//   - CLASSIFY: review 5 pieces of documentation; mark each as
//     supporting inpatient or supporting observation.
//   - RECLASSIFY: pick the right resolution path among 5 options
//     (Condition Code 44 in real-time vs Part A → Part B rebill
//     vs RAC appeal vs accept the recoupment).
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

interface ClockStatement {
  id: string
  text: string
  truth: boolean
  reason: string
}

interface DocSupport {
  id: string
  source: string
  text: string
  /** True if this documentation supports inpatient status; false if supports observation. */
  supportsInpatient: boolean
  reason: string
}

interface Resolution {
  id: string
  label: string
  detail: string
  correct: boolean
  feedback: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'clock' | 'classify' | 'reclassify'
}

interface GlossaryEntry { term: string; plain: string }

// ===== Encounter data =====

const PATIENT = 'Lawrence Mitchell'
const ADMIT_TS = 'Tue 2026-04-08, 8:14 PM'
const DISCHARGE_TS = 'Thu 2026-04-10, 11:23 AM'
const STAY_HOURS = 39
const PART_A_PAID = 8_200
const PART_B_OBSERVATION = 2_140
const RAC_RECOUPMENT = PART_A_PAID - PART_B_OBSERVATION

const clockStatements: ClockStatement[] = [
  {
    id: 'c1',
    text: 'The 2-midnight benchmark says: if the admitting physician expects the patient to require hospital care across 2+ midnights, inpatient is appropriate.',
    truth: true,
    reason: 'Right benchmark — 42 CFR 412.3 + CMS guidance. Physician expectation at admission is what matters. The expectation must be documented in the medical record at the time of admission. Actual stay length is secondary; expectation governs.',
  },
  {
    id: 'c2',
    text: 'Lawrence\'s admission at Tue 8:14 PM means the 2-midnight clock starts on Tuesday night.',
    truth: false,
    reason: '**The clock starts when hospital care begins, not when an inpatient order is written.** Lawrence arrived at 5:30 PM (per ED note); ED workup + chest pain protocol lasted 2.5 hours. Inpatient order at 8:14 PM. The 2-midnight clock includes the ED time as outpatient hospital care — so the clock effectively started ~5:30 PM Tuesday. This is the most-misunderstood part of the rule and a frequent RAC finding.',
  },
  {
    id: 'c3',
    text: 'Some clinical scenarios qualify as inpatient even when the stay is shorter than 2 midnights — severe illness, intensive resource use, certain procedures.',
    truth: true,
    reason: 'True. CMS\'s "case-by-case exception" allows shorter stays to qualify as inpatient when documentation supports the medical necessity (e.g., complex condition, severe instability, surgical procedures on the inpatient-only list). Documentation has to support; physician documentation alone isn\'t enough — the chart facts have to back it up.',
  },
  {
    id: 'c4',
    text: 'A signed inpatient order at admission, by itself, is sufficient to qualify the stay as inpatient under Part A.',
    truth: false,
    reason: 'Insufficient. The order is **necessary** but not **sufficient**. CMS requires the order PLUS supporting documentation that meets the 2-midnight benchmark or the case-by-case exception. RACs routinely find inpatient orders without supporting documentation — those get recouped at scale.',
  },
]

const docFacts: DocSupport[] = [
  {
    id: 'd1',
    source: 'ED triage note (Tue 5:30 PM)',
    text: 'Patient presenting with substernal chest pain, 4 hours duration. ESI level 2. EKG: nonspecific ST changes, troponin negative ×1. Pain rating 6/10.',
    supportsInpatient: false,
    reason: 'Atypical chest pain with negative initial troponin. Standard chest-pain workup at the time of presentation supports OBSERVATION (Part B). 0/3 risk-stratification scores typically observation-eligible; the workup is exactly what observation is designed for.',
  },
  {
    id: 'd2',
    source: 'Admitting H&P (Tue 8:00 PM)',
    text: 'CC: chest pain. HPI: 65yo M, atypical features. Hx: HTN, hyperlipidemia. Plan: serial troponins, telemetry, NSTEMI rule-out, expect 24-36 hour stay.',
    supportsInpatient: false,
    reason: 'Doc\'s OWN documentation says "expect 24-36 hour stay" — that\'s observation territory. 2-midnight rule requires the doc to expect the stay will cross 2 midnights for inpatient. "24-36 hours" is a 1-midnight expectation. The H&P contradicts the inpatient order written 14 minutes later.',
  },
  {
    id: 'd3',
    source: 'Inpatient admission order (Tue 8:14 PM)',
    text: 'Inpatient admission. Service: Hospitalist (Dr. Park). Reason: chest pain rule-out NSTEMI.',
    supportsInpatient: true,
    reason: 'Inpatient order is documented (necessary for inpatient status). But it isn\'t sufficient on its own — RAC reads the chart for whether the BENCHMARK is met. The order is one piece; the H&P and clinical course have to back it up.',
  },
  {
    id: 'd4',
    source: 'Day-2 progress note (Wed 9 AM)',
    text: 'Troponins ×3 negative. Stress test today. Patient comfortable, ambulating, requesting Wi-Fi password. Plan: stress test, discharge if negative.',
    supportsInpatient: false,
    reason: 'Day-2 patient is stable, ambulating, requesting Wi-Fi. This is a poster-child observation course. By Wed AM the doc could see Lawrence wasn\'t crossing 2 midnights with the level of care required for inpatient; status should have converted to observation here (via Condition Code 44 process).',
  },
  {
    id: 'd5',
    source: 'Discharge summary (Thu 11 AM)',
    text: 'Negative troponins ×3, negative stress test, no acute coronary syndrome. Discharge home with PCP follow-up. Total stay: 39 hours.',
    supportsInpatient: false,
    reason: '39 hours; ruled-out NSTEMI; no acute coronary syndrome; stable course. Discharge is exactly what observation patients look like. RAC reads this as: stay did not meet 2-midnight benchmark, no case-by-case exception, no severe illness or intensive care. Recoupment finding.',
  },
]

const resolutions: Resolution[] = [
  {
    id: 'rebill-part-b',
    label: 'Accept the RAC finding; rebill the stay as Part B outpatient observation',
    detail: `File a Part A → Part B rebill (CMS allows this). Recoup the ${money(PART_A_PAID)} Part A; bill ${money(PART_B_OBSERVATION)} Part B observation; net loss ${money(RAC_RECOUPMENT)} to the hospital. Update inpatient-vs-observation training for the hospitalist team; review chest-pain admissions from the past 90 days to see if the pattern recurs.`,
    correct: true,
    feedback: 'Right move. Part A → Part B rebilling is a real CMS-blessed mechanism for exactly this scenario. The hospital recovers the observation payment instead of writing off entirely; the RAC finding stays clean. Most importantly, fixing the documentation pattern (admit-as-observation for chest-pain rule-outs unless the chart genuinely meets the benchmark) prevents the next 50 cases.',
  },
  {
    id: 'condition-code-44-now',
    label: 'File Condition Code 44 to convert the stay from inpatient to observation',
    detail: 'CC 44 reclassifies the entire stay to outpatient/observation while the patient is still in the hospital.',
    correct: false,
    feedback: 'Wrong timing. **Condition Code 44 only applies BEFORE discharge** — it\'s a real-time conversion mechanism, not a post-discharge fix. Lawrence was discharged 2 days ago. CC 44 isn\'t available; Part A → Part B rebill is the post-discharge equivalent.',
  },
  {
    id: 'appeal-rac',
    label: 'Appeal the RAC finding; argue medical necessity for inpatient',
    detail: 'File a level-1 appeal disputing the RAC determination.',
    correct: false,
    feedback: 'You\'d be appealing a finding that\'s clinically defensible. Lawrence\'s own H&P said "expect 24-36 hour stay" — which is observation territory by the doc\'s own documentation. Appealing weak findings burns 90+ days, costs more than the recoupment in staff time, and rarely wins. Pick fights with documented merit, not with documented losses.',
  },
  {
    id: 'inpatient-only-list',
    label: 'Argue the procedure was on the inpatient-only list (case-by-case exception)',
    detail: 'Cite CMS\'s inpatient-only list to qualify the stay regardless of length.',
    correct: false,
    feedback: 'No procedure was performed. The inpatient-only list applies to specific surgical/procedural codes; rule-out NSTEMI with no intervention isn\'t on it. The case-by-case exception requires documentation of severe illness or intensive resource use; the chart doesn\'t support that here.',
  },
  {
    id: 'write-off',
    label: 'Accept the recoupment fully; write off the entire payment',
    detail: 'Take the loss; don\'t pursue Part B rebill.',
    correct: false,
    feedback: 'Don\'t leave money on the table. CMS specifically allows Part A → Part B rebill in exactly this scenario; you recover ${money(PART_B_OBSERVATION)} of the original payment as observation. Writing off entirely costs an extra ${money(PART_B_OBSERVATION)} you don\'t need to lose.',
  },
]

const issues: Issue[] = [
  {
    id: 'clock',
    label: 'Clock: walk the 2-midnight rule. 4 statements true/false.',
    recap: 'Walked the clock. Benchmark is doc\'s expectation at admission of 2+ midnights of hospital care; clock starts when hospital care begins (NOT when the inpatient order is written — ED time counts); case-by-case exceptions exist for severe illness; the order alone isn\'t sufficient — chart documentation has to back it up.',
    verb: 'clock',
  },
  {
    id: 'classify',
    label: 'Classify documentation: 5 chart facts; mark each as supporting inpatient or observation.',
    recap: 'Four facts support observation (atypical chest pain, "expect 24-36 hour" H&P, ambulating Wi-Fi-asking patient, ruled-out discharge); one supports inpatient (the admission order itself). The chart predominantly fits an observation pattern. RAC reading is correct.',
    verb: 'classify',
  },
  {
    id: 'reclassify',
    label: 'Reclassify: rebill Part A → Part B observation; fix the admit pattern.',
    recap: `RAC finding accepted; ${money(PART_A_PAID)} Part A recouped; ${money(PART_B_OBSERVATION)} Part B observation rebilled; net hospital exposure ${money(RAC_RECOUPMENT)}. Hospitalist team retrained on chest-pain admit criteria; 90-day audit of similar admissions queued.`,
    verb: 'reclassify',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  '2-midnight rule': {
    term: '2-midnight rule (42 CFR 412.3)',
    plain: "CMS rule (effective Oct 1, 2013, refined since) for distinguishing inpatient from observation stays under Medicare. The benchmark: inpatient is appropriate when the admitting physician expects the patient to require hospital care that crosses 2+ midnights. The presumption: stays that actually do cross 2+ midnights are presumed-inpatient (subject to medical necessity). The exception: shorter stays can qualify case-by-case when chart documents severe illness or intensive resource use, or when the procedure is on CMS's inpatient-only list.",
  },
  'observation status': {
    term: 'Observation status (Part B)',
    plain: "Outpatient hospital care provided to assess whether the patient needs inpatient admission. Pays under Medicare Part B at OPPS (Outpatient Prospective Payment System) rates — typically much less than inpatient Part A. Observation isn't a place; it's a billing classification. The patient may be in the same bed, getting the same nursing care; only the financial classification differs.",
  },
  'Part A vs Part B': {
    term: 'Medicare Part A vs Part B (inpatient vs outpatient)',
    plain: "Part A pays for inpatient hospital stays at DRG-based rates. Part B pays for outpatient services (physician visits, observation, OPPS-paid procedures). Same patient, same bed, same care — different payment system depending on classification. The classification choice is consequential: the same chest-pain rule-out can pay $8k under Part A (inpatient DRG) or $2k under Part B (observation), with the patient liability also flipping (Part A inpatient deductible vs Part B coinsurance + cost-share for observation).",
  },
  'RAC': {
    term: 'RAC (Recovery Audit Contractor)',
    plain: "CMS-contracted auditors that review claims after payment for over- and under-payments. Paid on contingency (percentage of recoveries). Heavy focus on inpatient-vs-observation under the 2-midnight rule because the dollar impact per case is large. RACs review chart documentation against the 2-midnight benchmark and case-by-case exception; recoup payment when the chart doesn't support the inpatient classification.",
  },
  'Condition Code 44': {
    term: 'Condition Code 44',
    plain: "UB-04 condition code that reclassifies a stay from inpatient to outpatient/observation BEFORE the patient is discharged. Real-time conversion mechanism. Requires UR (utilization review) committee involvement. Once the patient is discharged, CC 44 isn't available; the post-discharge equivalent is Part A → Part B rebill (CMS-blessed via Inpatient Hospital Rebill demonstrations).",
  },
  'Part A → Part B rebill': {
    term: 'Part A → Part B rebill',
    plain: "CMS mechanism for converting a Part A inpatient claim to Part B outpatient/observation after discharge — typically used when a self-audit, RAC finding, or QIO review concludes the stay didn't meet inpatient criteria. The provider recoups Part A; rebills Part B; recovers most (not all) of the original payment. Better than full write-off; not as good as having admitted correctly the first time.",
  },
  'inpatient-only list': {
    term: 'Inpatient-only list (CMS)',
    plain: "List of specific surgical and procedural codes that CMS pays only when performed inpatient. Performance of a code on this list automatically qualifies the stay as inpatient regardless of length — bypassing the 2-midnight benchmark. Updated annually in the OPPS final rule. Common examples: most cardiac surgery, major orthopedic, complex spine.",
  },
  'case-by-case exception': {
    term: 'Case-by-case exception (2-midnight rule)',
    plain: "Documented exception for shorter-than-2-midnight stays that still qualify as inpatient. Requires chart documentation of severe illness, intensive resource use, or imminent clinical deterioration justifying inpatient. Subjective in practice; RACs scrutinize claimed case-by-case exceptions heavily. Without strong documentation, the exception fails on review.",
  },
}

// ===== Runtime state =====

interface StmtState { pick: boolean | null }
interface DocState { pick: 'inpatient' | 'observation' | null }

const state = {
  briefingDone: false,
  briefingOpen: false,
  stmtStates: clockStatements.reduce((m, s) => { m[s.id] = { pick: null }; return m }, {} as Record<string, StmtState>),
  docStates: docFacts.reduce((m, d) => { m[d.id] = { pick: null }; return m }, {} as Record<string, DocState>),
  appliedResolutionId: null as string | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isClockDone(): boolean {
  return clockStatements.every(s => state.stmtStates[s.id].pick === s.truth)
}

function isClassifyDone(): boolean {
  return docFacts.every(d => {
    const ss = state.docStates[d.id]
    return ss.pick === (d.supportsInpatient ? 'inpatient' : 'observation')
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
      ${renderClaimSummary()}
      ${renderClockPanel()}
      ${renderClassifyPanel()}
      ${renderReclassifyPanel()}
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
        <h1>2-Midnight Mire <span class="muted">@ L24 — RAC finding on a chest-pain admit</span></h1>
        <div class="header-actions">${recallBtn}<a class="back-link" href="./prototypes.html">← back to catalog</a></div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          ${escape(PATIENT)}, 65, chest-pain rule-out. Doc admitted
          inpatient; stay was 39 hours; ruled out NSTEMI; discharged.
          ${term('RAC')} returned a finding — chart doesn't meet the
          ${term('2-midnight rule')} benchmark; should have been
          ${term('observation status')}. ${money(RAC_RECOUPMENT)}
          recoupment on the table. Walk the clock; classify the doc;
          decide whether to rebill, defend, or accept. See the
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
        Theo from compliance walks the ${term('RAC')} letter over.
        ${escape(PATIENT)}'s chest-pain admission from two weeks ago.
        Doc admitted inpatient; stay 39 hours; troponin negative
        ×3, stress test negative, ruled out NSTEMI. RAC says the
        chart doesn't meet ${term('2-midnight rule', 'the 2-midnight benchmark')}
        and there's no case-by-case exception documented.
        ${money(PART_A_PAID)} Part A is on the line.
      </p>
      <p>
        "Three steps. Walk the clock — make sure they're applying
        the rule right. Classify the documentation — does the chart
        actually back inpatient? Then decide: rebill, defend, or
        accept."
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The chart slides
        a half-pixel left, then settles. Five pieces of documentation
        line up; the clock ticks behind them.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'Inpatient vs observation. The dollar amount per case is huge.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "${term('RAC')} finding on a chest-pain admit. Lawrence
        spent 39 hours in a hospital bed; doc wrote inpatient; doc's
        own H&P said \"expect 24-36 hour stay.\" That's
        ${term('observation status')}, not inpatient. RAC reads
        charts for a living and they're right here."
      </p>
      <p>"Three issues:"</p>
      <ul>
        <li>Four statements about how the
        ${term('2-midnight rule')} actually works. Watch the
        clock-start trap (clock starts when hospital care begins,
        not when the inpatient order is written).</li>
        <li>Five pieces of documentation.
        Mark each as supporting inpatient or supporting observation.
        Most of the chart is observation-shaped.</li>
        <li>Five resolution paths.
        ${term('Condition Code 44')} only works pre-discharge —
        Lawrence is gone. The post-discharge fix is
        ${term('Part A → Part B rebill')}; that recovers
        observation payment instead of writing off entirely.</li>
      </ul>
      <p>
        "Pick fights with documented merit. Some RAC findings are
        wrong; this one isn't."
      </p>
      <p class="briefing-sign">"The clinical narrative is the defense. — D."</p>
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

function renderClaimSummary(): string {
  return `
    <section class="claim-summary">
      <div class="cs-h">
        <span class="cs-tag">CLAIM · Medicare FFS · ICN 2026-04-15-883</span>
        <span class="cs-sub">${escape(PATIENT)} · chest-pain rule-out · ${escape(ADMIT_TS)} → ${escape(DISCHARGE_TS)} (${STAY_HOURS}h)</span>
      </div>
      <table class="cs-table">
        <tr><th>Admission</th><td>${escape(ADMIT_TS)} (inpatient order)</td></tr>
        <tr><th>Discharge</th><td>${escape(DISCHARGE_TS)}</td></tr>
        <tr><th>Stay length</th><td>${STAY_HOURS} hours · crossed 1 midnight (Wed)</td></tr>
        <tr><th>Outcome</th><td>Negative troponins ×3 · negative stress · ruled out NSTEMI</td></tr>
        <tr><th>Original Part A payment</th><td>${money(PART_A_PAID)} (DRG 313 — chest pain w/o MCC)</td></tr>
        <tr><th>RAC finding</th><td><strong class="bad-text">Doesn't meet 2-midnight benchmark; no case-by-case exception documented</strong></td></tr>
        <tr><th>${term('Part A → Part B rebill', 'Rebill option')}</th><td>${money(PART_B_OBSERVATION)} Part B observation; net loss ${money(RAC_RECOUPMENT)}</td></tr>
      </table>
    </section>
  `
}

function renderClockPanel(): string {
  const done = state.resolvedIssues.has('clock')
  return `
    <section class="clock-panel ${done ? 'done' : ''}">
      <div class="cp-h">
        <span class="cp-tag">2-MIDNIGHT CLOCK · 4 statements</span>
        <span class="cp-sub">${done
          ? 'Walked. Benchmark = 2+ midnight expectation; clock starts at hospital-care arrival; case-by-case exceptions exist; order alone insufficient.'
          : 'Mark each true/false. Watch the clock-start trap.'}</span>
      </div>
      <ul class="stmt-list">
        ${clockStatements.map(s => renderStmt(s)).join('')}
      </ul>
      ${state.transientFeedback && clockStatements.some(s => s.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('clock') : ''}
    </section>
  `
}

function renderStmt(s: ClockStatement): string {
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

function renderClassifyPanel(): string {
  const unlocked = state.resolvedIssues.has('clock')
  const done = state.resolvedIssues.has('classify')
  if (!unlocked) {
    return `<section class="classify-panel locked"><div class="dp-h"><span class="dp-tag idle">CLASSIFY DOCUMENTATION</span><span class="dp-sub">Locked.</span></div></section>`
  }
  return `
    <section class="classify-panel ${done ? 'done' : 'active'}">
      <div class="dp-h">
        <span class="dp-tag ${done ? 'done' : 'active'}">CLASSIFY DOCUMENTATION · 5 chart facts</span>
        <span class="dp-sub">${done
          ? 'Four facts support observation; one (the order itself) supports inpatient. Chart predominantly observation-shaped.'
          : 'For each chart fact, mark whether it supports inpatient or observation status.'}</span>
      </div>
      <ul class="doc-list">
        ${docFacts.map(d => renderDocFact(d)).join('')}
      </ul>
      ${state.transientFeedback && docFacts.some(d => d.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('classify') : ''}
    </section>
  `
}

function renderDocFact(d: DocSupport): string {
  const ss = state.docStates[d.id]
  const decided = ss.pick !== null
  const correct = decided && ss.pick === (d.supportsInpatient ? 'inpatient' : 'observation')
  return `
    <li class="doc ${decided && correct ? (d.supportsInpatient ? 'inpatient' : 'observation') : ''}">
      <div class="doc-meta">
        <div class="doc-source">${escape(d.source)}</div>
        <div class="doc-text">${escape(d.text)}</div>
      </div>
      <div class="doc-actions">
        ${decided && correct ? `
          <span class="doc-badge ${d.supportsInpatient ? 'inpatient' : 'observation'}">${d.supportsInpatient ? 'SUPPORTS INPATIENT' : 'supports observation'}</span>
          <button class="btn small ghost" data-action="reset-doc" data-id="${d.id}">↺ undo</button>
        ` : `
          <button class="btn small ghost" data-action="pick-doc" data-id="${d.id}" data-pick="inpatient">Inpatient</button>
          <button class="btn small ghost" data-action="pick-doc" data-id="${d.id}" data-pick="observation">Observation</button>
        `}
      </div>
    </li>
  `
}

function renderReclassifyPanel(): string {
  const unlocked = state.resolvedIssues.has('clock') && state.resolvedIssues.has('classify')
  const done = state.resolvedIssues.has('reclassify')
  if (!unlocked) {
    return `<section class="reclassify-panel locked"><div class="rp-h"><span class="rp-tag idle">RECLASSIFY</span><span class="rp-sub">Locked.</span></div></section>`
  }
  return `
    <section class="reclassify-panel ${done ? 'done' : 'active'}">
      <div class="rp-h">
        <span class="rp-tag ${done ? 'done' : 'active'}">RECLASSIFY · 5 paths</span>
        <span class="rp-sub">${done
          ? `Part A → Part B rebill; ${money(PART_A_PAID)} recouped, ${money(PART_B_OBSERVATION)} rebilled, net ${money(RAC_RECOUPMENT)} loss.`
          : 'Pick the path that recovers what we can and prevents the next 50 cases.'}</span>
      </div>
      <ul class="opt-list">
        ${resolutions.map(r => renderResolution(r)).join('')}
      </ul>
      ${state.transientFeedback && resolutions.some(r => r.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>` : ''}
      ${done ? renderRecap('reclassify') : ''}
    </section>
  `
}

function renderResolution(r: Resolution): string {
  const applied = state.appliedResolutionId === r.id
  return `
    <li class="opt ${applied ? 'applied' : ''}">
      <button class="opt-btn" data-action="apply-resolution" data-id="${r.id}" ${state.appliedResolutionId !== null && !applied ? 'disabled' : ''}>
        <span class="opt-label">${escape(r.label)}</span>
        <span class="opt-detail">${escape(r.detail)}</span>
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
      <div class="checklist-h">RAC RESPONSE · 3 issues to resolve</div>
      <ul>${issues.map(i => `<li class="${state.resolvedIssues.has(i.id) ? 'done' : ''}"><span class="check">${state.resolvedIssues.has(i.id) ? '✓' : '○'}</span><div class="issue-body"><div class="issue-label">${escape(i.label)}</div></div></li>`).join('')}</ul>
      ${state.failedAttempts > 0 ? `<p class="fail-counter">Wrong picks so far: ${state.failedAttempts}.</p>` : ''}
      <button class="btn submit ${allDone ? '' : 'disabled'}" data-action="submit" ${allDone ? '' : 'disabled'}>Rebill Part A → Part B</button>
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

const RECAP: CaseRecap = CASE_RECAPS['two-midnight-mire']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">PART A → PART B REBILLED</div>
      <h2>Net hospital loss: ${money(RAC_RECOUPMENT)}. 90-day pattern audit queued.</h2>
      <p>
        Part A claim recouped (${money(PART_A_PAID)}); Part B observation
        rebilled (${money(PART_B_OBSERVATION)}); net hospital exposure
        ${money(RAC_RECOUPMENT)}. The hospitalist team gets retrained on
        chest-pain admit criteria; we audit the last 90 days for the
        same pattern (chest-pain admits with H&Ps that say "expect
        24-36 hours") to catch others before the next RAC cycle.
      </p>
      <p class="muted">
        The 2-midnight rule is the single biggest revenue-impact
        Medicare classification decision in inpatient billing. Same
        chest-pain rule-out can pay 4× more under Part A than Part B —
        and RACs target it precisely because the per-case dollar
        impact is large. The pattern fix (admit-as-observation when the
        H&P says < 2 midnights) prevents recoupment at scale.
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
            <li><strong>Three actions:</strong> CLOCK (2-midnight benchmark + clock-start mechanics), CLASSIFY (chart documentation per fact), RECLASSIFY (Part A→B rebill mechanics).</li>
            <li><strong>The 2-midnight rule is the biggest classification-decision dollar lever in inpatient Medicare.</strong> Same care, same bed, ~4× different reimbursement.</li>
            <li><strong>Order isn't enough.</strong> Inpatient order is necessary; chart documentation has to back it up. RACs read for the documentation, not the order.</li>
            <li><strong>Pick fights with documented merit.</strong> Some RAC findings are wrong; this one isn't. Appealing weak positions burns more than it recovers.</li>
            <li><strong>Pattern fixes scale.</strong> Recovering one case is good; fixing the admit pattern (chest-pain rule-outs default to observation when H&P expects <2 midnights) prevents the next 50.</li>
          </ul>
        </div>
        <div>
          <h3>Sibling shape</h3>
          <ul>
            <li>Cousin to <a href="./audit-boss-prototype.html">Audit Boss</a> — both are audit-defense Cases with RECEIPT vs concede tradeoffs. Audit Boss is broader; this is a focused single-rule RAC.</li>
            <li>Cousin to the inpatient/outpatient distinction in <a href="./form-mirror-prototype.html">Form Mirror</a> (UB-04 vs CMS-1500 institutional vs professional).</li>
            <li>Builds toward future RAC-specific Cases (extrapolated overpayment findings, multi-claim audits).</li>
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
  const s = clockStatements.find(x => x.id === id); if (!s) return
  state.transientFeedback = null
  if (s.truth === pick) {
    state.stmtStates[id].pick = pick
    state.transientFeedback = { id, message: s.reason, kind: 'good' }
    if (isClockDone()) state.resolvedIssues.add('clock')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: s.reason, kind: 'bad' }
  }
}

function resetStmt(id: string) {
  state.stmtStates[id].pick = null
  state.resolvedIssues.delete('clock'); state.resolvedIssues.delete('classify'); state.resolvedIssues.delete('reclassify')
  state.transientFeedback = null
}

function pickDoc(id: string, pick: 'inpatient' | 'observation') {
  const d = docFacts.find(x => x.id === id); if (!d) return
  state.transientFeedback = null
  const right = d.supportsInpatient ? 'inpatient' : 'observation'
  if (pick === right) {
    state.docStates[id].pick = pick
    state.transientFeedback = { id, message: d.reason, kind: 'good' }
    if (isClassifyDone()) state.resolvedIssues.add('classify')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: d.reason, kind: 'bad' }
  }
}

function resetDoc(id: string) {
  state.docStates[id].pick = null
  state.resolvedIssues.delete('classify'); state.resolvedIssues.delete('reclassify')
  state.transientFeedback = null
}

function applyResolution(id: string) {
  const r = resolutions.find(x => x.id === id); if (!r) return
  state.transientFeedback = null
  if (r.correct) {
    state.appliedResolutionId = id
    state.resolvedIssues.add('reclassify')
    state.transientFeedback = { id, message: r.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: r.feedback, kind: 'bad' }
  }
}

function attemptSubmit() {
  if (issues.every(i => state.resolvedIssues.has(i.id))) {
    state.packetSubmitted = true
    notifyParentVictory('two-midnight-mire')
  }
}

function reset() {
  state.briefingDone = false; state.briefingOpen = false
  for (const id in state.stmtStates) state.stmtStates[id] = { pick: null }
  for (const id in state.docStates) state.docStates[id] = { pick: null }
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
    case 'pick-doc': if (el.dataset.id && el.dataset.pick) pickDoc(el.dataset.id, el.dataset.pick as 'inpatient' | 'observation'); break
    case 'reset-doc': if (el.dataset.id) resetDoc(el.dataset.id); break
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

const css = districtVars('appeals') + BASE_CSS + `
  .claim-summary { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .cs-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .cs-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .cs-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .cs-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .cs-table th, .cs-table td { text-align: left; padding: 6px 10px; border-bottom: 1px dashed #232a36; vertical-align: top; }
  .cs-table th { font-size: 11px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; width: 220px; }
  .bad-text { color: var(--bad); }

  .clock-panel, .classify-panel, .reclassify-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .clock-panel.done, .classify-panel.done, .reclassify-panel.done { border-left-color: var(--good); }
  .classify-panel.locked, .reclassify-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .cp-h, .dp-h, .rp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .cp-tag, .dp-tag, .rp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .dp-tag.idle, .rp-tag.idle { color: var(--ink-dim); }
  .cp-tag.done, .dp-tag.done, .rp-tag.done { color: var(--good); }
  .cp-sub, .dp-sub, .rp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .stmt-list, .doc-list, .opt-list { list-style: none; padding-left: 0; margin: 0; }
  .stmt { display: flex; align-items: center; gap: 16px; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 6px; border-left: 3px solid transparent; }
  .stmt.correct { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .stmt-text { flex: 1; font-size: 13px; line-height: 1.5; }
  .stmt-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .stmt-badge { font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 3px; }
  .stmt-badge.true  { background: rgba(126, 226, 193, 0.15); color: var(--good); border: 1px solid #2c5547; }
  .stmt-badge.false { background: rgba(239, 91, 123, 0.10); color: var(--bad); border: 1px solid #4a2a32; }
  .btn.small { padding: 4px 10px; font-size: 11.5px; }

  .doc { display: flex; gap: 14px; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 6px; border-left: 3px solid transparent; flex-wrap: wrap; align-items: flex-start; }
  .doc.inpatient { border-left-color: var(--accent-2); background: linear-gradient(180deg, rgba(240,168,104,0.06), transparent); }
  .doc.observation { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .doc-meta { flex: 2; min-width: 280px; }
  .doc-source { font-size: 11.5px; color: var(--ink-dim); font-style: italic; }
  .doc-text { font-size: 13px; line-height: 1.55; margin-top: 4px; }
  .doc-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .doc-badge { font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 3px; }
  .doc-badge.inpatient { background: rgba(240,168,104,0.15); color: var(--accent-2); border: 1px solid #4a3a2a; }
  .doc-badge.observation { background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; }

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
