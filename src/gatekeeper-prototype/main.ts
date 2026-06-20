// Gatekeeper @ L5 — Prior Authorization (CO-197).
//
// Sibling to wraith / bundle / reaper. Same shape (Hospital
// intro → dreamlike fall → Waiting Room → claim form +
// supporting panels + checklist), tuned to a different
// action set:
//
//   - A new move: the request. File a retroactive 278
//     (prior-auth inquiry). Wait. Read the response. Then
//     transcribe the auth number onto the claim.
//   - An amend finishes it. Box 23 (auth number field) gets the
//     value the 278 returned.
//
// Drops the citation builder entirely — Gatekeeper isn't an
// argument, it's a process. In its place: a real 278 form
// (locked service code + dx, picker for clinical rationale)
// and a response panel that animates back from UHC.
//
// Demonstrates: the framework holds even when the action set
// is procedural rather than argumentative. Same hospital
// intro / register flip / claim / Dana voice / checklist /
// submit shape — different middle.

import { CASES } from '../content/cases'
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

interface RationaleOption {
  id: string
  label: string
  detail: string
  /** 'correct' | 'partial' | 'wrong'. */
  support: 'correct' | 'partial' | 'wrong'
  feedback: string
}

interface ChartFact {
  id: string
  plain: string
  technical: string
}

interface UmCriterion {
  id: string
  plain: string
  technical: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'request' | 'amend'
}

interface GlossaryEntry {
  term: string
  plain: string
}

const issues: Issue[] = [
  {
    id: 'auth-request',
    label: 'File a retroactive 278 inquiry; recover the auth number from UHC.',
    recap: "You filed a clean 278 with proper clinical rationale. UHC's UM system pulled up an existing approval on file — the precert team got verbal sign-off back on Feb 4 but never circulated the auth number internally. Now you have it: PA-78294-A.",
    verb: 'request',
  },
  {
    id: 'auth-transcribe',
    label: "Transcribe auth number PA-78294-A onto Box 23 of the claim.",
    recap: "Box 23 is the prior-auth-number field. UHC's adjudication engine matches that string against their auth database. Without the number, it didn't matter that an auth existed — the claim never linked to it. With it, the gate opens.",
    verb: 'amend',
  },
]

const rationaleOptions: RationaleOption[] = [
  {
    id: 'patient-request',
    label: 'Patient requested imaging',
    detail: 'Patient asked to be evaluated with MRI.',
    support: 'wrong',
    feedback: "UHC doesn't approve elective imaging on patient request alone — there has to be a clinical indication backed by the chart. This rationale gets auto-rejected by the UM system; the request comes back denied with no auth.",
  },
  {
    id: 'preop',
    label: 'Pre-operative imaging for upcoming surgery',
    detail: 'Imaging required prior to scheduled surgical procedure.',
    support: 'wrong',
    feedback: "There's no surgery scheduled — the chart shows a conservative-treatment plan that failed. A pre-op rationale doesn't match the record and would get the 278 denied for inconsistent documentation.",
  },
  {
    id: 'acute-pain',
    label: 'Acute low back pain with new neurologic deficit',
    detail: 'Recent-onset back pain with leg numbness/weakness.',
    support: 'partial',
    feedback: "Closer — UHC's UM criteria do allow MRI for acute back pain with red flags. But Tunde's chart documents a chronic course (six weeks of failed conservative treatment), not acute red-flag presentation. The right rationale is the one that matches the chart.",
  },
  {
    id: 'failed-conservative',
    label: 'Lumbar disc herniation w/ radiculopathy; failed >6 weeks conservative tx',
    detail: 'M51.16 with leg pain; trial of PT, NSAIDs, and gabapentin failed; imaging required to plan intervention.',
    support: 'correct',
    feedback: "Matches both the chart and UHC's UM criteria for lumbar MRI. The 278 returns approved.",
  },
]

const chartFacts: ChartFact[] = [
  {
    id: 'history',
    plain: "Tunde has had radiating low-back-into-right-leg pain for about three months — got worse over the last six weeks.",
    technical: "HPI: 3-month course L-spine pain w/ R L5 radicular distribution; worsening over last 6 wks.",
  },
  {
    id: 'conservative-tx',
    plain: "Dr. Reyes already tried PT (12 sessions over 8 weeks), NSAIDs, and gabapentin. Pain still 7/10.",
    technical: "Trial: PT 12 sessions × 8 wks, naproxen 500mg BID × 4 wks, gabapentin 300mg TID × 6 wks; VAS 7/10 unchanged.",
  },
  {
    id: 'exam',
    plain: "On exam, Tunde has weakness lifting his right foot (a sign the L5 nerve root is irritated).",
    technical: "Exam: positive R SLR @ 40°, R EHL strength 4/5, decreased pinprick R L5 dermatome.",
  },
  {
    id: 'plan',
    plain: "The plan is to image first, then decide if he needs an injection or surgical referral.",
    technical: "Plan: MRI L-spine to characterize disc/nerve-root pathology; intervention TBD per imaging.",
  },
]

const umCriteria: UmCriterion[] = [
  {
    id: 'duration',
    plain: "MRI of the lumbar spine is approvable when the patient has tried conservative treatment (PT, anti-inflammatories, etc.) for at least 6 weeks without improvement.",
    technical: "UHC Med Policy 2024.06 (Lumbar MRI) §C.1.a — conservative therapy ≥ 6 weeks documented.",
  },
  {
    id: 'radiculopathy',
    plain: "Or, MRI is approvable when there's clear radiculopathy — the disc is pinching a nerve root and causing leg symptoms.",
    technical: "UHC Med Policy 2024.06 §C.1.b — radiculopathy: clinical exam findings (positive SLR, dermatomal sensory loss, or motor weakness in a nerve-root distribution).",
  },
  {
    id: 'red-flags',
    plain: "Or, urgently, when there are red flags (sudden severe weakness, bowel/bladder issues, fever) suggesting a more dangerous cause.",
    technical: "UHC Med Policy 2024.06 §C.2 — urgent indications: cauda equina, infection, malignancy, trauma.",
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'CO-197': {
    term: 'CO-197 (prior authorization)',
    plain: "A denial code that says: this service required pre-approval (prior authorization) and the payer's system has no record of one. Almost every elective imaging study, surgery, and infusion needs prior auth in commercial plans. CO-197 is the most-common 'preventable' denial in real RCM.",
  },
  '278': {
    term: '278 (prior-auth transaction)',
    plain: "The X12 EDI transaction the provider sends to the payer to request prior authorization for a service. The 278 is paired with a 278 response, which carries the decision (approved / denied / pended) and, if approved, the all-important auth number. Retroactive 278s are a thing — payers will sometimes process them after the service if the clinical rationale would have approved at the time.",
  },
  'Box 23': {
    term: 'Box 23 — Prior Authorization Number',
    plain: "The CMS-1500 field for the auth number returned by the payer's 278 response. Without something in Box 23, an automated adjudication engine has no way to link the claim to the approved auth — even if both exist in the payer's database. This is the Gatekeeper's whole game.",
  },
  'CMS-1500': {
    term: 'CMS-1500',
    plain: "The standard claim form for outpatient services. Numbered boxes; this encounter cares about Box 23 (the prior-auth number — empty here, which is why the claim was kicked).",
  },
  'UM criteria': {
    term: 'UM (utilization management) criteria',
    plain: "The clinical rules a payer uses to decide whether to approve a service. Either home-grown (UHC has its own medical policies) or licensed (MCG, InterQual). Reading them is the secret weapon: if your 278 rationale matches the criteria word-for-word, approval is nearly automatic.",
  },
  'radiculopathy': {
    term: 'Radiculopathy',
    plain: "A pinched nerve root. The disc material presses on a spinal nerve and causes pain / numbness / weakness in the leg the nerve serves. L5 radiculopathy = symptoms down the back of the thigh into the foot.",
  },
}

// === Runtime state ===

interface ResponseState {
  status: 'pending' | 'approved'
  authNumber?: string
  validThrough?: string
  receivedAt?: string
}

const state = {
  briefingDone: false,
  briefingOpen: false,
  amendOpen: false,
  selectedRationale: null as string | null,
  /** UI-only — once "filing", show a brief animation. */
  filing: false,
  /** Auth response, if/when it arrives. */
  response: null as ResponseState | null,
  /** What's currently on Box 23. Empty until amended. */
  box23: '',
  amendFeedback: null as { id: string; message: string } | null,
  amendOptionPickedId: null as string | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  feedback: '' as string,
  feedbackKind: 'neutral' as 'neutral' | 'good' | 'bad',
  lastRecap: '' as string,
  packetSubmitted: false,
  openTermId: null as string | null,
}

const gatekeeperCase = CASES.case_gatekeeper_okafor

// The auth number Box 23 expects. Hard-coded here to keep the
// prototype self-contained (mirrors `case.errors[0].correctValue`).
const TRUE_AUTH = 'PA-78294-A'

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
      ${renderStepGuide()}
      ${renderClaim()}
      ${renderRequestStation()}
      ${renderResponsePanel()}
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
        <h1>Gatekeeper <span class="muted">@ L5 · Prior Authorization</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./">← back to game</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          Request-dominant: file a 278, wait for the response,
          transcribe the auth number. A process, not an argument
          — the payer didn't say no, they said prove you asked.
          See the <a href="#design-notes">design notes</a>
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
        Tunde Okafor's wife calls — she sounds tired. "Hi, we got
        a bill for $1,425 for the MRI he had last month? But we
        called and got approval before we went. The lady on the
        phone said it was fine."
      </p>
      <p>
        You pull up Tunde's file. The claim shows a CO-197 — no
        prior auth on record. ${term('Box 23', "Box 23")} is
        empty. Somebody got verbal approval and forgot to write
        the number down. There may still be an auth on file at
        UHC, but until it's pinned to the claim, the gate stays
        shut.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and somewhere down the corridor, you hear a soft
        "ahem." Polite. Patient. The fluorescents cool a half-
        notch. You're somewhere else.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : "Different shape from the others. Listen up."}</span>
    </div>
    <div class="briefing-body">
      <p>
        "This one is a Gatekeeper. ${term('CO-197')}. UHC says
        there's no auth on file for the MRI. Polite as anything,
        but immovable: no number, no money. Doesn't matter that
        Tunde's MRI was clinically appropriate. Doesn't matter
        that someone got verbal sign-off. The gate only opens
        for one thing: an auth number sitting on
        ${term('Box 23')}."
      </p>
      <p>
        "Two issues, in order:"
      </p>
      <ul>
        <li>
          <strong>File a ${term('278')}.</strong> Send a
          retroactive prior-auth inquiry to UHC. Pick a clinical
          rationale that matches both the chart <em>and</em> UHC's
          ${term('UM criteria')}. If it lines up, their system
          finds the approval that was issued back in February —
          the one nobody wrote down — and sends back the auth
          number.
        </li>
        <li>
          <strong>Amend Box 23.</strong> Once the 278 returns
          the auth number, transcribe it onto the claim. The
          gate opens.
        </li>
      </ul>
      <p>
        "Don't argue with the Gatekeeper. There's no audience
        for it. Just file the right form, get the number, and
        write it down. Wrong rationale on the 278 gets you
        denied — read the chart and the criteria first."
      </p>
      <p class="briefing-sign">"Don't argue with the Gatekeeper. File the right form. — D."</p>
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

/** A single "what to do now, and where" banner at the top of the
 *  workbench. The encounter has a strict two-phase order (file the 278 →
 *  transcribe the auth) spread across several panels; without an anchor,
 *  the player lands on the claim — which isn't actionable yet — and has
 *  to hunt for the real first move. This names the current step, points
 *  at the panel that holds it, and tracks progress 1 → 2. */
function renderStepGuide(): string {
  const approved = state.response?.status === 'approved'
  const transcribed = state.resolvedIssues.has('auth-transcribe')

  let title: string
  let detail: string
  if (transcribed) {
    title = 'Both steps done — resubmit the claim'
    detail = 'Box 23 now carries the auth number. Hit RESUBMIT CLAIM at the bottom to clear the denial.'
  } else if (approved) {
    title = 'Step 2 of 2 — Transcribe the auth onto Box 23'
    detail = "UHC returned an auth number in the response panel. Use the mint callout beside the claim (top) to write it onto Box 23."
  } else if (state.filing) {
    title = 'Step 1 of 2 — 278 in transit…'
    detail = "Waiting on UHC's response. The auth number comes back in the response panel — then Step 2 unlocks."
  } else {
    title = 'Step 1 of 2 — File the 278'
    detail = "Start in the 278 panel below: pick the clinical rationale that matches the chart, then file. UHC returns the auth number."
  }

  return `
    <section class="step-guide">
      <div class="step-guide-body">
        <div class="step-guide-title">${title}</div>
        <div class="step-guide-detail">${detail}</div>
      </div>
      <div class="step-guide-track" aria-hidden="true">
        <span class="sg-dot ${approved || transcribed ? 'done' : 'active'}">1</span>
        <span class="sg-bar ${approved || transcribed ? 'done' : ''}"></span>
        <span class="sg-dot ${transcribed ? 'done' : (approved ? 'active' : '')}">2</span>
      </div>
    </section>
  `
}

function renderClaim(): string {
  const claim = gatekeeperCase.claim
  if (!claim || claim.type !== 'cms1500') return ''
  const authResolved = state.resolvedIssues.has('auth-transcribe')
  const canAmend = state.response?.status === 'approved'
  return `
    <div class="claim-with-annotations">
      <section class="claim">
        <div class="claim-h">
          ${term('CMS-1500')} · ${escape(claim.claimId)}
          <span class="claim-explainer">(this is the claim UHC kicked back for missing prior auth)</span>
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
        <div class="claim-section">
          <div class="claim-section-h ${authResolved ? '' : 'box23-disputed'}">
            ${term('Box 23', 'Box 23 · Prior Authorization Number')}
            ${authResolved
              ? '<span class="claim-status amended">FILLED</span>'
              : '<span class="claim-status disputed">EMPTY</span>'}
          </div>
          <div class="box23-row ${authResolved ? 'amended' : 'hi'}">
            ${authResolved
              ? `<span class="mod-applied">${escape(state.box23)}</span>`
              : `<span class="mod-missing">— no auth number —</span>`}
          </div>
        </div>
      </section>
      ${authResolved ? '' : `
        <aside class="claim-annotations">
          <button class="amend-callout ${canAmend ? '' : 'inactive'}" ${canAmend ? 'data-action="open-amend"' : 'disabled'}>
            <span class="amend-callout-arrow" aria-hidden="true">⟵</span>
            <span class="amend-callout-body">
              <span class="amend-callout-main">${canAmend ? '✎ Transcribe the auth' : '⛔ No auth to transcribe yet'}</span>
              <span class="amend-callout-sub">${canAmend
                ? "The 278 came back approved. Click to write the auth number onto Box 23."
                : "File the 278 below first. Once UHC responds with an auth, this opens."}</span>
            </span>
          </button>
        </aside>
      `}
    </div>
  `
}

function renderRequestStation(): string {
  const filed = state.resolvedIssues.has('auth-request')
  const fbClass = state.feedback ? `fb-${state.feedbackKind}` : ''
  return `
    <section class="request-station ${filed ? 'filed' : ''}">
      <div class="request-h">
        <span class="request-tag">${term('278')} · PRIOR AUTH REQUEST</span>
        <span class="request-sub">${filed ? 'Filed and accepted by UHC.' : "Pick a clinical rationale that matches both the chart and UHC's criteria."}</span>
      </div>
      <div class="request-form">
        <div class="form-row">
          <div class="form-cell locked">
            <span class="form-label">SERVICE</span>
            <span class="form-value">CPT 72148 — MRI lumbar w/o contrast</span>
            <span class="form-locked">locked from claim</span>
          </div>
          <div class="form-cell locked">
            <span class="form-label">DIAGNOSIS</span>
            <span class="form-value">${term('radiculopathy', 'M51.16 — Lumbar disc herniation w/ radiculopathy')}</span>
            <span class="form-locked">locked from claim</span>
          </div>
        </div>
      </div>
      <div class="request-context">
        <div class="ctx-col chart-col">
          <div class="ctx-h">CHART (Okafor, T.)</div>
          <ul class="facts">
            ${chartFacts.map(f => `
              <li class="fact">
                <div class="fact-plain">${escape(f.plain)}</div>
                <div class="fact-technical"><span class="src">from chart:</span> ${escape(f.technical)}</div>
              </li>
            `).join('')}
          </ul>
        </div>
        <div class="ctx-col criteria-col">
          <div class="ctx-h">UHC ${term('UM criteria')} · LUMBAR MRI</div>
          <ul class="clauses">
            ${umCriteria.map(c => `
              <li class="clause">
                <div class="clause-plain">${escape(c.plain)}</div>
                <div class="clause-technical"><span class="src">policy:</span> ${escape(c.technical)}</div>
              </li>
            `).join('')}
          </ul>
        </div>
      </div>
      <div class="rationale-h">CLINICAL RATIONALE — pick one</div>
      <ul class="rationale-options">
        ${rationaleOptions.map(opt => {
          const sel = state.selectedRationale === opt.id ? 'selected' : ''
          return `
            <li class="rationale ${sel} ${filed ? 'locked' : ''}"
                ${filed ? '' : `data-action="select-rationale" data-id="${opt.id}"`}>
              <div class="rationale-h-row">
                <span class="rationale-radio">${state.selectedRationale === opt.id ? '●' : '○'}</span>
                <span class="rationale-label">${escape(opt.label)}</span>
              </div>
              <div class="rationale-detail">${escape(opt.detail)}</div>
            </li>
          `
        }).join('')}
      </ul>
      <div class="request-actions">
        <button class="btn primary ${(!state.selectedRationale || filed) ? 'disabled' : ''}"
                ${(!state.selectedRationale || filed) ? 'disabled' : ''}
                data-action="file-278">
          ${filed ? 'FILED' : 'FILE 278'}
        </button>
        <button class="btn ghost ${filed ? 'disabled' : ''}"
                ${filed ? 'disabled' : ''}
                data-action="clear-rationale">Clear</button>
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

function renderResponsePanel(): string {
  if (!state.response && !state.filing) {
    return `
      <section class="response-panel idle">
        <div class="response-h">
          <span class="response-tag">UHC RESPONSE</span>
          <span class="response-sub">Awaiting 278 submission.</span>
        </div>
        <div class="response-body idle-body">
          <span class="dim">No response yet. File the 278 above to query UHC's UM database.</span>
        </div>
      </section>
    `
  }
  if (state.filing) {
    return `
      <section class="response-panel pending">
        <div class="response-h">
          <span class="response-tag">UHC RESPONSE</span>
          <span class="response-sub">278 in transit…</span>
        </div>
        <div class="response-body pending-body">
          <div class="spinner"></div>
          <span>Routing to UHC UM system… checking for existing approvals…</span>
        </div>
      </section>
    `
  }
  if (state.response?.status === 'approved') {
    return `
      <section class="response-panel approved">
        <div class="response-h">
          <span class="response-tag">UHC RESPONSE · APPROVED</span>
          <span class="response-sub">Auth retrieved · ${escape(state.response.receivedAt ?? '')}</span>
        </div>
        <div class="response-body approved-body">
          <div class="approved-grid">
            <div><span class="r-label">AUTH NUMBER</span><code class="r-value">${escape(state.response.authNumber ?? '')}</code></div>
            <div><span class="r-label">SERVICE</span><span class="r-value">CPT 72148</span></div>
            <div><span class="r-label">VALID THROUGH</span><span class="r-value">${escape(state.response.validThrough ?? '')}</span></div>
          </div>
          <p class="approved-note">
            UHC's UM system found an existing approval issued
            2026-02-04 (rep ID: J. Smith). The original verbal
            approval was on file all along — it just never made
            it onto the claim. Transcribe the auth number onto
            ${term('Box 23')} and the gate opens.
          </p>
        </div>
      </section>
    `
  }
  return ''
}

function renderAmendModal(): string {
  if (!state.amendOpen) return ''
  const auth = state.response?.authNumber ?? ''
  // Distractor options: the real auth, an old auth from a prior claim,
  // a typo'd version. The point: the player has to read the response
  // panel and pick the matching value, not just guess.
  const options = [
    {
      id: auth,
      label: auth,
      support: 'correct' as const,
      feedback: `Matches the 278 response exactly. UHC's adjudication engine will link the claim to the auth on file.`,
    },
    {
      id: 'PA-44021',
      label: 'PA-44021',
      support: 'wrong' as const,
      feedback: "That's an old auth number — looks like it was from a prior procedure (a 2025 X-ray). Wrong auth = adjudication failure even though there's *a* number in Box 23.",
    },
    {
      id: 'PA-78294',
      label: 'PA-78294',
      support: 'wrong' as const,
      feedback: "Close — but you dropped the trailing '-A' suffix. UHC's auth IDs include the suffix; without it the engine treats it as a different auth and the claim still fails to match.",
    },
  ]
  return `
    <div class="amend-modal-backdrop">
      <div class="amend-modal">
        <button class="amend-modal-close" data-action="close-amend" aria-label="Close">×</button>
        <div class="amend-modal-h">
          <span class="amend-tag">AMEND BOX 23 · PRIOR-AUTH NUMBER</span>
          <span class="amend-sub">Transcribe the auth number from the 278 response.</span>
        </div>
        <div class="amend-context">
          <strong>278 response says:</strong> auth number ${escape(auth)}, valid through 2026-05-15, issued 2026-02-04.
        </div>
        <ul class="amend-options">
          ${options.map(opt => {
            const fb = state.amendFeedback?.id === opt.id ? state.amendFeedback : null
            return `
              <li class="amend-option ${fb ? 'rejected' : ''}"
                  data-action="pick-auth" data-id="${opt.id}">
                <div class="amend-option-h">
                  <code>${escape(opt.label)}</code>
                </div>
                ${fb ? `<div class="amend-option-fb">${escape(fb.message)}</div>` : ''}
              </li>
            `
          }).join('')}
        </ul>
        <p class="amend-hint-text">
          The 278 response is the source of truth — match it character-for-character. (Wrong picks give feedback, no penalty.)
        </p>
      </div>
    </div>
  `
}

function renderChecklist(): string {
  const allResolved = state.resolvedIssues.size === issues.length
  return `
    <section class="checklist">
      <div class="checklist-h">Gate sequence — ${state.resolvedIssues.size} of ${issues.length} steps complete</div>
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
        RESUBMIT CLAIM
      </button>
      ${state.failedAttempts > 0 ? `<div class="fail-counter">Wrong picks so far: ${state.failedAttempts}. (No penalty.)</div>` : ''}
    </section>
  `
}

const RECAP: CaseRecap = CASE_RECAPS['gatekeeper']

function renderVictory(): string {
  return `
    <section class="victory">
      <h2>The gate opens.</h2>
      <p class="register hospital">Hospital, two days later.</p>
      <p>
        UHC's adjudication engine matches the auth number on the
        resubmitted claim against PA-78294-A in their system.
        Approved on first pass. Tunde's wife calls back; you can
        hear the relief in her voice. The $1,425 was patient
        responsibility for ten minutes; now it isn't.
      </p>
      <p class="register waiting-room">Waiting Room.</p>
      <p>
        The Gatekeeper steps aside. There's no fanfare — just a
        small movement, a clipboard set down, the velvet rope
        drawn back. On the wall behind it, a row of little
        numbered plaques is now one plaque longer.
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
            <li><b>A new move: the request.</b> File a 278, wait for a response, read what came back. Not an argument; a process.</li>
            <li><b>The citation builder is gone.</b> In its place: a real 278 form (locked CPT + dx, picker for clinical rationale) and a response panel that animates back from UHC.</li>
            <li><b>Two-phase flow.</b> The amend can't fire until the request returns. The encounter has a strict order: file → wait → transcribe. Different rhythm from any of the prior prototypes.</li>
            <li><b>Different field again.</b> Box 23 (prior-auth number), not Box 1a, 21, or 24. The framework keeps working with whatever field the encounter targets.</li>
            <li><b>Wrong rationale → 278 denied.</b> The first action can fail in a soft way (denied, file again with better rationale). Models the real-world rhythm of 278 inquiries.</li>
            <li><b>Earlier in the curriculum (L3 vs L4/L7).</b> Lighter mood, more "polite procedural" than "looming dread."</li>
          </ul>
        </div>
        <div>
          <h3>What this prototype proves (or tries to)</h3>
          <ul>
            <li>The framework can absorb a procedural step (the request) without breaking — same hospital intro, same fall, same claim, same checklist; only the middle changed.</li>
            <li>UHC's UM criteria + the chart can sit side-by-side as informational columns rather than as builder slots, and still teach the player to *match the rationale to the criteria*.</li>
            <li>A locked-field form with a multiple-choice rationale picker can stand in for a real 278 transaction without dumping EDI onto the player.</li>
            <li>A two-phase encounter (request, then amend) feels like a sequence, not two unrelated puzzles, when the response panel literally produces the value the amend modal needs.</li>
            <li>Dana's voice still works at L3 — calmer, lighter, but the same "in your ear" register.</li>
          </ul>
        </div>
      </div>
      <p class="notes-cta">
        Side-by-side comparison: open
        <a href="./wraith-prototype.html">Wraith</a>,
        <a href="./bundle-prototype.html">Bundle</a>, or
        <a href="./reaper-prototype.html">Reaper</a> in another
        tab. Different action sets — argument, surgical fix,
        time-bounded appeal, procedural request. Same shape.
        That's the framework working.
      </p>
    </section>
  `
}

// === Interactions ===

function setFeedback(text: string, kind: 'good' | 'bad' | 'neutral' = 'neutral') {
  state.feedback = text
  state.feedbackKind = kind
}

function file278() {
  if (state.resolvedIssues.has('auth-request')) return
  const sel = state.selectedRationale
  if (!sel) return
  const opt = rationaleOptions.find(r => r.id === sel)
  if (!opt) return

  if (opt.support === 'wrong' || opt.support === 'partial') {
    state.failedAttempts += 1
    setFeedback(
      `278 came back denied. ${opt.feedback} Pick a different rationale and re-file.`,
      'bad'
    )
    state.lastRecap = ''
    return
  }

  // Approved path — show "filing" animation, then arrive at response.
  state.filing = true
  rerender()
  // Simulate the 278 round-trip with a short delay so the response
  // panel feels like it's coming back over the wire rather than
  // popping in. Keep it short — playtest will tell us if the wait
  // is satisfying or annoying.
  window.setTimeout(() => {
    state.filing = false
    state.response = {
      status: 'approved',
      authNumber: TRUE_AUTH,
      validThrough: '2026-05-15',
      receivedAt: 'just now',
    }
    state.resolvedIssues.add('auth-request')
    const issue = issues.find(i => i.id === 'auth-request')!
    setFeedback(`278 returned approved. ${opt.feedback}`, 'good')
    state.lastRecap = issue.recap
    rerender()
  }, 1200)
}

function attemptAmend(authId: string) {
  if (state.packetSubmitted) return
  if (authId !== TRUE_AUTH) {
    state.failedAttempts += 1
    // Look up the feedback by walking the in-modal options synthesizer.
    if (authId === 'PA-44021') {
      state.amendFeedback = { id: authId, message: "That's an old auth number from a prior procedure. UHC's engine will reject the link." }
    } else if (authId === 'PA-78294') {
      state.amendFeedback = { id: authId, message: "Missing the '-A' suffix. UHC treats it as a different auth — won't match." }
    } else {
      state.amendFeedback = { id: authId, message: "Doesn't match the 278 response. Try again." }
    }
    return
  }
  state.box23 = authId
  state.amendOpen = false
  state.amendFeedback = null
  if (!state.resolvedIssues.has('auth-transcribe')) {
    state.resolvedIssues.add('auth-transcribe')
    const issue = issues.find(i => i.id === 'auth-transcribe')!
    setFeedback(
      `Box 23 amended. ${authId} now on the claim. Issue addressed.`,
      'good'
    )
    state.lastRecap = issue.recap
  }
}

function attemptSubmit() {
  if (state.resolvedIssues.size < issues.length) return
  state.packetSubmitted = true
  notifyParentVictory('gatekeeper')
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  state.amendOpen = false
  state.selectedRationale = null
  state.filing = false
  state.response = null
  state.box23 = ''
  state.amendFeedback = null
  state.amendOptionPickedId = null
  state.resolvedIssues = new Set()
  state.failedAttempts = 0
  state.feedback = ''
  state.feedbackKind = 'neutral'
  state.lastRecap = ''
  state.packetSubmitted = false
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
    case 'select-rationale': state.selectedRationale = id ?? null; setFeedback(''); break
    case 'clear-rationale': state.selectedRationale = null; setFeedback(''); state.lastRecap = ''; break
    case 'file-278': file278(); return  // file278 handles its own rerender (delayed)
    case 'submit': attemptSubmit(); break
    case 'reset': reset(); break
    case 'dismiss-briefing': dismissBriefing(); break
    case 'show-briefing': showBriefing(); break
    case 'close-briefing': closeBriefing(); break
    case 'open-amend': openAmend(); break
    case 'close-amend': closeAmend(); break
    case 'pick-auth': if (id) attemptAmend(id); break
    case 'open-term': if (el.dataset.term) openTerm(el.dataset.term); break
    case 'close-term': closeTerm(); break
    default: return
  }
  rerender()
}

// === Mount ===

// Gatekeeper-specific CSS — request station, response panel, Box-23 amend.
// Base styles via BASE_CSS.
const css = districtVars('eligibility') + BASE_CSS + `
  /* Current-step guide — a single anchor at the top of the workbench
     that answers "what do I do now, and where," so the player isn't
     hunting across panels for the first move. */
  .step-guide {
    display: flex; align-items: center; gap: 18px;
    background: linear-gradient(180deg, rgba(126, 226, 193, 0.10), rgba(126, 226, 193, 0.03));
    border: 1px solid var(--accent); border-left: 4px solid var(--accent);
    border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;
  }
  .step-guide-body { flex: 1 1 auto; }
  .step-guide-title { font-weight: 700; font-size: 14px; color: var(--accent); letter-spacing: 0.02em; }
  .step-guide-detail { font-size: 12.5px; color: var(--ink); margin-top: 4px; line-height: 1.5; }
  .step-guide-track { display: flex; align-items: center; gap: 7px; flex: 0 0 auto; }
  .sg-dot {
    width: 24px; height: 24px; border-radius: 50%; display: grid; place-items: center;
    font-size: 11px; font-weight: 800; color: var(--ink-dim);
    background: var(--panel-2); border: 1px solid #2a3142;
  }
  .sg-dot.active { color: #0e1116; background: var(--accent); border-color: var(--accent); }
  .sg-dot.done { color: var(--good); background: rgba(126, 226, 193, 0.15); border-color: var(--good); }
  .sg-bar { width: 26px; height: 2px; background: #2a3142; border-radius: 2px; }
  .sg-bar.done { background: var(--good); }
  @media (max-width: 880px) { .step-guide-track { display: none; } }

  /* Larger annotation column — Gatekeeper's amend callout aligns with
     Box 23 (further down the form). */
  .claim-annotations { width: 240px; padding-top: 280px; }
  .claim-section-h { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .claim-section-h.box23-disputed { color: #a23148; }

  .box23-row { padding: 6px 8px; border-radius: 3px; }
  .box23-row.hi { background: var(--hi); box-shadow: inset 0 0 0 1px var(--hi-border); }
  .box23-row.amended { background: rgba(126, 226, 193, 0.15); box-shadow: inset 0 0 0 1px var(--good); }

  /* Gatekeeper's amend callout uses --good (mint) instead of --bad (red),
     because the gate opens with the auth — it's a positive action. */
  .amend-callout {
    background: linear-gradient(180deg, rgba(126, 226, 193, 0.12), rgba(126, 226, 193, 0.04));
    border-color: var(--good);
    box-shadow: 0 0 0 0 rgba(126, 226, 193, 0.18);
    animation: amend-pulse-good 4.5s ease-in-out infinite;
  }
  .amend-callout:hover:not(:disabled) { box-shadow: 0 4px 16px rgba(126, 226, 193, 0.35); }
  .amend-callout.inactive,
  .amend-callout:disabled {
    opacity: 0.45; cursor: not-allowed; animation: none;
    background: var(--panel); border-color: #2a3142; color: var(--ink-dim);
  }
  .amend-callout.inactive .amend-callout-arrow,
  .amend-callout:disabled .amend-callout-arrow,
  .amend-callout.inactive .amend-callout-main,
  .amend-callout:disabled .amend-callout-main { color: var(--ink-dim); }
  @keyframes amend-pulse-good {
    0%, 100% { box-shadow: 0 0 0 0 rgba(126, 226, 193, 0.18); }
    50% { box-shadow: 0 0 0 6px rgba(126, 226, 193, 0); }
  }
  .amend-callout-arrow { color: var(--good); }
  .amend-callout-main { color: var(--good); }

  /* Amend modal — green-tinted (gate-opening) instead of red. */
  .amend-modal { border-color: var(--good); }
  .amend-tag { color: var(--good); }
  .amend-context { border-left-color: var(--good); }
  .amend-context strong { color: var(--good); }
  .amend-option:hover { border-left-color: var(--good); }

  /* Request station */
  .request-station {
    background: var(--panel); border: 1px solid #232a36;
    border-left: 4px solid var(--accent); border-radius: 8px;
    padding: 18px 22px; margin-bottom: 22px;
    transition: opacity 0.3s;
  }
  .request-station.filed { opacity: 0.78; }
  .request-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
  .request-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .request-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .request-form { margin-bottom: 14px; }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 880px) { .form-row { grid-template-columns: 1fr; } }
  .form-cell { background: var(--panel-2); padding: 10px 12px; border-radius: 5px; display: flex; flex-direction: column; gap: 4px; border: 1px solid #2a3142; }
  .form-cell.locked { background: rgba(163, 197, 255, 0.04); border-color: #2c3a55; }
  .form-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-dim); }
  .form-value { font-size: 13.5px; color: var(--ink); }
  .form-locked { font-size: 10.5px; color: var(--ink-dim); font-style: italic; }

  .request-context { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px; }
  @media (max-width: 880px) { .request-context { grid-template-columns: 1fr; } }
  .ctx-col { background: var(--panel-2); padding: 12px 14px; border-radius: 5px; }
  .ctx-h { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 8px; }
  .chart-col .ctx-h { color: #c8b6e0; }
  .criteria-col .ctx-h { color: var(--accent); }
  .facts, .clauses { list-style: none; padding-left: 0; margin: 0; }
  .fact, .clause { padding: 8px 10px; margin: 4px 0; background: rgba(0,0,0,0.18); border-radius: 4px; border-left: 2px solid #2a3142; }
  .chart-col .fact { border-left-color: #c8b6e0; }
  .criteria-col .clause { border-left-color: var(--accent); }
  .fact-plain, .clause-plain { font-size: 13px; color: var(--ink); line-height: 1.45; }
  .fact-technical, .clause-technical { font-size: 11px; color: rgba(138, 147, 163, 0.65); margin-top: 5px; padding-top: 4px; border-top: 1px dashed rgba(138, 147, 163, 0.15); line-height: 1.4; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .fact-technical .src, .clause-technical .src { color: rgba(138, 147, 163, 0.45); text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px; margin-right: 4px; font-family: inherit; }

  .rationale-h { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-dim); margin: 14px 0 8px; }
  .rationale-options { list-style: none; padding-left: 0; margin: 0; }
  .rationale { padding: 10px 14px; margin: 6px 0; background: var(--panel-2); border-radius: 5px; border-left: 3px solid transparent; cursor: pointer; transition: all 0.15s; }
  .rationale:hover:not(.locked) { background: #232b3a; border-left-color: var(--accent); }
  .rationale.selected { border-left-color: var(--accent); background: rgba(163, 197, 255, 0.08); }
  .rationale.locked { cursor: default; opacity: 0.6; }
  .rationale-h-row { display: flex; align-items: baseline; gap: 10px; }
  .rationale-radio { color: var(--accent); width: 14px; flex-shrink: 0; }
  .rationale-label { font-size: 13.5px; color: var(--ink); font-weight: 600; }
  .rationale-detail { font-size: 12px; color: var(--ink-dim); margin-top: 4px; padding-left: 24px; line-height: 1.45; }

  .request-actions { margin-top: 12px; display: flex; gap: 10px; }

  /* Response panel */
  .response-panel {
    background: var(--panel); border: 1px solid #232a36; border-left-width: 4px;
    border-radius: 8px; padding: 18px 22px; margin-bottom: 22px;
    transition: border-color 0.3s, background 0.3s;
  }
  .response-panel.idle { border-left-color: #2a3142; opacity: 0.65; }
  .response-panel.pending { border-left-color: var(--accent-2); }
  .response-panel.approved { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126, 226, 193, 0.04), transparent); }
  .response-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .response-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .response-panel.idle .response-tag { color: var(--ink-dim); }
  .response-panel.pending .response-tag { color: var(--accent-2); }
  .response-panel.approved .response-tag { color: var(--good); }
  .response-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .response-body { font-size: 13.5px; }
  .idle-body .dim { color: var(--ink-dim); font-style: italic; }
  .pending-body { display: flex; align-items: center; gap: 14px; padding: 8px 0; }
  .spinner {
    width: 22px; height: 22px; border-radius: 50%;
    border: 3px solid rgba(240, 168, 104, 0.25);
    border-top-color: var(--accent-2);
    animation: spin 0.85s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .approved-body .approved-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 12px 14px; background: var(--panel-2); border-radius: 5px; margin-bottom: 10px; }
  @media (max-width: 880px) { .approved-body .approved-grid { grid-template-columns: 1fr; } }
  .approved-body .approved-grid > div { display: flex; flex-direction: column; gap: 4px; }
  .approved-body .r-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-dim); }
  .approved-body .r-value { font-size: 14px; color: var(--ink); }
  .approved-body code.r-value { background: transparent; color: var(--good); font-weight: 700; padding: 0; font-size: 15px; letter-spacing: 0.04em; }
  .approved-note { font-size: 12.5px; color: var(--ink-dim); margin: 0; line-height: 1.55; }

  /* Override recap to use district mint instead of warm orange. */
  .recap { background: rgba(163, 197, 255, 0.06); border-color: #2c3a55; }
  .recap-h { color: var(--accent); }
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
