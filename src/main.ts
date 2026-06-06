import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { IntroScene } from './scenes/IntroScene'
import { TitleScene } from './scenes/TitleScene'
import { HospitalScene } from './scenes/HospitalScene'
import { DialogueScene } from './scenes/DialogueScene'
import { PuzzleBattleScene } from './scenes/PuzzleBattleScene'
import { PrototypeIframeScene } from './scenes/PrototypeIframeScene'
import { FormScene } from './scenes/FormScene'
import { WaitingRoomScene } from './scenes/WaitingRoomScene'
import { CodexScene } from './scenes/CodexScene'
import { TipsTerminalScene } from './scenes/TipsTerminalScene'
import { TouchOverlay } from './scenes/TouchOverlay'
import { installDevPanel } from './dev/devPanel'
import { installDebugRibbon, debugEvent } from './scenes/debugRibbon'
import { addFullscreenButton } from './scenes/fullscreenButton'
import { addMuteButton } from './scenes/muteButton'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  // Bumped from 960×640 to 1920×1280 in the TILE=32→64 resolution
  // upgrade. Exactly 2× the prior canvas (same 8:5 aspect), so at
  // TILE=64 the visible field of view is the same 30×20 tiles the
  // game has always rendered — just with each tile drawn at 4× the
  // pixel area. Keeps camera zoom at 1.0 for pixel-perfect rendering
  // (no fractional nearest-neighbor scaling), and Phaser's
  // Scale.FIT handles the down-scale to whatever the player's
  // viewport actually is.
  width: 1920,
  height: 1280,
  parent: 'game',
  pixelArt: true,
  backgroundColor: '#0e1116',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, IntroScene, TitleScene, HospitalScene, DialogueScene, PuzzleBattleScene, PrototypeIframeScene, FormScene, WaitingRoomScene, CodexScene, TipsTerminalScene, TouchOverlay],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
}

const game = new Phaser.Game(config)
;(window as any).__PHASER_GAME__ = game

// Mobile audio unlock. iOS Safari and Android Chrome create the
// AudioContext in `suspended` state until a user gesture. Phaser
// has its own unlock, but it can miss taps on DOM overlays
// (touch d-pad, mute/fullscreen buttons, anything outside the
// canvas) — and on iOS it sometimes doesn't fire at all. Bind
// our own one-shot listener in capture phase on the document so
// any user gesture (tap, click, key) resumes the context and
// drains Phaser's pending sound queue.
const unlockAudio = () => {
  // Just resume the AudioContext — do NOT touch sm.locked or call
  // sm.unlock(). Phaser's own unlock handler (body-level, bubble phase)
  // checks `if (!this.locked) return` at the top; if we set locked=false
  // first, Phaser's handler bails without emitting 'unlocked' or draining
  // the queued sound queue. Our role is only to call ctx.resume() early
  // (capture phase) so the context is running by the time Phaser's handler
  // fires and completes its flow.
  const sm = game.sound as Phaser.Sound.BaseSoundManager & {
    context?: AudioContext
  }
  const ctx = sm.context
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().then(() => {
      debugEvent('audio-unlocked')
    }).catch(() => {})
  } else {
    debugEvent('audio-unlocked')
  }
  document.removeEventListener('touchstart', unlockAudio, true)
  document.removeEventListener('touchend', unlockAudio, true)
  document.removeEventListener('mousedown', unlockAudio, true)
  document.removeEventListener('click', unlockAudio, true)
  document.removeEventListener('keydown', unlockAudio, true)
}
document.addEventListener('touchstart', unlockAudio, true)
document.addEventListener('touchend', unlockAudio, true)
document.addEventListener('mousedown', unlockAudio, true)
document.addEventListener('click', unlockAudio, true)
document.addEventListener('keydown', unlockAudio, true)

installDevPanel()
installDebugRibbon()
// Fullscreen + mute are pure DOM globals — mount them once at game
// init so they're always present regardless of which scene is active.
// Pass `null as any` since the Phaser scene argument is unused.
addFullscreenButton(null as unknown as Phaser.Scene)
addMuteButton(null as unknown as Phaser.Scene)

// Track scene starts via the SceneManager event so the ribbon shows
// transitions even from code paths we haven't manually instrumented.
game.events.on(Phaser.Core.Events.READY, () => {
  for (const s of game.scene.scenes) {
    s.events.on(Phaser.Scenes.Events.START, () => debugEvent(`start ${s.scene.key}`))
    s.events.on(Phaser.Scenes.Events.SHUTDOWN, () => debugEvent(`shut ${s.scene.key}`))
  }
})
