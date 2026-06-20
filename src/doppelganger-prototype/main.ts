// Doppelgänger @ L6 — first-sketch prototype (CO-18 / duplicate claim).
//
// Sibling to wraith / bundle / reaper / gatekeeper / fog /
// hydra / swarm / specter. Same shape (Hospital intro →
// dreamlike fall → Waiting Room → middle work → checklist),
// tuned to a billing-side action set:
//
//   - Replace the claim. The original claim came back
//     denied for a transposed subscriber ID. The biller fixed
//     the ID and resubmitted — but as a *fresh* 837P (freq 1)
//     instead of as a *replacement* (freq 7). Now Humana sees
//     two claims for the same date of service and flags both
//     as duplicates (CO-18). To resolve: set Box 22 to
//     frequency 7 and reference the original's ICN, so the
//     replacement explicitly supersedes the duplicate.
//   - First prototype where the puzzle is *claim version
//     control* — not what's on the claim, but how the claim
//     relates to other claims that already exist.
//
// Demonstrates: a subtle but important action-set pivot.
// Same hospital intro / register flip / Dana voice / claim /
// checklist / submit shape — different middle (a claim
// history panel + Box 22 picker instead of a workbench or
// citation builder).

import { CASES } from '../content/cases'
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

interface FrequencyOption {
  code: '1' | '6' | '7' | '8'
  label: string
  detail: string
  /** 'current' | 'correct' | 'partial' | 'wrong'. */
  support: 'current' | 'correct' | 'partial' | 'wrong'
  feedback: string
}

interface IcnOption {
  icn: string
  label: string
  /** 'current' | 'correct' | 'wrong'. */
  support: 'current' | 'correct' | 'wrong'
  feedback: string
}

interface SubscriberOption {
  id: string
  support: 'current' | 'correct' | 'partial' | 'wrong'
  feedback: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'replace' | 'confirm'
}

interface GlossaryEntry {
  term: string
  plain: string
}

const issues: Issue[] = [
  {
    id: 'replace',
    label: 'Set Box 22 — frequency code 7 (replacement) + reference the original ICN.',
    recap: "The resubmission now declares itself a replacement for ICN CLM-2026-03-08-19842. Humana's adjudication engine will retire the original claim and adjudicate the replacement; the duplicate flag clears, and only one claim is left to pay.",
    verb: 'replace',
  },
  {
    id: 'confirm',
    label: 'Confirm the corrected subscriber ID on Box 1a matches the 271 response.',
    recap: "The resubmission has HUM712390 — the corrected subscriber ID per Humana's eligibility response. The transposition that doomed the original claim isn't repeated. Pre-flight check complete.",
    verb: 'confirm',
  },
]

const ORIGINAL_ICN = 'CLM-2026-03-08-19842'
const RESUB_ICN = 'CLM-2026-03-12-21055'
const TRUE_SUBSCRIBER = 'HUM712390'

const frequencyOptions: FrequencyOption[] = [
  {
    code: '1',
    label: '1 — Original',
    detail: 'A fresh, never-before-submitted claim.',
    support: 'current',
    feedback: "What's currently on the resubmission — and exactly the bug. Humana sees a never-before-submitted claim for the same DOS and patient as a claim already in their system, and flags both CO-18.",
  },
  {
    code: '6',
    label: '6 — Corrected',
    detail: 'Adjustment to a previously-submitted claim — limited use.',
    support: 'partial',
    feedback: "Frequency 6 is for corrections, but it's narrow — used when the payer specifically requests a corrected claim, often via an adjustment letter. For a duplicate-flag resolution after an internal fix, frequency 7 (replacement) is the right call.",
  },
  {
    code: '7',
    label: '7 — Replacement',
    detail: 'Replaces a previously-paid or denied claim. Original is retired by reference.',
    support: 'correct',
    feedback: "Frequency 7 with the original ICN tells Humana's engine: this isn't a new claim, it's a replacement for an existing one. The original gets retired, and only the replacement adjudicates. Duplicate flag clears.",
  },
  {
    code: '8',
    label: '8 — Void / Cancel',
    detail: 'Withdraws a previously-submitted claim with no replacement.',
    support: 'wrong',
    feedback: "Frequency 8 voids the claim outright and asks Humana to take it back — used when the patient was never actually seen, or the wrong patient was billed. We *do* want to be paid for Fatima's visit; we just want to be paid once. Frequency 7 (replacement) is the move.",
  },
]

const icnOptions: IcnOption[] = [
  {
    icn: '',
    label: '— blank —',
    support: 'current',
    feedback: "What's currently in Box 22 — empty. A frequency-7 with no original ICN reference is invalid; the engine doesn't know what claim this replaces.",
  },
  {
    icn: ORIGINAL_ICN,
    label: ORIGINAL_ICN,
    support: 'correct',
    feedback: "Matches the original claim's ICN per the 277CA log. Humana will retire that one and adjudicate this replacement.",
  },
  {
    icn: RESUB_ICN,
    label: RESUB_ICN,
    support: 'wrong',
    feedback: "That's the resubmission's *own* ICN — a claim can't reference itself as the original. The original is the one with the transposed subscriber ID, dated 2026-03-08.",
  },
  {
    icn: 'CLM-2025-11-22-78410',
    label: 'CLM-2025-11-22-78410',
    support: 'wrong',
    feedback: "That's a Reyes claim from last November — same patient, different date of service (annual physical). Different claim entirely.",
  },
]

const subscriberOptions: SubscriberOption[] = [
  {
    id: 'HUM712309',
    support: 'wrong',
    feedback: "That's the original transposed ID — the bug that started this whole problem. Don't put it back.",
  },
  {
    id: TRUE_SUBSCRIBER,
    support: 'correct',
    feedback: "Matches Humana's 271 eligibility response. The replacement's Box 1a is correct.",
  },
  {
    id: 'HUM712930',
    support: 'wrong',
    feedback: "Different transposition. Won't match the 271; the replacement would bounce again at the clearinghouse.",
  },
  {
    id: 'HUM7123',
    support: 'partial',
    feedback: "Truncated. Humana subscriber IDs are 9 characters after the prefix.",
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'CO-18': {
    term: 'CO-18 (duplicate claim)',
    plain: "A denial code that says: the payer's adjudication system found another claim that looks just like this one — same patient, same date of service, same provider — and refused to pay either of them until somebody resolves which is which. Almost always a billing-side bug, not a fraud signal.",
  },
  'frequency code': {
    term: 'Frequency code (Box 22, CMS-1500)',
    plain: "A single-digit code on the claim that tells the payer what kind of submission this is. 1 = original (first-time submit). 6 = corrected (narrow use). 7 = replacement (this supersedes a previously-submitted claim). 8 = void/cancel (take it back). The wrong code on a resubmission is the most common cause of CO-18 duplicates — billers fix the data and re-send, but as frequency 1, so the payer sees the corrected claim as a *new* duplicate of the original.",
  },
  'ICN': {
    term: 'ICN (internal control number)',
    plain: "The payer's internal identifier for a specific claim. Every 837 the provider sends gets one assigned by the clearinghouse and the payer. On a frequency-7 replacement, the ICN of the original claim goes into Box 22 alongside the frequency code, telling the payer's engine which claim this one supersedes.",
  },
  '837P': {
    term: '837P',
    plain: "The X12 EDI transaction that carries a professional (outpatient) claim from the provider to the payer through the clearinghouse. The CMS-1500 you see is the human-readable mirror of the 837P. Box 22 in the human form maps to specific loops in the 837P (CLM05-3 and REF*F8 segments) — when somebody says 'fix the resubmission code,' that's where it lives.",
  },
  'CMS-1500': {
    term: 'CMS-1500',
    plain: "The standard claim form for outpatient services. This encounter cares about Box 22 (resubmission code + original reference number) — empty on the original claim, blank on the buggy resubmission, and the field that resolves the duplicate-flag if filled correctly.",
  },
  '277CA': {
    term: '277CA (claim acknowledgment)',
    plain: "The clearinghouse's response after a claim is received. Carries the claim's ICN (so you know how to reference it later) and the accept/reject status. Reading the 277CA log is how you find the original ICN you need to reference on a frequency-7 replacement.",
  },
}

// === Runtime state ===

const state = {
  briefingDone: false,
  briefingOpen: false,
  /** Box 22 modal open. */
  box22Open: false,
  /** Box 1a modal open (subscriber-ID confirmation). */
  box1aOpen: false,
  /** Selections inside the open box-22 modal. */
  freqPicked: '1' as '1' | '6' | '7' | '8',
  icnPicked: '' as string,
  /** Per-pick feedback within the modals. */
  freqFeedback: null as { code: string; message: string } | null,
  icnFeedback: null as { icn: string; message: string } | null,
  subFeedback: null as { id: string; message: string } | null,
  /** Current claim values. Mutate as the player amends. */
  claim: {
    box22Freq: '1' as '1' | '6' | '7' | '8',
    box22Icn: '',
    subscriberId: TRUE_SUBSCRIBER,
  },
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  feedback: '' as string,
  feedbackKind: 'neutral' as 'neutral' | 'good' | 'bad',
  lastRecap: '' as string,
  packetSubmitted: false,
  openTermId: null as string | null,
}

const doppelCase = CASES.case_doppel_reyes

// === Rendering ===

function term(termId: string, displayText?: string): string {
  const entry = glossary[termId]
  const text = displayText ?? termId
  if (!entry) return escape(text)
  return `<span class="term" data-action="open-term" data-term="${termId}" title="${escape(entry.plain)}">${escape(text)}<span class="term-icon">?</span></span>`
}

function render(): string {
  if (state.packetSubmitted) {
    return renderHeader() + renderVictory() + renderTermPopover() + renderBriefingPopover() + renderBox22Modal() + renderBox1aModal()
  }
  return `
    ${renderHeader()}
    ${renderHospitalIntro()}
    ${!state.briefingDone ? renderBriefingInline() : `
      ${renderClaimHistory()}
      ${renderClaim()}
      ${renderChecklist()}
    `}
    ${state.briefingDone ? '' : renderDesignNotes()}
    ${renderTermPopover()}
    ${renderBriefingPopover()}
    ${renderBox22Modal()}
    ${renderBox1aModal()}
  `
}

function renderHeader(): string {
  const recallBtn = state.briefingDone
    ? `<button class="recall-btn" data-action="show-briefing">📜 Dana's note</button>`
    : ''
  return `
    <header class="page-h">
      <div class="title-row">
        <h1>Doppelgänger <span class="muted">@ L6 — first-sketch prototype</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./">← back to game</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          A ninth prototype, sibling to the others. This one
          is about replacing a claim: it came back denied for a
          transposed subscriber ID, the biller fixed it and
          resubmitted — but as a fresh 837P instead of a
          ${term('frequency code', 'frequency-7 replacement')}.
          Now both claims are flagged as ${term('CO-18')}
          duplicates. Different shape from amend or cite —
          this one is about claim *version control*. See the
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
        Lou, the biller, slides into your cube. "Fatima Reyes —
        diabetes follow-up from March 8. Original got denied
        for subscriber-not-found; I caught it, fixed the ID,
        resubmitted on March 12. Now <em>both</em> claims are
        denied as duplicates. ${term('CO-18')}. Humana thinks
        I'm double-billing them."
      </p>
      <p>
        You pull up the file. Two ${term('ICN')}s. Two claims
        sitting in the duplicate-flag bucket. The resubmission
        was filed as a fresh 837 instead of as a replacement —
        ${term('frequency code', 'Box 22')} reads <em>1
        (original)</em>, when it should read <em>7 (replacement)</em>
        with the original ICN in the next field over.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and somewhere in the building, two claims of
        Fatima's slip into the same chair. They look at each
        other. Neither is sure which one is real. The
        fluorescents stutter. You're somewhere else.</em>
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
        "This one is the Doppelgänger. ${term('CO-18')}. Two
        claims for the same patient, same date, same provider
        — and Humana's adjudication engine flags both. It's
        not fraud; it's a paperwork bug. The biller fixed the
        original's transposed ID and resubmitted, but as a
        <em>fresh</em> 837 instead of as a replacement. Now
        Humana doesn't know which one is real."
      </p>
      <p>
        "The fix is small but it has to be exact. Two issues:"
      </p>
      <ul>
        <li>
          Open the resubmission's ${term('CMS-1500', 'Box 22')}.
          Set the ${term('frequency code')} to <strong>7
          (replacement)</strong>, not 1 (original). Reference
          the original's ${term('ICN')} so Humana's engine
          knows which claim this one supersedes.
        </li>
        <li>
          <strong>Confirm the corrected subscriber ID.</strong>
          The whole reason we resubmitted is the original had
          a transposed ID. Open Box 1a on the replacement and
          confirm it matches Humana's ${term('277CA')} log
          and 271 response. <em>Pre-flight check before we
          send.</em>
        </li>
      </ul>
      <p>
        "Frequency-7 with the right original-ICN does the
        magic. The original gets retired, the replacement
        adjudicates, the duplicate flag clears. Both claims
        stop being a problem. Just one of them gets paid —
        which is what we wanted in the first place."
      </p>
      <p class="briefing-sign">"Two claims, one ICN, one truth. — D."</p>
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

function renderClaimHistory(): string {
  const replaceResolved = state.resolvedIssues.has('replace')
  return `
    <section class="claim-history">
      <div class="ch-h">
        <span class="ch-tag">CLAIM HISTORY · Reyes, F. · DOS 2026-03-08</span>
        <span class="ch-sub">${replaceResolved
          ? 'The original is retired. Only the replacement adjudicates.'
          : "Both claims flagged duplicate. Resolution: file the resub as a frequency-7 replacement of the original."}</span>
      </div>
      <div class="ch-row">
        <div class="ch-claim original ${replaceResolved ? 'retired' : 'duplicate'}">
          <div class="ch-claim-h">
            <span class="ch-icn">${escape(ORIGINAL_ICN)}</span>
            <span class="ch-tag-label">ORIGINAL · 2026-03-08</span>
          </div>
          <div class="ch-claim-body">
            <div class="ch-row-line"><span class="ch-label">${term('frequency code', 'Freq')}</span><span class="ch-value">1 (original)</span></div>
            <div class="ch-row-line"><span class="ch-label">Subscriber</span><span class="ch-value mono"><s>HUM712309</s></span></div>
            <div class="ch-row-line"><span class="ch-label">Status</span>
              ${replaceResolved
                ? '<span class="ch-status retired">RETIRED · superseded</span>'
                : '<span class="ch-status denied">CO-18 DUPLICATE</span>'}
            </div>
          </div>
        </div>
        <div class="ch-arrow">${replaceResolved ? '▶ replaced by ▶' : '?'}</div>
        <div class="ch-claim resub ${replaceResolved ? 'replacement' : 'duplicate'}">
          <div class="ch-claim-h">
            <span class="ch-icn">${escape(RESUB_ICN)}</span>
            <span class="ch-tag-label">RESUB · 2026-03-12</span>
          </div>
          <div class="ch-claim-body">
            <div class="ch-row-line"><span class="ch-label">${term('frequency code', 'Freq')}</span>
              <span class="ch-value mono ${replaceResolved ? 'good' : 'bad'}">${escape(state.claim.box22Freq)}${state.claim.box22Freq === '7' ? ' (replacement)' : state.claim.box22Freq === '1' ? ' (original) ⚠' : ''}</span>
            </div>
            <div class="ch-row-line"><span class="ch-label">Replaces</span>
              <span class="ch-value mono ${state.claim.box22Icn ? 'good' : 'bad'}">${state.claim.box22Icn ? escape(state.claim.box22Icn) : '— blank ⚠'}</span>
            </div>
            <div class="ch-row-line"><span class="ch-label">Subscriber</span><span class="ch-value mono good">${escape(state.claim.subscriberId)}</span></div>
            <div class="ch-row-line"><span class="ch-label">Status</span>
              ${replaceResolved
                ? '<span class="ch-status replacement">REPLACEMENT · ready</span>'
                : '<span class="ch-status denied">CO-18 DUPLICATE</span>'}
            </div>
          </div>
        </div>
      </div>
    </section>
  `
}

function renderClaim(): string {
  const claim = doppelCase.claim
  if (!claim || claim.type !== 'cms1500') return ''
  const replaceResolved = state.resolvedIssues.has('replace')
  const confirmResolved = state.resolvedIssues.has('confirm')
  return `
    <div class="claim-with-annotations">
      <section class="claim">
        <div class="claim-h">
          ${term('CMS-1500')} · ${escape(RESUB_ICN)} (replacement)
          <span class="claim-explainer">(this is the resubmission — fix Box 22 and confirm Box 1a)</span>
        </div>
        <div class="claim-grid">
          <div><b>Patient:</b> ${escape(claim.patient.name)} · ${escape(claim.patient.dob)}</div>
          <div class="${confirmResolved ? 'amended' : 'hi'}">
            <b>Box 1a · Subscriber:</b> <span class="mono">${escape(state.claim.subscriberId)}</span>
            ${confirmResolved ? '' : '<span class="dx-arrow" aria-hidden="true">⟶</span>'}
          </div>
        </div>
        <div class="claim-section">
          <div class="claim-section-h">
            ${term('CMS-1500', 'Box 22')} · Resubmission Code + Original Ref. No.
            ${replaceResolved
              ? '<span class="claim-status amended">AMENDED</span>'
              : '<span class="claim-status disputed">DUPLICATE FLAG</span>'}
          </div>
          <table class="lines">
            <thead><tr><th style="width:40%">Resubmission Code</th><th>Original Reference Number</th></tr></thead>
            <tbody>
              <tr class="${replaceResolved ? 'amended' : 'hi'}">
                <td class="mono">${escape(state.claim.box22Freq)}${state.claim.box22Freq === '7' ? ' — Replacement' : state.claim.box22Freq === '1' ? ' — Original ⚠' : ''}</td>
                <td class="mono">${state.claim.box22Icn ? escape(state.claim.box22Icn) : '<span class="placeholder-cell">— blank —</span>'}</td>
              </tr>
            </tbody>
          </table>
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
        ${replaceResolved ? '' : `
          <button class="amend-callout" data-action="open-box22">
            <span class="amend-callout-arrow" aria-hidden="true">⟵</span>
            <span class="amend-callout-body">
              <span class="amend-callout-main">✎ Set Box 22 — REPLACE</span>
              <span class="amend-callout-sub">Pick frequency 7 + reference the original ICN. Click to amend.</span>
            </span>
          </button>
        `}
        ${confirmResolved ? '' : `
          <button class="amend-callout subscriber" data-action="open-box1a">
            <span class="amend-callout-arrow" aria-hidden="true">⟵</span>
            <span class="amend-callout-body">
              <span class="amend-callout-main">✓ Confirm Box 1a</span>
              <span class="amend-callout-sub">Verify the subscriber ID matches the 271. Pre-flight check.</span>
            </span>
          </button>
        `}
      </aside>
    </div>
  `
}

function renderBox22Modal(): string {
  if (!state.box22Open) return ''
  const ready = (state.freqPicked === '7' && state.icnPicked === ORIGINAL_ICN)
  return `
    <div class="amend-modal-backdrop">
      <div class="amend-modal box22-modal">
        <button class="amend-modal-close" data-action="close-box22" aria-label="Close">×</button>
        <div class="amend-modal-h">
          <span class="amend-tag">AMEND BOX 22 · RESUBMISSION CODE + ORIGINAL REF</span>
          <span class="amend-sub">Two picks: the frequency code, and the ICN of the claim being replaced.</span>
        </div>
        <div class="amend-context">
          <strong>277CA log:</strong> original claim ICN <code>${escape(ORIGINAL_ICN)}</code>, denied 2026-03-09 for subscriber-not-found. Resubmission ICN <code>${escape(RESUB_ICN)}</code> filed 2026-03-12 with corrected ID.
        </div>

        <div class="b22-section">
          <div class="b22-h">1 · ${term('frequency code', 'Resubmission Code')}</div>
          <ul class="amend-options">
            ${frequencyOptions.map(opt => {
              const fb = state.freqFeedback?.code === opt.code ? state.freqFeedback : null
              const sel = state.freqPicked === opt.code ? 'selected' : ''
              const isCurrent = opt.support === 'current' && state.freqPicked === '1' && state.claim.box22Freq === '1'
              return `
                <li class="amend-option ${sel} ${fb ? 'rejected' : ''}"
                    data-action="pick-freq" data-code="${opt.code}">
                  <div class="amend-option-h">
                    <code>${escape(opt.code)}</code>
                    <span class="amend-option-label">${escape(opt.label)}</span>
                    ${isCurrent ? '<span class="amend-option-badge current">currently on resub</span>' : ''}
                  </div>
                  <div class="amend-option-detail">${escape(opt.detail)}</div>
                  ${fb ? `<div class="amend-option-fb">${escape(fb.message)}</div>` : ''}
                </li>
              `
            }).join('')}
          </ul>
        </div>

        <div class="b22-section">
          <div class="b22-h">2 · Original Reference Number (${term('ICN')})</div>
          <ul class="amend-options">
            ${icnOptions.map(opt => {
              const fb = state.icnFeedback?.icn === opt.icn ? state.icnFeedback : null
              const sel = state.icnPicked === opt.icn ? 'selected' : ''
              const isCurrent = opt.icn === '' && state.claim.box22Icn === ''
              return `
                <li class="amend-option ${sel} ${fb ? 'rejected' : ''}"
                    data-action="pick-icn" data-icn="${escape(opt.icn)}">
                  <div class="amend-option-h">
                    <code>${escape(opt.label)}</code>
                    ${isCurrent ? '<span class="amend-option-badge current">currently on resub</span>' : ''}
                  </div>
                  ${fb ? `<div class="amend-option-fb">${escape(fb.message)}</div>` : ''}
                </li>
              `
            }).join('')}
          </ul>
        </div>

        <div class="b22-actions">
          <button class="btn primary ${ready ? '' : 'disabled'}"
                  ${ready ? '' : 'disabled'}
                  data-action="commit-box22">
            ${ready ? 'Apply Box 22 amendment' : 'Pick freq + original ICN'}
          </button>
        </div>
        <p class="amend-hint-text">
          Both picks must align: frequency 7 alongside the actual original ICN. Either alone won't clear the duplicate flag.
        </p>
      </div>
    </div>
  `
}

function renderBox1aModal(): string {
  if (!state.box1aOpen) return ''
  return `
    <div class="amend-modal-backdrop">
      <div class="amend-modal">
        <button class="amend-modal-close" data-action="close-box1a" aria-label="Close">×</button>
        <div class="amend-modal-h">
          <span class="amend-tag">CONFIRM BOX 1A · SUBSCRIBER ID</span>
          <span class="amend-sub">Pre-flight check — match the resubmission against the 271 response.</span>
        </div>
        <div class="amend-context">
          <strong>Humana 271 says:</strong> <code>${escape(TRUE_SUBSCRIBER)}</code>. Pick the value that matches.
        </div>
        <ul class="amend-options">
          ${subscriberOptions.map(opt => {
            const fb = state.subFeedback?.id === opt.id ? state.subFeedback : null
            return `
              <li class="amend-option ${fb ? 'rejected' : ''}"
                  data-action="pick-sub" data-id="${opt.id}">
                <div class="amend-option-h">
                  <code>${escape(opt.id)}</code>
                  ${opt.support === 'wrong' && opt.id === 'HUM712309' ? '<span class="amend-option-badge current">original transposition</span>' : ''}
                </div>
                ${fb ? `<div class="amend-option-fb">${escape(fb.message)}</div>` : ''}
              </li>
            `
          }).join('')}
        </ul>
        <p class="amend-hint-text">
          The 271 response is the source of truth. Confirming this before send keeps the replacement from bouncing again at the clearinghouse.
        </p>
      </div>
    </div>
  `
}

function renderChecklist(): string {
  const allResolved = state.resolvedIssues.size === issues.length
  return `
    <section class="checklist">
      <div class="checklist-h">Duplicate-resolution checklist — ${state.resolvedIssues.size} of ${issues.length} steps complete</div>
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
        SEND REPLACEMENT
      </button>
      ${state.failedAttempts > 0 ? `<div class="fail-counter">Wrong picks so far: ${state.failedAttempts}. (No penalty.)</div>` : ''}
      ${state.feedback ? `<div class="feedback fb-${state.feedbackKind}">${escape(state.feedback)}</div>` : ''}
      ${state.lastRecap ? `
        <div class="recap">
          <div class="recap-h">What you just did</div>
          <p>${escape(state.lastRecap)}</p>
        </div>
      ` : ''}
    </section>
  `
}

const RECAP: CaseRecap = CASE_RECAPS['doppelganger']

function renderVictory(): string {
  return `
    <section class="victory">
      <h2>The duplicate clears.</h2>
      <p class="register hospital">Hospital, the next afternoon.</p>
      <p>
        Humana's adjudication engine retires the original
        ICN, runs the replacement through, and pays $98
        contractual on a $145 charge. Lou drops by to say
        thanks; Fatima never has to know any of this happened.
      </p>
      <p class="register waiting-room">Waiting Room.</p>
      <p>
        The Doppelgänger is gone. Where the two of Fatima's
        claims sat in the same chair, there's only one chair
        now — and it's empty. A small slip of paper on the
        floor reads <em>freq 7 · replaces ${escape(ORIGINAL_ICN)}</em>.
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
            <li><b>Replacing a claim.</b> The puzzle isn't what's on the claim — it's how the claim relates to other claims that already exist. First version-control encounter.</li>
            <li><b>Two-pick amend modal.</b> Box 22 has two fields (frequency code + original ref number); the modal renders them as paired sections that must both be set correctly. Standalone correct picks are still wrong if their counterpart is off.</li>
            <li><b>Claim history panel.</b> First prototype that shows two claims side-by-side. The "doppelgänger" framing is literal — both ICNs visible, both flagged duplicate, the player watches the original retire as the replacement registers.</li>
            <li><b>The claim form is the resubmission, not the original.</b> The original is read-only, displayed in the history panel as a reference. The player only edits the resub — but the edit refers back to the original's ICN.</li>
            <li><b>Subtle realism.</b> Real-world resubmission codes are exactly this finicky. Frequency 7 with a wrong original ICN is just as broken as frequency 1 with the right one. Both have to align.</li>
          </ul>
        </div>
        <div>
          <h3>What this prototype proves (or tries to)</h3>
          <ul>
            <li>The framework absorbs claim version-control puzzles without breaking — same hospital intro, fall, Dana voice, checklist, submit; only the middle changed.</li>
            <li>Two-axis amend picks (freq × ICN) read as nuanced without bloating the UI.</li>
            <li>A "claim history" widget can carry multi-claim relational logic with two side-by-side cards and an arrow between them, no graph database required.</li>
            <li>Box 22 — the most-fiddly box on the CMS-1500 — is teachable inline without a manual.</li>
            <li>Dana's voice scales to a granular paperwork puzzle without losing the in-your-ear register.</li>
          </ul>
        </div>
      </div>
      <p class="notes-cta">
        Side-by-side comparison: open
        <a href="./bundle-prototype.html">Bundle</a> for the
        single-amend cousin (modifier 25 on Box 24) — both are
        "fix one box and resubmit," but Bundle's fix is about
        <em>what's on</em> the line, while Doppelgänger's fix
        is about <em>how the claim relates to another claim</em>.
        Same shape, different unit of work.
      </p>
    </section>
  `
}

// === Interactions ===

function setFeedback(text: string, kind: 'good' | 'bad' | 'neutral' = 'neutral') {
  state.feedback = text
  state.feedbackKind = kind
}

function pickFreq(code: '1' | '6' | '7' | '8') {
  const opt = frequencyOptions.find(o => o.code === code)
  if (!opt) return
  state.freqPicked = code
  if (opt.support !== 'correct') {
    state.failedAttempts += 1
    state.freqFeedback = { code, message: opt.feedback }
  } else {
    state.freqFeedback = null
  }
}

function pickIcn(icn: string) {
  const opt = icnOptions.find(o => o.icn === icn)
  if (!opt) return
  state.icnPicked = icn
  if (opt.support !== 'correct') {
    state.failedAttempts += 1
    state.icnFeedback = { icn, message: opt.feedback }
  } else {
    state.icnFeedback = null
  }
}

function commitBox22() {
  if (state.freqPicked !== '7' || state.icnPicked !== ORIGINAL_ICN) return
  state.claim.box22Freq = '7'
  state.claim.box22Icn = ORIGINAL_ICN
  state.box22Open = false
  state.freqFeedback = null
  state.icnFeedback = null
  if (!state.resolvedIssues.has('replace')) {
    state.resolvedIssues.add('replace')
    const issue = issues.find(i => i.id === 'replace')!
    setFeedback(`Box 22 amended. Frequency 7 + original ICN ${ORIGINAL_ICN}. Issue addressed.`, 'good')
    state.lastRecap = issue.recap
  }
}

function pickSubscriber(id: string) {
  const opt = subscriberOptions.find(o => o.id === id)
  if (!opt) return
  if (opt.support !== 'correct') {
    state.failedAttempts += 1
    state.subFeedback = { id, message: opt.feedback }
    return
  }
  state.box1aOpen = false
  state.subFeedback = null
  if (!state.resolvedIssues.has('confirm')) {
    state.resolvedIssues.add('confirm')
    const issue = issues.find(i => i.id === 'confirm')!
    setFeedback(`Subscriber ID confirmed against the 271. Pre-flight check complete.`, 'good')
    state.lastRecap = issue.recap
  }
}

function attemptSubmit() {
  if (state.resolvedIssues.size < issues.length) return
  state.packetSubmitted = true
  notifyParentVictory('doppelganger')
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  state.box22Open = false
  state.box1aOpen = false
  state.freqPicked = '1'
  state.icnPicked = ''
  state.freqFeedback = null
  state.icnFeedback = null
  state.subFeedback = null
  state.claim = { box22Freq: '1', box22Icn: '', subscriberId: TRUE_SUBSCRIBER }
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
function openBox22() { state.box22Open = true; state.freqFeedback = null; state.icnFeedback = null }
function closeBox22() { state.box22Open = false; state.freqFeedback = null; state.icnFeedback = null }
function openBox1a() { state.box1aOpen = true; state.subFeedback = null }
function closeBox1a() { state.box1aOpen = false; state.subFeedback = null }
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
    closeBox22(); closeBox1a(); rerender(); return
  }
  const el = target.closest('[data-action]') as HTMLElement | null
  if (!el) return
  const action = el.dataset.action
  switch (action) {
    case 'open-box22': openBox22(); break
    case 'close-box22': closeBox22(); break
    case 'pick-freq':
      if (el.dataset.code === '1' || el.dataset.code === '6' || el.dataset.code === '7' || el.dataset.code === '8') {
        pickFreq(el.dataset.code)
      }
      break
    case 'pick-icn': if (el.dataset.icn !== undefined) pickIcn(el.dataset.icn); break
    case 'commit-box22': commitBox22(); break
    case 'open-box1a': openBox1a(); break
    case 'close-box1a': closeBox1a(); break
    case 'pick-sub': if (el.dataset.id) pickSubscriber(el.dataset.id); break
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

const css = districtVars('billing') + BASE_CSS + `
  .mono { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }

  /* Two-claim history panel — shows the original + resub side-by-side. */
  .claim-history { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .ch-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
  .ch-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .ch-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .ch-row { display: grid; grid-template-columns: 1fr auto 1fr; gap: 14px; align-items: stretch; }
  @media (max-width: 880px) { .ch-row { grid-template-columns: 1fr; } .ch-arrow { text-align: center; padding: 8px 0; } }
  .ch-claim { background: var(--panel-2); border-radius: 6px; padding: 12px 14px; border: 1px solid #2a3142; transition: border-color 0.3s, opacity 0.3s; }
  .ch-claim.duplicate { border-color: var(--bad); background: rgba(239, 91, 123, 0.04); }
  .ch-claim.original.retired { border-color: #2a3142; opacity: 0.55; background: var(--panel-2); }
  .ch-claim.resub.replacement { border-color: var(--good); background: rgba(126, 226, 193, 0.04); }
  .ch-claim-h { display: flex; flex-direction: column; gap: 4px; padding-bottom: 8px; border-bottom: 1px dashed #2a3142; margin-bottom: 8px; }
  .ch-icn { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 12px; color: var(--ink); font-weight: 600; letter-spacing: 0.04em; }
  .ch-tag-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-dim); font-weight: 700; }
  .ch-claim-body { display: flex; flex-direction: column; gap: 6px; }
  .ch-row-line { display: grid; grid-template-columns: 90px 1fr; gap: 8px; font-size: 12.5px; align-items: baseline; }
  .ch-label { color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; font-size: 10.5px; font-weight: 700; }
  .ch-value { color: var(--ink); }
  .ch-value.mono { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .ch-value.good { color: var(--good); font-weight: 600; }
  .ch-value.bad { color: var(--bad); font-weight: 600; }
  .ch-status { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 8px; border-radius: 3px; white-space: nowrap; }
  .ch-status.denied { background: rgba(239, 91, 123, 0.12); color: var(--bad); border: 1px solid #4a2a32; }
  .ch-status.retired { background: rgba(138, 147, 163, 0.1); color: var(--ink-dim); border: 1px solid #2a3142; }
  .ch-status.replacement { background: rgba(126, 226, 193, 0.12); color: var(--good); border: 1px solid #2c5547; }
  .ch-arrow { display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-dim); }

  /* Slimmer annotation column — Doppelgänger has two amend callouts stacked. */
  .claim-annotations { padding-top: 60px; gap: 10px; }
  .amend-callout.subscriber {
    background: linear-gradient(180deg, rgba(126, 226, 193, 0.10), rgba(126, 226, 193, 0.04));
    border-color: var(--good);
  }
  .amend-callout.subscriber:hover { box-shadow: 0 4px 16px rgba(126, 226, 193, 0.30); }
  .amend-callout.subscriber .amend-callout-arrow { color: var(--good); }
  .amend-callout.subscriber .amend-callout-main { color: var(--good); }

  /* Box-22 modal has two paired sections (freq + icn). */
  .box22-modal { max-width: 720px; }
  .b22-section { margin-bottom: 16px; }
  .b22-h { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 8px; }
  .b22-actions { margin-top: 4px; display: flex; gap: 10px; padding-top: 14px; border-top: 1px solid #232a36; }
  .amend-option.selected { border-left-color: var(--accent); background: rgba(239, 91, 123, 0.06); }
  .amend-option-detail { margin-top: 4px; font-size: 11.5px; color: var(--ink-dim); padding-left: 32px; line-height: 1.45; }

  .placeholder-cell { color: var(--ink-dim); font-style: italic; }

  /* Recap uses billing coral instead of warm orange. */
  .recap { background: rgba(239, 91, 123, 0.05); border-color: #4a2a32; }
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
      if (state.box22Open) { closeBox22(); changed = true }
      if (state.box1aOpen) { closeBox1a(); changed = true }
      if (changed) rerender()
    }
  })
}

mount()
