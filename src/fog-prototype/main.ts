// Fog @ L3 (eligibility / pre-submission).
//
// Sibling to wraith / bundle / reaper / gatekeeper. Same shape
// (Hospital intro → dreamlike fall → Waiting Room → claim form
// + middle work + checklist), tuned to a different action set:
//
//   - Reveal: run a 270 eligibility inquiry to
//     surface what registration got wrong. Until you do, the
//     suspect fields on the claim are literally fogged over —
//     you know something's off, you can't tell what.
//   - Amend finishes it. After the 271 response comes back,
//     the fog burns off and discrepancies show up red. Amend
//     each wrong field against the 271 as the source of truth.
//
// Different from Gatekeeper: this is BEFORE submit, not an
// appeal after denial. The encounter is upstream — fix at
// registration so the claim never breaks downstream.
//
// Demonstrates: visual fog → reveal → amend reads as a
// distinct rhythm. Same hospital intro / register flip / Dana
// voice / claim / checklist / submit shape — different middle.

import { CASES } from '../content/cases'
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

interface InquiryEntry {
  id: string
  field: string
  /** What the claim shows. */
  claimValue: string
  /** What 271 says. */
  payerValue: string
  /** True if this is an actual discrepancy that requires amending. */
  isDiscrepancy: boolean
  /** Cosmetic difference, not a real issue. */
  benign?: boolean
  /** Explanation surfaced when the player inspects this field. */
  note: string
}

interface AmendOption {
  value: string
  support: 'current' | 'correct' | 'wrong'
  feedback: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'reveal' | 'amend'
}

interface GlossaryEntry {
  term: string
  plain: string
}

const issues: Issue[] = [
  {
    id: 'reveal',
    label: 'Run a 270 eligibility inquiry to clear the fog.',
    recap: "You sent a 270 inquiry and got the 271 back. That's the official record — Linh's coverage today, straight from Anthem's eligibility system. Whatever's on the registration form has to match this.",
    verb: 'reveal',
  },
  {
    id: 'amend-subscriber',
    label: 'Amend the subscriber ID to match the 271 response.',
    recap: "The card Linh handed over at the front desk was from her previous employer's plan. The 271 returned her current plan's subscriber ID. Fixed at the source — the claim now matches Anthem's records before submission, so it lands clean instead of bouncing.",
    verb: 'amend',
  },
  {
    id: 'amend-group',
    label: 'Amend the group number to match the 271 response.',
    recap: "Same story as the subscriber ID — the group number was tied to her old employer. The new plan has a different group. Anthem's adjudication engine matches both fields; mismatched group means denial even with the right subscriber ID.",
    verb: 'amend',
  },
]

interface InquiryAmendable {
  field: 'subscriber' | 'group'
  options: AmendOption[]
  truth: string
}

const subscriberAmend: InquiryAmendable = {
  field: 'subscriber',
  truth: 'ANT772041',
  options: [
    { value: 'ANT883112', support: 'current', feedback: "What's currently on the claim — from her old card. The 271 explicitly says this isn't her ID anymore." },
    { value: 'ANT772041', support: 'correct', feedback: "Matches the 271 response. Her current Anthem PPO subscriber ID since the job change in November." },
    { value: 'ANT772014', support: 'wrong', feedback: "Last two digits transposed. Won't match — Anthem's adjudication engine does exact-string matching on subscriber IDs." },
    { value: 'ANT883120', support: 'wrong', feedback: "That's not what the 271 returned. Always trust the eligibility response over the card photocopy or your memory of it." },
  ],
}

const groupAmend: InquiryAmendable = {
  field: 'group',
  truth: '0066114',
  options: [
    { value: '0048221', support: 'current', feedback: "What's currently on the claim — her old employer's group. The 271 returned a different group entirely." },
    { value: '0066114', support: 'correct', feedback: "Matches the 271. New employer's group number, in effect since the job change." },
    { value: '0066141', support: 'wrong', feedback: "Last two digits transposed. Won't match — Anthem matches the full group string." },
    { value: '0066', support: 'wrong', feedback: "That's a partial — group numbers are seven digits. The 271 returned the full string; transcribe it whole." },
  ],
}

const inquiryEntries: InquiryEntry[] = [
  {
    id: 'subscriber',
    field: 'Subscriber ID',
    claimValue: 'ANT883112',
    payerValue: 'ANT772041',
    isDiscrepancy: true,
    note: "Different. The card on file is from her previous employer's plan; she changed jobs in November and her ID changed with the plan.",
  },
  {
    id: 'group',
    field: 'Group Number',
    claimValue: '0048221',
    payerValue: '0066114',
    isDiscrepancy: true,
    note: "Different. Same root cause — old employer's group. New plan, new group.",
  },
  {
    id: 'name',
    field: 'Patient Name',
    claimValue: 'NGUYEN, LINH',
    payerValue: 'Linh Q. Nguyen',
    isDiscrepancy: false,
    benign: true,
    note: "Cosmetic difference only. The 271 stores middle initial; the claim doesn't. Both forms identify the same person; this won't trigger a denial.",
  },
  {
    id: 'dob',
    field: 'Date of Birth',
    claimValue: '1996-12-04',
    payerValue: '1996-12-04',
    isDiscrepancy: false,
    note: "Match. Anthem's record has the same DOB as the claim — nothing to fix here.",
  },
  {
    id: 'plan-type',
    field: 'Plan Type',
    claimValue: 'PPO',
    payerValue: 'PPO',
    isDiscrepancy: false,
    note: "Match. Both plans were PPOs — that's why the plan-type field looked fine even before the inquiry. Subscriber ID + group are what changed.",
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'eligibility': {
    term: 'Eligibility',
    plain: "Whether the patient's insurance is active and covers the service on the date of service. Eligibility is a rolling state — it can change with a job change, a missed premium, an enrollment-period switch. Always verify on the day, every day.",
  },
  '270': {
    term: '270 (eligibility inquiry)',
    plain: "The X12 EDI transaction the provider sends to the payer (or eligibility vendor) to ask: is this patient covered, by what plan, with what subscriber ID, what's their copay/deductible? The 270 is the first thing a smart front desk runs after someone hands over a card.",
  },
  '271': {
    term: '271 (eligibility response)',
    plain: "The payer's reply to a 270. The 271 carries the official record — current plan, subscriber ID, group, deductible status, copay, network indicator. The 271 is the source of truth; the card photocopy is not.",
  },
  'CMS-1500': {
    term: 'CMS-1500',
    plain: "The standard claim form for outpatient services. Numbered boxes; this encounter cares about Box 1a (subscriber ID) and Box 11 (group number) — the two fields registration most often gets wrong on a job-change patient.",
  },
  'COB': {
    term: 'COB (coordination of benefits)',
    plain: "When a patient has more than one insurance, COB is the rules for which one pays first. Initialized at registration based on the patient's response to the questionnaire. Full COB chains are a level-9 problem; this encounter is single-payer, but the COB field on the registration screen still has to be set correctly.",
  },
  'eligibility vendor': {
    term: 'Eligibility vendor',
    plain: "A third-party platform (Availity, Trizetto, Change Healthcare, etc.) that sits between the provider and the payer's eligibility system. Most 270/271 traffic actually flows through one of these — the provider talks to the vendor, the vendor talks to the payer. Vendors sometimes return stale data; the savvy biller cross-checks against the payer portal directly when the 271 looks off.",
  },
}

// === Runtime state ===

const state = {
  briefingDone: false,
  briefingOpen: false,
  fogDispelled: false,
  inquiring: false,
  amendOpen: null as null | 'subscriber' | 'group',
  amendFeedback: null as { value: string; message: string } | null,
  /** Current claim values. Mutate as the player amends. */
  claim: {
    subscriber: 'ANT883112',
    group: '0048221',
  },
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  feedback: '' as string,
  feedbackKind: 'neutral' as 'neutral' | 'good' | 'bad',
  lastRecap: '' as string,
  packetSubmitted: false,
  openTermId: null as string | null,
  openInquiryDetail: null as string | null,
}

const fogCase = CASES.case_fog_nguyen

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
      ${renderInquiry()}
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
        <h1>Fog <span class="muted">@ L3</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./">← back to game</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          Upstream, not downstream — fix the claim
          <em>before</em> it submits, not after it bounces.
          Claim fields are fogged until you run a ${term('270')} inquiry.
          Once the ${term('271')} comes back, the fog burns
          off and the wrong fields glow red. See the
          <a href="#design-notes">design notes</a> for what
          this prototype is testing.
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
        Linh Nguyen comes in for a sore throat. She hands over
        her insurance card at the front desk; the registrar
        keys it in. You happen to walk past as the
        registration screen lights up green — accepted. But
        Linh mentions, almost in passing, that she changed
        jobs in November. The registrar shrugs. "It said
        accepted."
      </p>
      <p>
        You pull up the claim before it submits. Subscriber ID
        is there. Group is there. Everything <em>looks</em>
        fine. But it shimmers a little when you look at it.
        Like there's something behind it you can't see.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and somewhere down the corridor, a soft mist
        rolls in. Cool. Featureless. The fluorescents go
        translucent. You're somewhere else.</em>
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
        "This one is the Fog. ${term('eligibility', 'Eligibility')}.
        Linh changed jobs three months ago. The card she handed
        over at the front desk is from her old plan. The
        registration screen accepted it because the format was
        valid — but the data is stale. If this claim drops as
        is, it'll bounce off Anthem's adjudication engine for a
        subscriber-not-found, and we'll be cleaning it up
        for the next month."
      </p>
      <p>
        "Two issues, in order. The reveal first — without it,
        you can't see what's wrong:"
      </p>
      <ul>
        <li>
          <strong>Run a ${term('270')} inquiry.</strong> Send
          the eligibility check to Anthem; the ${term('271')}
          response comes back with her current plan,
          subscriber ID, group. The fog burns off. Differences
          show up red.
        </li>
        <li>
          <strong>Amend whatever the 271 flagged.</strong> Not
          every difference is a problem (a name format
          difference is fine). The real issues are the
          subscriber ID and the group number — old employer's
          plan, both stale. Fix them against the 271 as the
          source of truth.
        </li>
      </ul>
      <p>
        "Don't trust the card photocopy. Trust the 271. Always.
        That's the rule. The card is what someone said; the
        271 is what's actually true today."
      </p>
      <p class="briefing-sign">"Trust the 271, not the card. — D."</p>
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

function fieldStatus(fieldId: 'subscriber' | 'group'): 'fogged' | 'wrong' | 'amended' {
  if (!state.fogDispelled) return 'fogged'
  if (state.resolvedIssues.has(fieldId === 'subscriber' ? 'amend-subscriber' : 'amend-group')) return 'amended'
  return 'wrong'
}

function renderClaim(): string {
  const claim = fogCase.claim
  if (!claim || claim.type !== 'cms1500') return ''
  const subStatus = fieldStatus('subscriber')
  const grpStatus = fieldStatus('group')
  const subscriberCellHtml = subStatus === 'fogged'
    ? `<span class="fogged-value">${escape(state.claim.subscriber)}</span>`
    : subStatus === 'amended'
      ? `<span class="mod-applied">${escape(state.claim.subscriber)}</span>`
      : `<span class="mod-missing">${escape(state.claim.subscriber)}</span>`
  const groupCellHtml = grpStatus === 'fogged'
    ? `<span class="fogged-value">${escape(state.claim.group)}</span>`
    : grpStatus === 'amended'
      ? `<span class="mod-applied">${escape(state.claim.group)}</span>`
      : `<span class="mod-missing">${escape(state.claim.group)}</span>`
  return `
    <div class="claim-with-annotations">
      <section class="claim ${state.fogDispelled ? '' : 'fogged'}">
        ${state.fogDispelled ? '' : '<div class="fog-overlay" aria-hidden="true"></div>'}
        <div class="claim-h">
          ${term('CMS-1500')} · ${escape(claim.claimId)}
          <span class="claim-explainer">${state.fogDispelled
            ? '(eligibility cleared. Wrong fields glowing red.)'
            : '(staged for submission. Something feels off.)'}</span>
        </div>
        <div class="claim-grid">
          <div><b>Patient:</b> ${escape(claim.patient.name)} · ${escape(claim.patient.dob)}</div>
          <div class="${subStatus}-row">
            <b>Box 1a · Subscriber ID:</b> ${subscriberCellHtml}
            ${subStatus === 'wrong' ? '<span class="dx-arrow" aria-hidden="true">⟶</span>' : ''}
          </div>
          <div><b>Insurer:</b> ${escape(claim.insured.name ?? '')}</div>
          <div class="${grpStatus}-row">
            <b>Box 11 · Group:</b> ${groupCellHtml}
            ${grpStatus === 'wrong' ? '<span class="dx-arrow" aria-hidden="true">⟶</span>' : ''}
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
      ${state.fogDispelled
        ? `<aside class="claim-annotations">
            ${subStatus === 'wrong' ? `
              <button class="amend-callout" data-action="open-amend" data-id="subscriber">
                <span class="amend-callout-arrow" aria-hidden="true">⟵</span>
                <span class="amend-callout-body">
                  <span class="amend-callout-main">✎ Subscriber ID disputed</span>
                  <span class="amend-callout-sub">271 returned a different value. Click to amend.</span>
                </span>
              </button>` : ''}
            ${grpStatus === 'wrong' ? `
              <button class="amend-callout" data-action="open-amend" data-id="group">
                <span class="amend-callout-arrow" aria-hidden="true">⟵</span>
                <span class="amend-callout-body">
                  <span class="amend-callout-main">✎ Group number disputed</span>
                  <span class="amend-callout-sub">271 returned a different value. Click to amend.</span>
                </span>
              </button>` : ''}
          </aside>`
        : `<aside class="claim-annotations">
            <div class="fog-hint">
              <div class="fog-hint-icon">🌫</div>
              <div class="fog-hint-body">
                <div class="fog-hint-main">Fields hidden by the Fog</div>
                <div class="fog-hint-sub">Run the ${term('270')} inquiry below to clear it.</div>
              </div>
            </div>
          </aside>`}
    </div>
  `
}

function renderInquiry(): string {
  if (state.inquiring) {
    return `
      <section class="inquiry-panel pending">
        <div class="inquiry-h">
          <span class="inquiry-tag">${term('270')} INQUIRY · IN TRANSIT</span>
          <span class="inquiry-sub">Routing to Anthem's eligibility system…</span>
        </div>
        <div class="inquiry-body pending-body">
          <div class="spinner"></div>
          <span>Awaiting ${term('271')} response… checking current plan, subscriber, group, network…</span>
        </div>
      </section>
    `
  }
  if (!state.fogDispelled) {
    return `
      <section class="inquiry-panel idle">
        <div class="inquiry-h">
          <span class="inquiry-tag">${term('270')} INQUIRY</span>
          <span class="inquiry-sub">Pre-submission eligibility check.</span>
        </div>
        <div class="inquiry-body idle-body">
          <p class="idle-prose">
            Send a ${term('270')} eligibility inquiry to Anthem
            for Linh Nguyen, DOS 2026-02-21. Costs nothing —
            this is what the front desk should have done at
            check-in. The ${term('271')} response will come
            back with the current plan on file.
          </p>
          <button class="btn primary" data-action="run-270">
            Run 270 inquiry
          </button>
        </div>
      </section>
    `
  }
  // Revealed: show the 271 response panel.
  return `
    <section class="inquiry-panel revealed">
      <div class="inquiry-h">
        <span class="inquiry-tag">${term('271')} RESPONSE · ANTHEM BCBS</span>
        <span class="inquiry-sub">Active coverage. Click any row for the diff.</span>
      </div>
      <div class="inquiry-body revealed-body">
        <table class="inquiry-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Claim has</th>
              <th></th>
              <th>271 says</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${inquiryEntries.map(e => {
              const open = state.openInquiryDetail === e.id
              const claimDisplay = e.id === 'subscriber'
                ? state.claim.subscriber
                : e.id === 'group'
                  ? state.claim.group
                  : e.claimValue
              const fixed = e.id === 'subscriber'
                ? state.resolvedIssues.has('amend-subscriber')
                : e.id === 'group'
                  ? state.resolvedIssues.has('amend-group')
                  : false
              const status = !e.isDiscrepancy
                ? (e.benign ? 'benign' : 'match')
                : fixed
                  ? 'fixed'
                  : 'wrong'
              return `
                <tr class="inquiry-row ${status} ${open ? 'open' : ''}"
                    data-action="toggle-detail" data-id="${e.id}">
                  <td class="ir-field">${escape(e.field)}</td>
                  <td class="ir-claim"><code>${escape(claimDisplay)}</code></td>
                  <td class="ir-arrow">→</td>
                  <td class="ir-payer"><code>${escape(e.payerValue)}</code></td>
                  <td class="ir-status">
                    ${status === 'wrong'
                      ? '<span class="badge wrong">DIFFERS</span>'
                      : status === 'fixed'
                        ? '<span class="badge fixed">RESOLVED</span>'
                        : status === 'benign'
                          ? '<span class="badge benign">cosmetic</span>'
                          : '<span class="badge match">match</span>'}
                  </td>
                </tr>
                ${open ? `
                  <tr class="inquiry-detail-row"><td colspan="5">
                    <div class="inquiry-detail">${escape(e.note)}</div>
                  </td></tr>
                ` : ''}
              `
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function amendablesFor(field: 'subscriber' | 'group'): InquiryAmendable {
  return field === 'subscriber' ? subscriberAmend : groupAmend
}

function renderAmendModal(): string {
  if (!state.amendOpen) return ''
  const data = amendablesFor(state.amendOpen)
  const fieldLabel = state.amendOpen === 'subscriber' ? 'Box 1a · Subscriber ID' : 'Box 11 · Group Number'
  const currentValue = state.amendOpen === 'subscriber' ? state.claim.subscriber : state.claim.group
  return `
    <div class="amend-modal-backdrop">
      <div class="amend-modal">
        <button class="amend-modal-close" data-action="close-amend" aria-label="Close">×</button>
        <div class="amend-modal-h">
          <span class="amend-tag">AMEND ${escape(fieldLabel.toUpperCase())}</span>
          <span class="amend-sub">Pick the value that matches the 271 response.</span>
        </div>
        <div class="amend-context">
          <strong>271 says:</strong> ${escape(data.truth)}.
          <span class="amend-context-aside">(currently on claim: <code>${escape(currentValue)}</code>)</span>
        </div>
        <ul class="amend-options">
          ${data.options.map(opt => {
            const fb = state.amendFeedback?.value === opt.value ? state.amendFeedback : null
            const isCurrent = opt.value === currentValue
            return `
              <li class="amend-option ${isCurrent ? 'current' : ''} ${fb ? 'rejected' : ''}"
                  ${isCurrent ? '' : `data-action="pick-amend" data-value="${escape(opt.value)}"`}>
                <div class="amend-option-h">
                  <code>${escape(opt.value)}</code>
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
      <div class="checklist-h">Pre-submission checklist — ${state.resolvedIssues.size} of ${issues.length} steps complete</div>
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
        SUBMIT CLEAN CLAIM
      </button>
      ${state.failedAttempts > 0 ? `<div class="fail-counter">Wrong picks so far: ${state.failedAttempts}. (No penalty.)</div>` : ''}
    </section>
  `
}

const RECAP: CaseRecap = CASE_RECAPS['fog']

function renderVictory(): string {
  return `
    <section class="victory">
      <h2>The claim drops clean.</h2>
      <p class="register hospital">Hospital, the same afternoon.</p>
      <p>
        Anthem accepts the 837 on first pass. No 277CA bounce.
        No CO-26. The claim moves to adjudication; the 835
        will follow next week. Linh leaves with her sore-throat
        prescription and no idea anything was about to go
        wrong.
      </p>
      <p class="register waiting-room">Waiting Room.</p>
      <p>
        The Fog burns off. Where it stood, you can see clearly
        — Linh's name, her current plan, her current group,
        all stamped on a small card that didn't exist a few
        minutes ago. The card she should have had all along.
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
            <li><b>Reveal-gated.</b> The encounter is gated by an inquiry — until you run the 270, the discrepant fields are literally fogged over on the claim. The fog is the puzzle.</li>
            <li><b>Upstream encounter.</b> First prototype where the fight happens <em>before</em> the claim submits, not after a denial. Teaches that a clean drop on day one beats a clean appeal six months later.</li>
            <li><b>Distractors in the response.</b> The 271 returns five fields; only two are real issues (subscriber + group). Name format and DOB are not. The player learns to filter.</li>
            <li><b>Two-amends in one encounter.</b> Most prior prototypes had one amend. This one has two — same root cause (job change), different fields. Teaches that registration errors come in clusters.</li>
            <li><b>Visual fog.</b> A literal CSS fog overlays the claim form before reveal. Hopefully reads as "you can sense something's wrong but not what" without being too cute.</li>
          </ul>
        </div>
        <div>
          <h3>What this prototype proves (or tries to)</h3>
          <ul>
            <li>The framework absorbs an upstream encounter without breaking — same hospital intro, fall, claim, checklist; only the middle changed.</li>
            <li>A fog-and-reveal mechanic can carry the same teaching weight as a citation builder, with less prose.</li>
            <li>Filtering (real issue vs cosmetic difference) is a teachable mini-skill inside the eligibility loop.</li>
            <li>L2 mood holds — earlier-curriculum, less existential, more "fix it before it leaves" — without losing Dana's voice.</li>
            <li>Distinguishing 270/271 from 837/278 inside the player's mental model just by where the inquiry sits in the flow.</li>
          </ul>
        </div>
      </div>
      <p class="notes-cta">
        Side-by-side comparison: open
        <a href="./gatekeeper-prototype.html">Gatekeeper</a>
        — both prototypes use a "request → response → amend"
        spine, but Gatekeeper is post-denial appeal and Fog is
        pre-submission scrub. Same shape, different position
        in the revenue cycle.
      </p>
    </section>
  `
}

// === Interactions ===

function setFeedback(text: string, kind: 'good' | 'bad' | 'neutral' = 'neutral') {
  state.feedback = text
  state.feedbackKind = kind
}

function run270() {
  if (state.fogDispelled || state.inquiring) return
  state.inquiring = true
  rerender()
  window.setTimeout(() => {
    state.inquiring = false
    state.fogDispelled = true
    state.resolvedIssues.add('reveal')
    const issue = issues.find(i => i.id === 'reveal')!
    setFeedback(`271 received. Two fields differ from the claim — fog cleared.`, 'good')
    state.lastRecap = issue.recap
    rerender()
  }, 1100)
}

function attemptAmend(value: string) {
  if (!state.amendOpen) return
  const data = amendablesFor(state.amendOpen)
  const opt = data.options.find(o => o.value === value)
  if (!opt) return
  if (opt.support === 'wrong') {
    state.failedAttempts += 1
    state.amendFeedback = { value: opt.value, message: opt.feedback }
    return
  }
  // Apply amend.
  if (state.amendOpen === 'subscriber') {
    state.claim.subscriber = value
    if (!state.resolvedIssues.has('amend-subscriber')) {
      state.resolvedIssues.add('amend-subscriber')
      const issue = issues.find(i => i.id === 'amend-subscriber')!
      setFeedback(`Subscriber ID amended to ${value}. Issue addressed.`, 'good')
      state.lastRecap = issue.recap
    }
  } else {
    state.claim.group = value
    if (!state.resolvedIssues.has('amend-group')) {
      state.resolvedIssues.add('amend-group')
      const issue = issues.find(i => i.id === 'amend-group')!
      setFeedback(`Group number amended to ${value}. Issue addressed.`, 'good')
      state.lastRecap = issue.recap
    }
  }
  state.amendOpen = null
  state.amendFeedback = null
}

function attemptSubmit() {
  if (state.resolvedIssues.size < issues.length) return
  state.packetSubmitted = true
  notifyParentVictory('fog')
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  state.fogDispelled = false
  state.inquiring = false
  state.amendOpen = null
  state.amendFeedback = null
  state.claim = { subscriber: 'ANT883112', group: '0048221' }
  state.resolvedIssues = new Set()
  state.failedAttempts = 0
  state.feedback = ''
  state.feedbackKind = 'neutral'
  state.lastRecap = ''
  state.packetSubmitted = false
  state.openInquiryDetail = null
}

function dismissBriefing() { state.briefingDone = true; state.briefingOpen = false }
function showBriefing() { state.briefingOpen = true }
function closeBriefing() { state.briefingOpen = false }
function openAmend(field: 'subscriber' | 'group') { state.amendOpen = field; state.amendFeedback = null }
function closeAmend() { state.amendOpen = null; state.amendFeedback = null }
function openTerm(termId: string) { state.openTermId = termId }
function closeTerm() { state.openTermId = null }
function toggleDetail(id: string) { state.openInquiryDetail = state.openInquiryDetail === id ? null : id }

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
    case 'run-270': run270(); return
    case 'open-amend': if (id === 'subscriber' || id === 'group') openAmend(id); break
    case 'close-amend': closeAmend(); break
    case 'pick-amend': if (el.dataset.value) attemptAmend(el.dataset.value); break
    case 'submit': attemptSubmit(); break
    case 'reset': reset(); break
    case 'dismiss-briefing': dismissBriefing(); break
    case 'show-briefing': showBriefing(); break
    case 'close-briefing': closeBriefing(); break
    case 'open-term': if (el.dataset.term) openTerm(el.dataset.term); break
    case 'close-term': closeTerm(); break
    case 'toggle-detail': if (id) toggleDetail(id); break
    default: return
  }
  rerender()
}

// === Mount ===

// Fog-specific CSS — fog overlay, inquiry panel + 271 table, fog-hint side
// note. Base styles via BASE_CSS.
const css = districtVars('eligibility') + BASE_CSS + `
  :root {
    --warn: #f0c068;
    --fog: rgba(160, 175, 190, 0.55);
  }
  /* Claim positioned as a relative container for the fog overlay. */
  .claim-with-annotations .claim { position: relative; }
  .claim-annotations { width: 240px; padding-top: 60px; display: flex; flex-direction: column; gap: 10px; }
  .claim.fogged { box-shadow: inset 0 0 0 1px #d6cfb8, 0 0 30px rgba(160, 175, 190, 0.35); }
  .fog-overlay {
    position: absolute; inset: 0; pointer-events: none; border-radius: 6px;
    background:
      radial-gradient(ellipse at 30% 40%, rgba(220, 225, 230, 0.4), transparent 60%),
      radial-gradient(ellipse at 70% 60%, rgba(220, 225, 230, 0.35), transparent 60%),
      linear-gradient(180deg, rgba(220, 225, 230, 0.18), rgba(220, 225, 230, 0.05));
    animation: fog-drift 10s ease-in-out infinite;
  }
  @keyframes fog-drift {
    0%, 100% { transform: translateX(0); opacity: 0.95; }
    50% { transform: translateX(8px); opacity: 0.85; }
  }
  /* Box-row state styles for the fog reveal. */
  .claim-grid > div { padding: 4px 6px; border-radius: 3px; }
  .fogged-row { background: rgba(160, 175, 190, 0.18); }
  .wrong-row { background: var(--hi); box-shadow: inset 0 0 0 1px var(--hi-border); }
  .amended-row { background: rgba(126, 226, 193, 0.15); box-shadow: inset 0 0 0 1px var(--good); }
  .fogged-value { color: #1c1c1c; filter: blur(3.5px); user-select: none; transition: filter 0.4s; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }

  /* Side-panel hint that explains the fog before the inquiry runs. */
  .fog-hint { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: rgba(160, 175, 190, 0.08); border: 1px dashed #3a424a; border-radius: 8px; }
  .fog-hint-icon { font-size: 26px; opacity: 0.7; }
  .fog-hint-body { display: flex; flex-direction: column; gap: 4px; }
  .fog-hint-main { font-size: 12px; font-weight: 700; color: #c2d0d8; text-transform: uppercase; letter-spacing: 0.06em; }
  .fog-hint-sub { font-size: 11.5px; color: var(--ink-dim); font-style: italic; line-height: 1.4; }

  /* Amend modal — show currently-on-claim value alongside 271 truth. */
  .amend-context { display: flex; flex-direction: column; gap: 6px; }
  .amend-context-aside { color: var(--ink-dim); font-size: 12px; }

  /* Inquiry panel */
  .inquiry-panel {
    background: var(--panel); border: 1px solid #232a36; border-left-width: 4px;
    border-radius: 8px; padding: 18px 22px; margin-bottom: 22px;
    transition: border-color 0.3s;
  }
  .inquiry-panel.idle { border-left-color: var(--accent); }
  .inquiry-panel.pending { border-left-color: var(--accent-2); }
  .inquiry-panel.revealed { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126, 226, 193, 0.04), transparent); }
  .inquiry-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .inquiry-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .inquiry-panel.idle .inquiry-tag { color: var(--accent); }
  .inquiry-panel.pending .inquiry-tag { color: var(--accent-2); }
  .inquiry-panel.revealed .inquiry-tag { color: var(--good); }
  .inquiry-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .idle-prose { color: var(--ink); font-size: 13.5px; line-height: 1.55; max-width: 640px; margin: 0 0 14px; }
  .pending-body { display: flex; align-items: center; gap: 14px; padding: 8px 0; font-size: 13.5px; }
  .spinner {
    width: 22px; height: 22px; border-radius: 50%;
    border: 3px solid rgba(240, 168, 104, 0.25);
    border-top-color: var(--accent-2);
    animation: spin 0.85s linear infinite;
    flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .inquiry-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .inquiry-table th, .inquiry-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #232a36; }
  .inquiry-table th { font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-dim); }
  .inquiry-row { cursor: pointer; transition: background 0.15s; }
  .inquiry-row:hover { background: rgba(255,255,255,0.025); }
  .inquiry-row.open { background: rgba(255,255,255,0.04); }
  .inquiry-row.match .ir-claim, .inquiry-row.match .ir-payer { color: var(--ink); }
  .inquiry-row.benign .ir-claim, .inquiry-row.benign .ir-payer { color: var(--ink-dim); font-style: italic; }
  .inquiry-row.wrong .ir-claim { color: #f3a4b6; }
  .inquiry-row.wrong .ir-payer { color: var(--good); font-weight: 600; }
  .inquiry-row.fixed .ir-claim { color: var(--good); font-weight: 600; }
  .inquiry-row.fixed .ir-payer { color: var(--good); }
  .ir-arrow { color: var(--ink-dim); font-size: 12px; }
  .badge { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 8px; border-radius: 3px; }
  .badge.match { background: rgba(126, 226, 193, 0.1); color: var(--good); border: 1px solid #2c5547; }
  .badge.benign { background: rgba(138, 147, 163, 0.1); color: var(--ink-dim); border: 1px solid #2a3142; }
  .badge.wrong { background: rgba(239, 91, 123, 0.12); color: var(--bad); border: 1px solid #4a2a32; }
  .badge.fixed { background: rgba(126, 226, 193, 0.15); color: var(--good); border: 1px solid #2c5547; }
  .inquiry-detail-row td { padding: 0; background: rgba(0,0,0,0.18); }
  .inquiry-detail { padding: 10px 16px; font-size: 12.5px; color: var(--ink-dim); border-left: 3px solid var(--accent); margin: 0 10px; line-height: 1.5; }
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
