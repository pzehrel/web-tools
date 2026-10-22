import type { LucideIcon } from 'lucide-react'
import type { ChangeEvent, DragEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import type { FrameAnimationRecordMeta } from './records'
import { unzipSync } from 'fflate'
import {
  ArrowDownAZ,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crop,
  FileImage,
  FolderOpen,
  ImagePlus,
  Images,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Seo } from '@/components/seo'
import { STAGE_BOUNDARY_CLASS, StageViewControls, useStageViewSettings } from '@/components/stage-view-controls'
import { StageZoomIndicator } from '@/components/stage-zoom-indicator'
import { Button } from '@/components/ui/button'
import { measureUnobstructedStageFit, useAutoFitZoom, useStageFitScale, useStagePan, useStageZoom } from '@/lib/stage'
import { saveContentRecord } from '@/lib/storage/content-record'
import { cn } from '@/lib/utils'
import { createDemoFrames } from '../demos/frame-animation'
import { createFrameAnimationItem, createFrameArchive, extractFrameArchive, useFrameAnimationRecords } from './records'
import './workspace.scss'

/** 一帧：Blob 用于记录持久化，objectURL 仅用于当前页面预览 */
interface FrameItem {
  id: string
  /** 上传序号：导入时分配，重排 / 裁剪后保持不变 */
  seq: number
  name: string
  blob: Blob
  url: string
  width: number
  height: number
  /** 文件字节数 */
  size: number
}

type Direction = 'forward' | 'reverse' | 'pingpong'
type SpriteDimensionAxis = 'cols' | 'rows'
interface SpriteDims {
  cols: number
  rows: number
}
/** 文件名自然排序（数字按数值比较，frame2 < frame10） */
const collator = new Intl.Collator('zh', { numeric: true, sensitivity: 'base' })

function formatSize(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/** 代码区内的全选只选择代码，避免快捷键扩散到整页。 */
function selectCodeOnShortcut(e: ReactKeyboardEvent<HTMLPreElement>): void {
  if (e.key.toLowerCase() !== 'a' || (!e.metaKey && !e.ctrlKey))
    return

  e.preventDefault()
  e.stopPropagation()
  const selection = window.getSelection()
  if (!selection)
    return

  const range = document.createRange()
  range.selectNodeContents(e.currentTarget)
  selection.removeAllRanges()
  selection.addRange(range)
}

/** 读取图片为一帧（seq 由调用方分配）；解码失败返回 null（调用方过滤） */
function loadFrame(name: string, blob: Blob): Promise<Omit<FrameItem, 'seq'> | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => resolve({
      id: crypto.randomUUID(),
      name,
      blob,
      url,
      width: img.naturalWidth,
      height: img.naturalHeight,
      size: blob.size,
    })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

/* ---------- 压缩包导入 ---------- */

const IMAGE_MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
}

/** 按扩展名判断图片并给出 MIME；非图片返回 null */
function imageMimeOf(name: string): string | null {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_MIME_BY_EXT[ext] ?? null
}

interface IncomingImage {
  name: string
  blob: Blob
}

/** Uint8Array → Blob：切出精确的 ArrayBuffer 段（避免 TS 泛型与视图偏移问题） */
function bytesToBlob(data: Uint8Array, mime: string): Blob {
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
  return new Blob([buf], { type: mime })
}

/** 解 ZIP：取所有图片条目，忽略 macOS 元数据目录 */
async function extractZip(file: File): Promise<IncomingImage[]> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()))
  return Object.entries(entries)
    .filter(([path]) => !path.startsWith('__MACOSX') && imageMimeOf(path) !== null)
    .map(([path, data]) => ({
      name: path.split('/').pop() || path,
      blob: bytesToBlob(data, imageMimeOf(path)!),
    }))
}

/** alpha 阈值默认值：低于此值视为透明，避免抗锯齿边缘的半透明噪点撑大包围盒 */
const DEFAULT_ALPHA_THRESHOLD = 10

interface OpaqueBox {
  left: number
  top: number
  /** 右 / 下边界（开区间） */
  right: number
  bottom: number
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

/** 读取图片像素数据；取不到 2d 上下文返回 null */
function readImageData(img: HTMLImageElement): ImageData | null {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx)
    return null
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/** 扫描像素的非透明包围盒（alpha 大于 threshold 视为非透明）；全透明返回 null */
function scanOpaqueBox({ data, width, height }: ImageData, threshold: number): OpaqueBox | null {
  const colHasOpaque = (x: number) => {
    for (let y = 0; y < height; y++) {
      if (data[(y * width + x) * 4 + 3] > threshold)
        return true
    }
    return false
  }
  const rowHasOpaque = (y: number) => {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > threshold)
        return true
    }
    return false
  }

  let left = 0
  while (left < width && !colHasOpaque(left)) left++
  if (left === width)
    return null
  let right = width - 1
  while (!colHasOpaque(right)) right--
  let top = 0
  while (!rowHasOpaque(top)) top++
  let bottom = height - 1
  while (!rowHasOpaque(bottom)) bottom--
  return { left, top, right: right + 1, bottom: bottom + 1 }
}

/** 由缓存像素按阈值计算所有帧的并集包围盒；全部全透明返回 null */
function computeUnionBox(scan: ImageData[], threshold: number): OpaqueBox | null {
  let union: OpaqueBox | null = null
  for (const d of scan) {
    const box = scanOpaqueBox(d, threshold)
    if (!box)
      continue
    union = union
      ? {
          left: Math.min(union.left, box.left),
          top: Math.min(union.top, box.top),
          right: Math.max(union.right, box.right),
          bottom: Math.max(union.bottom, box.bottom),
        }
      : box
  }
  return union
}

/** 把图片按 rect 裁剪成 PNG，返回新的 objectURL 等信息 */
async function cropFrameImage(
  frame: FrameItem,
  rect: OpaqueBox,
): Promise<Pick<FrameItem, 'blob' | 'url' | 'width' | 'height' | 'size'> | null> {
  const img = await loadImage(frame.url)
  // 裁剪坐标与各帧自身尺寸取交集（帧尺寸可能不一致）
  const left = Math.min(rect.left, img.naturalWidth)
  const top = Math.min(rect.top, img.naturalHeight)
  const right = Math.min(rect.right, img.naturalWidth)
  const bottom = Math.min(rect.bottom, img.naturalHeight)
  const w = right - left
  const h = bottom - top
  if (w <= 0 || h <= 0)
    return null
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return null
  ctx.drawImage(img, left, top, w, h, 0, 0, w, h)
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob)
    return null
  return { blob, url: URL.createObjectURL(blob), width: w, height: h, size: blob.size }
}

/** 把所有帧拼成精灵图：单元格取最大宽 / 高，帧在格内居中 */
async function buildSpriteSheet(frames: FrameItem[], dims: SpriteDims): Promise<Blob | null> {
  if (frames.length === 0)
    return null
  const cellW = Math.max(...frames.map(f => f.width))
  const cellH = Math.max(...frames.map(f => f.height))
  const { cols, rows } = dims
  const canvas = document.createElement('canvas')
  canvas.width = cellW * cols
  canvas.height = cellH * rows
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return null
  for (let i = 0; i < frames.length; i++) {
    const img = await loadImage(frames[i].url)
    const col = i % cols
    const row = Math.floor(i / cols)
    ctx.drawImage(
      img,
      col * cellW + (cellW - img.naturalWidth) / 2,
      row * cellH + (cellH - img.naturalHeight) / 2,
    )
  }
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

/** 把所有帧叠放合成一张预览图（逆序绘制 = 最后一帧垫底，首帧在最上） */
async function buildStackPreview(frames: FrameItem[]): Promise<Blob | null> {
  if (frames.length === 0)
    return null
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(...frames.map(f => f.width))
  canvas.height = Math.max(...frames.map(f => f.height))
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return null
  for (let i = frames.length - 1; i >= 0; i--) {
    const img = await loadImage(frames[i].url)
    ctx.drawImage(img, 0, 0)
  }
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

/* ---------- 样式导出 ---------- */

type ExportFormat = 'css' | 'less' | 'scss'
/** 精灵图布局：strip = 单行长条；grid = 接近方形的网格（规避超长图） */
type SpriteLayout = 'strip' | 'grid'

interface ExportParams {
  frames: number
  /** 一轮时长（秒，已格式化） */
  duration: string
  /** 'infinite' 或次数 */
  iteration: string
  /** CSS animation-direction 值 */
  direction: 'normal' | 'reverse' | 'alternate'
  pixelated: boolean
  /** 单帧（单元格）尺寸 */
  cellW: number
  cellH: number
  /** 变量：帧数 / 时长提取为变量，便于集中调整 */
  useVars: boolean
  /**
   * 容器：宽高交给容器（100% + aspect-ratio），帧切换走百分比定位；
   *  关闭则写死单帧 px 尺寸，background-position 用 px
   */
  useContainer: boolean
  layout: SpriteLayout
  cols: number
  rows: number
}

const SPRITE_URL = 'YOUR-IMAGE-PATH.EXT'

/** 数字格式：两位小数截尾零 */
function num(v: number): number {
  return Number(v.toFixed(2))
}

/** 由最后编辑的列数或行数推导另一维；空白格只允许出现在末行 / 末列 */
function resolveSpriteDims(frameCount: number, axis: SpriteDimensionAxis, value: number): SpriteDims {
  const count = Math.max(1, frameCount)
  const primary = Math.min(count, Math.max(1, Math.floor(value)))
  return axis === 'cols'
    ? { cols: primary, rows: Math.ceil(count / primary) }
    : { cols: Math.ceil(count / primary), rows: primary }
}

/**
 * Language adapters: variable references/declarations, comments, final-frame pixel offsets and nested keyframes.
 * 语言差异适配：变量引用 / 变量声明 / 注释 / 「末帧偏移 px」表达式 / keyframes 能否嵌进选择器。
 */
interface LangSpec {
  v: (name: string) => string
  decl: (name: string, value: string) => string
  comment: (text: string) => string
  framesTimesPx: (cellW: number) => string
  /** SCSS / Less 支持 @keyframes 嵌套在选择器内（编译时冒泡到顶层）；原生 CSS 必须平铺 */
  nestedKeyframes: boolean
}

const LANG: Record<ExportFormat, LangSpec> = {
  css: {
    v: n => `var(--${n})`,
    decl: (n, val) => `  --${n}: ${val};`,
    comment: t => `/* ${t} */`,
    framesTimesPx: w => `calc((var(--frames) - 1) * -${w}px)`,
    nestedKeyframes: false,
  },
  less: {
    v: n => `@${n}`,
    decl: (n, val) => `  @${n}: ${val};`,
    comment: t => `// ${t}`,
    framesTimesPx: w => `((@frames - 1) * -${w}px)`,
    nestedKeyframes: true,
  },
  scss: {
    v: n => `$${n}`,
    decl: (n, val) => `  $${n}: ${val};`,
    comment: t => `// ${t}`,
    framesTimesPx: w => `(($frames - 1) * -${w}px)`,
    nestedKeyframes: true,
  },
}

/** 网格模式的逐格 keyframes：第 k 帧 = 第 (k%cols, floor(k/cols)) 格 */
function gridKeyframeLines(p: ExportParams): string[] {
  const sequence = Array.from({ length: p.frames }, (_, index) => index)
  if (p.direction === 'alternate')
    sequence.push(...sequence.slice(1, -1).reverse())
  const position = (index: number) => {
    const c = index % p.cols
    const r = Math.floor(index / p.cols)
    const x = p.useContainer
      ? `${num(p.cols > 1 ? (c / (p.cols - 1)) * 100 : 0)}%`
      : `${-c * p.cellW}px`
    const y = p.useContainer
      ? `${num(p.rows > 1 ? (r / (p.rows - 1)) * 100 : 0)}%`
      : `${-r * p.cellH}px`
    return `${x} ${y}`
  }
  const lines = sequence.map((index, tick) => `  ${Number(((tick / sequence.length) * 100).toFixed(6))}% { background-position: ${position(index)}; }`)
  lines.push(`  100% { background-position: ${position(p.direction === 'alternate' ? 0 : sequence.at(-1)!)}; }`)
  return lines
}

/**
 * 落位方式：
 * - 长条 + 容器：background-size 为 N×100%，0% → 100% 恰好扫过 N 帧，用 steps(N, jump-none)；
 * - 长条 + px：原始尺寸平铺，0 → -(N-1)×W px，steps(N, jump-none)；
 * - 单帧使用 step-end；有限循环用 both 保留终帧，往返用完整返回序列计数。
 * - 网格：逐格 keyframes + step-end（段内保持、段末瞬移），行列百分比分母是 列-1 / 行-1。
 */
function buildExport(p: ExportParams, lang: LangSpec): string {
  const frames = p.useVars ? lang.v('frames') : String(p.frames)
  const duration = p.useVars ? lang.v('duration') : `${p.duration}s`
  const isGrid = p.layout === 'grid'
  const discrete = isGrid || p.direction === 'alternate'

  const varLines: string[] = []
  if (p.useVars) {
    varLines.push(lang.decl('frames', String(p.frames)), lang.decl('duration', `${p.duration}s`))
    if (isGrid)
      varLines.push(lang.decl('cols', String(p.cols)), lang.decl('rows', String(p.rows)))
    varLines.push('')
  }

  const sizeLines = p.useContainer
    ? [`  ${lang.comment('宽高交给容器：宽度撑满，按单帧宽高比推导高度')}`, '  width: 100%;', `  aspect-ratio: ${p.cellW} / ${p.cellH};`]
    : [`  width: ${p.cellW}px;`, `  height: ${p.cellH}px;`]

  let bgSizeLine: string | null = null
  if (p.useContainer) {
    const bgSize = isGrid
      ? (p.useVars
          ? `calc(${lang.v('cols')} * 100%) calc(${lang.v('rows')} * 100%)`
          : `${p.cols * 100}% ${p.rows * 100}%`)
      : (p.useVars ? `calc(${frames} * 100%) 100%` : `${p.frames * 100}% 100%`)
    bgSizeLine = `  background-size: ${bgSize};`
  }

  const timing = discrete || p.frames === 1 ? 'step-end' : `steps(${frames}, jump-none)`

  let keyframesComment: string | null = null
  let keyframeLines: string[]
  if (discrete) {
    keyframesComment = lang.comment('逐格定位：step-end 段内保持、段末瞬移；往返包含返回序列')
    keyframeLines = gridKeyframeLines(p)
  }
  else {
    if (p.useContainer)
      keyframesComment = lang.comment('配合 steps(N, jump-none)，0% → 100% 每步正好一帧')
    const to = p.useContainer
      ? (p.frames === 1 ? '0%' : '100%')
      : (p.useVars ? lang.framesTimesPx(p.cellW) : `${-p.cellW * (p.frames - 1)}px`)
    keyframeLines = [
      `  from { background-position: 0${p.useContainer ? '%' : ''} 0; }`,
      `  to { background-position: ${to} 0; }`,
    ]
  }

  // keyframes：SCSS / Less 嵌进 .frame-anim 内（编译时冒泡），CSS 平铺在顶层
  const keyframesBlock = [
    ...(keyframesComment ? [lang.nestedKeyframes ? `  ${keyframesComment}` : keyframesComment] : []),
    lang.nestedKeyframes ? '  @keyframes frame-anim-play {' : '@keyframes frame-anim-play {',
    ...keyframeLines.map(line => lang.nestedKeyframes ? `  ${line}` : line),
    lang.nestedKeyframes ? '  }' : '}',
  ]

  return [
    '.frame-anim {',
    ...varLines,
    ...sizeLines,
    `  background-image: url("${SPRITE_URL}");`,
    '  background-repeat: no-repeat;',
    ...(bgSizeLine ? [bgSizeLine] : []),
    ...(p.pixelated ? ['  image-rendering: pixelated;'] : []),
    `  animation: frame-anim-play ${duration} ${timing} ${p.iteration} ${p.direction === 'alternate' ? 'normal' : p.direction} both;`,
    // SCSS / Less：keyframes 嵌进选择器内（编译时冒泡到顶层），CSS：平铺在外
    ...(lang.nestedKeyframes ? ['', ...keyframesBlock] : []),
    '}',
    ...(lang.nestedKeyframes ? [] : ['', ...keyframesBlock]),
  ].join('\n')
}

const EXPORT_BUILDERS: Record<ExportFormat, (p: ExportParams) => string> = {
  css: p => buildExport(p, LANG.css),
  less: p => buildExport(p, LANG.less),
  scss: p => buildExport(p, LANG.scss),
}

/** 数字小输入框的统一样式 */
const NUM_INPUT_CLASS = 'w-14 shrink-0 rounded-md border border-border bg-background px-1.5 py-1 text-center font-mono text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50'

/** 单选按钮组：描边分段控件，选中项用主色填充 */
function OptionGroup<T extends string | number>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T
  options: { value: T, label: ReactNode, icon?: LucideIcon }[]
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  return (
    <div className={cn('flex overflow-hidden rounded-md border border-border', className)} role="radiogroup" aria-label={label}>
      {options.map((opt) => {
        const Icon = opt.icon
        return (
          <button
            key={String(opt.value)}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 px-1 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
              value === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-secondary',
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * 双头滑块的共享样式：轨道透明且不响应指针（自定义轨道视觉），
 * 只有滑块可拖；两个 input 重叠放置，各管一个端点。
 */
const RANGE_INPUT_CLASS = cn(
  'pointer-events-none absolute inset-x-0 top-1/2 h-4 -translate-y-1/2 appearance-none bg-transparent disabled:opacity-50',
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-border [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:cursor-grab',
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-border [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:cursor-grab',
)

/** 新粗野主义勾选框：2px 描边 + 硬阴影 + 抬起/压实，选中填充主色 */
function FrameCheckbox({
  checked,
  onChange,
  label,
  title,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: ReactNode
  title?: string
}) {
  return (
    <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-muted-foreground" title={title}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-sm border border-border transition-all',
          'transition-colors',
          'peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50',
          checked ? 'bg-primary text-primary-foreground' : 'bg-background',
        )}
      >
        {checked && <Check className="size-3.5" strokeWidth={3.5} />}
      </span>
      {label}
    </label>
  )
}

export default function FrameAnimation() {
  const [workspace, setWorkspace] = useState<'canvas' | 'frames' | 'settings'>('canvas')
  const [panel, setPanel] = useState<'playback' | 'sprite' | 'code' | 'records'>('playback')
  const [sequenceOpen, setSequenceOpen] = useState(true)
  const sequenceRef = useRef<HTMLDivElement>(null)
  const [frames, setFrames] = useState<FrameItem[]>([])
  const { records, loading: recordsLoading, save: saveRecordItem, get: getRecordItem, remove: removeRecordItem } = useFrameAnimationRecords()
  const [recordName, setRecordName] = useState('')
  const currentRecordIdRef = useRef<string | null>(null)
  const [autoSaveTick, setAutoSaveTick] = useState(0)
  const [recordFeedback, setRecordFeedback] = useState<{ text: string, error?: boolean } | null>(null)
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const pendingAutoSaveRef = useRef(false)
  const saveRecordRef = useRef<(automatic?: boolean) => Promise<void>>(async () => {})
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const deletingRef = useRef(false)
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  /** 播放范围 [起, 止]（下标，含端点）；null = 全程。渲染时按帧数收敛，无需 effect */
  const [rangeRaw, setRangeRaw] = useState<[number, number] | null>(null)

  // 动画参数
  const [fps, setFps] = useState(12)
  const [direction, setDirection] = useState<Direction>('forward')
  const [loopInfinite, setLoopInfinite] = useState(true)
  const [loopCount, setLoopCount] = useState(3)
  const stageView = useStageViewSettings()
  const [pixelated, setPixelated] = useState(false)
  const stageRef = useRef<HTMLDivElement>(null)
  const fitAreaRef = useRef<HTMLDivElement>(null)
  const stagePan = useStagePan(stageRef, () => false)
  /** 入选的帧（按 id）：勾选 = 参与预览 / 播放 / 导出；不提供删除，防误操作 */
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dirInputRef = useRef<HTMLInputElement>(null)
  /** 播放游标：rAF 循环里读写，current 仅用于渲染 */
  const playRef = useRef({ index: 0, dir: 1 as 1 | -1, cycles: 0 })
  /** 有限循环播完后置位，再次播放时从头开始 */
  const finishedRef = useRef(false)
  /** 上传序号计数器：只增不减，清空后也不重置（序号 = 第几次上传） */
  const seqRef = useRef(1)
  /** 拖拽排序：被拖行的下标走 ref，悬停插入点走 state（需要渲染指示线） */
  const dragIndexRef = useRef<number | null>(null)
  const [dropTarget, setDropTarget] = useState<{ index: number, after: boolean } | null>(null)
  /** 批处理裁剪状态与结果反馈 */
  const [cropping, setCropping] = useState(false)
  const [cropResult, setCropResult] = useState<{ text: string, tone: 'info' | 'success' | 'warning' | 'error' } | null>(null)
  /** 透明阈值：alpha 低于此值视为透明（弹窗内可调，实时重算并集） */
  const [alphaThreshold, setAlphaThreshold] = useState(DEFAULT_ALPHA_THRESHOLD)
  /** 弹窗打开期间缓存的帧像素：调阈值时无需重新解码图片 */
  const cropScanRef = useRef<ImageData[] | null>(null)
  /** 裁剪确认弹窗：叠放预览图 + 并集裁剪矩形 */
  const [cropPreview, setCropPreview] = useState<{
    url: string
    /** 当前阈值下的并集保留区域；null = 该阈值下全部透明 */
    union: OpaqueBox | null
    fullW: number
    fullH: number
    /** 帧宽 / 高不一致：弹窗内给出提示 */
    mixedSize: boolean
  } | null>(null)
  const cropDialogRef = useRef<HTMLDivElement>(null)
  const cropRestoreFocusRef = useRef<Element | null>(null)
  const cropPreviewRef = useRef(cropPreview)
  cropPreviewRef.current = cropPreview
  const cropDialogOpen = Boolean(cropPreview)
  /** 样式导出：复制反馈与精灵图生成中状态 */
  const [copiedCss, setCopiedCss] = useState(false)
  const [copyError, setCopyError] = useState(false)
  const [spriting, setSpriting] = useState(false)
  const spriteBusyRef = useRef(false)
  const [exportError, setExportError] = useState(false)
  const [spriteError, setSpriteError] = useState<string | null>(null)
  const [spriteRetry, setSpriteRetry] = useState(0)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('scss')
  /** 精灵图排列：记录最后编辑的是列还是行，另一维由帧数自动推导 */
  const [spriteDimension, setSpriteDimension] = useState<{ axis: SpriteDimensionAxis, value: number }>({ axis: 'rows', value: 1 })
  /** 导出开关：变量（参数提取为变量）/ 容器（宽高交给容器、百分比定位） */
  const [exportVars, setExportVars] = useState(true)
  const [exportContainer, setExportContainer] = useState(true)
  /** 压缩包解析失败等导入错误提示 */
  const [importFeedback, setImportFeedback] = useState<{ text: string, tone: 'warning' | 'error' } | null>(null)
  const [importing, setImporting] = useState(false)
  // Clear, replacement and unmount invalidate unfinished work before it can commit.
  // 清空、替换和卸载先使未完成的任务失效，防止旧结果回写。
  const materialEpochRef = useRef(0)
  const importCountRef = useRef(0)
  const replacementRequestRef = useRef(0)
  const materialRevisionRef = useRef(0)
  const cropBusyRef = useRef(false)

  // Reserve the visible sequence height when fitting the canvas.
  // 画布适配时为当前帧序列实际高度留出空间。
  useEffect(() => {
    const sequence = sequenceRef.current
    if (!sequence)
      return
    let resizeFrame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(() => {
        sequence.parentElement?.style.setProperty('--frames-sequence-height', `${sequence.getBoundingClientRect().height}px`)
      })
    })
    observer.observe(sequence)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(resizeFrame)
    }
  }, [])

  const frameCount = frames.length
  /** 入选帧：勾选 = 参与预览 / 播放 / 导出；顺序跟随列表（可拖拽重排） */
  const activeFrames = frames.filter(f => selected.has(f.id))
  const activeCount = activeFrames.length
  /** 渲染用游标：勾选变化后 current 可能短暂越界，这里收敛 */
  const safeIndex = activeCount === 0 ? 0 : Math.min(current, activeCount - 1)
  const frame = activeFrames[safeIndex] ?? null
  /** 舞台视图缩放：加载帧后自动完整适配（留边），手动缩放后跟随用户 */
  const stageFit = useStageFitScale(fitAreaRef, frame?.width ?? 0, frame?.height ?? 0, Boolean(frame), 24)
  const [zoom, setZoom, resetStageZoom] = useAutoFitZoom(stageFit, frameCount > 0 ? 'content' : null)
  const stageZoom = useStageZoom(stageRef, zoom, setZoom, frameCount > 0)

  const resetFrameStageView = () => {
    const area = fitAreaRef.current
    if (!area || !frame)
      return
    const overlays = area.closest('.frame-workspace')?.querySelectorAll<HTMLElement>('.frames-panel, .frames-playback-float, .frames-sequence-float') ?? []
    const target = measureUnobstructedStageFit(area, overlays, frame.width, frame.height, 24)
    stagePan.setOffset(target.offset)
    if (target.offset.x === 0 && target.offset.y === 0)
      resetStageZoom()
    else
      resetStageZoom(target.scale)
  }
  /** 播放范围（收敛后）：在入选帧里截取；帧数变化时自动夹回有效区间 */
  const maxIdx = Math.max(0, activeCount - 1)
  const rangeStart = rangeRaw ? Math.min(rangeRaw[0], maxIdx) : 0
  const rangeEnd = rangeRaw ? Math.min(rangeRaw[1], maxIdx) : maxIdx
  const rangeLen = activeCount === 0 ? 0 : rangeEnd - rangeStart + 1
  /** 参与导出的帧：入选帧按播放范围截断 */
  const exportFrames = activeFrames.slice(rangeStart, rangeEnd + 1)
  const spriteDims = resolveSpriteDims(exportFrames.length, spriteDimension.axis, spriteDimension.value)
  const spriteCols = spriteDims.cols
  const spriteRows = spriteDims.rows
  /** 单行使用精简的长条样式；多行使用逐格网格样式 */
  const spriteLayout: SpriteLayout = spriteRows === 1 ? 'strip' : 'grid'

  /* ---------- 帧管理 ---------- */

  const addFiles = useCallback(async (list: FileList | File[], persist = true) => {
    const epoch = materialEpochRef.current
    replacementRequestRef.current += 1
    const inputs = [...list].filter(f => f.type.startsWith('image/') || imageMimeOf(f.name) || /\.zip$/i.test(f.name))
    if (inputs.length === 0) {
      setImportFeedback({ text: '没有找到可用的图片', tone: 'warning' })
      return
    }
    importCountRef.current += 1
    setImporting(true)
    setImportFeedback(null)
    try {
      // 图片直接收，压缩包先解出图片条目
      const incoming: IncomingImage[] = []
      const failed: string[] = []
      for (const f of inputs) {
        try {
          if (f.type.startsWith('image/') || imageMimeOf(f.name))
            incoming.push({ name: f.name, blob: f.type ? f : new Blob([f], { type: imageMimeOf(f.name)! }) })
          else
            incoming.push(...await extractZip(f))
        }
        catch {
          failed.push(f.name)
        }
      }
      if (epoch !== materialEpochRef.current)
        return
      if (incoming.length === 0) {
        setImportFeedback(failed.length ? { text: `压缩包解析失败：${failed.join('、')}`, tone: 'error' } : { text: '没有找到可用的图片', tone: 'warning' })
        return
      }
      const loaded = (await Promise.all(incoming.map(i => loadFrame(i.name, i.blob))))
        .filter((f): f is Omit<FrameItem, 'seq'> => f !== null)
      if (epoch !== materialEpochRef.current) {
        loaded.forEach(f => URL.revokeObjectURL(f.url))
        return
      }
      if (loaded.length < incoming.length || failed.length) {
        const messages = []
        if (loaded.length < incoming.length)
          messages.push(`已跳过 ${incoming.length - loaded.length} 张无法解码的图片`)
        if (failed.length)
          messages.push(`压缩包解析失败：${failed.join('、')}`)
        setImportFeedback({ text: messages.join('；'), tone: loaded.length ? 'warning' : 'error' })
      }
      if (loaded.length === 0)
        return
      materialRevisionRef.current += 1
      cropBusyRef.current = false
      setCropping(false)
      setCropResult(null)
      cropScanRef.current = null
      setCropPreview((previous) => {
        if (previous)
          URL.revokeObjectURL(previous.url)
        return null
      })
      // 新追加的一批内部按文件名自然排序，不打乱已有帧的手动顺序
      loaded.sort((a, b) => collator.compare(a.name, b.name))
      // 分配上传序号：重排不改变它，便于对照原始文件顺序；新帧默认入选
      const withSeq = loaded.map(f => ({ ...f, seq: seqRef.current++ }))
      setFrames(prev => [...prev, ...withSeq])
      setSelected((prev) => {
        const next = new Set(prev)
        withSeq.forEach(f => next.add(f.id))
        return next
      })
      if (persist)
        setAutoSaveTick(value => value + 1)
    }
    catch {
      if (epoch === materialEpochRef.current)
        setImportFeedback({ text: '导入失败，请重试', tone: 'error' })
    }
    finally {
      if (epoch === materialEpochRef.current) {
        importCountRef.current -= 1
        setImporting(importCountRef.current > 0)
      }
    }
  }, [])

  const onFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files)
      void addFiles(e.target.files)
    // 允许再次选择同一批文件
    e.target.value = ''
  }, [addFiles])

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    void addFiles(e.dataTransfer.files)
  }, [addFiles])

  /** 载入内置示例帧（canvas 只有客户端可用，用户点「试试示例」时现场生成） */
  const loadDemo = useCallback(async () => {
    setAutoSaveTick(0)
    const epoch = materialEpochRef.current
    const files = await createDemoFrames()
    if (files && epoch === materialEpochRef.current)
      await addFiles(files, false)
  }, [addFiles])

  /** 跳到指定帧：同步 rAF 游标并打断往返方向 / 循环计数 */
  const jumpTo = useCallback((index: number) => {
    playRef.current = { index, dir: 1, cycles: 0 }
    finishedRef.current = false
    setCurrent(index)
  }, [])

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id))
        next.delete(id)
      else
        next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    setSelected(prev => (prev.size >= frames.length ? new Set() : new Set(frames.map(f => f.id))))
  }, [frames])

  /** 拖拽排序：把 from 行移动到 to 行之前 / 之后 */
  const moveFrameTo = useCallback((from: number, to: number, after: boolean) => {
    setFrames((prev) => {
      if (from === to)
        return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      // 目标下标在移除后需要校正；after 表示插到目标行之后
      let insertAt = to + (after ? 1 : 0)
      if (from < insertAt)
        insertAt -= 1
      next.splice(insertAt, 0, moved)
      return next
    })
  }, [])

  /** 批处理：扫描所有帧的非透明包围盒，取并集 = 裁掉所有帧都透明的公共边缘 */
  const prepareCrop = useCallback(async () => {
    if (frames.length === 0 || cropBusyRef.current)
      return
    cropRestoreFocusRef.current = document.activeElement
    const revision = materialRevisionRef.current
    cropBusyRef.current = true
    setCropping(true)
    setCropResult(null)
    try {
      // 解码并缓存像素：弹窗内调阈值时直接重扫，不用重新解码
      const scan: ImageData[] = []
      for (const f of frames) {
        const img = await loadImage(f.url)
        const data = readImageData(img)
        if (!data)
          throw new Error('unreadable')
        scan.push(data)
      }
      const union = computeUnionBox(scan, alphaThreshold)
      if (revision !== materialRevisionRef.current)
        return
      if (!union) {
        setCropResult({ text: '所有帧都是全透明图片，没有可保留的内容', tone: 'warning' })
        return
      }
      // 并集已覆盖整张图 = 没有公共透明边可裁
      const coversAll = frames.every(
        f => union.left <= 0 && union.top <= 0 && union.right >= f.width && union.bottom >= f.height,
      )
      if (coversAll) {
        setCropResult({ text: '没有找到所有帧都透明的边缘，无需裁剪', tone: 'info' })
        return
      }
      // 生成叠放预览并弹出确认框
      const blob = await buildStackPreview(frames)
      if (revision !== materialRevisionRef.current)
        return
      if (!blob) {
        setCropResult({ text: '生成预览失败', tone: 'error' })
        return
      }
      const url = URL.createObjectURL(blob)
      cropScanRef.current = scan
      const { width: w0, height: h0 } = frames[0]
      setCropPreview((prev) => {
        if (prev)
          URL.revokeObjectURL(prev.url)
        return {
          url,
          union,
          fullW: Math.max(...frames.map(f => f.width)),
          fullH: Math.max(...frames.map(f => f.height)),
          mixedSize: frames.some(f => f.width !== w0 || f.height !== h0),
        }
      })
    }
    catch {
      if (revision === materialRevisionRef.current)
        setCropResult({ text: '裁剪失败：有图片无法解码', tone: 'error' })
    }
    finally {
      if (revision === materialRevisionRef.current) {
        cropBusyRef.current = false
        setCropping(false)
      }
    }
  }, [frames, alphaThreshold])

  /** 弹窗内调整阈值：用缓存像素实时重算并集（null = 该阈值下全部透明） */
  useEffect(() => {
    const scan = cropScanRef.current
    if (!scan)
      return
    setCropPreview((prev) => {
      if (!prev)
        return prev
      return { ...prev, union: computeUnionBox(scan, alphaThreshold) }
    })
  }, [alphaThreshold])

  const closeCropPreview = useCallback(() => {
    materialRevisionRef.current += 1
    cropBusyRef.current = false
    setCropping(false)
    cropScanRef.current = null
    setCropPreview((prev) => {
      if (prev)
        URL.revokeObjectURL(prev.url)
      return null
    })
  }, [])

  useEffect(() => {
    if (!cropDialogOpen)
      return
    const previousFocus = cropRestoreFocusRef.current
    cropDialogRef.current?.focus()
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus()
    }
  }, [cropDialogOpen])

  /** 清除全部帧：回收所有 objectURL，回到空状态（精灵图预览随 spriteKey 变空自动清理） */
  const clearAll = useCallback(() => {
    materialEpochRef.current += 1
    currentRecordIdRef.current = null
    setAutoSaveTick(0)
    importCountRef.current = 0
    setImporting(false)
    setPlaying(false)
    setCurrent(0)
    playRef.current = { index: 0, dir: 1, cycles: 0 }
    finishedRef.current = false
    setFrames((prev) => {
      prev.forEach(f => URL.revokeObjectURL(f.url))
      return []
    })
    setSelected(new Set())
    setRangeRaw(null)
    closeCropPreview()
    setCropResult(null)
    setImportFeedback(null)
    setRecordFeedback(null)
    setExportError(false)
    setCopyError(false)
    setDragOver(false)
    dragIndexRef.current = null
    setDropTarget(null)
  }, [closeCropPreview])

  const saveRecord = useCallback(async (automatic = false) => {
    if (frames.length === 0)
      return
    if (savingRef.current) {
      if (automatic)
        pendingAutoSaveRef.current = true
      return
    }
    savingRef.current = true
    setSaving(true)
    setRecordFeedback(null)
    const epoch = materialEpochRef.current
    try {
      const archive = await createFrameArchive(frames.map(frame => ({
        id: frame.id,
        seq: frame.seq,
        name: frame.name,
        blob: frame.blob,
        selected: selected.has(frame.id),
      })))
      const meta: FrameAnimationRecordMeta = {
        name: recordName.trim() || frames[0].name.replace(/\.[^.]+$/, '') || '帧动画项目',
        frames: archive.frames,
        fps,
        direction,
        loopInfinite,
        loopCount,
        range: rangeRaw,
        pixelated,
        alphaThreshold,
        exportFormat,
        spriteDimension,
        exportVars,
        exportContainer,
      }
      if (epoch !== materialEpochRef.current)
        return
      const result = await saveContentRecord('frame-animation', archive.blob, meta, currentRecordIdRef.current, automatic, createFrameAnimationItem, saveRecordItem)
      if (epoch === materialEpochRef.current) {
        currentRecordIdRef.current = result.id
        setRecordName('')
        setRecordFeedback({ text: result.saved ? '项目已保存' : '相同素材已有项目' })
      }
    }
    catch {
      if (epoch === materialEpochRef.current)
        setRecordFeedback({ text: '保存失败，素材和项目名称已保留，请重试', error: true })
    }
    finally {
      savingRef.current = false
      setSaving(false)
      if (pendingAutoSaveRef.current) {
        pendingAutoSaveRef.current = false
        queueMicrotask(() => void saveRecordRef.current(true))
      }
    }
  }, [alphaThreshold, direction, exportContainer, exportFormat, exportVars, fps, frames, loopCount, loopInfinite, pixelated, rangeRaw, recordName, saveRecordItem, selected, spriteDimension])

  saveRecordRef.current = saveRecord
  useEffect(() => {
    if (autoSaveTick === 0)
      return
    const timer = window.setTimeout(() => void saveRecordRef.current(true), 300)
    return () => window.clearTimeout(timer)
  }, [autoSaveTick])

  const deleteRecord = useCallback(async (id: string) => {
    if (deletingRef.current)
      return
    deletingRef.current = true
    setDeletingId(id)
    setRecordFeedback(null)
    try {
      await removeRecordItem(id)
      if (currentRecordIdRef.current === id)
        currentRecordIdRef.current = null
      setRecordFeedback({ text: '项目已删除' })
    }
    catch {
      setRecordFeedback({ text: '删除失败，请重试', error: true })
    }
    finally {
      deletingRef.current = false
      setDeletingId(null)
    }
  }, [removeRecordItem])

  const loadRecord = useCallback(async (id: string) => {
    setAutoSaveTick(0)
    const epoch = ++materialEpochRef.current
    const request = ++replacementRequestRef.current
    importCountRef.current = 0
    setImporting(true)
    setRecordFeedback(null)
    closeCropPreview()
    try {
      const item = await getRecordItem(id)
      if (!item || !(item.payload instanceof Blob))
        throw new Error('Missing project archive')
      const meta = item.meta as unknown as Partial<FrameAnimationRecordMeta>
      if (!Array.isArray(meta.frames) || meta.frames.length === 0 || meta.frames.some(saved => !saved || typeof saved.path !== 'string' || typeof saved.name !== 'string'))
        throw new Error('Invalid frame manifest')
      const archive = await extractFrameArchive(item.payload)
      const ids = new Set<string>()
      const manifest = meta.frames.map((saved, index) => {
        const id = typeof saved.id === 'string' && saved.id && !ids.has(saved.id) ? saved.id : crypto.randomUUID()
        ids.add(id)
        return { ...saved, id, seq: Number.isFinite(saved.seq) && saved.seq > 0 ? Math.floor(saved.seq) : index + 1, selected: typeof saved.selected === 'boolean' ? saved.selected : true }
      })
      const loaded = (await Promise.all(manifest.map(async (saved) => {
        const blob = archive.get(saved.path)
        if (!blob)
          return null
        // Cropping produces PNG pixels while retaining the original source name.
        // 裁剪生成 PNG 像素，但保留原素材名称。
        const signature = new Uint8Array(await blob.slice(0, 8).arrayBuffer())
        const isPng = [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => signature[index] === byte)
        const decodedBlob = isPng && blob.type !== 'image/png' ? new Blob([blob], { type: 'image/png' }) : blob
        const frame = await loadFrame(saved.name, decodedBlob)
        return frame ? { ...frame, id: saved.id, seq: saved.seq, selected: saved.selected } : null
      }))).filter((frame): frame is Omit<FrameItem, 'seq'> & { seq: number, selected: boolean } => frame !== null)
      if (epoch !== materialEpochRef.current || request !== replacementRequestRef.current) {
        loaded.forEach(frame => URL.revokeObjectURL(frame.url))
        return
      }
      if (loaded.length !== manifest.length) {
        loaded.forEach(frame => URL.revokeObjectURL(frame.url))
        throw new Error('Incomplete or invalid frame archive')
      }
      setPlaying(false)
      setCurrent(0)
      playRef.current = { index: 0, dir: 1, cycles: 0 }
      finishedRef.current = false
      setFrames((previous) => {
        previous.forEach(frame => URL.revokeObjectURL(frame.url))
        return loaded.map(({ selected: _selected, ...frame }) => frame)
      })
      setSelected(new Set(loaded.filter(frame => frame.selected).map(frame => frame.id)))
      const bounded = (value: unknown, fallback: number, min: number, max: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
      const count = loaded.filter(frame => frame.selected).length
      const last = Math.max(0, count - 1)
      const validRange = Array.isArray(meta.range) && meta.range.length === 2 && meta.range.every(value => typeof value === 'number' && Number.isFinite(value))
      const start = validRange ? Math.floor(bounded(meta.range![0], 0, 0, last)) : 0
      const end = validRange ? Math.floor(bounded(meta.range![1], last, start, last)) : last
      setRangeRaw(validRange ? [start, end] : null)
      setFps(bounded(meta.fps, 12, 1, 120))
      setDirection(meta.direction === 'reverse' || meta.direction === 'pingpong' ? meta.direction : 'forward')
      setLoopInfinite(typeof meta.loopInfinite === 'boolean' ? meta.loopInfinite : true)
      setLoopCount(Math.floor(bounded(meta.loopCount, 3, 1, 999)))
      setPixelated(typeof meta.pixelated === 'boolean' ? meta.pixelated : false)
      setAlphaThreshold(Math.floor(bounded(meta.alphaThreshold, DEFAULT_ALPHA_THRESHOLD, 0, 254)))
      setExportFormat(meta.exportFormat === 'css' || meta.exportFormat === 'less' ? meta.exportFormat : 'scss')
      setSpriteDimension({
        axis: meta.spriteDimension?.axis === 'cols' ? 'cols' : 'rows',
        value: Math.floor(bounded(meta.spriteDimension?.value, 1, 1, loaded.length)),
      })
      setExportVars(typeof meta.exportVars === 'boolean' ? meta.exportVars : true)
      setExportContainer(typeof meta.exportContainer === 'boolean' ? meta.exportContainer : true)
      seqRef.current = Math.max(...loaded.map(frame => frame.seq)) + 1
      setRecordName(typeof meta.name === 'string' ? meta.name : '')
      currentRecordIdRef.current = id
      setImportFeedback(null)
      setRecordFeedback({ text: '项目已加载' })
      setCropResult(null)
      closeCropPreview()
    }
    catch {
      if (epoch === materialEpochRef.current && request === replacementRequestRef.current) {
        setImportFeedback({ text: '加载项目失败，当前素材已保留，请重试', tone: 'error' })
        setRecordFeedback({ text: '加载项目失败，当前素材已保留，请重试', error: true })
      }
    }
    finally {
      if (epoch === materialEpochRef.current && request === replacementRequestRef.current)
        setImporting(false)
    }
  }, [closeCropPreview, getRecordItem])

  /** 确认裁剪：按预览的并集矩形裁掉所有帧 */
  const applyCrop = useCallback(async () => {
    if (!cropPreview || !cropPreview.union || cropBusyRef.current)
      return
    const revision = materialRevisionRef.current
    cropBusyRef.current = true
    setCropping(true)
    const { union } = cropPreview
    try {
      // 单帧失败不拖垮整批：失败的帧保持原样
      const cropped = await Promise.all(frames.map(f => cropFrameImage(f, union).catch(() => null)))
      if (revision !== materialRevisionRef.current) {
        cropped.forEach(frame => frame && URL.revokeObjectURL(frame.url))
        return
      }
      // 按 id 匹配回写：裁剪是异步的，期间用户可能重排或调整勾选
      const croppedById = new Map(frames.map((f, i) => [f.id, cropped[i]]))
      setFrames((prev) => {
        const alive = new Set(prev.map(f => f.id))
        // 裁剪期间被移除的帧：回收为其生成的新 objectURL
        for (const [id, c] of croppedById) {
          if (c && !alive.has(id))
            URL.revokeObjectURL(c.url)
        }
        return prev.map((f) => {
          const c = croppedById.get(f.id)
          if (!c)
            return f
          URL.revokeObjectURL(f.url)
          return { ...f, ...c }
        })
      })
      const failedCount = cropped.filter(frame => !frame).length
      setCropResult(failedCount === frames.length
        ? { text: '裁剪失败：未能生成图片，原素材已保留', tone: 'error' }
        : failedCount > 0
          ? { text: `已裁剪 ${frames.length - failedCount} 帧，${failedCount} 帧无法裁剪，已保留原素材`, tone: 'warning' }
          : {
              text: `已裁掉公共透明边：${cropPreview.fullW} × ${cropPreview.fullH} → ${union.right - union.left} × ${union.bottom - union.top}`,
              tone: 'success',
            })
      closeCropPreview()
    }
    catch {
      if (revision === materialRevisionRef.current)
        setCropResult({ text: '裁剪失败：有图片无法解码', tone: 'error' })
    }
    finally {
      if (revision === materialRevisionRef.current) {
        cropBusyRef.current = false
        setCropping(false)
      }
    }
  }, [cropPreview, frames, closeCropPreview])

  const sortByName = useCallback(() => {
    setFrames(prev => [...prev].sort((a, b) => collator.compare(a.name, b.name)))
  }, [])

  // 卸载时回收所有 objectURL
  const framesRef = useRef<FrameItem[]>([])
  framesRef.current = frames
  useEffect(() => () => {
    materialEpochRef.current += 1
    materialRevisionRef.current += 1
    framesRef.current.forEach(f => URL.revokeObjectURL(f.url))
    if (cropPreviewRef.current)
      URL.revokeObjectURL(cropPreviewRef.current.url)
  }, [])

  /* ---------- 播放引擎：rAF + 时间累积，帧率可调 ---------- */

  useEffect(() => {
    if (!playing || activeCount === 0)
      return
    let raf = 0
    let last = performance.now()
    let acc = 0
    const stepMs = 1000 / fps

    /** 推进一帧（限在播放范围内），返回是否因循环次数用尽而结束 */
    const advance = (): boolean => {
      const lo = rangeStart
      const hi = rangeEnd
      const ps = playRef.current
      if (hi <= lo) {
        ps.index = lo
        ps.cycles += 1
        setCurrent(lo)
        return !loopInfinite && ps.cycles >= loopCount
      }
      let { index, dir, cycles } = ps
      if (index < lo || index > hi) {
        // 范围外（刚调过范围或点过范围外的帧）：先归位，不计循环
        index = direction === 'reverse' ? hi : lo
        dir = 1
      }
      else if (direction === 'forward') {
        index += 1
        if (index > hi) {
          index = lo
          cycles += 1
        }
      }
      else if (direction === 'reverse') {
        index -= 1
        if (index < lo) {
          index = hi
          cycles += 1
        }
      }
      else {
        // Count a full ping-pong cycle on return, without an extra held tick.
        // 往返：回到 lo 就完成一轮，避免有限循环多等待一帧。
        index += dir
        if (index >= hi) {
          index = hi
          dir = -1
        }
        else if (index <= lo) {
          index = lo
          dir = 1
          cycles += 1
        }
      }
      const finished = !loopInfinite && cycles >= loopCount
      if (finished)
        index = direction === 'forward' ? hi : lo
      playRef.current = { index, dir, cycles }
      setCurrent(index)
      return finished
    }

    const tick = (now: number) => {
      acc += now - last
      last = now
      while (acc >= stepMs) {
        acc -= stepMs
        if (advance()) {
          finishedRef.current = true
          setPlaying(false)
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, fps, direction, loopInfinite, loopCount, activeCount, rangeStart, rangeEnd])

  const togglePlay = useCallback(() => {
    setPlaying((prev) => {
      const next = !prev
      // 有限循环播完后再次播放：从范围起点开始
      if (next && (finishedRef.current || playRef.current.index < rangeStart || playRef.current.index > rangeEnd)) {
        playRef.current = { index: direction === 'reverse' ? rangeEnd : rangeStart, dir: 1, cycles: 0 }
        setCurrent(playRef.current.index)
        finishedRef.current = false
      }
      return next
    })
  }, [direction, rangeStart, rangeEnd])

  const stepFrame = useCallback((delta: -1 | 1) => {
    if (activeCount === 0)
      return
    setPlaying(false)
    // 在播放范围内步进；当前帧在范围外时先夹回范围
    const cur = Math.min(Math.max(safeIndex, rangeStart), rangeEnd)
    const len = rangeEnd - rangeStart + 1
    jumpTo(rangeStart + (((cur - rangeStart + delta) % len) + len) % len)
  }, [safeIndex, activeCount, rangeStart, rangeEnd, jumpTo])

  // 键盘：弹窗打开时只响应 Esc；否则空格播放/暂停，← → 逐帧
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (cropPreview) {
        if (e.key === 'Escape')
          closeCropPreview()
        return
      }
      const target = e.target as HTMLElement
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable)
        return
      if (e.key === ' ') {
        e.preventDefault()
        togglePlay()
      }
      else if (e.key === 'ArrowLeft') {
        stepFrame(-1)
      }
      else if (e.key === 'ArrowRight') {
        stepFrame(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePlay, stepFrame, cropPreview, closeCropPreview])

  /* ---------- 样式导出 ---------- */

  const copyCss = useCallback((text: string) => {
    setCopiedCss(false)
    setCopyError(false)
    void Promise.resolve().then(() => navigator.clipboard.writeText(text)).then(() => {
      setCopiedCss(true)
      setTimeout(setCopiedCss, 1200, false)
    }).catch(() => setCopyError(true))
  }, [])

  const downloadSprite = useCallback(async () => {
    if (exportFrames.length === 0 || spriteBusyRef.current)
      return
    const epoch = materialEpochRef.current
    spriteBusyRef.current = true
    setSpriting(true)
    setExportError(false)
    try {
      const blob = await buildSpriteSheet(exportFrames, { cols: spriteCols, rows: spriteRows })
      if (epoch !== materialEpochRef.current)
        return
      if (!blob)
        throw new Error('Sprite encoding failed')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'frame-anim-sprite.png'
      a.click()
      // 延迟回收，确保下载已拿到引用
      setTimeout(URL.revokeObjectURL, 10_000, url)
    }
    catch {
      if (epoch === materialEpochRef.current)
        setExportError(true)
    }
    finally {
      spriteBusyRef.current = false
      setSpriting(false)
    }
  }, [exportFrames, spriteCols, spriteRows])

  /* ---------- 精灵图预览：入选 + 范围变化后防抖重建 ---------- */

  /** 预览内容指纹：id + 尺寸（裁剪后同 id 但尺寸变，需重建） */
  const spriteKey = exportFrames.length > 0
    ? `${spriteCols}x${spriteRows}|${exportFrames.map(f => `${f.id}:${f.width}x${f.height}`).join('|')}`
    : ''
  /** 最新 exportFrames 走 ref，effect 只依赖 key，避免每 render 重建 */
  const exportFramesRef = useRef(exportFrames)
  exportFramesRef.current = exportFrames
  const [sprite, setSprite] = useState<{ key: string, url: string } | null>(null)
  const spriteRef = useRef<{ key: string, url: string } | null>(null)
  spriteRef.current = sprite

  /** 丢弃当前精灵图预览并回收 objectURL */
  const disposeSprite = useCallback(() => {
    spriteRef.current = null
    setSprite((prev) => {
      if (prev)
        URL.revokeObjectURL(prev.url)
      return null
    })
  }, [])

  useEffect(() => {
    if (!spriteKey) {
      // 无入选帧（含清除全部）：丢弃旧预览并回收 objectURL
      disposeSprite()
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      setSpriteError(null)
      void buildSpriteSheet(exportFramesRef.current, { cols: spriteCols, rows: spriteRows }).then((blob) => {
        if (cancelled)
          return
        if (!blob)
          throw new Error('Sprite preview encoding failed')
        const url = URL.createObjectURL(blob)
        setSprite((prev) => {
          if (prev)
            URL.revokeObjectURL(prev.url)
          return { key: spriteKey, url }
        })
      }).catch(() => {
        if (!cancelled)
          setSpriteError(spriteKey)
      })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [spriteKey, spriteCols, spriteRows, spriteRetry, disposeSprite])

  // 卸载回收精灵图预览的 objectURL
  useEffect(() => () => {
    if (spriteRef.current)
      URL.revokeObjectURL(spriteRef.current.url)
  }, [])

  /* ---------- 渲染 ---------- */

  const duration = rangeLen > 0 ? (rangeLen / fps).toFixed(2) : '0'
  const frameMs = (1000 / fps).toFixed(0)

  // 导出代码：单元格 = 播放范围内各帧最大宽 / 高（与精灵图一致）；尺寸走容器 + 百分比
  const cellW = exportFrames.length > 0 ? Math.max(...exportFrames.map(f => f.width)) : 0
  const cellH = exportFrames.length > 0 ? Math.max(...exportFrames.map(f => f.height)) : 0
  /** 单帧宽高：仅当入选帧尺寸全部一致时展示，否则省略（单元格取最大值，单帧尺寸不唯一） */
  const uniformFrameSize = exportFrames.length > 0
    && exportFrames.every(f => f.width === exportFrames[0].width && f.height === exportFrames[0].height)
    ? { w: exportFrames[0].width, h: exportFrames[0].height }
    : null
  const exportParams: ExportParams = {
    frames: exportFrames.length,
    // Ping-pong includes both legs and counts a complete return as one loop.
    // 往返包含前进和返回，回到起点才计一次循环。
    duration: String(Number(((direction === 'pingpong' ? Math.max(1, (rangeLen - 1) * 2) : rangeLen) / fps).toFixed(6))),
    iteration: loopInfinite ? 'infinite' : String(loopCount),
    direction: direction === 'forward' ? 'normal' : direction === 'reverse' ? 'reverse' : 'alternate',
    pixelated,
    cellW,
    cellH,
    useVars: exportVars,
    useContainer: exportContainer,
    layout: spriteLayout,
    cols: spriteDims.cols,
    rows: spriteDims.rows,
  }
  const exportText = exportFrames.length > 0
    ? EXPORT_BUILDERS[exportFormat](exportParams)
    : ''
  return (
    <div className={`frame-workspace workspace-${workspace} ${sequenceOpen ? '' : 'sequence-collapsed'}`}>
      <Seo title="帧动画预览" description="导入多张图片逐帧预览动画效果，可调帧率、播放方向、循环次数、缩放与背景。" path="/tools/frame-animation" />
      <div className="frames-canvas" aria-label="帧动画画布">
        <div ref={fitAreaRef} className="frames-fit-area" aria-hidden="true" />
        <div className="frames-stage-viewport">
          <div
            ref={stageRef}
            {...stagePan.panHandlers}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              'absolute inset-0 flex touch-none overflow-hidden border p-3 transition-colors select-none',
              frame && (stagePan.panning ? 'cursor-grabbing' : 'cursor-grab'),
              frameCount === 0 && 'border-dashed',
              dragOver ? 'border-primary' : 'border-border',
            )}
            style={{ background: stageView.background }}
          >
            {frame
              ? (
                  <img
                    src={frame.url}
                    alt={frame.name}
                    draggable={false}
                    className={cn(
                      'm-auto shrink-0',
                      // 帧边界：勾出单张精灵图格子的范围
                      stageView.showBounds && STAGE_BOUNDARY_CLASS,
                    )}
                    style={{
                      width: frame.width * zoom,
                      transform: `translate(${stagePan.offset.x}px, ${stagePan.offset.y}px)`,
                      imageRendering: pixelated ? 'pixelated' : 'auto',
                    }}
                  />
                )
              : (
                  frameCount > 0
                  // 有上传但全部未勾选
                    ? (
                        <div className="canvas-empty-state m-auto flex flex-col items-center gap-2 text-center text-muted-foreground/60">
                          <Images className="size-8" />
                          <p className="text-sm">没有入选的帧：在下方帧序列里勾选后参与预览</p>
                        </div>
                      )
                    : (
                        <div className="canvas-empty-state m-auto flex flex-col items-center gap-3 text-center">
                          <Images className="size-8 text-muted-foreground" />
                          <div>
                            <p className="font-medium">拖拽图片 / ZIP 到此处，或</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              可多选，按文件名自然排序
                            </p>
                          </div>
                          <div className="flex flex-wrap justify-center gap-2">
                            <Button type="button" onClick={() => fileInputRef.current?.click()}>
                              <ImagePlus />
                              添加图片
                            </Button>
                            <Button type="button" variant="outline" onClick={() => dirInputRef.current?.click()}>
                              <FolderOpen />
                              添加文件夹
                            </Button>
                            <Button type="button" variant="outline" onClick={() => void loadDemo()}>
                              <Sparkles />
                              试试示例
                            </Button>
                          </div>
                        </div>
                      )
                )}
          </div>
          <StageZoomIndicator zoom={zoom} visible={stageZoom.zoomIndicatorVisible} />
        </div>
        <div className="frames-toolbar" aria-label="素材与画布工具">
          <div className="frames-import-actions">
            <Button type="button" variant="outline" title="添加图片或 ZIP" aria-label="添加图片或 ZIP" onClick={() => fileInputRef.current?.click()}>
              <ImagePlus />
              <span>图片 / ZIP</span>
            </Button>
            <Button type="button" variant="outline" title="添加文件夹" aria-label="添加文件夹" onClick={() => dirInputRef.current?.click()}>
              <FolderOpen />
              <span>目录</span>
            </Button>
            <Button type="button" variant="outline" title="载入示例" aria-label="载入示例" onClick={() => void loadDemo()}>
              <Sparkles />
              <span>示例</span>
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" title="清除全部帧" aria-label="清除全部帧" disabled={frameCount === 0 && !importing && !importFeedback} onClick={clearAll}>
              <Trash2 />
            </Button>
          </div>
          <span className="frames-material-info" role="status">
            {importing ? '正在导入…' : frameCount > 0 ? `${frameCount} 帧 · 入选 ${activeCount}` : '尚未导入素材'}
          </span>
          <div className="frames-view-controls">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              title="重置视图（居中并完整适配）"
              aria-label="重置视图"
              disabled={!frame}
              onClick={resetFrameStageView}
            >
              <RotateCcw />
            </Button>
            <StageViewControls hasContent={Boolean(frame)} settings={stageView} />
          </div>
        </div>

      </div>
      <input ref={fileInputRef} type="file" accept="image/*,.zip" multiple hidden onChange={onFileChange} aria-label="导入图片或 ZIP" />
      <input ref={dirInputRef} type="file" multiple hidden onChange={onFileChange} {...{ webkitdirectory: '' } as Record<string, string>} aria-label="导入图片目录" />
      {importFeedback && <div className="frames-import-error" role="alert" data-tone={importFeedback.tone}>{importFeedback.text}</div>}
      <nav className="frames-workspace-nav" aria-label="帧动画工作区">
        {([['canvas', '画布'], ['frames', '素材'], ['settings', '设置']] as const).map(([value, label]) => (
          <button type="button" key={value} aria-pressed={workspace === value} onClick={() => setWorkspace(value)}>{label}</button>
        ))}
      </nav>
      <div className="frames-playback-float" aria-label="播放控制">
        <Button variant="ghost" size="icon-sm" disabled={activeCount === 0} onClick={() => stepFrame(-1)} aria-label="上一帧"><ChevronLeft /></Button>
        <Button size="icon-sm" disabled={activeCount === 0} onClick={togglePlay} aria-label={playing ? '暂停' : '播放'}>{playing ? <Pause /> : <Play />}</Button>
        <Button variant="ghost" size="icon-sm" disabled={activeCount === 0} onClick={() => stepFrame(1)} aria-label="下一帧"><ChevronRight /></Button>
        <input
          className="frames-progress"
          type="range"
          min={0}
          max={maxIdx}
          step={1}
          value={safeIndex}
          disabled={activeCount < 2}
          aria-label="播放进度"
          aria-valuetext={frame ? `第 ${safeIndex + 1} 帧，共 ${activeCount} 帧` : '暂无帧'}
          title="拖动定位到指定帧"
          onPointerDown={() => setPlaying(false)}
          onChange={(event) => {
            setPlaying(false)
            jumpTo(Number(event.target.value))
          }}
        />
        <span className="frames-playback-position">{frame ? `${safeIndex + 1} / ${activeCount}` : '— / —'}</span>
        <span className="frames-duration">
          {duration}
          s ·
          {' '}
          {Number(fps.toFixed(2))}
          {' '}
          FPS
        </span>
        <Button variant="ghost" size="sm" onClick={() => setSequenceOpen(value => !value)} aria-expanded={sequenceOpen} aria-label={sequenceOpen ? '收起帧序列' : '展开帧序列'}>
          素材
          {frameCount}
        </Button>
      </div>
      <div ref={sequenceRef} className="frames-sequence-float" aria-label="帧素材">
        <section className="flex min-w-0 flex-col">
          <div className="flex min-h-8 flex-wrap items-center justify-between gap-3 pb-3">
            <h2 className="font-mono text-sm font-semibold tracking-tight">
              帧序列（
              {frameCount}
              ）
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={frameCount === 0 || cropping}
                onClick={() => void prepareCrop()}
              >
                {cropping ? <LoaderCircle className="animate-spin" /> : <Crop />}
                裁透明边
              </Button>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={frameCount === 0} onClick={toggleSelectAll}>
                  <Check />
                  {selected.size >= frameCount ? '全不选' : '全选'}
                </Button>
                <Button type="button" variant="outline" size="sm" disabled={frameCount === 0} onClick={sortByName}>
                  <ArrowDownAZ />
                  排序
                </Button>
              </div>
            </div>
          </div>
          <div className="min-w-0">
            {cropResult && (
              <p role="status" data-tone={cropResult.tone} className="mb-3 rounded-md border px-3 py-2 text-sm font-medium">
                {cropResult.text}
              </p>
            )}
            <ul aria-label="帧序列，可拖动调整顺序" className="flex gap-2 overflow-x-auto pb-3">
              {frames.map((f, i) => {
                const isActive = selected.has(f.id)
                const activeIdx = isActive ? activeFrames.indexOf(f) : -1
                return (
                  <li
                    key={f.id}
                    draggable
                    title={`${f.name} · ${f.width} × ${f.height} · ${formatSize(f.size)}`}
                    onDragStart={(e) => {
                      dragIndexRef.current = i
                      e.dataTransfer.effectAllowed = 'move'
                    }}
                    onDragOver={(e) => {
                      if (dragIndexRef.current === null)
                        return
                      e.preventDefault()
                      e.dataTransfer.dropEffect = 'move'
                      // Use the pointer's horizontal half to choose the insertion side.
                      // 横向序列按指针左右半区决定插入位置。
                      const rect = e.currentTarget.getBoundingClientRect()
                      const after = e.clientX > rect.left + rect.width / 2
                      setDropTarget({ index: i, after })
                    }}
                    onDrop={(e) => {
                      e.preventDefault()
                      const from = dragIndexRef.current
                      if (from !== null) {
                        const rect = e.currentTarget.getBoundingClientRect()
                        moveFrameTo(from, i, e.clientX > rect.left + rect.width / 2)
                      }
                      dragIndexRef.current = null
                      setDropTarget(null)
                    }}
                    onDragEnd={() => {
                      dragIndexRef.current = null
                      setDropTarget(null)
                    }}
                    className={cn(
                      'relative flex w-28 shrink-0 flex-col gap-2 border p-2 transition-colors',
                      isActive ? 'cursor-grab active:cursor-grabbing' : 'cursor-default opacity-40',
                      'border-border hover:border-foreground',
                      // Mark the insertion side with the left or right border.
                      // 用左右边框标记插入位置。
                      dropTarget?.index === i && (dropTarget.after
                        ? 'border-r-2 border-r-primary'
                        : 'border-l-2 border-l-primary'),
                    )}
                    onClick={() => {
                      if (!isActive)
                        return
                      setPlaying(false)
                      jumpTo(activeIdx)
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span onClick={e => e.stopPropagation()}>
                        <FrameCheckbox
                          checked={isActive}
                          onChange={() => toggleSelect(f.id)}
                          label={(
                            <span className="sr-only">
                              选择第
                              {i + 1}
                              {' '}
                              帧
                            </span>
                          )}
                          title={isActive ? `移出预览：${f.name}` : `加入预览：${f.name}`}
                        />
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{i + 1}</span>
                    </div>
                    <button
                      type="button"
                      disabled={!isActive}
                      aria-label={`预览第 ${i + 1} 帧：${f.name}`}
                      className="flex min-w-0 flex-col gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <img
                        src={f.url}
                        alt={f.name}
                        draggable={false}
                        className="h-16 w-full object-contain"
                        style={{ background: stageView.background }}
                      />
                      <span className="w-full truncate text-xs">{f.name.replace(/\.[^.]+$/, '')}</span>
                      <span className="frames-source-info">
                        {f.width}
                        ×
                        {f.height}
                        {' · '}
                        {formatSize(f.size)}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {frameCount === 0 && <p className="border-b border-border py-5 text-xs text-muted-foreground">导入后在这里勾选帧，拖动缩略图调整顺序。</p>}
          </div>
        </section>
      </div>
      <aside className="frames-panel" aria-label="帧动画设置">
        <div
          className="frames-panel-tabs"
          role="tablist"
          aria-label="设置面板"
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
              return
            event.preventDefault()
            event.stopPropagation()
            const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
            const currentTab = tabs.indexOf(document.activeElement as HTMLButtonElement)
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (currentTab + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
            tabs[next]?.focus()
            tabs[next]?.click()
          }}
        >
          {([['playback', '播放'], ['sprite', '精灵图'], ['code', '代码'], ['records', '项目']] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" tabIndex={panel === value ? 0 : -1} id={`frame-tab-${value}`} aria-selected={panel === value} aria-controls={`frame-panel-${value}`} onClick={() => setPanel(value)}>{label}</button>
          ))}
        </div>
        <div className="frames-panel-scroll">
          <div role="tabpanel" id="frame-panel-playback" aria-labelledby="frame-tab-playback" hidden={panel !== 'playback'}>
            <section className="min-w-0">
              <div className="pb-3">
                <h2 className="font-mono text-sm font-semibold tracking-tight">播放参数</h2>
              </div>
              <div className="flex flex-col gap-4">
                {/* 帧率 + 一轮时长（双向换算） */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="fps" className="text-xs font-medium text-muted-foreground">帧率</label>
                    <span className="text-xs text-muted-foreground">
                      {Number(fps.toFixed(2))}
                      {' fps · 每帧 '}
                      {frameMs}
                      {' ms'}
                    </span>
                  </div>
                  <div className="frames-rate-controls">
                    <input
                      id="fps"
                      type="range"
                      min={1}
                      max={60}
                      value={fps}
                      onChange={e => setFps(Number(e.target.value))}
                      className="min-w-0 flex-1 accent-primary"
                    />
                    <input
                      type="number"
                      min={1}
                      max={120}
                      step="any"
                      value={Number(fps.toFixed(2))}
                      aria-label="帧率（fps）"
                      title="帧率（fps）"
                      onChange={e => setFps(Math.min(120, Math.max(1, Number(e.target.value) || 1)))}
                      className={NUM_INPUT_CLASS}
                    />
                    <span className="text-xs text-muted-foreground">fps</span>
                  </div>
                  <div className="frames-total-duration">
                    <label htmlFor="frames-duration" className="text-xs text-muted-foreground">周期时长</label>
                    <input
                      id="frames-duration"
                      type="number"
                      min={0.01}
                      step={0.01}
                      disabled={activeCount === 0}
                      value={rangeLen > 0 ? Number((rangeLen / fps).toFixed(2)) : 0}
                      aria-label="所有帧总时长（秒），改了反推帧率"
                      title="所有帧总时长（秒），改了反推帧率"
                      onChange={(e) => {
                        const d = Number(e.target.value)
                        if (d > 0)
                          setFps(Math.min(120, Math.max(1, rangeLen / d)))
                      }}
                      className={NUM_INPUT_CLASS}
                    />
                    <span className="text-xs text-muted-foreground">秒</span>
                  </div>
                </div>

                {/* 帧范围：双头滑块，播放与导出都按范围截断 */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-medium text-muted-foreground">帧范围</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {activeCount > 0 ? `第 ${rangeStart + 1} → ${rangeEnd + 1} 帧` : '—'}
                      {rangeRaw !== null && (
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs"
                          onClick={() => setRangeRaw(null)}
                        >
                          恢复全程
                        </Button>
                      )}
                    </span>
                  </div>
                  <div className="relative h-4">
                    {/* 轨道 + 选中段高亮（视觉层，不响应指针） */}
                    <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-muted" />
                    {activeCount > 1 && (
                      <div
                        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
                        style={{
                          left: `${(rangeStart / maxIdx) * 100}%`,
                          right: `${(1 - rangeEnd / maxIdx) * 100}%`,
                        }}
                      />
                    )}
                    <input
                      type="range"
                      min={0}
                      max={maxIdx}
                      step={1}
                      value={rangeStart}
                      disabled={activeCount < 2}
                      aria-label="起始帧"
                      onChange={e => setRangeRaw([Math.min(Number(e.target.value), rangeEnd), rangeEnd])}
                      className={RANGE_INPUT_CLASS}
                    />
                    <input
                      type="range"
                      min={0}
                      max={maxIdx}
                      step={1}
                      value={rangeEnd}
                      disabled={activeCount < 2}
                      aria-label="结束帧"
                      onChange={e => setRangeRaw([rangeStart, Math.max(Number(e.target.value), rangeStart)])}
                      className={RANGE_INPUT_CLASS}
                    />
                  </div>
                </div>

                {/* 方向 / 循环 / 缩放：左标签单行 */}
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">方向</p>
                  <OptionGroup<Direction>
                    label="播放方向"
                    value={direction}
                    onChange={setDirection}
                    options={[
                      { value: 'forward', label: '正序' },
                      { value: 'reverse', label: '倒序' },
                      { value: 'pingpong', label: '往返' },
                    ]}
                  />
                </div>
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">循环</p>
                  <div className="flex items-center gap-2">
                    <OptionGroup<string>
                      label="循环方式"
                      className="flex-1"
                      value={loopInfinite ? 'infinite' : 'count'}
                      onChange={v => setLoopInfinite(v === 'infinite')}
                      options={[
                        { value: 'infinite', label: '无限' },
                        { value: 'count', label: '次数' },
                      ]}
                    />
                    {!loopInfinite && (
                      <>
                        <input
                          type="number"
                          min={1}
                          max={999}
                          value={loopCount}
                          aria-label="循环次数"
                          title="循环次数，播完停在最后一帧"
                          onChange={e => setLoopCount(Math.min(999, Math.max(1, Number(e.target.value) || 1)))}
                          className={NUM_INPUT_CLASS}
                        />
                        <span className="text-xs text-muted-foreground">次</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <FrameCheckbox
                    checked={pixelated}
                    onChange={setPixelated}
                    label="像素风"
                    title="放大时保持锐利，适合像素画"
                  />
                </div>

              </div>
            </section>
          </div>
          <div role="tabpanel" id="frame-panel-sprite" aria-labelledby="frame-tab-sprite" hidden={panel !== 'sprite'}>
            <section className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
                <h2 className="font-mono text-sm font-semibold tracking-tight">精灵图导出</h2>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={spriting || exportFrames.length === 0}
                  onClick={() => void downloadSprite()}
                >
                  {spriting ? <LoaderCircle className="animate-spin" /> : <FileImage />}
                  下载精灵图
                </Button>
              </div>
              <div className="mb-4 max-w-xs">
                <div>
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">排列</p>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                    <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, exportFrames.length)}
                        value={spriteDims.cols}
                        aria-label="精灵图列数"
                        title="修改列数，行数自动计算"
                        onChange={e => setSpriteDimension({ axis: 'cols', value: Math.max(1, Number(e.target.value) || 1) })}
                        className={cn(NUM_INPUT_CLASS, 'min-w-0 w-auto flex-1 shrink')}
                      />
                      列
                    </label>
                    <span className="text-xs text-muted-foreground">×</span>
                    <label className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <input
                        type="number"
                        min={1}
                        max={Math.max(1, exportFrames.length)}
                        value={spriteDims.rows}
                        aria-label="精灵图行数"
                        title="修改行数，列数自动计算"
                        onChange={e => setSpriteDimension({ axis: 'rows', value: Math.max(1, Number(e.target.value) || 1) })}
                        className={cn(NUM_INPUT_CLASS, 'min-w-0 w-auto flex-1 shrink')}
                      />
                      行
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">
                  精灵图预览（
                  {exportFrames.length}
                  {' 帧'}
                  {exportFrames.length > 0 && ` · 单元格 ${cellW} × ${cellH}`}
                  {uniformFrameSize && ` · 单张 ${uniformFrameSize.w} × ${uniformFrameSize.h}`}
                  {' · '}
                  {spriteDims.cols}
                  {' 列 × '}
                  {spriteDims.rows}
                  {' 行'}
                  {' · '}
                  {cellW * spriteDims.cols}
                  {' × '}
                  {cellH * spriteDims.rows}
                  ）
                </span>
                <div
                  className="h-48 max-w-full overflow-auto rounded-md border border-border"
                  style={{ background: stageView.background }}
                >
                  {sprite && sprite.key === spriteKey && spriteKey !== ''
                    ? (
                        <div className="flex min-h-full w-full items-center justify-center p-2">
                          <img
                            src={sprite.url}
                            alt="精灵图预览"
                            draggable={false}
                            className={cn('block h-auto max-h-44 max-w-full object-contain', stageView.showBounds && STAGE_BOUNDARY_CLASS)}
                            style={{ imageRendering: pixelated ? 'pixelated' : 'auto' }}
                          />
                        </div>
                      )
                    : (
                        <div className="flex min-h-full items-center justify-center text-xs text-muted-foreground">
                          {exportFrames.length === 0
                            ? '暂无帧'
                            : spriteError === spriteKey
                              ? (
                                  <div role="alert" className="flex flex-col items-center gap-2">
                                    <span>精灵图预览失败，请重试</span>
                                    <Button size="sm" variant="outline" onClick={() => setSpriteRetry(value => value + 1)}>重新生成</Button>
                                  </div>
                                )
                              : '生成中…'}
                        </div>
                      )}
                </div>
              </div>

            </section>
          </div>
          <div role="tabpanel" id="frame-panel-code" aria-labelledby="frame-tab-code" hidden={panel !== 'code'}>
            <section className="flex min-w-0 flex-col">
              <div className="flex min-h-8 items-center justify-between gap-2 pb-3">
                <h2 className="font-mono text-sm font-semibold tracking-tight">样式代码</h2>
                <Button type="button" variant="outline" size="icon-sm" disabled={!exportText} title="复制" aria-label="复制" onClick={() => copyCss(exportText)}>
                  {copiedCss ? <Check data-feedback="success" /> : <Copy />}
                </Button>
              </div>
              {copyError && <p role="alert" className="mb-2 text-xs text-destructive">复制失败，请重试或手动选择代码复制</p>}
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  <OptionGroup<ExportFormat>
                    label="导出格式"
                    className="w-fit"
                    value={exportFormat}
                    onChange={setExportFormat}
                    options={[
                      { value: 'scss', label: 'SCSS' },
                      { value: 'less', label: 'Less' },
                      { value: 'css', label: 'CSS' },
                    ]}
                  />
                  <FrameCheckbox
                    checked={exportVars}
                    onChange={setExportVars}
                    label="变量"
                    title="帧数 / 时长提取为变量，便于集中调整"
                  />
                  <FrameCheckbox
                    checked={exportContainer}
                    onChange={setExportContainer}
                    label="容器"
                    title="宽高由容器控制（100% + aspect-ratio），帧切换走百分比定位；关闭则写死单帧 px 尺寸"
                  />
                </div>
                <pre
                  tabIndex={0}
                  aria-label="导出样式代码"
                  onKeyDown={selectCodeOnShortcut}
                  className="min-h-48 max-h-96 min-w-0 flex-1 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs leading-5 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {exportText
                    ? exportText.split(/(url\("[^"]*"\))/g).map(part => (
                        part.startsWith('url(')
                          ? (
                              <mark
                                key={part}
                                title="下载精灵图后，把这里换成项目里的实际路径"
                                className="rounded-sm bg-chart-3/40 px-0.5 font-medium text-foreground"
                              >
                                {part}
                              </mark>
                            )
                          : part
                      ))
                    : '// 导入帧后生成样式代码'}
                </pre>
              </div>
            </section>
          </div>
          <div role="tabpanel" id="frame-panel-records" aria-labelledby="frame-tab-records" hidden={panel !== 'records'}>
            <section className="min-w-0 frames-record-section">
              <div className="pb-1">
                <h2 className="font-mono text-sm font-semibold tracking-tight">记录</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">导入后自动保存素材；调整参数后点保存更新项目。相同素材不会新增记录。</p>
              </div>
              <div>
                <div className="flex max-w-xl items-center gap-2">
                  <input
                    value={recordName}
                    onChange={event => setRecordName(event.target.value)}
                    placeholder={frames[0]?.name.replace(/\.[^.]+$/, '') || '项目名称'}
                    aria-label="项目名称"
                    className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                  />
                  <Button type="button" variant="outline" size="icon-sm" title="保存当前项目" aria-label="保存当前项目" disabled={frames.length === 0 || saving || importing || cropping} onClick={() => void saveRecord()}>
                    {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
                  </Button>
                </div>
                {recordFeedback && <p role={recordFeedback.error ? 'alert' : 'status'} className={cn('mt-2 text-xs', recordFeedback.error ? 'text-destructive' : 'text-muted-foreground')}>{recordFeedback.text}</p>}
                {recordsLoading && <p role="status" className="mt-2 text-xs text-muted-foreground">加载项目列表…</p>}
                {!recordsLoading && records.length === 0 && <p className="mt-2 text-xs text-muted-foreground">暂无保存的项目</p>}
                {records.length > 0 && (
                  <div className="mt-3 grid gap-x-6 sm:grid-cols-2">
                    {records.map(record => (
                      <div key={record.id} className="flex items-center gap-2 border-b border-border py-2">
                        <button type="button" className="min-w-0 flex-1 truncate text-left text-sm hover:underline" title="加载项目" disabled={importing} onClick={() => void loadRecord(record.id)}>
                          {record.recordName}
                        </button>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {record.frameCount}
                          {' '}
                          帧
                        </span>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`删除项目 ${record.recordName}`} disabled={deletingId !== null} onClick={() => void deleteRecord(record.id)}>
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
        {exportError && <p role="alert" className="px-3 py-2 text-xs text-destructive">导出失败，请重试</p>}
        <div className="frames-panel-footer">
          <span>
            {exportFrames.length}
            {' '}
            帧 ·
            {' '}
            {spriteDims.cols}
            ×
            {spriteDims.rows}
            {' '}
            格
          </span>
          <Button size="sm" disabled={spriting || exportFrames.length === 0} onClick={() => void downloadSprite()}>
            {spriting ? <LoaderCircle className="animate-spin" /> : <FileImage />}
            下载 PNG
          </Button>
        </div>
      </aside>
      {cropPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4"
          onClick={closeCropPreview}
        >
          <div
            ref={cropDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="裁剪公共透明边"
            tabIndex={-1}
            className="w-full max-w-lg border border-border bg-popover p-6"
            onClick={e => e.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key !== 'Tab')
                return
              const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)')
              const first = controls[0]
              const last = controls[controls.length - 1]
              if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
                event.preventDefault()
                last?.focus()
              }
              else if (!event.shiftKey && (document.activeElement === last || document.activeElement === event.currentTarget)) {
                event.preventDefault()
                first?.focus()
              }
            }}
          >
            <h2 className="font-mono text-lg font-semibold tracking-tight">裁剪公共透明边</h2>
            {cropPreview.mixedSize && (
              <p data-tone="warning" className="mt-2 flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-xs">
                <TriangleAlert className="mt-px size-3.5 shrink-0" />
                <span>
                  图片宽高不一致：框线以最大画布
                  {cropPreview.fullW}
                  {' × '}
                  {cropPreview.fullH}
                  为基准，小图按左上角对齐，超出部分自动忽略。
                </span>
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {cropPreview.union
                ? (
                    <>
                      实线框为原图尺寸，虚线框内为保留区域：
                      {cropPreview.fullW}
                      {' × '}
                      {cropPreview.fullH}
                      {' → '}
                      {cropPreview.union.right - cropPreview.union.left}
                      {' × '}
                      {cropPreview.union.bottom - cropPreview.union.top}
                    </>
                  )
                : '当前阈值下所有帧均为透明，无法裁剪'}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <label htmlFor="alpha-threshold" className="shrink-0 text-sm font-medium">透明阈值</label>
              <input
                id="alpha-threshold"
                type="range"
                min={0}
                max={128}
                value={alphaThreshold}
                onChange={e => setAlphaThreshold(Number(e.target.value))}
                className="min-w-0 flex-1 accent-primary"
              />
              <input
                type="number"
                min={0}
                max={254}
                value={alphaThreshold}
                aria-label="透明阈值"
                title="alpha 低于此值视为透明"
                onChange={e => setAlphaThreshold(Math.min(254, Math.max(0, Number(e.target.value) || 0)))}
                className={NUM_INPUT_CLASS}
              />
            </div>
            <div className="mt-4 flex justify-center">
              <div
                className="rounded-md border border-border p-2"
                style={{ background: stageView.checkerBackground }}
              >
                <div className="relative w-fit">
                  <img
                    src={cropPreview.url}
                    alt="所有帧叠放预览"
                    draggable={false}
                    className="block max-h-80 max-w-full"
                  />
                  {/* 原图尺寸描边（实线） */}
                  <div className="pointer-events-none absolute inset-0 border border-border" />
                  {/* 裁剪保留区域（虚线）：百分比定位，随预览图缩放 */}
                  {cropPreview.union && (
                    <div
                      className="pointer-events-none absolute border border-dashed border-primary bg-primary/10"
                      style={{
                        left: `${(cropPreview.union.left / cropPreview.fullW) * 100}%`,
                        top: `${(cropPreview.union.top / cropPreview.fullH) * 100}%`,
                        width: `${((cropPreview.union.right - cropPreview.union.left) / cropPreview.fullW) * 100}%`,
                        height: `${((cropPreview.union.bottom - cropPreview.union.top) / cropPreview.fullH) * 100}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeCropPreview}>
                取消
              </Button>
              <Button type="button" disabled={cropping || !cropPreview.union} onClick={() => void applyCrop()}>
                {cropping ? <LoaderCircle className="animate-spin" /> : <Crop />}
                应用裁剪
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
