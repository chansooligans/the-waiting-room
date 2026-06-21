// In-world note text shown when the player bumps a solid object or
// presses E facing one. Pure data + a stable per-tile picker — extracted
// from HospitalScene to keep the scene file focused on lifecycle. The
// toast renderer (HospitalScene.flashFlavorToast) reads from here.
//
// Each tile char can map to a single string OR a list of variants. When
// a list is given, the variant is picked by a stable hash of the tile's
// (x, y) — so the same tile always reads the same line, but two
// neighboring desks won't say the same thing.
//
// Voice registers (mixed across each tile's variant list so the
// player isn't reading the same tone every time):
//
//   Default — dry, observant, three lines tops. Most flavor.
//
//   Procedural fragment — looks like a chart note, an audit trail
//     entry, a clipboard line. ALL CAPS or labeled fields. Reads as
//     a thing someone wrote down, not a thing Chloe is saying.
//
//   Overheard — a single quoted line attributed to nobody.
//     Drops the player into someone else's conversation, briefly.
//
//   Lowercase narrative — same observation in lowercase, sentence-
//     case, first-person-present. Looser. Slightly literary.
//
//   Patient perspective — describes the object as the patient who
//     used it might have seen it. Brief. Often the warmest beat.
//
//   Lynchian — the object is wrong in a small specific way. Wood
//     paneling too dark. Lights too warm. The cabinet is humming.
//
//   Diagnostic-poetry — a sentence that sounds clinical but lands
//     elsewhere. Very rare.
//
// Mix freely within each tile's list. The hash-based picker spreads
// them naturally across neighboring tiles.

export const TILE_FLAVOR: Record<string, string | string[]> = {
  L: [
    'LOCKED — KEYCARD REQUIRED\nThe reader sticker reads:\n"Authorized personnel only. Prior Auth team."',
    'LOCKED\nKeyhole filled with hot glue.\nThe handle still moves a quarter-inch.',
    'LOCKED\nA half-peeled Post-It on the door:\n"ASK ABOUT THE COMBO — DON\'T GUESS."',
    'LOCKED\nThe knob is warm. You don\'t know why.',
    'a locked door.\nyou don\'t have what opens it.\nnot yet.',
    'DOOR · STATUS: LOCKED\nLAST ACCESS: 04:11\nCREDENTIAL: REVOKED',
    '"— and they just changed the combo,\nso don\'t bother."\nVoices, fading down the corridor.',
    'A locked door. The brass plate\naround the lock has been polished\nin one small thumb-shaped spot.',
    'LOCKED\nA child\'s drawing taped at knee-height:\nthe door, but open. With a heart on top.',
    'The door is locked from the inside.\nWhich is the part that doesn\'t make sense.',
  ],
  F: [
    'FILING CABINET\nDrawer locked. A peeling label:\nPRE-2018 / DO NOT PURGE.',
    'FILING CABINET\nTop drawer half-open. Manila folders\ntabbed: AETNA, AETNA, AETNA, OTHER.',
    'FILING CABINET\nLocked. The keyhole has been filled\nwith hot glue. Recently.',
    'FILING CABINET\nA dent in the side from a kicked foot.\nLabel: APPEALS / RESOLVED.',
    'FILING CABINET\nA charm necklace looped over the handle.\nNobody has admitted to losing it.',
    'FILING CABINET\nA coffee ring on top, three layers deep.\nTop folder reads: 2019 / DESTROY 2026.',
    'FILING CABINET\nMagnet on the side: "WORLD\'S OK\'EST CODER."\nNobody owns up to that one either.',
    // procedural-fragment register
    'CABINET · BAY 4-C\nLAST INVENTORIED: 2017Q3\nCONTENTS: assumed.',
    'FILES · STATUS: SEALED\nPER 45 CFR 164.530.\nAccess requires written request.',
    // overheard register
    '"— anything before \'19 is in here,\nbut I don\'t know which here —"',
    '"— don\'t ask me, I just file what they hand me."',
    // lowercase narrative
    'a beige filing cabinet.\nthe third drawer down rattles\nwhen you walk past. you walk past.',
    'a cabinet, locked. someone has\nlabeled the lock STUCK in pencil,\nso you don\'t feel bad about it.',
    // Lynchian
    'FILING CABINET\nThe whole thing is humming.\nNothing in the building is electric here.',
    'FILING CABINET\nThe top drawer opens an inch by itself.\nYou close it.',
    // diagnostic-poetry
    'A vertical body of records.\nFour stacked compartments —\nfour stacked years of someone\'s care.',
    // === volume expansion to meet placement count (~54 cabinets) ===
    'FILING CABINET\nThe second drawer\'s pull is missing.\nA paper clip has been bent into its shape.',
    'FILING CABINET\nThe top is covered in stickers.\nState fairs, conferences, AHIMA \'14, AHIMA \'15.',
    'FILING CABINET\nA plant on top of it. Plastic.\nDust forming a perfect halo on the cabinet.',
    'FILING CABINET\nA crochet doily on the top.\nNobody asks who put it there.',
    'FILING CABINET\nThe label-maker labels:\nDRAWER 1: PRE-2018\nDRAWER 2: ALSO PRE-2018',
    'FILING CABINET\nA combination lock on the bottom drawer.\nNobody knows the combination.\nNobody asks.',
    'FILING CABINET\nA long scratch down the side\nat exactly key-on-keychain height.',
    'FILING CABINET\nA fire extinguisher leans against it.\nThe pin is in. The seal is not.',
    'FILING CABINET\nThe drawer slides smoothly.\nThe drawer beneath it sticks every time.',
    'FILING CABINET\nA recall notice from 2016 taped to the side.\n"DEFECTIVE LATCH — DO NOT OVERFILL."\nIt\'s very full.',
    'FILING CABINET\nA Polaroid taped inside the open drawer:\nthe team, in better light, in 2009.',
    'FILING CABINET\nThe metal hums when the AC kicks on.\nIt\'s in B-flat.',
    'CABINET · ROW 4\nCONTENTS: pre-EHR\nDISPOSITION: pending review (perpetual)',
    'CABINET · LOCKED\nKEY: lost (2021)\nDUPLICATE: also lost (2022)',
    'CABINET\nLEGAL HOLD — DO NOT TOUCH\n(handwritten, in red Sharpie, in 2014)',
    '"don\'t throw out the manilas,\nthey\'re cheaper than reordering."',
    '"that drawer hasn\'t been opened\nsince I started, and I started in 2017."',
    '"every time I open it I find a different pen."',
    'a drawer half-open, full of paperclips.\nyou close it. it slides back open.\nyou close it again.',
    'someone has lined the inside of the drawer\nwith leftover wrapping paper.',
    'a cabinet you\'ve walked past a thousand times.\nyou stop, briefly. you keep walking.',
    'FILING CABINET\nA small ribbon tied to the handle.\nNobody knows whose ribbon it is.',
    'FILING CABINET\nThe drawer rolls out and reveals\na single page. Nothing else.',
    'FILING CABINET\nThe top drawer holds nothing but pens.\nFour hundred pens. You don\'t count.',
    'FILING CABINET\nA family of small Beanie Babies\nlines the top. Some have tags. Some don\'t.',
    'A child has drawn faces on the front\nin marker. The faces have been mostly\nwiped off but not entirely.',
    'A small maintenance log taped to the side:\n"SQUEAK — REPORTED 2022."\nThe squeak is still there.',
    'A cabinet whose history you don\'t know\nbut can guess.\nA history of being there.',
    'FILING CABINET\nThe drawers are labeled by year.\nThe years are out of order.',
    'FILING CABINET\nThe drawer slides too fast.\nIt slams. You flinch.',
    'FILING CABINET\nA brass nameplate on the top:\n"M. ROSARIO — PA SPECIALIST."\nNo M. Rosario currently on staff.',
    'FILING CABINET\nTwo cabinets pushed together.\nTheir handles align in a way that\nlooks intentional.',
    'FILING CABINET\nThe paint is peeling on one corner\nin the shape of a state. Florida, almost.',
    'FILING CABINET\nA pencil rests on top.\nIt has been there a long time.\nIt is not your pencil.',
    'FILING CABINET\nMagnetic poetry on the side:\n"THE / QUIET / BUREAUCRAT / WAITS."\nAssembled by an unknown poet.',
    'FILING CABINET\nA tinsel garland from last December\nstill draped across the top.',
    'FILING CABINET\nThe label has been replaced\nwith a new label. The old one\npeeks out from underneath: AETNA / 2014.',
    'FILING CABINET\nThe drawer rolls out perfectly silently.\nThe room becomes briefly aware of you.',
    'A cabinet, still and metal.\nA repository for what won\'t be looked at again\nbut can\'t yet be discarded.',
  ],
  B: [
    'WHITEBOARD\n"DENIAL OF THE WEEK: CO-16"\nMissing remark code. Half-erased.',
    'WHITEBOARD\nA flowchart titled FRONT-END EDITS.\nThe last branch trails off into a question mark.',
    'WHITEBOARD\nKPI tracker. Clean Claim Rate: 84%.\n(Goal: 95%. The 84 has been there a month.)',
    'WHITEBOARD\n"Numerator / Denominator." Underlined\nthree times. No definitions given.',
    'WHITEBOARD\nA list: 14 names. Twelve crossed out.\nThe last two circled in red.',
    'WHITEBOARD\nAn arrow loops back into itself.\nLabel: APPEAL CYCLE.',
    'WHITEBOARD\nA birthday count for someone named\n"BARB" — three days. Taped over.',
    // procedural / chart-note
    'WHITEBOARD · MAIN HUB\nWeek of: blank\nFocus area: blank\nOwner: blank',
    'WHITEBOARD\nA Gantt chart in dry-erase blue.\nEvery bar ends in "TBD."',
    // overheard
    '"if you\'re going to write on it,\nwrite in pencil first." — ghosting\non the lower right corner.',
    '"I don\'t care who put it up there,\nI care who takes it down."\nQuote of the week. Sept.',
    // lowercase narrative
    'a whiteboard. someone has drawn\na frowning face in the corner\nand erased it half away.',
    'on the board: a single equation.\nx = the patient. y = the bill.\nno equals sign.',
    // patient perspective
    'WHITEBOARD\nThe word HOPE is written in the corner\nin a different hand. Smaller. In green.',
    // Lynchian
    'WHITEBOARD\nThe word AUDIT is written\nin the corner. You don\'t remember\nseeing it last week. Or writing it.',
    // diagnostic-poetry
    'A whiteboard, vast and partly erased.\nThe ghost of a word — STILL —\nfaint enough to question.',
    // === volume expansion to meet placement count (~17 whiteboards) ===
    'WHITEBOARD\nMost of the surface is the smudge\nof a hundred half-erased weeks. The white\nis only theoretical now.',
  ],
  R: [
    'RECEPTION COUNTER\nIntake clipboards stacked four deep.\nA ballpoint pen, chained.',
    'RECEPTION COUNTER\nA bell. A sign: "PLEASE RING ONCE."\nSomeone has rung it twice in pen.',
    'RECEPTION COUNTER\nA candy dish. Empty. Just wrappers.\nStrawberry — always the strawberry left.',
    'RECEPTION COUNTER\nA visitor-badge sticker half-printed,\nname field still blank.',
    'RECEPTION COUNTER\nA tiny zen sand garden, with one rake.\nThe sand has been raked into one stripe.',
    'RECEPTION COUNTER\nClipboard with no pen.\nPen with no clipboard. Beside it.',
    // procedural
    'COUNTER · STATION 2\nQUEUE: 4\nAVG WAIT: 23 MIN',
    'INTAKE STATION\n"Please have ID + insurance card ready."\nUnderneath, in pencil: "and patience."',
    // overheard
    '"...is your insurance the same as last time?"\n"...kind of?"',
    '"if it\'s on the form, it\'s on the form."',
    // lowercase narrative
    'the counter, scratched along its top edge\nfrom thirty thousand sliding clipboards.\nyou can almost see the grain.',
    'a small bowl of mints. all green.\nyou\'ve never seen anyone take one.',
    // patient perspective
    'RECEPTION COUNTER\nFrom this side, you can see the receptionist\'s\nshoes — sneakers, untied.',
    // Lynchian
    'RECEPTION COUNTER\nThe surface is laminate, but cool to the touch.\nLike a mortuary table. Same exact temperature.',
    // === volume expansion to meet placement count (~42 counters) ===
    'RECEPTION COUNTER\nA stack of registration packets.\nThe top one is half-completed in pencil.',
    'RECEPTION COUNTER\nA badge printer beside the keyboard.\nIt clicks twice every hour, regardless.',
    'RECEPTION COUNTER\nA plastic queue-stand with no rope.\nNobody knows where the rope went.',
    'RECEPTION COUNTER\nA jar of dum-dums marked\n"FOR KIDS ONLY (or doctors)."',
    'RECEPTION COUNTER\nThe edge has a long scratch\nfrom a clipboard slide.',
    'RECEPTION COUNTER\nA Plexi shield bolted to the front\nfor the pandemic. Still there.',
    'RECEPTION COUNTER\nA hand-sanitizer pump. Empty.\nThe refill is on the floor behind the counter.',
    'RECEPTION COUNTER\nA small queue ticket dispenser.\nCurrent number: 87. Now serving: 53.',
    'RECEPTION COUNTER\nA name plate for someone\nwho hasn\'t worked here in a year.',
    'RECEPTION COUNTER\nA call bell. The clapper is missing.',
    'COUNTER · STATION 1\nQUEUE: 7\nLONGEST WAIT: 41 MIN',
    'COUNTER · STATION 4\nINTAKE: PAUSED\nNEXT AVAILABLE: ?',
    'COUNTER · INTAKE TERMINAL\nLAST USER: K. WHITE\nSESSION: ABANDONED',
    '"you\'re going to need to fill out\nthe whole packet, dear." — every shift.',
    '"what they don\'t tell you in school\nis how many forms there are." — overheard.',
    '"the person before you took the last pen.\nthe person before her took the last clipboard."',
    'a counter, white laminate. someone has\ntaped a cartoon to the front:\nan analyst drowning in paper, smiling.',
    'a counter where a child can just barely\nsee over the edge. a small face appears\nperiodically.',
    'a stack of brochures: HOSPICE OPTIONS,\nFINANCIAL ASSISTANCE, DIRECTORY.\nthe directory is from 2019.',
    'somebody has written I LOVE U\non the counter in pen, then erased it.\nthe ghost of it remains.',
    'on the counter: a single button —\nthe kind a hospital gown is missing.',
    'RECEPTION COUNTER\nFrom this side, the receptionist\'s\ncomputer is angled away. Privacy.\nProcedure.',
    'RECEPTION COUNTER\nA small bouquet in a plastic vase.\nA card: "FOR THE TEAM."\nNo signature.',
    'RECEPTION COUNTER\nA "NOW SERVING" display reads 14.\nThe last patient called was 14.\nYou\'re 27.',
    'RECEPTION COUNTER\nA small velvet rope on stanchions\nin front of an empty corridor.\nIt has been there a year.',
    'RECEPTION COUNTER\nA pneumatic tube terminal at the back.\nThe last canister sits in the catcher.\nIt has been there since this morning.',
    'A counter, the front-of-house edge\nof a system the patient will never quite see\nfrom this angle.',
    'A wide flat surface across which\nidentities are exchanged for plastic bracelets.',
  ],
  V: [
    'VENDING MACHINE\nOUT OF ORDER — BILL VALIDATOR JAM.\nThe sign has been there all month.',
    'VENDING MACHINE\nA single bag of pretzels stuck at C-3.\nC-3 has been the problem since 2019.',
    'VENDING MACHINE\nA dollar bill taped to the glass:\n"FOR WHOEVER FIXES THIS."',
    'VENDING MACHINE\nThe coil for E-7 spins forever.\nNothing falls. Nothing has, in months.',
    'VENDING MACHINE\nThe display loops: PLS INSERT MORE COINS.\nYou haven\'t inserted any.',
    // procedural
    'VENDING UNIT 042\nLAST RESTOCKED: 11/02\nLAST EARNED: $2.25',
    // overheard
    '"the chocolate ones are\nthree weeks expired but somehow\nthey still hit." — taped to the side.',
    // lowercase narrative
    'the machine hums in C-flat.\na fluorescent buzz right at the edge\nof you noticing.',
    'a little plastic flap that opens onto nothing.\nsomeone took the prize and forgot\nto close the door.',
    // patient perspective
    'VENDING MACHINE\nA child sits in front of it,\nstaring up at the chips.\nNobody has come back for her.',
    // Lynchian
    'VENDING MACHINE\nRow B, slot 4 has a small pair of car keys\nbehind the chip bags. They\'ve been there\nfor as long as anyone remembers.',
  ],
  w: [
    'WATER COOLER\nThe jug gurgles. A taped note reads:\n"Refill before you leave. — Mgmt"',
    'WATER COOLER\nNearly empty. The little cone cups\nare also nearly empty.',
    'WATER COOLER\nA stack of paper cones, half tipped.\nThe top one has lipstick on it.',
    'WATER COOLER\nThe red tap drips, slow.\nA bucket. The bucket is half full.',
    'WATER COOLER\nNo cups. A handwritten sign:\n"BYO. — Reception."',
    // procedural
    'WATER COOLER · STATION 3\nLAST FILTER CHANGE: 2024Q1\nLAST WATER REFILL: this morning',
    // overheard
    '"— and I told him, water is water,\nbut he keeps bringing the Brita pitcher in." —\nfaint, from down the hall.',
    // lowercase narrative
    'the jug burps a single bubble.\nyou wait for the second one.\nit doesn\'t come.',
    'water cooler. blue ring of dust\naround the base — a halo for things\nnobody touches.',
    // Lynchian
    'WATER COOLER\nThe water level has not dropped\nin a week. Nobody has refilled it.',
  ],
  b: [
    'BULLETIN BOARD\n• OPEN ENROLLMENT ENDS NOV 15\n• "Lost: blue badge — Sam, ext. 4112"\n• Pizza Friday (last week\'s flyer)',
    'BULLETIN BOARD\nA payer policy update from 2019\npinned over a payer policy update from 2018.',
    'BULLETIN BOARD\n"WORKFLOW POTLUCK — Thursday 5pm —\nbring a side and a denial story."',
    'BULLETIN BOARD\nOSHA poster, faded. Someone has drawn\na tiny mustache on the regulator.',
    'BULLETIN BOARD\n"DENIAL CODE OF THE WEEK: CO-97"\nThree CO-97 jokes pinned beneath.\nEach worse than the last.',
    'BULLETIN BOARD\nA running list of "WINS THIS QUARTER."\nIt has three entries. Two are typos.',
    'BULLETIN BOARD\n"FOUND: a single blue earring."\nBeneath it, in different handwriting:\n"FOUND: the matching one. Sept 14."',
    // procedural
    'BULLETIN BOARD · MAIN HUB\nPosted: 11/15\nApproved: pending',
    // overheard
    '"— who\'s the gnome in 2C, pinning recipes\nover the safety stuff." — laughter,\ndrifting from the hall.',
    // lowercase narrative
    'a corkboard, but most of the cork\nis hidden under thirty years\nof slightly out-of-date paper.',
    'a Polaroid of the team from 2014.\nthree of those people no longer work here.\nyou still get the holiday card from one.',
    // patient perspective
    'BULLETIN BOARD\nA crayon drawing pinned at\nchild-eye height: a stick-figure family\noutside a hospital, smiling.',
    // Lynchian
    'BULLETIN BOARD\nA Polaroid in the corner shows\nthis exact wall, last year. Same items.\nDifferent light.',
    // diagnostic-poetry
    'A board of small surviving things.\nTaped, layered, illegible.\nNobody removes anything; the board only grows.',
  ],
  H: [
    'EXAM TABLE\nPaper liner crinkled from the last patient.\nA blood-pressure cuff dangles off the side.',
    'INFUSION RECLINER\nThe IV pole is empty.\nA folded blanket on the seat.',
    'EXAM TABLE\nThe stirrup hardware folded back in.\nA tongue depressor on the floor.',
    'INFUSION RECLINER\nThe armrest still has the pump-tape\nresidue from the last patient. Sticky.',
    'EXAM TABLE\nA pediatric height chart on the wall behind it.\nThe top sticker is a giraffe.',
    // procedural
    'BAY 3 · STATUS: TURNED OVER\nLAST PATIENT: discharge 10:42\nNEXT PATIENT: 11:15',
    // overheard
    '"— and tell her not to lie down till the\nlidocaine catches up." — voice from\nthe hallway, fading.',
    // lowercase narrative
    'an exam table. the crinkle of the paper\nstill audible somewhere in the building.\na hundred crinkles a day.',
    'an infusion recliner. a paperback face-down\non the side table — page 173. someone\nstopped mid-chapter to be called in.',
    // patient perspective
    'INFUSION RECLINER\nFrom this seat, you\'d see the bag\nabove your shoulder, and the line dropping\nfrom it once a second. Once a second.',
    // Lynchian
    'EXAM TABLE\nThe paper has been changed but not torn.\nWhich means it ran out at the roll.\nWhich means somebody re-rolled it.',
    // diagnostic-poetry
    'A paper-covered horizon\nwhere a thousand patients have lain\nin the same shape.',
  ],
  X: [
    'FAX MACHINE\nStatus light blinking: NO LINE.\nThe out-tray has a single curled page.',
    'FAX MACHINE\nReceived: 1 page from UNKNOWN — 03:42 AM.\nThe page is upside down. You leave it.',
    'FAX MACHINE\nThe paper tray is jammed.\nA half-printed authorization curls out.',
    'FAX MACHINE\n"FAX CONFIRMATION: SUCCESS."\nNobody remembers sending one.',
    'FAX MACHINE\nThe handset is gone. Just the cradle.\nIt rings anyway. Twice.',
    // procedural
    'FAX UNIT 6\nLAST TX: 14:02 → AETNA PA UNIT\nSTATUS: OK',
    'FAX UNIT 6\nQUEUE: 3 OUTBOUND, 0 INBOUND\nLINE: BUSY (4 retries)',
    // overheard
    '"the fax. yes. still." — Dana,\nyesterday afternoon, to nobody.',
    '"if you can read it, you can fax it.\nif you can fax it, you have proof."',
    // lowercase narrative
    'the fax breathes. it does that.\nyou\'ve learned not to startle.',
    'a fax machine in 2026, still here,\nstill warm to the touch, still required\nby seven of the twelve major payers.',
    // Lynchian
    'FAX MACHINE\nThe out-tray has one page in it,\nface down. You don\'t turn it over.',
    // diagnostic-poetry
    'A small electric mouth\nthat speaks in pages.\nIt has spoken eleven times today.',
  ],
  c: [
    "DESK\nA half-eaten bagel on a napkin.\nOpen browser tab: \"Aetna PPO formulary 2024.\"",
    'DESK\nThe CRT hums. Photo of a corgi pinned\nto the monitor with packing tape.',
    'DESK\nSticky note on the keyboard:\n"CALL ANJALI BACK — RE: BILL."',
    'DESK\nA Rolodex. An actual Rolodex.\nMost cards blank. First one:\nMERCY GENERAL — IT — ext. 3000.',
    'DESK\nStacks of EOBs sorted by payer.\nA half-finished crossword.\n14-down: PARTITA.',
    'DESK\nMonitor sticky-noted:\n"DON\'T MOVE — recording."\nNothing is recording.',
    'DESK\nA cup of coffee, cold.\nA second cup of coffee, behind the first.\nAlso cold.',
    'DESK\nThree empty Diet Coke cans.\nThe phone\'s message-waiting light\nhas been on for a week.',
    // procedural
    'WORKSTATION 14\nUSER: pat.tan\nLAST LOGIN: 7:42\nLOGGED OFF: never',
    'DESK · UTILIZATION REVIEW\nQUEUE: 22\nSLA AT RISK: 3',
    // overheard
    '"if you move my snake plant\nI\'m gonna lose it." — sticky\nstuck to the monitor.',
    '"call before you fax. fax before you call.\nthat\'s the order. that\'s how it works."',
    // lowercase narrative
    'a desk like every desk: monitor, mug,\nstapler, two pens that don\'t work,\none that does.',
    'a workstation. the wrist rest is shaped\nto someone else\'s wrist by now.\nyou wonder whose.',
    'a small framed photo: a dog,\na rented cabin, a person looking just\noffscreen and laughing.',
    // patient perspective
    'DESK\nFrom the patient side: a wall of paper.\nThe analyst is somewhere behind it.\nYou can hear her typing.',
    // Lynchian
    'DESK\nThe screensaver is the time.\n12:14, in green numbers, scrolling slow.\nIt\'s 4 PM.',
    // diagnostic-poetry
    'A desk arranged the way a desk\nis arranged when its person\nhas been here a long time.',
    // === volume expansion to meet placement count (~72 desks) ===
    'DESK\nA wall calendar from 2019.\nNobody has flipped a page in seven years.',
    'DESK\nA mug that says WORLD\'S BEST COWORKER.\nA second mug, identical, beside it.\nNeither has been washed.',
    'DESK\nMonitor 1: claim queue.\nMonitor 2: solitaire, paused.',
    'DESK\nA fidget cube. The buttons are worn smooth.\nThe spinner makes a small click.',
    'DESK\nA stack of CMS-1500s, blank.\nA stack of CMS-1500s, completed.\nThe stacks are the same height.',
    'DESK\nA framed certificate: CPC, AAPC.\nThe glass has a hairline crack from corner to corner.',
    'DESK · WORKSTATION 04\nUSER: alex.kim\nIDLE: 47 MIN\nLOGGED OFF: never',
    'DESK · BILLING\nQUEUE: 412\nAVG TURNAROUND: 6 days\nGOAL: 4',
    'DESK · INTAKE\nMODE: open\nSESSION TIMEOUT: 8h',
    '"the password is on the post-it under the keyboard,\nbut you didn\'t hear that from me."',
    '"if you take my snack drawer\nI\'m calling HR." — taped to a drawer.',
    '"I keep my Aetna binder under the heater\nbecause it stays open that way."',
    'a desk somebody loved. you can tell\nby the photos: cabin, dog, kid.\nin that order.',
    'a desk where the chair has been pulled out\nas if to leave, but the coffee is still warm.',
    'a desk with a single houseplant.\nthe plant is doing okay.\nthe person, you can\'t tell.',
    'someone has aligned the pens by length.\nyou hate them a little. and respect them.',
    'a small radio playing classical music\nat a volume below the threshold of conversation.',
    'three pens. all blue. one cap missing.\nthe missing cap is on a fourth pen,\nin the drawer.',
    'DESK\nA child\'s art on the partition wall:\n"FOR MOMMY\'S OFFICE." Crayon. Two suns.',
    'DESK\nA Beanie Baby on the monitor stand.\nIts tag still attached. Its eye loose.',
    'DESK\nThe person who sits here has\na Live, Laugh, Love sign and a switchblade.\nNo overlap explanation.',
    'DESK\nA half-finished knit beanie\non the side. Two needles still in it.',
    'DESK\nThe phone has 47 missed calls,\nno voicemails. Your guess: payers.',
    'DESK\nA sticky note: "REMEMBER ALMA."\nNobody named Alma works here.',
    'DESK\nA fortune-cookie strip pinned to the cubicle wall:\n"YOU WILL FIND WHAT YOU\'RE LOOKING FOR\nAFTER YOU STOP LOOKING."',
    'DESK\nThe drawer is full of takeout chopsticks,\nstill in their paper sleeves. Forty? Fifty?',
    'DESK\nA stress ball in the shape of a heart.\nSomeone has thrown it at the wall hard\nenough to leave a small scuff.',
    'DESK\nThe monitor has a yellow Post-It tower\nclimbing the right edge. Bottom one says BCBS.\nTop one says PAY ATTENTION.',
    'DESK\nThe keyboard\'s spacebar is shinier than the rest.\nThe ENTER key is shinier still.',
    'DESK\nA snow globe of someplace\nyou can\'t make out. The water is murky.\nThe figurine inside is a man at a desk.',
    'DESK\nThe office chair is angled\nlike its owner is mid-conversation.\nThey\'ve been gone an hour.',
    'DESK\nA Word document open on the screen:\n"Dear payer,"\nNothing else.',
    'DESK\nA second monitor, off.\nA third monitor, off.\nThe first one is fine.',
    'DESK\nA novelty stamp: "DENIED."\nA second novelty stamp: "PAID."\nThe DENIED one has more wear.',
    'DESK\nThe desk is L-shaped.\nOnly the long arm is in use.\nThe short arm holds nothing.',
    'DESK\nA hand-drawn org chart taped to the divider.\nThe person at the top is labeled "?"',
    'DESK\nThe trash can is overflowing.\nThe recycle bin is empty.',
    'DESK\nA Costco-pack of tissues, half empty.\nA bottle of eye drops, also half.',
    'DESK\nA picture of a baby on the monitor.\nThe baby would now be eleven.\nNo updated picture.',
    'DESK\nThe label-maker is out of tape.\nLabels on every drawer anyway:\nNOTHING. SOMETHING. EVERYTHING.',
    'DESK\nThe Diet Coke can is sweating onto a grant proposal.\nNobody seems to mind.',
    '"if I have to read one more redetermination letter\nI swear" — a sigh, two cubicles over.',
    '"the EMR is down again." — every fifteen minutes,\nfor about an hour.',
    'A desk piled with charts.\nThe top one is dated tomorrow.\nYou look again. Today.',
    'DESK\nThe phone rings once. Then stops.\nThen rings once more.\nNobody picks up.',
    'DESK\nA single dried rose, wrapped in cellophane.\nNo card.',
    'DESK\nAn open notebook.\nThe writing is in shorthand —\na language you almost recognize.',
    'A workstation. The keyboard is warm.\nThe mouse is cool.\nThis only makes sense if she just stood up.',
    'A desk arranged in concentric rings of importance.\nClaim packets at the center.\nFamily photos at the periphery.',
    'A desk where an analyst sits when she sits.\nShe sits a long time.\nThe carpet under the chair is worn through to the pad.',
    'DESK\nA highlighter, dried.\nA second highlighter, dried.\nA pencil, sharpened to a nub.',
    'DESK\nA pair of reading glasses on a chain.\nThe chain is decorative.\nThe glasses are real.',
    'DESK\nA mouse pad with a corgi on it.\nThe corgi has been worn pale\nin one specific spot.',
    'DESK\nThe phone\'s receiver is off the hook,\nresting on the desk. Has been for a while.\nDial tone, faintly.',
    'DESK\nA "WORLD\'S OKAYEST CODER" mug.\nA second one, identical, on the\ndesk one over. The mugs traveled together.',
  ],
  // Chairs (h) and auditorium seats (s) intentionally omitted —
  // they're placed densely (~100+ each across the map) and reading
  // the same handful of chair lines repeatedly broke the variety
  // that the per-tile flavor system is meant to provide. The
  // flavorForTile picker returns undefined for unmapped chars and
  // the toast is skipped, so silence here = no toast on chair bumps.
  P: [
    'POTTED PLANT\nPlastic. Dust on the leaves.\nNobody has watered it since you started.',
    'POTTED PLANT\nA philodendron. Real, somehow.\nLeaves yellow at the tips.',
    'POTTED PLANT\nFake. The pot is full of takeout receipts\nsomeone shoved in there.',
    'POTTED PLANT\nA spider plant with five baby plants\ndangling. Nobody to give them to.',
    'POTTED PLANT\nFake. A real spider has\nmade itself comfortable inside.',
    'POTTED PLANT\nGoogly eyes someone stuck on the trunk.\nThree pairs. All looking elsewhere.',
    // procedural
    'PLANT · BAY 7\nLAST WATERED: ?\nSPECIES: ? (silk)',
    // overheard
    '"the only thing in this building that\'s\nstill green and breathing." — Sam, last week,\npretty sincere about it.',
    // lowercase narrative
    'a small plant in a clay pot.\nsomeone has tied a little ribbon\naround its trunk. the ribbon is for nothing.',
    'a fern with a yellowing frond.\nyou consider watering it.\nyou don\'t.',
    // patient perspective
    'POTTED PLANT\nA child has tucked a folded paper crane\ninto the pot. The crane is real.\nThe plant isn\'t.',
    // Lynchian
    'POTTED PLANT\nThe leaves move slightly when you\'re\nnot looking. There is no air vent\nin this part of the room.',
    // === volume expansion to meet placement count (~47 plants) ===
    'POTTED PLANT\nA snake plant. Indestructible.\nIt has been here longer than you have.',
    'POTTED PLANT\nA dracaena. Real, mostly dead.\nThree green leaves at the very top.',
    'POTTED PLANT\nA monstera. Holes in the leaves\nlike someone has been auditing them.',
    'POTTED PLANT\nA fiddle-leaf fig.\nTwo leaves on the floor. Three on the plant.',
    'POTTED PLANT\nA rubber plant. Glossy from being\nover-Armor-Alled. Someone takes this seriously.',
    'POTTED PLANT\nA ZZ plant. The leaves point in\nseventeen directions. None of them up.',
    'POTTED PLANT\nA peace lily. Drooping.\nSomeone\'s coffee inside its pot.',
    'POTTED PLANT\nA succulent. The leaves are wrinkled.\nIt has not been watered.\nIt has been over-watered.',
    'POTTED PLANT\nA pothos cascading off a shelf.\nTrailing six feet down the wall.',
    'POTTED PLANT\nA jade plant in a chipped clay pot.\nSomeone\'s mother\'s, probably.',
    'POTTED PLANT\nThe leaves are tinged purple at the edges.\nNobody knows what this means.',
    'POTTED PLANT\nFake. The leaves are not in the right shape\nfor any plant species. Slight tetrahedral.',
    'POTTED PLANT\nA single sunflower in a coffee mug.\nIt was a gift. The mug is unwashed.',
    'POTTED PLANT\nReal. Tag still in the soil:\n"$4.99 — TRADER JOE\'S — JAN \'24."',
    'POTTED PLANT\nThe pot has a small drainage tray.\nThe tray is dry. The soil is wet.',
    'POTTED PLANT\nA plant in a teapot. The lid\nin the soil, upside down, holding a\nvery small ceramic frog.',
    'POTTED PLANT\nA cactus. Has bloomed once.\nNobody saw.',
    'PLANT · UNREGISTERED\nNOT ON FACILITY PLANT LOG\nSPECIES: ?',
    'PLANT · CARE LOG\nLAST WATERED: 11/02 (Sam)\nLAST FERTILIZED: never',
    '"if you\'re going to water it,\nyou have to commit." — Sam,\nthe one person who waters anything.',
    '"the plant in 4-C has a name,\nbut nobody will tell me what it is."',
    'a plant. you don\'t know its name.\nyou don\'t know whose plant it is.\nyou wish it well.',
    'a plant in the corner where almost no light falls.\nit has done okay. it surprises you.',
    'a small plant in a Dixie cup.\nsomeone\'s elementary school project.\nadopted, evidently, by an adult.',
    'a plant whose pot is wrapped\nin foil. there\'s probably a logic to it.',
    'on the soil: a single quarter,\ntails up. been there long enough\nto have left a small green imprint.',
    'POTTED PLANT\nThe leaves catch the fluorescent light\nin a way that almost looks healthy.',
    'POTTED PLANT\nA child has named the plant\nin Sharpie on the pot: HARRY.',
    'POTTED PLANT\nThe plant has sent a single new leaf\nin the last six months. Tiny. Curled tight.',
    'POTTED PLANT\nThe pot has been mended twice.\nYou can see the seams.',
    'POTTED PLANT\nA prayer card propped against the pot.\nSt. Jude. The card has yellowed.',
    'POTTED PLANT\nThe plant is real. It has thrived\nin spite of you, your colleagues,\nand the air conditioning.',
    'POTTED PLANT\nA spider has spun a web\nbetween two leaves. The plant\nlooks nicer with it than without.',
    'POTTED PLANT\nThe pot is glazed in three colors.\nA child made it. The child is now\nsomeone\'s coworker.',
    'A plant of indeterminate species\nin a pot of indeterminate origin\nin a corner nobody passes much.',
    'A small green thing tended by everyone\nand by nobody. The way an organization\nknows how to keep something alive.',
  ],
  E: [
    'VITALS MONITOR\nOn a wheeled stand. The screen pulses\na slow green sine wave. Probably idle.',
    'VITALS MONITOR\nThe BP cuff is tangled in its own tube.\nThe O2 sat clip dangles.',
    'VITALS MONITOR\nThe screen reads PATIENT DISCONNECTED.\nThe room is empty.',
    'VITALS MONITOR\nA Post-It on the screen:\n"DON\'T TURN OFF — calibrating."\nNot dated.',
    // procedural
    'PHILIPS MX450\nLAST CAL: 09/12\nNEXT CAL: 03/13',
    'BEDSIDE MONITOR\nALARM: SUSPENDED\nMODE: STANDBY',
    // overheard
    '"if it\'s beeping at you, it\'s\nasking. listen." — Dr. Park,\noverheard from rounds.',
    // lowercase narrative
    'a vitals monitor on a wheeled cart.\nthe wheels squeak in different keys.\nthe back wheel is the loudest.',
    // Lynchian
    'VITALS MONITOR\nThe screen shows two heart-rate traces.\nThe second one is just a quarter-beat behind.',
    // diagnostic-poetry
    'A small machine that listens for the body\nin three places at once,\nand shows what it hears in green.',
  ],

  // ===== 2026-05 redraw set: cars, lampposts, lecture-hall props,
  // cafeteria props, parking-lot infrastructure =====

  '1': [
    'SEDAN\nWindshield needs replacing —\nspider crack from the rearview down.',
    'SEDAN\nA hospital parking pass on the dash,\nexpired four months.',
    'SEDAN\nThe back has a dog-stencil sticker\nAND a "BABY ON BOARD" sign.\nDoesn\'t add up.',
    'SEDAN\nA balled-up McDonald\'s bag in the wheel well.\nThe driver-side door is unlocked.',
    'SEDAN\nNew car smell. New car.\nFlorida plates.',
    // procedural
    'VEHICLE · LOT C\nPLATE: 7HXP-449\nSTATUS: parked > 8h',
    // overheard
    '"my car? blue, four doors,\nbroken antenna." — at the desk,\nan hour ago.',
    // lowercase narrative
    'a sedan, parked between the lines.\nthe window cracked an inch.\nsomeone\'s coming back soon.',
    'a small bumper sticker:\n"i brake for documentation."\nyou laugh, briefly.',
    // patient perspective
    'SEDAN\nA car seat in the back,\nstill with the new-baby tag\non the strap. Not new anymore.',
    // Lynchian
    'SEDAN\nThe driver\'s seat is reclined fully back.\nNobody\'s in it. The keys\nare in the ignition.',
    // === one more variant to meet placement count (~12 sedans) ===
    'SEDAN\nA Star of David air freshener\non the rearview mirror. Faded.\nA second one beside it. Newer.',
  ],
  '2': [
    'SUV\nMud-spattered to the wheel wells.\nLicense plate frame: "I\'D RATHER BE CODING."',
    'SUV\nRoof rack carrying a kayak.\nIt\'s February.',
    'SUV\nThe back is full of car-seat detritus —\nCheerios, a sippy cup, a single tiny shoe.',
    'SUV\nLights left on. You can hear them ticking.',
    'SUV\nDealer plate frame from a place\nyou\'ve never heard of.',
    // procedural
    'VEHICLE · ACCESSIBLE TAG\nDOT-mounted placard,\nblue. Renewal: 2027.',
    // overheard
    '"someone\'s left their lights on" —\nover the lobby PA, twice today.\nnobody\'s come out.',
    // lowercase narrative
    'an SUV parked across two lines.\nyou consider keying it.\nyou don\'t.',
    'a sticker on the back window:\n"my kid is honor roll at —"\nthe school name is sun-faded blank.',
    // Lynchian
    'SUV\nThe windows are tinted black.\nThe engine is not running.\nThe inside is exactly the same temperature\nas outside.',
  ],
  '3': [
    'BEATER\nThe driver\'s window is held up\nby a rolled towel. A flat in the back.',
    'BEATER\nDuct tape on the side panel.\nThe registration sticker is from 2017.',
    'BEATER\nA bumper sticker: "MY OTHER CAR\nIS A 1984 PROCEDURE." Dark humor.',
    'BEATER\nThe rear window has a hand-painted\nNumber 47 in glitter glue.',
    'BEATER\nThe alarm is going off, faintly.\nIt\'s been doing that for a while.',
    // procedural
    'VEHICLE · ABANDONED?\nSAME LOT POSITION 14 DAYS\nNO COMPLAINT FILED',
    // overheard
    '"if it has rust, it has stories." —\nbumper sticker, half-peeled.',
    // lowercase narrative
    'a car in the lot the way a tooth\nis in a jaw — there because\nremoving it would cost more.',
    'a beater, the kind of beater you grow attached to.\nthe sun-faded interior is the color\nof a thing once cared for.',
    // patient perspective
    'BEATER\nA wheelchair lift in the back,\njerry-rigged. Black market YouTube tutorial,\nten years ago, still working.',
    // Lynchian
    'BEATER\nThe radio is on, faintly.\nThe ignition is off.',
  ],
  '4': [
    'LAMPPOST\nThe shroud is dented in.\nNot working.',
    'LAMPPOST\nA flyer stapled to the pole:\n"LOST CAT — OPI — orange tabby."\nIt\'s been there since spring.',
    'LAMPPOST\nThe base is rusted through.\nIt sways a little when the wind picks up.',
    // procedural
    'LIGHT · POLE 14\nLAST INSPECTION: 2023\nLAMP TYPE: HPS (replace w/ LED)',
    // overheard
    '"the one at the end of the row\nflickers in morse, I swear" —\nlot guy, joking. probably.',
    // lowercase narrative
    'a lamppost whose pole has been kicked\nso many times the dent is now its shape.',
    // Lynchian
    'LAMPPOST\nNot lit. The bulb is intact.\nThe wiring is sound.\nIt simply isn\'t lit.',
  ],
  '5': [
    'LAMPPOST\nOrnamental glass globe.\nThe bulb inside flickers, just barely.',
    'LAMPPOST\nA bird has nested on the crossbar.\nYou can hear faint chirping.',
    'LAMPPOST\nThe glass is cracked but holding.\nA web of hairline fractures, lit from within.',
    // procedural
    'LIGHT · POLE 22\nORNAMENTAL — PRESERVATION HOLD\nDO NOT REPLACE',
    // lowercase narrative
    'a lamppost like a small lit moon.\nyou stand under it, briefly,\nand are the same temperature as it.',
    // patient perspective
    'LAMPPOST\nThe glow falls in a perfect circle.\nA child once stood inside it,\nlooking up.',
    // Lynchian
    'LAMPPOST\nThe globe holds a small dark shape\ninside it. Not a bulb.\nNot today.',
  ],
  '6': [
    'LAMPPOST\nTwin globes. Only one is lit.\nThe dark one has a hairline crack.',
    'LAMPPOST\nIvy creeping up the pole.\nThe maintenance crew has given up.',
    'LAMPPOST\nA "WE\'LL MISS YOU EARL" wreath\nzip-tied to the base. Earl was the lot guy.',
    // procedural
    'LIGHT · POLE 31 (TWIN)\nLEFT GLOBE: OK\nRIGHT GLOBE: OUT (since 2024Q3)',
    // overheard
    '"two suns. one always shy."\n— hand-painted on the base,\nsomeone\'s small gift.',
    // lowercase narrative
    'a twin lamp. one of them flickers,\nthe other doesn\'t.\nthey aren\'t synchronized.',
    // Lynchian
    'LAMPPOST\nThe two globes are slightly\ndifferent shades of yellow.\nYou\'ve never noticed before.',
  ],
  // Auditorium seats (s) intentionally omitted — see chairs (h)
  // note above. Same reason: ~80 placements densely packed in the
  // lecture hall, reading flavor on every one breaks variety.
  k: [
    'CHALKBOARD\nThe last lecture\'s formula:\n"PMT = ASP × 1.06"\n(Half-erased.)',
    'CHALKBOARD\nA crude diagram of the heart.\nLabeled wrong on the ventricles.',
    'CHALKBOARD\nA poem someone left up:\n"What is care, but a column —"\nThe rest is erased.',
    'CHALKBOARD\nA flowchart that loops back\non itself three times before exiting.',
    'CHALKBOARD\nGiant DRG-871 in red chalk.\nUnderneath, smaller: "DO NOT FORGET."',
    // procedural
    'BOARD · LECTURE HALL B\nLAST CLEANED: 2023\nLAST WRITTEN: yesterday',
    // overheard
    '"the older the chalkboard, the better\nthe ghosts of equations." — a professor,\nlast year, half-joking.',
    // lowercase narrative
    'a chalkboard that\'s mostly chalkboard\nand partly the ghosts of every lecture\nimperfectly erased.',
    // Lynchian
    'CHALKBOARD\nThe equation has changed\nsince you last looked.\nYou last looked one minute ago.',
    // diagnostic-poetry
    'A blackboard, almost.\nThe slate keeps an outline of every word\never written on it. A history visible only to itself.',
  ],
  A: [
    'AVOCADO ARMCHAIR\nA spring popped through the cushion.\nYou notice it before you sit.',
    'AVOCADO ARMCHAIR\nThe upholstery smells like 1976.\nIt\'s 2026.',
    'AVOCADO ARMCHAIR\nA throw pillow embroidered\n"HOME SWEET CLAIM." Found, not bought.',
    'AVOCADO ARMCHAIR\nThe armrest has been worn pale\nin the exact shape of a forearm.',
    // overheard
    '"the chair from my mother\'s living room\nbut bigger and slightly wronger."\n— a visitor, to nobody.',
    // lowercase narrative
    'an armchair the color of an avocado\nthat\'s about to turn. comfortable\nin the way old things are.',
    // patient perspective
    'AVOCADO ARMCHAIR\nThe seat is sunken in two places —\nthe shape of every patient\nwho\'s waited here in pairs.',
    // Lynchian
    'AVOCADO ARMCHAIR\nThe pattern, up close, is a repeating\nmotif of small open eyes.\nIt looks like fronds, from a distance.',
  ],
  T: [
    'CAFETERIA TABLE\nA water ring three-deep.\nSomeone\'s ID card half-tucked under a napkin.',
    'CAFETERIA TABLE\nSalt shaker missing.\nThe pepper one is missing a leg.',
    'CAFETERIA TABLE\nA tray with one bite of pie left.\nForkprints around it.',
    'CAFETERIA TABLE\nA crossword half-finished.\nThe answer to 7-across is wrong.',
    'CAFETERIA TABLE\nA prayer card, face down.\nYou don\'t flip it.',
    // procedural
    'TABLE 4 · CAFETERIA\nLAST WIPED: ?\nSEATS: 4 (3 chairs present)',
    // overheard
    '"— and the doctor said it might be\nweeks. weeks." — a family,\ntwo tables over.',
    // lowercase narrative
    'a round table. someone has put down\ntheir tray, gotten up, and forgotten\nwhich one was theirs.',
    // patient perspective
    'CAFETERIA TABLE\nA paper napkin folded into a star.\nSomeone\'s child made it,\nwaiting for a parent in surgery.',
    // Lynchian
    'CAFETERIA TABLE\nA single ice cube in the middle of the table,\nnowhere near a glass.\nNot melting.',
  ],
  m: [
    'STEAM TABLE\nMashed potatoes. Gravy.\nThe heat lamp buzzes overhead.',
    'STEAM TABLE\nThe carving station is empty —\njust the knife on the cutting board.',
    'STEAM TABLE\nMac and cheese. The crust on top\nhas been there since the lunch rush.',
    // procedural
    'STEAM WELL · TRAY 3\nFOOD: MASHED\nINTERNAL TEMP: 168°F (held)',
    // overheard
    '"the gravy comes from a mix.\nthe mix comes from corporate.\ncorporate comes from connecticut."',
    // lowercase narrative
    'a steam table, the food sweating\nunder its plastic dome.\nyou wonder if "sweating food" is a phrase.',
  ],
  M: [
    'STEAM TABLE\nBrass rims dulled by years of cleaning.\nEach well a slightly different temperature.',
    'STEAM TABLE\nThe sneeze guard has a fingerprint.\nNot near the food. Higher.',
    'STEAM TABLE\nThe heat lamp glows red.\nThe food beneath it has stopped steaming.',
    // procedural
    'BUFFET · 4-WELL HOTEL PAN\nWELL 1: empty\nWELL 2: red beans\nWELL 3: rice\nWELL 4: empty',
    // patient perspective
    'STEAM TABLE\nA hand-lettered sign in front:\n"please ask if you have questions"\nNobody is behind it to ask.',
    // Lynchian
    'STEAM TABLE\nThe brass under your hand is warm.\nThe trays inside are cold.',
  ],
  C: [
    'CURB\nA cigarette butt in the gutter.\nLipstick on the filter.',
    'CURB\nChunks of asphalt have crumbled\naround the base. Recently.',
    'CURB\nA Sharpied "FOR HEATHER" on the\nconcrete. The H is half-faded.',
    // overheard
    '"watch your step." — habit,\nfrom a guard fifteen yards back.',
    // lowercase narrative
    'a curb, painted yellow, where the yellow\nhas mostly become memory.',
    // patient perspective
    'CURB\nA child has chalked a hopscotch grid here\nand someone has half-erased it,\nthen left it.',
  ],
  r: [
    'STREET\nA car passes too fast.\nA paper coffee cup tumbles in its wake.',
    'STREET\nThe yellow line has worn through\nin three places. Nobody\'s repainted.',
    'STREET\nA single tire mark, fresh.\nIt curves the wrong way.',
    // procedural
    'STREET · MERCY DR\nSPEED LIMIT: 25\nLAST RESURFACED: 2019',
    // overheard
    '"every road past a hospital\nis somebody\'s last road, eventually." —\noverheard, on a smoke break.',
    // Lynchian
    'STREET\nThe yellow line breaks for the crosswalk\nand resumes on the other side.\nThe two halves are not aligned.',
  ],
}

/** Stable per-tile variant pick. Same (x, y) → same line every time;
 *  different (x, y) with the same tile char → different line. */
export function flavorForTile(ch: string, x: number, y: number): string | undefined {
  const v = TILE_FLAVOR[ch]
  if (!v) return undefined
  if (typeof v === 'string') return v
  const h = ((x * 73856093) ^ (y * 19349663)) >>> 0
  return v[h % v.length]
}

/** Where the player should head when each level begins. Shown under
 *  the level-advance banner. Mentions the case-handing NPC + their
 *  rough location so the player isn't left scanning the whole map. */
export const LEVEL_ORIENTATION_HINTS: Record<number, string> = {
  1:  'Wait at your desk — Anjali is on her way.',
  2:  'Liana from pharmacy is in the Main Hub — a J-code denial (ASP/WAC).',
  3:  'Find Kim at the Registration desk. Stale insurance card.',
  4:  'Alex stepped out over a stoploss case — take the lobby EXIT to the parking lot.',
  5:  'The south wing opens. Pat is in HIM / Coding — pull Sarah Kim\'s chart at Med Records, then bring it back.',
  6:  'Marisol\'s in the parking lot — outpatient surgery grouper (APC). Take the lobby EXIT.',
  7:  'Jordan in Eligibility — a no-show fee policy call.',
  8:  'Martinez is in Prior Auth. CO-197 on an MRI.',
  9:  'Jordan in Eligibility — a patient with no path to pay (charity care).',
  10: 'Theresa\'s in the parking lot — GFE vs bill. Take the lobby EXIT.',
  11: 'Diane in Patient Services — medical-necessity denial. Pull the Walker echo at the lit drawer first.',
  12: 'Roni in the Lab — NCCI edits as the claim swarms the clearinghouse.',
  13: 'Joe in Medical Records — a duplicate that shouldn\'t exist.',
  14: 'Adaeze in Radiology — implant carve-out went sideways.',
  15: 'Dr. Park in the Main Hub — a credentialing gap.',
  16: 'Dr. Ethan\'s in the parking lot — two bills for one ER visit. Take the lobby EXIT.',
  17: 'Pat in HIM. AMA CPT licensing question.',
  18: 'Sam in Patient Services. The reaper has surfaced.',
  19: 'Yvette\'s at the PFS window — a surprise bill the patient never saw coming.',
  20: 'Liana in the Cancer Center — a 340B rate clawback.',
  21: 'Marisol in Medical Records — an identity-matching collision.',
  22: 'Dr. Priya\'s in the parking lot — HCC capture review. Take the lobby EXIT.',
  23: 'Dr. Ethan in the Lecture Hall — chemo bundle short-paid.',
  24: 'Dr. Park in HIM — two-midnight inpatient vs observation.',
  25: 'Alex in Billing. CO-45 underpayment streak.',
  26: 'Kim at Registration. Multi-payer COB cascade.',
  27: 'Diane in the Payer office — case-rate vs per-diem mismatch.',
  28: 'Theresa\'s in the parking lot — mapping a payer\'s MRF. Take the lobby EXIT.',
  29: 'Sam in Patient Services. An IDR submission.',
  30: 'Dr. Priya\'s in the Auditorium — OB per-diem with a C-section escalator. Take the lobby EAST door.',
  31: 'Theo (compliance) — a faxed PHI page went to the wrong number.',
  32: 'Dana\'s at the head of the table in the 2F Audit room. The auditors have arrived.',
}
