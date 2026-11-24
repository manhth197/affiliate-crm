import { describe, expect, it } from 'vitest'
import { canMove, needsDialog, planDrop } from './lead-rules'

describe('lead status rules', () => {
  it('follows the pipeline order and allows rejecting any open lead', () => {
    expect(canMove('NEW', 'CONTACTED')).toBe(true)
    expect(canMove('NEW', 'SUBMITTED')).toBe(false) // no skipping
    expect(canMove('CONTACTED', 'NEW')).toBe(false) // no going back
    expect(canMove('APPROVED', 'REJECTED')).toBe(true)
    expect(canMove('DISBURSED', 'REJECTED')).toBe(false) // final
  })

  it('asks for more input only for DISBURSED and REJECTED', () => {
    expect(needsDialog('DISBURSED')).toBe(true)
    expect(needsDialog('REJECTED')).toBe(true)
    expect(needsDialog('CONTACTED')).toBe(false)
  })

  it('plans what a kanban drop does', () => {
    expect(planDrop('NEW', undefined)).toBe('ignore') // dropped outside any column
    expect(planDrop('NEW', 'NEW')).toBe('ignore')
    expect(planDrop('NEW', 'APPROVED')).toBe('invalid')
    expect(planDrop('NEW', 'CONTACTED')).toBe('direct')
    expect(planDrop('APPROVED', 'DISBURSED')).toBe('dialog')
    expect(planDrop('SUBMITTED', 'REJECTED')).toBe('dialog')
  })
})
