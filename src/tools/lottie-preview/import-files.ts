import type { LoadedLottieProject, LottieAsset, LottieDocument, LottieLayer, ResolvedImageAsset } from './types'

import { unzipSync } from 'fflate'

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  avif: 'image/avif',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
}

interface InputEntry {
  path: string
  bytes: Uint8Array
  blob: Blob
}

interface InputBundle {
  entries: InputEntry[]
  name: string
}

function extensionOf(path: string): string {
  return path.split('.').pop()?.toLowerCase() ?? ''
}

function normalizePath(path: string): string {
  const segments: string[] = []
  for (const segment of path.replaceAll('\\', '/').split('/')) {
    if (!segment || segment === '.')
      continue
    if (segment === '..') {
      segments.pop()
      continue
    }
    segments.push(segment)
  }
  return segments.join('/')
}

function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([buffer], { type })
}

async function entriesFromFiles(files: File[]): Promise<InputBundle> {
  const zip = files.find(file => extensionOf(file.name) === 'zip')
  if (zip) {
    if (files.length !== 1)
      throw new Error('ZIP 导入时请只选择一个 ZIP 文件')
    const entries = unzipSync(new Uint8Array(await zip.arrayBuffer()))
    return {
      entries: Object.entries(entries)
        .filter(([path]) => !path.endsWith('/') && !path.startsWith('__MACOSX/'))
        .map(([path, bytes]) => {
          const ext = extensionOf(path)
          const type = ext === 'json' ? 'application/json' : (IMAGE_MIME_BY_EXT[ext] ?? 'application/octet-stream')
          return { path: normalizePath(path), bytes, blob: bytesToBlob(bytes, type) }
        }),
      name: zip.name.replace(/\.zip$/i, ''),
    }
  }

  if (files.some(file => !file.webkitRelativePath))
    throw new Error('请选择一个包含 data.json 的目录，或导入 ZIP 文件')

  const rootName = normalizePath(files[0]?.webkitRelativePath ?? '').split('/')[0] || 'lottie'
  return {
    entries: await Promise.all(files.map(async (file) => {
      const bytes = new Uint8Array(await file.arrayBuffer())
      return { path: normalizePath(file.webkitRelativePath), bytes, blob: file }
    })),
    name: rootName,
  }
}

function isLottieDocument(value: unknown): value is LottieDocument {
  if (!value || typeof value !== 'object')
    return false
  const candidate = value as Partial<LottieDocument>
  return Array.isArray(candidate.layers)
    && typeof candidate.w === 'number'
    && typeof candidate.h === 'number'
    && typeof candidate.fr === 'number'
    && typeof candidate.ip === 'number'
    && typeof candidate.op === 'number'
}

function findAnimation(entries: InputEntry[]): { animation: LottieDocument, path: string, bytes: number } {
  const dataEntries = entries.filter(entry => entry.path.split('/').pop()?.toLowerCase() === 'data.json')
  if (dataEntries.length === 0)
    throw new Error('没有找到 data.json。请选择完整的 Lottie 目录或 ZIP。')
  if (dataEntries.length > 1)
    throw new Error('发现多个 data.json，请只导入一个 Lottie 资源目录。')

  const entry = dataEntries[0]
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(entry.bytes))
    if (isLottieDocument(parsed))
      return { animation: parsed, path: entry.path, bytes: entry.bytes.byteLength }
  }
  catch {
    // 统一在下面报告 data.json 格式错误。
  }
  throw new Error('data.json 不是有效的 Lottie 动画数据。')
}

function entryLookup(entries: InputEntry[]): Map<string, InputEntry> {
  return new Map(entries.map(entry => [normalizePath(entry.path), entry]))
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl)
  if (!response.ok)
    throw new Error('内嵌图片解码失败')
  return response.blob()
}

function isStillImageAsset(asset: LottieAsset): boolean {
  return !asset.layers && asset.t !== 'seq' && typeof asset.p === 'string' && typeof asset.w === 'number' && typeof asset.h === 'number'
}

export function collectReferencedAssetIds(animation: LottieDocument): Set<string> {
  const assetsById = new Map((animation.assets ?? []).map(asset => [asset.id, asset]))
  const referenced = new Set<string>()

  function visitLayers(layers: LottieLayer[] | undefined): void {
    for (const layer of layers ?? []) {
      if (!layer.refId || referenced.has(layer.refId))
        continue
      referenced.add(layer.refId)
      visitLayers(assetsById.get(layer.refId)?.layers)
    }
  }

  visitLayers(animation.layers)
  return referenced
}

export function createPreviewAnimation(project: LoadedLottieProject): LottieDocument {
  const animation = structuredClone(project.animation)
  for (const asset of animation.assets ?? []) {
    const image = project.images.get(asset.id)
    if (!image)
      continue
    asset.u = ''
    asset.p = image.url
    asset.e = 1
  }
  return animation
}

export function disposeProject(project: LoadedLottieProject | null): void {
  if (!project)
    return
  for (const image of project.images.values())
    URL.revokeObjectURL(image.url)
}

export async function loadLottieProject(files: File[]): Promise<LoadedLottieProject> {
  if (files.length === 0)
    throw new Error('请选择 ZIP 文件或包含 data.json 的目录')

  const bundle = await entriesFromFiles(files)
  const { animation, path: animationPath, bytes: jsonBytes } = findAnimation(bundle.entries)
  const animationDirectory = animationPath.includes('/') ? animationPath.slice(0, animationPath.lastIndexOf('/') + 1) : ''
  const lookup = entryLookup(bundle.entries)
  const referencedAssetIds = collectReferencedAssetIds(animation)
  const images = new Map<string, ResolvedImageAsset>()
  const warnings: string[] = []
  let sourceBytes = jsonBytes

  for (const asset of animation.assets ?? []) {
    if (!referencedAssetIds.has(asset.id))
      continue
    if (!isStillImageAsset(asset)) {
      if (!asset.layers && asset.t === 'seq')
        warnings.push(`图片序列 ${asset.id} 暂不支持图集优化`)
      continue
    }

    try {
      let blob: Blob | null = null
      let sourceName = asset.p!
      if (asset.e === 1 || asset.p!.startsWith('data:')) {
        blob = await dataUrlToBlob(asset.p!)
      }
      else if (/^https?:\/\//i.test(asset.p!)) {
        warnings.push(`远程图片 ${asset.p} 不会自动下载`)
      }
      else {
        const path = normalizePath(`${asset.u ?? ''}${asset.p ?? ''}`)
        const entry = lookup.get(normalizePath(`${animationDirectory}${path}`))
        if (entry) {
          blob = entry.blob
          sourceName = path
        }
      }

      if (!blob) {
        warnings.push(`缺少图片素材：${asset.u ?? ''}${asset.p ?? ''}`)
        continue
      }
      const url = URL.createObjectURL(blob)
      images.set(asset.id, { assetId: asset.id, asset, blob, url, sourceName })
      sourceBytes += blob.size
    }
    catch {
      warnings.push(`无法读取图片素材：${asset.p}`)
    }
  }

  return { name: bundle.name, animation, images, warnings, sourceBytes }
}
