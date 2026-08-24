function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}

function isAnimatedPng(bytes: Uint8Array): boolean {
  if (bytes.length < 16 || ascii(bytes, 1, 3) !== 'PNG')
    return false

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset)
    if (offset + 12 + length > bytes.length)
      return false
    const type = ascii(bytes, offset + 4, 4)
    if (type === 'acTL')
      return true
    if (type === 'IDAT' || type === 'IEND')
      return false
    offset += 12 + length
  }
  return false
}

function skipGifSubBlocks(bytes: Uint8Array, start: number): number {
  let offset = start
  while (offset < bytes.length) {
    const length = bytes[offset]
    offset += 1
    if (length === 0)
      return offset
    offset += length
  }
  return bytes.length
}

function isAnimatedGif(bytes: Uint8Array): boolean {
  if (bytes.length < 13 || !ascii(bytes, 0, 6).startsWith('GIF8'))
    return false

  const globalColorTable = (bytes[10] & 0x80) !== 0
  let offset = 13 + (globalColorTable ? 3 * 2 ** ((bytes[10] & 0x07) + 1) : 0)
  let frameCount = 0

  while (offset < bytes.length) {
    const marker = bytes[offset]
    if (marker === 0x2C) {
      if (offset + 10 > bytes.length)
        return false
      const packed = bytes[offset + 9]
      frameCount += 1
      if (frameCount > 1)
        return true
      const localColorTable = (packed & 0x80) !== 0
      offset += 10 + (localColorTable ? 3 * 2 ** ((packed & 0x07) + 1) : 0)
      if (offset >= bytes.length)
        return false
      offset = skipGifSubBlocks(bytes, offset + 1)
    }
    else if (marker === 0x21) {
      if (offset + 2 >= bytes.length)
        return false
      offset = skipGifSubBlocks(bytes, offset + 2)
    }
    else if (marker === 0x3B) {
      return false
    }
    else {
      return false
    }
  }
  return false
}

function isAnimatedWebp(bytes: Uint8Array): boolean {
  if (bytes.length < 20 || ascii(bytes, 0, 4) !== 'RIFF' || ascii(bytes, 8, 4) !== 'WEBP')
    return false

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, 4)
    const length = view.getUint32(offset + 4, true)
    if (type === 'ANIM' || type === 'ANMF')
      return true
    if (type === 'VP8X' && length > 0 && offset + 8 < bytes.length && (bytes[offset + 8] & 0x02) !== 0)
      return true
    offset += 8 + length + (length % 2)
  }
  return false
}

function isAnimatedAvif(bytes: Uint8Array): boolean {
  if (bytes.length < 16 || ascii(bytes, 4, 4) !== 'ftyp')
    return false
  const boxLength = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0)
  const end = Math.min(bytes.length, boxLength || bytes.length)
  for (let offset = 8; offset + 4 <= end; offset += 4) {
    if (ascii(bytes, offset, 4) === 'avis')
      return true
  }
  return false
}

function isAnimatedSvg(bytes: Uint8Array): boolean {
  const source = new TextDecoder().decode(bytes)
  return /<(?:animate(?:motion|transform)?|set|discard|script)\b|@keyframes\b|\banimation(?:-name)?\s*:/i.test(source)
}

export async function detectAnimatedImage(blob: Blob, sourceName: string): Promise<boolean> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const type = blob.type.toLowerCase()
  const extension = sourceName.split(/[?#]/, 1)[0].split('.').pop()?.toLowerCase()

  if (type === 'image/gif' || extension === 'gif')
    return isAnimatedGif(bytes)
  if (type === 'image/png' || extension === 'png' || extension === 'apng')
    return isAnimatedPng(bytes)
  if (type === 'image/webp' || extension === 'webp')
    return isAnimatedWebp(bytes)
  if (type === 'image/avif' || extension === 'avif')
    return isAnimatedAvif(bytes)
  if (type === 'image/svg+xml' || extension === 'svg')
    return isAnimatedSvg(bytes)
  return false
}
