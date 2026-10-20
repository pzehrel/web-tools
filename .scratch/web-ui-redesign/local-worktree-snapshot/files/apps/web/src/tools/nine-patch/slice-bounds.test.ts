import type { Slice } from './nine-slice'
import type { Side } from './slice-bounds'
import { describe, expect, it } from 'vitest'
import { maxSliceValue, normalizeSlice, updateSlice } from './slice-bounds'

const size = { width: 120, height: 80 }
const slice: Slice = { top: 10, right: 40, bottom: 20, left: 30 }

describe('nine-patch slice bounds', () => {
  it.each<{ side: Side, max: number }>([
    { side: 'top', max: 60 },
    { side: 'right', max: 90 },
    { side: 'bottom', max: 70 },
    { side: 'left', max: 80 },
  ])('stops $side at the opposite line without moving the other sides', ({ side, max }) => {
    expect(maxSliceValue(side, slice, size)).toBe(max)
    expect(updateSlice(side, 1000, slice, size)).toEqual({ ...slice, [side]: max })
    expect(updateSlice(side, -1000, slice, size)).toEqual({ ...slice, [side]: 0 })
  })

  it('allows touching, then lets either line move away', () => {
    const touching = updateSlice('top', 60, slice, size)
    expect(updateSlice('bottom', 21, touching, size).bottom).toBe(20)
    const separated = updateSlice('bottom', 15, touching, size)
    expect(maxSliceValue('top', separated, size)).toBe(65)
    expect(updateSlice('top', 64, separated, size).top).toBe(64)
  })

  it('rounds input values and handles an empty numeric value', () => {
    expect(updateSlice('left', 12.8, slice, size).left).toBe(13)
    expect(updateSlice('left', Number.NaN, slice, size).left).toBe(0)
  })

  it('normalizes old crossed records within the loaded image dimensions', () => {
    expect(normalizeSlice({ top: 50, right: 70, bottom: 50, left: 70 }, size))
      .toEqual({ top: 50, right: 50, bottom: 30, left: 70 })
    expect(normalizeSlice(slice, size)).toEqual(slice)
  })

  it('keeps margins ordered on a one-pixel image', () => {
    const tiny = { width: 1, height: 1 }
    const normalized = normalizeSlice({ top: 24, right: 24, bottom: 24, left: 24 }, tiny)
    expect(normalized).toEqual({ top: 1, right: 0, bottom: 0, left: 1 })
    expect(updateSlice('right', 1, normalized, tiny).right).toBe(0)
  })
})
