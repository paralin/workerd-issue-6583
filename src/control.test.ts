import { describe, expect, it } from 'vitest'

describe('control', () => {
  it('runs a basic test without node:sqlite', () => {
    expect(1 + 1).toBe(2)
  })
})
