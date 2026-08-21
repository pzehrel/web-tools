import type { ChangeEvent, DragEvent } from 'react'
import type { FontCheckReport, FontFormat, ParsedFont, SubsetResult } from './font-engine'
import {
  Activity,
  ArrowLeft,
  Check,
  Download,
  FileType,
  Grid3x3,
  LoaderCircle,
  Scissors,
  Trash2,
  TriangleAlert,
  Type,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'

import { Seo } from '@/components/seo'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ASCII_CHARSET, HANZI_TIERS, PUNCTUATION_CHARSET } from './charsets'
import { buildCheckReport, convertFont, detectFormat, parseFont, registerPreviewFont, subsetFont } from './font-engine'

/* ---------- 常量与工具 ---------- */

type HanTier = '3000' | '5000' | '7000'
type TabId = 'preview' | 'glyphs' | 'checkup' | 'subset'
type CharCategory = 'han' | 'letter' | 'digit' | 'punct' | 'other'

const HAN_TIERS: Array<{ id: HanTier, label: string, description: string }> = [
  { id: '3000', label: '常用 3000 字', description: '覆盖日常对话与一般 UI 文案' },
  { id: '5000', label: '常用 5000 字', description: '覆盖大部分出版物正文' },
  { id: '7000', label: '常用 7000 字', description: '接近通用规范汉字表，长文更稳' },
]

const TABS: Array<{ id: TabId, label: string, icon: typeof Type }> = [
  { id: 'preview', label: '预览', icon: Type },
  { id: 'glyphs', label: '字符浏览', icon: Grid3x3 },
  { id: 'checkup', label: '体检', icon: Activity },
  { id: 'subset', label: '子集化', icon: Scissors },
]

const CATEGORY_LABELS: Record<CharCategory, string> = {
  han: '汉字',
  letter: '字母',
  digit: '数字',
  punct: '标点符号',
  other: '其他',
}

const FORMAT_EXT: Record<FontFormat, string> = { ttf: 'ttf', otf: 'otf', woff: 'woff', woff2: 'woff2' }

const SAMPLE_TEXT = '永东国爱 in 0123 ABC 调和字韵，字体之美！The quick brown fox jumps over the lazy dog.'

const INPUT_CLASS = 'h-9 w-full rounded-md border-2 border-border bg-background px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-ring/40 disabled:opacity-50'

/** 每页渲染的字符数（网格分页，避免上万 glyph 一次进 DOM） */
const GLYPH_PAGE_SIZE = 600

function formatSize(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function classifyChar(cp: number): CharCategory {
  if ((cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF) || (cp >= 0xF900 && cp <= 0xFAFF))
    return 'han'
  if ((cp >= 0x41 && cp <= 0x5A) || (cp >= 0x61 && cp <= 0x7A) || (cp >= 0xC0 && cp <= 0x24F) || (cp >= 0x0370 && cp <= 0x052F))
    return 'letter'
  if ((cp >= 0x30 && cp <= 0x39) || (cp >= 0xFF10 && cp <= 0xFF19))
    return 'digit'
  if (
    (cp >= 0x20 && cp <= 0x2F) || (cp >= 0x3A && cp <= 0x40) || (cp >= 0x5B && cp <= 0x60) || (cp >= 0x7B && cp <= 0x7E)
    || (cp >= 0x2000 && cp <= 0x206F) || (cp >= 0x3000 && cp <= 0x303F) || (cp >= 0xFF00 && cp <= 0xFFEF)
  ) {
    return 'punct'
  }
  return 'other'
}

/* ---------- 小组件 ---------- */

function Checkbox({ checked, label, onChange }: { checked: boolean, label: string, onChange: (v: boolean) => void }) {
  return (
    <label className="relative flex size-6 shrink-0 cursor-pointer items-center">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={e => onChange(e.target.checked)}
        className="peer absolute inset-0 z-10 size-6 cursor-pointer opacity-0"
      />
      <span
        className={cn(
          'pointer-events-none flex size-6 shrink-0 items-center justify-center rounded-sm border-2 border-border shadow-hard-xs transition-all',
          'peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50',
          'peer-hover:-translate-x-px peer-hover:-translate-y-px peer-hover:shadow-hard-sm',
          'peer-active:translate-x-0.5 peer-active:translate-y-0.5 peer-active:shadow-none',
          checked ? 'bg-primary text-primary-foreground' : 'bg-background',
        )}
      >
        {checked && <Check className="size-4" strokeWidth={3.5} />}
      </span>
    </label>
  )
}

function Stat({ label, value, hint }: { label: string, value: string, hint?: string }) {
  return (
    <div className="rounded-md border-2 border-border bg-muted/40 px-3 py-2">
      <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="font-mono text-sm font-black">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

function SegmentedControl<T extends string>({ value, options, onChange }: {
  value: T
  options: Array<{ value: T, label: string }>
  onChange: (v: T) => void
}) {
  return (
    <div role="radiogroup" className="flex w-full overflow-hidden rounded-md border-2 border-border">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 px-2 py-1.5 text-xs font-bold transition-colors',
            value === opt.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-foreground hover:bg-muted',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- 字符网格 ---------- */

function GlyphGrid({ codePoints, previewFamily, onAddToCustom }: {
  codePoints: number[]
  previewFamily: string
  onAddToCustom: (cp: number) => void
}) {
  const [visibleCount, setVisibleCount] = useState(GLYPH_PAGE_SIZE)
  const [selected, setSelected] = useState<number | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // 切换筛选后回到第一页并清空选中
  useEffect(() => {
    setVisibleCount(GLYPH_PAGE_SIZE)
    setSelected(null)
    gridRef.current?.scrollTo({ top: 0 })
  }, [codePoints])

  const visible = codePoints.slice(0, visibleCount)
  const selectedChar = selected !== null ? String.fromCodePoint(selected) : null

  return (
    <div className="space-y-4">
      {/* 选中详情 */}
      {selectedChar && selected !== null && (
        <div className="flex flex-wrap items-center gap-5 rounded-md border-2 border-border bg-muted/40 px-5 py-4">
          <div
            className="flex size-24 shrink-0 items-center justify-center rounded-md border-2 border-border bg-background text-6xl leading-none"
            style={{ fontFamily: `"${previewFamily}", sans-serif` }}
          >
            {selectedChar}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-sm font-black">
              U+
              {selected.toString(16).toUpperCase().padStart(4, '0')}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {CATEGORY_LABELS[classifyChar(selected)]}
              {' '}
              · 十进制
              {selected}
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => onAddToCustom(selected)}
            >
              加入自定义文本
            </Button>
          </div>
          <div
            className="min-w-0 flex-1 text-4xl leading-snug break-all"
            style={{ fontFamily: `"${previewFamily}", sans-serif` }}
          >
            {selectedChar}
            永八刀
            {selectedChar}
            ample 0
            {selectedChar}
          </div>
        </div>
      )}

      {/* 网格 */}
      <div
        ref={gridRef}
        className="max-h-[26rem] overflow-y-auto rounded-md border-2 border-border bg-background p-2"
      >
        {visible.length === 0
          ? (
              <p className="py-10 text-center text-sm text-muted-foreground">没有匹配的字符</p>
            )
          : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-1">
                {visible.map(cp => (
                  <button
                    key={cp}
                    type="button"
                    title={`U+${cp.toString(16).toUpperCase().padStart(4, '0')}`}
                    onClick={() => setSelected(cp === selected ? null : cp)}
                    className={cn(
                      'flex h-11 items-center justify-center rounded-sm border-2 text-xl leading-none transition-colors',
                      cp === selected
                        ? 'border-border bg-primary text-primary-foreground'
                        : 'border-transparent text-foreground hover:border-border hover:bg-muted',
                    )}
                    style={{ fontFamily: `"${previewFamily}", sans-serif` }}
                  >
                    {String.fromCodePoint(cp)}
                  </button>
                ))}
              </div>
            )}
      </div>

      {visibleCount < codePoints.length && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={() => setVisibleCount(c => c + GLYPH_PAGE_SIZE)}>
            加载更多（
            {codePoints.length - visibleCount}
            {' '}
            个剩余）
          </Button>
        </div>
      )}
    </div>
  )
}

/* ---------- 主组件 ---------- */

interface LoadedFont {
  file: File
  buffer: ArrayBuffer
  parsed: ParsedFont
  report: FontCheckReport
  rawSize: number
  previewFamily: string
  unregister: () => void
}

export default function FontToolkitTool() {
  const [font, setFont] = useState<LoadedFont | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState<TabId>('preview')

  // 子集化选项
  const [hanTier, setHanTier] = useState<HanTier>('3000')
  const [useAscii, setUseAscii] = useState(true)
  const [usePunct, setUsePunct] = useState(true)
  const [useCustom, setUseCustom] = useState(false)
  const [customText, setCustomText] = useState('')
  const [outputFormat, setOutputFormat] = useState<FontFormat>('woff2')
  const [keepHinting, setKeepHinting] = useState(false)
  const [keepKerning, setKeepKerning] = useState(true)

  // 预览
  const [previewText, setPreviewText] = useState(SAMPLE_TEXT)
  const [previewSize, setPreviewSize] = useState(32)

  // 字符浏览
  const [category, setCategory] = useState<CharCategory>('han')
  const [search, setSearch] = useState('')

  // 结果
  const [result, setResult] = useState<(SubsetResult & { sourceSize: number, family: string }) | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // 清理预览字体与结果（组件卸载时；用 ref 保存最新值避免闭包过期）
  const fontRef = useRef<LoadedFont | null>(null)
  const resultUrlRef = useRef<string | null>(null)
  fontRef.current = font
  resultUrlRef.current = resultUrl
  useEffect(() => {
    return () => {
      fontRef.current?.unregister()
      if (resultUrlRef.current)
        URL.revokeObjectURL(resultUrlRef.current)
    }
  }, [])

  const loadFile = useCallback(async (file: File) => {
    setError(null)
    setLoading(true)
    try {
      const buffer = await file.arrayBuffer()
      const format = detectFormat(buffer)
      if (format === null || (format as string) === 'ttc')
        throw new Error('暂不支持该格式（支持 ttf / otf / woff / woff2；TTC 集合字体请先拆分）')
      const parsed = await parseFont(buffer, format)
      const report = buildCheckReport(parsed, [
        ...HAN_TIERS.map(t => ({ label: t.label, chars: HANZI_TIERS[t.id] })),
        { label: '英文与数字', chars: ASCII_CHARSET },
        { label: '标点与符号', chars: PUNCTUATION_CHARSET },
      ])
      const family = `font-preview-${crypto.randomUUID().slice(0, 8)}`
      const unregister = await registerPreviewFont(family, buffer.slice(0))
      const rawSize = parsed.rawSize
      setFont((prev) => {
        if (prev)
          prev.unregister()
        return { file, buffer, parsed, report, rawSize, previewFamily: family, unregister }
      })
      setResult(null)
      setResultUrl((prev) => {
        if (prev)
          URL.revokeObjectURL(prev)
        return null
      })
    }
    catch (e) {
      setError(e instanceof Error ? e.message : '字体解析失败')
    }
    finally {
      setLoading(false)
    }
  }, [])

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file)
      loadFile(file)
  }, [loadFile])

  const onPickFile = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file)
      loadFile(file)
    e.target.value = ''
  }, [loadFile])

  /** 字体全部字符码点（按码点升序） */
  const allCodePoints = useMemo(() => {
    if (!font)
      return []
    return [...font.parsed.data.glyf]
      .flatMap(g => g.unicode ?? [])
      .sort((a, b) => a - b)
  }, [font])

  /** 字符浏览：分类 + 搜索过滤 */
  const filteredCodePoints = useMemo(() => {
    let list = allCodePoints.filter(cp => classifyChar(cp) === category)
    // 搜索：支持输入任意字符（取其码点做匹配）或 U+XXXX 码点
    const q = search.trim()
    if (q) {
      const hexMatch = q.match(/^u\+?([0-9a-f]{2,6})$/i)
      if (hexMatch) {
        const cp = Number.parseInt(hexMatch[1], 16)
        list = list.filter(c => c === cp)
      }
      else {
        const targets = [...q].map(ch => ch.codePointAt(0)!).filter(cp => cp > 0x20)
        if (targets.length)
          list = list.filter(c => targets.includes(c))
      }
    }
    return list
  }, [allCodePoints, category, search])

  /** 分类计数 */
  const categoryCounts = useMemo(() => {
    const counts: Record<CharCategory, number> = { han: 0, letter: 0, digit: 0, punct: 0, other: 0 }
    for (const cp of allCodePoints)
      counts[classifyChar(cp)]++
    return counts
  }, [allCodePoints])

  const addToCustom = useCallback((cp: number) => {
    setUseCustom(true)
    setCustomText(prev => [...new Set([...prev, String.fromCodePoint(cp)])].join(''))
    setTab('subset')
  }, [])

  /** 当前选择对应的码点集合 + 选中字符数 */
  const selection = useMemo(() => {
    const groups: string[] = [HANZI_TIERS[hanTier]]
    if (useAscii)
      groups.push(ASCII_CHARSET)
    if (usePunct)
      groups.push(PUNCTUATION_CHARSET)
    if (useCustom && customText.trim())
      groups.push(customText)
    const cps = new Set<number>()
    for (const g of groups) {
      for (const ch of g) {
        const cp = ch.codePointAt(0)
        if (cp !== undefined && cp >= 0x20)
          cps.add(cp)
      }
    }
    return { codePoints: cps, total: cps.size }
  }, [hanTier, useAscii, usePunct, useCustom, customText])

  /** 选中字符在当前字体里的缺字 */
  const missingChars = useMemo(() => {
    if (!font)
      return ''
    const missing = [...selection.codePoints].filter(cp => !font.parsed.data.glyf.some(g => g.unicode?.includes(cp)))
    return String.fromCodePoint(...missing)
  }, [font, selection])

  const runExport = useCallback(async (mode: 'subset' | 'convert') => {
    if (!font)
      return
    setBusy(true)
    setError(null)
    try {
      const out = mode === 'convert'
        ? await convertFont(font.buffer, font.parsed.format, outputFormat)
        : await subsetFont(font.parsed, {
            codePoints: selection.codePoints,
            outputFormat,
            hinting: keepHinting,
            kerning: keepKerning,
          })
      const blob = new Blob([out.buffer], { type: `font/${FORMAT_EXT[out.format]}` })
      const url = URL.createObjectURL(blob)
      if (resultUrl)
        URL.revokeObjectURL(resultUrl)
      setResultUrl(url)
      setResult({ ...out, sourceSize: font.rawSize, family: font.report.familyName })
    }
    catch (e) {
      setError(e instanceof Error ? e.message : '导出失败')
    }
    finally {
      setBusy(false)
    }
  }, [font, selection, outputFormat, keepHinting, keepKerning, resultUrl])

  const download = useCallback(() => {
    if (!result || !resultUrl || !font)
      return
    const a = document.createElement('a')
    a.href = resultUrl
    const base = font.report.familyName.replace(/\s+/g, '') || 'font'
    a.download = `${base}-subset.${FORMAT_EXT[result.format]}`
    a.click()
  }, [result, resultUrl, font])

  const sizeDelta = result
    ? Math.max(0, Math.round((1 - result.buffer.byteLength / result.sourceSize) * 100))
    : 0

  const fontStack = font ? `"${font.previewFamily}", sans-serif` : undefined

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <Seo
        title="字体工具箱"
        description="字体预览、体检、子集化与格式转换：常用汉字 3000/5000/7000 分级选择，本地运行不上传。"
        path="/tools/font-toolkit"
      />

      {/* 顶部导航 */}
      <div className="flex items-center gap-3 py-5">
        <Button variant="outline" size="icon-sm" asChild>
          <Link to="/" aria-label="返回首页"><ArrowLeft className="size-4" /></Link>
        </Button>
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-chart-2 text-primary-foreground">
            <Type className="size-4" />
          </span>
          <h1 className="text-2xl font-black tracking-tight">字体工具箱</h1>
        </div>
        {font && (
          <span className="ml-auto hidden max-w-[45%] truncate font-mono text-xs font-bold text-muted-foreground sm:block">
            {font.report.familyName}
            {' '}
            ·
            {formatSize(font.rawSize)}
            {' '}
            ·
            {font.report.format.toUpperCase()}
          </span>
        )}
      </div>

      {/* 字体导入（未导入时大卡；已导入后折叠成一行） */}
      {!font
        ? (
            <Card
              className={cn('mb-5', dragOver && 'ring-[3px] ring-ring/50')}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <CardContent className="flex flex-col items-center gap-4 px-6 py-14 text-center">
                <span className="flex size-14 items-center justify-center rounded-md border-2 border-border bg-muted/40 shadow-hard-sm">
                  <FileType className="size-7 text-muted-foreground" />
                </span>
                <div>
                  <p className="font-bold">拖入字体文件开始</p>
                  <p className="mt-1 text-sm text-muted-foreground">支持 .ttf / .otf / .woff / .woff2，所有处理都在浏览器本地完成</p>
                </div>
                <input ref={inputRef} type="file" accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2" className="hidden" onChange={onPickFile} />
                <Button onClick={() => inputRef.current?.click()} disabled={loading}>
                  {loading
                    ? <LoaderCircle className="size-4 animate-spin" />
                    : <FileType className="size-4" />}
                  选择文件
                </Button>
              </CardContent>
            </Card>
          )
        : (
            <div
              className={cn(
                'mb-5 flex flex-wrap items-center gap-3 rounded-md border-2 border-border bg-card px-4 py-3 shadow-hard-sm',
                dragOver && 'ring-[3px] ring-ring/50',
              )}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
            >
              <span className="max-w-[14rem] truncate rounded-sm border-2 border-border bg-muted px-2 py-1 font-mono text-xs font-bold">
                {font.file.name}
              </span>
              <span className="text-xs text-muted-foreground">
                {font.report.glyphCount.toLocaleString()}
                {' '}
                glyphs · 汉字
                {font.report.charset.hanGlyphs.toLocaleString()}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <input ref={inputRef} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={onPickFile} />
                <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={loading}>
                  {loading ? <LoaderCircle className="size-4 animate-spin" /> : <FileType className="size-4" />}
                  更换
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    font.unregister()
                    setFont(null)
                    setResult(null)
                    if (resultUrl) {
                      URL.revokeObjectURL(resultUrl)
                      setResultUrl(null)
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                  移除
                </Button>
              </div>
            </div>
          )}

      {error && (
        <div className="mb-5 flex items-center gap-2 rounded-md border-2 border-destructive/50 bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">
          <TriangleAlert className="size-4 shrink-0" />
          {error}
        </div>
      )}

      {font && (
        <>
          {/* Tab 导航 */}
          <div role="tablist" className="mb-5 flex gap-2 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-md border-2 border-border px-4 py-2 text-sm font-bold transition-all',
                  tab === id
                    ? 'translate-x-0.5 translate-y-0.5 bg-primary text-primary-foreground shadow-none'
                    : 'bg-card shadow-hard-xs hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>

          {/* 预览 */}
          {tab === 'preview' && (
            <Card>
              <CardHeader>
                <CardTitle>文本预览</CardTitle>
                <CardDescription>用导入的字体渲染任意文本；想逐字浏览全部字符请切到「字符浏览」。</CardDescription>
                <CardAction>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">字号</span>
                    <input
                      type="range"
                      min={16}
                      max={72}
                      value={previewSize}
                      onChange={e => setPreviewSize(Number(e.target.value))}
                      className="w-28"
                      aria-label="预览字号"
                    />
                    <span className="w-8 font-mono text-xs font-bold">{previewSize}</span>
                  </div>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-3 pb-6">
                <input
                  className={INPUT_CLASS}
                  value={previewText}
                  onChange={e => setPreviewText(e.target.value)}
                  placeholder="输入要预览的文字…"
                />
                <div
                  className="overflow-hidden rounded-md border-2 border-border bg-muted/30 p-4 leading-relaxed"
                  style={{ fontFamily: fontStack, fontSize: previewSize, overflowWrap: 'break-word' }}
                >
                  {previewText || SAMPLE_TEXT}
                </div>
                <p className="text-xs text-muted-foreground">
                  也可以直接拖拽字体到本页继续更换；预览使用 FontFace 本地注册，不会上传。
                </p>
              </CardContent>
            </Card>
          )}

          {/* 字符浏览 */}
          {tab === 'glyphs' && (
            <Card>
              <CardHeader>
                <CardTitle>字符浏览</CardTitle>
                <CardDescription>
                  字体里的
                  {' '}
                  {allCodePoints.length.toLocaleString()}
                  {' '}
                  个字符，按分类筛选或搜索定位，点击查看大图。
                </CardDescription>
                <CardAction>
                  <input
                    className="h-9 w-44 rounded-md border-2 border-border bg-background px-3 text-sm font-bold outline-none focus:ring-2 focus:ring-ring/40"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="搜字符或 U+4E2D"
                    aria-label="搜索字符"
                  />
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4 pb-6">
                {/* 分类筛选 */}
                <div role="radiogroup" className="flex flex-wrap gap-2">
                  {(Object.keys(CATEGORY_LABELS) as CharCategory[]).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      role="radio"
                      aria-checked={category === cat}
                      onClick={() => setCategory(cat)}
                      className={cn(
                        'rounded-sm border-2 border-border px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-40',
                        category === cat
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background hover:bg-muted',
                      )}
                    >
                      {CATEGORY_LABELS[cat]}
                      <span className="ml-1.5 font-mono opacity-70">{categoryCounts[cat].toLocaleString()}</span>
                    </button>
                  ))}
                </div>

                <GlyphGrid
                  codePoints={filteredCodePoints}
                  previewFamily={font.previewFamily}
                  onAddToCustom={addToCustom}
                />
              </CardContent>
            </Card>
          )}

          {/* 体检 */}
          {tab === 'checkup' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="size-4" />
                  体检报告
                </CardTitle>
                <CardDescription>字数构成与字符集覆盖情况，子集化前先看看家底。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pb-6">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Stat label="Glyph 总数" value={font.report.glyphCount.toLocaleString()} />
                  <Stat label="汉字 Glyph" value={font.report.charset.hanGlyphs.toLocaleString()} hint={font.report.charset.hanGlyphs > 0 ? '含 CJK 统一表意' : '无中文字形'} />
                  <Stat label="映射码点" value={font.report.charset.mappedGlyphs.toLocaleString()} />
                  <Stat label="原始体积" value={formatSize(font.rawSize)} hint={`${font.report.unitsPerEm} UPM · ${font.report.format.toUpperCase()}`} />
                </div>
                <div className="space-y-2">
                  {font.report.coverage.map(row => (
                    <div key={row.label} className="flex items-center gap-3 rounded-md border-2 border-border/50 px-3 py-2">
                      <span className="w-28 shrink-0 text-xs font-bold">{row.label}</span>
                      <div className="h-3 flex-1 overflow-hidden rounded-sm border-2 border-border bg-muted">
                        <div
                          className="h-full bg-chart-2"
                          style={{ width: `${row.total ? Math.round(row.covered / row.total * 100) : 0}%` }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right font-mono text-xs font-bold">
                        {row.covered}
                        /
                        {row.total}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 子集化 + 转换 */}
          {tab === 'subset' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scissors className="size-4" />
                  子集化与转换
                </CardTitle>
                <CardDescription>按分类勾选需要的字符，导出瘦身后的字体。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pb-6">
                {/* 中文分级 */}
                <div>
                  <p className="mb-1.5 text-xs font-bold text-muted-foreground">中文常用字（按字频分级）</p>
                  <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
                    {HAN_TIERS.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        role="radio"
                        aria-checked={hanTier === t.id}
                        onClick={() => setHanTier(t.id)}
                        className={cn(
                          'rounded-md border-2 border-border p-3 text-left transition-all shadow-hard-xs',
                          'hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard-sm',
                          'active:translate-x-0.5 active:translate-y-0.5 active:shadow-none',
                          hanTier === t.id ? 'bg-primary text-primary-foreground' : 'bg-background',
                        )}
                      >
                        <span className="block text-sm font-black">{t.label}</span>
                        <span className={cn('block text-xs', hanTier === t.id ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                          {t.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 其他字符集 */}
                <div className="space-y-2">
                  <p className="mb-1.5 text-xs font-bold text-muted-foreground">其他字符集</p>
                  <div className="flex items-center gap-3 rounded-md border-2 border-border px-3 py-2.5">
                    <Checkbox checked={useAscii} label="英文与数字" onChange={setUseAscii} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">英文与数字</p>
                      <p className="text-xs text-muted-foreground">ASCII 可打印字符（含空格），95 个</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 rounded-md border-2 border-border px-3 py-2.5">
                    <Checkbox checked={usePunct} label="标点与符号" onChange={setUsePunct} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">标点与符号</p>
                      <p className="text-xs text-muted-foreground">中文全角标点 + 常用符号</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-md border-2 border-border px-3 py-2.5">
                    <div className="pt-0.5"><Checkbox checked={useCustom} label="自定义文本" onChange={setUseCustom} /></div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">自定义文本</p>
                      <p className="mb-2 text-xs text-muted-foreground">额外保留指定文字（品牌名、UI 文案；也可在「字符浏览」里点选加入）</p>
                      <input
                        className={INPUT_CLASS}
                        value={customText}
                        disabled={!useCustom}
                        placeholder="例如：Web Tools 字体工具箱"
                        onChange={e => setCustomText(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* 导出选项 */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="mb-1.5 text-xs font-bold text-muted-foreground">输出格式</p>
                    <SegmentedControl
                      value={outputFormat}
                      onChange={setOutputFormat}
                      options={[
                        { value: 'woff2', label: 'WOFF2' },
                        { value: 'woff', label: 'WOFF' },
                        { value: 'ttf', label: 'TTF' },
                      ]}
                    />
                  </div>
                  <div className="space-y-2 pt-1">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
                      <Checkbox checked={keepHinting} label="保留 hinting" onChange={setKeepHinting} />
                      保留 hinting
                    </label>
                    <p className="pl-8 text-xs text-muted-foreground">Windows 小字号渲染更清晰，体积略增</p>
                  </div>
                  <div className="space-y-2 pt-1">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-bold">
                      <Checkbox checked={keepKerning} label="保留 kerning" onChange={setKeepKerning} />
                      保留 kerning
                    </label>
                    <p className="pl-8 text-xs text-muted-foreground">字偶间距表，西文排版更精细</p>
                  </div>
                </div>

                {/* 缺字提示 */}
                {missingChars && (
                  <div className="rounded-md border-2 border-border bg-muted/40 px-3 py-2 text-xs">
                    <span className="font-bold">
                      所选字符中有
                      {missingChars.length}
                      {' '}
                      个字体里没有
                    </span>
                    <span className="text-muted-foreground">（导出会自动跳过）：</span>
                    <span className="font-mono break-all">
                      {missingChars.slice(0, 120)}
                      {missingChars.length > 120 ? '…' : ''}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 border-t-2 border-border/20 pt-4">
                  <Button onClick={() => runExport('subset')} disabled={busy || selection.total === 0}>
                    {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Scissors className="size-4" />}
                    子集化导出（
                    {selection.total}
                    {' '}
                    字符）
                  </Button>
                  <Button variant="outline" onClick={() => runExport('convert')} disabled={busy}>
                    仅转换格式（全量）
                  </Button>
                </div>

                {/* 结果 */}
                {result && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border-2 border-border bg-muted/40 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="font-mono text-sm font-black">
                          {formatSize(result.sourceSize)}
                          <span className="mx-1.5 text-muted-foreground">→</span>
                          <span className="text-chart-2">{formatSize(result.buffer.byteLength)}</span>
                        </span>
                        <span className="rounded-sm border-2 border-border bg-background px-1.5 py-0.5 text-xs font-bold">
                          -
                          {sizeDelta}
                          %
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {result.glyphCount.toLocaleString()}
                          {' '}
                          glyphs ·
                          {result.format.toUpperCase()}
                        </span>
                      </div>
                      <Button size="sm" onClick={download}>
                        <Download className="size-4" />
                        下载
                        {' '}
                        {FORMAT_EXT[result.format].toUpperCase()}
                      </Button>
                    </div>
                    <div>
                      <p className="mb-1.5 text-xs font-bold text-muted-foreground">@font-face 代码</p>
                      <pre className="overflow-x-auto rounded-md border-2 border-border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
                        {`@font-face {
  font-family: '${result.family}';
  src: url('${result.family}-subset.${FORMAT_EXT[result.format]}') format('${result.format}');
  font-weight: ${font.report.weightClass};
  font-display: swap;
}`}
                      </pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
