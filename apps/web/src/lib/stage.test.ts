import { describe, expect, it } from 'vitest'
import { calculateAnchoredStageFit, calculateStageFitScale, calculateUnobstructedStageFit, clampZoom } from './stage'

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

  it('keeps the empty state and loaded content centered in the same free area', () => {
    const viewport = { left: 0, top: 0, right: 1000, bottom: 600 }
    const overlays = [
      { left: 0, top: 0, right: 200, bottom: 600 },
      { left: 650, top: 0, right: 1000, bottom: 300 },
      { left: 200, top: 560, right: 1000, bottom: 600 },
    ]
    const empty = calculateUnobstructedStageFit(viewport, overlays, 400, 140, 8, 8, 'area')
    const content = calculateUnobstructedStageFit(viewport, overlays, 480, 320, 24, 8, 'area')
    expect(empty.offset).toEqual(content.offset)
    expect(empty.scale).toBeGreaterThan(content.scale)
  })

  it('uses one center for different canvas HUD layouts while fitting around each layout', () => {
    const viewport = { left: 0, top: 56, right: 1280, bottom: 720 }
    const anchor = { x: 621, y: 408 }
    const lottie = calculateAnchoredStageFit(viewport, [
      { left: 12, top: 68, right: 252, bottom: 708 },
      { left: 948, top: 116, right: 1268, bottom: 353 },
    ], 480, 320, anchor, 24)
    const frames = calculateAnchoredStageFit(viewport, [
      { left: 12, top: 68, right: 252, bottom: 500 },
      { left: 828, top: 500, right: 1268, bottom: 540 },
      { left: 12, top: 548, right: 1268, bottom: 708 },
    ], 320, 320, anchor, 24)
    expect(lottie.center).toEqual(anchor)
    expect(frames.center).toEqual(anchor)
    expect(lottie.scale).toBeGreaterThan(0)
    expect(frames.scale).toBeGreaterThan(0)
  })
})
