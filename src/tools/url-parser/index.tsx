import type { UrlRecord } from './url-records'
import type { UrlNode, UrlTree } from './url-tree'
import { ArrowLeft, Bookmark, Check, CodeXml, Copy, Link2, Pencil, Plus, QrCode, Save, Sparkles, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ClientOnly } from 'vite-react-ssg'

import { Seo } from '@/components/seo'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { readHashParam, writeHashParam } from '@/lib/hash-param'
import { cn } from '@/lib/utils'
import { encodeQr } from '../qrcode-generator/qr-codec'
import { generateCode } from './url-code'
import { useUrlRecords } from './url-records'
import { addParam, deleteNode, parseUrl, serializeUrl, setNodeValue, updateNode, variableName } from './url-tree'

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
        'min-w-0 cursor-text rounded-sm px-1 text-left break-all hover:bg-secondary',
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
  onAdd,
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
  /** 在该 URL 下追加一个字段 */
  onAdd: (id: string) => void
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

        {expandable && (
          <button
            type="button"
            aria-label="添加字段"
            onClick={() => onAdd(node.id)}
            className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-secondary hover:text-foreground"
          >
            <Plus className="size-3" />
          </button>
        )}
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
          onAdd={onAdd}
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
  onAdd,
  onDelete,
}: {
  tree: UrlTree
  depth: number
  lastFlags: boolean[]
  onEdit: (id: string, patch: Partial<Pick<UrlNode, 'label' | 'value'>>) => void
  onEditValue: (id: string, value: string) => void
  onEditBase: (node: UrlNode, nextBase: string) => void
  onAdd: (id: string) => void
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
          onAdd={onAdd}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

function formatTime(time: number) {
  return new Date(time).toLocaleString('zh-CN', { hour12: false })
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

  // 挂载时从 URL hash 读入初始内容（#url=...，支持分享链接直达）
  useEffect(() => {
    const timer = setTimeout(() => {
      const initial = readHashParam('url')
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

  // 在某个 URL（parentId 为 null 表示顶层）下追加一个字段，默认 key=value 便于继续编辑
  const handleAdd = useCallback((parentId: string | null) => {
    setInput(prev => serializeUrl(addParam(parseUrl(prev), parentId, 'key', 'value')))
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

  const copy = useCallback(() => {
    void navigator.clipboard.writeText(input).then(() => {
      setCopied(true)
      setTimeout(setCopied, 1200, false)
    })
  }, [input])

  // 代码预览：变量原样插值，encodeURIComponent 只包变量本身（按嵌套层级叠加）
  const codeGen = useMemo(() => generateCode(tree), [tree])
  const [copiedCode, setCopiedCode] = useState(false)
  const copyCode = useCallback(() => {
    void navigator.clipboard.writeText(codeGen.code).then(() => {
      setCopiedCode(true)
      setTimeout(setCopiedCode, 1200, false)
    })
  }, [codeGen.code])

  // 记录：主动保存；选中一条后编辑内容会同步更新该记录
  const { items: records, add: addRecord, update: updateRecord, remove: removeRecord, clear: clearRecords } = useUrlRecords()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')

  // 选中记录后，编辑内容防抖同步回该记录（不再每次改动都新增历史）
  useEffect(() => {
    if (!selectedId)
      return
    const timer = setTimeout(updateRecord, 300, selectedId, { text: input })
    return () => clearTimeout(timer)
  }, [input, selectedId, updateRecord])

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

  const toggleSelect = useCallback((item: UrlRecord) => {
    if (selectedId === item.id) {
      setSelectedId(null)
      return
    }
    setSelectedId(item.id)
    setInput(item.text)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [selectedId])

  const commitRename = useCallback(() => {
    if (renamingId)
      updateRecord(renamingId, { name: nameDraft.trim() })
    setRenamingId(null)
  }, [renamingId, nameDraft, updateRecord])

  const handleRemoveRecord = useCallback((id: string) => {
    if (selectedId === id)
      setSelectedId(null)
    removeRecord(id)
  }, [selectedId, removeRecord])

  const handleClearRecords = useCallback(() => {
    setSelectedId(null)
    clearRecords()
  }, [clearRecords])

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
        description="把任意协议 URL / 路径的参数拆成文件树，嵌套参数递归展开、层级着色、可编辑；支持 $$变量 声明与代码预览、记录保存与二维码分享。"
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
          <p className="text-sm text-muted-foreground">把 URL / 路径里的参数拆成文件树，嵌套参数递归展开、可编辑</p>
        </div>
      </header>

      {/* 输入 */}
      <Card>
        <CardContent className="flex flex-col gap-3 px-6 py-6">
          <div className="flex items-stretch gap-3">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="粘贴任意 URL 或路径，例如 https://a.com/p?x=1#/hash；参数值写成 $$变量名 可声明变量并在下方生成代码"
              rows={6}
              className="w-full flex-1 resize-y rounded-md border-2 border-border bg-background px-3 py-2 font-mono text-sm outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
            {/* 二维码区域常驻展示，无内容时占位；点击放大便于扫描密集二维码 */}
            {qr
              ? (
                  <button
                    type="button"
                    title="点击放大二维码"
                    aria-label="放大二维码"
                    onClick={() => setQrEnlarged(true)}
                    className="shrink-0 cursor-zoom-in self-start rounded-md transition-transform hover:-translate-y-0.5"
                  >
                    <img
                      src={qr}
                      alt="当前内容的二维码"
                      className="size-36 rounded-md border-2 border-border bg-white object-contain shadow-hard-xs"
                    />
                  </button>
                )
              : (
                  <div className="flex size-36 shrink-0 self-start items-center justify-center rounded-md border-2 border-dashed border-border/50 text-muted-foreground/40">
                    <QrCode className="size-8" />
                  </div>
                )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={!input} onClick={copy}>
              {copied ? <Check /> : <Copy />}
              复制
            </Button>
            <Button variant="default" size="sm" disabled={!input.trim()} onClick={handleSave}>
              <Save />
              保存
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setInput(EXAMPLE)}>
              <Sparkles />
              试试示例
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 参数树 */}
      <Card className="mt-5">
        <CardHeader>
          <CardTitle>参数</CardTitle>
          <CardDescription>点击 key 或 value 即可编辑，改动会同步回上面的完整字符串；值写成 $$变量名 即声明变量</CardDescription>
        </CardHeader>
        <CardContent className="pb-6">
          {!input.trim()
            ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  输入 URL 或路径后，这里会展示参数树
                </p>
              )
            : (
                <div>
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
                      aria-label="添加字段"
                      onClick={() => handleAdd(null)}
                      className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-secondary hover:text-foreground"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                  {found
                    ? (
                        <ParamTree tree={tree} depth={0} lastFlags={[]} onEdit={handleEdit} onEditValue={handleEditValue} onEditBase={handleEditBase} onAdd={handleAdd} onDelete={handleDelete} />
                      )
                    : (
                        <p className="py-3 pl-6 text-sm text-muted-foreground">没有解析到参数</p>
                      )}
                </div>
              )}
        </CardContent>
      </Card>

      {/* 代码预览：变量生成模板字符串插值，按嵌套层级着色（与参数树一致） */}
      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CodeXml className="size-4" />
            代码预览
          </CardTitle>
          <CardDescription>
            值写成
            {' '}
            <code className="rounded-sm bg-secondary px-1 font-mono">$$变量名</code>
            {' '}
            即声明变量（原样插入）；嵌套 URL 里的变量按层级叠对应次数的 encodeURIComponent（只包变量）
          </CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" disabled={!input.trim()} onClick={copyCode}>
              {copiedCode ? <Check /> : <Copy />}
              复制
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="pb-6">
          {!input.trim()
            ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  输入 URL 或路径后，这里会生成对应的模板字符串代码
                </p>
              )
            : (
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
              <CardDescription>仅保存在浏览器本地；选中一条后，编辑内容会同步更新该记录</CardDescription>
              {records.length > 0 && (
                <CardAction>
                  <Button variant="ghost" size="sm" onClick={handleClearRecords}>
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
                    <ul className="flex flex-col gap-2">
                      {records.map(item => (
                        <li
                          key={item.id}
                          className={cn(
                            'flex items-center gap-2 rounded-md border-2 bg-background px-3 py-2',
                            selectedId === item.id ? 'border-primary shadow-hard-xs' : 'border-border',
                          )}
                        >
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
                                  className="min-w-0 flex-1 rounded-sm border-2 border-border bg-background px-1 py-0 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                />
                              )
                            : (
                                <button
                                  type="button"
                                  title={selectedId === item.id ? '取消选中' : '选中并填入输入框，后续编辑同步更新该记录'}
                                  onClick={() => toggleSelect(item)}
                                  className="min-w-0 flex-1 cursor-pointer text-left"
                                >
                                  <span className="flex items-center gap-2">
                                    <span className="truncate text-sm font-bold hover:underline">{item.name || item.text}</span>
                                    {selectedId === item.id && (
                                      <span className="shrink-0 rounded-sm bg-primary px-1 text-xs font-bold text-primary-foreground">编辑中</span>
                                    )}
                                  </span>
                                  <span className="block truncate font-mono text-xs text-muted-foreground">{item.text}</span>
                                </button>
                              )}
                          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                            {formatTime(item.time)}
                          </span>
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
                            onClick={() => handleRemoveRecord(item.id)}
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
    </div>
  )
}

export default UrlParserTool
