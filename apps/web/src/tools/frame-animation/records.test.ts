import { describe, expect, it } from 'vitest'

import { createFrameArchive, extractFrameArchive } from './records'

describe('frame animation records', () => {
  it('round-trips frame bytes and preserves the project manifest order', async () => {
    const result = await createFrameArchive([
      { id: 'a', seq: 3, name: 'walk-2.png', blob: new Blob(['two'], { type: 'image/png' }), selected: false },
      { id: 'b', seq: 1, name: 'walk-1.webp', blob: new Blob(['one'], { type: 'image/webp' }), selected: true },
    ])

    expect(result.frames.map(frame => frame.name)).toEqual(['walk-2.png', 'walk-1.webp'])
    expect(result.frames.map(frame => frame.selected)).toEqual([false, true])

    const restored = await extractFrameArchive(result.blob)
    await expect(restored.get(result.frames[0].path)?.text()).resolves.toBe('two')
    await expect(restored.get(result.frames[1].path)?.text()).resolves.toBe('one')
    expect(restored.get(result.frames[0].path)?.type).toBe('image/png')
    expect(restored.get(result.frames[1].path)?.type).toBe('image/webp')
  })
})
