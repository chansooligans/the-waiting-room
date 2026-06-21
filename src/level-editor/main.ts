// Level / case-order editor.
//
// Mounted at /level-editor.html. Reads CASE_ORDER from
// src/content/case-order.ts, renders the 32 cases as a draggable
// vertical list, and lets the user reorder them. The output is a
// paste-back TypeScript snippet (the full `CASE_ORDER` array
// literal) that can be dropped back into the source file.
//
// This is a planning surface, not the production-game level
// authority. The eventual goal is "one level per case" and
// regenerating `levels.ts` from this ordering, but for now the
// purpose is just to iterate on the narrative sequence.

import { CASE_ORDER, type CaseEntry, type District } from '../content/case-order'
import { isLevelEnabled } from '../content/levels'

const DISTRICT_COLORS: Record<District, { fg: string; bg: string; border: string }> = {
  eligibility:    { fg: '#7ee2c1', bg: 'rgba(126, 226, 193, 0.10)', border: '#3a6b58' },
  coding:         { fg: '#f0a868', bg: 'rgba(240, 168, 104, 0.10)', border: '#6b4d36' },
  billing:        { fg: '#ef5b7b', bg: 'rgba(239, 91, 123, 0.10)', border: '#6b3742' },
  appeals:        { fg: '#b18bd6', bg: 'rgba(177, 139, 214, 0.10)', border: '#54426b' },
  'release-valve':{ fg: '#e8c074', bg: 'rgba(232, 192, 116, 0.10)', border: '#6b5938' },
}

interface EditorState {
  order: CaseEntry[]
  /** Index currently being dragged, null when no drag active. */
  draggingIdx: number | null
  /** Index the dragged item will land at if dropped right now. */
  hoverIdx: number | null
}

const state: EditorState = {
  order: CASE_ORDER.slice(),
  draggingIdx: null,
  hoverIdx: null,
}

function $(sel: string): HTMLElement {
  const el = document.querySelector(sel)
  if (!el) throw new Error(`No element matches ${sel}`)
  return el as HTMLElement
}

function render() {
  const list = $('#case-list')
  list.innerHTML = state.order.map((c, i) => renderCard(c, i)).join('')
  attachDragHandlers()
  updateSummary()
}

function renderCard(c: CaseEntry, i: number): string {
  const palette = DISTRICT_COLORS[c.district]
  const dragging = state.draggingIdx === i ? ' dragging' : ''
  const dropTop = state.hoverIdx === i && state.draggingIdx !== null && state.draggingIdx > i
    ? ' drop-target-top' : ''
  const dropBot = state.hoverIdx === i && state.draggingIdx !== null && state.draggingIdx < i
    ? ' drop-target-bot' : ''
  const specChip = c.hasRuntimeSpec
    ? '<span class="chip-spec">in-game</span>'
    : '<span class="chip-catalog">catalog-only</span>'
  const legacyChip = c.legacyLevel != null
    ? `<span class="chip-legacy">prev L${c.legacyLevel}</span>`
    : ''
  const diffColor = difficultyColor(c.difficulty)
  const diffChip = `<span class="chip-diff" style="color:${diffColor.fg};background:${diffColor.bg};border-color:${diffColor.border}" title="Difficulty: ${c.difficulty}/10">diff ${c.difficulty}</span>`
  // Level slot i+1 — dim + tag the card when that slot is skipped in the
  // game flow (ENABLED_LEVELS in levels.ts). The status follows the slot,
  // not the case, so it stays meaningful while you drag-reorder.
  const skipped = !isLevelEnabled(i + 1)
  const skippedClass = skipped ? ' skipped' : ''
  const skippedChip = skipped ? '<span class="chip-skipped">skipped</span>' : ''
  return `
    <div class="card${dragging}${dropTop}${dropBot}${skippedClass}" draggable="true" data-idx="${i}">
      <div class="grip" aria-label="drag to reorder">⋮⋮</div>
      <div class="pos">L${i + 1}</div>
      <div class="body">
        <div class="head">
          <span class="name">${esc(c.name)}</span>
          <span class="archetype">${esc(c.archetype)}</span>
        </div>
        <div class="gloss">${esc(c.gloss)}</div>
        <div class="chips">
          ${skippedChip}
          ${diffChip}
          <span class="chip-district" style="color:${palette.fg};background:${palette.bg};border-color:${palette.border}">${esc(c.district)}</span>
          ${specChip}
          ${legacyChip}
          <span class="chip-id">${esc(c.id)}</span>
        </div>
      </div>
      <div class="nudge">
        <button data-act="up" data-idx="${i}" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button data-act="down" data-idx="${i}" title="Move down" ${i === state.order.length - 1 ? 'disabled' : ''}>↓</button>
      </div>
    </div>
  `
}

function attachDragHandlers() {
  const cards = document.querySelectorAll('.card') as NodeListOf<HTMLElement>
  cards.forEach(card => {
    const idx = parseInt(card.dataset.idx ?? '-1', 10)
    card.addEventListener('dragstart', (e: DragEvent) => {
      state.draggingIdx = idx
      e.dataTransfer?.setData('text/plain', String(idx))
      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
      // Re-render lazily so card gets the .dragging visual.
      requestAnimationFrame(render)
    })
    card.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
      if (state.hoverIdx !== idx) {
        state.hoverIdx = idx
        render()
      }
    })
    card.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault()
      const from = state.draggingIdx
      const to = idx
      if (from != null && from !== to) {
        const [moved] = state.order.splice(from, 1)
        state.order.splice(to, 0, moved)
      }
      state.draggingIdx = null
      state.hoverIdx = null
      render()
    })
    card.addEventListener('dragend', () => {
      state.draggingIdx = null
      state.hoverIdx = null
      render()
    })
  })

  // Up/down nudge buttons (mobile-friendly alternative to drag).
  document.querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      const target = e.currentTarget as HTMLButtonElement
      const act = target.dataset.act
      const idx = parseInt(target.dataset.idx ?? '-1', 10)
      if (idx < 0) return
      if (act === 'up' && idx > 0) {
        const [m] = state.order.splice(idx, 1)
        state.order.splice(idx - 1, 0, m)
      } else if (act === 'down' && idx < state.order.length - 1) {
        const [m] = state.order.splice(idx, 1)
        state.order.splice(idx + 1, 0, m)
      }
      render()
    })
  })
}

/** Heat-map color for the difficulty chip — green-leaning at 1,
 *  amber mid, red at 10. Saturation kept low so the chip doesn't
 *  scream louder than the district color. */
function difficultyColor(d: number): { fg: string; bg: string; border: string } {
  if (d <= 2) return { fg: '#7ee2c1', bg: 'rgba(126, 226, 193, 0.10)', border: '#3a6b58' }
  if (d <= 4) return { fg: '#a8d878', bg: 'rgba(168, 216, 120, 0.10)', border: '#4a6b3a' }
  if (d <= 6) return { fg: '#f4d06f', bg: 'rgba(244, 208, 111, 0.10)', border: '#6b5938' }
  if (d <= 8) return { fg: '#f0a868', bg: 'rgba(240, 168, 104, 0.10)', border: '#6b4d36' }
  return            { fg: '#ef5b7b', bg: 'rgba(239, 91, 123, 0.10)', border: '#6b3742' }
}

function updateSummary() {
  const summary = $('#summary')
  const byDistrict: Record<string, number> = {}
  for (const c of state.order) {
    byDistrict[c.district] = (byDistrict[c.district] ?? 0) + 1
  }
  const playable = state.order.filter(c => c.hasRuntimeSpec).length
  const active = state.order.filter((_, i) => isLevelEnabled(i + 1)).length
  const skipped = state.order.length - active
  const dChips = Object.entries(byDistrict)
    .map(([d, n]) => {
      const p = DISTRICT_COLORS[d as District]
      return `<span class="sum-chip" style="color:${p.fg};background:${p.bg};border-color:${p.border}">${esc(d)} · ${n}</span>`
    }).join('')
  summary.innerHTML = `
    <div class="sum-row">
      <strong>${state.order.length}</strong> levels
      · <strong>${active}</strong> active${skipped ? ` · <span style="color:#ef5b7b">${skipped} skipped</span>` : ''}
      · <strong>${playable}</strong> in-game playable
      · ${dChips}
    </div>
  `
}

function copyTsLiteral() {
  const tsLines: string[] = ['export const CASE_ORDER: CaseEntry[] = [']
  for (const c of state.order) {
    tsLines.push('  {')
    tsLines.push(`    id: ${JSON.stringify(c.id)},`)
    tsLines.push(`    name: ${JSON.stringify(c.name)},`)
    tsLines.push(`    archetype: ${JSON.stringify(c.archetype)},`)
    tsLines.push(`    district: ${JSON.stringify(c.district)},`)
    tsLines.push(`    hasRuntimeSpec: ${c.hasRuntimeSpec},`)
    tsLines.push(`    legacyLevel: ${c.legacyLevel === null ? 'null' : c.legacyLevel},`)
    tsLines.push(`    gloss: ${JSON.stringify(c.gloss)},`)
    tsLines.push(`    difficulty: ${c.difficulty},`)
    tsLines.push('  },')
  }
  tsLines.push(']')
  const ts = tsLines.join('\n')
  navigator.clipboard.writeText(ts).then(
    () => flashStatus('Copied. Paste back into src/content/case-order.ts (replace the existing CASE_ORDER assignment).'),
    () => fallbackCopy(ts),
  )
}

function copyIdsOnly() {
  const ids = state.order.map(c => c.id)
  const ts = 'const ORDER = [\n' + ids.map(id => `  ${JSON.stringify(id)},`).join('\n') + '\n]'
  navigator.clipboard.writeText(ts).then(
    () => flashStatus('Copied ids only.'),
    () => fallbackCopy(ts),
  )
}

function resetOrder() {
  if (!confirm('Reset to the original CASE_ORDER from the source file?')) return
  state.order = CASE_ORDER.slice()
  render()
  flashStatus('Reset.')
}

function sortByDifficulty() {
  state.order = state.order.slice().sort((a, b) => a.difficulty - b.difficulty)
  render()
  flashStatus('Sorted by difficulty (easiest first). Tweak from here.')
}

function fallbackCopy(text: string) {
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:80vw;height:60vh;z-index:9999;padding:10px;font:11px/1.4 ui-monospace,Menlo,monospace;background:#0a0e14;color:#d8dee9;border:1px solid #2a3142;'
  document.body.appendChild(ta)
  ta.select()
  alert("Couldn't auto-copy. Cmd/Ctrl+C from the textarea, then dismiss.")
  ta.remove()
}

function flashStatus(msg: string) {
  const el = $('#status')
  el.textContent = msg
  el.style.opacity = '1'
  setTimeout(() => { el.style.opacity = '0' }, 3500)
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

document.addEventListener('DOMContentLoaded', () => {
  render()
  $('#copy-ts').addEventListener('click', copyTsLiteral)
  $('#copy-ids').addEventListener('click', copyIdsOnly)
  $('#sort-diff').addEventListener('click', sortByDifficulty)
  $('#reset').addEventListener('click', resetOrder)
})
