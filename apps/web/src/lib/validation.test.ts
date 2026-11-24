import { describe, expect, it } from 'vitest'
import { phoneField } from './validation'

describe('phoneField', () => {
  it.each(['0912345678', '0356789012', '+84912345678', '091 234 5678', '091.234.5678'])(
    'accepts %s',
    (phone) => {
      expect(phoneField.safeParse(phone).success).toBe(true)
    },
  )

  it.each(['', '012345678', '0212345678', '09123456789', 'abc'])('rejects "%s"', (phone) => {
    expect(phoneField.safeParse(phone).success).toBe(false)
  })

  it('normalizes separators before sending to the API', () => {
    expect(phoneField.parse('091 234-5678')).toBe('0912345678')
  })
})
