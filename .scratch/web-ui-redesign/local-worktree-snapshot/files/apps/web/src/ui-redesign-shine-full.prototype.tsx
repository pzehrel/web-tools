import type { CSSProperties, ReactNode } from 'react'

import { Check, Copy, MousePointer2, Play, RotateCcw, Sparkles, Upload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

import { cn } from '@/lib/utils'
/**
 * Complete-function throwaway UI study; processing engines remain unchanged.
 * 完整功能的临时 UI 研究；处理引擎保持原样。
 */
import './ui-redesign-shine-full.prototype.scss'
import './tools/css-shine/index.scss'

type Trigger = 'auto' | 'hover'
type Direction = 'right' | 'left'
type PreviewShape = 'card' | 'button' | 'badge' | 'image'

interface ShineConfig {
  duration: number
  delay: number
  width: number
  intensity: number
  tilt: number
}

interface UploadedImage {
  name: string
  url: string
}

const DEFAULT_CONFIG: ShineConfig = {
  duration: 1.6,
  delay: 0.8,
  width: 24,
  intensity: 60,
  tilt: -18,
}

const PRESETS: { name: string, config: ShineConfig }[] = [
  {
    name: '轻快',
    config: { duration: 0.9, delay: 0.5, width: 18, intensity: 72, tilt: -22 },
  },
  {
    name: '柔和',
    config: { duration: 2.4, delay: 1.4, width: 34, intensity: 38, tilt: -12 },
  },
  {
    name: '醒目',
    config: { duration: 1.3, delay: 0.6, width: 28, intensity: 82, tilt: -28 },
  },
]

function OptionGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T, label: string, icon?: ReactNode }[]
  onChange: (value: T) => void
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div role="radiogroup" aria-label={label} className="grid grid-cols-2 overflow-hidden border border-border">
        {options.map(option => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex h-8 items-center justify-center gap-1.5 text-xs font-medium transition-colors',
              value === option.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-secondary',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  suffix: string
  onChange: (value: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span>{label}</span>
        <output className="rounded-sm border border-border bg-secondary px-1.5 py-0.5 font-mono text-foreground">
          {value}
          {suffix}
        </output>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={event => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer accent-primary"
      />
    </label>
  )
}

function ShinePreview({
  children,
  className,
  layerClassName,
  style,
  trigger,
  direction,
  tabIndex,
}: {
  children: ReactNode
  className?: string
  layerClassName?: string
  style: CSSProperties
  trigger: Trigger
  direction: Direction
  tabIndex?: number
}) {
  return (
    <div
      tabIndex={tabIndex}
      data-trigger={trigger}
      data-direction={direction}
      style={style}
      className={cn('shine-preview-wrap max-w-full', className)}
    >
      {children}
      <span aria-hidden="true" className={cn('shine-preview-layer', layerClassName)}>
        <span className="shine-preview-beam" />
      </span>
    </div>
  )
}

function cssNumber(value: number) {
  return Number(value.toFixed(2))
}

function buildCss(config: ShineConfig, trigger: Trigger, direction: Direction) {
  // translateX 的百分比以光带自身宽度为基准。两端各多留 150% 光带宽度，
  // 保留旋转光带的自然形状，同时让首尾帧完整落在可视区域之外。
  const travel = Math.ceil(10000 / config.width) + 250
  const start = direction === 'right' ? '-150%' : `${travel}%`
  const end = direction === 'right' ? `${travel}%` : '-150%'
  const animationTarget = trigger === 'auto'
    ? '.shine-beam'
    : '.shine-wrap:hover .shine-beam,\n.shine-wrap:focus-within .shine-beam'
  const repeat = trigger === 'auto' ? 'infinite' : '1'
  const delay = trigger === 'auto' ? `${cssNumber(config.delay)}s` : '0s'

  return `/* 动效只写在包装层；目标元素原有样式无需修改。 */
.shine-wrap {
  position: relative;
  display: inline-grid;
  max-width: 100%;
  isolation: isolate;
}

.shine-layer {
  position: absolute;
  z-index: 1;
  inset: 0;
  overflow: hidden;
  border-radius: var(--shine-radius, 0);
  pointer-events: none;
  -webkit-mask-image: var(
    --shine-mask,
    linear-gradient(rgb(0 0 0) 0 0)
  );
  mask-image: var(
    --shine-mask,
    linear-gradient(rgb(0 0 0) 0 0)
  );
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
}

.shine-beam {
  position: absolute;
  top: -75%;
  bottom: -75%;
  left: -${config.width}%;
  width: ${config.width}%;
  background: linear-gradient(
    90deg,
    transparent,
    rgb(255 255 255 / ${config.intensity}%),
    transparent
  );
  transform: translateX(${start}) rotate(${config.tilt}deg);
}

${animationTarget} {
  animation: shine-sweep ${cssNumber(config.duration)}s ease-in-out ${delay} ${repeat};
}

@keyframes shine-sweep {
  from { transform: translateX(${start}) rotate(${config.tilt}deg); }
  to { transform: translateX(${end}) rotate(${config.tilt}deg); }
}

@media (prefers-reduced-motion: reduce) {
  .shine-beam { animation: none; }
}`
}

function buildMarkup(shape: PreviewShape, imageName?: string) {
  const layer = `  <span class="shine-layer" aria-hidden="true">\n    <span class="shine-beam"></span>\n  </span>`

  if (shape === 'image') {
    const fileName = (imageName || 'your-image.png').replace(/[<>"']/g, '')
    return `<!-- --shine-mask 使用同一张图片的 Alpha 通道裁切扫光。 -->
<span
  class="shine-wrap"
  style="--shine-mask: url('./${fileName}')"
>
  <img class="your-existing-classes" src="./${fileName}" alt="">
${layer}
</span>`
  }

  const radius = shape === 'badge' ? '999px' : shape === 'card' ? '0.75rem' : '0.375rem'
  const target = shape === 'button'
    ? '  <button class="your-existing-classes">立即体验</button>'
    : shape === 'badge'
      ? '  <span class="your-existing-classes">限时特惠</span>'
      : '  <article class="your-existing-classes">原有卡片内容</article>'
  const wrapper = shape === 'card' ? 'div' : 'span'

  return `<!-- 原元素的 class、style 和伪元素保持不变。 -->
<${wrapper} class="shine-wrap" style="--shine-radius: ${radius}">
${target}
${layer}
</${wrapper}>`
}

export default function ShineFullPrototype() {
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [trigger, setTrigger] = useState<Trigger>('auto')
  const [direction, setDirection] = useState<Direction>('right')
  const [shape, setShape] = useState<PreviewShape>('card')
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [replayKey, setReplayKey] = useState(0)
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const css = useMemo(() => buildCss(config, trigger, direction), [config, direction, trigger])
  const markup = useMemo(() => buildMarkup(shape, uploadedImage?.name), [shape, uploadedImage?.name])
  const code = `${css}\n\n${markup}`
  const previewStyle = {
    '--shine-duration': `${config.duration}s`,
    '--shine-delay': `${config.delay}s`,
    '--shine-width': `${config.width}%`,
    '--shine-tilt': `${config.tilt}deg`,
    '--shine-travel': `${Math.ceil(10000 / config.width) + 250}%`,
    '--shine-color': `color-mix(in oklab, var(--primary-foreground) ${config.intensity}%, transparent)`,
  } as CSSProperties
  const imagePreviewStyle = uploadedImage
    ? { ...previewStyle, '--shine-mask': `url("${uploadedImage.url}")` } as CSSProperties
    : previewStyle

  useEffect(() => {
    return () => {
      if (uploadedImage)
        URL.revokeObjectURL(uploadedImage.url)
    }
  }, [uploadedImage])

  const updateConfig = (patch: Partial<ShineConfig>) => {
    setConfig(current => ({ ...current, ...patch }))
  }

  const copyCss = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopyState('copied')
    }
    catch {
      setCopyState('failed')
    }
    window.setTimeout(setCopyState, 1400, 'idle')
  }

  const selectImage = (file?: File) => {
    if (!file)
      return
    setUploadedImage({ name: file.name, url: URL.createObjectURL(file) })
    setShape('image')
    setReplayKey(key => key + 1)
  }

  return (
    <div className="full-shine-prototype">

      <main className="shine-full-layout">
        <div className="shine-full-stage">
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
              <div>
                <h2 className="font-mono text-sm font-semibold tracking-tight">实时预览</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {trigger === 'hover' ? '把鼠标移到样例上触发扫光。' : '每次调整参数都会重新播放。'}
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/webp,image/svg+xml,.png,.webp,.svg"
                  className="sr-only"
                  onChange={(event) => {
                    selectImage(event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
                {shape === 'image' && (
                  <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <Upload />
                    {uploadedImage ? '换图' : '上传'}
                  </Button>
                )}
                <Button type="button" size="sm" variant="outline" onClick={() => setReplayKey(key => key + 1)}>
                  <RotateCcw />
                  重播
                </Button>
              </div>
            </div>
            <div>
              <div className="flex aspect-[3/2] items-center justify-center overflow-hidden border border-border bg-muted p-4 sm:p-8">
                {shape === 'card' && (
                  <ShinePreview
                    key={`card-${replayKey}-${JSON.stringify(config)}-${trigger}-${direction}`}
                    tabIndex={trigger === 'hover' ? 0 : undefined}
                    trigger={trigger}
                    direction={direction}
                    style={previewStyle}
                    className="w-full max-w-[24rem]"
                    layerClassName="rounded-lg"
                  >
                    <article className="w-full rounded-lg border border-border bg-primary p-6 text-primary-foreground">
                      <span className="inline-flex -rotate-2 items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground">
                        <Sparkles className="size-3.5" />
                        NEW
                      </span>
                      <h2 className="mt-5 text-3xl font-semibold tracking-tight">灵感正在发光</h2>
                      <p className="mt-2 text-sm opacity-85">一束克制的高光，让重要内容被看见。</p>
                    </article>
                  </ShinePreview>
                )}

                {shape === 'button' && (
                  <ShinePreview
                    key={`button-${replayKey}-${JSON.stringify(config)}-${trigger}-${direction}`}
                    trigger={trigger}
                    direction={direction}
                    style={previewStyle}
                    layerClassName="rounded-md"
                  >
                    <button
                      type="button"
                      className="rounded-md border border-border bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground "
                    >
                      立即体验
                    </button>
                  </ShinePreview>
                )}

                {shape === 'badge' && (
                  <ShinePreview
                    key={`badge-${replayKey}-${JSON.stringify(config)}-${trigger}-${direction}`}
                    tabIndex={trigger === 'hover' ? 0 : undefined}
                    trigger={trigger}
                    direction={direction}
                    style={previewStyle}
                    className="-rotate-2"
                    layerClassName="rounded-full"
                  >
                    <span className="rounded-full border border-border bg-primary px-7 py-3 text-xl font-semibold text-primary-foreground">
                      限时特惠
                    </span>
                  </ShinePreview>
                )}

                {shape === 'image' && uploadedImage && (
                  <ShinePreview
                    key={`image-${replayKey}-${uploadedImage.url}-${JSON.stringify(config)}-${trigger}-${direction}`}
                    tabIndex={trigger === 'hover' ? 0 : undefined}
                    trigger={trigger}
                    direction={direction}
                    style={imagePreviewStyle}
                  >
                    <img
                      src={uploadedImage.url}
                      alt={uploadedImage.name}
                      className="block max-h-56 max-w-full object-contain"
                    />
                  </ShinePreview>
                )}

                {shape === 'image' && !uploadedImage && (
                  <div className="flex max-w-sm flex-col items-center rounded-lg border border-dashed border-border bg-card p-8 text-center">
                    <div className="flex size-12 items-center justify-center rounded-md border border-border bg-chart-3">
                      <Upload className="size-5 text-accent-foreground" />
                    </div>
                    <p className="mt-4 font-bold">上传透明背景图片</p>
                    <p className="mt-1 text-sm text-muted-foreground">支持 PNG、WebP、SVG，扫光会沿 Alpha 轮廓裁切。</p>
                    <Button type="button" size="sm" className="mt-4" onClick={() => fileInputRef.current?.click()}>
                      选择图片
                    </Button>
                  </div>
                )}
              </div>
              <div role="radiogroup" aria-label="预览样式" className="grid grid-cols-4 border-t border-border">
                {([
                  ['card', '卡片'],
                  ['button', '按钮'],
                  ['badge', '徽章'],
                  ['image', '异形图片'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={shape === value}
                    onClick={() => setShape(value)}
                    className={cn(
                      'h-11 border-r border-border text-xs font-medium transition-colors last:border-r-0 sm:text-sm',
                      shape === value ? 'bg-secondary text-secondary-foreground' : 'bg-card hover:bg-muted',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>
          <section className="shine-full-code">
            <div className="flex items-center justify-between gap-3 pb-3">
              <div>
                <h2 className="font-mono text-sm font-semibold tracking-tight">可用代码</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">动效放在独立覆盖层，目标元素的原有样式保持不变。</p>
              </div>
              <Button type="button" variant="outline" size="icon-sm" title={copyState === 'copied' ? '已复制' : copyState === 'failed' ? '复制失败' : '复制代码'} aria-label="复制代码" onClick={() => void copyCss()}>
                {copyState === 'copied' ? <Check /> : <Copy />}
              </Button>
            </div>
            <div>
              <pre className="max-h-96 overflow-auto border border-border bg-muted p-3 font-mono text-xs leading-5"><code>{code}</code></pre>
            </div>
          </section>
        </div>
        <div className="shine-full-controls">
          <section>
            <div className="pb-3">
              <h2 className="font-mono text-sm font-semibold tracking-tight">动效参数</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">从预设起步，再把节奏调到刚刚好。</p>
            </div>
            <div className="space-y-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">预设</p>
                <div className="grid grid-cols-3 gap-2">
                  {PRESETS.map(preset => (
                    <Button
                      key={preset.name}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setConfig(preset.config)}
                    >
                      {preset.name}
                    </Button>
                  ))}
                </div>
              </div>

              <OptionGroup
                label="触发方式"
                value={trigger}
                onChange={setTrigger}
                options={[
                  { value: 'auto', label: '自动循环', icon: <Play className="size-3.5" /> },
                  { value: 'hover', label: '悬停触发', icon: <MousePointer2 className="size-3.5" /> },
                ]}
              />
              <OptionGroup
                label="扫光方向"
                value={direction}
                onChange={setDirection}
                options={[
                  { value: 'right', label: '从左到右' },
                  { value: 'left', label: '从右到左' },
                ]}
              />

              <div className="grid gap-4">
                <RangeField label="单次时长" value={config.duration} min={0.6} max={4} step={0.1} suffix="s" onChange={duration => updateConfig({ duration })} />
                <RangeField label="循环间隔" value={config.delay} min={0} max={4} step={0.1} suffix="s" onChange={delay => updateConfig({ delay })} />
                <RangeField label="光带宽度" value={config.width} min={8} max={55} step={1} suffix="%" onChange={width => updateConfig({ width })} />
                <RangeField label="光带亮度" value={config.intensity} min={10} max={90} step={1} suffix="%" onChange={intensity => updateConfig({ intensity })} />
                <RangeField label="倾斜角度" value={config.tilt} min={-40} max={40} step={1} suffix="°" onChange={tilt => updateConfig({ tilt })} />
              </div>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                size="sm"
                onClick={() => {
                  setConfig(DEFAULT_CONFIG)
                  setTrigger('auto')
                  setDirection('right')
                }}
              >
                <RotateCcw />
                恢复默认
              </Button>
            </div>
          </section>

        </div>
      </main>
    </div>
  )
}
