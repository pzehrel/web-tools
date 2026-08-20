import type { ChangeEvent, DragEvent, ReactNode } from 'react'
import type { UrlRecord } from './url-records'
import type { UrlNode, UrlTree } from './url-tree'
import { ArrowLeft, Bookmark, Check, Copy, Download, Link2, Pencil, Plus, QrCode, Save, Sparkles, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ClientOnly } from 'vite-react-ssg'

import { Seo } from '@/components/seo'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { readHashParam, writeHashParam } from '@/lib/hash-param'
import { cn } from '@/lib/utils'
import { ConfirmDialog } from './confirm-dialog'
import { decodeQr, encodeQr } from './qr-codec'
import { generateCode } from './url-code'
import { useUrlRecords } from './url-records'
import { addParam, deleteNode, insertParamBelow, looksLikeUrl, parseUrl, serializeUrl, setNodeValue, updateNode, variableName } from './url-tree'

/** 层级文字颜色轮换：橙 → 黄 → 绿，暖色系相邻过渡（chart 令牌，随主题联动） */
const DEPTH_COLORS = ['text-chart-4', 'text-chart-2', 'text-chart-3'] as const

/** 嵌套 URL 的 key 渐变色：本组颜色保持到 30%，70% 处到达下一组颜色 */
const KEY_GRADIENTS = [
  'from-chart-4 from-30% to-chart-2 to-70%',
  'from-chart-2 from-30% to-chart-3 to-70%',
  'from-chart-3 from-30% to-chart-4 to-70%',
] as const

/** 示例：OAuth 授权链接，redirect_uri 内嵌回调地址，回调里再嵌订单详情路径，外加 hash 路由 */
const EXAMPLE = `https://auth.example.com/oauth/authorize?client_id=shop-web&response_type=code&redirect_uri=${
  encodeURIComponent(`https://shop.example.com/oauth/callback?next=${
    encodeURIComponent('/order/detail?id=1024&from=分享卡片')
  }`)
}&state=a1b2c3#/consent?source=banner`

/** 只关心参数：查询参数 + hash（hash 内的参数递归取） */
function paramNodes(tree: UrlTree): UrlNode[] {
  return tree.nodes.filter(n => n.kind === 'param' || n.kind === 'hash')
}

function hasParams(tree: UrlTree): boolean {
  return paramNodes(tree).length > 0
}

/** 点击即编辑的文本：点击进入编辑态，Enter / 失焦提交，Esc 取消 */
function EditableText({
  text,
  className,
  mono,
  autoSize,
  title = '点击编辑',
  onCommit,
}: {
  text: string
  className?: string
  mono?: boolean
  /** 输入框宽度随内容变化（否则占满整行） */
  autoSize?: boolean
  title?: string
  onCommit: (next: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)

  if (draft !== null) {
    const commit = () => {
      // 内容没变不提交：避免序列化规范化改写 input（会触发历史记录误增）
      if (draft !== text)
        onCommit(draft)
      setDraft(null)
    }
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter')
            commit()
          if (e.key === 'Escape')
            setDraft(null)
        }}
        {...(autoSize
          // CJK 字符按 2 个宽度估算，避免输入框过窄
          ? { size: Math.max(1, [...draft].reduce((n, c) => n + (c.codePointAt(0)! > 0xFF ? 2 : 1), 0)) }
          : {})}
        className={cn(
          'min-w-0 rounded-sm border-2 border-border bg-background px-1 py-0 text-sm outline-none',
          autoSize ? 'w-auto' : 'flex-1',
          mono && 'font-mono',
          className,
        )}
      />
    )
  }

  return (
    <button
      type="button"
      title={title}
      onClick={() => setDraft(text)}
      className={cn(
        // 悬停高亮用 muted：参数 key 按层级着色（chart-2 与 secondary 同色），
        // 用 secondary 会在暗色模式下黄字叠黄底看不清
        'min-w-0 cursor-text rounded-sm px-1 text-left break-all hover:bg-muted',
        mono && 'font-mono text-sm',
        className,
      )}
    >
      {text || <span className="text-muted-foreground">（空）</span>}
    </button>
  )
}

/** 文件树连接符：祖先层竖线 / 空白 + 本行的 ├─ / └─ */
function TreePrefix({ lastFlags, isLast }: { lastFlags: boolean[], isLast: boolean }) {
  return (
    <span className="shrink-0 font-mono text-sm whitespace-pre text-muted-foreground select-none">
      {lastFlags.map(last => (last ? '   ' : '│  ')).join('')}
      {isLast ? '└─' : '├─'}
    </span>
  )
}

/** 序列化一棵树时去掉参数和 hash（它们已展开成子级行） */
function baseOfTree(tree: UrlTree): string {
  return serializeUrl({
    ...tree,
    hasQuery: false,
    hasHash: false,
    nodes: tree.nodes.filter(n => n.kind !== 'param' && n.kind !== 'hash'),
  })
}

/** 一棵树的参数 + hash 后缀（编辑 base 时保留它们） */
function suffixOfTree(tree: UrlTree): string {
  return serializeUrl({
    ...tree,
    leadingSlash: false,
    trailingSlash: false,
    nodes: tree.nodes.filter(n => n.kind === 'param' || n.kind === 'hash'),
  })
}

function ParamRow({
  node,
  depth,
  isLast,
  lastFlags,
  onEdit,
  onEditValue,
  onEditBase,
  onAddBelow,
  onDelete,
}: {
  node: UrlNode
  depth: number
  isLast: boolean
  /** 各祖先层（param 维度）是否是最后一个兄弟，用于画竖线 */
  lastFlags: boolean[]
  onEdit: (id: string, patch: Partial<Pick<UrlNode, 'label' | 'value'>>) => void
  /** 编辑普通值（重解析子树，避免残留旧子树覆盖新值） */
  onEditValue: (id: string, value: string) => void
  /** 编辑嵌套 URL 的 base 部分（协议/域名/路径），参数后缀保留 */
  onEditBase: (node: UrlNode, nextBase: string) => void
  /** 在该行所在层级、该行下方插入 key=value */
  onAddBelow: (node: UrlNode) => void
  onDelete: (id: string) => void
}) {
  const color = DEPTH_COLORS[depth % DEPTH_COLORS.length]
  // 嵌套 URL 的颜色与它下面的子级字段一致
  const childColor = DEPTH_COLORS[(depth + 1) % DEPTH_COLORS.length]
  const expandable = node.children !== null && hasParams(node.children)
  // 值是变量标记（$$name）时高亮展示
  const isVar = !expandable && variableName(node.value) !== null
  // 值是嵌套 URL 时，key 用渐变色（本组 → 下一组）；否则纯色
  const keyClass = expandable
    ? cn('bg-gradient-to-r bg-clip-text text-transparent', KEY_GRADIENTS[depth % KEY_GRADIENTS.length])
    : color

  // 值是嵌套 URL / 路径时，可复制「该 URL 及其下面所有参数」序列化后的完整串
  const [copiedSubtree, setCopiedSubtree] = useState(false)
  const copySubtree = () => {
    if (!node.children)
      return
    void navigator.clipboard.writeText(serializeUrl(node.children)).then(() => {
      setCopiedSubtree(true)
      setTimeout(setCopiedSubtree, 1200, false)
    })
  }

  return (
    <div>
      <div className="group flex items-center gap-0.5 rounded-sm pr-1 leading-5 hover:bg-secondary/40">
        <TreePrefix lastFlags={lastFlags} isLast={isLast} />

        {/* key：param 可编辑，hash 固定为 # */}
        {node.kind === 'param'
          ? (
              <EditableText
                text={node.label}
                autoSize
                className={cn('shrink-0 text-sm font-bold', keyClass)}
                onCommit={next => onEdit(node.id, { label: next })}
              />
            )
          : (
              <span className={cn('shrink-0 px-1 text-sm font-bold', keyClass)}>#</span>
            )}

        {/* 值：有子参数时可编辑嵌套 URL 的 base（不含参数/hash），颜色与子级一致 */}
        {expandable
          ? (
              <>
                <span className="shrink-0 font-mono text-muted-foreground select-none">=</span>
                <EditableText
                  text={baseOfTree(node.children!)}
                  mono
                  className={cn('flex-1 truncate', childColor)}
                  onCommit={next => onEditBase(node, next)}
                />
              </>
            )
          : (
              <>
                {(node.kind !== 'param' || node.flag) && (
                  <span className="shrink-0 font-mono text-muted-foreground select-none">=</span>
                )}
                <EditableText
                  text={node.value}
                  mono
                  title={isVar ? `变量 ${variableName(node.value)}` : undefined}
                  className={cn('flex-1', isVar && 'font-bold text-chart-5')}
                  onCommit={next => onEditValue(node.id, next)}
                />
              </>
            )}

        {/* 复制（仅嵌套 URL 行）/ + / x 紧跟内容末尾（不再顶到最右侧），hover 显示 */}
        {node.children !== null && (
          <button
            type="button"
            aria-label="复制该 URL 及其所有参数"
            title="复制该 URL 及其所有参数"
            onClick={copySubtree}
            className="ml-1 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-secondary hover:text-foreground"
          >
            {copiedSubtree ? <Check className="size-3" /> : <Copy className="size-3" />}
          </button>
        )}
        <button
          type="button"
          aria-label="在下方插入字段"
          onClick={() => onAddBelow(node)}
          className={cn('flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-secondary hover:text-foreground', node.children === null && 'ml-1')}
        >
          <Plus className="size-3" />
        </button>
        <button
          type="button"
          aria-label="删除"
          onClick={() => onDelete(node.id)}
          className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-secondary hover:text-destructive"
        >
          <X className="size-3" />
        </button>
      </div>

      {expandable && (
        <ParamTree
          tree={node.children!}
          depth={depth + 1}
          lastFlags={[...lastFlags, isLast]}
          onEdit={onEdit}
          onEditValue={onEditValue}
          onEditBase={onEditBase}
          onAddBelow={onAddBelow}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}

function ParamTree({
  tree,
  depth,
  lastFlags,
  onEdit,
  onEditValue,
  onEditBase,
  onAddBelow,
  onDelete,
}: {
  tree: UrlTree
  depth: number
  lastFlags: boolean[]
  onEdit: (id: string, patch: Partial<Pick<UrlNode, 'label' | 'value'>>) => void
  onEditValue: (id: string, value: string) => void
  onEditBase: (node: UrlNode, nextBase: string) => void
  onAddBelow: (node: UrlNode) => void
  onDelete: (id: string) => void
}) {
  const nodes = paramNodes(tree)
  return (
    <div>
      {nodes.map((node, i) => (
        <ParamRow
          key={node.id}
          node={node}
          depth={depth}
          isLast={i === nodes.length - 1}
          lastFlags={lastFlags}
          onEdit={onEdit}
          onEditValue={onEditValue}
          onEditBase={onEditBase}
          onAddBelow={onAddBelow}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

/** 记录卡片里的二维码：按文本异步生成，空态占位 */
function RecordQr({ text, size = 128 }: { text: string, size?: number }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    let cancelled = false
    encodeQr(text, 'L')
      .then((u) => {
        if (!cancelled)
          setUrl(u)
      })
      .catch(() => {
        if (!cancelled)
          setUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [text])
  if (!url) {
    return (
      <div className="flex items-center justify-center" style={{ width: size, height: size }}>
        <QrCode className="size-8 text-muted-foreground" />
      </div>
    )
  }
  return <img src={url} alt="记录内容二维码" style={{ width: size, height: size }} className="shrink-0" />
}

/** 只读参数行：与参数板块同样的树形展示（连接符 / 层级着色 / 渐变 key），不可编辑 */
function StaticRow({ node, depth, isLast, lastFlags }: { node: UrlNode, depth: number, isLast: boolean, lastFlags: boolean[] }) {
  const color = DEPTH_COLORS[depth % DEPTH_COLORS.length]
  // 嵌套 URL 的颜色与它下面的子级字段一致
  const childColor = DEPTH_COLORS[(depth + 1) % DEPTH_COLORS.length]
  const expandable = node.children !== null && hasParams(node.children)
  // 值是变量标记（$$name）时高亮展示
  const isVar = !expandable && variableName(node.value) !== null
  // 值是嵌套 URL 时，key 用渐变色（本组 → 下一组）；否则纯色
  const keyClass = expandable
    ? cn('bg-gradient-to-r bg-clip-text text-transparent', KEY_GRADIENTS[depth % KEY_GRADIENTS.length])
    : color

  return (
    <div>
      <div className="flex items-center gap-0.5 rounded-sm pr-1 leading-5">
        <TreePrefix lastFlags={lastFlags} isLast={isLast} />
        {/* key：param 展示参数名，hash 固定为 # */}
        <span className={cn('shrink-0 px-1 text-sm font-bold', keyClass)}>
          {node.kind === 'param' ? (node.label || '（空）') : '#'}
        </span>
        {/* 值：嵌套 URL 只展示 base（参数已展开成子级），普通值原样展示 */}
        {expandable
          ? (
              <>
                <span className="shrink-0 font-mono text-muted-foreground select-none">=</span>
                <span className={cn('flex-1 font-mono text-sm break-all', childColor)}>{baseOfTree(node.children!)}</span>
              </>
            )
          : (
              <>
                {(node.kind !== 'param' || node.flag) && (
                  <span className="shrink-0 font-mono text-muted-foreground select-none">=</span>
                )}
                <span className={cn('flex-1 font-mono text-sm break-all', isVar && 'font-bold text-chart-5')}>
                  {node.value || '（空）'}
                </span>
              </>
            )}
      </div>
      {expandable && (
        <StaticTree tree={node.children!} depth={depth + 1} lastFlags={[...lastFlags, isLast]} />
      )}
    </div>
  )
}

function StaticTree({ tree, depth, lastFlags }: { tree: UrlTree, depth: number, lastFlags: boolean[] }) {
  const nodes = paramNodes(tree)
  return (
    <div>
      {nodes.map((node, i) => (
        <StaticRow
          key={node.id}
          node={node}
          depth={depth}
          isLast={i === nodes.length - 1}
          lastFlags={lastFlags}
        />
      ))}
    </div>
  )
}

/** 记录预览：二维码 + 只读参数树（与参数板块同样样式）；非 URL 内容原样展示 */
function RecordPreviewContent({ text }: { text: string }) {
  const tree = useMemo(() => parseUrl(text), [text])
  return (
    <div className="flex gap-3">
      <RecordQr text={text} size={112} />
      <div className="min-w-0 flex-1">
        {!looksLikeUrl(text)
          ? <p className="text-sm break-all text-popover-foreground">{text}</p>
          : (
              <>
                {/* 根节点：顶层 URL 的 base，颜色与参数字段一致 */}
                <div className="flex items-center gap-1 leading-5">
                  <Link2 className={cn('size-3.5 shrink-0', DEPTH_COLORS[0])} />
                  <span className={cn('flex-1 font-mono text-sm break-all', DEPTH_COLORS[0])}>{baseOfTree(tree)}</span>
                </div>
                {hasParams(tree)
                  ? <StaticTree tree={tree} depth={0} lastFlags={[]} />
                  : <p className="py-1 pl-6 text-sm text-muted-foreground">没有解析到参数</p>}
              </>
            )}
      </div>
    </div>
  )
}

/** 是否小屏（移动端）：预览从悬停 tooltip 切换为点击弹窗 */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return isMobile
}

/**
 * 记录预览的交互壳：
 * - 桌面端：悬停时在光标上方弹出只读 tooltip（优先右上、放不下换左上、再放不下居中）
 * - 移动端：点击同样的内容（二维码 / 名称）打开弹窗展示预览
 */
function RecordPreviewTip({ text, wide, onSelect, children }: { text: string, wide?: boolean, onSelect?: () => void, children: ReactNode }) {
  const isMobile = useIsMobile()
  const [anchor, setAnchor] = useState<{ x: number, y: number } | null>(null)
  const [pos, setPos] = useState<{ left: number, top: number } | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const tipRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // 弹窗开合（原生 <dialog>）
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog)
      return
    if (dialogOpen) {
      if (!dialog.open)
        dialog.showModal()
    }
    else if (dialog.open) {
      dialog.close()
    }
  }, [dialogOpen])

  // 内容渲染完成后按实际尺寸定位（树可能很高，必须先量再摆）

  useLayoutEffect(() => {
    if (!anchor || !tipRef.current)
      return
    const el = tipRef.current
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    // 优先右上：光标右上方留 14px 偏移
    let left = anchor.x + 14
    let top = anchor.y - h - 14
    // 右侧放不下 → 左上
    if (left + w > vw - 8)
      left = anchor.x - w - 14
    // 左侧也放不下 → 中上
    if (left < 8)
      left = anchor.x - w / 2
    // 上方放不下 → 落到光标下方
    if (top < 8)
      top = anchor.y + 18
    left = Math.max(8, Math.min(left, vw - w - 8))
    top = Math.max(8, Math.min(top, vh - h - 8))
    setPos(prev => (prev && prev.left === left && prev.top === top ? prev : { left, top }))
  }, [anchor])

  // 滚动 / Esc 时关闭（内容较高时跟随滚动会跑偏，直接收起更稳）
  useEffect(() => {
    if (!anchor)
      return
    const hide = () => setAnchor(null)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape')
        hide()
    }
    window.addEventListener('scroll', hide, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [anchor])

  return (
    <>
      <span
        title={isMobile ? '点击查看预览' : '悬停查看预览'}
        {...(isMobile
          ? {
              // 移动端：点击打开弹窗；捕获阶段拦截，避免触发内部按钮（如二维码的切换选中）
              onClickCapture: (e: { stopPropagation: () => void }) => {
                e.stopPropagation()
                setDialogOpen(true)
              },
            }
          : {
              onMouseEnter: (e: { clientX: number, clientY: number }) => setAnchor({ x: e.clientX, y: e.clientY }),
              onMouseLeave: () => setAnchor(null),
            })}
        className={cn(
          'flex min-w-0 cursor-pointer',
          wide && 'max-w-full',
        )}
      >
        {children}
      </span>
      {/* 桌面端悬停 tooltip */}
      {anchor && !isMobile && (
        <div
          ref={tipRef}
          role="tooltip"
          style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
          className={cn(
            'pointer-events-none fixed z-50 max-h-[60vh] overflow-auto rounded-md border-2 border-border bg-popover px-3 py-2 text-popover-foreground shadow-hard-sm',
            wide ? 'w-[min(40rem,calc(100vw-1rem))]' : 'max-w-[min(28rem,calc(100vw-1rem))]',
          )}
        >
          <RecordPreviewContent text={text} />
        </div>
      )}
      {/* 移动端预览弹窗 */}
      <dialog
        ref={dialogRef}
        onClose={() => setDialogOpen(false)}
        // 点击描边 / 背板区域（事件目标是 dialog 本身）时关闭
        onClick={e => e.target === dialogRef.current && setDialogOpen(false)}
        className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-lg border-2 border-border bg-popover p-5 text-popover-foreground shadow-hard-lg backdrop:bg-black/50"
      >
        {dialogOpen && (
          <div className="max-h-[70vh] overflow-auto">
            <RecordPreviewContent text={text} />
            <div className="mt-4 flex justify-end gap-2">
              {onSelect && (
                <Button
                  size="sm"
                  onClick={() => {
                    onSelect()
                    setDialogOpen(false)
                  }}
                >
                  切换到该记录
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                关闭
              </Button>
            </div>
          </div>
        )}
      </dialog>
    </>
  )
}

/** 保存记录时的默认名：取去掉协议的 base，截断 24 字符 */
function defaultName(input: string): string {
  const base = baseOfTree(parseUrl(input)).replace(/^[a-z][a-z0-9+.-]*:(\/\/)?/i, '').trim()
  return [...base].slice(0, 24).join('') || '未命名记录'
}

function UrlParserTool() {
  const [input, setInput] = useState('')
  const tree = useMemo(() => parseUrl(input), [input])
  const found = hasParams(tree)
  // 根节点只展示 base（协议 + 主机 + 路径），参数和 # 已在树里展开
  const baseUrl = useMemo(() => baseOfTree(tree), [tree])
  // 内容是否是 URL / 路径：不是时（如识别出的纯文本二维码）参数树和代码预览保持默认态
  const isUrl = looksLikeUrl(input)

  // 挂载时从 URL hash 读入初始内容（#url=...；兼容旧二维码工具分享的 #text=...）
  useEffect(() => {
    const timer = setTimeout(() => {
      const hash = window.location.hash.slice(1)
      const initial = hash.startsWith('text=') ? readHashParam('text') : readHashParam('url')
      if (initial)
        setInput(initial)
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  // 内容变动 → 同步到 URL hash（防抖，replaceState 不产生历史记录）
  useEffect(() => {
    const timer = setTimeout(writeHashParam, 400, 'url', input)
    return () => clearTimeout(timer)
  }, [input])

  const handleEdit = useCallback((id: string, patch: Partial<Pick<UrlNode, 'label' | 'value'>>) => {
    setInput(prev => serializeUrl(updateNode(parseUrl(prev), id, patch)))
  }, [])

  // 编辑普通值：重解析子树，避免旧子树覆盖新值
  const handleEditValue = useCallback((id: string, value: string) => {
    setInput(prev => serializeUrl(setNodeValue(parseUrl(prev), id, value)))
  }, [])

  // 编辑嵌套 URL 的 base（协议/域名/路径）：剥离误贴的参数/hash 后，拼接原参数后缀再重解析
  const handleEditBase = useCallback((node: UrlNode, nextBase: string) => {
    const cleanBase = nextBase.split(/[?#]/)[0]
    const suffix = node.children ? suffixOfTree(node.children) : ''
    setInput(prev => serializeUrl(setNodeValue(parseUrl(prev), node.id, cleanBase + suffix)))
  }, [])

  const handleDelete = useCallback((id: string) => {
    setInput(prev => serializeUrl(deleteNode(parseUrl(prev), id)))
  }, [])

  // 在某一行所在层级、其下方插入 key=value（默认值便于继续编辑）
  const handleAddBelow = useCallback((node: UrlNode | null) => {
    setInput(prev => serializeUrl(
      node === null
        ? addParam(parseUrl(prev), null, 'key', 'value')
        : insertParamBelow(parseUrl(prev), node.id, 'key', 'value'),
    ))
  }, [])

  const [copied, setCopied] = useState(false)

  // 输入内容的二维码预览（防抖 400ms）
  const [qr, setQr] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(() => {
      if (!input.trim()) {
        if (!cancelled)
          setQr(null)
        return
      }
      encodeQr(input, 'L')
        .then((dataUrl) => {
          if (!cancelled)
            setQr(dataUrl)
        })
        .catch(() => {
          if (!cancelled)
            setQr(null)
        })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [input])

  // —— 二维码图片识别（原二维码工具能力）：点击选择 / 拖拽 / 粘贴图片 ——
  const [qrError, setQrError] = useState('')
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    setQrError('')
    try {
      const result = await decodeQr(file)
      if (result) {
        setInput(result)
      }
      else {
        setQrError('未在图片中识别到二维码，换一张更清晰的试试')
      }
    }
    catch {
      setQrError('图片读取失败，请确认是有效的图片文件')
    }
  }, [])

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

  const downloadQr = useCallback(() => {
    if (!qr)
      return
    const a = document.createElement('a')
    a.href = qr
    a.download = 'qrcode.png'
    a.click()
  }, [qr])

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(input).then(() => {
      setCopied(true)
      setTimeout(setCopied, 1200, false)
    })
  }, [input])

  // 参数板块根节点行：复制序列化后的完整 URL（含下面所有参数，规范化编码）
  const [copiedTree, setCopiedTree] = useState(false)
  const copyTree = useCallback(() => {
    void navigator.clipboard.writeText(serializeUrl(tree)).then(() => {
      setCopiedTree(true)
      setTimeout(setCopiedTree, 1200, false)
    })
  }, [tree])

  // 代码预览：变量原样插值，encodeURIComponent 只包变量本身（按嵌套层级叠加）
  const codeGen = useMemo(() => generateCode(tree), [tree])
  // 是否声明了 $$变量：有变量才展示代码预览（右侧）
  const hasVars = useMemo(() => codeGen.tokens.some(t => t.kind === 'var'), [codeGen])
  const [copiedCode, setCopiedCode] = useState(false)
  const copyCode = useCallback(() => {
    void navigator.clipboard.writeText(codeGen.code).then(() => {
      setCopiedCode(true)
      setTimeout(setCopiedCode, 1200, false)
    })
  }, [codeGen.code])

  // 记录：主动保存；记录是稳定快照，点击切换内容，不再静默回写
  const { items: records, add: addRecord, update: updateRecord, remove: removeRecord, clear: clearRecords } = useUrlRecords()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')

  /** 保存为新记录：无论当前是否选中，都新增一条并选中进入重命名 */
  const handleSave = useCallback(() => {
    const name = defaultName(input)
    const id = addRecord(input, name)
    if (id) {
      // 保存后选中并直接进入重命名（预填默认名），方便立刻起一个名字
      setSelectedId(id)
      setNameDraft(name)
      setRenamingId(id)
    }
  }, [input, addRecord])

  /** 更新：把当前内容回写到选中的记录（名称保持不变） */
  const handleUpdate = useCallback(() => {
    if (selectedId)
      updateRecord(selectedId, { text: input })
  }, [input, selectedId, updateRecord])

  const toggleSelect = useCallback((item: UrlRecord) => {
    // 再次点击取消选中；切换到另一条时不回写输入框当前内容
    if (selectedId === item.id) {
      setSelectedId(null)
      return
    }
    setSelectedId(item.id)
    setRenamingId(null)
    setInput(item.text)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [selectedId])

  const commitRename = useCallback(() => {
    if (renamingId)
      updateRecord(renamingId, { name: nameDraft.trim() })
    setRenamingId(null)
  }, [renamingId, nameDraft, updateRecord])

  // 删除 / 清空记录需二次确认
  const [confirmState, setConfirmState] = useState<{ kind: 'remove', id: string } | { kind: 'clear' } | null>(null)
  const handleConfirm = useCallback(() => {
    if (!confirmState)
      return
    if (confirmState.kind === 'remove') {
      if (selectedId === confirmState.id)
        setSelectedId(null)
      removeRecord(confirmState.id)
    }
    else {
      setSelectedId(null)
      clearRecords()
    }
  }, [confirmState, selectedId, removeRecord, clearRecords])

  const [copiedId, setCopiedId] = useState<string | null>(null)

  // 二维码放大弹层：点击缩略图打开，Esc / 点击遮罩关闭
  const [qrEnlarged, setQrEnlarged] = useState(false)
  useEffect(() => {
    if (!qrEnlarged)
      return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape')
        setQrEnlarged(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [qrEnlarged])
  const copyHistory = useCallback((id: string, text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(setCopiedId, 1200, null)
    })
  }, [])

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <Seo
        title="URL 解析"
        description="把任意协议 URL / 路径的参数拆成文件树，嵌套参数递归展开、可编辑；内容实时生成二维码，也可上传二维码图片识别；支持 $$变量 声明与代码预览、记录保存。"
        path="/tools/url-parser"
      />
      {/* 顶栏 */}
      <header className="flex h-24 items-center gap-3">
        <Button asChild variant="outline" size="icon">
          <Link to="/" aria-label="返回首页">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <div className="flex size-10 items-center justify-center rounded-md border-2 border-border bg-chart-3 shadow-hard-xs">
          <Link2 className="size-5 text-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-tight">URL 解析</h1>
          <p className="text-sm text-muted-foreground">URL ⇄ 二维码双向互转，参数拆成文件树、嵌套递归展开、可编辑</p>
        </div>
      </header>

      {/* 输入 + 二维码：左右两块布局，等高对齐 */}
      <div className="flex flex-col gap-5 md:flex-row md:items-stretch">
        {/* 输入板块 */}
        <Card className="min-w-0 flex-1">
          <CardContent className="flex h-full flex-col gap-3 px-6 py-6">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="粘贴任意 URL 或路径，例如 https://a.com/p?x=1#/hash；参数值写成 $$变量名 可声明变量并在下方生成代码"
              className="min-h-44 w-full flex-1 resize-y rounded-md border-2 border-border bg-background px-3 py-2 font-mono text-sm outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            {qrError && (
              <p className="rounded-md border-2 border-border bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">
                {qrError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={!input} onClick={copy}>
                {copied ? <Check /> : <Copy />}
                复制
              </Button>
              {/* 选中记录时提供「更新」回写该记录；「保存」始终新增一条记录 */}
              {selectedId && (
                <Button
                  variant="default"
                  size="sm"
                  disabled={!input.trim()}
                  title="把当前内容回写到选中的记录"
                  onClick={handleUpdate}
                >
                  <Save />
                  更新
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={!input.trim()}
                title="保存为新记录"
                onClick={handleSave}
              >
                <Plus />
                保存
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setInput(EXAMPLE)}>
                <Sparkles />
                试试示例
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 二维码板块：与输入框左右布局、等高；二维码填满剩余高度，下载按钮与输入区按钮同一水平线 */}
        <Card className="flex shrink-0 flex-col md:w-56">
          <CardContent className="flex h-full flex-col gap-3 px-6 py-6">
            <div
              role="button"
              tabIndex={0}
              title="点击选择 / 拖拽 / 粘贴二维码图片识别"
              aria-label="上传二维码图片识别"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                'flex min-h-0 w-full flex-1 cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 border-border bg-background p-1 transition-colors',
                !qr && 'border-dashed',
                dragging ? 'bg-secondary' : 'hover:bg-secondary/50',
              )}
            >
              {qr
                ? (
                    <img
                      src={qr}
                      alt="当前内容的二维码，点击放大"
                      title="点击放大二维码"
                      onClick={(e) => {
                        // 点图片本身 → 放大；点其余区域 → 上传识别
                        e.stopPropagation()
                        setQrEnlarged(true)
                      }}
                      className="size-full min-h-0 cursor-zoom-in rounded-sm bg-white object-contain"
                    />
                  )
                : (
                    <div className="flex flex-col items-center gap-1 p-2 text-center text-muted-foreground">
                      <QrCode className="size-8" />
                      <span className="text-xs">上传二维码识别</span>
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
            <Button variant="outline" size="sm" disabled={!qr} onClick={downloadQr} className="shrink-0">
              <Download />
              下载
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 参数 + 代码预览：左右融合为一个板块；代码预览仅在存在 $$变量 时出现 */}
      <Card className="mt-5">
        <CardHeader>
          <CardTitle>参数</CardTitle>
          <CardDescription>
            点击 key 或 value 即可编辑，改动会同步回上面的完整字符串；值写成
            {' '}
            <code className="rounded-sm bg-secondary px-1 font-mono">$$变量名</code>
            {' '}
            即声明变量，声明后右侧会生成模板字符串代码（嵌套 URL 里的变量按层级叠对应次数的 encodeURIComponent）
          </CardDescription>
          {hasVars && (
            <CardAction>
              <Button variant="ghost" size="sm" disabled={!isUrl} onClick={copyCode}>
                {copiedCode ? <Check /> : <Copy />}
                复制代码
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="pb-6">
          {!isUrl
            ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {input.trim() ? '当前内容不是 URL / 路径，参数树保持默认状态' : '输入 URL 或路径后，这里会展示参数树'}
                </p>
              )
            : (
                <div className="flex flex-col gap-4">
                  {/* 参数树 */}
                  <div className="w-full">
                    {/* 根节点：顶层 URL 的 base（可编辑），颜色与下面的参数字段一致 */}
                    <div className="group flex items-center gap-1 rounded-sm pr-1 leading-5 hover:bg-secondary/40">
                      <Link2 className={cn('size-3.5 shrink-0', DEPTH_COLORS[0])} />
                      <EditableText
                        text={baseUrl}
                        mono
                        className={cn('flex-1 break-all', DEPTH_COLORS[0])}
                        onCommit={next => setInput(next.split(/[?#]/)[0] + suffixOfTree(tree))}
                      />
                      <button
                        type="button"
                        aria-label="复制该 URL 及其所有参数"
                        title="复制该 URL 及其所有参数"
                        onClick={copyTree}
                        className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-secondary hover:text-foreground"
                      >
                        {copiedTree ? <Check className="size-3" /> : <Copy className="size-3" />}
                      </button>
                      <button
                        type="button"
                        aria-label="添加字段"
                        onClick={() => handleAddBelow(null)}
                        className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-secondary hover:text-foreground"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>
                    {found
                      ? (
                          <ParamTree tree={tree} depth={0} lastFlags={[]} onEdit={handleEdit} onEditValue={handleEditValue} onEditBase={handleEditBase} onAddBelow={handleAddBelow} onDelete={handleDelete} />
                        )
                      : (
                          <p className="py-3 pl-6 text-sm text-muted-foreground">没有解析到参数</p>
                        )}
                  </div>
                  {/* 代码预览：变量生成模板字符串插值，按嵌套层级着色（与参数树一致）；仅在存在变量时展示在参数树下方 */}
                  {hasVars && (
                    <pre className="overflow-x-auto rounded-md border-2 border-border bg-background p-3 font-mono text-sm leading-6 break-all whitespace-pre-wrap">
                      {/* eslint-disable react/no-array-index-key -- token 无稳定 id，顺序固定 */}
                      {codeGen.tokens.map((t, i) => (
                        <span
                          key={i}
                          className={cn(
                            t.kind !== 'static' && DEPTH_COLORS[t.depth % DEPTH_COLORS.length],
                            t.kind === 'var' && 'font-bold underline',
                          )}
                        >
                          {t.text}
                        </span>
                      ))}
                      {/* eslint-enable react/no-array-index-key */}
                    </pre>
                  )}
                </div>
              )}
        </CardContent>
      </Card>

      {/* 记录（存 localStorage，仅客户端渲染以避免 hydration 不一致） */}
      <ClientOnly>
        {() => (
          <Card className="mt-5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bookmark className="size-4" />
                记录
              </CardTitle>
              <CardDescription>仅保存在浏览器本地；点击记录即可切换到该记录的内容</CardDescription>
              {records.length > 0 && (
                <CardAction>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmState({ kind: 'clear' })}>
                    <Trash2 />
                    清空
                  </Button>
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="pb-6">
              {records.length === 0
                ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                      还没有保存的记录，点击上方「保存」把当前内容存下来
                    </p>
                  )
                : (
                    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {records.map(item => (
                        <li
                          key={item.id}
                          className={cn(
                            'flex min-w-0 items-stretch gap-2 rounded-md border-2 bg-background p-2 shadow-hard-xs',
                            selectedId === item.id ? 'border-primary' : 'border-border',
                          )}
                        >
                          {/* 悬停二维码或名称弹出预览（移动端点击打开弹窗），点击切换到该记录 */}
                          <RecordPreviewTip text={item.text} wide onSelect={() => toggleSelect(item)}>
                            <button
                              type="button"
                              title={selectedId === item.id ? '点击取消选中' : '点击切换到该记录的内容'}
                              aria-label={`切换到记录 ${item.name || item.text}`}
                              onClick={() => toggleSelect(item)}
                              className="flex cursor-pointer items-center"
                            >
                              <RecordQr text={item.text} size={64} />
                            </button>
                          </RecordPreviewTip>
                          <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
                            {renamingId === item.id
                              ? (
                                  <input
                                    autoFocus
                                    value={nameDraft}
                                    placeholder="给记录起一个名字"
                                    onChange={e => setNameDraft(e.target.value)}
                                    onBlur={commitRename}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter')
                                        commitRename()
                                      if (e.key === 'Escape')
                                        setRenamingId(null)
                                    }}
                                    className="min-w-0 w-full rounded-sm border-2 border-border bg-background px-1 py-0 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                  />
                                )
                              : (
                                  <RecordPreviewTip text={item.text} wide onSelect={() => toggleSelect(item)}>
                                    <span className="flex min-w-0 items-center gap-1">
                                      <span className="max-w-full truncate text-sm font-bold">{item.name || item.text}</span>
                                      {selectedId === item.id && (
                                        <span className="shrink-0 rounded-sm bg-primary px-1 text-xs font-bold text-primary-foreground">编辑中</span>
                                      )}
                                    </span>
                                  </RecordPreviewTip>
                                )}
                            <div className="flex gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="重命名"
                                onClick={() => {
                                  setRenamingId(item.id)
                                  setNameDraft(item.name)
                                }}
                              >
                                <Pencil />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="复制"
                                onClick={() => copyHistory(item.id, item.text)}
                              >
                                {copiedId === item.id ? <Check /> : <Copy />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="删除"
                                onClick={() => setConfirmState({ kind: 'remove', id: item.id })}
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
            </CardContent>
          </Card>
        )}
      </ClientOnly>

      {/* 二维码放大弹层：放大到接近满屏，密集二维码也能扫 */}
      {qrEnlarged && qr && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="二维码大图"
          onClick={() => setQrEnlarged(false)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-foreground/60 p-4"
        >
          <img
            src={qr}
            alt="当前内容的二维码（放大）"
            style={{ imageRendering: 'pixelated' }}
            className="w-[min(88vw,30rem)] rounded-md border-2 border-border bg-white object-contain shadow-hard-lg"
          />
        </div>
      )}

      {/* 删除 / 清空记录的二次确认 */}
      <ConfirmDialog
        open={confirmState !== null}
        title={confirmState?.kind === 'clear' ? '清空全部记录' : '删除这条记录'}
        description={confirmState?.kind === 'clear' ? '所有保存的记录都会被删除，且无法恢复。' : '这条记录会被删除，且无法恢复。'}
        confirmLabel={confirmState?.kind === 'clear' ? '清空' : '删除'}
        onConfirm={handleConfirm}
        onClose={() => setConfirmState(null)}
      />
    </div>
  )
}

export default UrlParserTool
