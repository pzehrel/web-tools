import type { LucideIcon } from 'lucide-react'
import type { ChangeEvent, DragEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode, PointerEvent as ReactPointerEvent } from 'react'
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Frame,
  ImagePlus,
  Link2,
  Link2Off,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'

import { Seo } from '@/components/seo'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useStagePan, useStageZoom } from '@/lib/stage'
import { cn } from '@/lib/utils'

/** 已加载的源图：objectURL 或内置示例的 dataURL，绝不离开浏览器 */
interface SourceImage {
  name: string
  url: string
  width: number
  height: number
}

/** 四条切线的边距（图像 px）：内容区 = 四条线围出的中心 */
interface Slice {
  top: number
  right: number
  bottom: number
  left: number
}

type Side = keyof Slice
type RepeatMode = 'stretch' | 'repeat' | 'round' | 'space'

const SIDES: { side: Side, label: string }[] = [
  { side: 'top', label: '上' },
  { side: 'right', label: '右' },
  { side: 'bottom', label: '下' },
  { side: 'left', label: '左' },
]

/** 导出代码里的占位图名：用户自行替换为实际路径 */
const EXPORT_IMAGE_NAME = 'nine-patch.png'

/** 读取用户选择的图片文件；解码失败返回 null */
function loadImageFile(file: File): Promise<SourceImage | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ name: file.name, url, width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

/**
 * 内置示例图（96×96，建议切片 24）：
 * 粗描边圆角徽章 + 中心圆点，四角是圆弧、四边是直线段，
 * 切片后拉伸 / 平铺的效果一眼可辨。仅在客户端生成（canvas 无 SSG 环境）。
 */
function createDemoImage(): SourceImage | null {
  const size = 96
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return null

  const inset = 8
  const r = 18
  const x0 = inset
  const y0 = inset
  const x1 = size - inset
  const y1 = size - inset
  ctx.beginPath()
  ctx.moveTo(x0 + r, y0)
  ctx.lineTo(x1 - r, y0)
  ctx.arcTo(x1, y0, x1, y0 + r, r)
  ctx.lineTo(x1, y1 - r)
  ctx.arcTo(x1, y1, x1 - r, y1, r)
  ctx.lineTo(x0 + r, y1)
  ctx.arcTo(x0, y1, x0, y1 - r, r)
  ctx.lineTo(x0, y0 + r)
  ctx.arcTo(x0, y0, x0 + r, y0, r)
  ctx.closePath()
  ctx.fillStyle = '#fff3d6'
  ctx.fill()
  ctx.lineWidth = 8
  ctx.strokeStyle = '#33302b'
  ctx.stroke()

  // 中心圆点：落在内容区，用于观察 fill 开 / 关的差别
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, 10, 0, Math.PI * 2)
  ctx.fillStyle = '#e2622b'
  ctx.fill()
  // 边上小刻度：让 repeat / round / space 的平铺单元可数
  ctx.fillStyle = '#33302b'
  ctx.fillRect(size / 2 - 2, y0 - 4, 4, 8)
  ctx.fillRect(size / 2 - 2, y1 - 4, 4, 8)
  ctx.fillRect(x0 - 4, size / 2 - 2, 8, 4)
  ctx.fillRect(x1 - 4, size / 2 - 2, 8, 4)

  return { name: 'demo.png', url: canvas.toDataURL('image/png'), width: size, height: size }
}

/** 默认切片：短边的 1/4，四边相同 */
function defaultSlice(width: number, height: number): Slice {
  const s = Math.max(1, Math.round(Math.min(width, height) / 4))
  return { top: s, right: s, bottom: s, left: s }
}

/** CSS 四值简写折叠：全同 → 1 值；上下同且左右同 → 2 值；左右同 → 3 值。unit 为单位后缀（slice 无单位，宽度用 'px'） */
function collapse4(t: number, r: number, b: number, l: number, unit = ''): string {
  const u = (v: number) => `${v}${unit}`
  if (t === r && r === b && b === l)
    return u(t)
  if (t === b && r === l)
    return `${u(t)} ${u(r)}`
  if (r === l)
    return `${u(t)} ${u(r)} ${u(b)}`
  return `${u(t)} ${u(r)} ${u(b)} ${u(l)}`
}

interface CodeParams {
  slice: Slice
  /** 解绑后独立调整的边框图像宽度（px，四边，与切片边距同构） */
  imageWidth: Slice
  /** 绑定 = 宽度跟随切片边距（只有切片可调整） */
  linkWidth: boolean
  outset: number
  fill: boolean
  repeatH: RepeatMode
  repeatV: RepeatMode
}

function repeatValue(p: CodeParams): string {
  return p.repeatH === p.repeatV ? p.repeatH : `${p.repeatH} ${p.repeatV}`
}

function sliceValue(p: CodeParams): string {
  const base = collapse4(p.slice.top, p.slice.right, p.slice.bottom, p.slice.left)
  return p.fill ? `${base} fill` : base
}

/** 有效 border-image-width：绑定时跟随四条切片的 px 值，解绑时用独立的四边宽度 */
function widthValue(p: CodeParams): string {
  const w = p.linkWidth ? p.slice : p.imageWidth
  return collapse4(w.top, w.right, w.bottom, w.left, 'px')
}

/** 导出格式：scss / less / css 输出一致——直写值的纯声明，不用预处理器变量 */
type CodeFormat = 'scss' | 'less' | 'css'
/** 写法：分开写 = 每个 border-image-* 一行；简写 = border-image 一行收拢 */
type CodeStyle = 'longhand' | 'shorthand'

function buildCode(style: CodeStyle, p: CodeParams): string {
  /**
   * 不输出 border-width：border-style 非 none 时 border-image 即可正常绘制，
   * 图像会压住 padding 区，内容间距由使用者的 padding 控制（点九图常见写法）。
   * 因此 border-image-width 必须始终显式给出——缺省值 1 = 1 × border-width，
   * 不写宽度会退化成 medium（≈3px）。
   */
  if (style === 'longhand') {
    return [
      '.nine-patch {',
      '  border-style: solid;',
      `  border-image-source: url("${EXPORT_IMAGE_NAME}");`,
      `  border-image-slice: ${sliceValue(p)};`,
      `  border-image-width: ${widthValue(p)};`,
      `  border-image-outset: ${p.outset}px;`,
      `  border-image-repeat: ${repeatValue(p)};`,
      '}',
    ].join('\n')
  }
  const outsetSeg = p.outset === 0 ? '' : ` / ${p.outset}px`
  return [
    '.nine-patch {',
    '  border: solid transparent;',
    `  border-image: url("${EXPORT_IMAGE_NAME}") ${sliceValue(p)} / ${widthValue(p)}${outsetSeg} ${repeatValue(p)};`,
    '}',
  ].join('\n')
}

/** 代码区内的全选只选择代码，避免快捷键扩散到整页 */
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

/** 数字小输入框的统一样式 */
const NUM_INPUT_CLASS = 'w-full rounded-md border-2 border-border bg-background px-1.5 py-1 text-center font-mono text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

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
    <div className={cn('flex overflow-hidden rounded-md border-2 border-border shadow-hard-xs', className)} role="radiogroup" aria-label={label}>
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
              'flex flex-1 items-center justify-center gap-1 px-1 py-1.5 text-xs font-bold whitespace-nowrap transition-colors',
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

/** 新粗野主义勾选框：2px 描边 + 硬阴影 + 抬起/压实，选中填充主色 */
function BrutalCheckbox({
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
          'flex size-5 shrink-0 items-center justify-center rounded-sm border-2 border-border shadow-hard-xs transition-all',
          'hover:-translate-x-px hover:-translate-y-px hover:shadow-hard-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
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

/** 默认视图缩放：小图放大到 200% 便于看清，大图 100% */
function fitZoom(w: number, h: number): number {
  return Math.min(w, h) < 200 ? 2 : 1
}

/** 舞台棋盘格底纹：语义令牌双色，随主题联动 */
const CHECKER_STYLE = {
  backgroundImage: 'conic-gradient(var(--muted) 25%, transparent 0 50%, var(--muted) 0 75%, transparent 0)',
  backgroundSize: '16px 16px',
} as const

/** 裁剪遮罩：前景 / 背景色交叉斜纹——图片内容色不可控，双向条纹保证任意图上至少一组可辨 */
const CROP_MASK_STYLE = {
  backgroundColor: 'color-mix(in srgb, var(--foreground) 12%, transparent)',
  backgroundImage: [
    'repeating-linear-gradient(45deg, color-mix(in srgb, var(--foreground) 45%, transparent) 0 4px, transparent 4px 8px)',
    'repeating-linear-gradient(-45deg, color-mix(in srgb, var(--background) 60%, transparent) 0 4px, transparent 4px 8px)',
  ].join(', '),
} as const

/** 预览框的缩边方向：四边各管宽或高，四角同时管两个 */
type ResizeEdge = 'left' | 'right' | 'top' | 'bottom'
type ResizeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/** 四边拖拽条：位置类 + 指示条类（悬停预览框时统一显示） */
const RESIZE_EDGES: { edge: ResizeEdge, strip: string, bar: string, label: string }[] = [
  { edge: 'right', strip: 'top-0 bottom-0 -right-2 w-4 cursor-ew-resize', bar: 'top-1/2 right-1.5 h-8 w-1 -translate-y-1/2', label: '拖动调整宽度' },
  { edge: 'left', strip: 'top-0 bottom-0 -left-2 w-4 cursor-ew-resize', bar: 'top-1/2 left-1.5 h-8 w-1 -translate-y-1/2', label: '拖动调整宽度' },
  { edge: 'bottom', strip: 'left-0 right-0 -bottom-2 h-4 cursor-ns-resize', bar: 'bottom-1.5 left-1/2 h-1 w-8 -translate-x-1/2', label: '拖动调整高度' },
  { edge: 'top', strip: 'left-0 right-0 -top-2 h-4 cursor-ns-resize', bar: 'top-1.5 left-1/2 h-1 w-8 -translate-x-1/2', label: '拖动调整高度' },
]

/** 四角拖拽块：L 形指示块（与四边指示条同为 primary 色），悬停预览框时统一显示 */
const RESIZE_CORNERS: { corner: ResizeCorner, hit: string, lShape: string, label: string }[] = [
  { corner: 'top-left', hit: '-top-2 -left-2 size-5 cursor-nwse-resize', lShape: 'top-1.5 left-1.5 border-t-4 border-l-4 rounded-tl-sm', label: '拖动调整尺寸' },
  { corner: 'top-right', hit: '-top-2 -right-2 size-5 cursor-nesw-resize', lShape: 'top-1.5 right-1.5 border-t-4 border-r-4 rounded-tr-sm', label: '拖动调整尺寸' },
  { corner: 'bottom-left', hit: '-bottom-2 -left-2 size-5 cursor-nesw-resize', lShape: 'bottom-1.5 left-1.5 border-b-4 border-l-4 rounded-bl-sm', label: '拖动调整尺寸' },
  { corner: 'bottom-right', hit: '-bottom-2 -right-2 size-5 cursor-nwse-resize', lShape: 'bottom-1.5 right-1.5 border-r-4 border-b-4 rounded-br-sm', label: '拖动调整尺寸' },
]

export default function NinePatchTool() {
  const [image, setImage] = useState<SourceImage | null>(null)
  const [slice, setSlice] = useState<Slice>({ top: 24, right: 24, bottom: 24, left: 24 })
  /** border-image-width 四边值：解绑时可独立调整 */
  const [imageWidth, setImageWidth] = useState<Slice>({ top: 24, right: 24, bottom: 24, left: 24 })
  const [outset, setOutset] = useState(0)
  const [fill, setFill] = useState(true)
  const [linkWidth, setLinkWidth] = useState(true)
  const [repeatH, setRepeatH] = useState<RepeatMode>('stretch')
  const [repeatV, setRepeatV] = useState<RepeatMode>('stretch')
  /** 编辑 / 预览舞台的视图缩放（1 = 100%）：滚轮或双指调整，不影响导出 */
  const [zoom, setZoom] = useState(1)
  const [previewZoom, setPreviewZoom] = useState(1)
  const [dragOver, setDragOver] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  /** 预览框尺寸（px）：拖拽四边 / 右下角调整 */
  const [previewSize, setPreviewSize] = useState({ w: 320, h: 180 })
  const [codeFormat, setCodeFormat] = useState<CodeFormat>('scss')
  const [codeStyle, setCodeStyle] = useState<CodeStyle>('longhand')
  const [copied, setCopied] = useState(false)
  /** 中心裁剪：删除中心可拉伸区域的多余行列，导出时生效，CSS 无需修改 */
  const [cropEnabled, setCropEnabled] = useState(false)
  /** 中心保留尺寸（图像 px）：默认 1×1 即最小图 */
  const [cropKeep, setCropKeep] = useState({ w: 1, h: 1 })

  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorStageRef = useRef<HTMLDivElement>(null)
  const previewStageRef = useRef<HTMLDivElement>(null)
  /** 切线拖拽快照：指针 id + 边 + 起始指针坐标 + 起始边距（图像 px） */
  const lineDragRef = useRef<{ pointerId: number, side: Side, startClient: number, startValue: number } | null>(null)
  /** 预览框缩边拖拽快照 */
  const resizeDragRef = useRef<{ pointerId: number, edge: ResizeEdge | ResizeCorner, startX: number, startY: number, baseW: number, baseH: number } | null>(null)
  /** 卸载回收用：始终指向最新 image */
  const imageRef = useRef<SourceImage | null>(null)
  imageRef.current = image

  useStageZoom(editorStageRef, zoom, setZoom)
  useStageZoom(previewStageRef, previewZoom, setPreviewZoom)
  const editorPan = useStagePan(editorStageRef, () => lineDragRef.current !== null)
  const previewPan = useStagePan(previewStageRef, () => resizeDragRef.current !== null)

  /** 换图：回收旧 objectURL，切片与边框宽度回到按图推导的默认值 */
  const applyImage = useCallback((img: SourceImage) => {
    /* eslint-disable react/set-state-in-effect -- 挂载 effect 也走这里初始化内置示例图（canvas 只有客户端可用，无法放进 useState 初值，否则水合不一致） */
    setImage((prev) => {
      if (prev && prev.url.startsWith('blob:'))
        URL.revokeObjectURL(prev.url)
      return img
    })
    const s = defaultSlice(img.width, img.height)
    setSlice(s)
    setImageWidth(s)
    setOutset(0)
    setImportError(null)
    // 裁剪与上一张图的中心尺寸绑定，换图后回到默认
    setCropEnabled(false)
    setCropKeep({ w: 1, h: 1 })
    // 小图默认放大，切线更好拖
    setZoom(fitZoom(img.width, img.height))
    /* eslint-enable react/set-state-in-effect */
  }, [])

  // 首次进入（客户端）自动生成内置示例图，打开即可玩；SSG 环境无 canvas，首渲保持空态
  useEffect(() => {
    if (imageRef.current)
      return
    const demo = createDemoImage()
    if (demo)
      applyImage(demo)
  }, [applyImage])

  // 卸载时回收 objectURL
  useEffect(() => () => {
    const img = imageRef.current
    if (img && img.url.startsWith('blob:'))
      URL.revokeObjectURL(img.url)
  }, [])

  /* ---------- 图片导入 ---------- */

  const onFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file)
      return
    if (!file.type.startsWith('image/')) {
      setImportError('请选择图片文件')
      return
    }
    void loadImageFile(file).then((img) => {
      if (img)
        applyImage(img)
      else
        setImportError('图片解码失败，换一张试试')
    })
  }, [applyImage])

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (!file)
      return
    if (!file.type.startsWith('image/')) {
      setImportError('请选择图片文件')
      return
    }
    void loadImageFile(file).then((img) => {
      if (img)
        applyImage(img)
      else
        setImportError('图片解码失败，换一张试试')
    })
  }, [applyImage])

  /* ---------- 切线拖拽与键盘微调 ---------- */

  const clampSlice = useCallback((side: Side, value: number): number => {
    if (!image)
      return 0
    const max = side === 'top' || side === 'bottom' ? image.height : image.width
    return Math.min(max, Math.max(0, Math.round(value)))
  }, [image])

  const setSliceValue = useCallback((side: Side, value: number) => {
    setSlice(prev => ({ ...prev, [side]: clampSlice(side, value) }))
  }, [clampSlice])

  /** border-image-width 四边输入：0 ~ 200px */
  const setImageWidthValue = useCallback((side: Side, value: number) => {
    const v = Math.min(200, Math.max(0, Math.round(value) || 0))
    setImageWidth(prev => ({ ...prev, [side]: v }))
  }, [])

  const scale = zoom

  const onLinePointerDown = useCallback((side: Side) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !image)
      return
    e.preventDefault()
    lineDragRef.current = {
      pointerId: e.pointerId,
      side,
      startClient: side === 'top' || side === 'bottom' ? e.clientY : e.clientX,
      startValue: slice[side],
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [image, slice])

  const onLinePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = lineDragRef.current
    if (!drag || drag.pointerId !== e.pointerId)
      return
    const client = drag.side === 'top' || drag.side === 'bottom' ? e.clientY : e.clientX
    // 下 / 右边距的线随指针反向移动（边距增大 = 线往中心外移）
    const sign = drag.side === 'bottom' || drag.side === 'right' ? -1 : 1
    setSliceValue(drag.side, drag.startValue + sign * (client - drag.startClient) / scale)
  }, [setSliceValue, scale])

  const onLinePointerEnd = useCallback(() => {
    lineDragRef.current = null
  }, [])

  /** 键盘微调：沿线的法向方向键 ±1px，Shift ±10px */
  const onLineKeyDown = useCallback((side: Side) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const horizontal = side === 'top' || side === 'bottom'
    let delta = 0
    if (horizontal && e.key === 'ArrowUp')
      delta = -1
    else if (horizontal && e.key === 'ArrowDown')
      delta = 1
    else if (!horizontal && e.key === 'ArrowLeft')
      delta = -1
    else if (!horizontal && e.key === 'ArrowRight')
      delta = 1
    if (delta === 0)
      return
    e.preventDefault()
    const sign = side === 'bottom' || side === 'right' ? -1 : 1
    setSliceValue(side, slice[side] + sign * delta * (e.shiftKey ? 10 : 1))
  }, [slice, setSliceValue])

  const resetSlice = useCallback(() => {
    if (!image)
      return
    setSlice(defaultSlice(image.width, image.height))
  }, [image])

  /* ---------- 中心裁剪：删行列得到最小图，导出时生效 ---------- */

  /** 中心区域尺寸（图像 px）：四条切线围出的可拉伸区 */
  const centerW = image ? Math.max(0, image.width - slice.left - slice.right) : 0
  const centerH = image ? Math.max(0, image.height - slice.top - slice.bottom) : 0
  /** 实际保留尺寸：不超过当前中心区 */
  const keepW = Math.min(cropKeep.w, Math.max(1, centerW))
  const keepH = Math.min(cropKeep.h, Math.max(1, centerH))
  /** 裁剪后的图片尺寸：边距不动，只缩中心 */
  const croppedW = slice.left + keepW + slice.right
  const croppedH = slice.top + keepH + slice.bottom
  /** 启用且有像素可裁才算激活（中心小于等于保留尺寸时无事可做） */
  const cropActive = cropEnabled && image !== null && centerW > 0 && centerH > 0 && (keepW < centerW || keepH < centerH)

  const setCropKeepValue = useCallback((axis: 'w' | 'h', value: number) => {
    setCropKeep(prev => ({ ...prev, [axis]: Math.max(1, Math.round(value) || 1) }))
  }, [])

  /** 下载裁剪后的 PNG：三列 × 三行 1:1 拷贝，角不动、边带与中心只保留中间行列 */
  const downloadCropped = useCallback(() => {
    if (!image || !cropActive)
      return
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = croppedW
      canvas.height = croppedH
      const ctx = canvas.getContext('2d')
      if (!ctx)
        return
      const kx = slice.left + Math.floor((centerW - keepW) / 2)
      const ky = slice.top + Math.floor((centerH - keepH) / 2)
      // [源起点, 源尺寸, 目标起点]
      const cols: [number, number, number][] = [
        [0, slice.left, 0],
        [kx, keepW, slice.left],
        [image.width - slice.right, slice.right, slice.left + keepW],
      ]
      const rows: [number, number, number][] = [
        [0, slice.top, 0],
        [ky, keepH, slice.top],
        [image.height - slice.bottom, slice.bottom, slice.top + keepH],
      ]
      for (const [sx, sw, dx] of cols) {
        for (const [sy, sh, dy] of rows) {
          if (sw > 0 && sh > 0)
            ctx.drawImage(img, sx, sy, sw, sh, dx, dy, sw, sh)
        }
      }
      canvas.toBlob((blob) => {
        if (!blob)
          return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${image.name.replace(/\.[^.]+$/, '') || 'nine-patch'}-cropped.png`
        a.click()
        URL.revokeObjectURL(url)
      }, 'image/png')
    }
    img.src = image.url
  }, [image, cropActive, slice, centerW, centerH, keepW, keepH, croppedW, croppedH])

  /* ---------- 预览框缩边：拖四边改宽 / 高，拖四角同时改 ---------- */

  const onResizePointerDown = useCallback((edge: ResizeEdge | ResizeCorner) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0)
      return
    e.preventDefault()
    resizeDragRef.current = { pointerId: e.pointerId, edge, startX: e.clientX, startY: e.clientY, baseW: previewSize.w, baseH: previewSize.h }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [previewSize])

  const clampPreview = (w: number, h: number) => ({
    w: Math.min(720, Math.max(96, Math.round(w))),
    h: Math.min(480, Math.max(64, Math.round(h))),
  })

  const onResizePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = resizeDragRef.current
    if (!drag || drag.pointerId !== e.pointerId)
      return
    // 预览有视图缩放：屏幕位移换算回盒子的逻辑像素
    const dx = (e.clientX - drag.startX) / previewZoom
    const dy = (e.clientY - drag.startY) / previewZoom
    let w = drag.baseW
    let h = drag.baseH
    if (drag.edge === 'right' || drag.edge === 'top-right' || drag.edge === 'bottom-right')
      w = drag.baseW + dx
    else if (drag.edge === 'left' || drag.edge === 'top-left' || drag.edge === 'bottom-left')
      w = drag.baseW - dx
    if (drag.edge === 'bottom' || drag.edge === 'bottom-left' || drag.edge === 'bottom-right')
      h = drag.baseH + dy
    else if (drag.edge === 'top' || drag.edge === 'top-left' || drag.edge === 'top-right')
      h = drag.baseH - dy
    setPreviewSize(clampPreview(w, h))
  }, [previewZoom])

  const onResizePointerEnd = useCallback(() => {
    resizeDragRef.current = null
  }, [])

  const onResizeKeyDown = useCallback((e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 40 : 8
    let dw = 0
    let dh = 0
    if (e.key === 'ArrowLeft')
      dw = -step
    else if (e.key === 'ArrowRight')
      dw = step
    else if (e.key === 'ArrowUp')
      dh = -step
    else if (e.key === 'ArrowDown')
      dh = step
    else
      return
    e.preventDefault()
    setPreviewSize(prev => clampPreview(prev.w + dw, prev.h + dh))
  }, [])

  /* ---------- 代码导出 ---------- */

  const codeParams: CodeParams = { slice, imageWidth, linkWidth, outset, fill, repeatH, repeatV }
  const exportText = buildCode(codeStyle, codeParams)

  const copyCode = useCallback(() => {
    void navigator.clipboard.writeText(exportText).then(() => {
      setCopied(true)
      setTimeout(setCopied, 1200, false)
    })
  }, [exportText])

  /* ---------- 渲染 ---------- */

  /** 裁剪遮罩（图像 px）：裁剪删的是整行整列——横向条带贯通全宽、纵向条带贯通全高；keepRect 为保留框 */
  let cropMask: { x: number, y: number, w: number, h: number }[] | null = null
  let keepRect: { x: number, y: number, w: number, h: number } | null = null
  if (cropActive && image) {
    const cx0 = slice.left
    const cy0 = slice.top
    const cx1 = image.width - slice.right
    const cy1 = image.height - slice.bottom
    const kx0 = cx0 + Math.floor((centerW - keepW) / 2)
    const ky0 = cy0 + Math.floor((centerH - keepH) / 2)
    keepRect = { x: kx0, y: ky0, w: keepW, h: keepH }
    cropMask = [
      { x: 0, y: cy0, w: image.width, h: ky0 - cy0 },
      { x: 0, y: ky0 + keepH, w: image.width, h: cy1 - ky0 - keepH },
      { x: cx0, y: 0, w: kx0 - cx0, h: image.height },
      { x: kx0 + keepW, y: 0, w: cx1 - kx0 - keepW, h: image.height },
    ].filter(r => r.w > 0 && r.h > 0)
  }

  /** 单条切线：水平线改上 / 下边距，垂直线改左 / 右边距 */
  const renderLine = (side: Side) => {
    if (!image)
      return null
    const horizontal = side === 'top' || side === 'bottom'
    const value = slice[side]
    // 线相对图片左上角的位置（显示 px）
    const pos = side === 'top'
      ? value * scale
      : side === 'bottom'
        ? (image.height - value) * scale
        : side === 'left'
          ? value * scale
          : (image.width - value) * scale
    const label = SIDES.find(s => s.side === side)!.label
    return (
      <div
        key={side}
        role="slider"
        tabIndex={0}
        aria-label={`${label}边距`}
        aria-valuemin={0}
        aria-valuemax={horizontal ? image.height : image.width}
        aria-valuenow={value}
        title={`${label}边距 ${value}px（拖拽或方向键微调）`}
        className={cn(
          'absolute touch-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          horizontal ? '-left-5 -right-5 h-5 -translate-y-1/2 cursor-ns-resize' : '-top-5 -bottom-5 w-5 -translate-x-1/2 cursor-ew-resize',
        )}
        style={horizontal ? { top: pos } : { left: pos }}
        onPointerDown={onLinePointerDown(side)}
        onPointerMove={onLinePointerMove}
        onPointerUp={onLinePointerEnd}
        onPointerCancel={onLinePointerEnd}
        onKeyDown={onLineKeyDown(side)}
      >
        <div
          className={cn(
            'absolute border-primary',
            horizontal
              ? 'inset-x-0 top-1/2 -translate-y-1/2 border-t-2 border-dashed'
              : 'inset-y-0 left-1/2 -translate-x-1/2 border-l-2 border-dashed',
          )}
        />
        <span
          className={cn(
            'absolute rounded-sm border-2 border-border bg-primary px-1 font-mono text-[10px] leading-4 font-bold text-primary-foreground shadow-hard-xs select-none',
            // 徽章骑在延长线的图外端点上（中心对齐线头），不遮挡图片
            horizontal ? 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2' : 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
          )}
        >
          {value}
        </span>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <Seo
        title="点九图工具"
        description="上传图片并拖动四条切线定义九宫格切片，实时预览 border-image 的拉伸 / 平铺效果，一键复制 CSS / SCSS / Less 代码，并可裁剪中心区域导出最小体积的 PNG，全部在浏览器本地完成。"
        path="/tools/nine-patch"
      />
      {/* 顶栏 */}
      <header className="flex h-24 items-center gap-3">
        <Button asChild variant="outline" size="icon">
          <Link to="/" aria-label="返回首页">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="flex size-10 items-center justify-center rounded-md border-2 border-border bg-chart-4 shadow-hard-xs">
          <Frame className="size-5 text-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight">点九图工具</h1>
          <p className="text-sm text-muted-foreground">拖动四条切线定义九宫格，实时预览 border-image 效果，导出 CSS 与裁剪后的最小 PNG</p>
        </div>
      </header>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        {/* 切片编辑 */}
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>切片编辑</CardTitle>
          </CardHeader>
          <CardContent className="min-w-0 pb-6">
            {/* 相对定位容器：悬浮按钮挂在滚动舞台外面，不随内容滚动 */}
            <div className="relative">
              <div
                ref={editorStageRef}
                {...editorPan.panHandlers}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={cn(
                  // 固定高度：overflow-auto 只在有确定高度时才裁剪，min-h 会被放大后的内容撑高
                  'flex h-72 touch-none overflow-hidden rounded-md border-2 p-6 transition-colors select-none',
                  editorPan.panning ? 'cursor-grabbing' : 'cursor-grab',
                  !image && 'border-dashed',
                  dragOver ? 'border-primary' : 'border-border',
                )}
                style={CHECKER_STYLE}
              >
                {image
                  ? (
                      <div
                        className="relative m-auto shrink-0 select-none"
                        style={{
                          width: image.width * scale,
                          height: image.height * scale,
                          transform: `translate(${editorPan.offset.x}px, ${editorPan.offset.y}px)`,
                        }}
                      >
                        <img
                          src={image.url}
                          alt={image.name}
                          width={image.width * scale}
                          height={image.height * scale}
                          draggable={false}
                          className="block"
                        />
                        {/* 裁剪预览：被裁行列盖斜纹遮罩，保留框描边；不拦截指针，切线照常可拖 */}
                        {cropMask && keepRect && (
                          <>
                            {cropMask.map(r => (
                              <div
                                key={`${r.x}-${r.y}`}
                                className="pointer-events-none absolute"
                                style={{ left: r.x * scale, top: r.y * scale, width: r.w * scale, height: r.h * scale, ...CROP_MASK_STYLE }}
                              />
                            ))}
                            <div
                              className="pointer-events-none absolute border-2 border-primary"
                              style={{ left: keepRect.x * scale, top: keepRect.y * scale, width: keepRect.w * scale, height: keepRect.h * scale }}
                            />
                          </>
                        )}
                        {SIDES.map(s => renderLine(s.side))}
                      </div>
                    )
                  : (
                      <div className="m-auto flex flex-col items-center gap-3 px-6 text-center">
                        <div className="flex size-12 items-center justify-center rounded-md border-2 border-border bg-chart-4 shadow-hard-xs -rotate-2">
                          <Frame className="size-6 text-foreground" />
                        </div>
                        <div>
                          <p className="font-bold">拖拽图片到此处，或</p>
                          <p className="mt-1 text-sm text-muted-foreground">PNG / SVG / WebP 均可，图片不出浏览器</p>
                        </div>
                        <Button type="button" onClick={() => fileInputRef.current?.click()}>
                          <ImagePlus />
                          选择图片
                        </Button>
                      </div>
                    )}
              </div>
              {/* 有图后：操作按钮悬浮在舞台右上角（与帧动画工具一致）；平移后出现「回到居中」 */}
              {image && (
                <div className="absolute top-2 right-2 flex gap-1.5">
                  {(editorPan.offset.x !== 0 || editorPan.offset.y !== 0 || zoom !== fitZoom(image.width, image.height)) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      title="重置视图（居中并恢复默认缩放）"
                      aria-label="重置视图"
                      onClick={() => {
                        editorPan.resetPan()
                        setZoom(fitZoom(image.width, image.height))
                      }}
                    >
                      <RotateCcw />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    title="更换图片"
                    aria-label="更换图片"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImagePlus />
                  </Button>
                </div>
              )}
            </div>
            {importError && (
              <p className="mt-3 flex items-center gap-1.5 text-sm text-destructive">
                <TriangleAlert className="size-4 shrink-0" />
                {importError}
              </p>
            )}
          </CardContent>
        </Card>

        {/* 实时预览 */}
        <Card>
          <CardHeader>
            <CardTitle>实时预览</CardTitle>
          </CardHeader>
          <CardContent className="pb-6">
            <div className="relative">
              <div
                ref={previewStageRef}
                {...previewPan.panHandlers}
                className={cn(
                  'flex h-72 touch-none overflow-hidden rounded-md border-2 border-border p-8 select-none',
                  previewPan.panning ? 'cursor-grabbing' : 'cursor-grab',
                )}
                style={CHECKER_STYLE}
              >
                {image
                  ? (
                    // 占位层按缩放后的尺寸撑开舞台居中区；内层 transform 缩放，origin 对齐左上
                      <div
                        className="m-auto shrink-0"
                        style={{
                          width: (previewSize.w + 24) * previewZoom,
                          height: (previewSize.h + 24) * previewZoom,
                          transform: `translate(${previewPan.offset.x}px, ${previewPan.offset.y}px)`,
                        }}
                      >
                        <div
                          style={{
                          // 必须收紧到内容尺寸：否则缩层自身（占位宽度）也被 scale 放大，居中位置翻倍偏移
                            width: previewSize.w + 24,
                            height: previewSize.h + 24,
                            transform: `scale(${previewZoom})`,
                            transformOrigin: '0 0',
                          }}
                        >
                          <div className="group/preview relative m-3" style={{ width: previewSize.w, height: previewSize.h }}>
                            <div
                              className="flex size-full items-center justify-center"
                              style={{
                                borderStyle: 'solid',
                                borderColor: 'transparent',
                                borderImageSource: `url("${image.url}")`,
                                borderImageSlice: sliceValue(codeParams),
                                borderImageWidth: widthValue(codeParams),
                                borderImageOutset: `${outset}px`,
                                borderImageRepeat: repeatValue(codeParams),
                              }}
                            >
                              <span className="rounded-sm bg-card px-2 py-0.5 text-xs font-bold text-card-foreground">
                                {previewSize.w}
                                {' × '}
                                {previewSize.h}
                              </span>
                            </div>
                            {/* 四边拖拽条 + 四角 L 形块：悬停预览框时一起显示 */}
                            {RESIZE_EDGES.map(({ edge, strip, bar, label }) => (
                              <div
                                key={edge}
                                title={label}
                                className={cn('absolute touch-none', strip)}
                                onPointerDown={onResizePointerDown(edge)}
                                onPointerMove={onResizePointerMove}
                                onPointerUp={onResizePointerEnd}
                                onPointerCancel={onResizePointerEnd}
                              >
                                <div className={cn('absolute rounded-full bg-primary opacity-0 transition-opacity group-hover/preview:opacity-100', bar)} />
                              </div>
                            ))}
                            {RESIZE_CORNERS.map(({ corner, hit, lShape, label }) => (
                              <div
                                key={corner}
                                role="slider"
                                tabIndex={0}
                                aria-label="调整预览框尺寸"
                                aria-valuetext={`${previewSize.w} × ${previewSize.h}`}
                                title={`${label}（方向键微调）`}
                                className={cn('absolute touch-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', hit)}
                                onPointerDown={onResizePointerDown(corner)}
                                onPointerMove={onResizePointerMove}
                                onPointerUp={onResizePointerEnd}
                                onPointerCancel={onResizePointerEnd}
                                onKeyDown={onResizeKeyDown}
                              >
                                <div className={cn('absolute size-3 border-primary opacity-0 transition-opacity group-hover/preview:opacity-100', lShape)} />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  : (
                      <p className="m-auto text-sm text-muted-foreground">先导入一张图片</p>
                    )}
              </div>
              {/* 平移 / 缩放后：悬浮「重置视图」 */}
              {(previewPan.offset.x !== 0 || previewPan.offset.y !== 0 || previewZoom !== 1) && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  title="重置视图（居中并恢复默认缩放）"
                  aria-label="重置视图"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    previewPan.resetPan()
                    setPreviewZoom(1)
                  }}
                >
                  <RotateCcw />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid min-w-0 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* 参数 */}
        <Card>
          <CardHeader>
            <CardTitle>参数</CardTitle>
            <CardAction>
              <Button type="button" variant="outline" size="icon-sm" title="重置切片" aria-label="重置切片" onClick={resetSlice} disabled={!image}>
                <RotateCcw />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pb-6">
            {/* 切片边距 */}
            <div>
              <p className="mb-1.5 text-xs font-bold text-muted-foreground">切片边距（px）</p>
              <div className="grid grid-cols-4 gap-1.5">
                {SIDES.map(({ side, label }) => (
                  <label key={side} className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="number"
                      min={0}
                      max={image ? (side === 'top' || side === 'bottom' ? image.height : image.width) : 0}
                      value={slice[side]}
                      disabled={!image}
                      onChange={e => setSliceValue(side, Number(e.target.value))}
                      aria-label={`${label}边距`}
                      className={NUM_INPUT_CLASS}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            {/* border-image-width：与切片边距同构的四边输入 */}
            <div>
              <p className="mb-1.5 flex items-center justify-between text-xs font-bold text-muted-foreground">
                边框宽度（border-image-width）
                <button
                  type="button"
                  role="switch"
                  aria-checked={linkWidth}
                  aria-label="绑定边框宽度与切片"
                  title={linkWidth ? '已绑定：宽度跟随切片边距（点击解绑）' : '已解绑：可独立调整宽度（点击绑定）'}
                  onClick={() => setLinkWidth(v => !v)}
                  className={cn(
                    'flex size-5 items-center justify-center rounded-sm border-2 border-border shadow-hard-xs transition-all outline-none',
                    'hover:-translate-x-px hover:-translate-y-px hover:shadow-hard-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
                    'focus-visible:ring-[3px] focus-visible:ring-ring/50',
                    linkWidth ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground',
                  )}
                >
                  {linkWidth ? <Link2 className="size-3" /> : <Link2Off className="size-3" />}
                </button>
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {SIDES.map(({ side, label }) => (
                  <label key={side} className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={linkWidth ? slice[side] : imageWidth[side]}
                      disabled={linkWidth}
                      onChange={e => setImageWidthValue(side, Number(e.target.value))}
                      aria-label={`边框宽度${label}`}
                      className={cn(NUM_INPUT_CLASS, 'disabled:cursor-not-allowed disabled:opacity-60')}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            {/* 外扩 + 填充：同一行；勾选框包一层与输入框等高（h-8）的居中容器，保证水平对齐 */}
            <div className="flex items-end justify-between gap-3">
              <label className="flex w-24 shrink-0 flex-col gap-1 text-xs text-muted-foreground">
                <span className="font-bold">外扩 outset</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={outset}
                  onChange={e => setOutset(Math.min(100, Math.max(0, Math.round(Number(e.target.value) || 0))))}
                  className={NUM_INPUT_CLASS}
                />
              </label>
              <div className="flex h-8 items-center">
                <BrutalCheckbox
                  checked={fill}
                  onChange={setFill}
                  label="填充中心（fill）"
                  title="开启后中心切片会绘制在内容区背景上"
                />
              </div>
            </div>
            {/* 重复方式 */}
            <div>
              <p className="mb-1.5 text-xs font-bold text-muted-foreground">横向重复</p>
              <OptionGroup
                label="横向重复方式"
                value={repeatH}
                onChange={setRepeatH}
                options={(['stretch', 'repeat', 'round', 'space'] as RepeatMode[]).map(m => ({ value: m, label: m }))}
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-bold text-muted-foreground">纵向重复</p>
              <OptionGroup
                label="纵向重复方式"
                value={repeatV}
                onChange={setRepeatV}
                options={(['stretch', 'repeat', 'round', 'space'] as RepeatMode[]).map(m => ({ value: m, label: m }))}
              />
            </div>
            {/* 中心裁剪：导出更小体积的 PNG，不改任何 CSS 值 */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-bold text-muted-foreground">中心裁剪</p>
                <BrutalCheckbox
                  checked={cropEnabled}
                  onChange={setCropEnabled}
                  title="删除中心可拉伸区域的多余行列，导出更小体积的 PNG，CSS 无需修改"
                />
              </div>
              {cropEnabled
                ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-end gap-2">
                        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
                          保留宽（px）
                          <input
                            type="number"
                            min={1}
                            max={Math.max(1, centerW)}
                            value={keepW}
                            disabled={!image}
                            onChange={e => setCropKeepValue('w', Number(e.target.value))}
                            aria-label="中心保留宽"
                            className={NUM_INPUT_CLASS}
                          />
                        </label>
                        <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
                          保留高（px）
                          <input
                            type="number"
                            min={1}
                            max={Math.max(1, centerH)}
                            value={keepH}
                            disabled={!image}
                            onChange={e => setCropKeepValue('h', Number(e.target.value))}
                            aria-label="中心保留高"
                            className={NUM_INPUT_CLASS}
                          />
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!image || (keepW === 1 && keepH === 1)}
                          onClick={() => setCropKeep({ w: 1, h: 1 })}
                        >
                          裁到最小
                        </Button>
                      </div>
                      {(repeatH !== 'stretch' || repeatV !== 'stretch') && (
                        <p className="flex items-start gap-1.5 text-xs text-destructive">
                          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                          平铺模式下裁剪会改变平铺单元，渲染效果将发生变化
                        </p>
                      )}
                      <Button type="button" variant="outline" size="sm" disabled={!cropActive} onClick={downloadCropped}>
                        <Download />
                        {cropActive ? `下载裁剪图（${croppedW} × ${croppedH}）` : '下载裁剪图'}
                      </Button>
                    </div>
                  )
                : (
                    <p className="text-xs text-muted-foreground">删除中心多余行列得到最小图，CSS 代码无需修改</p>
                  )}
            </div>
          </CardContent>
        </Card>

        {/* 样式代码 */}
        <Card>
          <CardHeader>
            <CardTitle>样式代码</CardTitle>
            <CardDescription>
              {'把代码里的 '}
              <code className="font-mono">{EXPORT_IMAGE_NAME}</code>
              {' 换成你的图片路径即可使用'}
            </CardDescription>
            <CardAction>
              <Button type="button" variant="outline" size="sm" onClick={copyCode}>
                {copied ? <Check /> : <Copy />}
                {copied ? '已复制' : '复制'}
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pb-6">
            <div className="grid grid-cols-2 gap-2">
              <OptionGroup
                label="代码格式"
                value={codeFormat}
                onChange={setCodeFormat}
                options={(['scss', 'less', 'css'] as CodeFormat[]).map(f => ({
                  value: f,
                  label: f.toUpperCase(),
                }))}
              />
              <OptionGroup
                label="代码写法"
                value={codeStyle}
                onChange={setCodeStyle}
                options={[
                  { value: 'longhand' as CodeStyle, label: '分开写' },
                  { value: 'shorthand' as CodeStyle, label: '简写' },
                ]}
              />
            </div>
            <pre
              tabIndex={0}
              onKeyDown={selectCodeOnShortcut}
              className="overflow-auto rounded-md border-2 border-border bg-muted p-3 font-mono text-xs leading-5 whitespace-pre outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {exportText}
            </pre>
          </CardContent>
        </Card>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={onFileChange} />
    </div>
  )
}
