// Intro @ L1 — "The Wrong Card." The teaching encounter.
//
// Ported from the runtime puzzle engine (INTRO_PUZZLE) into the
// standalone iframe-prototype format every other encounter uses.
// Eligibility district (mint accent). The simplest possible shape:
//
//   - A single verb: AMEND. There is no reveal, no inquiry, no
//     timer, no queue. One disputed field on the claim (Box 1a),
//     one picker, one correct answer.
//   - The denial is clerical, not adversarial. Anjali handed her
//     husband's Aetna card to the registrar at the ER counter —
//     same plan, his subscriber id, not hers. The 837 went out
//     under his id; Aetna's roster has her as a dependent under
//     her own id, so it bounced CO-31 ("patient cannot be
//     identified as our insured").
//
// Why this is the opener: it's the clearest demo of the puzzle
// loop (briefing → claim → amend → SUBMIT → victory), the hook is
// universally relatable, and the hospital ↔ waiting-room layer-
// shift runs once at low stakes before any of it has to carry
// narrative weight. Content (hospital intro, Dana's briefing, the
// amend feedback strings, the victory text) was ported from the
// original runtime intro puzzle spec (since retired).

import { CASES } from '../content/cases'
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory } from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

interface AmendOption {
  value: string
  /** Display label (id + name, where present). */
  label: string
  support: 'current' | 'correct' | 'partial' | 'wrong'
  feedback: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'amend'
}

interface GlossaryEntry {
  term: string
  plain: string
}

const issues: Issue[] = [
  {
    id: 'subscriber-id',
    label: "Amend Box 1a — swap to Anjali's subscriber id, not her husband's.",
    recap: "The 271 eligibility response had her id (AET447821491) all along. The card photocopy lied — or rather, it was the wrong card. Box 1a now matches the payer's roster; the claim adjudicates clean on the next pass.",
    verb: 'amend',
  },
]

// Box 1a amend options, ported from INTRO_PUZZLE.amendSlots[0].
const subscriberOptions: AmendOption[] = [
  {
    value: 'AET447821903',
    label: 'AET447821903 — PATEL, RAVI',
    support: 'current',
    feedback: "What's currently on the claim. That's the husband's id; Aetna's roster has him as the subscriber, not Anjali. CO-31 again.",
  },
  {
    value: 'AET447821491',
    label: 'AET447821491 — PATEL, ANJALI',
    support: 'correct',
    feedback: "Matches the 271 response. Anjali is on the plan as a dependent under her own id; Box 1a now lines up with the payer's roster.",
  },
  {
    value: 'AET44782149',
    label: 'AET44782149',
    support: 'partial',
    feedback: "Close — but you dropped the trailing digit. Aetna IDs are 11 characters after the prefix.",
  },
]

// 271 source of truth for the amend context line.
const SUBSCRIBER_TRUTH = 'AET447821491'

const glossary: Record<string, GlossaryEntry> = {
  'CMS-1500': {
    term: 'CMS-1500',
    plain: "The standard claim form for professional / outpatient services. Numbered boxes; this encounter cares about Box 1a (insured's subscriber ID) — the field registration most often gets wrong when a family member's card gets handed over by mistake.",
  },
  'subscriber': {
    term: 'Subscriber vs dependent',
    plain: "On a family plan, the subscriber is the policyholder; spouses and children are dependents. Each member has their own subscriber ID. Box 1a must carry the patient's own ID — not the household's, not whoever's card happened to be in the wallet.",
  },
  '271': {
    term: '271 (eligibility response)',
    plain: "The payer's reply to a 270 eligibility inquiry. The 271 carries the official record — current plan, subscriber ID, dependent status, copay, network indicator. The 271 is the source of truth; the card photocopy is not.",
  },
  'CO-31': {
    term: 'CO-31 (patient not identifiable)',
    plain: "Claim adjustment reason code: \"patient cannot be identified as our insured.\" A clerical denial — the demographics on the claim don't match the payer's member record. Almost always fixed by amending Box 1a or the patient name to match the 271, then resubmitting. No appeal needed.",
  },
  '837': {
    term: '837 (electronic claim)',
    plain: "The X12 EDI transaction that carries the claim from the provider to the payer — the electronic equivalent of the CMS-1500 paper form. When the data in it doesn't match the payer's roster, it bounces back as a rejection or denial.",
  },
}

// === Runtime state ===

const state = {
  briefingDone: false,
  briefingOpen: false,
  amendOpen: false,
  amendFeedback: null as { value: string; message: string } | null,
  /** Current Box 1a value. Mutate as the player amends. */
  claim: {
    subscriberId: 'AET447821903',
    subscriberName: 'PATEL, RAVI',
  },
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  feedback: '' as string,
  feedbackKind: 'neutral' as 'neutral' | 'good' | 'bad',
  lastRecap: '' as string,
  packetSubmitted: false,
  openTermId: null as string | null,
}

const introCase = CASES.case_intro_patel

// === Rendering ===

function term(termId: string, displayText?: string): string {
  const entry = glossary[termId]
  const text = displayText ?? termId
  if (!entry) return escape(text)
  return `<span class="term" data-action="open-term" data-term="${termId}" title="${escape(entry.plain)}">${escape(text)}<span class="term-icon">?</span></span>`
}

function render(): string {
  if (state.packetSubmitted) {
    return renderHeader() + renderVictory() + renderTermPopover() + renderBriefingPopover() + renderAmendModal()
  }
  return `
    ${renderHeader()}
    ${renderHospitalIntro()}
    ${!state.briefingDone ? renderBriefingInline() : `
      ${renderClaim()}
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
        <h1>The Wrong Card <span class="muted">@ L1 — the teaching encounter</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./">← back to game</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          The opener. The simplest possible demonstration of the
          puzzle loop — one disputed field, one verb. Anjali
          handed her husband's ${term('CMS-1500', 'Aetna card')} to
          the registrar; the claim went out under
          <em>his</em> ${term('subscriber', 'subscriber id')} and
          bounced ${term('CO-31')}. Click Box 1a, pick her actual
          id from the ${term('271')} response, and SUBMIT. This is
          the shape of half the job. See the
          <a href="#design-notes">design notes</a> for what it's
          teaching.
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
        Anjali is at the patient-services counter holding a $387
        ER bill. "I had strep throat last week. I gave them my
        card. It said 'accepted.' Now they're saying I'm not on
        the plan?"
      </p>
      <p>
        You pull up the file. The card she handed to the
        registrar was her husband's — same Aetna PPO, same family
        group, but his subscriber id, not hers. The claim went
        out under <em>his</em> name. Aetna's roster lists him as
        the subscriber and her as a dependent with her own id.
        ${term('CO-31')} — "patient cannot be identified as our
        insured." Two minutes of work to fix.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the counter goes quiet. The fluorescents hum a
        half-step lower. The floor tilts, just slightly, the way
        a dream does right before you notice it's a dream. You're
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'Your first day. Listen up.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "Welcome to the building. You'll get a feel for the rhythm
        fast. Most of what we do here looks like this one: somebody
        in the chain typed the wrong thing into a box, and the
        payer's computer kicked it back. A typo, a card swap, a
        missing field."
      </p>
      <p>
        "You're going to learn one verb today:"
      </p>
      <ul>
        <li>
          <strong>AMEND.</strong> Click a disputed field on the
          claim and pick what should actually be there. The chart
          and the payer's ${term('271', 'eligibility record')} are
          your sources of truth — not the photocopy of the card.
        </li>
        <li>
          There are bigger fights upstairs and downstairs. We'll
          get to those. <em>This one</em> is the shape of half your
          job: a small thing, fixed cleanly, before it becomes
          someone's collections problem.
        </li>
      </ul>
      <p class="briefing-sign">"Welcome aboard. — D."</p>
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
  const claim = introCase.claim
  if (!claim || claim.type !== 'cms1500') return ''
  const resolved = state.resolvedIssues.has('subscriber-id')
  const idStatus = resolved ? 'amended' : 'wrong'
  const idCellHtml = resolved
    ? `<span class="mod-applied">${escape(state.claim.subscriberId)} — ${escape(state.claim.subscriberName)}</span>`
    : `<span class="mod-missing">${escape(state.claim.subscriberId)} — ${escape(state.claim.subscriberName)}</span>`
  return `
    <div class="claim-with-annotations">
      <section class="claim">
        <div class="claim-h">
          ${term('CMS-1500')} · ${escape(claim.claimId)}
          <span class="claim-explainer">${resolved
            ? '(Box 1a amended. Ready to resubmit.)'
            : '(bounced CO-31. Box 1a is disputed.)'}</span>
        </div>
        <div class="claim-grid">
          <div><b>Patient:</b> ${escape(claim.patient.name)} · ${escape(claim.patient.dob)}</div>
          <div class="${idStatus}-row">
            <b>Box 1a · Subscriber ID:</b> ${idCellHtml}
            ${idStatus === 'wrong' ? '<span class="dx-arrow" aria-hidden="true">⟶</span>' : ''}
          </div>
          <div><b>Insurer:</b> ${escape(claim.insured.name ?? '')} · Aetna PPO</div>
          <div><b>Box 11 · Group:</b> ${escape(claim.insured.group ?? '')}</div>
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
        <div class="claim-section">
          <div class="claim-section-h">Box 24 · Service Lines</div>
          <table class="lines">
            <thead><tr><th>DOS</th><th>POS</th><th>CPT</th><th>Charges</th></tr></thead>
            <tbody>
              ${claim.serviceLines.map(line => `
                <tr>
                  <td>${escape(line.dos)}</td>
                  <td>${escape(line.pos)}</td>
                  <td>${escape(line.cpt.code)}${line.cpt.label ? ' — ' + escape(line.cpt.label) : ''}</td>
                  <td>${escape(line.charges)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
      <aside class="claim-annotations">
        ${resolved
          ? `<div class="resolved-note">
              <div class="resolved-note-icon">✓</div>
              <div class="resolved-note-body">
                <div class="resolved-note-main">Box 1a resolved</div>
                <div class="resolved-note-sub">Now matches the 271. Resubmit below.</div>
              </div>
            </div>`
          : `<button class="amend-callout" data-action="open-amend">
              <span class="amend-callout-arrow" aria-hidden="true">⟵</span>
              <span class="amend-callout-body">
                <span class="amend-callout-main">✎ Subscriber ID disputed</span>
                <span class="amend-callout-sub">CO-31. The 271 returned a different id. Click to amend.</span>
              </span>
            </button>`}
      </aside>
    </div>
  `
}

function renderAmendModal(): string {
  if (!state.amendOpen) return ''
  const currentValue = state.claim.subscriberId
  return `
    <div class="amend-modal-backdrop">
      <div class="amend-modal">
        <button class="amend-modal-close" data-action="close-amend" aria-label="Close">×</button>
        <div class="amend-modal-h">
          <span class="amend-tag">AMEND BOX 1A · SUBSCRIBER ID</span>
          <span class="amend-sub">Pick the value that matches the 271 response.</span>
        </div>
        <div class="amend-context">
          <strong>Aetna ${term('271')} response, ran just now:</strong>
          subscriber ${escape(SUBSCRIBER_TRUTH)} (Patel, Anjali, dependent).
          The card on file is AET447821903 (Patel, Ravi).
          <span class="amend-context-aside">(currently on claim: <code>${escape(currentValue)}</code>)</span>
        </div>
        <ul class="amend-options">
          ${subscriberOptions.map(opt => {
            const fb = state.amendFeedback?.value === opt.value ? state.amendFeedback : null
            const isCurrent = opt.value === currentValue
            return `
              <li class="amend-option ${isCurrent ? 'current' : ''} ${fb ? 'rejected' : ''}"
                  ${isCurrent ? '' : `data-action="pick-amend" data-value="${escape(opt.value)}"`}>
                <div class="amend-option-h">
                  <code>${escape(opt.label)}</code>
                  ${isCurrent ? '<span class="amend-option-badge current">currently on claim</span>' : ''}
                </div>
                ${fb ? `<div class="amend-option-fb">${escape(fb.message)}</div>` : ''}
              </li>
            `
          }).join('')}
        </ul>
        <p class="amend-hint-text">
          The 271 is the source of truth. Wrong picks give feedback (no penalty).
        </p>
      </div>
    </div>
  `
}

function renderChecklist(): string {
  const allResolved = state.resolvedIssues.size === issues.length
  return `
    <section class="checklist">
      <div class="checklist-h">Pre-resubmission checklist — ${state.resolvedIssues.size} of ${issues.length} step${issues.length === 1 ? '' : 's'} complete</div>
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
      ${state.failedAttempts > 0 ? `<div class="fail-counter">Wrong picks so far: ${state.failedAttempts}. (No penalty.)</div>` : ''}
    </section>
  `
}

const RECAP: CaseRecap = CASE_RECAPS['intro']

function renderVictory(): string {
  return `
    <section class="victory">
      <h2>You blink.</h2>
      <p class="register waiting-room">Waiting Room.</p>
      <p>
        You're at your desk. Or — you never left.
      </p>
      <p class="register hospital">Hospital, the same morning.</p>
      <p>
        The screen in front of you shows the claim has
        resubmitted. Anjali is still standing across the counter,
        still holding the bill.
      </p>
      <p>
        She hasn't realized anything has happened yet.
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
          <h3>What's different from the others</h3>
          <ul>
            <li><b>It's the floor, not a wall.</b> One issue, one picker, one verb. Every other prototype layers a second mechanic on top of AMEND; this one is AMEND alone, so the loop itself is the lesson.</li>
            <li><b>The denial is clerical, not adversarial.</b> Nobody is fighting the claim — a card got swapped at the counter. Sets the tone: most "denials" are mistakes, and someone has to know the rules well enough to catch them.</li>
            <li><b>Universally relatable hook.</b> Everyone has fumbled an insurance card or watched a loved one do it. No prior revenue-cycle knowledge required to feel the problem.</li>
            <li><b>The layer-shift runs once at low stakes.</b> Hospital → Waiting Room → back, with nothing narrative riding on it yet. The player learns the register flip before it has to carry weight.</li>
            <li><b>A decoy that teaches precision.</b> The partial id (dropped trailing digit) isn't a trap so much as a lesson: payer IDs are exact-match; close is a denial.</li>
          </ul>
        </div>
        <div>
          <h3>What this prototype proves (or tries to)</h3>
          <ul>
            <li>The puzzle loop reads cleanly with zero scaffolding — briefing → claim → amend → submit → victory, no inquiry, no timer, no queue.</li>
            <li>A single correct amend can feel like a complete encounter when the framing (a real person, a real bill) carries it.</li>
            <li>Dana's voice establishes the AMEND verb here so later prototypes can assume it and build on top.</li>
            <li>CO-31 / subscriber-vs-dependent is teachable in two minutes through the form, not a lecture.</li>
            <li>The standalone iframe format can host the tutorial as faithfully as the deleted runtime engine did.</li>
          </ul>
        </div>
      </div>
      <p class="notes-cta">
        Next step up: open
        <a href="./fog-prototype.html">Fog</a> — same eligibility
        district, same AMEND spine, but it adds the REVEAL verb (run
        a 270, clear the fog, then amend). This prototype is what Fog
        assumes you already know.
      </p>
    </section>
  `
}

// === Interactions ===

function setFeedback(text: string, kind: 'good' | 'bad' | 'neutral' = 'neutral') {
  state.feedback = text
  state.feedbackKind = kind
}

function attemptAmend(value: string) {
  const opt = subscriberOptions.find(o => o.value === value)
  if (!opt) return
  if (opt.support !== 'correct') {
    state.failedAttempts += 1
    state.amendFeedback = { value: opt.value, message: opt.feedback }
    return
  }
  // Apply the correct amend.
  state.claim.subscriberId = value
  state.claim.subscriberName = 'PATEL, ANJALI'
  if (!state.resolvedIssues.has('subscriber-id')) {
    state.resolvedIssues.add('subscriber-id')
    const issue = issues.find(i => i.id === 'subscriber-id')!
    setFeedback(`Box 1a amended to ${value}. Issue addressed.`, 'good')
    state.lastRecap = issue.recap
  }
  state.amendOpen = false
  state.amendFeedback = null
}

function attemptSubmit() {
  if (state.resolvedIssues.size < issues.length) return
  state.packetSubmitted = true
  notifyParentVictory('intro')
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  state.amendOpen = false
  state.amendFeedback = null
  state.claim = { subscriberId: 'AET447821903', subscriberName: 'PATEL, RAVI' }
  state.resolvedIssues = new Set()
  state.failedAttempts = 0
  state.feedback = ''
  state.feedbackKind = 'neutral'
  state.lastRecap = ''
  state.packetSubmitted = false
  state.openTermId = null
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
  switch (action) {
    case 'open-amend': openAmend(); break
    case 'close-amend': closeAmend(); break
    case 'pick-amend': if (el.dataset.value) attemptAmend(el.dataset.value); break
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

// === Mount ===

// Intro-specific CSS — claim box-row state styles + the resolved-note
// side panel. Base styles (claim form, amend modal, briefing, buttons,
// register flip, victory) all come from BASE_CSS.
const css = districtVars('eligibility') + BASE_CSS + `
  .claim-annotations { width: 240px; padding-top: 60px; display: flex; flex-direction: column; gap: 10px; }

  /* Box-row state styles. */
  .claim-grid > div { padding: 4px 6px; border-radius: 3px; }
  .wrong-row { background: var(--hi); box-shadow: inset 0 0 0 1px var(--hi-border); }
  .amended-row { background: rgba(126, 226, 193, 0.15); box-shadow: inset 0 0 0 1px var(--good); }

  /* Amend modal — show currently-on-claim value alongside 271 truth. */
  .amend-context { display: flex; flex-direction: column; gap: 6px; }
  .amend-context-aside { color: var(--ink-dim); font-size: 12px; }

  /* Resolved side-note after the amend lands. */
  .resolved-note { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: rgba(126, 226, 193, 0.08); border: 1px solid #2c5547; border-radius: 8px; }
  .resolved-note-icon { font-size: 22px; color: var(--good); }
  .resolved-note-body { display: flex; flex-direction: column; gap: 4px; }
  .resolved-note-main { font-size: 12px; font-weight: 700; color: var(--good); text-transform: uppercase; letter-spacing: 0.06em; }
  .resolved-note-sub { font-size: 11.5px; color: var(--ink-dim); font-style: italic; line-height: 1.4; }
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
