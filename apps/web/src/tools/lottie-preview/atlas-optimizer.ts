import type {
  AtlasOptions,
  AtlasOutput,
  LoadedLottieProject,
  LottieAsset,
  LottieDocument,
  LottieLayer,
  OptimizedLottieResult,
  ResolvedImageAsset,
} from './types'
import { zipSync } from 'fflate'

import { MaxRectsPacker, Rectangle } from 'maxrects-packer'
import { collectReferencedAssetIds } from './import-files'

interface PreparedSprite {
  assetIds: string[]
  canvas: HTMLCanvasElement
  contentHeight: number
  contentWidth: number
  extruded: HTMLCanvasElement
  originalHeight: number
  originalWidth: number
  trimLeft: number
  trimTop: number
}

interface PlacedSprite {
  atlasIndex: number
  contentHeight: number
  contentWidth: number
  contentX: number
  contentY: number
  originalHeight: number
  originalWidth: number
  rotated: boolean
  trimLeft: number
  trimTop: number
}

interface SpriteRectangle extends Rectangle {
  data: PreparedSprite
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob)
        resolve(blob)
      else
        reject(new Error('浏览器无法生成 PNG 图集'))
    }, 'image/png')
  })
}

function loadBitmap(image: ResolvedImageAsset): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error(`无法解码图片：${image.sourceName}`))
    element.src = image.url
  })
}

function alignmentOffset(mode: string, available: number): number {
  if (mode.includes('xMax') || mode.includes('YMax'))
    return available
  if (mode.includes('xMid') || mode.includes('YMid'))
    return available / 2
  return 0
}

async function normalizeAsset(image: ResolvedImageAsset): Promise<HTMLCanvasElement> {
  const bitmap = await loadBitmap(image)
  const width = Math.max(1, Math.round(image.asset.w ?? bitmap.naturalWidth))
  const height = Math.max(1, Math.round(image.asset.h ?? bitmap.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context)
    throw new Error('浏览器不支持 Canvas 2D')

  const preserveAspectRatio = image.asset.pr ?? 'xMidYMid slice'
  if (preserveAspectRatio === 'none') {
    context.drawImage(bitmap, 0, 0, width, height)
    return canvas
  }

  const fit = preserveAspectRatio.includes('meet') ? 'meet' : 'slice'
  const scale = fit === 'meet'
    ? Math.min(width / bitmap.naturalWidth, height / bitmap.naturalHeight)
    : Math.max(width / bitmap.naturalWidth, height / bitmap.naturalHeight)
  const drawWidth = bitmap.naturalWidth * scale
  const drawHeight = bitmap.naturalHeight * scale
  const x = alignmentOffset(preserveAspectRatio, width - drawWidth)
  const y = alignmentOffset(preserveAspectRatio.replace('x', 'Y'), height - drawHeight)
  context.drawImage(bitmap, x, y, drawWidth, drawHeight)
  return canvas
}

function trimCanvas(source: HTMLCanvasElement, threshold: number): {
  canvas: HTMLCanvasElement
  left: number
  top: number
} {
  const context = source.getContext('2d', { willReadFrequently: true })
  if (!context)
    throw new Error('浏览器不支持 Canvas 2D')
  const pixels = context.getImageData(0, 0, source.width, source.height).data
  let left = source.width
  let top = source.height
  let right = -1
  let bottom = -1

  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const alpha = pixels[(y * source.width + x) * 4 + 3]
      if (alpha <= threshold)
        continue
      left = Math.min(left, x)
      top = Math.min(top, y)
      right = Math.max(right, x)
      bottom = Math.max(bottom, y)
    }
  }

  if (right < left || bottom < top) {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    return { canvas, left: 0, top: 0 }
  }

  const canvas = document.createElement('canvas')
  canvas.width = right - left + 1
  canvas.height = bottom - top + 1
  canvas.getContext('2d')?.drawImage(source, left, top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
  return { canvas, left, top }
}

function extrudeCanvas(source: HTMLCanvasElement, amount: number): HTMLCanvasElement {
  if (amount === 0)
    return source
  const canvas = document.createElement('canvas')
  canvas.width = source.width + amount * 2
  canvas.height = source.height + amount * 2
  const context = canvas.getContext('2d')
  if (!context)
    throw new Error('浏览器不支持 Canvas 2D')

  context.imageSmoothingEnabled = false
  context.drawImage(source, amount, amount)
  context.drawImage(source, 0, 0, 1, source.height, 0, amount, amount, source.height)
  context.drawImage(source, source.width - 1, 0, 1, source.height, amount + source.width, amount, amount, source.height)
  context.drawImage(source, 0, 0, source.width, 1, amount, 0, source.width, amount)
  context.drawImage(source, 0, source.height - 1, source.width, 1, amount, amount + source.height, source.width, amount)
  context.drawImage(source, 0, 0, 1, 1, 0, 0, amount, amount)
  context.drawImage(source, source.width - 1, 0, 1, 1, amount + source.width, 0, amount, amount)
  context.drawImage(source, 0, source.height - 1, 1, 1, 0, amount + source.height, amount, amount)
  context.drawImage(source, source.width - 1, source.height - 1, 1, 1, amount + source.width, amount + source.height, amount, amount)
  return canvas
}

function canvasHash(canvas: HTMLCanvasElement): string {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context)
    return `${canvas.width}x${canvas.height}`
  const data = context.getImageData(0, 0, canvas.width, canvas.height).data
  let hash = 2166136261
  for (const value of data) {
    hash ^= value
    hash = Math.imul(hash, 16777619)
  }
  return `${canvas.width}x${canvas.height}:${(hash >>> 0).toString(16)}`
}

async function prepareSprites(project: LoadedLottieProject, options: AtlasOptions): Promise<PreparedSprite[]> {
  const sprites: PreparedSprite[] = []
  const duplicateMap = new Map<string, PreparedSprite>()
  for (const image of project.images.values()) {
    const normalized = await normalizeAsset(image)
    const trimmed = options.allowTrim
      ? trimCanvas(normalized, options.alphaThreshold)
      : { canvas: normalized, left: 0, top: 0 }
    const key = options.detectIdentical
      ? `${normalized.width}x${normalized.height}:${trimmed.left},${trimmed.top}:${canvasHash(trimmed.canvas)}`
      : ''
    const duplicate = key ? duplicateMap.get(key) : undefined
    if (duplicate) {
      duplicate.assetIds.push(image.assetId)
      continue
    }
    const sprite: PreparedSprite = {
      assetIds: [image.assetId],
      canvas: trimmed.canvas,
      contentHeight: trimmed.canvas.height,
      contentWidth: trimmed.canvas.width,
      extruded: extrudeCanvas(trimmed.canvas, options.extrude),
      originalHeight: normalized.height,
      originalWidth: normalized.width,
      trimLeft: trimmed.left,
      trimTop: trimmed.top,
    }
    sprites.push(sprite)
    if (key)
      duplicateMap.set(key, sprite)
  }
  return sprites
}

function uniqueId(base: string, usedIds: Set<string>): string {
  let id = base
  let suffix = 1
  while (usedIds.has(id)) {
    id = `${base}_${suffix}`
    suffix++
  }
  usedIds.add(id)
  return id
}

function atlasLayer(atlasId: string, placement: PlacedSprite): LottieLayer {
  const position = placement.rotated
    ? [placement.trimLeft, placement.trimTop + placement.contentHeight, 0]
    : [placement.trimLeft, placement.trimTop, 0]
  return {
    ddd: 0,
    ind: 1,
    ty: 2,
    nm: 'Texture atlas region',
    hasMask: true,
    masksProperties: [
      {
        inv: false,
        mode: 'a',
        nm: 'Atlas region mask',
        o: { a: 0, k: 100 },
        pt: {
          a: 0,
          k: {
            c: true,
            i: [[0, 0], [0, 0], [0, 0], [0, 0]],
            o: [[0, 0], [0, 0], [0, 0], [0, 0]],
            v: [
              [placement.contentX, placement.contentY],
              [placement.contentX + placement.contentWidth, placement.contentY],
              [placement.contentX + placement.contentWidth, placement.contentY + placement.contentHeight],
              [placement.contentX, placement.contentY + placement.contentHeight],
            ],
          },
        },
        x: { a: 0, k: 0 },
      },
    ],
    refId: atlasId,
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: { a: 0, k: placement.rotated ? -90 : 0 },
      p: { a: 0, k: position },
      a: { a: 0, k: [placement.contentX, placement.contentY, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    ao: 0,
    ip: -100000,
    op: 100000,
    st: 0,
    bm: 0,
  }
}

function replaceImageLayers(layers: LottieLayer[] | undefined, spriteIds: Map<string, string>, sizes: Map<string, PlacedSprite>): void {
  if (!layers)
    return
  for (const layer of layers) {
    if (layer.ty !== 2 || !layer.refId)
      continue
    const spriteId = spriteIds.get(layer.refId)
    const placement = sizes.get(layer.refId)
    if (!spriteId || !placement)
      continue
    layer.ty = 0
    layer.refId = spriteId
    layer.w = placement.originalWidth
    layer.h = placement.originalHeight
  }
}

function rewriteAnimation(
  source: LottieDocument,
  atlasAssets: LottieAsset[],
  placements: Map<string, PlacedSprite>,
): LottieDocument {
  const animation = structuredClone(source)
  const referencedAssetIds = collectReferencedAssetIds(source)
  const optimizedIds = new Set(placements.keys())
  const usedIds = new Set((animation.assets ?? []).map(asset => asset.id))
  const atlasIds = atlasAssets.map(asset => uniqueId(asset.id, usedIds))
  atlasAssets.forEach((asset, index) => asset.id = atlasIds[index])
  const spriteIds = new Map<string, string>()
  const spriteAssets: LottieAsset[] = []

  for (const [assetId, placement] of placements) {
    const spriteId = uniqueId(`__atlas_sprite_${assetId}`, usedIds)
    spriteIds.set(assetId, spriteId)
    spriteAssets.push({
      id: spriteId,
      w: placement.originalWidth,
      h: placement.originalHeight,
      layers: [atlasLayer(atlasIds[placement.atlasIndex], placement)],
    })
  }

  const keptAssets = (animation.assets ?? []).filter(asset => referencedAssetIds.has(asset.id) && !optimizedIds.has(asset.id))
  for (const asset of keptAssets)
    replaceImageLayers(asset.layers, spriteIds, placements)
  replaceImageLayers(animation.layers, spriteIds, placements)
  animation.assets = [...keptAssets, ...atlasAssets, ...spriteAssets]
  return animation
}

export function disposeOptimizedResult(result: OptimizedLottieResult | null): void {
  if (!result)
    return
  for (const atlas of result.atlases)
    URL.revokeObjectURL(atlas.objectUrl)
}

export async function optimizeLottie(project: LoadedLottieProject, options: AtlasOptions): Promise<OptimizedLottieResult> {
  if (project.images.size === 0)
    throw new Error('没有可打包的图片素材')

  const sprites = await prepareSprites(project, options)
  const rectangles = sprites.map((sprite) => {
    if (sprite.extruded.width + options.padding * 2 > options.maxSize || sprite.extruded.height + options.padding * 2 > options.maxSize)
      throw new Error(`有图片超过 ${options.maxSize}×${options.maxSize} 图集上限，请调大最大尺寸或开启透明边裁剪`)
    const rectangle = new Rectangle(sprite.extruded.width, sprite.extruded.height, 0, 0, false, options.allowRotation) as SpriteRectangle
    rectangle.data = sprite
    return rectangle
  })
  const packer = new MaxRectsPacker<SpriteRectangle>(options.maxSize, options.maxSize, options.padding, {
    allowRotation: options.allowRotation,
    border: options.padding,
    pot: options.powerOfTwo,
    smart: true,
    square: options.square,
  })
  packer.addArray(rectangles)

  const placements = new Map<string, PlacedSprite>()
  const atlases: AtlasOutput[] = []
  let usedArea = 0
  let atlasArea = 0
  for (const [atlasIndex, bin] of packer.bins.entries()) {
    const canvas = document.createElement('canvas')
    canvas.width = bin.width
    canvas.height = bin.height
    const context = canvas.getContext('2d')
    if (!context)
      throw new Error('浏览器不支持 Canvas 2D')
    for (const rectangle of bin.rects) {
      const sprite = rectangle.data
      context.save()
      if (rectangle.rot) {
        context.translate(rectangle.x + rectangle.width, rectangle.y)
        context.rotate(Math.PI / 2)
      }
      context.drawImage(sprite.extruded, rectangle.rot ? 0 : rectangle.x, rectangle.rot ? 0 : rectangle.y)
      context.restore()
      const placement: PlacedSprite = {
        atlasIndex,
        contentHeight: sprite.contentHeight,
        contentWidth: sprite.contentWidth,
        contentX: rectangle.x + options.extrude,
        contentY: rectangle.y + options.extrude,
        originalHeight: sprite.originalHeight,
        originalWidth: sprite.originalWidth,
        rotated: rectangle.rot,
        trimLeft: sprite.trimLeft,
        trimTop: sprite.trimTop,
      }
      for (const assetId of sprite.assetIds)
        placements.set(assetId, placement)
      usedArea += sprite.extruded.width * sprite.extruded.height
    }
    const filename = `atlas-${atlasIndex + 1}.png`
    const blob = await canvasBlob(canvas)
    atlases.push({
      id: `__lottie_atlas_${atlasIndex + 1}`,
      filename,
      blob,
      width: canvas.width,
      height: canvas.height,
      objectUrl: URL.createObjectURL(blob),
    })
    atlasArea += canvas.width * canvas.height
  }

  const atlasAssets: LottieAsset[] = atlases.map(atlas => ({
    id: atlas.id,
    w: atlas.width,
    h: atlas.height,
    u: '',
    p: atlas.filename,
    e: 0,
  }))
  const animation = rewriteAnimation(project.animation, atlasAssets, placements)
  const previewAnimation = structuredClone(animation)
  for (const asset of previewAnimation.assets ?? []) {
    const atlas = atlases.find(item => item.filename === asset.p)
    if (!atlas)
      continue
    asset.u = ''
    asset.p = atlas.objectUrl
    asset.e = 1
  }

  return {
    animation,
    previewAnimation,
    atlases,
    sourceImageCount: project.images.size,
    packedImageCount: sprites.length,
    occupancy: atlasArea === 0 ? 0 : usedArea / atlasArea,
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function exportOptimizedProject(project: LoadedLottieProject, result: OptimizedLottieResult): Promise<void> {
  const entries: Record<string, Uint8Array> = {
    'data.json': new TextEncoder().encode(JSON.stringify(result.animation, null, 2)),
  }
  for (const atlas of result.atlases)
    entries[atlas.filename] = new Uint8Array(await atlas.blob.arrayBuffer())
  const zip = zipSync(entries, { level: 6 })
  triggerDownload(new Blob([zip as BlobPart], { type: 'application/zip' }), `${project.name}-atlas.zip`)
}
