import type { NPC } from '../types'

export const NPCS: Record<string, NPC> = {
  dana: {
    id: 'dana',
    name: 'Dana',
    department: 'Revenue Cycle',
    spriteKey: 'npc_dana',
    dialogueKey: 'dana_intro',
    description: 'Your mentor. Knows where every claim goes and why.',
  },
  martinez: {
    id: 'martinez',
    name: 'Dr. Martinez',
    department: 'Surgery',
    spriteKey: 'npc_martinez',
    dialogueKey: 'martinez_intro',
    description: 'Brilliant surgeon, terrible at documentation.',
  },
  kim: {
    id: 'kim',
    name: 'Kim',
    department: 'Registration',
    spriteKey: 'npc_kim',
    dialogueKey: 'kim_intro',
    description: 'Front desk. First point of contact, first point of failure.',
  },
  jordan: {
    id: 'jordan',
    name: 'Jordan',
    department: 'Patient Financial Services',
    spriteKey: 'npc_jordan',
    dialogueKey: 'jordan_intro',
    description: 'Explains bills to confused patients all day.',
  },
  pat: {
    id: 'pat',
    name: 'Pat',
    department: 'Coding',
    spriteKey: 'npc_pat',
    dialogueKey: 'pat_intro',
    description: 'Senior coder. ICD-10 in their sleep.',
  },
  alex: {
    id: 'alex',
    name: 'Alex',
    department: 'IT / EDI',
    spriteKey: 'npc_alex',
    dialogueKey: 'alex_intro',
    description: 'Manages the clearinghouse connection. Speaks in X12.',
  },
  sam: {
    id: 'sam',
    name: 'Sam',
    department: 'Denials Management',
    spriteKey: 'npc_sam',
    dialogueKey: 'sam_intro',
    description: 'Works the appeal queue. Tired but determined.',
  },
  anjali: {
    id: 'anjali',
    name: 'Anjali',
    department: 'Patient',
    spriteKey: 'npc_anjali',
    dialogueKey: 'anjali_intro',
    description: 'Came in for strep. Now holding a $387 ER bill that says she isn\'t on the plan.',
  },

  // === L10: The audit team. Show up only in the conference room when
  //     the player has reached the boss. Each one is talkable but
  //     none hands a case — the only progress path is Dana. ===
  auditor_carl: {
    id: 'auditor_carl',
    name: 'Carl Westbrook',
    department: 'Audit / Partner',
    spriteKey: 'npc_carl',
    dialogueKey: 'auditor_carl_intro',
    description: 'Senior partner. Smile that lives only on his face.',
  },
  auditor_chen: {
    id: 'auditor_chen',
    name: 'Wendy Chen',
    department: 'Audit / Data Analytics',
    spriteKey: 'npc_chen',
    dialogueKey: 'auditor_chen_intro',
    description: 'Built the regression model that flagged your hospital.',
  },
  auditor_rivera: {
    id: 'auditor_rivera',
    name: 'Mira Rivera',
    department: 'Audit / Compliance',
    spriteKey: 'npc_rivera',
    dialogueKey: 'auditor_rivera_intro',
    description: 'JD/MPH. Has read every NCD published in the last decade.',
  },
  auditor_eddi: {
    id: 'auditor_eddi',
    name: 'Eddi',
    department: 'Audit / Observer',
    spriteKey: 'npc_eddi',
    dialogueKey: 'auditor_eddi_intro',
    description: 'Doesn\'t introduce themselves. Doesn\'t need to.',
  },

  // === Ambient populace — atmosphere NPCs that hang around the
  //     hospital regardless of story level. Each has a one-line
  //     dialogue for color; none hand cases. Sprites mapped via
  //     BootScene.NPC_SOURCES from the LoRA contact sheet. ===
  liana: {
    id: 'liana',
    name: 'Liana',
    department: 'Pharmacy',
    spriteKey: 'npc_liana',
    dialogueKey: 'liana_intro',
    description: "Floor pharmacist. Walks the formulary like it's a script.",
  },
  dr_priya: {
    id: 'dr_priya',
    name: 'Dr. Priya',
    department: 'Surgery',
    spriteKey: 'npc_dr_priya',
    dialogueKey: 'dr_priya_intro',
    description: 'Surgeon. Documents in third-person past tense like a court transcript.',
  },
  dev: {
    id: 'dev',
    name: 'Dev',
    department: 'Patient Transport',
    spriteKey: 'npc_dev',
    dialogueKey: 'dev_intro',
    description: 'Pushes beds between floors. Has memorized every shortcut.',
  },
  walter: {
    id: 'walter',
    name: 'Walter',
    department: 'Patient',
    spriteKey: 'npc_walter',
    dialogueKey: 'walter_intro',
    description: 'Came in for a follow-up two hours ago. Still waiting.',
  },
  dr_ethan: {
    id: 'dr_ethan',
    name: 'Dr. Ethan',
    department: 'Hospitalist',
    spriteKey: 'npc_dr_ethan',
    dialogueKey: 'dr_ethan_intro',
    description: 'Internal medicine. Wears a white coat for the patients more than himself.',
  },
  officer_reyes: {
    id: 'officer_reyes',
    name: 'Officer Reyes',
    department: 'Security',
    spriteKey: 'npc_officer_reyes',
    dialogueKey: 'officer_reyes_intro',
    description: 'Watches the lobby door. Knows every regular by name.',
  },
  joe: {
    id: 'joe',
    name: 'Joe',
    department: 'Facilities',
    spriteKey: 'npc_joe',
    dialogueKey: 'joe_intro',
    description: 'Janitor. Has been here longer than anyone else on the floor.',
  },
  // Stands in the SW corridor blocking the path to Billing / PFS / Lab /
  // Lecture Hall during the early game. Disappears at L7 once the
  // last of those rooms (lecture hall, L7) unlocks. Sprite reused
  // from joe — both are facilities-coded so the visual reads coherently.
  maintenance_worker: {
    id: 'maintenance_worker',
    name: 'Cal',
    department: 'Facilities',
    spriteKey: 'npc_maintenance_worker',
    dialogueKey: 'maintenance_worker_intro',
    description: 'Contractor. Renovating the back wing. Mop and ladder; politely impassable.',
  },
  noah: {
    id: 'noah',
    name: 'Noah',
    department: 'Visitor',
    spriteKey: 'npc_noah',
    dialogueKey: 'noah_intro',
    description: 'Picking up a relative from radiology. Lost twice already.',
  },

  // === Round 2 — populating the rooms added in the east-wing,
  //     2F-floor, and outdoor PRs. Sprites map to NPC_SOURCES in
  //     BootScene.ts. ===
  rad_tech: {
    id: 'rad_tech',
    name: 'Adaeze',
    department: 'Radiology',
    spriteKey: 'npc_rad_tech',
    dialogueKey: 'rad_tech_intro',
    description: 'Imaging tech. Reads twenty studies before her first coffee.',
  },
  records_clerk: {
    id: 'records_clerk',
    name: 'Marisol',
    department: 'Health Information',
    spriteKey: 'npc_records_clerk',
    dialogueKey: 'records_clerk_intro',
    description: 'Knows which row of binders holds 2003 — by the smell.',
  },
  payer_rep: {
    id: 'payer_rep',
    name: 'Theresa',
    department: 'Payer / Anthem',
    spriteKey: 'npc_payer_rep',
    dialogueKey: 'payer_rep_intro',
    description: 'Provider relations rep, sitting in the office Mercy gave their payer liaisons.',
  },
  payer_supervisor: {
    id: 'payer_supervisor',
    name: 'Diane',
    department: 'Payer / Aetna',
    spriteKey: 'npc_payer_supervisor',
    dialogueKey: 'payer_supervisor_intro',
    description: 'Senior payer rep. Has the policy memorized and the empathy of a stop sign.',
  },
  compliance_officer: {
    id: 'compliance_officer',
    name: 'Theo',
    department: 'Compliance / Privacy',
    spriteKey: 'npc_compliance_officer',
    dialogueKey: 'compliance_officer_intro',
    description: 'HIPAA Privacy Officer. Will ask three questions before answering yours.',
  },
  smoker_visitor: {
    id: 'smoker_visitor',
    name: 'Earl',
    department: 'Visitor',
    spriteKey: 'npc_smoker_visitor',
    dialogueKey: 'smoker_visitor_intro',
    description: 'Stepped out for air four hours ago. Came back to find his wife discharged.',
  },

  // === Round 3 — npc16–20 sheets. Smokers are *outdoor-only*; the
  //     name + sprite both signal it. Other characters (paramedic,
  //     flower_visitor, elder_patient) work indoor or out. ===
  smoker_outdoor_b: {
    id: 'smoker_outdoor_b',
    name: 'Sandra',
    department: 'Visitor',
    spriteKey: 'npc_smoker_outdoor_b',
    dialogueKey: 'smoker_outdoor_b_intro',
    description: 'On break. The third one this hour. Outdoor only — cigarette is part of the sprite.',
  },
  paramedic: {
    id: 'paramedic',
    name: 'Cassie',
    department: 'EMS',
    spriteKey: 'npc_paramedic',
    dialogueKey: 'paramedic_intro',
    description: 'Just rolled in with a transfer from the surgical center. Wants the radio code right.',
  },
  flower_visitor: {
    id: 'flower_visitor',
    name: 'Greta',
    department: 'Visitor',
    spriteKey: 'npc_flower_visitor',
    dialogueKey: 'flower_visitor_intro',
    description: 'Visiting her sister, room 412. Brings a fresh arrangement every Friday.',
  },
  elder_patient: {
    id: 'elder_patient',
    name: 'Mr. Beck',
    department: 'Patient',
    spriteKey: 'npc_elder_patient',
    dialogueKey: 'elder_patient_intro',
    description: "Can't read the wayfinding signs without his good glasses. Has the wrong glasses.",
  },

  // === Round 4 — cafeteria staff + a couple of pool back-fills. ===
  cafeteria_worker: {
    id: 'cafeteria_worker',
    name: 'Manny',
    department: 'Cafeteria',
    spriteKey: 'npc_cafeteria_worker',
    dialogueKey: 'cafeteria_worker_intro',
    description: 'Runs the hot line. Knows what every doctor orders without looking up.',
  },
  cashier: {
    id: 'cashier',
    name: 'Yvette',
    department: 'Cafeteria',
    spriteKey: 'npc_cashier',
    dialogueKey: 'cashier_intro',
    description: 'Cashier. Will validate parking even if you forgot to ask.',
  },
  server: {
    id: 'server',
    name: 'Reggie',
    department: 'Cafeteria',
    spriteKey: 'npc_server',
    dialogueKey: 'server_intro',
    description: 'Bussing tables since 6 AM. Coffee in one hand, tray in the other.',
  },
  bike_emt: {
    id: 'bike_emt',
    name: 'Chase',
    department: 'EMS',
    spriteKey: 'npc_bike_emt',
    dialogueKey: 'bike_emt_intro',
    description: "Bike EMT. Faster through downtown traffic than the rig — sometimes.",
  },
  dr_park: {
    id: 'dr_park',
    name: 'Dr. Park',
    department: 'Internal Medicine',
    spriteKey: 'npc_dr_park',
    dialogueKey: 'dr_park_intro',
    description: 'Hospitalist. Reads charts faster than she reads the news.',
  },
  lab_tech: {
    id: 'lab_tech',
    name: 'Roni',
    department: 'Lab / Pathology',
    spriteKey: 'npc_lab_tech',
    dialogueKey: 'lab_tech_intro',
    description: 'Med-tech, dark scrubs + glasses. Annotates her samples in three colors.',
  },

  // === Round 5 — Data Sandbox (R&D team).
  //     The Sandbox lives upstairs alongside Audit/Payer/Compliance;
  //     it's the team that ships the tools the rest of the hospital
  //     pretends not to need. Sprites map to NPC_SOURCES →
  //     contact-sheets npc21–24. ===
  chansoo: {
    id: 'chansoo',
    name: 'Chansoo',
    department: 'R&D / Data Science',
    spriteKey: 'npc_chansoo',
    dialogueKey: 'chansoo_intro',
    description: 'Data scientist. Tracks the denial regression model that flagged this hospital.',
  },
  nicole: {
    id: 'nicole',
    name: 'Nicole',
    department: 'R&D / Solutions Architecture',
    spriteKey: 'npc_nicole',
    dialogueKey: 'nicole_intro',
    description: 'Solutions architect. Translates payer schemas into something the rest of the team can ship against.',
  },
  nick: {
    id: 'nick',
    name: 'Nick',
    department: 'R&D / Product',
    spriteKey: 'npc_nick',
    dialogueKey: 'nick_intro',
    description: "Product manager. Carries the roadmap in his head and the deadlines in his calendar.",
  },
  monika: {
    id: 'monika',
    name: 'Monika',
    department: 'R&D / Data Science',
    spriteKey: 'npc_monika',
    dialogueKey: 'monika_intro',
    description: 'Data scientist. Joins claim-adjudication tables five LEFT JOINs deep without flinching.',
  },
}
