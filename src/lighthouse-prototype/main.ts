// Lighthouse @ L8 (charity care, patient-facing).
//
// Sibling to the other nine prototypes — but a deliberately
// different shape. Per L8's design principle: "Lean Hospital-
// side weight on patient stories; lean Waiting Room surrealism
// for the release valve. The horror is *witnessed* in the
// Hospital; the catharsis is *played* in the Waiting Room."
//
// This is the first prototype where the encounter is NOT a
// fight. There's no payer to argue with, no claim to amend,
// no denial to overturn. The patient is in front of you with
// an $87,420 bill she can't pay; the win condition is
// screening her properly, applying the financial-assistance
// policy correctly, and writing the bill off as charity care
// instead of letting it become bad debt.
//
// Action set:
//   - Read Maria's disclosures, pick a follow-up question that
//     elicits useful information instead of paternalism or
//     premature paperwork.
//   - Federal Poverty Level worksheet. Compute household income
//     / FPL ratio; pick the eligibility tier.
//   - File the bill as charity care, not bad debt and not a
//     payment-plan-only.
//
// The Lighthouse itself is restorative. It doesn't disappear
// when defeated; it keeps standing. The bell rings; Maria
// walks out; the next person finds the lighthouse the same
// way she did. The encounter is a kindness, not a victory.

import { BASE_CSS, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

interface QuestionOption {
  id: string
  label: string
  patientResponse: string
  /** 'good' | 'paternalistic' | 'premature' | 'kind-but-not-yet'. */
  judgment: 'good' | 'paternalistic' | 'premature' | 'kind-but-not-yet'
  feedback: string
}

interface FplBucketOption {
  id: 'under-200' | '200-300' | '300-400' | 'over-400'
  label: string
  detail: string
  support: 'correct' | 'wrong'
  feedback: string
}

interface TierOption {
  id: 'charity-100' | 'charity-75' | 'charity-50' | 'plan-only' | 'bad-debt'
  label: string
  detail: string
  support: 'correct' | 'wrong'
  feedback: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'listen' | 'screen' | 'release'
}

interface GlossaryEntry {
  term: string
  plain: string
}

const issues: Issue[] = [
  {
    id: 'listen',
    label: "Listen — ask a follow-up question that elicits useful information without paternalism.",
    recap: "You asked her about her job's insurance and her recovery, not about whether she made the 'right' financial choices. She told you what she lost when the employer plan ended; she told you what the COBRA premium was; she told you what dinner has looked like for the kids. The intake on her financial-assistance application is going to be cleaner because of that conversation.",
    verb: 'listen',
  },
  {
    id: 'screen',
    label: "Screen — compute Maria's household income against the federal poverty level and pick her tier.",
    recap: "Household of 3 (Maria + her two kids). 2024 FPL for HH=3 is $25,820; her income is $32,000, which puts her at 124% FPL — squarely in Mercy's <200% tier. By policy, that's a 100% write-off; she owes $0.",
    verb: 'screen',
  },
  {
    id: 'release',
    label: "Release — file the bill as charity care, not bad debt and not a payment-plan-only.",
    recap: "You filed Maria's $87,420 as charity care under Mercy's <200%-FPL tier. Charity is the *positive* path: the hospital writes the bill off voluntarily because the patient qualifies. Bad debt is what happens when a hospital fails to collect; payment-plan-only would be quietly cruel. This is the right tool for who Maria is.",
    verb: 'release',
  },
]

const questionOptions: QuestionOption[] = [
  {
    id: 'job-insurance',
    label: "\"Did Sysco's plan end when you went on FMLA, or earlier?\"",
    patientResponse: "She nods. \"Two weeks before the stroke. They said... they said FMLA pauses the plan if you're out before 90 days. I'd just hit my 60-day mark when I went out. The HR lady was nice about it. I don't think she made the rule.\"",
    judgment: 'good',
    feedback: "Right kind of question. Job-loss timing matters for the FA application's narrative — and asking about the *plan*, not about her *choices*, signals that you're not auditing her. She'll feel safer answering the income questions next.",
  },
  {
    id: 'recovery',
    label: "\"How are you doing with the recovery? Are you back to PT yet?\"",
    patientResponse: "She exhales. \"Outpatient PT three days a week. The therapist is good. I can lift my left arm to about here\" — she demonstrates, halfway up — \"and I'm back to walking up stairs without holding the rail. Slow, but. Yeah.\"",
    judgment: 'kind-but-not-yet',
    feedback: "Kind, and exactly the kind of question a human asks. But for the FA application you need information about her household and finances first — there'll be time for the recovery questions when the paperwork is settled. Try asking about her insurance.",
  },
  {
    id: 'cobra',
    label: "\"Did you not sign up for COBRA when the plan ended?\"",
    patientResponse: "She looks down. \"I... I tried. The premium was $800 a month. We were eating cereal for dinner.\" Long pause. \"I didn't expect to have a stroke.\"",
    judgment: 'paternalistic',
    feedback: "She tried. The COBRA premium was nearly her entire monthly income. The question lands as judgment whether you intended that or not — the patient's already ashamed of her financial situation; the FA worker's job is to make the room feel safe, not to interrogate. Try a question about the plan, not about her.",
  },
  {
    id: 'bank-statements',
    label: "\"I'll need to see your bank statements before we can process this.\"",
    patientResponse: "She freezes. \"Right now? I... they froze the account two weeks ago. Overdrafts. I have my paystubs from before, would those — \"",
    judgment: 'premature',
    feedback: "Premature. Mercy's FA application asks for income documentation but not bank statements at intake; you can verify income with paystubs or a tax return. Asking for bank statements in the first thirty seconds reads as suspicion; it also frequently freezes patients out of the process entirely. Slow down — start with conversation, not documents.",
  },
]

const fplBuckets: FplBucketOption[] = [
  {
    id: 'under-200',
    label: 'Under 200% FPL',
    detail: 'Mercy policy: 100% charity write-off. Patient owes $0.',
    support: 'correct',
    feedback: "Right tier. Maria's at 124% FPL — well under 200%. Mercy's policy writes off 100% of the bill for this band.",
  },
  {
    id: '200-300',
    label: '200-300% FPL',
    detail: 'Mercy policy: 75% charity write-off. Patient owes ~$21,855.',
    support: 'wrong',
    feedback: "Maria's at 124% FPL, not 200-300%. Income $32,000, household 3, 2024 FPL HH=3 = $25,820 → 32000/25820 = 124%. She qualifies for the under-200% tier, which is a full write-off, not 75%.",
  },
  {
    id: '300-400',
    label: '300-400% FPL',
    detail: 'Mercy policy: 50% charity write-off. Patient owes ~$43,710.',
    support: 'wrong',
    feedback: "Way off. 300% FPL for HH=3 is $77,460 in income — Maria's at $32,000. The math is 32000/25820 = 124%; she's in the lowest band, not the highest.",
  },
  {
    id: 'over-400',
    label: 'Over 400% FPL',
    detail: 'Mercy policy: not eligible for charity. Payment plan only. Patient owes $87,420.',
    support: 'wrong',
    feedback: "Not even close. 400% FPL for HH=3 is $103,280; Maria earned $32,000 last year. This pick would deny her the assistance she clearly qualifies for and put $87,420 on a payment plan she can't pay.",
  },
]

const tierOptions: TierOption[] = [
  {
    id: 'charity-100',
    label: 'Charity care · 100% write-off',
    detail: "Mercy absorbs the full $87,420. Maria owes $0. Filed under Mercy's <200%-FPL tier.",
    support: 'correct',
    feedback: "The right tool for who Maria is. Mercy writes the full $87,420 off as charity care; the bill never becomes hers to pay. The lighthouse rings.",
  },
  {
    id: 'charity-75',
    label: 'Charity care · 75% write-off',
    detail: "$65,565 written off. Maria owes ~$21,855 on a payment plan.",
    support: 'wrong',
    feedback: "Wrong tier. The screening said <200% FPL = 100% write-off; you've applied the 200-300% band's rules to Maria. She'd still be carrying $21,855 she can't pay; eventually that goes to bad debt and collections, just slower.",
  },
  {
    id: 'plan-only',
    label: 'Payment plan only',
    detail: "$87,420 over 24 months at $3,642/mo. No write-off.",
    support: 'wrong',
    feedback: "A payment plan she can't pay is just deferral. Maria's monthly income is around $2,600 pre-tax; a $3,642/month plan is impossible. Three or four missed payments and the account goes to collections anyway. Skipping the FA screen puts her on a treadmill that ends in the same place — except now Mercy spends six months calling her about it.",
  },
  {
    id: 'bad-debt',
    label: 'Bad debt — write off and send to collections',
    detail: "Mercy writes off the bill internally as uncollectable; the account goes to collections.",
    support: 'wrong',
    feedback: "Bad debt is what hospitals do when they fail to collect. It's the *passive* path: the bill goes to collections, hits Maria's credit, follows her around for seven years. Charity care is the *active* path — the same dollar amount written off, but as a deliberate kindness. She qualifies for charity. Use the right tool.",
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'FPL': {
    term: 'FPL (federal poverty level)',
    plain: "The federal income threshold the government publishes annually, indexed by household size. Charity-care policies at most US hospitals are calibrated against FPL multiples — 'under 200% FPL' is a common qualifier for full write-off, with sliding scales above that. 2024 FPL for a household of 3 is $25,820; 200% is $51,640.",
  },
  'charity care': {
    term: 'Charity care',
    plain: "When a hospital voluntarily writes off all or part of a patient's bill because the patient meets the hospital's financial-assistance policy. This is the *positive* path: the hospital chose to forgive the debt, the patient owes nothing, and federal nonprofit-hospital rules require it as a condition of tax-exempt status. Charity care has to be screened-for and granted; it doesn't happen automatically.",
  },
  'bad debt': {
    term: 'Bad debt',
    plain: "When the hospital tried to collect, failed, and writes the bill off as uncollectable. The patient still owes the money on paper; the account goes to collections; the patient's credit is hit. Same dollar amount written off as charity care, very different impact on the patient. The active difference between the two is whether anyone screened the patient for charity-care eligibility *first*.",
  },
  'FMLA': {
    term: 'FMLA (Family & Medical Leave Act)',
    plain: "Federal law giving covered employees up to 12 weeks of unpaid leave for serious medical reasons, with their job protected. Doesn't require pay, doesn't extend coverage indefinitely, and doesn't apply to small employers. A frequent flyer in patient stories: someone takes FMLA, exhausts it, loses the job + the employer health plan, and has a medical event in the gap.",
  },
  'COBRA': {
    term: 'COBRA',
    plain: "Federal continuation-of-coverage law: when a worker loses their employer health plan, they can extend it for up to 18 months, but they pay the *full* premium themselves (employer + employee share + 2% admin fee). Premiums often run $700-1,500/month for individual coverage and $1,500-2,500 for family. Frequently impossible to afford for the people who most need it.",
  },
  'FA application': {
    term: 'Financial assistance application',
    plain: "The hospital-side form a patient fills out to apply for charity care. Asks for household composition, household income, residency, citizenship status, asset declaration. Outcome maps to the hospital's published FA policy — usually a tier table by FPL multiple. Federal rules require nonprofit hospitals to publish their FA policy in plain language, and to screen patients for eligibility before pursuing collections.",
  },
}

// === Maria's case (invented for the prototype) ===
const PATIENT = {
  name: 'Maria Vega',
  age: 42,
  occupation: 'Food service worker (Sysco — laid off 2026-04-12)',
  householdSize: 3,
  householdComposition: 'Maria + 2 kids (ages 8 and 11)',
  annualIncome: 32000,
  income2023: 31420,
  income2024Ytd: 11200, // before the stroke
  citizenship: 'US citizen',
  residency: 'Mercy service area (24-month resident)',
  assets: 'No real property. Frozen checking acct ($-340). Used 2014 sedan.',
  totalCharge: 87420,
  charges: [
    { label: 'ICU · 4 days', amount: 32400 },
    { label: 'Step-down · 3 days', amount: 14600 },
    { label: 'Inpatient rehab · 14 days', amount: 38120 },
    { label: 'Pharmacy / labs / imaging', amount: 2300 },
  ],
  diagnosis: 'Left MCA ischemic stroke; right hemiparesis (improving)',
  insurance: 'Sysco group plan (terminated 2026-04-26, two weeks pre-stroke)',
  cobraPremium: 802,
}

const FPL_HH3_2024 = 25820

// === Runtime state ===

const state = {
  briefingDone: false,
  briefingOpen: false,
  /** Question-asking modal state. */
  questionsAsked: new Set<string>(),
  questionFeedback: null as { id: string; option: QuestionOption } | null,
  /** Worksheet state. */
  worksheetOpen: false,
  worksheetHouseholdSize: 3,
  worksheetIncome: PATIENT.annualIncome,
  worksheetFplPickedBucket: null as null | 'under-200' | '200-300' | '300-400' | 'over-400',
  worksheetFplFeedback: null as { id: string; message: string } | null,
  /** Tier modal state (final release). */
  tierOpen: false,
  tierFeedback: null as { id: string; message: string } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  feedback: '' as string,
  feedbackKind: 'neutral' as 'neutral' | 'good' | 'bad',
  lastRecap: '' as string,
  packetSubmitted: false,
  openTermId: null as string | null,
}

// === Rendering ===

function term(termId: string, displayText?: string): string {
  const entry = glossary[termId]
  const text = displayText ?? termId
  if (!entry) return escape(text)
  return `<span class="term" data-action="open-term" data-term="${termId}" title="${escape(entry.plain)}">${escape(text)}<span class="term-icon">?</span></span>`
}

function money(n: number): string {
  return '$' + n.toLocaleString()
}

function render(): string {
  if (state.packetSubmitted) {
    return renderHeader() + renderVictory() + renderTermPopover() + renderBriefingPopover() + renderWorksheetModal() + renderTierModal()
  }
  return `
    ${renderHeader()}
    ${renderHospitalIntro()}
    ${!state.briefingDone ? renderBriefingInline() : `
      ${renderPatientPanel()}
      ${renderQuestionPanel()}
      ${renderWorksheet()}
      ${renderReleasePanel()}
      ${renderChecklist()}
    `}
    ${state.briefingDone ? '' : renderDesignNotes()}
    ${renderTermPopover()}
    ${renderBriefingPopover()}
    ${renderWorksheetModal()}
    ${renderTierModal()}
  `
}

function renderHeader(): string {
  const recallBtn = state.briefingDone
    ? `<button class="recall-btn" data-action="show-briefing">📜 Dana's note</button>`
    : ''
  return `
    <header class="page-h">
      <div class="title-row">
        <h1>Lighthouse <span class="muted">@ L8</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./">← back to game</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          A tenth prototype, sibling to the others — but a
          deliberately different shape. <strong>This isn't a
          fight.</strong> There's no payer to argue with, no
          claim to amend, no denial to overturn. The patient
          is in front of you with an $87,420 bill she can't
          pay; the win condition is screening her properly,
          applying ${term('charity care', "Mercy's financial-assistance policy")}
          correctly, and releasing the bill instead of letting
          it become ${term('bad debt')}. See the
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
      <div class="register hospital">HOSPITAL · PFS counter · this morning</div>
      <p>
        Maria Vega is in front of you holding a printed
        statement. <strong>${money(PATIENT.totalCharge)}.</strong>
        She's 42, food service, two kids. Six weeks ago she
        had a stroke at her mother's apartment; the ambulance
        brought her here. ICU, step-down, inpatient rehab.
        The recovery is going well. The recovery is the only
        thing going well.
      </p>
      <p>
        Her job ended on ${PATIENT.occupation.split('—')[1]?.trim() ?? '2026-04-12'}.
        Sysco's plan ended two weeks before the stroke; she'd
        hit her ${term('FMLA')} 60-day mark just before going
        out, and the policy paused. ${term('COBRA')} would have
        been ${money(PATIENT.cobraPremium)} a month. She didn't
        sign up. She didn't expect to have a stroke.
      </p>
      <p>
        She's not crying. She did her crying weeks ago. Her
        hands are shaking on the statement.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and somewhere down a long corridor you've never
        walked, you see a beam of light. Not a flicker; a
        steady warmth. A small bell, maybe a chime. The
        fluorescents above you don't dim — they get warmer.
        You're somewhere else.</em>
      </div>
      <div class="register waiting-room">WAITING ROOM · the lighthouse</div>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : "Different from the other fights. Listen close."}</span>
    </div>
    <div class="briefing-body">
      <p>
        "This one isn't a fight. There's no payer on the other
        side of the desk; there's just Maria. The bill is
        already real. The question is what kind of bill it
        becomes — ${term('charity care', "charity")},
        ${term('bad debt')}, payment plan, or something in
        between."
      </p>
      <p>
        "The Lighthouse is the only station in the Waiting
        Room that isn't bureaucratic. It's restorative.
        Patients who get screened for ${term('FA application', 'financial assistance')}
        properly find their way here. Patients who get steered
        toward collections never do."
      </p>
      <p>
        "Three issues, in order:"
      </p>
      <ul>
        <li>
          She's already exhausted. Ask one good follow-up
          question — the kind that gets you what the
          application needs without making her feel audited.
        </li>
        <li>
          Open the FA worksheet. Compute her household income
          against ${term('FPL')}. Pick her tier.
        </li>
        <li>
          File the bill correctly — as charity care under the
          right tier, not as bad debt and not as a
          payment-plan-only.
        </li>
      </ul>
      <p>
        "The Lighthouse doesn't disappear when this is done.
        It keeps standing. The next person finds it the same
        way Maria did. That's the point."
      </p>
      <p class="briefing-sign">"Be the kind one. — D."</p>
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

function renderPatientPanel(): string {
  return `
    <section class="patient-panel">
      <div class="pp-h">
        <div class="pp-portrait">
          <div class="pp-portrait-glyph">M</div>
        </div>
        <div class="pp-id">
          <div class="pp-name">${escape(PATIENT.name)}</div>
          <div class="pp-meta">${PATIENT.age} · ${escape(PATIENT.occupation)}</div>
          <div class="pp-meta">Household: ${PATIENT.householdSize} (${escape(PATIENT.householdComposition)})</div>
          <div class="pp-meta">Coverage: ${escape(PATIENT.insurance)}</div>
        </div>
      </div>
      <div class="pp-body">
        <div class="pp-section">
          <div class="pp-h-row">DIAGNOSIS</div>
          <div class="pp-text">${escape(PATIENT.diagnosis)}</div>
        </div>
        <div class="pp-section">
          <div class="pp-h-row">CHARGES</div>
          <table class="pp-charges">
            ${PATIENT.charges.map(c => `
              <tr><td>${escape(c.label)}</td><td class="right">${money(c.amount)}</td></tr>
            `).join('')}
            <tr class="total"><td><strong>TOTAL</strong></td><td class="right"><strong>${money(PATIENT.totalCharge)}</strong></td></tr>
          </table>
        </div>
        <div class="pp-section">
          <div class="pp-h-row">DISCLOSURES (intake)</div>
          <ul class="pp-disclosures">
            <li>"I lost my job in April. The plan ended two weeks before."</li>
            <li>"COBRA was ${money(PATIENT.cobraPremium)} a month. I couldn't."</li>
            <li>"I make about ${money(PATIENT.annualIncome)} a year, when I'm working."</li>
            <li>"I have two kids. They live with me. Their dad's not in the picture."</li>
            <li>"I rent. No house. The car's a 2014."</li>
          </ul>
        </div>
      </div>
    </section>
  `
}

function renderQuestionPanel(): string {
  const listenResolved = state.resolvedIssues.has('listen')
  const lastFb = state.questionFeedback
  return `
    <section class="question-panel ${listenResolved ? 'resolved' : ''}">
      <div class="qp-h">
        <span class="qp-tag">${listenResolved ? 'CONVERSATION · GOOD' : 'ASK A FOLLOW-UP'}</span>
        <span class="qp-sub">${listenResolved
          ? 'She told you what she could. The application will be cleaner because of this.'
          : 'Pick one question. The right kind elicits useful information; the wrong kind makes her feel audited.'}</span>
      </div>
      ${listenResolved ? '' : `
        <ul class="question-options">
          ${questionOptions.map(opt => {
            const asked = state.questionsAsked.has(opt.id)
            const showFb = lastFb && lastFb.id === opt.id
            return `
              <li class="q-option ${asked ? 'asked' : ''} ${showFb ? 'showing-fb' : ''}"
                  ${asked ? '' : `data-action="ask-question" data-id="${opt.id}"`}>
                <div class="q-option-label">${escape(opt.label)}</div>
                ${showFb ? `
                  <div class="q-response">
                    <div class="q-response-h">She:</div>
                    <p>${escape(opt.patientResponse)}</p>
                  </div>
                  <div class="q-feedback q-${opt.judgment}">
                    ${escape(opt.feedback)}
                  </div>
                ` : ''}
              </li>
            `
          }).join('')}
        </ul>
      `}
    </section>
  `
}

function renderWorksheet(): string {
  const screenResolved = state.resolvedIssues.has('screen')
  const fplPercent = Math.round((PATIENT.annualIncome / FPL_HH3_2024) * 100)
  return `
    <section class="worksheet-panel ${screenResolved ? 'resolved' : ''}">
      <div class="ws-h">
        <span class="ws-tag">${screenResolved ? 'FA WORKSHEET · COMPLETE' : 'FA WORKSHEET · open'}</span>
        <span class="ws-sub">${screenResolved
          ? `Maria at ${fplPercent}% FPL. Mercy's <200% tier applies — full charity write-off.`
          : `Compute Maria's income / federal poverty level ratio; pick her tier.`}</span>
      </div>
      <table class="ws-table">
        <tr><td>Household size</td><td class="right">${PATIENT.householdSize}</td></tr>
        <tr><td>Annual income (2023)</td><td class="right">${money(PATIENT.income2023)}</td></tr>
        <tr><td>Annual income (estimated, 2024 pre-stroke run-rate)</td><td class="right">${money(PATIENT.annualIncome)}</td></tr>
        <tr><td>${term('FPL', '2024 FPL · household of 3')}</td><td class="right">${money(FPL_HH3_2024)}</td></tr>
        <tr class="ws-calc"><td>Income ÷ FPL</td><td class="right">${money(PATIENT.annualIncome)} ÷ ${money(FPL_HH3_2024)} = <strong>${fplPercent}%</strong></td></tr>
      </table>
      ${screenResolved ? '' : `
        <div class="ws-actions">
          <button class="btn primary" data-action="open-worksheet">
            Pick eligibility tier
          </button>
        </div>
      `}
    </section>
  `
}

function renderWorksheetModal(): string {
  if (!state.worksheetOpen) return ''
  return `
    <div class="amend-modal-backdrop">
      <div class="amend-modal lighthouse-modal">
        <button class="amend-modal-close" data-action="close-worksheet" aria-label="Close">×</button>
        <div class="amend-modal-h">
          <span class="amend-tag">FPL TIER · MERCY GENERAL FA POLICY</span>
          <span class="amend-sub">Maria is at 124% FPL. Pick the tier that matches.</span>
        </div>
        <div class="amend-context">
          <strong>Mercy's published tiers:</strong> &lt;200% FPL = 100% write-off. 200-300% = 75%. 300-400% = 50%. Over 400% = not eligible.
        </div>
        <ul class="amend-options">
          ${fplBuckets.map(opt => {
            const fb = state.worksheetFplFeedback?.id === opt.id ? state.worksheetFplFeedback : null
            return `
              <li class="amend-option ${fb && opt.support !== 'correct' ? 'rejected' : ''}"
                  data-action="pick-bucket" data-id="${opt.id}">
                <div class="amend-option-h">
                  <span class="amend-option-label"><strong>${escape(opt.label)}</strong></span>
                </div>
                <div class="amend-option-detail">${escape(opt.detail)}</div>
                ${fb ? `<div class="amend-option-fb">${escape(fb.message)}</div>` : ''}
              </li>
            `
          }).join('')}
        </ul>
      </div>
    </div>
  `
}

function renderReleasePanel(): string {
  const screenResolved = state.resolvedIssues.has('screen')
  const releaseResolved = state.resolvedIssues.has('release')
  if (!screenResolved) {
    return `
      <section class="release-panel idle">
        <div class="rp-h">
          <span class="rp-tag">RELEASE</span>
          <span class="rp-sub">Available after screening. Decide how to file the bill.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="release-panel ${releaseResolved ? 'done' : 'active'}">
      <div class="rp-h">
        <span class="rp-tag">RELEASE · ${releaseResolved ? 'FILED' : 'READY'}</span>
        <span class="rp-sub">${releaseResolved
          ? "Filed as charity care. Maria walks out owing nothing. The lighthouse rings."
          : "How do we file this bill?"}</span>
      </div>
      ${releaseResolved ? '' : `
        <div class="rp-body">
          <p>
            Maria's qualified for the under-200%-FPL tier.
            That doesn't <em>require</em> filing as charity —
            you can still send her to a payment plan or, by
            policy default, watch the account drift toward
            ${term('bad debt')} and collections. Pick the
            tool that matches who she is.
          </p>
          <button class="btn primary" data-action="open-tier">
            Pick filing path
          </button>
        </div>
      `}
    </section>
  `
}

function renderTierModal(): string {
  if (!state.tierOpen) return ''
  return `
    <div class="amend-modal-backdrop">
      <div class="amend-modal lighthouse-modal">
        <button class="amend-modal-close" data-action="close-tier" aria-label="Close">×</button>
        <div class="amend-modal-h">
          <span class="amend-tag">RELEASE · HOW DO WE FILE THIS?</span>
          <span class="amend-sub">Maria qualifies for charity. The question is whether you choose to use that tool.</span>
        </div>
        <div class="amend-context">
          <strong>Total charge:</strong> ${money(PATIENT.totalCharge)}. <strong>Tier on file:</strong> &lt;200% FPL.
        </div>
        <ul class="amend-options">
          ${tierOptions.map(opt => {
            const fb = state.tierFeedback?.id === opt.id ? state.tierFeedback : null
            return `
              <li class="amend-option ${fb && opt.support !== 'correct' ? 'rejected' : ''}"
                  data-action="pick-tier" data-id="${opt.id}">
                <div class="amend-option-h">
                  <span class="amend-option-label"><strong>${escape(opt.label)}</strong></span>
                </div>
                <div class="amend-option-detail">${escape(opt.detail)}</div>
                ${fb ? `<div class="amend-option-fb">${escape(fb.message)}</div>` : ''}
              </li>
            `
          }).join('')}
        </ul>
      </div>
    </div>
  `
}

function renderChecklist(): string {
  const allResolved = state.resolvedIssues.size === issues.length
  return `
    <section class="checklist">
      <div class="checklist-h">Lighthouse checklist — ${state.resolvedIssues.size} of ${issues.length} steps complete</div>
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
        RING THE BELL
      </button>
      ${state.failedAttempts > 0 ? `<div class="fail-counter">Wrong picks so far: ${state.failedAttempts}.</div>` : ''}
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

const RECAP: CaseRecap = CASE_RECAPS['lighthouse']

function renderVictory(): string {
  return `
    <section class="victory lighthouse-victory">
      <h2>The bell rings.</h2>
      <p class="register hospital">Hospital, two weeks later.</p>
      <p>
        Mercy's financial-assistance committee approves the
        write-off. The full ${money(PATIENT.totalCharge)} comes
        off the hospital's books as charity care. Maria's
        statement gets reissued at $0. She calls PFS to make
        sure it's real, twice. The third time she just thanks
        the rep and hangs up.
      </p>
      <p>
        Recovery continues. Outpatient PT three days a week.
        Job interview at a different food-service company,
        with insurance on day one this time. The kids are at
        school. The mortgage on her mom's apartment, where
        they're staying, is paid this month.
      </p>
      <p class="register waiting-room">Waiting Room · the lighthouse, still standing.</p>
      <p>
        The Lighthouse is unchanged. The bell is still ringing
        — softly, from a long way off. The next person finds
        it the same way Maria did.
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
            <li><b>Not a fight.</b> First prototype where the encounter has no enemy. The patient is in front of you; the bill is real; the question is what happens to it. Win condition: the bill gets released as charity, not let to drift into bad debt.</li>
            <li><b>Patient-facing register.</b> Every prior prototype argues with payers. This one is a conversation with someone who owes money she can't pay. Different emotional shape entirely — closer to social work than RCM.</li>
            <li><b>Listen, screen, release.</b> Not amend, not cite, not appeal. Listening well is a learnable skill that maps onto a multiple-choice mechanic — the wrong question reads as paternalism, premature paperwork, or judgment, and the patient closes off.</li>
            <li><b>The Lighthouse doesn't disappear.</b> Defeat-the-encounter framing is gone. The Lighthouse keeps standing; the next patient finds it the same way Maria did. Cosmologically: this is a release valve, not a stuck claim.</li>
            <li><b>Outside the four-district system.</b> The prototype uses a warm-gold accent (lighthouse beam), not one of the canonical Eligibility/Coding/Billing/Appeals colors. The encounter sits outside the action set those districts share.</li>
          </ul>
        </div>
        <div>
          <h3>What this prototype proves (or tries to)</h3>
          <ul>
            <li>The framework holds for non-combat encounters — same hospital intro, dreamlike fall, Dana voice, checklist, submit; only the middle and the emotional register changed.</li>
            <li>"Pick the right kind of question to ask" reads as a teachable skill (not a trivia challenge) when the wrong kinds get specific patient-side feedback rather than generic "wrong answer" rejection.</li>
            <li>FPL math taught inline beats FPL math taught in a glossary — the worksheet shows the calculation as it happens, with the divisor and result bolded.</li>
            <li>Charity-vs-bad-debt is the load-bearing distinction in real-world hospital RCM, and it's almost never named in healthcare-system games. Naming it directly — and making the choice <em>matter</em> — does most of the teaching.</li>
            <li>Dana's voice scales to a kindness-mode encounter without becoming saccharine. Sign-off shifts from "Don't be most people" to "Be the kind one."</li>
          </ul>
        </div>
      </div>
      <p class="notes-cta">
        Side-by-side comparison: open
        <a href="./specter-prototype.html">Specter</a> for the
        payer-side cousin (VARIANCE — find the underpayment
        the payer hid in CO-45). Both involve careful reading
        of someone's financial situation; one is a fight with
        a payer, the other is a kindness toward a patient. The
        framework absorbs both.
      </p>
    </section>
  `
}

// === Interactions ===

function setFeedback(text: string, kind: 'good' | 'bad' | 'neutral' = 'neutral') {
  state.feedback = text
  state.feedbackKind = kind
}

function askQuestion(id: string) {
  if (state.resolvedIssues.has('listen')) return
  const opt = questionOptions.find(o => o.id === id)
  if (!opt) return
  state.questionsAsked.add(id)
  state.questionFeedback = { id, option: opt }
  if (opt.judgment !== 'good') {
    state.failedAttempts += 1
    return
  }
  state.resolvedIssues.add('listen')
  const issue = issues.find(i => i.id === 'listen')!
  setFeedback("Conversation grounded. She'll fill out the application without flinching.", 'good')
  state.lastRecap = issue.recap
}

function pickBucket(id: 'under-200' | '200-300' | '300-400' | 'over-400') {
  const opt = fplBuckets.find(o => o.id === id)
  if (!opt) return
  if (opt.support !== 'correct') {
    state.failedAttempts += 1
    state.worksheetFplFeedback = { id, message: opt.feedback }
    return
  }
  state.worksheetFplPickedBucket = id
  state.worksheetOpen = false
  state.worksheetFplFeedback = null
  state.resolvedIssues.add('screen')
  const issue = issues.find(i => i.id === 'screen')!
  setFeedback(`Tier locked: under-200% FPL. ${opt.feedback}`, 'good')
  state.lastRecap = issue.recap
}

function pickTier(id: 'charity-100' | 'charity-75' | 'charity-50' | 'plan-only' | 'bad-debt') {
  const opt = tierOptions.find(o => o.id === id)
  if (!opt) return
  if (opt.support !== 'correct') {
    state.failedAttempts += 1
    state.tierFeedback = { id, message: opt.feedback }
    return
  }
  state.tierOpen = false
  state.tierFeedback = null
  state.resolvedIssues.add('release')
  const issue = issues.find(i => i.id === 'release')!
  setFeedback(`Filed as charity care. The lighthouse rings.`, 'good')
  state.lastRecap = issue.recap
}

function attemptSubmit() {
  if (state.resolvedIssues.size < issues.length) return
  state.packetSubmitted = true
  notifyParentVictory('lighthouse')
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  state.questionsAsked = new Set()
  state.questionFeedback = null
  state.worksheetOpen = false
  state.worksheetFplPickedBucket = null
  state.worksheetFplFeedback = null
  state.tierOpen = false
  state.tierFeedback = null
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
function openWorksheet() { state.worksheetOpen = true; state.worksheetFplFeedback = null }
function closeWorksheet() { state.worksheetOpen = false; state.worksheetFplFeedback = null }
function openTier() { state.tierOpen = true; state.tierFeedback = null }
function closeTier() { state.tierOpen = false; state.tierFeedback = null }
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
    closeWorksheet(); closeTier(); rerender(); return
  }
  const el = target.closest('[data-action]') as HTMLElement | null
  if (!el) return
  const action = el.dataset.action
  switch (action) {
    case 'ask-question': if (el.dataset.id) askQuestion(el.dataset.id); break
    case 'open-worksheet': openWorksheet(); break
    case 'close-worksheet': closeWorksheet(); break
    case 'pick-bucket':
      if (el.dataset.id === 'under-200' || el.dataset.id === '200-300' || el.dataset.id === '300-400' || el.dataset.id === 'over-400') {
        pickBucket(el.dataset.id)
      }
      break
    case 'open-tier': openTier(); break
    case 'close-tier': closeTier(); break
    case 'pick-tier':
      if (el.dataset.id === 'charity-100' || el.dataset.id === 'charity-75' || el.dataset.id === 'charity-50' || el.dataset.id === 'plan-only' || el.dataset.id === 'bad-debt') {
        pickTier(el.dataset.id)
      }
      break
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

// Lighthouse sits OUTSIDE the four-district system. Use a warm gold
// accent (lighthouse-beam color) instead of one of the canonical
// district colors. Override --accent and --accent-hover directly.
const css = `:root { --accent: #e8c074; --accent-hover: #f5d68c; }` + BASE_CSS + `
  /* Patient panel — Maria's portrait + meta + charges + disclosures. */
  .patient-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 18px 22px; margin-bottom: 22px; }
  .pp-h { display: flex; gap: 16px; align-items: center; margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px dashed #2a3142; }
  .pp-portrait { width: 56px; height: 56px; flex-shrink: 0; border-radius: 50%; background: linear-gradient(180deg, rgba(232, 192, 116, 0.25), rgba(232, 192, 116, 0.08)); border: 2px solid var(--accent); display: flex; align-items: center; justify-content: center; }
  .pp-portrait-glyph { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 26px; font-weight: 700; color: var(--accent); }
  .pp-id { display: flex; flex-direction: column; gap: 3px; }
  .pp-name { font-size: 16px; font-weight: 700; color: var(--ink); }
  .pp-meta { font-size: 12px; color: var(--ink-dim); }
  .pp-body { display: grid; grid-template-columns: 1fr 1fr 2fr; gap: 16px; }
  @media (max-width: 880px) { .pp-body { grid-template-columns: 1fr; } }
  .pp-section { background: var(--panel-2); padding: 12px 14px; border-radius: 5px; border-left: 2px solid #2a3142; }
  .pp-h-row { font-size: 10.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ink-dim); margin-bottom: 8px; }
  .pp-text { font-size: 13px; color: var(--ink); line-height: 1.5; }
  .pp-charges { width: 100%; border-collapse: collapse; font-size: 12.5px; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .pp-charges td { padding: 3px 0; color: var(--ink); }
  .pp-charges td.right { text-align: right; }
  .pp-charges tr.total td { padding-top: 8px; border-top: 1px solid #2a3142; color: var(--accent); }
  .pp-disclosures { list-style: none; padding-left: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .pp-disclosures li { font-size: 13px; color: var(--ink); line-height: 1.5; padding-left: 14px; border-left: 2px solid #4a3a2a; padding-top: 1px; padding-bottom: 1px; }

  /* Question-asking — multiple choice with patient response + judgment-aware feedback. */
  .question-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 18px 22px; margin-bottom: 22px; transition: border-color 0.3s, background 0.3s; }
  .question-panel.resolved { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126, 226, 193, 0.04), transparent); }
  .qp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
  .qp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .question-panel.resolved .qp-tag { color: var(--good); }
  .qp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .question-options { list-style: none; padding-left: 0; margin: 0; }
  .q-option { padding: 14px 16px; margin: 8px 0; background: var(--panel-2); border-radius: 5px; border-left: 3px solid transparent; cursor: pointer; transition: all 0.15s; }
  .q-option:hover:not(.asked) { background: #232b3a; border-left-color: var(--accent); }
  .q-option.asked { cursor: default; opacity: 0.85; }
  .q-option-label { font-size: 13.5px; color: var(--ink); line-height: 1.5; }
  .q-response { margin-top: 10px; padding: 10px 14px; background: rgba(232, 192, 116, 0.05); border-left: 3px solid var(--accent); border-radius: 4px; font-size: 13px; color: var(--ink); line-height: 1.55; }
  .q-response-h { font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); margin-bottom: 4px; }
  .q-response p { margin: 0; }
  .q-feedback { margin-top: 10px; padding: 10px 14px; border-radius: 4px; font-size: 12.5px; line-height: 1.55; }
  .q-good { background: rgba(126, 226, 193, 0.10); border-left: 3px solid var(--good); color: var(--good); }
  .q-paternalistic { background: rgba(239, 91, 123, 0.08); border-left: 3px solid var(--bad); color: #f3a4b6; }
  .q-premature { background: rgba(239, 91, 123, 0.08); border-left: 3px solid var(--bad); color: #f3a4b6; }
  .q-kind-but-not-yet { background: rgba(240, 168, 104, 0.08); border-left: 3px solid var(--accent-2); color: #f3c890; }

  /* Worksheet panel — read-only inputs + the calc + a button to open the tier modal. */
  .worksheet-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 18px 22px; margin-bottom: 22px; transition: border-color 0.3s, background 0.3s; }
  .worksheet-panel.resolved { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126, 226, 193, 0.04), transparent); }
  .ws-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .ws-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .worksheet-panel.resolved .ws-tag { color: var(--good); }
  .ws-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .ws-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .ws-table td { padding: 7px 8px; border-bottom: 1px dashed #232a36; }
  .ws-table td.right { text-align: right; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .ws-table tr.ws-calc td { background: rgba(232, 192, 116, 0.05); border-bottom: none; }
  .ws-table tr.ws-calc td strong { color: var(--accent); font-size: 14px; }
  .ws-actions { margin-top: 12px; }

  /* Release panel — the final pick. */
  .release-panel { background: var(--panel); border: 1px solid #232a36; border-left-width: 4px; border-radius: 8px; padding: 18px 22px; margin-bottom: 22px; transition: border-color 0.3s; }
  .release-panel.idle { border-left-color: #2a3142; opacity: 0.6; }
  .release-panel.active { border-left-color: var(--accent); }
  .release-panel.done { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126, 226, 193, 0.04), transparent); }
  .rp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .rp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .release-panel.idle .rp-tag { color: var(--ink-dim); }
  .release-panel.active .rp-tag { color: var(--accent); }
  .release-panel.done .rp-tag { color: var(--good); }
  .rp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .rp-body p { font-size: 13.5px; line-height: 1.6; margin: 0 0 12px; color: var(--ink); }

  /* Lighthouse modal styling — warm gold accent. */
  .lighthouse-modal { max-width: 720px; }
  .amend-option-detail { margin-top: 4px; font-size: 12px; color: var(--ink-dim); padding-left: 0; line-height: 1.45; }

  /* Recap uses warm gold instead of warm orange. */
  .recap { background: rgba(232, 192, 116, 0.06); border-color: #4a3a2a; }
  .recap-h { color: var(--accent); }

  /* Lighthouse victory — softer, restorative. */
  .lighthouse-victory { background: linear-gradient(180deg, rgba(232, 192, 116, 0.06), transparent); border-color: #4a3a2a; }
  .lighthouse-victory h2 { color: var(--accent); }
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
      if (state.worksheetOpen) { closeWorksheet(); changed = true }
      if (state.tierOpen) { closeTier(); changed = true }
      if (changed) rerender()
    }
  })
}

mount()
