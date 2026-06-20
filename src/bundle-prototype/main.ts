// Bundle @ L4 (CO-97).
//
// Sibling to wraith-prototype. Same shape (Hospital intro →
// dreamlike fall → Waiting Room → claim form + workbench + builder),
// tuned to a different action set:
//
//   - AMEND-dominant: the fix is a missing modifier on Box 24, not
//     a wrong code on Box 21. Faster surgical fix.
//   - One CITE issue (the E&M was significant and separately
//     identifiable per NCCI guidance) — proves the cite path still
//     works alongside the amend path.
//
// Demonstrates: not every encounter is a long appeal. Some are
// quick "fix the field, resubmit." The framework supports both.
//
// Code is intentionally a sibling rather than abstracted from the
// wraith prototype; once we have 3+ encounters the shared bits
// will be obvious to extract.

import { CASES } from '../content/cases'
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

interface ModifierOption {
  code: string
  label: string
  /** 'current' | 'correct' | 'wrong' | 'partial'. */
  support: 'current' | 'correct' | 'wrong' | 'partial'
  feedback: string
}

interface ChartFact {
  id: string
  plain: string
  technical: string
  issueId: string | null
  distractorReason?: string
}

interface NcciClause {
  id: string
  plain: string
  technical: string
  issueId: string
}

interface PayerPhrase {
  id: string
  text: string
  plain: string
  issueId: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'amend' | 'cite'
}

interface GlossaryEntry {
  term: string
  plain: string
}

const issues: Issue[] = [
  {
    id: 'modifier',
    label: 'Add modifier 25 to the office-visit line.',
    recap: "Fixed at the source. The chart documents that the office visit was separate from the lesion removal — modifier 25 is exactly the field for 'significant, separately identifiable E&M.' Once it's on the line, NCCI no longer bundles them.",
    verb: 'amend',
  },
  {
    id: 'separately-identifiable',
    label: "Show the chart documents the E&M as significant and separately identifiable.",
    recap: "You just argued: the patient came in for one reason (hypertension recheck) and the lesion was noted incidentally during the exam — a textbook case for modifier 25. NCCI guidance explicitly allows it.",
    verb: 'cite',
  },
]

const modifierOptions: ModifierOption[] = [
  {
    code: '—',
    label: 'No modifier',
    support: 'current',
    feedback: "This is what's currently on the line — and it's why the claim was bundled.",
  },
  {
    code: '25',
    label: "Modifier 25 — significant, separately identifiable E&M",
    support: 'correct',
    feedback: "Right modifier for an E&M visit performed on the same day as a procedure when the visit was significant and separate. Matches the chart.",
  },
  {
    code: '59',
    label: "Modifier 59 — distinct procedural service",
    support: 'partial',
    feedback: "Modifier 59 marks two distinct *procedures* — but the issue here is an E&M visit alongside a procedure, not two procedures. Modifier 25 is the right tool for that.",
  },
  {
    code: '76',
    label: "Modifier 76 — repeat procedure, same physician",
    support: 'wrong',
    feedback: "Modifier 76 is for a procedure repeated by the same physician (e.g. two X-rays). That doesn't apply here — there's no repeated procedure.",
  },
]

const payerPhrases: PayerPhrase[] = [
  {
    id: 'bundled',
    text: 'CPT 99214 bundled into 11102 per NCCI edit',
    plain: "The insurance company says the office visit (99214) is automatically included in the lesion-removal procedure (11102), so they're only paying for one of them.",
    issueId: 'separately-identifiable',
  },
  {
    id: 'no-modifier',
    text: 'no separately-identifiable modifier on the E&M line',
    plain: "Their automated system didn't see modifier 25 on the office-visit line, so it merged the two services. The fix is to add the modifier and resubmit.",
    issueId: 'modifier',
  },
]

const chartFacts: ChartFact[] = [
  {
    id: 'visit-reason',
    plain: "The patient came in primarily for a hypertension recheck — a planned, scheduled visit.",
    technical: "Chief complaint: HTN follow-up; BP today 138/86; meds reviewed.",
    issueId: 'separately-identifiable',
  },
  {
    id: 'incidental',
    plain: "The doctor only noticed the skin lesion during the visit — it wasn't why she came.",
    technical: 'Skin lesion noted incidentally on exam; biopsy performed same encounter.',
    issueId: 'separately-identifiable',
  },
  {
    id: 'em-time',
    plain: "The doctor spent real time on the visit (review of meds, BP discussion) — not just the procedure.",
    technical: "E&M time documented: 22 min counseling, history, exam (HTN-focused).",
    issueId: 'separately-identifiable',
  },
  {
    id: 'biopsy-tech',
    plain: "The biopsy itself was a quick procedure (a few minutes).",
    technical: "Tangential biopsy of dorsal forearm lesion: ~3 min, no complications.",
    issueId: null,
    distractorReason: "How long the biopsy took isn't relevant to whether the E&M was separately identifiable. The biopsy is its own service.",
  },
]

const ncciClauses: NcciClause[] = [
  {
    id: 'mod25-rule',
    plain: "Modifier 25 may be added to an E&M visit when it's significant and separately identifiable from a procedure done the same day.",
    technical: "Per NCCI guidance: modifier 25 may be appended to E&M when documentation supports a significant, separately identifiable E&M service on the same day as a procedure.",
    issueId: 'separately-identifiable',
  },
  {
    id: 'em-criteria',
    plain: "The visit qualifies if the doctor did real medical work beyond the procedure — like reviewing meds, exam, counseling.",
    technical: "E&M qualifies as separately identifiable when documentation shows history, exam, and medical decision-making distinct from the procedure's own pre/intra/post work.",
    issueId: 'separately-identifiable',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'CO-97': {
    term: 'CO-97',
    plain: "A denial code for 'bundled' — the insurance company says two services on the same day count as one for payment. They'll pay for the bigger one and reject the other.",
  },
  'NCCI': {
    term: 'NCCI (National Correct Coding Initiative)',
    plain: "A set of automated edits the insurance companies use to catch service combinations they consider redundant. NCCI tables list which CPT codes get bundled with which others. Modifier 25 (and a few others) tell the edit 'these are actually separate, here's why.'",
  },
  'modifier 25': {
    term: 'Modifier 25',
    plain: "A two-digit code added to an E&M billing line to flag: 'this office visit was a significant, separately identifiable service from the procedure done the same day.' One of the most-missed modifiers in real billing.",
  },
  '99214': {
    term: 'CPT 99214',
    plain: "An office visit, established patient, moderate complexity. The 'visit' part of this claim — distinct from the procedure.",
  },
  '11102': {
    term: 'CPT 11102',
    plain: "Tangential skin biopsy. The 'procedure' part of this claim — the lesion removal.",
  },
  'E&M': {
    term: "E&M (Evaluation and Management)",
    plain: "Doctor visits where the work is exam, history, and medical decision-making — as opposed to procedures (cutting, sewing, imaging). Insurance pays for E&M and procedures separately, IF you mark them as separate.",
  },
  'CMS-1500': {
    term: 'CMS-1500',
    plain: "The standard claim form for outpatient services. Numbered boxes; this encounter cares about Box 24 (service lines, including the modifier field).",
  },
}

// === Runtime state ===

interface SelectionState {
  payerId: string | null
  chartId: string | null
  ncciId: string | null
}

const state = {
  briefingDone: false,
  briefingOpen: false,
  amendOpen: false,
  amendFeedback: null as { code: string; message: string } | null,
  /** Current modifier on the E&M line (Box 24, line 1). */
  currentModifier: '—',
  selection: { payerId: null, chartId: null, ncciId: null } as SelectionState,
  resolvedIssues: new Set<string>(),
  citationCount: 0,
  failedAttempts: 0,
  feedback: '' as string,
  feedbackKind: 'neutral' as 'neutral' | 'good' | 'bad',
  lastRecap: '' as string,
  packetSubmitted: false,
  openTermId: null as string | null,
}

const bundleCase = CASES.case_bundle_kim

// === Rendering ===

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
        <h1>Bundle <span class="muted">@ L4</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./">← back to game</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          AMEND-dominant: the fix is a missing modifier on Box 24,
          not a wrong diagnosis code. A clean surgical claim bounced
          on a technicality. See the <a href="#design-notes">design notes</a>
          for what this prototype is testing.
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
        Dr. Patel, the dermatologist, leans into your office.
        "Hey — Sarah Kim's claim from last week. Cigna paid me for
        the biopsy but rejected the office visit. They said it was
        bundled. But she came in for hypertension! I noticed the
        spot during the exam, did the biopsy, but the visit was
        its own thing."
      </p>
      <p>
        He drops the chart on your desk. You start reading.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and somewhere in the building, a door you've never
        used opens. The hum of the fluorescents shifts. You're
        somewhere else.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : "Different shape from the Wraith. Listen up."}</span>
    </div>
    <div class="briefing-body">
      <p>
        "This one is a Bundle. The insurance company saw two
        services on the same day and decided to only pay for
        one. The fix is usually small: there's a <strong>two-digit
        modifier</strong> that tells their automated
        system 'these are actually separate.'"
      </p>
      <p>
        "Two ways to address this:"
      </p>
      <ul>
        <li>
          <strong>Amend the claim.</strong> Add the right
          modifier (it's called a ${term('modifier 25')}) to the
          office-visit line. Click the line on the claim above
          to open the modifier picker. <em>This is the cheap
          fix.</em> Most bundles resolve here.
        </li>
        <li>
          <strong>Build a citation.</strong> If you want to
          back up the modifier with chart evidence — show that
          the office visit really was separate from the
          procedure — connect a chart fact to the
          ${term('NCCI')} guidance. <em>This is the appeal-ready
          version.</em>
        </li>
      </ul>
      <p>
        "Two issues to resolve. Pick the right modifier, and
        cite the chart against the bundling rule. Click any
        underlined term for what it means."
      </p>
      <p class="briefing-sign">"Modifier 25 isn't a trick. It's a sentence. — D."</p>
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

function renderClaim(): string {
  const claim = bundleCase.claim
  if (!claim || claim.type !== 'cms1500') return ''
  const modifierResolved = state.resolvedIssues.has('modifier')
  const modifierText = state.currentModifier === '—' ? 'no modifier' : `mod ${state.currentModifier}`
  return `
    <div class="claim-with-annotations">
      <section class="claim">
        <div class="claim-h">
          ${term('CMS-1500')} · ${escape(claim.claimId)}
          <span class="claim-explainer">(this is the bill the doctor's office sent to insurance)</span>
        </div>
        <div class="claim-grid">
          <div><b>Patient:</b> ${escape(claim.patient.name)} · ${escape(claim.patient.dob)}</div>
          <div><b>Insurer:</b> ${escape(claim.insured.name ?? '')} · ${escape(claim.insured.id)}</div>
        </div>
        <div class="claim-section">
          <div class="claim-section-h">Box 21 · Diagnoses</div>
          <ul class="dx">
            ${claim.diagnoses.map((d, i) => {
              const letter = String.fromCharCode(65 + i)
              return `<li><b>${letter}.</b> ${escape(d.code)}${d.label ? ' — ' + escape(d.label) : ''}</li>`
            }).join('')}
          </ul>
        </div>
        <div class="claim-section service-section">
          <div class="claim-section-h">
            Box 24 · Service Lines
            ${modifierResolved
              ? '<span class="claim-status amended">AMENDED</span>'
              : '<span class="claim-status disputed">DISPUTED</span>'}
          </div>
          <table class="lines">
            <thead><tr><th>DOS</th><th>POS</th><th>CPT</th><th>Modifier</th><th>Charges</th></tr></thead>
            <tbody>
              <tr class="${modifierResolved ? 'amended' : 'hi'}">
                <td>${escape(claim.serviceLines[0].dos)}</td>
                <td>${escape(claim.serviceLines[0].pos)}</td>
                <td>${term('99214', claim.serviceLines[0].cpt.code + (claim.serviceLines[0].cpt.label ? ' — ' + claim.serviceLines[0].cpt.label : ''))}</td>
                <td class="modifier-cell">
                  ${modifierResolved
                    ? `<span class="mod-applied">${escape(state.currentModifier)}</span>`
                    : `<span class="mod-missing">${escape(modifierText)}</span><span class="dx-arrow" aria-hidden="true">⟶</span>`}
                </td>
                <td>${escape(claim.serviceLines[0].charges)}</td>
              </tr>
              <tr>
                <td>${escape(claim.serviceLines[1].dos)}</td>
                <td>${escape(claim.serviceLines[1].pos)}</td>
                <td>${term('11102', claim.serviceLines[1].cpt.code + (claim.serviceLines[1].cpt.label ? ' — ' + claim.serviceLines[1].cpt.label : ''))}</td>
                <td class="modifier-cell">—</td>
                <td>${escape(claim.serviceLines[1].charges)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      ${modifierResolved ? '' : `
        <aside class="claim-annotations">
          <button class="amend-callout" data-action="open-amend">
            <span class="amend-callout-arrow" aria-hidden="true">⟵</span>
            <span class="amend-callout-body">
              <span class="amend-callout-main">✎ Add the missing modifier</span>
              <span class="amend-callout-sub">The office-visit line (99214) needs a modifier to unbundle from the procedure. Click to amend.</span>
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
          <span class="amend-tag">AMEND BOX 24 · MODIFIER (line 1: 99214)</span>
          <span class="amend-sub">Pick the modifier that fits the chart.</span>
        </div>
        <div class="amend-context">
          <strong>The chart says:</strong> patient seen for HTN recheck (planned visit), lesion noted incidentally during exam, biopsy performed same encounter.
        </div>
        <ul class="amend-options">
          ${modifierOptions.map(opt => {
            const fb = state.amendFeedback?.code === opt.code ? state.amendFeedback : null
            return `
              <li class="amend-option ${opt.support === 'current' ? 'current' : ''} ${fb ? 'rejected' : ''}"
                  ${opt.support === 'current' ? '' : `data-action="pick-mod" data-code="${opt.code}"`}>
                <div class="amend-option-h">
                  <code>${escape(opt.code)}</code>
                  <span class="amend-option-label">${escape(opt.label)}</span>
                  ${opt.support === 'current' ? '<span class="amend-option-badge current">currently on line</span>' : ''}
                </div>
                ${fb ? `<div class="amend-option-fb">${escape(fb.message)}</div>` : ''}
              </li>
            `
          }).join('')}
        </ul>
        <p class="amend-hint-text">
          The chart is the source of truth. Wrong picks give feedback (no penalty).
        </p>
      </div>
    </div>
  `
}

function renderWorkbench(): string {
  const phraseById = (id: string) => {
    const p = payerPhrases.find(pp => pp.id === id)
    return p ? phraseSpan(p) : ''
  }
  return `
    <section class="workbench">
      <div class="col col-payer">
        <div class="col-h">
          <span class="col-tag">PAYER NOTE</span>
          <span class="col-sub">The denial. Hover a red phrase for plain English; click to select.</span>
        </div>
        <p class="col-prose">
          Cigna denied the office-visit charge. They said it was
          ${phraseById('bundled')} because there was
          ${phraseById('no-modifier')}.
        </p>
      </div>
      <div class="col col-chart">
        <div class="col-h">
          <span class="col-tag">CHART (Kim, S.)</span>
          <span class="col-sub">What Dr. Patel wrote. Click a fact to cite it.</span>
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
          <span class="col-tag">${term('NCCI')} GUIDANCE</span>
          <span class="col-sub">Coding rules from the National Correct Coding Initiative. Click a clause to back a citation.</span>
        </div>
        <ul class="clauses">
          ${ncciClauses.map(c => `
            <li class="clause ${state.selection.ncciId === c.id ? 'selected' : ''}"
                data-action="select-ncci" data-id="${c.id}">
              <div class="clause-plain">${escape(c.plain)}</div>
              <div class="clause-technical"><span class="src">guidance:</span> ${escape(c.technical)}</div>
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
  const ncci = sel.ncciId ? ncciClauses.find(c => c.id === sel.ncciId) : null
  const ready = !!(sel.payerId && sel.chartId && sel.ncciId)
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
        <div class="slot ${ncci ? 'filled' : ''}">
          <div class="slot-label">NCCI CLAUSE</div>
          <div class="slot-text">${ncci ? escape(ncci.plain) : '<span class="placeholder">Click a guidance clause</span>'}</div>
        </div>
      </div>
      <div class="builder-actions">
        <button class="btn primary ${ready ? '' : 'disabled'}" ${ready ? '' : 'disabled'} data-action="cite">CITE</button>
        <button class="btn ghost" data-action="clear">Clear</button>
      </div>
      ${state.feedback ? `<div class="feedback ${fbClass}">${escape(state.feedback)}</div>` : ''}
      ${state.lastRecap ? `
        <div class="recap">
          <div class="recap-h">What you just did</div>
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
        SUBMIT CORRECTED CLAIM
      </button>
      ${state.failedAttempts > 0 ? `<div class="fail-counter">Tried citations that didn't fit: ${state.failedAttempts}. (No penalty.)</div>` : ''}
    </section>
  `
}

const RECAP: CaseRecap = CASE_RECAPS['bundle']

function renderVictory(): string {
  return `
    ${renderHeader()}
    <section class="victory">
      <h2>The corrected claim resubmits.</h2>
      <p class="register hospital">Hospital, the next morning.</p>
      <p>
        Cigna pays for both lines. Dr. Patel sticks his head in
        to say thanks. The corrected claim goes through their
        system in less than 12 hours — Bundles are usually quick
        once the modifier's right.
      </p>
      <p class="register waiting-room">Waiting Room.</p>
      <p>
        The Bundling Beast is gone. Where it stood, two service
        lines that had been fused are sitting on a folding table,
        side by side, with a small modifier "25" pinned between
        them like a ribbon.
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
      <h2>Design notes — what this prototype tests</h2>
      <div class="notes-grid">
        <div>
          <h3>What's different from the Wraith</h3>
          <ul>
            <li><b>AMEND-dominant.</b> The fix is a missing modifier on Box 24, not a wrong code on Box 21. Different field, different rhythm.</li>
            <li><b>Faster encounter.</b> Two issues instead of three. Modifier is one click + one pick. Cite is supporting evidence, not the main act.</li>
            <li><b>Different actors.</b> The Hospital intro is a doctor (Dr. Patel) frustrated about not getting paid — not a patient's daughter calling. Different stakeholder, different emotional register.</li>
            <li><b>NCCI guidance, not LCD.</b> Bundling rules live in the NCCI tables, not in an LCD. Same shape (rules + chart + payer claim), different reference document.</li>
            <li><b>Action button: "SUBMIT CORRECTED CLAIM"</b> instead of "SUBMIT DEFENSE PACKET" — mirrors how this work is actually framed in real life.</li>
          </ul>
        </div>
        <div>
          <h3>What this prototype proves (or tries to)</h3>
          <ul>
            <li>The framework supports both quick surgical fixes and protracted appeals — same action set (AMEND + CITE), different ratios.</li>
            <li>The claim form as playing field works for service-line modifications, not just diagnosis amendments.</li>
            <li>Margin callouts can point at any disputed row, not just Box 21.</li>
            <li>Dana's voice generalizes to different denial types — same wisdom, different specifics.</li>
            <li>The two-truths register flip (Hospital warmth → Waiting Room surreal) holds with a different patient and a different doctor.</li>
          </ul>
        </div>
      </div>
      <p class="notes-cta">
        Side-by-side comparison: open the
        <a href="./wraith-prototype.html">Wraith prototype</a>
        in another tab and see how the two encounters feel different
        despite sharing structure. That's the framework working.
      </p>
    </section>
  `
}

// === Interactions ===

function findFact(id: string) { return chartFacts.find(f => f.id === id) }
function findPayer(id: string) { return payerPhrases.find(p => p.id === id) }
function findNcci(id: string) { return ncciClauses.find(c => c.id === id) }

function setFeedback(text: string, kind: 'good' | 'bad' | 'neutral' = 'neutral') {
  state.feedback = text
  state.feedbackKind = kind
}

function clearSelection() {
  state.selection = { payerId: null, chartId: null, ncciId: null }
}

function attemptCite() {
  const sel = state.selection
  if (!sel.payerId || !sel.chartId || !sel.ncciId) return

  const payer = findPayer(sel.payerId)!
  const chart = findFact(sel.chartId)!
  const ncci = findNcci(sel.ncciId)!

  if (chart.issueId === null) {
    state.failedAttempts += 1
    setFeedback(
      `That fact doesn't follow. ${chart.distractorReason ?? ''} Try another.`,
      'bad'
    )
    state.lastRecap = ''
    return
  }

  if (payer.issueId === chart.issueId && chart.issueId === ncci.issueId) {
    const issue = issues.find(i => i.id === chart.issueId)!

    if (issue.verb === 'amend') {
      state.failedAttempts += 1
      setFeedback(
        "These pieces line up — but this issue is solved by *amending* the claim, not arguing. Click the 'Add the missing modifier' callout next to the claim.",
        'bad'
      )
      state.lastRecap = ''
      return
    }

    if (state.resolvedIssues.has(chart.issueId)) {
      setFeedback(
        'Already cited. The other issue still needs work — check the checklist.',
        'neutral'
      )
      state.lastRecap = ''
      return
    }
    state.resolvedIssues.add(chart.issueId)
    state.citationCount += 1
    setFeedback(`Citation accepted. Issue addressed: ${issue.label}`, 'good')
    state.lastRecap = issue.recap
    clearSelection()
    return
  }

  state.failedAttempts += 1
  setFeedback(buildMismatchFeedback(payer, chart, ncci), 'bad')
  state.lastRecap = ''
}

function buildMismatchFeedback(
  payer: PayerPhrase,
  chart: ChartFact,
  ncci: NcciClause,
): string {
  const lines: string[] = []
  lines.push("Those three don't fit together yet. Here's where each one points:")
  lines.push('')
  lines.push(`• Payer phrase: addresses "${issueDescription(payer.issueId)}".`)
  if (chart.issueId === null) {
    lines.push(`• Chart fact: distractor — ${chart.distractorReason ?? 'not relevant.'}`)
  } else {
    const issue = issues.find(i => i.id === chart.issueId)!
    if (issue.verb === 'amend') {
      lines.push(`• Chart fact: this is amend territory — use the modifier callout next to the claim.`)
    } else {
      lines.push(`• Chart fact: addresses "${issueDescription(chart.issueId)}".`)
    }
  }
  const ncciIssue = issues.find(i => i.id === ncci.issueId)!
  if (ncciIssue.verb === 'amend') {
    lines.push(`• Guidance clause: this is amend territory — use the modifier callout.`)
  } else {
    lines.push(`• Guidance clause: addresses "${issueDescription(ncci.issueId)}".`)
  }
  lines.push('')
  lines.push('A citation works when all three pieces address the same issue.')
  return lines.join('\n')
}

function issueDescription(issueId: string): string {
  const issue = issues.find(i => i.id === issueId)
  return issue ? issue.label : '(unknown)'
}

function attemptAmend(code: string) {
  const opt = modifierOptions.find(d => d.code === code)
  if (!opt) return

  if (opt.support === 'wrong' || opt.support === 'partial') {
    state.failedAttempts += 1
    state.amendFeedback = { code: opt.code, message: opt.feedback }
    return
  }

  state.currentModifier = opt.code
  state.amendOpen = false
  state.amendFeedback = null
  if (!state.resolvedIssues.has('modifier')) {
    state.resolvedIssues.add('modifier')
    const issue = issues.find(i => i.id === 'modifier')!
    setFeedback(
      `Claim amended. Modifier ${opt.code} now on the office-visit line. Issue addressed.`,
      'good'
    )
    state.lastRecap = issue.recap
  }
}

function attemptSubmit() {
  if (state.resolvedIssues.size < issues.length) return
  state.packetSubmitted = true
  notifyParentVictory('bundle')
}

function reset() {
  state.selection = { payerId: null, chartId: null, ncciId: null }
  state.resolvedIssues = new Set()
  state.citationCount = 0
  state.failedAttempts = 0
  state.feedback = ''
  state.feedbackKind = 'neutral'
  state.lastRecap = ''
  state.packetSubmitted = false
  state.briefingDone = false
  state.amendOpen = false
  state.currentModifier = '—'
}

function dismissBriefing() { state.briefingDone = true; state.briefingOpen = false }
function showBriefing() { state.briefingOpen = true }
function closeBriefing() { state.briefingOpen = false }
function openAmend() { state.amendOpen = true; state.amendFeedback = null }
function closeAmend() { state.amendOpen = false; state.amendFeedback = null }
function openTerm(termId: string) { state.openTermId = termId }
function closeTerm() { state.openTermId = null }

function handleClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.classList.contains('briefing-popover-backdrop')) {
    closeBriefing(); rerender(); return
  }
  if (target.classList.contains('term-popover-backdrop')) {
    closeTerm(); rerender(); return
  }
  if (target.classList.contains('amend-modal-backdrop')) {
    closeAmend(); rerender(); return
  }
  const el = target.closest('[data-action]') as HTMLElement | null
  if (!el) return
  const action = el.dataset.action
  const id = el.dataset.id
  switch (action) {
    case 'select-payer': state.selection.payerId = id ?? null; setFeedback(''); break
    case 'select-chart': state.selection.chartId = id ?? null; setFeedback(''); break
    case 'select-ncci':  state.selection.ncciId  = id ?? null; setFeedback(''); break
    case 'cite': attemptCite(); break
    case 'clear': clearSelection(); setFeedback(''); state.lastRecap = ''; break
    case 'submit': attemptSubmit(); break
    case 'reset': reset(); break
    case 'set-mode': /* no mode */ break
    case 'dismiss-briefing': dismissBriefing(); break
    case 'show-briefing': showBriefing(); break
    case 'close-briefing': closeBriefing(); break
    case 'open-amend': openAmend(); break
    case 'close-amend': closeAmend(); break
    case 'pick-mod': if (el.dataset.code) attemptAmend(el.dataset.code); break
    case 'open-term': if (el.dataset.term) openTerm(el.dataset.term); break
    case 'close-term': closeTerm(); break
    default: return
  }
  rerender()
}

// === Mount ===

// Bundle-specific CSS only — base styles come from BASE_CSS.
const css = districtVars('coding') + BASE_CSS + `
  /* Override claim-annotations padding — Bundle's callout sits next to
     Box 24 (service lines), which is further down than Box 21. */
  .claim-annotations { padding-top: 220px; }
  .modifier-cell { white-space: nowrap; }

  /* Three-column workbench — payer phrases / chart facts / NCCI clauses. */
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

  /* Payer phrases inline in prose. */
  .phrase {
    cursor: pointer; background: rgba(239, 91, 123, 0.15);
    border-bottom: 1px dashed var(--bad);
    padding: 2px 5px; border-radius: 3px;
    transition: background 0.15s;
    position: relative; display: inline;
  }
  .phrase:hover { background: rgba(239, 91, 123, 0.32); }
  .phrase.selected { background: rgba(239, 91, 123, 0.5); border-bottom-style: solid; color: #fff; box-shadow: inset 0 0 0 1px var(--bad); }
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
    background: rgba(126, 226, 193, 0.18);
    color: rgba(216, 222, 233, 0.7);
    box-shadow: inset 0 0 0 1px rgba(126, 226, 193, 0.5);
  }

  /* Hover tooltip for payer phrases. */
  .hover-tip {
    position: absolute; bottom: calc(100% + 8px); left: 0;
    z-index: 50; min-width: 200px; max-width: 320px;
    padding: 10px 14px;
    background: var(--panel); color: var(--ink);
    border: 1px solid var(--accent); border-radius: 6px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
    font-size: 12.5px; line-height: 1.5; font-style: italic;
    text-transform: none; letter-spacing: normal; white-space: normal;
    pointer-events: none; opacity: 0; transform: translateY(6px);
    transition: opacity 0.18s, transform 0.18s;
  }
  .hover-tip::after { content: ""; position: absolute; top: 100%; left: 18px; border: 7px solid transparent; border-top-color: var(--accent); }
  .phrase:hover .hover-tip { opacity: 1; transform: translateY(0); }
  .phrase-tip { border-color: var(--bad); color: var(--ink); font-style: normal; }
  .phrase-tip::after { border-top-color: var(--bad); }

  /* Chart fact / NCCI clause cards. */
  .facts, .clauses { list-style: none; padding-left: 0; margin: 0; }
  .fact, .clause { padding: 10px 12px; margin: 6px 0; background: var(--panel-2); border-radius: 5px; border-left: 3px solid transparent; cursor: pointer; transition: all 0.15s; position: relative; }
  .fact:hover, .clause:hover { background: #232b3a; }
  .fact.selected { border-left-color: var(--accent); background: rgba(126, 226, 193, 0.1); }
  .clause.selected { border-left-color: #a3c5ff; background: rgba(163, 197, 255, 0.08); }
  .fact-plain, .clause-plain { font-size: 13.5px; color: var(--ink); line-height: 1.45; }
  .fact-technical, .clause-technical { font-size: 11px; color: rgba(138, 147, 163, 0.65); margin-top: 6px; padding-top: 5px; border-top: 1px dashed rgba(138, 147, 163, 0.15); line-height: 1.4; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .fact-technical .src, .clause-technical .src { color: rgba(138, 147, 163, 0.45); text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px; margin-right: 4px; font-family: inherit; }

  /* Citation builder. */
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
