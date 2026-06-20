// All Case recap data, single source of truth. Both the Case
// prototypes (src/<case>-prototype/main.ts) and the prototype
// catalog (src/prototypes/main.ts) read from this map.
//
// Keys are the Case id used in prototypes/main.ts (the prototype
// directory name minus the -prototype suffix).
//
// Authored May 2026 — extracted from per-Case inline RECAPs by
// scratch/extract_recaps.py. To add a new Case, write its recap
// here and import CASE_RECAPS['<id>'] from the Case main.ts.
import type { CaseRecap } from '../shared/prototype-base'

export const CASE_RECAPS: Record<string, CaseRecap> = {
  'intro': {
    oneLineRecap: "You amended Anjali Patel's claim to her own subscriber ID — the card she handed over at the counter was her husband's, the 837 went out under his ID, and the 271 eligibility response showed her on the plan as a dependent under her own ID all along.",
    keyConcepts: [
      { term: 'Subscriber vs dependent', gist: 'On a family plan, the subscriber is the policyholder; spouses and children are dependents. Each member has their own subscriber ID. Boxes 1a (insured ID) and 4 (insured name) on the CMS-1500 must match the payer\'s roster for the patient — not the household.' },
      { term: '270/271 eligibility', gist: 'The X12 270 is the real-time "is this patient covered?" query; the 271 is the payer\'s response. Run it before the visit (or before resubmitting after a CO-31). It\'s the source of truth for member ID, plan, effective dates, and copay — not the photocopy of the card.' },
      { term: 'CO-31 (patient cannot be identified as our insured)', gist: 'Clerical denial: the demographic info on the claim doesn\'t match the payer\'s member record. Almost always fixed by amending Box 1a or the patient name to match the 271 response, then resubmitting. No appeal needed — just a clean correction.' },
      { term: 'Amending a field', gist: 'Open the disputed field on the claim, pick the value the chart + payer record actually support, resubmit. Most denials in your queue will be exactly this: a small thing, fixed cleanly, before it becomes someone\'s collections problem.' },
    ],
    resources: [
      { title: 'CMS — CMS-1500 Form Instructions', url: 'https://www.cms.gov/medicare/billing/electronicbillingeditrans/15001500', note: 'Field-by-field instructions for the CMS-1500, including Boxes 1a–11 (insured info).' },
      { title: 'X12 — 270/271 Eligibility Transactions', url: 'https://x12.org/examples/005010x279/eligibility-benefit-inquiry-and-response', note: 'The standard for real-time eligibility queries. Mandated under HIPAA for electronic transactions.' },
      { title: 'CAQH CORE — Eligibility Operating Rules', url: 'https://www.caqh.org/core/eligibility-and-benefits-rules', note: 'Operating rules that bind payers to specific 271 response content (member ID, copay, deductible).' },
      { title: 'WPC — CARC/RARC Code Lists', url: 'https://x12.org/codes/claim-adjustment-reason-codes', note: 'Authoritative list of Claim Adjustment Reason Codes — including CO-31 and the rest of the demographic-mismatch family.' },
    ],
  },
  'asp-wac-apothecary': {
    oneLineRecap: 'You decoded a Part B drug payment by reconciling ASP-vs-WAC pricing, J-code units, and NDC-vs-HCPCS — and recovered the right reimbursement.',
    keyConcepts: [
      { term: 'ASP+6%', gist: 'Medicare Part B pays drugs at the Average Sales Price + 6% (manufacturer-reported, CMS-published quarterly). 340B drugs paid at the same ASP+6% post-Becerra.' },
      { term: 'WAC vs ASP', gist: 'WAC = Wholesale Acquisition Cost (list price). ASP = Average Sales Price (real, post-rebate). New drugs are paid at WAC + 3% until ASP data is available (~6 months).' },
      { term: 'J-code units', gist: 'HCPCS J-codes describe the drug + the dose unit. Wrong unit count = systematic underpayment. E.g. J3490 50mg = 1 unit; if you bill 50 units the dispute is on you.' },
    ],
    resources: [
      { title: 'CMS — Part B Drug Pricing Files', url: 'https://www.cms.gov/medicare/payment/part-b-drugs/asp-pricing-files', note: 'Quarterly ASP files + the published ASP+6% rates.' },
      { title: 'CMS — HCPCS J-Code Reference', url: 'https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system', note: 'The J-code set + dose-unit definitions.' },
      { title: 'FDA NDC Directory', url: 'https://www.accessdata.fda.gov/scripts/cder/ndc/', note: "Crosswalk NDC codes (manufacturer's SKU) to HCPCS J-codes." },
    ],
  },
  'audit-boss': {
    oneLineRecap: "You defended Margaret Holloway's UB-04 against three audit findings — picked RECEIPT for the two defensible ones, AMEND for the real billing error, kept the recoupment to $340 against an $11,970 exposure.",
    keyConcepts: [
      { term: 'RECEIPT vs AMEND', gist: "RECEIPT = defend the original work with chart evidence (you were right, here's the proof). AMEND = concede + accept the recoupment (you were wrong, here's the corrected claim)." },
      { term: 'Audit defense rhythm', gist: "Read each finding cold. Distinguish documentation gaps from coding errors. Concede fast on real errors so you don't spend goodwill defending the indefensible." },
      { term: 'RAC findings', gist: 'Recovery Audit Contractor findings are recoupment demands. You have appeal rights, but the burden of proof is on the provider. Documentation > argumentation.' },
    ],
    resources: [
      { title: 'CMS — Recovery Audit Program', url: 'https://www.cms.gov/research-statistics-data-and-systems/monitoring-programs/medicare-ffs-compliance-programs/recovery-audit-program', note: 'The RAC framework + the appeal levels.' },
      { title: 'CMS — Five Levels of Medicare Appeals', url: 'https://www.cms.gov/medicare/appeals-and-grievances/orgmedffsappeals', note: 'The full appeal chain from redetermination to federal court.' },
      { title: 'AHIMA — Audit Response Best Practices', url: 'https://www.ahima.org/', note: 'Industry guidance on audit response programs + documentation.' },
    ],
  },
  'bundle': {
    oneLineRecap: 'You unbundled a CO-97 denial by adding modifier 25 to the E&M line, citing the NCCI edit, and showing the procedure was significant + separately identifiable.',
    keyConcepts: [
      { term: 'CO-97 (procedure or service is bundled)', gist: 'The payer rolled this code into a primary service. Resolution: prove the service was significant + separately identifiable AND apply the right modifier (most often 25 or 59).' },
      { term: 'Modifier 25', gist: 'Significant, separately identifiable E&M service performed by the same physician on the same day as a procedure. Belongs on the E&M line, not the procedure.' },
      { term: 'NCCI edits', gist: 'CMS\'s National Correct Coding Initiative tables that drive most CO-97 denials. Each edit pair has a "1" or "0" indicator — 1 means a modifier can break the bundle; 0 means it can\'t.' },
    ],
    resources: [
      { title: 'CMS NCCI Coding Edits', url: 'https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits', note: 'The NCCI edit tables themselves + quarterly updates.' },
      { title: 'CMS NCCI Policy Manual', url: 'https://www.cms.gov/medicare/coding-billing/national-correct-coding-initiative-ncci-edits/medicare-ncci-policy-manual', note: 'Chapter-by-chapter rationale for the edits. Pulls the curtain back.' },
      { title: 'CMS Modifier Quick Reference (MLN)', url: 'https://www.cms.gov/files/document/mln006764-evaluation-management-services.pdf', note: 'When 25 applies, when 57 applies, when neither does.' },
    ],
  },
  'carveout-phantom': {
    oneLineRecap: 'You walked the contract chain on a two-bills-for-one-visit ER, applied the right NSA carve-out, and routed the rate dispute through IDR — not the patient.',
    keyConcepts: [
      { term: 'Facility vs physician billing', gist: 'In-network facility + OON physician group is the most common surprise-bill scenario. The NSA carve-out applies to the physician bill; the patient owes only in-network cost-sharing.' },
      { term: 'Trace the contract chain', gist: "Each player — facility, physician group, anesthesiologist, radiologist — has a separate contract with the payer. The NSA applies based on each contract's in/out-of-network status." },
      { term: 'IDR routes payer↔provider', gist: 'The patient is out of the rate dispute once cost-share is correctly calculated. The OON physician group + the payer fight in IDR.' },
    ],
    resources: [
      { title: '45 CFR 149.110-130 — Patient Protections', url: 'https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-149/subpart-B', note: 'The NSA balance-billing protections.' },
      { title: 'CMS — Provider Notice + Consent (149.420)', url: 'https://www.cms.gov/nosurprises/policies-and-resources/provider-requirements-and-resources', note: 'When OON providers may ask patients to waive NSA protections (post-stabilization, scheduled).' },
      { title: 'AHA — NSA Implementation Guide', url: 'https://www.aha.org/surprise-billing-resources', note: 'Operational walkthrough for facility + physician group contract alignment.' },
    ],
  },
  'case-rate-specter': {
    oneLineRecap: 'You reprised an underpayment behind a CO-45 by reading the contract — case-rate vs outlier-provision split — and recovered the shortfall the static fee table had hidden.',
    keyConcepts: [
      { term: 'Case rate', gist: 'A flat per-admission payment by DRG or service category. Simpler than per-diem; harder to challenge unless the case has outlier characteristics.' },
      { term: 'Outlier provision', gist: 'Most case-rate contracts have an outlier clause: when charges exceed a threshold (often 2x or 3x the case rate, sometimes a fixed dollar threshold), payment converts to percent-of-charges.' },
      { term: 'Contract repricing', gist: "When the EOB pays the case rate but the contract's outlier clause was triggered, the right move is to reprice using the contract — not appeal the denial." },
    ],
    resources: [
      { title: 'CMS — Inpatient Outlier Payments', url: 'https://www.cms.gov/medicare/medicare-fee-for-service-payment/acuteinpatientpps/outlier', note: "How Medicare's outlier methodology works — model for many commercial contracts." },
      { title: 'AHA — Contract Modeling Guide', url: 'https://www.aha.org/', note: 'Best practices for verifying contracted rates against EOBs.' },
      { title: 'HFMA — Underpayment Recovery Programs', url: 'https://www.hfma.org/topics/revenue-cycle/', note: 'Systematic approach to reprice + recover.' },
    ],
  },
  'chemo-bundle-specter': {
    oneLineRecap: 'You recovered a chemo administration underpayment — initial vs sequential infusion codes, drug J-codes, frequency caveats — under the contract-management system overlay.',
    keyConcepts: [
      { term: 'Initial vs sequential infusion', gist: 'CPT 96413 (initial), 96415 (each additional hour), 96417 (sequential infusion of a different drug). Wrong sequence = CO-97 bundling denial.' },
      { term: 'Drug J-codes', gist: 'Each chemo agent has its own J-code + dose units. Bevacizumab Q5107 (biosimilar) at 100mg/unit. Miscalculated units underpay 1:1.' },
      { term: 'Contract-management systems', gist: 'Hospital CMS overlays maintain payer-specific reimbursement rules (oncology fee schedules, biosimilar substitutions, prior-auth requirements). EOB review against the CMS catches structural underpayments.' },
    ],
    resources: [
      { title: 'CMS — Hospital Outpatient Prospective Payment System (OPPS)', url: 'https://www.cms.gov/medicare/payment/prospective-payment-systems/hospital-outpatient', note: 'OPPS rules including chemo administration + drug payment.' },
      { title: 'ASCO — Coding & Reimbursement', url: 'https://www.asco.org/practice-policy/billing-coding', note: 'Oncology-specific billing guidance from the American Society of Clinical Oncology.' },
      { title: 'CMS — Hospital Outpatient Quarterly Update Pricer', url: 'https://www.cms.gov/medicare/payment/prospective-payment-systems/hospital-outpatient', note: 'Quarterly pricer files for chemo administration codes + drug payment rates.' },
    ],
  },
  'cob-cascade-spider': {
    oneLineRecap: 'You ran the COB cascade for three patients on one household policy — birthday rule, MSP working-aged, payer-of-last-resort — and refiled each claim against the right primary.',
    keyConcepts: [
      { term: 'Birthday rule', gist: "For dependent children with two parents on different plans, the parent whose birthday falls EARLIER in the calendar year is primary (year doesn't matter — month + day)." },
      { term: 'MSP working-aged', gist: "For Medicare-eligible employees (age 65+) covered by an employer's GHP with 20+ employees, the GHP is primary; Medicare is secondary. Reverse for employers under 20." },
      { term: 'Payer-of-last-resort', gist: 'Medicaid is always last. If the patient has any other coverage (Medicare, commercial), Medicaid pays only after those have adjudicated.' },
    ],
    resources: [
      { title: 'CMS — Coordination of Benefits & Recovery Center', url: 'https://www.cms.gov/medicare/coordination-benefits-recovery/overview', note: 'The Medicare COB program + the BCRC contractor.' },
      { title: 'NAIC Coordination of Benefits Model Regulation', url: 'https://www.naic.org/cipr_topics/coordination_benefits.htm', note: 'The model COB rules most states adopt — birthday rule, primary/secondary order.' },
      { title: 'SSA — Medicare Secondary Payer (MSP) Manual', url: 'https://www.ssa.gov/OP_Home/cfr20/404/404-0408.htm', note: 'Title XVIII rules on when Medicare is secondary.' },
    ],
  },
  'cpt-licensure-mire': {
    oneLineRecap: 'You walked the AMA CPT licensing chain at a charity clinic audit, picked the right tier, and found the HCPCS Level II alternative codes where they exist.',
    keyConcepts: [
      { term: 'AMA CPT licensing', gist: 'CPT codes are AMA-owned IP. Most software vendors and providers pay royalty + license fees. The federal government has a special exemption.' },
      { term: 'HCPCS Level II', gist: 'CMS-published codes (the "G", "Q", "S" code families) covering services CPT doesn\'t — DME, supplies, certain procedures. Royalty-free.' },
      { term: 'Federal exemption', gist: 'Federally-funded programs (Medicare, Medicaid) have a license to use CPT for claims. Charity clinics serving those populations may qualify for reduced fees.' },
    ],
    resources: [
      { title: 'AMA CPT Licensing FAQ', url: 'https://www.ama-assn.org/practice-management/cpt', note: "AMA's licensing tiers + the application process." },
      { title: 'CMS HCPCS Level II Quarterly Update', url: 'https://www.cms.gov/medicare/coding-billing/healthcare-common-procedure-system', note: 'The HCPCS Level II code set + quarterly additions.' },
      { title: '45 CFR 162.1002 — HIPAA Code Sets', url: 'https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-162/subpart-J', note: 'The federally-mandated code sets — CPT, HCPCS, ICD-10 — for HIPAA-covered transactions.' },
    ],
  },
  'credentialing-lattice': {
    oneLineRecap: 'You walked a credentialing problem — NPI types, taxonomy alignment, payer-specific delegation — and recovered the retroactive effective date so the claims could refile.',
    keyConcepts: [
      { term: 'Type 1 vs Type 2 NPIs', gist: 'Type 1 = individual provider. Type 2 = organization (group practice, hospital, clinic). Most claims need both — the rendering Type 1 + the billing Type 2.' },
      { term: 'Taxonomy alignment', gist: 'Each NPI carries one or more taxonomy codes. The taxonomy on the claim must match what the payer has credentialed — mismatch = CO-185 or CO-208.' },
      { term: 'Retroactive effective dates', gist: 'Credentialing delays are common. Most payers will backdate the effective date to the application-received date if you push — recovering 60-90 days of previously-denied claims.' },
    ],
    resources: [
      { title: 'NPPES NPI Registry', url: 'https://npiregistry.cms.hhs.gov/', note: 'Look up any NPI for type, taxonomy, and registered locations.' },
      { title: 'NUCC Provider Taxonomy Code Set', url: 'https://taxonomy.nucc.org/', note: 'The taxonomy hierarchy — Type 1 specialties, Type 2 group types.' },
      { title: 'CAQH ProView', url: 'https://proview.caqh.org/', note: 'The industry credentialing data hub. Most commercial payers source from here.' },
    ],
  },
  'doppelganger': {
    oneLineRecap: 'You resolved a CO-18 duplicate flag by filing the resubmission as a frequency-7 replacement of the original ICN — version control, not a re-fight.',
    keyConcepts: [
      { term: 'CO-18 (exact duplicate claim/service)', gist: 'The payer sees two claims that look identical and pays neither. Two correct fixes: frequency-code-7 replacement (most cases) or frequency-code-8 void+rebill.' },
      { term: 'Frequency code 7 (replacement)', gist: 'Says "replace this claim, here\'s the original ICN, here\'s the corrected version." Belongs in CLM05-3 of the X12 837.' },
      { term: 'Original ICN reference', gist: "Frequency-7 replacements MUST cite the original Internal Control Number (ICN/DCN). Without it, the payer treats it as a brand-new claim and you're back at CO-18." },
    ],
    resources: [
      { title: 'CMS — Frequency Codes (UB-04 Manual)', url: 'https://www.cms.gov/medicare/coding-billing/icd-10-codes', note: 'Type-of-bill third-position frequency code reference.' },
      { title: 'X12 837P Implementation Guide — CLM05-3', url: 'https://x12.org/products', note: 'The frequency-type code field for professional claims.' },
      { title: 'CMS Claim Adjustment Reason Codes', url: 'https://x12.org/codes/claim-adjustment-reason-codes', note: 'CO-18 + the rest of the CARC family.' },
    ],
  },
  'fog': {
    oneLineRecap: "You ran a 270 eligibility inquiry pre-submit, used the 271 response to surface the field discrepancy, and amended the claim before it ever met the payer's adjudicator.",
    keyConcepts: [
      { term: 'X12 270 / 271', gist: "270 = eligibility inquiry sent to the payer; 271 = the payer's response (active/inactive coverage, copay/coinsurance, plan details). Real-time exchanges; usually free." },
      { term: 'Pre-submission verification', gist: 'The fight you win on the front end. Catching a wrong member ID, terminated coverage, or wrong-payer-of-record before submission saves a denial cycle.' },
      { term: 'Roster vs claim mismatch', gist: 'The most common eligibility break: registration captured one name/DOB/ID combination; the payer has a different one on file. The 271 surfaces both.' },
    ],
    resources: [
      { title: 'CMS — Eligibility (X12 270/271)', url: 'https://www.cms.gov/medicare/coding-billing/electronic-billing', note: "CMS's reference for Medicare eligibility transactions." },
      { title: 'CAQH CORE — Eligibility Operating Rules', url: 'https://www.caqh.org/core/operating-rules', note: 'Payer obligations on the 270/271 — turnaround times, content requirements.' },
      { title: 'X12 — 270/271 Implementation Guide', url: 'https://x12.org/products', note: 'The standard itself, including data segments + return codes.' },
    ],
  },
  'form-mirror': {
    oneLineRecap: 'You detected a CMS-1500 / 837P that should have been UB-04 / 837I, mapped institutional-only fields to the right form locators, and rerouted the resubmission.',
    keyConcepts: [
      { term: 'UB-04 (837I) vs CMS-1500 (837P)', gist: 'Institutional services (hospitals, SNFs, home health) bill UB-04 / 837I. Professional services (physicians, NPPs) bill CMS-1500 / 837P. Wrong form = clearinghouse rejection (CO-95).' },
      { term: 'Form locator vs box number', gist: 'UB-04 uses Form Locators (FL 1, FL 4, etc.). CMS-1500 uses Box numbers (Box 1, Box 24, etc.). Same data, different addresses.' },
      { term: 'Institutional-only fields', gist: "Type of bill (FL 4), revenue codes, condition codes, occurrence codes — these don't exist on CMS-1500. A facility claim sent on CMS-1500 is missing the spine of its data." },
    ],
    resources: [
      { title: 'CMS — UB-04 Claim Form Manual', url: 'https://www.cms.gov/medicare/coding-billing/electronic-billing', note: 'The UB-04 reference + FL definitions.' },
      { title: 'CMS — CMS-1500 Form Instructions', url: 'https://www.cms.gov/medicare/cms-forms/cms-forms/downloads/cms1500.pdf', note: 'The CMS-1500 box-by-box instructions.' },
      { title: 'NUCC — CMS-1500 Reference Instruction Manual', url: 'https://www.nucc.org/index.php/1500-claim-form-mainmenu-35', note: 'Authoritative CMS-1500 instructions maintained by the National Uniform Claim Committee.' },
    ],
  },
  'gatekeeper': {
    oneLineRecap: 'You filed a retroactive 278 prior-auth request, transcribed the auth number onto Box 23 of the resubmitted claim, and unblocked a CO-197 denial.',
    keyConcepts: [
      { term: 'CO-197 (precert/auth absent)', gist: "The service required prior authorization and one wasn't obtained — or wasn't recorded. Resolution: file the auth retroactively (some payers allow), then refile with the auth number on the claim." },
      { term: 'X12 278 transaction', gist: 'The standard EDI prior-auth request/response. Most payers also accept fax + portal submissions; the 278 is what trading partners use.' },
      { term: 'Box 23 / Field 63', gist: 'CMS-1500 Box 23 (or UB-04 Field 63) is where the auth number lives once it comes back. Forgetting to populate it = same denial again.' },
    ],
    resources: [
      { title: 'CMS — Prior Authorization', url: 'https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-prior-authorization-final-rule-cms-0057-f', note: 'The federal stance on PA, including the new (2026) interoperability rule.' },
      { title: 'X12 — 278 Transaction Standard', url: 'https://x12.org/products', note: 'The EDI standard reference + implementation guides.' },
      { title: 'CAQH CORE — PA Operating Rules', url: 'https://www.caqh.org/core/operating-rules', note: 'Industry operating rules for PA exchange. Most payers attest compliance with these.' },
    ],
  },
  'gfe-oracle': {
    oneLineRecap: "You produced a Good Faith Estimate within 3 business days of the self-pay patient's scheduled procedure — itemized, estimated, committed — covering the convening provider AND the co-providers.",
    keyConcepts: [
      { term: 'GFE under the No Surprises Act', gist: 'For uninsured/self-pay patients, the convening provider must furnish a GFE within 3 business days of scheduling (or 1 business day for procedures within 3 days).' },
      { term: 'Convening provider vs co-provider', gist: 'The convening provider organizes the GFE — must include their charges AND the expected charges from co-providers (anesthesia, pathology, etc.).' },
      { term: 'AEOB (deferred)', gist: 'For insured patients, the equivalent is an Advance Explanation of Benefits — currently in deferred enforcement. Watch the CMS rulemaking.' },
    ],
    resources: [
      { title: '45 CFR 149.610 — Good Faith Estimates', url: 'https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-149/subpart-G/section-149.610', note: 'The GFE regulation for uninsured/self-pay.' },
      { title: 'CMS — GFE Guidance', url: 'https://www.cms.gov/nosurprises/help-resolve-payment-disputes', note: 'CMS resources, sample GFE templates, the patient-provider dispute resolution process.' },
      { title: 'AHA — GFE Implementation Toolkit', url: 'https://www.aha.org/', note: 'Operational guidance on convening-provider workflows.' },
    ],
  },
  'hipaa-spider': {
    oneLineRecap: 'You triaged a HIPAA breach event — risk-assessment, OCR self-disclosure, mitigation steps — without conflating accidental disclosure with willful neglect.',
    keyConcepts: [
      { term: 'Breach notification rule', gist: '45 CFR 164.400-414. Acquisition/access/use/disclosure of unsecured PHI not permitted under the Privacy Rule. Notification to affected individuals + HHS within 60 days for breaches affecting 500+; annual log otherwise.' },
      { term: 'Risk assessment', gist: 'Probability that PHI was compromised — based on nature/extent of PHI, unauthorized recipient, whether PHI was actually viewed or acquired, mitigation extent. Determines whether an event is a breach.' },
      { term: 'OCR self-disclosure', gist: "HIPAA's self-disclosure mechanism is the breach notification itself + voluntary corrective action. Cooperative posture vastly reduces penalties (willful neglect carries minimum $50,000/violation)." },
    ],
    resources: [
      { title: 'HHS OCR — Breach Notification Portal', url: 'https://ocrportal.hhs.gov/ocr/breach/wizard_breach.jsf', note: 'The actual reporting mechanism + breach search archive.' },
      { title: '45 CFR 164.400-414 — Breach Notification Rule', url: 'https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-D', note: 'The federal breach-notification regulation.' },
      { title: 'HHS — HIPAA Privacy + Security Rules', url: 'https://www.hhs.gov/hipaa/for-professionals/privacy', note: 'Foundational HIPAA documentation for compliance programs.' },
    ],
  },
  'idr-crucible': {
    oneLineRecap: 'You filed an Independent Dispute Resolution submission against a wrong-bucket QPA, picked the defensible market median over the billed charge or the just-above-QPA decoy, and won baseball-style arbitration on the merits.',
    keyConcepts: [
      { term: 'QPA methodology', gist: 'The plan\'s median in-network rate keyed by service + specialty + region + plan type. Excludes single-case agreements and risk-bearing payments. Plans must disclose the methodology within 30 days of provider request.' },
      { term: 'Specialty + setting bucket', gist: 'Same CPT code can carry different QPAs depending on who billed and where. Cardiology-elective ≠ cardiology-emergency-ED. Wrong-bucket QPAs are the most-litigated IDR challenge ground.' },
      { term: 'Baseball arbitration', gist: 'Each side submits ONE final offer; the arbitrator picks one — no splitting, no averaging. Submit too high → arbitrator picks the QPA. Submit too low → leave money on the table.' },
      { term: 'Additional credible information', gist: 'After Texas Medical Association v HHS killed the QPA presumption, arbitrators weigh the QPA alongside provider training, service complexity, market data, and prior negotiations. Strong ACI can flip the decision.' },
    ],
    resources: [
      { title: '45 CFR 149.140 — QPA methodology', url: 'https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-149/subpart-D/section-149.140', note: 'The regulation that defines what goes into the QPA, what\'s excluded, and the disclosure obligations.' },
      { title: '45 CFR 149.510 — Federal IDR process', url: 'https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-149/subpart-G/section-149.510', note: 'The IDR mechanic itself: open negotiation, certified IDR entity, baseball arbitration, ACI factors.' },
      { title: 'CMS Federal IDR Process — provider portal', url: 'https://www.cms.gov/nosurprises/help-resolve-payment-disputes', note: 'CMS guidance, batching rules, current arbitration entity list, fee schedule.' },
      { title: 'Texas Medical Association v HHS (TMA III) ruling', url: 'https://www.govinfo.gov/app/details/USCOURTS-txed-6_22-cv-00450', note: 'The 2023 E.D. Tex. ruling that struck the QPA presumption from the IDR rule. Foundation for current arbitrator-discretion regime.' },
    ],
  },
  'implant-carveout-specter': {
    oneLineRecap: "You unbundled an implant from the DRG case rate by appending the contract's invoice-cost-plus-20% carveout — recovering the surgical-implant cost the case rate had absorbed.",
    keyConcepts: [
      { term: 'Implant carveouts', gist: 'Most surgical contracts carve out high-cost implants (typically > $1,000-$5,000 invoice cost) — paid separately at invoice cost + a markup (often 10-20%).' },
      { term: 'Itemize + invoice-match', gist: 'Carveouts require the original invoice on the claim. Append the supplier invoice as supporting documentation; the claim must reference invoice number + line item.' },
      { term: 'Case-rate absorption', gist: 'Without the carveout flag, the implant is rolled into the DRG case rate. A $12,000 cardiac stent absorbed into a $14,000 case rate is a $12,000 underpayment.' },
    ],
    resources: [
      { title: 'CMS — Inpatient Prospective Payment System (IPPS)', url: 'https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps', note: 'How CMS handles high-cost implants — model for many commercial contracts.' },
      { title: 'AHA — Implant Carveout Guide', url: 'https://www.aha.org/', note: 'Industry guidance on implant carveout language + reimbursement.' },
      { title: 'HFMA — Underpayment Recovery', url: 'https://www.hfma.org/topics/revenue-cycle/', note: 'Systematic approach to identifying contract carveouts in EOB review.' },
    ],
  },
  'lighthouse': {
    oneLineRecap: "You screened a patient against the FPL ladder, qualified them for charity care under the hospital's 501(r) policy, and routed the $87,420 bill out of collections instead of into them.",
    keyConcepts: [
      { term: '501(r)', gist: 'The IRC section governing nonprofit hospital obligations: written financial-assistance policy (FAP), widely-publicized eligibility, limitations on charges to FAP-eligible patients.' },
      { term: 'FPL ladder', gist: 'Federal Poverty Level. Hospitals set their own thresholds — usually 100% / 200% / 400% FPL — for free care, partial discount, sliding scale.' },
      { term: 'Charity vs bad debt', gist: 'Charity care is unpaid by design (financial assistance policy granted). Bad debt is unpaid because collection failed. Treating one as the other costs the hospital + the patient.' },
    ],
    resources: [
      { title: 'IRS § 501(r) — Hospital Requirements', url: 'https://www.irs.gov/charities-non-profits/charitable-organizations/requirements-for-501c3-hospitals-under-the-affordable-care-act-section-501r', note: 'The federal requirements for nonprofit hospitals.' },
      { title: 'Catholic Health Association — Financial Assistance Toolkit', url: 'https://www.chausa.org/finance/financial-assistance', note: 'Practical FAP design + screening protocols.' },
      { title: 'HHS — Federal Poverty Level Guidelines', url: 'https://aspe.hhs.gov/topics/poverty-economic-mobility/poverty-guidelines', note: 'Annual FPL tables. The thresholds shift each January.' },
    ],
  },
  'mrf-cartographer': {
    oneLineRecap: 'You built the machine-readable file row by row from the chargemaster (hard-coded services) and claim history (soft-coded services), with per-payer-discrete rates plus de-identified min/max.',
    keyConcepts: [
      { term: 'Hard-coded vs soft-coded', gist: 'Hard-coded services live in the CDM (chargemaster) with a fixed CPT/HCPCS — straight read. Soft-coded services are HIM-assigned post-encounter from documentation — must be derived from claim history.' },
      { term: '45 CFR 180.50 — MRF requirements', gist: 'Hospitals must publish a machine-readable file with per-payer-discrete negotiated rates (not medians) plus de-identified min/max for each shoppable service. Updated annually.' },
      { term: 'Service-package buckets', gist: 'The MRF lists items by gross charge, discounted cash price, payer-specific negotiated charge, de-identified min, de-identified max — all five for every shoppable service.' },
    ],
    resources: [
      { title: '45 CFR 180.50 — Machine-Readable Files', url: 'https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-180/subpart-B/section-180.50', note: 'The MRF regulation. Read the standard and the schema.' },
      { title: 'CMS Hospital Price Transparency', url: 'https://www.cms.gov/hospital-price-transparency', note: 'CMS guidance, schema templates, enforcement notices.' },
      { title: 'CMS MRF Schema (GitHub)', url: 'https://github.com/CMSgov/hospital-price-transparency', note: 'Reference JSON/CSV schemas for compliant MRFs.' },
    ],
  },
  'no-show-bill': {
    oneLineRecap: 'You handled a missed-appointment billing situation — Medicare prohibition, commercial allowability, patient-financial-hardship pathway — without violating policy or burning the relationship.',
    keyConcepts: [
      { term: 'Medicare prohibition', gist: "Medicare does NOT allow providers to bill the patient for missed appointments unless the practice has a uniformly-applied written policy (CMS Carrier Manual 30-3). Most don't bother." },
      { term: 'Commercial allowability', gist: "Commercial payers don't restrict no-show fees — but the patient pays out of pocket; the payer doesn't cover them." },
      { term: 'Hardship pathway', gist: 'Many practices waive no-show fees on first occurrence + for documented hardship. Routes through the same financial-assistance policy that handles charity care.' },
    ],
    resources: [
      { title: 'CMS Carrier Manual — Missed Appointment Charges', url: 'https://www.cms.gov/regulations-and-guidance/guidance/manuals/internet-only-manuals-ioms', note: "Medicare's rule: practice may charge IF policy applies uniformly to all patients (Medicare + others)." },
      { title: 'AAFP — Missed Appointment Policies', url: 'https://www.aafp.org/', note: 'Family-medicine guidance on practice-level no-show policy design.' },
      { title: 'AMA — Office Practice Management', url: 'https://www.ama-assn.org/', note: "AMA's no-show policy templates + patient communication." },
    ],
  },
  'ob-perdiem-specter': {
    oneLineRecap: 'You recovered an OB underpayment by parsing the case-rate + per-diem hybrid contract, allocating each day correctly, and filing the corrected claim with the per-diem days.',
    keyConcepts: [
      { term: 'Case-rate + per-diem hybrid', gist: 'Common in OB contracts: case rate covers days 1-2; per-diem (e.g. $1,400/day) for days 3+. Stays under 3 days = case rate only. Stays 3+ days = mixed payment.' },
      { term: 'Mutually-INclusive provisions', gist: 'The trap: case rate AND per-diem both apply to the same stay (different days), not either-or. Reading "case rate covers days 1-2" as exclusive misses the per-diem days.' },
      { term: 'Complications without re-DRGing', gist: "A complication that extends a stay (e.g. newborn phototherapy, maternal infection) often DOESN'T change the DRG — but does extend the stay into per-diem territory." },
    ],
    resources: [
      { title: 'CMS — IPPS / DRG Files', url: 'https://www.cms.gov/medicare/payment/prospective-payment-systems/acute-inpatient-pps', note: 'DRG definitions + Medicare per-diem methodologies (model for many commercial contracts).' },
      { title: 'AHIMA — OB Coding & Billing', url: 'https://www.ahima.org/', note: 'Industry guidance on labor-and-delivery DRG assignment + complication coding.' },
      { title: 'HFMA — Contract-Modeling Best Practices', url: 'https://www.hfma.org/topics/revenue-cycle/', note: 'Verification techniques for hybrid case-rate / per-diem contracts.' },
    ],
  },
  'outpatient-surgery-grouper': {
    oneLineRecap: "You modeled an OPG-based reimbursement against the UHC contract's outpatient-surgery grouping methodology, identified the multiple-procedure discount tier, and recovered the contract-vs-EOB shortfall.",
    keyConcepts: [
      { term: 'OPG vs APC', gist: "UHC's Outpatient Procedure Grouper (OPG) is a proprietary grouping methodology that bundles multiple outpatient procedures into a single payment tier — different from CMS's APC system." },
      { term: 'Multiple-procedure discount', gist: 'Most OPG contracts pay 100% of the highest-tier procedure + 50% of additional procedures (sometimes 25% for 3+). Misreading the discount stacks underpayments.' },
      { term: 'Tier walking', gist: 'Verify each line: which procedure landed in which OPG tier, what discount applied, what the contracted rate yields. EOB rarely shows the math.' },
    ],
    resources: [
      { title: 'UHC — Outpatient Surgery Grouper Reference', url: 'https://www.uhcprovider.com/en/resource-library/news/2025/outpatient-procedure-codes-for-reimbursement.html', note: "UHC's public OPG reference (the actual contract has the rate tables)." },
      { title: 'CMS — APC Reference (model for OPG)', url: 'https://www.cms.gov/medicare/payment/prospective-payment-systems/hospital-outpatient', note: "How Medicare's APC grouper works — useful comparison to OPG." },
      { title: 'AHA — Contract Modeling', url: 'https://www.aha.org/', note: 'Hospital-side guidance on OPG-style proprietary groupers.' },
    ],
  },
  'phantom-patient': {
    oneLineRecap: 'You resolved an identity-mismatch denial by matching against the registration record, surfacing the wrong DOB at intake, and preventing the same break next visit.',
    keyConcepts: [
      { term: 'Patient matching', gist: 'Registration captures name + DOB + SSN/MRN; the payer matches against their member roster. A character off in the DOB or a hyphen in the last name breaks the match.' },
      { term: 'Identity verification', gist: 'EMPI (enterprise master patient index) systems probabilistic-match across registrations, but only catch what the registrar enters correctly.' },
      { term: 'Front-end prevention', gist: 'A 270/271 eligibility check at intake catches most identity breaks before the claim ever submits. Saves a denial cycle.' },
    ],
    resources: [
      { title: 'ONC — Patient Matching Resources', url: 'https://www.healthit.gov/standards-and-technology/patient-identity-and-patient-record-matching/', note: 'Federal guidance on patient-matching standards + algorithms.' },
      { title: 'AHIMA — Patient Identification + Matching', url: 'https://www.ahima.org/', note: "AHIMA's patient-matching toolkit + best-practice registration workflows." },
      { title: 'HHS — Strategic Health IT Plan: Identity Resolution', url: 'https://www.healthit.gov/', note: 'The federal-level identity-resolution roadmap.' },
    ],
  },
  'reaper': {
    oneLineRecap: 'You filed a CO-29 timely-filing waiver under deadline pressure — citing the original submission proof + good-cause exception — without burning the appeal window on indecision.',
    keyConcepts: [
      { term: 'CO-29 (timely filing limit exceeded)', gist: "The claim arrived past the payer's filing deadline. Resolution: prove the original was timely (clearinghouse acknowledgments, fax confirmations) OR file a good-cause waiver." },
      { term: 'Filing windows vary', gist: 'Medicare: 1 calendar year from DOS. Commercial: usually 90-180 days, sometimes 365. Medicaid: state-specific. Always check the contract — never assume.' },
      { term: 'Good-cause exception', gist: "Documented circumstances outside the provider's control (catastrophic event, payer error, member-id provided wrong by patient). Different payers have different evidence standards." },
    ],
    resources: [
      { title: 'CMS — Medicare Timely Filing (MLN MM6960)', url: 'https://www.cms.gov/regulations-and-guidance/guidance/transmittals/downloads/r1815cp.pdf', note: 'The 1-calendar-year rule + the four exceptions Medicare recognizes.' },
      { title: '42 CFR 424.44 — Time limits for filing claims', url: 'https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-B/part-424/subpart-C/section-424.44', note: 'The federal regulation. Authority for any timely-filing argument with a Medicare contractor.' },
      { title: 'AAPC — Timely Filing Appeals Playbook', url: 'https://www.aapc.com/blog/47879-the-clock-is-ticking-tips-for-timely-claim-filing/', note: 'Practical good-cause arguments and the proof formats payers accept.' },
    ],
  },
  'risk-adj-hollow': {
    oneLineRecap: "You closed the HCC documentation gap by capturing the chronic conditions in this year's encounter, applying the MEAT criteria, and posting the corrected RAF.",
    keyConcepts: [
      { term: 'HCC categories', gist: "Hierarchical Condition Categories — CMS's risk-adjustment model. Each captured chronic condition bumps the patient's RAF score and the plan's capitation payment." },
      { term: 'MEAT documentation', gist: "Monitor / Evaluate / Assess / Treat. Each chronic condition must show at least one of these in the current year's notes — otherwise the HCC doesn't roll forward." },
      { term: 'Annual recapture', gist: "HCCs reset every January. Conditions documented last year must be re-documented with MEAT this year — diagnosis lists alone aren't enough." },
    ],
    resources: [
      { title: 'CMS — Medicare Advantage Risk Adjustment', url: 'https://www.cms.gov/medicare/health-plans/medicareadvtgspecratestats/risk-adjustors', note: 'The HCC model + the RAF calculation.' },
      { title: 'AAPC — HCC Coding & MEAT Documentation', url: 'https://www.aapc.com/blog/topics/hcc-coding/', note: "Coder's view of MEAT + common documentation gaps." },
      { title: 'AHIMA — Risk-Adjusted Coding Guide', url: 'https://www.ahima.org/', note: 'Health-information-management perspective on HCC capture programs.' },
    ],
  },
  'specter': {
    oneLineRecap: 'You read the 835 ERA line by line, flagged a $28 underpayment hidden behind a CO-45 contractual adjustment, and filed the appeal with the right shortfall + contract section.',
    keyConcepts: [
      { term: 'CO-45 (charge exceeds fee schedule/maximum allowable)', gist: 'Strictly informational on a normal claim — the payer is reporting the contractual write-down. The bug is when CO-45 is hiding an UNDERPAYMENT relative to the actual contracted rate.' },
      { term: 'VARIANCE detection', gist: "Compare each paid amount line against the live contract's fee schedule. Even small per-claim variances become real money at volume." },
      { term: '835 ERA structure', gist: "The 835 has CLP segments (per-claim) and SVC segments (per-service-line). The contractual adjustment lives at the line level. CO-45 + a number that doesn't match your contract = appeal." },
    ],
    resources: [
      { title: 'X12 835 Health Care Claim Payment/Advice', url: 'https://x12.org/products', note: 'The EDI standard for the ERA. Field-level reference.' },
      { title: 'CMS — ERA / 835 Companion Guide', url: 'https://www.cms.gov/medicare/coding-billing/electronic-billing', note: "CMS's implementation specifics for Medicare ERAs." },
      { title: 'Healthcare Financial Management Association — Underpayment Recovery', url: 'https://www.hfma.org/topics/revenue-cycle/', note: 'Industry guidance on systematic underpayment review programs.' },
    ],
  },
  'stoploss-reckoner': {
    oneLineRecap: 'You tripped a stoploss provision on a $312k ICU stay, recalculated payment from case rate to 65% of charges, and filed the appeal with the right shortfall.',
    keyConcepts: [
      { term: 'Stoploss / outlier provisions', gist: 'Trigger when actual charges far exceed the case rate (e.g. > 4× case rate, or fixed dollar threshold). Payment converts from case rate to a percent-of-charges (commonly 65-80%).' },
      { term: 'Mutually-EXclusive vs INclusive', gist: 'Most stoploss provisions are exclusive: payment is EITHER case rate OR percent-of-charges, not both. Misreading as inclusive double-pays — payer will not.' },
      { term: 'Threshold math', gist: 'Stoploss math is mechanical: charges > threshold → flip to percent-of-charges → calculate shortfall against case rate paid → file appeal with citation.' },
    ],
    resources: [
      { title: 'CMS — Inpatient Outlier Payments', url: 'https://www.cms.gov/medicare/medicare-fee-for-service-payment/acuteinpatientpps/outlier', note: "Medicare's outlier methodology — model for commercial stoploss provisions." },
      { title: 'AHA — Contract Stoploss Provisions', url: 'https://www.aha.org/', note: 'Hospital-side guidance on stoploss language + threshold modeling.' },
      { title: 'HFMA — Outlier Payment Recovery', url: 'https://www.hfma.org/topics/revenue-cycle/', note: 'Systematic identification of triggered stoploss claims in EOB review.' },
    ],
  },
  'surprise-bill': {
    oneLineRecap: 'You disarmed an OON balance bill from a contracted radiologist on an in-network ER scan — classified the scenario, calculated true patient cost-share, filed the protective statement under the No Surprises Act.',
    keyConcepts: [
      { term: 'NSA emergency carve-out', gist: 'Patients who receive emergency care at any facility — or care from an OON clinician at an in-network facility — pay only in-network cost-sharing. The provider/plan rate dispute is between them.' },
      { term: 'Patient cost-share = in-network', gist: 'Even if the clinician is OON, the patient sees the in-network deductible/coinsurance/copay. Anything above that is balance billing and prohibited under the NSA.' },
      { term: 'Protective notification', gist: 'When an OON provider tries to balance bill, the patient files a protective statement; the provider must refund any overage. Then the provider/plan dispute moves to IDR.' },
    ],
    resources: [
      { title: '45 CFR 149.110 — Patient Protections', url: 'https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-B/part-149/subpart-B', note: 'The NSA balance-billing prohibition.' },
      { title: 'CMS — No Surprises Act Patient FAQ', url: 'https://www.cms.gov/nosurprises', note: 'Patient-facing explainer + complaint mechanism.' },
      { title: 'CMS — Provider Notice and Consent Requirements', url: 'https://www.cms.gov/nosurprises/policies-and-resources/provider-requirements-and-resources', note: 'When OON providers can ask the patient to waive NSA protections (limited situations).' },
    ],
  },
  'swarm': {
    oneLineRecap: 'You batch-fixed 18 CO-16 rejections by finding the shared NPI/taxonomy root cause, swept the outliers individually, and patched the EHR profile so it stops happening Mondays.',
    keyConcepts: [
      { term: 'CO-16 (claim/service lacks information)', gist: 'Most often a missing or invalid identifier — NPI, taxonomy, ICN, member ID. The remark code (RARC) tells you which.' },
      { term: 'Root-cause vs case-by-case', gist: 'When N denials share a root cause, fixing the root cause once is cheaper than appealing N times. Batching the shared fix is what captures this.' },
      { term: 'Upstream patches', gist: 'Fixing the claim AND the system that produced the bad claim. Usually means an EHR ticket — provider-profile field, taxonomy crosswalk, payer-specific submission rule.' },
    ],
    resources: [
      { title: 'NUCC Provider Taxonomy Code Set', url: 'https://taxonomy.nucc.org/', note: "The taxonomy hierarchy. Every NPI must have at least one taxonomy code; CO-16 often means it's wrong." },
      { title: 'NPPES NPI Registry', url: 'https://npiregistry.cms.hhs.gov/', note: 'Look up any NPI to verify the registered taxonomy + practice locations.' },
      { title: 'CMS — Remittance Advice Remark Codes (RARCs)', url: 'https://x12.org/codes/remittance-advice-remark-codes', note: 'The current RARC list. Pair RARCs with CARCs to decode any 835 line.' },
    ],
  },
  'three-forty-b-specter': {
    oneLineRecap: 'You walked the 340B program rules, marked the state Medicaid claim with modifier UD, and self-disclosed the duplicate-discount to HRSA — making the compliance review remedial, not punitive.',
    keyConcepts: [
      { term: '340B program', gist: '42 USC §256b. Manufacturers provide deeply-discounted outpatient drugs to qualifying covered entities (DSH ≥ 11.75%, CAH, RRC, SCH, FSCH, FQHC, Ryan White, etc.). Discount in exchange for safety-net mission.' },
      { term: 'Duplicate-discount prohibition', gist: "Manufacturers can't pay BOTH the 340B discount AND a Medicaid drug rebate on the same dose. State Medicaid programs use an identifier modifier (most commonly UD) on claims to prevent it." },
      { term: 'HRSA self-disclosure', gist: 'When a duplicate-discount slip happens, voluntary disclosure to HRSA is favored — typically remediation (refund + corrective action plan). Hiding makes review punitive (program termination, FCA exposure).' },
    ],
    resources: [
      { title: 'HRSA — 340B Program Office of Pharmacy Affairs', url: 'https://www.hrsa.gov/opa', note: 'The 340B program home — eligibility, registration, compliance, self-disclosure.' },
      { title: '42 USC §256b — 340B Statute', url: 'https://www.govinfo.gov/app/details/USCODE-2023-title42/USCODE-2023-title42-chap6A-subchapII-partD-subpartVII-sec256b', note: 'The statute itself, including the duplicate-discount prohibition.' },
      { title: 'CMS — Medicaid 340B Identifier Crosswalk', url: 'https://www.medicaid.gov/medicaid/prescription-drugs/medicaid-drug-rebate-program', note: 'State-by-state 340B claim identifier reference (UD, JG, state-specific).' },
    ],
  },
  'two-midnight-mire': {
    oneLineRecap: "You defended a 2-midnight inpatient admission against a RAC reclassification — and when the chart didn't support it, you rebilled Part A → Part B observation with the right citation.",
    keyConcepts: [
      { term: '2-Midnight Rule', gist: 'Medicare presumes inpatient is appropriate when the admitting physician expects the patient will need ≥2 midnights of medically-necessary hospital care. Stays clearly < 2 midnights belong as observation.' },
      { term: 'Clock-start mechanic', gist: 'The clock starts when the patient receives hospital-level care — usually ED arrival — NOT when the inpatient order is written. Documentation often gets this wrong.' },
      { term: 'Part A → Part B rebill', gist: "When a RAC denies the inpatient stay AND the chart doesn't actually support inpatient, the right move is to rebill as observation under Part B (lower payment, but recoverable)." },
    ],
    resources: [
      { title: 'CMS — 2-Midnight Rule (MLN MM9979)', url: 'https://www.cms.gov/files/document/two-midnight-rule-fact-sheet.pdf', note: 'The MLN article explaining the 2-midnight benchmark + presumption.' },
      { title: '42 CFR 412.3 — Inpatient Admission Decision', url: 'https://www.ecfr.gov/current/title-42/chapter-IV/subchapter-B/part-412/subpart-A/section-412.3', note: 'The federal regulation establishing the 2-midnight rule.' },
      { title: 'CMS — Recovery Audit Program (2-Midnight Reviews)', url: 'https://www.cms.gov/research-statistics-data-and-systems/monitoring-programs/medicare-ffs-compliance-programs/recovery-audit-program', note: 'How RACs review 2-midnight cases + the Part A → Part B rebill mechanic.' },
    ],
  },
  'wraith': {
    oneLineRecap: 'You answered a CO-50 medical-necessity denial by citing payer policy + chart documentation chain — no shortcuts, just the receipts.',
    keyConcepts: [
      { term: 'CO-50 (medical necessity)', gist: "The payer says the service didn't meet their coverage criteria. Resolution requires citing the specific NCD/LCD or commercial medical-policy section AND the chart evidence that satisfies it." },
      { term: 'NCD vs LCD', gist: 'NCDs (National Coverage Determinations) are CMS-wide; LCDs (Local Coverage Determinations) are MAC-specific. Commercial payers publish their own medical policies — usually online, sometimes by login.' },
      { term: 'CITE vs AMEND', gist: 'CITE = pull authoritative text into the appeal letter. AMEND = change the claim itself (a code, a modifier). Medical-necessity fights are CITE-dominant; coding fights are AMEND-dominant.' },
    ],
    resources: [
      { title: 'CMS Medicare Coverage Database', url: 'https://www.cms.gov/medicare-coverage-database', note: 'NCD + LCD search. Start here for any Medicare medical-necessity question.' },
      { title: 'CMS Internet-Only Manual 100-08, Ch 13 — LCDs', url: 'https://www.cms.gov/regulations-and-guidance/guidance/manuals/internet-only-manuals-ioms-items/cms014961', note: 'How LCDs are written, the appeals window, the public-comment process.' },
      { title: 'AAPC — Medical Necessity Documentation Guide', url: 'https://www.aapc.com/blog/topics/medical-necessity/', note: 'Practical CITE-craft for medical-necessity appeals.' },
    ],
  },
}
