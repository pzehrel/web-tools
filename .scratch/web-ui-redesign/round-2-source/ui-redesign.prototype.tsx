/**
 * Throwaway UI study: two layouts on existing routes, selected by ?variant=D|E.
 * Edits stay in memory. This module is loaded only by the development layout.
 *
 * 临时 UI 研究：现有路由通过 ?variant=D|E 选择两种布局。
 * 编辑仅保存在内存中。本模块仅由开发环境的布局载入。
 */
import type { CSSProperties, ReactNode } from 'react'
import { ArrowDownToLine, ArrowRight, Check, ChevronDown, ChevronRight, Copy, Film, Frame, Grid2X2, Images, Link2, Maximize, Moon, Pause, Play, Plus, QrCode, RotateCcw, ScanLine, Sun, Upload, X } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { PrototypeSwitcher } from '@/components/prototype-switcher'
import { Button } from '@/components/ui/button'
import { useStagePan, useStageZoom } from '@/lib/stage'
import './ui-redesign.prototype.scss'

type Page = 'home' | 'url' | 'nine' | 'frames'
type Variant = 'D' | 'E'
interface PrototypeProps {
  page: Page
  variant: Variant
  href: (path: string) => string
  heading: string
  description: string
  input: ReactNode
  controls: ReactNode
  preview: ReactNode
  result: ReactNode
  action: ReactNode
}

const toolItems = [
  { name: 'URL 与二维码', path: '/tools/url-qrcode', icon: Link2, detail: '解析链接、编辑参数、生成二维码', kind: 'url' },
  { name: '帧动画', path: '/tools/frame-animation', icon: Film, detail: '整理序列帧，预览并导出动画素材', kind: 'frames' },
  { name: 'Lottie 预览', path: '/tools/lottie-preview', icon: Images, detail: '检查动画效果，优化图片素材', kind: 'lottie' },
  { name: '点九图', path: '/tools/nine-patch', icon: Frame, detail: '设置拉伸区域，生成九宫格 CSS', kind: 'nine' },
]
const sampleUrl = 'https://example.com/product?source=webtools&theme=light&lang=zh-CN'
const slices = ['上', '右', '下', '左']
const pageLabels = { home: '首页', url: 'URL 与二维码', nine: '点九图', frames: '帧动画' }

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function Flower({ step = 0, small = false }: { step?: number, small?: boolean }) {
  return (
    <svg className={small ? 'proto-flower small' : 'proto-flower'} viewBox="0 0 240 240" aria-label="花形序列帧示例" role="img">
      <g transform={`rotate(${step * 12} 120 120)`} fill="currentColor">
        {[0, 60, 120, 180, 240, 300].map(angle => <ellipse key={angle} cx="120" cy="77" rx="29" ry="48" transform={`rotate(${angle} 120 120)`} opacity="0.85" />)}
      </g>
      <circle cx="120" cy="120" r="27" className="proto-flower-center" />
    </svg>
  )
}

function ToolGlyph({ kind }: { kind: string }) {
  if (kind === 'frames') {
    return (
      <div className="proto-glyph proto-glyph-frames">
        <Flower small />
        <span>01 — 08</span>
      </div>
    )
  }
  if (kind === 'nine') {
    return (
      <div className="proto-glyph proto-glyph-nine">
        <div>
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    )
  }
  if (kind === 'lottie') {
    return (
      <div className="proto-glyph proto-glyph-lottie">
        <Play size={36} strokeWidth={1.5} />
        <span>JSON / ZIP</span>
      </div>
    )
  }
  return (
    <div className="proto-glyph proto-glyph-url">
      <span>https://</span>
      <QrCode size={42} strokeWidth={1.25} />
      <span>?key=value</span>
    </div>
  )
}

function ToolLink({ tool, href, children }: { tool: typeof toolItems[number], href: PrototypeProps['href'], children: ReactNode }) {
  return <Link to={tool.kind === 'lottie' ? tool.path : href(tool.path)}>{children}</Link>
}

function Region({ title, note, children, className = '' }: { title: string, note?: string, children: ReactNode, className?: string }) {
  return (
    <section className={`proto-region ${className}`}>
      <div className="proto-region-heading">
        <h2>{title}</h2>
        {note && <span>{note}</span>}
      </div>
      {children}
    </section>
  )
}

function VariantD(props: PrototypeProps) {
  if (props.page === 'home') {
    return (
      <main className="native-home">
        <div className="native-home-heading">
          <h1>工具</h1>
          <span>4 个工具</span>
        </div>
        <nav className="native-launcher" aria-label="工具目录">
          {toolItems.map(tool => (
            <ToolLink key={tool.kind} tool={tool} href={props.href}>
              <div className={`native-app-icon native-icon-${tool.kind}`}><tool.icon size={36} strokeWidth={1.6} /></div>
              <h2>{tool.name}</h2>
              <p>{tool.detail}</p>
            </ToolLink>
          ))}
        </nav>
      </main>
    )
  }
  return (
    <main className="native-work">
      <div className="native-work-toolbar">
        <div>
          <h1>{props.heading}</h1>
          <span>{props.description}</span>
        </div>
        {props.action}
      </div>
      <div className={`native-work-area ${props.page === 'url' ? 'is-url' : ''}`}>
        <div className="native-viewport">{props.preview}</div>
        <aside className="native-inspector" aria-label="工具参数">
          {props.input}
          {props.controls}
          <details className="native-output">
            <summary>
              查看输出
              <ChevronDown size={14} />
            </summary>
            {props.result}
          </details>
        </aside>
      </div>
    </main>
  )
}

function VariantE(props: PrototypeProps) {
  const [selected, setSelected] = useState(0)
  const [tab, setTab] = useState<'edit' | 'preview' | 'result'>(props.page === 'url' ? 'edit' : 'preview')
  const chosen = toolItems[selected]
  const tabs = [{ key: 'edit', label: '输入与参数' }, { key: 'preview', label: '预览' }, { key: 'result', label: '输出' }] as const
  if (props.page === 'home') {
    return (
      <main className="graphic-home">
        <div className="graphic-home-heading">
          <h1>工具箱</h1>
          <span>04</span>
        </div>
        <div className="graphic-catalog">
          <nav className="graphic-tools" aria-label="工具目录">
            {toolItems.map((tool, index) => (
              <Link
                key={tool.kind}
                to={tool.kind === 'lottie' ? tool.path : props.href(tool.path)}
                className={selected === index ? 'is-selected' : ''}
                onMouseEnter={() => setSelected(index)}
                onFocus={() => setSelected(index)}
              >
                <span className="graphic-tool-number">
                  0
                  {index + 1}
                </span>
                <div>
                  <h2>{tool.name}</h2>
                  <p>{tool.detail}</p>
                </div>
                <ArrowRight size={21} />
              </Link>
            ))}
          </nav>
          <div className={`graphic-cover graphic-cover-${chosen.kind}`}>
            <div className="graphic-cover-caption">
              <chosen.icon size={18} />
              <span>{chosen.name}</span>
              <span>
                0
                {selected + 1}
              </span>
            </div>
            <div className="graphic-cover-art">
              <ToolGlyph kind={chosen.kind} />
              <div className="graphic-orbit orbit-one" />
              <div className="graphic-orbit orbit-two" />
            </div>
            <ToolLink tool={chosen} href={props.href}>
              <span>
                打开
                {chosen.name}
              </span>
              <ArrowRight size={22} />
            </ToolLink>
          </div>
        </div>
      </main>
    )
  }
  return (
    <main className="graphic-work">
      <div className="graphic-work-heading">
        <div>
          <span className="graphic-work-index">{props.page === 'url' ? '01' : props.page === 'frames' ? '02' : '04'}</span>
          <h1>{props.heading}</h1>
        </div>
        <p>{props.description}</p>
      </div>
      <nav className="graphic-view-tabs" role="tablist" aria-label="工作视图">
        {tabs.map((item, index) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            id={`view-tab-${item.key}`}
            aria-controls="prototype-work-content"
            aria-selected={tab === item.key}
            tabIndex={tab === item.key ? 0 : -1}
            onClick={() => setTab(item.key)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault()
                const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]
                setTab(next.key)
                document.getElementById(`view-tab-${next.key}`)?.focus()
              }
            }}
          >
            <span>
              0
              {index + 1}
            </span>
            {item.label}
          </button>
        ))}
      </nav>
      <div id="prototype-work-content" role="tabpanel" aria-labelledby={`view-tab-${tab}`} className={`graphic-content graphic-content-${tab}`}>
        {tab === 'edit'
          ? (
              <div className="graphic-edit-grid">
                {props.input}
                {props.controls}
              </div>
            )
          : tab === 'preview' ? props.preview : props.result}
      </div>
      <div className="graphic-work-bottom">
        <span>{tab === 'edit' ? '设置参数后，切换到预览检查效果。' : tab === 'preview' ? '检查完成后，可直接获取输出。' : '输出与当前设置保持同步。'}</span>
        <div>
          {tab !== 'edit' && <Button variant="outline" onClick={() => setTab('edit')}>调整参数</Button>}
          {tab === 'edit'
            ? (
                <Button onClick={() => setTab('preview')}>
                  查看预览
                  <ArrowRight />
                </Button>
              )
            : props.action}
        </div>
      </div>
    </main>
  )
}

function CanvasStage({ children, resetKey }: { children: ReactNode, resetKey: string }) {
  const stageRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const { zoomIndicatorVisible } = useStageZoom(stageRef, zoom, setZoom)
  const { offset: pan, resetPan, panHandlers } = useStagePan(stageRef, () => false)
  return (
    <div ref={stageRef} className="proto-stage" {...panHandlers}>
      <div className="proto-stage-content" key={resetKey} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>{children}</div>
      <Button
        className="proto-stage-reset"
        variant="outline"
        size="icon-sm"
        aria-label="重置视图"
        onClick={() => {
          setZoom(1)
          resetPan()
        }}
      >
        <Maximize />
      </Button>
      <span className="proto-stage-hint">拖动平移 · 滚轮缩放</span>
      {zoomIndicatorVisible && (
        <span className="proto-zoom">
          {Math.round(zoom * 100)}
          %
        </span>
      )}
    </div>
  )
}

export default function UiRedesignPrototype() {
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const candidate = params.get('variant')
  const variant: Variant = candidate === 'E' ? 'E' : 'D'
  const page: Page = location.pathname.includes('nine-patch') ? 'nine' : location.pathname.includes('frame-animation') ? 'frames' : location.pathname.includes('url-') ? 'url' : 'home'
  const href = (path: string) => `${path}?variant=${variant}`
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [urlValue, setUrlValue] = useState(sampleUrl)
  const [qrResult, setQrResult] = useState({ data: '', input: '', size: '' })
  const [qrSize, setQrSize] = useState('240')
  const [toast, setToast] = useState('')
  const [bounds, setBounds] = useState([24, 24, 24, 24])
  const [guides, setGuides] = useState(true)
  const [asset, setAsset] = useState('')
  const [assetName, setAssetName] = useState('message-bubble.png')
  const [frameImages, setFrameImages] = useState<string[]>([])
  const [fps, setFps] = useState(12)
  const [playing, setPlaying] = useState(true)
  const [activeFrame, setActiveFrame] = useState(0)
  const [previewWidth, setPreviewWidth] = useState(300)
  const uploadRef = useRef<HTMLInputElement>(null)
  const toolMenuRef = useRef<HTMLDetailsElement>(null)
  const objectUrlsRef = useRef<string[]>([])
  const qr = qrResult.input === urlValue && qrResult.size === qrSize ? qrResult.data : ''
  const frameCount = frameImages.length || 8
  let parsed: URL | null = null
  try {
    parsed = new URL(urlValue)
  }
  catch {
    parsed = null
  }

  useEffect(() => {
    const original = document.documentElement.classList.contains('dark')
    return () => {
      document.documentElement.classList.toggle('dark', original)
    }
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  useEffect(() => {
    toolMenuRef.current?.removeAttribute('open')
  }, [location.pathname])
  useEffect(() => {
    if (candidate !== 'D' && candidate !== 'E') {
      const next = new URLSearchParams(params)
      next.set('variant', 'D')
      setParams(next, { replace: true, preventScrollReset: true })
    }
  }, [candidate, params, setParams])
  useEffect(() => {
    let cancelled = false
    if (urlValue.trim()) {
      QRCode.toDataURL(urlValue, { width: Number(qrSize), margin: 1 }).then((value) => {
        if (!cancelled)
          setQrResult({ data: value, input: urlValue, size: qrSize })
      }).catch(() => {
        if (!cancelled)
          setQrResult({ data: '', input: urlValue, size: qrSize })
      })
    }
    return () => {
      cancelled = true
    }
  }, [urlValue, qrSize])
  useEffect(() => {
    if (page !== 'frames' || !playing)
      return
    const timer = setInterval(() => setActiveFrame(previous => (previous + 1) % frameCount), 1000 / fps)
    return () => clearInterval(timer)
  }, [fps, playing, frameCount, page])
  useEffect(() => {
    if (!toast)
      return
    const timer = setTimeout(setToast, 2400, '')
    return () => clearTimeout(timer)
  }, [toast])
  useEffect(() => () => objectUrlsRef.current.forEach(url => URL.revokeObjectURL(url)), [])

  const notifyCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setToast('已复制到剪贴板')
    }
    catch {
      setToast('浏览器未允许复制，请手动选择结果')
    }
  }
  const cssText = `.message {\n  border: 24px solid transparent;\n  border-image-source: url("${assetName}");\n  border-image-slice: ${bounds.join(' ')} fill;\n  border-image-width: ${bounds.map(value => `${value}px`).join(' ')};\n  border-image-repeat: stretch;\n}`
  const importFiles = (files: File[]) => {
    const images = files.filter(file => file.type.startsWith('image/'))
    if (!images.length)
      return
    const urls = images.map((file) => {
      const url = URL.createObjectURL(file)
      objectUrlsRef.current.push(url)
      return url
    })
    if (page === 'frames') {
      setFrameImages(urls)
      setActiveFrame(0)
      setToast(`已导入 ${urls.length} 张图片`)
    }
    else {
      setAsset(urls[0])
      setAssetName(images[0].name)
      setToast('已更换图片')
    }
  }
  const exportSprite = async () => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context)
      return
    canvas.width = 240 * frameCount
    canvas.height = 240
    const color = getComputedStyle(document.documentElement).getPropertyValue('--primary')
    for (let index = 0; index < frameCount; index++) {
      if (frameImages.length) {
        const image = new Image()
        image.src = frameImages[index]
        await image.decode()
        const scale = Math.min(240 / image.width, 240 / image.height)
        context.drawImage(image, index * 240 + (240 - image.width * scale) / 2, (240 - image.height * scale) / 2, image.width * scale, image.height * scale)
      }
      else {
        context.save()
        context.translate(index * 240 + 120, 120)
        context.rotate(index * 12 * Math.PI / 180)
        context.fillStyle = color
        context.globalAlpha = 0.85
        for (let petal = 0; petal < 6; petal++) {
          context.rotate(Math.PI / 3)
          context.beginPath()
          context.ellipse(0, -43, 29, 48, 0, 0, Math.PI * 2)
          context.fill()
        }
        context.restore()
      }
    }
    canvas.toBlob((blob) => {
      if (blob) {
        download(blob, 'prototype-sprite.png')
        setToast('已导出原型精灵图')
      }
    })
  }

  const input = page === 'url'
    ? (
        <Region title="输入链接" note="即时解析">
          <label className="proto-field">
            <span>URL</span>
            <textarea aria-label="输入 URL" spellCheck={false} value={urlValue} onChange={event => setUrlValue(event.target.value)} rows={4} />
          </label>
          <div className="proto-inline-actions">
            <Button size="sm" variant="ghost" onClick={() => setUrlValue(sampleUrl)}>
              <RotateCcw />
              载入示例
            </Button>
            <span>{parsed ? '链接格式有效' : '请输入完整 URL'}</span>
          </div>
        </Region>
      )
    : (
        <Region title={page === 'frames' ? '序列帧' : '源图片'} note={page === 'frames' ? `${frameCount} 帧` : '图片'}>
          <div className="proto-file">
            <span className="proto-file-icon">{page === 'frames' ? <Film /> : <Frame />}</span>
            <div>
              <strong>{page === 'frames' ? (frameImages.length ? '已导入的序列帧' : 'flower-sequence') : assetName}</strong>
              <span>{page === 'frames' ? `${frameCount} 张图片 · ${frameImages.length ? '已导入' : '内置示例'}` : asset ? '已导入' : '240 × 160 · 内置示例'}</span>
            </div>
            <Button variant="ghost" size="icon-sm" aria-label="更换素材" onClick={() => uploadRef.current?.click()}><Upload /></Button>
          </div>
          <Button className="proto-upload" variant="outline" onClick={() => uploadRef.current?.click()}>
            <Plus />
            {page === 'frames' ? '导入序列帧' : '更换图片'}
          </Button>
          {page === 'frames' && (
            <div className="proto-frame-strip">
              {Array.from({ length: frameCount }, (_, index) => (
                <button
                  type="button"
                  key={frameImages[index] || `sample-${index}`}
                  className={index === activeFrame ? 'is-active' : ''}
                  aria-label={`查看第 ${index + 1} 帧`}
                  onClick={() => {
                    setPlaying(false)
                    setActiveFrame(index)
                  }}
                >
                  {frameImages[index] ? <img src={frameImages[index]} alt={`第 ${index + 1} 帧`} /> : <Flower small step={index} />}
                  <span>{String(index + 1).padStart(2, '0')}</span>
                </button>
              ))}
            </div>
          )}
        </Region>
      )

  const controls = page === 'url'
    ? (
        <Region title="查询参数" note={`${parsed?.searchParams.size || 0} 项`}>
          <div className="proto-params">
            {parsed && Array.from(new Set(parsed.searchParams.keys())).map(key => (
              <label key={key}>
                <span>{key}</span>
                <input
                  aria-label={`参数 ${key}`}
                  value={parsed?.searchParams.get(key) || ''}
                  onChange={(event) => {
                    if (parsed) {
                      parsed.searchParams.set(key, event.target.value)
                      setUrlValue(parsed.href)
                    }
                  }}
                />
              </label>
            ))}
          </div>
          <p className="proto-help">编辑参数，链接与二维码会同步更新。</p>
        </Region>
      )
    : page === 'nine'
      ? (
          <Region title="切片设置" note="px">
            <p className="proto-help">设置四边固定区域，中间部分随容器拉伸。</p>
            <div className="proto-bounds">
              {slices.map((label, index) => (
                <label key={label}>
                  <span>{label}</span>
                  <input type="number" min={0} max={70} value={bounds[index]} aria-label={`${label}切片`} onChange={event => setBounds(previous => previous.map((value, position) => position === index ? Math.min(70, Math.max(0, Number(event.target.value))) : value))} />
                </label>
              ))}
            </div>
            <label className="proto-check">
              <input type="checkbox" checked={guides} onChange={event => setGuides(event.target.checked)} />
              显示切片辅助线
            </label>
            <label className="proto-field">
              <span>
                预览宽度
                <strong>
                  {previewWidth}
                  px
                </strong>
              </span>
              <input type="range" min={180} max={400} value={previewWidth} onChange={event => setPreviewWidth(Number(event.target.value))} />
            </label>
          </Region>
        )
      : (
          <Region title="播放设置" note="循环播放">
            <label className="proto-field">
              <span>
                帧率
                <strong>
                  {fps}
                  {' '}
                  FPS
                </strong>
              </span>
              <input type="range" min={1} max={30} value={fps} onChange={event => setFps(Number(event.target.value))} />
            </label>
            <div className="proto-playback">
              <Button variant="outline" onClick={() => setPlaying(!playing)}>
                {playing ? <Pause /> : <Play />}
                {playing ? '暂停' : '播放'}
              </Button>
              <span>
                {activeFrame + 1}
                {' '}
                /
                {' '}
                {frameCount}
              </span>
            </div>
            <p className="proto-help">点击缩略图查看单帧。</p>
          </Region>
        )

  const preview = page === 'url'
    ? (
        <Region title="二维码预览" note={`${qrSize} × ${qrSize}`} className="proto-preview-region">
          <div className="proto-qr-stage">
            {qr ? <img src={qr} alt="当前链接的二维码" /> : <QrCode size={80} />}
            <span>扫码打开当前链接</span>
          </div>
          <label className="proto-field proto-qr-size">
            <span>导出尺寸</span>
            <select aria-label="二维码导出尺寸" value={qrSize} onChange={event => setQrSize(event.target.value)}>
              <option value="240">240 × 240</option>
              <option value="480">480 × 480</option>
              <option value="960">960 × 960</option>
            </select>
          </label>
        </Region>
      )
    : (
        <Region title={page === 'nine' ? '切片与拉伸预览' : '动画预览'} note={page === 'nine' ? '视图不影响导出' : `${fps} FPS`} className="proto-preview-region">
          <CanvasStage resetKey={page}>
            <div className={page === 'nine' ? 'proto-nine-sample' : 'proto-animation'} style={page === 'nine' ? { width: `min(${previewWidth}px, 70vw)` } : undefined}>
              {page === 'nine'
                ? (
                    <>
                      <div className="proto-bubble" style={asset ? { borderStyle: 'solid', borderColor: 'transparent', borderWidth: 24, borderImage: `url("${asset}") ${bounds.join(' ')} fill / ${bounds.map(value => `${value}px`).join(' ')} stretch` } : undefined}>
                        {!asset && (
                          <>
                            <ScanLine size={24} />
                            <strong>内容可以自由伸展。</strong>
                            <span>让边角，保持刚刚好。</span>
                          </>
                        )}
                      </div>
                      {guides && (
                        <div className="proto-guides" style={{ '--slice-top': `${bounds[0]}px`, '--slice-right': `${bounds[1]}px`, '--slice-bottom': `${bounds[2]}px`, '--slice-left': `${bounds[3]}px` } as CSSProperties}>
                          <i />
                          <i />
                          <i />
                          <i />
                        </div>
                      )}
                    </>
                  )
                : frameImages.length ? <img src={frameImages[activeFrame]} alt={`当前第 ${activeFrame + 1} 帧`} /> : <Flower step={activeFrame} />}
            </div>
          </CanvasStage>
          <div className="proto-canvas-status">
            <span>{page === 'nine' ? '拉伸模式 · stretch' : `第 ${String(activeFrame + 1).padStart(2, '0')} 帧`}</span>
            <span>{page === 'nine' ? `${previewWidth} × 160` : `${frameCount} 帧 · ${(frameCount / fps).toFixed(2)}s`}</span>
          </div>
        </Region>
      )

  const result = page === 'url'
    ? (
        <Region title="解析结果" note="URL">
          <dl className="proto-url-parts">
            <div>
              <dt>协议</dt>
              <dd>{parsed?.protocol || '—'}</dd>
            </div>
            <div>
              <dt>主机</dt>
              <dd>{parsed?.hostname || '—'}</dd>
            </div>
            <div>
              <dt>路径</dt>
              <dd>{parsed?.pathname || '—'}</dd>
            </div>
          </dl>
          <div className="proto-result-text">{urlValue || '等待输入链接'}</div>
          <Button className="proto-full-button" variant="outline" onClick={() => void notifyCopy(urlValue)} disabled={!urlValue}>
            <Copy />
            复制链接
          </Button>
        </Region>
      )
    : (
        <Region title={page === 'nine' ? 'CSS 输出' : '导出精灵图'} note={page === 'nine' ? 'border-image' : 'PNG'}>
          {page === 'nine'
            ? <pre className="proto-code"><code>{cssText}</code></pre>
            : (
                <>
                  <div className="proto-sprite-mini">{Array.from({ length: Math.min(frameCount, 8) }, (_, index) => frameImages.length ? <img key={frameImages[index]} src={frameImages[index]} alt="" /> : <Flower key={`export-${index}`} small step={index} />)}</div>
                  <dl className="proto-url-parts">
                    <div>
                      <dt>排布</dt>
                      <dd>水平排列</dd>
                    </div>
                    <div>
                      <dt>单帧尺寸</dt>
                      <dd>240 × 240</dd>
                    </div>
                    <div>
                      <dt>画布尺寸</dt>
                      <dd>
                        {240 * frameCount}
                        {' '}
                        × 240
                      </dd>
                    </div>
                  </dl>
                  <p className="proto-help">原型导出使用固定单帧尺寸，仅用于体验操作链路。</p>
                </>
              )}
          <Button className="proto-full-button" variant="outline" onClick={() => page === 'nine' ? void notifyCopy(cssText) : void exportSprite()}>
            {page === 'nine' ? <Copy /> : <ArrowDownToLine />}
            {page === 'nine' ? '复制 CSS' : '导出 PNG 精灵图'}
          </Button>
        </Region>
      )

  const action = (
    <Button
      className="proto-primary-action"
      onClick={() => {
        if (page === 'url') {
          if (qr) {
            void fetch(qr).then(response => response.blob()).then((blob) => {
              download(blob, 'qrcode.png')
              setToast('二维码已导出')
            })
          }
        }
        else if (page === 'nine') {
          void notifyCopy(cssText)
        }
        else {
          void exportSprite()
        }
      }}
      disabled={page === 'url' && !qr}
    >
      {page === 'nine' ? <Copy /> : <ArrowDownToLine />}
      {page === 'url' ? '下载二维码' : page === 'nine' ? '复制 CSS' : '导出精灵图'}
    </Button>
  )
  const shared: PrototypeProps = { page, variant, href, heading: pageLabels[page], description: page === 'url' ? '编辑链接参数，即时生成二维码。' : page === 'nine' ? '固定边角，拉伸中间。让图像适应每一种尺寸。' : '从一组静态图片，整理出流畅的动画。', input, controls, preview, result, action }

  return (
    <div className={`ui-prototype variant-${variant}`}>
      <header className="proto-header">
        <Link className="proto-brand" to={href('/')} aria-label="Web Tools 首页">
          <Grid2X2 size={20} strokeWidth={2} />
          <span>
            Web Tools
          </span>
        </Link>
        <span className="proto-header-slash">/</span>
        <details ref={toolMenuRef} className="proto-tool-menu">
          <summary>
            {page === 'home' ? '全部工具' : pageLabels[page]}
            <ChevronDown size={14} />
          </summary>
          <nav aria-label="切换工具">
            <Link to={href('/')}>
              全部工具
              <ChevronRight size={14} />
            </Link>
            {toolItems.map(tool => (
              <ToolLink key={tool.kind} tool={tool} href={href}>
                <tool.icon size={16} />
                {tool.name}
                {tool.kind === 'lottie' && <small>现有页面</small>}
              </ToolLink>
            ))}
          </nav>
        </details>
        <div className="proto-header-end">
          <button type="button" onClick={() => setDark(!dark)} aria-label={dark ? '切换为浅色' : '切换为深色'}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
        </div>
      </header>
      {variant === 'D' ? <VariantD {...shared} /> : <VariantE key={page} {...shared} />}
      <footer className="proto-footer">
        <span>设计原型</span>
      </footer>
      <input
        ref={uploadRef}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept="image/*"
        multiple={page === 'frames'}
        aria-label="导入图片"
        onChange={(event) => {
          importFiles(Array.from(event.target.files || []))
          event.target.value = ''
        }}
      />
      {toast && (
        <div className="proto-toast" role="status">
          <Check size={16} />
          {toast}
          <button type="button" onClick={() => setToast('')} aria-label="关闭提示"><X size={14} /></button>
        </div>
      )}
      <PrototypeSwitcher state={`${pageLabels[page]} · ${dark ? '暗色' : '亮色'} · ${page === 'nine' ? `切片 ${bounds.join('/')} · 宽 ${previewWidth}` : page === 'frames' ? `${frameCount} 帧 · ${fps} FPS` : page === 'url' ? `${parsed?.searchParams.size || 0} 参数 · QR ${qrSize}px` : '4 个公开工具'}`} />
    </div>
  )
}
