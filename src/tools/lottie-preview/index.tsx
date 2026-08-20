import type { ChangeEvent, DragEvent, ReactNode } from 'react'
import type { AtlasOptions, LoadedLottieProject, OptimizedLottieResult } from './types'
import {
  ArrowLeft,
  Check,
  Download,
  FileArchive,
  Film,
  FolderOpen,
  Gauge,
  ImageIcon,
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Link } from 'react-router'
import { Seo } from '@/components/seo'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DEFAULT_CHECKER_STYLE } from '@/lib/checker'

import { useStagePan, useStageZoom } from '@/lib/stage'
import { cn } from '@/lib/utils'
import { createDemoProject } from '../demos/lottie-preview'
import { disposeOptimizedResult, exportOptimizedProject, optimizeLottie } from './atlas-optimizer'
import { createPreviewAnimation, disposeProject, loadLottieProject } from './import-files'
import { LottiePreview } from './preview'
import { LottieReactPreview } from './react-preview'

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

const INPUT_CLASS = 'h-9 w-full rounded-md border-2 border-border bg-background px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50'

type LottieLibrary = 'lottie-react' | 'lottie-web'

function formatSize(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
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
          'pointer-events-none flex size-6 shrink-0 items-center justify-center rounded-sm border-2 border-border shadow-hard-xs transition-all',
          'peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50',
          'peer-enabled:hover:-translate-x-px peer-enabled:hover:-translate-y-px peer-enabled:hover:shadow-hard-sm',
          'peer-enabled:active:translate-x-0.5 peer-enabled:active:translate-y-0.5 peer-enabled:active:shadow-none',
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
    <div className="flex items-center justify-between gap-4 border-b-2 border-border/20 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-bold">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}

function Stat({ label, value }: { label: string, value: string }) {
  return (
    <div className="rounded-md border-2 border-border bg-muted/40 px-3 py-2">
      <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="font-mono text-sm font-black">{value}</p>
    </div>
  )
}

export default function LottiePreviewTool() {
  const zipInputRef = useRef<HTMLInputElement>(null)
  const directoryInputRef = useRef<HTMLInputElement>(null)
  const projectRef = useRef<LoadedLottieProject | null>(null)
  const resultRef = useRef<OptimizedLottieResult | null>(null)
  const [project, setProject] = useState<LoadedLottieProject | null>(null)
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
  const [zoom, setZoom] = useState(1)
  const stageRef = useRef<HTMLDivElement>(null)
  useStageZoom(stageRef, zoom, setZoom)
  const stagePan = useStagePan(stageRef, () => false)
  const resetStagePan = stagePan.resetPan

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
    setZoom(1)
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
    setZoom(1)
    resetStagePan()
    if (previous)
      window.setTimeout(disposeProject, 0, previous)
  }, [replaceResult, resetStagePan])

  useEffect(() => () => {
    disposeProject(projectRef.current)
    disposeOptimizedResult(resultRef.current)
  }, [])

  useEffect(() => {
    if (!project || !optimizationEnabled || project.images.size === 0 || project.warnings.length > 0) {
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
  }, [optimizationEnabled, options, project, replaceResult])

  const originalPreview = useMemo(() => project ? createPreviewAnimation(project) : null, [project])
  const shouldOptimize = Boolean(project && optimizationEnabled && project.images.size > 0 && project.warnings.length === 0)
  const activeAnimation = shouldOptimize ? (optimized?.previewAnimation ?? null) : originalPreview

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
    setOptimizing(Boolean(project && optimizationEnabled && project.warnings.length === 0))
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
    <Card className="lg:h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gauge className="size-5" />
          资源结果
        </CardTitle>
        <CardDescription>{!project ? '导入素材后显示图集与资源统计。' : project.warnings.length > 0 ? '资源路径校验未通过，请查看右上角消息。' : project.images.size === 0 ? 'data.json 没有引用可打包的图片素材。' : !optimizationEnabled ? '图集优化已关闭，画布显示原始素材。' : optimizing ? '正在重新排布图集，画布等待最新结果…' : optimized ? '画布当前显示的就是此导出结果。' : '等待图集优化结果'}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pb-6">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="原始资源" value={project ? formatSize(project.sourceBytes) : '—'} />
          <Stat label="图片数" value={project ? `${project.images.size}` : '—'} />
          <Stat label="图集数" value={optimized ? `${optimized.atlases.length}` : '—'} />
          <Stat label="占用率" value={optimized ? `${(optimized.occupancy * 100).toFixed(1)}%` : '—'} />
        </div>
        {optimized && (
          <>
            <div className="grid gap-3">
              {optimized.atlases.map(atlas => (
                <figure key={atlas.id} className="w-full">
                  <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-md border-2 border-border bg-muted">
                    <img src={atlas.objectUrl} alt={atlas.filename} className="size-full object-contain" />
                  </div>
                  <figcaption className="mt-1 truncate text-center font-mono text-[10px]">
                    {atlas.width}
                    ×
                    {atlas.height}
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <ImageIcon className="size-3.5" />
              {optimized.sourceImageCount}
              {' '}
              个引用 →
              {optimized.packedImageCount}
              {' '}
              份像素数据
            </p>
            <Button type="button" className="w-full" onClick={() => void exportProject()} disabled={busy || optimizing}>
              <Download />
              导出 ZIP
            </Button>
          </>
        )}
        {optimizing && (
          <div className="flex items-center gap-2 text-sm font-bold">
            <LoaderCircle className="size-4 animate-spin" />
            生成图集中
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <Seo
        title="Lottie 预览与图集优化"
        description="使用 lottie-web 或 lottie-react 预览动画，把分散的图片素材打包为纹理图集，并导出仍由 Lottie 播放的资源包。"
        path="/tools/lottie-preview"
      />
      <header className="flex min-h-24 items-center gap-3 py-4">
        <Button asChild variant="outline" size="icon">
          <Link to="/" aria-label="返回首页"><ArrowLeft className="size-5" /></Link>
        </Button>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md border-2 border-border bg-chart-5 shadow-hard-xs">
          <Film className="size-5" />
        </div>
        <div className="min-w-0 max-w-36 sm:max-w-none">
          <h1 className="text-lg font-black tracking-tight">Lottie 预览与图集优化</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">预览优先，按需将小图片合并成 lottie-web 可直接播放的纹理图集</p>
        </div>
      </header>

      {(error || Boolean(project?.warnings.length)) && (
        <section
          className="fixed top-24 right-4 left-4 z-[60] max-h-[calc(100vh-7rem)] space-y-3 overflow-y-auto sm:left-auto sm:w-96"
          aria-label="素材消息"
          aria-live="polite"
        >
          {error && (
            <div className="flex gap-3 rounded-md border-2 border-border bg-destructive p-4 text-destructive-foreground shadow-hard-sm" role="alert">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0">
                <p className="font-black">处理失败</p>
                <p className="mt-1 text-sm font-bold">{error}</p>
              </div>
            </div>
          )}
          {Boolean(project?.warnings.length) && (
            <div className="flex gap-3 rounded-md border-2 border-border bg-secondary p-4 text-secondary-foreground shadow-hard-sm" role="status">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-black">
                  素材警告
                  <span className="ml-2 rounded-sm border-2 border-border bg-background px-1.5 py-0.5 font-mono text-xs text-foreground">
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
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>动画预览</CardTitle>
              <CardDescription>{project ? `${project.name} · ${project.animation.w}×${project.animation.h} · ${project.animation.fr} FPS` : '导入包含 data.json 的 ZIP 或完整目录'}</CardDescription>
            </CardHeader>
            <CardContent className="pb-6">
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
                  'relative flex h-72 overflow-hidden rounded-md border-2 transition-colors sm:h-96',
                  project && (stagePan.panning ? 'cursor-grabbing' : 'cursor-grab'),
                  dragOver ? 'border-primary bg-primary/10' : 'border-border',
                  !project && 'border-dashed',
                )}
                style={DEFAULT_CHECKER_STYLE}
              >
                {activeAnimation
                  ? (
                      <div
                        className="pointer-events-none m-auto size-full shrink-0 origin-center"
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
                            <p className="font-black">{optimizing ? '正在应用图集设置' : '暂时无法生成预览'}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{optimizing ? '完成后画布会直接显示最终导出素材' : '请查看页面顶部的处理消息'}</p>
                          </div>
                        </div>
                      )
                    : (
                        <div className="m-auto flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
                          <div className="flex size-16 items-center justify-center rounded-lg border-2 border-border bg-card shadow-hard-sm">
                            <FileArchive className="size-8" />
                          </div>
                          <div>
                            <p className="font-black">把 Lottie ZIP 拖到这里</p>
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
                              试用示例
                            </Button>
                          </div>
                        </div>
                      )}
                {busy && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80">
                    <LoaderCircle className="size-7 animate-spin" />
                  </div>
                )}
                {project && (
                  <>
                    <span className="pointer-events-none absolute bottom-2 left-2 rounded-sm border-2 border-border bg-background/90 px-2 py-0.5 font-mono text-[10px] font-black shadow-hard-xs">
                      {Math.round(zoom * 100)}
                      %
                    </span>
                    {/* 加载内容后：导入按钮悬浮在画布右上角（与九宫格工具一致）；平移/缩放后出现「重置视图」 */}
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      {(stagePan.offset.x !== 0 || stagePan.offset.y !== 0 || zoom !== 1) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          title="重置视图（居中并恢复 100%）"
                          aria-label="重置视图"
                          className="bg-background/90"
                          onClick={() => {
                            stagePan.resetPan()
                            setZoom(1)
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

              {project && (
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
                  <span className="w-24 text-right font-mono text-xs font-bold">
                    {Math.floor(currentFrame) + 1}
                    {' '}
                    /
                    {' '}
                    {totalFrames}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
          {resourceResult}
        </div>

        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontal className="size-5" />
                Lottie 设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pb-6">
              <div>
                <p className="mb-1.5 text-xs font-bold text-muted-foreground">渲染库</p>
                <div className="grid grid-cols-2 rounded-md border-2 border-border bg-background p-0.5" role="tablist" aria-label="Lottie 渲染库">
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
                      className={cn('rounded-sm px-3 py-1.5 text-xs font-bold', library === value && 'bg-primary text-primary-foreground')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-bold text-muted-foreground">渲染器</p>
                <div className="grid grid-cols-2 rounded-md border-2 border-border bg-background p-0.5">
                  {(['canvas', 'svg'] as const).map(value => (
                    <button key={value} type="button" onClick={() => setRenderer(value)} className={cn('rounded-sm px-3 py-1.5 text-xs font-bold uppercase', renderer === value && 'bg-primary text-primary-foreground')}>{value}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-bold text-muted-foreground">画布适配</p>
                <div className="grid grid-cols-2 rounded-md border-2 border-border bg-background p-0.5">
                  {(['meet', 'slice'] as const).map(value => (
                    <button key={value} type="button" onClick={() => setFit(value)} className={cn('rounded-sm px-3 py-1.5 text-xs font-bold', fit === value && 'bg-primary text-primary-foreground')}>{value === 'meet' ? '完整显示' : '铺满裁切'}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-muted-foreground">
                  播放速度
                  <select value={speed} onChange={event => setSpeed(Number(event.target.value))} className={cn(INPUT_CLASS, 'mt-1')} aria-label="播放速度">
                    <option value={0.25}>0.25×</option>
                    <option value={0.5}>0.5×</option>
                    <option value={1}>1×</option>
                    <option value={1.5}>1.5×</option>
                    <option value={2}>2×</option>
                  </select>
                </label>
                <label className="text-xs font-bold text-muted-foreground">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="size-5" />
                图集设置
              </CardTitle>
              <CardDescription>开启后画布与导出均使用图集素材</CardDescription>
              <CardAction><Checkbox checked={optimizationEnabled} onChange={setOptimizationEnabled} label="纹理图集优化" disabled={!project} /></CardAction>
            </CardHeader>
            <CardContent className="pb-6">
              <div className={cn((!optimizationEnabled || !project) && 'pointer-events-none opacity-45')}>
                <label className="mb-3 block text-xs font-bold text-muted-foreground">
                  最大图集尺寸
                  <select value={options.maxSize} onChange={event => updateOption('maxSize', Number(event.target.value) as AtlasOptions['maxSize'])} className={cn(INPUT_CLASS, 'mt-1')}>
                    <option value={1024}>1024 × 1024</option>
                    <option value={2048}>2048 × 2048</option>
                    <option value={4096}>4096 × 4096</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-bold text-muted-foreground">
                    间距 padding
                    <input type="number" min={0} max={32} value={options.padding} onChange={event => updateOption('padding', Math.min(32, Math.max(0, Number(event.target.value))))} className={cn(INPUT_CLASS, 'mt-1')} />
                  </label>
                  <label className="text-xs font-bold text-muted-foreground">
                    边缘扩展 extrude
                    <input type="number" min={0} max={8} value={options.extrude} onChange={event => updateOption('extrude', Math.min(8, Math.max(0, Number(event.target.value))))} className={cn(INPUT_CLASS, 'mt-1')} />
                  </label>
                </div>
                <div className="mt-3">
                  <SettingRow label="允许旋转" description="打包时可将素材旋转 90°，通常更省空间"><Checkbox checked={options.allowRotation} onChange={value => updateOption('allowRotation', value)} label="允许旋转" /></SettingRow>
                  <SettingRow label="裁掉透明边" description="保留原始 Lottie 尺寸与定位"><Checkbox checked={options.allowTrim} onChange={value => updateOption('allowTrim', value)} label="裁掉透明边" /></SettingRow>
                  <SettingRow label="合并相同图片" description="像素完全一致的素材只存一份"><Checkbox checked={options.detectIdentical} onChange={value => updateOption('detectIdentical', value)} label="合并相同图片" /></SettingRow>
                </div>
                <button type="button" onClick={() => setAdvancedOpen(value => !value)} className="mt-3 text-xs font-black text-primary underline underline-offset-4">{advancedOpen ? '收起高级选项' : '展开高级选项'}</button>
                {advancedOpen && (
                  <div className="mt-2 rounded-md border-2 border-border bg-muted/30 px-3">
                    <SettingRow label="2 的幂尺寸" description="输出 128 / 256 / 512…"><Checkbox checked={options.powerOfTwo} onChange={value => updateOption('powerOfTwo', value)} label="2 的幂尺寸" /></SettingRow>
                    <SettingRow label="正方形图集" description="宽高保持相同"><Checkbox checked={options.square} onChange={value => updateOption('square', value)} label="正方形图集" /></SettingRow>
                    <label className="block py-3 text-xs font-bold text-muted-foreground">
                      Alpha 阈值（0–255）
                      <input type="number" min={0} max={255} value={options.alphaThreshold} onChange={event => updateOption('alphaThreshold', Math.min(255, Math.max(0, Number(event.target.value))))} className={cn(INPUT_CLASS, 'mt-1')} />
                    </label>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

        </div>
      </div>

    </div>
  )
}
