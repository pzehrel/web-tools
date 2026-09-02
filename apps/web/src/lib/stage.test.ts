import { describe, expect, it } from 'vitest'
import { calculateStageFitScale, clampZoom } from './stage'

describe('stage zoom', () => {
  it('allows zooming down to one percent', () => {
    expect(clampZoom(0)).toBe(0.01)
    expect(clampZoom(0.01)).toBe(0.01)
    expect(clampZoom(9)).toBe(8)
  })

  it('fits the complete content bounds inside the stage at 100%', () => {
    expect(calculateStageFitScale(500, 200, 800, 100)).toBeCloseTo(484 / 800)
    expect(calculateStageFitScale(500, 200, 100, 400)).toBeCloseTo(184 / 400)
  })

  it('uses a neutral scale while bounds are unavailable', () => {
    expect(calculateStageFitScale(0, 200, 800, 100)).toBe(1)
    expect(calculateStageFitScale(500, 200, 0, 100)).toBe(1)
  })
})
