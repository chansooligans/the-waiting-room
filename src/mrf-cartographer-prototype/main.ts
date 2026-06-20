// MRF Cartographer @ L8 — pricing-transparency Case.
//
// First Case where the deliverable is a regulatory file, not a
// claim packet. Mercy's machine-readable file (MRF) is due for
// refresh under the Hospital Price Transparency rule; the player
// sits with the chargemaster open in one window and twelve months
// of claims open in another, and assembles the MRF row by row.
//
// === Update — May 2026 ===
// Earlier draft conflated "hard-coded" / "soft-coded" with rate
// stability. The terms have specific RCM meanings (see Chemo
// Bundle Specter @ #200) — they describe *who assigns the CPT*,
// not whether the rate is stable. This version teaches both
// axes properly:
//
//   1. CODING — hard-coded (CDM auto-assigns CPT/HCPCS at charge
//      drop; most outpatient ancillaries) vs soft-coded (HIM coder
//      reviews the chart and assigns codes manually after the
//      encounter; most inpatient stays + complex procedures).
//      This is *who* codes the service.
//
//   2. RATE SOURCE — CDM/fee schedule (when payer rates are
//      stable across the contracted population) vs claim history
//      (when per-payer rates vary enough that the published
//      number has to come from observed adjudications). This is
//      *where* the published rate comes from.
//
// The two axes are correlated but independent. A service can be
// hard-coded with a stable rate (X-ray), hard-coded with a
// variable rate (CMP lab, IV saline), or soft-coded with a stable
// rate (DRG case rate — the contract sets one number per DRG once
// HIM assigns the grouping).
//
// Action set:
//   - 4 services; mark each hard-coded or soft-coded.
//   - 4 services; pick CDM or claim history per service.
//   - For claim-priced services, pick the right publication
//     structure (per-payer-discrete + de-identified min/max
//     per 45 CFR 180.50).
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

// ===== Domain types =====

type CodingMode = 'hard' | 'soft'
type RateSource = 'cdm' | 'claims'

interface ClaimSample {
  payer: string
  rate: number
  count: number
}

interface Service {
  id: string
  /** CPT/HCPCS/DRG/CDM code. */
  code: string
  /** Plain-English service description. */
  label: string
  /** Hint about how the service is coded + priced (shown on row). */
  shape: string
  /** True coding mode (hard = CDM auto-assigns; soft = HIM reviews). */
  coding: CodingMode
  /** Why the coding mode is what it is — shown after correct classify. */
  codingReason: string
  /** True MRF rate source (CDM or claim history). */
  rateSource: RateSource
  /** Why this rate source is correct — shown after correct source pick. */
  sourceReason: string
  /** Chargemaster gross charge (always present). */
  cdmCharge: number
  /** 12-month claim sample. Only meaningful for claim-priced services. */
  claims: ClaimSample[]
  /** The correct rate to publish on the MRF. */
  correctRate: number
}

interface AggregationOption {
  id: string
  label: string
  amount: number
  correct: boolean
  feedback: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'classify' | 'source' | 'aggregate'
}

interface GlossaryEntry { term: string; plain: string }

// ===== Encounter data =====

const services: Service[] = [
  {
    id: 'xray-skull',
    code: '70250',
    label: 'X-ray, skull, complete (4+ views)',
    shape: 'Imaging — CDM auto-assigns; rates stable across payers.',
    coding: 'hard',
    codingReason: "Hard-coded. The CDM drops 70250 + Rev 0320 every time radiology orders the study; no human reviews the code per encounter. Standard outpatient ancillary.",
    rateSource: 'cdm',
    sourceReason: "CDM is the source of truth. Imaging studies typically have payer variance under the MRF rounding floor — every payer pays close to the same number. CDM-pull is correct AND simple here.",
    cdmCharge: 185,
    claims: [],
    correctRate: 185,
  },
  {
    id: 'cmp-lab',
    code: '80053',
    label: 'Comprehensive metabolic panel',
    shape: 'Lab — CDM auto-assigns; per-payer rates vary widely.',
    coding: 'hard',
    codingReason: "Hard-coded. CDM drops 80053 + Rev 0301 every time the lab runs a CMP order. The coder doesn't review each panel; the chargemaster handles it. Standard outpatient ancillary, same as imaging.",
    rateSource: 'claims',
    sourceReason: "Hard-coded BUT claim-priced. CDM says $48; payers actually pay $8-22. Hard-coding gives you a reliable code, not a reliable rate. The MRF requires per-payer negotiated rates — pull them from claim history, not CDM.",
    cdmCharge: 48,
    claims: [
      { payer: 'Anthem PPO',    rate: 16, count: 142 },
      { payer: 'BCBS HMO',      rate: 14, count: 88  },
      { payer: 'Aetna',         rate: 18, count: 76  },
      { payer: 'UHC',           rate: 22, count: 64  },
      { payer: 'Cigna',         rate: 20, count: 52  },
      { payer: 'Medicare Adv',  rate: 12, count: 41  },
      { payer: 'Medicaid MCO',  rate: 8,  count: 29  },
    ],
    correctRate: 16,  // median per-payer rate
  },
  {
    id: 'drg-470',
    code: 'DRG 470',
    label: 'Major joint replacement, lower extremity, no MCC',
    shape: 'Inpatient stay — HIM reviews chart + assigns DRG.',
    coding: 'soft',
    codingReason: "Soft-coded. The DRG isn't on a charge entry — a HIM coder reviews the chart after discharge, codes principal + secondary diagnoses + procedures, and runs the grouper to assign the DRG. Manual review per encounter is the soft-coding signature.",
    rateSource: 'cdm',
    sourceReason: "Soft-coded BUT CDM-priced (in the contract sense). Once HIM assigns DRG 470, the case rate is contractually fixed per payer per DRG — the MRF rate comes from the fee-schedule appendix, not from claim variance. Soft-coding doesn't automatically mean claim-priced.",
    cdmCharge: 14_000,
    claims: [],
    correctRate: 14_000,
  },
  {
    id: 'iv-saline',
    code: 'J7030',
    label: 'Saline infusion solution, 1000mL (per dose)',
    shape: 'Drug/supply — CDM auto-assigns; per-payer rates wander.',
    coding: 'hard',
    codingReason: "Hard-coded. CDM drops J7030 every time pharmacy administers a 1000mL saline bag. Standard outpatient supply line; no chart review per dose.",
    rateSource: 'claims',
    sourceReason: "Hard-coded AND claim-priced. CDM says $32; payers pay $4-8. Same shape as the CMP lab — the chargemaster gets you the code, but the rate has to come from observed adjudications because per-payer pricing on supplies wanders.",
    cdmCharge: 32,
    claims: [
      { payer: 'Anthem PPO',    rate: 6, count: 220 },
      { payer: 'BCBS HMO',      rate: 5, count: 150 },
      { payer: 'Aetna',         rate: 7, count: 110 },
      { payer: 'UHC',           rate: 8, count: 95  },
      { payer: 'Medicare Adv',  rate: 4, count: 80  },
    ],
    correctRate: 6,  // median per-payer rate
  },
]

// Aggregation options — same as before; player makes one pick that
// applies across all claim-priced services.
// MRF schema (45 CFR 180.50) requires per-payer-per-plan negotiated
// rates as DISCRETE rows/columns, plus a de-identified min/max
// computed across all payers. There's no single aggregation
// statistic in the spec. The decoys here are common rookie
// mistakes: collapsing per-payer rates into a single average,
// publishing CDM, etc.
const aggregations: AggregationOption[] = [
  {
    id: 'cdm-charge',
    label: 'Publish CDM gross charge as the negotiated rate',
    amount: 48,
    correct: false,
    feedback: 'CDM is the rack rate, not the negotiated rate. Publishing CDM as the negotiated rate misrepresents the contract — the MRF requires the actual payer-specific rates. This is exactly what got Mercy flagged in the first place.',
  },
  {
    id: 'single-mean',
    label: 'Collapse to one negotiated-rate column = mean across payers',
    amount: 16.0,
    correct: false,
    feedback: 'MRF schema requires per-payer-per-plan rates as DISCRETE columns/rows — one rate per payer-plan, not one rate across all. Collapsing to a single mean fails the schema validator and misrepresents what each payer actually pays.',
  },
  {
    id: 'single-median',
    label: 'Collapse to one negotiated-rate column = median across payers',
    amount: 16,
    correct: false,
    feedback: 'Median is a fine summary statistic for internal analytics but not for the MRF. CMS requires per-payer-per-plan rates discretely. A single median collapses the per-payer detail the file is supposed to publish.',
  },
  {
    id: 'max-only',
    label: 'Publish only de-identified max',
    amount: 22,
    correct: false,
    feedback: "Min/max alone aren't sufficient. The MRF schema requires per-payer-per-plan rates DISCRETELY *plus* the de-identified min and max as separate fields. You need both layers.",
  },
  {
    id: 'discrete-plus-minmax',
    label: 'Discrete per-payer-plan rates ($16 Anthem, $14 BCBS, $18 Aetna…) + de-identified min/max ($8 / $22) across all',
    amount: 0, // not a single number; the structure is the answer
    correct: true,
    feedback: 'Right schema. The MRF (45 CFR 180.50) requires per-payer-per-plan negotiated rates as discrete fields, plus de-identified min ($8) and max ($22) calculated across all payers. No single aggregation collapses the detail. Lock this structure across all claim-priced rows; the schema validator passes.',
  },
]

const issues: Issue[] = [
  {
    id: 'classify',
    label: 'Classify each service hard-coded (CDM auto-assigns CPT) or soft-coded (HIM reviews chart).',
    recap: `You sorted four services by coding mode. Three are hard-coded (X-ray, CMP lab, IV saline — outpatient ancillaries the CDM auto-assigns at charge drop). One is soft-coded (DRG 470 — HIM coder reviews chart, codes diagnoses + procedures, runs grouper). Soft-coding is rare in any given encounter; most volume is hard-coded. Coding mode is one axis; rate source is a *separate* axis.`,
    verb: 'classify',
  },
  {
    id: 'source',
    label: 'Source: pick CDM/fee schedule or claim history per service.',
    recap: `Two services pull from CDM (X-ray's stable rate; DRG's contractually fixed case rate). Two pull from claim history (CMP lab and IV saline — both hard-coded but with per-payer rate variance). Coding mode and rate source aren't the same axis: hard-coded services can be claim-priced, soft-coded services can be CDM-priced.`,
    verb: 'source',
  },
  {
    id: 'aggregate',
    label: 'Aggregate: for claim-priced services, publish per-payer-discrete rates + de-identified min/max.',
    recap: `Per-payer-per-plan rates published discretely (one row per payer): $16 Anthem, $14 BCBS, $18 Aetna, $22 UHC, $20 Cigna, $12 Medicare Adv, $8 Medicaid MCO. De-identified min ($8) and max ($22) computed across all payers. Schema-correct per 45 CFR 180.50.`,
    verb: 'aggregate',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'MRF': {
    term: 'MRF (Machine-Readable File)',
    plain: "Standardized file every hospital must publish under the federal Hospital Price Transparency rule (45 CFR 180.50). One row per service per payer per plan, listing gross charge, discounted-cash price, payer-specific negotiated rates, and de-identified min/max. Updated at least monthly. CMS audits compliance; recent fines have hit seven figures per hospital.",
  },
  'CDM': {
    term: 'CDM (Chargemaster)',
    plain: "Hospital master price list and code-mapping table. For hard-coded services, the CDM auto-assigns CPT/HCPCS + revenue code + gross charge at the moment a charge drops. For soft-coded services, the CDM doesn't drive coding — HIM does — but it still carries the gross charge per service. The CDM is half source-of-truth (for codes + rack rates) and half configuration table (for billing rules).",
  },
  'hard-coded': {
    term: 'Hard-coded service (chargemaster-side meaning)',
    plain: "A service whose CPT/HCPCS code is auto-assigned by the chargemaster when the charge drops — no per-encounter human review. Most outpatient ancillaries (lab, radiology, pharmacy, supplies) are hard-coded because their service-to-code mapping is stable. Hard-coding is about *who codes*, not whether the rate is stable. NOTE: this is a different concept than 'CDM-priced MRF rate' below — same term, different layer. See Chemo Bundle Specter (PR #200) for the chargemaster-rule-update version of this concept.",
  },
  'soft-coded': {
    term: 'Soft-coded service (chargemaster-side meaning)',
    plain: "A service whose codes are assigned by a HIM (Health Information Management) coder after the encounter, reviewing the chart manually. Used for inpatient stays (DRG assignment), complex outpatient surgeries, and any encounter where the codes can't be reliably auto-derived from the charge entry. Slower and more expensive than hard-coding; necessary when documentation drives coding rather than the other way around. Distinct from rate source — soft-coded services often have stable rates (case rates per DRG).",
  },
  'rate source': {
    term: 'MRF rate source (CDM vs claim history)',
    plain: "Where a published MRF rate comes from. CDM-pull works when the contract sets a stable rate per service per payer (most fixed-fee schedules, DRG case rates, inpatient per-diems). Claim-history-pull is required when per-payer rates vary enough that no single posted number is honest — most lab panels, supplies, and pharmacy lines, even though they're hard-coded on the chargemaster side. The rate-source decision is *separate* from the hard/soft coding decision.",
  },
  'two meanings of hard-coding': {
    term: 'Two meanings of "hard-coded" in this catalog',
    plain: "(a) HARD-CODED SERVICE = chargemaster auto-assigns the CPT/HCPCS at charge drop (Cancer Center chemo session, X-ray, CMP lab — most outpatient ancillaries). The opposite is SOFT-CODED SERVICE (HIM coder reviews the chart after discharge — most inpatient stays). (b) HARD-CODED MRF RATE = the published MRF rate comes straight from the chargemaster / fee schedule because it's stable per payer (X-ray, DRG case rate). The opposite is CLAIM-PRICED MRF RATE (rate has to come from claim history because per-payer prices vary — CMP, IV saline). The two axes are CORRELATED but INDEPENDENT — hard-coded services can be claim-priced (CMP); soft-coded services can be CDM-priced (DRG case rate). Don't conflate them.",
  },
  'MRF schema': {
    term: 'MRF schema fields (45 CFR 180.50)',
    plain: "Per-row fields the MRF must publish: gross charge, discounted cash price, per-payer-per-plan negotiated rate (one row/column per payer-plan pair), de-identified min negotiated rate (across all payers), and de-identified max negotiated rate (across all payers). There's no single 'aggregated' rate; the per-payer detail is required as discrete fields. CMS audits this schema against published files.",
  },
  'CMS': {
    term: 'CMS (Centers for Medicare & Medicaid Services)',
    plain: "Federal agency that runs Medicare and oversees Medicaid. Issues the rules every hospital + payer follows: the MRF schema, NCCI edits, OPPS/IPPS payment systems, the CARC/RARC list. When CMS publishes a rule, hospitals comply or face penalties.",
  },
  'price transparency': {
    term: 'Hospital price transparency',
    plain: "Federal rule (effective 2021, sharpened 2024) requiring hospitals to publish a machine-readable file of standard charges plus a consumer-friendly display of 300 shoppable services. The intent: let patients compare prices. The reality: most files are inconsistently formatted; most patients don't read them. Compliance is the floor.",
  },
  'de-identified min/max': {
    term: 'De-identified min/max negotiated rate',
    plain: "Two MRF fields (per 45 CFR 180.50) that report the lowest and highest negotiated rates for a service across ALL payer-plans, without naming the payers. Calculated alongside the discrete per-payer-plan rates; both layers are required. The de-identification serves patients shopping a service at multiple facilities — they can compare ranges without each hospital revealing each payer's specific rate.",
  },
  'HIM': {
    term: 'HIM (Health Information Management)',
    plain: "Hospital department that owns medical records + post-discharge coding. HIM coders are the humans who do soft-coding — review the chart, assign ICD-10 / CPT / HCPCS, run the DRG grouper for inpatient stays. Distinct from the billing/AR side; both are downstream of HIM's coding output.",
  },
  'DRG grouper': {
    term: 'DRG grouper',
    plain: "Software that takes a coded inpatient encounter (principal diagnosis, secondary diagnoses, procedures, discharge status) and outputs one MS-DRG. The grouper is deterministic; the codes that feed it come from soft-coding. Once the DRG is set, the contracted case rate per payer applies — that's why soft-coded services can still be CDM-priced for MRF purposes.",
  },
}

// ===== Runtime state =====

interface ServiceState {
  /** Player's hard/soft classification — null if not yet set. */
  coding: CodingMode | null
  /** Player's CDM/claims source pick — null if not yet set. */
  rateSource: RateSource | null
}

const state = {
  briefingDone: false,
  briefingOpen: false,
  serviceStates: services.reduce((m, s) => { m[s.id] = { coding: null, rateSource: null }; return m }, {} as Record<string, ServiceState>),
  /** Service the player is inspecting for the aggregation panel. */
  inspectingId: null as string | null,
  /** The aggregation method the player picked; locks once set. */
  appliedAggregationId: null as string | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isClassifyDone(): boolean {
  return services.every(s => state.serviceStates[s.id].coding === s.coding)
}
function isSourceDone(): boolean {
  if (!isClassifyDone()) return false
  return services.every(s => state.serviceStates[s.id].rateSource === s.rateSource)
}
function isAggregateDone(): boolean {
  if (!isSourceDone()) return false
  const f = aggregations.find(a => a.id === state.appliedAggregationId)
  return !!f && f.correct
}
function claimPricedServices(): Service[] {
  return services.filter(s => s.rateSource === 'claims')
}

// ===== Render helpers =====

function term(termId: string, displayText?: string): string {
  const entry = glossary[termId]
  const text = displayText ?? termId
  if (!entry) return escape(text)
  return `<span class="term" data-action="open-term" data-term="${termId}" title="${escape(entry.plain)}">${escape(text)}<span class="term-icon">?</span></span>`
}

function money(n: number): string {
  return '$' + Math.round(n).toLocaleString()
}

function render(): string {
  if (state.packetSubmitted) {
    return renderHeader() + renderVictory() + renderTermPopover() + renderBriefingPopover()
  }
  return `
    ${renderHeader()}
    ${renderHospitalIntro()}
    ${!state.briefingDone ? renderBriefingInline() : `
      ${renderClassifyPanel()}
      ${renderSourcePanel()}
      ${renderAggregatePanel()}
      ${renderInspector()}
      ${renderPublishPanel()}
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
        <h1>MRF Cartographer <span class="muted">@ L8 — first sketch (revised)</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./prototypes.html">← back to catalog</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          A pricing-transparency Case. Mercy's
          ${term('MRF')} refresh is due in seven days. Two axes
          at once: classify each service ${term('hard-coded')} (CDM
          auto-assigns) or ${term('soft-coded')} (HIM reviews chart),
          then *separately* pick the ${term('rate source')} —
          CDM/fee-schedule or claim history. The axes are
          correlated but distinct. See the
          <a href="#design-notes">design notes</a>.
        </p>
      `}
    </header>
  `
}

function renderHospitalIntro(): string {
  return `
    <section class="hospital-intro">
      <div class="register hospital">HOSPITAL · early morning</div>
      <p>
        Theo from compliance leans on your desk with a printed
        ${term('CMS')} notice. "${term('price transparency')} audit. Our
        ${term('MRF')} is stale. Four service rows came back flagged.
        Refresh them by Friday or we eat a fine."
      </p>
      <p>
        Behind him on a second monitor: the ${term('CDM')} on the left, the
        12-month claims warehouse on the right. "Two questions per row.
        First — is the service ${term('hard-coded', 'hard')} or
        ${term('soft-coded', 'soft')} on the chargemaster side? Second —
        for the published rate, do we pull from CDM or from claims?
        Don't conflate them; that\'s how this got flagged."
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The CDM and the claims
        slide a half-pixel left, then settle. Four services sit in
        a queue, each waiting for two answers.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'Two axes. Don\'t conflate them.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "${term('MRF')} day. The deliverable is a regulatory
        file — CMS reads it, patients read it (some), plaintiffs'
        attorneys definitely do. We have to publish per-payer
        rates that match what payers actually pay, not what the
        ${term('CDM')} pretends they do."
      </p>
      <p>
        "Important update from the
        <a href="./chemo-bundle-specter-prototype.html">Chemo Bundle Specter</a>
        work — the terms ${term('hard-coded')} and ${term('soft-coded')}
        are about *who assigns the CPT*, not whether the rate is
        stable. Don't conflate them. Hard-coded services can have
        wildly variable rates (CMP lab, IV saline). Soft-coded
        services can have rock-stable rates (DRG case rates).
        Two axes."
      </p>
      <p>"Three issues:"</p>
      <ul>
        <li>
          For each of 4 services, mark
          ${term('hard-coded')} (CDM auto-drops the code at charge
          time — most outpatient ancillaries) or ${term('soft-coded')}
          (HIM coder reviews the chart and runs the
          ${term('DRG grouper')} after discharge — most inpatient
          stays + complex cases).
        </li>
        <li>
          *Separately* pick the
          ${term('rate source')} — CDM/fee-schedule (rates stable
          per payer) or claim history (rates wander per payer).
          Hard-coded services can be either; soft-coded services
          can be either. The axes correlate; they aren't identical.
        </li>
        <li>
          For claim-sourced rows, pick
          the right ${term('MRF schema', 'MRF publication structure')}.
          The CMS spec wants per-payer-per-plan rates as DISCRETE
          fields plus a de-identified min/max — not a single
          collapsed statistic. CDM, single mean, single median,
          max-only — all collapse the per-payer detail and fail the
          schema."
        </li>
      </ul>
      <p>
        "The sneaky part: most rookies think 'soft-coded' = 'pull
        from claims' because soft-coding implies ambiguity. It
        doesn't. The DRG case rate is contractually fixed once
        ${term('HIM')} assigns the grouping; CDM-pull is right
        even though the service is soft-coded. Read both axes
        carefully."
      </p>
      <p class="briefing-sign">"It's in the JSON if the rule was followed. — D."</p>
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

function renderClassifyPanel(): string {
  const done = state.resolvedIssues.has('classify')
  return `
    <section class="classify-panel ${done ? 'done' : ''}">
      <div class="cp-h">
        <span class="cp-tag">AXIS 1 · CODING MODE · 4 services</span>
        <span class="cp-sub">${done
          ? 'Sorted. Three hard-coded (CDM auto-assigns CPT); one soft-coded (HIM reviews chart).'
          : `For each service, mark whether the chargemaster auto-assigns the CPT (${term('hard-coded')}) or whether ${term('HIM')} reviews the chart and assigns codes manually (${term('soft-coded')}).`}</span>
      </div>
      <table class="svc-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Service</th>
            <th>Pricing shape (hint)</th>
            <th class="right">CDM</th>
            <th>Coding mode</th>
          </tr>
        </thead>
        <tbody>
          ${services.map(s => renderClassifyRow(s)).join('')}
        </tbody>
      </table>
      ${state.transientFeedback && services.some(s => `coding-${s.id}` === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('classify') : ''}
    </section>
  `
}

function renderClassifyRow(s: Service): string {
  const ss = state.serviceStates[s.id]
  const decided = ss.coding !== null
  const correct = decided && ss.coding === s.coding
  return `
    <tr class="svc-row ${correct ? 'classified ' + ss.coding : ''}">
      <td><code>${escape(s.code)}</code></td>
      <td>${escape(s.label)}</td>
      <td class="muted-cell">${escape(s.shape)}</td>
      <td class="right">${money(s.cdmCharge)}</td>
      <td class="classify-cell">
        ${correct ? `
          <span class="kind-badge ${ss.coding}">${ss.coding === 'hard' ? 'HARD-CODED · CDM auto-assigns' : 'SOFT-CODED · HIM reviews'}</span>
          <button class="btn ghost small" data-action="reset-coding" data-id="${s.id}">↺ undo</button>
        ` : `
          <button class="btn small ghost" data-action="classify" data-id="${s.id}" data-coding="hard">Hard-coded</button>
          <button class="btn small ghost" data-action="classify" data-id="${s.id}" data-coding="soft">Soft-coded</button>
        `}
      </td>
    </tr>
  `
}

function renderSourcePanel(): string {
  const unlocked = state.resolvedIssues.has('classify')
  const done = state.resolvedIssues.has('source')
  if (!unlocked) {
    return `
      <section class="source-panel locked">
        <div class="sp-h">
          <span class="sp-tag idle">AXIS 2 · MRF RATE SOURCE</span>
          <span class="sp-sub">Locked until coding-mode classification is done.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="source-panel ${done ? 'done' : 'active'}">
      <div class="sp-h">
        <span class="sp-tag ${done ? 'done' : 'active'}">AXIS 2 · MRF RATE SOURCE · 4 services</span>
        <span class="sp-sub">${done
          ? 'Two pull from CDM (X-ray stable rate; DRG contractually fixed case rate). Two pull from claim history (CMP and IV saline — hard-coded but rate-variable).'
          : `For each service, pick the ${term('rate source')}. Hard-coded ≠ CDM-source; soft-coded ≠ claim-source. Read each row\'s rate behavior, not its coding mode.`}</span>
      </div>
      <table class="svc-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Service</th>
            <th>Coding mode</th>
            <th class="right">CDM</th>
            <th class="right">Claim sample</th>
            <th>Rate source</th>
          </tr>
        </thead>
        <tbody>
          ${services.map(s => renderSourceRow(s)).join('')}
        </tbody>
      </table>
      ${state.transientFeedback && services.some(s => `source-${s.id}` === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('source') : ''}
    </section>
  `
}

function renderSourceRow(s: Service): string {
  const ss = state.serviceStates[s.id]
  const decided = ss.rateSource !== null
  const correct = decided && ss.rateSource === s.rateSource
  const claimsBlurb = s.claims.length > 0
    ? `${s.claims.length} payers, $${Math.min(...s.claims.map(c => c.rate))}–$${Math.max(...s.claims.map(c => c.rate))}`
    : '(no variance)'
  return `
    <tr class="svc-row ${correct ? 'sourced ' + ss.rateSource : ''}">
      <td><code>${escape(s.code)}</code></td>
      <td>${escape(s.label)}</td>
      <td class="muted-cell"><span class="kind-badge-mini ${s.coding}">${s.coding === 'hard' ? 'HARD' : 'SOFT'}</span></td>
      <td class="right">${money(s.cdmCharge)}</td>
      <td class="right muted-cell">${claimsBlurb}</td>
      <td class="classify-cell">
        ${correct ? `
          <span class="src-badge ${ss.rateSource}">${ss.rateSource === 'cdm' ? 'CDM · pull fee schedule' : 'CLAIMS · pull median'}</span>
          <button class="btn ghost small" data-action="reset-source" data-id="${s.id}">↺ undo</button>
        ` : `
          <button class="btn small ghost" data-action="source" data-id="${s.id}" data-source="cdm">CDM</button>
          <button class="btn small ghost" data-action="source" data-id="${s.id}" data-source="claims">Claims</button>
        `}
      </td>
    </tr>
  `
}

function renderAggregatePanel(): string {
  const unlocked = state.resolvedIssues.has('source')
  const done = state.resolvedIssues.has('aggregate')
  if (!unlocked) {
    return `
      <section class="estimate-panel locked">
        <div class="ep-h">
          <span class="ep-tag idle">AGGREGATION METHOD</span>
          <span class="ep-sub">Locked until rate-source decisions are done.</span>
        </div>
      </section>
    `
  }
  if (state.appliedAggregationId === null) {
    return `
      <section class="estimate-panel active">
        <div class="ep-h">
          <span class="ep-tag active">AGGREGATION METHOD · 2 claim-priced rows</span>
          <span class="ep-sub">Both claim-priced services use the same statistic. Open one to see the claim history and pick.</span>
        </div>
        <div class="ep-soft-list">
          ${claimPricedServices().map(s => `
            <button class="soft-svc-card ${state.inspectingId === s.id ? 'inspecting' : ''}" data-action="inspect" data-id="${s.id}">
              <span class="ssc-code"><code>${escape(s.code)}</code></span>
              <span class="ssc-label">${escape(s.label)}</span>
              <span class="ssc-cta">${state.inspectingId === s.id ? 'Inspecting →' : 'Open claim history →'}</span>
            </button>
          `).join('')}
        </div>
      </section>
    `
  }
  return `
    <section class="estimate-panel done">
      <div class="ep-h">
        <span class="ep-tag done">AGGREGATION METHOD</span>
        <span class="ep-sub">Per-payer-discrete + de-identified min/max locked across claim-priced rows. CMP: per-payer rates published; min ${money(8)} / max ${money(22)}. IV saline: similar shape; min ${money(4)} / max ${money(8)}.</span>
      </div>
      ${renderRecap('aggregate')}
    </section>
  `
}

function renderInspector(): string {
  if (!state.resolvedIssues.has('source')) return ''
  if (state.appliedAggregationId !== null) return ''
  if (!state.inspectingId) return ''
  const s = services.find(x => x.id === state.inspectingId)
  if (!s || s.rateSource !== 'claims') return ''
  return `
    <section class="inspector-panel">
      <div class="ip-h">
        <span class="ip-tag">CLAIM HISTORY · ${escape(s.code)} — ${escape(s.label)}</span>
        <span class="ip-sub">12-month sample. CDM line says ${money(s.cdmCharge)}; payers actually paid the rates below.</span>
      </div>
      <table class="claim-history">
        <thead>
          <tr><th>Payer</th><th class="right">Negotiated rate</th><th class="right">Claim count (12 mo)</th></tr>
        </thead>
        <tbody>
          ${s.claims.map(c => `
            <tr>
              <td>${escape(c.payer)}</td>
              <td class="right">${money(c.rate)}</td>
              <td class="right">${c.count.toLocaleString()}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="ip-aggregations">
        <p class="ip-prompt">Pick the right MRF publication structure. Locks across all claim-priced rows.</p>
        <ul class="agg-list">
          ${aggregations.map(a => renderAggregation(a)).join('')}
        </ul>
        ${state.transientFeedback && aggregations.some(a => a.id === state.transientFeedback!.id)
          ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
          : ''}
      </div>
    </section>
  `
}

function renderAggregation(a: AggregationOption): string {
  return `
    <li class="agg">
      <button class="agg-btn" data-action="apply-aggregation" data-id="${a.id}">
        <span class="agg-label">${escape(a.label)}</span>
      </button>
    </li>
  `
}

function renderPublishPanel(): string {
  const ready = isAggregateDone()
  const done = state.resolvedIssues.has('aggregate') && state.packetSubmitted
  const cls = !ready ? 'idle' : (done ? 'done' : 'active')
  return `
    <section class="publish-panel ${cls}">
      <div class="pp-h">
        <span class="pp-tag">${done ? 'MRF PUBLISHED' : 'PREVIEW MRF BATCH'}</span>
        <span class="pp-sub">${done
          ? 'Four rows submitted. Schema validates. CMS deadline cleared.'
          : !ready
            ? 'Locked until both axes + aggregation are done.'
            : 'Hard-coded vs soft-coded on one axis; CDM-source vs claim-source on the other. Click publish.'}</span>
      </div>
      ${ready ? `
        <table class="mrf-preview">
          <thead>
            <tr>
              <th>Code</th>
              <th>Service</th>
              <th>Coding</th>
              <th>Source</th>
              <th class="right">Published rate</th>
            </tr>
          </thead>
          <tbody>
            ${services.map(s => `
              <tr>
                <td><code>${escape(s.code)}</code></td>
                <td>${escape(s.label)}</td>
                <td><span class="kind-badge-mini ${s.coding}">${s.coding === 'hard' ? 'HARD' : 'SOFT'}</span></td>
                <td>${s.rateSource === 'cdm' ? 'CDM · fee schedule' : 'Claim history · median'}</td>
                <td class="right">${money(s.correctRate)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      ` : ''}
    </section>
  `
}

function renderRecap(issueId: string): string {
  const issue = issues.find(i => i.id === issueId)
  if (!issue) return ''
  return `
    <div class="recap">
      <div class="recap-h">RECAP</div>
      <p>${escape(issue.recap)}</p>
    </div>
  `
}

function renderChecklist(): string {
  const allDone = issues.every(i => state.resolvedIssues.has(i.id))
  return `
    <section class="checklist">
      <div class="checklist-h">MRF DELIVERABLE · 3 issues to resolve</div>
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
      ${state.failedAttempts > 0 ? `<p class="fail-counter">Wrong picks so far: ${state.failedAttempts}.</p>` : ''}
      <button class="btn submit ${allDone ? '' : 'disabled'}" data-action="submit" ${allDone ? '' : 'disabled'}>
        Submit MRF batch · 4 rows
      </button>
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
        <div class="term-popover-h">
          <span class="term-popover-name">${escape(entry.term)}</span>
          <button class="term-popover-close" data-action="close-term" aria-label="Close">×</button>
        </div>
        <p>${escape(entry.plain)}</p>
      </div>
    </div>
  `
}

const RECAP: CaseRecap = CASE_RECAPS['mrf-cartographer']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">MRF PUBLISHED</div>
      <h2>Four rows shipped. CMS deadline cleared.</h2>
      <p>
        Each row carries two axes: coding mode (hard/soft) and rate
        source (CDM/claims). X-ray pulled from CDM. CMP pulled from
        claim history despite being hard-coded. DRG pulled from CDM
        despite being soft-coded. IV saline pulled from claim history.
        Schema validator returned clean.
      </p>
      <p class="muted">
        The trick wasn't the math — it was reading the two axes
        independently. Most ${term('MRF')} files are wrong because
        teams treat hard/soft coding and rate source as a single
        decision; they aren't. Yours isn't.
      </p>
      <div class="register hospital">HOSPITAL · later that morning</div>
      <p>
        Theo drops the CMS clearance letter on your desk. "Audit
        passes. Same drill next quarter — different rows, same
        two-axis logic." He slides you the next docket. "Aetna's GFE
        rules are next; same source-of-truth puzzle, different
        deliverable."
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
            <li><strong>Three new actions:</strong> classifying coding
            mode (hard vs soft), choosing rate source (CDM vs
            claims), and aggregating (per-payer-discrete + de-identified min/max per 45 CFR 180.50).</li>
            <li><strong>Two axes, not one.</strong> Hard/soft
            coding and CDM/claims source are correlated but
            independent. Hard-coded services can be claim-priced
            (CMP, IV saline). Soft-coded services can be CDM-priced
            (DRG case rate, contractually fixed once HIM assigns).</li>
            <li><strong>Coding mode is about *who*; rate source
            is about *where*.</strong> ${term('hard-coded', 'Hard-coding')}
            answers "who assigns the CPT" — the chargemaster, at
            charge drop, no human review. ${term('soft-coded', 'Soft-coding')}
            answers the same question with "the HIM coder, after
            discharge, reviewing the chart." Neither tells you
            where the published MRF rate comes from.</li>
            <li><strong>The deliverable is regulatory.</strong>
            CMS reads it. Patient experience is downstream of
            getting the published rates honest.</li>
          </ul>
        </div>
        <div>
          <h3>Sibling shape</h3>
          <ul>
            <li>Tightly paired with
            <a href="./chemo-bundle-specter-prototype.html">Chemo Bundle Specter</a>
            — that Case introduced the proper RCM definition of
            hard-coding (chargemaster auto-mapping that fails when
            contract bundling rules don't flow through). This
            Case extends it: classification + rate-source as
            separate axes for the MRF deliverable.</li>
            <li>Cousin to
            <a href="./gfe-oracle-prototype.html">GFE Oracle</a> —
            same source-of-truth muscle for a different
            deliverable (Good Faith Estimate to a self-pay
            patient).</li>
            <li>Cousin to
            <a href="./case-rate-specter-prototype.html">Case Rate Specter</a> —
            the contract-clause-as-lever theme.</li>
          </ul>
          <h3>What changed from v1</h3>
          <p style="font-size: 12.5px; color: var(--ink-dim); line-height: 1.55;">
            The earlier draft labeled rate-stable services
            "hard-coded" and rate-variable services "soft-coded."
            That conflated coding-mode with rate source. After the
            Chemo Bundle Specter work landed proper definitions,
            this Case was rewritten as two axes. The puzzle gained
            a step (classify + source instead of just classify),
            and the cross-cases (hard-coded + claim-priced;
            soft-coded + CDM-priced) became the actual teaching
            beat.
          </p>
        </div>
      </div>
      <p class="notes-cta">
        See the <a href="./prototypes.html">Case Prototypes catalog</a>
        for the full set.
      </p>
    </section>
  `
}

// ===== State mutations =====

function dismissBriefing() { state.briefingDone = true; state.briefingOpen = false }
function showBriefing() { state.briefingOpen = true }
function closeBriefing() { state.briefingOpen = false }
function openTerm(termId: string) { state.openTermId = termId }
function closeTerm() { state.openTermId = null }

function classifyCoding(id: string, coding: CodingMode) {
  const s = services.find(x => x.id === id)
  if (!s) return
  const ss = state.serviceStates[id]
  state.transientFeedback = null
  if (s.coding === coding) {
    ss.coding = coding
    state.transientFeedback = { id: `coding-${id}`, message: s.codingReason, kind: 'good' }
    if (isClassifyDone()) state.resolvedIssues.add('classify')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id: `coding-${id}`, message: s.codingReason, kind: 'bad' }
  }
}

function resetCoding(id: string) {
  const ss = state.serviceStates[id]
  if (!ss) return
  ss.coding = null
  ss.rateSource = null
  state.resolvedIssues.delete('classify')
  state.resolvedIssues.delete('source')
  state.resolvedIssues.delete('aggregate')
  state.transientFeedback = null
}

function pickSource(id: string, src: RateSource) {
  const s = services.find(x => x.id === id)
  if (!s) return
  const ss = state.serviceStates[id]
  state.transientFeedback = null
  if (s.rateSource === src) {
    ss.rateSource = src
    state.transientFeedback = { id: `source-${id}`, message: s.sourceReason, kind: 'good' }
    if (isSourceDone()) state.resolvedIssues.add('source')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id: `source-${id}`, message: s.sourceReason, kind: 'bad' }
  }
}

function resetSource(id: string) {
  const ss = state.serviceStates[id]
  if (!ss) return
  ss.rateSource = null
  state.resolvedIssues.delete('source')
  state.resolvedIssues.delete('aggregate')
  state.transientFeedback = null
}

function inspect(id: string) {
  state.inspectingId = state.inspectingId === id ? null : id
  state.transientFeedback = null
}

function applyAggregation(id: string) {
  const a = aggregations.find(x => x.id === id)
  if (!a) return
  state.transientFeedback = null
  if (a.correct) {
    state.appliedAggregationId = id
    state.resolvedIssues.add('aggregate')
    state.transientFeedback = { id, message: a.feedback, kind: 'good' }
    state.inspectingId = null
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: a.feedback, kind: 'bad' }
  }
}

function attemptSubmit() {
  if (issues.every(i => state.resolvedIssues.has(i.id))) {
    state.packetSubmitted = true
    notifyParentVictory('mrf-cartographer')
  }
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  for (const id in state.serviceStates) {
    state.serviceStates[id] = { coding: null, rateSource: null }
  }
  state.inspectingId = null
  state.appliedAggregationId = null
  state.transientFeedback = null
  state.resolvedIssues = new Set()
  state.failedAttempts = 0
  state.packetSubmitted = false
  state.openTermId = null
}

function handleClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.classList.contains('briefing-popover-backdrop')) {
    closeBriefing(); rerender(); return
  }
  if (target.classList.contains('term-popover-backdrop')) {
    closeTerm(); rerender(); return
  }
  const el = target.closest('[data-action]') as HTMLElement | null
  if (!el) return
  const action = el.dataset.action
  switch (action) {
    case 'classify':
      if (el.dataset.id && el.dataset.coding) classifyCoding(el.dataset.id, el.dataset.coding as CodingMode)
      break
    case 'reset-coding':
      if (el.dataset.id) resetCoding(el.dataset.id)
      break
    case 'source':
      if (el.dataset.id && el.dataset.source) pickSource(el.dataset.id, el.dataset.source as RateSource)
      break
    case 'reset-source':
      if (el.dataset.id) resetSource(el.dataset.id)
      break
    case 'inspect':
      if (el.dataset.id) inspect(el.dataset.id)
      break
    case 'apply-aggregation':
      if (el.dataset.id) applyAggregation(el.dataset.id)
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

// ===== Per-prototype CSS =====

const css = districtVars('billing') + BASE_CSS + `
  /* Classify panel — axis 1 (coding mode). Mint accent. */
  .classify-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .classify-panel.done { border-left-color: var(--good); }
  .cp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .cp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .cp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }

  /* Source panel — axis 2 (CDM vs claims). Lavender accent to visually distinguish. */
  .source-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid #c8b6e0; border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .source-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .source-panel.done { border-left-color: var(--good); }
  .sp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .sp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #c8b6e0; }
  .sp-tag.idle { color: var(--ink-dim); }
  .sp-tag.done { color: var(--good); }
  .sp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }

  .svc-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .svc-table th, .svc-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #232a36; vertical-align: middle; }
  .svc-table th { font-size: 10.5px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; }
  .svc-table th.right, .svc-table td.right { text-align: right; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .muted-cell { color: var(--ink-dim); font-size: 12px; }
  .svc-row.classified.hard td { background: rgba(126, 226, 193, 0.04); }
  .svc-row.classified.soft td { background: rgba(177, 139, 214, 0.04); }
  .svc-row.sourced.cdm td { background: rgba(126, 226, 193, 0.04); }
  .svc-row.sourced.claims td { background: rgba(240, 168, 104, 0.04); }
  .classify-cell { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .kind-badge { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; font-weight: 700; }
  .kind-badge.hard { background: rgba(126, 226, 193, 0.15); color: var(--good); border: 1px solid #2c5547; }
  .kind-badge.soft { background: rgba(177, 139, 214, 0.15); color: #c8b6e0; border: 1px solid #3a324a; }
  .kind-badge-mini { font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 3px; letter-spacing: 0.04em; }
  .kind-badge-mini.hard { background: rgba(126, 226, 193, 0.12); color: var(--good); border: 1px solid #2c5547; }
  .kind-badge-mini.soft { background: rgba(177, 139, 214, 0.12); color: #c8b6e0; border: 1px solid #3a324a; }
  .src-badge { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; font-weight: 700; }
  .src-badge.cdm { background: rgba(126, 226, 193, 0.15); color: var(--good); border: 1px solid #2c5547; }
  .src-badge.claims { background: rgba(240, 168, 104, 0.15); color: var(--accent-2); border: 1px solid #4a3a2a; }
  .btn.small { padding: 4px 10px; font-size: 11.5px; }

  /* Estimate panel — same shape as v1. */
  .estimate-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent-2); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .estimate-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .estimate-panel.done   { border-left-color: var(--good); }
  .ep-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .ep-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .ep-tag.idle { color: var(--ink-dim); }
  .ep-tag.active { color: var(--accent-2); }
  .ep-tag.done { color: var(--good); }
  .ep-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .ep-soft-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px; }
  .soft-svc-card { background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 12px 14px; text-align: left; display: flex; flex-direction: column; gap: 4px; font: inherit; transition: all 0.15s; }
  .soft-svc-card:hover, .soft-svc-card.inspecting { border-color: var(--accent-2); background: #232b3a; }
  .ssc-code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 12px; color: var(--accent-2); }
  .ssc-label { font-size: 13px; color: var(--ink); }
  .ssc-cta { font-size: 11px; color: var(--ink-dim); }

  /* Inspector panel */
  .inspector-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid #c8b6e0; border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .ip-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .ip-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: #c8b6e0; }
  .ip-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .claim-history { width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 14px; }
  .claim-history th, .claim-history td { text-align: left; padding: 6px 10px; border-bottom: 1px dashed #232a36; }
  .claim-history th { font-size: 10.5px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; }
  .claim-history th.right, .claim-history td.right { text-align: right; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .ip-prompt { font-size: 12px; color: var(--ink-dim); margin: 0 0 8px; font-style: italic; }
  .agg-list { list-style: none; padding-left: 0; margin: 0; }
  .agg { margin-bottom: 6px; }
  .agg-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 9px 14px; text-align: left; font: inherit; transition: all 0.15s; }
  .agg-btn:hover { border-color: #c8b6e0; background: #232b3a; }
  .agg-label { font-size: 13px; }

  /* Publish panel */
  .publish-panel { background: var(--panel); border: 1px solid #232a36; border-left-width: 4px; border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .publish-panel.idle   { border-left-color: #2a3142; opacity: 0.55; }
  .publish-panel.active { border-left-color: var(--accent-2); }
  .publish-panel.done   { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126, 226, 193, 0.04), transparent); }
  .pp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .pp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .publish-panel.idle   .pp-tag { color: var(--ink-dim); }
  .publish-panel.active .pp-tag { color: var(--accent-2); }
  .publish-panel.done   .pp-tag { color: var(--good); }
  .pp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .mrf-preview { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .mrf-preview th, .mrf-preview td { text-align: left; padding: 6px 10px; border-bottom: 1px dashed #232a36; }
  .mrf-preview th { font-size: 10.5px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; }
  .mrf-preview th.right, .mrf-preview td.right { text-align: right; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }

  /* Recap green */
  .recap { background: rgba(126, 226, 193, 0.06); border-color: #2c5547; }
  .recap-h { color: var(--good); }
`

// ===== Mount =====

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
      if (changed) rerender()
    }
  })
}

mount()
