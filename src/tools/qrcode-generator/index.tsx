import type { ChangeEvent, DragEvent } from 'react'
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  History,
  QrCode,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ClientOnly } from 'vite-react-ssg'

import { Seo } from '@/components/seo'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { readHashParam, writeHashParam } from '@/lib/hash-param'
import { cn } from '@/lib/utils'
import { decodeQr, encodeQr } from './qr-codec'
import { useQrHistory } from './qr-history'

function formatTime(time: number) {
  return new Date(time).toLocaleString('zh-CN', { hour12: false })
}

function QrCodeTool() {
  const { items: historyItems, add: addHistory, remove: removeHistory, clear: clearHistory } = useQrHistory()

  // 双向联动的两个状态：文字 ⇄ 二维码
  const [text, setText] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 挂载时从 URL hash 读入初始内容（#text=...，支持分享链接直达）
  useEffect(() => {
    const timer = setTimeout(() => {
      const initial = readHashParam('text')
      if (initial)
        setText(initial)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  // 内容变动 → 同步到 URL hash（防抖，replaceState 不产生历史记录）
  useEffect(() => {
    const timer = setTimeout(writeHashParam, 400, 'text', text)
    return () => clearTimeout(timer)
  }, [text])

  // 文字变动 → 重新生成二维码（防抖）
  useEffect(() => {
    const timer = setTimeout(() => {
      const value = text.trim()
      if (!value) {
        setQrDataUrl('')
        return
      }
      encodeQr(value)
        .then((url) => {
          setQrDataUrl(url)
          addHistory('encode', value)
        })
        .catch(() => setQrDataUrl(''))
    }, 400)
    return () => clearTimeout(timer)
  }, [text, addHistory])

  // 图片变动（选择 / 拖拽 / 粘贴）→ 识别并更新文字
  const handleFile = useCallback(async (file: File) => {
    setError('')
    try {
      const result = await decodeQr(file)
      if (result) {
        setText(result)
        addHistory('decode', result)
      }
      else {
        setError('未在图片中识别到二维码，换一张更清晰的试试')
      }
    }
    catch {
      setError('图片读取失败，请确认是有效的图片文件')
    }
  }, [addHistory])

  const onFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file)
      void handleFile(file)
    e.target.value = ''
  }, [handleFile])

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'))
    if (file)
      void handleFile(file)
  }, [handleFile])

  // 全局粘贴：输入框聚焦时不拦截，其余情况粘贴图片即识别
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const target = e.target
      if (target instanceof HTMLElement && target.closest('textarea, input'))
        return
      const file = Array.from(e.clipboardData?.files ?? []).find(f => f.type.startsWith('image/'))
      if (file)
        void handleFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [handleFile])

  // —— 复制反馈 ——
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const copy = useCallback((id: string, value: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 1200)
    })
  }, [])

  const download = useCallback(() => {
    if (!qrDataUrl)
      return
    const a = document.createElement('a')
    a.href = qrDataUrl
    a.download = 'qrcode.png'
    a.click()
  }, [qrDataUrl])

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <Seo
        title="二维码工具"
        description="文字与二维码双向互转：输入文字即时生成二维码，也可以粘贴或拖入图片识别内容，支持历史记录。"
        path="/tools/qrcode-generator"
      />
      {/* 顶栏：返回 + 印章式标题 */}
      <header className="flex items-center gap-3 py-6">
        <Button asChild variant="outline" size="icon">
          <Link to="/" aria-label="返回首页">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="flex size-10 items-center justify-center rounded-md border-2 border-border bg-chart-2 shadow-hard-xs">
          <QrCode className="size-5 text-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight">二维码工具</h1>
          <p className="text-sm text-muted-foreground">文字 ⇄ 二维码双向互转，历史记录保存在本地</p>
        </div>
      </header>

      {/* 双向互转面板 */}
      <Card>
        <CardContent className="flex flex-col gap-4 px-6 py-6 sm:flex-row">
          {/* 文字输入 */}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="输入文字、链接……"
              rows={8}
              className="min-h-44 w-full flex-1 resize-y rounded-md border-2 border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              disabled={!text.trim()}
              onClick={() => copy('text', text)}
            >
              {copiedId === 'text' ? <Check /> : <Copy />}
              复制文字
            </Button>
          </div>

          {/* 二维码：点击 / 拖拽 / 粘贴图片即识别 */}
          <div className="flex shrink-0 flex-col items-center gap-2">
            <div
              role="button"
              tabIndex={0}
              title="点击选择 / 拖拽 / 粘贴二维码图片"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'flex size-48 cursor-pointer items-center justify-center rounded-md border-2 border-border bg-background transition-colors',
                !qrDataUrl && 'border-dashed',
                dragging ? 'bg-secondary' : 'hover:bg-secondary/50',
              )}
            >
              {qrDataUrl
                ? <img src={qrDataUrl} alt="二维码" className="size-44" />
                : (
                    <div className="flex flex-col items-center gap-1 p-3 text-center text-muted-foreground">
                      <QrCode className="size-8" />
                      <span className="text-xs">点击 / 拖拽 / 粘贴图片识别</span>
                    </div>
                  )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
              />
            </div>
            <Button variant="outline" size="sm" disabled={!qrDataUrl} onClick={download}>
              <Download />
              下载 PNG
            </Button>
          </div>
        </CardContent>
        {error && (
          <p className="mx-6 mb-6 rounded-md border-2 border-border bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">
            {error}
          </p>
        )}
      </Card>

      {/* 历史记录（存 localStorage，仅客户端渲染以避免 hydration 不一致） */}
      <ClientOnly>
        {() => (
          <Card className="mt-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4" />
                历史记录
              </CardTitle>
              <CardDescription>仅保存在浏览器本地，最多 50 条</CardDescription>
              {historyItems.length > 0 && (
                <CardAction>
                  <Button variant="ghost" size="sm" onClick={clearHistory}>
                    <Trash2 />
                    清空
                  </Button>
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="pb-6">
              {historyItems.length === 0
                ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      还没有记录，生成或识别一个二维码试试
                    </p>
                  )
                : (
                    <ul className="flex flex-col gap-2">
                      {historyItems.map(item => (
                        <li
                          key={item.id}
                          className="flex items-center gap-3 rounded-md border-2 border-border bg-background px-3 py-2"
                        >
                          <span
                            className={cn(
                              'shrink-0 rounded-full border-2 border-border px-2 py-0.5 text-xs font-bold',
                              item.kind === 'encode' ? 'bg-chart-2' : 'bg-chart-4',
                            )}
                          >
                            {item.kind === 'encode' ? '生成' : '识别'}
                          </span>
                          <button
                            type="button"
                            title="点击填入输入框"
                            onClick={() => {
                              setText(item.text)
                              window.scrollTo({ top: 0, behavior: 'smooth' })
                            }}
                            className="min-w-0 flex-1 cursor-pointer truncate text-left text-sm hover:underline"
                          >
                            {item.text}
                          </button>
                          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                            {formatTime(item.time)}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="复制"
                            onClick={() => copy(item.id, item.text)}
                          >
                            {copiedId === item.id ? <Check /> : <Copy />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="删除"
                            onClick={() => removeHistory(item.id)}
                          >
                            <Trash2 />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
            </CardContent>
          </Card>
        )}
      </ClientOnly>
    </div>
  )
}

export default QrCodeTool
