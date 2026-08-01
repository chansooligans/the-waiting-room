import Phaser from 'phaser'
import { FACTION_COLOR } from '../types'
import type { Faction } from '../types'
import { OBJECT_SOURCES } from './objectSources'
import { NPC_SOURCES } from './npcSources'

/** Mix a hex color toward white by `amt` (0..1). Used for highlight ramps. */
function lighten(hex: number, amt: number): number {
  const r = (hex >> 16) & 0xff
  const g = (hex >> 8) & 0xff
  const b = hex & 0xff
  return (
    (Math.min(255, Math.round(r + (255 - r) * amt)) << 16) |
    (Math.min(255, Math.round(g + (255 - g) * amt)) << 8) |
    Math.min(255, Math.round(b + (255 - b) * amt))
  )
}
/** Mix a hex color toward black by `amt` (0..1). Used for shadow ramps. */
function darken(hex: number, amt: number): number {
  const r = (hex >> 16) & 0xff
  const g = (hex >> 8) & 0xff
  const b = hex & 0xff
  return (
    (Math.max(0, Math.round(r * (1 - amt))) << 16) |
    (Math.max(0, Math.round(g * (1 - amt))) << 8) |
    Math.max(0, Math.round(b * (1 - amt)))
  )
}

/** Cheap deterministic string hash (djb2). Used so a fallback NPC
 *  palette is stable across reloads instead of re-randomizing every
 *  boot. */
function hashString(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

// NPC_SOURCES extracted to ./npcSources so the map editor + sprite
// library page can import it without dragging Phaser into their
// bundles. Edit the mapping there.

// OBJECT_SOURCES extracted to its own module so the map editor can
// import the same source-of-truth without dragging Phaser in. Edit
// the mapping there.

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  preload() {
    // Comic-page intro art. Five images:
    //   - cover  : opening title splash
    //   - page5  : "the gap" reveal (Beat 5)
    //   - page6  : "the waiting room" reveal (Beat 7)
    //   - page7  : Mercy General corridor closer (gothic figures, plague
    //              doctor, ghost — the Waiting Room bleeding into the day job)
    //   - page8  : Chloe at her desk surrounded by claims (back to work)
    // Other pages are intentionally not loaded — beats 1-4 stay procedural
    // so typed text stays clearly readable.
    this.load.image('intro_cover', 'intro/cover.png')
    this.load.image('intro_page5', 'intro/page5.png')
    this.load.image('intro_page6', 'intro/page6.png')
    this.load.image('intro_page7', 'intro/page7.jpg')
    this.load.image('intro_page8', 'intro/page8.jpg')

    // Voiceover for the cinematic IntroScene — one MP3 per text beat,
    // pre-split via whisper transcription so each line plays its own
    // audio. Keys are 'intro_voice_NN' where NN matches the text-beat
    // index (1-based, zero-padded). 17 lines total — the original
    // beat 3 ("That's not a typo.") was cut and the rest renumbered
    // down by one to keep the 1-to-1 alignment.
    for (let i = 1; i <= 17; i++) {
      const nn = String(i).padStart(2, '0')
      this.load.audio(`intro_voice_${nn}`, `audio/intro/${nn}.mp3`)
    }
    // Intro song — fades in when the user advances past the title
    // splash and runs underneath the rest of the cinematic.
    this.load.audio('intro_song', 'audio/intro/intro_song.mp3')

    // Player walk-cycle frames — 4 directions × 4 frames each, all
    // 64×64 transparent PNGs. Authored by the LoRA pipeline (see
    // reference/art-direction-roadmap.md). Loaded as individual
    // textures keyed `player_<dir>_<frame>` and stitched into
    // animations in create() below.
    const directions = ['down', 'up', 'left', 'right'] as const
    for (const dir of directions) {
      for (let i = 0; i < 4; i++) {
        this.load.image(`player_${dir}_${i}`, `sprites/player/${dir}_walk_${i}.png`)
      }
      // Per-direction idle pose (standing still). Used when the
      // player isn't moving — looks better than freezing on walk
      // frame 0 which is mid-stride.
      this.load.image(`player_idle_${dir}`, `sprites/player/idle_${dir}.png`)
    }

    // NPC sprites — same LoRA pipeline as the player, mapped from
    // public/sprites/npcs-raw/<sheet>_<row>_<col>.png to the
    // canonical `npc_<id>` texture key the rest of the game uses.
    // The 4 columns per row are the directional poses
    // (col 0 = front/down, col 1 = left, col 2 = right, col 3 = back/up).
    // For now we wire the front-facing pose to `npc_<id>` (matching
    // the existing procedural texture key) and ALSO load the other
    // three directions to dedicated keys for future use when NPCs
    // gain orientation. BootScene.makeNPCSprites checks for an
    // existing texture and skips procedural generation per-key, so
    // the LoRA art wins over the procedural fallback.
    for (const [id, slot] of Object.entries(NPC_SOURCES)) {
      this.load.image(`npc_${id}`,       `sprites/npcs-raw/${slot}_0.png`)
      this.load.image(`npc_${id}_down`,  `sprites/npcs-raw/${slot}_0.png`)
      // Cols 1 + 2 swapped vs the original convention — the LoRA
      // sheets from ChatGPT label "left profile" as "view of the
      // character's left side", which means the character is
      // actually facing screen-RIGHT in that pose. Swap so the
      // texture key `npc_<id>_left` actually shows the NPC facing
      // left (toward screen-left) and `_right` shows them facing
      // right. Keeps in-game logic semantic ("dx<0 → face 'left'"
      // → loads the texture where they face screen-left).
      this.load.image(`npc_${id}_left`,  `sprites/npcs-raw/${slot}_2.png`)
      this.load.image(`npc_${id}_right`, `sprites/npcs-raw/${slot}_1.png`)
      this.load.image(`npc_${id}_up`,    `sprites/npcs-raw/${slot}_3.png`)
    }

    // Hospital objects — LoRA-generated 64×64 transparent PNGs from
    // the Object contact sheet (5 sheets × 16 cells = 80 total).
    // 11 keys override existing procedural draws; the rest register
    // new texture keys for future placement. makeHospitalTiles skips
    // its procedural draw per-key when the loaded texture already
    // claimed that key (same pattern as makeNPCSprites).
    for (const [key, slot] of Object.entries(OBJECT_SOURCES)) {
      this.load.image(key, `sprites/objects-raw/${slot}.png`)
    }

    // The Hospital ambient tracks (~12MB) and Waiting Room red-room
    // tracks (~16MB) used to load here too. Moved to per-scene
    // preload (HospitalScene / WaitingRoomScene) — they're not needed
    // until the player reaches those scenes, and eager-loading them
    // delayed first paint by ~28MB of downloads on a cold start.
  }

  create() {
    this.generateSprites()
    this.registerPlayerWalkAnimations()
    // Every page reload lands on the cover — which is the splash at
    // the start of the cinematic intro. Players can hit Skip on the
    // splash to jump to the title menu.
    //
    // Dev shortcut: `?introBeat=N` in the URL deep-links to a
    // specific beat. Used by /intro-editor.html "open at beat" so
    // authors can iterate on a single scene without sitting through
    // the prior cinematic. Clamped + ignored if not a positive int.
    const params = new URLSearchParams(window.location.search)
    const beatRaw = params.get('introBeat')
    const beatNum = beatRaw !== null ? parseInt(beatRaw, 10) : NaN
    if (Number.isFinite(beatNum) && beatNum > 0) {
      this.scene.start('Intro', { skipToBeat: beatNum })
    } else {
      this.scene.start('Intro')
    }
  }

  /** Register the four directional walk-cycle animations. Anims are
   *  global (live on AnimationManager, not per-scene), so once this
   *  fires every scene can `sprite.play('player_down_walk')` etc. */
  private registerPlayerWalkAnimations() {
    const directions = ['down', 'up', 'left', 'right'] as const
    for (const dir of directions) {
      const key = `player_${dir}_walk`
      if (this.anims.exists(key)) continue
      this.anims.create({
        key,
        frames: [0, 1, 2, 3].map(i => ({ key: `player_${dir}_${i}` })),
        frameRate: 8,
        repeat: -1,
      })
    }
  }

  private hasExistingSave(): boolean {
    try {
      return !!localStorage.getItem('denial_dungeon_save')
    } catch {
      return false
    }
  }

  private generateSprites() {
    this.makePlayerSprite()
    this.makeNPCSprites()
    this.makeHospitalTiles()
    this.makeWaitingRoomTiles()
    this.makeUIElements()
    this.makeDocumentSprites()
    this.makeEncounterPortraits()
  }

  /**
   * Higher-fidelity 32×32 character draw. More pixels per element so
   * each character can carry recognizable features (eye shape, hair
   * texture, collar, pant fold) instead of reading as a colored
   * rectangle. Generic NPC body — accessories are added on top by
   * the caller.
   */
  private drawCharacter(
    g: Phaser.GameObjects.Graphics,
    shirt: number,
    hair: number,
    skin: number,
    pants = 0x1a1a2e,
  ) {
    const HAIR_DARK = darken(hair, 0.5)
    const SHIRT_HI = lighten(shirt, 0.18)
    const SHIRT_LO = darken(shirt, 0.25)
    const SKIN_LO = darken(skin, 0.18)
    const PANTS_LO = darken(pants, 0.35)
    const SHOE = 0x1a1208
    const EYE = 0x1a1a2e
    const MOUTH = 0x6a3030

    // -- Head dome / hair cap --
    g.fillStyle(hair)
    g.fillRect(11, 1, 10, 2)
    g.fillRect(9, 2, 14, 2)
    g.fillRect(8, 3, 16, 4)
    g.fillRect(7, 4, 1, 5)
    g.fillRect(24, 4, 1, 5)
    g.fillStyle(HAIR_DARK)
    g.fillRect(8, 7, 16, 1) // hair shadow strip above forehead

    // -- Face --
    g.fillStyle(skin)
    g.fillRect(9, 8, 14, 8)
    // Cheek shading
    g.fillStyle(SKIN_LO)
    g.fillRect(9, 14, 14, 1)

    // -- Eyes --
    g.fillStyle(0xffffff)
    g.fillRect(11, 10, 3, 2) // left eye white
    g.fillRect(18, 10, 3, 2) // right eye white
    g.fillStyle(EYE)
    g.fillRect(12, 10, 2, 2) // left iris
    g.fillRect(19, 10, 2, 2) // right iris
    g.fillStyle(0xffffff)
    g.fillRect(12, 10, 1, 1) // left highlight
    g.fillRect(19, 10, 1, 1) // right highlight

    // -- Mouth --
    g.fillStyle(MOUTH)
    g.fillRect(14, 14, 4, 1)

    // -- Neck --
    g.fillStyle(SKIN_LO)
    g.fillRect(13, 16, 6, 1)

    // -- Torso (shirt) --
    g.fillStyle(shirt)
    g.fillRect(6, 17, 20, 9)
    // Shoulder slope
    g.fillStyle(SHIRT_LO)
    g.fillRect(6, 17, 1, 9)
    g.fillRect(25, 17, 1, 9)
    // Collar V
    g.fillStyle(SHIRT_LO)
    g.fillRect(15, 17, 2, 2)
    g.fillStyle(skin)
    g.fillRect(15, 17, 2, 1)
    // Light highlight on the chest
    g.fillStyle(SHIRT_HI, 1)
    g.fillRect(8, 18, 5, 4)

    // -- Arms --
    g.fillStyle(shirt)
    g.fillRect(4, 17, 2, 8)
    g.fillRect(26, 17, 2, 8)
    g.fillStyle(SHIRT_LO)
    g.fillRect(4, 24, 2, 1)
    g.fillRect(26, 24, 2, 1)
    // Hands
    g.fillStyle(skin)
    g.fillRect(4, 25, 2, 2)
    g.fillRect(26, 25, 2, 2)
    g.fillStyle(SKIN_LO)
    g.fillRect(4, 26, 2, 1)
    g.fillRect(26, 26, 2, 1)

    // -- Pants --
    g.fillStyle(pants)
    g.fillRect(8, 26, 7, 5)
    g.fillRect(17, 26, 7, 5)
    g.fillStyle(PANTS_LO)
    g.fillRect(8, 30, 7, 1) // pant cuff
    g.fillRect(17, 30, 7, 1)

    // -- Shoes --
    g.fillStyle(SHOE)
    g.fillRect(8, 31, 7, 1)
    g.fillRect(17, 31, 7, 1)
  }

  private makePlayerSprite() {
    // Protagonist matches the intro cover + page-5 illustration:
    // young woman, dark brown hair tied up in a messy bun, pale skin,
    // warm sepia sweater, dark trousers, hospital ID badge.
    //
    // Three textures: 'player' (front/down), 'player_up' (back),
    // 'player_side' (profile facing right; flipped via setFlipX for
    // left-facing). Movement code swaps the texture based on the last
    // direction the player walked.
    this.makePlayerDirection('player', 'down')
    this.makePlayerDirection('player_up', 'up')
    this.makePlayerDirection('player_side', 'side')
  }

  private makePlayerDirection(key: string, dir: 'down' | 'up' | 'side') {
    const g = this.make.graphics({ x: 0, y: 0 })
    const HAIR = 0x2a1a0e
    const HAIR_HI = lighten(HAIR, 0.18)
    const HAIR_LO = darken(HAIR, 0.4)
    const SKIN = 0xf0d9be
    const SKIN_LO = darken(SKIN, 0.18)
    const SWEATER = 0x5a4030
    const SWEATER_HI = lighten(SWEATER, 0.16)
    const SWEATER_LO = darken(SWEATER, 0.28)
    const PANTS = 0x1a1a2e
    const PANTS_LO = darken(PANTS, 0.4)
    const SHOE = 0x1a1208
    const EYE = 0x1a1a2e
    const MOUTH = 0x6a3030

    // Messy bun on top of the head (visible from every angle).
    g.fillStyle(HAIR)
    g.fillRect(14, 0, 4, 2)
    g.fillRect(13, 1, 6, 1)
    g.fillStyle(HAIR_HI)
    g.fillRect(15, 0, 2, 1)
    // Stray hair strands escaping the bun
    g.fillStyle(HAIR_LO)
    g.fillRect(11, 1, 1, 2)
    g.fillRect(20, 1, 1, 2)

    if (dir === 'up') {
      // Back of head: hair covers the face area entirely + side strands.
      g.fillStyle(HAIR)
      g.fillRect(11, 2, 10, 2)
      g.fillRect(9, 3, 14, 4)
      g.fillRect(8, 4, 16, 11)
      g.fillRect(7, 6, 1, 7)
      g.fillRect(24, 6, 1, 7)
      g.fillStyle(HAIR_LO)
      g.fillRect(8, 14, 16, 1) // shadow at the nape
      // Tiny strip of skin where the neck peeks out
      g.fillStyle(SKIN_LO)
      g.fillRect(13, 15, 6, 2)
    } else if (dir === 'side') {
      // Profile facing right. Hair on the left half (back of head),
      // face/skin on the right. One eye visible on the right.
      g.fillStyle(HAIR)
      g.fillRect(8, 3, 16, 4) // hair cap
      g.fillRect(7, 4, 1, 9)
      g.fillRect(8, 4, 8, 12) // back of head all hair
      g.fillStyle(SKIN)
      g.fillRect(16, 8, 8, 8) // face (right side only)
      // Bangs falling
      g.fillStyle(HAIR)
      g.fillRect(16, 6, 8, 2)
      g.fillRect(22, 8, 2, 3)
      // Single eye + brow
      g.fillStyle(0xffffff)
      g.fillRect(19, 10, 3, 2)
      g.fillStyle(EYE)
      g.fillRect(20, 10, 2, 2)
      g.fillStyle(0xffffff)
      g.fillRect(20, 10, 1, 1)
      g.fillStyle(MOUTH)
      g.fillRect(21, 14, 2, 1)
      // Neck
      g.fillStyle(SKIN_LO)
      g.fillRect(16, 16, 6, 1)
    } else {
      // Front (down)
      g.fillStyle(HAIR)
      g.fillRect(11, 2, 10, 2) // crown
      g.fillRect(9, 3, 14, 2)
      g.fillRect(8, 4, 16, 4)
      g.fillRect(7, 5, 1, 7)
      g.fillRect(24, 5, 1, 7)
      g.fillRect(8, 7, 16, 1) // bangs across forehead
      g.fillRect(7, 12, 1, 2) // wisp by left ear
      g.fillRect(24, 12, 1, 2) // wisp by right ear
      g.fillStyle(HAIR_LO)
      g.fillRect(8, 7, 16, 1) // bang shadow
      // Face
      g.fillStyle(SKIN)
      g.fillRect(9, 8, 14, 8)
      g.fillStyle(SKIN_LO)
      g.fillRect(9, 14, 14, 1) // cheek shading
      // Eyes
      g.fillStyle(0xffffff)
      g.fillRect(11, 10, 3, 2)
      g.fillRect(18, 10, 3, 2)
      g.fillStyle(EYE)
      g.fillRect(12, 10, 2, 2)
      g.fillRect(19, 10, 2, 2)
      g.fillStyle(0xffffff)
      g.fillRect(12, 10, 1, 1)
      g.fillRect(19, 10, 1, 1)
      // Mouth
      g.fillStyle(MOUTH)
      g.fillRect(14, 14, 4, 1)
      // Neck
      g.fillStyle(SKIN_LO)
      g.fillRect(13, 16, 6, 1)
    }

    // -- Sweater (torso) --
    g.fillStyle(SWEATER)
    g.fillRect(6, 17, 20, 9)
    g.fillStyle(SWEATER_LO)
    g.fillRect(6, 17, 1, 9)
    g.fillRect(25, 17, 1, 9)
    if (dir === 'down') {
      // Collar V + ID lanyard hint
      g.fillStyle(SWEATER_LO)
      g.fillRect(15, 17, 2, 2)
      g.fillStyle(SKIN)
      g.fillRect(15, 17, 2, 1)
      // Highlight stripe
      g.fillStyle(SWEATER_HI)
      g.fillRect(8, 18, 5, 4)
      // Hospital ID badge (yellow)
      g.fillStyle(0xf4d06f)
      g.fillRect(18, 21, 3, 3)
      g.fillStyle(0xc28a3e)
      g.fillRect(18, 23, 3, 1)
    } else if (dir === 'up') {
      // Spine shadow
      g.fillStyle(SWEATER_LO)
      g.fillRect(15, 17, 2, 9)
    } else {
      // Side: highlight on the front side, shadow on the back
      g.fillStyle(SWEATER_HI)
      g.fillRect(15, 18, 8, 5)
      g.fillStyle(SWEATER_LO)
      g.fillRect(7, 18, 4, 6)
    }

    // -- Arms / hands --
    g.fillStyle(SWEATER)
    g.fillRect(4, 17, 2, 8)
    g.fillRect(26, 17, 2, 8)
    g.fillStyle(SWEATER_LO)
    g.fillRect(4, 24, 2, 1)
    g.fillRect(26, 24, 2, 1)
    g.fillStyle(SKIN)
    g.fillRect(4, 25, 2, 2)
    g.fillRect(26, 25, 2, 2)
    g.fillStyle(SKIN_LO)
    g.fillRect(4, 26, 2, 1)
    g.fillRect(26, 26, 2, 1)

    // -- Pants --
    g.fillStyle(PANTS)
    g.fillRect(8, 26, 7, 5)
    g.fillRect(17, 26, 7, 5)
    g.fillStyle(PANTS_LO)
    g.fillRect(8, 30, 7, 1)
    g.fillRect(17, 30, 7, 1)

    // -- Shoes --
    g.fillStyle(SHOE)
    g.fillRect(8, 31, 7, 1)
    g.fillRect(17, 31, 7, 1)

    g.generateTexture(key, 32, 32)
    g.destroy()
  }

  private makeNPCSprites() {
    const npcs: { key: string; shirt: number; hair: number; skin: number; accessory?: string }[] = [
      { key: 'npc_dana', shirt: 0x6da9e3, hair: 0xc4a35a, skin: 0xf5deb3, accessory: 'glasses' },
      { key: 'npc_martinez', shirt: 0xffffff, hair: 0x2a2a2a, skin: 0xc68642, accessory: 'stethoscope' },
      { key: 'npc_kim', shirt: 0xa8d8a8, hair: 0x1a1a1a, skin: 0xf0c8a0 },
      { key: 'npc_jordan', shirt: 0xd4a0d4, hair: 0x8b4513, skin: 0x8d5524 },
      { key: 'npc_eddi', shirt: 0x808080, hair: 0x808080, skin: 0xb0b0b0 },
      { key: 'npc_pat', shirt: 0x3a3a6a, hair: 0xc0c0c0, skin: 0xf5deb3, accessory: 'glasses' },
      { key: 'npc_alex', shirt: 0x2a2a2a, hair: 0x4a2a0a, skin: 0xdeb887 },
      { key: 'npc_sam', shirt: 0xf0a868, hair: 0x6a3a1a, skin: 0xc68642 },
      { key: 'npc_carl', shirt: 0x6a6a6a, hair: 0x5a5a5a, skin: 0xf5deb3 },
      { key: 'npc_chen', shirt: 0x4a4a7a, hair: 0x1a1a1a, skin: 0xf0c8a0 },
      { key: 'npc_rivera', shirt: 0x2a4a6a, hair: 0x3a3a3a, skin: 0xc68642 },
      // Patient (Anjali) — softer palette than staff so the visitor reads
      // as a visitor, not as another desk.
      { key: 'npc_anjali', shirt: 0xb8d4e8, hair: 0x2a1a0e, skin: 0xc8a070 },
    ]

    for (const npc of npcs) {
      // Skip procedural generation when a LoRA-loaded PNG already
      // claimed this texture key in preload — the PNG is what we
      // actually want to render. Procedural draws are fallback only.
      if (this.textures.exists(npc.key)) continue
      const g = this.make.graphics({ x: 0, y: 0 })
      this.drawCharacter(g, npc.shirt, npc.hair, npc.skin)
      if (npc.accessory === 'glasses') {
        g.lineStyle(1, 0xe0e0e0)
        g.strokeRect(11, 9, 4, 4)
        g.strokeRect(17, 9, 4, 4)
        g.lineBetween(15, 11, 17, 11) // bridge
      } else if (npc.accessory === 'stethoscope') {
        // Tubing draped around the neck, dipping into the chest
        g.lineStyle(1, 0x9098a0)
        g.lineBetween(13, 16, 13, 21)
        g.lineBetween(19, 16, 19, 21)
        g.lineBetween(13, 21, 16, 24)
        g.lineBetween(19, 21, 16, 24)
        g.fillStyle(0x6a7280)
        g.fillRect(15, 24, 3, 2) // bell
      }
      g.generateTexture(npc.key, 32, 32)
      g.destroy()
    }

    // Coverage fallback for every OTHER npc id registered in
    // NPC_SOURCES (the LoRA-art roster, cast well after the 12
    // hand-tuned palettes above). Those 25+ NPCs have no curated
    // procedural entry, so a single failed or slow PNG load left
    // them rendering Phaser's stock "missing texture" black box
    // instead of a character. This generates a readable placeholder
    // for any of them whose real art didn't make it into the cache,
    // picked deterministically from the id so a given NPC's fallback
    // look is stable across reloads rather than re-randomizing.
    const SKIN_TONES = [0xf5deb3, 0xc68642, 0xf0c8a0, 0x8d5524, 0xdeb887, 0xc8a070]
    const HAIR_TONES = [0x2a2a2a, 0x1a1a1a, 0x8b4513, 0x4a2a0a, 0x6a3a1a, 0xc0c0c0, 0x808080, 0x5a5a5a, 0x3a3a3a, 0xc4a35a]
    const SHIRT_TONES = [0x6da9e3, 0xa8d8a8, 0xd4a0d4, 0xf0a868, 0x6a6a6a, 0x4a4a7a, 0x2a4a6a, 0xb8d4e8, 0xe0a0a0, 0xa0d0c0]
    for (const id of Object.keys(NPC_SOURCES)) {
      const key = `npc_${id}`
      if (this.textures.exists(key)) continue
      const h = hashString(id)
      const g = this.make.graphics({ x: 0, y: 0 })
      this.drawCharacter(g, SHIRT_TONES[h % SHIRT_TONES.length], HAIR_TONES[(h >> 4) % HAIR_TONES.length], SKIN_TONES[(h >> 8) % SKIN_TONES.length])
      g.generateTexture(key, 32, 32)
      g.destroy()
    }
  }

  private makeHospitalTiles() {
    let g: Phaser.GameObjects.Graphics

    // Floor — warm beige linoleum
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x8a7e6e)
    g.fillRect(0, 0, 16, 16)
    g.fillStyle(0x908474, 0.3)
    g.fillRect(0, 0, 8, 8)
    g.fillRect(8, 8, 8, 8)
    g.lineStyle(1, 0x7a7060, 0.25)
    g.strokeRect(0, 0, 16, 16)
    g.generateTexture('h_floor', 16, 16)
    g.destroy()

    // Floor variant — greenish hospital tile
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x7a8070)
    g.fillRect(0, 0, 16, 16)
    g.fillStyle(0x808878, 0.3)
    g.fillRect(0, 8, 8, 8)
    g.fillRect(8, 0, 8, 8)
    g.lineStyle(1, 0x6a7060, 0.25)
    g.strokeRect(0, 0, 16, 16)
    g.generateTexture('h_floor2', 16, 16)
    g.destroy()

    // Carpet — soft blue-gray waiting area
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x5a6878)
    g.fillRect(0, 0, 16, 16)
    g.fillStyle(0x627080, 0.4)
    g.fillRect(0, 0, 4, 4)
    g.fillRect(8, 0, 4, 4)
    g.fillRect(4, 4, 4, 4)
    g.fillRect(12, 4, 4, 4)
    g.fillRect(0, 8, 4, 4)
    g.fillRect(8, 8, 4, 4)
    g.fillRect(4, 12, 4, 4)
    g.fillRect(12, 12, 4, 4)
    g.generateTexture('h_carpet', 16, 16)
    g.destroy()

    // Wall — cream with baseboard
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x98a0a8)
    g.fillRect(0, 0, 16, 16)
    g.fillStyle(0xa0a8b0, 0.5)
    g.fillRect(0, 0, 16, 2)
    g.fillStyle(0x706050)
    g.fillRect(0, 14, 16, 2)
    g.lineStyle(1, 0x8890a0, 0.4)
    g.lineBetween(0, 13, 16, 13)
    g.generateTexture('h_wall', 16, 16)
    g.destroy()

    // Door — wood panel with handle
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x8a6a40)
    g.fillRect(0, 0, 16, 16)
    g.fillStyle(0x9a7a50, 0.5)
    g.fillRect(2, 1, 12, 6)
    g.fillRect(2, 9, 12, 6)
    g.lineStyle(1, 0x7a5a30)
    g.strokeRect(2, 1, 12, 6)
    g.strokeRect(2, 9, 12, 6)
    g.fillStyle(0xd0b060)
    g.fillRect(11, 7, 3, 2)
    g.generateTexture('h_door', 16, 16)
    g.destroy()

    // Desk — wood with monitor
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x7a6040)
    g.fillRect(0, 6, 16, 10)
    g.fillStyle(0x8a7050, 0.5)
    g.fillRect(1, 6, 14, 2)
    g.fillStyle(0x303840)
    g.fillRect(2, 0, 6, 5)
    g.fillStyle(0x5090c0)
    g.fillRect(3, 1, 4, 3)
    g.fillStyle(0x404850)
    g.fillRect(4, 5, 2, 1)
    if (!this.textures.exists('h_desk')) g.generateTexture('h_desk', 16, 16)
    g.destroy()

    // Chair — neutral body so TINT.chair in HospitalScene controls
    // the actual color (Phaser tints multiply against the texture).
    // Shorter than its predecessor (body 6 rows instead of 8) and
    // sits lower in the tile so chairs read as waist-high seating
    // rather than podium-blocks dominating each cell.
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xffffff)
    g.fillRect(3, 6, 10, 6)         // body 10×6 starting row 6
    g.fillStyle(0xd8d8d8, 0.4)
    g.fillRect(4, 6, 8, 1)           // top highlight
    g.fillStyle(0x404040)
    g.fillRect(6, 12, 4, 2)          // dark stem rows 12–13
    g.fillStyle(0x808080)
    g.fillRect(4, 14, 2, 2)          // feet rows 14–15
    g.fillRect(10, 14, 2, 2)
    if (!this.textures.exists('h_chair')) g.generateTexture('h_chair', 16, 16)
    g.destroy()

    // Medical equipment — vitals monitor on stand
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xc0c8d0)
    g.fillRect(4, 0, 8, 10)
    g.fillStyle(0x1a2a1a)
    g.fillRect(5, 1, 6, 5)
    g.fillStyle(0x40d080)
    g.lineBetween(6, 4, 7, 2)
    g.lineBetween(7, 2, 8, 5)
    g.lineBetween(8, 5, 9, 3)
    g.lineBetween(9, 3, 10, 4)
    g.fillStyle(0x909898)
    g.fillRect(6, 10, 4, 2)
    g.fillRect(5, 12, 6, 1)
    g.fillRect(4, 13, 8, 3)
    if (!this.textures.exists('h_equipment')) g.generateTexture('h_equipment', 16, 16)
    g.destroy()

    // Plant — potted fern with detail
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x8a5a30)
    g.fillRect(5, 10, 6, 5)
    g.fillStyle(0x9a6a40, 0.5)
    g.fillRect(6, 10, 4, 1)
    g.fillStyle(0x508040)
    g.fillCircle(8, 7, 5)
    g.fillStyle(0x60a050)
    g.fillCircle(6, 5, 3)
    g.fillCircle(10, 6, 3)
    g.fillStyle(0x70b060, 0.5)
    g.fillCircle(8, 4, 2)
    g.fillRect(5, 15, 6, 1)
    if (!this.textures.exists('h_plant')) g.generateTexture('h_plant', 16, 16)
    g.destroy()

    // Water cooler
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xd8e0e8)
    g.fillRect(5, 0, 6, 12)
    g.fillStyle(0x70b8e8)
    g.fillRect(6, 1, 4, 4)
    g.fillStyle(0x90d0f0, 0.3)
    g.fillRect(6, 1, 2, 2)
    g.fillStyle(0x909898)
    g.fillRect(4, 12, 8, 4)
    g.fillStyle(0xf05050)
    g.fillRect(9, 7, 2, 1)
    g.fillStyle(0x5080e0)
    g.fillRect(5, 7, 2, 1)
    if (!this.textures.exists('h_water')) g.generateTexture('h_water', 16, 16)
    g.destroy()

    // Filing cabinet — metal with handles
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x708090)
    g.fillRect(2, 0, 12, 16)
    g.lineStyle(1, 0x607080)
    g.lineBetween(3, 5, 13, 5)
    g.lineBetween(3, 10, 13, 10)
    g.fillStyle(0xa0a8b0)
    g.fillRect(7, 2, 3, 1)
    g.fillRect(7, 7, 3, 1)
    g.fillRect(7, 12, 3, 1)
    g.fillStyle(0x7888a0, 0.3)
    g.fillRect(3, 0, 2, 5)
    if (!this.textures.exists('h_cabinet')) g.generateTexture('h_cabinet', 16, 16)
    g.destroy()

    // Whiteboard — with colored notes
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xf0f0e8)
    g.fillRect(1, 1, 14, 12)
    g.lineStyle(1, 0xa0a0a0)
    g.strokeRect(1, 1, 14, 12)
    g.fillStyle(0x606060)
    g.fillRect(1, 13, 14, 2)
    g.fillStyle(0xe05050, 0.6)
    g.fillRect(3, 3, 7, 1)
    g.fillStyle(0x3080e0, 0.6)
    g.fillRect(3, 5, 5, 1)
    g.fillStyle(0x40a050, 0.6)
    g.fillRect(3, 7, 9, 1)
    g.fillStyle(0xe0a020, 0.6)
    g.fillRect(3, 9, 4, 1)
    g.generateTexture('h_whiteboard', 16, 16)
    g.destroy()

    // Reception counter — polished wood. Lowered to occupy the
    // bottom half of the tile and narrower (12 wide instead of 16)
    // so multi-tile counters read as a continuous run with subtle
    // tile-to-tile seams instead of a solid horizontal slab.
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x6a5030)
    g.fillRect(2, 8, 12, 8)
    g.fillStyle(0x7a6040, 0.6)
    g.fillRect(2, 8, 12, 2)            // top edge highlight
    g.fillStyle(0x8a7050, 0.2)
    g.fillRect(3, 9, 10, 1)
    g.lineStyle(1, 0x5a4020, 0.6)
    g.strokeRect(2, 8, 12, 8)
    if (!this.textures.exists('h_counter')) g.generateTexture('h_counter', 16, 16)
    g.destroy()

    // Vending machine — bright and inviting
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x4050a0)
    g.fillRect(2, 0, 12, 16)
    g.fillStyle(0x6080c0, 0.5)
    g.fillRect(4, 1, 8, 8)
    g.fillStyle(0xe06040)
    g.fillRect(5, 2, 2, 2)
    g.fillStyle(0x40c060)
    g.fillRect(9, 2, 2, 2)
    g.fillStyle(0xe0c040)
    g.fillRect(5, 5, 2, 2)
    g.fillStyle(0x4090e0)
    g.fillRect(9, 5, 2, 2)
    g.fillStyle(0x303840)
    g.fillRect(5, 10, 6, 3)
    g.fillStyle(0x40d080, 0.6)
    g.fillRect(11, 13, 2, 2)
    if (!this.textures.exists('h_vending')) g.generateTexture('h_vending', 16, 16)
    g.destroy()

    // Bulletin board — cork with colorful notes
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x9a7a50)
    g.fillRect(1, 1, 14, 14)
    g.lineStyle(1, 0x705830)
    g.strokeRect(1, 1, 14, 14)
    g.fillStyle(0xf0e060)
    g.fillRect(3, 3, 4, 3)
    g.fillStyle(0xf08080)
    g.fillRect(9, 3, 4, 4)
    g.fillStyle(0xe0e8f0)
    g.fillRect(3, 8, 5, 4)
    g.fillStyle(0x80c0f0)
    g.fillRect(9, 9, 4, 3)
    g.fillStyle(0xe04040)
    g.fillRect(4, 3, 1, 1)
    g.fillRect(10, 3, 1, 1)
    g.fillRect(5, 8, 1, 1)
    g.fillRect(10, 9, 1, 1)
    if (!this.textures.exists('h_bulletin')) g.generateTexture('h_bulletin', 16, 16)
    g.destroy()

    // Bed — hospital with pillow and blanket
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xe0e8f0)
    g.fillRect(1, 3, 14, 11)
    g.fillStyle(0x80b8e0)
    g.fillRect(1, 6, 14, 8)
    g.fillStyle(0xf0f0f0)
    g.fillRect(2, 3, 5, 3)
    g.fillStyle(0x505860)
    g.fillRect(0, 14, 3, 2)
    g.fillRect(13, 14, 3, 2)
    g.fillRect(0, 2, 3, 2)
    g.fillRect(13, 2, 3, 2)
    if (!this.textures.exists('h_bed')) g.generateTexture('h_bed', 16, 16)
    g.destroy()

    // Fax machine — with paper feed
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xd8d8d0)
    g.fillRect(2, 6, 12, 8)
    g.fillStyle(0xf0f0e8)
    g.fillRect(4, 1, 8, 5)
    g.fillStyle(0x505860)
    g.fillRect(5, 8, 6, 2)
    g.fillStyle(0x40d080)
    g.fillRect(10, 11, 2, 2)
    g.fillStyle(0x606868)
    g.fillRect(4, 11, 4, 1)
    if (!this.textures.exists('h_fax')) g.generateTexture('h_fax', 16, 16)
    g.destroy()

    // ============================================================
    // 2026-05 redraw set — see /sprite-redraw-preview.html for the
    // canvas mockups these were picked from. All baked-in colors;
    // intended to be rendered with objTint = 0xffffff (no tint) so
    // the painted palette comes through.
    // ============================================================

    // ---------- Cars (parking-lot variety) ----------

    // Sedan — top-down, two-tone slate body.
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x000000, 0.3); g.fillRect(2, 1, 12, 14)            // ground shadow
    g.fillStyle(0xc0c8d4); g.fillRect(3, 1, 10, 14)                 // body
    g.fillStyle(0xa8b0bc); g.fillRect(3, 1, 10, 1); g.fillRect(3, 14, 10, 1)
    g.fillStyle(0x808890); g.fillRect(3, 7, 10, 1); g.fillRect(3, 8, 10, 1) // door seam
    g.fillStyle(0x707880, 0.5); g.fillRect(3, 7, 10, 1)
    g.fillStyle(0x7a8290); g.fillRect(4, 4, 8, 8)                   // roof
    g.fillStyle(0x6a7280); g.fillRect(4, 4, 8, 1)
    g.fillStyle(0x90989c, 0.4); g.fillRect(5, 5, 6, 1)
    g.fillStyle(0x1a1e26); g.fillRect(4, 2, 8, 2); g.fillRect(4, 12, 8, 2) // windshields
    g.fillStyle(0x303a48, 0.7); g.fillRect(5, 2, 6, 1)
    g.fillStyle(0x303a48, 0.5); g.fillRect(5, 13, 6, 1)
    g.fillStyle(0x202830); g.fillRect(3, 5, 1, 6); g.fillRect(12, 5, 1, 6) // side windows
    g.fillStyle(0x404a58, 0.6); g.fillRect(3, 5, 1, 1); g.fillRect(12, 5, 1, 1)
    g.fillStyle(0x707880); g.fillRect(2, 4, 1, 1); g.fillRect(13, 4, 1, 1) // mirrors
    g.fillStyle(0xa0a8b0); g.fillRect(3, 6, 1, 1); g.fillRect(12, 6, 1, 1) // door handles
    g.fillStyle(0xa0a8b0); g.fillRect(3, 9, 1, 1); g.fillRect(12, 9, 1, 1)
    g.fillStyle(0x101014); g.fillRect(2, 2, 1, 3); g.fillRect(13, 2, 1, 3) // wheels
    g.fillStyle(0x101014); g.fillRect(2, 11, 1, 3); g.fillRect(13, 11, 1, 3)
    g.fillStyle(0x4a4a52); g.fillRect(2, 3, 1, 1); g.fillRect(13, 3, 1, 1)
    g.fillStyle(0x4a4a52); g.fillRect(2, 12, 1, 1); g.fillRect(13, 12, 1, 1)
    g.fillStyle(0xfff4b8); g.fillRect(4, 0, 2, 1); g.fillRect(10, 0, 2, 1) // headlights
    g.fillStyle(0xffffff, 0.7); g.fillRect(5, 0, 1, 1); g.fillRect(11, 0, 1, 1)
    g.fillStyle(0x1a1a1e); g.fillRect(6, 0, 4, 1)                   // grille
    g.fillStyle(0xc02020); g.fillRect(4, 15, 2, 1); g.fillRect(10, 15, 2, 1) // taillights
    g.fillStyle(0xe0d8a0); g.fillRect(7, 15, 2, 1)                  // license plate
    if (!this.textures.exists('h_car_sedan')) g.generateTexture('h_car_sedan', 16, 16)
    g.destroy()

    // SUV / minivan — boxy, fills the tile, charcoal body.
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x000000, 0.3); g.fillRect(1, 0, 14, 16)
    g.fillStyle(0x3a4050); g.fillRect(2, 0, 12, 16)
    g.fillStyle(0x4a5060, 0.4); g.fillRect(3, 1, 10, 1)
    g.fillStyle(0x202630); g.fillRect(3, 1, 10, 1)                  // roof rack rail
    g.fillStyle(0x202630); g.fillRect(2, 3, 1, 1); g.fillRect(13, 3, 1, 1)
    g.fillStyle(0x202630); g.fillRect(2, 12, 1, 1); g.fillRect(13, 12, 1, 1)
    g.fillStyle(0x10141a); g.fillRect(3, 3, 10, 3); g.fillRect(3, 10, 10, 3) // glass
    g.fillStyle(0x303848, 0.6); g.fillRect(3, 3, 10, 1); g.fillRect(3, 12, 10, 1)
    g.fillStyle(0x505868, 0.4); g.fillRect(4, 4, 1, 1); g.fillRect(11, 4, 1, 1)
    g.fillStyle(0x505868, 0.4); g.fillRect(4, 11, 1, 1); g.fillRect(11, 11, 1, 1)
    g.fillStyle(0x4a5060); g.fillRect(3, 7, 10, 2)                  // body band
    g.fillStyle(0x303640); g.fillRect(7, 7, 1, 2); g.fillRect(8, 7, 1, 2)
    g.fillStyle(0x5a6070, 0.5); g.fillRect(3, 7, 10, 1)
    g.fillStyle(0x202630); g.fillRect(1, 5, 1, 1); g.fillRect(14, 5, 1, 1) // mirrors
    g.fillStyle(0x404858); g.fillRect(1, 4, 1, 1); g.fillRect(14, 4, 1, 1)
    g.fillStyle(0x808890); g.fillRect(2, 6, 1, 1); g.fillRect(13, 6, 1, 1) // handles
    g.fillStyle(0x808890); g.fillRect(2, 9, 1, 1); g.fillRect(13, 9, 1, 1)
    g.fillStyle(0x0a0a0e); g.fillRect(0, 2, 2, 4); g.fillRect(14, 2, 2, 4) // wheels
    g.fillStyle(0x0a0a0e); g.fillRect(0, 10, 2, 4); g.fillRect(14, 10, 2, 4)
    g.fillStyle(0x404048); g.fillRect(1, 3, 1, 2); g.fillRect(14, 3, 1, 2)
    g.fillStyle(0x404048); g.fillRect(1, 11, 1, 2); g.fillRect(14, 11, 1, 2)
    g.fillStyle(0xfff6c0); g.fillRect(3, 0, 3, 1); g.fillRect(10, 0, 3, 1)
    g.fillStyle(0xffffff, 0.6); g.fillRect(4, 0, 1, 1); g.fillRect(11, 0, 1, 1)
    g.fillStyle(0x1a1a20); g.fillRect(6, 0, 4, 1)
    g.fillStyle(0x303848); g.fillRect(7, 0, 1, 1); g.fillRect(8, 0, 1, 1)
    g.fillStyle(0xa01818); g.fillRect(3, 15, 10, 1)                 // taillight bar
    g.fillStyle(0xe04040, 0.6); g.fillRect(4, 15, 2, 1); g.fillRect(10, 15, 2, 1)
    if (!this.textures.exists('h_car_suv')) g.generateTexture('h_car_suv', 16, 16)
    g.destroy()

    // Beater — rusted, dented, missing trim. Lynch-y.
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x000000, 0.4); g.fillRect(2, 1, 12, 14)
    g.fillStyle(0x202018, 0.6); g.fillRect(7, 14, 4, 1)             // oil leak
    g.fillStyle(0x8a7860); g.fillRect(3, 1, 10, 14)                 // muddy beige
    g.fillStyle(0xa08868, 0.5); g.fillRect(3, 1, 10, 1)
    g.fillStyle(0x6a4838); g.fillRect(4, 4, 8, 8)                   // rust roof
    g.fillStyle(0x4a2a18); g.fillRect(5, 5, 2, 1); g.fillRect(9, 6, 2, 2)
    g.fillStyle(0x4a2a18); g.fillRect(6, 9, 1, 2); g.fillRect(10, 10, 2, 1)
    g.fillStyle(0x8a5a3a, 0.6); g.fillRect(7, 7, 2, 2)              // primer
    g.fillStyle(0x9aa098); g.fillRect(3, 6, 1, 4)                   // duct-tape side
    g.fillStyle(0x707068, 0.5); g.fillRect(3, 7, 1, 1); g.fillRect(3, 9, 1, 1)
    g.fillStyle(0x2a2628); g.fillRect(4, 2, 8, 2); g.fillRect(4, 12, 8, 2)
    g.fillStyle(0x6a6868); g.fillRect(7, 2, 1, 1); g.fillRect(8, 3, 1, 1)
    g.fillStyle(0x6a6868); g.fillRect(6, 3, 1, 1); g.fillRect(7, 13, 1, 1)
    g.fillStyle(0xc8a878); g.fillRect(12, 8, 1, 2)                  // missing trim
    g.fillStyle(0xa0a8a8); g.fillRect(8, 1, 3, 1)                   // duct-tape patch
    g.fillStyle(0x6a5848, 0.5); g.fillRect(3, 9, 4, 3)              // mismatched door
    g.fillStyle(0x101010); g.fillRect(2, 2, 1, 3); g.fillRect(13, 2, 1, 3)
    g.fillStyle(0x101010); g.fillRect(2, 10, 2, 4)                  // flat tire
    g.fillStyle(0x101010); g.fillRect(13, 11, 1, 2)
    g.fillStyle(0x4a4a40); g.fillRect(13, 3, 1, 1)
    g.fillStyle(0xa03020); g.fillRect(8, 14, 3, 1)                  // bumper sticker
    g.fillStyle(0xe0d8a0, 0.4); g.fillRect(8, 14, 3, 1)
    g.fillStyle(0xa89060); g.fillRect(4, 0, 2, 1)                   // dim headlight
    g.fillStyle(0x303030); g.fillRect(10, 0, 2, 1)                  // dead headlight
    g.fillStyle(0xc8c0a0); g.fillRect(7, 15, 3, 1)                  // tilted plate
    if (!this.textures.exists('h_car_beater')) g.generateTexture('h_car_beater', 16, 16)
    g.destroy()

    // ---------- Lampposts ----------

    // Simple — rectangular fixture with shroud.
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xfff5c8, 0.15); g.fillRect(3, 0, 10, 6)            // halo
    g.fillStyle(0xfff5c8, 0.25); g.fillRect(4, 1, 8, 4)
    g.fillStyle(0x1a1a1e); g.fillRect(4, 1, 8, 4)
    g.fillStyle(0x303034); g.fillRect(5, 1, 6, 1)
    g.fillStyle(0xfff080); g.fillRect(5, 2, 6, 2)
    g.fillStyle(0xffffff, 0.7); g.fillRect(7, 2, 2, 1)
    g.fillStyle(0x202024); g.fillRect(4, 4, 8, 1)
    g.fillStyle(0x303034); g.fillRect(7, 4, 2, 11)                  // pole
    g.fillStyle(0x404044, 0.6); g.fillRect(7, 4, 1, 11)
    g.fillStyle(0x1a1a1e); g.fillRect(8, 4, 1, 11)
    g.fillStyle(0x202024); g.fillRect(7, 8, 2, 1); g.fillRect(7, 12, 2, 1) // bands
    g.fillStyle(0x1a1a1e); g.fillRect(5, 14, 6, 2)
    g.fillStyle(0x303034); g.fillRect(5, 14, 6, 1)
    g.fillStyle(0x0a0a0e); g.fillRect(4, 15, 8, 1)
    if (!this.textures.exists('h_lamp_simple')) g.generateTexture('h_lamp_simple', 16, 16)
    g.destroy()

    // Arched — shepherd's-crook with a glass globe.
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xfff5c8, 0.2); g.fillRect(1, 1, 8, 8)
    g.fillStyle(0xfff5c8, 0.3); g.fillRect(2, 2, 6, 6)
    g.fillStyle(0x2a2a2e); g.fillRect(8, 5, 1, 10)                  // pole
    g.fillStyle(0x404044, 0.6); g.fillRect(8, 5, 1, 10)
    g.fillStyle(0x1a1a1e); g.fillRect(9, 5, 1, 10)
    g.fillStyle(0x1a1a1e); g.fillRect(6, 14, 4, 2)                  // base
    g.fillStyle(0x2a2a2e); g.fillRect(7, 13, 2, 1)
    g.fillStyle(0x404044); g.fillRect(6, 14, 4, 1)
    g.fillStyle(0x0a0a0e); g.fillRect(5, 15, 6, 1)
    g.fillStyle(0x2a2a2e)                                            // arch scroll
    g.fillRect(8, 4, 1, 1); g.fillRect(7, 3, 1, 1); g.fillRect(6, 2, 1, 1)
    g.fillRect(5, 2, 1, 1); g.fillRect(4, 3, 1, 1)
    g.fillStyle(0x404044, 0.6); g.fillRect(7, 3, 1, 1); g.fillRect(5, 2, 1, 1)
    g.fillStyle(0x404044); g.fillRect(8, 4, 1, 1)
    g.fillStyle(0xfff5c8, 0.5); g.fillRect(3, 4, 5, 4)              // glass globe
    g.fillStyle(0xfff5c8, 0.3); g.fillRect(2, 5, 7, 2)
    g.fillStyle(0xffe880); g.fillRect(4, 5, 3, 2)                   // bulb
    g.fillStyle(0xffffff, 0.8); g.fillRect(4, 5, 1, 1)
    g.fillStyle(0x303034); g.fillRect(3, 3, 5, 1)
    g.fillStyle(0x202028); g.fillRect(3, 8, 5, 1)
    if (!this.textures.exists('h_lamp_arched')) g.generateTexture('h_lamp_arched', 16, 16)
    g.destroy()

    // Twin globe — civic / hospital-drive lamp.
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xfff5c8, 0.2); g.fillRect(0, 0, 6, 6); g.fillRect(10, 0, 6, 6)
    g.fillStyle(0xfff5c8, 0.3); g.fillRect(1, 1, 4, 4); g.fillRect(11, 1, 4, 4)
    g.fillStyle(0x2a2a2e); g.fillRect(7, 5, 2, 10)                  // pole
    g.fillStyle(0x404044, 0.6); g.fillRect(7, 5, 1, 10)
    g.fillStyle(0x1a1a1e); g.fillRect(8, 5, 1, 10)
    g.fillStyle(0x404044); g.fillRect(7, 9, 2, 1)                   // band
    g.fillStyle(0x2a2a2e); g.fillRect(2, 4, 12, 1)                  // crossbar
    g.fillStyle(0x404044, 0.5); g.fillRect(2, 4, 12, 1)
    g.fillStyle(0x2a2a2e); g.fillRect(2, 3, 1, 1); g.fillRect(13, 3, 1, 1)
    g.fillStyle(0x2a2a2e); g.fillRect(7, 3, 2, 2)
    g.fillStyle(0x404044); g.fillRect(7, 3, 1, 1)
    g.fillStyle(0xfff5c8, 0.5); g.fillRect(2, 1, 4, 4); g.fillRect(10, 1, 4, 4)
    g.fillStyle(0xfff5c8, 0.3); g.fillRect(1, 2, 6, 2); g.fillRect(9, 2, 6, 2)
    g.fillStyle(0xffe880); g.fillRect(3, 2, 2, 2); g.fillRect(11, 2, 2, 2)
    g.fillStyle(0xffffff, 0.8); g.fillRect(3, 2, 1, 1); g.fillRect(11, 2, 1, 1)
    g.fillStyle(0x303034); g.fillRect(2, 0, 4, 1); g.fillRect(10, 0, 4, 1)
    g.fillStyle(0x202028); g.fillRect(2, 5, 4, 1); g.fillRect(10, 5, 4, 1)
    g.fillStyle(0x1a1a1e); g.fillRect(5, 14, 6, 2)
    g.fillStyle(0x303034); g.fillRect(5, 14, 6, 1)
    g.fillStyle(0x404044); g.fillRect(6, 13, 4, 1)
    g.fillStyle(0x0a0a0e); g.fillRect(4, 15, 8, 1)
    if (!this.textures.exists('h_lamp_double')) g.generateTexture('h_lamp_double', 16, 16)
    g.destroy()

    // ---------- Auditorium seat (lecture hall) — padded armrest ----------
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x4a3a48); g.fillRect(3, 1, 10, 5)                  // back
    g.fillStyle(0x5a4a58, 0.6); g.fillRect(4, 1, 8, 1)
    g.fillStyle(0x3a2a38); g.fillRect(3, 5, 10, 1)
    g.fillStyle(0x2a1a28); g.fillRect(7, 3, 1, 1); g.fillRect(8, 3, 1, 1)
    g.fillStyle(0x3a2a38, 0.6); g.fillRect(7, 1, 2, 4)
    g.fillStyle(0x4a3a48); g.fillRect(3, 6, 10, 4)                  // seat cushion
    g.fillStyle(0x6a5a68, 0.4); g.fillRect(4, 6, 8, 1)
    g.fillStyle(0x5a4a58, 0.3); g.fillRect(5, 7, 6, 2)
    g.fillStyle(0x3a2a38); g.fillRect(3, 9, 10, 1)
    g.fillStyle(0x2a1a28); g.fillRect(2, 5, 1, 5); g.fillRect(13, 5, 1, 5)
    g.fillStyle(0x3a2a38); g.fillRect(2, 5, 1, 1); g.fillRect(13, 5, 1, 1)
    g.fillStyle(0x4a3a48, 0.5); g.fillRect(2, 6, 1, 1); g.fillRect(13, 6, 1, 1)
    g.fillStyle(0x404048); g.fillRect(7, 10, 2, 3)                  // pedestal
    g.fillStyle(0x606068); g.fillRect(7, 10, 1, 3)
    g.fillStyle(0x202028); g.fillRect(8, 10, 1, 3)
    g.fillStyle(0x1a1a1e); g.fillRect(5, 13, 6, 1)
    g.fillStyle(0x303038); g.fillRect(5, 14, 6, 2)
    g.fillStyle(0x0a0a0e); g.fillRect(4, 15, 8, 1)
    if (!this.textures.exists('h_seat')) g.generateTexture('h_seat', 16, 16)
    g.destroy()

    // ---------- Chalkboard (lecture hall big-board) ----------
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x4a3018); g.fillRect(0, 0, 16, 2)                  // wood frame top
    g.fillStyle(0x6a4a30); g.fillRect(0, 0, 16, 1)
    g.fillStyle(0x4a3018); g.fillRect(0, 1, 1, 13); g.fillRect(15, 1, 1, 13)
    g.fillStyle(0x6a4a30); g.fillRect(0, 1, 1, 1); g.fillRect(15, 1, 1, 1)
    g.fillStyle(0x1a2a20); g.fillRect(1, 2, 14, 11)                 // slate green
    g.fillStyle(0x2a3a30); g.fillRect(1, 2, 14, 1)
    g.fillStyle(0x0a1a10, 0.3); g.fillRect(2, 3, 12, 9)
    g.fillStyle(0xe0e8d8, 0.15); g.fillRect(3, 4, 10, 2)            // dust smudge
    g.fillStyle(0xe0e8d8, 0.1); g.fillRect(2, 8, 12, 2)
    g.fillStyle(0xf0f0e0, 0.85); g.fillRect(3, 4, 4, 1)             // chalk lines
    g.fillStyle(0xf0f0e0, 0.7); g.fillRect(8, 4, 1, 1); g.fillRect(10, 4, 2, 1)
    g.fillStyle(0xf0f0e0, 0.8); g.fillRect(3, 6, 6, 1)
    g.fillStyle(0xf0f0e0, 0.6); g.fillRect(10, 6, 3, 1)
    g.fillStyle(0xf0f0e0, 0.75); g.fillRect(3, 8, 5, 1)
    g.fillStyle(0xf0f0e0, 0.5); g.fillRect(9, 8, 4, 1)
    g.fillStyle(0xe07060, 0.8); g.fillRect(11, 9, 2, 2)             // colored chalk
    g.fillStyle(0xf0f0e0, 0.4); g.fillRect(3, 10, 7, 1)
    g.fillStyle(0x6a4a30); g.fillRect(0, 13, 16, 2)                 // chalk tray
    g.fillStyle(0x8a6a44, 0.5); g.fillRect(1, 13, 14, 1)
    g.fillStyle(0x4a3018); g.fillRect(0, 14, 16, 1)
    g.fillStyle(0xf0f0e0); g.fillRect(3, 13, 2, 1)                  // chalk pieces
    g.fillStyle(0xe0a050); g.fillRect(11, 13, 2, 1)
    g.fillStyle(0xa05858); g.fillRect(7, 13, 1, 1)
    g.fillStyle(0x4a3a30); g.fillRect(13, 13, 2, 1)                 // eraser
    if (!this.textures.exists('h_chalkboard')) g.generateTexture('h_chalkboard', 16, 16)
    g.destroy()

    // ---------- Avocado tufted armchair (lobby) ----------
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x000000, 0.2); g.fillRect(2, 14, 12, 2)
    g.fillStyle(0x607038); g.fillRect(2, 4, 12, 9)                  // body
    g.fillStyle(0x788848, 0.5); g.fillRect(3, 4, 10, 1)
    g.fillStyle(0x405020); g.fillRect(2, 12, 12, 1)
    g.fillStyle(0x405020); g.fillRect(2, 8, 12, 1)                  // back-cushion seam
    g.fillStyle(0x788848, 0.3); g.fillRect(3, 9, 10, 1)
    g.fillStyle(0x2a3818); g.fillRect(5, 6, 1, 1); g.fillRect(8, 6, 1, 1); g.fillRect(11, 6, 1, 1)
    g.fillStyle(0x2a3818); g.fillRect(4, 7, 1, 1); g.fillRect(7, 7, 1, 1); g.fillRect(10, 7, 1, 1); g.fillRect(12, 7, 1, 1)
    g.fillStyle(0x788848, 0.4); g.fillRect(5, 6, 1, 1); g.fillRect(8, 6, 1, 1)
    g.fillStyle(0x2a3818); g.fillRect(5, 10, 1, 1); g.fillRect(8, 10, 1, 1); g.fillRect(11, 10, 1, 1)
    g.fillStyle(0x506028); g.fillRect(2, 4, 1, 9); g.fillRect(13, 4, 1, 9) // armrests
    g.fillStyle(0x788848); g.fillRect(2, 4, 1, 1); g.fillRect(13, 4, 1, 1)
    g.fillStyle(0xe0e0d0); g.fillRect(5, 4, 6, 1)                   // antimacassar
    g.fillStyle(0x788848, 0.2); g.fillRect(5, 4, 6, 1)
    g.fillStyle(0xa05030); g.fillRect(11, 4, 3, 5)                  // throw blanket
    g.fillStyle(0xc06040, 0.4); g.fillRect(11, 4, 3, 1)
    g.fillStyle(0x804030); g.fillRect(11, 8, 3, 1)
    g.fillStyle(0x405020); g.fillRect(2, 13, 12, 1)                 // pleated skirt
    g.fillStyle(0x506028, 0.5); g.fillRect(3, 13, 1, 1); g.fillRect(7, 13, 1, 1); g.fillRect(11, 13, 1, 1)
    g.fillStyle(0x3a2818); g.fillRect(3, 14, 2, 1); g.fillRect(11, 14, 2, 1)
    g.fillStyle(0x1a0a00); g.fillRect(3, 15, 2, 1); g.fillRect(11, 15, 2, 1)
    if (!this.textures.exists('h_armchair_avocado')) g.generateTexture('h_armchair_avocado', 16, 16)
    g.destroy()

    // ---------- Round dining table (cafeteria) ----------
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x000000, 0.2); g.fillCircle(7.5, 8.5, 7)
    g.fillStyle(0x808890); g.fillCircle(7.5, 7.5, 7.0)              // chrome edge ring
    g.fillStyle(0xe8e0c8); g.fillCircle(7.5, 7.5, 6.8)
    g.fillStyle(0xd0c8a8, 0.7); g.fillCircle(7.5, 7.5, 6.0)
    g.fillStyle(0xf0e8d0, 0.5); g.fillCircle(7.5, 7.0, 5.5)
    g.fillStyle(0x8a6a48); g.fillRect(2, 5, 6, 5)                   // tray
    g.fillStyle(0xa07a58, 0.5); g.fillRect(2, 5, 6, 1)
    g.fillStyle(0x6a4a30); g.fillRect(2, 9, 6, 1)
    g.fillStyle(0xfafaf0); g.fillCircle(5, 7.5, 1.6)                // plate
    g.fillStyle(0xe8e0d0, 0.6); g.fillCircle(5, 7.0, 1.2)
    g.fillStyle(0x8a4030); g.fillRect(4, 7, 2, 1)                   // entrée
    g.fillStyle(0x607030); g.fillRect(4, 8, 1, 1)                   // greens
    g.fillStyle(0xc8a040); g.fillRect(5, 8, 1, 1)                   // mash
    g.fillStyle(0xc0c0c8); g.fillRect(2, 6, 1, 3)                   // fork
    g.fillStyle(0x808890); g.fillRect(2, 6, 1, 1)
    g.fillStyle(0xc0c0c8); g.fillRect(7, 6, 1, 3)                   // knife
    g.fillStyle(0xc0c8d0); g.fillCircle(11, 6, 1.6)                 // glass rim
    g.fillStyle(0xa0c8e0, 0.8); g.fillCircle(11, 6, 1.2)
    g.fillStyle(0xe0f0f8, 0.5); g.fillCircle(11, 5.5, 1.0)
    g.fillStyle(0xf0e0d0); g.fillRect(10, 9, 3, 2)                  // napkin
    g.fillStyle(0xd0c0a8, 0.5); g.fillRect(10, 9, 3, 1)
    g.fillStyle(0x3a3a4a); g.fillRect(6, 0, 4, 2); g.fillRect(6, 14, 4, 2) // chair backs
    g.fillStyle(0x3a3a4a); g.fillRect(0, 6, 2, 4); g.fillRect(14, 6, 2, 4)
    g.fillStyle(0x4a4a5a, 0.5); g.fillRect(7, 0, 2, 1); g.fillRect(7, 14, 2, 1)
    g.fillStyle(0x4a4a5a, 0.5); g.fillRect(0, 7, 1, 2); g.fillRect(15, 7, 1, 2)
    if (!this.textures.exists('h_diningtable')) g.generateTexture('h_diningtable', 16, 16)
    g.destroy()

    // ---------- Modern stainless steam table ----------
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xa0a8b0); g.fillRect(1, 0, 1, 6); g.fillRect(14, 0, 1, 6) // sneeze-guard posts
    g.fillStyle(0xc0c8d0, 0.6); g.fillRect(1, 0, 1, 1); g.fillRect(14, 0, 1, 1)
    g.fillStyle(0xa0a8b0); g.fillRect(1, 0, 14, 1)                  // top bar
    g.fillStyle(0xa0d0e8, 0.18); g.fillRect(2, 1, 12, 4)            // glass panel
    g.fillStyle(0xffffff, 0.15); g.fillRect(2, 1, 12, 1)
    g.fillStyle(0xa0d0e8, 0.08); g.fillRect(3, 2, 10, 3)
    g.fillStyle(0xffffff, 0.5); g.fillCircle(3.5, 4, 1.4); g.fillCircle(8, 3.5, 1.5); g.fillCircle(12.5, 4, 1.4)
    g.fillStyle(0xffffff, 0.35); g.fillCircle(4.5, 2.5, 1); g.fillCircle(9, 2, 1.2); g.fillCircle(13, 2.5, 0.9)
    g.fillStyle(0xffffff, 0.2); g.fillCircle(5, 1.5, 0.8); g.fillCircle(10, 1, 0.8); g.fillCircle(13.5, 1.5, 0.8)
    g.fillStyle(0xb8c0c8); g.fillRect(1, 6, 14, 9)                  // body
    g.fillStyle(0xd8e0e8, 0.5); g.fillRect(1, 6, 14, 1)
    g.fillStyle(0x707880, 0.4); g.fillRect(1, 14, 14, 1)
    g.lineStyle(1, 0x808890); g.strokeRect(1, 6, 14, 9)
    g.fillStyle(0xc0c8d0, 0.3); g.fillRect(2, 13, 1, 1); g.fillRect(6, 13, 1, 1); g.fillRect(10, 13, 1, 1); g.fillRect(13, 13, 1, 1)
    g.fillStyle(0x707880); g.fillRect(2, 7, 4, 1); g.fillRect(7, 7, 4, 1); g.fillRect(12, 7, 3, 1)
    g.fillStyle(0x303840); g.fillRect(2, 8, 4, 5); g.fillRect(7, 8, 4, 5); g.fillRect(12, 8, 3, 5)
    g.fillStyle(0xc05030); g.fillRect(2, 9, 4, 2); g.fillStyle(0xe06040, 0.4); g.fillRect(2, 9, 4, 1)
    g.fillStyle(0xa08838); g.fillRect(7, 9, 4, 2); g.fillStyle(0xc0a050, 0.4); g.fillRect(7, 9, 4, 1)
    g.fillStyle(0x607030); g.fillRect(12, 9, 3, 2); g.fillStyle(0x809040, 0.4); g.fillRect(12, 9, 3, 1)
    g.fillStyle(0xc0c0c8); g.fillRect(4, 8, 1, 1); g.fillRect(9, 8, 1, 1); g.fillRect(13, 8, 1, 1)
    g.fillStyle(0xf0e8d0); g.fillRect(2, 12, 4, 1); g.fillRect(7, 12, 4, 1); g.fillRect(12, 12, 3, 1)
    g.fillStyle(0x202028); g.fillRect(3, 12, 2, 1); g.fillRect(8, 12, 2, 1); g.fillRect(12, 12, 2, 1)
    g.fillStyle(0x202028); g.fillRect(13, 13, 2, 1)
    g.fillStyle(0x40d080); g.fillRect(13, 13, 1, 1)
    if (!this.textures.exists('h_steamtable_modern')) g.generateTexture('h_steamtable_modern', 16, 16)
    g.destroy()

    // ---------- Brass buffet steam table ----------
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xa05020); g.fillRect(1, 0, 14, 1)                  // heat-lamp bracket
    g.fillStyle(0xe06030); g.fillRect(2, 1, 12, 1)                  // lamp tube
    g.fillStyle(0xff8050, 0.6); g.fillRect(2, 1, 12, 1)
    g.fillStyle(0xffa080, 0.4); g.fillRect(3, 1, 10, 1)
    g.fillStyle(0xffffff, 0.45); g.fillCircle(3.5, 4, 1.2); g.fillCircle(7.5, 3.5, 1.3); g.fillCircle(11.5, 4, 1.2)
    g.fillStyle(0xffffff, 0.3); g.fillCircle(4, 2.5, 0.9); g.fillCircle(8, 2, 1); g.fillCircle(12, 2.5, 0.9)
    g.fillStyle(0xffffff, 0.2); g.fillCircle(5, 1.5, 0.7); g.fillCircle(9, 1, 0.8); g.fillCircle(12.5, 1.5, 0.7)
    g.fillStyle(0xa07030); g.fillRect(1, 6, 14, 9)                  // brass housing
    g.fillStyle(0xc09040, 0.5); g.fillRect(1, 6, 14, 1)
    g.fillStyle(0x804018); g.fillRect(1, 14, 14, 1)
    g.lineStyle(1, 0x804018); g.strokeRect(1, 6, 14, 9)
    g.fillStyle(0xc09040); g.fillRect(1, 13, 14, 1)
    g.fillStyle(0xe0a060, 0.4); g.fillRect(1, 13, 14, 1)
    g.fillStyle(0x6a4818); g.fillRect(2, 7, 3, 1); g.fillRect(5, 7, 3, 1); g.fillRect(8, 7, 3, 1); g.fillRect(11, 7, 3, 1)
    g.fillStyle(0x303030); g.fillRect(2, 8, 3, 5); g.fillRect(5, 8, 3, 5); g.fillRect(8, 8, 3, 5); g.fillRect(11, 8, 3, 5)
    g.fillStyle(0x9a3a20); g.fillRect(2, 9, 3, 2); g.fillStyle(0xc05030, 0.4); g.fillRect(2, 9, 3, 1)
    g.fillStyle(0xa08038); g.fillRect(5, 9, 3, 2); g.fillStyle(0xc0a050, 0.4); g.fillRect(5, 9, 3, 1)
    g.fillStyle(0x507028); g.fillRect(8, 9, 3, 2); g.fillStyle(0x708840, 0.4); g.fillRect(8, 9, 3, 1)
    g.fillStyle(0xb8a060); g.fillRect(11, 9, 3, 2); g.fillStyle(0xd8c080, 0.4); g.fillRect(11, 9, 3, 1)
    g.fillStyle(0xc0c0c8); g.fillRect(3, 8, 1, 1); g.fillRect(6, 8, 1, 1); g.fillRect(9, 8, 1, 1); g.fillRect(12, 8, 1, 1)
    g.fillStyle(0x808890); g.fillRect(3, 7, 1, 1); g.fillRect(6, 7, 1, 1); g.fillRect(9, 7, 1, 1); g.fillRect(12, 7, 1, 1)
    g.fillStyle(0xf0e0c0); g.fillRect(2, 12, 3, 1); g.fillRect(5, 12, 3, 1); g.fillRect(8, 12, 3, 1); g.fillRect(11, 12, 3, 1)
    g.fillStyle(0x402a18); g.fillRect(3, 12, 1, 1); g.fillRect(6, 12, 1, 1); g.fillRect(9, 12, 1, 1); g.fillRect(12, 12, 1, 1)
    if (!this.textures.exists('h_steamtable_buffet')) g.generateTexture('h_steamtable_buffet', 16, 16)
    g.destroy()

    // ---------- Parking-line stripe ('=' glyph) ----------
    // Asphalt floor with white painted stripes on the left + right
    // edges. Used in the OUTDOOR room flanking each parked car so
    // adjacent parking spaces share a 2-px stripe at their boundary.
    // Walkable — players can move freely across stripes.
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x4a4848); g.fillRect(0, 0, 16, 16)            // dark asphalt base
    g.fillStyle(0xe8e8d8); g.fillRect(0, 0, 1, 16)             // left stripe
    g.fillStyle(0xe8e8d8); g.fillRect(15, 0, 1, 16)            // right stripe
    g.fillStyle(0x282828, 0.4); g.fillRect(0, 7, 1, 2)         // wear on left stripe
    g.fillStyle(0x282828, 0.4); g.fillRect(15, 5, 1, 2)        // wear on right stripe
    if (!this.textures.exists('h_asphalt_striped')) g.generateTexture('h_asphalt_striped', 16, 16)
    g.destroy()

    // ---------- Curb ('C' glyph) ----------
    // Concrete curb between the parking lot and the street. Solid —
    // acts as a barrier so the player can't wander into the road.
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x5a5650); g.fillRect(0, 0, 16, 16)            // base
    g.fillStyle(0x787268); g.fillRect(0, 0, 16, 4)             // raised top edge
    g.fillStyle(0xa0998a); g.fillRect(0, 0, 16, 1)             // top highlight
    g.fillStyle(0x3a362e); g.fillRect(0, 4, 16, 1)             // top/edge joint
    g.fillStyle(0x3a362e); g.fillRect(7, 4, 1, 12)             // expansion joint mid
    if (!this.textures.exists('h_curb')) g.generateTexture('h_curb', 16, 16)
    g.destroy()

    // ---------- Road / street ('r' glyph) ----------
    // Darker than parking-lot asphalt. Yellow dashed center line
    // (3 dashes per tile) + white edge stripes top + bottom. Solid
    // — the street is decorative; player navigates the lot, not
    // the road.
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x1e1e22); g.fillRect(0, 0, 16, 16)            // road base
    g.fillStyle(0xe0e0d0); g.fillRect(0, 1, 16, 1)             // top edge stripe
    g.fillStyle(0xe0e0d0); g.fillRect(0, 14, 16, 1)            // bottom edge stripe
    g.fillStyle(0xe8c040); g.fillRect(1, 7, 4, 1)              // center dash 1
    g.fillStyle(0xe8c040); g.fillRect(7, 7, 4, 1)              // center dash 2
    g.fillStyle(0xe8c040); g.fillRect(13, 7, 3, 1)             // center dash 3 (truncated)
    g.fillStyle(0xffffff, 0.04); g.fillRect(3, 4, 3, 1)        // pavement noise
    g.fillStyle(0xffffff, 0.04); g.fillRect(10, 11, 4, 1)
    if (!this.textures.exists('h_road')) g.generateTexture('h_road', 16, 16)
    g.destroy()
  }

  private makeWaitingRoomTiles() {
    // Floor — slightly off, cracked
    let g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x1a1e25)
    g.fillRect(0, 0, 16, 16)
    g.lineStyle(1, 0x252a33, 0.4)
    g.strokeRect(0, 0, 16, 16)
    g.lineStyle(1, 0x3a3a3a, 0.2)
    g.lineBetween(3, 0, 12, 16) // crack
    g.generateTexture('wr_floor', 16, 16)
    g.destroy()

    // Wall — darker, unsettling
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x252833)
    g.fillRect(0, 0, 16, 16)
    g.lineStyle(1, 0x353845)
    g.strokeRect(0, 0, 16, 16)
    g.generateTexture('wr_wall', 16, 16)
    g.destroy()

    // Waiting chair — infinite repeating
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x4a4a5a)
    g.fillRect(2, 4, 12, 8)
    g.fillStyle(0x3a3a4a)
    g.fillRect(4, 12, 3, 4)
    g.fillRect(9, 12, 3, 4)
    g.generateTexture('wr_chair', 16, 16)
    g.destroy()

    // Ticket counter
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x3a3a4a)
    g.fillRect(0, 2, 16, 12)
    g.fillStyle(0xef5b7b)
    g.fillRect(4, 4, 8, 6) // red number display
    g.generateTexture('wr_counter', 16, 16)
    g.destroy()

    // Floating paper particle
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xd0d0d0, 0.6)
    g.fillRect(0, 0, 6, 8)
    g.lineStyle(1, 0xa0a0a0, 0.4)
    g.lineBetween(1, 2, 5, 2)
    g.lineBetween(1, 4, 4, 4)
    g.generateTexture('wr_paper', 6, 8)
    g.destroy()
  }

  private makeUIElements() {
    // Text box background
    let g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x0e1116, 0.92)
    g.fillRoundedRect(0, 0, 400, 120, 8)
    g.lineStyle(2, 0x2a323d)
    g.strokeRoundedRect(0, 0, 400, 120, 8)
    g.generateTexture('ui_textbox', 400, 120)
    g.destroy()

    // Heart icon
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xef5b7b)
    g.fillCircle(4, 4, 3)
    g.fillCircle(10, 4, 3)
    g.fillTriangle(1, 5, 13, 5, 7, 12)
    g.generateTexture('ui_heart', 14, 13)
    g.destroy()

    // Cash icon
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x6cd49a)
    g.fillCircle(6, 6, 6)
    g.fillStyle(0x1a1e25)
    g.fillRect(5, 2, 2, 8)
    g.generateTexture('ui_cash', 12, 12)
    g.destroy()

    // Battle action button bg
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x1f262f)
    g.fillRoundedRect(0, 0, 180, 40, 6)
    g.lineStyle(1, 0x2a323d)
    g.strokeRoundedRect(0, 0, 180, 40, 6)
    g.generateTexture('ui_action_btn', 180, 40)
    g.destroy()

    // Battle action button hover
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0x1f262f)
    g.fillRoundedRect(0, 0, 180, 40, 6)
    g.lineStyle(2, 0x7ee2c1)
    g.strokeRoundedRect(0, 0, 180, 40, 6)
    g.generateTexture('ui_action_btn_hover', 180, 40)
    g.destroy()
  }

  private makeDocumentSprites() {
    // CMS-1500 form (simplified icon)
    let g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xffffff)
    g.fillRect(0, 0, 12, 16)
    g.lineStyle(1, 0xcccccc)
    g.strokeRect(0, 0, 12, 16)
    g.fillStyle(0xef5b7b)
    g.fillRect(1, 1, 10, 2) // red header
    g.fillStyle(0xaaaaaa)
    g.fillRect(2, 5, 8, 1)
    g.fillRect(2, 7, 6, 1)
    g.fillRect(2, 9, 7, 1)
    g.fillRect(2, 11, 5, 1)
    g.fillRect(2, 13, 8, 1)
    g.generateTexture('doc_cms1500', 12, 16)
    g.destroy()

    // UB-04 form
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xffffff)
    g.fillRect(0, 0, 12, 16)
    g.lineStyle(1, 0xcccccc)
    g.strokeRect(0, 0, 12, 16)
    g.fillStyle(0x6da9e3)
    g.fillRect(1, 1, 10, 2) // blue header
    g.fillStyle(0xaaaaaa)
    g.fillRect(2, 5, 8, 1)
    g.fillRect(2, 7, 6, 1)
    g.fillRect(2, 9, 7, 1)
    g.fillRect(2, 11, 5, 1)
    g.fillRect(2, 13, 8, 1)
    g.generateTexture('doc_ub04', 12, 16)
    g.destroy()

    // 835 remittance
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xf0f0e8)
    g.fillRect(0, 0, 12, 16)
    g.lineStyle(1, 0xcccccc)
    g.strokeRect(0, 0, 12, 16)
    g.fillStyle(0x6cd49a)
    g.fillRect(1, 1, 10, 2)
    g.fillStyle(0xaaaaaa)
    g.fillRect(2, 5, 8, 1)
    g.fillRect(2, 7, 6, 1)
    g.fillRect(2, 9, 7, 1)
    g.generateTexture('doc_835', 12, 16)
    g.destroy()

    // EOB
    g = this.make.graphics({ x: 0, y: 0 })
    g.fillStyle(0xfff8e8)
    g.fillRect(0, 0, 12, 16)
    g.lineStyle(1, 0xcccccc)
    g.strokeRect(0, 0, 12, 16)
    g.fillStyle(0xf0a868)
    g.fillRect(1, 1, 10, 2)
    g.fillStyle(0xaaaaaa)
    g.fillRect(2, 5, 8, 1)
    g.fillRect(2, 9, 6, 1)
    g.generateTexture('doc_eob', 12, 16)
    g.destroy()

    // DENIED stamp overlay
    g = this.make.graphics({ x: 0, y: 0 })
    g.lineStyle(3, 0xef5b7b, 0.8)
    g.strokeRect(2, 6, 60, 20)
    g.generateTexture('stamp_denied', 64, 32)
    g.destroy()
  }

  private makeEncounterPortraits() {
    const factions: { key: string; color: number; accent: number; icon: (g: Phaser.GameObjects.Graphics) => void }[] = [
      {
        key: 'enc_payer', color: 0x6da9e3, accent: 0x4a7ab0,
        icon: (g) => {
          // Shield shape — insurance payer
          g.fillStyle(0x6da9e3)
          g.fillRect(12, 4, 24, 20)
          g.fillTriangle(12, 24, 36, 24, 24, 38)
          g.fillStyle(0x4a7ab0)
          g.fillRect(20, 8, 8, 12)
          g.fillStyle(0xffffff, 0.3)
          g.fillRect(14, 6, 6, 4)
        },
      },
      {
        key: 'enc_provider', color: 0xec8f6e, accent: 0xc06a48,
        icon: (g) => {
          // Clipboard — provider side
          g.fillStyle(0xec8f6e)
          g.fillRect(10, 2, 28, 36)
          g.fillStyle(0xf0f0e8)
          g.fillRect(13, 8, 22, 26)
          g.fillStyle(0xc06a48)
          g.fillRect(19, 0, 10, 4)
          g.fillRect(16, 12, 16, 2)
          g.fillRect(16, 18, 12, 2)
          g.fillRect(16, 24, 14, 2)
        },
      },
      {
        key: 'enc_vendor', color: 0x6cd49a, accent: 0x48a870,
        icon: (g) => {
          // Gear — vendor/system
          g.fillStyle(0x6cd49a)
          g.fillCircle(24, 22, 14)
          g.fillStyle(0x0e1116)
          g.fillCircle(24, 22, 7)
          g.fillStyle(0x6cd49a)
          g.fillRect(22, 4, 4, 8)
          g.fillRect(22, 32, 4, 8)
          g.fillRect(8, 20, 8, 4)
          g.fillRect(32, 20, 8, 4)
        },
      },
      {
        key: 'enc_patient', color: 0xf4d06f, accent: 0xc0a040,
        icon: (g) => {
          // Person silhouette — patient
          g.fillStyle(0xf4d06f)
          g.fillCircle(24, 10, 8)
          g.fillRect(14, 20, 20, 14)
          g.fillStyle(0xc0a040)
          g.fillRect(18, 26, 4, 2)
          g.fillRect(26, 26, 4, 2)
        },
      },
      {
        key: 'enc_system', color: 0xa3aab5, accent: 0x708090,
        icon: (g) => {
          // Terminal/screen — system error
          g.fillStyle(0x708090)
          g.fillRect(8, 4, 32, 24)
          g.fillStyle(0x1a2a1a)
          g.fillRect(10, 6, 28, 20)
          g.fillStyle(0x40d080)
          g.fillRect(13, 10, 12, 2)
          g.fillRect(13, 14, 18, 2)
          g.fillRect(13, 18, 8, 2)
          g.fillStyle(0x708090)
          g.fillRect(18, 30, 12, 4)
          g.fillRect(14, 34, 20, 2)
        },
      },
    ]

    for (const f of factions) {
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0x1a2030)
      g.fillRect(0, 0, 48, 48)
      g.lineStyle(2, f.color, 0.6)
      g.strokeRect(1, 1, 46, 46)
      f.icon(g)
      g.generateTexture(f.key, 48, 48)
      g.destroy()
    }
  }
}
