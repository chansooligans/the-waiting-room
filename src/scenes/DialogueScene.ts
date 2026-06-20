import Phaser from 'phaser'
import { DIALOGUES } from '../content/dialogue'
import { unlockCodex, unlockTool, updateResources, saveGame, getState } from '../state'
import { isTouchDevice } from './device'
import { setTouchOverlayHidden } from './TouchOverlay'
import type { DialogueNode, DialogueChoice, DialogueEffect } from '../types'

// Speaker → color mapping. Each character gets their own tint on the
// speaker label so it's clear who's talking at a glance. Colors are
// keyed by the speaker string set on each DialogueNode.
const SPEAKER_COLORS: Record<string, string> = {
  Anjali: '#b8d4e8',         // soft cyan, matches her sprite shirt
  Dana: '#6da9e3',           // blue (revenue cycle)
  Kim: '#a8d8a8',            // green (registration)
  Jordan: '#d4a0d4',         // purple (PFS)
  'Dr. Martinez': '#f0eedc', // warm white (white coat)
  Pat: '#9bb0c8',            // slate (coding)
  Alex: '#a8a8b0',           // gray (IT/EDI)
  Sam: '#f0a868',            // orange (denials)
  Chloe: '#f4d06f',          // yellow (player ID badge)
  Intern: '#f4d06f',         // legacy label, retained for any unmigrated nodes
  'Carl Westbrook — Senior Partner': '#c9b074', // grey-gold, authoritative
  'Wendy Chen — Data Analytics':     '#7fb6d4', // cool data-blue
  'Mira Rivera — Compliance':        '#b5494a', // rule-red / maroon
  'Eddi — Observer':                 '#bdbcb4', // soft neutral, fades back
}
const SPEAKER_DEFAULT_COLOR = '#7ee2c1'
function colorForSpeaker(name: string): string {
  return SPEAKER_COLORS[name] ?? SPEAKER_DEFAULT_COLOR
}

export class DialogueScene extends Phaser.Scene {
  private currentNode!: DialogueNode
  private speakerText!: Phaser.GameObjects.Text
  private bodyText!: Phaser.GameObjects.Text
  private choiceTexts: Phaser.GameObjects.Text[] = []
  private textBox!: Phaser.GameObjects.Rectangle
  private callingScene!: string
  private bodyY!: number
  private onComplete?: (effects: any[]) => void
  private collectedEffects: any[] = []

  constructor() {
    super('Dialogue')
  }

  init(data: { dialogueKey: string; callingScene: string; onComplete?: (effects: any[]) => void }) {
    const node = DIALOGUES[data.dialogueKey]
    if (!node) throw new Error(`Unknown dialogue: ${data.dialogueKey}`)
    this.currentNode = node
    this.callingScene = data.callingScene
    this.onComplete = data.onComplete
    this.collectedEffects = []
  }

  create() {
    const { width, height } = this.scale
    // Mobile gets larger text + a taller box so dialogue is legible
    // without fullscreen. The box still anchors to the bottom of the
    // viewport so the player's view of the world is preserved above.
    const m = isTouchDevice()
    // Mobile sizes are huge because Phaser.Scale.FIT downscales the
    // 1920×1280 canvas to fit a phone viewport (typically ~5×).
    // 64/56 native → ~13/11 on a 390px-wide phone, ~22/19 on iPad
    // portrait. Was 36/32 last revision and still reading too small,
    // so bumping to "absurd-looking on desktop, correct on phone."
    const speakerSize = m ? 64 : 20
    const bodySize    = m ? 56 : 18
    const boxHeight   = m ? 560 : 200
    const speakerY    = height - boxHeight - 10
    const bodyY       = speakerY + speakerSize + 6

    this.textBox = this.add
      .rectangle(width / 2, height - boxHeight / 2, width - 40, boxHeight, 0x0e1116, 0.95)
      .setStrokeStyle(2, 0x2a323d)

    this.speakerText = this.add.text(40, speakerY, '', {
      fontSize: `${speakerSize}px`, fontFamily: 'monospace', color: '#7ee2c1', fontStyle: 'bold',
    })

    this.bodyY = bodyY
    this.bodyText = this.add.text(40, bodyY, '', {
      fontSize: `${bodySize}px`, fontFamily: 'monospace', color: '#d0d8e0',
      wordWrap: { width: width - 80 },
    })

    // Mobile: the touch d-pad + interact button live in the bottom
    // 200px of the viewport, exactly where the dialogue text box
    // sits. Hide the overlay while dialogue is active — it's not
    // useful here (advance by tapping the box / Space) and it
    // visually overlaps the text.
    setTouchOverlayHidden(true)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => setTouchOverlayHidden(false))

    this.showNode(this.currentNode)
  }

  private showNode(node: DialogueNode) {
    this.currentNode = node
    this.speakerText.setText(node.speaker)
    this.speakerText.setColor(colorForSpeaker(node.speaker))
    this.bodyText.setText(node.text)

    this.choiceTexts.forEach(t => t.destroy())
    this.choiceTexts = []

    const { width, height } = this.scale

    const m = isTouchDevice()
    // Choice text matches the body bump: 52px native ≈ 11px on a
    // phone, 18px on iPad. Step scaled up so multi-choice menus
    // don't crowd each other on bigger text.
    const choiceSize = m ? 52 : 17
    const choiceStep = m ? 88 : 30
    // Choices are placed just below the body text so they never
    // overlap on mobile when the NPC line wraps to many lines.
    const choiceGap  = m ? 60 : 16
    const choicesStartY = this.bodyY + this.bodyText.height + choiceGap

    // Filter choices by their `condition` against game state (e.g. a
    // descent option that should only appear once the relevant chart
    // has been pulled from Medical Records).
    const visibleChoices = (node.choices ?? []).filter(c => this.choiceVisible(c))

    if (visibleChoices.length > 0) {
      // Selected-choice highlight cursor: tracks the currently focused
      // option for arrow-key + Enter selection. Defaults to 0; mouse
      // hover and clicks update it so keyboard + pointer don't fight
      // each other.
      let selected = 0
      const choiceTexts: Phaser.GameObjects.Text[] = []
      const setSelected = (i: number) => {
        selected = ((i % visibleChoices.length) + visibleChoices.length) % visibleChoices.length
        choiceTexts.forEach((t, k) => {
          if (k === selected) {
            t.setColor('#ffffff')
            t.setText(`▸ ${visibleChoices[k].text}`)
          } else {
            t.setColor('#f4d06f')
            t.setText(`  ${visibleChoices[k].text}`)
          }
        })
      }

      visibleChoices.forEach((choice, i) => {
        const y = choicesStartY + i * choiceStep
        const ct = this.add.text(60, y, `  ${choice.text}`, {
          fontSize: `${choiceSize}px`, fontFamily: 'monospace', color: '#f4d06f',
        }).setInteractive({ useHandCursor: true })

        ct.on('pointerover', () => setSelected(i))
        ct.on('pointerdown', () => this.selectChoice(choice))

        choiceTexts.push(ct)
        this.choiceTexts.push(ct)
      })

      setSelected(0)

      // Keyboard navigation: ↑/↓ (or W/S) cycles the selection;
      // Enter/Space confirms. Listener cleaned up on scene shutdown
      // OR when a choice is selected (so a stray keystroke after
      // selection doesn't fire on the next dialogue node).
      const onKey = (e: KeyboardEvent) => {
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
          e.preventDefault()
          setSelected(selected + 1)
        } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
          e.preventDefault()
          setSelected(selected - 1)
        } else if (e.code === 'Enter' || e.code === 'Space') {
          e.preventDefault()
          window.removeEventListener('keydown', onKey)
          this.selectChoice(visibleChoices[selected])
        }
      }
      window.addEventListener('keydown', onKey)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey))
    } else if (node.next) {
      const advanceText = this.add.text(width - 60, height - 30, 'click or space ▸', {
        fontSize: m ? '40px' : '14px', fontFamily: 'monospace', color: '#5a6a7a',
      }).setOrigin(1, 0.5)
      this.choiceTexts.push(advanceText)

      const advanceFn = () => {
        const nextNode = DIALOGUES[node.next!]
        if (nextNode) this.showNode(nextNode)
      }

      // Click OR SPACE/ENTER advances. The calling scene's SPACE
      // handler is paused while this DialogueScene is active (the
      // caller called scene.pause()), so there's no double-bind.
      // Use `once` semantics so an accidental held Space doesn't
      // skip multiple lines.
      this.input.once('pointerdown', advanceFn)
      const onKey = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault()
          window.removeEventListener('keydown', onKey)
          advanceFn()
        }
      }
      window.addEventListener('keydown', onKey)
      // Ensure the listener doesn't outlive the scene if the dialogue
      // ends (or scene shuts down) before either input fires.
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey))
    } else {
      // Terminal node — no `next`, no `choices`. Wait for the player
      // to click / press Space before ending so they can actually
      // read the line. (Previously this called endDialogue() right
      // after setText, so single-line atmosphere dialogues like the
      // L10 auditors flashed and vanished.)
      const closeText = this.add.text(width - 60, height - 30, 'click or space to close ▸', {
        fontSize: m ? '40px' : '14px', fontFamily: 'monospace', color: '#5a6a7a',
      }).setOrigin(1, 0.5)
      this.choiceTexts.push(closeText)

      const closeFn = () => this.endDialogue()
      this.input.once('pointerdown', closeFn)
      const onKey = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault()
          window.removeEventListener('keydown', onKey)
          closeFn()
        }
      }
      window.addEventListener('keydown', onKey)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.removeEventListener('keydown', onKey))
    }
  }

  /** Evaluate a DialogueChoice's `condition` against current game
   *  state. Returns true if the choice should be visible. Currently
   *  supports chartPulled / chartNotPulled gates; add new condition
   *  kinds here as they appear in design. */
  private choiceVisible(choice: DialogueChoice): boolean {
    const cond = choice.condition
    if (!cond) return true
    const charts = getState().chartsPulled ?? {}
    if (cond.chartPulled && !charts[cond.chartPulled]) return false
    if (cond.chartNotPulled && charts[cond.chartNotPulled]) return false
    return true
  }

  private selectChoice(choice: DialogueChoice) {
    if (choice.effect) {
      this.collectedEffects.push(choice.effect)
    }

    if (choice.next) {
      const nextNode = DIALOGUES[choice.next]
      if (nextNode) {
        this.showNode(nextNode)
        return
      }
    }

    this.endDialogue()
  }

  private applyEffects() {
    for (const effect of this.collectedEffects) {
      if (effect.unlockCodex) unlockCodex(effect.unlockCodex)
      if (effect.addTool) unlockTool(effect.addTool)
      if (effect.reputationDelta) updateResources({ reputation: effect.reputationDelta })
      if (effect.cashDelta) updateResources({ cash: effect.cashDelta })
      if (effect.auditDelta) updateResources({ auditRisk: effect.auditDelta })
      if (effect.markChartHinted) {
        const st = getState()
        st.chartsHinted ??= {}
        st.chartsHinted[effect.markChartHinted] = true
      }
    }
    saveGame()
  }

  private endDialogue() {
    this.applyEffects()

    if (this.onComplete) {
      this.onComplete(this.collectedEffects)
    }

    const descentEffect = this.collectedEffects.find(e => e.triggerDescent)
    const formEffect = this.collectedEffects.find(e => e.triggerForm)

    if (descentEffect && descentEffect.triggerDescent) {
      // Stash the descent signal; the calling scene (Hospital) picks it
      // up on `resume` and plays the descent animation. Doing it that
      // way keeps all the animation + camera plumbing in HospitalScene
      // instead of duplicating it here.
      const state = getState()
      state.pendingDescent = descentEffect.triggerDescent
      saveGame()
      this.scene.stop()
      this.scene.resume(this.callingScene)
    } else if (formEffect) {
      this.scene.stop()
      this.scene.stop(this.callingScene)
      this.scene.start('Form', { caseId: formEffect.triggerForm })
    } else {
      this.scene.stop()
      this.scene.resume(this.callingScene)
    }
  }
}
