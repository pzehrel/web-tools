/**
 * 独立前端九宫格分析，无第三方依赖。
 *
 * const pixels = await readImagePixels(file); // File、Blob 或允许 CORS 的 URL
 * const result = analyzeNineSlice(pixels)
 * if (result.accepted) {
 *   console.log(result.slice, result.cssSlice)
 *   const png = await pixelsToPng(result.compact)
 * }
 *
 * SLICE 相对于裁掉透明留白后的图及 compact 图，单位为素材像素。
 * confidence 是阈值余量评分，不是统计概率或设计验收结论。
 * 仅验证还原到原始尺寸的表现；其他展示尺寸仍需预览。
 */

export interface Pixels {
  width: number
  height: number
  data: Uint8ClampedArray
}

export interface Slice {
  top: number
  right: number
  bottom: number
  left: number
}

export interface PixelError {
  /** 在白色、黑色背景上分别合成，取更差一侧的 RGB 通道误差。 */
  mean: number
  p99: number
  max: number
  alphaMax: number
}

export interface AnalyzeOptions {
  /** 误差单位为 8 位通道数值，范围 0..255。 */
  maxMeanError?: number
  maxP99Error?: number
  maxChannelError?: number
  maxAlphaError?: number
  /** 圆角范围外额外保留的像素。默认 4。 */
  safetyPadding?: number
}

export interface NineSliceResult {
  accepted: boolean
  confidence: number
  crop: { x: number, y: number, width: number, height: number }
  slice: Slice
  cssSlice: string
  compact: Pixels
  restored: Pixels
  error: PixelError
  pixelReduction: number
  candidatesEvaluated: number
  warnings: string[]
}

interface Weight { index: number, weight: number }

function assertPixels(image: Pixels): void {
  if (!Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height)
    || image.width < 1 || image.height < 1
    || image.width * image.height > 16_000_000
    || image.data.length !== image.width * image.height * 4) {
    throw new Error('无效图像，或像素数超过 1600 万。')
  }
}

/** 只裁 alpha=0 的整行/整列，不删除半透明阴影。 */
function trimTransparent(image: Pixels): { pixels: Pixels, crop: NineSliceResult['crop'] } {
  let left = image.width
  let top = image.height
  let right = -1
  let bottom = -1
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3] === 0)
        continue
      left = Math.min(left, x)
      right = Math.max(right, x)
      top = Math.min(top, y)
      bottom = Math.max(bottom, y)
    }
  }
  if (right < 0)
    throw new Error('全透明图像没有可分析内容。')
  const width = right - left + 1
  const height = bottom - top + 1
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    const start = ((top + y) * image.width + left) * 4
    data.set(image.data.subarray(start, start + width * 4), y * width * 4)
  }
  return { pixels: { width, height, data }, crop: { x: left, y: top, width, height } }
}

/** 检测四条外沿在两端的 alpha 变化，作为圆角/阴影保留范围的下限。 */
function geometrySlice(image: Pixels, padding: number): Slice {
  const alpha = (x: number, y: number) => image.data[(y * image.width + x) * 4 + 3]
  const edgeRuns = (length: number, read: (i: number) => number): [number, number] => {
    let peak = 0
    for (let i = 0; i < length; i++) peak = Math.max(peak, read(i))
    // 完全透明外沿或不规则图形由后续还原误差筛选，不推断圆角。
    if (peak === 0)
      return [0, 0]
    let start = 0
    let end = 0
    while (start < Math.floor(length / 2) && read(start) < peak) start++
    while (end < Math.floor(length / 2) && read(length - 1 - end) < peak) end++
    return [start, end]
  }
  const [tl, tr] = edgeRuns(image.width, x => alpha(x, 0))
  const [bl, br] = edgeRuns(image.width, x => alpha(x, image.height - 1))
  const [lt, lb] = edgeRuns(image.height, y => alpha(0, y))
  const [rt, rb] = edgeRuns(image.height, y => alpha(image.width - 1, y))
  // 无透明圆角时使用保守起点；这不等于已识别边框厚度。
  const fallback = Math.max(1, Math.ceil(Math.min(image.width, image.height) * 0.04))
  const cap = (value: number, dimension: number) => Math.min(
    Math.max(value === 0 ? fallback : value, 1) + padding,
    Math.floor((dimension - 1) / 2),
  )
  return {
    left: cap(Math.max(tl, bl), image.width),
    right: cap(Math.max(tr, br), image.width),
    top: cap(Math.max(lt, rt), image.height),
    bottom: cap(Math.max(lb, rb), image.height),
  }
}

/** 单段缩小用面积采样，放大用双线性插值；采样不会越过切片边界。 */
function segmentWeights(start: number, sourceLength: number, targetLength: number): Weight[][] {
  const scale = sourceLength / targetLength
  return Array.from({ length: targetLength }, (_, position) => {
    if (sourceLength === targetLength)
      return [{ index: start + position, weight: 1 }]
    if (scale > 1) {
      const from = position * scale
      const to = (position + 1) * scale
      const weights: Weight[] = []
      for (let index = Math.floor(from); index < Math.min(sourceLength, Math.ceil(to)); index++) {
        const overlap = Math.min(to, index + 1) - Math.max(from, index)
        if (overlap > 0)
          weights.push({ index: start + index, weight: overlap / scale })
      }
      return weights
    }
    const center = Math.max(0, Math.min(sourceLength - 1, (position + 0.5) * scale - 0.5))
    const low = Math.floor(center)
    const high = Math.min(sourceLength - 1, low + 1)
    const fraction = center - low
    return [{ index: start + low, weight: 1 - fraction }, { index: start + high, weight: fraction }]
  })
}

function axisWeights(source: number, target: number, before: number, after: number): Weight[][] {
  return [
    ...segmentWeights(0, before, before),
    ...segmentWeights(before, source - before - after, target - before - after),
    ...segmentWeights(source - after, after, after),
  ]
}

/** 保留四角原像素，仅调整边条和中心。颜色插值使用预乘 alpha，避免透明边黑晕。 */
export function resizeNineSlice(image: Pixels, width: number, height: number, slice: Slice): Pixels {
  assertPixels(image)
  const caps = [slice.top, slice.right, slice.bottom, slice.left]
  if (!caps.every(value => Number.isSafeInteger(value) && value > 0)
    || !Number.isSafeInteger(width) || !Number.isSafeInteger(height)
    || width <= slice.left + slice.right || height <= slice.top + slice.bottom
    || image.width <= slice.left + slice.right || image.height <= slice.top + slice.bottom
    || width * height > 16_000_000) {
    throw new Error('尺寸必须超过两侧 SLICE 之和，且总像素不得超过 1600 万。')
  }
  const xs = axisWeights(image.width, width, slice.left, slice.right)
  const ys = axisWeights(image.height, height, slice.top, slice.bottom)
  const horizontal = new Float32Array(width * image.height * 4)
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < width; x++) {
      const target = (y * width + x) * 4
      for (const { index, weight } of xs[x]) {
        const source = (y * image.width + index) * 4
        const alpha = image.data[source + 3] / 255
        for (let c = 0; c < 3; c++) horizontal[target + c] += image.data[source + c] * alpha * weight
        horizontal[target + 3] += image.data[source + 3] * weight
      }
    }
  }
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const target = (y * width + x) * 4
      let red = 0
      let green = 0
      let blue = 0
      let alpha = 0
      for (const { index, weight } of ys[y]) {
        const source = (index * width + x) * 4
        red += horizontal[source] * weight
        green += horizontal[source + 1] * weight
        blue += horizontal[source + 2] * weight
        alpha += horizontal[source + 3] * weight
      }
      if (alpha > 0) {
        data[target] = red * 255 / alpha
        data[target + 1] = green * 255 / alpha
        data[target + 2] = blue * 255 / alpha
      }
      data[target + 3] = alpha
    }
  }
  // 包括 alpha=0 时的隐藏 RGB，四角也逐字节保留。
  for (let y = 0; y < height; y++) {
    if (y >= slice.top && y < height - slice.bottom)
      continue
    const sy = y < slice.top ? y : image.height - height + y
    for (const [start, end, offset] of [[0, slice.left, 0], [width - slice.right, width, image.width - width]]) {
      const source = (sy * image.width + start + offset) * 4
      data.set(image.data.subarray(source, source + (end - start) * 4), (y * width + start) * 4)
    }
  }
  return { width, height, data }
}

export function comparePixels(original: Pixels, restored: Pixels): PixelError {
  assertPixels(original)
  assertPixels(restored)
  if (original.width !== restored.width || original.height !== restored.height) {
    throw new Error('比较图像的尺寸必须一致。')
  }
  const histogram = new Uint32Array(256)
  let sum = 0
  let max = 0
  let alphaMax = 0
  let count = 0
  for (let i = 0; i < original.data.length; i += 4) {
    const a = original.data[i + 3] / 255
    const b = restored.data[i + 3] / 255
    alphaMax = Math.max(alphaMax, Math.abs(original.data[i + 3] - restored.data[i + 3]))
    for (let c = 0; c < 3; c++) {
      const black = original.data[i + c] * a - restored.data[i + c] * b
      const error = Math.max(Math.abs(black), Math.abs(black + (b - a) * 255))
      sum += error
      max = Math.max(max, error)
      count++
      histogram[Math.min(255, Math.ceil(error))]++
    }
  }
  let cumulative = 0
  let p99 = 0
  for (; p99 < 255; p99++) {
    cumulative += histogram[p99]
    if (cumulative >= Math.ceil(count * 0.99))
      break
  }
  return { mean: sum / count, p99, max, alphaMax }
}

/**
 * 从 alpha 几何范围出发，搜索保留边距及中央采样尺寸。
 * 在有限候选中选择通过误差阈值且像素数最少的方案，不承诺全局最优。
 * 同一素材建议离线或在 Worker 中分析一次，不在页面渲染循环中调用。
 */
export function analyzeNineSlice(input: Pixels, options: AnalyzeOptions = {}): NineSliceResult {
  assertPixels(input)
  const limits = {
    mean: options.maxMeanError ?? 0.25,
    p99: options.maxP99Error ?? 2,
    max: options.maxChannelError ?? 8,
    alphaMax: options.maxAlphaError ?? 0,
  }
  if (!Object.values(limits).every(value => Number.isFinite(value) && value >= 0 && value <= 255)) {
    throw new Error('误差阈值必须为 0..255 的有限数值。')
  }
  const padding = options.safetyPadding ?? 4
  if (!Number.isSafeInteger(padding) || padding < 0)
    throw new Error('safetyPadding 必须为非负整数。')
  const { pixels: original, crop } = trimTransparent(input)
  if (original.width < 4 || original.height < 4)
    throw new Error('内容尺寸至少为 4×4。')
  const base = geometrySlice(original, padding)
  const slices: Slice[] = [base]
  // 上、下、左、右分别扩大保留范围；允许高光方向不同的素材。
  for (const side of ['top', 'bottom', 'left', 'right'] as const) {
    for (const extra of [16, 32, 64]) {
      const slice = { ...base, [side]: base[side] + extra }
      if (slice.left + slice.right < original.width && slice.top + slice.bottom < original.height)
        slices.push(slice)
    }
  }
  const samples = [[16, 16], [32, 16], [32, 32], [48, 32], [64, 32], [64, 48], [96, 64], [128, 96]]
  let best: NineSliceResult | undefined
  let evaluated = 0
  const seen = new Set<string>()
  for (const slice of slices) {
    for (const [centerWidth, centerHeight] of samples) {
      const width = Math.min(original.width, slice.left + slice.right + centerWidth)
      const height = Math.min(original.height, slice.top + slice.bottom + centerHeight)
      const key = `${slice.top},${slice.right},${slice.bottom},${slice.left},${width},${height}`
      if (seen.has(key))
        continue
      seen.add(key)
      // 已通过的更小方案存在时，不再计算更大的候选。
      if (best?.accepted && width * height >= best.compact.width * best.compact.height)
        continue
      const compact = resizeNineSlice(original, width, height, slice)
      const restored = resizeNineSlice(compact, original.width, original.height, slice)
      const error = comparePixels(original, restored)
      evaluated++
      const accepted = error.mean <= limits.mean && error.p99 <= limits.p99
        && error.max <= limits.max && error.alphaMax <= limits.alphaMax
      const ratios = (Object.keys(limits) as (keyof PixelError)[]).map(key =>
        limits[key] === 0 ? (error[key] === 0 ? 0 : Infinity) : error[key] / limits[key])
      const score = Math.max(...ratios)
      const confidence = accepted ? Math.max(0, 1 - score) : 0
      const candidate: NineSliceResult = {
        accepted,
        confidence,
        crop,
        slice,
        cssSlice: `${slice.top} ${slice.right} ${slice.bottom} ${slice.left} fill`,
        compact,
        restored,
        error,
        pixelReduction: 1 - width * height / (original.width * original.height),
        candidatesEvaluated: evaluated,
        warnings: [],
      }
      if (!best || (accepted && !best.accepted)
        || (accepted && best.accepted && width * height < best.compact.width * best.compact.height)
        || (!accepted && !best.accepted && error.mean < best.error.mean)) {
        best = candidate
      }
    }
  }
  if (!best)
    throw new Error('没有有效候选。')
  best.candidatesEvaluated = evaluated
  best.warnings.push('只验证原尺寸还原；目标尺寸变化后需检查渐变和纹理。')
  if (!best.accepted)
    best.warnings.push('候选均超过误差阈值，建议保留原图或手工调整切线。')
  if (crop.width !== input.width || crop.height !== input.height) {
    best.warnings.push('已裁掉全透明留白；SLICE 坐标相对于裁剪后的图像。')
  }
  return best
}

/** 浏览器读取；跨域 URL 必须由服务器允许 CORS。Blob URL 在读取后释放。 */
export async function readImagePixels(source: Blob | string): Promise<Pixels> {
  const ownedUrl = typeof source !== 'string'
  const url = ownedUrl ? URL.createObjectURL(source) : source
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.crossOrigin = 'anonymous'
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('图片加载失败，请检查格式、URL 或 CORS。'))
      element.src = url
    })
    if (image.naturalWidth * image.naturalHeight > 16_000_000)
      throw new Error('像素数超过 1600 万。')
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context)
      throw new Error('Canvas 2D 不可用。')
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    return { width: pixels.width, height: pixels.height, data: pixels.data }
  }
  finally {
    if (ownedUrl)
      URL.revokeObjectURL(url)
  }
}

export async function pixelsToPng(pixels: Pixels): Promise<Blob> {
  assertPixels(pixels)
  const canvas = document.createElement('canvas')
  canvas.width = pixels.width
  canvas.height = pixels.height
  const context = canvas.getContext('2d')
  if (!context)
    throw new Error('Canvas 2D 不可用。')
  const data = context.createImageData(pixels.width, pixels.height)
  data.data.set(pixels.data)
  context.putImageData(data, 0, 0)
  return new Promise((resolve, reject) => canvas.toBlob((blob) => {
    if (blob)
      resolve(blob)
    else reject(new Error('PNG 导出失败。'))
  }, 'image/png'))
}
