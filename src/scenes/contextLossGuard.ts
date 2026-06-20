// WebGL context-loss guard.
//
// On memory-constrained mobile devices the browser can drop the WebGL
// context out from under the game — typically during the peak-memory
// Hospital ↔ Waiting Room handoff. Without handling, the canvas goes
// blank or the tab appears to "crash."
//
// Phaser 3.90's WebGLRenderer already does the critical low-level work:
// it binds `webglcontextlost` / `webglcontextrestored`, calls
// `event.preventDefault()` (so the browser will attempt to restore
// rather than abandon the context), and rebuilds its GL resources +
// re-uploads textures on restore. What it does NOT do is tell the
// player anything — the canvas just freezes mid-recovery.
//
// This guard layers UX onto Phaser's renderer events:
//   • LOSE_WEBGL    → pause audio, show a calm overlay, arm a fallback.
//   • RESTORE_WEBGL → tear the overlay down, resume — player keeps their
//                     exact spot (no reload needed in the happy path).
//   • Fallback      → if the browser never fires `restored` (common on
//                     iOS after a true out-of-memory kill), offer a
//                     Reload button. Progress is saved continuously, so
//                     reloading returns to the Title → CONTINUE at the
//                     current level.

import Phaser from 'phaser'
import { debugEvent } from './debugRibbon'

const OVERLAY_ID = '__webgl_context_loss_overlay__'

export function installContextLossGuard(game: Phaser.Game) {
  const renderer = game.renderer
  // Phaser.AUTO can fall back to the Canvas renderer on devices without
  // WebGL — there's no GL context to lose, so nothing to guard.
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer)) return

  let lost = false
  let fallbackTimer: number | undefined

  const clearFallback = () => {
    if (fallbackTimer !== undefined) {
      window.clearTimeout(fallbackTimer)
      fallbackTimer = undefined
    }
  }

  const onLost = () => {
    if (lost) return
    lost = true
    debugEvent('webgl:context-lost')
    // Stop audio so the player isn't left with sound over a frozen
    // frame. Wrapped defensively — the sound manager may be mid-teardown.
    try { game.sound.pauseAll() } catch { /* ignore */ }
    showOverlay(false)
    // Some mobile browsers never fire `webglcontextrestored` after an
    // OOM kill. If we're still lost after a grace period, surface the
    // manual Reload path.
    clearFallback()
    fallbackTimer = window.setTimeout(() => {
      if (lost) showOverlay(true)
    }, 6000)
  }

  const onRestored = () => {
    debugEvent('webgl:context-restored')
    lost = false
    clearFallback()
    try { game.sound.resumeAll() } catch { /* ignore */ }
    removeOverlay()
  }

  renderer.on(Phaser.Renderer.Events.LOSE_WEBGL, onLost)
  renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, onRestored)
}

/** Build (or update) the recovery overlay. `withReload` adds the manual
 *  Reload button used when automatic restore doesn't arrive. */
function showOverlay(withReload: boolean) {
  let overlay = document.getElementById(OVERLAY_ID) as HTMLDivElement | null
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.id = OVERLAY_ID
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 9000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 18px;
      padding: 32px;
      text-align: center;
      background: rgba(10, 13, 18, 0.94);
      color: #f0d090;
      font: 14px/1.5 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      letter-spacing: 0.04em;
    `
    document.body.appendChild(overlay)
  }

  const heading = withReload
    ? 'The game ran low on graphics memory.'
    : 'Recovering…'
  const detail = withReload
    ? 'Your progress is saved. Reload to continue from the title screen.'
    : 'The display dropped out for a moment. Restoring the Waiting Room…'

  overlay.innerHTML = ''
  const h = document.createElement('div')
  h.textContent = heading
  h.style.cssText = 'font-weight: 700; font-size: 16px; color: #f0a868;'
  const p = document.createElement('div')
  p.textContent = detail
  p.style.cssText = 'max-width: 340px; opacity: 0.85;'
  overlay.append(h, p)

  if (withReload) {
    const btn = document.createElement('button')
    btn.textContent = 'Reload game'
    btn.style.cssText = `
      margin-top: 6px;
      background: #f0a868;
      color: #1b130a;
      border: 1px solid #f7c690;
      border-radius: 999px;
      padding: 12px 28px;
      font: 700 14px/1 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      letter-spacing: 0.08em;
      cursor: pointer;
    `
    btn.addEventListener('click', () => window.location.reload())
    overlay.appendChild(btn)
  }
}

function removeOverlay() {
  const overlay = document.getElementById(OVERLAY_ID)
  if (overlay && overlay.parentElement) overlay.parentElement.removeChild(overlay)
}
