// Reaper @ L7 — first-sketch prototype (CO-29).
//
// Sibling to wraith-prototype + bundle-prototype. Same shape
// (Hospital intro → dreamlike fall → Waiting Room → claim form +
// workbench + builder), tuned to a different action set:
//
//   - Time pressure drives it. Every action costs days from a
//     finite filing-window budget. The Reaper doesn't hit; the
//     calendar does.
//   - Two issues: cite the extenuating-circumstances waiver, backed
//     by 277CA receipts, and amend the subscriber ID that's been
//     bouncing this claim for nine months.
//
// Demonstrates: a real countdown changes the rhythm without
// breaking the framework. Wrong picks aren't free; the player
// can lose. Reads as urgency, not as punishment.
//
// Code is intentionally a sibling rather than abstracted from
// the bundle prototype; once we have 3+ encounters the shared
// bits will be obvious to extract.

import { CASES } from '../content/cases'
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

interface SubscriberOption {
  id: string
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

interface PolicyClause {
  id: string
  plain: string
  technical: string
  issueId: string | null
  distractorReason?: string
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
    id: 'subscriber-id',
    label: 'Amend the subscriber ID on Box 1a so the claim stops bouncing.',
    recap: "The 277CAs have been telling us this for nine months. The last four digits were transposed: AET882441293 → AET882441923. Same digits, different order. Now the claim can land at Aetna instead of getting kicked back at the clearinghouse.",
    verb: 'amend',
  },
  {
    id: 'timely-waiver',
    label: 'Cite proof of timely original submission for the extenuating-circumstances waiver.',
    recap: "You just argued: we tried to file inside the 90-day window — within seven days of surgery, in fact — but the clearinghouse kept bouncing it on a transposed ID. Aetna's own provider manual carves out an extenuating-circumstances waiver for exactly this scenario, provided we can show the 277CA acknowledgments. We can.",
    verb: 'cite',
  },
]

const subscriberOptions: SubscriberOption[] = [
  {
    id: 'AET882441293',
    label: 'AET882441293',
    support: 'current',
    feedback: "This is what's currently on the claim — and it's why the 277CA has bounced it four times.",
  },
  {
    id: 'AET882441923',
    label: 'AET882441923',
    support: 'correct',
    feedback: "Last four digits restored to the order Aetna's eligibility system actually uses. Matches every 277CA bounce-back the clearinghouse has been mailing us.",
  },
  {
    id: 'AET88241923',
    label: 'AET88241923',
    support: 'partial',
    feedback: "Close, but you dropped a digit. Aetna IDs are eleven characters after the 'AET' prefix. The 277CA log shows the eleven-digit form.",
  },
  {
    id: 'AET882441329',
    label: 'AET882441329',
    support: 'wrong',
    feedback: "A different transposition — still doesn't match. The 277CA log explicitly listed AET882441923 as the correct subscriber. That's the one to use.",
  },
]

const payerPhrases: PayerPhrase[] = [
  {
    id: 'window',
    text: 'received outside the 90-day timely filing window',
    plain: "Aetna says the claim arrived in their system after the 90-day window closed. Their final denial. Without a waiver, we lose the $42,300.",
    issueId: 'timely-waiver',
  },
  {
    id: 'subscriber',
    text: 'subscriber identifier not found in our records',
    plain: "Every previous submission attempt bounced at the clearinghouse for this exact reason — the ID on Box 1a doesn't match any active Aetna subscriber. The 277CAs flagged it each time.",
    issueId: 'subscriber-id',
  },
]

const chartFacts: ChartFact[] = [
  {
    id: 'first-submit',
    plain: "Our billing system first submitted this claim on 2025-08-22 — exactly seven days after surgery, well within Aetna's 90-day window.",
    technical: "Clearinghouse log: 837P submitted 2025-08-22T14:11Z; ICN 2025-08-22-A22087.",
    issueId: 'timely-waiver',
  },
  {
    id: '277ca-chain',
    plain: "Every submission attempt got a 277CA bounce within 48 hours: 2025-08-25, 2025-09-14, 2025-10-09, 2026-01-15. Same reason each time: subscriber ID not found.",
    technical: "277CA STC*A7:562*U: subscriber id not found in payer master, ref AET882441293, suggested AET882441923.",
    issueId: 'timely-waiver',
  },
  {
    id: 'surgery-success',
    plain: "Devon was ambulating well at the six-week post-op visit; recovery has been straightforward.",
    technical: "Op note + 6-wk f/u: WBAT, ROM 0-110°, no effusion; routine PT progression.",
    issueId: null,
    distractorReason: "How well the patient is recovering doesn't bear on whether the claim can still be filed. The waiver is about timely-filing intent, not clinical outcome.",
  },
  {
    id: 'patient-eligible',
    plain: "Devon's coverage was active on 2025-08-15 — the 270/271 eligibility check that morning came back clean.",
    technical: "270 inquiry 2025-08-15T07:42Z; 271 response: active coverage, group 0078421, copay $400.",
    issueId: null,
    distractorReason: "Eligibility on the surgery date isn't disputed — Aetna isn't claiming Devon wasn't covered. They're claiming we filed late. The waiver argument needs to be about *when we tried to file*.",
  },
]

const policyClauses: PolicyClause[] = [
  {
    id: 'waiver-rule',
    plain: "Aetna's provider manual allows an extenuating-circumstances waiver for claims that bounced at the clearinghouse on identifier issues, provided the original submission was inside the 90-day window and 277CA evidence is attached.",
    technical: "Aetna Participating Provider Manual §4.2.3 (timely filing waivers) — extenuating circumstances includes 'documented EDI rejection chains where the provider's good-faith original submission predates the contractual filing limit.'",
    issueId: 'timely-waiver',
  },
  {
    id: '277ca-evidence',
    plain: "A complete 277CA acknowledgment chain is acceptable proof of attempted timely filing — the dates on the bounces become the dates of record.",
    technical: "Aetna PPM §4.2.3.b — acceptable proof: 'all 277CA STC code records with timestamps, plus the original 837P submission ICN.'",
    issueId: 'timely-waiver',
  },
  {
    id: 'prior-auth-rule',
    plain: "Aetna's prior-auth rule for elective orthopedic surgeries.",
    technical: "Aetna PPM §6.1 — prior auth required for elective inpatient and selected outpatient orthopedic procedures (joint replacement, spinal fusion, ACL repair).",
    issueId: null,
    distractorReason: "Prior-auth wasn't the denial reason here — Aetna issued CO-29 (timely filing), not CO-15 or CO-197. PA was approved on 2025-08-08 (auth #PA-44021); not what's at issue.",
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'CO-29': {
    term: 'CO-29 (timely filing)',
    plain: "A denial code that says: the claim arrived after the contractual filing window closed. The window varies by payer (Aetna PPO: 90 days from DOS for participating providers). After CO-29, you have a narrow appeal window — usually 60 days from the denial — to argue extenuating circumstances.",
  },
  '277CA': {
    term: '277CA (Claim Acknowledgment)',
    plain: "An EDI transaction the clearinghouse sends back after you submit a claim. It tells you whether the claim was accepted onto the payer's adjudication queue or rejected before it ever reached the payer. A 277CA bounce means the claim never *got* to Aetna; the clearinghouse stopped it. Critically: 277CAs are timestamped, which makes them the receipts that prove timely intent.",
  },
  'timely filing window': {
    term: 'Timely filing window',
    plain: "The contractual deadline for first-time submission of a claim, measured from date of service. Set per-payer; commercial PPOs are typically 90-180 days, Medicare is 12 months, Medicaid varies by state. Miss it without a waiver and the payer is contractually entitled to deny — even on otherwise valid claims.",
  },
  'extenuating circumstances waiver': {
    term: 'Extenuating-circumstances waiver',
    plain: "A payer-specific appeal process for claims denied on timely filing when the provider can document that good-faith filing was attempted inside the window. Aetna calls this their §4.2.3 waiver. The two things you need: (1) proof of timely original submission, usually 277CA logs, and (2) a clean root-cause fix — i.e., the claim has to be amend-ready, not still broken.",
  },
  'Box 1a': {
    term: "Box 1a — Insured's ID Number",
    plain: "On the CMS-1500, the box where the subscriber's payer-issued member ID goes. Wrong digits here = clearinghouse bounce 100% of the time — this is the field 277CAs flag most often. Always cross-check against the 271 response, never the card photocopy.",
  },
  'CMS-1500': {
    term: 'CMS-1500',
    plain: "The standard claim form for outpatient services. Numbered boxes; this encounter cares about Box 1a (subscriber ID — what's been bouncing) and the date-of-service in Box 24 (which started the timely-filing clock).",
  },
  '837P': {
    term: '837P',
    plain: "The X12 EDI transaction that carries a professional claim from the provider to the payer (via clearinghouse). The CMS-1500 you see is the human-readable mirror of the 837P. When we say 'we submitted the claim,' that's the 837P going out.",
  },
}

// === Runtime state ===

const STARTING_DAYS = 14

interface SelectionState {
  payerId: string | null
  chartId: string | null
  policyId: string | null
}

const state = {
  briefingDone: false,
  briefingOpen: false,
  amendOpen: false,
  amendFeedback: null as { id: string; message: string } | null,
  /** Current subscriber ID on Box 1a. Starts as the (transposed) on-claim value. */
  currentSubscriberId: 'AET882441293',
  selection: { payerId: null, chartId: null, policyId: null } as SelectionState,
  resolvedIssues: new Set<string>(),
  citationCount: 0,
  failedAttempts: 0,
  feedback: '' as string,
  feedbackKind: 'neutral' as 'neutral' | 'good' | 'bad',
  lastRecap: '' as string,
  packetSubmitted: false,
  filingClosed: false,
  daysRemaining: STARTING_DAYS,
  daysSpent: [] as Array<{ days: number; reason: string }>,
  lastDayCost: null as { days: number; reason: string } | null,
  openTermId: null as string | null,
}

const reaperCase = CASES.case_reaper_park

// === Time-cost model ===

const COST = {
  citeCorrect: 2,
  citeMismatch: 3,
  citeDistractor: 4,
  amendCorrect: 1,
  amendPartial: 2,
  amendWrong: 3,
  submit: 1,
}

function spendDays(days: number, reason: string) {
  state.daysRemaining = Math.max(0, state.daysRemaining - days)
  state.daysSpent.push({ days, reason })
  state.lastDayCost = { days, reason }
  if (state.daysRemaining <= 0 && !state.packetSubmitted) {
    state.filingClosed = true
  }
}

// === Rendering ===

function term(termId: string, displayText?: string): string {
  const entry = glossary[termId]
  const text = displayText ?? termId
  if (!entry) return escape(text)
  return `<span class="term" data-action="open-term" data-term="${termId}" title="${escape(entry.plain)}">${escape(text)}<span class="term-icon">?</span></span>`
}

function render(): string {
  if (state.filingClosed) {
    return renderHeader() + renderDefeat() + renderTermPopover() + renderBriefingPopover() + renderAmendModal()
  }
  if (state.packetSubmitted) {
    return renderHeader() + renderVictory() + renderTermPopover() + renderBriefingPopover() + renderAmendModal()
  }
  return `
    ${renderHeader()}
    ${renderHospitalIntro()}
    ${!state.briefingDone ? renderBriefingInline() : `
      ${renderClock()}
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
        <h1>Reaper <span class="muted">@ L7 — first-sketch prototype</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./">← back to game</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          Time pressure. The appeal window is closing, and every
          action burns days. CITE the right code, AMEND the record
          — same framework, but the clock changes the rhythm.
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
        Devon Park leans against your office doorframe with that
        carefully-calm look people get when they've been on hold
        with a billing department for an hour. "Hey — I just got a
        letter. Aetna says my knee surgery from last August won't
        be covered. They said it was filed too late. But… we
        scheduled the surgery <em>through</em> them?"
      </p>
      <p>
        He sets the letter on your desk. CO-29. Final denial,
        dated April 20. You pull up the file. The 277CA log
        scrolls past on the second monitor — four bounces,
        same reason each time. The claim never reached Aetna.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and somewhere down the corridor, a clock you can't
        see starts ticking. Loud. The fluorescents dim a half-
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
        "This one is a Reaper. ${term('CO-29')}. Aetna says we
        filed too late. Their final denial went out fifteen days
        ago, which means we have <strong>fourteen days</strong>
        before the appeal window closes for good. After that the
        file is dead and Devon owes $42,300 he doesn't have."
      </p>
      <p>
        "Two issues. Both have to land before the window shuts:"
      </p>
      <ul>
        <li>
          <strong>Amend the claim.</strong> The ${term('Box 1a')}
          subscriber ID has been transposed since day one.
          That's why the ${term('277CA')} kept bouncing it at
          the clearinghouse — it never reached Aetna. Click the
          claim's subscriber line to fix it. <em>This is the
          root-cause fix.</em>
        </li>
        <li>
          <strong>Build a citation.</strong> File an
          ${term('extenuating circumstances waiver')}. You'll
          need to show that we tried to file <em>inside</em> the
          90-day window — the 277CA receipts prove it — and
          point at Aetna's own provider manual section that
          allows for this exact case. <em>This is what unlocks
          the appeal.</em>
        </li>
      </ul>
      <p>
        "Listen carefully — every action takes <strong>days off
        your remaining window</strong>. Reading a chart, building
        a citation, even submitting the packet costs a day or
        two. Wrong picks cost more. If the clock hits zero before
        you submit, the file is closed forever. Move with
        purpose."
      </p>
      <p class="briefing-sign">"The clock isn't your enemy. The paperwork is. — D."</p>
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

function clockColorClass(): string {
  const d = state.daysRemaining
  if (d > 9) return 'safe'
  if (d > 4) return 'warn'
  return 'danger'
}

function renderClock(): string {
  const total = STARTING_DAYS
  const used = total - state.daysRemaining
  const pct = (state.daysRemaining / total) * 100
  const cls = clockColorClass()
  const recent = state.lastDayCost
    ? `<div class="cost-recent">last action: <span class="cost-recent-cost">−${state.lastDayCost.days} day${state.lastDayCost.days === 1 ? '' : 's'}</span> · ${escape(state.lastDayCost.reason)}</div>`
    : `<div class="cost-recent muted">No actions yet. Each one will burn 1–4 days.</div>`
  return `
    <section class="clock ${cls}">
      <div class="clock-h">
        <span class="clock-tag">⏳ APPEAL WINDOW</span>
        <span class="clock-sub">From CO-29 final denial · 14 days total</span>
      </div>
      <div class="clock-row">
        <div class="clock-days">
          <span class="clock-num">${state.daysRemaining}</span>
          <span class="clock-unit">day${state.daysRemaining === 1 ? '' : 's'} left</span>
        </div>
        <div class="clock-cells">
          ${Array.from({ length: total }).map((_, i) => {
            const isUsed = i < used
            return `<span class="clock-cell ${isUsed ? 'used' : ''} ${cls}"></span>`
          }).join('')}
        </div>
      </div>
      <div class="clock-bar"><div class="clock-bar-fill ${cls}" style="width: ${pct}%"></div></div>
      ${recent}
    </section>
  `
}

function renderClaim(): string {
  const claim = reaperCase.claim
  if (!claim || claim.type !== 'cms1500') return ''
  const subscriberResolved = state.resolvedIssues.has('subscriber-id')
  return `
    <div class="claim-with-annotations">
      <section class="claim">
        <div class="claim-h">
          ${term('CMS-1500')} · ${escape(claim.claimId)}
          <span class="claim-explainer">(this is the claim that's been bouncing for nine months)</span>
        </div>
        <div class="claim-grid">
          <div><b>Patient:</b> ${escape(claim.patient.name)} · ${escape(claim.patient.dob)}</div>
          <div class="${subscriberResolved ? 'amended' : 'hi'}">
            <b>${term('Box 1a', "Box 1a · Insured's ID")}: </b>
            ${subscriberResolved
              ? `<span class="mod-applied">${escape(state.currentSubscriberId)}</span>`
              : `<span class="mod-missing">${escape(state.currentSubscriberId)}</span><span class="dx-arrow" aria-hidden="true">⟶</span>`}
          </div>
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
        <div class="claim-status-row">
          ${subscriberResolved
            ? '<span class="claim-status amended">SUBSCRIBER ID AMENDED</span>'
            : '<span class="claim-status disputed">SUBSCRIBER ID DISPUTED</span>'}
        </div>
      </section>
      ${subscriberResolved ? '' : `
        <aside class="claim-annotations">
          <button class="amend-callout" data-action="open-amend">
            <span class="amend-callout-arrow" aria-hidden="true">⟵</span>
            <span class="amend-callout-body">
              <span class="amend-callout-main">✎ Fix the subscriber ID</span>
              <span class="amend-callout-sub">The 277CA log has been mailing us the right one for nine months. Click to amend.</span>
              <span class="amend-callout-cost">~ <strong>${COST.amendCorrect} day</strong> if you pick right · more if you don't</span>
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
          <span class="amend-tag">AMEND BOX 1A · SUBSCRIBER ID</span>
          <span class="amend-sub">Pick the ID that matches the 277CA log.</span>
        </div>
        <div class="amend-context">
          <strong>The 277CA log says:</strong> "subscriber id not found in payer master, ref AET882441293, suggested AET882441923." (Bounced four times — 2025-08-25, 2025-09-14, 2025-10-09, 2026-01-15.)
        </div>
        <ul class="amend-options">
          ${subscriberOptions.map(opt => {
            const fb = state.amendFeedback?.id === opt.id ? state.amendFeedback : null
            return `
              <li class="amend-option ${opt.support === 'current' ? 'current' : ''} ${fb ? 'rejected' : ''}"
                  ${opt.support === 'current' ? '' : `data-action="pick-sub" data-id="${opt.id}"`}>
                <div class="amend-option-h">
                  <code>${escape(opt.label)}</code>
                  ${opt.support === 'current' ? '<span class="amend-option-badge current">currently on claim</span>' : ''}
                </div>
                ${fb ? `<div class="amend-option-fb">${escape(fb.message)}</div>` : ''}
              </li>
            `
          }).join('')}
        </ul>
        <p class="amend-hint-text">
          The 277CA log is the source of truth. Wrong picks cost real days (1–${COST.amendWrong}).
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
          <span class="col-tag">PAYER NOTE · CO-29 final denial</span>
          <span class="col-sub">The denial. Hover a red phrase for plain English; click to select.</span>
        </div>
        <p class="col-prose">
          Aetna's letter dated 2026-04-20 says the claim was
          ${phraseById('window')} — and that the
          ${phraseById('subscriber')}.
        </p>
      </div>
      <div class="col col-chart">
        <div class="col-h">
          <span class="col-tag">FILE (Park, D.)</span>
          <span class="col-sub">Submission history + chart. Click a fact to cite it.</span>
        </div>
        <ul class="facts">
          ${chartFacts.map(f => `
            <li class="fact ${state.selection.chartId === f.id ? 'selected' : ''}"
                data-action="select-chart" data-id="${f.id}">
              <div class="fact-plain">${escape(f.plain)}</div>
              <div class="fact-technical"><span class="src">from file:</span> ${escape(f.technical)}</div>
            </li>
          `).join('')}
        </ul>
      </div>
      <div class="col col-policy">
        <div class="col-h">
          <span class="col-tag">AETNA PROVIDER MANUAL</span>
          <span class="col-sub">Aetna's own rules for waivers + denials. Click a clause to back a citation.</span>
        </div>
        <ul class="clauses">
          ${policyClauses.map(c => `
            <li class="clause ${state.selection.policyId === c.id ? 'selected' : ''}"
                data-action="select-policy" data-id="${c.id}">
              <div class="clause-plain">${escape(c.plain)}</div>
              <div class="clause-technical"><span class="src">policy:</span> ${escape(c.technical)}</div>
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
  const policy = sel.policyId ? policyClauses.find(c => c.id === sel.policyId) : null
  const ready = !!(sel.payerId && sel.chartId && sel.policyId)
  const fbClass = state.feedback ? `fb-${state.feedbackKind}` : ''
  return `
    <section class="builder">
      <div class="builder-h">Citation builder <span class="builder-cost">CITE costs ${COST.citeCorrect}–${COST.citeDistractor} days</span></div>
      <div class="builder-row">
        <div class="slot ${payer ? 'filled' : ''}">
          <div class="slot-label">PAYER ASSERTS</div>
          <div class="slot-text">${payer ? '"' + escape(payer.text) + '"' : '<span class="placeholder">Click a payer phrase</span>'}</div>
        </div>
        <div class="connector">cited by</div>
        <div class="slot ${chart ? 'filled' : ''}">
          <div class="slot-label">FILE EVIDENCE</div>
          <div class="slot-text">${chart ? escape(chart.plain) : '<span class="placeholder">Click a file entry</span>'}</div>
        </div>
        <div class="connector">per</div>
        <div class="slot ${policy ? 'filled' : ''}">
          <div class="slot-label">POLICY CLAUSE</div>
          <div class="slot-text">${policy ? escape(policy.plain) : '<span class="placeholder">Click a policy clause</span>'}</div>
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
      <div class="checklist-h">Appeal packet — ${state.resolvedIssues.size} of ${issues.length} issues addressed</div>
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
        FILE TIMELY-FILING WAIVER · ${COST.submit} day
      </button>
      ${state.failedAttempts > 0 ? `<div class="fail-counter">Wrong moves so far: ${state.failedAttempts}.</div>` : ''}
    </section>
  `
}

const RECAP: CaseRecap = CASE_RECAPS['reaper']

function renderVictory(): string {
  const saved = state.daysRemaining
  return `
    <section class="victory">
      <h2>The waiver lands.</h2>
      <p class="register hospital">Hospital, eight days later.</p>
      <p>
        Aetna's appeals team accepts the extenuating-circumstances
        waiver. The 277CA chain did the heavy lifting — they could
        see the original 2025-08-22 submission stamp, well inside
        the window. The corrected claim adjudicates in the next
        ERA. Devon won't owe the $42,300.
      </p>
      <p class="register waiting-room">Waiting Room.</p>
      <p>
        The Reaper is gone. Where it stood, an unsealed file
        folder is sitting on a table — Devon Park, 2025-08-15 —
        with four 277CA receipts paperclipped to the cover.
        ${saved >= 8
          ? "You finished with " + saved + " days to spare."
          : saved >= 3
            ? "You finished with " + saved + " day" + (saved === 1 ? "" : "s") + " left. Cut it close."
            : "You finished with " + saved + " day" + (saved === 1 ? "" : "s") + " left. The clock made it."}
      </p>
      <button class="btn primary" data-action="reset">Run it again</button>
      <a class="back-link inline" href="./">← back to game</a>
    </section>
    ${renderCaseRecap(RECAP)}
  `
}

function renderDefeat(): string {
  return `
    <section class="defeat">
      <h2>The Reaper closes the file.</h2>
      <p class="register waiting-room">Waiting Room.</p>
      <p>
        The appeal window shut while you were still on the
        wrong subscriber ID. The Reaper sets the folder down on
        the closed-claims pile without a sound. Aetna's CO-29 is
        final.
      </p>
      <p class="register hospital">Hospital, the next morning.</p>
      <p>
        Devon's bill is now $42,300 of patient responsibility.
        He'll need a payment plan, financial assistance, or
        bankruptcy. None of those are healing.
      </p>
      <p class="defeat-lesson">
        Time pressure is the lesson. You can't try every fact;
        you have to read carefully and pick once. Watch the
        277CA log — it told you the right ID nine months ago.
      </p>
      <button class="btn primary" data-action="reset">Try again</button>
      <a class="back-link inline" href="./">← back to game</a>
    </section>
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
          <h3>What's different from Wraith + Bundle</h3>
          <ul>
            <li><b>Time pressure drives it.</b> A real countdown — 14 days — visible at all times. Every action burns days. Run out, lose the file.</li>
            <li><b>Cost preview on every action.</b> The amend callout, the CITE button, even SUBMIT show their day-cost up front. Players choose with knowledge.</li>
            <li><b>Wrong picks have real cost.</b> A wrong subscriber ID burns 3 days. A mismatched citation burns 3–4. There's no "no penalty" mode here — that's the whole point.</li>
            <li><b>Different field again.</b> Box 1a (subscriber ID), not Box 21 (dx) or Box 24 (modifier). The framework handles any field; this proves it.</li>
            <li><b>The amend lives in the 277CA log, not the chart.</b> Source of truth shifts to clearinghouse data. Reads as RCM-real.</li>
            <li><b>A lose state.</b> First prototype where the player can fail. Defeat screen frames it as a lesson, not a punishment.</li>
          </ul>
        </div>
        <div>
          <h3>What this prototype proves (or tries to)</h3>
          <ul>
            <li>The framework absorbs time pressure as a budget rather than a separate mode. Same workbench, same builder — the only new UI is the clock at the top.</li>
            <li>Urgency reads as urgency, not as stress, when the player can see the cost of every action up front.</li>
            <li>277CA / 837P / EDI machinery is teachable inside the encounter loop without dumping a glossary on the player.</li>
            <li>Dana's voice generalizes again: she explains the time budget the same way she explains a modifier — calm, specific, in your ear.</li>
            <li>The dreamlike fall and register flip work even when the encounter mood is "the clock is ticking" rather than "the form is wrong."</li>
          </ul>
        </div>
      </div>
      <p class="notes-cta">
        Side-by-side comparison: open the
        <a href="./wraith-prototype.html">Wraith</a> or
        <a href="./bundle-prototype.html">Bundle</a> in another
        tab. The shape is the same; the rhythm is not. That's
        the framework working.
      </p>
    </section>
  `
}

// === Interactions ===

function findFact(id: string) { return chartFacts.find(f => f.id === id) }
function findPayer(id: string) { return payerPhrases.find(p => p.id === id) }
function findPolicy(id: string) { return policyClauses.find(c => c.id === id) }

function setFeedback(text: string, kind: 'good' | 'bad' | 'neutral' = 'neutral') {
  state.feedback = text
  state.feedbackKind = kind
}

function clearSelection() {
  state.selection = { payerId: null, chartId: null, policyId: null }
}

function attemptCite() {
  if (state.filingClosed || state.packetSubmitted) return
  const sel = state.selection
  if (!sel.payerId || !sel.chartId || !sel.policyId) return

  const payer = findPayer(sel.payerId)!
  const chart = findFact(sel.chartId)!
  const policy = findPolicy(sel.policyId)!

  // Distractor chart fact: max cost (researching down a dead end).
  if (chart.issueId === null) {
    state.failedAttempts += 1
    spendDays(COST.citeDistractor, `chased a fact that didn't bear on the appeal`)
    setFeedback(
      `That fact doesn't move the appeal. ${chart.distractorReason ?? ''} Cost ${COST.citeDistractor} days.`,
      'bad'
    )
    state.lastRecap = ''
    return
  }
  if (policy.issueId === null) {
    state.failedAttempts += 1
    spendDays(COST.citeDistractor, `pulled the wrong section of the manual`)
    setFeedback(
      `That clause doesn't apply here. ${policy.distractorReason ?? ''} Cost ${COST.citeDistractor} days.`,
      'bad'
    )
    state.lastRecap = ''
    return
  }

  if (payer.issueId === chart.issueId && chart.issueId === policy.issueId) {
    const issue = issues.find(i => i.id === chart.issueId)!

    if (issue.verb === 'amend') {
      state.failedAttempts += 1
      spendDays(COST.citeMismatch, `built an argument when the issue needed an amend`)
      setFeedback(
        `These pieces line up — but this issue is solved by *amending* the claim, not arguing. Click 'Fix the subscriber ID' next to the claim. Cost ${COST.citeMismatch} days.`,
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
    spendDays(COST.citeCorrect, `assembled the waiver citation`)
    setFeedback(`Citation accepted. Issue addressed: ${issue.label} (cost ${COST.citeCorrect} days)`, 'good')
    state.lastRecap = issue.recap
    clearSelection()
    return
  }

  state.failedAttempts += 1
  spendDays(COST.citeMismatch, `built a citation that didn't hold together`)
  setFeedback(buildMismatchFeedback(payer, chart, policy), 'bad')
  state.lastRecap = ''
}

function buildMismatchFeedback(
  payer: PayerPhrase,
  chart: ChartFact,
  policy: PolicyClause,
): string {
  const lines: string[] = []
  lines.push(`Those three don't fit together yet (cost ${COST.citeMismatch} days). Here's where each one points:`)
  lines.push('')
  lines.push(`• Payer phrase: addresses "${issueDescription(payer.issueId)}".`)
  if (chart.issueId === null) {
    lines.push(`• File evidence: distractor — ${chart.distractorReason ?? 'not relevant.'}`)
  } else {
    const issue = issues.find(i => i.id === chart.issueId)!
    if (issue.verb === 'amend') {
      lines.push(`• File evidence: this is amend territory — fix the subscriber ID on the claim instead.`)
    } else {
      lines.push(`• File evidence: addresses "${issueDescription(chart.issueId)}".`)
    }
  }
  if (policy.issueId === null) {
    lines.push(`• Policy clause: distractor — ${policy.distractorReason ?? 'not relevant.'}`)
  } else {
    const policyIssue = issues.find(i => i.id === policy.issueId)!
    if (policyIssue.verb === 'amend') {
      lines.push(`• Policy clause: this is amend territory — use the amend callout.`)
    } else {
      lines.push(`• Policy clause: addresses "${issueDescription(policy.issueId)}".`)
    }
  }
  lines.push('')
  lines.push('A citation works when all three pieces address the same issue.')
  return lines.join('\n')
}

function issueDescription(issueId: string): string {
  const issue = issues.find(i => i.id === issueId)
  return issue ? issue.label : '(unknown)'
}

function attemptAmend(id: string) {
  if (state.filingClosed || state.packetSubmitted) return
  const opt = subscriberOptions.find(d => d.id === id)
  if (!opt) return

  if (opt.support === 'wrong') {
    state.failedAttempts += 1
    spendDays(COST.amendWrong, `picked a wrong subscriber ID`)
    state.amendFeedback = { id: opt.id, message: opt.feedback + ` (Cost ${COST.amendWrong} days.)` }
    return
  }
  if (opt.support === 'partial') {
    state.failedAttempts += 1
    spendDays(COST.amendPartial, `picked a near-miss subscriber ID`)
    state.amendFeedback = { id: opt.id, message: opt.feedback + ` (Cost ${COST.amendPartial} days.)` }
    return
  }

  state.currentSubscriberId = opt.id
  state.amendOpen = false
  state.amendFeedback = null
  if (!state.resolvedIssues.has('subscriber-id')) {
    state.resolvedIssues.add('subscriber-id')
    spendDays(COST.amendCorrect, `amended the subscriber ID`)
    const issue = issues.find(i => i.id === 'subscriber-id')!
    setFeedback(
      `Claim amended. Box 1a now reads ${opt.id}. Issue addressed (cost ${COST.amendCorrect} day).`,
      'good'
    )
    state.lastRecap = issue.recap
  }
}

function attemptSubmit() {
  if (state.filingClosed || state.packetSubmitted) return
  if (state.resolvedIssues.size < issues.length) return
  // Mark submitted first; spendDays() guards filingClosed on !packetSubmitted,
  // so a clutch submit that lands the clock exactly at 0 still counts as a win.
  state.packetSubmitted = true
  notifyParentVictory('reaper')
  spendDays(COST.submit, `filed the waiver packet`)
}

function reset() {
  state.selection = { payerId: null, chartId: null, policyId: null }
  state.resolvedIssues = new Set()
  state.citationCount = 0
  state.failedAttempts = 0
  state.feedback = ''
  state.feedbackKind = 'neutral'
  state.lastRecap = ''
  state.packetSubmitted = false
  state.filingClosed = false
  state.briefingDone = false
  state.amendOpen = false
  state.currentSubscriberId = 'AET882441293'
  state.daysRemaining = STARTING_DAYS
  state.daysSpent = []
  state.lastDayCost = null
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
    case 'select-policy': state.selection.policyId = id ?? null; setFeedback(''); break
    case 'cite': attemptCite(); break
    case 'clear': clearSelection(); setFeedback(''); state.lastRecap = ''; break
    case 'submit': attemptSubmit(); break
    case 'reset': reset(); break
    case 'dismiss-briefing': dismissBriefing(); break
    case 'show-briefing': showBriefing(); break
    case 'close-briefing': closeBriefing(); break
    case 'open-amend': openAmend(); break
    case 'close-amend': closeAmend(); break
    case 'pick-sub': if (id) attemptAmend(id); break
    case 'open-term': if (el.dataset.term) openTerm(el.dataset.term); break
    case 'close-term': closeTerm(); break
    default: return
  }
  rerender()
}

// === Mount ===

// Reaper-specific CSS — clock, claim-with-annotations override,
// workbench/builder, defeat screen. Base styles via BASE_CSS.
const css = districtVars('appeals') + BASE_CSS + `
  :root {
    --time-safe: #7ee2c1;
    --time-warn: #f0a868;
    --time-danger: #ef5b7b;
  }
  /* Hover tooltip pattern (used by payer phrases). */
  .hover-tip {
    position: absolute; bottom: calc(100% + 8px); left: 0;
    z-index: 50; min-width: 200px; max-width: 320px;
    padding: 10px 14px; background: var(--panel); color: var(--ink);
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

  /* Clock — Reaper's signature countdown. */
  .clock {
    background: var(--panel);
    border: 1px solid #232a36; border-left-width: 4px;
    border-radius: 8px; padding: 14px 18px; margin-bottom: 22px;
    position: relative; overflow: hidden;
  }
  .clock.safe { border-left-color: var(--time-safe); }
  .clock.warn { border-left-color: var(--time-warn); }
  .clock.danger { border-left-color: var(--time-danger); animation: clock-pulse 1.6s ease-in-out infinite; }
  @keyframes clock-pulse {
    0%, 100% { box-shadow: inset 4px 0 0 0 var(--time-danger); }
    50% { box-shadow: inset 4px 0 0 0 var(--time-danger), 0 0 18px rgba(239, 91, 123, 0.25); }
  }
  .clock-h { display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px; }
  .clock-tag { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent-2); }
  .clock-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .clock-row { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
  .clock-days { display: flex; align-items: baseline; gap: 6px; }
  .clock.safe .clock-num { color: var(--time-safe); }
  .clock.warn .clock-num { color: var(--time-warn); }
  .clock.danger .clock-num { color: var(--time-danger); }
  .clock-num { font-size: 36px; font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
  .clock-unit { font-size: 13px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.08em; }
  .clock-cells { display: flex; gap: 3px; flex-wrap: wrap; flex: 1; min-width: 200px; }
  .clock-cell { width: 18px; height: 22px; border-radius: 2px; background: rgba(126, 226, 193, 0.12); border: 1px solid rgba(126, 226, 193, 0.3); }
  .clock-cell.warn { background: rgba(240, 168, 104, 0.12); border-color: rgba(240, 168, 104, 0.3); }
  .clock-cell.danger { background: rgba(239, 91, 123, 0.12); border-color: rgba(239, 91, 123, 0.3); }
  .clock-cell.used { background: rgba(80, 80, 80, 0.4); border-color: rgba(120, 120, 120, 0.4); position: relative; }
  .clock-cell.used::after { content: "×"; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: rgba(216, 222, 233, 0.45); font-weight: 700; font-size: 13px; }
  .clock-bar { height: 4px; background: rgba(80, 80, 80, 0.4); border-radius: 2px; margin-top: 10px; overflow: hidden; }
  .clock-bar-fill { height: 100%; transition: width 0.45s ease, background 0.3s; }
  .clock-bar-fill.safe { background: var(--time-safe); }
  .clock-bar-fill.warn { background: var(--time-warn); }
  .clock-bar-fill.danger { background: var(--time-danger); }
  .cost-recent { margin-top: 8px; font-size: 12px; color: var(--ink); }
  .cost-recent.muted { color: var(--ink-dim); font-style: italic; }
  .cost-recent-cost { color: var(--bad); font-weight: 700; }

  /* Reaper-specific claim layout — annotations sit higher (less padding-top
     because the Reaper claim has a tighter top section). */
  .claim-annotations { width: 240px; padding-top: 60px; }
  .claim-grid > div { padding: 4px 6px; border-radius: 3px; }
  .claim-grid .term { color: #1c1c1c; }
  .claim-grid .term-icon { background: #5a4d2b; color: var(--paper); }
  .claim-grid .hi { background: var(--hi); box-shadow: inset 0 0 0 1px var(--hi-border); }
  .claim-grid .amended { background: rgba(126, 226, 193, 0.15); box-shadow: inset 0 0 0 1px var(--good); }
  .claim-status-row { margin-top: 10px; text-align: right; }

  /* Per-action cost callout below the amend prompt. */
  .amend-callout-cost { font-size: 11px; color: var(--accent-2); margin-top: 4px; padding-top: 4px; border-top: 1px dashed rgba(240, 168, 104, 0.3); }
  .amend-callout-cost strong { color: var(--accent-2); }

  /* Workbench (3-col: payer / chart / policy). */
  .workbench { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; margin-bottom: 22px; }
  @media (max-width: 980px) { .workbench { grid-template-columns: 1fr; } }
  .col { background: var(--panel); border: 1px solid #232a36; border-radius: 8px; padding: 14px 16px; }
  .col-h { display: flex; flex-direction: column; gap: 2px; margin-bottom: 8px; }
  .col-tag { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
  .col-payer .col-tag { color: var(--bad); }
  .col-chart .col-tag { color: var(--accent); }
  .col-policy .col-tag { color: #a3c5ff; }
  .col-sub { font-size: 11.5px; color: var(--ink-dim); }
  .col-prose { font-size: 13.5px; line-height: 1.7; margin: 0; }

  .phrase { cursor: pointer; background: rgba(239, 91, 123, 0.15); border-bottom: 1px dashed var(--bad); padding: 2px 5px; border-radius: 3px; transition: background 0.15s; position: relative; display: inline; }
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

  .facts, .clauses { list-style: none; padding-left: 0; margin: 0; }
  .fact, .clause { padding: 10px 12px; margin: 6px 0; background: var(--panel-2); border-radius: 5px; border-left: 3px solid transparent; cursor: pointer; transition: all 0.15s; position: relative; }
  .fact:hover, .clause:hover { background: #232b3a; }
  .fact.selected { border-left-color: var(--accent); background: rgba(177, 139, 214, 0.1); }
  .clause.selected { border-left-color: #a3c5ff; background: rgba(163, 197, 255, 0.08); }
  .fact-plain, .clause-plain { font-size: 13.5px; color: var(--ink); line-height: 1.45; }
  .fact-technical, .clause-technical { font-size: 11px; color: rgba(138, 147, 163, 0.65); margin-top: 6px; padding-top: 5px; border-top: 1px dashed rgba(138, 147, 163, 0.15); line-height: 1.4; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .fact-technical .src, .clause-technical .src { color: rgba(138, 147, 163, 0.45); text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px; margin-right: 4px; font-family: inherit; }

  /* Citation builder with cost annotation. */
  .builder { background: var(--panel); border: 1px solid #232a36; border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .builder-h { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-dim); margin-bottom: 10px; display: flex; justify-content: space-between; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .builder-cost { font-size: 11px; color: var(--accent-2); text-transform: none; letter-spacing: normal; font-style: italic; }
  .builder-row { display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; gap: 10px; align-items: stretch; }
  @media (max-width: 980px) { .builder-row { grid-template-columns: 1fr; } .connector { text-align: center; padding: 4px 0; } }
  .slot { padding: 10px 12px; background: var(--panel-2); border: 1px dashed #2a3142; border-radius: 5px; min-height: 60px; }
  .slot.filled { border-style: solid; border-color: #3a4658; }
  .slot-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-dim); margin-bottom: 4px; }
  .slot-text { font-size: 13px; }
  .placeholder { color: var(--ink-dim); font-style: italic; }
  .connector { color: var(--ink-dim); font-size: 12px; align-self: center; padding: 0 6px; font-style: italic; }
  .builder-actions { margin-top: 12px; display: flex; gap: 10px; }

  /* Defeat screen — Reaper closes the file. */
  .defeat { background: var(--panel); border: 1px solid #232a36; border-radius: 8px; padding: 32px 28px; margin: 22px 0 60px; text-align: center; }
  .defeat h2 { font-size: 26px; margin-bottom: 16px; color: var(--bad); }
  .defeat p { max-width: 560px; margin: 12px auto; }
  .defeat .register { margin-top: 20px; }
  .defeat .btn.primary { margin-top: 24px; }
  .defeat .back-link.inline { display: block; margin-top: 16px; font-size: 12px; }
  .defeat-lesson { font-style: italic; color: var(--ink-dim); border-top: 1px dashed #2a3142; border-bottom: 1px dashed #2a3142; padding: 14px 16px; margin-top: 24px !important; }
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
