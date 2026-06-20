// Form Mirror @ catalog — wrong-form Case. Facility claim filed on a
// CMS-1500 (professional 837P) instead of a UB-04 (institutional
// 837I). Different shape from the other coding-district Cases:
// the puzzle isn't which code is wrong, it's which form is wrong.
//
// Action set:
//   - Detect: 5 indicators on the rejected claim that signal the
//     form mismatch. Mark each "this is on the wrong form" or
//     "this is fine."
//   - Map: 4 data elements need to be relocated from the CMS-1500
//     to the correct UB-04 form locator. Pick the right FL per
//     element.
//   - Reroute: refile as 837I (institutional) and pick the right
//     resolution path — corrected claim vs new claim vs appeal.
//
// Demonstrates: forms are infrastructure. The same patient + same
// procedures + same charges can sit on either form; the wrong one
// gets rejected without ever being adjudicated. CO-95 is the most
// common "your claim never got read" CARC.
//
// Author: May 2026.
import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

// ===== Domain types =====

interface FormIndicator {
  id: string
  /** What the indicator says on the rejected CMS-1500. */
  text: string
  /** True iff this indicator is evidence the wrong form was used. */
  wrongForm: boolean
  /** Why it's right or wrong. */
  reason: string
}

interface DataElement {
  id: string
  /** Source field on the CMS-1500. */
  source: string
  /** Plain-English what-it-is. */
  label: string
  /** What the field carries. */
  value: string
  /** Correct UB-04 form locator (FL) where this should land. */
  correctFL: string
  /** Decoy FLs the player might pick. */
  decoyFLs: { fl: string; reason: string }[]
  /** Why the correct FL is correct. */
  correctReason: string
}

interface Resolution {
  id: string
  label: string
  correct: boolean
  feedback: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'detect' | 'map' | 'reroute'
}

interface GlossaryEntry {
  term: string
  plain: string
}

// ===== Encounter data =====

const PATIENT = 'Aiyana Roberts'
const VISIT_TYPE = 'inpatient stay'
const DOS_ADMIT = '2026-04-02'
const DOS_DISCHARGE = '2026-04-05'
const DRG = '690'
const CARC = 'CO-95'
const TOTAL_CHARGES = 18_400

const indicators: FormIndicator[] = [
  {
    id: 'rev-codes',
    text: 'The chargemaster output includes Revenue Codes 0250 (pharmacy), 0300 (lab), 0450 (ER), 0710 (recovery room).',
    wrongForm: true,
    reason: 'Revenue codes are institutional billing — UB-04 form locator 42. The CMS-1500 has no field for revenue codes; on a 1500 these data elements have nowhere to live and trigger CO-95 ("wrong claim type") at the clearinghouse.',
  },
  {
    id: 'drg',
    text: `The case is grouped to MS-DRG ${DRG} (Kidney and Urinary Tract Infections w/o MCC).`,
    wrongForm: true,
    reason: 'DRG codes are institutional. UB-04 carries the DRG in form locator 71; CMS-1500 has no DRG field at all. Outpatient claims don\'t group to DRG, so a DRG\'s presence is itself evidence the claim is institutional.',
  },
  {
    id: 'cpts',
    text: 'Procedures are listed with CPT codes (99221 initial hospital E&M, 99232 subsequent hospital care).',
    wrongForm: false,
    reason: 'CPT codes appear on both forms — CMS-1500 box 24D and UB-04 form locator 44. Their presence by itself doesn\'t indicate a mismatch; the form mismatch is in the *other* fields.',
  },
  {
    id: 'occurrence-codes',
    text: 'Occurrence Code 11 (onset of symptoms) appears with date 2026-03-28.',
    wrongForm: true,
    reason: 'Occurrence codes are institutional — UB-04 form locators 31-34. The CMS-1500 has no occurrence-code fields; placing one here is evidence this should have been a UB-04.',
  },
  {
    id: 'diagnoses',
    text: 'Primary diagnosis N39.0 (Urinary tract infection, site not specified) is recorded.',
    wrongForm: false,
    reason: 'ICD-10 diagnosis codes appear on both forms — CMS-1500 box 21 and UB-04 form locator 67. Diagnoses by themselves don\'t indicate which form is right; the form mismatch is in the institutional-only fields above.',
  },
]

const dataElements: DataElement[] = [
  {
    id: 'rev-codes',
    source: '(no equivalent on CMS-1500)',
    label: 'Revenue codes for pharmacy / lab / ER / recovery',
    value: '0250, 0300, 0450, 0710',
    correctFL: 'FL 42 (Revenue Code)',
    decoyFLs: [
      { fl: 'FL 44 (HCPCS / Rate)', reason: 'FL 44 is for the HCPCS/CPT line item — the procedure itself, not its revenue category.' },
      { fl: 'FL 50 (Payer Name)', reason: 'FL 50 is the payer header — wrong row entirely.' },
    ],
    correctReason: 'Revenue codes belong in FL 42, with the matching service description in FL 43 and the procedure code in FL 44.',
  },
  {
    id: 'drg',
    source: '(no equivalent on CMS-1500)',
    label: 'MS-DRG assignment',
    value: 'DRG 690',
    correctFL: 'FL 71 (DRG Code)',
    decoyFLs: [
      { fl: 'FL 67 (Principal Diagnosis)', reason: 'FL 67 is the principal ICD-10 diagnosis. DRG is derived from diagnosis + procedure; it has its own field.' },
      { fl: 'FL 80 (Remarks)', reason: 'FL 80 is the free-text remarks line. DRG goes in its own dedicated field, not free text.' },
    ],
    correctReason: 'FL 71 is the DRG code box. UB-04 has a dedicated field; CMS-1500 has nothing, which is why the claim was rejected.',
  },
  {
    id: 'admit-discharge',
    source: 'Box 18 (Hospitalization Dates Related to Current Service)',
    label: 'Statement-from-through dates (admit + discharge)',
    value: `${DOS_ADMIT} → ${DOS_DISCHARGE}`,
    correctFL: 'FL 6 (Statement Covers Period)',
    decoyFLs: [
      { fl: 'FL 17 (Patient Status)', reason: 'FL 17 is the discharge disposition (e.g., 01 home, 02 transferred). Different field.' },
      { fl: 'FL 31-34 (Occurrence Codes)', reason: 'Occurrence codes carry event-specific dates (onset, accident); the from/through stay dates have their own field.' },
    ],
    correctReason: 'FL 6 is the statement-covers-period (from/through). Box 18 on the CMS-1500 was being used as a workaround; on UB-04 it has its own slot.',
  },
  {
    id: 'occurrence',
    source: '(no equivalent on CMS-1500)',
    label: 'Occurrence Code 11 — onset of symptoms',
    value: 'Code 11, 2026-03-28',
    correctFL: 'FL 31-34 (Occurrence Codes/Dates)',
    decoyFLs: [
      { fl: 'FL 67 (Principal Diagnosis)', reason: 'Onset of symptoms is an event date, not a diagnosis. FL 67 carries the principal ICD-10.' },
      { fl: 'FL 80 (Remarks)', reason: 'Occurrence codes have their own structured fields. Free-text in FL 80 won\'t pass clearinghouse edits.' },
    ],
    correctReason: 'Occurrence codes are paired with their dates in FL 31-34 (up to four). UB-04 supports this directly; CMS-1500 doesn\'t.',
  },
]

const resolutions: Resolution[] = [
  {
    id: 'refile-837i',
    label: 'Refile as a fresh 837I (institutional) UB-04 claim with the data elements remapped to the correct form locators.',
    correct: true,
    feedback: 'Right path. CO-95 means the original was never adjudicated — it bounced at the clearinghouse for being on the wrong form. Refile as 837I, fresh ICN, no resubmission code needed (there\'s no prior adjudicated claim to correct).',
  },
  {
    id: 'corrected-claim',
    label: 'Submit a corrected claim (CLM05-3 frequency = 7) referencing the original CMS-1500 ICN.',
    correct: false,
    feedback: 'Frequency 7 (replacement of prior claim) only applies to claims that were *adjudicated*. CO-95 means the claim was rejected at the clearinghouse and never adjudicated — there\'s nothing to replace. Filing as a replacement loops the rejection.',
  },
  {
    id: 'appeal-co95',
    label: 'File a level-1 appeal arguing CO-95 was applied incorrectly.',
    correct: false,
    feedback: 'Appeals are for adjudicated claims you disagree with. CO-95 is a clearinghouse rejection, not a payer decision. Appealing it routes the work to the wrong team and the rejection sticks.',
  },
  {
    id: 'reassign-as-prof',
    label: 'Reclassify the inpatient stay as professional services and keep the CMS-1500.',
    correct: false,
    feedback: 'You can\'t reclassify an inpatient stay into professional services — the facility services (room, supplies, lab) genuinely are institutional, and the DRG / revenue codes / occurrence codes have no home on the 1500. Keeping the wrong form means perpetually rejected.',
  },
  {
    id: 'split-claims',
    label: 'Split into facility (UB-04) and professional (CMS-1500) claims, both for this stay.',
    correct: false,
    feedback: 'Tempting, and partly true — physician services *do* often bill on a separate CMS-1500. But this rejected claim is the facility piece. The split should already exist; the question is just refiling this one piece on the right form.',
  },
]

const issues: Issue[] = [
  {
    id: 'detect',
    label: 'Detect the form mismatch — find the institutional-only fields squatting on the CMS-1500.',
    recap: 'Three institutional-only fields were on the CMS-1500: revenue codes, DRG, and occurrence code 11. CPT codes and ICD-10 diagnoses appear on both forms; their presence didn\'t prove anything either way.',
    verb: 'detect',
  },
  {
    id: 'map',
    label: 'Map four data elements to their correct UB-04 form locators.',
    recap: 'Revenue codes → FL 42. DRG → FL 71. Statement-from-through dates → FL 6. Occurrence code → FL 31-34. Each element has a dedicated UB-04 slot the CMS-1500 doesn\'t expose.',
    verb: 'map',
  },
  {
    id: 'reroute',
    label: 'Refile as 837I (UB-04) — fresh claim, not a corrected claim or appeal.',
    recap: 'Refiled as a fresh 837I institutional claim. CO-95 was a clearinghouse rejection (not an adjudicated decision), so there\'s nothing to correct or appeal — just submit on the right form.',
    verb: 'reroute',
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'CMS-1500': {
    term: 'CMS-1500 (837P)',
    plain: "Professional claim form — physician offices, ambulance services, freestanding clinics. The HIPAA-mandated paper form (CMS-1500) and its electronic equivalent (X12 837P) carry the same data: patient demographics, ICD-10 diagnoses, CPT/HCPCS procedures, modifiers, units, charges. Limited to one rendering provider per claim. About 33 fields/boxes.",
  },
  'UB-04': {
    term: 'UB-04 (837I)',
    plain: "Institutional claim form — hospitals (inpatient + outpatient), SNFs, home health, hospice, freestanding ASCs. Paper form CMS-1450 / UB-04 with its X12 837I electronic equivalent. Carries everything CMS-1500 does PLUS revenue codes (FL 42), DRG (FL 71), occurrence codes (FL 31-34), value codes (FL 39-41), and condition codes (FL 18-28) — fields the professional form doesn't have. 81 form locators.",
  },
  '837I': {
    term: '837I (Institutional EDI)',
    plain: "X12 transaction set 837 with the 'Institutional' implementation guide — the electronic version of the UB-04. Carries the same 81 form locators as structured EDI segments (CLM, NM1, REF, HI, etc.). Hospitals submit through clearinghouses to commercial payers and through MACs to Medicare.",
  },
  '837P': {
    term: '837P (Professional EDI)',
    plain: "X12 transaction set 837 with the 'Professional' implementation guide — the electronic version of the CMS-1500. Same X12 backbone as 837I, but the loops/segments only carry the 1500's fields. The institutional-only fields (revenue codes, DRG, occurrence codes) literally don't have an 837P slot.",
  },
  'CO-95': {
    term: 'CO-95 (Plan procedures not followed)',
    plain: "Clearinghouse / payer rejection: 'this claim doesn't follow our procedures.' In practice this CARC catches a lot of structural problems — wrong claim type, wrong file format, missing required loops. For a facility claim filed as 837P, it usually means 'use 837I instead.' The claim never adjudicates; refiling on the right form is the only path forward.",
  },
  'revenue code': {
    term: 'Revenue code',
    plain: "4-digit code on the UB-04 (form locator 42) classifying the service category — pharmacy (025x), lab (030x), ER (045x), recovery (071x), surgery (036x), and so on. Pairs with the procedure code in FL 44 to describe each line. Required on every UB-04 line; has no home on the CMS-1500.",
  },
  'DRG': {
    term: 'DRG (Diagnosis-Related Group)',
    plain: "Bundled payment classification for inpatient stays. The grouper takes the principal diagnosis + secondary diagnoses + procedures + discharge status and outputs one DRG per stay. Most large payers pay a fixed amount per DRG. Lives in form locator 71 on the UB-04; no equivalent field on the CMS-1500.",
  },
  'occurrence code': {
    term: 'Occurrence code',
    plain: "2-digit UB-04 code paired with a date, marking events relevant to billing (onset of symptoms, accident date, last menstrual period, hospice election). Up to four pairs in form locators 31-34. The 1500 has nothing comparable.",
  },
  'form locator': {
    term: 'Form locator (FL)',
    plain: "The UB-04's term for 'box.' 81 of them, each with a strict data type and constraint. FL 1 is provider name; FL 81 is the certifying signature. Like CMS-1500 box numbers but more of them, more structured, and tied to the institutional 837I loops.",
  },
}

// ===== Runtime state =====

interface IndicatorState { pick: 'wrong' | 'fine' | null; }
interface ElementState { pickedFL: string | null; }

const state = {
  briefingDone: false,
  briefingOpen: false,
  indicatorStates: indicators.reduce((m, i) => { m[i.id] = { pick: null }; return m }, {} as Record<string, IndicatorState>),
  elementStates: dataElements.reduce((m, e) => { m[e.id] = { pickedFL: null }; return m }, {} as Record<string, ElementState>),
  appliedResolutionId: null as string | null,
  transientFeedback: null as { id: string; message: string; kind: 'good' | 'bad' } | null,
  resolvedIssues: new Set<string>(),
  failedAttempts: 0,
  packetSubmitted: false,
  openTermId: null as string | null,
}

function isDetectDone(): boolean {
  return indicators.every(i => {
    const ss = state.indicatorStates[i.id]
    return ss.pick === (i.wrongForm ? 'wrong' : 'fine')
  })
}

function isMapDone(): boolean {
  return dataElements.every(e => state.elementStates[e.id].pickedFL === e.correctFL)
}

// ===== Render =====

function term(termId: string, displayText?: string): string {
  const entry = glossary[termId]
  const text = displayText ?? termId
  if (!entry) return escape(text)
  return `<span class="term" data-action="open-term" data-term="${termId}" title="${escape(entry.plain)}">${escape(text)}<span class="term-icon">?</span></span>`
}

function money(n: number): string { return '$' + Math.round(n).toLocaleString() }

function render(): string {
  if (state.packetSubmitted) {
    return renderHeader() + renderVictory() + renderTermPopover() + renderBriefingPopover()
  }
  return `
    ${renderHeader()}
    ${renderHospitalIntro()}
    ${!state.briefingDone ? renderBriefingInline() : `
      ${renderClaimSummary()}
      ${renderDetectPanel()}
      ${renderMapPanel()}
      ${renderReroutePanel()}
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
        <h1>Form Mirror <span class="muted">@ catalog — first sketch (UB-04 vs CMS-1500)</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./prototypes.html">← back to catalog</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          ${escape(PATIENT)}'s inpatient stay was billed on a
          ${term('CMS-1500')} (professional). It came back
          ${term('CO-95')}: wrong claim type. The fields the
          institutional 1500 doesn't have — ${term('revenue code', 'revenue codes')},
          ${term('DRG')}, ${term('occurrence code', 'occurrence codes')} —
          all squatted in margins and remarks. Move them to a
          ${term('UB-04')} and refile. See the
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
        Pat from coding plops the rejection on your desk:
        ${escape(PATIENT)}'s ${VISIT_TYPE}, ${money(TOTAL_CHARGES)}
        in charges, came back ${term('CO-95')} from BCBS. "Wrong
        claim type. Somebody filed it as a ${term('CMS-1500')}.
        Look at the fields — half of them don't even have a
        place on the 1500."
      </p>
      <p>
        On the printout: revenue codes squatting in the line-item
        notes, ${term('DRG')} ${DRG} typed into the remarks, an
        occurrence code shoved into a margin. The clearinghouse
        bounced the claim before BCBS ever saw it. Refile on a
        ${term('UB-04')} or it stays bounced.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the lights flicker, bluish. The CMS-1500 slides
        a half-pixel left and a UB-04 slides in beside it,
        translucent. The fields realign. The puzzle is which
        ones move and where.</em>
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
      <span class="briefing-sub">${state.briefingDone ? 'Re-reading her note.' : 'Different shape — forms are the puzzle, not codes.'}</span>
    </div>
    <div class="briefing-body">
      <p>
        "First time the dragon is the form itself. ${term('CO-95')}
        means the clearinghouse never even gave BCBS a chance to
        adjudicate — it bounced for being on the wrong claim type.
        Refile, no need to appeal. But refile <em>correctly</em>."
      </p>
      <p>
        "Three issues:"
      </p>
      <ul>
        <li>
          Five lines on the rejected
          claim. Some signal the form mismatch
          (institutional-only fields with no home on the 1500),
          some are the same on both forms. Mark each.
        </li>
        <li>
          Each institutional-only data
          element has a ${term('form locator')} on the
          ${term('UB-04')}. Pick the right FL per element.
          Decoys are real-form fields — pick wrong and the new
          claim comes back bounced too.
        </li>
        <li>
          Pick the right resolution
          path. Hint: ${term('CO-95')} isn't a denial, it's a
          rejection. Different remedy.
        </li>
      </ul>
      <p class="briefing-sign">"The form is the routing. — D."</p>
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

function renderClaimSummary(): string {
  return `
    <section class="claim-summary">
      <div class="cs-h">
        <span class="cs-tag">REJECTED CLAIM · BCBS · ICN 2026-04-08-552</span>
        <span class="cs-sub">${term('CO-95')} returned by clearinghouse. Original filed on ${term('CMS-1500')} (837P).</span>
      </div>
      <table class="cs-table">
        <tr><th>Patient</th><td>${escape(PATIENT)}</td></tr>
        <tr><th>Visit</th><td>${escape(VISIT_TYPE)}, ${DOS_ADMIT} → ${DOS_DISCHARGE}</td></tr>
        <tr><th>${term('DRG')}</th><td><code>${DRG}</code> (Kidney/UTI infections, no MCC)</td></tr>
        <tr><th>Total charges</th><td>${money(TOTAL_CHARGES)}</td></tr>
        <tr><th>Filed as</th><td><code>${term('837P')}</code> (professional) — clearinghouse returned ${CARC}</td></tr>
      </table>
    </section>
  `
}

function renderDetectPanel(): string {
  const done = state.resolvedIssues.has('detect')
  return `
    <section class="detect-panel ${done ? 'done' : ''}">
      <div class="dp-h">
        <span class="dp-tag">DETECT MISMATCH · 5 indicators</span>
        <span class="dp-sub">${done
          ? 'Three institutional-only fields squatting on the CMS-1500. CPT + diagnoses appear on both forms.'
          : 'For each line, mark whether it\'s evidence the wrong form was used or whether it\'s fine on either form.'}</span>
      </div>
      <ul class="ind-list">
        ${indicators.map(i => renderIndicator(i)).join('')}
      </ul>
      ${state.transientFeedback && indicators.some(i => i.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('detect') : ''}
    </section>
  `
}

function renderIndicator(i: FormIndicator): string {
  const ss = state.indicatorStates[i.id]
  const decided = ss.pick !== null
  const correct = decided && ss.pick === (i.wrongForm ? 'wrong' : 'fine')
  return `
    <li class="ind ${decided && correct ? 'correct' : ''}">
      <div class="ind-text">${escape(i.text)}</div>
      <div class="ind-actions">
        ${decided && correct ? `
          <span class="ind-badge ${ss.pick}">${ss.pick === 'wrong' ? 'WRONG FORM' : 'EITHER FORM'}</span>
          <button class="btn small ghost" data-action="reset-ind" data-id="${i.id}">↺ undo</button>
        ` : `
          <button class="btn small ghost" data-action="pick-ind" data-id="${i.id}" data-pick="wrong">Wrong form</button>
          <button class="btn small ghost" data-action="pick-ind" data-id="${i.id}" data-pick="fine">Fine on either</button>
        `}
      </div>
    </li>
  `
}

function renderMapPanel(): string {
  const unlocked = state.resolvedIssues.has('detect')
  const done = state.resolvedIssues.has('map')
  if (!unlocked) {
    return `
      <section class="map-panel locked">
        <div class="mp-h">
          <span class="mp-tag idle">MAP TO UB-04 FORM LOCATORS</span>
          <span class="mp-sub">Locked until the mismatch is detected.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="map-panel ${done ? 'done' : 'active'}">
      <div class="mp-h">
        <span class="mp-tag ${done ? 'done' : 'active'}">MAP TO UB-04 FORM LOCATORS · 4 elements</span>
        <span class="mp-sub">${done
          ? 'Mapped. Revenue codes → FL 42. DRG → FL 71. Statement dates → FL 6. Occurrence → FL 31-34.'
          : 'For each data element, pick the correct UB-04 ' + term('form locator') + '. Decoys are real fields; wrong picks loop the rejection.'}</span>
      </div>
      <ul class="elem-list">
        ${dataElements.map(e => renderElementRow(e)).join('')}
      </ul>
      ${state.transientFeedback && dataElements.some(e => e.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('map') : ''}
    </section>
  `
}

function renderElementRow(e: DataElement): string {
  const ss = state.elementStates[e.id]
  const correct = ss.pickedFL === e.correctFL
  const allFLs: { fl: string; isCorrect: boolean }[] = [
    ...e.decoyFLs.map(d => ({ fl: d.fl, isCorrect: false })),
    { fl: e.correctFL, isCorrect: true },
  ].sort((a, b) => a.fl.localeCompare(b.fl))
  return `
    <li class="elem ${ss.pickedFL ? (correct ? 'correct' : '') : ''}">
      <div class="elem-meta">
        <div class="elem-label">${escape(e.label)}</div>
        <div class="elem-source">${escape(e.source)} → <strong>${escape(e.value)}</strong></div>
      </div>
      <div class="elem-fls">
        ${ss.pickedFL && correct ? `
          <span class="elem-badge correct">${escape(e.correctFL)}</span>
          <button class="btn small ghost" data-action="reset-elem" data-id="${e.id}">↺ undo</button>
        ` : `
          ${allFLs.map(f => `
            <button class="btn small ghost" data-action="pick-fl" data-id="${e.id}" data-fl="${escape(f.fl)}">${escape(f.fl)}</button>
          `).join('')}
        `}
      </div>
    </li>
  `
}

function renderReroutePanel(): string {
  const unlocked = state.resolvedIssues.has('detect') && state.resolvedIssues.has('map')
  const done = state.resolvedIssues.has('reroute')
  if (!unlocked) {
    return `
      <section class="reroute-panel locked">
        <div class="rp-h">
          <span class="rp-tag idle">REROUTE</span>
          <span class="rp-sub">Locked until detection + mapping are done.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="reroute-panel ${done ? 'done' : 'active'}">
      <div class="rp-h">
        <span class="rp-tag ${done ? 'done' : 'active'}">REROUTE · 5 resolution paths</span>
        <span class="rp-sub">${done
          ? 'Refiled as fresh 837I. CO-95 was a clearinghouse rejection, not an adjudicated denial — no correction or appeal needed.'
          : 'Pick the right path. Hint: CO-95 is a rejection (clearinghouse), not a denial (payer).'}</span>
      </div>
      <ul class="res-list">
        ${resolutions.map(r => renderResolutionOption(r)).join('')}
      </ul>
      ${state.transientFeedback && resolutions.some(r => r.id === state.transientFeedback!.id)
        ? `<div class="feedback fb-${state.transientFeedback.kind}">${escape(state.transientFeedback.message)}</div>`
        : ''}
      ${done ? renderRecap('reroute') : ''}
    </section>
  `
}

function renderResolutionOption(r: Resolution): string {
  const applied = state.appliedResolutionId === r.id
  return `
    <li class="res-opt ${applied ? 'applied' : ''}">
      <button class="res-btn" data-action="apply-resolution" data-id="${r.id}" ${state.appliedResolutionId !== null && !applied ? 'disabled' : ''}>
        <span class="res-label">${escape(r.label)}</span>
        ${applied ? '<span class="res-badge applied">APPLIED</span>' : ''}
      </button>
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
      <div class="checklist-h">CLAIM REROUTE · 3 issues to resolve</div>
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
        Refile as 837I (UB-04)
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

const RECAP: CaseRecap = CASE_RECAPS['form-mirror']

function renderVictory(): string {
  return `
    <section class="victory">
      <div class="register waiting-room">REFILED · 837I</div>
      <h2>Claim resubmitted on a UB-04. ${money(TOTAL_CHARGES)} pending adjudication.</h2>
      <p>
        Revenue codes seated in FL 42. DRG in FL 71. Statement dates
        in FL 6. Occurrence code paired with its date in FL 31. The
        837I cleared the clearinghouse on the first pass; BCBS will
        adjudicate within their normal cycle.
      </p>
      <p class="muted">
        ${term('CO-95')} is the most common "your claim never got
        read" CARC, and it almost always means a structural mismatch
        somewhere — wrong form, wrong taxonomy, missing required
        loop. Reading the rejection as a routing problem rather than
        a payment problem is the muscle.
      </p>
      <div class="register hospital">HOSPITAL · later that morning</div>
      <p>
        Pat slides a stack of three more rejections across the
        desk. "All CO-95. All from the same week. Somebody on the
        outpatient team is filing institutional surgeries on
        1500s." Different patients; same Mirror.
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
            <li><strong>Three actions:</strong> detect (find the
            mismatch), map (move data elements to the right form
            locators), reroute (refile, not appeal).</li>
            <li><strong>Forms are infrastructure.</strong> The
            same patient, procedures, and charges fit on either
            CMS-1500 or UB-04 — the wrong one bounces without
            ever being adjudicated.</li>
            <li><strong>Rejection vs denial.</strong> CO-95 is a
            clearinghouse rejection (the payer never read the
            claim). Different remedy than a CARC denial — refile,
            don\'t appeal, don\'t correct.</li>
            <li><strong>Decoy form locators.</strong> Each FL
            decoy is a real UB-04 field — picking the wrong one
            still gets the claim rejected, just for a different
            reason.</li>
          </ul>
        </div>
        <div>
          <h3>Sibling shape</h3>
          <ul>
            <li>Cousin to all the coding-district Cases (Wraith /
            Bundle / Pat's L4-cluster) — same district, but the
            puzzle isn't which code, it's which form.</li>
            <li>Cousin to the routing puzzles in
            <a href="./carveout-phantom-prototype.html">Carve-out Phantom</a>
            (PPDR vs IDR) — same "wrong forum, wrong remedy"
            failure mode.</li>
            <li>Builds toward Phantom Patient @ L21 (wrong-MRN
            identity merge) — same "the data ended up in the
            wrong container" muscle.</li>
          </ul>
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

function pickInd(id: string, pick: 'wrong' | 'fine') {
  const i = indicators.find(x => x.id === id)
  if (!i) return
  const ss = state.indicatorStates[id]
  state.transientFeedback = null
  const correctPick = i.wrongForm ? 'wrong' : 'fine'
  if (pick === correctPick) {
    ss.pick = pick
    state.transientFeedback = { id, message: i.reason, kind: 'good' }
    if (isDetectDone()) state.resolvedIssues.add('detect')
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: i.reason, kind: 'bad' }
  }
}

function resetInd(id: string) {
  const ss = state.indicatorStates[id]
  if (!ss) return
  ss.pick = null
  state.resolvedIssues.delete('detect')
  state.resolvedIssues.delete('map')
  state.resolvedIssues.delete('reroute')
  state.transientFeedback = null
}

function pickFL(elemId: string, fl: string) {
  const e = dataElements.find(x => x.id === elemId)
  if (!e) return
  const ss = state.elementStates[elemId]
  state.transientFeedback = null
  if (e.correctFL === fl) {
    ss.pickedFL = fl
    state.transientFeedback = { id: elemId, message: e.correctReason, kind: 'good' }
    if (isMapDone()) state.resolvedIssues.add('map')
  } else {
    state.failedAttempts++
    const decoy = e.decoyFLs.find(d => d.fl === fl)
    state.transientFeedback = { id: elemId, message: decoy?.reason ?? 'Wrong field for this element.', kind: 'bad' }
  }
}

function resetElem(id: string) {
  const ss = state.elementStates[id]
  if (!ss) return
  ss.pickedFL = null
  state.resolvedIssues.delete('map')
  state.resolvedIssues.delete('reroute')
  state.transientFeedback = null
}

function applyResolution(id: string) {
  const r = resolutions.find(x => x.id === id)
  if (!r) return
  state.transientFeedback = null
  if (r.correct) {
    state.appliedResolutionId = id
    state.resolvedIssues.add('reroute')
    state.transientFeedback = { id, message: r.feedback, kind: 'good' }
  } else {
    state.failedAttempts++
    state.transientFeedback = { id, message: r.feedback, kind: 'bad' }
  }
}

function attemptSubmit() {
  if (issues.every(i => state.resolvedIssues.has(i.id))) {
    state.packetSubmitted = true
    notifyParentVictory('form-mirror')
  }
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  for (const id in state.indicatorStates) state.indicatorStates[id] = { pick: null }
  for (const id in state.elementStates) state.elementStates[id] = { pickedFL: null }
  state.appliedResolutionId = null
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
    case 'pick-ind': if (el.dataset.id && el.dataset.pick) pickInd(el.dataset.id, el.dataset.pick as 'wrong' | 'fine'); break
    case 'reset-ind': if (el.dataset.id) resetInd(el.dataset.id); break
    case 'pick-fl':  if (el.dataset.id && el.dataset.fl) pickFL(el.dataset.id, el.dataset.fl); break
    case 'reset-elem': if (el.dataset.id) resetElem(el.dataset.id); break
    case 'apply-resolution': if (el.dataset.id) applyResolution(el.dataset.id); break
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
  /* Claim summary */
  .claim-summary { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .cs-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .cs-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .cs-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .cs-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .cs-table th, .cs-table td { text-align: left; padding: 6px 10px; border-bottom: 1px dashed #232a36; vertical-align: top; }
  .cs-table th { font-size: 11px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; width: 160px; }

  /* Detect panel */
  .detect-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .detect-panel.done { border-left-color: var(--good); }
  .dp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .dp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .dp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .ind-list { list-style: none; padding-left: 0; margin: 0; }
  .ind { display: flex; align-items: center; gap: 16px; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 6px; border-left: 3px solid transparent; }
  .ind.correct { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .ind-text { flex: 1; font-size: 13px; line-height: 1.5; }
  .ind-actions { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
  .ind-badge { font-size: 10px; font-weight: 700; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; }
  .ind-badge.wrong { background: rgba(239, 91, 123, 0.10); color: var(--bad); border: 1px solid #4a2a32; }
  .ind-badge.fine  { background: rgba(126, 226, 193, 0.15); color: var(--good); border: 1px solid #2c5547; }
  .btn.small { padding: 4px 10px; font-size: 11.5px; }

  /* Map panel */
  .map-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent-2); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .map-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .map-panel.done   { border-left-color: var(--good); }
  .mp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .mp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .mp-tag.idle { color: var(--ink-dim); }
  .mp-tag.active { color: var(--accent-2); }
  .mp-tag.done { color: var(--good); }
  .mp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .elem-list { list-style: none; padding-left: 0; margin: 0; }
  .elem { display: flex; gap: 14px; align-items: flex-start; padding: 10px 12px; background: var(--panel-2); border-radius: 5px; margin-bottom: 8px; flex-wrap: wrap; border-left: 3px solid transparent; }
  .elem.correct { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.06), transparent); }
  .elem-meta { flex: 2; min-width: 240px; }
  .elem-label { font-size: 13px; font-weight: 600; }
  .elem-source { font-size: 11.5px; color: var(--ink-dim); margin-top: 3px; }
  .elem-source strong { color: var(--ink); font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .elem-fls { flex: 3; min-width: 280px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
  .elem-badge { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 3px; letter-spacing: 0.04em; }
  .elem-badge.correct { background: rgba(126, 226, 193, 0.15); color: var(--good); border: 1px solid #2c5547; }

  /* Reroute panel */
  .reroute-panel { background: var(--panel); border: 1px solid #232a36; border-left: 4px solid var(--accent-2); border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .reroute-panel.locked { opacity: 0.55; border-left-color: #2a3142; }
  .reroute-panel.done   { border-left-color: var(--good); }
  .rp-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .rp-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .rp-tag.idle { color: var(--ink-dim); }
  .rp-tag.active { color: var(--accent-2); }
  .rp-tag.done { color: var(--good); }
  .rp-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .res-list { list-style: none; padding-left: 0; margin: 0; }
  .res-opt { margin-bottom: 6px; }
  .res-btn { width: 100%; background: var(--panel-2); border: 1px solid #2a3142; border-radius: 5px; color: var(--ink); cursor: pointer; padding: 11px 14px; text-align: left; font: inherit; transition: all 0.15s; position: relative; }
  .res-btn:hover:not(:disabled) { background: #232b3a; border-color: var(--accent-2); }
  .res-btn:disabled { opacity: 0.45; cursor: default; }
  .res-opt.applied .res-btn { border-color: var(--good); background: linear-gradient(180deg, rgba(126,226,193,0.08), transparent); opacity: 1; }
  .res-label { font-size: 13px; line-height: 1.5; display: block; padding-right: 80px; }
  .res-badge.applied { position: absolute; top: 10px; right: 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 3px; background: rgba(126,226,193,0.15); color: var(--good); border: 1px solid #2c5547; font-weight: 700; }

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
