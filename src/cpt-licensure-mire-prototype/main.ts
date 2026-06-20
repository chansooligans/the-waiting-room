// CPT Licensure Mire @ L6 — meta-Case on the AMA's CPT licensing
// system. First Case where the puzzle pushes against the system
// rather than working within it: the AMA holds the copyright on
// CPT codes, charges hospitals to use them, and CMS requires CPT
// on Medicare/Medicaid claims. The cost is real, the workaround
// (HCPCS Level II for Medicare-specific services) is partial,
// and the audit consequence is real.
//
// Action set:
//   - Source: 4 true/false statements about the CPT licensing
//     chain. Player has to know how the system actually works
//     before picking a fix.
//   - License: 4 license-tier options for Mercy's charity clinic
//     (5 coders, 1 EHR vendor, public-facing patient handouts).
//     One tier covers the actual use; others over- or under-fit.
//   - Alternative: 4 services on the audit list. For each, pick
//     "use CPT" or "use HCPCS Level II equivalent." Most CPT codes
//     have no HCPCS substitute; a small set of Medicare-specific
//     services do (G-codes, J-codes for drugs, K-codes for DME).
//
// Demonstrates: not every Case is solvable — sometimes the system
// is the problem and the best answer is a partial workaround.
// First Case where the design notes openly critique the structure.
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

// ===== Domain types =====

interface ChainStatement {
  id: string
  text: string
  truth: boolean
  reason: string
}

interface LicenseTier {
  id: string
  label: string
  summary: string
  fitsThisClinic: boolean
  feedback: string
}

interface ServiceCheck {
  id: string
  cptCode: string
  cptLabel: string
  /** Does HCPCS Level II have an equivalent code for this service? */
  hasHcpcsEquivalent: boolean
  hcpcsCode?: string
  /** Why HCPCS is or isn't a viable substitute. */
  reason: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'source' | 'license' | 'alternative'
}

interface GlossaryEntry {
  term: string
  plain: string
}

// ===== Encounter data =====

const CLINIC = 'Mercy Charity Clinic'
const CODER_COUNT = 5
const ANNUAL_LICENSE_COST_PER_USER = 110 // approximate AMA CPT Pro Edition end-user license

const chainStatements: ChainStatement[] = [
  {
    id: 's1',
    text: 'The AMA holds the copyright on CPT codes and charges providers to use them.',
    truth: true,
    reason: 'CPT (Current Procedural Terminology) is owned by the American Medical Association. Every commercial use — including submitting claims — requires a paid license. The fee structure has tiers (Pro Edition end-user, EHR vendor pass-through, distribution rights, public-facing rights).',
  },
  {
    id: 's2',
    text: 'CMS requires CPT codes on Medicare and Medicaid claims for outpatient services.',
    truth: true,
    reason: 'The HIPAA transaction standards adopted CPT as the required code set for physician services. Medicare\'s Outpatient Prospective Payment System and Medicaid claim formats rely on CPT. Providers cannot bill federal programs without using AMA-licensed codes.',
  },
  {
    id: 's3',
    text: 'HCPCS Level II is a free, government-maintained alternative that fully replaces CPT.',
    truth: false,
    reason: 'HCPCS Level II (G/J/K/Q codes) is published by CMS and free to use, but it covers a narrow band — Medicare-specific services, drugs, DME, ambulance. The 6,000+ CPT codes for physician services have no HCPCS equivalent. HCPCS supplements CPT; it doesn\'t replace it.',
  },
  {
    id: 's4',
    text: 'Using CPT codes on patient-facing handouts requires a separate, broader license than the claim-submission license.',
    truth: true,
    reason: 'AMA distinguishes "internal use" (claim submission, internal coding) from "publication / distribution rights" (patient handouts, marketing, public websites). Charity clinics often miss this when they include CPT codes in patient cost-estimate sheets — the basic Pro Edition license doesn\'t cover it.',
  },
]

const licenseTiers: LicenseTier[] = [
  {
    id: 'pro-end-user',
    label: 'Pro Edition End-User license × 5 coders + EHR Vendor Pass-Through + Distribution Rights add-on',
    summary: 'Per-user Pro Edition for each of the 5 charity-clinic coders, plus EHR vendor flow-through (covers EHR display), plus the distribution add-on (covers patient-facing handouts at the clinic). All three layers are required because the clinic uses CPT in three distinct contexts.',
    fitsThisClinic: true,
    feedback: 'Right tier. 5 Pro Edition seats × $' + ANNUAL_LICENSE_COST_PER_USER + ' = ' + (5 * ANNUAL_LICENSE_COST_PER_USER).toLocaleString() + ' annual baseline; the EHR pass-through is included in the vendor contract; the distribution add-on covers the patient handouts. Audit clears with the right paperwork on file.',
  },
  {
    id: 'pro-end-user-only',
    label: 'Pro Edition End-User license × 5 coders only',
    summary: 'Per-user Pro Edition for each coder. No EHR pass-through assertion, no distribution rights. Cheapest option.',
    fitsThisClinic: false,
    feedback: 'Under-licensed. The clinic uses CPT codes in patient handouts (distribution use) — basic Pro Edition only covers internal claim submission. Audit will flag the handouts as unlicensed use; the AMA has actively pursued non-profit clinics for this exact gap.',
  },
  {
    id: 'institutional',
    label: 'Institutional / Enterprise license — unlimited internal users at Mercy umbrella',
    summary: 'Single enterprise license covering all Mercy-affiliated clinics. Higher cost, but unlimited internal users and broader use rights.',
    fitsThisClinic: false,
    feedback: 'Over-licensed for a 5-coder charity clinic. The enterprise tier is built for hospital systems with dozens or hundreds of coders; paying that for 5 wastes budget and isn\'t what the AMA expects to see at this scale. Pro Edition + add-ons fits.',
  },
  {
    id: 'no-license',
    label: 'No license — argue charity-clinic exemption under "fair use"',
    summary: 'Don\'t pay; assert that submitting Medicare claims is government-mandated and therefore exempt.',
    fitsThisClinic: false,
    feedback: 'Not a real exemption. Federal courts have held the AMA\'s copyright on CPT, and the AMA has won enforcement actions against unlicensed use. There is no "compelled use" carve-out — even when a federal program requires the codes, the licensing fee still applies. This finding is the audit blowing up.',
  },
]

const serviceChecks: ServiceCheck[] = [
  {
    id: 'office-visit',
    cptCode: '99213',
    cptLabel: 'Office E&M, established patient, low-mod complexity',
    hasHcpcsEquivalent: false,
    reason: 'No HCPCS Level II equivalent. Office E&M visits have to use CPT — every code in the 99xxx Evaluation & Management family is CPT-only. License needed.',
  },
  {
    id: 'flu-admin',
    cptCode: '90471',
    cptLabel: 'Immunization administration, single vaccine',
    hasHcpcsEquivalent: true,
    hcpcsCode: 'G0008',
    reason: 'For Medicare patients, HCPCS G0008 (administration of influenza virus vaccine) is the Medicare-specific equivalent — and it\'s the code Medicare actually expects. Use HCPCS for Medicare; CPT 90471 is only required for non-Medicare payers who want it.',
  },
  {
    id: 'iv-pump',
    cptCode: '96365',
    cptLabel: 'IV infusion, initial up to 1 hour',
    hasHcpcsEquivalent: false,
    reason: 'CPT-only territory. Therapeutic IV infusion services in the 96xxx range have no HCPCS Level II equivalents. License needed.',
  },
  {
    id: 'dme-walker',
    cptCode: 'E0143',
    cptLabel: 'Walker, folding, wheeled, adjustable',
    hasHcpcsEquivalent: true,
    hcpcsCode: 'E0143',
    reason: 'Trick row — DME codes (E-codes) are HCPCS Level II already, not CPT. The clinic doesn\'t need a CPT license to bill walkers; this code was misfiled in the audit. Note: HCPCS Level II IS the right code, paid as HCPCS.',
  },
]

const issues: Issue[] = [
  {
    id: 'source',
    label: 'Source: walk the CPT licensing chain. 4 statements true/false.',
    recap: 'You walked the chain. AMA holds copyright; CMS requires CPT on most claims; HCPCS Level II covers a narrow band (drugs, DME, Medicare-specific services), not a full replacement; patient-facing use of CPT requires a broader license than internal claim submission.',
    verb: 'source',
  },
  {
    id: 'license',
    label: 'License: pick the right tier for the charity clinic.',
    recap: `Pro Edition × ${CODER_COUNT} coders + EHR vendor pass-through + distribution add-on. The clinic uses CPT in three distinct contexts (internal coding, EHR display, patient handouts) and each needs its own coverage. ${(CODER_COUNT * ANNUAL_LICENSE_COST_PER_USER).toLocaleString()} baseline + add-ons; audit clears.`,
    verb: 'license',
  },
  {
    id: 'alternative',
    label: 'Alternative: for each audit-list service, decide CPT or HCPCS Level II.',
    recap: 'Most rows had no HCPCS substitute (E&M visits, IV infusions). Two had Medicare-specific HCPCS equivalents (flu admin G0008, DME walker E0143 — already HCPCS). The HCPCS workaround is real but narrow.',
    verb: 'alternative',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'CPT': {
    term: 'CPT (Current Procedural Terminology)',
    plain: "Code set for physician and outpatient services. Owned by the American Medical Association — every code in the CPT manual is AMA copyright. Required by CMS for Medicare/Medicaid outpatient claims and adopted by every commercial payer. ~10,000 active codes split into Category I (mainstream), II (performance measurement), and III (emerging tech). Updated annually each January.",
  },
  'HCPCS': {
    term: 'HCPCS (Healthcare Common Procedure Coding System)',
    plain: "Two-level code set. Level I IS CPT (the AMA codes). Level II is the CMS-maintained companion — alphanumeric codes for items and services CPT doesn't cover: durable medical equipment (E-codes), drugs (J-codes), Medicare-specific physician services (G-codes), services pending CPT adoption (K-codes), and so on. Level II is free; Level I (CPT) requires an AMA license.",
  },
  'AMA': {
    term: 'AMA (American Medical Association)',
    plain: "Private, non-profit professional association of US physicians. Holds the copyright on CPT and licenses its use through tiered fee structures. CPT-related licensing is a substantial share of AMA's annual revenue (estimates range from ~35% to over 50% depending on what's counted; AMA's IRS Form 990 disaggregates differently than industry critique often does). The fact that a private association charges hospitals to use the codes a federal program requires is a long-standing critique of US healthcare administration; the exact revenue share is debated, the structural arrangement is not.",
  },
  'license tiers': {
    term: 'CPT license tiers',
    plain: "AMA segments use rights into tiers: Pro Edition (per-user, internal claim submission); Vendor / EHR pass-through (software vendor flows the license through to its hospital customers); Distribution Rights (publication, patient-facing); Multi-User Site Licenses; Enterprise. Different uses need different tiers; using CPT outside your tier is unlicensed use, which AMA has actively enforced.",
  },
  'HIPAA standard code sets': {
    term: 'HIPAA standard code sets',
    plain: "The HIPAA transaction rule (45 CFR 162) designated specific code sets as required for electronic claim submission: ICD-10-CM (diagnoses), ICD-10-PCS (inpatient procedures), CPT/HCPCS (outpatient procedures + services), CDT (dental), NDC (drugs), and HCPCS Level II (DME, supplies). HIPAA didn't make CPT free; it just made it required.",
  },
  'fair use': {
    term: 'Fair use (copyright law)',
    plain: "US copyright law's safety valve — limited unlicensed use of copyrighted material for commentary, criticism, education, etc. AMA's CPT licensing model has survived multiple fair-use challenges. Submitting Medicare claims using CPT is *commercial use*; courts have held it requires a license. There is no \"compelled use\" exemption when a federal program requires CPT.",
  },
  'compelled use': {
    term: 'Compelled use',
    plain: "The argument that when a government regulation requires a private code set, the code set should be free or its license fees should be capped. CPT is the standard textbook example: CMS requires its use, AMA charges for it, and providers have no real alternative for most services. Repeatedly raised in policy circles; never adopted into law.",
  },
}

// ===== Runtime state =====

interface StmtState { pick: boolean | null }
interface ServiceState { pick: 'cpt' | 'hcpcs' | null }

const state = {
  briefingDone: false,
  briefingOpen: false,
  stmtStates: chainStatements.reduce((m, s) => { m[s.id] = { pick: null }; return m }, {} as Record<string, StmtState>),
  appliedTierId: null as string | null,
  serviceStates: serviceChecks.reduce((m, s) => { m[s.id] = { pick: null }; return m }, {} as Record<string, ServiceState>),
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isSourceDone(): boolean {
  return chainStatements.every(s => state.stmtStates[s.id].pick === s.truth)
}
function isAlternativeDone(): boolean {
  return serviceChecks.every(s => {
    const ss = state.serviceStates[s.id]
    if (s.hasHcpcsEquivalent) return ss.pick === 'hcpcs'
    return ss.pick === 'cpt'
  })
}

// ===== Render =====

function term(termId: string, displayText?: string): string {
  const entry = glossary[termId]
  const text = displayText ?? termId
  if (!entry) return escape(text)
  return `<span class="term" data-action="open-term" data-term="${termId}" title="${escape(entry.plain)}">${escape(text)}<span class="term-icon">?</span></span>`
}

function render(): string {
  if (state.packetSubmitted) {
    return renderHeader() + renderVictory() + renderTermPopover() + renderBriefingPopover()
  }
  return `
    ${renderHeader()}
    ${renderHospitalIntro()}
    ${!state.briefingDone ? renderBriefingInline() : `
      ${renderSourcePanel()}
      ${renderLicensePanel()}
      ${renderAlternativePanel()}
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
        <h1>CPT Licensure Mire <span class="muted">@ L6 — first sketch (meta-Case)</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./prototypes.html">← back to catalog</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          A meta-Case. The ${escape(CLINIC)}'s ${term('CPT')} licensing
          came up in audit. The ${term('AMA')} holds the copyright;
          ${escape("CMS")} requires the codes; the clinic pays the AMA to
          use codes the federal program forces them to use. The puzzle
          works inside that system — pick the right ${term('license tiers', 'license tier')},
          surface ${term('HCPCS')} Level II alternatives where they
          exist. See the
          <a href="#design-notes">design notes</a>.
        </p>
      `}
    </header>
  `
}

function renderHospitalIntro(): string {
  return `
    <section class="hospital-intro">
      <div class="register hospital">HOSPITAL · charity clinic, this morning</div>
      <p>
        Theo from compliance brings the audit memo over. "${escape(CLINIC)}.
        ${term('AMA')} licensing audit ten days ago. Three findings: under-
        counted users on the ${term('CPT')} ${term('license tiers', 'Pro Edition seats')},
        used CPT codes in patient handouts without distribution rights,
        and ran some services on CPT that probably should have been
        ${term('HCPCS')} G-codes for the Medicare populations. Five-figure
        catch-up if we don't sort it before the next quarter."
      </p>
      <p>
        He drops the CPT manual, the Pro Edition price sheet, and the
        clinic's last 12 months of services on the desk. "The math is
        easy. The system is the problem. We work inside it anyway."
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The audit findings slide
        a half-pixel left, then settle. The licensing chain unfolds,
        statement by statement.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'A meta-Case. Read the design notes after.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "Different tone from the other Cases. The system is the
        dragon: ${term('AMA')} owns the codes, CMS requires the codes,
        the hospital pays the AMA, the patient never sees this part.
        It's been litigated. The licensing model survived. Our job is
        to comply correctly and use ${term('HCPCS')} where we legally can."
      </p>
      <p>
        "Three issues:"
      </p>
      <ul>
        <li>
          Four statements about how the
          licensing chain actually works. Mark each true/false.
          You can't pick a fix until you understand the structure.
        </li>
        <li>
          Four tier options. Only one
          covers all three contexts the clinic uses CPT in
          (internal coding, EHR display, patient handouts). Cheap
          option under-licenses; enterprise option over-buys; "no
          license" doesn't fly.
        </li>
        <li>
          Four services in the
          audit. For each, pick CPT or its HCPCS Level II
          equivalent. Most have no HCPCS substitute; a couple do
          (G-codes for Medicare-specific services, E-codes for DME).
          The workaround is narrow but real."
        </li>
      </ul>
      <p>
        "Don't try to argue ${term('fair use')} or
        ${term('compelled use')} — both have been tried, both have
        lost. The Mire is the situation; we get out of this audit by
        complying, not by litigating."
      </p>
      <p class="briefing-sign">"Licenses don't lapse. The reading does. — D."</p>
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

function renderSourcePanel(): string {
  const done = state.resolvedIssues.has('source')
  return `
    <section class="source-panel ${done ? 'done' : ''}">
      <div class="sp-h">
        <span class="sp-tag">LICENSING CHAIN · 4 statements</span>
        <span class="sp-sub">${done
          ? 'AMA owns CPT; CMS requires CPT; HCPCS supplements; distribution rights are separate.'
          : 'Mark each true/false. The chain explains why we\'re paying the AMA in the first place.'}</span>
      </div>
      <ul class="stmt-list">
        ${chainStatements.map(s => renderStmt(s)).join('')}
      </ul>
      ${state.transientFeedback && chainStatements.some(s => s.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('source') : ''}
    </section>
  `
}

function renderStmt(s: ChainStatement): string {
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

function renderLicensePanel(): string {
  const unlocked = state.resolvedIssues.has('source')
  const done = state.resolvedIssues.has('license')
  if (!unlocked) {
    return `
      <section class="license-panel locked">
        <div class="lp-h">
          <span class="lp-tag idle">LICENSE TIER</span>
          <span class="lp-sub">Locked until the chain is walked.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="license-panel ${done ? 'done' : 'active'}">
      <div class="lp-h">
        <span class="lp-tag ${done ? 'done' : 'active'}">LICENSE TIER · 4 options</span>
        <span class="lp-sub">${done
          ? `Pro Edition × ${CODER_COUNT} + EHR pass-through + distribution add-on. All three contexts covered.`
          : `${CODER_COUNT} coders. EHR + patient handouts in scope. Pick the tier that covers all three contexts.`}</span>
      </div>
      <ul class="tier-list">
        ${licenseTiers.map(t => renderTier(t)).join('')}
      </ul>
      ${state.transientFeedback && licenseTiers.some(t => t.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('license') : ''}
    </section>
  `
}

function renderTier(t: LicenseTier): string {
  const applied = state.appliedTierId === t.id
  const locked = state.appliedTierId !== null && !applied
  return `
    <li class="tier ${applied ? 'applied' : ''}">
      <button class="tier-btn" data-action="apply-tier" data-id="${t.id}" ${locked ? 'disabled' : ''}>
        <span class="tier-label">${escape(t.label)}</span>
        <span class="tier-summary">${escape(t.summary)}</span>
        ${applied ? '<span class="tier-badge applied">APPLIED</span>' : ''}
      </button>
    </li>
  `
}

function renderAlternativePanel(): string {
  const unlocked = state.resolvedIssues.has('license')
  const done = state.resolvedIssues.has('alternative')
  if (!unlocked) {
    return `
      <section class="alt-panel locked">
        <div class="ap-h">
          <span class="ap-tag idle">CPT vs HCPCS — PER SERVICE</span>
          <span class="ap-sub">Locked until the license tier is picked.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="alt-panel ${done ? 'done' : 'active'}">
      <div class="ap-h">
        <span class="ap-tag ${done ? 'done' : 'active'}">CPT vs HCPCS LEVEL II · 4 services</span>
        <span class="ap-sub">${done
          ? 'Two had no HCPCS substitute (E&M, IV); two did (G-code for flu admin, E-code DME — which is HCPCS Level II already).'
          : 'For each service, pick CPT (use the AMA-licensed code) or HCPCS Level II (use the free CMS-maintained equivalent).'}</span>
      </div>
      <ul class="svc-list">
        ${serviceChecks.map(s => renderServiceCheck(s)).join('')}
      </ul>
      ${state.transientFeedback && serviceChecks.some(s => s.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('alternative') : ''}
    </section>
  `
}

function renderServiceCheck(s: ServiceCheck): string {
  const ss = state.serviceStates[s.id]
  const correct = (s.hasHcpcsEquivalent && ss.pick === 'hcpcs') || (!s.hasHcpcsEquivalent && ss.pick === 'cpt')
  return `
    <li class="svc-check ${ss.pick && correct ? 'correct' : ''}">
      <div class="svc-meta">
        <code class="svc-cpt">${escape(s.cptCode)}</code>
        <span class="svc-label">${escape(s.cptLabel)}</span>
      </div>
      <div class="svc-actions">
        ${ss.pick && correct ? `
          <span class="svc-badge ${ss.pick}">${ss.pick === 'cpt' ? 'CPT (licensed)' : 'HCPCS ' + (s.hcpcsCode ?? 'Level II')}</span>
          <button class="btn small ghost" data-action="reset-svc" data-id="${s.id}">↺ undo</button>
        ` : `
          <button class="btn small ghost" data-action="pick-svc" data-id="${s.id}" data-pick="cpt">CPT</button>
          <button class="btn small ghost" data-action="pick-svc" data-id="${s.id}" data-pick="hcpcs">HCPCS Level II</button>
        `}
      </div>
    </li>
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
      <div class="checklist-h">AUDIT RESPONSE · 3 issues to resolve</div>
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
        File audit response
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

const RECAP: CaseRecap = CASE_RECAPS['cpt-licensure-mire']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">AUDIT RESPONSE FILED</div>
      <h2>${escape(CLINIC)}'s licensing chain is documented and compliant.</h2>
      <p>
        Pro Edition × ${CODER_COUNT} seats on file. EHR vendor pass-
        through asserted in the contract. Distribution-rights add-on
        purchased to cover patient handouts. Two services moved from
        CPT to ${term('HCPCS')} Level II equivalents (G0008 for flu
        admin; E0143 was already HCPCS and got reclassified in
        billing).
      </p>
      <p class="muted">
        The system is what it is. The ${term('AMA')} licenses codes
        the federal government requires, hospitals pay, the cost
        flows downstream. Walking out of this audit means complying
        with the structure rather than fighting it. That doesn't
        mean the structure is right.
      </p>
      <div class="register hospital">HOSPITAL · later that morning</div>
      <p>
        Theo files the response and sighs. "Renewal hits January 1.
        We'll do this dance again every year forever, or until
        someone in DC makes the AMA's license fees a public-good
        carve-out. Don't hold your breath."
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
            <li><strong>Three actions:</strong> source (walk
            the structure), license (pick a tier), alternative
            (find HCPCS substitutes where they exist).</li>
            <li><strong>The system IS the problem.</strong> First
            Case where the puzzle isn't a fix-it; it's
            "comply with a system that you can argue shouldn't
            exist this way." The Mire isn't winnable in the
            usual sense.</li>
            <li><strong>The HCPCS workaround is narrow.</strong>
            Only Medicare-specific services and DME have viable
            substitutes; the bulk of physician work has no
            alternative to CPT.</li>
            <li><strong>Decoy tiers are real options.</strong>
            Under-licensing is a real audit finding; over-
            licensing burns budget; "no license" is real
            litigation. None of them are winning moves.</li>
          </ul>
        </div>
        <div>
          <h3>The meta-critique</h3>
          <p style="font-size: 13px; line-height: 1.55; color: var(--ink-dim);">
            The AMA collects roughly half its annual revenue from
            CPT-related licensing. Hospitals pay because CMS
            requires CPT and there's no full alternative. This
            arrangement has been challenged on antitrust and
            ${term('compelled use')} grounds; it has held up. The
            ${term('AMA')} is also the lobby that pushed CPT into
            HIPAA's standard code-set list, locking in the
            requirement.
          </p>
          <p style="font-size: 13px; line-height: 1.55; color: var(--ink-dim);">
            This Case doesn't take a position on whether that's
            right. It just lays the structure flat so the player
            sees the shape before navigating it.
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

function pickStmt(id: string, pick: boolean) {
  const s = chainStatements.find(x => x.id === id)
  if (!s) return
  state.transientFeedback = null
  if (s.truth === pick) {
    state.stmtStates[id].pick = pick
    state.transientFeedback = { id, message: s.reason, kind: 'good' }
    if (isSourceDone()) state.resolvedIssues.add('source')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: s.reason, kind: 'bad' }
  }
}

function resetStmt(id: string) {
  state.stmtStates[id].pick = null
  state.resolvedIssues.delete('source')
  state.resolvedIssues.delete('license')
  state.resolvedIssues.delete('alternative')
  state.transientFeedback = null
}

function applyTier(id: string) {
  const t = licenseTiers.find(x => x.id === id)
  if (!t) return
  state.transientFeedback = null
  if (t.fitsThisClinic) {
    state.appliedTierId = id
    state.resolvedIssues.add('license')
    state.transientFeedback = { id, message: t.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: t.feedback, kind: 'bad' }
  }
}

function pickSvc(id: string, pick: 'cpt' | 'hcpcs') {
  const s = serviceChecks.find(x => x.id === id)
  if (!s) return
  state.transientFeedback = null
  const right = s.hasHcpcsEquivalent ? 'hcpcs' : 'cpt'
  if (pick === right) {
    state.serviceStates[id].pick = pick
    state.transientFeedback = { id, message: s.reason, kind: 'good' }
    if (isAlternativeDone()) state.resolvedIssues.add('alternative')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: s.reason, kind: 'bad' }
  }
}

function resetSvc(id: string) {
  state.serviceStates[id].pick = null
  state.resolvedIssues.delete('alternative')
  state.transientFeedback = null
}

function attemptSubmit() {
  if (issues.every(i => state.resolvedIssues.has(i.id))) {
    state.packetSubmitted = true
    notifyParentVictory('cpt-licensure-mire')
  }
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  for (const id in state.stmtStates) state.stmtStates[id] = { pick: null }
  for (const id in state.serviceStates) state.serviceStates[id] = { pick: null }
  state.appliedTierId = null
  state.transientFeedback = null
  state.resolvedIssues = new Set()
  state.failedAttempts = 0
  state.packetSubmitted = false
  state.openTermId = null
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
    case 'apply-tier': if (el.dataset.id) applyTier(el.dataset.id); break
    case 'pick-svc': if (el.dataset.id && el.dataset.pick) pickSvc(el.dataset.id, el.dataset.pick as 'cpt' | 'hcpcs'); break
    case 'reset-svc': if (el.dataset.id) resetSvc(el.dataset.id); break
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

const css = districtVars('coding') + BASE_CSS + `
  .source-panel, .license-panel, .alt-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .source-panel.done, .license-panel.done, .alt-panel.done { border-left-color: var(--good); }
  .license-panel, .alt-panel { border-left-color: var(--accent-2); }
  .license-panel.locked, .alt-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .sp-h, .lp-h, .ap-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .sp-tag, .lp-tag, .ap-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .sp-tag { color: var(--accent); }
  .lp-tag, .ap-tag { color: var(--accent-2); }
  .lp-tag.idle, .ap-tag.idle { color: var(--ink-dim); }
  .lp-tag.done, .ap-tag.done, .sp-tag.done { color: var(--good); }
  .sp-sub, .lp-sub, .ap-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .stmt-list, .tier-list, .svc-list { list-style: none; padding-left: 0; margin: 0; }
  .stmt { display: flex; align-items: center; gap: 16px; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 6px; border-left: 3px solid transparent; }
  .stmt.correct { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .stmt-text { flex: 1; font-size: 13px; line-height: 1.5; }
  .stmt-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .stmt-badge { font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; }
  .stmt-badge.true  { background: rgba(126, 226, 193, 0.15); color: var(--good); border: 1px solid #2c5547; }
  .stmt-badge.false { background: rgba(239, 91, 123, 0.10); color: var(--bad); border: 1px solid #4a2a32; }
  .btn.small { padding: 4px 10px; font-size: 11.5px; }

  .tier { margin-bottom: 6px; }
  .tier-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 12px 14px; text-align: left; display: flex; flex-direction: column; gap: 6px; font: inherit; transition: all 0.15s; position: relative; }
  .tier-btn:hover:not(:disabled) { background: #232b3a; border-color: var(--accent-2); }
  .tier-btn:disabled { opacity: 0.45; cursor: default; }
  .tier.applied .tier-btn { border-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); opacity: 1; }
  .tier-label { font-size: 13px; font-weight: 600; padding-right: 80px; }
  .tier-summary { font-size: 12px; color: var(--ink-dim); line-height: 1.55; }
  .tier-badge.applied { position: absolute; top: 10px; right: 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; font-weight: 700; }

  .svc-check { display: flex; align-items: center; gap: 16px; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 6px; border-left: 3px solid transparent; flex-wrap: wrap; }
  .svc-check.correct { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .svc-meta { display: flex; gap: 12px; align-items: baseline; flex: 1; min-width: 280px; }
  .svc-cpt { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 13px; color: var(--accent); background: var(--bg); padding: 2px 8px; border-radius: 3px; }
  .svc-label { font-size: 13px; }
  .svc-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .svc-badge { font-size: 10.5px; font-weight: 700; padding: 3px 8px; border-radius: 3px; letter-spacing: 0.04em; }
  .svc-badge.cpt   { background: rgba(240, 168, 104, 0.15); color: var(--accent-2); border: 1px solid #4a3a2a; }
  .svc-badge.hcpcs { background: rgba(126, 226, 193, 0.15); color: var(--good); border: 1px solid #2c5547; }

  .recap { background: rgba(126, 226, 193, 0.06); border-color: #2c5547; }
  .recap-h { color: var(--good); }
`

// ===== Mount =====

function rerender() { const root = document.getElementById('prototype-root'); if (root) root.innerHTML = render() }

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
