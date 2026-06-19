import { defineConfig } from 'vite'
import { resolve } from 'path'

const base = process.env.VITE_BASE ?? (process.env.NODE_ENV === 'production' ? '/the-waiting-room/' : '/')

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      input: {
        // Game: the existing entry point.
        main: resolve(__dirname, 'index.html'),
        // Case Prototypes catalog: index page listing one playable
        // sketch per Case (the player-side problem solved in a
        // single encounter). Lives at /prototypes.html on GitHub
        // Pages — URL kept for link stability; visible label is
        // "Case Prototypes."
        prototypes: resolve(__dirname, 'prototypes.html'),
        // Wraith prototype: a single-encounter sketch demonstrating
        // the no-HP / no-tools / no-multiple-choice redesign. Lives
        // at /wraith-prototype.html on GitHub Pages.
        wraith: resolve(__dirname, 'wraith-prototype.html'),
        // Bundle prototype: sibling demonstrating AMEND-dominant
        // verb-space (modifier 25 on Box 24, vs. Wraith's CITE-
        // dominant). Lives at /bundle-prototype.html.
        bundle: resolve(__dirname, 'bundle-prototype.html'),
        // Reaper prototype: third sibling adding TIME PRESSURE —
        // a literal day countdown on a CO-29 timely-filing
        // waiver appeal. Lives at /reaper-prototype.html.
        reaper: resolve(__dirname, 'reaper-prototype.html'),
        // Gatekeeper prototype: fourth sibling introducing the
        // REQUEST verb — file a retroactive 278, wait for the
        // response, transcribe the auth number onto Box 23.
        // Lives at /gatekeeper-prototype.html.
        gatekeeper: resolve(__dirname, 'gatekeeper-prototype.html'),
        // Fog prototype: fifth sibling introducing the REVEAL
        // verb — pre-submission claim with fogged fields; run
        // a 270 inquiry to surface what registration got wrong;
        // amend against the 271 response. Lives at
        // /fog-prototype.html.
        fog: resolve(__dirname, 'fog-prototype.html'),
        // Intro prototype: the L1 teaching encounter ("The Wrong
        // Card"), ported from the runtime puzzle engine into the
        // standalone iframe format. Eligibility district. A single
        // AMEND on Box 1a — swap Anjali's husband's subscriber id
        // for her own to clear a CO-31. The simplest possible demo
        // of the puzzle loop. Lives at /intro-prototype.html.
        intro: resolve(__dirname, 'intro-prototype.html'),
        // Hydra prototype REMOVED 2026-05 — superseded by COB
        // Cascade Spider (cobCascadeSpider input below). The Hydra
        // mechanic was a thin three-payer SEQUENCE sketch; COB
        // Cascade Spider provides the full per-patient cascade
        // (birthday rule, MSP, payer-of-last-resort) at L9.
        // Swarm prototype: seventh sibling introducing the
        // BATCH verb — 18 weekend CO-16 rejections, 14 sharing
        // one root cause; fix the cluster as a group, sweep
        // the outliers, patch upstream so it stops happening.
        // First prototype that operates on a queue, not a
        // single claim. Lives at /swarm-prototype.html.
        swarm: resolve(__dirname, 'swarm-prototype.html'),
        // Specter prototype: eighth sibling introducing the
        // VARIANCE verb — an 835 ERA arrived showing four
        // claims paid; one hides an underpayment that the
        // CO-45 adjustment quietly absorbed. Detect and
        // appeal. First prototype where the input is a
        // successful payment, not a denial. Lives at
        // /specter-prototype.html.
        specter: resolve(__dirname, 'specter-prototype.html'),
        // Doppelgänger prototype: ninth sibling introducing
        // the REPLACE verb — resolve a CO-18 duplicate flag
        // by filing the resubmission as a frequency-7
        // replacement of the original ICN. First version-
        // control encounter. Lives at
        // /doppelganger-prototype.html.
        doppelganger: resolve(__dirname, 'doppelganger-prototype.html'),
        // Lighthouse prototype: tenth sibling — the patient-
        // facing release-valve. First encounter that isn't
        // a fight: charity-care screening for a patient who
        // can't pay an $87,420 bill. Verbs are LISTEN /
        // SCREEN / RELEASE; sits outside the four-district
        // verb-space. Lives at /lighthouse-prototype.html.
        lighthouse: resolve(__dirname, 'lighthouse-prototype.html'),
        // Surprise Bill Specter: eleventh sibling — the L8
        // patient-facing fight (companion to Lighthouse's
        // kindness). NSA dispute against an OON surprise
        // bill. Verbs: CLASSIFY / CALCULATE / DISPUTE.
        // Lives at /surprise-bill-prototype.html.
        surpriseBill: resolve(__dirname, 'surprise-bill-prototype.html'),
        // Audit Boss: twelfth sibling — the finale. The
        // Quarterly Audit. Defense, not offense: three
        // findings on Margaret Holloway's UB-04, each
        // resolvable as RECEIPT (defend with chart evidence)
        // or AMEND (concede + recoupment). Lives at
        // /audit-boss-prototype.html.
        auditBoss: resolve(__dirname, 'audit-boss-prototype.html'),
        // Case Rate Specter: pricing-methodology sibling to the
        // Specter. Same dragon (underpayment behind CO-45),
        // different lever — the contract's case-rate / outlier-
        // provision split rather than a stale fee table. Verbs:
        // COMPARE-CONTRACT / REPRICE / APPEAL. Lives at
        // /case-rate-specter-prototype.html.
        caseRateSpecter: resolve(__dirname, 'case-rate-specter-prototype.html'),
        // MRF Cartographer: pricing-transparency Case. First
        // prototype where the deliverable is a regulatory file,
        // not a claim packet. Player builds the machine-readable
        // file row by row from the chargemaster (hard-coded
        // services) and the claim history (soft-coded services).
        // Verbs: MAP / ESTIMATE / RECONCILE. Lives at
        // /mrf-cartographer-prototype.html.
        mrfCartographer: resolve(__dirname, 'mrf-cartographer-prototype.html'),
        // GFE Oracle: pre-service Case. Self-pay patient scheduled
        // for an elective procedure; NSA requires a Good Faith
        // Estimate within 3 business days. Sibling to MRF
        // Cartographer (same source-of-truth puzzle, different
        // deliverable + a third bucket for co-providers). Verbs:
        // ITEMIZE / ESTIMATE / COMMIT. Lives at
        // /gfe-oracle-prototype.html.
        gfeOracle: resolve(__dirname, 'gfe-oracle-prototype.html'),
        // Carve-out Phantom: two-bills-for-one-visit Case. Patient
        // got an in-network facility bill plus an OON physician-
        // group bill for the same ER visit. Player walks the
        // contract chain, applies the right NSA carve-out, and
        // routes the rate dispute through IDR (not the patient).
        // Verbs: TRACE-CONTRACT / APPLY-NSA / RESOLVE. Lives at
        // /carveout-phantom-prototype.html.
        carveoutPhantom: resolve(__dirname, 'carveout-phantom-prototype.html'),
        // Form Mirror: wrong-form Case. Facility claim filed on
        // a CMS-1500 (837P) instead of UB-04 (837I); came back
        // CO-95 (clearinghouse rejection, not a denial). Player
        // detects the mismatch, maps institutional-only fields
        // to the correct UB-04 form locators, and refiles as
        // 837I. Verbs: DETECT / MAP / REROUTE. Lives at
        // /form-mirror-prototype.html.
        formMirror: resolve(__dirname, 'form-mirror-prototype.html'),
        // CPT Licensure Mire: meta-Case on AMA's CPT licensing
        // system. Charity clinic audit; player walks the
        // licensing chain, picks the right tier, finds HCPCS
        // Level II alternatives where they exist. First Case
        // where the puzzle pushes against the system rather than
        // working within it. Verbs: SOURCE / LICENSE /
        // ALTERNATIVE. Lives at /cpt-licensure-mire-prototype.html.
        cptLicensureMire: resolve(__dirname, 'cpt-licensure-mire-prototype.html'),
        // ASP/WAC Apothecary: drug-pricing Case. Part B J-code
        // claim underpaid because the hospital billed in vials
        // but HCPCS units are 10mg. Player picks the right
        // reimbursement basis (ASP+6%, not WAC/AWP/CDM), the
        // right unit count (40 not 1), and files. Verbs:
        // PRICE / CONVERT / APPEAL. Lives at
        // /asp-wac-apothecary-prototype.html.
        aspWacApothecary: resolve(__dirname, 'asp-wac-apothecary-prototype.html'),
        // Chemo Bundle Specter: UHC chemo bundling Case. Chemo
        // admin (CPT 96413) + Rev 0335 triggers a chemo case
        // rate that bundles the drug J-codes — but the
        // chargemaster is hard-coded to drop the drugs as
        // separate billable lines. UHC denies the J-codes
        // CO-234 (correctly). The fix is upstream: update the
        // CDM to suppress the J-code drops on UHC chemo
        // sessions. Verbs: READ-CLAUSE / EXAMINE-CDM /
        // HARD-CODE. First Case where the bug is in the
        // chargemaster, not the claim. Lives at
        // /chemo-bundle-specter-prototype.html.
        chemoBundleSpecter: resolve(__dirname, 'chemo-bundle-specter-prototype.html'),
        // Outpatient Surgery Grouper: UHC OPG variance Case. CPT in
        // the right grouper level, but the chargemaster dropped the
        // wrong rev code → grouper bypassed → default fee schedule
        // adjudication → quiet underpayment. Sibling to Chemo Bundle
        // Specter (same upstream-fix muscle, different UHC mechanism).
        // Verbs: VERIFY-GROUPER / DIAGNOSE-VARIANCE / CORRECT.
        // Reference: uhcprovider.com 7/1/25 OPG Exhibit. Lives at
        // /outpatient-surgery-grouper-prototype.html.
        outpatientSurgeryGrouper: resolve(__dirname, 'outpatient-surgery-grouper-prototype.html'),
        // COB Cascade Spider: birthday rule + MSP working-aged +
        // payer-of-last-resort across three patients on one
        // household policy. Verbs: VERIFY-ELIGIBILITY /
        // APPLY-CASCADE / REFILE.
        cobCascadeSpider: resolve(__dirname, 'cob-cascade-spider-prototype.html'),
        // 2-Midnight Mire: Medicare 2-midnight rule + observation
        // vs inpatient classification + RAC defense. Verbs:
        // CLOCK / CLASSIFY / RECLASSIFY.
        twoMidnightMire: resolve(__dirname, 'two-midnight-mire-prototype.html'),
        // 340B Drug Pricing Specter: duplicate-discount Case.
        // Outpatient 340B-acquired drug billed to state Medicaid
        // without the state-specific 340B identifier; manufacturer
        // pays both the 340B discount + the Medicaid rebate; HRSA
        // opens a compliance review. Refile + refund + self-disclose.
        // Verbs: QUALIFY / MARK / DISCLOSE.
        threeFortyBSpecter: resolve(__dirname, 'three-forty-b-specter-prototype.html'),
        // IDR Crucible: NSA Independent Dispute Resolution Case.
        // OON emergency cath at in-network ED; payer paid the QPA
        // off the wrong specialty+setting bucket; open negotiation
        // lapsed; provider must file IDR. Baseball-style arbitration
        // — one offer wins. Audit the QPA methodology, rebucket
        // specialty+setting, submit the defensible market median.
        // Verbs: AUDIT / REBUCKET / OFFER. Lives at
        // /idr-crucible-prototype.html.
        idrCrucible: resolve(__dirname, 'idr-crucible-prototype.html'),
        // Implant Carve-out Specter: high-cost implant unflagged
        // at billing, rolled into the DRG case rate when the
        // contract appendix carves it out at invoice +20%. Verbs:
        // ITEMIZE / INVOICE-MATCH / APPEND. Lives at
        // /implant-carveout-specter-prototype.html.
        implantCarveoutSpecter: resolve(__dirname, 'implant-carveout-specter-prototype.html'),
        // Stoploss Reckoner: math-heavy charge-threshold trip;
        // payment converts from case rate to 65% of charges. Verbs:
        // TRIP / RECALCULATE / APPEAL.
        stoplossReckoner: resolve(__dirname, 'stoploss-reckoner-prototype.html'),
        // OB Per-Diem Specter: case-rate + per-diem hybrid contract;
        // hospital missed the per-diem days. Verbs: PARSE-CONTRACT /
        // SPLIT-DAYS / APPEAL.
        obPerdiemSpecter: resolve(__dirname, 'ob-perdiem-specter-prototype.html'),
        // Phantom Patient: wrong-MRN identity merge. Verbs: TRACE /
        // UNMERGE / REFILE.
        phantomPatient: resolve(__dirname, 'phantom-patient-prototype.html'),
        // Risk Adjustment Hollow: HCC under-capture for Medicare
        // Advantage. Verbs: REVIEW / ENRICH / QUERY.
        riskAdjHollow: resolve(__dirname, 'risk-adj-hollow-prototype.html'),
        // Credentialing Lattice: provider-side eligibility gap.
        // Verbs: VERIFY-NETWORK / ENROLL / BACKDATE.
        credentialingLattice: resolve(__dirname, 'credentialing-lattice-prototype.html'),
        // HIPAA Spider: privacy breach response. Verbs: ASSESS /
        // CONTAIN / NOTIFY.
        hipaaSpider: resolve(__dirname, 'hipaa-spider-prototype.html'),
        // No-Show Bill: mid-game release-valve (Lighthouse companion).
        // Verbs: LISTEN / INVESTIGATE / WAIVE.
        noShowBill: resolve(__dirname, 'no-show-bill-prototype.html'),
        // Map editor: a dev-only authoring tool for level1's object
        // placement and orientation. Click any object to select it,
        // then rotate/flip via keyboard or drag to move. Outputs a
        // tileMeta + tileOverrides snippet to paste back into
        // src/content/maps/level1.ts. Lives at /map-editor.html.
        mapEditor: resolve(__dirname, 'map-editor.html'),
        // Intro editor: beat-by-beat browser, voiceover scrubber,
        // and live edit/export for src/scenes/introBeats.ts.
        // "Open game at this beat" deep-links to /?introBeat=N
        // (BootScene reads the URL param and forwards to IntroScene).
        // Lives at /intro-editor.html.
        introEditor: resolve(__dirname, 'intro-editor.html'),
        // Level / case-order editor: drag-reorder the 32 Case
        // entries in src/content/case-order.ts. Outputs a paste-back
        // TS snippet. Planning surface for the narrative re-work
        // toward a "one level per case" model. Lives at
        // /level-editor.html.
        levelEditor: resolve(__dirname, 'level-editor.html'),
        // Dev tools index — single page that links every authoring +
        // diagnostic page in one place. Bookmark this. Lives at
        // /dev.html on GitHub Pages.
        dev: resolve(__dirname, 'dev.html'),
        // Sprite redraw preview — click-to-pick interface for
        // procedurally-drawn 16×16 sprite variants (cars, lamps,
        // recliners, armchairs, etc.). Renders each variant on a
        // canvas using the same Phaser Graphics primitives that
        // BootScene.makeHospitalTiles uses, so what you see IS what
        // the game would render. Lives at /sprite-redraw-preview.html.
        spriteRedrawPreview: resolve(__dirname, 'sprite-redraw-preview.html'),
        // Room redraw preview — click-to-pick interface for full
        // room layouts (parking lot, lecture hall, lobby, etc.). Each
        // canvas renders the entire room with walls, doors, props in
        // tile positions matching the level1.ts MapDef format. Lives
        // at /room-redraw-preview.html.
        roomRedrawPreview: resolve(__dirname, 'room-redraw-preview.html'),
      },
      output: {
        // Pull Phaser into its own vendor chunk. The framework is the
        // bulk of the bundle (~1.3 MB) and never changes between
        // deploys, so an immutable filename means returning visitors
        // re-use the cached copy and only re-download the much smaller
        // game-logic chunk when we ship updates.
        manualChunks(id) {
          if (id.includes('node_modules/phaser')) return 'phaser'
        },
      },
    },
    // Bumped explicitly because phaser is a known-large vendor chunk;
    // we don't want the > 500 kB warning on every build.
    chunkSizeWarningLimit: 1500,
  },
})
