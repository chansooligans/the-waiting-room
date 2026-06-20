import Phaser from 'phaser'
import { safeFinishSoundTween } from './soundFadeHelper'
import { getState, saveGame } from '../state'
import { LEVELS } from '../content/levels'
import { ENCOUNTERS } from '../content/enemies'
import { HOSPITAL_MAP } from '../content/maps'
import { showNarration } from './narration'
import { isTouchDevice } from './device'
import { debugEvent } from './debugRibbon'
import { pickNextTrack } from './musicShuffle'
import type { MapDef } from '../content/maps'

// Tile size in game pixels — see HospitalScene for the full
// rationale on the 32→64 bump. The Waiting Room is a parallel
// layer on the same map, so it needs to match.
const TILE = 64

// See HospitalScene — keeps the 2-tiles-tall character feel.
const CHARACTER_SCALE = 2

// Mirror of HospitalScene.OBJECT_DISPLAY_MULT — objects render
// 1.5× tile size by default. Kept as its own const here (rather
// than imported) since the two scenes have independent visual
// budgets and the WR red-room register might want a different
// scale tomorrow.
const OBJECT_DISPLAY_MULT = 1.5

/**
 * The Waiting Room is a *parallel layer* — it shares the Hospital's
 * floor plan, transformed. Same walls, same doors, same rooms; the
 * register flips from "Animal Crossing cozy" to "Twin Peaks Red Room
 * cranked up to dramatic + cyberpunk." Per the design doc:
 *
 *   "Below the hospital you know, there is another place… every
 *    claim that was ever filed still exists, waiting."
 *
 * Mechanically: the WR is summoned by NPC dialogue. The conversation
 * pulls the player downstairs with one specific case (`activeEncounterId`
 * passed via init). Only that obstacle is rendered; the others stay
 * dark until their own NPC calls. Player walks to the lit obstacle,
 * presses E, the puzzle launches, and on completion the scene returns
 * directly to the Hospital — the player wakes up next to whoever
 * handed them the case.
 *
 * Free-roam mode (no activeEncounterId) is retained as a fallback: it
 * renders every obstacle and exits via the gap. The dev panel uses it.
 */

interface ObstacleMarker {
  /** World-space tile coordinate inside the Hospital room. */
  tileX: number
  tileY: number
  encounterId: string
  /**
   * When this marker is the active one for an NPC-triggered descent,
   * confine the player to this rectangle (in tile units). Prevents the
   * player from wandering to other obstacles' rooms during a focused
   * case. Optional — when absent or in free-roam mode, no extra
   * confinement beyond the map's solid tiles.
   */
  bounds?: { x: number; y: number; w: number; h: number }
}

/**
 * Encounter placement on the Hospital level-1 map. Each one sits inside
 * a thematically-appropriate room.
 *   Patient Services (2-13, 17-24)   → Wraith (med necessity, sad-witness register)
 *   Registration   (15-36, 17-24)    → Fog + Swarm (eligibility + data quality)
 *   Eligibility    (24-33, 24-29)    → Gatekeeper (auth — the kiosk is literally a gate)
 *   Main Hub       (20-37, 3-12)     → Hydra + Reaper (hub-as-tribunal)
 *   Corridor       (x=14, y=14..29)  → Bundle + Doppelgänger (in-transit fights)
 *   Lobby          — no fights (the safe entry space)
 *   Prior Auth     — locked (post-L1)
 */
// Room bounds (mirror level1.ts) so each WR session is locked to the
// parallel layer of the room where the player handed off the case.
// The 'parallel room' framing is the whole point — solving the bundle
// for Pat means descending into HIM's mirror, not wandering the
// entire underworld map.
const LOBBY_BOUNDS        = { x: 4,  y: 32, w: 26, h: 10 }
const MAIN_HUB_BOUNDS     = { x: 20, y: 3,  w: 18, h: 10 }
const PRIOR_AUTH_BOUNDS   = { x: 37, y: 3,  w: 14, h: 10 }
const PATIENT_SVC_BOUNDS  = { x: 2,  y: 17, w: 12, h: 8  }
const REGISTRATION_BOUNDS = { x: 15, y: 17, w: 22, h: 8  }
const ELIGIBILITY_BOUNDS  = { x: 24, y: 24, w: 10, h: 6  }
const HIM_BOUNDS          = { x: 4,  y: 50, w: 14, h: 10 }
const BILLING_BOUNDS      = { x: 22, y: 50, w: 14, h: 10 }
const PFS_BOUNDS          = { x: 40, y: 50, w: 16, h: 10 }
// AUDIT relocated to second floor (y=100..110). The WR session for the
// boss is bounded to AUDIT's new mirror; the WR layer auto-mirrors the
// hospital's tilemap, so this is just a coord update.
const AUDIT_BOUNDS        = { x: 4,  y: 100, w: 28, h: 10 }

const OBSTACLES: ObstacleMarker[] = [
  // Each obstacle is placed in the parallel layer of the room where
  // its case-handing NPC stands in the Hospital — so descending lands
  // the player roughly where they were. Bounds match the source room
  // so the WR session can't drift across the underworld map.

  // L1 — Anjali in the LOBBY.
  { tileX: 14, tileY: 36, encounterId: 'intro_wrong_card',     bounds: LOBBY_BOUNDS },

  // PATIENT SERVICES — Sam hands the wraith / reaper.
  { tileX: 5,  tileY: 21, encounterId: 'co_50',                bounds: PATIENT_SVC_BOUNDS },  // Wraith    (L5)
  { tileX: 11, tileY: 21, encounterId: 'co_29_reaper',         bounds: PATIENT_SVC_BOUNDS },  // Reaper    (L7)

  // PRIOR AUTH — Martinez hands the gatekeeper.
  { tileX: 44, tileY: 8,  encounterId: 'co_197',               bounds: PRIOR_AUTH_BOUNDS },   // Gatekeeper (L5)

  // REGISTRATION — Kim hands the fog / doppelgänger.
  // (Hydra was here at L9 in the prior rotation; now prototype-only.
  // Doppelgänger took the slot — it moved from free-roam corridor to
  // a Kim-handed registration encounter.)
  { tileX: 20, tileY: 21, encounterId: 'eligibility_fog',      bounds: REGISTRATION_BOUNDS }, // Fog       (L2)
  { tileX: 32, tileY: 21, encounterId: 'co_18_doppelganger',   bounds: REGISTRATION_BOUNDS }, // Doppelgänger (L9)

  // HIM / Coding — Pat hands the bundle.
  { tileX: 11, tileY: 55, encounterId: 'co_97',                bounds: HIM_BOUNDS },          // Bundle    (L4)

  // BILLING — Alex hands the swarm.
  { tileX: 29, tileY: 55, encounterId: 'co_16_swarm',          bounds: BILLING_BOUNDS },      // Swarm     (L6)

  // PFS — Jordan hands the surprise bill.
  { tileX: 48, tileY: 55, encounterId: 'surprise_bill_specter', bounds: PFS_BOUNDS },          // Specter   (L8)

  // AUDIT — Dana hands the boss. Audit moved to second floor; the
  // boss obstacle moves with it so the WR mirror lines up.
  { tileX: 18, tileY: 105, encounterId: 'boss_audit',          bounds: AUDIT_BOUNDS },        // Boss      (L33)

  // ===== Catalog encounters (iframe-mounted) =====
  // Each marker is placed in the parallel layer of the room where
  // its case-handing NPC stands at the matching level. WR.tryEngage-
  // Obstacle dispatches to PrototypeIframeScene for these (the
  // encounter's `prototypeIframeUrl` field is the discriminator).

  // MAIN HUB — Alex (L2 asp-wac, L4 stoploss).
  { tileX: 26, tileY: 7,  encounterId: 'catalog_asp_wac_apothecary',        bounds: MAIN_HUB_BOUNDS },
  { tileX: 30, tileY: 7,  encounterId: 'catalog_stoploss_reckoner',         bounds: MAIN_HUB_BOUNDS },

  // REGISTRATION — Kim (L16 credentialing, L22 phantom-patient, L27 cob),
  //                Pat (L6 form-mirror, L7 outpatient-grouper) until L9.
  { tileX: 18, tileY: 21, encounterId: 'catalog_form_mirror',               bounds: REGISTRATION_BOUNDS },
  { tileX: 22, tileY: 21, encounterId: 'catalog_outpatient_surgery_grouper', bounds: REGISTRATION_BOUNDS },
  { tileX: 26, tileY: 21, encounterId: 'catalog_credentialing_lattice',     bounds: REGISTRATION_BOUNDS },
  { tileX: 28, tileY: 21, encounterId: 'catalog_phantom_patient',           bounds: REGISTRATION_BOUNDS },
  { tileX: 34, tileY: 21, encounterId: 'catalog_cob_cascade_spider',        bounds: REGISTRATION_BOUNDS },

  // ELIGIBILITY — Jordan (L8 no-show, L10 lighthouse).
  { tileX: 27, tileY: 27, encounterId: 'catalog_no_show_bill',              bounds: ELIGIBILITY_BOUNDS },
  { tileX: 30, tileY: 27, encounterId: 'lighthouse_charity',                bounds: ELIGIBILITY_BOUNDS },

  // PATIENT SERVICES — Sam (L11 gfe, L29 mrf, L30 idr, L32 hipaa).
  { tileX: 4,  tileY: 21, encounterId: 'catalog_gfe_oracle',                bounds: PATIENT_SVC_BOUNDS },
  { tileX: 9,  tileY: 22, encounterId: 'catalog_mrf_cartographer',          bounds: PATIENT_SVC_BOUNDS },
  { tileX: 6,  tileY: 22, encounterId: 'catalog_idr_crucible',              bounds: PATIENT_SVC_BOUNDS },
  { tileX: 10, tileY: 23, encounterId: 'catalog_hipaa_spider',              bounds: PATIENT_SVC_BOUNDS },

  // HIM / Coding — Pat from L9 onwards (L18 cpt, L23 risk-adj, L25 two-midnight).
  { tileX: 9,  tileY: 55, encounterId: 'catalog_cpt_licensure_mire',        bounds: HIM_BOUNDS },
  { tileX: 14, tileY: 55, encounterId: 'catalog_risk_adj_hollow',           bounds: HIM_BOUNDS },
  { tileX: 7,  tileY: 56, encounterId: 'catalog_two_midnight_mire',         bounds: HIM_BOUNDS },

  // BILLING — Alex from L13 onwards (L15 implant, L17 carveout-phantom,
  // L21 ob-perdiem, L24 chemo, L26 underpayment, L28 case-rate, L31 340b).
  { tileX: 27, tileY: 55, encounterId: 'catalog_implant_carveout_specter',  bounds: BILLING_BOUNDS },
  { tileX: 31, tileY: 55, encounterId: 'catalog_carveout_phantom',          bounds: BILLING_BOUNDS },
  { tileX: 33, tileY: 55, encounterId: 'catalog_ob_perdiem_specter',        bounds: BILLING_BOUNDS },
  { tileX: 25, tileY: 56, encounterId: 'catalog_chemo_bundle_specter',      bounds: BILLING_BOUNDS },
  { tileX: 28, tileY: 56, encounterId: 'underpayment_specter',              bounds: BILLING_BOUNDS },
  { tileX: 31, tileY: 56, encounterId: 'catalog_case_rate_specter',         bounds: BILLING_BOUNDS },
  { tileX: 34, tileY: 56, encounterId: 'catalog_three_forty_b_specter',     bounds: BILLING_BOUNDS },
]

interface ObstacleSprite {
  marker: ObstacleMarker
  graphics: Phaser.GameObjects.Graphics
  label: Phaser.GameObjects.Text
}

/**
 * Per-tile-char rendering for the Waiting Room. Same chars as
 * `HospitalScene.TILE_TEXTURES` (so we can read the same map), but
 * each one transformed: walls → red curtains, floors → B&W chevron,
 * doors → neon-glowing portals, chairs → red velvet, counters →
 * ticket-counter monitors, etc.
 */
interface WrTileDef {
  /** Sprite key — uses wr_* sprites where they exist, else falls back to h_* with heavy tint. */
  sprite: string
  /** Tint applied to the base sprite. */
  tint: number
  /** True if the player can't walk over this tile. */
  solid: boolean
  /** Object sprite drawn on top (chairs, counters, etc.). */
  obj?: string
  /** Object tint. */
  objTint?: number
  /** Cyberpunk overlay: glowing neon ring around the tile. */
  glow?: number
}

const WR_TILES: Record<string, WrTileDef> = {
  // Walls → red curtain panels (alternating fold tint applied per-tile in buildMap)
  'W': { sprite: 'wr_wall', tint: 0x6a0d10, solid: true },
  // Doors → neon-portal floor + soft glow
  'D': { sprite: 'wr_floor', tint: 0x141014, solid: false, glow: 0xff3050 },
  'L': { sprite: 'wr_floor', tint: 0x2a0608, solid: true,  glow: 0x6a4828 }, // dim/dead-neon (locked)
  // Floor: chevron checkerboard handled per-tile
  '.': { sprite: 'wr_floor', tint: 0xd8cfc4, solid: false },
  '~': { sprite: 'wr_floor', tint: 0x141014, solid: false },
  '_': { sprite: 'wr_floor', tint: 0x4a0608, solid: false }, // burgundy carpet
  // Furniture / props — re-skinned for the Red Room
  'c': { sprite: 'wr_floor', tint: 0xd8cfc4, solid: false, obj: 'h_desk',       objTint: 0x2a0608 },
  'h': { sprite: 'wr_floor', tint: 0xd8cfc4, solid: false, obj: 'wr_chair',     objTint: 0x6a0d10 },
  'P': { sprite: 'wr_floor', tint: 0xd8cfc4, solid: false, obj: 'h_plant',      objTint: 0x4a0608 }, // dried-blood plant
  'w': { sprite: 'wr_floor', tint: 0xd8cfc4, solid: true,  obj: 'h_water',      objTint: 0xff3050, glow: 0xff3050 }, // neon dispenser
  'F': { sprite: 'wr_floor', tint: 0xd8cfc4, solid: true,  obj: 'h_cabinet',    objTint: 0x2a0608 },
  'B': { sprite: 'wr_floor', tint: 0xd8cfc4, solid: true,  obj: 'h_whiteboard', objTint: 0xff3050, glow: 0xff3050 }, // monitor
  'R': { sprite: 'wr_floor', tint: 0xd8cfc4, solid: true,  obj: 'wr_counter',   objTint: 0x6a0d10 }, // ticket counter
  'V': { sprite: 'wr_floor', tint: 0xd8cfc4, solid: true,  obj: 'h_vending',    objTint: 0xff3050, glow: 0xff3050 }, // glowing vending
  'b': { sprite: 'wr_floor', tint: 0xd8cfc4, solid: true,  obj: 'h_bulletin',   objTint: 0x6a0d10 },
  'H': { sprite: 'wr_floor', tint: 0xd8cfc4, solid: true,  obj: 'h_bed',        objTint: 0x4a0608 },
  'X': { sprite: 'wr_floor', tint: 0xd8cfc4, solid: false, obj: 'h_fax',        objTint: 0xff3050, glow: 0xff3050 }, // CRT terminal
  'E': { sprite: 'wr_floor', tint: 0xd8cfc4, solid: false, obj: 'h_equipment',  objTint: 0x2a0608 },
  // Stair / outdoor-exit teleport tiles. WR sessions are bounded to a
  // single hospital room so these aren't actually traversable inside
  // the WR — they only render as floor tiles. Kept as their own entries
  // (vs. falling through to '.') so the WR's parallel-layer reading is
  // visually consistent if the player is ever near them.
  'S': { sprite: 'wr_floor', tint: 0x2a0608, solid: false, glow: 0xff3050 }, // stair landing — burgundy with red neon
  'O': { sprite: 'wr_floor', tint: 0x141014, solid: false }, // outdoor exit reads as void in WR
}

function tileForChar(ch: string): WrTileDef {
  return WR_TILES[ch] ?? WR_TILES['.']
}

export class WaitingRoomScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite
  private playerFacing: 'down' | 'up' | 'left' | 'right' = 'down'
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private wasdKeys!: Record<string, Phaser.Input.Keyboard.Key>
  private canMove = true
  private playerTileX = 0
  private playerTileY = 0
  private mapDef!: MapDef
  /** When set, only this obstacle is rendered + engageable. The session
   *  was opened by a dialogue handoff and the player is here to handle
   *  exactly this one case. Null = legacy free-roam mode. */
  private activeEncounterId: string | null = null
  /** When set, tryMove rejects any tile outside this rectangle —
   *  confines the player to the active obstacle's room. */
  private sessionBounds: { x: number; y: number; w: number; h: number } | null = null
  /** Spawn tile passed in by the dialogue handoff — the player's
   *  Hospital tile at the moment of descent. WR drops them at the
   *  same coords so the room-by-room parallelism reads. */
  private pendingSpawnX: number | null = null
  private pendingSpawnY: number | null = null

  private floatingMotes: Phaser.GameObjects.Graphics[] = []
  private ticketText!: Phaser.GameObjects.Text
  private hudLevel!: Phaser.GameObjects.Text
  private obstacleSprites: ObstacleSprite[] = []
  private engagePrompt!: Phaser.GameObjects.Text
  private nearbyObstacle: ObstacleSprite | null = null

  constructor() {
    super('WaitingRoom')
  }

  init(data: { activeEncounterId?: string; spawnTileX?: number; spawnTileY?: number }) {
    this.activeEncounterId = data?.activeEncounterId ?? null
    this.pendingSpawnX = data?.spawnTileX ?? null
    this.pendingSpawnY = data?.spawnTileY ?? null
    const activeMarker = this.activeEncounterId
      ? OBSTACLES.find(m => m.encounterId === this.activeEncounterId)
      : null
    this.sessionBounds = activeMarker?.bounds ?? null
  }

  preload() {
    // Red Room ambience — picked at random in startRedRoomAmbience.
    // Loaded here (not in BootScene) so the title doesn't wait on
    // ~16MB of music until the player actually descends. Phaser's
    // .load.audio is idempotent so this is a no-op on subsequent
    // entries that re-use the cached audio.
    if (!this.cache.audio.exists('red_room_1')) {
      this.load.audio('red_room_1', 'audio/wr/red_room_1.mp3')
    }
    if (!this.cache.audio.exists('red_room_2')) {
      this.load.audio('red_room_2', 'audio/wr/red_room_2.mp3')
    }
    if (!this.cache.audio.exists('red_room_3')) {
      this.load.audio('red_room_3', 'audio/wr/red_room_3.mp3')
    }
  }

  create() {
    debugEvent(`wr:create encounter=${this.activeEncounterId ?? '-'}`)
    const state = getState()
    this.mapDef = HOSPITAL_MAP

    // Spawn at the same tile the player was standing on in the
    // Hospital — the WR is a parallel layer over the same map, so
    // they fall straight down into the corresponding room. Falls
    // back to the map's playerStart if the scene was launched without
    // a spawn (e.g. from the dev panel).
    this.playerTileX = this.pendingSpawnX ?? this.mapDef.playerStart.x
    this.playerTileY = this.pendingSpawnY ?? this.mapDef.playerStart.y

    // Deeper burgundy than the Hospital's warm dark — this is the
    // dramatic stage. Pure black with red highlights would feel too
    // much like a haunted house; #1a0608 reads as theatrical.
    this.cameras.main.setBackgroundColor(0x1a0608)
    this.canMove = true
    this.floatingMotes = []
    this.obstacleSprites = []
    this.nearbyObstacle = null

    this.buildMap()
    this.placePlayer()
    this.addAtmosphere()
    this.addIntroCallbacks()
    this.placeObstacles()
    this.setupInput()
    this.buildHUD()

    this.cameras.main.startFollow(this.player, true, 0.08, 0.08)
    this.cameras.main.setZoom(1.5)
    this.cameras.main.setBounds(0, 0, this.mapDef.width * TILE, this.mapDef.height * TILE)
    // Fade in from black — the player just fell through the gap,
    // and the WR resolves out of the dark.
    this.cameras.main.fadeIn(700, 0, 0, 0)


    // Fade out anything bleeding in from above — the hospital
    // ambient track or, if the player skipped fast, the intro song.
    // Both live on the global sound manager and would otherwise keep
    // playing under the WR ambience.
    this.fadeOutHospitalLayerAudio(900)

    // Red Room ambience — pick one of three tracks at random, loop
    // it, and fade in over 2s. The sound is on the global manager so
    // it carries through the prototype overlay; PrototypeIframeScene
    // fades it out as part of its post-submit return transition.
    this.startRedRoomAmbience()

    // Arrival animation — the player drops in from above, rotating
    // out of the spin from the Hospital descent, then settles with a
    // squash. A red ground-flash hits the moment they land.
    const targetX = this.player.x
    const targetY = this.player.y
    this.player.setPosition(targetX, targetY - TILE * 5)
    this.player.setAlpha(0)
    this.player.setAngle(220)
    this.canMove = false
    this.tweens.add({
      targets: this.player,
      y: targetY,
      alpha: 1,
      angle: 0,
      duration: 600,
      delay: 350,
      ease: 'Sine.easeOut',
    })
    // Squash on landing — base x-scale stays at CHARACTER_SCALE, y
    // squashes to half height, then springs back.
    this.player.setScale(CHARACTER_SCALE, CHARACTER_SCALE * 0.5)
    this.tweens.add({
      targets: this.player,
      scaleY: CHARACTER_SCALE,
      duration: 280,
      ease: 'Back.easeOut',
      delay: 900,
    })
    // Landing flash — concentric red ring out from the landing tile.
    this.time.delayedCall(900, () => {
      const ring = this.add.graphics().setDepth(20)
      ring.lineStyle(2, 0xff3050, 1)
      ring.strokeCircle(targetX, targetY, 4)
      this.tweens.add({
        targets: ring,
        scale: 8,
        alpha: 0,
        duration: 700,
        ease: 'Cubic.easeOut',
        onComplete: () => ring.destroy(),
      })

      // First time the player ever lands in the WR: surreal-reveal
      // narration. Movement stays disabled until it finishes.
      const s = getState()
      if (!s.firstWrArrivalNarrationPlayed) {
        showNarration(this, [
          'You are somewhere else.',
          "The same room, but it isn't.",
        ], () => {
          const after = getState()
          after.firstWrArrivalNarrationPlayed = true
          saveGame()
          this.canMove = true
        })
      } else {
        this.canMove = true
      }
    })

    // When a battle returns control, refresh obstacle visibility (defeated
    // obstacles disappear) and re-enable movement.
    this.events.on('resume', () => {
      this.canMove = true
      this.refreshObstacleVisibility()
    })

    // Mobile / accessibility: virtual D-pad + E button. Touch devices
    // only — desktop keyboards skip the overlay.
    if (isTouchDevice() && !this.scene.isActive('TouchOverlay')) {
      this.scene.launch('TouchOverlay')
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      const sm = this.game.scene
      setTimeout(() => {
        if (!sm.isActive('Hospital') && !sm.isActive('WaitingRoom')) {
          sm.stop('TouchOverlay')
        }
      }, 0)
    })
  }

  private buildMap() {
    const { width: mw, height: mh, layout } = this.mapDef

    // The WR map mirrors the full hospital (80×130 = 10,400 tiles).
    // NPC-triggered sessions are always bounded to one room via
    // sessionBounds, so we only build tiles within that room + a
    // generous padding buffer. On mobile this cuts objects from ~15k
    // down to ~1-2k, preventing the WebGL crash on entry.
    // Free-roam mode (no sessionBounds, e.g. dev panel) builds everything.
    const PAD = 12
    const x0 = this.sessionBounds ? Math.max(0,  this.sessionBounds.x - PAD) : 0
    const x1 = this.sessionBounds ? Math.min(mw, this.sessionBounds.x + this.sessionBounds.w + PAD) : mw
    const y0 = this.sessionBounds ? Math.max(0,  this.sessionBounds.y - PAD) : 0
    const y1 = this.sessionBounds ? Math.min(mh, this.sessionBounds.y + this.sessionBounds.h + PAD) : mh

    for (let y = y0; y < y1; y++) {
      const row = layout[y] || ''
      for (let x = x0; x < x1; x++) {
        const ch = row[x] || '.'
        const px = x * TILE + TILE / 2
        const py = y * TILE + TILE / 2
        const def = tileForChar(ch)

        // Floor / base tile
        const floor = this.add.image(px, py, def.sprite).setDisplaySize(TILE, TILE)
        // Chevron checkerboard for floors: alternate bone-white + ink-black
        // on every other tile. Walls + furniture get their fixed tints.
        if (ch === '.' || ch === 'h' || ch === 'c' || ch === 'P' || ch === 'w' ||
            ch === 'F' || ch === 'B' || ch === 'R' || ch === 'V' || ch === 'b' ||
            ch === 'H' || ch === 'X' || ch === 'E') {
          const isBoneTile = (x + y) % 2 === 0
          floor.setTint(isBoneTile ? 0xd8cfc4 : 0x141014)
        } else if (ch === 'W') {
          // Walls — alternating fold tint to give the curtain texture
          // even with a uniform sprite.
          const isFold = (x + y) % 2 === 0
          floor.setTint(isFold ? 0x6a0d10 : 0x4a0709)
        } else {
          floor.setTint(def.tint)
        }

        // Object on top (furniture, monitor, counter, etc.). Same
        // tileMeta override semantics as HospitalScene — sprite
        // override, size multiplier, flipX. A tile renders an obj
        // when either def.obj OR meta.sprite is set, so authors can
        // drop inactive textures onto plain WR floor.
        const meta = this.mapDef.tileMeta?.[`${x},${y}`]
        const objKey = meta?.sprite ?? def.obj
        if (objKey) {
          const sizeMult = meta?.size ?? 1
          const dispSize = TILE * OBJECT_DISPLAY_MULT * sizeMult
          const objY = y * TILE + TILE
          const obj = this.add.image(px, objY, objKey)
            .setOrigin(0.5, 1).setDisplaySize(dispSize, dispSize).setDepth(2)
          // Default tint only when using the glyph's default obj —
          // the override sprite's palette wouldn't be tuned for the
          // procedural-fallback tint.
          if (!meta?.sprite && def.objTint !== undefined) {
            obj.setTint(def.objTint)
          }
          if (meta?.flipX) obj.setFlipX(true)
        }

        // Cyberpunk neon glow — under-tile pool of light for monitors,
        // doors, vending. Drawn behind object so the object's silhouette
        // still reads.
        if (def.glow !== undefined) {
          const glow = this.add.graphics().setDepth(1)
          glow.fillStyle(def.glow, 0.18)
          glow.fillCircle(px, py, TILE * 0.85)
          glow.fillStyle(def.glow, 0.32)
          glow.fillCircle(px, py, TILE * 0.45)
          // Slow flicker on the glow — reads as bad fluorescent / neon.
          this.tweens.add({
            targets: glow, alpha: 0.55,
            duration: Phaser.Math.Between(2200, 4500),
            yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
            delay: Phaser.Math.Between(0, 1500),
          })
        }
      }
    }

    // Ticket counter monitor — float a "NOW SERVING" widget over the
    // first counter tile we find. This sits in the Hospital's lobby
    // counter or the Registration counter; either reads thematically.
    let counterFound = false
    for (let y = y0; y < y1 && !counterFound; y++) {
      for (let x = x0; x < x1 && !counterFound; x++) {
        if (layout[y]?.[x] === 'R') {
          const px = x * TILE + TILE / 2
          const py = y * TILE + TILE / 2 - 6
          this.ticketText = this.add.text(px, py, 'NOW SERVING\n     ?', {
            fontSize: '14px', fontFamily: 'monospace', color: '#ff3050',
          }).setOrigin(0.5).setDepth(5)
          counterFound = true
        }
      }
    }
    if (counterFound) {
      // Cycle the number aggressively — never lands. Cyberpunk drama.
      this.time.addEvent({
        delay: 1400,
        loop: true,
        callback: () => {
          const n = Phaser.Math.Between(0, 9999)
          this.ticketText.setText(`NOW SERVING\n   ${n.toString().padStart(4, '0')}`)
          this.ticketText.setAlpha(0.35)
          this.time.delayedCall(120, () => this.ticketText.setAlpha(1))
        },
      })
    }
  }

  private placePlayer() {
    this.player = this.add.sprite(
      this.playerTileX * TILE + TILE / 2,
      (this.playerTileY + 1) * TILE,
      'player_idle_down'
    ).setOrigin(0.5, 1).setDepth(10).setScale(CHARACTER_SCALE)
    this.playerFacing = 'down'
  }

  private addAtmosphere() {
    // Floating data motes — replace the old papers with small
    // glowing dots that drift slowly. Cyberpunk-ish; the room's
    // air is thick with information that never resolves.
    for (let i = 0; i < 28; i++) {
      const mx = Phaser.Math.Between(2 * TILE, (this.mapDef.width - 2) * TILE)
      const my = Phaser.Math.Between(2 * TILE, (this.mapDef.height - 2) * TILE)
      const mote = this.add.graphics().setDepth(1)
      const color = Phaser.Math.RND.pick([0xff3050, 0xff8090, 0xb18bd6])
      mote.fillStyle(color, Phaser.Math.FloatBetween(0.18, 0.42))
      mote.fillCircle(0, 0, Phaser.Math.FloatBetween(1.5, 3))
      mote.setPosition(mx, my)
      this.tweens.add({
        targets: mote,
        y: my - Phaser.Math.Between(20, 60),
        x: mx + Phaser.Math.Between(-30, 30),
        alpha: { from: mote.alpha, to: mote.alpha * 0.3 },
        duration: Phaser.Math.Between(5000, 11000),
        yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        delay: i * 220,
      })
      this.floatingMotes.push(mote)
    }

    // CRT scanlines overlay — fixed-position thin horizontal bars
    // across the camera. Sits under HUD (depth 90) so HUD text
    // remains crisp.
    const { width: vw, height: vh } = this.scale
    const scanlines = this.add.graphics().setScrollFactor(0).setDepth(90)
    scanlines.fillStyle(0x000000, 0.18)
    for (let y = 0; y < vh; y += 4) {
      scanlines.fillRect(0, y, vw, 1)
    }

    // Edge curtains — narrow burgundy bars framing the camera.
    // Same idea as the prior pass but with a darker outer edge for
    // more theatrical dimensionality.
    const curtain = this.add.graphics().setScrollFactor(0).setDepth(99)
    const cWidth = 44
    curtain.fillStyle(0x1a0608, 0.7)
    curtain.fillRect(0, 0, cWidth, vh)
    curtain.fillRect(vw - cWidth, 0, cWidth, vh)
    curtain.fillStyle(0x6a0d10, 0.4)
    curtain.fillRect(cWidth, 0, 6, vh)
    curtain.fillRect(vw - cWidth - 6, 0, 6, vh)
    // Top + bottom soft mask — gives the camera a letterbox-y
    // theatrical frame.
    curtain.fillStyle(0x000000, 0.55)
    curtain.fillRect(0, 0, vw, 18)
    curtain.fillRect(0, vh - 18, vw, 18)

    // Ambient camera pulse — slower + deeper than the Hospital,
    // and the sharp dim hits harder.
    this.tweens.add({
      targets: this.cameras.main,
      alpha: 0.88,
      duration: 5800,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    })
    // Sharp brownout every ~6 seconds. Drops to 0.5 for 130ms
    // and recovers — the lights cutting then catching.
    this.time.addEvent({
      delay: 6000,
      loop: true,
      callback: () => {
        this.cameras.main.setAlpha(0.5)
        this.time.delayedCall(130, () => this.cameras.main.setAlpha(0.88))
      },
    })
    // Even rarer: a single full-black blink. Once every ~22 seconds.
    this.time.addEvent({
      delay: 22000,
      loop: true,
      callback: () => {
        this.cameras.main.setAlpha(0.05)
        this.time.delayedCall(60, () => this.cameras.main.setAlpha(0.88))
      },
    })

    this.engagePrompt = this.add.text(0, 0, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#f0d090',
      backgroundColor: '#1a0608', padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(20).setVisible(false)
  }

  /**
   * Intro-narration callbacks. Each places a fixed environmental
   * moment that pays off a specific line from the cinematic:
   *
   *   "The number on the ticket counter never seems to change."
   *     → frozen NOW SERVING widget at a designated tile (the global
   *       widget over the lobby counter cycles aggressively; this one
   *       sits over the PFS-mirror counter and is locked to "0042").
   *
   *   "Somewhere, a phone rings that no one answers."
   *     → pulsing red ring + faint ring text drifting up from a
   *       designated PFS tile. Visual-only for now (no audio loop —
   *       deferred until we have a phone-ring sample); the pulse +
   *       drifting "ring..." text reads in silence as a phone left
   *       off the hook.
   *
   *   "Forms fill out themselves, then unfill."
   *     → a Patient-Services-mirror tile with an animated CMS-1500
   *       stand-in that types itself in then erases on a long loop.
   *
   * These are WR-only. Each is placed at a fixed tile and rendered
   * at depth between floor and player. Player walks past / through.
   */
  private addIntroCallbacks() {
    this.addFrozenTicket()
    this.addRingingPhone()
    this.addUnfillingForm()
  }

  /** Frozen ticket counter — partner to the cycling global ticketText.
   *  Locked to "0042" forever. Sits in the PFS-mirror's interior so the
   *  player encounters it during late-game phone-bank encounters. */
  private addFrozenTicket() {
    const TX = 48, TY = 51 // PFS interior, near the north wall
    const px = TX * TILE + TILE / 2
    const py = TY * TILE + TILE / 2 - 6
    this.add.text(px, py, 'NOW SERVING\n    0042', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ff3050',
    }).setOrigin(0.5).setDepth(5)
    // No tween — the entire point of this widget is that it doesn't
    // change. The cycling ticketText already provides the contrast.
  }

  /** Ringing phone — pulsing red ring at a designated tile, plus
   *  drifting "ring..." text that fades upward and recycles. Reads as
   *  a phone left off the hook in an empty room. */
  private addRingingPhone() {
    const TX = 45, TY = 55 // PFS-mirror interior, mid-room
    const px = TX * TILE + TILE / 2
    const py = TY * TILE + TILE / 2
    // Ring marker — pulses outward. Two nested rings out of sync so
    // the cadence reads as "ringing".
    for (let i = 0; i < 2; i++) {
      const ring = this.add.graphics().setDepth(3)
      ring.lineStyle(2, 0xff3050, 0.7)
      ring.strokeCircle(0, 0, 6)
      ring.setPosition(px, py)
      this.tweens.add({
        targets: ring,
        scale: 5,
        alpha: 0,
        duration: 1600,
        repeat: -1,
        delay: i * 800,
        ease: 'Cubic.easeOut',
        onRepeat: () => { ring.setScale(1).setAlpha(0.7) },
      })
    }
    // Drifting "ring..." text — appears at the tile, drifts up and
    // fades, then recycles. Spacer time so it's not constantly on
    // screen.
    const spawnRing = () => {
      const t = this.add.text(px, py - 8, 'ring...', {
        fontSize: '13px', fontFamily: 'monospace', color: '#ff8090',
      }).setOrigin(0.5).setDepth(6).setAlpha(0)
      this.tweens.add({
        targets: t,
        y: py - 60,
        alpha: { from: 0.9, to: 0 },
        duration: 2400,
        ease: 'Sine.easeOut',
        onComplete: () => t.destroy(),
      })
    }
    spawnRing()
    this.time.addEvent({ delay: 3200, loop: true, callback: spawnRing })
  }

  /** Unfilling form — a small CMS-1500 stand-in that types itself in
   *  then erases on a loop. Reads as the intro line "forms fill out
   *  themselves, then unfill." */
  private addUnfillingForm() {
    const TX = 8, TY = 20 // Patient Services interior
    const px = TX * TILE + TILE / 2
    const py = TY * TILE + TILE / 2 - 8
    // Background paper rect for the form
    const paper = this.add.graphics().setDepth(3)
    paper.fillStyle(0xd8cfc4, 0.85)
    paper.fillRoundedRect(px - 36, py - 28, 72, 56, 3)
    paper.lineStyle(1, 0x1a0608, 0.6)
    paper.strokeRoundedRect(px - 36, py - 28, 72, 56, 3)
    // The form text — three short lines that fill in serially then
    // erase together. Each character of `target` types in over a
    // tween on a typewriter-style text widget.
    const formText = this.add.text(px, py - 22, '', {
      fontSize: '9px', fontFamily: 'monospace', color: '#1a0608',
      lineSpacing: 1,
    }).setOrigin(0.5, 0).setDepth(4)
    const target =
      'PATIENT NAME: J.DOE\n' +
      'POLICY #: 8429-XX\n' +
      'DOS: 11/__/____\n' +
      'DX: K35.80\n' +
      'CPT: 44970'
    let chIndex = 0
    const tickType = () => {
      if (chIndex < target.length) {
        chIndex++
        formText.setText(target.slice(0, chIndex))
      } else {
        // Pause briefly with the form filled, then erase.
        this.time.delayedCall(1400, () => {
          formText.setText('')
          chIndex = 0
          this.time.delayedCall(900, scheduleNext)
        })
        return
      }
      this.time.delayedCall(60, tickType)
    }
    const scheduleNext = () => tickType()
    scheduleNext()
  }

  private placeObstacles() {
    // When the WR was opened to handle one specific case (NPC handoff),
    // only the matching obstacle gets rendered. The others stay dark
    // until their own NPC summons them.
    const markers = this.activeEncounterId
      ? OBSTACLES.filter(m => m.encounterId === this.activeEncounterId)
      : OBSTACLES
    for (const marker of markers) {
      const enc = ENCOUNTERS[marker.encounterId]
      if (!enc) continue
      const px = marker.tileX * TILE + TILE / 2
      const py = marker.tileY * TILE + TILE / 2

      // Holographic encounter marker — magenta + cyan stack with
      // a flicker. Cyberpunk-ish; reads as glitch.
      const g = this.add.graphics().setDepth(4)
      // Outer magenta ring
      g.lineStyle(2, 0xff3050, 0.85)
      g.strokeCircle(px, py, 16)
      // Cyan inner ring (offset slightly for chromatic aberration)
      g.lineStyle(1, 0x60d0ff, 0.7)
      g.strokeCircle(px + 1, py - 1, 12)
      // Solid magenta core
      g.fillStyle(0xff3050, 0.45)
      g.fillCircle(px, py, 5)

      // Pulse + tiny jitter — never quite still
      this.tweens.add({
        targets: g, alpha: 0.55,
        duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
      })

      const labelText = enc.archetype ?? enc.title
      const label = this.add.text(px, py - 48, labelText, {
        fontSize: '24px', fontFamily: 'monospace', color: '#ff8090',
        backgroundColor: '#1a0608cc', padding: { x: 12, y: 6 },
        stroke: '#0e1116', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(5)

      this.obstacleSprites.push({ marker, graphics: g, label })
    }
    this.refreshObstacleVisibility()
  }

  private refreshObstacleVisibility() {
    const state = getState()
    for (const os of this.obstacleSprites) {
      const defeated = state.defeatedObstacles.includes(os.marker.encounterId)
      os.graphics.setVisible(!defeated)
      os.label.setVisible(!defeated)
    }
    if (this.nearbyObstacle &&
        getState().defeatedObstacles.includes(this.nearbyObstacle.marker.encounterId)) {
      this.nearbyObstacle = null
      this.engagePrompt.setVisible(false)
    }
  }

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasdKeys = {
      W: this.input.keyboard!.addKey('W'),
      A: this.input.keyboard!.addKey('A'),
      S: this.input.keyboard!.addKey('S'),
      D: this.input.keyboard!.addKey('D'),
    }
    // E: engage obstacle OR return to Hospital (via the gap).
    // SPACE: engage obstacle only — return-to-hospital is deliberately
    //        E-only so accidental space-bar presses don't bounce the
    //        player out mid-puzzle exploration.
    this.input.keyboard!.on('keydown-E', () => this.tryInteract())
    this.input.keyboard!.on('keydown-SPACE', () => {
      if (!this.canMove) return
      if (this.nearbyObstacle) this.tryEngageObstacle(this.nearbyObstacle)
    })
  }

  private tryInteract() {
    // Don't fire while a narration is on screen or the arrival
    // animation is still settling — avoids stacking narration boxes
    // when E is mashed.
    if (!this.canMove) return
    if (this.nearbyObstacle) {
      this.tryEngageObstacle(this.nearbyObstacle)
    }
    // No gap exit — the player wakes up at their desk after the
    // puzzle finishes; they don't need to walk anywhere.
  }

  private tryEngageObstacle(os: ObstacleSprite) {
    const state = getState()
    if (state.defeatedObstacles.includes(os.marker.encounterId)) return
    const enc = ENCOUNTERS[os.marker.encounterId]
    if (!enc) return
    // Engagement requires a prototype iframe URL. Every playable
    // encounter is a standalone Case prototype now; encounters without
    // one exist as codex/lore data only.
    if (!enc.prototypeIframeUrl) return

    this.canMove = false
    this.engagePrompt.setVisible(false)
    saveGame()

    // Snap the red-room ambience to full volume before handing off to
    // the prototype scene. The WR fades ambience in over 2 s; if the
    // player engages quickly, scene.start kills that tween mid-fade
    // and the sound stays silent for the entire encounter session.
    for (const key of ['red_room_1', 'red_room_2', 'red_room_3']) {
      const s = this.sound.get(key)
      if (s && s.isPlaying) {
        this.tweens.killTweensOf(s)
        ;(s as Phaser.Sound.BaseSound & { volume: number }).volume = 0.45
      }
    }

    // NPC-triggered sessions return to the Hospital after the encounter
    // (the player wakes up next to whoever handed them the case).
    // Free-roam sessions return to the WR so the player can wander
    // to another obstacle.
    const returnScene = this.activeEncounterId ? 'Hospital' : 'WaitingRoom'

    // Mount the encounter's standalone prototype in an iframe.
    this.scene.start('PrototypeIframe', {
      encounterId: enc.id,
      returnScene,
    })
  }

  private buildHUD() {
    const state = getState()
    const level = LEVELS[state.currentLevel - 1]

    this.hudLevel = this.add.text(10, 10, `THE WAITING ROOM — ${level?.title ?? ''}`, {
      fontSize: '16px', fontFamily: 'monospace', color: '#f0d090',
      backgroundColor: '#1a060880', padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100)

    this.add.text(10, 44, '"Your number will be called."', {
      fontSize: '14px', fontFamily: 'monospace', color: '#a8806a',
      fontStyle: 'italic',
      backgroundColor: '#1a060880', padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100)

    const r = state.resources
    this.add.text(10, 76, `HP: ${r.hp}/${r.maxHp}  Rep: ${r.reputation}  Audit: ${r.auditRisk}%  Stress: ${r.stress}`, {
      fontSize: '14px', fontFamily: 'monospace', color: '#ff8090',
      backgroundColor: '#1a060880', padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100)
  }

  update() {
    if (!this.canMove) return

    let dx = 0
    let dy = 0
    // Hold-to-move: poll `isDown` each frame and gate via `canMove`
    // (set false during the tween, true on completion). Mirrors the
    // Hospital's input pattern; the older WR code used `JustDown` and
    // forced tap-to-move.
    if (this.cursors.left.isDown  || this.wasdKeys.A.isDown) dx = -1
    else if (this.cursors.right.isDown || this.wasdKeys.D.isDown) dx = 1
    else if (this.cursors.up.isDown    || this.wasdKeys.W.isDown) dy = -1
    else if (this.cursors.down.isDown  || this.wasdKeys.S.isDown) dy = 1

    if (dx !== 0 || dy !== 0) {
      this.tryMove(dx, dy)
    } else if (this.player.anims.isPlaying) {
      this.player.anims.stop()
      this.player.setTexture(`player_idle_${this.playerFacing}`)
    }

    this.checkObstacleProximity()
  }

  /** Swap the player texture based on the direction they're moving. */
  /** Pick one of three Red Room ambience tracks at random and start
   *  it looped with a 2s fade-in. Skips if a red_room_* sound is
   *  already playing on the global sound manager (e.g., we're
   *  re-entering the WR while the previous track hasn't been faded
   *  out yet). */
  private startRedRoomAmbience() {
    const keys = ['red_room_1', 'red_room_2', 'red_room_3']
    // If a previous track is somehow still playing (slow tween
    // teardown from a prior session), tear it down now and continue.
    // The OLD code just returned, leaving a 'silent' state if the
    // sound was technically still alive.
    for (const k of keys) {
      const s = this.sound.get(k)
      if (s) { s.stop(); s.destroy() }
    }
    const sm = this.sound as Phaser.Sound.BaseSoundManager & { locked?: boolean; unlock?: () => void }
    if (sm.locked && typeof sm.unlock === 'function') {
      // Mobile autoplay gate — Phaser stores a locked flag until any
      // user input. By the time the player descends from Hospital,
      // they've tapped enough times that this should already be
      // unlocked. Call it defensively in case it's still gated.
      sm.unlock()
      debugEvent('wr:sm-unlock')
    }
    const key = pickNextTrack('redRoom', keys)
    if (!this.cache.audio.exists(key)) {
      debugEvent('wr:audio-missing ' + key)
      return
    }
    const ambient = this.sound.add(key, { volume: 0, loop: true })
    const playResult = ambient.play()
    debugEvent(`wr:start ${key} play=${playResult} muted=${this.sound.mute}`)
    this.tweens.add({
      targets: ambient,
      volume: 0.45,
      duration: 2000,
    })
  }

  /** Fade and stop any hospital-layer audio that might still be
   *  playing on the global sound manager — the random hospital
   *  ambient pick, or the intro song if the player descended before
   *  it finished. Called on WR entry to keep the upper-floor music
   *  from bleeding under the Red Room track. */
  private fadeOutHospitalLayerAudio(durationMs: number) {
    const keys = [
      'hospital_twin_peaks',
      'hospital_mulholland',
      'hospital_blade_runner',
      'intro_song',
    ]
    for (const k of keys) {
      const s = this.sound.get(k)
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

  private faceDirection(dx: number, dy: number) {
    let dir: 'down' | 'up' | 'left' | 'right'
    if (dx > 0) dir = 'right'
    else if (dx < 0) dir = 'left'
    else if (dy < 0) dir = 'up'
    else dir = 'down'

    this.playerFacing = dir
    const animKey = `player_${dir}_walk`
    const current = this.player.anims.currentAnim
    if (current?.key !== animKey || !this.player.anims.isPlaying) {
      this.player.play(animKey)
    }
  }

  private isSolid(x: number, y: number): boolean {
    const { width: mw, height: mh, layout } = this.mapDef
    if (x < 0 || x >= mw || y < 0 || y >= mh) return true
    const ch = layout[y]?.[x] || '.'
    return tileForChar(ch).solid
  }

  private tryMove(dx: number, dy: number) {
    const newX = this.playerTileX + dx
    const newY = this.playerTileY + dy

    this.faceDirection(dx, dy)

    if (this.isSolid(newX, newY)) return

    // NPC-triggered sessions confine the player to the active obstacle's
    // room. Other doors / corridors are visually present but unreachable.
    if (this.sessionBounds) {
      const b = this.sessionBounds
      if (newX < b.x || newX >= b.x + b.w || newY < b.y || newY >= b.y + b.h) {
        return
      }
    }

    this.playerTileX = newX
    this.playerTileY = newY

    this.canMove = false
    const targetX = newX * TILE + TILE / 2
    const targetY = (newY + 1) * TILE
    this.tweens.add({
      targets: this.player,
      x: targetX, y: targetY,
      duration: 140, ease: 'Linear',
      onComplete: () => { this.canMove = true },
    })
    // Same walking bob as Hospital — keeps the character feeling
    // present in both layers.
    this.tweens.add({
      targets: this.player,
      // 8% squash from CHARACTER_SCALE base.
      scaleY: CHARACTER_SCALE * 0.92,
      duration: 70, yoyo: true, ease: 'Sine.easeInOut',
    })
  }

  private checkObstacleProximity() {
    const state = getState()
    let closest: ObstacleSprite | null = null
    let closestDist = Infinity

    for (const os of this.obstacleSprites) {
      if (state.defeatedObstacles.includes(os.marker.encounterId)) continue
      const ox = os.marker.tileX * TILE + TILE / 2
      const oy = os.marker.tileY * TILE + TILE / 2
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, ox, oy)
      if (d < TILE * 1.6 && d < closestDist) {
        closest = os
        closestDist = d
      }
    }

    if (closest) {
      const enc = ENCOUNTERS[closest.marker.encounterId]
      const name = enc?.archetype ?? enc?.title ?? 'obstacle'
      const ox = closest.marker.tileX * TILE + TILE / 2
      const oy = closest.marker.tileY * TILE + TILE / 2
      this.engagePrompt.setText(`[E] Engage ${name}`)
      this.engagePrompt.setPosition(ox, oy - 44)
      this.engagePrompt.setVisible(true)
      this.nearbyObstacle = closest
    } else {
      this.engagePrompt.setVisible(false)
      this.nearbyObstacle = null
    }
  }

}
