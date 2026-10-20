import type { LucideIcon } from 'lucide-react'
import type { ChangeEvent, DragEvent, KeyboardEvent as ReactKeyboardEvent, ReactNode, PointerEvent as ReactPointerEvent } from 'react'
import type { Slice } from './nine-slice'
import type { NinePatchRecordMeta } from './records'
import type { Side } from './slice-bounds'

import {
  Check,
  CircleHelp,
  Copy,
  Download,
  Frame,
  ImagePlus,
  Link2,
  Link2Off,
  RotateCcw,
  Save,
  ScanLine,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Seo } from '@/components/seo'
import { STAGE_BOUNDARY_CLASS, StageViewControls, useStageViewSettings } from '@/components/stage-view-controls'
import { StageZoomIndicator } from '@/components/stage-zoom-indicator'
import { Button } from '@/components/ui/button'
import { useAutoFitZoom, useStageFitScale, useStagePan, useStageZoom } from '@/lib/stage'
import { cn } from '@/lib/utils'
import { createDemoImage } from '../demos/nine-patch'
import { analyzeNineSlice, readImagePixels } from './nine-slice'
import { NinePreviewHud } from './preview-hud'
import { createNinePatchItem, useNinePatchRecords } from './records'
import { maxSliceValue, normalizeSlice, updateSlice } from './slice-bounds'
import './workspace.scss'

interface SourceImage {
  name: string
  blob: Blob
  url: string
  width: number
  height: number
}

type RepeatMode = 'stretch' | 'repeat' | 'round' | 'space'

type CropAxes = 'both' | 'x' | 'y'

const CROP_AXES_OPTIONS: { value: CropAxes, label: string }[] = [
  { value: 'both', label: '两轴' },
  { value: 'x', label: '仅 X' },
  { value: 'y', label: '仅 Y' },
]

const SIDES: { side: Side, label: string, lineClass: string, badgeClass: string }[] = [
  { side: 'top', label: '上', lineClass: 'border-chart-1', badgeClass: 'border-chart-1 text-chart-1' },
  { side: 'right', label: '右', lineClass: 'border-chart-2', badgeClass: 'border-chart-2 text-chart-2' },
  { side: 'bottom', label: '下', lineClass: 'border-chart-3', badgeClass: 'border-chart-3 text-chart-3' },
  { side: 'left', label: '左', lineClass: 'border-chart-4', badgeClass: 'border-chart-4 text-chart-4' },
]

const EXPORT_IMAGE_NAME = 'YOUR-IMAGE-PATH.EXT'

function loadImageBlob(name: string, blob: Blob): Promise<SourceImage | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => resolve({ name, blob, url, width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    img.src = url
  })
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, encoded] = dataUrl.split(',', 2)
  const mime = header.match(/^data:([^;]+)/)?.[1] ?? 'application/octet-stream'
  const binary = atob(encoded ?? '')
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0))
  return new Blob([bytes], { type: mime })
}

function defaultSlice(width: number, height: number): Slice {
  const shortest = Math.min(width, height)
  const s = Math.min(Math.floor(shortest / 2), Math.max(1, Math.round(shortest / 4)))
  return { top: s, right: s, bottom: s, left: s }
}

function restoreRecordMeta(meta: Record<string, unknown>, image: SourceImage): NinePatchRecordMeta {
  const defaults = defaultSlice(image.width, image.height)
  const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
  const number = (value: unknown, fallback: number, max: number, min = 0): number => typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback
  const sides = (value: unknown, fallback: Slice, max: number): Slice => {
    const source = object(value)
    const edge = (side: Side) => number(source[side], Math.min(max, fallback[side]), max)
    return { top: edge('top'), right: edge('right'), bottom: edge('bottom'), left: edge('left') }
  }
  const slice = normalizeSlice(sides(meta.slice, defaults, Math.max(image.width, image.height)), image)
  const crop = object(meta.cropKeep)
  const repeat = (value: unknown): RepeatMode => value === 'repeat' || value === 'round' || value === 'space' ? value : 'stretch'
  return {
    name: typeof meta.name === 'string' ? meta.name.trim() : '',
    imageName: image.name,
    width: image.width,
    height: image.height,
    slice,
    imageWidth: sides(meta.imageWidth, defaults, 200),
    outset: number(meta.outset, 0, 100),
    fill: typeof meta.fill === 'boolean' ? meta.fill : true,
    linkWidth: typeof meta.linkWidth === 'boolean' ? meta.linkWidth : true,
    repeatH: repeat(meta.repeatH),
    repeatV: repeat(meta.repeatV),
    cropEnabled: typeof meta.cropEnabled === 'boolean' ? meta.cropEnabled : false,
    cropKeep: {
      w: number(crop.w, 1, Math.max(1, image.width - slice.left - slice.right), 1),
      h: number(crop.h, 1, Math.max(1, image.height - slice.top - slice.bottom), 1),
    },
    cropAxes: meta.cropAxes === 'x' || meta.cropAxes === 'y' ? meta.cropAxes : 'both',
    codeFormat: 'css',
    codeStyle: meta.codeStyle === 'shorthand' ? 'shorthand' : 'longhand',
  }
}

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

  imageWidth: Slice

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

function widthValue(p: CodeParams): string {
  const w = p.linkWidth ? p.slice : p.imageWidth
  return collapse4(w.top, w.right, w.bottom, w.left, 'px')
}

type CodeStyle = 'longhand' | 'shorthand'

function buildCode(style: CodeStyle, p: CodeParams): string {
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

const NUM_INPUT_CLASS = 'w-full rounded-md border border-border bg-background px-1.5 py-1 text-center font-mono text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

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
        aria-label={typeof label === 'string' ? label : title}
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-sm border border-border transition-colors',
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

const CROP_MASK_STYLE = {
  backgroundColor: 'color-mix(in srgb, var(--foreground) 12%, transparent)',
  backgroundImage: [
    'repeating-linear-gradient(45deg, color-mix(in srgb, var(--foreground) 45%, transparent) 0 4px, transparent 4px 8px)',
    'repeating-linear-gradient(-45deg, color-mix(in srgb, var(--background) 60%, transparent) 0 4px, transparent 4px 8px)',
  ].join(', '),
} as const

const NINE_PATCH_BOUNDARY_CLASS = cn(STAGE_BOUNDARY_CLASS, 'outline-1 -outline-offset-1')
const SIZE_LABEL_CLASS = 'pointer-events-none absolute -top-1 left-0 -translate-y-full font-mono text-xs whitespace-nowrap text-muted-foreground'

type ResizeEdge = 'left' | 'right' | 'top' | 'bottom'
type ResizeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const RESIZE_EDGES: { edge: ResizeEdge, strip: string, bar: string, label: string }[] = [
  { edge: 'right', strip: 'top-0 bottom-0 -right-2 w-4 cursor-ew-resize', bar: 'top-1/2 left-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2', label: '拖动调整宽度' },
  { edge: 'left', strip: 'top-0 bottom-0 -left-2 w-4 cursor-ew-resize', bar: 'top-1/2 left-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2', label: '拖动调整宽度' },
  { edge: 'bottom', strip: 'left-0 right-0 -bottom-2 h-4 cursor-ns-resize', bar: 'top-1/2 left-1/2 h-0.5 w-5 -translate-x-1/2 -translate-y-1/2', label: '拖动调整高度' },
  { edge: 'top', strip: 'left-0 right-0 -top-2 h-4 cursor-ns-resize', bar: 'top-1/2 left-1/2 h-0.5 w-5 -translate-x-1/2 -translate-y-1/2', label: '拖动调整高度' },
]

const RESIZE_CORNERS: { corner: ResizeCorner, hit: string, lShape: string, label: string }[] = [
  { corner: 'top-left', hit: '-top-2 -left-2 size-5 cursor-nwse-resize', lShape: 'top-2 left-2 border-t-2 border-l-2 rounded-tl-sm', label: '拖动调整尺寸' },
  { corner: 'top-right', hit: '-top-2 -right-2 size-5 cursor-nesw-resize', lShape: 'top-2 right-2 border-t-2 border-r-2 rounded-tr-sm', label: '拖动调整尺寸' },
  { corner: 'bottom-left', hit: '-bottom-2 -left-2 size-5 cursor-nesw-resize', lShape: 'bottom-2 left-2 border-b-2 border-l-2 rounded-bl-sm', label: '拖动调整尺寸' },
  { corner: 'bottom-right', hit: '-bottom-2 -right-2 size-5 cursor-nwse-resize', lShape: 'bottom-2 right-2 border-r-2 border-b-2 rounded-br-sm', label: '拖动调整尺寸' },
]

export default function NinePatchTool() {
  const [mobileView, setMobileView] = useState<'editor' | 'preview' | 'params'>('editor')
  const [panelTab, setPanelTab] = useState<'params' | 'code' | 'records'>('params')
  const sourceFitRef = useRef<HTMLDivElement>(null)
  const [image, setImage] = useState<SourceImage | null>(null)
  const [recordName, setRecordName] = useState('')
  const [recordInfo, setRecordInfo] = useState<{ ok: boolean, text: string } | null>(null)
  const requestRef = useRef(0)
  const detectRequestRef = useRef(0)
  const detectBusyRef = useRef(false)
  const exportRef = useRef<{ key: string, revision: number } | null>(null)
  const [exportState, setExportState] = useState<{ key: string, revision: number, busy: boolean, info: { ok: boolean, text: string } | null } | null>(null)
  const { records, save: saveRecordItem, get: getRecordItem, remove: removeRecordItem } = useNinePatchRecords()
  const [slice, setSlice] = useState<Slice>({ top: 24, right: 24, bottom: 24, left: 24 })

  const [imageWidth, setImageWidth] = useState<Slice>({ top: 24, right: 24, bottom: 24, left: 24 })
  const [outset, setOutset] = useState(0)
  const [fill, setFill] = useState(true)
  const [linkWidth, setLinkWidth] = useState(true)
  const [repeatH, setRepeatH] = useState<RepeatMode>('stretch')
  const [repeatV, setRepeatV] = useState<RepeatMode>('stretch')

  const [dragOver, setDragOver] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const [previewSize, setPreviewSize] = useState({ w: 320, h: 180 })

  const [resizeOffset, setResizeOffset] = useState({ x: 0, y: 0 })
  const [codeStyle, setCodeStyle] = useState<CodeStyle>('longhand')
  const [copyFeedback, setCopyFeedback] = useState<{ text: string, ok: boolean } | null>(null)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const copyRequestRef = useRef(0)
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)

  const [cropEnabled, setCropEnabled] = useState(false)

  const [cropKeep, setCropKeep] = useState({ w: 1, h: 1 })

  const [cropAxes, setCropAxes] = useState<CropAxes>('both')

  const [detecting, setDetecting] = useState(false)
  const [detectInfo, setDetectInfo] = useState<{ tone: 'success' | 'warning' | 'error', text: string } | null>(null)

  const exportKey = JSON.stringify([image?.url, slice, cropEnabled, cropKeep, cropAxes])
  const exportKeyRef = useRef(exportKey)
  const exportRevisionRef = useRef(0)
  if (exportKeyRef.current !== exportKey) {
    exportKeyRef.current = exportKey
    exportRevisionRef.current++
  }
  const exporting = exportState?.revision === exportRevisionRef.current && exportState.busy
  const exportInfo = exportState?.revision === exportRevisionRef.current ? exportState.info : null

  const invalidateAnalysis = useCallback(() => {
    detectRequestRef.current++
    detectBusyRef.current = false
    setDetecting(false)
    setDetectInfo(null)
  }, [])

  const invalidateImageWork = useCallback(() => {
    invalidateAnalysis()
    exportRef.current = null
    setExportState(null)
  }, [invalidateAnalysis])

  const changeCropEnabled = (value: boolean) => {
    invalidateAnalysis()
    setCropEnabled(value)
  }
  const changeCropAxes = (value: CropAxes) => {
    invalidateAnalysis()
    setCropAxes(value)
  }

  const makeRecordMeta = useCallback((): NinePatchRecordMeta | null => {
    if (!image)
      return null
    return {
      name: recordName.trim() || image.name,
      imageName: image.name,
      width: image.width,
      height: image.height,
      slice,
      imageWidth,
      outset,
      fill,
      linkWidth,
      repeatH,
      repeatV,
      cropEnabled,
      cropKeep,
      cropAxes,
      codeFormat: 'css',
      codeStyle,
    }
  }, [codeStyle, cropAxes, cropEnabled, cropKeep, fill, image, imageWidth, linkWidth, outset, recordName, repeatH, repeatV, slice])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const editorStageRef = useRef<HTMLDivElement>(null)
  const previewStageRef = useRef<HTMLDivElement>(null)
  const editorStageView = useStageViewSettings()

  const lineDragRef = useRef<{ pointerId: number, owner: HTMLElement, side: Side, startClient: number, startValue: number, startZoom: number } | null>(null)

  const resizeDragRef = useRef<{
    pointerId: number
    owner: HTMLElement
    edge: ResizeEdge | ResizeCorner
    startX: number
    startY: number
    baseW: number
    baseH: number
    startZoom: number
    boxEl: HTMLElement
    anchorX: { side: 'left' | 'right', pos: number } | null
    anchorY: { side: 'top' | 'bottom', pos: number } | null
  } | null>(null)

  const imageRef = useRef<SourceImage | null>(null)
  imageRef.current = image

  const editorFit = useStageFitScale(sourceFitRef, image?.width ?? 0, image?.height ?? 0, Boolean(image), 32)
  const [zoom, setZoom, resetEditorZoom] = useAutoFitZoom(editorFit, image?.url ?? null)
  const previewFit = useStageFitScale(previewStageRef, previewSize.w + 24, previewSize.h + 24, Boolean(image), 40)
  const [previewZoom, setPreviewZoom, resetPreviewZoom] = useAutoFitZoom(previewFit, image?.url ?? null)
  const editorStageZoom = useStageZoom(editorStageRef, zoom, setZoom, Boolean(image))
  const previewStageZoom = useStageZoom(previewStageRef, previewZoom, setPreviewZoom, Boolean(image))
  const editorPan = useStagePan(editorStageRef, () => lineDragRef.current !== null)
  const previewPan = useStagePan(previewStageRef, () => resizeDragRef.current !== null)

  const resetGestures = useCallback(() => {
    for (const ref of [lineDragRef, resizeDragRef]) {
      const active = ref.current
      ref.current = null
      if (active?.owner.hasPointerCapture(active.pointerId))
        active.owner.releasePointerCapture(active.pointerId)
    }
  }, [])

  const { resetPan: resetEditorPan } = editorPan
  const { resetPan: resetPreviewPan } = previewPan

  const applyImage = useCallback((img: SourceImage) => {
    invalidateImageWork()
    setRecordInfo(null)
    setRecordName('')
    resetGestures()
    resetEditorPan()
    resetPreviewPan()
    setResizeOffset({ x: 0, y: 0 })
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

    setCropEnabled(false)
    setCropKeep({ w: 1, h: 1 })
    setCropAxes('both')
  }, [resetEditorPan, resetPreviewPan, resetGestures, invalidateImageWork])

  const saveRecord = useCallback(async () => {
    if (!image || savingRef.current)
      return
    const meta = makeRecordMeta()
    if (!meta)
      return
    const request = requestRef.current
    savingRef.current = true
    setSaving(true)
    setRecordInfo(null)
    try {
      await saveRecordItem(createNinePatchItem(crypto.randomUUID(), image.blob, meta))
      if (request === requestRef.current)
        setRecordInfo({ ok: true, text: '记录已保存' })
    }
    catch {
      if (request === requestRef.current)
        setRecordInfo({ ok: false, text: '记录保存失败，请重试' })
    }
    finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [image, makeRecordMeta, saveRecordItem])

  const loadRecord = useCallback(async (id: string) => {
    const request = ++requestRef.current
    invalidateImageWork()
    setRecordInfo(null)
    try {
      const item = await getRecordItem(id)
      if (request !== requestRef.current)
        return
      if (!item || !(item.payload instanceof Blob)) {
        setRecordInfo({ ok: false, text: '记录图片不可用，请重试或选择其他记录' })
        return
      }
      const name = typeof item.meta.imageName === 'string' && item.meta.imageName.trim() ? item.meta.imageName : 'image'
      const bytes = await item.payload.arrayBuffer()
      if (request !== requestRef.current)
        return
      const source = new Blob([bytes], { type: item.payload.type })
      const loaded = await loadImageBlob(name, source)
      if (request !== requestRef.current) {
        if (loaded)
          URL.revokeObjectURL(loaded.url)
        return
      }
      if (!loaded) {
        setRecordInfo({ ok: false, text: '记录图片解码失败，请重试或选择其他记录' })
        return
      }
      const meta = restoreRecordMeta(item.meta, loaded)
      applyImage(loaded)
      setRecordName(meta.name)
      setSlice(meta.slice)
      setImageWidth(meta.imageWidth)
      setOutset(meta.outset)
      setFill(meta.fill)
      setLinkWidth(meta.linkWidth)
      setRepeatH(meta.repeatH)
      setRepeatV(meta.repeatV)
      setCropEnabled(meta.cropEnabled)
      setCropKeep(meta.cropKeep)
      setCropAxes(meta.cropAxes)
      setCodeStyle(meta.codeStyle)
      setRecordInfo({ ok: true, text: '记录已加载' })
    }
    catch {
      if (request === requestRef.current)
        setRecordInfo({ ok: false, text: '记录加载失败，请重试' })
    }
  }, [applyImage, getRecordItem, invalidateImageWork])

  const deleteRecord = useCallback(async (id: string) => {
    setRecordInfo(null)
    try {
      await removeRecordItem(id)
      setRecordInfo({ ok: true, text: '记录已删除' })
    }
    catch {
      setRecordInfo({ ok: false, text: '记录删除失败，请重试' })
    }
  }, [removeRecordItem])

  const importBlob = useCallback(async (name: string, blob: Blob) => {
    const request = ++requestRef.current
    invalidateImageWork()
    if (!blob.type.startsWith('image/')) {
      setImportError('请选择图片文件')
      return
    }
    const loaded = await loadImageBlob(name, blob)
    if (request !== requestRef.current) {
      if (loaded)
        URL.revokeObjectURL(loaded.url)
      return
    }
    if (loaded)
      applyImage(loaded)
    else
      setImportError('图片解码失败，换一张试试')
  }, [applyImage, invalidateImageWork])

  const loadDemo = useCallback(() => {
    const demo = createDemoImage()
    if (demo)
      void importBlob(demo.name, dataUrlToBlob(demo.url))
  }, [importBlob])

  const clearImage = useCallback(() => {
    requestRef.current++
    invalidateImageWork()
    resetGestures()
    setRecordInfo(null)
    setRecordName('')
    setImage((prev) => {
      if (prev && prev.url.startsWith('blob:'))
        URL.revokeObjectURL(prev.url)
      return null
    })
    setImportError(null)

    setCropEnabled(false)
    setCropKeep({ w: 1, h: 1 })
    setCropAxes('both')
  }, [resetGestures, invalidateImageWork])

  useEffect(() => () => {
    requestRef.current++
    detectRequestRef.current++
    exportRef.current = null
    resetGestures()
    copyRequestRef.current++
    if (copyTimerRef.current !== null)
      clearTimeout(copyTimerRef.current)
    const img = imageRef.current
    if (img && img.url.startsWith('blob:'))
      URL.revokeObjectURL(img.url)
  }, [resetGestures])

  const onFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file)
      void importBlob(file.name, file)
  }, [importBlob])

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file)
      void importBlob(file.name, file)
  }, [importBlob])

  const setSliceValue = useCallback((side: Side, value: number) => {
    if (!image)
      return
    invalidateAnalysis()
    setSlice(prev => updateSlice(side, value, prev, image))
  }, [image, invalidateAnalysis])

  const setImageWidthValue = useCallback((side: Side, value: number) => {
    invalidateAnalysis()
    const v = Math.min(200, Math.max(0, Math.round(value) || 0))
    setImageWidth(prev => ({ ...prev, [side]: v }))
  }, [invalidateAnalysis])

  const scale = zoom

  const onLinePointerDown = useCallback((side: Side) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !e.isPrimary || !image || lineDragRef.current)
      return
    e.preventDefault()
    lineDragRef.current = {
      pointerId: e.pointerId,
      owner: e.currentTarget,
      startZoom: zoom,
      side,
      startClient: side === 'top' || side === 'bottom' ? e.clientY : e.clientX,
      startValue: slice[side],
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [image, slice, zoom])

  const onLinePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = lineDragRef.current
    if (!drag || drag.pointerId !== e.pointerId)
      return
    const client = drag.side === 'top' || drag.side === 'bottom' ? e.clientY : e.clientX

    const sign = drag.side === 'bottom' || drag.side === 'right' ? -1 : 1
    setSliceValue(drag.side, drag.startValue + sign * (client - drag.startClient) / drag.startZoom)
  }, [setSliceValue])

  const onLinePointerEnd = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const active = lineDragRef.current
    if (!active || active.pointerId !== e.pointerId)
      return
    lineDragRef.current = null
    if (active.owner.hasPointerCapture(active.pointerId))
      active.owner.releasePointerCapture(active.pointerId)
  }, [])

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
    invalidateAnalysis()
    setSlice(defaultSlice(image.width, image.height))
  }, [image, invalidateAnalysis])

  const autoDetect = useCallback(async () => {
    if (!image || detectBusyRef.current)
      return
    detectBusyRef.current = true
    const request = ++detectRequestRef.current
    setDetecting(true)
    setDetectInfo(null)
    try {
      await new Promise(resolve => setTimeout(resolve, 50))
      const pixels = await readImagePixels(image.blob)
      if (request !== detectRequestRef.current)
        return
      const result = analyzeNineSlice(pixels)
      const { crop, slice: s } = result
      const next = normalizeSlice({
        top: crop.y + s.top,
        right: image.width - crop.x - crop.width + s.right,
        bottom: image.height - crop.y - crop.height + s.bottom,
        left: crop.x + s.left,
      }, image)
      setSlice(next)
      setImageWidth({
        top: Math.min(200, next.top),
        right: Math.min(200, next.right),
        bottom: Math.min(200, next.bottom),
        left: Math.min(200, next.left),
      })

      setCropEnabled(true)
      setCropAxes('both')
      setCropKeep({
        w: Math.min(Math.max(1, image.width - next.left - next.right), Math.max(1, result.compact.width - s.left - s.right)),
        h: Math.min(Math.max(1, image.height - next.top - next.bottom), Math.max(1, result.compact.height - s.top - s.bottom)),
      })
      setDetectInfo(result.accepted
        ? { tone: 'success', text: `已应用识别结果，检查了 ${result.candidatesEvaluated} 个候选${crop.width !== image.width || crop.height !== image.height ? '，已补偿透明留白' : ''}` }
        : {
            tone: 'warning',
            text: '未找到满足误差阈值的最小切片，已应用最接近的候选，请手动微调切线',
          })
    }
    catch (error) {
      if (request === detectRequestRef.current)
        setDetectInfo({ tone: 'error', text: error instanceof Error ? error.message : '识别失败' })
    }
    finally {
      if (request === detectRequestRef.current) {
        detectBusyRef.current = false
        setDetecting(false)
      }
    }
  }, [image])

  const centerW = image ? Math.max(0, image.width - slice.left - slice.right) : 0
  const centerH = image ? Math.max(0, image.height - slice.top - slice.bottom) : 0

  const keepW = cropAxes === 'y' ? Math.max(1, centerW) : Math.min(cropKeep.w, Math.max(1, centerW))
  const keepH = cropAxes === 'x' ? Math.max(1, centerH) : Math.min(cropKeep.h, Math.max(1, centerH))

  const croppedW = slice.left + keepW + slice.right
  const croppedH = slice.top + keepH + slice.bottom

  const cropActive = cropEnabled && image !== null && centerW > 0 && centerH > 0 && (keepW < centerW || keepH < centerH)

  const setCropKeepValue = useCallback((axis: 'w' | 'h', value: number) => {
    invalidateAnalysis()
    const max = axis === 'w' ? centerW : centerH
    setCropKeep(prev => ({ ...prev, [axis]: Math.min(Math.max(1, max), Math.max(1, Math.round(value) || 1)) }))
  }, [centerW, centerH, invalidateAnalysis])

  const downloadCropped = useCallback(async () => {
    if (!image || !cropActive || (exportRef.current?.key === exportKeyRef.current && exportRef.current.revision === exportRevisionRef.current))
      return
    const task = { key: exportKeyRef.current, revision: exportRevisionRef.current }
    exportRef.current = task
    setExportState({ ...task, busy: true, info: null })
    const current = () => exportRef.current === task && exportRevisionRef.current === task.revision
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image()
        element.onload = () => resolve(element)
        element.onerror = () => reject(new Error('图片解码失败，请重试'))
        element.src = image.url
      })
      if (!current())
        return
      const canvas = document.createElement('canvas')
      canvas.width = croppedW
      canvas.height = croppedH
      const ctx = canvas.getContext('2d')
      if (!ctx)
        throw new Error('Canvas 2D 不可用，请重试')
      const kx = slice.left + Math.floor((centerW - keepW) / 2)
      const ky = slice.top + Math.floor((centerH - keepH) / 2)

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
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG 编码失败，请重试')), 'image/png')
      })
      if (!current())
        return
      const url = URL.createObjectURL(blob)
      try {
        const a = document.createElement('a')
        a.href = url
        a.download = `${image.name.replace(/\.[^.]+$/, '') || 'nine-patch'}-cropped.png`
        a.click()
        setExportState({ ...task, busy: false, info: { ok: true, text: '裁剪 PNG 已导出' } })
      }
      finally {
        setTimeout(() => URL.revokeObjectURL(url), 10_000)
      }
    }
    catch (error) {
      if (current())
        setExportState({ ...task, busy: false, info: { ok: false, text: error instanceof Error ? error.message : 'PNG 导出失败，请重试' } })
    }
    finally {
      if (exportRef.current === task) {
        exportRef.current = null
        setExportState(prev => prev?.revision === task.revision ? { ...prev, busy: false } : prev)
      }
    }
  }, [image, cropActive, slice, centerW, centerH, keepW, keepH, croppedW, croppedH])

  const anchorFor = (edge: ResizeEdge | ResizeCorner, rect: DOMRect) => ({
    anchorX: edge === 'right' || edge === 'top-right' || edge === 'bottom-right'
      ? { side: 'left' as const, pos: rect.left }
      : edge === 'left' || edge === 'top-left' || edge === 'bottom-left'
        ? { side: 'right' as const, pos: rect.right }
        : null,
    anchorY: edge === 'bottom' || edge === 'bottom-left' || edge === 'bottom-right'
      ? { side: 'top' as const, pos: rect.top }
      : edge === 'top' || edge === 'top-left' || edge === 'top-right'
        ? { side: 'bottom' as const, pos: rect.bottom }
        : null,
  })

  const onResizePointerDown = useCallback((edge: ResizeEdge | ResizeCorner) => (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !e.isPrimary || resizeDragRef.current)
      return
    e.preventDefault()

    setPreviewZoom(z => z)

    const boxEl = e.currentTarget.parentElement as HTMLElement
    const { anchorX, anchorY } = anchorFor(edge, boxEl.getBoundingClientRect())
    resizeDragRef.current = {
      pointerId: e.pointerId,
      owner: e.currentTarget,
      edge,
      startX: e.clientX,
      startY: e.clientY,
      baseW: previewSize.w,
      baseH: previewSize.h,
      startZoom: previewZoom,
      boxEl,
      anchorX,
      anchorY,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [previewSize, previewZoom, setPreviewZoom])

  const clampPreview = (w: number, h: number) => ({
    w: Math.min(720, Math.max(96, Math.round(w))),
    h: Math.min(480, Math.max(64, Math.round(h))),
  })

  const onResizePointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = resizeDragRef.current
    if (!drag || drag.pointerId !== e.pointerId)
      return

    const dx = (e.clientX - drag.startX) / drag.startZoom
    const dy = (e.clientY - drag.startY) / drag.startZoom
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

    // eslint-disable-next-line react/dom-no-flush-sync
    flushSync(() => setPreviewSize(clampPreview(w, h)))
    const rect = drag.boxEl.getBoundingClientRect()
    const cx = drag.anchorX ? (drag.anchorX.side === 'left' ? rect.left : rect.right) - drag.anchorX.pos : 0
    const cy = drag.anchorY ? (drag.anchorY.side === 'top' ? rect.top : rect.bottom) - drag.anchorY.pos : 0
    if (cx !== 0 || cy !== 0) {
      // eslint-disable-next-line react/dom-no-flush-sync
      flushSync(() => setResizeOffset(prev => ({ x: prev.x - cx, y: prev.y - cy })))
    }
  }, [])

  const onResizePointerEnd = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    const active = resizeDragRef.current
    if (!active || active.pointerId !== e.pointerId)
      return
    resizeDragRef.current = null
    if (active.owner.hasPointerCapture(active.pointerId))
      active.owner.releasePointerCapture(active.pointerId)
  }, [])

  const onResizeKeyDown = useCallback((edge: ResizeCorner) => (e: ReactKeyboardEvent<HTMLDivElement>) => {
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
    setPreviewZoom(z => z)
    const boxEl = e.currentTarget.parentElement!
    const { anchorX, anchorY } = anchorFor(edge, boxEl.getBoundingClientRect())
    // eslint-disable-next-line react/dom-no-flush-sync
    flushSync(() => setPreviewSize(prev => clampPreview(prev.w + dw, prev.h + dh)))
    const rect = boxEl.getBoundingClientRect()
    const dx = anchorX ? (anchorX.side === 'left' ? rect.left : rect.right) - anchorX.pos : 0
    const dy = anchorY ? (anchorY.side === 'top' ? rect.top : rect.bottom) - anchorY.pos : 0
    setResizeOffset(prev => ({ x: prev.x - dx, y: prev.y - dy }))
  }, [setPreviewZoom])

  const codeParams: CodeParams = { slice, imageWidth, linkWidth, outset, fill, repeatH, repeatV }
  const exportText = buildCode(codeStyle, codeParams)

  const copied = copyFeedback?.ok === true && copyFeedback.text === exportText
  const copyError = copyFeedback?.ok === false && copyFeedback.text === exportText

  useEffect(() => {
    copyRequestRef.current++
  }, [exportText])

  const copyCode = useCallback(async () => {
    const request = ++copyRequestRef.current
    setCopyFeedback(null)
    if (copyTimerRef.current !== null)
      clearTimeout(copyTimerRef.current)
    try {
      await navigator.clipboard.writeText(exportText)
      if (request === copyRequestRef.current) {
        setCopyFeedback({ text: exportText, ok: true })
        copyTimerRef.current = setTimeout(setCopyFeedback, 1200, null)
      }
    }
    catch {
      if (request === copyRequestRef.current)
        setCopyFeedback({ text: exportText, ok: false })
    }
  }, [exportText])

  let cropMask: { x: number, y: number, w: number, h: number }[] | null = null
  let keepRect: { x: number, y: number, w: number, h: number } | null = null
  if (cropEnabled && image && centerW > 0 && centerH > 0) {
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

  const renderLine = (side: Side) => {
    if (!image)
      return null
    const horizontal = side === 'top' || side === 'bottom'
    const value = slice[side]

    const pos = side === 'top'
      ? value * scale
      : side === 'bottom'
        ? (image.height - value) * scale
        : side === 'left'
          ? value * scale
          : (image.width - value) * scale
    const { label, lineClass, badgeClass } = SIDES.find(s => s.side === side)!
    const endpointClasses = horizontal
      ? ['left-0 top-1/2 -translate-x-1/2 -translate-y-1/2', 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2']
      : ['top-0 left-1/2 -translate-x-1/2 -translate-y-1/2', 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2']
    return (
      <div
        key={side}
        role="slider"
        tabIndex={0}
        aria-label={`${label}边距`}
        aria-valuemin={0}
        aria-valuemax={maxSliceValue(side, slice, image)}
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
        onLostPointerCapture={onLinePointerEnd}
        onKeyDown={onLineKeyDown(side)}
      >
        <div
          className={cn(
            'absolute',
            lineClass,
            horizontal
              ? 'inset-x-0 top-1/2 -translate-y-1/2 border-t border-dashed'
              : 'inset-y-0 left-1/2 -translate-x-1/2 border-l border-dashed',
          )}
        />
        {endpointClasses.map(positionClass => (
          <span
            key={positionClass}
            aria-hidden="true"
            className={cn(
              'absolute rounded-sm border bg-background px-1 font-mono text-[10px] leading-4 font-medium select-none',
              badgeClass,
              positionClass,
            )}
          >
            {value}
          </span>
        ))}
      </div>
    )
  }

  return (
    <div className="nine-patch-workspace" data-mobile-view={mobileView}>
      <Seo title="点九图工具" description="调整点九图切片、中心裁剪和 border-image 样式，预览拉伸效果并保存编辑记录。" path="/tools/nine-patch" />
      <section className="nine-editor" aria-label="源图画布" style={{ background: editorStageView.background }}>
        <div ref={sourceFitRef} className="nine-source-fit" aria-hidden="true" />

        <div className="nine-source-stage">
          <div
            ref={editorStageRef}
            data-nine-editor-stage
            {...editorPan.panHandlers}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn(
              'nine-editor-surface absolute inset-0 flex touch-none overflow-hidden transition-colors select-none',
              editorPan.panning ? 'cursor-grabbing' : 'cursor-grab',
              !image && 'border-dashed',
              dragOver ? 'border-primary' : 'border-border',
            )}
            style={{ background: editorStageView.background }}
          >
            {image
              ? (
                  <div
                    className={cn('relative m-auto shrink-0 select-none', editorStageView.showBounds && NINE_PATCH_BOUNDARY_CLASS)}
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

                    <span className={SIZE_LABEL_CLASS} title={`原图尺寸：${image.name}`}>
                      {image.width}
                      {' × '}
                      {image.height}
                    </span>
                    {cropEnabled && centerW > 0 && centerH > 0 && (
                      <div
                        aria-hidden="true"
                        data-crop-center-preview
                        className="pointer-events-none absolute bg-foreground/15"
                        style={{ left: slice.left * scale, top: slice.top * scale, width: centerW * scale, height: centerH * scale }}
                      />
                    )}

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
                          className="pointer-events-none absolute border border-primary"
                          style={{ left: keepRect.x * scale, top: keepRect.y * scale, width: keepRect.w * scale, height: keepRect.h * scale }}
                        />
                      </>
                    )}
                    {SIDES.map(s => renderLine(s.side))}
                  </div>
                )
              : (
                  <div className="m-auto flex flex-col items-center gap-3 px-6 text-center">
                    <Frame className="size-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">拖拽图片到此处，或</p>
                      <p className="mt-1 text-sm text-muted-foreground">PNG / SVG / WebP 均可</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" onClick={() => fileInputRef.current?.click()}>
                        <ImagePlus />
                        选择图片
                      </Button>
                      <Button type="button" variant="outline" onClick={loadDemo}>
                        <Sparkles />
                        试试示例
                      </Button>
                    </div>
                  </div>
                )}
          </div>
          <StageZoomIndicator zoom={zoom} visible={editorStageZoom.zoomIndicatorVisible} />

        </div>
        <div className="nine-toolbar" aria-label="素材与画布工具">
          <div className="nine-imports">
            <Button type="button" variant="outline" title={image ? '更换图片' : '选择图片'} aria-label={image ? '更换图片' : '选择图片'} onClick={() => fileInputRef.current?.click()}>
              <ImagePlus />
              <span>{image ? '更换' : '图片'}</span>
            </Button>
            <Button type="button" variant="outline" title="载入示例" aria-label="载入示例" onClick={loadDemo}>
              <Sparkles />
              <span>示例</span>
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" title="清除图片" aria-label="清除图片" disabled={!image} onClick={clearImage}><Trash2 /></Button>
          </div>
          <span className="nine-source-info" title={image?.name}>{image ? `${image.name} · ${image.width} × ${image.height}` : '尚未导入图片'}</span>
          <div className="nine-view-controls">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              title="重置源图视图"
              aria-label="重置源图视图"
              disabled={!image || (editorPan.offset.x === 0 && editorPan.offset.y === 0 && zoom === editorFit)}
              onClick={() => {
                editorPan.resetPan()
                resetEditorZoom()
              }}
            >
              <RotateCcw />
            </Button>
            <StageViewControls hasContent={Boolean(image)} settings={editorStageView} />
          </div>
        </div>
        {importError && (
          <p role="alert" data-tone="error" className="nine-import-error">
            <TriangleAlert className="size-4 shrink-0" />
            {importError}
          </p>
        )}
      </section>
      <NinePreviewHud controls={(
        <>
          <div className="nine-preview-dimensions">
            <input type="number" min={96} max={720} step={1} value={previewSize.w} disabled={!image} aria-label="预览宽度" onChange={event => setPreviewSize(clampPreview(Number(event.target.value) || 96, previewSize.h))} />
            <span aria-hidden="true">×</span>
            <input type="number" min={64} max={480} step={1} value={previewSize.h} disabled={!image} aria-label="预览高度" onChange={event => setPreviewSize(clampPreview(previewSize.w, Number(event.target.value) || 64))} />
          </div>
          <output className="sr-only" aria-label="预览尺寸">
            {previewSize.w}
            {' '}
            ×
            {' '}
            {previewSize.h}
          </output>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="重置预览视图"
            aria-label="重置预览视图"
            disabled={!image || (previewPan.offset.x === 0 && previewPan.offset.y === 0 && previewZoom === previewFit && resizeOffset.x === 0 && resizeOffset.y === 0)}
            onClick={() => {
              previewPan.resetPan()
              resetPreviewZoom()
              setResizeOffset({ x: 0, y: 0 })
            }}
          >
            <RotateCcw />
          </Button>
        </>
      )}
      >

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="nine-preview-stage">
            <div
              ref={previewStageRef}
              data-nine-preview-stage
              {...previewPan.panHandlers}
              className={cn(
                'absolute inset-0 flex touch-none overflow-hidden rounded-md border border-border p-8 select-none',
                previewPan.panning ? 'cursor-grabbing' : 'cursor-grab',
              )}
              style={{ background: editorStageView.background }}
            >
              {image
                ? (
                    <div
                      className="relative m-auto shrink-0"
                      style={{
                        width: (previewSize.w + 24) * previewZoom,
                        height: (previewSize.h + 24) * previewZoom,
                        transform: `translate(${previewPan.offset.x + resizeOffset.x}px, ${previewPan.offset.y + resizeOffset.y}px)`,
                      }}
                    >
                      <div
                        className="group/preview absolute"
                        style={{
                          left: 12 * previewZoom,
                          top: 12 * previewZoom,
                          width: previewSize.w * previewZoom,
                          height: previewSize.h * previewZoom,
                        }}
                      >
                        <span className={SIZE_LABEL_CLASS}>
                          {previewSize.w}
                          {' × '}
                          {previewSize.h}
                        </span>
                        <div
                          className="absolute top-0 left-0"
                          style={{
                            width: previewSize.w,
                            height: previewSize.h,
                            transform: `scale(${previewZoom})`,
                            transformOrigin: '0 0',
                            borderStyle: 'solid',
                            borderColor: 'transparent',
                            borderImageSource: `url("${image.url}")`,
                            borderImageSlice: sliceValue(codeParams),
                            borderImageWidth: widthValue(codeParams),
                            borderImageOutset: `${outset}px`,
                            borderImageRepeat: repeatValue(codeParams),
                          }}
                        >
                        </div>
                        {editorStageView.showBounds && (
                          <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 z-10', NINE_PATCH_BOUNDARY_CLASS)} />
                        )}

                        {RESIZE_EDGES.map(({ edge, strip, bar, label }) => (
                          <div
                            key={edge}
                            data-nine-resize={edge}
                            title={label}
                            className={cn('absolute z-20 touch-none', strip)}
                            onPointerDown={onResizePointerDown(edge)}
                            onPointerMove={onResizePointerMove}
                            onPointerUp={onResizePointerEnd}
                            onPointerCancel={onResizePointerEnd}
                            onLostPointerCapture={onResizePointerEnd}
                          >
                            <div className={cn('absolute rounded-full bg-primary opacity-60 transition-opacity group-hover/preview:opacity-100', bar)} />
                          </div>
                        ))}
                        {RESIZE_CORNERS.map(({ corner, hit, lShape, label }) => (
                          <div
                            key={corner}
                            data-nine-resize={corner}
                            role="slider"
                            tabIndex={0}
                            aria-label="调整预览框尺寸"
                            aria-valuetext={`${previewSize.w} × ${previewSize.h}`}
                            title={`${label}（方向键微调）`}
                            className={cn('absolute z-20 touch-none outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', hit)}
                            onPointerDown={onResizePointerDown(corner)}
                            onPointerMove={onResizePointerMove}
                            onPointerUp={onResizePointerEnd}
                            onPointerCancel={onResizePointerEnd}
                            onLostPointerCapture={onResizePointerEnd}
                            onKeyDown={onResizeKeyDown(corner)}
                          >
                            <div className={cn('absolute size-2 border-primary opacity-60 transition-opacity group-hover/preview:opacity-100', lShape)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                : (
                    <p className="m-auto text-sm text-muted-foreground">先导入一张图片</p>
                  )}
            </div>
            <StageZoomIndicator zoom={previewZoom} visible={previewStageZoom.zoomIndicatorVisible} />

          </div>
          <p className="nine-preview-hint">画面手柄调拉伸 · 外框手柄调 HUD</p>
        </div>
      </NinePreviewHud>
      <aside className="nine-panel" aria-label="点九图设置">
        <nav className="nine-panel-tabs" aria-label="设置区域">
          {([{ id: 'params', label: '参数' }, { id: 'code', label: 'CSS' }, { id: 'records', label: '记录' }] as const).map(tab => (
            <button key={tab.id} type="button" aria-pressed={panelTab === tab.id} onClick={() => setPanelTab(tab.id)}>{tab.label}</button>
          ))}
        </nav>
        <div className="nine-panel-body">
          <div hidden={panelTab !== 'params'}>
            {' '}
            <section className="nine-settings" aria-label="切片参数">
              <div className="flex min-h-8 items-center justify-between gap-2 pb-3">
                <h2 className="font-mono text-sm font-semibold tracking-tight">参数</h2>
                <Button type="button" variant="outline" size="icon-sm" className="size-5 rounded-sm" title="重置切片" aria-label="重置切片" onClick={resetSlice} disabled={!image}>
                  <RotateCcw className="size-3" />
                </Button>
              </div>
              <div className="flex flex-col gap-4">

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
                    <p>切片边距（px）</p>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      className="size-5 rounded-sm"
                      title={detecting ? '识别中…' : '从像素分析最小可用切片（自动识别）'}
                      aria-label={detecting ? '识别中…' : '自动识别切片'}
                      aria-busy={detecting}
                      disabled={!image || detecting}
                      onClick={() => void autoDetect()}
                    >
                      <ScanLine className="size-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {SIDES.map(({ side, label }) => (
                      <label key={side} className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                        <input
                          type="number"
                          min={0}
                          max={image ? maxSliceValue(side, slice, image) : 0}
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
                  {detecting && <p role="status" className="mt-2 text-xs text-info">正在分析像素…</p>}
                  {detectInfo && (
                    <p role={detectInfo.tone === 'error' ? 'alert' : 'status'} className={cn('mt-2 flex items-start gap-1.5 text-xs', detectInfo.tone === 'success' ? 'text-success' : detectInfo.tone === 'error' ? 'text-destructive' : 'text-warning-muted-foreground')}>
                      {detectInfo.tone !== 'success' && <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />}
                      {detectInfo.text}
                    </p>
                  )}
                </div>
                <section className="nine-crop" aria-label="中心裁剪设置" aria-describedby={cropEnabled ? 'nine-crop-guide' : undefined}>
                  <div>
                    <div className="mb-1.5 flex items-center justify-between">
                      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        中心裁剪
                        <span className="group/crop-help relative inline-flex">
                          <button
                            type="button"
                            aria-label="中心裁剪说明"
                            aria-describedby="center-crop-help"
                            className="inline-flex cursor-help rounded-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          >
                            <CircleHelp className="size-3.5" aria-hidden="true" />
                          </button>
                          <span
                            id="center-crop-help"
                            role="tooltip"
                            className="pointer-events-none invisible absolute bottom-full left-0 z-50 mb-2 w-max max-w-64 border border-border bg-popover px-2 py-1 text-xs font-normal text-popover-foreground group-focus-within/crop-help:visible group-hover/crop-help:visible"
                          >
                            删除中心多余行列得到最小图
                          </span>
                        </span>
                      </p>
                      <BrutalCheckbox
                        checked={cropEnabled}
                        onChange={changeCropEnabled}
                        title="启用中心裁剪"
                      />
                    </div>
                    {cropEnabled && (
                      <div className="flex flex-col gap-2">
                        <OptionGroup
                          label="裁剪轴"
                          value={cropAxes}
                          onChange={changeCropAxes}
                          options={CROP_AXES_OPTIONS}
                        />
                        <div className="flex items-end gap-2">
                          <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
                            保留宽（px）
                            <input
                              type="number"
                              min={1}
                              max={Math.max(1, centerW)}
                              value={keepW}
                              disabled={!image || cropAxes === 'y'}
                              onChange={e => setCropKeepValue('w', Number(e.target.value))}
                              aria-label="中心保留宽"
                              className={cn(NUM_INPUT_CLASS, 'disabled:cursor-not-allowed disabled:opacity-60')}
                            />
                          </label>
                          <label className="flex flex-1 flex-col gap-1 text-xs text-muted-foreground">
                            保留高（px）
                            <input
                              type="number"
                              min={1}
                              max={Math.max(1, centerH)}
                              value={keepH}
                              disabled={!image || cropAxes === 'x'}
                              onChange={e => setCropKeepValue('h', Number(e.target.value))}
                              aria-label="中心保留高"
                              className={cn(NUM_INPUT_CLASS, 'disabled:cursor-not-allowed disabled:opacity-60')}
                            />
                          </label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!image || ((cropAxes === 'y' || keepW === 1) && (cropAxes === 'x' || keepH === 1))}
                            onClick={() => {
                              invalidateAnalysis()
                              setCropKeep({ w: 1, h: 1 })
                            }}
                          >
                            裁到最小
                          </Button>
                        </div>
                        <p id="nine-crop-guide" className="text-xs text-muted-foreground">框线内为保留中心，斜纹行列将删除。拉伸预览使用原图；裁剪只影响下载。</p>
                        {(repeatH !== 'stretch' || repeatV !== 'stretch') && (
                          <p className="flex items-start gap-1.5 text-xs text-warning-muted-foreground">
                            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                            平铺模式下裁剪会改变平铺单元，渲染效果将发生变化
                          </p>
                        )}

                      </div>
                    )}
                  </div>
                </section>
                <section className="nine-rendering" aria-label="渲染参数">
                  <h2>渲染</h2>
                  <div className="nine-advanced-body">
                    <div>
                      <p className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
                        边框宽度（px）
                        <button
                          type="button"
                          role="switch"
                          aria-checked={linkWidth}
                          aria-label="绑定边框宽度与切片"
                          title={linkWidth ? '已绑定：宽度跟随切片边距（点击解绑）' : '已解绑：可独立调整宽度（点击绑定）'}
                          onClick={() => setLinkWidth(v => !v)}
                          className={cn(
                            'flex size-5 items-center justify-center rounded-sm outline-none',
                            'transition-colors',
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

                    <div className="flex items-end justify-between gap-3">
                      <label className="flex w-24 shrink-0 flex-col gap-1 text-xs text-muted-foreground">
                        <span className="font-medium">外扩 outset</span>
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
                          label="填充中心"
                          title="开启后中心切片会绘制在内容区背景上"
                        />
                      </div>
                    </div>

                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">横向重复</p>
                      <OptionGroup
                        label="横向重复方式"
                        value={repeatH}
                        onChange={setRepeatH}
                        options={(['stretch', 'repeat', 'round', 'space'] as RepeatMode[]).map(m => ({ value: m, label: m }))}
                      />
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-muted-foreground">纵向重复</p>
                      <OptionGroup
                        label="纵向重复方式"
                        value={repeatV}
                        onChange={setRepeatV}
                        options={(['stretch', 'repeat', 'round', 'space'] as RepeatMode[]).map(m => ({ value: m, label: m }))}
                      />
                    </div>
                  </div>
                </section>
              </div>
            </section>
          </div>
          <div hidden={panelTab !== 'code'}>
            {' '}
            <section className="nine-code" aria-label="CSS 输出">
              <div className="flex min-h-8 items-center justify-between gap-2 pb-3">
                <h2 className="font-mono text-sm font-semibold tracking-tight">样式代码</h2>
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="flex items-center gap-2">
                  <OptionGroup
                    label="代码写法"
                    className="h-8 flex-1"
                    value={codeStyle}
                    onChange={setCodeStyle}
                    options={[
                      { value: 'longhand' as CodeStyle, label: '分开写' },
                      { value: 'shorthand' as CodeStyle, label: '简写' },
                    ]}
                  />
                  <Button type="button" variant="outline" size="icon-sm" title="复制" aria-label="复制" onClick={() => void copyCode()}>
                    {copied ? <Check data-feedback="success" /> : <Copy />}
                  </Button>
                </div>
                <p id="nine-image-path-guide" className="text-xs text-muted-foreground">把 YOUR-IMAGE-PATH.EXT 换成项目中的实际图片路径。</p>
                <pre
                  tabIndex={0}
                  aria-label="CSS 代码"
                  aria-describedby="nine-image-path-guide"
                  onKeyDown={selectCodeOnShortcut}
                  className="min-h-40 max-h-96 min-w-0 flex-1 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-xs leading-5 whitespace-pre outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {exportText.split(/(url\("[^"]*"\))/g).map(part => (
                    part.startsWith('url(')
                      ? (
                          <mark
                            key={part}
                            title="下载 PNG 后，把这里换成项目里的实际路径"
                            className="rounded-sm bg-chart-3/40 px-0.5 font-medium text-foreground"
                          >
                            {part}
                          </mark>
                        )
                      : part
                  ))}
                </pre>
              </div>
            </section>
          </div>
          <div hidden={panelTab !== 'records'}>
            {' '}
            <section className="nine-records" aria-label="编辑记录">
              <div className="pb-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-mono text-sm font-semibold tracking-tight">记录</h2>

                </div>

              </div>
              {records.length === 0 && <p className="nine-empty-records">暂无记录</p>}
              <div className="flex flex-col">
                {records.length > 0 && (
                  <div className="mt-3 flex flex-col">
                    {records.map(record => (
                      <div key={record.id} className="flex items-center gap-2 border-b border-border py-2">
                        <button type="button" className="min-w-0 flex-1 truncate text-left text-sm hover:underline" onClick={() => void loadRecord(record.id)} title="加载记录">
                          {record.recordName}
                        </button>
                        <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{record.size >= 1024 ? `${Math.round(record.size / 1024)} KB` : `${record.size} B`}</span>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`删除记录 ${record.recordName}`} onClick={() => void deleteRecord(record.id)}>
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
        <footer className="nine-panel-footer">
          <input aria-label="记录名称" placeholder={image?.name || '记录名称'} value={recordName} onChange={event => setRecordName(event.target.value)} className="w-full rounded border border-border bg-background px-2 py-1" />
          {recordInfo && <p role="status" className={recordInfo.ok ? 'text-success' : 'text-destructive'}>{recordInfo.text}</p>}
          {copyError && <p role="alert" className="text-destructive">复制失败，请重试或选中代码手动复制</p>}
          <div className="nine-output-actions">
            <Button type="button" size="sm" disabled={!image} onClick={() => void copyCode()}>
              {copied ? <Check data-feedback="success" /> : <Copy />}
              复制 CSS
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!image || saving} onClick={() => void saveRecord()} aria-label="保存当前记录">
              <Save />
              {saving ? '保存中…' : '保存'}
            </Button>
          </div>
          {exportInfo && <p role={exportInfo.ok ? 'status' : 'alert'} className={exportInfo.ok ? 'text-success' : 'text-destructive'}>{exportInfo.text}</p>}
          <Button type="button" variant="outline" size="sm" className="nine-crop-download" aria-busy={exporting} disabled={!cropActive || exporting} onClick={() => void downloadCropped()}>
            <Download />
            {exporting ? '导出中…' : '裁剪 PNG'}
            <span>{cropActive ? `${croppedW} × ${croppedH}` : '暂无裁剪'}</span>
          </Button>
        </footer>
      </aside>
      <nav className="nine-mobile-tabs" aria-label="工作区域">
        {([{ id: 'editor', label: '编辑' }, { id: 'preview', label: '预览' }, { id: 'params', label: '参数与输出' }] as const).map(tab => (
          <button type="button" key={tab.id} aria-pressed={mobileView === tab.id} onClick={() => setMobileView(tab.id)}>{tab.label}</button>
        ))}
      </nav>
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" aria-label="导入图片" onChange={onFileChange} />
    </div>
  )
}
