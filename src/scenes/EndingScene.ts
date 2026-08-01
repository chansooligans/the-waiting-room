// EndingScene — the game's actual ending. Reached when the player
// clicks "Return to game" after beating `boss_audit` (The Quarterly
// Audit, L32, the finale) — see PrototypeIframeScene._transitionToReturn,
// which special-cases that one encounter id and routes here instead of
// waking Hospital. Replaces the old "hidden Turquoise Lounge reveal"
// ending with a share screen: a short recap + one-click links to post
// a completion message to LinkedIn, Facebook, Instagram, and X.
//
// Instagram has no web share-intent URL (unlike the other three), so
// its button instead copies the message to the clipboard and opens
// instagram.com — the player pastes it into a Story or post.

import Phaser from 'phaser'
import { getState } from '../state'

const GAME_URL = 'https://chansooligans.github.io/the-waiting-room/'
const SHARE_MESSAGE =
  "I just survived The Waiting Room and came out the other side a revenue cycle master. Think you can navigate the healthcare billing underworld?"

interface ShareTarget {
  label: string
  color: string
  action: () => void
}

export class EndingScene extends Phaser.Scene {
  private toast?: Phaser.GameObjects.Text

  constructor() {
    super('Ending')
  }

  create() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor(0x2a0f16)
    this.cameras.main.fadeIn(600, 0, 0, 0)

    // Floating papers, same treatment as TitleScene, for visual continuity.
    for (let i = 0; i < 10; i++) {
      const paper = this.add.image(
        Phaser.Math.Between(100, width - 100),
        Phaser.Math.Between(100, height - 100),
        'wr_paper'
      ).setScale(Phaser.Math.FloatBetween(3, 6)).setAlpha(0.08)

      this.tweens.add({
        targets: paper,
        y: paper.y - 20,
        x: paper.x + Phaser.Math.Between(-16, 16),
        duration: Phaser.Math.Between(3000, 5000),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        delay: i * 400,
      })
    }

    this.add.text(width / 2, 150, 'CASE CLOSED', {
      fontSize: '58px', fontFamily: 'monospace', color: '#f4e6c8',
      fontStyle: 'bold',
    }).setOrigin(0.5)

    this.add.text(width / 2, 215, 'The Quarterly Audit is over. The claim finally paid.', {
      fontSize: '22px', fontFamily: 'monospace', color: '#e8c074',
    }).setOrigin(0.5)

    const gs = getState()
    const recap = `${gs.defeatedObstacles.length} obstacles cleared · $${gs.resources.cash.toLocaleString()} recovered`
    this.add.text(width / 2, 265, recap, {
      fontSize: '18px', fontFamily: 'monospace', color: '#8b95a5',
    }).setOrigin(0.5)

    this.add.text(width / 2, 380, 'TELL THE WORLD YOU SURVIVED THE REVENUE CYCLE', {
      fontSize: '18px', fontFamily: 'monospace', color: '#c9a5d1', letterSpacing: 1,
    }).setOrigin(0.5)

    const targets: ShareTarget[] = [
      { label: 'LinkedIn', color: '#7ee2c1', action: () => this.shareViaIntent(
        `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(GAME_URL)}`) },
      { label: 'Facebook', color: '#6da9e3', action: () => this.shareViaIntent(
        `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(GAME_URL)}&quote=${encodeURIComponent(SHARE_MESSAGE)}`) },
      { label: 'X', color: '#f0a868', action: () => this.shareViaIntent(
        `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_MESSAGE)}&url=${encodeURIComponent(GAME_URL)}`) },
      { label: 'Instagram', color: '#ef5b7b', action: () => this.shareToInstagram() },
    ]

    const spacing = 260
    const startX = width / 2 - (spacing * (targets.length - 1)) / 2
    targets.forEach((t, i) => {
      const x = startX + i * spacing
      const btn = this.add.text(x, 440, `[ ${t.label} ]`, {
        fontSize: '26px', fontFamily: 'monospace', color: t.color,
      }).setOrigin(0.5).setInteractive({ useHandCursor: true })

      btn.on('pointerover', () => btn.setColor('#ffffff'))
      btn.on('pointerout', () => btn.setColor(t.color))
      btn.on('pointerdown', t.action)
    })

    this.add.text(width / 2, height - 140, `"${SHARE_MESSAGE}"`, {
      fontSize: '15px', fontFamily: 'monospace', color: '#5a4a52',
      align: 'center', wordWrap: { width: width - 400 },
    }).setOrigin(0.5)

    const backBtn = this.add.text(width / 2, height - 60, '[ BACK TO TITLE ]', {
      fontSize: '22px', fontFamily: 'monospace', color: '#8b95a5',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    backBtn.on('pointerover', () => backBtn.setColor('#ffffff'))
    backBtn.on('pointerout', () => backBtn.setColor('#8b95a5'))
    backBtn.on('pointerdown', () => this.scene.start('Title'))
  }

  private shareViaIntent(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=640')
  }

  /** Instagram has no web share-intent that accepts prefilled text, so
   *  copy the message to the clipboard and let the player paste it in. */
  private shareToInstagram() {
    navigator.clipboard?.writeText(`${SHARE_MESSAGE} ${GAME_URL}`).catch(() => {})
    this.showToast('Message copied — paste it into your Instagram post or Story')
    window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer')
  }

  private showToast(message: string) {
    this.toast?.destroy()
    const { width, height } = this.scale
    this.toast = this.add.text(width / 2, height - 190, message, {
      fontSize: '16px', fontFamily: 'monospace', color: '#f4e6c8',
      backgroundColor: '#1b1014', padding: { x: 14, y: 8 },
    }).setOrigin(0.5)
    this.tweens.add({
      targets: this.toast,
      alpha: 0,
      delay: 2200,
      duration: 600,
      onComplete: () => this.toast?.destroy(),
    })
  }
}
