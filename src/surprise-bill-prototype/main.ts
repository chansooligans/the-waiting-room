// Surprise Bill Specter @ L8 — first-sketch prototype.
//
// Companion to Lighthouse — also L8 / patient-facing — but a
// different shape entirely. Lighthouse is the kindness; this
// is the fight. The patient is in front of you with a $4,200
// balance bill from an out-of-network radiologist who read his
// in-network ER scan. Under the No Surprises Act, that bill is
// prohibited. The win condition isn't a write-off (Lighthouse)
// — it's a regulatory dispute that protects the patient and
// recovers the contested amount from the OON billing entity.
//
// Action set:
//   - Classify — recognize this as an NSA-protected scenario
//     (in-network facility + OON ancillary provider in an
//     emergency context).
//   - Calculate — compute what the patient *actually* owes
//     under NSA rules (in-network cost-share, not the OON
//     balance).
//   - Dispute — file the patient's protective statement +
//     initiate IDR (Independent Dispute Resolution) against
//     the OON billing entity.
//
// Where Lighthouse asks "is this person in front of you OK?",
// Surprise Bill asks "is this bill in front of you legal?"
// Both are L8 patient-facing; both have to coexist in the
// curriculum because they teach two different responsibilities
// the PFS counter has to carry.

import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

interface ClassifyOption {
  id: string
  label: string
  detail: string
  support: 'correct' | 'partial' | 'wrong'
  feedback: string
}

interface CalculateOption {
  id: string
  label: string
  detail: string
  support: 'correct' | 'wrong'
  feedback: string
}

interface DisputeOption {
  id: string
  label: string
  detail: string
  support: 'correct' | 'wrong'
  feedback: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'classify' | 'calculate' | 'dispute'
}

interface GlossaryEntry {
  term: string
  plain: string
}

const issues: Issue[] = [
  {
    id: 'classify',
    label: 'Classify the bill — is this NSA-protected?',
    recap: "Yes — in-network ER (Mercy) + out-of-network ancillary provider (Radiology Associates of Eastside, the contracted reader) in an emergency context. Textbook NSA scenario; the patient is held harmless from the OON balance.",
    verb: 'classify',
  },
  {
    id: 'calculate',
    label: "Calculate Lou's actual cost-share under NSA rules.",
    recap: "$150 — Lou's in-network CT copay under his Anthem PPO. NSA caps the patient's cost-share at the *in-network* amount even when the rendering provider is out-of-network. The remaining ~$3,850 is a dispute between the hospital, the OON provider, and Anthem; not Lou's problem.",
    verb: 'calculate',
  },
  {
    id: 'dispute',
    label: 'Dispute — protect the patient + initiate IDR with the OON provider.',
    recap: "You voided the $4,200 patient statement and reissued it at $150. The OON provider (RAE) has been notified of NSA applicability with a 30-day window to accept the QPA-based amount or initiate IDR. Lou walks out of the encounter with a corrected bill and a paper trail he can show his employer if questions come up.",
    verb: 'dispute',
  },
]

const classifyOptions: ClassifyOption[] = [
  {
    id: 'yes-nsa',
    label: 'Yes — NSA applies. In-network facility, OON ancillary, emergency context.',
    detail: "All three NSA triggers present. Patient's cost-share is capped at the in-network amount; the rest is a provider/payer dispute.",
    support: 'correct',
    feedback: "Right call. The radiologist who read Lou's CT was OON, but the facility (Mercy's ER) was in-network and the visit was an emergency. The NSA's surprise-bill protections apply in full.",
  },
  {
    id: 'no-nsa',
    label: 'No — this is just an out-of-network charge. Patient owes the bill minus their plan benefit.',
    detail: "Treat as standard OON balance billing. Lou owes whatever Anthem's OON benefit doesn't cover.",
    support: 'wrong',
    feedback: "That was the rule before 2022. The No Surprises Act explicitly carved this scenario out — emergency care at an in-network facility cannot be balance-billed by ancillary providers (radiology, anesthesia, pathology, ED docs) regardless of their network status. Treating it as standard OON would put Lou on the hook for $4,200 he doesn't actually owe.",
  },
  {
    id: 'partial-nsa',
    label: 'Partial — NSA caps the bill, but Lou still owes the OON amount above his in-network limit.',
    detail: "Reduce the bill by some amount but leave a residual on Lou's responsibility.",
    support: 'wrong',
    feedback: "NSA isn't a partial cap — it's a full hold-harmless. The patient pays in-network cost-share, period. Anything above that is between the OON provider, the facility, and the payer (via IDR if they can't agree). Splitting the difference would still leave Lou owing money he isn't legally required to pay.",
  },
  {
    id: 'prior-auth',
    label: "It's a prior-auth issue — refer Lou back to Anthem.",
    detail: "Tell Lou to call Anthem about the missing prior auth on his CT.",
    support: 'wrong',
    feedback: "Wrong category entirely. ER imaging doesn't require prior auth (emergency exception); the bill came from RAE, not from Anthem; and 'call your insurance' is exactly the runaround patients dread. The applicable rule is NSA, not PA — different denial code, different process, different protection.",
  },
]

const calculateOptions: CalculateOption[] = [
  {
    id: 'inn-share',
    label: '$150 — in-network CT copay per Anthem PPO benefits',
    detail: "Lou's in-network cost-share for ER imaging. Applies under NSA regardless of provider's network status.",
    support: 'correct',
    feedback: "Right amount. Lou's PPO has a flat $150 copay for ER imaging; under NSA, that's also his cap when the provider is OON. The remaining $3,850 isn't his to pay or to dispute.",
  },
  {
    id: 'full-bill',
    label: '$4,200 — the OON provider\'s billed charge',
    detail: "Lou pays the radiologist's full charge minus whatever Anthem's OON benefit covered.",
    support: 'wrong',
    feedback: "That's the bill RAE sent — but it's exactly what NSA prohibits. The patient's responsibility is capped at in-network cost-share. Asking Lou to pay $4,200 while we figure out IDR would defeat the entire purpose of the law.",
  },
  {
    id: 'zero',
    label: '$0 — patient owes nothing',
    detail: "Write off the entire bill. Lou pays nothing.",
    support: 'wrong',
    feedback: "Generous, but wrong. NSA caps patient responsibility at *in-network* — it doesn't zero it out. The in-network copay still applies; the dispute is over the amount *above* that. Setting it to $0 would be a charity-care write-off, which is a different mechanism with different documentation. Don't blur the two.",
  },
  {
    id: 'half',
    label: '$2,100 — split the difference, settle for half',
    detail: "Negotiate Lou down to half the OON charge.",
    support: 'wrong',
    feedback: "This is what some PFS teams quietly do under pressure: take 50% as a 'compromise' on a contested bill. NSA makes it unnecessary — the patient doesn't need to negotiate; the law does the work. $2,100 is still ~14× what Lou actually owes.",
  },
]

const disputeOptions: DisputeOption[] = [
  {
    id: 'void-and-idr',
    label: 'Void the $4,200 statement, reissue at $150, file IDR with RAE for the contested amount.',
    detail: "Patient walks out with a corrected statement; the dispute moves to IDR (out of Lou's hands).",
    support: 'correct',
    feedback: "Right action and right ordering: protect the patient first, settle the OON dispute through IDR. RAE has 30 days to accept the QPA-based offer or formally initiate IDR; either way Lou is out of the loop.",
  },
  {
    id: 'patient-pay-dispute-later',
    label: "Tell Lou to pay the $4,200 now and dispute it later.",
    detail: "Have Lou pay first to avoid collections; refund what comes back from the dispute.",
    support: 'wrong',
    feedback: "Common advice, frequently illegal post-NSA. Asking the patient to front a bill they aren't required to pay shifts the regulatory burden back onto them. If Lou pays and the dispute drags, his money is held while RAE keeps it. The NSA's whole point is that the patient never has to.",
  },
  {
    id: 'refer-to-payer',
    label: 'Refer Lou to Anthem and let him handle it with them.',
    detail: "Hand Lou Anthem's customer service number and walk away.",
    support: 'wrong',
    feedback: "Walking-away is a category of harm in patient billing — NSA explicitly puts the burden on the *facility* to protect the patient and on the *OON provider/payer* to negotiate. Punting Lou to Anthem when he came to Mercy with the problem is exactly the kind of runaround NSA was passed to end.",
  },
  {
    id: 'collections',
    label: 'Let it go to collections; the credit hit is between Lou and his bureau.',
    detail: "No action; the bill ages out into collections.",
    support: 'wrong',
    feedback: "Worst path. Under NSA, sending an NSA-protected balance bill to collections is itself a violation — the hospital risks regulatory action, and Lou ends up with a credit-bureau hit for a bill he never owed. This is the failure mode the law was designed to prevent.",
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'NSA': {
    term: 'NSA (No Surprises Act)',
    plain: "Federal law in effect since 2022 that protects patients from out-of-network balance bills in three scenarios: (1) emergency care at any facility, (2) non-emergency care from OON providers at in-network facilities (the radiologist / anesthesiologist / ED-doc carve-out), and (3) air ambulance services. Patient cost-share is capped at the in-network amount; the OON provider and payer settle the rest, often through IDR. Did not eliminate balance billing entirely (ground ambulance is still exposed), but covers most ER + ancillary scenarios.",
  },
  'IDR': {
    term: 'IDR (Independent Dispute Resolution)',
    plain: "The arbitration process NSA created for OON-vs-payer payment disputes. Either side can initiate after a 30-day open negotiation period; a certified IDR entity picks one party's offer (baseball-style arbitration). The QPA — qualifying payment amount — is the median in-network rate the payer paid for the same service, and is the anchor for IDR offers. Patients are not parties to IDR; the dispute is entirely between provider and payer.",
  },
  'QPA': {
    term: 'QPA (qualifying payment amount)',
    plain: "The median in-network rate the payer paid for a given service in the prior year, indexed by geography. Under NSA, the QPA is the default amount the OON provider receives if no other agreement is reached, and the anchor for IDR offers. Computing QPAs accurately has been a fight unto itself — the IDR process has been litigated repeatedly over how the QPA is calculated.",
  },
  'OON': {
    term: 'OON (out-of-network)',
    plain: "A provider not contracted with the patient's plan. OON providers can charge their own rates, which are usually higher than the in-network contracted rates. The whole point of NSA is to protect patients from OON exposure they didn't choose — emergency care + ancillary providers at in-network facilities are the most common scenarios where a patient ends up OON without realizing.",
  },
  'in-network cost-share': {
    term: 'In-network cost-share',
    plain: "What the patient owes under their plan when the provider IS in-network. Made up of copay, coinsurance, and deductible obligations. Under NSA, this same in-network cost-share is what the patient owes for protected OON encounters too — even though the provider charges OON rates.",
  },
  'balance bill': {
    term: 'Balance bill',
    plain: "A bill from an OON provider for the difference between what the provider charged and what the payer paid. Pre-NSA, these were the surprise bills patients received weeks after a hospital visit — sometimes thousands of dollars from providers they didn't know they'd been seen by. NSA prohibits balance billing in protected scenarios; the patient's only obligation is in-network cost-share.",
  },
  'ancillary provider': {
    term: 'Ancillary provider',
    plain: "A provider who renders services adjacent to the main encounter — radiologist (reading scans), anesthesiologist, pathologist, ED-doc-as-contractor. The NSA carve-out exists because patients have no ability to choose ancillary providers; the radiologist who reads your CT is whoever the hospital contracts with, regardless of the patient's network status.",
  },
}

// === Lou's case (invented for the prototype) ===
const PATIENT = {
  name: 'Lou Ramirez',
  age: 35,
  occupation: 'Retail manager (Target — currently employed, plan active)',
  insurance: 'Anthem BCBS PPO (group: Target Wellness Plan)',
  visit: 'ER · 2026-04-15 · Mercy General',
  chiefComplaint: 'Acute substernal chest pain',
  dx: 'GERD with reflux esophagitis (R10.13 / K21.0). Cardiac r/o negative.',
  procedures: 'EKG · CT chest with contrast (PE protocol) · troponin × 2',
  facilityNetworkStatus: 'in-network',
  innFacilityCharge: 1840, // patient saw $200 in-network ER copay; this is Mercy's adjudicated bill
  innFacilityPaidStatus: 'PAID',
  oonProviderName: 'Radiology Associates of Eastside (RAE)',
  oonProviderRole: 'Contracted radiologist; reads Mercy ER imaging',
  oonProviderNetworkStatus: 'OUT-OF-NETWORK with Anthem',
  oonBilledCharge: 4200,
  oonProviderPaidByAnthem: 0, // OON; no agreement
  oonBalanceBilled: 4200, // sent directly to Lou
  innCostShareForCt: 150, // Lou's actual in-network copay per his PPO
}

// === Runtime state ===

const state = {
  briefingDone: false,
  briefingOpen: false,
  classifyOpen: false,
  classifyFeedback: null as { id: string; message: string } | null,
  calculateOpen: false,
  calculateFeedback: null as { id: string; message: string } | null,
  disputeOpen: false,
  disputeFeedback: null as { id: string; message: string } | null,
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
    return renderHeader() + renderVictory() + renderTermPopover() + renderBriefingPopover() + renderClassifyModal() + renderCalculateModal() + renderDisputeModal()
  }
  return `
    ${renderHeader()}
    ${renderHospitalIntro()}
    ${!state.briefingDone ? renderBriefingInline() : `
      ${renderBillStack()}
      ${renderActionPanel()}
      ${renderChecklist()}
    `}
    ${state.briefingDone ? '' : renderDesignNotes()}
    ${renderTermPopover()}
    ${renderBriefingPopover()}
    ${renderClassifyModal()}
    ${renderCalculateModal()}
    ${renderDisputeModal()}
  `
}

function renderHeader(): string {
  const recallBtn = state.briefingDone
    ? `<button class="recall-btn" data-action="show-briefing">📜 Dana's note</button>`
    : ''
  return `
    <header class="page-h">
      <div class="title-row">
        <h1>Surprise Bill Specter <span class="muted">@ L8 — first-sketch prototype</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./">← back to game</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          An eleventh prototype, sibling to the others —
          patient-facing like Lighthouse, but a fight, not a
          kindness. A patient is at the PFS counter with a
          $4,200 ${term('balance bill')} from an
          ${term('OON')} radiologist who read his
          ${term('in-network cost-share', 'in-network')} ER
          scan. Under the ${term('NSA')}, that bill is
          prohibited. See the
          <a href="#design-notes">design notes</a>.
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
        Lou Ramirez is at your counter with two pieces of
        paper. The first is the Mercy ER bill from his April
        15 visit — chest pain, ruled out as reflux, sent home
        with omeprazole. That bill says "PAID — your responsibility:
        $200" and he paid it the day of discharge. The second
        is a separate bill that arrived in his mail two weeks
        ago: <strong>${money(PATIENT.oonBilledCharge)} from
        Radiology Associates of Eastside</strong>, the
        radiologist who read his CT. Anthem paid them
        nothing because they're ${term('OON')}. They're now
        billing Lou directly.
      </p>
      <p>
        Lou is not panicking — he's furious in the contained
        way of someone who reads contracts for a living. "I
        went to your hospital. I paid your bill. Now this guy
        I never met — that I had no way to even <em>know</em>
        about — wants four grand. How is that legal?"
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and somewhere down a long fluorescent corridor
        you've never walked, a tall figure in an expensive
        suit polishes its glasses on a spotless silk tie. It
        looks at you. It doesn't smile. The lights stutter.
        You're somewhere else.</em>
      </div>
      <div class="register waiting-room">WAITING ROOM · the Specter</div>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : "Patient-facing again — but this one's a fight."}</span>
    </div>
    <div class="briefing-body">
      <p>
        "This one is the Surprise Bill Specter. Different
        beast from the Lighthouse — Lou doesn't need charity.
        He needs the law applied to him correctly. The
        ${term('NSA')} has been on the books since 2022, but
        OON ${term('ancillary provider', 'ancillaries')} still
        send these bills out — sometimes by mistake, sometimes
        because they're hoping the patient pays before
        figuring out they don't have to."
      </p>
      <p>
        "Three issues, in order:"
      </p>
      <ul>
        <li>
          Is this an
          NSA-protected scenario? You need the right answer
          and the right reasoning — 'no, OON is just OON'
          and 'partial cap' both lose Lou money he isn't
          legally required to pay.
        </li>
        <li>
          What does Lou actually
          owe? It's not zero (NSA caps at in-network, doesn't
          eliminate it). It's not the bill (NSA prohibits
          that). It's his ${term('in-network cost-share')} —
          his plan's ER imaging copay.
        </li>
        <li>
          File the protective
          statement: void Lou's $4,200 bill, reissue at the
          right amount, initiate ${term('IDR')} with the OON
          provider for the contested portion. The dispute is
          between Mercy / Anthem / RAE — not Lou.
        </li>
      </ul>
      <p>
        "The Specter only haunts patients who don't know the
        rules. Lou's at the counter; you know the rules; this
        one ends fast if you do it right."
      </p>
      <p class="briefing-sign">"The Specter only haunts patients who don't know the rules. — D."</p>
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

function renderBillStack(): string {
  return `
    <section class="bill-stack">
      <div class="bs-h">
        <span class="bs-tag">LOU'S BILL STACK</span>
        <span class="bs-sub">Two bills from the same April 15 ER visit. One paid, one disputed.</span>
      </div>
      <div class="bs-row">
        <div class="bs-card paid">
          <div class="bs-card-h">
            <span class="bs-card-from">MERCY GENERAL · ER</span>
            <span class="bs-card-status paid">PAID · ${money(200)}</span>
          </div>
          <div class="bs-card-body">
            <div class="bs-line"><span>Visit</span><span>${escape(PATIENT.visit)}</span></div>
            <div class="bs-line"><span>Network</span><span class="good">${escape(PATIENT.facilityNetworkStatus)}</span></div>
            <div class="bs-line"><span>Total charge</span><span class="mono">${money(PATIENT.innFacilityCharge)}</span></div>
            <div class="bs-line"><span>Patient resp</span><span class="mono">${money(200)}</span></div>
            <div class="bs-card-note">Lou's in-network ER copay. Settled the day of discharge.</div>
          </div>
        </div>
        <div class="bs-card disputed">
          <div class="bs-card-h">
            <span class="bs-card-from">${escape(PATIENT.oonProviderName)}</span>
            <span class="bs-card-status disputed">SURPRISE · ${money(PATIENT.oonBilledCharge)}</span>
          </div>
          <div class="bs-card-body">
            <div class="bs-line"><span>Service</span><span>CT chest read · same visit</span></div>
            <div class="bs-line"><span>Network</span><span class="bad">${escape(PATIENT.oonProviderNetworkStatus)}</span></div>
            <div class="bs-line"><span>Anthem paid</span><span class="mono">${money(PATIENT.oonProviderPaidByAnthem)}</span></div>
            <div class="bs-line"><span>${term('balance bill', 'Balance billed to Lou')}</span><span class="mono bad">${money(PATIENT.oonBalanceBilled)}</span></div>
            <div class="bs-card-note">Sent directly to Lou two weeks after discharge. NSA-protected scenario? You decide.</div>
          </div>
        </div>
      </div>
    </section>
  `
}

function renderActionPanel(): string {
  const classifyResolved = state.resolvedIssues.has('classify')
  const calculateResolved = state.resolvedIssues.has('calculate')
  const disputeResolved = state.resolvedIssues.has('dispute')
  return `
    <section class="actions">
      <div class="action-row">
        <div class="action-tile ${classifyResolved ? 'done' : 'active'}">
          <div class="at-h">
            <span class="at-num">1</span>
            <span class="at-tag">CLASSIFY</span>
          </div>
          <p class="at-prose">${classifyResolved
            ? "NSA-protected scenario. In-network facility + OON ancillary + emergency. ✓"
            : "Is this an NSA-protected scenario? Pick the right reasoning."}</p>
          ${classifyResolved ? '' : `
            <button class="btn primary" data-action="open-classify">Classify</button>
          `}
        </div>
        <div class="action-tile ${!classifyResolved ? 'idle' : calculateResolved ? 'done' : 'active'}">
          <div class="at-h">
            <span class="at-num">2</span>
            <span class="at-tag">CALCULATE</span>
          </div>
          <p class="at-prose">${calculateResolved
            ? `${money(PATIENT.innCostShareForCt)} — Lou's in-network ER imaging copay. ✓`
            : !classifyResolved
              ? "Available after classification."
              : "What's Lou's actual cost-share under NSA?"}</p>
          ${(classifyResolved && !calculateResolved) ? `
            <button class="btn primary" data-action="open-calculate">Calculate</button>
          ` : ''}
        </div>
        <div class="action-tile ${!calculateResolved ? 'idle' : disputeResolved ? 'done' : 'active'}">
          <div class="at-h">
            <span class="at-num">3</span>
            <span class="at-tag">DISPUTE</span>
          </div>
          <p class="at-prose">${disputeResolved
            ? "Patient statement voided + reissued. IDR initiated with RAE. ✓"
            : !calculateResolved
              ? "Available after calculation."
              : "How do we resolve the contested portion?"}</p>
          ${(calculateResolved && !disputeResolved) ? `
            <button class="btn primary" data-action="open-dispute">Dispute</button>
          ` : ''}
        </div>
      </div>
    </section>
  `
}

function renderClassifyModal(): string {
  if (!state.classifyOpen) return ''
  return `
    <div class="amend-modal-backdrop">
      <div class="amend-modal sb-modal">
        <button class="amend-modal-close" data-action="close-classify" aria-label="Close">×</button>
        <div class="amend-modal-h">
          <span class="amend-tag">CLASSIFY · ${term('NSA')} APPLICABILITY</span>
          <span class="amend-sub">Read the bill stack carefully. Pick the right reasoning, not just the right outcome.</span>
        </div>
        <div class="amend-context">
          <strong>Facts:</strong> Mercy ER (in-network) on 2026-04-15. CT read by RAE (OON). Lou paid his $200 ER copay. RAE then sent a $4,200 separate bill for the read.
        </div>
        <ul class="amend-options">
          ${classifyOptions.map(opt => {
            const fb = state.classifyFeedback?.id === opt.id ? state.classifyFeedback : null
            return `
              <li class="amend-option ${fb && opt.support !== 'correct' ? 'rejected' : ''}"
                  data-action="pick-classify" data-id="${opt.id}">
                <div class="amend-option-h"><strong>${escape(opt.label)}</strong></div>
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

function renderCalculateModal(): string {
  if (!state.calculateOpen) return ''
  return `
    <div class="amend-modal-backdrop">
      <div class="amend-modal sb-modal">
        <button class="amend-modal-close" data-action="close-calculate" aria-label="Close">×</button>
        <div class="amend-modal-h">
          <span class="amend-tag">CALCULATE · LOU'S ACTUAL RESPONSIBILITY</span>
          <span class="amend-sub">NSA caps patient resp at the in-network amount. What's the right number?</span>
        </div>
        <div class="amend-context">
          <strong>Lou's plan benefit:</strong> Anthem PPO. ER imaging copay (in-network): $150. ER copay (paid): $200. Both are in-network amounts.
        </div>
        <ul class="amend-options">
          ${calculateOptions.map(opt => {
            const fb = state.calculateFeedback?.id === opt.id ? state.calculateFeedback : null
            return `
              <li class="amend-option ${fb && opt.support !== 'correct' ? 'rejected' : ''}"
                  data-action="pick-calculate" data-id="${opt.id}">
                <div class="amend-option-h"><strong>${escape(opt.label)}</strong></div>
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

function renderDisputeModal(): string {
  if (!state.disputeOpen) return ''
  return `
    <div class="amend-modal-backdrop">
      <div class="amend-modal sb-modal">
        <button class="amend-modal-close" data-action="close-dispute" aria-label="Close">×</button>
        <div class="amend-modal-h">
          <span class="amend-tag">DISPUTE · HOW DO WE RESOLVE THIS?</span>
          <span class="amend-sub">Pick the path that protects Lou and moves the dispute upstream.</span>
        </div>
        <div class="amend-context">
          <strong>Contested amount:</strong> ${money(PATIENT.oonBalanceBilled - PATIENT.innCostShareForCt)} (the difference between RAE's billed charge and Lou's ${term('in-network cost-share')}).
        </div>
        <ul class="amend-options">
          ${disputeOptions.map(opt => {
            const fb = state.disputeFeedback?.id === opt.id ? state.disputeFeedback : null
            return `
              <li class="amend-option ${fb && opt.support !== 'correct' ? 'rejected' : ''}"
                  data-action="pick-dispute" data-id="${opt.id}">
                <div class="amend-option-h"><strong>${escape(opt.label)}</strong></div>
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
      <div class="checklist-h">Surprise-bill checklist — ${state.resolvedIssues.size} of ${issues.length} steps complete</div>
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
        FILE THE PROTECTIVE STATEMENT
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

const RECAP: CaseRecap = CASE_RECAPS['surprise-bill']

function renderVictory(): string {
  return `
    <section class="victory">
      <h2>The bill becomes ${money(PATIENT.innCostShareForCt)}.</h2>
      <p class="register hospital">Hospital, the next morning.</p>
      <p>
        Lou's $4,200 statement is voided. A reissued
        statement at $150 — his in-network ER imaging copay —
        is in his email by 9 AM with a one-page NSA
        explanation attached. Mercy's billing team initiates
        ${term('IDR')} with RAE for the
        ${money(PATIENT.oonBalanceBilled - PATIENT.innCostShareForCt)}
        contested portion. RAE will accept Anthem's
        ${term('QPA')}-based offer or arbitrate; either way,
        Lou is out of the loop.
      </p>
      <p class="register waiting-room">Waiting Room.</p>
      <p>
        The Specter is gone. Where the tall figure stood,
        there's a single piece of paper — Lou's reissued
        statement, $150, marked PROTECTED. The polished
        shoes left no print on the chevron floor; the suit
        was never quite there at all.
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
            <li><b>Patient-facing fight.</b> Lighthouse (the L8 sibling) is patient-facing kindness — charity care write-off. Surprise Bill is patient-facing combat — NSA dispute against an OON billing entity. Both meet the patient at the PFS counter; they end in opposite registers.</li>
            <li><b>Three sequential gates.</b> CLASSIFY → CALCULATE → DISPUTE — each unlocks the next. Models the real-world workflow: you can't compute the right cost-share until you've classified the scenario; you can't file the dispute until you know what to dispute.</li>
            <li><b>Wrong picks are pedagogically distinct.</b> Each option's feedback names a specific real-world failure mode (treating it as standard OON, splitting the difference, handing the patient back to the payer, letting it go to collections). Players who pick wrong learn what NSA was specifically passed to prevent.</li>
            <li><b>Specter framing kept.</b> The Specter is the OON billing entity — polished, formal, devastating. The encounter ends with the Specter <em>vanishing</em>, not with the player beating it; once NSA is correctly applied, the bill simply doesn't exist anymore.</li>
            <li><b>Two bills shown side-by-side.</b> The bill-stack panel makes the NSA scenario visible: in-network facility bill (paid, $200) next to OON balance bill (disputed, $4,200). Pedagogically: the Specter is invisible to patients without a setup like this.</li>
          </ul>
        </div>
        <div>
          <h3>What this prototype proves (or tries to)</h3>
          <ul>
            <li>NSA / IDR / QPA — the most-recent and most-litigated patient protection in US healthcare — is teachable inline through three picks instead of a glossary dump.</li>
            <li>The Lighthouse-vs-Specter pairing at L8 carries the load-bearing distinction: hospitals' patient-facing PFS function has a kindness arm (charity) and an enforcement arm (regulatory disputes) that work different muscles and need different teaching.</li>
            <li>Three-tile sequential-action panel pattern works for ordered encounters where each step depends on the prior one.</li>
            <li>Dana's voice scales to a regulatory-fight encounter without losing its in-your-ear register; the sign-off goes back to "Don't be most people."</li>
            <li>The Specter's dissolution at victory ("the polished shoes left no print on the chevron floor; the suit was never quite there at all") leans into Twin Peaks more directly than prior prototypes' victory copy.</li>
          </ul>
        </div>
      </div>
      <p class="notes-cta">
        Side-by-side comparison: open
        <a href="./lighthouse-prototype.html">Lighthouse</a> for
        the L8 kindness cousin (charity care for a patient who
        can't pay) and
        <a href="./specter-prototype.html">Specter</a> for the
        L7 payer-side cousin (find the underpayment hidden in
        a CO-45). The framework absorbs all three: same shape,
        very different emotional and pedagogical loads.
      </p>
    </section>
  `
}

// === Interactions ===

function setFeedback(text: string, kind: 'good' | 'bad' | 'neutral' = 'neutral') {
  state.feedback = text
  state.feedbackKind = kind
}

function pickClassify(id: string) {
  const opt = classifyOptions.find(o => o.id === id)
  if (!opt) return
  if (opt.support !== 'correct') {
    state.failedAttempts += 1
    state.classifyFeedback = { id, message: opt.feedback }
    return
  }
  state.classifyOpen = false
  state.classifyFeedback = null
  state.resolvedIssues.add('classify')
  const issue = issues.find(i => i.id === 'classify')!
  setFeedback("NSA classification confirmed. Calculate Lou's actual cost-share next.", 'good')
  state.lastRecap = issue.recap
}

function pickCalculate(id: string) {
  const opt = calculateOptions.find(o => o.id === id)
  if (!opt) return
  if (opt.support !== 'correct') {
    state.failedAttempts += 1
    state.calculateFeedback = { id, message: opt.feedback }
    return
  }
  state.calculateOpen = false
  state.calculateFeedback = null
  state.resolvedIssues.add('calculate')
  const issue = issues.find(i => i.id === 'calculate')!
  setFeedback("Cost-share locked at $150. Now move the dispute upstream.", 'good')
  state.lastRecap = issue.recap
}

function pickDispute(id: string) {
  const opt = disputeOptions.find(o => o.id === id)
  if (!opt) return
  if (opt.support !== 'correct') {
    state.failedAttempts += 1
    state.disputeFeedback = { id, message: opt.feedback }
    return
  }
  state.disputeOpen = false
  state.disputeFeedback = null
  state.resolvedIssues.add('dispute')
  const issue = issues.find(i => i.id === 'dispute')!
  setFeedback("Patient statement voided. IDR initiated with RAE. Lou is out of the loop.", 'good')
  state.lastRecap = issue.recap
}

function attemptSubmit() {
  if (state.resolvedIssues.size < issues.length) return
  state.packetSubmitted = true
  notifyParentVictory('surprise-bill')
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  state.classifyOpen = false
  state.classifyFeedback = null
  state.calculateOpen = false
  state.calculateFeedback = null
  state.disputeOpen = false
  state.disputeFeedback = null
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
function openClassify() { state.classifyOpen = true; state.classifyFeedback = null }
function closeClassify() { state.classifyOpen = false; state.classifyFeedback = null }
function openCalculate() { state.calculateOpen = true; state.calculateFeedback = null }
function closeCalculate() { state.calculateOpen = false; state.calculateFeedback = null }
function openDispute() { state.disputeOpen = true; state.disputeFeedback = null }
function closeDispute() { state.disputeOpen = false; state.disputeFeedback = null }
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
    closeClassify(); closeCalculate(); closeDispute(); rerender(); return
  }
  const el = target.closest('[data-action]') as HTMLElement | null
  if (!el) return
  const action = el.dataset.action
  switch (action) {
    case 'open-classify': openClassify(); break
    case 'close-classify': closeClassify(); break
    case 'pick-classify': if (el.dataset.id) pickClassify(el.dataset.id); break
    case 'open-calculate': openCalculate(); break
    case 'close-calculate': closeCalculate(); break
    case 'pick-calculate': if (el.dataset.id) pickCalculate(el.dataset.id); break
    case 'open-dispute': openDispute(); break
    case 'close-dispute': closeDispute(); break
    case 'pick-dispute': if (el.dataset.id) pickDispute(el.dataset.id); break
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
  .good { color: var(--good); font-weight: 600; }
  .bad { color: var(--bad); font-weight: 600; }

  /* Bill stack — two side-by-side cards (paid + disputed). */
  .bill-stack { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .bs-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 14px; }
  .bs-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .bs-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .bs-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  @media (max-width: 880px) { .bs-row { grid-template-columns: 1fr; } }
  .bs-card { background: var(--panel-2); border-radius: 6px; padding: 12px 14px; border: 1px solid #2a3142; transition: border-color 0.3s; }
  .bs-card.paid { border-color: #2c5547; background: rgba(126, 226, 193, 0.04); }
  .bs-card.disputed { border-color: var(--bad); background: rgba(239, 91, 123, 0.04); }
  .bs-card-h { display: flex; flex-direction: column; gap: 4px; padding-bottom: 10px; margin-bottom: 10px; border-bottom: 1px dashed #2a3142; }
  .bs-card-from { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; color: var(--ink); }
  .bs-card-status { font-size: 10.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 8px; border-radius: 3px; align-self: flex-start; }
  .bs-card-status.paid { background: rgba(126, 226, 193, 0.12); color: var(--good); border: 1px solid #2c5547; }
  .bs-card-status.disputed { background: rgba(239, 91, 123, 0.12); color: var(--bad); border: 1px solid #4a2a32; }
  .bs-card-body { display: flex; flex-direction: column; gap: 5px; font-size: 12.5px; }
  .bs-line { display: grid; grid-template-columns: 130px 1fr; gap: 8px; }
  .bs-line span:first-child { color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; font-size: 10.5px; font-weight: 700; }
  .bs-line span.mono { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .bs-card-note { margin-top: 8px; padding-top: 8px; border-top: 1px dashed #2a3142; font-size: 11.5px; color: var(--ink-dim); font-style: italic; line-height: 1.5; }

  /* Three sequential action tiles. */
  .actions { background: var(--panel); border: 1px solid #232a36; border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .action-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  @media (max-width: 880px) { .action-row { grid-template-columns: 1fr; } }
  .action-tile { background: var(--panel-2); padding: 14px 16px; border-radius: 6px; border-left: 3px solid #2a3142; transition: border-color 0.3s, background 0.3s, opacity 0.3s; min-height: 140px; display: flex; flex-direction: column; }
  .action-tile.idle { opacity: 0.55; }
  .action-tile.active { border-left-color: var(--accent); }
  .action-tile.done { border-left-color: var(--good); background: rgba(126, 226, 193, 0.04); }
  .at-h { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
  .at-num { background: var(--panel); color: var(--ink-dim); width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; border: 1px solid #2a3142; font-family: ui-monospace, monospace; }
  .action-tile.active .at-num { color: var(--accent); border-color: var(--accent); }
  .action-tile.done .at-num { color: var(--good); border-color: var(--good); background: rgba(126, 226, 193, 0.1); }
  .at-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink-dim); }
  .action-tile.active .at-tag { color: var(--accent); }
  .action-tile.done .at-tag { color: var(--good); }
  .at-prose { font-size: 13px; color: var(--ink); line-height: 1.5; flex: 1; margin: 0 0 10px; }

  /* Surprise-bill modal sizing — readable but not too wide. */
  .sb-modal { max-width: 720px; }
  .amend-option-detail { margin-top: 4px; font-size: 12px; color: var(--ink-dim); padding-left: 0; line-height: 1.45; }

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
      if (state.classifyOpen) { closeClassify(); changed = true }
      if (state.calculateOpen) { closeCalculate(); changed = true }
      if (state.disputeOpen) { closeDispute(); changed = true }
      if (changed) rerender()
    }
  })
}

mount()
