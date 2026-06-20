import Phaser from 'phaser'
import { CASES } from '../content/cases'
import { getState, saveGame } from '../state'
import type { PatientCase, FormError } from '../types'

interface FieldDisplay {
  label: Phaser.GameObjects.Text
  value: Phaser.GameObjects.Text
  bg: Phaser.GameObjects.Rectangle
  error?: FormError
  corrected: boolean
}

export class FormScene extends Phaser.Scene {
  private patientCase!: PatientCase
  private fields: FieldDisplay[] = []
  private errorsFound = 0
  private totalErrors = 0
  private statusText!: Phaser.GameObjects.Text
  private feedbackText!: Phaser.GameObjects.Text
  private callingScene = 'Hospital'

  constructor() {
    super('Form')
  }

  init(data: { caseId: string; callingScene?: string }) {
    const c = CASES[data.caseId]
    if (!c) throw new Error(`Unknown case: ${data.caseId}`)
    this.patientCase = c
    this.callingScene = data.callingScene ?? 'Hospital'
    this.fields = []
    this.errorsFound = 0
    this.totalErrors = c.errors?.length ?? 0
  }

  create() {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor(0x0e1116)

    const isCMS = this.patientCase.formType === 'cms1500'
    const formTitle = isCMS ? 'CMS-1500' : 'UB-04'
    const headerColor = isCMS ? 0xef5b7b : 0x6da9e3

    // Form header
    this.add.rectangle(width / 2, 30, width - 40, 40, headerColor, 0.15)
      .setStrokeStyle(1, headerColor)

    this.add.text(width / 2, 20, formTitle, {
      fontSize: '16px', fontFamily: 'monospace', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5)

    this.add.text(width / 2, 38, 'Find and correct the errors in this claim', {
      fontSize: '10px', fontFamily: 'monospace', color: '#8b95a5',
    }).setOrigin(0.5)

    // Patient info header
    const pc = this.patientCase
    this.add.text(30, 65, `Patient: ${pc.patientName}  Age: ${pc.age}  Insurance: ${pc.insurance}`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#7ee2c1',
    })

    this.add.text(30, 80, `Dx: ${pc.diagnosisCode} — ${pc.diagnosis}`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#d0d8e0',
    })

    this.add.text(30, 95, `Px: ${pc.procedureCode} — ${pc.procedure}`, {
      fontSize: '10px', fontFamily: 'monospace', color: '#d0d8e0',
    })

    // Build form fields
    this.buildFields(isCMS)

    // Status
    this.statusText = this.add.text(width / 2, height - 60, `Errors found: ${this.errorsFound} / ${this.totalErrors}`, {
      fontSize: '12px', fontFamily: 'monospace', color: '#f4d06f',
    }).setOrigin(0.5)

    this.feedbackText = this.add.text(width / 2, height - 35, '', {
      fontSize: '11px', fontFamily: 'monospace', color: '#8b95a5',
      wordWrap: { width: width - 60 }, align: 'center',
    }).setOrigin(0.5)
  }

  private buildFields(isCMS: boolean) {
    const { width } = this.scale
    const errors = this.patientCase.errors ?? []
    const errorMap = new Map<string, FormError>()
    for (const e of errors) errorMap.set(e.field, e)

    const fieldDefs = isCMS ? this.getCMS1500Fields() : this.getUB04Fields()

    const startY = 125
    const rowHeight = 36
    const colWidth = (width - 60) / 2

    fieldDefs.forEach((fd, i) => {
      const col = i % 2
      const row = Math.floor(i / 2)
      const x = 30 + col * colWidth
      const y = startY + row * rowHeight

      const error = errorMap.get(fd.label)
      const displayValue = error ? error.currentValue : fd.value

      const bg = this.add.rectangle(x + colWidth / 2 - 10, y + 10, colWidth - 20, 30, 0x1f262f)
        .setStrokeStyle(1, 0x2a323d)

      const label = this.add.text(x, y - 2, fd.label, {
        fontSize: '8px', fontFamily: 'monospace', color: '#5a6a7a',
      })

      const value = this.add.text(x + 5, y + 10, displayValue, {
        fontSize: '11px', fontFamily: 'monospace', color: '#d0d8e0',
      })

      const field: FieldDisplay = { label, value, bg, error, corrected: false }
      this.fields.push(field)

      if (error) {
        bg.setInteractive({ useHandCursor: true })
        bg.on('pointerover', () => {
          if (!field.corrected) bg.setStrokeStyle(2, 0xf4d06f)
        })
        bg.on('pointerout', () => {
          if (!field.corrected) bg.setStrokeStyle(1, 0x2a323d)
        })
        bg.on('pointerdown', () => this.correctField(field))
      }
    })
  }

  private correctField(field: FieldDisplay) {
    if (field.corrected || !field.error) return

    field.corrected = true
    this.errorsFound++

    // Animate correction
    field.value.setText(field.error.correctValue)
    field.value.setColor('#6cd49a')
    field.bg.setStrokeStyle(2, 0x6cd49a)

    this.feedbackText.setText(field.error.explanation)
    this.statusText.setText(`Errors found: ${this.errorsFound} / ${this.totalErrors}`)

    // Flash the field
    this.tweens.add({
      targets: field.bg,
      alpha: 0.5,
      duration: 100,
      yoyo: true,
      repeat: 1,
    })

    if (this.errorsFound >= this.totalErrors) {
      this.time.delayedCall(2000, () => this.formComplete())
    }
  }

  private formComplete() {
    const { width, height } = this.scale

    // Form-bridge: mark this case as perfected. Any obstacle whose
    // `caseId` is this case will now start the matching battle at full
    // HP. Idempotent — re-perfecting just keeps the entry.
    const state = getState()
    if (!state.formsPerfected.includes(this.patientCase.id)) {
      state.formsPerfected.push(this.patientCase.id)
      saveGame()
    }

    this.add.rectangle(width / 2, height / 2, width, height, 0x0e1116, 0.85)

    this.add.text(width / 2, height / 2 - 40, 'CLAIM CORRECTED', {
      fontSize: '20px', fontFamily: 'monospace', color: '#6cd49a', fontStyle: 'bold',
    }).setOrigin(0.5)

    this.add.text(width / 2, height / 2, 'All errors found and fixed. This claim is ready to submit.', {
      fontSize: '11px', fontFamily: 'monospace', color: '#d0d8e0',
    }).setOrigin(0.5)

    this.add.text(width / 2, height / 2 + 22, 'Your form bridge is ready; the Waiting Room case will start with the evidence already prepared.', {
      fontSize: '10px', fontFamily: 'monospace', color: '#7ee2c1',
      fontStyle: 'italic',
    }).setOrigin(0.5)

    const btn = this.add.text(width / 2, height / 2 + 50, '[ CONTINUE ]', {
      fontSize: '14px', fontFamily: 'monospace', color: '#7ee2c1',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })

    btn.on('pointerover', () => btn.setColor('#ffffff'))
    btn.on('pointerout', () => btn.setColor('#7ee2c1'))
    btn.on('pointerdown', () => {
      this.scene.stop()
      this.scene.start(this.callingScene)
    })

    this.input.keyboard!.on('keydown-SPACE', () => {
      this.scene.stop()
      this.scene.start(this.callingScene)
    })
  }

  private getCMS1500Fields() {
    const pc = this.patientCase
    return [
      { label: 'Patient Name', value: pc.patientName },
      { label: 'Subscriber ID', value: 'XGP882410' },
      { label: 'Date of Birth', value: `${pc.age} yrs` },
      { label: 'Insurance Plan', value: pc.insurance },
      { label: 'Diagnosis Code', value: pc.diagnosisCode },
      { label: 'Place of Service', value: '11' },
      { label: 'CPT Code', value: pc.procedureCode },
      { label: 'Modifier', value: pc.modifiers?.join(', ') || '—' },
      { label: 'Charges', value: '$185.00' },
      { label: 'Rendering Provider', value: 'Dr. Martinez' },
    ]
  }

  private getUB04Fields() {
    const pc = this.patientCase
    return [
      { label: 'Patient Name', value: pc.patientName },
      { label: 'Type of Bill', value: '111' },
      { label: 'Admission Date', value: '05/01/2026' },
      { label: 'Insurance Plan', value: pc.insurance },
      { label: 'Principal Dx', value: pc.diagnosisCode },
      { label: 'Revenue Code', value: pc.revenueCode || '0360' },
      { label: 'ICD-10-PCS', value: pc.procedureCode },
      { label: 'Total Charges', value: '$32,450.00' },
      { label: 'Attending Provider', value: 'Dr. Martinez' },
      { label: 'DRG', value: '343' },
    ]
  }
}
