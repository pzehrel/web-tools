import { describe, expect, it } from 'vitest'
import { calculateStageFitScale, calculateUnobstructedStageFit, clampZoom } from './stage'

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

  it('centers fitted content in the largest usable area beside HUDs', () => {
    const viewport = { left: 0, top: 0, right: 1000, bottom: 600 }
    const overlays = [
      { left: 600, top: 0, right: 1000, bottom: 260 },
      { left: 600, top: 360, right: 1000, bottom: 600 },
    ]
    const fit = calculateUnobstructedStageFit(viewport, overlays, 400, 400, 40)
    expect(fit.scale).toBeCloseTo(512 / 400)
    expect(fit.offset).toEqual({ x: -204, y: 0 })
  })

  it('keeps the stage center and ordinary fit when no HUD is visible', () => {
    const fit = calculateUnobstructedStageFit({ left: 20, top: 40, right: 520, bottom: 240 }, [], 800, 100)
    expect(fit.scale).toBeCloseTo(calculateStageFitScale(500, 200, 800, 100))
    expect(fit.offset).toEqual({ x: 0, y: 0 })
  })
})
