import type { PatientCase } from '../types'

export const CASES: Record<string, PatientCase> = {
  case_level1_cms: {
    id: 'case_level1_cms',
    patientName: 'Maria Santos',
    age: 42,
    insurance: 'Blue Cross PPO',
    diagnosis: 'Type 2 diabetes mellitus without complications',
    diagnosisCode: 'E11.9',
    procedure: 'Office visit, established patient, moderate complexity',
    procedureCode: '99214',
    formType: 'cms1500',
    level: 1,
    errors: [
      {
        field: 'Subscriber ID',
        currentValue: 'XGP882401',
        correctValue: 'XGP882410',
        explanation: 'Transposed last two digits. The 270 eligibility response had the correct ID — always verify against the electronic response, not the card photocopy.',
      },
      {
        field: 'Place of Service',
        currentValue: '23',
        correctValue: '11',
        explanation: 'POS 23 is Emergency Room. This was an office visit — POS 11. Wrong POS can trigger a denial or change reimbursement.',
      },
    ],
  },
  case_level1_ub: {
    id: 'case_level1_ub',
    patientName: 'Robert Chen',
    age: 67,
    insurance: 'Medicare Part A',
    diagnosis: 'Acute appendicitis with peritonitis',
    diagnosisCode: 'K35.20',
    procedure: 'Laparoscopic appendectomy',
    procedureCode: '0DTJ4ZZ',
    revenueCode: '0360',
    formType: 'ub04',
    level: 1,
    errors: [
      {
        field: 'Type of Bill',
        currentValue: '131',
        correctValue: '111',
        explanation: 'TOB 131 is outpatient. An appendectomy with admission is inpatient — TOB 111. This determines which payment system (IPPS vs OPPS) processes the claim.',
      },
      {
        field: 'Revenue Code',
        currentValue: '0250',
        correctValue: '0360',
        explanation: 'Rev code 0250 is Pharmacy. The OR charge should be 0360 (Operating Room). Revenue codes tell the payer what department provided the service.',
      },
    ],
    claim: {
      type: 'ub04',
      claimId: 'CLM-2026-05-01-04920',
      typeOfBill: '111',
      patient: { name: 'CHEN, ROBERT', dob: '1958-04-22', sex: 'M' },
      insured: { id: 'MED-1A2B3C4D', name: 'CHEN, ROBERT', group: '0M-Part A' },
      statementPeriod: { from: '2026-05-01', through: '2026-05-03' },
      admissionType: 'EMG',
      diagnoses: [
        { code: 'K35.20', label: 'Acute appendicitis w/ peritonitis' },
        { code: 'K35.32', label: 'Local peritonitis (other)' },
      ],
      serviceLines: [
        {
          revCode: '0360',
          description: 'Operating Room services',
          hcpcs: '0DTJ4ZZ',
          serviceDate: '2026-05-01',
          units: '1',
          totalCharges: '$28,400.00',
        },
        {
          revCode: '0250',
          description: 'Pharmacy',
          serviceDate: '2026-05-01',
          units: '12',
          totalCharges: '$1,840.00',
        },
        {
          revCode: '0710',
          description: 'Recovery Room',
          serviceDate: '2026-05-01',
          units: '2',
          totalCharges: '$2,210.00',
        },
      ],
      attendingProvider: { name: 'Dr. M. Adeyemi, MD', npi: '1827340912' },
      drg: '343 (Appendectomy w/ peritonitis)',
    },
  },

  // -------------------------------------------------------------------------
  // Cases for archetype obstacles in the Waiting Room. Each ships realistic
  // CMS-1500 data (ICD-10, CPT, POS, charges) that a battle can reference.
  // -------------------------------------------------------------------------

  // Linked to encounter `intro_wrong_card` — the level-1 introductory puzzle.
  // Mrs. Patel handed in her husband's insurance card at registration. The
  // claim went out under his subscriber id (which doesn't match her name on
  // the payer's roster) and bounced as CO-31. One amend on Box 1a fixes it.
  case_intro_patel: {
    id: 'case_intro_patel',
    patientName: 'Anjali',
    age: 38,
    insurance: 'Aetna PPO',
    diagnosis: 'Acute pharyngitis',
    diagnosisCode: 'J02.9',
    procedure: 'ER visit, expanded problem-focused',
    procedureCode: '99282',
    formType: 'cms1500',
    level: 1,
    errors: [
      {
        field: 'Subscriber ID',
        currentValue: 'AET447821903', // husband's id
        correctValue: 'AET447821491',  // patient's actual id
        explanation: "She handed over her husband's card at registration. Same plan, different subscriber id — the payer's roster lists him as the subscriber, her as a dependent under her own id.",
      },
    ],
    claim: {
      type: 'cms1500',
      claimId: 'CLM-2026-05-02-00118',
      insuranceType: 'Group',
      patient: { name: 'PATEL, ANJALI', dob: '1988-02-14', sex: 'F' },
      // Pre-fix state: card said this id (her husband's). Player swaps it
      // to the correct one via the amend modal.
      insured: { id: 'AET447821903', name: 'PATEL, RAVI', group: '0042811' },
      diagnoses: [
        { code: 'J02.9', label: 'Acute pharyngitis, unspecified' },
      ],
      serviceLines: [
        {
          dos: '2026-05-02',
          pos: '23',
          cpt: { code: '99282', label: 'ER visit, expanded' },
          dxPointer: 'A',
          charges: '$387.00',
        },
      ],
      provider: { name: 'Dr. T. Greene, MD', npi: '1029384756' },
    },
  },

  // Linked to encounter `co_50` (Medical Necessity Wraith).
  case_wraith_walker: {
    id: 'case_wraith_walker',
    patientName: 'Arlene Walker',
    age: 67,
    insurance: 'BCBS NC PPO',
    diagnosis: 'Heart failure, unspecified',
    diagnosisCode: 'I50.9',
    procedure: 'Echocardiography, transthoracic, complete with Doppler',
    procedureCode: '93306',
    formType: 'cms1500',
    level: 4,
    // Pre-fix in the hospital: bump the diagnosis to a more specific
    // ICD-10 (the LCD requires evidence of systolic dysfunction).
    // Catching it grants the form-bridge buff for the Wraith.
    errors: [
      {
        field: 'Diagnosis Code',
        currentValue: 'I50.9',
        correctValue: 'I50.42',
        explanation: 'I50.9 (heart failure, unspecified) is too vague for medical necessity on a TTE. I50.42 (chronic combined systolic-diastolic) names the dysfunction the LCD asks for and is what the chart actually supports.',
      },
    ],
    claim: {
      type: 'cms1500',
      claimId: 'CLM-2026-01-15-04401',
      insuranceType: 'Group',
      patient: { name: 'WALKER, ARLENE', dob: '1958-03-12', sex: 'F' },
      insured: { id: 'BCB827193401', name: 'WALKER, ARLENE', group: '0042873' },
      diagnoses: [
        { code: 'I50.9', label: 'Heart failure, unspecified' },
      ],
      serviceLines: [
        {
          dos: '2026-01-15',
          pos: '11',
          cpt: { code: '93306', label: 'TTE w/ Doppler, complete' },
          dxPointer: 'A',
          charges: '$2,150.00',
        },
      ],
      provider: { name: 'Dr. M. Chen, MD', npi: '1487329104' },
    },
  },

  // Linked to encounter `co_29_reaper` (Timely Filing Reaper).
  case_reaper_park: {
    id: 'case_reaper_park',
    patientName: 'Devon Park',
    age: 33,
    insurance: 'Aetna PPO',
    diagnosis: 'Unilateral primary osteoarthritis, right knee',
    diagnosisCode: 'M17.11',
    procedure: 'Arthroplasty, knee, condyle and prosthesis (total knee replacement)',
    procedureCode: '27447',
    formType: 'cms1500',
    level: 7,
    // The claim was rejected at the clearinghouse the first time it
    // dropped (subscriber id transposed). That's why it's now bumping
    // up against the timely-filing window. Catching it lets us refile
    // before the deadline closes.
    errors: [
      {
        field: 'Subscriber ID',
        currentValue: 'AET882441293',
        correctValue: 'AET882441923',
        explanation: 'Last four digits transposed. The 277CA bounced this back the first three submissions — fixing it lets us refile inside the contractual filing window.',
      },
    ],
    claim: {
      type: 'cms1500',
      claimId: 'CLM-2025-08-15-22087',
      insuranceType: 'Group',
      patient: { name: 'PARK, DEVON', dob: '1992-07-22', sex: 'M' },
      insured: { id: 'AET882441923', name: 'PARK, DEVON', group: '0078421' },
      diagnoses: [
        { code: 'M17.11', label: 'OA right knee, primary' },
      ],
      serviceLines: [
        {
          dos: '2025-08-15',
          pos: '22',
          cpt: { code: '27447', label: 'Total knee arthroplasty' },
          dxPointer: 'A',
          charges: '$42,300.00',
        },
      ],
      provider: { name: 'Dr. R. Adeyemi, MD', npi: '1659827733' },
    },
  },

  // Linked to encounter `co_197` (Prior Auth Gatekeeper).
  case_gatekeeper_okafor: {
    id: 'case_gatekeeper_okafor',
    patientName: 'Tunde Okafor',
    age: 58,
    insurance: 'UnitedHealthcare Choice Plus',
    diagnosis: 'Lumbar disc herniation with radiculopathy',
    diagnosisCode: 'M51.16',
    procedure: 'Lumbar MRI without contrast',
    procedureCode: '72148',
    formType: 'cms1500',
    level: 3,
    // The PA was actually approved, but the auth number was never
    // transcribed onto the claim. Adding it to box 23 before the claim
    // drops is the canonical upstream fix.
    errors: [
      {
        field: 'Modifier',
        currentValue: '—',
        correctValue: 'PA-78294-A',
        explanation: 'Box 23 prior-auth-number was approved by UHC on 2026-02-04 but never transcribed onto the claim. Adding it before submission keeps the gate open from the start.',
      },
    ],
    claim: {
      type: 'cms1500',
      claimId: 'CLM-2026-02-09-15208',
      insuranceType: 'Group',
      patient: { name: 'OKAFOR, TUNDE', dob: '1967-09-04', sex: 'M' },
      insured: { id: 'UHC1182904', name: 'OKAFOR, TUNDE', group: '0091772' },
      diagnoses: [
        { code: 'M51.16', label: 'Lumbar disc, radiculopathy' },
      ],
      serviceLines: [
        {
          dos: '2026-02-09',
          pos: '11',
          cpt: { code: '72148', label: 'MRI lumbar w/o contrast' },
          dxPointer: 'A',
          charges: '$1,425.00',
        },
      ],
      provider: { name: 'Dr. P. Reyes, MD', npi: '1928374650' },
    },
  },

  // Linked to encounter `eligibility_fog` (Eligibility Fog).
  case_fog_nguyen: {
    id: 'case_fog_nguyen',
    patientName: 'Linh Nguyen',
    age: 29,
    insurance: 'Anthem BCBS PPO',
    diagnosis: 'Acute pharyngitis',
    diagnosisCode: 'J02.9',
    procedure: 'Office visit, new patient, low complexity',
    procedureCode: '99203',
    formType: 'cms1500',
    level: 2,
    // Pre-fix in the hospital: the subscriber id on file is from her
    // old plan (before her job change). Running a 270 inquiry returns
    // the new id; transcribing it pre-submission means the claim drops
    // clean and the Fog never thickens.
    errors: [
      {
        field: 'Subscriber ID',
        currentValue: 'ANT883112',
        correctValue: 'ANT772041',
        explanation: 'Patient changed jobs; the card she handed over is from her former employer plan. The 270/271 returns the active subscriber id. Always trust the eligibility response over the card photocopy.',
      },
    ],
    claim: {
      type: 'cms1500',
      claimId: 'CLM-2026-02-21-32018',
      insuranceType: 'Group',
      patient: { name: 'NGUYEN, LINH', dob: '1996-12-04', sex: 'F' },
      insured: { id: 'ANT772041', name: 'NGUYEN, LINH', group: '0066114' },
      diagnoses: [
        { code: 'J02.9', label: 'Acute pharyngitis, unspecified' },
      ],
      serviceLines: [
        {
          dos: '2026-02-21',
          pos: '11',
          cpt: { code: '99203', label: 'Office E&M, new, low' },
          dxPointer: 'A',
          charges: '$190.00',
        },
      ],
      provider: { name: 'Dr. K. Singh, MD', npi: '1340912783' },
    },
  },

  // Linked to encounter `boss_audit` (The Quarterly Audit, L10 finale).
  case_audit_finale: {
    id: 'case_audit_finale',
    patientName: 'Margaret Holloway',
    age: 74,
    insurance: 'United Healthcare Medicare Advantage',
    diagnosis: 'Sepsis due to MSSA, with severe sepsis',
    diagnosisCode: 'A41.01',
    procedure: 'Inpatient stay, 5 days, ICU step-down',
    procedureCode: '99232',
    revenueCode: '0200',
    formType: 'ub04',
    level: 10,
    // The flagged file: principal dx originally posted as A41.9 (sepsis,
    // unspecified) which underspecifies the organism, weakens the DRG
    // assignment, and leaves the file vulnerable on review. CDI clarified
    // the organism as MSSA (A41.01) and added severity coding (R65.20)
    // — a more defensible DRG and a cleaner audit. The DRG box was also
    // mis-stated as 871 (no MCC) when the documented severity supports
    // 870 (with MCC).
    errors: [
      {
        field: 'Principal Diagnosis',
        currentValue: 'A41.9',
        correctValue: 'A41.01',
        explanation: 'A41.9 is sepsis, unspecified — too vague for a defensible audit. Cultures grew MSSA on day 1; A41.01 (sepsis due to methicillin-susceptible Staph aureus) is the documented and defensible code. Specific dx survives review.',
      },
      {
        field: 'DRG',
        currentValue: '871 (Septicemia w/o MCC)',
        correctValue: '870 (Septicemia w/ MCC)',
        explanation: 'Documented hypotension, lactate > 4, and ICU step-down support severity coding R65.20 (severe sepsis), which lifts the DRG from 871 to 870. Auditor will compare clinical evidence against assigned DRG — match them.',
      },
    ],
    claim: {
      type: 'ub04',
      claimId: 'CLM-2026-04-30-99102',
      typeOfBill: '111',
      patient: { name: 'HOLLOWAY, MARGARET', dob: '1951-08-14', sex: 'F' },
      insured: { id: 'UHC-MA-7740921', name: 'HOLLOWAY, MARGARET', group: 'AARP-MA-001' },
      statementPeriod: { from: '2026-04-25', through: '2026-04-30' },
      admissionType: 'EMG',
      diagnoses: [
        { code: 'A41.01', label: 'Sepsis due to MSSA' },
        { code: 'R65.20', label: 'Severe sepsis without septic shock' },
        { code: 'J18.9',  label: 'Pneumonia, unspecified' },
        { code: 'I10',    label: 'Essential hypertension' },
      ],
      serviceLines: [
        {
          revCode: '0200',
          description: 'ICU step-down',
          serviceDate: '2026-04-25',
          units: '2',
          totalCharges: '$18,200.00',
        },
        {
          revCode: '0110',
          description: 'Med/Surg, room & board',
          serviceDate: '2026-04-27',
          units: '3',
          totalCharges: '$11,700.00',
        },
        {
          revCode: '0250',
          description: 'Pharmacy — IV antibiotics',
          serviceDate: '2026-04-25',
          units: '20',
          totalCharges: '$3,940.00',
        },
        {
          revCode: '0301',
          description: 'Lab — chemistry / cultures',
          serviceDate: '2026-04-25',
          units: '14',
          totalCharges: '$2,180.00',
        },
      ],
      attendingProvider: { name: 'Dr. R. Okafor, MD', npi: '1495802377' },
      drg: '870 (Septicemia w/ MCC)',
    },
  },

  // Linked to encounter `co_16_swarm` (Documentation Sprite Swarm).
  case_swarm_yamada: {
    id: 'case_swarm_yamada',
    patientName: 'Hiro Yamada',
    age: 58,
    insurance: 'United Healthcare PPO',
    diagnosis: 'Hypertensive heart disease without heart failure',
    diagnosisCode: 'I11.9',
    procedure: 'Office visit, established patient, moderate complexity',
    procedureCode: '99214',
    formType: 'cms1500',
    level: 6,
    // The chart originally listed an unspecified diagnosis (I10) and the
    // taxonomy was blank in the rendering provider segment. Both fields
    // tripped 277CA rejects from the clearinghouse. CDI cleans both
    // upstream so the swarm never spawns.
    errors: [
      {
        field: 'Diagnosis Code',
        currentValue: 'I10',
        correctValue: 'I11.9',
        explanation: 'I10 (essential hypertension) is too unspecified for the cardiology workup billed. The chart supports I11.9 — hypertensive heart disease without heart failure. Specific dx kills the missing-info reject at the source.',
      },
      {
        field: 'Provider Taxonomy',
        currentValue: '',
        correctValue: '207RC0000X',
        explanation: 'Loop 2310B PRV segment was blank. UHC requires the rendering provider taxonomy on every electronic claim. Cardiology = 207RC0000X. Empty taxonomy is the #1 cause of 277CA rejects.',
      },
    ],
    claim: {
      type: 'cms1500',
      claimId: 'CLM-2026-04-12-44091',
      insuranceType: 'Group',
      patient: { name: 'YAMADA, HIRO', dob: '1968-06-19', sex: 'M' },
      insured: { id: 'UHC502118', name: 'YAMADA, HIRO', group: '0091224' },
      diagnoses: [
        { code: 'I11.9', label: 'Hypertensive heart dz, no HF' },
      ],
      serviceLines: [
        {
          dos: '2026-04-12',
          pos: '11',
          cpt: { code: '99214', label: 'Office E&M, established, moderate' },
          dxPointer: 'A',
          charges: '$240.00',
        },
      ],
      provider: { name: 'Dr. T. Mendez, MD', npi: '1593028477' },
    },
  },

  // Linked to encounter `co_18_doppelganger` (Duplicate Claim Doppelgänger).
  case_doppel_reyes: {
    id: 'case_doppel_reyes',
    patientName: 'Fatima Reyes',
    age: 41,
    insurance: 'Humana Gold Plus',
    diagnosis: 'Type 2 diabetes mellitus without complications',
    diagnosisCode: 'E11.9',
    procedure: 'Office visit, established patient, low complexity',
    procedureCode: '99213',
    formType: 'cms1500',
    level: 6,
    // The original claim was rejected for a wrong subscriber id, fixed,
    // and resubmitted as a new 837P (frequency 1) instead of as a
    // replacement (frequency 7). The payer's adjudication system
    // flagged the resubmission as a duplicate. Catching the upstream
    // resubmission code grants the form-bridge buff for the Doppelgänger.
    errors: [
      {
        field: 'Subscriber ID',
        currentValue: 'HUM712309',
        correctValue: 'HUM712390',
        explanation: 'Subscriber id digits transposed on the original claim — that\'s why we resubmitted at all. Fixing it before submission means we never need a frequency-7 replacement, so the duplicate flag never trips.',
      },
    ],
    claim: {
      type: 'cms1500',
      claimId: 'CLM-2026-03-08-19842',
      insuranceType: 'Group',
      patient: { name: 'REYES, FATIMA', dob: '1984-09-30', sex: 'F' },
      insured: { id: 'HUM712390', name: 'REYES, FATIMA', group: '0050211' },
      diagnoses: [
        { code: 'E11.9', label: 'Type 2 diabetes, uncomplicated' },
      ],
      serviceLines: [
        {
          dos: '2026-03-08',
          pos: '11',
          cpt: { code: '99213', label: 'Office E&M, established, low' },
          dxPointer: 'A',
          charges: '$145.00',
        },
      ],
      provider: { name: 'Dr. L. Park, MD', npi: '1762048910' },
    },
  },

  // Linked to encounter `co_97` (The Bundle / Bundling Beast).
  case_bundle_kim: {
    id: 'case_bundle_kim',
    patientName: 'Sarah Kim',
    age: 52,
    insurance: 'Cigna OAP',
    diagnosis: 'Actinic keratosis (with hypertension)',
    diagnosisCode: 'L57.0',
    procedure: 'Office E&M + tangential skin biopsy (same day)',
    procedureCode: '99214 + 11102',
    formType: 'cms1500',
    level: 5,
    // Errors authored so this case is also playable as a hospital form
    // puzzle. Perfect-completion grants the form-bridge buff: the
    // matching Bundling Beast obstacle starts at full HP.
    errors: [
      {
        field: 'Modifier',
        currentValue: '—',
        correctValue: '25',
        explanation: 'Modifier 25 marks a significant, separately identifiable E&M service performed on the same day as a procedure. Without it, the 99214 bundles into 11102 (NCCI edit).',
      },
    ],
    claim: {
      type: 'cms1500',
      claimId: 'CLM-2026-04-12-09931',
      insuranceType: 'Group',
      patient: { name: 'KIM, SARAH', dob: '1973-11-04', sex: 'F' },
      insured: { id: 'CIG9938221', name: 'KIM, SARAH', group: '0093388' },
      diagnoses: [
        { code: 'L57.0', label: 'Actinic keratosis' },
        { code: 'I10',   label: 'Essential hypertension' },
      ],
      serviceLines: [
        {
          dos: '2026-04-12',
          pos: '11',
          cpt: { code: '99214', label: 'Office E&M, established, mod' },
          dxPointer: 'B',
          charges: '$215.00',
        },
        {
          dos: '2026-04-12',
          pos: '11',
          cpt: { code: '11102', label: 'Tangential skin biopsy' },
          dxPointer: 'A',
          charges: '$185.00',
        },
      ],
      provider: { name: 'Dr. J. Patel, MD', npi: '1234560987' },
    },
  },
}

export const CASE_LIST = Object.values(CASES)
