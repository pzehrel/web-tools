import { describe, expect, it } from 'vitest'
import { detectAnimatedImage } from './image-animation'

function bytes(...values: Array<number | string>): Uint8Array {
  return new Uint8Array(values.flatMap(value => typeof value === 'string' ? [...value].map(character => character.charCodeAt(0)) : [value]))
}

function imageBlob(data: Uint8Array, type: string): Blob {
  return new Blob([data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer], { type })
}

function gif(frameCount: number): Uint8Array {
  const header = bytes('GIF89a', 1, 0, 1, 0, 0, 0, 0)
  const frame = bytes(0x2C, 0, 0, 0, 0, 1, 0, 1, 0, 0, 2, 1, 0, 0)
  return new Uint8Array([...header, ...Array.from({ length: frameCount }, () => [...frame]).flat(), 0x3B])
}

describe('animated image detection', () => {
  it('distinguishes animated GIF files from single-frame GIF files', async () => {
    await expect(detectAnimatedImage(imageBlob(gif(1), 'image/gif'), 'still.gif')).resolves.toBe(false)
    await expect(detectAnimatedImage(imageBlob(gif(2), 'image/gif'), 'animated.gif')).resolves.toBe(true)
  })

  it('detects APNG animation control chunks', async () => {
    const apng = bytes(0x89, 'PNG', 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 8, 'acTL', 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0)
    await expect(detectAnimatedImage(imageBlob(apng, 'image/png'), 'animated.png')).resolves.toBe(true)
  })

  it('detects animated WebP and AVIF containers', async () => {
    const webp = bytes('RIFF', 12, 0, 0, 0, 'WEBP', 'ANIM', 0, 0, 0, 0)
    const avif = bytes(0, 0, 0, 20, 'ftyp', 'avis', 0, 0, 0, 0, 'avif')
    await expect(detectAnimatedImage(imageBlob(webp, 'image/webp'), 'animated.webp')).resolves.toBe(true)
    await expect(detectAnimatedImage(imageBlob(avif, 'image/avif'), 'animated.avif')).resolves.toBe(true)
  })

  it('detects common SVG animation mechanisms', async () => {
    const svg = new Blob(['<svg><circle><animate attributeName="r" /></circle></svg>'], { type: 'image/svg+xml' })
    await expect(detectAnimatedImage(svg, 'animated.svg')).resolves.toBe(true)
  })
})
