// Swarm @ L12 (CO-16 / batch rejections).
//
// Sibling to wraith / bundle / reaper / gatekeeper / fog /
// hydra. Same shape (Hospital intro → dreamlike fall → Waiting
// Room → middle work → checklist), tuned to a queue-shaped
// action set:
//
//   - Eighteen claims rejected over the
//     weekend, all CO-16 ("claim/service lacks information").
//     Fourteen of them share one root cause (a misconfigured
//     NPI on Dr. Smith's profile). Fix the cluster as a group;
//     handle the outliers individually; then PATCH UPSTREAM so
//     it stops happening.
//   - First prototype that operates on *many* claims at once.
//     The CMS-1500 is gone — in its place, a queue.
//
// Demonstrates: the framework holds when the unit of work is
// a list rather than a single form. Same hospital intro,
// dreamlike fall, Dana voice, checklist, submit shape —
// different middle (a queue + batch actions instead of a
// claim form + builder).

import { BASE_CSS, districtVars, escape, renderCaseRecap, type CaseRecap, notifyParentVictory} from '../shared/prototype-base'
import { CASE_RECAPS } from '../content/case-recaps'

interface QueueClaim {
  id: string
  patient: string
  cpt: string
  cptLabel: string
  charge: number
  carcDetail: string
  cluster: 'npi' | 'outlier-dx' | 'outlier-pos' | 'outlier-clean'
  /** Status set as the player works through the queue. */
  status: 'pending' | 'fixed' | 'no-action'
  /** Per-claim explanation for the inspector. */
  note: string
}

interface NpiOption {
  id: string
  label: string
  support: 'wrong' | 'correct' | 'partial'
  feedback: string
}

interface Issue {
  id: string
  label: string
  recap: string
  verb: 'batch' | 'sweep' | 'patch'
}

interface GlossaryEntry {
  term: string
  plain: string
}

const issues: Issue[] = [
  {
    id: 'batch-npi',
    label: 'Batch-fix the 14 NPI rejections — apply Dr. Smith\'s correct NPI to all of them.',
    recap: "Fourteen claims share the same root cause — Dr. Smith's NPI was sent as 0000000000 on every one. Fixed once, applied across the cluster. The queue isn't actually 14 problems; it's one problem 14 times.",
    verb: 'batch',
  },
  {
    id: 'sweep-outliers',
    label: 'Sweep the three outliers — fix what needs fixing, mark the false positive.',
    recap: "Two outliers had real issues (missing diagnosis pointer on Box 24E; wrong place-of-service code). One was a false positive — flagged CO-16 by the clearinghouse but actually clean on inspection. Triaging the queue is half the skill.",
    verb: 'sweep',
  },
  {
    id: 'patch-upstream',
    label: 'File an EHR ticket so the NPI stops being blank on every Smith claim.',
    recap: "You logged the upstream root cause: Dr. Smith's provider profile in the EHR has a blank rendering-NPI field. The billing module defaults blank NPIs to '0000000000' instead of erroring out. Filed for IT to fix the profile and add a non-empty validator. Otherwise the same 14 claims become 28 next Monday, then 56.",
    verb: 'patch',
  },
]

const SMITH_TRUE_NPI = '1487329104'

const npiOptions: NpiOption[] = [
  {
    id: '0000000000',
    label: '0000000000',
    support: 'wrong',
    feedback: "That's what the queue already has — the placeholder the billing system inserted when the profile field was blank. That's the bug, not the fix.",
  },
  {
    id: SMITH_TRUE_NPI,
    label: SMITH_TRUE_NPI,
    support: 'correct',
    feedback: "Matches Dr. Smith's NPI on file with NPPES. Applying to the cluster — all 14 claims will resubmit with this on Box 24j.",
  },
  {
    id: '1487329140',
    label: '1487329140',
    support: 'wrong',
    feedback: "Last two digits transposed. NPIs are checksum-validated; this would fail the Luhn check at the clearinghouse and bounce again.",
  },
  {
    id: '1487329',
    label: '1487329',
    support: 'partial',
    feedback: "Truncated. NPIs are exactly 10 digits — this is 7. The clearinghouse would reject it on length validation.",
  },
]

// Queue. 18 claims; 14 in NPI cluster, 3 outliers, 1 false positive.
const initialQueue: QueueClaim[] = [
  // NPI cluster (14)
  ...Array.from({ length: 14 }).map((_, i): QueueClaim => {
    // Vary patient + CPT slightly so it doesn't read as identical rows.
    const patients = [
      'Aiyana Begay', 'Tariq Mensah', 'Priya Iyer', 'Ezra Stein',
      'Maya Tran', 'Carlos Vega', 'Bea Whitfield', 'Yusuf Aydin',
      'Hannelore Roth', 'Ola Akande', 'Joon Park', 'Sasha Vukov',
      'Femi Adebayo', 'Gita Sharma',
    ]
    const cpts = [
      { code: '99213', label: 'Office E&M, est, low' },
      { code: '99214', label: 'Office E&M, est, mod' },
      { code: '99203', label: 'Office E&M, new, low' },
      { code: '99396', label: 'Annual prev, age 40-64' },
      { code: '99395', label: 'Annual prev, age 18-39' },
    ]
    const cpt = cpts[i % cpts.length]
    const charge = [120, 165, 175, 220, 145, 190, 165, 145, 175, 165, 220, 120, 145, 165][i] ?? 165
    return {
      id: `clm-npi-${i + 1}`,
      patient: patients[i],
      cpt: cpt.code,
      cptLabel: cpt.label,
      charge,
      carcDetail: 'missing rendering provider NPI on box 24j',
      cluster: 'npi',
      status: 'pending',
      note: `Box 24j shows '0000000000'. Dr. Smith's profile in the EHR rendering-NPI field is blank; the billing module is filling the gap with the placeholder. Same root cause as the rest of the cluster.`,
    }
  }),
  // Outlier: missing dx pointer
  {
    id: 'clm-out-1',
    patient: 'Renata Lima',
    cpt: '99213',
    cptLabel: 'Office E&M, est, low',
    charge: 145,
    carcDetail: 'missing diagnosis pointer on Box 24E',
    cluster: 'outlier-dx',
    status: 'pending',
    note: "Box 24E (diagnosis pointer) is blank — should reference Box 21 entry A. Different root cause from the NPI cluster; fix this one individually.",
  },
  // Outlier: wrong POS
  {
    id: 'clm-out-2',
    patient: 'Marc Belanger',
    cpt: '99214',
    cptLabel: 'Office E&M, est, mod',
    charge: 175,
    carcDetail: 'place of service code missing or invalid (Box 24B)',
    cluster: 'outlier-pos',
    status: 'pending',
    note: "Box 24B (POS) shows '99' (other) — should be '11' (office). Marc was seen in clinic per the encounter note. Different root cause from the cluster.",
  },
  // False positive: actually clean
  {
    id: 'clm-out-3',
    patient: 'Imani Edwards',
    cpt: '99396',
    cptLabel: 'Annual prev, age 40-64',
    charge: 220,
    carcDetail: 'flagged CO-16 by clearinghouse heuristic',
    cluster: 'outlier-clean',
    status: 'pending',
    note: "On inspection, every required field is populated correctly. The clearinghouse's heuristic false-positives this template once in a while when the patient name has unusual spacing in the 837. Mark as 'no action' — the claim doesn't actually need a fix. (In real life: sometimes you have to look closely to NOT do work.)",
  },
]

const glossary: Record<string, GlossaryEntry> = {
  'CO-16': {
    term: 'CO-16 (claim/service lacks information)',
    plain: "A generic CARC the payer (or the clearinghouse, before forwarding) returns when something the payer needed isn't on the claim. The CARC alone tells you almost nothing — the *detail string* attached to it is what tells you what's actually missing. Reading those detail strings is half of L2.",
  },
  '277CA': {
    term: '277CA (claim acknowledgment)',
    plain: "The clearinghouse's response after a claim is received. Either accepts the claim onto the payer's adjudication queue or rejects it pre-payer. Most CO-16s on small claims start as 277CA-level rejections — the clearinghouse caught the missing field before the payer even saw it.",
  },
  'NPI': {
    term: 'NPI (national provider identifier)',
    plain: "A 10-digit identifier assigned by NPPES to every billable provider (and provider organization). Two flavors: Type-1 (individuals, like Dr. Smith) and Type-2 (organizations, like a clinic). On a CMS-1500, Box 24j carries the rendering provider's individual NPI for each service line; Box 33a carries the billing entity's NPI.",
  },
  'EHR': {
    term: 'EHR (electronic health record)',
    plain: "The system the clinic uses to document care — Epic, Cerner/Oracle Health, athena, Meditech, etc. The EHR is also where provider profiles live, including the NPI fields the billing module pulls from. A blank or wrong field here ripples downstream into every claim that provider touches.",
  },
  'CMS-1500': {
    term: 'CMS-1500',
    plain: "The standard claim form for outpatient services. This encounter doesn't render one — instead it operates on the queue of CMS-1500s that came back rejected. Box 24j (rendering NPI) is the field at issue.",
  },
  'upstream fix': {
    term: 'Upstream fix',
    plain: "Fixing the source of a recurring problem instead of the symptom. The 14 claims here are the symptom; Dr. Smith's blank profile is the source. A pure downstream fix patches each claim and waits for next week's batch. An upstream fix files an EHR ticket and the cluster stops growing.",
  },
}

// === Runtime state ===

const state = {
  briefingDone: false,
  briefingOpen: false,
  queue: initialQueue.map(c => ({ ...c })),
  /** Inspector for an individual claim. */
  inspectingClaimId: null as string | null,
  /** Batch-fix modal open? */
  batchFixOpen: false,
  batchFeedback: null as { id: string; message: string } | null,
  /** Outlier-fix modal: which outlier is being addressed. */
  outlierFixOpen: null as 'outlier-dx' | 'outlier-pos' | 'outlier-clean' | null,
  outlierFeedback: null as { choice: string; message: string } | null,
  /** Upstream-ticket modal. */
  ticketOpen: false,
  ticketSubmitted: false,
  /** Issue resolution. */
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
    return renderHeader() + renderVictory() + renderTermPopover() + renderBriefingPopover() + renderBatchModal() + renderOutlierModal() + renderTicketModal()
  }
  return `
    ${renderHeader()}
    ${renderHospitalIntro()}
    ${!state.briefingDone ? renderBriefingInline() : `
      ${renderQueueStats()}
      ${renderQueue()}
      ${renderUpstream()}
      ${renderChecklist()}
    `}
    ${state.briefingDone ? '' : renderDesignNotes()}
    ${renderTermPopover()}
    ${renderBriefingPopover()}
    ${renderBatchModal()}
    ${renderOutlierModal()}
    ${renderTicketModal()}
    ${renderInspector()}
  `
}

function renderHeader(): string {
  const recallBtn = state.briefingDone
    ? `<button class="recall-btn" data-action="show-briefing">📜 Dana's note</button>`
    : ''
  return `
    <header class="page-h">
      <div class="title-row">
        <h1>Swarm <span class="muted">@ L12</span></h1>
        <div class="header-actions">
          ${recallBtn}
          <a class="back-link" href="./">← back to game</a>
        </div>
      </div>
      ${state.briefingDone ? '' : `
        <p class="lede">
          A seventh prototype, sibling to the others. This one
          works a whole queue at once: eighteen weekend
          ${term('CO-16')} rejections, fourteen of them sharing
          one ${term('upstream fix')} (a misconfigured
          ${term('NPI')} on Dr. Smith's profile). The
          ClaimSheet is gone — in its place, a queue. See the
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
      <div class="register hospital">HOSPITAL · Monday, 7:42am</div>
      <p>
        Coffee not hot yet. The weekend's ${term('277CA')}
        rejections finished posting overnight. Eighteen claims,
        all from Smith Family Medicine — Dr. Lila Smith's
        clinic across the lobby. All flagged ${term('CO-16')}.
        Total charge value: $2,460. Small dollars, irritating
        volume.
      </p>
      <p>
        You scroll the list. Most of them say the same thing
        in the detail string. You stop scrolling.
      </p>
      <div class="register-flip">
        <div class="ripple"></div>
        <em>— and the screen ripples like water disturbed. The
        queue keeps scrolling on its own. The fluorescents
        whisper. You're somewhere else.</em>
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
        "This one is the Swarm. ${term('CO-16')} is the most
        common denial code in the building because it's a
        catch-all — anything missing from the claim. The CARC
        itself tells you almost nothing. The <em>detail
        string</em> tells you everything. Read those first."
      </p>
      <p>
        "When you see eighteen of these on a Monday morning,
        check for a pattern before you start fixing them one
        at a time. If they're from the same clinic with the
        same detail string, that's not a queue — that's
        <strong>one bug</strong> in the upstream system."
      </p>
      <p>
        "Three issues, in order:"
      </p>
      <ul>
        <li>
          Find the cluster and batch-fix it.
          Fourteen of these claims share a detail string.
          Figure out the right ${term('NPI')}, apply it to all
          fourteen at once.
        </li>
        <li>
          Sweep the outliers. The remaining
          three have different issues. Two need real fixes.
          One is a false positive — looks broken, isn't.
          Triage matters; sometimes the right move is no
          move.
        </li>
        <li>
          ${term('upstream fix', 'Patch upstream')}.
          Why was the NPI blank? Dr. Smith's profile in the
          ${term('EHR')} has an empty rendering-NPI field, and
          the billing module fills blanks with placeholders
          instead of erroring out. File an IT ticket so this
          stops happening. Otherwise the cluster doubles next
          week.
        </li>
      </ul>
      <p>
        "Three issues. Fix the cluster, sweep the outliers,
        patch the source. Don't be the person who fixes the
        same fourteen claims every Monday."
      </p>
      <p class="briefing-sign">"Don't be the person who fixes the same fourteen claims every Monday. — D."</p>
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

function renderQueueStats(): string {
  const totalCharge = state.queue.reduce((s, c) => s + c.charge, 0)
  const fixed = state.queue.filter(c => c.status !== 'pending').length
  return `
    <section class="stats">
      <div class="stat-cell">
        <span class="stat-num">${state.queue.length}</span>
        <span class="stat-label">claims · all CO-16</span>
      </div>
      <div class="stat-cell">
        <span class="stat-num">${money(totalCharge)}</span>
        <span class="stat-label">total charge value</span>
      </div>
      <div class="stat-cell">
        <span class="stat-num">${fixed} / ${state.queue.length}</span>
        <span class="stat-label">resolved</span>
      </div>
      <div class="stat-cell highlight">
        <span class="stat-num">14</span>
        <span class="stat-label">share one detail string</span>
      </div>
    </section>
  `
}

function renderQueue(): string {
  const npiCluster = state.queue.filter(c => c.cluster === 'npi')
  const outliers = state.queue.filter(c => c.cluster !== 'npi')
  const npiResolved = state.resolvedIssues.has('batch-npi')
  return `
    <section class="queue">
      <div class="queue-h">
        <span class="queue-tag">REJECTION QUEUE · weekend batch</span>
        <span class="queue-sub">Click any row to inspect. Use the cluster header to batch-fix.</span>
      </div>

      <div class="cluster ${npiResolved ? 'resolved' : ''}">
        <div class="cluster-h">
          <div class="cluster-h-text">
            <span class="cluster-name">NPI Cluster · 14 claims</span>
            <span class="cluster-detail">All show: <em>"missing rendering provider NPI on box 24j"</em></span>
            <span class="cluster-source">Source: Dr. Lila Smith / Smith Family Medicine</span>
          </div>
          <button class="btn ${npiResolved ? 'ghost disabled' : 'primary'}"
                  ${npiResolved ? 'disabled' : ''}
                  data-action="open-batch">
            ${npiResolved ? '✓ Batch fix applied' : 'Batch-fix all 14'}
          </button>
        </div>
        <table class="claims">
          <thead>
            <tr>
              <th>Patient</th>
              <th>CPT</th>
              <th>Charge</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${npiCluster.map(c => `
              <tr class="claim ${c.status}" data-action="inspect" data-id="${c.id}">
                <td>${escape(c.patient)}</td>
                <td><code>${escape(c.cpt)}</code> · ${escape(c.cptLabel)}</td>
                <td class="charge">${money(c.charge)}</td>
                <td>${statusBadge(c.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="cluster outliers">
        <div class="cluster-h">
          <div class="cluster-h-text">
            <span class="cluster-name">Outliers · 3 claims</span>
            <span class="cluster-detail">Different detail strings — sweep individually.</span>
          </div>
        </div>
        <table class="claims">
          <thead>
            <tr>
              <th>Patient</th>
              <th>CPT</th>
              <th>Charge</th>
              <th>Detail string</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${outliers.map(c => `
              <tr class="claim ${c.status}" data-action="open-outlier" data-cluster="${c.cluster}">
                <td>${escape(c.patient)}</td>
                <td><code>${escape(c.cpt)}</code> · ${escape(c.cptLabel)}</td>
                <td class="charge">${money(c.charge)}</td>
                <td class="detail">${escape(c.carcDetail)}</td>
                <td>${statusBadge(c.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function statusBadge(status: 'pending' | 'fixed' | 'no-action'): string {
  if (status === 'fixed') return '<span class="badge fixed">✓ FIXED</span>'
  if (status === 'no-action') return '<span class="badge noaction">— NO ACTION</span>'
  return '<span class="badge pending">PENDING</span>'
}

function renderInspector(): string {
  if (!state.inspectingClaimId) return ''
  const c = state.queue.find(q => q.id === state.inspectingClaimId)
  if (!c) return ''
  return `
    <div class="inspector-backdrop" data-action="close-inspect">
      <div class="inspector">
        <button class="inspector-close" data-action="close-inspect" aria-label="Close">×</button>
        <div class="inspector-h">
          <span class="inspector-tag">CLAIM INSPECTOR</span>
          <span class="inspector-sub">${escape(c.id)}</span>
        </div>
        <div class="inspector-body">
          <p><b>Patient:</b> ${escape(c.patient)}</p>
          <p><b>CPT:</b> <code>${escape(c.cpt)}</code> — ${escape(c.cptLabel)}</p>
          <p><b>Charge:</b> ${money(c.charge)}</p>
          <p><b>CARC detail:</b> "${escape(c.carcDetail)}"</p>
          <hr />
          <p class="inspector-note">${escape(c.note)}</p>
        </div>
      </div>
    </div>
  `
}

function renderBatchModal(): string {
  if (!state.batchFixOpen) return ''
  return `
    <div class="amend-modal-backdrop">
      <div class="amend-modal">
        <button class="amend-modal-close" data-action="close-batch" aria-label="Close">×</button>
        <div class="amend-modal-h">
          <span class="amend-tag">BATCH FIX · 14 CLAIMS · BOX 24J · NPI</span>
          <span class="amend-sub">Pick the right NPI. Applies to the whole cluster at once.</span>
        </div>
        <div class="amend-context">
          <strong>Smith Family Medicine ·</strong> Dr. Lila Smith's individual NPI per the NPPES registry. The billing module is sending '0000000000' because the EHR profile field is blank.
        </div>
        <ul class="amend-options">
          ${npiOptions.map(opt => {
            const fb = state.batchFeedback?.id === opt.id ? state.batchFeedback : null
            const isCurrent = opt.id === '0000000000'
            return `
              <li class="amend-option ${isCurrent ? 'current' : ''} ${fb ? 'rejected' : ''}"
                  ${isCurrent ? '' : `data-action="pick-batch" data-id="${opt.id}"`}>
                <div class="amend-option-h">
                  <code>${escape(opt.label)}</code>
                  ${isCurrent ? '<span class="amend-option-badge current">currently on every claim</span>' : ''}
                </div>
                ${fb ? `<div class="amend-option-fb">${escape(fb.message)}</div>` : ''}
              </li>
            `
          }).join('')}
        </ul>
        <p class="amend-hint-text">
          NPPES is the source of truth for provider identifiers. Wrong picks give feedback (no penalty).
        </p>
      </div>
    </div>
  `
}

function renderOutlierModal(): string {
  if (!state.outlierFixOpen) return ''
  const cluster = state.outlierFixOpen
  const claim = state.queue.find(c => c.cluster === cluster)
  if (!claim) return ''

  let prompt = ''
  let options: Array<{ id: string; label: string; correct: boolean; feedback: string }> = []
  let title = ''

  if (cluster === 'outlier-dx') {
    title = 'AMEND BOX 24E · DIAGNOSIS POINTER'
    prompt = "Box 24E (diagnosis pointer) is blank. Box 21 entry A is the only diagnosis on this claim — point at it."
    options = [
      { id: 'A', label: 'A — point at the only diagnosis on the claim', correct: true, feedback: 'Right call. Box 24E now points at Box 21A. Resubmits clean.' },
      { id: 'blank', label: '— leave blank, payer will figure it out', correct: false, feedback: "They will not figure it out. Blank dx pointer = CO-16 again. The pointer is required." },
      { id: 'X', label: 'X — placeholder', correct: false, feedback: "Pointers are letters A-D referencing existing Box 21 entries. X isn't valid." },
    ]
  } else if (cluster === 'outlier-pos') {
    title = 'AMEND BOX 24B · PLACE OF SERVICE'
    prompt = 'Marc was seen in clinic per the encounter note. Box 24B currently shows 99 (other), which is why CO-16 caught it.'
    options = [
      { id: '11', label: '11 — Office', correct: true, feedback: 'Office visit, POS 11. Matches the encounter note. Resubmits clean.' },
      { id: '22', label: '22 — On-campus outpatient hospital', correct: false, feedback: "He wasn't seen in a hospital outpatient department — he was seen in Smith Family Medicine's office. POS 22 would underpay; the office rate (POS 11) is right." },
      { id: '23', label: '23 — Emergency room', correct: false, feedback: "Not an ER visit. Wrong POS will trigger another denial — and ER reimbursement rates would also lift the payer's eyebrows." },
    ]
  } else if (cluster === 'outlier-clean') {
    title = 'INSPECT · IMANI EDWARDS'
    prompt = 'Every required field is populated. The clearinghouse heuristic flagged this as CO-16 by mistake.'
    options = [
      { id: 'no-action', label: 'Mark as no-action — leave on the resubmit queue as-is', correct: true, feedback: "Right call. Sometimes the right move is no move; this resubmits as-is and the clearinghouse won't false-positive it twice in a row." },
      { id: 'rebuild', label: 'Rebuild the 837 from scratch just to be safe', correct: false, feedback: 'Make-work — the claim is fine. Rebuilding doesn\'t reduce error rate; it raises it.' },
      { id: 'write-off', label: 'Write off the $220 charge', correct: false, feedback: "$220 left on the table for no reason. The claim is good — it just needs to resubmit." },
    ]
  }

  return `
    <div class="amend-modal-backdrop">
      <div class="amend-modal">
        <button class="amend-modal-close" data-action="close-outlier" aria-label="Close">×</button>
        <div class="amend-modal-h">
          <span class="amend-tag">${escape(title)}</span>
          <span class="amend-sub">${escape(claim.patient)} · ${escape(claim.cpt)} · ${money(claim.charge)}</span>
        </div>
        <div class="amend-context">
          <strong>Detail string:</strong> "${escape(claim.carcDetail)}". ${escape(prompt)}
        </div>
        <ul class="amend-options">
          ${options.map(opt => {
            const fb = state.outlierFeedback?.choice === opt.id ? state.outlierFeedback : null
            return `
              <li class="amend-option ${fb && !opt.correct ? 'rejected' : ''}"
                  data-action="pick-outlier" data-cluster="${cluster}" data-id="${opt.id}" data-correct="${opt.correct}">
                <div class="amend-option-h">
                  <span class="amend-option-label">${escape(opt.label)}</span>
                </div>
                ${fb ? `<div class="amend-option-fb">${escape(fb.message)}</div>` : ''}
              </li>
            `
          }).join('')}
        </ul>
      </div>
    </div>
  `
}

function renderUpstream(): string {
  const npiResolved = state.resolvedIssues.has('batch-npi')
  const ticketResolved = state.resolvedIssues.has('patch-upstream')
  if (!npiResolved) {
    return `
      <section class="upstream idle">
        <div class="upstream-h">
          <span class="upstream-tag">UPSTREAM</span>
          <span class="upstream-sub">Available after the cluster is fixed. Without an upstream patch, the same 14 claims become 28 next Monday.</span>
        </div>
      </section>
    `
  }
  return `
    <section class="upstream ${ticketResolved ? 'done' : 'active'}">
      <div class="upstream-h">
        <span class="upstream-tag">UPSTREAM · EHR PROFILE FIX</span>
        <span class="upstream-sub">Stop the bleeding at the source.</span>
      </div>
      <div class="upstream-body">
        <p>
          The 14 claims you just batch-fixed will resubmit
          clean — but next Monday's batch will look identical
          unless someone fixes Dr. Smith's profile in the
          ${term('EHR')}. The blank rendering-NPI field is
          falling through to the billing module, which
          defaults to '0000000000' instead of erroring.
        </p>
        <button class="btn primary ${ticketResolved ? 'disabled' : ''}"
                ${ticketResolved ? 'disabled' : ''}
                data-action="open-ticket">
          ${ticketResolved ? '✓ Ticket filed' : 'File EHR ticket'}
        </button>
      </div>
    </section>
  `
}

function renderTicketModal(): string {
  if (!state.ticketOpen) return ''
  return `
    <div class="amend-modal-backdrop">
      <div class="amend-modal ticket-modal">
        <button class="amend-modal-close" data-action="close-ticket" aria-label="Close">×</button>
        <div class="amend-modal-h">
          <span class="amend-tag">EHR · IT TICKET</span>
          <span class="amend-sub">Pre-filled from what we found. Review and file.</span>
        </div>
        <div class="ticket-body">
          <div class="ticket-row"><span class="ticket-label">Title</span><span class="ticket-value">Smith, L. — rendering NPI field blank in EHR profile</span></div>
          <div class="ticket-row"><span class="ticket-label">Severity</span><span class="ticket-value">Medium · 14 claims/week routinely affected</span></div>
          <div class="ticket-row"><span class="ticket-label">Affected provider</span><span class="ticket-value">Dr. Lila Smith · Smith Family Medicine</span></div>
          <div class="ticket-row"><span class="ticket-label">Correct NPI</span><span class="ticket-value"><code>${SMITH_TRUE_NPI}</code></span></div>
          <div class="ticket-row long">
            <span class="ticket-label">Description</span>
            <span class="ticket-value">
              EHR rendering-NPI field on Smith's provider profile is empty. Billing module defaults blank NPIs to '0000000000', producing CO-16 277CA rejections on every claim Smith touches. Two-part fix: (1) populate rendering NPI on the profile (use NPI ${SMITH_TRUE_NPI}, NPPES-verified), and (2) add a non-empty validator on the field so future profiles can't be saved with this blank.
            </span>
          </div>
        </div>
        <button class="btn primary" data-action="submit-ticket">File ticket</button>
      </div>
    </div>
  `
}

function renderChecklist(): string {
  const allResolved = state.resolvedIssues.size === issues.length
  return `
    <section class="checklist">
      <div class="checklist-h">Queue checklist — ${state.resolvedIssues.size} of ${issues.length} steps complete</div>
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
        RESUBMIT QUEUE — 18 CLAIMS
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

const RECAP: CaseRecap = CASE_RECAPS['swarm']

function renderVictory(): string {
  return `
    <section class="victory">
      <h2>The queue empties.</h2>
      <p class="register hospital">Hospital, Tuesday morning.</p>
      <p>
        Seventeen of the eighteen claims adjudicate clean
        overnight. The eighteenth (Imani's) sails through
        without anybody noticing the clearinghouse had
        false-positived it. The IT ticket comes back closed
        the same afternoon — Dr. Smith's profile is fixed and
        the billing module has a new validator. Next Monday's
        rejection batch from her clinic is two claims, not
        fourteen.
      </p>
      <p class="register waiting-room">Waiting Room.</p>
      <p>
        The Swarm is gone. Where it was, you can see clearly
        for the first time — eighteen tiny envelopes stacked
        neatly on a table, with one ten-digit number written
        on a small card on top. The number Dr. Smith's profile
        should have had all along.
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
            <li><b>Operates on a queue, not a single claim.</b> First prototype to do so. Eighteen rows; fourteen share one fix. Pattern detection comes before triage.</li>
            <li><b>The ClaimSheet is gone.</b> In its place: a queue table with cluster + outlier sections, status badges per row, and a click-to-inspect modal for each claim.</li>
            <li><b>"No action" is a valid move.</b> One outlier is a clearinghouse false positive — picking 'mark as no-action' is the correct answer. Rebuilding the 837 'just to be safe' is wrong.</li>
            <li><b>Patch-upstream is its own issue.</b> Fixing the 14 claims is half the encounter; filing the EHR ticket is the other half. Without both, the same 14 claims become 28 next Monday.</li>
            <li><b>Pre-filled IT ticket.</b> The ticket modal auto-populates from what the player found — affected provider, correct NPI, description. Models the "good ticket" rhythm: specific, actionable, with a fix proposed.</li>
          </ul>
        </div>
        <div>
          <h3>What this prototype proves (or tries to)</h3>
          <ul>
            <li>The framework absorbs queue-shaped work without breaking — same hospital intro, fall, Dana voice, checklist, submit; only the middle changed.</li>
            <li>Cluster + outlier is a teachable mental model that maps cleanly to a UI shape (one big group + small group + per-row inspection).</li>
            <li>"Look for the pattern before you start fixing things" reads as a teaching beat when the cluster header is visible from the start.</li>
            <li>Upstream-vs-downstream thinking can carry an issue slot. Most prototypes treat upstream as flavor; this one makes it a checklist item.</li>
            <li>The 'work, not health' reframe (queue depth instead of HP) lands when the queue is visible and the player can see it shrinking.</li>
          </ul>
        </div>
      </div>
      <p class="notes-cta">
        Side-by-side comparison: open
        <a href="./fog-prototype.html">Fog</a> for the other
        L2 prototype (single-claim upstream encounter)
        — both teach 'fix it before it ships' but at completely
        different scales (1 claim vs 18). Same shape, different
        unit of work.
      </p>
    </section>
  `
}

// === Interactions ===

function setFeedback(text: string, kind: 'good' | 'bad' | 'neutral' = 'neutral') {
  state.feedback = text
  state.feedbackKind = kind
}

function attemptBatch(npiId: string) {
  const opt = npiOptions.find(o => o.id === npiId)
  if (!opt) return
  if (opt.support !== 'correct') {
    state.failedAttempts += 1
    state.batchFeedback = { id: npiId, message: opt.feedback }
    return
  }
  // Apply to all NPI cluster rows.
  state.queue.forEach(c => {
    if (c.cluster === 'npi') c.status = 'fixed'
  })
  state.batchFixOpen = false
  state.batchFeedback = null
  state.resolvedIssues.add('batch-npi')
  const issue = issues.find(i => i.id === 'batch-npi')!
  setFeedback("Batch fix applied. All 14 NPI cluster rows now resubmit-ready.", 'good')
  state.lastRecap = issue.recap
}

function attemptOutlier(cluster: 'outlier-dx' | 'outlier-pos' | 'outlier-clean', choice: string, correct: boolean) {
  if (!correct) {
    state.failedAttempts += 1
    // Re-derive the matching feedback.
    const tempState = renderOutlierModalCheck(cluster, choice)
    state.outlierFeedback = { choice, message: tempState }
    return
  }
  // Mark this outlier resolved.
  state.queue.forEach(c => {
    if (c.cluster === cluster) c.status = (cluster === 'outlier-clean') ? 'no-action' : 'fixed'
  })
  state.outlierFixOpen = null
  state.outlierFeedback = null
  // If all three outliers are now non-pending, mark the sweep issue resolved.
  const outliersDone = state.queue
    .filter(c => c.cluster !== 'npi')
    .every(c => c.status !== 'pending')
  if (outliersDone && !state.resolvedIssues.has('sweep-outliers')) {
    state.resolvedIssues.add('sweep-outliers')
    const issue = issues.find(i => i.id === 'sweep-outliers')!
    setFeedback('All three outliers cleared. Triage complete.', 'good')
    state.lastRecap = issue.recap
  } else {
    setFeedback('Outlier resolved. Two outliers to go — keep sweeping.', 'good')
    state.lastRecap = ''
  }
}

// Helper: re-derive feedback string for a wrong outlier pick, mirroring
// the option text in renderOutlierModal. Kept inline to avoid a second
// source of truth — modal owns its options, attempt() asks for feedback.
function renderOutlierModalCheck(cluster: 'outlier-dx' | 'outlier-pos' | 'outlier-clean', choice: string): string {
  if (cluster === 'outlier-dx') {
    if (choice === 'blank') return "They will not figure it out. Blank dx pointer = CO-16 again. The pointer is required."
    if (choice === 'X') return "Pointers are letters A-D referencing existing Box 21 entries. X isn't valid."
  } else if (cluster === 'outlier-pos') {
    if (choice === '22') return "He wasn't seen in a hospital outpatient department — he was seen in Smith Family Medicine's office. POS 22 would underpay; the office rate (POS 11) is right."
    if (choice === '23') return "Not an ER visit. Wrong POS will trigger another denial — and ER reimbursement rates would also lift the payer's eyebrows."
  } else if (cluster === 'outlier-clean') {
    if (choice === 'rebuild') return "Make-work — the claim is fine. Rebuilding doesn't reduce error rate; it raises it."
    if (choice === 'write-off') return "$220 left on the table for no reason. The claim is good — it just needs to resubmit."
  }
  return 'Try again.'
}

function submitTicket() {
  state.ticketSubmitted = true
  state.ticketOpen = false
  state.resolvedIssues.add('patch-upstream')
  const issue = issues.find(i => i.id === 'patch-upstream')!
  setFeedback('EHR ticket filed. Stops the bleeding at the source.', 'good')
  state.lastRecap = issue.recap
}

function attemptSubmit() {
  if (state.resolvedIssues.size < issues.length) return
  state.packetSubmitted = true
  notifyParentVictory('swarm')
}

function reset() {
  state.briefingDone = false
  state.briefingOpen = false
  state.queue = initialQueue.map(c => ({ ...c }))
  state.inspectingClaimId = null
  state.batchFixOpen = false
  state.batchFeedback = null
  state.outlierFixOpen = null
  state.outlierFeedback = null
  state.ticketOpen = false
  state.ticketSubmitted = false
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
function openBatch() { state.batchFixOpen = true; state.batchFeedback = null }
function closeBatch() { state.batchFixOpen = false; state.batchFeedback = null }
function openOutlier(cluster: 'outlier-dx' | 'outlier-pos' | 'outlier-clean') {
  state.outlierFixOpen = cluster
  state.outlierFeedback = null
}
function closeOutlier() { state.outlierFixOpen = null; state.outlierFeedback = null }
function openTicket() { state.ticketOpen = true }
function closeTicket() { state.ticketOpen = false }
function openInspect(id: string) { state.inspectingClaimId = id }
function closeInspect() { state.inspectingClaimId = null }
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
    closeBatch(); closeOutlier(); closeTicket(); rerender(); return
  }
  // Inspector backdrop click closes inspector — but only if user clicked the backdrop itself, not children.
  const el = target.closest('[data-action]') as HTMLElement | null
  if (!el) return
  const action = el.dataset.action
  switch (action) {
    case 'inspect': if (el.dataset.id) openInspect(el.dataset.id); break
    case 'close-inspect':
      // Only close if the click landed on the backdrop or close button.
      if (target.classList.contains('inspector-backdrop') || target.classList.contains('inspector-close') || target.tagName === 'BUTTON') {
        closeInspect()
      } else {
        return
      }
      break
    case 'open-batch': openBatch(); break
    case 'close-batch': closeBatch(); break
    case 'pick-batch': if (el.dataset.id) attemptBatch(el.dataset.id); break
    case 'open-outlier':
      if (el.dataset.cluster === 'outlier-dx' || el.dataset.cluster === 'outlier-pos' || el.dataset.cluster === 'outlier-clean') {
        // Don't reopen on already-resolved outliers.
        const c = state.queue.find(q => q.cluster === el.dataset.cluster)
        if (c && c.status === 'pending') openOutlier(el.dataset.cluster)
      }
      break
    case 'close-outlier': closeOutlier(); break
    case 'pick-outlier':
      if (el.dataset.cluster && el.dataset.id) {
        attemptOutlier(
          el.dataset.cluster as 'outlier-dx' | 'outlier-pos' | 'outlier-clean',
          el.dataset.id,
          el.dataset.correct === 'true',
        )
      }
      break
    case 'open-ticket': openTicket(); break
    case 'close-ticket': closeTicket(); break
    case 'submit-ticket': submitTicket(); break
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

// Swarm-specific CSS — stats grid, queue tables (cluster + outliers),
// inspector overlay, upstream + ticket modals, status badges.
// Base styles via BASE_CSS.
const css = districtVars('eligibility') + BASE_CSS + `
  /* Stats */
  .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 18px; }
  @media (max-width: 880px) { .stats { grid-template-columns: repeat(2, 1fr); } }
  .stat-cell { background: var(--panel); border: 1px solid #232a36; border-radius: 8px; padding: 12px 16px; display: flex; flex-direction: column; gap: 4px; }
  .stat-cell.highlight { background: rgba(109, 200, 163, 0.06); border-color: #2c5547; }
  .stat-num { font-size: 22px; font-weight: 700; color: var(--ink); font-variant-numeric: tabular-nums; }
  .stat-cell.highlight .stat-num { color: var(--accent); }
  .stat-label { font-size: 11px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; }

  /* Queue */
  .queue { background: var(--panel); border: 1px solid #232a36; border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .queue-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .queue-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink); }
  .queue-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }

  .cluster { background: var(--panel-2); border-radius: 6px; padding: 12px 14px; margin-bottom: 14px; border-left: 3px solid var(--accent); transition: border-color 0.2s, background 0.3s; }
  .cluster.outliers { border-left-color: var(--accent-2); }
  .cluster.resolved { border-left-color: var(--good); background: rgba(126, 226, 193, 0.04); }
  .cluster-h { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; margin-bottom: 10px; flex-wrap: wrap; }
  .cluster-h-text { display: flex; flex-direction: column; gap: 4px; }
  .cluster-name { font-size: 13.5px; font-weight: 700; color: var(--ink); }
  .cluster-detail { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .cluster-source { font-size: 11px; color: var(--ink-dim); }

  .claims { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .claims th, .claims td { text-align: left; padding: 6px 8px; border-bottom: 1px solid rgba(35, 42, 54, 0.6); }
  .claims th { font-size: 10.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-dim); }
  .claims tr.claim { cursor: pointer; transition: background 0.12s; }
  .claims tr.claim:hover { background: rgba(255,255,255,0.025); }
  .claims tr.claim.fixed td { color: rgba(216, 222, 233, 0.5); }
  .claims tr.claim.no-action td { color: rgba(216, 222, 233, 0.5); }
  .claims .charge { text-align: right; font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .claims .detail { color: var(--ink-dim); font-style: italic; font-size: 11.5px; }

  .badge { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; padding: 2px 8px; border-radius: 3px; white-space: nowrap; }
  .badge.pending { background: rgba(239, 91, 123, 0.12); color: var(--bad); border: 1px solid #4a2a32; }
  .badge.fixed { background: rgba(126, 226, 193, 0.12); color: var(--good); border: 1px solid #2c5547; }
  .badge.noaction { background: rgba(138, 147, 163, 0.1); color: var(--ink-dim); border: 1px solid #2a3142; }

  /* Inspector overlay */
  .inspector-backdrop { position: fixed; inset: 0; background: rgba(10, 13, 18, 0.6); display: flex; align-items: center; justify-content: center; z-index: 90; padding: 20px; }
  .inspector { background: var(--panel); border: 1px solid var(--accent); border-radius: 8px; padding: 22px 26px; max-width: 540px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5); position: relative; }
  .inspector-close { position: absolute; top: 8px; right: 12px; background: transparent; border: none; color: var(--ink-dim); font-size: 28px; cursor: pointer; padding: 4px 10px; }
  .inspector-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px; }
  .inspector-tag { font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--accent); }
  .inspector-sub { font-size: 12px; color: var(--ink-dim); font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; }
  .inspector-body p { margin: 6px 0; font-size: 13px; }
  .inspector-body hr { border: none; border-top: 1px dashed #2a3142; margin: 12px 0; }
  .inspector-note { color: var(--ink-dim); font-size: 12.5px; line-height: 1.55; }

  /* Wider amend modal for outlier picks with descriptive labels. */
  .amend-modal { max-width: 660px; }

  /* Upstream */
  .upstream { background: var(--panel); border: 1px solid #232a36; border-left-width: 4px; border-radius: 8px; padding: 16px 18px; margin-bottom: 22px; }
  .upstream.idle { border-left-color: #2a3142; opacity: 0.6; }
  .upstream.active { border-left-color: var(--accent-2); }
  .upstream.done { border-left-color: var(--good); background: linear-gradient(180deg, rgba(126, 226, 193, 0.04), transparent); }
  .upstream-h { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
  .upstream-tag { font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .upstream.idle .upstream-tag { color: var(--ink-dim); }
  .upstream.active .upstream-tag { color: var(--accent-2); }
  .upstream.done .upstream-tag { color: var(--good); }
  .upstream-sub { font-size: 12px; color: var(--ink-dim); font-style: italic; }
  .upstream-body p { font-size: 13px; line-height: 1.55; margin: 0 0 12px; }

  /* Ticket modal */
  .ticket-modal { max-width: 720px; }
  .ticket-body { padding: 4px 0 12px; }
  .ticket-row { display: grid; grid-template-columns: 160px 1fr; gap: 14px; padding: 8px 0; border-bottom: 1px dashed #232a36; align-items: baseline; }
  .ticket-row.long { align-items: flex-start; }
  .ticket-row:last-child { border-bottom: none; }
  .ticket-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--ink-dim); }
  .ticket-value { font-size: 13px; line-height: 1.5; color: var(--ink); }

  /* Recap uses Swarm mint instead of warm orange. */
  .recap { background: rgba(109, 200, 163, 0.06); border-color: #2c5547; }
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
      if (state.batchFixOpen) { closeBatch(); changed = true }
      if (state.outlierFixOpen) { closeOutlier(); changed = true }
      if (state.ticketOpen) { closeTicket(); changed = true }
      if (state.inspectingClaimId) { closeInspect(); changed = true }
      if (changed) rerender()
    }
  })
}

mount()
