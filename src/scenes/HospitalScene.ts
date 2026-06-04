import Phaser from 'phaser'
import { safeFinishSoundTween } from './soundFadeHelper'
import { NPCS } from '../content/npcs'
import { LEVELS } from '../content/levels'
import { HOSPITAL_MAP } from '../content/maps'
import type { MapDef } from '../content/maps'
import { applyUnlocks } from '../content/mapBuilder'
import { getState, saveGame, consumePendingLevelBanner } from '../state'
import { showNarration } from './narration'
import { isTouchDevice } from './device'
import { ENCOUNTERS } from '../content/enemies'
import { LEVEL_NPC_DIALOGUES } from '../content/dialogue'
import { PUZZLE_SPECS } from '../runtime/puzzle/specs'
import { flavorForTile, LEVEL_ORIENTATION_HINTS } from './hospitalFlavor'
import { runWakeUpTransition } from './wakeUpOverlay'
import { pickNextTrack } from './musicShuffle'
import { showClaimPreview } from './claimPreview'
import { debugStatus, debugEvent } from './debugRibbon'
import type { NPC } from '../types'

// Tile size in game pixels. Bumped from 32 to 64 so the 64×64 LoRA
// art (player / NPCs / objects) renders at native resolution instead
// of being downsampled. Field of view at the same canvas pixel count
// halves; main.ts compensates by bumping the Phaser canvas from
// 960×640 to 1280×800. See journal/2026-05-08 + PR #151 preview.
const TILE = 64

// Pixel-doubling for character sprites so they read 2 tiles tall —
// matches the original visual ratio (when TILE=32 the 64-px sprites
// were also 2 tiles tall). Without this, characters at native 64
// would only fill 1 tile and look small relative to doors/walls.
// Scale 2 is a clean integer multiple, so nearest-neighbor doesn't
// produce uneven pixel mapping.
const CHARACTER_SCALE = 2

// Multiplier applied to TILE for placed-object sprites. 2 = "object
// fills two tiles, overflows up into the tile above" (the original
// look — beds/cabinets towering over chairs); 1.5 = compact, less
// dominant; 1 = object fits cleanly in one tile. Chunky 16×16
// procedural art looks crisper at smaller multipliers since less
// nearest-neighbor scaling is involved.
const OBJECT_DISPLAY_MULT = 1.5

// 70s + David Lynch palette — applied as tints on top of existing
// sprites. Reads warm but uncanny: cream-tan floors, walnut walls,
// burnt-orange chairs, mustard counters, avocado plants. Cooler
// fluorescent tiles get replaced with a warm incandescent register.
const TINT = {
  floor:    0xc8b090, // cream-tan, scuffed
  floorAlt: 0xb89870, // slightly darker tan for ~ tiles (worn carpet patches)
  carpet:   0x8a4a30, // burgundy-cream carpet (entry rugs etc.)
  wall:     0x4a3220, // walnut wood paneling
  door:     0x9a6a3a, // brass door
  doorLock: 0x6a4828, // dim brass (locked)
  desk:     0x5a3820, // dark walnut
  chair:    0x4a6878, // slate teal (contrasts the sepia sweater)
  equip:    0x6a5a4a, // dim taupe
  plant:    0x5a7028, // avocado green
  water:    0xc8a040, // mustard yellow (doubles as a "lamp" highlight)
  cabinet:  0x6a4828, // walnut cabinet
  whiteboard: 0xa89878, // off-cream board
  counter:  0xb08c30, // mustard counter laminate
  vending:  0x8a4a28, // burnt orange machine
  bulletin: 0x8a6840, // cork tan
  bed:      0xb09870, // tan
  fax:      0x6a5a4a, // dim taupe
  // Outdoor floor for parking-lot tiles — dark cracked asphalt.
  // Used by car + lamppost glyphs so they don't read as sitting on
  // cream-tan linoleum. Indoor floors keep TINT.floor.
  asphalt:  0x4a4848,
} as const

const TILE_TEXTURES: Record<string, { floor: string; obj?: string; solid?: boolean; floorTint?: number; objTint?: number }> = {
  'W': { floor: 'h_wall',  solid: true, floorTint: TINT.wall },
  'D': { floor: 'h_door',  floorTint: TINT.door },
  'L': { floor: 'h_door',  solid: true, floorTint: TINT.doorLock },
  '.': { floor: 'h_floor', floorTint: TINT.floor },
  '~': { floor: 'h_floor2', floorTint: TINT.floorAlt },
  '_': { floor: 'h_carpet', floorTint: TINT.carpet },
  // Outdoor asphalt floor — used as the OUTDOOR room's interior fill
  // so empty parking-lot cells read as gray pavement instead of the
  // cream-tan linoleum every indoor room shares. Same h_floor texture,
  // just tinted dark.
  ',': { floor: 'h_floor', floorTint: TINT.asphalt },
  // Parking-line stripe — asphalt with white painted edges baked
  // into the texture. Walkable. Flanks each parked car in the
  // OUTDOOR room (see withStripes() in level1.ts).
  '=': { floor: 'h_asphalt_striped', floorTint: 0xffffff },
  // Curb — concrete barrier between the parking lot and the street.
  // Solid: player can't cross into the road.
  'C': { floor: 'h_curb', solid: true, floorTint: 0xffffff },
  // Road / street — dark asphalt with yellow dashed center +
  // white edge stripes. Solid; decorative south-edge of the lot.
  'r': { floor: 'h_road', solid: true, floorTint: 0xffffff },
  'c': { floor: 'h_floor', obj: 'h_desk',       solid: true, floorTint: TINT.floor, objTint: TINT.desk },
  'h': { floor: 'h_floor', obj: 'h_chair',      floorTint: TINT.floor, objTint: TINT.chair },
  'E': { floor: 'h_floor', obj: 'h_equipment',  floorTint: TINT.floor, objTint: TINT.equip },
  'P': { floor: 'h_floor', obj: 'h_plant',      solid: true, floorTint: TINT.floor, objTint: TINT.plant },
  'w': { floor: 'h_floor', obj: 'h_water',      solid: true, floorTint: TINT.floor, objTint: TINT.water },
  'F': { floor: 'h_floor', obj: 'h_cabinet',    solid: true, floorTint: TINT.floor, objTint: TINT.cabinet },
  'B': { floor: 'h_floor', obj: 'h_whiteboard', solid: true, floorTint: TINT.floor, objTint: TINT.whiteboard },
  'R': { floor: 'h_floor', obj: 'h_counter',    solid: true, floorTint: TINT.floor, objTint: TINT.counter },
  'V': { floor: 'h_floor', obj: 'h_vending',    solid: true, floorTint: TINT.floor, objTint: TINT.vending },
  'b': { floor: 'h_floor', obj: 'h_bulletin',   solid: true, floorTint: TINT.floor, objTint: TINT.bulletin },
  'H': { floor: 'h_floor', obj: 'h_bed',        solid: true, floorTint: TINT.floor, objTint: TINT.bed },
  'X': { floor: 'h_floor', obj: 'h_fax',        floorTint: TINT.floor, objTint: TINT.fax },
  // 2026-05 redraw set — see /sprite-redraw-preview.html. Each of
  // these has its palette baked into the sprite, so objTint stays at
  // 0xffffff (no recolor) so the painted colors come through. Floor
  // tint reuses TINT.floor for indoor sprites; outdoor props use a
  // dark-asphalt tint instead of cream-tan linoleum.
  // Cars (parking lot variety):
  '1': { floor: 'h_floor', obj: 'h_car_sedan',        solid: true, floorTint: TINT.asphalt, objTint: 0xffffff },
  '2': { floor: 'h_floor', obj: 'h_car_suv',          solid: true, floorTint: TINT.asphalt, objTint: 0xffffff },
  '3': { floor: 'h_floor', obj: 'h_car_beater',       solid: true, floorTint: TINT.asphalt, objTint: 0xffffff },
  // Lampposts (parking lot):
  '4': { floor: 'h_floor', obj: 'h_lamp_simple',      solid: true, floorTint: TINT.asphalt, objTint: 0xffffff },
  '5': { floor: 'h_floor', obj: 'h_lamp_arched',      solid: true, floorTint: TINT.asphalt, objTint: 0xffffff },
  '6': { floor: 'h_floor', obj: 'h_lamp_double',      solid: true, floorTint: TINT.asphalt, objTint: 0xffffff },
  // Lecture hall — auditorium seat (walkable, like h_chair):
  's': { floor: 'h_floor', obj: 'h_seat',             floorTint: TINT.floor, objTint: 0xffffff },
  // Lecture hall — chalkboard (solid, like whiteboard):
  'k': { floor: 'h_floor', obj: 'h_chalkboard',       solid: true, floorTint: TINT.floor, objTint: 0xffffff },
  // Lobby — avocado tufted armchair (solid):
  'A': { floor: 'h_floor', obj: 'h_armchair_avocado', solid: true, floorTint: TINT.floor, objTint: 0xffffff },
  // Cafeteria — round dining table (solid, single-tile w/ chair backs):
  'T': { floor: 'h_floor', obj: 'h_diningtable',      solid: true, floorTint: TINT.floor, objTint: 0xffffff },
  // Cafeteria — steam tables (solid):
  'm': { floor: 'h_floor', obj: 'h_steamtable_modern',solid: true, floorTint: TINT.floor, objTint: 0xffffff },
  'M': { floor: 'h_floor', obj: 'h_steamtable_buffet',solid: true, floorTint: TINT.floor, objTint: 0xffffff },
  // Teleport tiles. Visually a tinted floor; their behavior (fade-and-
  // snap to a paired tile) is wired in tryMove via the MapDef.stairs
  // sidecar. Floating labels are drawn on top in placeStairLabels().
  'S': { floor: 'h_floor', floorTint: 0x9a6a3a }, // stair landing — brass tint
  'O': { floor: 'h_floor', floorTint: 0x6a8848 }, // outdoor exit mat — moss-green
}

// Tiles that act as room boundaries for flood-fill: walls and doors.
// (Doors are passable for the player but separate rooms visually.)
const BARRIER_CHARS = new Set(['W', 'D', 'L'])

// Object flavor text + level orientation hints live in a sibling
// module (./hospitalFlavor) — pure data + a stable-hash picker, no
// scene state.

const VIS_HIDDEN = 0
const VIS_VISITED = 1
const VIS_CURRENT = 2

const ALPHA_FOR_STATE = [0, 0.28, 1]

// Module-level cache of the player's fog-of-war reveal state, so it
// survives Hospital → WaitingRoom → Hospital round-trips. Reset by
// `clearHospitalFog()` (called from the dev panel's clear-save). Lost
// on full page reload, which we accept — exploration in-session is
// the main UX win, and a reload is a deliberate fresh start.
let cachedTileVisState: number[][] | null = null
export function clearHospitalFog() {
  cachedTileVisState = null
}

interface NPCSprite {
  sprite: Phaser.GameObjects.Image
  npc: NPC
  label: Phaser.GameObjects.Text
  tileX: number
  tileY: number
}

/** World tile of the Data Sandbox whiteboard / docs terminal.
 *  In level1.ts: DATA_SANDBOX = (x:68, y:100, w:12, h:8) and the
 *  whiteboard is the 'B' item at interior dx=6 dy=0, which the
 *  builder places at world (r.x + 1 + dx, r.y + 1 + dy) = (75, 101).
 *  Press-E facing this tile opens the TipsTerminalScene. */
const TIPS_TERMINAL_TILE = { x: 75, y: 101 }

/** Collect every encounter id that gates a room (lockedUntilDefeated)
 *  so the dev "full map access" toggle can pretend they're all
 *  defeated and pop those rooms open. */
function collectAllGatedDefeats(rooms: { lockedUntilDefeated?: string[] }[]): string[] {
  const all = new Set<string>()
  for (const r of rooms) {
    for (const id of r.lockedUntilDefeated ?? []) all.add(id)
  }
  return Array.from(all)
}

export class HospitalScene extends Phaser.Scene {
  private player!: Phaser.GameObjects.Sprite
  /** Direction the player is currently facing — drives which walk
   *  animation plays and which tile `examineFacingTile` looks at.
   *  Replaces the old "read it back from the texture key" trick. */
  private playerFacing: 'down' | 'up' | 'left' | 'right' = 'down'
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private npcSprites: NPCSprite[] = []
  private interactPrompt!: Phaser.GameObjects.Text
  private nearbyNpc: NPCSprite | null = null
  private canMove = true
  private playerTileX = 0
  private playerTileY = 0
  private wasdKeys!: Record<string, Phaser.Input.Keyboard.Key>
  private hudHp!: Phaser.GameObjects.Text
  private hudLevel!: Phaser.GameObjects.Text
  private mapDef!: MapDef

  // Room visibility state
  private tileFloorSprites: Phaser.GameObjects.Image[][] = []
  private tileObjSprites: (Phaser.GameObjects.Image | null)[][] = []
  private roomIds: number[][] = []
  private tileVisState: number[][] = []
  private currentRoomId = -1

  // Mini-map
  private miniMapBg!: Phaser.GameObjects.Graphics
  private miniMapTiles!: Phaser.GameObjects.Graphics
  private miniMapPlayer!: Phaser.GameObjects.Graphics
  private miniMapNpcMarker!: Phaser.GameObjects.Graphics
  private miniMapCell = 2
  private miniMapX = 0
  private miniMapY = 0
  private miniMapPad = 4
  /** Set when level-banner display is intentionally postponed (e.g.
   *  the L2 banner waits for Anjali's thank-you + leave to finish). */
  private deferredLevelBanner: number | null = null
  private miniMapLabels: Phaser.GameObjects.Text[] = []
  private miniMapHitZone?: Phaser.GameObjects.Zone
  private miniMapDim?: Phaser.GameObjects.Rectangle
  private miniMapCloseHint?: Phaser.GameObjects.Text
  private miniMapHint?: Phaser.GameObjects.Text
  private miniMapExpanded = false
  private lockedToast?: Phaser.GameObjects.Text
  private lockedToastTween?: Phaser.Tweens.Tween
  private uiCamera!: Phaser.Cameras.Scene2D.Camera

  constructor() {
    super('Hospital')
  }

  preload() {
    // Hospital ambience — Lynch-y / sci-fi melancholy. One is picked
    // at random in startHospitalAmbience after the intro song has
    // finished. Loaded here (not in BootScene) so the title doesn't
    // wait on ~12MB of music it doesn't need yet. Phaser's loader is
    // idempotent — if these were already cached on a prior visit,
    // the .load.audio call no-ops.
    if (!this.cache.audio.exists('hospital_twin_peaks')) {
      this.load.audio('hospital_twin_peaks', 'audio/hospital/twin_peaks.mp3')
    }
    if (!this.cache.audio.exists('hospital_mulholland')) {
      this.load.audio('hospital_mulholland', 'audio/hospital/mulholland_drive.mp3')
    }
    if (!this.cache.audio.exists('hospital_blade_runner')) {
      this.load.audio('hospital_blade_runner', 'audio/hospital/blade_runner_love.mp3')
    }
  }

  create() {
    const state = getState()
    // Apply phase-based door unlocks. Rooms with `lockedUntilLevel` set
    // stamp as 'L' (locked) at module load; here we flip them to 'D'
    // (open) for any room whose threshold the player has reached. Plot
    // doors with explicit `locked: true` keep their 'L' regardless of
    // level — those aren't progression gates.
    //
    // DEV: `state.devFullMapAccess` (toggled from the dev panel)
    // bumps the effective level to 999 so every phase-locked room
    // unlocks at once. Useful for QA / map-redraw work without
    // grinding through level transitions.
    const effectiveLevel = state.devFullMapAccess ? 999 : state.currentLevel
    // For the defeat-gated rooms (Turquoise Lounge etc.), pass the
    // current defeated-obstacles list. devFullMapAccess pretends all
    // gated obstacles are defeated so post-game rooms open immediately.
    const effectiveDefeats = state.devFullMapAccess
      ? collectAllGatedDefeats(HOSPITAL_MAP.roomDefs ?? [])
      : state.defeatedObstacles
    const unlockedLayout = HOSPITAL_MAP.roomDefs
      ? applyUnlocks(HOSPITAL_MAP.layout, HOSPITAL_MAP.roomDefs, effectiveLevel, effectiveDefeats)
      : HOSPITAL_MAP.layout
    this.mapDef = { ...HOSPITAL_MAP, layout: unlockedLayout }

    // If we're returning from a puzzle round-trip (NPC handed us a case
    // → descended → solved → coming back), respawn at the saved tile
    // so the player wakes up next to whoever they were talking to.
    const wasReturnFromWr = state.pendingHospitalSpawn != null
    if (state.pendingHospitalSpawn) {
      this.playerTileX = state.pendingHospitalSpawn.x
      this.playerTileY = state.pendingHospitalSpawn.y
      state.pendingHospitalSpawn = null
    } else {
      this.playerTileX = this.mapDef.playerStart.x
      this.playerTileY = this.mapDef.playerStart.y
    }
    this.canMove = true
    this.npcSprites = []
    this.currentRoomId = -1
    // Reset stateful refs that don't survive a scene re-create. The
    // arrays/fields are populated again below; if we leave stale
    // references from the prior run, applyMiniMapLayout (and related)
    // try to setStyle on destroyed Phaser Text objects and throw a
    // Phaser-internal "Cannot read properties of null (drawImage)".
    this.miniMapLabels = []
    this.deferredLevelBanner = null

    // 70s-Lynch warm darkness — incandescent-bulb register, not
    // fluorescent. Deeper than #1a1208 because the camera shows a
    // lot of bg through the fog-of-war alpha-0.28 visited tiles.
    this.cameras.main.setBackgroundColor(0x140a05)

    this.buildMap()
    this.applyAmbientPulse()
    this.placeStairLabels()
    this.addGothicSilhouettes()
    this.placePlayer()
    this.placeNPCs()
    this.setupInput()
    this.buildUI()
    this.buildHUD()

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)
    this.cameras.main.setZoom(1.5)
    this.cameras.main.setBounds(0, 0, this.mapDef.width * TILE, this.mapDef.height * TILE)
    // Defensive: clear any residual fade state from the previous scene
    // (the PuzzleBattle scene fades to black before scene.start; on
    // some mobile browsers the new camera was inheriting a stuck
    // fade overlay, leaving the player on a fully black screen). Then
    // fade in cleanly from black.
    this.cameras.main.resetFX()
    this.cameras.main.fadeIn(450, 0, 0, 0)
    // Belt-and-suspenders: if the camera fade-in tween silently fails,
    // force alpha back to 1 after the fade should be done, so the
    // canvas can never be permanently invisible.
    this.time.delayedCall(700, () => {
      this.cameras.main.setAlpha(1)
      debugEvent(`cam α=${this.cameras.main.alpha}`)
    })
    debugStatus(`Hospital L${state.currentLevel}`)
    debugEvent('hosp:cam-set')

    // Hospital ambience — Lynch-y / sci-fi melancholy. Only kicks in
    // once the cinematic intro song is done so the two don't fight.
    try { this.startHospitalAmbience() } catch (e) { debugEvent('hosp:ambience-err ' + (e as Error).message?.slice(0,30)) }
    debugEvent('hosp:after-ambience')

    // Level-advance banner — if the player just crossed a defeat
    // threshold during the prior battle, surface it now. Banner
    // is screen-space (UI camera) and self-cleans after ~3s.
    //
    // Special case: when advancing INTO L2 (i.e. just defeated
    // Anjali's intro case), defer the banner until *after* Anjali's
    // thank-you dialogue plays and she walks out. Showing the
    // 'Find Kim at Registration' hint while she's still on screen
    // saying thank-you is jarring. The deferred trigger lives in
    // runAnjaliLeave's onComplete.
    const advancedLevel = consumePendingLevelBanner()
    if (advancedLevel !== null) {
      const state = getState()
      const isPostAnjaliL2 = advancedLevel === 2 && !state.anjaliThanked
      if (isPostAnjaliL2) {
        this.deferredLevelBanner = advancedLevel
      } else {
        try { this.showLevelAdvanceBanner(advancedLevel) } catch (e) { debugEvent('hosp:banner-err ' + (e as Error).message?.slice(0,30)) }
      }
    }
    debugEvent('hosp:after-banner')

    // Dedicated UI camera (zoom 1, no scroll) so HUD/mini-map aren't affected
    // by the main camera's zoom or follow.
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height)
    this.uiCamera.setScroll(0, 0)
    debugEvent('hosp:ui-cam')

    try { this.buildMiniMap() } catch (e) { debugEvent('hosp:minimap-err ' + (e as Error).message?.slice(0,40)) }
    debugEvent('hosp:after-minimap')

    try { this.enterRoomAt(this.playerTileX, this.playerTileY) } catch (e) { debugEvent('hosp:enterRoom-err ' + (e as Error).message?.slice(0,40)) }
    debugEvent('hosp:after-enterRoom')

    this.events.on('resume', () => {
      // Always re-enable movement first — interact() set canMove=false
      // when it launched the dialogue, and descendThroughGap below
      // expects canMove to be true (it early-returns otherwise).
      this.canMove = true
      this.refreshHUD()
      // A dialogue handoff may have flagged a descent. Save the
      // player's current position so we can return them here. Show
      // the claim preview first (player gets to see what's broken
      // before falling), then descend.
      const s = getState()
      if (s.pendingDescent) {
        const descent = s.pendingDescent
        s.pendingDescent = null
        s.pendingHospitalSpawn = { x: this.playerTileX, y: this.playerTileY }
        saveGame()
        this.canMove = false
        debugEvent(`descent:start ${descent.encounterId}`)
        showClaimPreview(this, descent.encounterId, () => {
          debugEvent(`descent:preview-done ${descent.encounterId}`)
          this.descendThroughGap(descent.encounterId)
        })
      }
      // After the thanks dialogue closes, walk Anjali out.
      if (s.pendingAnjaliLeave) {
        s.pendingAnjaliLeave = false
        saveGame()
        this.runAnjaliLeave()
      }
    })

    // Level-1 atmosphere: occasionally a sheet of paper scuttles across
    // the floor — a hint that the Waiting Room is bleeding through. No
    // interaction, no codex; just sensation. Higher levels skip this.
    if (state.currentLevel === 1) {
      this.scheduleGhostPaper()
    }

    // First-time level-1 opening: narrate the intern's situation, walk
    // Anjali into the lobby, auto-launch her dialogue. Runs once per
    // save (gated by state.introOpeningPlayed).
    if (!state.introOpeningPlayed && state.currentLevel === 1) {
      this.runOpeningSequence()
    } else if (state.pendingClaimSubmitted) {
      // Just submitted a puzzle. Run the wake-up transition (CSS blur
      // unblurring with a CLAIM SUBMITTED indicator) and only then
      // hand off to Anjali's thank-you dialogue.
      const sub = state.pendingClaimSubmitted
      state.pendingClaimSubmitted = null
      saveGame()
      debugEvent(`wake-up ${sub.encounterId}`)
      this.runWakeUpTransition(sub.claimId, () => {
        debugEvent('wake-up done')
        this.maybeRunAnjaliThanks()
      })
    } else if (wasReturnFromWr) {
      // Returning from a puzzle round-trip. If the case Anjali handed
      // over has been solved and she hasn't said her piece yet, auto-
      // launch the thank-you dialogue so the moment doesn't depend on
      // the player walking back to her.
      this.maybeRunAnjaliThanks()
    }

    // Mobile / accessibility: parallel scene with virtual D-pad + E + ESC.
    // Only launched on touch-primary devices — desktop keyboards don't
    // need the on-screen controls cluttering the view.
    if (isTouchDevice() && !this.scene.isActive('TouchOverlay')) {
      this.scene.launch('TouchOverlay')
    }
    // Deferred stop: when this scene shuts down, defer to the next tick
    // so the next scene has had a chance to start. If we're transitioning
    // to another scene that also wants the overlay (Hospital ⇄ WaitingRoom),
    // leave it running; otherwise stop it.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // Persist fog-of-war so a return-from-WR doesn't blow it away.
      // Snapshot a copy (the next Hospital create() will allocate a
      // fresh array, so we want value-copies, not aliased rows).
      cachedTileVisState = this.tileVisState.map(row => [...row])
      const sm = this.game.scene
      setTimeout(() => {
        if (!sm.isActive('Hospital') && !sm.isActive('WaitingRoom')) {
          sm.stop('TouchOverlay')
        }
      }, 0)
    })

    // Sleep: snapshot fog-of-war so a hard-reload while sleeping still
    // has the last-known vis state. Also used by the sleep/wake WR
    // round-trip (descendThroughGap sleeps instead of stops Hospital).
    this.events.on(Phaser.Scenes.Events.SLEEP, () => {
      cachedTileVisState = this.tileVisState.map(row => [...row])
      debugEvent('hosp:sleep')
    })

    // Wake: fired when PuzzleBattleScene calls scene.wake('Hospital')
    // instead of scene.start('Hospital'). Restores movement, camera,
    // ambience, and post-puzzle state without rebuilding 10k tiles.
    this.events.on(Phaser.Scenes.Events.WAKE, () => {
      debugEvent('hosp:wake-fired')
      const s = getState()
      s.pendingHospitalSpawn = null  // position preserved in sleeping scene
      s.inWaitingRoom = false
      saveGame()

      this.canMove = true
      this.refreshHUD()

      // Reset the player sprite from the descent cinematic's end-state
      // (alpha:0 / scaleY:0.6 / angle:220 / y offset). Without this,
      // the player stays invisible + squished + rotated + sunk through
      // the floor when Hospital wakes for the post-puzzle thanks
      // sequence. Snap them back to their pre-descent tile/pose.
      const playerTargetX = this.playerTileX * TILE + TILE / 2
      const playerTargetY = (this.playerTileY + 1) * TILE
      this.player.setPosition(playerTargetX, playerTargetY)
      this.player.setAlpha(1)
      this.player.setAngle(0)
      this.player.setScale(CHARACTER_SCALE)
      this.player.setTexture(`player_idle_${this.playerFacing}`)
      // Stop any in-flight tween targeting the player. The descent
      // cinematic's tween might still be live in the tween manager
      // (Phaser sleep doesn't auto-kill tweens), and on wake it
      // would resume pulling the player toward alpha:0.
      this.tweens.killTweensOf(this.player)
      // Re-snap the camera to the player so it doesn't lerp from the
      // descent's end-position (below the desk) toward the reset.
      this.cameras.main.centerOn(playerTargetX, playerTargetY)
      debugEvent(`wake:player-reset @(${this.playerTileX},${this.playerTileY})`)

      // If the level advanced during the puzzle round-trip, new NPCs
      // become active (e.g. Alex at L2 once the intro is done). Re-run
      // placeNPCs — it's idempotent now, so existing sprites stay
      // and only the newly-active ones get spawned. Without this the
      // player arrives in a "case-handler missing" Hospital.
      try { this.placeNPCs() } catch (e) { debugEvent('wake:placeNPCs-err') }

      // Re-apply phase-based room unlocks. Without this, doors that
      // should open at the new level stay 'L' (locked) because
      // applyUnlocks only ran during the original create(). The bug
      // surface: complete L2 → currentLevel becomes 3 → Registration's
      // `lockedUntilLevel: 3` should now be satisfied, but the door
      // tile still reads 'L' so the player can't enter.
      try { this.reapplyRoomUnlocks() } catch { debugEvent('wake:reapply-unlocks-err') }

      // Reapply NPC visibility against the fog state — defensive in
      // case any NPC alpha drifted during sleep. Anjali's thanks
      // sequence depends on her being visible at the desk.
      try { this.applyEntityVisibility() } catch { /* swallow */ }

      // Force the camera fully visible + on-screen before kicking off
      // the fadeIn. The descent's `fadeOut(900)` left the camera at
      // alpha 0; sleep preserves that, so on wake we'd be staring at
      // a black canvas. resetFX cancels in-flight fade tweens but
      // doesn't reset the camera's drawn state — setAlpha(1) does.
      // This is the "blank screen behind CLAIM SUBMITTED" bug.
      this.cameras.main.resetFX()
      this.cameras.main.setAlpha(1)
      this.cameras.main.setBackgroundColor(0x0e1116)
      this.cameras.main.fadeIn(450, 0, 0, 0)
      this.time.delayedCall(700, () => { this.cameras.main.setAlpha(1) })

      try { this.startHospitalAmbience() } catch (e) { debugEvent('wake:ambience-err') }

      const advancedLevel = consumePendingLevelBanner()
      if (advancedLevel !== null) {
        const isPostAnjaliL2 = advancedLevel === 2 && !s.anjaliThanked
        if (isPostAnjaliL2) {
          this.deferredLevelBanner = advancedLevel
        } else {
          try { this.showLevelAdvanceBanner(advancedLevel) } catch (e) { debugEvent('wake:banner-err') }
        }
      }

      if (s.pendingClaimSubmitted) {
        const sub = s.pendingClaimSubmitted
        s.pendingClaimSubmitted = null
        saveGame()
        debugEvent(`wake:claim-submitted ${sub.encounterId}`)
        this.runWakeUpTransition(sub.claimId, () => {
          debugEvent('wake:claim-overlay-done')
          this.maybeRunAnjaliThanks()
        })
      } else {
        this.maybeRunAnjaliThanks()
      }

      if (isTouchDevice() && !this.scene.isActive('TouchOverlay')) {
        this.scene.launch('TouchOverlay')
      }
    })
  }

  private buildMap() {
    const { width: mw, height: mh, layout } = this.mapDef

    this.tileFloorSprites = Array.from({ length: mh }, () => new Array(mw))
    this.tileObjSprites = Array.from({ length: mh }, () => new Array(mw).fill(null))
    // Restore fog-of-war from the module-level cache if it matches
    // the current map dimensions — preserves exploration across the
    // Hospital → WR → Hospital round-trip. Otherwise start fully
    // hidden. Any VIS_CURRENT cells from the prior session demote
    // to VIS_VISITED so the player's just-arrived tile becomes the
    // new "current" via enterRoomAt below.
    if (
      cachedTileVisState &&
      cachedTileVisState.length === mh &&
      cachedTileVisState[0]?.length === mw
    ) {
      this.tileVisState = cachedTileVisState.map(row =>
        row.map(v => (v === VIS_CURRENT ? VIS_VISITED : v))
      )
    } else {
      this.tileVisState = Array.from({ length: mh }, () => new Array(mw).fill(VIS_HIDDEN))
    }

    for (let y = 0; y < mh; y++) {
      const row = layout[y] || ''
      for (let x = 0; x < mw; x++) {
        const ch = row[x] || '.'
        const px = x * TILE + TILE / 2
        const py = y * TILE + TILE / 2
        const tileDef = TILE_TEXTURES[ch] || TILE_TEXTURES['.']

        const floor = this.add.image(px, py, tileDef.floor).setAlpha(0)
        // setDisplaySize handles both 16×16 procedural and any future
        // higher-res floor PNGs (which would land at 64×64). Replaces
        // the prior setScale(2) which only worked for 16-px source.
        floor.setDisplaySize(TILE, TILE)
        if (tileDef.floorTint !== undefined) floor.setTint(tileDef.floorTint)
        this.tileFloorSprites[y][x] = floor

        // Per-tile overrides — `tileMeta` is built by mapBuilder from
        // RoomItem fields, or produced by /map-editor.html and
        // pasted in by hand. Drives sprite swap, size multiplier,
        // and horizontal flip. A tile renders an obj when EITHER
        // the glyph has a default `tileDef.obj` OR `meta.sprite`
        // is set — letting authors place inactive (no-glyph) textures
        // directly via the editor.
        const meta = this.mapDef.tileMeta?.[`${x},${y}`]
        const objKey = meta?.sprite ?? tileDef.obj
        if (objKey) {
          // Objects render bottom-anchored at the tile's bottom edge.
          // Base size is `TILE * OBJECT_DISPLAY_MULT`; `meta.size`
          // scales further per-tile if a layout wants a hero piece.
          const sizeMult = meta?.size ?? 1
          const dispSize = TILE * OBJECT_DISPLAY_MULT * sizeMult
          const objY = (y + 1) * TILE
          const obj = this.add.image(px, objY, objKey)
            .setOrigin(0.5, 1).setDepth(2).setAlpha(0)
          obj.setDisplaySize(dispSize, dispSize)
          // Default tint applies only when the renderer is using the
          // glyph's default obj. If the user overrode the sprite via
          // tileMeta, the tint (which was tuned for the default art)
          // would be wrong, so leave the override sprite untinted.
          if (!meta?.sprite && tileDef.objTint !== undefined) {
            obj.setTint(tileDef.objTint)
          }
          if (meta?.flipX) obj.setFlipX(true)
          this.tileObjSprites[y][x] = obj
        }
      }
    }

    this.computeRooms()
  }

  private computeRooms() {
    const { width: mw, height: mh, layout } = this.mapDef
    this.roomIds = Array.from({ length: mh }, () => new Array(mw).fill(-1))
    let nextId = 0

    const isInterior = (x: number, y: number) => {
      if (x < 0 || x >= mw || y < 0 || y >= mh) return false
      const ch = layout[y]?.[x] || '.'
      return !BARRIER_CHARS.has(ch)
    }

    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        if (this.roomIds[y][x] !== -1) continue
        if (!isInterior(x, y)) continue

        const queue: [number, number][] = [[x, y]]
        this.roomIds[y][x] = nextId
        while (queue.length) {
          const [cx, cy] = queue.shift()!
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const nx = cx + dx
            const ny = cy + dy
            if (!isInterior(nx, ny)) continue
            if (this.roomIds[ny][nx] !== -1) continue
            this.roomIds[ny][nx] = nextId
            queue.push([nx, ny])
          }
        }
        nextId++
      }
    }
  }

  /**
   * "LEVEL N — <Title>" banner shown after the player advances out
   * of a level by clearing the defeat threshold. Centered, fades in
   * from above + holds for ~2s + fades out. Sits on the UI camera
   * so it's not affected by the main camera's pulse.
   */
  private showLevelAdvanceBanner(newLevel: number) {
    const level = LEVELS[newLevel - 1]
    if (!level) return
    const { width: vw } = this.scale

    const titleText = `LEVEL ${newLevel}`
    const subtitleText = level.title
    const hintText = LEVEL_ORIENTATION_HINTS[newLevel]

    const title = this.add.text(vw / 2, 80, titleText, {
      fontSize: '32px', fontFamily: 'monospace', color: '#f0d090',
      backgroundColor: '#1a060880',
      padding: { x: 18, y: 8 },
      stroke: '#05070a', strokeThickness: 4,
      fontStyle: 'bold',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0)

    const subtitle = this.add.text(vw / 2, 130, subtitleText, {
      fontSize: '20px', fontFamily: 'monospace', color: '#c8a040',
      backgroundColor: '#1a060880',
      padding: { x: 14, y: 6 },
      stroke: '#05070a', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0)

    const banners: Phaser.GameObjects.Text[] = [title, subtitle]
    if (hintText) {
      const hint = this.add.text(vw / 2, 178, hintText, {
        fontSize: '18px', fontFamily: 'monospace', color: '#7ee2c1',
        backgroundColor: '#1a060880',
        padding: { x: 14, y: 6 },
        stroke: '#05070a', strokeThickness: 3,
        align: 'center',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(200).setAlpha(0)
      banners.push(hint)
    }

    // Fade in (slightly delayed so it lands on a fresh hospital), hold,
    // then fade out + destroy.
    this.tweens.add({
      targets: banners, alpha: 1, duration: 400, delay: 600,
      ease: 'Sine.easeOut',
    })
    this.tweens.add({
      targets: banners, alpha: 0, duration: 500, delay: 4200,
      ease: 'Sine.easeIn',
      onComplete: () => { for (const b of banners) b.destroy() },
    })
  }

  /**
   * Lynch-warm incandescent ambient pulse on the camera. Slow
   * 6-second breath plus an occasional sharp dim — like a stage
   * bulb that doesn't quite hold. Same idea as the Waiting Room's
   * ambient flicker but warmer and slower; the Hospital is supposed
   * to feel almost-but-not-quite-stable.
   */
  private applyAmbientPulse() {
    this.tweens.add({
      targets: this.cameras.main,
      alpha: 0.94,
      duration: 6000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    })
    // One sharp stutter every ~9 seconds. Brief — 90ms — so the
    // overall feel stays still, with the occasional reminder that
    // the room is theatrical rather than real.
    this.time.addEvent({
      delay: 9000,
      loop: true,
      callback: () => {
        this.cameras.main.setAlpha(0.74)
        this.time.delayedCall(90, () => this.cameras.main.setAlpha(0.94))
      },
    })
  }

  private placePlayer() {
    // 64×64 walk frames anchored bottom-center so the character's
    // feet sit at the bottom edge of their tile and the body extends
    // up into the tile above. Player still occupies one logical
    // tile for collision/proximity — the sprite is just visually
    // taller than the 32-px tiles + NPCs.
    this.player = this.add.sprite(
      this.playerTileX * TILE + TILE / 2,
      (this.playerTileY + 1) * TILE,
      'player_idle_down'
    ).setOrigin(0.5, 1).setDepth(10).setScale(CHARACTER_SCALE)
    this.playerFacing = 'down'
  }

  private placeNPCs() {
    const state = getState()
    const level = LEVELS[state.currentLevel - 1]
    const activeNpcs = [...(level?.npcsActive ?? Object.keys(NPCS))]
    // Anjali sticks around until her case is closed (the thanks
    // dialogue runs and she walks out). Solving her puzzle bumps the
    // player to level 2, which would otherwise drop her from the
    // active-NPC roster mid-conversation.
    if (!state.anjaliThanked && !activeNpcs.includes('anjali')) {
      activeNpcs.push('anjali')
    }

    // Evict NPC sprites placed from a stale level-filtered placement.
    // Example: Kim is placed in the lobby at L1 (levels:[1,2]); when
    // the player reaches L3 she should move to Registration. Without
    // this pass the lobby sprite persists, blocks the registration
    // placement via placedSoFar, and the player descends from the lobby
    // (wrong spawn tile → outside REGISTRATION_BOUNDS in the WR).
    const staleIds = new Set<string>()
    for (const ns of this.npcSprites) {
      const src = this.mapDef.npcPlacements.find(
        p => p.npcId === ns.npc.id && p.tileX === ns.tileX && p.tileY === ns.tileY
      )
      if (src?.levels && !src.levels.includes(state.currentLevel)) {
        staleIds.add(ns.npc.id)
      }
    }
    if (staleIds.size > 0) {
      this.npcSprites = this.npcSprites.filter(ns => {
        if (!staleIds.has(ns.npc.id)) return true
        ns.sprite.destroy()
        ns.label.destroy()
        return false
      })
    }

    // De-dupe NPCs that have multiple placements (different rooms per
    // level) so each NPC is placed exactly once. Per-NPC, prefer a
    // placement whose `levels` filter matches the current level; fall
    // back to a placement with no filter (the default).
    //
    // Seed `placedSoFar` with NPCs already in `this.npcSprites` so a
    // re-run on Hospital wake doesn't double-place existing NPCs. This
    // makes placeNPCs idempotent + additive: new level → new NPCs
    // appear without rebuilding the whole roster.
    const placedSoFar = new Set<string>(this.npcSprites.map(n => n.npc.id))
    const defeatedSet = new Set(state.defeatedObstacles)
    for (const p of this.mapDef.npcPlacements) {
      if (placedSoFar.has(p.npcId)) continue
      if (p.levels && !p.levels.includes(state.currentLevel)) continue
      // requiresDefeated — placement is gated until *all* listed
      // encounters are in defeatedObstacles. Used for post-boss
      // reveals (e.g. chris/adam in Turquoise Lounge).
      if (p.requiresDefeated && !p.requiresDefeated.every(id => defeatedSet.has(id))) continue
      // Ambient NPCs (background populace) bypass the activeNpcs
      // filter — they're scenery, not story.
      if (!p.ambient && !activeNpcs.includes(p.npcId)) continue
      const npc = NPCS[p.npcId]
      if (!npc) continue
      placedSoFar.add(p.npcId)

      const px = p.tileX * TILE + TILE / 2
      // Anchor sprite bottom-center to the bottom of the tile so the
      // 64-px LoRA art's feet sit on the floor. Falls back gracefully
      // for the 32-px procedural fallback (which is square — the
      // bottom-anchor still puts feet at tile bottom, just with the
      // body extending up from there). Mirrors player placement.
      const spriteY = (p.tileY + 1) * TILE
      const sprite = this.add.image(px, spriteY, npc.spriteKey)
        .setOrigin(0.5, 1).setDepth(5).setAlpha(0).setScale(CHARACTER_SCALE)

      // Label sits above the sprite — taller offset for the upgraded
      // art so it doesn't overlap the head. displayHeight accounts
      // for setScale so the offset works at any character scale.
      const labelY = spriteY - sprite.displayHeight - 4
      const label = this.add.text(px, labelY, npc.name, {
        fontSize: '24px', fontFamily: 'monospace', color: '#7ee2c1',
        stroke: '#0e1116', strokeThickness: 4,
      }).setOrigin(0.5).setDepth(6).setAlpha(0)

      // Apply the placement's facing so NPCs render in their
      // authored direction. setTexture only fires if the key
      // exists; otherwise the front pose stays in place.
      const facing = p.facing ?? 'down'
      if (facing !== 'down') {
        const dirKey = `npc_${npc.id}_${facing}`
        if (this.textures.exists(dirKey)) {
          sprite.setTexture(dirKey)
          sprite.setOrigin(0.5, 1).setScale(CHARACTER_SCALE)
        }
      }
      this.npcSprites.push({
        sprite, npc, label,
        tileX: p.tileX, tileY: p.tileY,
      })
    }
  }

  /**
   * Level-1 opening: narrate the intern's mood, walk Anjali in from the
   * lobby's north door, auto-launch her dialogue. Runs once per save.
   */
  private runOpeningSequence() {
    const anjali = this.npcSprites.find(n => n.npc.id === 'anjali')
    if (!anjali) return

    // Stash her destination, hide her until the narration ends.
    // Sprite origin is (0.5, 1) so y is the bottom of the tile.
    const destX = anjali.tileX * TILE + TILE / 2
    const destY = (anjali.tileY + 1) * TILE
    anjali.sprite.setVisible(false)
    anjali.label.setVisible(false)

    this.canMove = false

    // Establish Dana through her notebook. The intern has never met her
    // — she's a presence-through-absence, a previous occupant of this
    // desk who left guidance behind. Sets up the briefing card as
    // "Dana's notebook" rather than an in-ear voice from a stranger.
    showNarration(this, [
      'There’s a notebook on your desk. Not yours.',
      'Someone named Dana wrote in it.',
      'Diagrams. Step-by-steps. Worked examples. Like a handover she never got to give in person.',
    ], () => {
      this.startAnjaliEntrance(anjali, destX, destY)
    }, { ignoreCameras: [this.cameras.main] })
  }

  private startAnjaliEntrance(
    anjali: NPCSprite,
    destX: number,
    destY: number,
  ) {
    this.time.delayedCall(400, () => {
      // Anjali enters from the lobby's north door and walks south to
      // her placement tile. Door tile is the player's spawn column,
      // y=32 (LOBBY's top edge).
      const startX = this.mapDef.playerStart.x * TILE + TILE / 2
      const startY = (32 + 1) * TILE  // bottom of tile y=32
      // Label sits above the sprite by sprite displayHeight + 4px.
      // displayHeight reflects setScale so it works at any character scale.
      const labelOffset = anjali.sprite.displayHeight + 4
      anjali.sprite.setPosition(startX, startY)
      anjali.label.setPosition(startX, startY - labelOffset)
      anjali.sprite.setVisible(true).setAlpha(0)
      anjali.label.setVisible(true).setAlpha(0)
      anjali.sprite.setTexture('npc_anjali')

      this.tweens.add({
        targets: [anjali.sprite, anjali.label],
        alpha: 1,
        duration: 350,
      })
      // Walk the sprite down the lobby aisle.
      this.tweens.add({
        targets: anjali.sprite,
        x: destX,
        y: destY,
        duration: 1700,
        delay: 200,
        ease: 'Sine.easeInOut',
      })
      // Label tracks the sprite, offset to sit above the head.
      this.tweens.add({
        targets: anjali.label,
        x: destX,
        y: destY - labelOffset,
        duration: 1700,
        delay: 200,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          // Mark the sequence done so it doesn't replay.
          const s = getState()
          s.introOpeningPlayed = true
          saveGame()
          // Auto-launch the dialogue, mirroring what interact() does.
          this.canMove = false
          this.scene.pause()
          this.scene.launch('Dialogue', {
            dialogueKey: 'anjali_intro',
            callingScene: 'Hospital',
          })
        },
      })
    })
  }

  /**
   * Auto-launch Anjali's thank-you dialogue if she's still here, the
   * intro case is solved, and we haven't done it yet. Fires on the
   * Hospital scene's create() right after a return-from-WR.
   */
  /**
   * Wake-up transition after a puzzle submit. The Hospital fades back
   * in heavily blurred (via a CSS backdrop-filter on a fixed overlay).
   * A "CLAIM SUBMITTED" panel pops in the center and fades; the blur
   * gradually clears. When it's done, the caller's onComplete fires —
   * typically Anjali's thank-you dialogue.
   */
  /**
   * Start a random Hospital ambient track on a 2.5s fade-in. If the
   * cinematic intro song is still playing, defer until it ends so the
   * two music beds don't fight. Skips if any hospital_* track is
   * already playing globally (e.g. we re-entered Hospital from a WR
   * round-trip and the prior track is still going).
   */
  private startHospitalAmbience() {
    const tracks = ['hospital_twin_peaks', 'hospital_mulholland', 'hospital_blade_runner']
    if (tracks.some(k => this.sound.get(k)?.isPlaying)) return

    const introSong = this.sound.get('intro_song')
    if (introSong && introSong.isPlaying) {
      // Wait for the cinematic song to finish, then start the bed.
      introSong.once('complete', () => {
        if (this.scene.isActive()) this.startHospitalAmbience()
      })
      return
    }

    const key = pickNextTrack('hospital', tracks)
    if (!this.cache.audio.exists(key)) return
    const ambient = this.sound.add(key, { volume: 0, loop: true })
    ambient.play()
    this.tweens.add({
      targets: ambient,
      volume: 0.35,
      duration: 2500,
    })
  }

  /** Fade out any hospital_* ambience that's playing globally. Used
   *  when leaving the Hospital (descent into the WR). */
  private fadeOutHospitalAmbience(durationMs: number) {
    for (const key of ['hospital_twin_peaks', 'hospital_mulholland', 'hospital_blade_runner']) {
      const s = this.sound.get(key)
      if (!s || !s.isPlaying) continue
      this.tweens.add({
        targets: s,
        volume: 0,
        duration: durationMs,
        onComplete: () => {
          // Stop + destroy, but first kill any other tween across any
          // scene that might still target this sound. The crash this
          // guards: a tween that survived a scene sleep/shut steps
          // after destroy() nulls the sound's currentConfig and
          // throws "Cannot set properties of null (setting volume)".
          // Leaving sounds stopped-but-alive (the previous fix) avoided
          // the crash but created duplicate same-key Sound instances
          // that produce audible cuts when a new ambience is added.
          safeFinishSoundTween(this.game, s)
        },
      })
    }
  }

  private runWakeUpTransition(claimId: string | null, onComplete: () => void) {
    this.canMove = false
    runWakeUpTransition(this, claimId, onComplete)
  }

  private maybeRunAnjaliThanks() {
    const state = getState()
    // Defensive: if any precondition isn't met we still want movement
    // re-enabled (the wake-up transition disabled it expecting we'd
    // hand off to a dialogue here).
    if (state.anjaliThanked) {
      this.canMove = true
      return
    }
    if (!state.defeatedObstacles.includes('intro_wrong_card')) {
      this.canMove = true
      return
    }
    const anjali = this.npcSprites.find(n => n.npc.id === 'anjali')
    if (!anjali) {
      this.canMove = true
      return
    }

    this.canMove = false
    this.time.delayedCall(700, () => {
      this.scene.pause()
      this.scene.launch('Dialogue', {
        dialogueKey: 'anjali_thanks',
        callingScene: 'Hospital',
        onComplete: () => {
          // Mark thanked + flag the leave; the resume handler will
          // pick up pendingAnjaliLeave and run the walk-out.
          const s = getState()
          s.anjaliThanked = true
          s.pendingAnjaliLeave = true
          saveGame()
        },
      })
    })
  }

  /** Walk Anjali back out the lobby's north door, fading as she goes,
   *  then drop her sprite + label so she stops being engageable. */
  private runAnjaliLeave() {
    const anjali = this.npcSprites.find(n => n.npc.id === 'anjali')
    if (!anjali) return
    this.canMove = false
    const exitX = this.mapDef.playerStart.x * TILE + TILE / 2
    const exitY = (32 - 1) * TILE + TILE / 2
    this.tweens.add({
      targets: anjali.sprite,
      x: exitX,
      y: exitY,
      alpha: 0,
      duration: 1500,
      ease: 'Sine.easeIn',
      onComplete: () => {
        anjali.sprite.destroy()
        anjali.label.destroy()
        this.npcSprites = this.npcSprites.filter(n => n.npc.id !== 'anjali')
        this.canMove = true
        // If the L2 (or any) level-advance banner was deferred
        // because Anjali was still on screen, surface it now.
        if (this.deferredLevelBanner !== null) {
          const lvl = this.deferredLevelBanner
          this.deferredLevelBanner = null
          this.time.delayedCall(300, () => {
            try { this.showLevelAdvanceBanner(lvl) } catch (e) {
              debugEvent('hosp:deferred-banner-err ' + (e as Error).message?.slice(0,30))
            }
          })
        }
      },
    })
    this.tweens.add({
      targets: anjali.label,
      x: exitX,
      y: exitY - 22,
      alpha: 0,
      duration: 1500,
      ease: 'Sine.easeIn',
    })
  }

  // showClaimPreview lives in ./claimPreview — pure DOM overlay, no
  // scene state.

  private setupInput() {
    this.cursors = this.input.keyboard!.createCursorKeys()
    this.wasdKeys = {
      W: this.input.keyboard!.addKey('W'),
      A: this.input.keyboard!.addKey('A'),
      S: this.input.keyboard!.addKey('S'),
      D: this.input.keyboard!.addKey('D'),
    }
    this.input.keyboard!.on('keydown-E', () => this.interact())
    this.input.keyboard!.on('keydown-SPACE', () => this.interact())
  }

  private buildUI() {
    this.interactPrompt = this.add.text(0, 0, '[E] Talk', {
      fontSize: '16px', fontFamily: 'monospace', color: '#f4d06f',
      backgroundColor: '#1f1208',
      padding: { x: 8, y: 4 },
    }).setOrigin(0.5).setDepth(20).setVisible(false)
  }

  private buildHUD() {
    const state = getState()
    const level = LEVELS[state.currentLevel - 1]

    this.hudLevel = this.add.text(10, 10, `Level ${state.currentLevel}: ${level?.title ?? ''}`, {
      fontSize: '16px', fontFamily: 'monospace', color: '#7ee2c1',
      backgroundColor: '#1f120880',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100)

    this.hudHp = this.add.text(10, 44, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ef5b7b',
      backgroundColor: '#1f120880',
      padding: { x: 8, y: 4 },
    }).setScrollFactor(0).setDepth(100)

    // Toast that flashes when the player bumps a solid object or
    // examines a tile. Anchored to the bottom-center of the viewport,
    // hidden until triggered. Larger font on touch devices so it's
    // legible without fullscreen.
    const screenW = this.scale.width
    const screenH = this.scale.height
    const mobile = isTouchDevice()
    this.lockedToast = this.add.text(
      screenW / 2,
      screenH - (mobile ? 110 : 90),
      '',
      {
        fontSize: mobile ? '24px' : '20px',
        fontFamily: 'monospace',
        color: '#f4d06f',
        backgroundColor: '#1f1208cc',
        padding: { x: mobile ? 16 : 14, y: mobile ? 8 : 6 },
        align: 'center',
      },
    ).setOrigin(0.5).setScrollFactor(0).setDepth(120).setAlpha(0)

    this.refreshHUD()
  }

  private buildMiniMap() {
    const screenW = this.scale.width
    const screenH = this.scale.height

    // Full-screen dim backdrop shown only in expanded mode.
    this.miniMapDim = this.add.rectangle(0, 0, screenW, screenH, 0x000000, 0.7)
      .setOrigin(0, 0).setDepth(98).setVisible(false)
      .setInteractive() // swallows clicks behind the expanded map

    this.miniMapBg = this.add.graphics().setDepth(99)
    this.miniMapTiles = this.add.graphics().setDepth(100)
    this.miniMapNpcMarker = this.add.graphics().setDepth(101)
    this.miniMapPlayer = this.add.graphics().setDepth(102)

    // Pre-create one label per room with its actual short text and a
    // baseline fontSize so Phaser's internal text texture is allocated
    // up-front. Creating a Text with empty content can leave the
    // backing frame in a half-initialized state where a later
    // setStyle({ wordWrap }) trips an internal drawImage on a null
    // texture (observed crash in Hospital.create on mobile).
    // Position, font size, and wrap width are re-applied in
    // applyMiniMapLayout based on collapsed / expanded.
    for (const room of this.mapDef.rooms ?? []) {
      const initialText = room.shortName ?? room.name
      const label = this.add.text(0, 0, initialText, {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#fff7e0',
        fontStyle: 'bold',
        align: 'center',
        stroke: '#1f1208',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(102).setVisible(false)
      this.miniMapLabels.push(label)
    }

    // Hit zone over the minimap rect — click to toggle expand/collapse.
    this.miniMapHitZone = this.add.zone(0, 0, 1, 1)
      .setOrigin(0, 0).setDepth(103).setInteractive({ useHandCursor: true })
    this.miniMapHitZone.on('pointerdown', () => this.toggleMiniMapExpanded())

    // Expanded-mode close hint (top of screen).
    this.miniMapCloseHint = this.add.text(screenW / 2, 14,
      'click anywhere to close', {
        fontFamily: 'monospace', fontSize: '11px',
        color: '#c8a040',
      }).setOrigin(0.5, 0).setDepth(104).setVisible(false)

    // Persistent next-step hint along the bottom edge inside the
    // minimap frame. Sources its text from LEVEL_ORIENTATION_HINTS
    // for the current level. Position + wrap width are recomputed in
    // applyMiniMapLayout. Stroke + bold so the cyan reads cleanly
    // against any tile color underneath.
    this.miniMapHint = this.add.text(0, 0, '', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#7ee2c1',
      align: 'center',
      fontStyle: 'bold',
      stroke: '#0e1116',
      strokeThickness: 4,
    }).setOrigin(0.5, 1).setDepth(102)

    const miniMapObjs: Phaser.GameObjects.GameObject[] = [
      this.miniMapDim, this.miniMapBg, this.miniMapTiles,
      this.miniMapNpcMarker, this.miniMapPlayer,
      ...this.miniMapLabels, this.miniMapHitZone, this.miniMapCloseHint,
      this.miniMapHint,
    ]
    if (this.lockedToast) miniMapObjs.push(this.lockedToast)

    // Main camera ignores the minimap; UI camera ignores everything else.
    this.cameras.main.ignore(miniMapObjs)
    this.uiCamera.ignore(this.children.list.filter(c => !miniMapObjs.includes(c)))

    this.applyMiniMapLayout()
  }

  /** Resolve cell size, position, frame, label fonts, and hit zone
   *  bounds based on the current expand state. Called on build and
   *  on every toggle. */
  private applyMiniMapLayout() {
    const { width: mw, height: mh } = this.mapDef
    const screenW = this.scale.width
    const screenH = this.scale.height

    if (this.miniMapExpanded) {
      // Fit to viewport with comfortable margins.
      this.miniMapCell = Math.max(4, Math.min(
        Math.floor((screenW - 80) / mw),
        Math.floor((screenH - 100) / mh),
      ))
    } else {
      // Collapsed minimap — 6px per tile on the 60-wide map gives a
      // 360px-wide HUD element. The bottom hint text stays at 18px
      // regardless (set in buildMiniMap).
      this.miniMapCell = Math.max(1, Math.min(6, Math.floor(360 / mw))) || 1
    }
    const cell = this.miniMapCell
    const innerW = mw * cell
    const innerH = mh * cell
    const pad = this.miniMapExpanded ? 12 : 4
    this.miniMapPad = pad
    const totalW = innerW + pad * 2
    const totalH = innerH + pad * 2

    if (this.miniMapExpanded) {
      this.miniMapX = Math.floor((screenW - totalW) / 2)
      this.miniMapY = Math.floor((screenH - totalH) / 2)
    } else {
      this.miniMapX = screenW - totalW - 8
      this.miniMapY = 8
    }

    // Frame + fill.
    this.miniMapBg.clear()
    this.miniMapBg.fillStyle(0x140a05, 0.92)
    this.miniMapBg.fillRect(this.miniMapX, this.miniMapY, totalW, totalH)
    this.miniMapBg.lineStyle(this.miniMapExpanded ? 2 : 1, 0xc8a040, 0.7)
    this.miniMapBg.strokeRect(
      this.miniMapX + 0.5, this.miniMapY + 0.5, totalW - 1, totalH - 1,
    )

    // Hit zone — covers full screen in expanded mode (click outside
    // to close), or just the minimap rect in collapsed mode.
    if (this.miniMapHitZone) {
      if (this.miniMapExpanded) {
        this.miniMapHitZone.setPosition(0, 0).setSize(screenW, screenH)
      } else {
        this.miniMapHitZone.setPosition(this.miniMapX, this.miniMapY)
          .setSize(totalW, totalH)
      }
      this.miniMapHitZone.input!.hitArea.setTo(
        0, 0,
        this.miniMapHitZone.width, this.miniMapHitZone.height,
      )
    }

    this.miniMapDim?.setVisible(this.miniMapExpanded)
    this.miniMapCloseHint?.setVisible(this.miniMapExpanded)

    // Position + populate the persistent next-step hint anchored to
    // the bottom edge INSIDE the minimap frame (origin 0.5, 1 lets
    // the text grow upward as it wraps). Hidden in expanded mode
    // (the room labels + close hint cover that view).
    if (this.miniMapHint) {
      const lvl = getState().currentLevel
      const hintText = LEVEL_ORIENTATION_HINTS[lvl] ?? ''
      this.miniMapHint.setText(hintText)
      this.miniMapHint.setPosition(
        this.miniMapX + totalW / 2,
        this.miniMapY + totalH - 3,
      )
      this.miniMapHint.setWordWrapWidth(totalW - 8, true)
      this.miniMapHint.setVisible(!this.miniMapExpanded && !!hintText)
    }

    // Reposition + restyle labels.
    const ox = this.miniMapX + pad
    const oy = this.miniMapY + pad
    const rooms = this.mapDef.rooms ?? []
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i]
      const label = this.miniMapLabels[i]
      if (!label) continue
      const cx = ox + (r.x + r.w / 2) * cell
      const cy = oy + (r.y + r.h / 2) * cell
      label.setPosition(cx, cy)
      label.setText(this.miniMapExpanded ? r.name : (r.shortName ?? r.name))
      label.setFontSize(this.miniMapExpanded ? 22 : 12)
      // Use setWordWrapWidth instead of setStyle({ wordWrap }) — the
      // latter tripped a Phaser internal "Cannot read properties of
      // null (reading 'drawImage')" on first paint, on at least one
      // mobile browser. setWordWrapWidth is the official narrow API
      // for this and skips the full style reset.
      label.setWordWrapWidth(Math.max(24, r.w * cell - 2), true)
    }

    this.redrawMiniMapTiles()
  }

  private toggleMiniMapExpanded() {
    this.miniMapExpanded = !this.miniMapExpanded
    this.applyMiniMapLayout()
  }

  private refreshHUD() {
    const state = getState()
    this.hudHp.setText(
      `HP: ${state.resources.hp}/${state.resources.maxHp}  ` +
      `Rep: ${state.resources.reputation}  ` +
      `Audit: ${state.resources.auditRisk}%  ` +
      `Stress: ${state.resources.stress}`
    )
    this.refreshMiniMapHint()
  }

  /** Pull the current level's orientation hint into the minimap's
   *  bottom-edge label. Called when the level changes (or whenever
   *  the HUD refreshes) so the persistent hint stays current. */
  private refreshMiniMapHint() {
    if (!this.miniMapHint) return
    const lvl = getState().currentLevel
    const hintText = LEVEL_ORIENTATION_HINTS[lvl] ?? ''
    this.miniMapHint.setText(hintText)
    this.miniMapHint.setVisible(!this.miniMapExpanded && !!hintText)
  }

  update() {
    if (!this.canMove) return

    let dx = 0
    let dy = 0

    if (this.cursors.left.isDown || this.wasdKeys.A.isDown) dx = -1
    else if (this.cursors.right.isDown || this.wasdKeys.D.isDown) dx = 1
    else if (this.cursors.up.isDown || this.wasdKeys.W.isDown) dy = -1
    else if (this.cursors.down.isDown || this.wasdKeys.S.isDown) dy = 1

    if (dx !== 0 || dy !== 0) {
      this.tryMove(dx, dy)
    } else {
      // Idle — pause the walk loop on frame 0 of the current
      // facing direction so the character stands still instead of
      // freezing on a mid-stride walk frame.
      if (this.player.anims.isPlaying) {
        this.player.anims.stop()
        this.player.setTexture(`player_idle_${this.playerFacing}`)
      }
    }

    this.checkNpcProximity()
  }

  /** Play the walk-cycle animation matching the direction of intent.
   *  Idempotent: if the player is already walking that way, leave
   *  the current loop running rather than restarting at frame 0
   *  (which makes movement look stuttery). */
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

  private flashFlavorToast(message: string) {
    if (!this.lockedToast) return
    this.lockedToast.setText(message)
    this.lockedToastTween?.stop()
    this.lockedToast.setAlpha(1)
    // Hold longer when the message is multi-line — give the player
    // time to read each beat. Roughly 700ms per line, capped at 4s.
    const lineCount = message.split('\n').length
    const holdMs = Math.min(4000, 900 + lineCount * 700)
    this.lockedToastTween = this.tweens.add({
      targets: this.lockedToast,
      alpha: 0,
      delay: holdMs,
      duration: 500,
      ease: 'Sine.easeIn',
    })
  }

  /** Press-E examine: look up the tile in front of the player and
   *  show its flavor text if any. "In front" is determined by the
   *  player's current facing texture. Also handles the chart-pull
   *  interaction when the facing tile is an 'F' cabinet inside
   *  Medical Records — sets `state.chartsPulled[encounterId]` for
   *  the current level's gated case so the player can subsequently
   *  return to the case-handing NPC and choose the descent option. */
  private examineFacingTile() {
    const dir = this.facingDelta()
    const tx = this.playerTileX + dir.dx
    const ty = this.playerTileY + dir.dy
    const ch = this.mapDef.layout[ty]?.[tx]
    if (this.tryOpenTipsTerminal(tx, ty)) return
    if (this.tryChartPull(ch, tx, ty)) return
    const flavor = ch ? flavorForTile(ch, tx, ty) : undefined
    if (flavor) this.flashFlavorToast(flavor)
  }

  /** Tips-terminal check. The Data Sandbox whiteboard ('B' at
   *  the north wall, world (74, 100)) is the team's documentation
   *  board. Press-E facing it pauses Hospital and launches the
   *  TipsTerminal overlay. Returns true if handled. */
  private tryOpenTipsTerminal(tx: number, ty: number): boolean {
    if (tx !== TIPS_TERMINAL_TILE.x || ty !== TIPS_TERMINAL_TILE.y) return false
    this.canMove = false
    this.interactPrompt.setVisible(false)
    this.scene.pause()
    this.scene.launch('TipsTerminal', { callingScene: 'Hospital' })
    return true
  }

  /** Chart-pull check. Returns true if the tile + level + state
   *  combination triggers a chart pull (which sets the flag, saves,
   *  and toasts the matching narration); false otherwise. The caller
   *  falls through to normal flavor-text examination on false. */
  private tryChartPull(ch: string | undefined, tx: number, ty: number): boolean {
    if (ch !== 'F') return false
    // MedRecords room bounds (mirror level1.ts MED_RECORDS).
    const inMedRecords =
      tx >= 51 && tx < 51 + 14 && ty >= 37 && ty < 37 + 10
    if (!inMedRecords) return false
    // Map current level → encounterId whose chart this pull resolves.
    // Two cases gate descent on a chart pull right now (Pat L4 bundle,
    // Sam L5 wraith); add new entries as more cases need the detour.
    const lvl = getState().currentLevel
    const PULL_BY_LEVEL: Record<number, { encounterId: string; toast: string }> = {
      4: {
        encounterId: 'co_97',
        toast:
          "You pull Sarah Kim's chart.\n" +
          "Op-note clear: separate visit, modifier-25 was just never appended.",
      },
      5: {
        encounterId: 'co_50',
        toast:
          "You pull Mr. Walker's chart.\n" +
          "Echo report: LVEF 28%. Right there in black ink.",
      },
    }
    const target = PULL_BY_LEVEL[lvl]
    if (!target) {
      // Player is poking binders on a non-gated level — show flavor
      // but don't set any flag.
      this.flashFlavorToast("Old binders. They smell like lawyers.")
      return true
    }
    const state = getState()
    state.chartsPulled ??= {}
    if (state.chartsPulled[target.encounterId]) {
      // Idempotent — show a different toast on re-pull so the player
      // gets feedback that they've already done this.
      this.flashFlavorToast("You already pulled this one.\nIt's in your bag.")
      return true
    }
    state.chartsPulled[target.encounterId] = true
    saveGame()
    this.flashFlavorToast(target.toast)
    return true
  }

  private facingDelta(): { dx: number; dy: number } {
    switch (this.playerFacing) {
      case 'up':    return { dx: 0, dy: -1 }
      case 'down':  return { dx: 0, dy: 1 }
      case 'left':  return { dx: -1, dy: 0 }
      case 'right': return { dx: 1, dy: 0 }
    }
  }

  private isSolid(x: number, y: number): boolean {
    const { width: mw, height: mh, layout } = this.mapDef
    if (x < 0 || x >= mw || y < 0 || y >= mh) return true
    const ch = layout[y]?.[x] || '.'
    const def = TILE_TEXTURES[ch]
    return def?.solid === true
  }

  /** Look up a stair entry whose `from` matches the given tile. */
  private findStair(x: number, y: number): { from: { x: number; y: number }; to: { x: number; y: number }; label?: string } | null {
    for (const s of this.mapDef.stairs ?? []) {
      if (s.from.x === x && s.from.y === y) return s
    }
    return null
  }

  /** Fade out, snap player + camera to the destination tile, fade in.
   *  Reuses HospitalScene's existing tile/room visibility plumbing —
   *  enterRoomAt() reveals whatever room contains the destination. */
  private runStairTeleport(to: { x: number; y: number }) {
    const cam = this.cameras.main
    const destX = to.x * TILE + TILE / 2
    const destY = (to.y + 1) * TILE
    cam.fadeOut(280, 0, 0, 0)
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.playerTileX = to.x
      this.playerTileY = to.y
      this.player.setPosition(destX, destY)
      this.enterRoomAt(to.x, to.y)
      this.updateMiniMapPlayer()
      cam.fadeIn(320, 0, 0, 0)
      cam.once(Phaser.Cameras.Scene2D.Events.FADE_IN_COMPLETE, () => {
        this.canMove = true
      })
    })
  }

  /** Render a small floating text widget over each stair source so the
   *  player knows the tile teleports somewhere ("↑ 2F", "EXIT"). Called
   *  once during create() after the tilemap has been built. */
  private placeStairLabels() {
    for (const s of this.mapDef.stairs ?? []) {
      const label = s.label
      if (!label) continue
      const px = s.from.x * TILE + TILE / 2
      const py = s.from.y * TILE + TILE / 2 - 4
      this.add.text(px, py, label, {
        fontSize: '14px', fontFamily: 'monospace', color: '#f4d06f',
        stroke: '#0e1116', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(5)
    }
  }

  /**
   * Intro callback — "gothic figures lurking in Mercy General" (intro
   * page7 cover). A handful of cloaked silhouettes drifting through
   * the second-floor corridor; pulse alpha low so they read as just-
   * barely-visible, with a slow sway so they feel alive. Player walks
   * past / through them; depth is set below the player so the figures
   * stay behind. Placed at fixed corridor tiles on 2F (the upstairs is
   * thematically the part of the hospital where things "watch").
   */
  private addGothicSilhouettes() {
    const COORDS: Array<{ x: number; y: number }> = [
      { x: 28, y: 99 },  // 2F trunk corridor, west of landing
      { x: 37, y: 99 },  // 2F trunk corridor, east of landing
      { x: 34, y: 105 }, // long vertical corridor between AUDIT and PAYER
      { x: 34, y: 110 }, // same corridor, near COMPLIANCE
    ]
    for (const c of COORDS) {
      const px = c.x * TILE + TILE / 2
      const py = c.y * TILE + TILE / 2
      const g = this.add.graphics().setDepth(2)
      // Tall hooded figure: trapezoidal "cloak" body + small head.
      g.fillStyle(0x0a0608, 1)
      // Body (cloak)
      g.fillRoundedRect(px - 18, py - 24, 36, 60, 6)
      // Head
      g.fillCircle(px, py - 30, 10)
      // Eye-glints — two tiny dots that catch the camera, very faint.
      g.fillStyle(0xffefc4, 0.85)
      g.fillCircle(px - 4, py - 30, 1.4)
      g.fillCircle(px + 4, py - 30, 1.4)
      g.setAlpha(0)
      // Slow pulse — alpha 0 ↔ 0.18, with random offset so figures
      // don't synchronize.
      this.tweens.add({
        targets: g,
        alpha: 0.18,
        duration: Phaser.Math.Between(2400, 4200),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Phaser.Math.Between(0, 2000),
      })
      // Tiny sway — ±6px horizontal, slow.
      this.tweens.add({
        targets: g,
        x: { from: -6, to: 6 },
        duration: Phaser.Math.Between(3500, 5500),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      })
    }
  }

  private tryMove(dx: number, dy: number) {
    const newX = this.playerTileX + dx
    const newY = this.playerTileY + dy

    // Face the direction of intent before checking blockers — so the
    // sprite reads as "looking that way" even when bonking a wall.
    this.faceDirection(dx, dy)

    if (this.isSolid(newX, newY)) {
      const ch = this.mapDef.layout[newY]?.[newX]
      const flavor = ch ? flavorForTile(ch, newX, newY) : undefined
      if (flavor) this.flashFlavorToast(flavor)
      return
    }

    for (const ns of this.npcSprites) {
      if (newX === ns.tileX && newY === ns.tileY) return
    }

    this.playerTileX = newX
    this.playerTileY = newY

    // Stair / outdoor-exit teleport. If the new tile is a registered
    // stair source, finish the walk-step tween and then fade-and-snap
    // the player to the paired destination instead of letting them
    // continue normal movement. Keeps everything inside the same scene
    // (no cross-scene plumbing) at the cost of one big tilemap that
    // bundles all "areas" (ground floor, second floor, outdoor).
    const stair = this.findStair(newX, newY)

    this.canMove = false
    const targetX = newX * TILE + TILE / 2
    const targetY = (newY + 1) * TILE
    // Position tween — moves the player to the new tile.
    this.tweens.add({
      targets: this.player,
      x: targetX,
      y: targetY,
      duration: 120,
      ease: 'Linear',
      onComplete: () => {
        if (stair) {
          this.runStairTeleport(stair.to)
        } else {
          this.canMove = true
        }
      },
    })
    // Walking bob — scaleY squashes 1.0 → 0.92 → 1.0 over the
    // duration of the move so the character has a hint of weight
    // landing each step. Tiny effect (8% squash); reads as life
    // without becoming cartoony.
    this.tweens.add({
      targets: this.player,
      // 8% squash from CHARACTER_SCALE base. Tween-target is absolute
      // scaleY, so the value has to be the absolute height we want.
      scaleY: CHARACTER_SCALE * 0.92,
      duration: 60,
      yoyo: true,
      ease: 'Sine.easeInOut',
    })

    this.enterRoomAt(newX, newY)
    this.updateMiniMapPlayer()
  }

  private enterRoomAt(x: number, y: number) {
    const newRoomId = this.roomIds[y]?.[x] ?? -1
    // -1 means standing on a door/wall — keep current room.
    if (newRoomId === -1 || newRoomId === this.currentRoomId) return

    // Demote any tile currently lit to "visited."
    for (let yy = 0; yy < this.tileVisState.length; yy++) {
      const row = this.tileVisState[yy]
      for (let xx = 0; xx < row.length; xx++) {
        if (row[xx] === VIS_CURRENT) row[xx] = VIS_VISITED
      }
    }

    this.revealRoom(newRoomId)
    this.currentRoomId = newRoomId
    this.applyTileVisibility()
    this.applyEntityVisibility()
    this.redrawMiniMapTiles()
  }

  private revealRoom(roomId: number) {
    const { width: mw, height: mh } = this.mapDef
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        if (this.roomIds[y][x] !== roomId) continue
        this.tileVisState[y][x] = VIS_CURRENT
        // Reveal adjacent walls/doors so room boundaries are visible.
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || nx >= mw || ny < 0 || ny >= mh) continue
            if (this.roomIds[ny][nx] === -1) {
              this.tileVisState[ny][nx] = VIS_CURRENT
            }
          }
        }
      }
    }
  }

  private applyTileVisibility() {
    const { width: mw, height: mh } = this.mapDef
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const a = ALPHA_FOR_STATE[this.tileVisState[y][x]]
        this.tileFloorSprites[y][x].setAlpha(a)
        const obj = this.tileObjSprites[y][x]
        if (obj) obj.setAlpha(a)
      }
    }
  }

  private applyEntityVisibility() {
    for (const ns of this.npcSprites) {
      const v = this.tileVisState[ns.tileY]?.[ns.tileX] ?? VIS_HIDDEN
      const a = ALPHA_FOR_STATE[v]
      ns.sprite.setAlpha(a)
      ns.label.setAlpha(a)
    }
  }

  private redrawMiniMapTiles() {
    const { width: mw, height: mh, layout } = this.mapDef
    const g = this.miniMapTiles
    const cell = this.miniMapCell
    const ox = this.miniMapX + this.miniMapPad
    const oy = this.miniMapY + this.miniMapPad

    g.clear()

    // First pass: pre-reveal every room the player currently has
    // access to. Renders at a dimmer alpha than "seen" tiles so the
    // player can still tell explored areas apart from "unlocked but
    // haven't walked here yet". Build a Set of accessible room tiles
    // so the fog pass below knows to skip them.
    const accessibleTiles = this.collectAccessibleRoomTiles()
    for (const key of accessibleTiles) {
      const [x, y] = key.split(',').map(Number)
      const ch = layout[y]?.[x] || '.'
      let color: number
      if (ch === 'W') color = 0x4a3220
      else if (ch === 'D' || ch === 'L') color = 0xc8a040
      else color = 0xc8b090
      g.fillStyle(color, 0.22)
      g.fillRect(ox + x * cell, oy + y * cell, cell, cell)
    }

    // Second pass: fog-of-war. Overdraws the pre-revealed tiles at a
    // higher alpha where the player has actually walked. VIS_CURRENT
    // (the player's current FOV) gets the strongest alpha.
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const state = this.tileVisState[y][x]
        if (state === VIS_HIDDEN) continue

        const ch = layout[y]?.[x] || '.'
        let color: number
        if (ch === 'W') color = 0x4a3220       // walnut, matches wall tint
        else if (ch === 'D' || ch === 'L') color = 0xc8a040 // mustard for doors
        else color = 0xc8b090                  // cream-tan for floors

        const alpha = state === VIS_CURRENT ? 1 : 0.45
        g.fillStyle(color, alpha)
        g.fillRect(ox + x * cell, oy + y * cell, cell, cell)
      }
    }

    // Reveal each room label once the room is either currently
    // accessible (door unlocked) OR has been seen by walking into it.
    const rooms = this.mapDef.rooms ?? []
    const roomDefs = HOSPITAL_MAP.roomDefs ?? []
    const accessibleRoomIds = new Set(this.collectAccessibleRoomIds())
    for (let i = 0; i < rooms.length; i++) {
      const r = rooms[i]
      const label = this.miniMapLabels[i]
      if (!label) continue
      // Map the rooms-list entry to its roomDef counterpart by bounds
      // (rooms[] is a thin label-only list; roomDefs[] carries lock
      // metadata). Match on x/y/w/h.
      const matchingDef = roomDefs.find(d =>
        d.x === r.x && d.y === r.y && d.w === r.w && d.h === r.h
      )
      const preRevealed = matchingDef?.id ? accessibleRoomIds.has(matchingDef.id) : false
      let seen = preRevealed
      if (!seen) {
        for (let yy = r.y; yy < r.y + r.h && !seen; yy++) {
          for (let xx = r.x; xx < r.x + r.w; xx++) {
            if (this.tileVisState[yy]?.[xx] !== VIS_HIDDEN) { seen = true; break }
          }
        }
      }
      label.setVisible(seen)
    }

    this.updateMiniMapPlayer()
  }

  /** Set of every "x,y" tile coord the minimap should pre-reveal.
   *  Includes:
   *    - Tiles inside any room the player currently has access to
   *      (unlocked by level + defeated gates).
   *    - All corridor tiles (floor tiles outside any room).
   *  Used by the minimap to pre-reveal the navigable layout so the
   *  player can plan a route to unlocked rooms before walking them. */
  private collectAccessibleRoomTiles(): Set<string> {
    const tiles = new Set<string>()
    const state = getState()
    const effectiveLevel = state.devFullMapAccess ? 999 : state.currentLevel
    const defeated = new Set(state.defeatedObstacles)
    const roomDefs = HOSPITAL_MAP.roomDefs ?? []

    // 1. Accessible rooms — include every tile inside (walls + interior + doors).
    for (const r of roomDefs) {
      if (!this.isRoomAccessible(r, effectiveLevel, defeated)) continue
      for (let yy = r.y; yy < r.y + r.h; yy++) {
        for (let xx = r.x; xx < r.x + r.w; xx++) {
          tiles.add(`${xx},${yy}`)
        }
      }
    }

    // 2. Corridors — floor tiles ('.') that aren't inside ANY room.
    // Room interiors are also '.', so we subtract the rooms (regardless
    // of whether they're accessible — we want every corridor revealed
    // so the player can read the topology).
    const { width: mw, height: mh, layout } = this.mapDef
    for (let y = 0; y < mh; y++) {
      const row = layout[y]
      if (!row) continue
      for (let x = 0; x < mw; x++) {
        if (row[x] !== '.') continue
        // Skip if inside any room.
        let inside = false
        for (const r of roomDefs) {
          if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
            inside = true
            break
          }
        }
        if (!inside) tiles.add(`${x},${y}`)
      }
    }
    return tiles
  }

  /** Set of accessible room ids. Used for label visibility. */
  private collectAccessibleRoomIds(): string[] {
    const state = getState()
    const effectiveLevel = state.devFullMapAccess ? 999 : state.currentLevel
    const defeated = new Set(state.defeatedObstacles)
    const ids: string[] = []
    for (const r of HOSPITAL_MAP.roomDefs ?? []) {
      if (!this.isRoomAccessible(r, effectiveLevel, defeated)) continue
      if (r.id) ids.push(r.id)
    }
    return ids
  }

  /** Re-run applyUnlocks against current state and diff against the
   *  in-memory layout. For each tile whose lock state flipped, mutate
   *  `this.mapDef.layout` (so movement-collision sees the new char)
   *  and retint the corresponding floor sprite (so it visually reads
   *  open vs locked). Called from the WAKE handler — the original
   *  create() already did this once, but the iframe / puzzle return
   *  path wakes the scene rather than rebuilding it. */
  private reapplyRoomUnlocks() {
    const state = getState()
    const effectiveLevel = state.devFullMapAccess ? 999 : state.currentLevel
    const effectiveDefeats = state.devFullMapAccess
      ? collectAllGatedDefeats(HOSPITAL_MAP.roomDefs ?? [])
      : state.defeatedObstacles
    const newLayout = HOSPITAL_MAP.roomDefs
      ? applyUnlocks(HOSPITAL_MAP.layout, HOSPITAL_MAP.roomDefs, effectiveLevel, effectiveDefeats)
      : HOSPITAL_MAP.layout
    const oldLayout = this.mapDef.layout
    let changed = 0
    for (let y = 0; y < newLayout.length; y++) {
      const nRow = newLayout[y]
      const oRow = oldLayout[y] ?? ''
      if (nRow === oRow) continue
      for (let x = 0; x < nRow.length; x++) {
        const nCh = nRow[x]
        const oCh = oRow[x]
        if (nCh === oCh) continue
        // Only door lock <-> open transitions need a visual repaint.
        // Anything else (shouldn't happen in this code path) is left
        // to whatever applyUnlocks intended.
        const tile = this.tileFloorSprites[y]?.[x]
        if (tile) {
          const tileDef = TILE_TEXTURES[nCh] || TILE_TEXTURES['.']
          if (tileDef.floorTint !== undefined) tile.setTint(tileDef.floorTint)
        }
        changed++
      }
    }
    this.mapDef = { ...this.mapDef, layout: newLayout }
    if (changed > 0) debugEvent(`wake:rooms-unlocked tiles=${changed}`)
  }

  private isRoomAccessible(
    r: { id?: string; lockedUntilLevel?: number; lockedUntilDefeated?: string[] },
    effectiveLevel: number,
    defeated: Set<string>,
  ): boolean {
    if (r.lockedUntilLevel != null && effectiveLevel < r.lockedUntilLevel) return false
    if (r.lockedUntilDefeated && !r.lockedUntilDefeated.every(id => defeated.has(id))) return false
    return true
  }

  private updateMiniMapPlayer() {
    const cell = this.miniMapCell
    const ox = this.miniMapX + this.miniMapPad
    const oy = this.miniMapY + this.miniMapPad
    this.miniMapPlayer.clear()
    this.miniMapPlayer.fillStyle(0x7ee2c1, 1)
    this.miniMapPlayer.fillRect(
      ox + this.playerTileX * cell - 1,
      oy + this.playerTileY * cell - 1,
      cell + 2,
      cell + 2
    )
    this.updateMiniMapNpcMarker()
  }

  /** Draw a gold quest marker on the mini-map at the objective NPC's tile.
   *  Always visible regardless of fog so the player always knows where to go.
   *  The objective NPC is the first entry in the level's npcsActive list that
   *  has a placed sprite. */
  private updateMiniMapNpcMarker() {
    this.miniMapNpcMarker.clear()
    const state = getState()
    const level = LEVELS[state.currentLevel - 1]
    const objectiveId = (level?.npcsActive ?? []).find(id =>
      this.npcSprites.some(ns => ns.npc.id === id)
    )
    if (!objectiveId) return
    const ns = this.npcSprites.find(n => n.npc.id === objectiveId)
    if (!ns) return
    const cell = this.miniMapCell
    const ox = this.miniMapX + this.miniMapPad
    const oy = this.miniMapY + this.miniMapPad
    // Center of the NPC's tile
    const cx = ox + ns.tileX * cell + cell / 2
    const cy = oy + ns.tileY * cell + cell / 2
    // 5-pointed star: outer radius slightly larger than a tile so it
    // stands out clearly at collapsed scale (cell=6 → outerR=10).
    const outerR = cell + 4
    const innerR = outerR * 0.42
    const pts: { x: number; y: number }[] = []
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI / 5) - Math.PI / 2
      const r = i % 2 === 0 ? outerR : innerR
      pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r })
    }
    this.miniMapNpcMarker.fillStyle(0xff3050, 1)
    this.miniMapNpcMarker.fillPoints(pts, true)
  }

  private checkNpcProximity() {
    let closest: NPCSprite | null = null
    let closestDist = Infinity

    for (const ns of this.npcSprites) {
      const v = this.tileVisState[ns.tileY]?.[ns.tileX] ?? VIS_HIDDEN
      if (v !== VIS_CURRENT) continue
      const dist = Phaser.Math.Distance.Between(
        this.player.x, this.player.y,
        ns.sprite.x, ns.sprite.y
      )
      if (dist < TILE * 2 && dist < closestDist) {
        closest = ns
        closestDist = dist
      }
    }

    this.nearbyNpc = closest
    this.interactPrompt.setVisible(!!closest)
    if (closest) {
      // Sprite origin is (0.5, 1), so sprite.y is the bottom edge.
      // Prompt sits a fixed gap above the top of the sprite.
      this.interactPrompt.setPosition(closest.sprite.x, closest.sprite.y - closest.sprite.displayHeight - 8)
    }
  }

  private interact() {
    // Don't interact while frozen (e.g. during the opening notebook
    // narration, the claim preview, or a transition).
    if (!this.canMove) return
    if (this.nearbyNpc) {
      this.canMove = false
      this.interactPrompt.setVisible(false)

      // Per-level dialogue override: if the current level routes this
      // NPC to a different intake tree, use it. Falls back to the
      // NPC's default dialogueKey otherwise.
      const lvl = getState().currentLevel
      const override = LEVEL_NPC_DIALOGUES[lvl]?.[this.nearbyNpc.npc.id]
      const dialogueKey = override ?? this.nearbyNpc.npc.dialogueKey

      this.scene.pause()
      this.scene.launch('Dialogue', {
        dialogueKey,
        callingScene: 'Hospital',
      })
      return
    }
    // No nearby NPC — try examining whatever the player is facing.
    this.examineFacingTile()
  }

  /**
   * Hospital → Waiting Room transition. Triggered from a dialogue
   * handoff (the player isn't supposed to *want* to descend; cases
   * pull them in). Animation reads as "the floor goes liquid":
   *   1. Three concentric red rings ripple outward from the player.
   *   2. The player rotates + drops + fades + squashes vertically.
   *   3. A red flash washes over the camera as the floor "claims" them.
   *   4. Camera fades to black; WR starts.
   * Total ~1100ms — long enough for the metaphor to read, short
   * enough that it doesn't get tiresome on repeat plays.
   */
  private descendThroughGap(activeEncounterId: string) {
    // Descent is dialogue-driven now; canMove is intentionally false
    // when we get here (set by the claim-preview step that runs
    // before us). No guard needed.
    this.canMove = false

    // Cross-fade hospital ambience out so the WR's red_room track can
    // fade in without overlap.
    this.fadeOutHospitalAmbience(900)

    const px = this.player.x
    const py = this.player.y

    // Floor ripple — three concentric magenta/red rings expanding from
    // the player's tile. World-space, so they read as physical waves
    // on the floor instead of a screen-space FX flash.
    for (let i = 0; i < 3; i++) {
      const ring = this.add.graphics().setDepth(20).setAlpha(0)
      ring.lineStyle(2, 0xb13050, 1)
      ring.strokeCircle(px, py, 4)
      this.tweens.add({
        targets: ring,
        alpha: 0.9,
        duration: 120,
        delay: i * 110,
        yoyo: true,
        hold: 280,
        onComplete: () => ring.destroy(),
      })
      this.tweens.add({
        targets: ring,
        scale: 6,
        duration: 700,
        delay: i * 110,
        ease: 'Cubic.easeOut',
      })
    }

    // Player drops, slow rotation, squash, fade. Slight delay so the
    // ripple lands first.
    this.tweens.add({
      targets: this.player,
      y: py + TILE * 4,
      alpha: 0,
      scaleY: 0.6, // ~40% squash from base 1
      angle: 220,
      duration: 800,
      delay: 150,
      ease: 'Sine.easeIn',
    })

    // Red flash overlay (screen-space) just before the camera fade —
    // a moment of "the WR is bleeding through" before the cut.
    const { width, height } = this.scale
    const flash = this.add.rectangle(width / 2, height / 2, width, height, 0x6a0d10, 0)
      .setScrollFactor(0).setDepth(50)
    this.tweens.add({
      targets: flash,
      alpha: 0.55,
      delay: 700,
      duration: 200,
      yoyo: true,
      hold: 80,
      onComplete: () => flash.destroy(),
    })

    // Camera fade-to-black + start WR on completion. Every encounter
    // (both runtime-spec and iframe) lands in the WR — the player
    // walks the parallel-room layer to the obstacle and presses E.
    // WR.tryEngageObstacle dispatches to PuzzleBattleScene or
    // PrototypeIframeScene based on the encounter's fields.
    const spawnTileX = this.playerTileX
    const spawnTileY = this.playerTileY
    this.cameras.main.fadeOut(900, 0, 0, 0)
    this.cameras.main.once('camerafadeoutcomplete', () => {
      const state = getState()
      state.inWaitingRoom = true
      saveGame()
      debugEvent(`descent:starting-WR ${activeEncounterId} @ ${spawnTileX},${spawnTileY}`)
      // Sleep BEFORE launch so Hospital stops rendering before WR's
      // buildMap allocates tile sprites. If launch ran first, Hospital's
      // ~20k objects would still be active in the WebGL pipeline during
      // WR.create() and push total objects past the mobile limit.
      this.scene.sleep()
      this.scene.launch('WaitingRoom', { activeEncounterId, spawnTileX, spawnTileY })
    })
  }

  /**
   * Periodically launch a "ghost paper" — a faint piece of paper
   * scuttles across the camera viewport. Atmosphere only; no
   * interaction. Hints that the Waiting Room is bleeding through.
   *
   * Spawned in screen-space (scrollFactor 0) so it's always visible
   * regardless of where the camera is following the player.
   */
  private scheduleGhostPaper() {
    const fire = () => {
      // Skip if we're paused, transitioning, or generally not focused.
      if (!this.scene.isActive()) return
      this.spawnGhostPaper()
      // Re-arm with a randomized interval so it doesn't feel timed.
      this.time.delayedCall(Phaser.Math.Between(35_000, 70_000), fire)
    }
    // First glimpse fires after the player has had a moment to orient.
    this.time.delayedCall(Phaser.Math.Between(15_000, 30_000), fire)
  }

  private spawnGhostPaper() {
    const { width, height } = this.scale
    // Pick a horizontal direction; spawn just off the matching edge,
    // drift across with a slight vertical wobble + rotation.
    const goingRight = Phaser.Math.Between(0, 1) === 0
    const startX = goingRight ? -32 : width + 32
    const endX = goingRight ? width + 32 : -32
    const y = Phaser.Math.Between(Math.floor(height * 0.55), height - 80)

    const paper = this.add.image(startX, y, 'wr_paper')
      .setScale(2.2)
      .setAlpha(0)
      .setAngle(Phaser.Math.Between(-25, 25))
      .setScrollFactor(0)
      .setDepth(15)

    // The UI camera at zoom 1 owns scrollFactor-0 widgets cleanly.
    this.cameras.main.ignore(paper)

    const duration = Phaser.Math.Between(1800, 3200)
    this.tweens.add({
      targets: paper,
      alpha: 0.55,
      duration: 300,
    })
    this.tweens.add({
      targets: paper,
      x: endX,
      y: y + Phaser.Math.Between(-12, 12),
      angle: paper.angle + Phaser.Math.Between(-30, 30),
      duration,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.tweens.add({
          targets: paper,
          alpha: 0,
          duration: 250,
          onComplete: () => paper.destroy(),
        })
      },
    })
  }
}
