import type { ChangeEvent, DragEvent, ReactNode } from 'react'
import type { AtlasOptions, LoadedLottieProject, OptimizedLottieResult } from './types'
import {
  Check,
  Download,
  FileArchive,
  FolderOpen,
  Gauge,
  ImageIcon,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Save,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Seo } from '@/components/seo'
import { StageViewControls, STAGE_BOUNDARY_CLASS, useStageViewSettings } from '@/components/stage-view-controls'
import { StageZoomIndicator } from '@/components/stage-zoom-indicator'
import { Button } from '@/components/ui/button'

import { clampZoom, useAutoFitZoom, useStageFitScale, useStagePan, useStageZoom } from '@/lib/stage'
import { cn } from '@/lib/utils'
import { createDemoProject } from '../demos/lottie-preview'
import { countAtlasOptimizableImages, disposeOptimizedResult, exportOptimizedProject, optimizeLottie } from './atlas-optimizer'
import { createPreviewAnimation, disposeProject, loadLottieProject } from './import-files'
import { LottiePreview } from './preview'
import { LottieReactPreview } from './react-preview'
import { createLottieArchive, createLottieItem, useLottieRecords, type LottieRecordMeta } from './records'
import { calculateLottieResourceMetrics } from './resource-metrics'

const DEFAULT_OPTIONS: AtlasOptions = {
  maxSize: 2048,
  padding: 2,
  extrude: 1,
  allowRotation: false,
  allowTrim: true,
  detectIdentical: true,
  powerOfTwo: false,
  square: false,
  alphaThreshold: 1,
}

const INPUT_CLASS = 'h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50'

type LottieLibrary = 'lottie-react' | 'lottie-web'

interface ComparisonValue {
  after: string
  before: string
  unit: string
}

function formatComparisonValue(before: number | null, after: number | null, scales: Array<{ decimals: number, divisor: number, unit: string }>): ComparisonValue {
  if (before == null)
    return { after: '—', before: '—', unit: '' }
  const largest = Math.max(before, after ?? before)
  let scale = scales[0]
  for (const candidate of scales) {
    if (largest >= candidate.divisor)
      scale = candidate
  }
  const format = (value: number) => scale.decimals === 0 ? `${Math.round(value / scale.divisor)}` : (value / scale.divisor).toFixed(scale.decimals)
  return {
    after: after == null ? '—' : format(after),
    before: format(before),
    unit: scale.unit,
  }
}

function formatSizeComparison(before: number | null, after: number | null): ComparisonValue {
  return formatComparisonValue(before, after, [
    { decimals: 0, divisor: 1, unit: 'B' },
    { decimals: 1, divisor: 1024, unit: 'KB' },
    { decimals: 2, divisor: 1024 * 1024, unit: 'MB' },
  ])
}

function formatPixelComparison(before: number | null, after: number | null): ComparisonValue {
  return formatComparisonValue(before, after, [
    { decimals: 0, divisor: 1, unit: 'px' },
    { decimals: 1, divisor: 1000, unit: 'Kpx' },
    { decimals: 2, divisor: 1000 * 1000, unit: 'MP' },
  ])
}

function Checkbox({ checked, label, onChange, disabled = false }: {
  checked: boolean
  disabled?: boolean
  label: string
  onChange: (checked: boolean) => void
}) {
  return (
    <label className={cn('relative flex size-6 shrink-0 items-center', disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer')}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={event => onChange(event.target.checked)}
        className="peer absolute inset-0 z-10 size-6 cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
      <span
        className={cn(
          'pointer-events-none flex size-6 shrink-0 items-center justify-center rounded-sm border border-border transition-colors',
          'peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50',
          checked ? 'bg-primary text-primary-foreground' : 'bg-background',
        )}
      >
        {checked && <Check className="size-4" strokeWidth={3.5} />}
      </span>
    </label>
  )
}

function SettingRow({ children, description, label }: { children: ReactNode, description: string, label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-bold">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

function ComparisonStat({ after, before, label, lastRow = false, negative = false, title = label, unit = '' }: {
  after: string
  before: string
  label: string
  lastRow?: boolean
  negative?: boolean
  title?: string
  unit?: string
}) {
  const hasAfter = after !== '—'
  return (
    <div title={title} className={cn('flex min-w-0 items-baseline justify-between gap-2 px-2 py-1.5 odd:border-r odd:border-border/40', !lastRow && 'border-b border-border/40', negative && 'bg-destructive/10')}>
      <p className="truncate text-[10px] font-bold text-muted-foreground">{label}</p>
      <p className="flex shrink-0 items-baseline gap-1 font-mono text-[11px] font-semibold">
        <span>
          {before}
          {!hasAfter && unit ? ` ${unit}` : ''}
        </span>
        <span className="text-muted-foreground">→</span>
        <span className={cn(negative && 'text-destructive')}>
          {after}
          {hasAfter && unit ? ` ${unit}` : ''}
        </span>
      </p>
    </div>
  )
}

function Stat({ label, lastRow = false, title = label, value }: { label: string, lastRow?: boolean, title?: string, value: string }) {
  return (
    <div title={title} className={cn('flex min-w-0 items-baseline justify-between gap-2 px-2 py-1.5 odd:border-r odd:border-border/40', !lastRow && 'border-b border-border/40')}>
      <p className="truncate text-[10px] font-bold text-muted-foreground">{label}</p>
      <p className="shrink-0 font-mono text-[11px] font-semibold">{value}</p>
    </div>
  )
}

export default function LottiePreviewTool() {
  const zipInputRef = useRef<HTMLInputElement>(null)
  const directoryInputRef = useRef<HTMLInputElement>(null)
  const projectRef = useRef<LoadedLottieProject | null>(null)
  const resultRef = useRef<OptimizedLottieResult | null>(null)
  const [project, setProject] = useState<LoadedLottieProject | null>(null)
  const { records, save: saveRecordItem, get: getRecordItem, remove: removeRecordItem } = useLottieRecords()
  const [recordName, setRecordName] = useState('')
  const [optimized, setOptimized] = useState<OptimizedLottieResult | null>(null)
  const [options, setOptions] = useState(DEFAULT_OPTIONS)
  const [optimizationEnabled, setOptimizationEnabled] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [library, setLibrary] = useState<LottieLibrary>('lottie-web')
  const [renderer, setRenderer] = useState<'canvas' | 'svg'>('canvas')
  const [playing, setPlaying] = useState(false)
  const [loop, setLoop] = useState(true)
  const [speed, setSpeed] = useState(1)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [fit, setFit] = useState<'meet' | 'slice'>('meet')
  const [currentFrame, setCurrentFrame] = useState(0)
  const [totalFrames, setTotalFrames] = useState(1)
  const [seekToken, setSeekToken] = useState(0)
  const [busy, setBusy] = useState(false)
  const [optimizing, setOptimizing] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [atlasZoom, setAtlasZoom] = useState(1)
  const stageView = useStageViewSettings()
  const stageRef = useRef<HTMLDivElement>(null)
  const atlasStageRef = useRef<HTMLDivElement>(null)
  const atlasStageZoom = useStageZoom(atlasStageRef, atlasZoom, setAtlasZoom, Boolean(optimized))
  const stagePan = useStagePan(stageRef, () => false)
  const atlasStagePan = useStagePan(atlasStageRef, () => false)
  const resetStagePan = stagePan.resetPan
  const optimizableImageCount = useMemo(() => project ? countAtlasOptimizableImages(project) : 0, [project])
  const animatedImageCount = project ? [...project.images.values()].filter(image => image.isAnimated).length : 0
  const excludedImageDescription = animatedImageCount > 0
    ? `${animatedImageCount} 个动态图片保留原始素材，不参与图集优化。`
    : null
  const resourceMetrics = useMemo(() => project ? calculateLottieResourceMetrics(project, optimized) : null, [optimized, project])
  const atlasDimensions = optimized ? optimized.atlases.map(atlas => `${atlas.width}×${atlas.height}`).join(' / ') : '—'
  const atlasContentSize = useMemo(() => ({
    height: optimized ? Math.max(...optimized.atlases.map(atlas => atlas.height), 0) : 0,
    width: optimized ? optimized.atlases.reduce((total, atlas) => total + atlas.width, 0) + Math.max(0, optimized.atlases.length - 1) * 8 : 0,
  }), [optimized])
  const atlasFitScale = useStageFitScale(atlasStageRef, atlasContentSize.width, atlasContentSize.height, Boolean(optimized))
  /**
   * 主舞台视图缩放：内容层是舞台等尺寸的画布（内部 meet 适配），缩放值是相对
   * meet 基线的倍率——完整适配 + 留边 = (留边适配比例 ÷ meet 比例)，恒 ≤ 1。
   */
  const animationWidth = project?.animation.w ?? 0
  const animationHeight = project?.animation.h ?? 0
  const meetScale = useStageFitScale(stageRef, animationWidth, animationHeight, Boolean(project), 0)
  const marginFitScale = useStageFitScale(stageRef, animationWidth, animationHeight, Boolean(project), 24)
  const stageFitZoom = meetScale > 0 ? clampZoom(marginFitScale / meetScale) : 1
  const [zoom, setZoom, resetStageZoom] = useAutoFitZoom(stageFitZoom, project)
  const stageZoom = useStageZoom(stageRef, zoom, setZoom, Boolean(project))
  const resourceSizeComparison = formatSizeComparison(project?.sourceBytes ?? null, optimized ? resourceMetrics?.optimizedResourceBytes ?? null : null)
  const texturePixelComparison = formatPixelComparison(resourceMetrics?.sourcePixels ?? null, optimized && resourceMetrics ? resourceMetrics.activeTextureBytes / 4 : null)
  const textureMemoryComparison = formatSizeComparison(resourceMetrics?.sourceDecodedBytes ?? null, optimized ? resourceMetrics?.activeTextureBytes ?? null : null)

  const replaceResult = useCallback((next: OptimizedLottieResult | null) => {
    const previous = resultRef.current
    resultRef.current = next
    setOptimized(next)
    if (previous)
      window.setTimeout(disposeOptimizedResult, 0, previous)
  }, [])

  const replaceProject = useCallback((next: LoadedLottieProject) => {
    const previous = projectRef.current
    replaceResult(null)
    projectRef.current = next
    setProject(next)
    setPlaying(false)
    setCurrentFrame(0)
    setSeekToken(value => value + 1)
    setError(null)
    resetStagePan()
    if (previous)
      window.setTimeout(disposeProject, 0, previous)
  }, [replaceResult, resetStagePan])

  /** 清除项目：释放素材与图集结果，回到空状态 */
  const clearProject = useCallback(() => {
    const previous = projectRef.current
    projectRef.current = null
    replaceResult(null)
    setProject(null)
    setPlaying(false)
    setCurrentFrame(0)
    setSeekToken(value => value + 1)
    setError(null)
    resetStagePan()
    if (previous)
      window.setTimeout(disposeProject, 0, previous)
  }, [replaceResult, resetStagePan])

  useEffect(() => () => {
    disposeProject(projectRef.current)
    disposeOptimizedResult(resultRef.current)
  }, [])

  useEffect(() => {
    atlasStagePan.resetPan()
    setAtlasZoom(1)
  }, [atlasStagePan.resetPan, optimized])

  useEffect(() => {
    if (!project || !optimizationEnabled || optimizableImageCount === 0 || project.warnings.length > 0) {
      replaceResult(null)
      setOptimizing(false)
      return
    }

    let active = true
    replaceResult(null)
    setOptimizing(true)
    const timer = window.setTimeout(() => {
      void optimizeLottie(project, options).then((result) => {
        if (!active) {
          disposeOptimizedResult(result)
          return
        }
        replaceResult(result)
        setOptimizing(false)
      }).catch((reason: unknown) => {
        if (!active)
          return
        setOptimizing(false)
        setError(reason instanceof Error ? reason.message : '图集生成失败')
      })
    }, 180)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [optimizableImageCount, optimizationEnabled, options, project, replaceResult])

  const originalPreview = useMemo(() => project ? createPreviewAnimation(project) : null, [project])
  const shouldOptimize = Boolean(project && optimizationEnabled && optimizableImageCount > 0 && project.warnings.length === 0)
  const activeAnimation = shouldOptimize && optimized ? optimized.previewAnimation : originalPreview

  const importFiles = useCallback(async (files: File[]) => {
    if (files.length === 0)
      return
    setBusy(true)
    setError(null)
    try {
      replaceProject(await loadLottieProject(files))
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : '文件导入失败')
    }
    finally {
      setBusy(false)
    }
  }, [replaceProject])

  const saveRecord = useCallback(async () => {
    if (!project)
      return
    setBusy(true)
    try {
      const archive = await createLottieArchive(project)
      const meta: LottieRecordMeta = {
        name: recordName.trim() || project.name,
        projectName: project.name,
        width: project.animation.w,
        height: project.animation.h,
        frameRate: project.animation.fr,
        imageCount: project.images.size,
        options,
        optimizationEnabled,
        library,
        renderer,
        loop,
        speed,
        direction,
        fit,
      }
      await saveRecordItem(createLottieItem(crypto.randomUUID(), archive, meta))
      setRecordName('')
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : '项目保存失败')
    }
    finally {
      setBusy(false)
    }
  }, [direction, fit, library, loop, optimizationEnabled, options, project, recordName, renderer, saveRecordItem, speed])

  const loadRecord = useCallback(async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      const item = await getRecordItem(id)
      if (!item || !(item.payload instanceof Blob))
        return
      const meta = item.meta as unknown as Partial<LottieRecordMeta>
      const name = typeof meta.projectName === 'string' && meta.projectName ? meta.projectName : 'lottie'
      replaceProject(await loadLottieProject([new File([item.payload], `${name}.zip`, { type: 'application/zip' })]))
      if (meta.options)
        setOptions(meta.options)
      if (typeof meta.optimizationEnabled === 'boolean')
        setOptimizationEnabled(meta.optimizationEnabled)
      if (meta.library)
        setLibrary(meta.library)
      if (meta.renderer)
        setRenderer(meta.renderer)
      if (typeof meta.loop === 'boolean')
        setLoop(meta.loop)
      if (typeof meta.speed === 'number')
        setSpeed(meta.speed)
      if (meta.direction)
        setDirection(meta.direction)
      if (meta.fit)
        setFit(meta.fit)
      setRecordName(typeof meta.name === 'string' ? meta.name : '')
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : '项目加载失败')
    }
    finally {
      setBusy(false)
    }
  }, [getRecordItem, replaceProject])

  async function loadDemo(): Promise<void> {
    setBusy(true)
    try {
      replaceProject(await createDemoProject())
    }
    catch (reason) {
      setError(reason instanceof Error ? reason.message : '示例生成失败')
    }
    finally {
      setBusy(false)
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>): void {
    void importFiles(Array.from(event.target.files ?? []))
    event.target.value = ''
  }

  function onDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    setDragOver(false)
    const files = Array.from(event.dataTransfer.files)
    if (files.length !== 1 || !/\.zip$/i.test(files[0].name)) {
      setError('拖放仅支持一个 ZIP 文件；导入目录请使用“选择目录”。')
      return
    }
    void importFiles(files)
  }

  function updateOption<K extends keyof AtlasOptions>(key: K, value: AtlasOptions[K]): void {
    replaceResult(null)
    setOptimizing(Boolean(project && optimizationEnabled && optimizableImageCount > 0 && project.warnings.length === 0))
    setOptions(current => ({ ...current, [key]: value }))
  }

  async function exportProject(): Promise<void> {
    if (!project || !optimized)
      return
    setBusy(true)
    try {
      await exportOptimizedProject(project, optimized)
    }
    finally {
      setBusy(false)
    }
  }

  const resourceResult = (
    <section className="min-w-0 lg:h-full lg:border-l lg:border-border lg:pl-6">
      <div className="flex min-h-8 items-center gap-2 pb-2">
        <Gauge className="size-4 text-muted-foreground" />
        <h2 className="font-mono text-sm font-semibold tracking-tight">资源结果</h2>
      </div>
      <p className="pb-3 text-xs text-muted-foreground">{!project ? '导入素材后显示图集与资源统计。' : project.warnings.length > 0 ? '资源路径校验未通过，请查看右上角消息。' : project.images.size === 0 ? 'data.json 没有引用可预览的图片素材。' : optimizableImageCount === 0 && excludedImageDescription ? excludedImageDescription : !optimizationEnabled ? '图集优化已关闭，画布显示原始素材。' : optimizing ? '正在重新排布图集，画布先显示原始素材…' : optimized ? '画布当前显示的就是此导出结果。' : '等待图集优化结果'}
      </p>
      <div className="space-y-3">
        <div className="grid grid-cols-2 overflow-hidden rounded-md border border-border bg-muted/30">
          <ComparisonStat
            label="体积"
            title="资源体积"
            before={resourceSizeComparison.before}
            after={resourceSizeComparison.after}
            unit={resourceSizeComparison.unit}
            negative={Boolean(optimized && project && resourceMetrics?.optimizedResourceBytes != null && resourceMetrics.optimizedResourceBytes > project.sourceBytes)}
          />
          <ComparisonStat
            label="纹理"
            title="纹理数量"
            before={resourceMetrics ? `${resourceMetrics.sourceImageCount}` : '—'}
            after={optimized && resourceMetrics ? `${resourceMetrics.activeTextureCount}` : '—'}
            negative={Boolean(optimized && resourceMetrics && resourceMetrics.activeTextureCount > resourceMetrics.sourceImageCount)}
          />
          <ComparisonStat
            label="像素"
            title="纹理像素"
            before={texturePixelComparison.before}
            after={texturePixelComparison.after}
            unit={texturePixelComparison.unit}
            negative={Boolean(optimized && resourceMetrics && resourceMetrics.activeTextureBytes / 4 > resourceMetrics.sourcePixels)}
          />
          <ComparisonStat
            label="内存"
            title="RGBA 内存"
            before={textureMemoryComparison.before}
            after={textureMemoryComparison.after}
            unit={textureMemoryComparison.unit}
            negative={Boolean(optimized && resourceMetrics && resourceMetrics.activeTextureBytes > resourceMetrics.sourceDecodedBytes)}
          />
          <Stat label="图集" title="图集数" value={optimized ? `${optimized.atlases.length}` : '—'} lastRow />
          <Stat label="占用" title="占用率" value={optimized ? `${(optimized.occupancy * 100).toFixed(1)}%` : '—'} lastRow />
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          优化前 → 图集后；红色为增加。内存按 RGBA 4 B/px 估算，未计 Canvas 等开销。
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <p className="font-bold tracking-wide uppercase">图集预览</p>
            <span className="max-w-[60%] truncate text-right font-mono font-semibold" title={optimized ? atlasDimensions : undefined}>{atlasDimensions}</span>
          </div>
          <div
            ref={atlasStageRef}
            data-testid="lottie-atlas-stage"
            aria-label="图集预览画布"
            {...atlasStagePan.panHandlers}
            className={cn(
              'relative flex h-[162px] touch-none overflow-hidden rounded-md border border-border select-none',
              optimized && (atlasStagePan.panning ? 'cursor-grabbing' : 'cursor-grab'),
            )}
            style={{ background: stageView.background }}
          >
            {optimized
              ? (
                  <div
                    className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    style={{ transform: `translate(${atlasStagePan.offset.x}px, ${atlasStagePan.offset.y}px)` }}
                  >
                    <div
                      className="flex shrink-0 origin-center items-center gap-2"
                      style={{ transform: `scale(${atlasFitScale * atlasZoom})` }}
                    >
                      {optimized.atlases.map(atlas => (
                        <img
                          key={atlas.id}
                          src={atlas.objectUrl}
                          alt={atlas.filename}
                          width={atlas.width}
                          height={atlas.height}
                          draggable={false}
                          className={cn('block max-w-none shrink-0', stageView.showBounds && STAGE_BOUNDARY_CLASS)}
                        />
                      ))}
                    </div>
                  </div>
              )
              : (
                  <div className="m-auto flex items-center justify-center gap-2 rounded-md border border-border bg-background/90 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    {optimizing
                      ? <LoaderCircle className="size-4 animate-spin" />
                      : <ImageIcon className="size-4" />}
                    {optimizing ? '生成图集中' : '暂无图集'}
                  </div>
                )}
            <StageZoomIndicator zoom={atlasZoom} visible={atlasStageZoom.zoomIndicatorVisible} />
            {optimized && (atlasStagePan.offset.x !== 0 || atlasStagePan.offset.y !== 0 || atlasZoom !== 1) && (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                title="重置图集视图（居中并恢复 100%）"
                aria-label="重置图集视图"
                className="absolute top-2 right-2 bg-background/90"
                onClick={() => {
                  atlasStagePan.resetPan()
                  setAtlasZoom(1)
                }}
              >
                <RotateCcw />
              </Button>
            )}
          </div>
        </div>
        <p className="flex min-h-4 items-center gap-1 text-xs text-muted-foreground">
          <ImageIcon className="size-3.5" />
          <span className="truncate">
            {optimized ? `${optimized.sourceImageCount} 个引用 → ${optimized.packedImageCount} 份像素数据` : '生成图集后显示素材合并统计'}
          </span>
        </p>
        <Button type="button" className="w-full" onClick={() => void exportProject()} disabled={!optimized || busy || optimizing}>
          <Download />
          导出 ZIP
        </Button>
      </div>
    </section>
  )

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <Seo
        title="Lottie 预览与图集优化"
        description="使用 lottie-web 或 lottie-react 预览动画，把分散的图片素材打包为纹理图集，并导出仍由 Lottie 播放的资源包。"
        path="/tools/lottie-preview"
      />


      {(error || Boolean(project?.warnings.length)) && (
        <section
          className="fixed top-24 right-4 left-4 z-[60] max-h-[calc(100vh-7rem)] space-y-3 overflow-y-auto sm:left-auto sm:w-96"
          aria-label="素材消息"
          aria-live="polite"
        >
          {error && (
            <div className="flex gap-3 rounded-md border border-border bg-destructive p-4 text-destructive-foreground" role="alert">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold">处理失败</p>
                <p className="mt-1 text-sm font-bold">{error}</p>
              </div>
            </div>
          )}
          {Boolean(project?.warnings.length) && (
            <div className="flex gap-3 rounded-md border border-border bg-secondary p-4 text-secondary-foreground" role="status">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  素材警告
                  <span className="ml-2 rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-xs text-foreground">
                    {project?.warnings.length}
                  </span>
                </p>
                <ul className="mt-2 space-y-1 text-sm font-bold">
                  {project?.warnings.map(warning => <li key={warning}>{warning}</li>)}
                </ul>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="flex min-w-0 flex-col gap-6">
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-stretch">
          <section className="min-w-0">
            <div className="flex min-h-8 items-center justify-between gap-2 pb-3">
              <h2 className="font-mono text-sm font-semibold tracking-tight">动画预览</h2>
              <span className="font-mono text-xs text-muted-foreground">{project ? `${project.name} · ${project.animation.w}×${project.animation.h} · ${project.animation.fr} FPS` : '导入包含 data.json 的 ZIP 或完整目录'}</span>
            </div>
            <div>
              <input ref={zipInputRef} type="file" accept=".zip,application/zip" className="hidden" onChange={onFileChange} />
              <input
                ref={directoryInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={onFileChange}
                {...{ directory: '', webkitdirectory: '' }}
              />
              <div
                ref={stageRef}
                data-testid="lottie-stage"
                {...stagePan.panHandlers}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={cn(
                  'relative flex h-72 touch-none overflow-hidden border transition-colors select-none sm:h-96',
                  project && (stagePan.panning ? 'cursor-grabbing' : 'cursor-grab'),
                  dragOver ? 'border-primary bg-primary/10' : 'border-border',
                  !project && 'border-dashed',
                )}
                style={{ background: stageView.background }}
              >
                {activeAnimation
                  ? (
                      <div
                        className={cn('pointer-events-none m-auto size-full shrink-0 origin-center', stageView.showBounds && STAGE_BOUNDARY_CLASS)}
                        style={{ transform: `translate(${stagePan.offset.x}px, ${stagePan.offset.y}px) scale(${zoom})` }}
                      >
                        {library === 'lottie-web'
                          ? (
                              <LottiePreview
                                animation={activeAnimation}
                                currentFrame={currentFrame}
                                direction={direction}
                                fit={fit}
                                loop={loop}
                                onDurationChange={setTotalFrames}
                                onError={setError}
                                onFrameChange={setCurrentFrame}
                                playing={playing}
                                renderer={renderer}
                                seekToken={seekToken}
                                speed={speed}
                              />
                            )
                          : (
                              <LottieReactPreview
                                animation={activeAnimation}
                                currentFrame={currentFrame}
                                direction={direction}
                                fit={fit}
                                loop={loop}
                                onDurationChange={setTotalFrames}
                                onError={setError}
                                onFrameChange={setCurrentFrame}
                                playing={playing}
                                renderer={renderer}
                                seekToken={seekToken}
                                speed={speed}
                              />
                            )}
                      </div>
                    )
                  : project && shouldOptimize
                    ? (
                        <div className="m-auto flex flex-col items-center gap-3 px-6 text-center">
                          {optimizing ? <LoaderCircle className="size-8 animate-spin" /> : <TriangleAlert className="size-8" />}
                          <div>
                            <p className="font-semibold">{optimizing ? '正在应用图集设置' : '暂时无法生成预览'}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{optimizing ? '完成后画布会直接显示最终导出素材' : '请查看页面顶部的处理消息'}</p>
                          </div>
                        </div>
                      )
                    : (
                        <div className="m-auto flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
                          <div className="flex size-16 items-center justify-center rounded-lg border border-border bg-card">
                            <FileArchive className="size-8" />
                          </div>
                          <div>
                            <p className="font-semibold">把 Lottie ZIP 拖到这里</p>
                            <p className="mt-1 text-sm text-muted-foreground">ZIP 或目录内必须包含 data.json，并保持其中记录的资源路径</p>
                          </div>
                          <div className="flex w-full justify-center gap-3">
                            <Button type="button" onClick={() => zipInputRef.current?.click()} disabled={busy}>
                              <FileArchive />
                              选择 ZIP
                            </Button>
                            <Button type="button" variant="outline" onClick={() => directoryInputRef.current?.click()} disabled={busy}>
                              <FolderOpen />
                              选择目录
                            </Button>
                            <Button type="button" variant="outline" onClick={() => void loadDemo()} disabled={busy}>
                              <Sparkles />
                              试试示例
                            </Button>
                          </div>
                        </div>
                      )}
                {busy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                    <LoaderCircle className="size-7 animate-spin" />
                  </div>
                )}
                <StageZoomIndicator zoom={zoom} visible={stageZoom.zoomIndicatorVisible} />
                <StageViewControls hasContent={Boolean(activeAnimation)} settings={stageView} />
                {project && (
                  <>
                    {/* 加载内容后：导入按钮悬浮在画布右上角（与九宫格工具一致）；平移/缩放后出现「重置视图」 */}
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      {(stagePan.offset.x !== 0 || stagePan.offset.y !== 0 || zoom !== stageFitZoom) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          title="重置视图（居中并恢复 100%）"
                          aria-label="重置视图"
                          className="bg-background/90"
                          onClick={() => {
                            stagePan.resetPan()
                            resetStageZoom()
                          }}
                        >
                          <RotateCcw />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        title="导入 ZIP"
                        aria-label="导入 ZIP"
                        className="bg-background/90"
                        onClick={() => zipInputRef.current?.click()}
                        disabled={busy}
                      >
                        <FileArchive />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        title="导入目录"
                        aria-label="导入目录"
                        className="bg-background/90"
                        onClick={() => directoryInputRef.current?.click()}
                        disabled={busy}
                      >
                        <FolderOpen />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        title="清除项目"
                        aria-label="清除项目"
                        className="bg-background/90"
                        onClick={clearProject}
                        disabled={busy}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </>
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button type="button" size="icon" variant="outline" aria-label={playing ? '暂停' : '播放'} onClick={() => setPlaying(value => !value)} disabled={!activeAnimation}>
                  {playing ? <Pause /> : <Play />}
                </Button>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, totalFrames - 1)}
                  step={0.01}
                  value={Math.min(currentFrame, totalFrames - 1)}
                  disabled={!activeAnimation}
                  onChange={(event) => {
                    setPlaying(false)
                    setCurrentFrame(Number(event.target.value))
                    setSeekToken(value => value + 1)
                  }}
                  className="min-w-32 flex-1 accent-primary disabled:opacity-50"
                  aria-label="动画进度"
                />
                <span className="w-24 text-right font-mono text-xs font-medium text-muted-foreground">
                  {project ? `${Math.floor(currentFrame) + 1} / ${totalFrames}` : '— / —'}
                </span>
              </div>
            </div>
          </section>
          {resourceResult}
        </div>

        <div className="grid min-w-0 items-stretch gap-6 lg:grid-cols-2">
          <section>
            <div className="flex min-h-8 items-center gap-2 pb-3">
              <SlidersHorizontal className="size-4 text-muted-foreground" />
              <h2 className="font-mono text-sm font-semibold tracking-tight">Lottie 设置</h2>
            </div>
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">渲染库</p>
                <div className="grid grid-cols-2 rounded-md border border-border bg-background p-0.5" role="tablist" aria-label="Lottie 渲染库">
                  {([
                    ['lottie-web', 'lottie-web'],
                    ['lottie-react', 'lottie-react 2'],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={library === value}
                      onClick={() => setLibrary(value)}
                      className={cn('rounded-sm px-3 py-1.5 text-xs font-medium', library === value && 'bg-primary text-primary-foreground')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">渲染器</p>
                <div className="grid grid-cols-2 rounded-md border border-border bg-background p-0.5">
                  {(['canvas', 'svg'] as const).map(value => (
                    <button key={value} type="button" onClick={() => setRenderer(value)} className={cn('rounded-sm px-3 py-1.5 text-xs font-medium uppercase', renderer === value && 'bg-primary text-primary-foreground')}>{value}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">画布适配</p>
                <div className="grid grid-cols-2 rounded-md border border-border bg-background p-0.5">
                  {(['meet', 'slice'] as const).map(value => (
                    <button key={value} type="button" onClick={() => setFit(value)} className={cn('rounded-sm px-3 py-1.5 text-xs font-medium', fit === value && 'bg-primary text-primary-foreground')}>{value === 'meet' ? '完整显示' : '铺满裁切'}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-muted-foreground">
                  播放速度
                  <select value={speed} onChange={event => setSpeed(Number(event.target.value))} className={cn(INPUT_CLASS, 'mt-1')} aria-label="播放速度">
                    <option value={0.25}>0.25×</option>
                    <option value={0.5}>0.5×</option>
                    <option value={1}>1×</option>
                    <option value={1.5}>1.5×</option>
                    <option value={2}>2×</option>
                  </select>
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  播放方向
                  <select value={direction} onChange={event => setDirection(Number(event.target.value) as 1 | -1)} className={cn(INPUT_CLASS, 'mt-1')} aria-label="播放方向">
                    <option value={1}>正向</option>
                    <option value={-1}>反向</option>
                  </select>
                </label>
              </div>
              <div>
                <SettingRow label="循环播放" description="播放结束后从头继续"><Checkbox checked={loop} onChange={setLoop} label="循环播放" /></SettingRow>
              </div>
            </div>
          </section>

          <section className="lg:border-l lg:border-border lg:pl-6">
            <div className="flex min-h-8 items-center justify-between gap-2">
              <div className="flex min-h-8 items-center gap-2">
                <Settings2 className="size-4 text-muted-foreground" />
                <h2 className="font-mono text-sm font-semibold tracking-tight">图集设置</h2>
              </div>
              <Checkbox checked={optimizationEnabled && optimizableImageCount > 0} onChange={setOptimizationEnabled} label="纹理图集优化" disabled={!project || optimizableImageCount === 0} />
            </div>
            <p className="pb-3 text-xs text-muted-foreground">{project && excludedImageDescription ? excludedImageDescription : '开启后画布与导出均使用图集素材'}</p>
            <div>
              <div className={cn((!optimizationEnabled || !project || optimizableImageCount === 0) && 'pointer-events-none opacity-45')}>
                <label className="mb-3 block text-xs font-medium text-muted-foreground">
                  最大图集尺寸
                  <select value={options.maxSize} onChange={event => updateOption('maxSize', Number(event.target.value) as AtlasOptions['maxSize'])} className={cn(INPUT_CLASS, 'mt-1')}>
                    <option value={1024}>1024 × 1024</option>
                    <option value={2048}>2048 × 2048</option>
                    <option value={4096}>4096 × 4096</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-medium text-muted-foreground">
                    间距 padding
                    <input type="number" min={0} max={32} value={options.padding} onChange={event => updateOption('padding', Math.min(32, Math.max(0, Number(event.target.value))))} className={cn(INPUT_CLASS, 'mt-1')} />
                  </label>
                  <label className="text-xs font-medium text-muted-foreground">
                    边缘扩展 extrude
                    <input type="number" min={0} max={8} value={options.extrude} onChange={event => updateOption('extrude', Math.min(8, Math.max(0, Number(event.target.value))))} className={cn(INPUT_CLASS, 'mt-1')} />
                  </label>
                </div>
                <div className="mt-3">
                  <SettingRow label="允许旋转" description="打包时可将素材旋转 90°，通常更省空间"><Checkbox checked={options.allowRotation} onChange={value => updateOption('allowRotation', value)} label="允许旋转" /></SettingRow>
                  <SettingRow label="裁掉透明边" description="保留原始 Lottie 尺寸与定位"><Checkbox checked={options.allowTrim} onChange={value => updateOption('allowTrim', value)} label="裁掉透明边" /></SettingRow>
                  <SettingRow label="合并相同图片" description="像素完全一致的素材只存一份"><Checkbox checked={options.detectIdentical} onChange={value => updateOption('detectIdentical', value)} label="合并相同图片" /></SettingRow>
                </div>
                <button type="button" onClick={() => setAdvancedOpen(value => !value)} className="mt-3 text-xs font-semibold text-primary underline underline-offset-4">{advancedOpen ? '收起高级选项' : '展开高级选项'}</button>
                {advancedOpen && (
                  <div className="mt-2 rounded-md border border-border bg-muted/30 px-3">
                    <SettingRow label="2 的幂尺寸" description="输出 128 / 256 / 512…"><Checkbox checked={options.powerOfTwo} onChange={value => updateOption('powerOfTwo', value)} label="2 的幂尺寸" /></SettingRow>
                    <SettingRow label="正方形图集" description="宽高保持相同"><Checkbox checked={options.square} onChange={value => updateOption('square', value)} label="正方形图集" /></SettingRow>
                    <label className="block py-3 text-xs font-medium text-muted-foreground">
                      Alpha 阈值（0–255）
                      <input type="number" min={0} max={255} value={options.alphaThreshold} onChange={event => updateOption('alphaThreshold', Math.min(255, Math.max(0, Number(event.target.value))))} className={cn(INPUT_CLASS, 'mt-1')} />
                    </label>
                  </div>
                )}
              </div>
            </div>
          </section>

        </div>
      </div>

      <section className="mt-10 border-t border-border pt-4">
        <div className="pb-1">
          <h2 className="font-mono text-sm font-semibold tracking-tight">记录</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">保存完整 Lottie 素材包和优化参数，之后可以继续预览与导出。</p>
        </div>
        <div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              value={recordName}
              onChange={event => setRecordName(event.target.value)}
              placeholder={project?.name ?? '项目名称'}
              aria-label="项目名称"
              className={INPUT_CLASS}
            />
            <Button type="button" disabled={!project || busy} onClick={() => void saveRecord()}>
              {busy ? <LoaderCircle className="animate-spin" /> : <Save />}
              保存当前项目
            </Button>
          </div>
          {records.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {records.map(record => (
                <div key={record.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                  <button type="button" disabled={busy} className="min-w-0 flex-1 truncate text-left text-sm font-bold hover:underline disabled:opacity-50" title="加载项目" onClick={() => void loadRecord(record.id)}>
                    {record.recordName}
                  </button>
                  <span className="shrink-0 text-xs text-muted-foreground">{record.projectSize}</span>
                  <Button type="button" variant="ghost" size="icon-sm" disabled={busy} aria-label={`删除项目 ${record.recordName}`} onClick={() => void removeRecordItem(record.id)}>
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

    </div>
  )
}
