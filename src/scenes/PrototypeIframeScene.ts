// PrototypeIframeScene — mounts a standalone Case prototype page in
// an iframe overlay so every Case becomes an in-game playable
// encounter without duplicating its puzzle logic into the runtime.
// This is the game's sole battle scene: every engageable encounter
// routes here via its `prototypeIframeUrl`.
//
// Flow:
//   1. Hospital → descent → this scene starts with `{ encounterId }`.
//   2. The encounter's `prototypeIframeUrl` is loaded into an iframe
//      with `?embedded=1` appended; the prototype reads that flag
//      from prototype-base.isEmbedded() and posts a `case-completed`
//      message back when it wins.
//   3. On message, handleCaseComplete runs the game-side bookkeeping
//      (defeatedObstacles.push, unlockCodex, unlockTool,
//       pendingClaimSubmitted, saveGame, checkLevelProgression) and
//      then the player dismisses the recap to fade out + return.
//
// The iframe is the prototype's own DOM — its CSS, its event
// handling, its victory animation. We just listen for the postMessage
// signal and run the game-side bookkeeping when it fires.

import Phaser from 'phaser'
import { safeFinishSoundTween } from './soundFadeHelper'
import { ENCOUNTERS } from '../content/enemies'
import { CASES } from '../content/cases'
import {
  getState,
  saveGame,
  unlockCodex,
  unlockTool,
  updateResources,
  checkLevelProgression,
} from '../state'
import { debugEvent } from './debugRibbon'

const OVERLAY_ID = '__prototype_iframe_overlay__'

interface InitData {
  encounterId?: string
  returnScene?: string
}

export class PrototypeIframeScene extends Phaser.Scene {
  private encounterId!: string
  private returnScene!: string
  private overlay!: HTMLDivElement
  private iframe!: HTMLIFrameElement
  private leaveBtn!: HTMLButtonElement
  private returnBtn?: HTMLButtonElement
  private messageHandler!: (e: MessageEvent) => void
  private keyHandler!: (e: KeyboardEvent) => void
  private fadingOut = false
  private caseCompleted = false

  constructor() {
    super('PrototypeIframe')
  }

  init(data: InitData) {
    this.encounterId = data.encounterId ?? ''
    this.returnScene = data.returnScene ?? 'Hospital'
    const enc = ENCOUNTERS[this.encounterId]
    if (!enc) throw new Error(`Unknown encounter: ${this.encounterId}`)
    if (!enc.prototypeIframeUrl) {
      throw new Error(`Encounter ${this.encounterId} has no prototypeIframeUrl`)
    }
  }

  create() {
    this.cameras.main.setBackgroundColor(0x05070a)
    this.cameras.main.fadeIn(450, 0, 0, 0)
    this.installOverlay()
    this.attachHandlers()

    // Auto-unlock codex on first sight.
    const gs = getState()
    const enc = ENCOUNTERS[this.encounterId]
    if (!gs.obstaclesSeen.includes(enc.id)) {
      gs.obstaclesSeen.push(enc.id)
      unlockCodex(enc.codexOnSight ?? enc.id)
      saveGame()
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown())
  }

  private installOverlay() {
    let overlay = document.getElementById(OVERLAY_ID) as HTMLDivElement | null
    if (!overlay) {
      overlay = document.createElement('div')
      overlay.id = OVERLAY_ID
      overlay.style.position = 'fixed'
      overlay.style.inset = '0'
      overlay.style.zIndex = '500'
      overlay.style.background = '#0a0d12'
      const game = document.getElementById('game')
      ;(game ?? document.body).appendChild(overlay)
    }
    this.overlay = overlay

    const enc = ENCOUNTERS[this.encounterId]
    // Prefix with the runtime base URL so the iframe resolves correctly
    // on GitHub Pages (/the-waiting-room/) as well as locally (/).
    // BASE_URL ends with '/' and prototypeIframeUrl starts with '/', so
    // strip the trailing slash from base to avoid a double slash.
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    const url = `${base}${enc.prototypeIframeUrl!}?embedded=1`

    overlay.innerHTML = ''
    const iframe = document.createElement('iframe')
    iframe.src = url
    iframe.style.position = 'absolute'
    iframe.style.inset = '0'
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.border = '0'
    iframe.style.background = '#0a0d12'
    iframe.title = enc.title
    overlay.appendChild(iframe)
    this.iframe = iframe

    // Small "leave" button in the top-right so the player can bail
    // without solving (the flee path).
    const leaveBtn = document.createElement('button')
    leaveBtn.textContent = '⏎ Leave'
    leaveBtn.style.cssText = `
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 600;
      background: rgba(14, 20, 32, 0.92);
      color: #f0a868;
      border: 1px solid #4a3a2a;
      border-radius: 999px;
      padding: 6px 14px;
      font: 700 11px/1 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      letter-spacing: 0.1em;
      cursor: pointer;
      opacity: 0.7;
    `
    leaveBtn.addEventListener('click', () => this.handleFlee())
    overlay.appendChild(leaveBtn)
    this.leaveBtn = leaveBtn

    // DEV-only one-click solver. Rendered at the parent overlay level
    // since the prototype's own HTML doesn't ship one. Tree-shakes out
    // of prod via import.meta.env.DEV.
    if (import.meta.env.DEV) {
      const solveBtn = document.createElement('button')
      solveBtn.textContent = '🐛 SOLVE'
      solveBtn.title = 'DEV: skip the case — fires the victory flow'
      solveBtn.style.cssText = `
        position: fixed;
        bottom: 12px;
        right: 12px;
        z-index: 600;
        background: rgba(14, 20, 32, 0.92);
        color: #f0a868;
        border: 1px solid #4a3a2a;
        border-radius: 999px;
        padding: 6px 12px;
        font: 700 11px/1 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
        letter-spacing: 0.1em;
        cursor: pointer;
        opacity: 0.6;
      `
      solveBtn.addEventListener('mouseenter', () => (solveBtn.style.opacity = '1'))
      solveBtn.addEventListener('mouseleave', () => (solveBtn.style.opacity = '0.6'))
      solveBtn.addEventListener('click', () => this.handleCaseComplete())
      overlay.appendChild(solveBtn)
    }
  }

  private attachHandlers() {
    this.messageHandler = (e: MessageEvent) => {
      // We accept messages from our own origin (the prototype runs
      // in the same origin as the game). For dev safety, validate
      // the message shape before acting.
      const data = e.data as { type?: string; caseId?: string } | undefined
      if (!data || typeof data !== 'object') return
      if (data.type !== 'case-completed') return
      this.handleCaseComplete()
    }
    window.addEventListener('message', this.messageHandler)

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // ESC = flee. Don't consume in the iframe — at the parent level.
        this.handleFlee()
      }
    }
    window.addEventListener('keydown', this.keyHandler)
  }

  /** Game-side bookkeeping for a win. The iframe handled the win-state
   *  UI; we just record it in game state and transition out
   *  cinematically once the player dismisses the recap. */
  private handleCaseComplete() {
    if (this.caseCompleted) return  // Idempotent: ignore duplicate messages.
    this.caseCompleted = true

    const gs = getState()
    const enc = ENCOUNTERS[this.encounterId]
    if (!gs.defeatedObstacles.includes(this.encounterId)) {
      gs.defeatedObstacles.push(this.encounterId)
    }
    updateResources({ stress: -3 })
    unlockCodex(enc.id)
    for (const tool of enc.unlocksOnDefeat ?? []) unlockTool(tool)
    // The wake-up "CLAIM SUBMITTED" overlay shows this string. Resolve
    // the encounter's internal caseId to the human-facing claim number
    // (e.g. "CLM-2026-05-02-00118") — showing the raw `case_intro_patel`
    // id leaked an internal identifier into the UI.
    const claimNumber = enc.caseId
      ? (CASES[enc.caseId]?.claim?.claimId ?? null)
      : null
    gs.pendingClaimSubmitted = {
      encounterId: this.encounterId,
      claimId: claimNumber,
    }
    saveGame()
    const before = gs.currentLevel
    const newLvl = checkLevelProgression()
    debugEvent(`prototype-iframe submit ${this.encounterId}`)
    if (newLvl !== null) debugEvent(`level:advance ${before}->${newLvl}`)

    // Don't auto-return — the prototype just rendered its victory
    // recap, and the player needs time to actually read it. Surface a
    // "Return to game" button and let them dismiss it when ready. The
    // Red Room ambience keeps looping underneath until they click.
    this.showReturnButton()
  }

  /** Replace the bail-out "Leave" affordance with a prominent
   *  "Return to game" button once the case is won. Clicking it runs
   *  the same cinematic fade + return as the old auto-timer did. */
  private showReturnButton() {
    // The "Leave" button applies a stress penalty (it's the flee
    // path). After a win that's wrong — hide it so the only exit is
    // the clean return.
    if (this.leaveBtn) this.leaveBtn.style.display = 'none'

    if (this.returnBtn) return
    const btn = document.createElement('button')
    btn.textContent = 'Return to game →'
    // No entrance animation: this is the only exit from a won encounter,
    // so it must NEVER depend on a CSS animation completing. A prior
    // version used `animation: ... both` starting from opacity:0, which
    // left the button invisible whenever the animation was throttled
    // (background tab, slow device, reduced-motion) — the "missing
    // Return to game button" bug. The button is now visible the instant
    // it mounts.
    btn.style.cssText = `
      position: fixed;
      bottom: 28px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 600;
      opacity: 1;
      background: #f0a868;
      color: #1b130a;
      border: 1px solid #f7c690;
      border-radius: 999px;
      padding: 13px 30px;
      font: 700 14px/1 ui-monospace, "SF Mono", Menlo, Consolas, monospace;
      letter-spacing: 0.08em;
      cursor: pointer;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.45);
    `
    btn.addEventListener('click', () => {
      if (this.fadingOut) return
      btn.disabled = true
      btn.style.opacity = '0.6'
      this.fadeOutAndReturn(1200)
    })
    this.overlay.appendChild(btn)
    this.returnBtn = btn
  }

  private handleFlee() {
    // Once the case is won, ESC is just a clean exit — no flee
    // penalty (the win was already recorded), and we use the slower
    // cinematic fade to match the "Return to game" button.
    if (this.caseCompleted) {
      this.fadeOutAndReturn(1200)
      return
    }
    // Stress penalty + quick fade — the flee path.
    updateResources({ stress: +2 })
    saveGame()
    this.fadeOutAndReturn(400)
  }

  private fadeOutAndReturn(durationMs: number) {
    if (this.fadingOut) return  // Idempotent: one transition only.
    this.fadingOut = true
    this.overlay.style.transition = `opacity ${durationMs}ms ease-out`
    this.overlay.style.opacity = '0'
    this.cameras.main.fadeOut(durationMs, 0, 0, 0)
    this.fadeOutRedRoomAmbience(durationMs)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this._transitionToReturn()
    })
    this.time.delayedCall(durationMs + 100, () => {
      if (this.scene.isActive(this.scene.key)) {
        this._transitionToReturn()
      }
    })
  }

  /** Wake a sleeping Hospital rather than recreating it from scratch.
   *  Without this, the iframe-return path fully restarted Hospital,
   *  losing the wake-
   *  handler's player + NPC visibility resets and forcing a 10k-tile
   *  rebuild on mobile. Falls back to scene.start for any return
   *  scene that isn't sleeping. */
  private _transitionToReturn() {
    const sleeping = this.scene.isSleeping(this.returnScene)
    debugEvent(`return:${this.returnScene} sleeping=${sleeping}`)
    if (sleeping) {
      this.scene.stop()
      this.scene.wake(this.returnScene)
    } else {
      this.scene.start(this.returnScene)
    }
  }

  private fadeOutRedRoomAmbience(durationMs: number) {
    for (const key of ['red_room_1', 'red_room_2', 'red_room_3']) {
      const s = this.sound.get(key)
      if (!s || !s.isPlaying) continue
      this.tweens.add({
        targets: s,
        volume: 0,
        duration: durationMs,
        onComplete: () => {
          // Stop + destroy via the cross-scene-safe helper. See
          // soundFadeHelper.ts for the race this guards against.
          safeFinishSoundTween(this.game, s)
        },
      })
    }
  }

  private teardown() {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler)
    }
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler)
    }
    const overlay = document.getElementById(OVERLAY_ID)
    if (overlay && overlay.parentElement) overlay.parentElement.removeChild(overlay)
  }
}
