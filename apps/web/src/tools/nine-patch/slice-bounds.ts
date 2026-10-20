import type { Slice } from './nine-slice'

export type Side = keyof Slice

interface ImageSize {
  width: number
  height: number
}

const OPPOSITE_SIDE: Record<Side, Side> = {
  top: 'bottom',
  right: 'left',
  bottom: 'top',
  left: 'right',
}

function clampValue(value: number, max: number): number {
  return Math.min(max, Math.max(0, Math.round(value) || 0))
}

export function maxSliceValue(side: Side, slice: Slice, size: ImageSize): number {
  const dimension = side === 'top' || side === 'bottom' ? size.height : size.width
  return Math.max(0, dimension - slice[OPPOSITE_SIDE[side]])
}

export function updateSlice(side: Side, value: number, slice: Slice, size: ImageSize): Slice {
  return { ...slice, [side]: clampValue(value, maxSliceValue(side, slice, size)) }
}

export function normalizeSlice(slice: Slice, size: ImageSize): Slice {
  const top = clampValue(slice.top, size.height)
  const left = clampValue(slice.left, size.width)
  return {
    top,
    right: clampValue(slice.right, size.width - left),
    bottom: clampValue(slice.bottom, size.height - top),
    left,
  }
}
