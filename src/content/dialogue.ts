import type { DialogueNode } from '../types'

// =====================================================================
// TABLE OF CONTENTS — grep for any tag to jump:
//
//   ## DEFAULT_NPC_INTROS    — One-shot intro line per case-handler NPC
//                              (Dana, Kim, Martinez, Jordan, Pat, Alex,
//                              Sam). Used when nothing more specific is
//                              wired via LEVEL_NPC_DIALOGUES.
//   ## ANJALI_L1             — Anjali's L1 intro tree + post-thanks.
//   ## LEVEL_INTAKES         — Per-level case-handoff dialogues for the
//                              12 in-game playable cases. Keys follow
//                              `<npc>_l<N>_intake` for the legacy 10-
//                              level shape and `<npc>_<case>_intake`
//                              for the 33-level catalog adds.
//   ## L10_AUDIT_TEAM        — Atmosphere lines for the four auditors
//                              (one-shot, no case handoff).
//   ## AMBIENT_NPCS          — One-line scenery dialogues (Liana,
//                              Marisol, Walter, Greta, Joe, etc.).
//   ## SANDBOX_AND_LOUNGE    — Data Sandbox crew (Chansoo, Monika, Nick,
//                              Nicole) + Turquoise Lounge (Chris, Adam).
//   ## CATALOG_INTAKES       — The 21 catalog-case intake dialogues
//                              added during the 33-level migration.
//   ## LEVEL_NPC_DIALOGUES   — Per-level override map at the bottom of
//                              the file. Routes each level's case
//                              handoff to the right intake tree.
// =====================================================================

export const DIALOGUES: Record<string, DialogueNode> = {
  // ## DEFAULT_NPC_INTROS ##
  // === Dana — your mentor, Level 1 orientation ===
  dana_intro: {
    id: 'dana_intro',
    speaker: 'Dana',
    text: "Oh — Chloe, right? The part-time intern. Sorry, I'm slammed. Stick around the lobby; if anything weird comes up, flag me.",
    next: 'dana_intro_2',
  },
  dana_intro_2: {
    id: 'dana_intro_2',
    speaker: 'Dana',
    text: 'Every denied claim is money the hospital earned but never collected. Your job is to figure out why — and fix it upstream.',
    next: 'dana_intro_3',
  },
  dana_intro_3: {
    id: 'dana_intro_3',
    speaker: 'Dana',
    text: "A claim just vanished from the system. No 835, no rejection, just... gone. That shouldn't happen.",
    choices: [
      { text: 'Where do lost claims go?', next: 'dana_waiting_room' },
      { text: 'Can we just resubmit it?', next: 'dana_resubmit' },
    ],
  },
  dana_waiting_room: {
    id: 'dana_waiting_room',
    speaker: 'Dana',
    text: "That's what we need to find out. Check with Kim at registration first — most problems start at the front door.",
    choices: [
      { text: 'Got it.', effect: { unlockCodex: 'denial_rate' } },
    ],
  },
  dana_resubmit: {
    id: 'dana_resubmit',
    speaker: 'Dana',
    text: "Without understanding why it vanished? That's how you get duplicate claims and audit flags. Start at the source — talk to Kim at registration.",
    choices: [
      { text: 'Fair point.', effect: { unlockCodex: 'denial_rate' } },
    ],
  },

  // === Kim — registration ===
  kim_intro: {
    id: 'kim_intro',
    speaker: 'Kim',
    text: "Registration desk. We check insurance cards and enter demographics. Sounds simple, right?",
    next: 'kim_intro_2',
  },
  kim_intro_2: {
    id: 'kim_intro_2',
    speaker: 'Kim',
    text: "It's not. Patients bring expired cards, wrong member IDs, and sometimes no card at all. And we have 3 minutes per check-in.",
    choices: [
      { text: "What happens if info is wrong?", next: 'kim_wrong_info' },
      { text: "Can you verify electronically?", next: 'kim_verify' },
    ],
  },
  kim_wrong_info: {
    id: 'kim_wrong_info',
    speaker: 'Kim',
    text: "Claim goes to the wrong payer. Denied. CO-109. Patient gets a surprise bill. Everybody loses.",
    choices: [
      { text: "I'll go check the system. The Waiting Room queue is full of these.", effect: { unlockCodex: 'co_109' } },
    ],
  },
  kim_verify: {
    id: 'kim_verify',
    speaker: 'Kim',
    text: "A 270 eligibility check. Takes seconds. But the system was down last Tuesday so we keyed it manually. That's when errors happen.",
    choices: [
      { text: "I'll look at the queue downstairs.", effect: { unlockCodex: 'x12_270_271' } },
    ],
  },

  // === Dr. Martinez — documentation ===
  martinez_intro: {
    id: 'martinez_intro',
    speaker: 'Dr. Martinez',
    text: "The documentation says what I did. I've been writing that note for twelve years. Now it needs seventeen more characters or the claim bounces?",
    next: 'martinez_intro_2',
  },
  martinez_intro_2: {
    id: 'martinez_intro_2',
    speaker: 'Dr. Martinez',
    text: "I'm not wrong about the clinical picture. So tell me exactly where the problem is.",
    choices: [
      { text: "The payer says the diagnosis doesn't support the procedure.", next: 'martinez_denial' },
      { text: "The codes need to match the clinical picture exactly — ICD-10 specificity matters.", next: 'martinez_codes' },
    ],
  },
  martinez_denial: {
    id: 'martinez_denial',
    speaker: 'Dr. Martinez',
    text: "Which diagnosis? I coded what was in the room. If they want more specificity, that's a CDI conversation — not a clinical mistake.",
    choices: [
      { text: "A CDI query can bridge the gap. I'll work it.", effect: { unlockCodex: 'cdi' } },
    ],
  },
  martinez_codes: {
    id: 'martinez_codes',
    speaker: 'Dr. Martinez',
    text: "Fine. What does the note need to say that it doesn't already say? And for the record — the clinical picture was clear.",
    choices: [
      { text: "Exactly. Let me pull up the CDI queue.", effect: { unlockCodex: 'icd10_cm' } },
    ],
  },

  // === Jordan — patient financial services ===
  jordan_intro: {
    id: 'jordan_intro',
    speaker: 'Jordan',
    text: "A patient just called crying. Her insurance denied the procedure and now she owes $14,000.",
    next: 'jordan_intro_2',
  },
  jordan_intro_2: {
    id: 'jordan_intro_2',
    speaker: 'Jordan',
    text: "It's a benefit exclusion — PR-204. An appeal can't create a benefit the plan excludes. The fix was earlier: estimate before the visit.",
    choices: [
      { text: "Could we have caught this earlier?", next: 'jordan_earlier' },
      { text: "What do we tell the patient?", next: 'jordan_patient' },
    ],
  },
  jordan_earlier: {
    id: 'jordan_earlier',
    speaker: 'Jordan',
    text: "A cost estimate before the visit. Run the 270, check the benefits, and tell the patient what they'll owe BEFORE the procedure.",
    choices: [
      { text: "I'll see what I can do downstairs.", effect: { unlockCodex: 'cost_share' } },
    ],
  },
  jordan_patient: {
    id: 'jordan_patient',
    speaker: 'Jordan',
    text: "The truth. That their plan doesn't cover it. And that we should have told them before the visit, not after.",
    choices: [
      { text: "Got it. Cost estimates upstream — noted.", effect: { unlockCodex: 'cost_share' } },
    ],
  },

  // === Pat — coding ===
  pat_intro: {
    id: 'pat_intro',
    speaker: 'Pat',
    text: "Two procedures billed separately, payer bundled them. CO-97. Classic.",
    next: 'pat_intro_2',
  },
  pat_intro_2: {
    id: 'pat_intro_2',
    speaker: 'Pat',
    text: "The surgeon did two distinct things. But without modifier 59, the payer sees one.",
    choices: [
      { text: "Could a claim scrubber have caught that?", next: 'pat_scrubber' },
      { text: "Is the payer right to bundle them?", next: 'pat_bundle' },
    ],
  },
  pat_scrubber: {
    id: 'pat_scrubber',
    speaker: 'Pat',
    text: "Absolutely. CCI edits are public. A good scrubber flags this before the claim ever drops.",
    choices: [
      { text: "Let me prep the claim before you fight it.", effect: { triggerForm: 'case_bundle_kim', unlockCodex: 'modifiers' } },
    ],
  },
  pat_bundle: {
    id: 'pat_bundle',
    speaker: 'Pat',
    text: "Sometimes yes. The CCI edits say which codes are bundled. But when they're truly separate, we need to document and modify.",
    choices: [
      { text: "Walk me through fixing the claim form first.", effect: { triggerForm: 'case_bundle_kim', unlockCodex: 'modifiers' } },
    ],
  },

  // === Alex — IT/EDI ===
  alex_intro: {
    id: 'alex_intro',
    speaker: 'Alex',
    text: "The clearinghouse rejected 47 claims overnight. 277CA — front-end rejects.",
    next: 'alex_intro_2',
  },
  alex_intro_2: {
    id: 'alex_intro_2',
    speaker: 'Alex',
    text: "These never even reached the payer. Missing taxonomy code in loop 2310B.",
    choices: [
      { text: "Is that our fault or the vendor's?", next: 'alex_fault' },
      { text: "How do we fix 47 claims?", next: 'alex_fix' },
    ],
  },
  alex_fault: {
    id: 'alex_fault',
    speaker: 'Alex',
    text: "Could be either. The PM system generates the 837. But the clearinghouse validates it. Either way, it's our revenue stuck in limbo.",
    choices: [
      { text: "I'll go work the queue.", effect: { unlockCodex: 'x12_837' } },
    ],
  },
  alex_fix: {
    id: 'alex_fix',
    speaker: 'Alex',
    text: "Fix the mapping, run them through the scrubber again, and resubmit. The good news? Front-end rejects are fast to fix. The bad news? They shouldn't happen at all.",
    choices: [
      { text: "Got it. I'll head down to clear them.", effect: { unlockCodex: 'x12_277ca' } },
    ],
  },

  // === Sam — denials management ===
  sam_intro: {
    id: 'sam_intro',
    speaker: 'Sam',
    text: "I have 200 appeals in my queue. Each one takes 45 minutes. You do the math.",
    next: 'sam_intro_2',
  },
  sam_intro_2: {
    id: 'sam_intro_2',
    speaker: 'Sam',
    text: "Half of these are CO-50 — medical necessity. The documentation was fine clinically but didn't meet the payer's policy criteria.",
    choices: [
      { text: "Can we win on appeal?", next: 'sam_appeal' },
      { text: "Can we prevent these upstream?", next: 'sam_prevent' },
      { text: "What about timely filing?", next: 'sam_timely' },
    ],
  },
  sam_timely: {
    id: 'sam_timely',
    speaker: 'Sam',
    text: "Worst feeling in this job. The claim is meritorious, the documentation is perfect, and you missed the contractual deadline by three days. Without proof of timely filing, there may be no appeal left. Watch the clock — that's the work.",
    choices: [
      { text: "I'll watch for one in the queue.", effect: { unlockCodex: 'co_29_reaper' } },
    ],
  },
  sam_appeal: {
    id: 'sam_appeal',
    speaker: 'Sam',
    text: "Sometimes. But an appeal costs time and money. The real win is CDI before the claim drops — fix the documentation while the patient is still in the building.",
    choices: [
      { text: "I'll go find one in the queue.", effect: { unlockCodex: 'medical_necessity' } },
    ],
  },
  sam_prevent: {
    id: 'sam_prevent',
    speaker: 'Sam',
    text: "Now you're thinking like an analyst. CDI queries, payer policy lookups, prior auth checks — all upstream. That's where you win.",
    choices: [
      { text: "I'll head down and try one.", effect: { unlockCodex: 'medical_necessity' } },
    ],
  },

  // ## ANJALI_L1 ##
  // === Anjali — Level 1 intro patient. The wrong-card case. ===
  // The intern is part-time, undertrained, not supposed to help patients
  // directly. She does anyway — the patient looks like she's been
  // waiting forever.
  anjali_intro: {
    id: 'anjali_intro',
    speaker: 'Anjali',
    text: "Sorry to bother you. They told me someone here could check whether I was approved.",
    next: 'anjali_intro_2',
  },
  anjali_intro_2: {
    id: 'anjali_intro_2',
    speaker: 'Anjali',
    text: "I had strep last week. They said my insurance was accepted at check-in. Now there's a bill for $387 saying I'm not on the plan.",
    next: 'anjali_intro_3',
  },
  anjali_intro_3: {
    id: 'anjali_intro_3',
    speaker: 'Anjali',
    text: "I have the same Aetna PPO as my husband. I've had it for years. I really don't think this is right.",
    choices: [
      { text: "(I'm not supposed to do this.)", next: 'anjali_hesitate' },
      { text: "Let me pull up your file.", next: 'anjali_pull_file' },
    ],
  },
  anjali_hesitate: {
    id: 'anjali_hesitate',
    speaker: 'Chloe',
    text: "Part-time interns don't help patients directly. You're supposed to flag this to a supervisor — but it's late, and there's no supervisor here. And she looks like she's been waiting forever.",
    choices: [
      { text: "Let me pull up your file.", next: 'anjali_pull_file' },
    ],
  },
  anjali_pull_file: {
    id: 'anjali_pull_file',
    speaker: 'Anjali',
    text: "Thank you. I — I just want to figure this out.",
    choices: [
      {
        text: "(Sit down at your desk and open the claim.)",
        effect: { triggerDescent: { encounterId: 'intro_wrong_card' } },
      },
    ],
  },

  // === Anjali — after the intro case is solved. Auto-launched on
  //     return to Hospital. ===
  anjali_thanks: {
    id: 'anjali_thanks',
    speaker: 'Anjali',
    text: "Wait — that's it? It's fixed?",
    next: 'anjali_thanks_2',
  },
  anjali_thanks_2: {
    id: 'anjali_thanks_2',
    speaker: 'Anjali',
    text: "I had my husband's card on me by accident. Of course I did. Thank you, Chloe. Really.",
    choices: [
      { text: "(You're not entirely sure what just happened either.)", next: 'anjali_thanks_3' },
      { text: "Glad I could help.", next: 'anjali_thanks_3' },
    ],
  },
  anjali_thanks_3: {
    id: 'anjali_thanks_3',
    speaker: 'Anjali',
    text: "I'm going to go home and sleep for a week. Thanks again.",
    choices: [
      { text: "Take care.", effect: { unlockCodex: 'co_31' } },
    ],
  },

  // ## LEVEL_INTAKES ##
  // === Level 2 — Kim hands off the eligibility-fog case ===
  kim_l2_intake: {
    id: 'kim_l2_intake',
    speaker: 'Kim',
    text: "Chloe — you're back. Word travels. Listen, I need a hand. The 270 we sent on Mai Nguyen this morning came back fogged. Half the fields blanked, no clear reason.",
    next: 'kim_l2_intake_2',
  },
  kim_l2_intake_2: {
    id: 'kim_l2_intake_2',
    speaker: 'Kim',
    text: "If we file without verifying her plan, that claim ends up in the Waiting Room with the rest of the half-answered ones. Want to take a look?",
    choices: [
      { text: '(Sit down at the workstation and pull her file.)',
        effect: { triggerDescent: { encounterId: 'eligibility_fog' } } },
      { text: "Maybe later.", next: 'kim_l2_intake_back' },
    ],
  },
  kim_l2_intake_back: {
    id: 'kim_l2_intake_back',
    speaker: 'Kim',
    text: "Fair. It'll still be here. They always are.",
    choices: [{ text: '(Step away.)' }],
  },

  // === Level 3 — Sam (Denials) hands off the prior-auth gatekeeper ===
  sam_l3_intake: {
    id: 'sam_l3_intake',
    speaker: 'Sam',
    text: "There's a UHC denial on Adaeze Okafor — MRI lumbar, CO-197. No 278 on file. Pre-cert team swears they got verbal sign-off. Nobody wrote down the auth number.",
    next: 'sam_l3_intake_2',
  },
  sam_l3_intake_2: {
    id: 'sam_l3_intake_2',
    speaker: 'Sam',
    text: "If you can dig the auth out of the payer's UM portal and re-file with it, we recover. Otherwise it dies in appeals. Want to take it?",
    choices: [
      { text: '(Open the case.)',
        effect: { triggerDescent: { encounterId: 'co_197' } } },
      { text: 'Not yet.', next: 'sam_l3_intake_back' },
    ],
  },
  sam_l3_intake_back: {
    id: 'sam_l3_intake_back',
    speaker: 'Sam',
    text: "Take your time. The appeal clock is only ninety days.",
    choices: [{ text: '(Step away.)' }],
  },

  // === Level 5 — Dr. Martinez hands off the prior-auth gatekeeper ===
  martinez_gatekeeper_intake: {
    id: 'martinez_gatekeeper_intake',
    speaker: 'Dr. Martinez',
    text: "Adaeze Okafor's lumbar MRI came back CO-197. I remember the payer giving verbal sign-off. What I don't have is the authorization number.",
    next: 'martinez_gatekeeper_intake_2',
  },
  martinez_gatekeeper_intake_2: {
    id: 'martinez_gatekeeper_intake_2',
    speaker: 'Dr. Martinez',
    text: "If you can pull the auth out of the payer's UM portal and re-file with it, the MRI survives. If not, appeals gets another corpse.",
    choices: [
      { text: '(Open the case.)',
        effect: { triggerDescent: { encounterId: 'co_197' } } },
      { text: 'Not yet.', next: 'martinez_gatekeeper_intake_back' },
    ],
  },
  martinez_gatekeeper_intake_back: {
    id: 'martinez_gatekeeper_intake_back',
    speaker: 'Dr. Martinez',
    text: "I'll be here. The authorization number is somewhere in that portal maze.",
    choices: [{ text: '(Step away.)' }],
  },

  // === Level 4 — Pat (Coding) hands off the bundling beast ===
  pat_l4_intake: {
    id: 'pat_l4_intake',
    speaker: 'Pat',
    text: "Got a CO-97 on Sarah Kim's chart. E&M and a procedure same day, NCCI bundled them. The visit was significant and separate — modifier 25 just never made it on.",
    next: 'pat_l4_intake_2',
  },
  pat_l4_intake_2: {
    id: 'pat_l4_intake_2',
    speaker: 'Pat',
    text: "Quick fix if you know where to put it. Care to give it a swing?",
    // Three branches gated on chart state:
    //  - chart not yet pulled: "I'll grab the op-note first" + decline
    //  - chart pulled: descend immediately
    // The chart-pull is a tile interaction inside Medical Records — the
    // single lit drawer (ACTIVE_CHART_CABINET); see HospitalScene.tryChartPull.
    choices: [
      { text: '(Pull the op-note first.)',
        next: 'pat_l4_chart_hint',
        effect: { markChartHinted: 'co_97' },
        condition: { chartNotPulled: 'co_97' } },
      { text: '(Sit down and code it.)',
        effect: { triggerDescent: { encounterId: 'co_97' } },
        condition: { chartPulled: 'co_97' } },
      { text: 'In a bit.', next: 'pat_l4_intake_back' },
    ],
  },
  pat_l4_chart_hint: {
    id: 'pat_l4_chart_hint',
    speaker: 'Pat',
    text: "Right. Op-note's in Medical Records — east wing. Look for the lit drawer, press E to slide it open and grab the chart. Won't make sense without it.",
    choices: [{ text: '(Step away.)' }],
  },
  pat_l4_intake_back: {
    id: 'pat_l4_intake_back',
    speaker: 'Pat',
    text: "Bundle's not going anywhere. It's bundled.",
    choices: [{ text: '(Step away.)' }],
  },

  // === Level 5 — Sam hands off the medical-necessity wraith ===
  sam_l5_intake: {
    id: 'sam_l5_intake',
    speaker: 'Diane',
    text: "CO-50 on Walker. TTE for unspecified heart failure. Payer wants LCD evidence of LVEF under 35%. Echo report exists; it's just not stapled to the claim.",
    next: 'sam_l5_intake_2',
  },
  sam_l5_intake_2: {
    id: 'sam_l5_intake_2',
    speaker: 'Diane',
    text: "Wraiths feed on missing pages. Bring the evidence and it dissolves. Try?",
    // Same chart-gating pattern as Pat L4: descent only available
    // after the player has pulled Walker's echo from Medical Records.
    choices: [
      { text: '(Get the echo report from Records first.)',
        next: 'sam_l5_chart_hint',
        effect: { markChartHinted: 'co_50' },
        condition: { chartNotPulled: 'co_50' } },
      { text: '(Bring the echo to the wraith.)',
        effect: { triggerDescent: { encounterId: 'co_50' } },
        condition: { chartPulled: 'co_50' } },
      { text: 'Later.', next: 'sam_l5_intake_back' },
    ],
  },
  sam_l5_chart_hint: {
    id: 'sam_l5_chart_hint',
    speaker: 'Diane',
    text: "Walker. Echo dated 09/14. Medical Records — east wing — bottom shelf. Without the LVEF the LCD doesn't apply. Don't go down empty-handed.",
    choices: [{ text: '(Step away.)' }],
  },
  sam_l5_intake_back: {
    id: 'sam_l5_intake_back',
    speaker: 'Diane',
    text: "It only gets harder to read once it's been a week.",
    choices: [{ text: '(Step away.)' }],
  },

  // === Level 6 — Alex (IT/EDI) hands off the documentation-sprite swarm ===
  alex_l6_intake: {
    id: 'alex_l6_intake',
    speaker: 'Roni',
    text: "Yamada batch. 277CA rejects piling up — taxonomy missing on the rendering provider, and a dx pointer that points to nothing. We can scrub each reject one at a time, but they're regenerating faster than we sweep them.",
    next: 'alex_l6_intake_2',
  },
  alex_l6_intake_2: {
    id: 'alex_l6_intake_2',
    speaker: 'Roni',
    text: "Trace the source upstream. Patch the chart, and the swarm starves.",
    choices: [
      { text: '(Trace the swarm.)',
        effect: { triggerDescent: { encounterId: 'co_16_swarm' } } },
      { text: 'Hold on.', next: 'alex_l6_intake_back' },
    ],
  },
  alex_l6_intake_back: {
    id: 'alex_l6_intake_back',
    speaker: 'Roni',
    text: "Sure. They multiply quietly until they don't.",
    choices: [{ text: '(Step away.)' }],
  },

  // === Level 7 — Sam hands off the duplicate-claim reaper ===
  sam_l7_intake: {
    id: 'sam_l7_intake',
    speaker: 'Sam',
    text: "Park got a CO-29 on the 835 — duplicate claim. The provider hand-keyed a corrected version while a frequency-1 was still adjudicating. Now both look like duplicates to the payer.",
    next: 'sam_l7_intake_2',
  },
  sam_l7_intake_2: {
    id: 'sam_l7_intake_2',
    speaker: 'Sam',
    text: "Fix is a frequency-7 with the right ICN. Sounds easy. Isn't. Open the ERA and follow the duplicate trail.",
    choices: [
      { text: '(Open the ERA.)',
        effect: { triggerDescent: { encounterId: 'co_29_reaper' } } },
      { text: 'Soon.', next: 'sam_l7_intake_back' },
    ],
  },
  sam_l7_intake_back: {
    id: 'sam_l7_intake_back',
    speaker: 'Sam',
    text: "Reaper's patient. Reaper waits.",
    choices: [{ text: '(Step away.)' }],
  },

  // === Level 8 — Jordan (PFS) hands off the surprise-bill specter ===
  jordan_l8_intake: {
    id: 'jordan_l8_intake',
    speaker: 'Yvette',
    text: "Patient on the line — surprise bill from an out-of-network anesthesiologist. The procedure was at an in-network facility. NSA applies. Provider's billing it like it doesn't.",
    next: 'jordan_l8_intake_2',
  },
  jordan_l8_intake_2: {
    id: 'jordan_l8_intake_2',
    speaker: 'Yvette',
    text: "I need someone to document the protections and push the IDR side before the bill hardens.",
    choices: [
      { text: '(Take the case.)',
        effect: { triggerDescent: { encounterId: 'surprise_bill_specter' } } },
      { text: 'Give me a minute.', next: 'jordan_l8_intake_back' },
    ],
  },
  jordan_l8_intake_back: {
    id: 'jordan_l8_intake_back',
    speaker: 'Yvette',
    text: "She's still on hold. She's been on hold a while.",
    choices: [{ text: '(Step away.)' }],
  },

  // === Level 9 — Kim hands off the duplicate-claim doppelgänger.
  //     (Was the COB hydra; hydra moved to prototype-only catalog.) ===
  kim_l9_intake: {
    id: 'kim_l9_intake',
    speaker: 'Joe',
    text: "Two claims for Reyes — same DOS, same CPT, same everything — and they're both denying CO-18. Someone resubmitted instead of replacing.",
    next: 'kim_l9_intake_2',
  },
  kim_l9_intake_2: {
    id: 'kim_l9_intake_2',
    speaker: 'Joe',
    text: "I've got the original ICN. Box 22 frequency 7 references it and the duplicate folds back in. Want to take it?",
    choices: [
      { text: '(Open the duplicate.)',
        effect: { triggerDescent: { encounterId: 'co_18_doppelganger' } } },
      { text: 'Hold up.', next: 'kim_l9_intake_back' },
    ],
  },
  kim_l9_intake_back: {
    id: 'kim_l9_intake_back',
    speaker: 'Joe',
    text: "It'll keep. They always do.",
    choices: [{ text: '(Step away.)' }],
  },

  // === Level 10 — Dana hands off the audit boss ===
  dana_l10_intake: {
    id: 'dana_l10_intake',
    speaker: 'Dana',
    text: "Auditors are in the conference room. They've got every claim you've touched in the last ninety days printed out, sorted by payer.",
    next: 'dana_l10_intake_2',
  },
  dana_l10_intake_2: {
    id: 'dana_l10_intake_2',
    speaker: 'Dana',
    text: "Documentation, modifiers, medical necessity, the whole stack. They'll ask, and your answers go on the record. You ready?",
    choices: [
      { text: '(Walk into the conference room.)',
        effect: { triggerDescent: { encounterId: 'boss_audit' } } },
      { text: 'Give me a minute.', next: 'dana_l10_intake_back' },
    ],
  },
  // ## L10_AUDIT_TEAM ##
  // === L10 audit team — atmosphere NPCs. Each speaks one line and
  //     ends. They don't hand off cases (that's Dana's job); they're
  //     here to make the conference room feel like a deposition. ===
  auditor_carl_intro: {
    id: 'auditor_carl_intro',
    speaker: 'Carl Westbrook — Senior Partner',
    text: "We've blocked off four hours for this. We'll need them.",
  },
  auditor_chen_intro: {
    id: 'auditor_chen_intro',
    speaker: 'Wendy Chen — Data Analytics',
    text: "Your CMI variance is in the 96th percentile. That's not a compliment.",
  },
  auditor_rivera_intro: {
    id: 'auditor_rivera_intro',
    speaker: 'Mira Rivera — Compliance',
    text: "We're not here to teach. We're here to find.",
  },
  auditor_eddi_intro: {
    id: 'auditor_eddi_intro',
    speaker: 'Eddi — Observer',
    text: "...",
  },

  // ## AMBIENT_NPCS ##
  // === Ambient populace — one-line atmospheric exchanges. None hand
  //     off cases. Terminal nodes (no `next`, no `choices`) — the
  //     dialogue scene shows them with a click-to-close prompt. ===
  liana_intro: {
    id: 'liana_intro',
    speaker: 'Liana',
    text: "Pharmacy ran the prior auth twice. Both came back 'in process.' That's not a status. That's a holding pattern.",
  },
  dr_priya_intro: {
    id: 'dr_priya_intro',
    speaker: 'Dr. Priya',
    text: "Tell coding the bowel obstruction was complete. Not partial. Different DRG.",
  },
  dev_intro: {
    id: 'dev_intro',
    speaker: 'Dev',
    text: "Bed B is in the hallway because someone said C was contaminated. Nobody charted it.",
  },
  walter_intro: {
    id: 'walter_intro',
    speaker: 'Walter',
    text: "Two hours. They said one. I'm not in a hurry. I just want to know.",
    next: 'walter_intro_2',
  },
  walter_intro_2: {
    id: 'walter_intro_2',
    speaker: 'Walter',
    text: "I had a procedure here in '92. Same lobby. Same chair, I think. They moved the magazine rack.",
    next: 'walter_intro_3',
  },
  walter_intro_3: {
    id: 'walter_intro_3',
    speaker: 'Walter',
    text: "Catch-22. If they call my name and I'm gone, they call the next one. If I'm here when they call mine, I'll have missed it daydreaming. So I sit very still and try not to think about anything important.",
  },
  dr_ethan_intro: {
    id: 'dr_ethan_intro',
    speaker: 'Dr. Ethan',
    text: "Discharge summary's on me. Don't bill until it's signed.",
  },
  officer_reyes_intro: {
    id: 'officer_reyes_intro',
    speaker: 'Officer Reyes',
    text: "You new? You walk like you know where you're going. Most of them don't.",
    next: 'officer_reyes_intro_2',
  },
  officer_reyes_intro_2: {
    id: 'officer_reyes_intro_2',
    speaker: 'Officer Reyes',
    text: "Forty hours a week, the most exciting thing I see is a man try to push the door that pulls. They don't make it three inches before they stop and read the sign. Every time.",
    next: 'officer_reyes_intro_3',
  },
  officer_reyes_intro_3: {
    id: 'officer_reyes_intro_3',
    speaker: 'Officer Reyes',
    text: "I keep a notebook. Not for anything. Just to look like I'm doing a thing that matters. Saved me from a department review once. Whatever's in the notebook, whatever I'm writing — they assume it's important.",
  },
  joe_intro: {
    id: 'joe_intro',
    speaker: 'Joe',
    text: "Dust on these binders is older than the binders. Records doesn't throw anything out. Can't.",
    next: 'joe_intro_2',
  },
  joe_intro_2: {
    id: 'joe_intro_2',
    speaker: 'Joe',
    text: "Started here in '04. Floor's the same. Walls have been beige, then sage, then beige again. Painters don't even pretend it's a different color anymore.",
    next: 'joe_intro_3',
  },
  joe_intro_3: {
    id: 'joe_intro_3',
    speaker: 'Joe',
    text: "I find a thumb drive in a recycling bin twice a year. Two of them are private. One's a wedding video. Same wedding both times.",
  },
  noah_intro: {
    id: 'noah_intro',
    speaker: 'Noah',
    text: "Radiology. I know it's near the cafeteria. I keep ending up at the cafeteria.",
    next: 'noah_intro_2',
  },
  noah_intro_2: {
    id: 'noah_intro_2',
    speaker: 'Noah',
    text: "Brought my mom for the MRI an hour ago. Got coffee. Came back. The hallway's not the same hallway. I think they rotate the wings on Wednesdays.",
    next: 'noah_intro_3',
  },
  noah_intro_3: {
    id: 'noah_intro_3',
    speaker: 'Noah',
    text: "If you see a small woman in a red coat — that's her. Tell her I'm fine. I'm having the meatloaf again.",
  },

  // Round 2 ambient — east wing, 2F, outdoor.
  rad_tech_intro: {
    id: 'rad_tech_intro',
    speaker: 'Adaeze',
    text: "Echo, MRI, two CTs since seven. Half are stat. The other half think they're stat.",
    next: 'rad_tech_intro_2',
  },
  rad_tech_intro_2: {
    id: 'rad_tech_intro_2',
    speaker: 'Adaeze',
    text: "The ER doc and the floor nurse will both swear theirs is the priority. They're both right and both wrong. The scanner doesn't care. The scanner is honest. The scanner is the most honest person in this hospital.",
  },
  records_clerk_intro: {
    id: 'records_clerk_intro',
    speaker: 'Marisol',
    text: "Whatever you're looking for is here. Whether you find it depends on what year it lived in.",
    next: 'records_clerk_intro_2',
  },
  records_clerk_intro_2: {
    id: 'records_clerk_intro_2',
    speaker: 'Marisol',
    text: "We migrated to electronic in '07. Migrated again in '14. The third migration is theoretical. There's a champion. They have a deck. The deck is from 2019.",
    next: 'records_clerk_intro_3',
  },
  records_clerk_intro_3: {
    id: 'records_clerk_intro_3',
    speaker: 'Marisol',
    text: "I knew a chart once that had four versions of the same op note. None of them said the same thing. The patient's still alive, far as I know. We send a card every December and nothing comes back.",
  },
  payer_rep_intro: {
    id: 'payer_rep_intro',
    speaker: 'Theresa',
    text: "I'm contracted to be onsite three days a week. Tuesday I do nothing but call my own auto-attendant on speakerphone.",
    next: 'payer_rep_intro_2',
  },
  payer_rep_intro_2: {
    id: 'payer_rep_intro_2',
    speaker: 'Theresa',
    text: "Press one for claims. Press two for eligibility. Press three to leave a message that gets reviewed in six to eight weeks. I press three. I leave nothing. Six weeks later I get a denial letter for a question I didn't ask.",
    next: 'payer_rep_intro_3',
  },
  payer_rep_intro_3: {
    id: 'payer_rep_intro_3',
    speaker: 'Theresa',
    text: "We call it a closed-loop system. Internally we call it the wail. Don't put that in the meeting notes.",
  },
  payer_supervisor_intro: {
    id: 'payer_supervisor_intro',
    speaker: 'Diane',
    text: "The medical policy hasn't changed. Your interpretation of it has.",
  },
  compliance_officer_intro: {
    id: 'compliance_officer_intro',
    speaker: 'Theo',
    text: "Don't say 'breach' until I've finished the four-factor assessment. The word does work on its own.",
  },
  smoker_visitor_intro: {
    id: 'smoker_visitor_intro',
    speaker: 'Earl',
    text: "Stepped out for one. Came back, room's empty, sheets stripped. They don't tell you anything if you're not in the room.",
  },

  // Round 3 ambient — smokers (outdoor-only), paramedic, lobby visitors.
  smoker_outdoor_b_intro: {
    id: 'smoker_outdoor_b_intro',
    speaker: 'Sandra',
    text: "I quit twice. Last time stuck three years. Then payroll switched the schedule and here I am.",
    next: 'smoker_outdoor_b_intro_2',
  },
  smoker_outdoor_b_intro_2: {
    id: 'smoker_outdoor_b_intro_2',
    speaker: 'Sandra',
    text: "I'm calling it the maintenance dose. My doctor says that's not how nicotine works. My doctor smokes. We disagree about a lot.",
  },
  paramedic_intro: {
    id: 'paramedic_intro',
    speaker: 'Cassie',
    text: "Transfer from West Coast. They paged ahead, but the bed's still showing dirty. I'll wait.",
  },
  flower_visitor_intro: {
    id: 'flower_visitor_intro',
    speaker: 'Greta',
    text: "Lilies again. She always says they're fine. She knows I know they're not her favorite.",
    next: 'flower_visitor_intro_2',
  },
  flower_visitor_intro_2: {
    id: 'flower_visitor_intro_2',
    speaker: 'Greta',
    text: "Forty-two years married. I know what her favorite is. I stopped buying it because once she said 'they're fine' and meant it. So now I bring lilies. Spite. After forty-two years, you call it spite, you laugh about it, you keep doing it.",
    next: 'flower_visitor_intro_3',
  },
  flower_visitor_intro_3: {
    id: 'flower_visitor_intro_3',
    speaker: 'Greta',
    text: "She's recovering well. The doctor said. She told me. I'll see for myself in eight minutes when visiting hours start. Then we'll fight about the lilies. It's the best part of my week, honestly.",
  },
  elder_patient_intro: {
    id: 'elder_patient_intro',
    speaker: 'Mr. Beck',
    text: "Sign says cardiology that way. Or it says cafeteria. Hard to tell. The arrow's at an angle.",
  },

  // Round 4 — cafeteria staff + a couple of pool back-fills.
  cafeteria_worker_intro: {
    id: 'cafeteria_worker_intro',
    speaker: 'Manny',
    text: "We had meatloaf today. We always have meatloaf today. They like the consistency.",
    next: 'cafeteria_worker_intro_2',
  },
  cafeteria_worker_intro_2: {
    id: 'cafeteria_worker_intro_2',
    speaker: 'Manny',
    text: "Recipe hasn't changed since '98. I changed the recipe in '02. Switched it back the next week. They knew. I never figured out how. Maybe a chef tasted it. Maybe a nurse. Maybe meatloaf has its own information network and I'm just a node.",
    next: 'cafeteria_worker_intro_3',
  },
  cafeteria_worker_intro_3: {
    id: 'cafeteria_worker_intro_3',
    speaker: 'Manny',
    text: "Don't ever ask what's in the binder. The binder is everything. The binder is meatloaf. Some questions you don't ask.",
  },
  cashier_intro: {
    id: 'cashier_intro',
    speaker: 'Yvette',
    text: "Visitor or staff? Doesn't matter, same price. I just like to know which line you cut.",
  },
  server_intro: {
    id: 'server_intro',
    speaker: 'Reggie',
    text: "Tray here, tray there. Don't sit at the corner table — leg's loose, swore I told them last week.",
    next: 'server_intro_2',
  },
  server_intro_2: {
    id: 'server_intro_2',
    speaker: 'Reggie',
    text: "Filed a work order in February. They sent a guy. The guy looked at it. Walked away. Filed another work order. We're now in a self-sustaining loop. Some philosopher could write a paper.",
  },
  bike_emt_intro: {
    id: 'bike_emt_intro',
    speaker: 'Chase',
    text: "Three miles in eight minutes. The rig was still on the freeway. They paid me less than the rig made waiting.",
    next: 'bike_emt_intro_2',
  },
  bike_emt_intro_2: {
    id: 'bike_emt_intro_2',
    speaker: 'Chase',
    text: "Got into bike EMS because the lecture said 'urban response time.' Last week I responded to a guy on the eighteenth floor. Stairs. With a defib on my back. The lecture didn't cover stairs. The lecture didn't cover the eighteenth floor. The lecture covered very little, in retrospect.",
  },
  dr_park_intro: {
    id: 'dr_park_intro',
    speaker: 'Dr. Park',
    text: "I rounded twenty-two patients before the auditor's email. I'm not reading it until the cafeteria runs out of coffee.",
    next: 'dr_park_intro_2',
  },
  dr_park_intro_2: {
    id: 'dr_park_intro_2',
    speaker: 'Dr. Park',
    text: "They want to know why I documented an ICU admit with no critical-care minutes. I documented it because the patient was dying. The minutes were used dying.",
    next: 'dr_park_intro_3',
  },
  dr_park_intro_3: {
    id: 'dr_park_intro_3',
    speaker: 'Dr. Park',
    text: "I'm going to retire in six years. My wife says four. We're negotiating. The negotiation has been going for two years. Every year I say six and she says four. The math is starting to bother her.",
  },
  lab_tech_intro: {
    id: 'lab_tech_intro',
    speaker: 'Roni',
    text: "Modifier 91 on the second draw, modifier 59 on the urinalysis. They keep coming back NCCI-bundled because nobody copy-pastes the right modifier.",
    next: 'lab_tech_intro_2',
  },
  lab_tech_intro_2: {
    id: 'lab_tech_intro_2',
    speaker: 'Roni',
    text: "I wrote a macro that adds the modifiers automatically. Compliance turned it off because the auditors flagged it as 'systematic modifier abuse.' Now I add them by hand. Same modifiers. Same audit risk. Less efficient. Compliant. The job became a tribute to the job.",
  },

  // SW-corridor blocker. Cal stands in the south-wing trough at L1-6
  // and politely will not move; disappears at L7 when the last room
  // behind him (lecture hall) finally unlocks.
  maintenance_worker_intro: {
    id: 'maintenance_worker_intro',
    speaker: 'Cal',
    text: "Sorry, sorry — back wing's torn up. Billing, the phones, the lab, the lecture hall. Wiring, mostly. Ceiling tiles came down on Tuesday. Couple weeks and you'll be walking through here like nothing happened.",
  },

  // ## SANDBOX_AND_LOUNGE ##
  // === Round 5 — Data Sandbox (R&D) + Turquoise Lounge ===
  chansoo_intro: {
    id: 'chansoo_intro',
    speaker: 'Chansoo',
    text: "Pulling the denial regression. Cleanest signal from the dirtiest data — every reason code is a different kind of lie.",
    next: 'chansoo_intro_2',
  },
  chansoo_intro_2: {
    id: 'chansoo_intro_2',
    speaker: 'Chansoo',
    text: "Built a whole game about this once. Educational. People kept asking why it was scary. I said: have you read a denial letter? It's a horror genre. The denial letter invented the cliffhanger.",
    next: 'chansoo_intro_3',
  },
  chansoo_intro_3: {
    id: 'chansoo_intro_3',
    speaker: 'Chansoo',
    text: "If a model gets the right answer for the wrong reason, it's not the right answer. It's just expensive. Same goes for hospitals. Same goes for lunch.",
  },
  nicole_intro: {
    id: 'nicole_intro',
    speaker: 'Nicole',
    text: "Spinning up a sandbox env. One environment per region, one schema per payer, all provisioned through code.",
    next: 'nicole_intro_2',
  },
  nicole_intro_2: {
    id: 'nicole_intro_2',
    speaker: 'Nicole',
    text: "My job is reliability. Customers don't see the platform when it works — they see it when it doesn't. So if we're doing our jobs, you've never thought about me. If you have, somebody woke me up at 2 a.m.",
    next: 'nicole_intro_3',
  },
  nicole_intro_3: {
    id: 'nicole_intro_3',
    speaker: 'Nicole',
    text: "Thing I'm proudest of from last quarter: we ingested eight billion new rate rows and three new payer formats and the customer-facing UI never blinked. Reliability isn't loud. But it's how trust gets built.",
  },
  nick_intro: {
    id: 'nick_intro',
    speaker: 'Nick',
    text: "Price transparency PM. Five years ago this product category didn't exist. The federal rule shipped in 2021; we shipped our first version of the product a few months later.",
    next: 'nick_intro_2',
  },
  nick_intro_2: {
    id: 'nick_intro_2',
    speaker: 'Nick',
    text: "Half my job is translating. Hospitals and payers don't say 'I want a percentile breakdown of negotiated rates by CPT code.' They say 'I just want to know if I'm paying too much.' My job is to make the second question answerable with the first one.",
    next: 'nick_intro_3',
  },
  nick_intro_3: {
    id: 'nick_intro_3',
    speaker: 'Nick',
    text: "Best feature we shipped last year was a one-click 'show me the highest-leverage rate to renegotiate' button. CFOs use it. Procurement teams use it. First time I saw a hospital save real money from it, I went home early. Then I came back the next morning and started on the next one.",
  },
  monika_intro: {
    id: 'monika_intro',
    speaker: 'Monika',
    text: "Joining claim adjudications to remit codes. Two LEFT JOINs deep and still finding nulls where the patient should be.",
    next: 'monika_intro_2',
  },
  monika_intro_2: {
    id: 'monika_intro_2',
    speaker: 'Monika',
    text: "A NULL is supposed to mean 'unknown.' In this dataset it means 'someone didn't finish a sentence.' Sometimes a registrar missed a checkbox. Sometimes the patient declined to answer. Sometimes the row exists for an audit reason and was never supposed to be queried. I have to guess every time.",
    next: 'monika_intro_3',
  },
  monika_intro_3: {
    id: 'monika_intro_3',
    speaker: 'Monika',
    text: "That's the job, honestly — guessing accurately about why somebody didn't write something down. Sounds depressing on paper. Most days it's just interesting.",
  },
  chris_intro: {
    id: 'chris_intro',
    speaker: 'Chris',
    text: "We're at a genuinely weird moment. Data that didn't exist five years ago exists now. Questions nobody could answer are answerable. That doesn't happen often in any industry.",
    next: 'chris_intro_2',
  },
  chris_intro_2: {
    id: 'chris_intro_2',
    speaker: 'Chris',
    text: "The hard part isn't the data. It's the belief that it should exist at all. Every person here decided it should. That's actually the thing.",
    next: 'chris_intro_3',
  },
  chris_intro_3: {
    id: 'chris_intro_3',
    speaker: 'Chris',
    text: "I get asked if the timing is right. I think there's never been a better time. The infrastructure is here. The data is here. The will is here.",
    next: 'chris_intro_4',
  },
  chris_intro_4: {
    id: 'chris_intro_4',
    speaker: 'Chris',
    text: "We have a knack for turning skeptics into believers. I call it courageousoptimism — one word when you've lived it long enough.",
    next: 'chris_intro_5',
  },
  chris_intro_5: {
    id: 'chris_intro_5',
    speaker: 'Chris',
    text: "I love when you can feel something wiring up. The pieces exist separately, and then one week they start talking to each other. That's the moment.",
  },
  adam_intro: {
    id: 'adam_intro',
    speaker: 'Adam',
    text: "Seventy percent of our PRs have AI contribution now. Not because we mandated it — because the work actually moves faster. Stuff that wasn't getting built is getting built.",
    next: 'adam_intro_2',
  },
  adam_intro_2: {
    id: 'adam_intro_2',
    speaker: 'Adam',
    text: "There's a version of this data that answers questions nobody has been able to ask yet. We're building toward that version. Every quarter it gets a little more real.",
    next: 'adam_intro_3',
  },
  adam_intro_3: {
    id: 'adam_intro_3',
    speaker: 'Adam',
    text: "The gap between 'someone should do this' and 'someone did this' got shorter. That's the whole job, honestly — close that gap.",
    next: 'adam_intro_4',
  },
  adam_intro_4: {
    id: 'adam_intro_4',
    speaker: 'Adam',
    text: "When we ship something, I like to name everyone who touched it — the PMs, the designers, the devs, the data scientists who validated it, the people who scraped the data so there was something to validate. The chain is longer than it looks.",
    next: 'adam_intro_5',
  },
  adam_intro_5: {
    id: 'adam_intro_5',
    speaker: 'Adam',
    text: "We've launched products that wouldn't exist without AI. Not 'launched faster' — wouldn't exist. That's a different sentence.",
  },

  dana_l10_intake_back: {
    id: 'dana_l10_intake_back',
    speaker: 'Dana',
    text: "They're not in a hurry. They never are.",
    choices: [{ text: '(Step away.)' }],
  },

  // ## CATALOG_INTAKES ##
  // ===== 33-level migration: catalog-case intake dialogues =====
  // Each one a 3-node tree (intro → ask → optional back-out). The
  // case body uses the gloss from case-order.ts; the descent fires
  // the corresponding catalog_* encounter id which routes through
  // PrototypeIframeScene.

  // L2 — Alex, ASP / WAC Apothecary
  alex_asp_wac_intake: {
    id: 'alex_asp_wac_intake',
    speaker: 'Liana',
    text: "Got a Part B drug denial — J-code units don't reconcile with ASP+6%. NDC↔HCPCS crosswalk might be off. Look interesting?",
    next: 'alex_asp_wac_intake_2',
  },
  alex_asp_wac_intake_2: {
    id: 'alex_asp_wac_intake_2',
    speaker: 'Liana',
    text: "I've got the file open if you want the trail. Pricing math is mostly checking the units against the dose; spot the mistake and it should recover cleanly.",
    choices: [
      { text: '(Pull the J-code file.)',
        effect: { triggerDescent: { encounterId: 'catalog_asp_wac_apothecary' } } },
      { text: 'Maybe later.', next: 'alex_asp_wac_intake_back' },
    ],
  },
  alex_asp_wac_intake_back: {
    id: 'alex_asp_wac_intake_back',
    speaker: 'Liana',
    text: "Fair. The pricing files don't move on us.",
    choices: [{ text: '(Step away.)' }],
  },

  // L4 — Alex, Stoploss Reckoner
  alex_stoploss_intake: {
    id: 'alex_stoploss_intake',
    speaker: 'Alex',
    text: "Don't laugh — I came out here to think. That trauma case from last quarter? Total charges blew past the stoploss threshold, but the payment came back like they paid the case rate flat. Couldn't see straight staring at it under the office lights.",
    next: 'alex_stoploss_intake_2',
  },
  alex_stoploss_intake_2: {
    id: 'alex_stoploss_intake_2',
    speaker: 'Alex',
    text: "Patient came in right through that ambulance bay. Feels wrong to short the contract on a save like that. I need a second set of eyes on the math and the clause.",
    choices: [
      { text: '(Pull the EOR + contract.)',
        effect: { triggerDescent: { encounterId: 'catalog_stoploss_reckoner' } } },
      { text: 'Not yet.', next: 'alex_stoploss_intake_back' },
    ],
  },
  alex_stoploss_intake_back: {
    id: 'alex_stoploss_intake_back',
    speaker: 'Alex',
    text: "I'll be out here a while. The variance report's not going anywhere.",
    choices: [{ text: '(Step away.)' }],
  },

  // Pat, Outpatient Surgery Grouper (L6)
  pat_outpatient_surgery_intake: {
    id: 'pat_outpatient_surgery_intake',
    speaker: 'Marisol',
    text: "Outpatient surgery case where the APC grouper put a 'T' code into a packaged-N bundle. The line should pay separately; it isn't.",
    next: 'pat_outpatient_surgery_intake_2',
  },
  pat_outpatient_surgery_intake_2: {
    id: 'pat_outpatient_surgery_intake_2',
    speaker: 'Marisol',
    text: "Status indicators are the lever. Pull the chart, then run the grouper logic against it.",
    choices: [
      { text: '(Pull the case.)',
        effect: { triggerDescent: { encounterId: 'catalog_outpatient_surgery_grouper' } } },
      { text: 'Later.', next: 'pat_outpatient_surgery_intake_back' },
    ],
  },
  pat_outpatient_surgery_intake_back: {
    id: 'pat_outpatient_surgery_intake_back',
    speaker: 'Marisol',
    text: "It's a quarterly issue. We'll see it again.",
    choices: [{ text: '(Step away.)' }],
  },

  // L7 — Jordan, No-Show Bill (release-valve)
  jordan_no_show_intake: {
    id: 'jordan_no_show_intake',
    speaker: 'Jordan',
    text: "Patient missed an appointment, billing department auto-fee'd them, they're calling to push back. There's a clinical reason — they were in the ER that morning.",
    next: 'jordan_no_show_intake_2',
  },
  jordan_no_show_intake_2: {
    id: 'jordan_no_show_intake_2',
    speaker: 'Jordan',
    text: "This one's a call, not a code: walk the no-show policy and decide whether we waive.",
    choices: [
      { text: '(Take the call.)',
        effect: { triggerDescent: { encounterId: 'catalog_no_show_bill' } } },
      { text: 'Not now.', next: 'jordan_no_show_intake_back' },
    ],
  },
  jordan_no_show_intake_back: {
    id: 'jordan_no_show_intake_back',
    speaker: 'Jordan',
    text: "She's still on hold. I'll keep her on the line.",
    choices: [{ text: '(Step away.)' }],
  },

  // L9 — Jordan, Lighthouse (charity)
  jordan_lighthouse_intake: {
    id: 'jordan_lighthouse_intake',
    speaker: 'Jordan',
    text: "A patient who can't pay. Walked into the ER three weeks ago with no insurance and no income above 200% FPL. We have §501(r) for exactly this; the application's open.",
    next: 'jordan_lighthouse_intake_2',
  },
  jordan_lighthouse_intake_2: {
    id: 'jordan_lighthouse_intake_2',
    speaker: 'Jordan',
    text: "Can you walk the screen and presumptive eligibility check with him?",
    choices: [
      { text: '(Open the application.)',
        effect: { triggerDescent: { encounterId: 'lighthouse_charity' } } },
      { text: 'Give me a minute.', next: 'jordan_lighthouse_intake_back' },
    ],
  },
  jordan_lighthouse_intake_back: {
    id: 'jordan_lighthouse_intake_back',
    speaker: 'Jordan',
    text: "He's not going anywhere. He's been in this lobby longer than I have.",
    choices: [{ text: '(Step away.)' }],
  },

  // L10 — Sam, GFE Oracle
  sam_gfe_intake: {
    id: 'sam_gfe_intake',
    speaker: 'Theresa',
    text: "Patient says the bill came in $1,200 over their GFE. NSA dispute path opens at $400. They've already started the paperwork.",
    next: 'sam_gfe_intake_2',
  },
  sam_gfe_intake_2: {
    id: 'sam_gfe_intake_2',
    speaker: 'Theresa',
    text: "Itemize the GFE against the actual bill and find the gap.",
    choices: [
      { text: '(Take it.)',
        effect: { triggerDescent: { encounterId: 'catalog_gfe_oracle' } } },
      { text: 'Later.', next: 'sam_gfe_intake_back' },
    ],
  },
  sam_gfe_intake_back: {
    id: 'sam_gfe_intake_back',
    speaker: 'Theresa',
    text: "Patient has 30 days to file. Don't make me chase you.",
    choices: [{ text: '(Step away.)' }],
  },

  // L14 — Alex, Implant Carve-Out
  alex_implant_carveout_intake: {
    id: 'alex_implant_carveout_intake',
    speaker: 'Adaeze',
    text: "Surgical case where the implant invoice was $14K above the stoploss threshold. Contract carves it out — payer paid the bundled case rate anyway.",
    next: 'alex_implant_carveout_intake_2',
  },
  alex_implant_carveout_intake_2: {
    id: 'alex_implant_carveout_intake_2',
    speaker: 'Adaeze',
    text: "Pull the manufacturer invoice and the contract clause. If the carve-out triggers, the math will say so.",
    choices: [
      { text: '(Open the case.)',
        effect: { triggerDescent: { encounterId: 'catalog_implant_carveout_specter' } } },
      { text: 'Not yet.', next: 'alex_implant_carveout_intake_back' },
    ],
  },
  alex_implant_carveout_intake_back: {
    id: 'alex_implant_carveout_intake_back',
    speaker: 'Adaeze',
    text: "Six figures in aggregate. I'll wait.",
    choices: [{ text: '(Step away.)' }],
  },

  // L15 — Kim, Credentialing Lattice
  kim_credentialing_intake: {
    id: 'kim_credentialing_intake',
    speaker: 'Dr. Park',
    text: "New hire denied — Aetna says the doc isn't credentialed yet. He's been seeing patients for six weeks under a covering attending, but the bill went out under his own NPI.",
    next: 'kim_credentialing_intake_2',
  },
  kim_credentialing_intake_2: {
    id: 'kim_credentialing_intake_2',
    speaker: 'Dr. Park',
    text: "Could be a retro-credential request; could be a re-route under the covering attending. Pull the file and pin it down.",
    choices: [
      { text: '(Pull the credentialing file.)',
        effect: { triggerDescent: { encounterId: 'catalog_credentialing_lattice' } } },
      { text: 'Maybe later.', next: 'kim_credentialing_intake_back' },
    ],
  },
  kim_credentialing_intake_back: {
    id: 'kim_credentialing_intake_back',
    speaker: 'Dr. Park',
    text: "Sixty days from charge to denial. Clock's running.",
    choices: [{ text: '(Step away.)' }],
  },

  // L16 — Alex, Carve-Out Phantom (NSA carve-out)
  alex_carveout_phantom_intake: {
    id: 'alex_carveout_phantom_intake',
    speaker: 'Dr. Ethan',
    text: "ER visit, facility in-network, anesthesiologist group OON. Patient got two bills — facility's fine, physician's a balance bill that NSA should be capping.",
    next: 'alex_carveout_phantom_intake_2',
  },
  alex_carveout_phantom_intake_2: {
    id: 'alex_carveout_phantom_intake_2',
    speaker: 'Dr. Ethan',
    text: "Start with cost-share, then route the OON ↔ payer fight to IDR.",
    choices: [
      { text: '(Take the case.)',
        effect: { triggerDescent: { encounterId: 'catalog_carveout_phantom' } } },
      { text: 'Not now.', next: 'alex_carveout_phantom_intake_back' },
    ],
  },
  alex_carveout_phantom_intake_back: {
    id: 'alex_carveout_phantom_intake_back',
    speaker: 'Dr. Ethan',
    text: "Patient escalated to the state AG once. Don't make that happen again.",
    choices: [{ text: '(Step away.)' }],
  },

  // L17 — Pat, CPT Licensure Mire
  pat_cpt_licensure_intake: {
    id: 'pat_cpt_licensure_intake',
    speaker: 'Pat',
    text: "Compliance flagged our internal CPT crosswalk tool — AMA's licensing terms changed and our use might've drifted out of compliance.",
    next: 'pat_cpt_licensure_intake_2',
  },
  pat_cpt_licensure_intake_2: {
    id: 'pat_cpt_licensure_intake_2',
    speaker: 'Pat',
    text: "If you can stand licensing language, I need your eyes on the tool usage and the HCPCS crosswalk.",
    choices: [
      { text: '(Take the audit.)',
        effect: { triggerDescent: { encounterId: 'catalog_cpt_licensure_mire' } } },
      { text: 'Pass for now.', next: 'pat_cpt_licensure_intake_back' },
    ],
  },
  pat_cpt_licensure_intake_back: {
    id: 'pat_cpt_licensure_intake_back',
    speaker: 'Pat',
    text: "License doesn't lapse. But our copy of the manual does.",
    choices: [{ text: '(Step away.)' }],
  },

  // L20 — Alex, OB Per-Diem Specter
  alex_ob_perdiem_intake: {
    id: 'alex_ob_perdiem_intake',
    speaker: 'Dr. Priya',
    text: "L&D case — vaginal delivery converted to C-section mid-labor. Payer paid the OB per-diem base rate; the C-section escalator never triggered.",
    next: 'alex_ob_perdiem_intake_2',
  },
  alex_ob_perdiem_intake_2: {
    id: 'alex_ob_perdiem_intake_2',
    speaker: 'Dr. Priya',
    text: "Pull the contract clause and the procedure record; that'll tell us whether the escalator missed.",
    choices: [
      { text: '(Pull the case.)',
        effect: { triggerDescent: { encounterId: 'catalog_ob_perdiem_specter' } } },
      { text: 'Not yet.', next: 'alex_ob_perdiem_intake_back' },
    ],
  },
  alex_ob_perdiem_intake_back: {
    id: 'alex_ob_perdiem_intake_back',
    speaker: 'Dr. Priya',
    text: "The escalator's worth four figures per case. We see this a lot.",
    choices: [{ text: '(Step away.)' }],
  },

  // L21 — Kim, Phantom Patient
  kim_phantom_patient_intake: {
    id: 'kim_phantom_patient_intake',
    speaker: 'Marisol',
    text: "Two patients with the same name, same DOB, same zip code. They collided into one MRN at intake. Treatment histories tangled.",
    next: 'kim_phantom_patient_intake_2',
  },
  kim_phantom_patient_intake_2: {
    id: 'kim_phantom_patient_intake_2',
    speaker: 'Marisol',
    text: "Walk the chart timelines and separate them at the source. Both patients are real; both deserve their own MRN.",
    choices: [
      { text: '(Open both charts.)',
        effect: { triggerDescent: { encounterId: 'catalog_phantom_patient' } } },
      { text: 'Give me a minute.', next: 'kim_phantom_patient_intake_back' },
    ],
  },
  kim_phantom_patient_intake_back: {
    id: 'kim_phantom_patient_intake_back',
    speaker: 'Marisol',
    text: "Don't take long. Both of them are getting bills that aren't theirs.",
    choices: [{ text: '(Step away.)' }],
  },

  // L22 — Pat, Risk Adjustment Hollow
  pat_risk_adj_intake: {
    id: 'pat_risk_adj_intake',
    speaker: 'Dr. Priya',
    text: "Annual HCC capture — patient with documented chronic conditions last year, none captured this year. RAF score dropped by 0.8. Reimbursement follows.",
    next: 'pat_risk_adj_intake_2',
  },
  pat_risk_adj_intake_2: {
    id: 'pat_risk_adj_intake_2',
    speaker: 'Dr. Priya',
    text: "Pull the chart and see what's actually documented this year. Recapture what we can.",
    choices: [
      { text: '(Take the review.)',
        effect: { triggerDescent: { encounterId: 'catalog_risk_adj_hollow' } } },
      { text: 'Not yet.', next: 'pat_risk_adj_intake_back' },
    ],
  },
  pat_risk_adj_intake_back: {
    id: 'pat_risk_adj_intake_back',
    speaker: 'Dr. Priya',
    text: "Year-end closes the capture window. Don't sleep on it.",
    choices: [{ text: '(Step away.)' }],
  },

  // L23 — Alex, Chemo Bundle Specter
  alex_chemo_bundle_intake: {
    id: 'alex_chemo_bundle_intake',
    speaker: 'Dr. Ethan',
    text: "Oncology case — chemo administration codes (96413, 96415) dropped from the claim. Payer paid the drug + a case rate that doesn't cover admin time.",
    next: 'alex_chemo_bundle_intake_2',
  },
  alex_chemo_bundle_intake_2: {
    id: 'alex_chemo_bundle_intake_2',
    speaker: 'Dr. Ethan',
    text: "Open the file and reconcile the missing units against the infusion record, claim, and contract.",
    choices: [
      { text: '(Open the file.)',
        effect: { triggerDescent: { encounterId: 'catalog_chemo_bundle_specter' } } },
      { text: 'Pass.', next: 'alex_chemo_bundle_intake_back' },
    ],
  },
  alex_chemo_bundle_intake_back: {
    id: 'alex_chemo_bundle_intake_back',
    speaker: 'Dr. Ethan',
    text: "Six-figure aggregate every quarter. Don't pass long.",
    choices: [{ text: '(Step away.)' }],
  },

  // L24 — Pat, Two-Midnight Mire
  pat_two_midnight_intake: {
    id: 'pat_two_midnight_intake',
    speaker: 'Dr. Park',
    text: "Medicare admit, 38 hours total stay. Payer downgraded to observation. Clinical narrative supports inpatient — physician documented the 2-midnight expectation.",
    next: 'pat_two_midnight_intake_2',
  },
  pat_two_midnight_intake_2: {
    id: 'pat_two_midnight_intake_2',
    speaker: 'Dr. Park',
    text: "Build the inpatient defense from the H&P, progress notes, and discharge summary.",
    choices: [
      { text: '(Pull the chart.)',
        effect: { triggerDescent: { encounterId: 'catalog_two_midnight_mire' } } },
      { text: 'Later.', next: 'pat_two_midnight_intake_back' },
    ],
  },
  pat_two_midnight_intake_back: {
    id: 'pat_two_midnight_intake_back',
    speaker: 'Dr. Park',
    text: "The clock on the appeal isn't generous.",
    choices: [{ text: '(Step away.)' }],
  },

  // L25 — Alex, Underpayment Specter
  alex_specter_intake: {
    id: 'alex_specter_intake',
    speaker: 'Alex',
    text: "CO-45 streak across one payer this quarter — paid amounts running 8-12% below contract. Either fee schedule loaded wrong or someone's adjudicating to a different one.",
    next: 'alex_specter_intake_2',
  },
  alex_specter_intake_2: {
    id: 'alex_specter_intake_2',
    speaker: 'Alex',
    text: "Build the dispute from the EOR and contract rate.",
    choices: [
      { text: '(Open the case.)',
        effect: { triggerDescent: { encounterId: 'underpayment_specter' } } },
      { text: 'Not yet.', next: 'alex_specter_intake_back' },
    ],
  },
  alex_specter_intake_back: {
    id: 'alex_specter_intake_back',
    speaker: 'Alex',
    text: "Underpayment dollars are silent. Until you look.",
    choices: [{ text: '(Step away.)' }],
  },

  // L26 — Kim, COB Cascade Spider
  kim_cob_cascade_intake: {
    id: 'kim_cob_cascade_intake',
    speaker: 'Kim',
    text: "Patient with three coverages — Medicare, retiree plan through wife, employer plan through self. All three 271s say 'secondary.' Nobody wants to pay first.",
    next: 'kim_cob_cascade_intake_2',
  },
  kim_cob_cascade_intake_2: {
    id: 'kim_cob_cascade_intake_2',
    speaker: 'Kim',
    text: "Run fresh inquiries, then walk the COB order.",
    choices: [
      { text: '(Pull the file.)',
        effect: { triggerDescent: { encounterId: 'catalog_cob_cascade_spider' } } },
      { text: 'Later.', next: 'kim_cob_cascade_intake_back' },
    ],
  },
  kim_cob_cascade_intake_back: {
    id: 'kim_cob_cascade_intake_back',
    speaker: 'Kim',
    text: "Patient called four times last week. He's not going to stop.",
    choices: [{ text: '(Step away.)' }],
  },

  // L27 — Alex, Case-Rate Specter
  alex_case_rate_intake: {
    id: 'alex_case_rate_intake',
    speaker: 'Diane',
    text: "Eight-day stay paid as one case rate. Contract has a per-diem trigger at day 5 that should've kicked in. Payer's adjudication didn't.",
    next: 'alex_case_rate_intake_2',
  },
  alex_case_rate_intake_2: {
    id: 'alex_case_rate_intake_2',
    speaker: 'Diane',
    text: "Walk the LOS and contract clauses, then build the per-diem dispute.",
    choices: [
      { text: '(Take the case.)',
        effect: { triggerDescent: { encounterId: 'catalog_case_rate_specter' } } },
      { text: 'Pass.', next: 'alex_case_rate_intake_back' },
    ],
  },
  alex_case_rate_intake_back: {
    id: 'alex_case_rate_intake_back',
    speaker: 'Diane',
    text: "Three or four of these a month. Aggregate matters.",
    choices: [{ text: '(Step away.)' }],
  },

  // L28 — Sam, MRF Cartographer
  sam_mrf_intake: {
    id: 'sam_mrf_intake',
    speaker: 'Theresa',
    text: "Contract dispute on a specialty drug. Payer says their negotiated rate is what they paid; provider says no. The MRF should settle it — if we can read it.",
    next: 'sam_mrf_intake_2',
  },
  sam_mrf_intake_2: {
    id: 'sam_mrf_intake_2',
    speaker: 'Theresa',
    text: "It's 8 GB of JSON. jq + grep. Find the rate for J-code 9120 and bring coffee.",
    choices: [
      { text: '(Open the MRF.)',
        effect: { triggerDescent: { encounterId: 'catalog_mrf_cartographer' } } },
      { text: 'Not yet.', next: 'sam_mrf_intake_back' },
    ],
  },
  sam_mrf_intake_back: {
    id: 'sam_mrf_intake_back',
    speaker: 'Theresa',
    text: "The file is updated monthly. Yours won't be the only one.",
    choices: [{ text: '(Step away.)' }],
  },

  // L29 — Sam, IDR Crucible
  sam_idr_intake: {
    id: 'sam_idr_intake',
    speaker: 'Sam',
    text: "IDR submission due Friday. Payer's offer is 60% of QPA. Our position is 110% based on complexity. Three days to pick a number and defend the math.",
    next: 'sam_idr_intake_2',
  },
  sam_idr_intake_2: {
    id: 'sam_idr_intake_2',
    speaker: 'Sam',
    text: "Walk the QPA calc and case-specific factors; baseball arbitration means the arbiter picks one number, no middle ground.",
    choices: [
      { text: '(Take the submission.)',
        effect: { triggerDescent: { encounterId: 'catalog_idr_crucible' } } },
      { text: 'Later.', next: 'sam_idr_intake_back' },
    ],
  },
  sam_idr_intake_back: {
    id: 'sam_idr_intake_back',
    speaker: 'Sam',
    text: "Friday's not moving.",
    choices: [{ text: '(Step away.)' }],
  },

  // L30 — Alex, 340B Specter
  alex_340b_intake: {
    id: 'alex_340b_intake',
    speaker: 'Liana',
    text: "340B-eligible drug reimbursed at the non-340B rate post-Becerra. Either we lose the discount on this DOS or the payer's reading the clawback rule wrong.",
    next: 'alex_340b_intake_2',
  },
  alex_340b_intake_2: {
    id: 'alex_340b_intake_2',
    speaker: 'Liana',
    text: "Pull the eligibility, the DOS, and the policy; the answer is in the overlap.",
    choices: [
      { text: '(Open the case.)',
        effect: { triggerDescent: { encounterId: 'catalog_three_forty_b_specter' } } },
      { text: 'Not now.', next: 'alex_340b_intake_back' },
    ],
  },
  alex_340b_intake_back: {
    id: 'alex_340b_intake_back',
    speaker: 'Liana',
    text: "Pharmacy's keeping a tally. They'll appreciate the recover.",
    choices: [{ text: '(Step away.)' }],
  },

  // L31 — Sam, HIPAA Spider
  sam_hipaa_intake: {
    id: 'sam_hipaa_intake',
    speaker: 'Theo',
    text: "Fax-machine misroute Tuesday — six pages of PHI to a podiatrist's office that isn't ours. Four-factor assessment hasn't started.",
    next: 'sam_hipaa_intake_2',
  },
  sam_hipaa_intake_2: {
    id: 'sam_hipaa_intake_2',
    speaker: 'Theo',
    text: "Don't say breach yet — assess first. Walk the four factors, document, then decide on notification.",
    choices: [
      { text: '(Open the file.)',
        effect: { triggerDescent: { encounterId: 'catalog_hipaa_spider' } } },
      { text: 'Compliance can wait one more day.', next: 'sam_hipaa_intake_back' },
    ],
  },
  sam_hipaa_intake_back: {
    id: 'sam_hipaa_intake_back',
    speaker: 'Theo',
    text: "Sixty-day notification clock starts when we knew. We know now.",
    choices: [{ text: '(Step away.)' }],
  },
}

// ## LEVEL_NPC_DIALOGUES ##
/** Per-level dialogue overrides. When `state.currentLevel` matches a
 *  key here, the matching NPC opens the listed dialogue tree instead
 *  of their default `dialogueKey`. Lets one NPC carry different cases
 *  across levels without forking their identity.
 *
 *  33-level structure — each level routes its case-handing NPC to
 *  the right intake tree. Existing dialogues from the 10-level shape
 *  are reused where the case is unchanged (only the level number moved). */
export const LEVEL_NPC_DIALOGUES: Record<number, Record<string, string>> = {
  2:   { liana: 'alex_asp_wac_intake' },
  3:   { kim:      'kim_l2_intake' },  // fog
  4:   { alex:     'alex_stoploss_intake' },
  5:   { pat:      'pat_l4_intake' },  // bundle
  6:   { records_clerk: 'pat_outpatient_surgery_intake' },
  7:   { jordan:   'jordan_no_show_intake' },
  8:   { martinez: 'martinez_gatekeeper_intake', sam: 'sam_l3_intake' },  // gatekeeper
  9:   { jordan: 'jordan_lighthouse_intake' },
  10:  { payer_rep: 'sam_gfe_intake' },
  11:  { payer_supervisor: 'sam_l5_intake' },  // wraith
  12:  { lab_tech: 'alex_l6_intake' },  // swarm
  13:  { joe: 'kim_l9_intake' },  // doppelganger
  14:  { rad_tech: 'alex_implant_carveout_intake' },
  15:  { dr_park: 'kim_credentialing_intake' },
  16:  { dr_ethan: 'alex_carveout_phantom_intake' },
  17:  { pat:      'pat_cpt_licensure_intake' },
  18:  { sam:      'sam_l7_intake' },  // reaper
  19:  { cashier: 'jordan_l8_intake' },  // surprise-bill
  20:  { dr_priya: 'alex_ob_perdiem_intake' },
  21:  { records_clerk: 'kim_phantom_patient_intake' },
  22:  { dr_priya: 'pat_risk_adj_intake' },
  23:  { dr_ethan: 'alex_chemo_bundle_intake' },
  24:  { dr_park: 'pat_two_midnight_intake' },
  25:  { alex:     'alex_specter_intake' },
  26:  { kim:      'kim_cob_cascade_intake' },
  27:  { payer_supervisor: 'alex_case_rate_intake' },
  28:  { payer_rep: 'sam_mrf_intake' },
  29:  { sam:      'sam_idr_intake' },
  30:  { liana: 'alex_340b_intake' },
  31:  { compliance_officer: 'sam_hipaa_intake' },
  32:  { dana:     'dana_l10_intake' },  // boss

}
