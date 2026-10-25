import { describe, expect, it } from 'vitest'
import { fitHudRect, HUD_GAP, separateHudRect, updateHudRectUntilObstacle } from './hud-geometry'

describe('movable HUD spacing', () => {
  const bounds = { left: 264, top: 60, right: 689, bottom: 408 }
  const upper = { x: 409, y: 60, width: 280, height: 168 }

  it('keeps the lower HUD separated while moving toward the upper HUD', () => {
    const lower = separateHudRect({ x: 409, y: 190, width: 280, height: 168 }, upper, bounds)
    expect(lower.y).toBe(upper.y + upper.height + HUD_GAP)
    expect(lower.y + lower.height).toBeLessThanOrEqual(bounds.bottom)
  })

  it('reduces a HUD to the available space before allowing an overlap', () => {
    const lower = { x: 409, y: 240, width: 280, height: 168 }
    const upper = separateHudRect({ x: 409, y: 60, width: 280, height: 300 }, lower, bounds)
    expect(upper.y + upper.height + HUD_GAP).toBeLessThanOrEqual(lower.y)
    expect(upper.height).toBeGreaterThan(0)
    expect(fitHudRect({ x: 409, y: 60, width: 280, height: 130 }, bounds).height).toBe(168)
  })
})

describe('hud gesture collision', () => {
  const bounds = { left: 264, top: 60, right: 1268, bottom: 800 }
  const upper = { x: 986, y: 60, width: 282, height: 218 }
  const lower = { x: 986, y: 290, width: 282, height: 218 }
  const left = { x: 500, y: 300, width: 280, height: 200 }
  const right = { x: 792, y: 300, width: 280, height: 200 }

  it('stops a north edge at the upper HUD instead of moving sideways', () => {
    const result = updateHudRectUntilObstacle(lower, 'n', 0, -80, bounds, upper)
    expect(result).toEqual(lower)
  })

  it('stops a south edge without moving the neighboring HUD', () => {
    const result = updateHudRectUntilObstacle(upper, 's', 0, 80, bounds, lower)
    expect(result).toEqual(upper)
  })

  it('stops east and west edges at the horizontal gap', () => {
    expect(updateHudRectUntilObstacle(left, 'e', 100, 0, bounds, right)).toEqual(left)
    expect(updateHudRectUntilObstacle(right, 'w', -100, 0, bounds, left)).toEqual(right)
  })

  it.each([
    { edge: 'ne' as const, dx: 100, dy: -100, obstacle: { x: 800, y: 80, width: 200, height: 200 }, left: 500, top: 292, right: 788, bottom: 500 },
    { edge: 'nw' as const, dx: -100, dy: -100, obstacle: { x: 280, y: 80, width: 200, height: 200 }, left: 492, top: 292, right: 780, bottom: 500 },
    { edge: 'se' as const, dx: 100, dy: 100, obstacle: { x: 800, y: 520, width: 200, height: 200 }, left: 500, top: 300, right: 788, bottom: 508 },
    { edge: 'sw' as const, dx: -100, dy: 100, obstacle: { x: 280, y: 520, width: 200, height: 200 }, left: 492, top: 300, right: 780, bottom: 508 },
  ])('stops the $edge corner at first contact and keeps the opposite corner fixed', ({ edge, dx, dy, obstacle, left: expectedLeft, top: expectedTop, right: expectedRight, bottom: expectedBottom }) => {
    const result = updateHudRectUntilObstacle({ x: 500, y: 300, width: 280, height: 200 }, edge, dx, dy, bounds, obstacle)
    expect(result.x).toBeCloseTo(expectedLeft)
    expect(result.y).toBeCloseTo(expectedTop)
    expect(result.x + result.width).toBeCloseTo(expectedRight)
    expect(result.y + result.height).toBeCloseTo(expectedBottom)
  })

  it('stops a move even when a single pointer event crosses the whole obstacle', () => {
    const moving = { x: 300, y: 300, width: 280, height: 200 }
    const obstacle = { x: 600, y: 300, width: 280, height: 200 }
    const result = updateHudRectUntilObstacle(moving, 'move', 700, 0, bounds, obstacle)
    expect(result.x).toBeCloseTo(obstacle.x - HUD_GAP - moving.width)
    expect(result.y).toBe(moving.y)
  })

  it('slides along a neighboring HUD when diagonal movement reaches its edge', () => {
    const result = updateHudRectUntilObstacle(lower, 'move', -120, -30, bounds, upper)
    expect(result.x).toBe(lower.x - 120)
    expect(result.y).toBe(lower.y)
  })

  it.each([
    { name: 'bottom-left', x: 500 - HUD_GAP - 282, y: 512, dx: 100, dy: -2, expectedX: 500 - HUD_GAP - 282 + 100, expectedY: 512 },
    { name: 'bottom-right', x: 780 + HUD_GAP, y: 512, dx: -100, dy: -2, expectedX: 780 + HUD_GAP - 100, expectedY: 512 },
    { name: 'top-left', x: 500 - HUD_GAP - 282, y: 300 - HUD_GAP - 218, dx: 100, dy: 2, expectedX: 500 - HUD_GAP - 282 + 100, expectedY: 300 - HUD_GAP - 218 },
    { name: 'top-right', x: 780 + HUD_GAP, y: 300 - HUD_GAP - 218, dx: -100, dy: 2, expectedX: 780 + HUD_GAP - 100, expectedY: 300 - HUD_GAP - 218 },
  ])('slides back horizontally from the $name corner despite a small inward pointer delta', ({ x, y, dx, dy, expectedX, expectedY }) => {
    const result = updateHudRectUntilObstacle({ x, y, width: 282, height: 218 }, 'move', dx, dy, { ...bounds, left: 0 }, left)
    expect(result.x).toBeCloseTo(expectedX)
    expect(result.y).toBeCloseTo(expectedY)
  })

  it('slides back vertically from a corner despite a small inward horizontal pointer delta', () => {
    const corner = { ...lower, x: upper.x - HUD_GAP - lower.width }
    const result = updateHudRectUntilObstacle(corner, 'move', 2, -100, bounds, upper)
    expect(result.x).toBe(corner.x)
    expect(result.y).toBe(corner.y - 100)
  })

  it('does not cross a neighbor when the starting gap has floating point error', () => {
    const almostTouching = { ...lower, y: lower.y - 1e-10 }
    const result = updateHudRectUntilObstacle(almostTouching, 'move', 0, -30, bounds, upper)
    expect(result.y).toBeCloseTo(lower.y)
    expect(result.x).toBe(lower.x)
  })

  it('allows resizing away from a neighbor', () => {
    const result = updateHudRectUntilObstacle(lower, 's', 0, 40, bounds, upper)
    expect(result.height).toBe(lower.height + 40)
    expect(result.x).toBe(lower.x)
  })

  it('ignores a neighbor outside the dragged edge’s perpendicular span', () => {
    const result = updateHudRectUntilObstacle(lower, 'n', 0, -80, bounds, { ...upper, x: 400 })
    expect(result.y).toBe(lower.y - 80)
    expect(result.x).toBe(lower.x)
  })
})
