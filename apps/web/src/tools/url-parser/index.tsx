import type { ChangeEvent, DragEvent, ReactNode, SetStateAction } from 'react'
import type { JsonContainer, JsonValue } from './json-value'
import type { UrlRecord, UrlTab, UrlWorkspaceSnapshot } from './url-records'
import type { UrlNode, UrlTree } from './url-tree'
import { Bookmark, Check, Copy, Download, GitBranch, Link2, LoaderCircle, Pencil, Plus, QrCode, Save, Sparkles, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ClientOnly } from 'vite-react-ssg'

import { Seo } from '@/components/seo'
import { Button, buttonVariants } from '@/components/ui/button'

import { PopConfirm } from '@/components/ui/pop-confirm'
import { readHashParam, writeHashParam } from '@/lib/hash-param'
import { cn } from '@/lib/utils'
import { DEMO_URL } from '../demos/url-qrcode'
import { parseJsonContainer, parseJsonField, replaceJsonField } from './json-value'
import { decodeQr, encodeQr } from './qr-codec'
import { renderQrParameterPreview } from './qr-preview-image'
import { generateCode, resolveUrlVariables } from './url-code'
import { useUrlRecords } from './url-records'
import { addParam, baseOfTree, canMoveNode, deleteNode, findInsertedId, hasParams, insertParamBelow, looksLikeUrl, mergeBaseEdit, moveNode, paramNodes, parseUrl, serializeUrl, setNodeValue, suffixOfTree, updateNode, variableName } from './url-tree'
import './url-workspace.scss'

/** 层级文字颜色轮换：橙 → 黄 → 绿，暖色系相邻过渡（chart 令牌，随主题联动） */
const DEPTH_COLORS = ['text-chart-4', 'text-chart-2', 'text-chart-3'] as const

/** 嵌套 URL 的 key 渐变色：本组颜色保持到 30%，70% 处到达下一组颜色 */
const KEY_GRADIENTS = [
  'from-chart-4 from-30% to-chart-2 to-70%',
  'from-chart-2 from-30% to-chart-3 to-70%',
  'from-chart-3 from-30% to-chart-4 to-70%',
] as const

/** 点击即编辑的文本：点击进入编辑态，Enter / 失焦提交，Esc 取消 */
function EditableText({
  text,
  className,
  mono,
  autoSize,
  editSignal = 0,
  title = '点击编辑',
  displayText,
  onCommit,
}: {
  text: string
  className?: string
  mono?: boolean
  /** 输入框宽度随内容变化（否则占满整行） */
  autoSize?: boolean
  /** 外部触发的编辑信号（每次 +1）：重解析会复用组件实例，不能靠挂载初始态 */
  editSignal?: number
  title?: string
  displayText?: string
  onCommit: (next: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const selectNextRef = useRef(false)
  const lastSignalRef = useRef(0)

  // 外部信号进入编辑态（+ 号新建的 key）：nonce 变化时触发，全选方便直接覆盖。
  // 不加依赖数组：text 需取当次渲染的最新值
  useEffect(() => {
    if (editSignal && editSignal !== lastSignalRef.current) {
      lastSignalRef.current = editSignal
      selectNextRef.current = true
      setDraft(text)
    }
  })

  if (draft !== null) {
    const commit = () => {
      // 内容没变不提交：避免序列化规范化改写 input（会触发历史记录误增）
      if (draft !== text)
        onCommit(draft)
      setDraft(null)
      selectNextRef.current = false
    }
    return (
      <input
        autoFocus
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onFocus={(e) => {
          if (selectNextRef.current) {
            e.currentTarget.select()
            selectNextRef.current = false
          }
        }}
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
          'min-w-0 rounded-sm border border-border bg-background px-1 py-0 text-sm outline-none',
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
      {displayText ?? (text || <span className="text-muted-foreground">（空）</span>)}
    </button>
  )
}

/**
 * Tree connectors preserve ancestor rails and the current branch.
 * 文件树连接符保留祖先层竖线／空白与本行分支，以描边替代字符绘制。
 */
function TreePrefix({ lastFlags, isLast }: { lastFlags: boolean[], isLast: boolean }) {
  return (
    <span className="url-tree-rails" aria-hidden="true">
      {/* eslint-disable react/no-array-index-key -- ancestor positions define connector columns / 祖先位置定义连接线列 */}
      {lastFlags.map((last, index) => <i key={index} className={last ? '' : 'continues'} />)}
      {/* eslint-enable react/no-array-index-key */}
      <i className={isLast ? 'branch is-last' : 'branch'} />
    </span>
  )
}

/** JSON 字符串按原文编辑，数字、布尔和 null 按 JSON 字面量编辑。 */
function JsonFields({ value, depth, lastFlags, onChange }: {
  value: JsonContainer
  depth: number
  lastFlags: boolean[]
  onChange?: (value: JsonContainer) => void
}) {
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const entries = Object.entries(value)
  return (
    <div>
      {entries.map(([key, item], index) => {
        const isLast = index === entries.length - 1
        const container = item !== null && typeof item === 'object' && depth < 8
        const text = typeof item === 'string' ? item : JSON.stringify(item)
        const change = (next: JsonValue) => onChange?.(replaceJsonField(value, key, next))
        return (
          <div key={key}>
            <div className="url-node-row flex items-start gap-0.5 rounded-sm pr-1 leading-5">
              <TreePrefix lastFlags={lastFlags} isLast={isLast} />
              <span className={cn('shrink-0 px-1 font-mono text-sm font-bold', DEPTH_COLORS[depth % DEPTH_COLORS.length])}>
                {Array.isArray(value) ? `[${key}]` : key || '（空）'}
              </span>
              <span className="shrink-0 font-mono text-muted-foreground">:</span>
              {container
                ? <span className="px-1 font-mono text-sm text-muted-foreground">{Array.isArray(item) ? '[]' : '{}'}</span>
                : onChange
                  ? (
                      <EditableText
                        text={text}
                        mono
                        className="flex-1"
                        title={typeof item === 'string' ? '点击编辑字符串' : '点击编辑 JSON 值'}
                        onCommit={(next) => {
                          try {
                            change(parseJsonField(next, item))
                            setErrorKey(null)
                          }
                          catch {
                            setErrorKey(key)
                          }
                        }}
                      />
                    )
                  : <span className="min-w-0 flex-1 px-1 font-mono text-sm break-all">{text || '（空）'}</span>}
            </div>
            {errorKey === key && <p role="alert" className="px-1 text-xs text-destructive">请输入有效的 JSON 值，例如 123、true 或 null。</p>}
            {container && (
              <JsonFields value={item} depth={depth + 1} lastFlags={[...lastFlags, isLast]} onChange={onChange ? change : undefined} />
            )}
          </div>
        )
      })}
    </div>
  )
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
  onAddInside,
  onDelete,
  dragSourceId,
  dropTargetId,
  autoEdit,
  onDragStart,
  onDragEnd,
  onDragOverUrl,
  onDragLeaveUrl,
  onDropOnUrl,
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
  /** 值是嵌套 URL / 路径时，向该 URL 内部追加 key=value */
  onAddInside: (id: string) => void
  onDelete: (id: string) => void
  dragSourceId: string | null
  dropTargetId: string | null | undefined
  /** 新建参数后需要主动进入编辑态的节点（id + 触发信号） */
  autoEdit: { id: string, nonce: number } | null
  onDragStart: (event: DragEvent<HTMLElement>, id: string) => void
  onDragEnd: () => void
  onDragOverUrl: (event: DragEvent<HTMLElement>, targetId: string) => void
  onDragLeaveUrl: () => void
  onDropOnUrl: (event: DragEvent<HTMLElement>, targetId: string) => void
}) {
  const color = DEPTH_COLORS[depth % DEPTH_COLORS.length]
  // 嵌套 URL 的颜色与它下面的子级字段一致
  const childColor = DEPTH_COLORS[(depth + 1) % DEPTH_COLORS.length]
  const json = node.children === null ? parseJsonContainer(node.value) : null
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
      <div className="url-node-row group flex items-start gap-0.5 rounded-sm pr-1 leading-5 hover:bg-secondary/40">
        <TreePrefix lastFlags={lastFlags} isLast={isLast} />

        {/* key：param 可编辑，hash 固定为 # */}
        {node.kind === 'param'
          ? (
              <span
                draggable
                title={node.children ? '拖拽该 URL 及其所有参数；放到这里会移入该 URL' : '拖拽字段；放到这里会移动到同一层'}
                data-drag-key={node.id}
                onDragStart={event => onDragStart(event, node.id)}
                onDragEnd={onDragEnd}
                onDragOver={event => onDragOverUrl(event, node.id)}
                onDragLeave={onDragLeaveUrl}
                onDrop={event => onDropOnUrl(event, node.id)}
                className={cn(
                  'shrink-0 cursor-grab rounded-sm transition-all active:cursor-grabbing',
                  'hover:ring-2 hover:ring-border',
                  dragSourceId === node.id && 'opacity-40',
                  dropTargetId === node.id && 'bg-primary/15 ring-2 ring-primary',
                )}
              >
                <EditableText
                  text={node.label}
                  autoSize
                  editSignal={autoEdit?.id === node.id ? autoEdit.nonce : 0}
                  className={cn('text-sm font-bold', keyClass)}
                  onCommit={next => onEdit(node.id, { label: next })}
                />
              </span>
            )
          : (
              <span
                draggable
                title={node.children ? '拖拽 hash；放到这里会移入该 URL' : '拖拽 hash；放到这里会移动到同一层'}
                data-drag-key={node.id}
                onDragStart={event => onDragStart(event, node.id)}
                onDragEnd={onDragEnd}
                onDragOver={event => onDragOverUrl(event, node.id)}
                onDragLeave={onDragLeaveUrl}
                onDrop={event => onDropOnUrl(event, node.id)}
                className={cn(
                  'shrink-0 cursor-grab rounded-sm px-1 text-sm font-medium transition-colors active:cursor-grabbing',
                  'hover:ring-2 hover:ring-border',
                  keyClass,
                  dragSourceId === node.id && 'opacity-40',
                  dropTargetId === node.id && 'bg-primary/15 ring-2 ring-primary',
                )}
              >
                #
              </span>
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
                  displayText={json !== null ? (Array.isArray(json) ? '[]' : '{}') : undefined}
                  mono
                  title={json !== null ? '点击编辑完整 JSON' : isVar ? `变量 ${variableName(node.value)}` : undefined}
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
            {copiedSubtree ? <Check data-feedback="success" className="size-3" /> : <Copy className="size-3" />}
          </button>
        )}
        <button
          type="button"
          aria-label={node.children !== null ? '在该 URL 内添加字段' : '在下方插入字段'}
          title={node.children !== null ? '在该 URL 内添加字段' : '在下方插入字段'}
          onClick={() => (node.children !== null ? onAddInside(node.id) : onAddBelow(node))}
          className={cn('flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-secondary hover:text-foreground', node.children === null && 'ml-1')}
        >
          <Plus className="size-3" />
        </button>
        <PopConfirm
          trigger={<X className="size-3" />}
          triggerAriaLabel="删除"
          triggerClassName="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-secondary hover:text-destructive"
          title={node.children ? '删除这个 URL？' : '删除这个字段？'}
          description={node.children ? '该 URL 及其所有下级参数都会被删除。' : '删除后无法恢复。'}
          onConfirm={() => onDelete(node.id)}
        />
      </div>

      {json !== null && (
        <JsonFields value={json} depth={depth + 1} lastFlags={[...lastFlags, isLast]} onChange={next => onEditValue(node.id, JSON.stringify(next))} />
      )}
      {expandable && (
        <ParamTree
          tree={node.children!}
          depth={depth + 1}
          lastFlags={[...lastFlags, isLast]}
          onEdit={onEdit}
          onEditValue={onEditValue}
          onEditBase={onEditBase}
          onAddBelow={onAddBelow}
          onAddInside={onAddInside}
          onDelete={onDelete}
          dragSourceId={dragSourceId}
          dropTargetId={dropTargetId}
          autoEdit={autoEdit}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOverUrl={onDragOverUrl}
          onDragLeaveUrl={onDragLeaveUrl}
          onDropOnUrl={onDropOnUrl}
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
  onAddInside,
  onDelete,
  dragSourceId,
  dropTargetId,
  autoEdit,
  onDragStart,
  onDragEnd,
  onDragOverUrl,
  onDragLeaveUrl,
  onDropOnUrl,
}: {
  tree: UrlTree
  depth: number
  lastFlags: boolean[]
  onEdit: (id: string, patch: Partial<Pick<UrlNode, 'label' | 'value'>>) => void
  onEditValue: (id: string, value: string) => void
  onEditBase: (node: UrlNode, nextBase: string) => void
  onAddBelow: (node: UrlNode) => void
  onAddInside: (id: string) => void
  onDelete: (id: string) => void
  dragSourceId: string | null
  dropTargetId: string | null | undefined
  /** 新建参数后需要主动进入编辑态的节点（id + 触发信号） */
  autoEdit: { id: string, nonce: number } | null
  onDragStart: (event: DragEvent<HTMLElement>, id: string) => void
  onDragEnd: () => void
  onDragOverUrl: (event: DragEvent<HTMLElement>, targetId: string) => void
  onDragLeaveUrl: () => void
  onDropOnUrl: (event: DragEvent<HTMLElement>, targetId: string) => void
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
          onAddInside={onAddInside}
          onDelete={onDelete}
          dragSourceId={dragSourceId}
          dropTargetId={dropTargetId}
          autoEdit={autoEdit}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragOverUrl={onDragOverUrl}
          onDragLeaveUrl={onDragLeaveUrl}
          onDropOnUrl={onDropOnUrl}
        />
      ))}
    </div>
  )
}

/** 记录卡片里的二维码：按文本异步生成，空态占位 */
function RecordQr({ text, size = 128 }: { text: string | null, size?: number }) {
  const [result, setResult] = useState<{ text: string, url: string } | null>(null)
  const url = text && result?.text === text ? result.url : null
  useEffect(() => {
    let cancelled = false
    if (!text?.trim())
      return
    encodeQr(text, 'L')
      .then((url) => {
        if (!cancelled)
          setResult({ text, url })
      })
      .catch(() => {
        if (!cancelled)
          setResult(null)
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
  const json = node.children === null ? parseJsonContainer(node.value) : null
  const expandable = node.children !== null && hasParams(node.children)
  // 值是变量标记（$$name）时高亮展示
  const isVar = !expandable && variableName(node.value) !== null
  // 值是嵌套 URL 时，key 用渐变色（本组 → 下一组）；否则纯色
  const keyClass = expandable
    ? cn('bg-gradient-to-r bg-clip-text text-transparent', KEY_GRADIENTS[depth % KEY_GRADIENTS.length])
    : color

  return (
    <div>
      <div className="flex items-start gap-0.5 rounded-sm pr-1 leading-5">
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
                  {json !== null ? (Array.isArray(json) ? '[]' : '{}') : node.value || '（空）'}
                </span>
              </>
            )}
      </div>
      {json !== null && <JsonFields value={json} depth={depth + 1} lastFlags={[...lastFlags, isLast]} />}
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

function StaticUrlTree({ tree }: { tree: UrlTree }) {
  return (
    <>
      <div className="flex items-start gap-1 leading-5">
        <Link2 className={cn('size-3.5 shrink-0', DEPTH_COLORS[0])} />
        <span className={cn('flex-1 font-mono text-sm break-all', DEPTH_COLORS[0])}>{baseOfTree(tree)}</span>
      </div>
      {hasParams(tree)
        ? <StaticTree tree={tree} depth={0} lastFlags={[]} />
        : <p className="py-1 pl-6 text-sm text-muted-foreground">没有解析到参数</p>}
    </>
  )
}

/** 有变量时求实际内容；普通 URL 和文本保持原输入。 */
function resolveTab(tab: UrlTab) {
  if (!looksLikeUrl(tab.text))
    return { names: [], missing: [], text: tab.text }
  const resolved = resolveUrlVariables(parseUrl(tab.text), tab.variables)
  return { ...resolved, text: resolved.names.length ? resolved.text : tab.text }
}

/** 整组预览逐项显示；未补齐变量时只展示模板。 */
function RecordPreviewContent({ snapshot }: { snapshot: UrlWorkspaceSnapshot }) {
  return (
    <div className="url-record-preview">
      {snapshot.tabs.map((tab) => {
        const resolved = resolveTab(tab)
        const text = resolved.text ?? tab.text
        return (
          <section key={tab.id}>
            <h3 className="mb-2 text-sm font-semibold">{tab.name}</h3>
            <div className="flex gap-3">
              <RecordQr text={resolved.text} size={96} />
              <div className="min-w-0 flex-1">
                {resolved.missing.length > 0 && (
                  <p className="mb-1 text-xs text-warning-muted-foreground">
                    请补齐变量：
                    {resolved.missing.join('、')}
                  </p>
                )}
                {looksLikeUrl(text)
                  ? <StaticUrlTree tree={parseUrl(text)} />
                  : <p className="text-sm break-all text-popover-foreground">{text || '暂无内容'}</p>}
              </div>
            </div>
          </section>
        )
      })}
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
function RecordPreviewTip({ snapshot, wide, onSelect, children }: { snapshot: UrlWorkspaceSnapshot, wide?: boolean, onSelect?: () => void, children: ReactNode }) {
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
            'pointer-events-none fixed z-50 max-h-[60vh] overflow-auto rounded-md border border-border bg-popover px-3 py-2 text-popover-foreground',
            wide ? 'w-[min(40rem,calc(100vw-1rem))]' : 'max-w-[min(28rem,calc(100vw-1rem))]',
          )}
        >
          <RecordPreviewContent snapshot={snapshot} />
        </div>
      )}
      {/* 移动端预览弹窗 */}
      <dialog
        ref={dialogRef}
        onClose={() => setDialogOpen(false)}
        // 点击描边 / 背板区域（事件目标是 dialog 本身）时关闭
        onClick={e => e.target === dialogRef.current && setDialogOpen(false)}
        className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-5 text-popover-foreground backdrop:bg-black/50"
      >
        {dialogOpen && (
          <div className="max-h-[70vh] overflow-auto">
            <RecordPreviewContent snapshot={snapshot} />
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
  // 固定首屏内容，随机 id 与分享内容均在用户操作或挂载后产生。
  const [snapshot, setSnapshot] = useState<UrlWorkspaceSnapshot>({
    tabs: [{ id: 'initial', name: '链接 1', text: '', variables: {} }],
    activeTabId: 'initial',
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [session, setSession] = useState(0)
  const qrCache = useRef(new Map<string, { text: string, url: string }>()).current
  const recordStore = useUrlRecords()
  const activeTab = snapshot.tabs.find(tab => tab.id === snapshot.activeTabId) ?? snapshot.tabs[0]!
  const restore = useCallback((next: UrlWorkspaceSnapshot) => {
    qrCache.clear()
    setSnapshot(structuredClone(next))
    setSession(value => value + 1)
  }, [qrCache])

  // 挂载后读取分享链接，兼容旧二维码工具的 #text=...。
  useEffect(() => {
    const timer = setTimeout(() => {
      const hash = window.location.hash.slice(1)
      const text = hash.startsWith('text=') ? readHashParam('text') : readHashParam('url')
      if (text)
        setSnapshot(prev => ({ ...prev, tabs: [{ ...prev.tabs[0]!, text }] }))
    }, 0)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const timer = setTimeout(writeHashParam, 400, 'url', activeTab.text)
    return () => clearTimeout(timer)
  }, [activeTab.text])

  return (
    <UrlWorkspace
      key={`${session}:${activeTab.id}`}
      snapshot={snapshot}
      setSnapshot={setSnapshot}
      restore={restore}
      selectedId={selectedId}
      setSelectedId={setSelectedId}
      recordStore={recordStore}
      qrCache={qrCache}
    />
  )
}

function UrlWorkspace({ snapshot, setSnapshot, restore, selectedId, setSelectedId, recordStore, qrCache }: {
  snapshot: UrlWorkspaceSnapshot
  setSnapshot: (value: SetStateAction<UrlWorkspaceSnapshot>) => void
  restore: (snapshot: UrlWorkspaceSnapshot) => void
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  recordStore: ReturnType<typeof useUrlRecords>
  qrCache: Map<string, { text: string, url: string }>
}) {
  const activeTab = snapshot.tabs.find(tab => tab.id === snapshot.activeTabId) ?? snapshot.tabs[0]!
  const input = activeTab.text
  const setInput = useCallback((value: SetStateAction<string>) => {
    setSnapshot(prev => ({
      ...prev,
      tabs: prev.tabs.map(tab => tab.id === activeTab.id ? { ...tab, text: typeof value === 'function' ? value(tab.text) : value } : tab),
    }))
  }, [activeTab.id, setSnapshot])
  const recognitionRequestRef = useRef(0)
  const contentRevisionRef = useRef(0)
  const mountedRef = useRef(true)
  const [recognizing, setRecognizing] = useState(false)
  const [qrError, setQrError] = useState('')
  const changeInput = useCallback((value: SetStateAction<string>) => {
    recognitionRequestRef.current += 1
    contentRevisionRef.current += 1
    setRecognizing(false)
    setQrError('')
    setInput(value)
  }, [setInput])
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      recognitionRequestRef.current += 1
      contentRevisionRef.current += 1
    }
  }, [])
  const tree = useMemo(() => parseUrl(input), [input])
  const found = hasParams(tree)
  // 根节点只展示 base（协议 + 主机 + 路径），参数和 # 已在树里展开
  const baseUrl = useMemo(() => baseOfTree(tree), [tree])
  // 内容是否是 URL / 路径：不是时（如识别出的纯文本二维码）参数树和代码预览保持默认态
  const isUrl = looksLikeUrl(input)

  const [qrEnlarged, setQrEnlarged] = useState(false)
  const resolved = useMemo(() => resolveTab(activeTab), [activeTab])
  const qrText = resolved.text
  const resolvedTree = useMemo(() => qrText === null ? null : parseUrl(qrText), [qrText])

  const changeVariable = useCallback((name: string, value: string) => {
    recognitionRequestRef.current += 1
    contentRevisionRef.current += 1
    setRecognizing(false)
    setQrError('')
    setQrEnlarged(false)
    setSnapshot(prev => ({
      ...prev,
      tabs: prev.tabs.map(tab => tab.id === prev.activeTabId ? { ...tab, variables: { ...tab.variables, [name]: value } } : tab),
    }))
  }, [setSnapshot])

  const handleEdit = useCallback((id: string, patch: Partial<Pick<UrlNode, 'label' | 'value'>>) => {
    changeInput(prev => serializeUrl(updateNode(parseUrl(prev), id, patch)))
  }, [changeInput])

  // 编辑普通值：重解析子树，避免旧子树覆盖新值
  const handleEditValue = useCallback((id: string, value: string) => {
    changeInput(prev => serializeUrl(setNodeValue(parseUrl(prev), id, value)))
  }, [changeInput])

  // 编辑嵌套 URL 的 base（协议/域名/路径）：剥离误贴的 query，但保留手动输入的 hash（视为显式替换）
  const handleEditBase = useCallback((node: UrlNode, nextBase: string) => {
    const suffix = node.children ? suffixOfTree(node.children) : ''
    changeInput(prev => serializeUrl(setNodeValue(parseUrl(prev), node.id, mergeBaseEdit(nextBase, suffix))))
  }, [changeInput])

  const handleDelete = useCallback((id: string) => {
    changeInput(prev => serializeUrl(deleteNode(parseUrl(prev), id)))
  }, [changeInput])

  // 新增参数后，主动让新 key 进入编辑态。id 经「新旧树结构 diff」在重解析后的树里定位
  // （序列化 → 重解析会重新分配全部 id，不能直接用 addParam 内部生成的 id）；
  // nonce 每次递增：新节点的 id 可能与旧行的 id 相同（整体位移），React 会复用组件实例，
  // 必须靠信号变化触发 effect，不能依赖挂载初始态
  const [autoEdit, setAutoEdit] = useState<{ id: string, nonce: number } | null>(null)
  const commitAdd = useCallback((prevTree: UrlTree, nextTree: UrlTree) => {
    const nextInput = serializeUrl(nextTree)
    changeInput(nextInput)
    const id = findInsertedId(prevTree.nodes, parseUrl(nextInput).nodes)
    if (id)
      setAutoEdit(prev => ({ id, nonce: (prev?.nonce ?? 0) + 1 }))
  }, [changeInput])

  // 在某一行所在层级、其下方插入 key=value（默认值便于继续编辑）
  const handleAddBelow = useCallback((node: UrlNode | null) => {
    const parsed = parseUrl(input)
    commitAdd(
      parsed,
      node === null
        ? addParam(parsed, null, 'key', 'value')
        : insertParamBelow(parsed, node.id, 'key', 'value'),
    )
  }, [input, commitAdd])

  // 向嵌套 URL / 路径内部追加 key=value（值是 URL 的行上 + 号的含义）
  const handleAddInside = useCallback((id: string) => {
    const parsed = parseUrl(input)
    commitAdd(parsed, addParam(parsed, id, 'key', 'value'))
  }, [input, commitAdd])

  // 参数树拖拽：所有 key 都是目标；URL value 接收为子级，普通 value 接收到同一层。
  const [dragSourceId, setDragSourceId] = useState<string | null>(null)
  // undefined 表示没有目标，null 表示顶部根 URL，string 表示嵌套 URL 节点。
  const [dropTargetId, setDropTargetId] = useState<string | null | undefined>(undefined)

  const handleTreeDragStart = useCallback((event: DragEvent<HTMLElement>, id: string) => {
    event.stopPropagation()
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-url-tree-node', id)
    // Safari 对自定义 MIME 的拖拽数据支持不稳定，同时写入标准类型作为兜底。
    event.dataTransfer.setData('text/plain', id)
    setDragSourceId(id)
    setDropTargetId(undefined)
  }, [])

  const clearTreeDrag = useCallback(() => {
    setDragSourceId(null)
    setDropTargetId(undefined)
  }, [])

  const draggedId = useCallback((event: DragEvent<HTMLElement>) => (
    dragSourceId
    ?? (event.dataTransfer.getData('application/x-url-tree-node') || event.dataTransfer.getData('text/plain'))
  ), [dragSourceId])

  const handleTreeDragOver = useCallback((event: DragEvent<HTMLElement>, targetId: string | null) => {
    const sourceId = draggedId(event)
    if (!sourceId || !canMoveNode(tree, sourceId, targetId))
      return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    setDropTargetId(targetId)
  }, [draggedId, tree])

  const handleTreeDrop = useCallback((event: DragEvent<HTMLElement>, targetId: string | null) => {
    event.preventDefault()
    event.stopPropagation()
    const sourceId = draggedId(event)
    if (sourceId) {
      changeInput((prev) => {
        const current = parseUrl(prev)
        return serializeUrl(moveNode(current, sourceId, targetId))
      })
    }
    clearTreeDrag()
  }, [clearTreeDrag, draggedId, changeInput])

  const [copied, setCopied] = useState(false)

  // 命中当前 Tab 的内容缓存时立即展示，仅新内容防抖生成。
  const [qrResult, setQrResult] = useState<{ text: string, url: string } | null>(null)
  const cachedQr = qrCache.get(activeTab.id)
  const currentQr = cachedQr?.text === qrText ? cachedQr : qrResult
  const qr = qrText?.trim() && currentQr?.text === qrText ? currentQr.url : null
  useEffect(() => {
    if (qrCache.get(activeTab.id)?.text === qrText)
      return
    let cancelled = false
    const timer = setTimeout(() => {
      if (!qrText?.trim()) {
        if (!cancelled)
          setQrResult(null)
        return
      }
      encodeQr(qrText, 'L')
        .then((dataUrl) => {
          if (!cancelled) {
            const result = { text: qrText, url: dataUrl }
            qrCache.set(activeTab.id, result)
            setQrResult(result)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setQrResult(null)
            setQrError('二维码生成失败，内容可能过长，请缩短后重试')
          }
        })
    }, 400)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [activeTab.id, qrCache, qrText])

  // —— 二维码图片识别（原二维码工具能力）：点击选择 / 拖拽 / 粘贴图片 ——
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    const request = ++recognitionRequestRef.current
    setRecognizing(true)
    setQrError('')
    try {
      const result = await decodeQr(file)
      if (request !== recognitionRequestRef.current)
        return
      if (result) {
        changeInput(result)
      }
      else {
        setQrError('未在图片中识别到二维码，换一张更清晰的试试')
      }
    }
    catch {
      if (request === recognitionRequestRef.current)
        setQrError('图片读取失败，请确认是有效的图片文件')
    }
    finally {
      if (request === recognitionRequestRef.current)
        setRecognizing(false)
    }
  }, [changeInput])

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
      if (target instanceof HTMLElement && target.closest('textarea, input, [contenteditable]:not([contenteditable="false"])'))
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

  const [renderingQrPreview, setRenderingQrPreview] = useState(false)
  const exportBusyRef = useRef(false)
  const downloadQrPreview = useCallback(async () => {
    if (!qr || !isUrl || !resolvedTree || exportBusyRef.current)
      return
    exportBusyRef.current = true
    const revision = contentRevisionRef.current
    setRenderingQrPreview(true)
    setQrError('')
    try {
      const blob = await renderQrParameterPreview(qr, resolvedTree)
      if (revision !== contentRevisionRef.current)
        return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'qrcode-with-parameters.png'
      a.click()
      setTimeout(URL.revokeObjectURL, 10_000, url)
    }
    catch {
      if (revision === contentRevisionRef.current)
        setQrError('参数预览图片生成失败，请重试')
    }
    finally {
      exportBusyRef.current = false
      if (mountedRef.current)
        setRenderingQrPreview(false)
    }
  }, [isUrl, qr, resolvedTree])

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
  const variableDeclaration = useMemo(() => {
    if (!codeGen.code.endsWith('(variables)'))
      return ''
    const values = Object.fromEntries(resolved.names.map(name => [name, Object.hasOwn(activeTab.variables, name) ? activeTab.variables[name] : '']))
    return `const variables = JSON.parse(${JSON.stringify(JSON.stringify(values))});`
  }, [activeTab.variables, codeGen.code, resolved.names])
  const [copiedCode, setCopiedCode] = useState(false)
  const copyCode = useCallback(() => {
    const revision = contentRevisionRef.current
    const code = variableDeclaration ? `${variableDeclaration}\n${codeGen.code}` : codeGen.code
    void navigator.clipboard.writeText(code).then(() => {
      if (!mountedRef.current || revision !== contentRevisionRef.current)
        return
      setCopiedCode(true)
      setTimeout(setCopiedCode, 1200, false)
    })
  }, [codeGen.code, variableDeclaration])

  // 记录：主动保存；记录是稳定快照，点击切换内容，不再静默回写
  const { items: records, add: addRecord, update: updateRecord, remove: removeRecord, clear: clearRecords, writeStatus } = recordStore
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const canUpdate = selectedId !== null && records.some(record => record.id === selectedId)

  /** 保存为新记录：无论当前是否选中，都新增一条并选中进入重命名 */
  const handleSave = useCallback(() => {
    const name = snapshot.tabs.length === 1 ? defaultName(input) : `${activeTab.name} 等 ${snapshot.tabs.length} 个链接`
    const id = addRecord(snapshot, name)
    if (id) {
      // 保存后选中并直接进入重命名（预填默认名），方便立刻起一个名字
      setSelectedId(id)
      setNameDraft(name)
      setRenamingId(id)
    }
  }, [snapshot, activeTab.name, input, addRecord, setSelectedId])

  /** 更新：把当前内容回写到选中的记录（名称保持不变） */
  const handleUpdate = useCallback(() => {
    if (canUpdate && selectedId)
      updateRecord(selectedId, { snapshot })
  }, [canUpdate, snapshot, selectedId, updateRecord])

  const invalidate = useCallback(() => {
    recognitionRequestRef.current += 1
    contentRevisionRef.current += 1
    mountedRef.current = false
  }, [])

  const toggleSelect = useCallback((item: UrlRecord) => {
    invalidate()
    setSelectedId(item.id)
    restore(item.snapshot)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [invalidate, restore, setSelectedId])

  const [renamingTab, setRenamingTab] = useState(false)
  const [tabName, setTabName] = useState(activeTab.name)
  const renameTabTriggerRef = useRef<HTMLButtonElement>(null)
  const renameTabDialogRef = useRef<HTMLDialogElement>(null)
  useLayoutEffect(() => {
    const dialog = renameTabDialogRef.current
    if (renamingTab)
      dialog?.showModal()
    else
      dialog?.close()
  }, [renamingTab])
  const closeTabRename = () => {
    renameTabDialogRef.current?.close()
    setRenamingTab(false)
    renameTabTriggerRef.current?.focus()
  }
  const commitTabName = () => {
    const name = tabName.trim() || activeTab.name
    setSnapshot(prev => ({ ...prev, tabs: prev.tabs.map(tab => tab.id === activeTab.id ? { ...tab, name } : tab) }))
    closeTabRename()
  }
  const switchTab = (id: string) => {
    if (id === activeTab.id)
      return
    invalidate()
    setSnapshot(prev => ({ ...prev, activeTabId: id }))
    requestAnimationFrame(() => document.getElementById(`url-tab-${id}`)?.focus())
  }
  const addTab = () => {
    const id = crypto.randomUUID()
    let number = snapshot.tabs.length + 1
    while (snapshot.tabs.some(tab => tab.name === `链接 ${number}`))
      number += 1
    invalidate()
    setSnapshot(prev => ({ ...prev, activeTabId: id, tabs: [...prev.tabs, { id, name: `链接 ${number}`, text: '', variables: {} }] }))
    requestAnimationFrame(() => document.getElementById('url-workspace-input')?.focus())
  }
  const deleteTab = () => {
    if (snapshot.tabs.length < 2)
      return
    invalidate()
    const index = snapshot.tabs.findIndex(tab => tab.id === activeTab.id)
    const tabs = snapshot.tabs.filter(tab => tab.id !== activeTab.id)
    const id = tabs[Math.min(index, tabs.length - 1)]!.id
    qrCache.delete(activeTab.id)
    setSnapshot({ tabs, activeTabId: id })
    requestAnimationFrame(() => document.getElementById(`url-tab-${id}`)?.focus())
  }
  const canSave = snapshot.tabs.some(tab => tab.text.trim())

  const commitRename = useCallback(() => {
    if (renamingId)
      updateRecord(renamingId, { name: nameDraft.trim() })
    setRenamingId(null)
  }, [renamingId, nameDraft, updateRecord])

  const [copiedId, setCopiedId] = useState<string | null>(null)

  // 二维码放大弹层：点击缩略图打开，Esc / 点击遮罩关闭
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
    <main className="url-workspace">
      <Seo
        title="URL 与二维码"
        description="解析任意协议的 URL 与路径，递归展开嵌套参数，并与二维码双向转换；支持编辑、拖拽、变量代码预览和历史记录。"
        path="/tools/url-qrcode"
      />
      <div className="url-workspace-tabs">
        <div role="tablist" aria-label="二维码链接" className="url-tabs-list">
          {snapshot.tabs.map((tab, index) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`url-tab-${tab.id}`}
              aria-controls="url-active-content"
              aria-selected={tab.id === activeTab.id}
              tabIndex={tab.id === activeTab.id ? 0 : -1}
              onClick={() => switchTab(tab.id)}
              onDoubleClick={() => {
                setTabName(tab.name)
                setRenamingTab(true)
              }}
              onKeyDown={(event) => {
                let next = index
                if (event.key === 'ArrowRight')
                  next = (index + 1) % snapshot.tabs.length
                else if (event.key === 'ArrowLeft')
                  next = (index + snapshot.tabs.length - 1) % snapshot.tabs.length
                else if (event.key === 'Home')
                  next = 0
                else if (event.key === 'End')
                  next = snapshot.tabs.length - 1
                else
                  return
                event.preventDefault()
                const id = snapshot.tabs[next]!.id
                switchTab(id)
              }}
            >
              <QrCode size={13} />
              <span>{tab.name}</span>
            </button>
          ))}
        </div>
        <div className="url-tabs-actions">
          <Button variant="ghost" size="icon-sm" title="新增链接" aria-label="新增链接" onClick={addTab}><Plus className="size-3.5" /></Button>
          <Button
            ref={renameTabTriggerRef}
            variant="ghost"
            size="icon-sm"
            title="重命名当前链接"
            aria-label="重命名当前链接"
            onClick={() => {
              setTabName(activeTab.name)
              setRenamingTab(true)
            }}
          >
            <Pencil className="size-3.5" />
          </Button>
          {snapshot.tabs.length > 1
            ? <PopConfirm trigger={<Trash2 className="size-3.5" />} triggerAriaLabel="删除当前链接" triggerClassName={buttonVariants({ variant: 'ghost', size: 'icon-sm' })} title="删除当前链接？" description="该链接的内容和变量值会被删除，且无法恢复。" onConfirm={deleteTab} />
            : <Button variant="ghost" size="icon-sm" disabled title="至少保留一个链接" aria-label="删除当前链接"><Trash2 className="size-3.5" /></Button>}
        </div>
      </div>
      <dialog
        ref={renameTabDialogRef}
        aria-labelledby="url-tab-rename-title"
        className="url-tab-rename-dialog"
        onCancel={(event) => {
          event.preventDefault()
          closeTabRename()
        }}
        onClose={() => setRenamingTab(false)}
        onClick={event => event.target === event.currentTarget && closeTabRename()}
      >
        <form
          className="url-tab-rename"
          onSubmit={(event) => {
            event.preventDefault()
            commitTabName()
          }}
        >
          <h2 id="url-tab-rename-title">编辑链接名称</h2>
          <label htmlFor="url-tab-name">链接名称</label>
          <input id="url-tab-name" autoFocus value={tabName} onChange={event => setTabName(event.target.value)} />
          <div className="url-tab-rename-actions">
            <Button type="button" variant="outline" size="sm" onClick={closeTabRename}>取消</Button>
            <Button type="submit" size="sm">确认</Button>
          </div>
        </form>
      </dialog>
      <section id="url-active-content" role="tabpanel" aria-labelledby={`url-tab-${activeTab.id}`} className="url-workspace-source">
        <label htmlFor="url-workspace-input" className="url-source-label">
          <Link2 size={14} />
          链接内容
        </label>
        <textarea
          id="url-workspace-input"
          value={input}
          onChange={e => changeInput(e.target.value)}
          aria-label="链接内容"
          placeholder="粘贴 URL 或路径，例如 https://a.com/p?x=1；可声明参数变量，语法见参数区"
          className="h-36 min-h-28 w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-sm leading-6 outline-none placeholder:font-sans placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        {resolved.names.length > 0 && (
          <section className="url-variable-inputs" aria-label="变量输入">
            <div className="url-variable-heading">
              <h2>变量输入</h2>
              <span role="status">{resolved.missing.length ? `还需填写 ${resolved.missing.length} 项` : '变量已补齐'}</span>
            </div>
            <div className="url-variable-fields">
              {resolved.names.map(name => (
                <label key={name}>
                  <span className="font-mono">{`$$${name}`}</span>
                  <input
                    value={Object.hasOwn(activeTab.variables, name) ? activeTab.variables[name] : ''}
                    onChange={event => changeVariable(name, event.target.value)}
                    placeholder={`输入 ${name} 的值`}
                    aria-required="true"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
              ))}
            </div>
            <p>{resolved.missing.length ? '请补齐所有变量后生成二维码；代码可随时复制。' : '二维码已使用当前变量值，链接内容保留变量写法。'}</p>
          </section>
        )}
        {qrError && (
          <p className="rounded-md border border-border bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {qrError}
          </p>
        )}
        <div className="url-source-actions flex flex-wrap gap-2">
          <Button variant="outline" size="icon-sm" disabled={!input} title="复制" aria-label="复制" onClick={copy}>
            {copied ? <Check data-feedback="success" /> : <Copy />}
          </Button>
          {/* 选中记录时提供「更新」回写该记录；「保存」始终新增一条记录 */}
          {canUpdate && (
            <Button
              variant="default"
              size="sm"
              disabled={!canSave || writeStatus === 'saving'}
              title="把当前内容回写到选中的记录"
              onClick={handleUpdate}
            >
              <Save />
              更新整组
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!canSave || writeStatus === 'saving'}
            title="保存为新记录"
            onClick={handleSave}
          >
            <Bookmark />
            保存为新记录
          </Button>
          <Button variant="outline" size="sm" onClick={() => changeInput(DEMO_URL)}>
            <Sparkles />
            试试示例
          </Button>
          {writeStatus !== 'idle' && (
            <span className="url-record-write-status" data-status={writeStatus} role={writeStatus === 'error' ? 'alert' : 'status'}>
              {writeStatus === 'saving' ? '正在保存，请稍候' : writeStatus === 'saved' ? '记录已保存' : '记录保存失败，请重试'}
            </span>
          )}
          <span className="url-source-note">{isUrl ? 'URL / 路径' : input.trim() ? '文本' : '等待输入'}</span>
        </div>
      </section>
      <div className="url-workspace-qr w-full">
        <section className="flex min-w-0 flex-col gap-3">
          <div className="url-qr-heading">
            <h2>
              {recognizing ? <LoaderCircle size={16} className="animate-spin" /> : <QrCode size={16} />}
              {recognizing ? '正在识别…' : '二维码'}
            </h2>
            <Button variant="ghost" size="icon-sm" aria-label="选择二维码图片识别" title="选择二维码图片识别" onClick={() => fileInputRef.current?.click()}><Plus size={16} /></Button>
          </div>
          <div
            role="button"
            tabIndex={0}
            title="点击选择 / 拖拽 / 粘贴二维码图片识别"
            aria-label="上传二维码图片识别"
            aria-busy={recognizing}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex aspect-square min-h-0 w-full cursor-pointer items-center justify-center overflow-hidden rounded-md border border-border bg-muted/30 p-3 transition-colors',
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
                    className="size-full cursor-zoom-in object-contain"
                  />
                )
              : (
                  <div className="flex flex-col items-center gap-3 p-2 text-center text-muted-foreground">
                    <QrCode className="size-8" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{resolved.missing.length ? '请补齐变量后生成二维码' : input.trim() ? '正在生成二维码…' : '输入链接生成二维码'}</p>
                      <p className="mt-1 text-xs">点击、拖拽或粘贴图片识别</p>
                    </div>
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
          <Button
            variant="default"
            size="sm"
            disabled={!qr}
            onClick={downloadQr}
            className="url-qr-download w-full shrink-0"
          >
            <Download />
            下载二维码
          </Button>
        </section>
      </div>
      <section className="url-workspace-tree min-w-0">
        <div className="flex min-h-8 items-start justify-between gap-4 pb-3">
          <div>
            <h2 className="url-tree-heading">
              <GitBranch size={16} />
              参数树
              <span>
                {paramNodes(tree).length}
                {' '}
                个根字段
              </span>
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              点击 key / value 编辑；写成
              {' '}
              <code className="rounded-sm bg-secondary px-1 font-mono">
                <span>$</span>
                <span>$变量名</span>
              </code>
              {' '}
              声明变量，拖放可移动或嵌套节点
            </p>
          </div>
        </div>
        <div>
          {!isUrl
            ? (
                <p className="border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  {input.trim() ? '当前内容不是 URL / 路径，参数树保持默认状态' : '输入 URL 或路径后，这里会展示参数树'}
                </p>
              )
            : (
                <div className="flex flex-col gap-4">
                  {/* 参数树 */}
                  <div className="url-workspace-tree-content w-full">
                    {/* 根节点：顶层 URL 的 base（可编辑），颜色与下面的参数字段一致 */}
                    <div className="url-root-row group flex items-start gap-1 rounded-sm pr-1 leading-5 hover:bg-secondary/40">
                      <Link2 className={cn('size-3.5 shrink-0', DEPTH_COLORS[0])} />
                      <span
                        data-drop-url="root"
                        title="把字段拖到这里；URL 字段会整体替换当前根 URL"
                        onDragOver={event => handleTreeDragOver(event, null)}
                        onDragLeave={() => setDropTargetId(undefined)}
                        onDrop={event => handleTreeDrop(event, null)}
                        className={cn(
                          'min-w-0 flex-1 rounded-sm transition-colors',
                          dropTargetId === null && 'bg-primary/15 ring-2 ring-primary',
                        )}
                      >
                        <EditableText
                          text={baseUrl}
                          mono
                          className={cn('w-full break-all', DEPTH_COLORS[0])}
                          onCommit={next => changeInput(mergeBaseEdit(next, suffixOfTree(tree)))}
                        />
                      </span>
                      <button
                        type="button"
                        aria-label="复制该 URL 及其所有参数"
                        title="复制该 URL 及其所有参数"
                        onClick={copyTree}
                        className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-secondary hover:text-foreground"
                      >
                        {copiedTree ? <Check data-feedback="success" className="size-3" /> : <Copy className="size-3" />}
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
                          <ParamTree
                            tree={tree}
                            depth={0}
                            lastFlags={[]}
                            onEdit={handleEdit}
                            onEditValue={handleEditValue}
                            onEditBase={handleEditBase}
                            onAddBelow={handleAddBelow}
                            onAddInside={handleAddInside}
                            onDelete={handleDelete}
                            dragSourceId={dragSourceId}
                            dropTargetId={dropTargetId}
                            autoEdit={autoEdit}
                            onDragStart={handleTreeDragStart}
                            onDragEnd={clearTreeDrag}
                            onDragOverUrl={(event, targetId) => handleTreeDragOver(event, targetId)}
                            onDragLeaveUrl={() => setDropTargetId(undefined)}
                            onDropOnUrl={(event, targetId) => handleTreeDrop(event, targetId)}
                          />
                        )
                      : (
                          <p className="py-3 pl-6 text-sm text-muted-foreground">没有解析到参数</p>
                        )}
                  </div>
                  {/* 代码预览：变量生成模板字符串插值，按嵌套层级着色（与参数树一致）；仅在存在变量时展示在参数树下方 */}
                  {hasVars && (
                    <div className="url-code-heading">
                      <h3>变量代码</h3>
                      <Button variant="ghost" size="sm" title="复制代码" aria-label="复制代码" onClick={copyCode}>
                        {copiedCode ? <Check data-feedback="success" /> : <Copy />}
                        {copiedCode ? '已复制' : '复制代码'}
                      </Button>
                    </div>
                  )}
                  {hasVars && codeGen.code.endsWith('(variables)') && (
                    <p className="px-1 text-xs text-muted-foreground">
                      通过 variables 对象传入变量，例如
                      {' '}
                      <code className="font-mono">{variableDeclaration}</code>
                    </p>
                  )}
                  {hasVars && (
                    <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 font-mono text-sm leading-6 break-all whitespace-pre-wrap">
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
        </div>
      </section>
      <aside aria-label="保存的记录" className="url-workspace-records min-w-0">
        <ClientOnly>
          {() => (
            <section>
              <div className="flex min-h-8 items-center justify-between gap-2 pb-3">
                <h2 className="flex items-center gap-2 font-mono text-sm font-semibold tracking-tight">
                  <Bookmark className="size-4" />
                  记录
                </h2>
                {records.length > 0 && (
                  <PopConfirm
                    trigger={<Trash2 className="size-3.5" />}
                    triggerAriaLabel="清空全部记录"
                    triggerClassName={buttonVariants({ variant: 'ghost', size: 'sm' })}
                    title="清空全部记录？"
                    description="所有保存的记录都会被删除，且无法恢复。"
                    confirmLabel="清空"
                    onConfirm={() => {
                      setSelectedId(null)
                      clearRecords()
                    }}
                  />
                )}
              </div>
              <div>
                {records.length === 0
                  ? (
                      <p className="py-3 text-xs leading-5 text-muted-foreground">
                        还没有保存的记录，点击「保存为新记录」保存整组链接与变量值
                      </p>
                    )
                  : (
                      <ul className="flex flex-col">
                        {records.map(item => (
                          <li
                            key={item.id}
                            className={cn(
                              'flex min-w-0 items-center gap-2 border-b py-2 transition-colors hover:bg-muted/60',
                              selectedId === item.id ? 'border-primary' : 'border-border',
                            )}
                          >
                            <div className="min-w-0 flex-1">
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
                                      className="min-w-0 w-full rounded-sm border border-border bg-background px-1 py-0 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                    />
                                  )
                                : (
                                    <RecordPreviewTip snapshot={item.snapshot} wide onSelect={() => toggleSelect(item)}>
                                      <button
                                        type="button"
                                        title="恢复整组链接"
                                        aria-label={`恢复记录 ${item.name || '未命名记录'}，${item.snapshot.tabs.length} 个链接`}
                                        onClick={() => toggleSelect(item)}
                                        className="flex min-w-0 cursor-pointer items-center gap-1 text-left"
                                      >
                                        <span className="line-clamp-2 min-w-0 text-sm break-all">{item.name || '未命名记录'}</span>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                          {item.snapshot.tabs.length}
                                          {' '}
                                          个链接
                                        </span>
                                        {selectedId === item.id && (
                                          <span className="shrink-0 font-mono text-xs text-primary">编辑中</span>
                                        )}
                                      </button>
                                    </RecordPreviewTip>
                                  )}
                            </div>
                            <div className="flex shrink-0 items-center gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="size-6 text-muted-foreground"
                                aria-label="重命名"
                                onClick={() => {
                                  setRenamingId(item.id)
                                  setNameDraft(item.name)
                                }}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="size-6 text-muted-foreground"
                                aria-label="复制"
                                onClick={() => copyHistory(item.id, item.snapshot.tabs.map(tab => resolveTab(tab).text ?? tab.text).join('\n'))}
                              >
                                {copiedId === item.id ? <Check data-feedback="success" className="size-3.5" /> : <Copy className="size-3.5" />}
                              </Button>
                              <PopConfirm
                                trigger={<Trash2 className="size-3.5" />}
                                triggerAriaLabel="删除"
                                triggerClassName={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }), 'size-6 text-muted-foreground')}
                                title="删除这条记录？"
                                description="这条记录会被删除，且无法恢复。"
                                onConfirm={() => {
                                  if (selectedId === item.id)
                                    setSelectedId(null)
                                  removeRecord(item.id)
                                }}
                              />
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
              </div>
            </section>
          )}
        </ClientOnly>
      </aside>

      {/* 二维码详情弹层：二维码 + 当前 URL 的只读参数树 */}
      {qrEnlarged && qr && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="二维码与参数预览"
          onClick={() => setQrEnlarged(false)}
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-foreground/60 p-4"
        >
          <div
            onClick={event => event.stopPropagation()}
            className="flex max-h-[calc(100vh-2rem)] w-[min(64rem,calc(100vw-2rem))] flex-col rounded-lg border border-border bg-popover p-5 text-popover-foreground"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-mono text-lg font-semibold tracking-tight">二维码与参数预览</h2>
                <p className="text-sm text-muted-foreground">扫码打开当前内容，同时核对 URL 参数层级</p>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="关闭" onClick={() => setQrEnlarged(false)}>
                <X />
              </Button>
            </div>
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto sm:grid-cols-[minmax(14rem,22rem)_minmax(0,1fr)]">
              <div className="flex items-start justify-center">
                <img
                  src={qr}
                  alt="当前内容的二维码（放大）"
                  style={{ imageRendering: 'pixelated' }}
                  className="aspect-square w-full max-w-[22rem] rounded-md border border-border bg-background object-contain"
                />
              </div>
              <div className="min-h-32 overflow-auto rounded-md border border-border bg-background p-3 text-foreground">
                <h3 className="mb-2 text-sm font-semibold">参数预览</h3>
                {isUrl
                  ? (
                      <div className="min-w-[28rem] sm:min-w-0">
                        {resolvedTree && <StaticUrlTree tree={resolvedTree} />}
                      </div>
                    )
                  : <p className="text-sm break-all text-muted-foreground">当前内容不是 URL，无法展示参数树。</p>}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              {qrError && <p role="alert" className="mr-auto self-center text-sm text-destructive">{qrError}</p>}
              <Button
                variant="default"
                size="sm"
                disabled={!qr || renderingQrPreview}
                aria-busy={renderingQrPreview}
                onClick={isUrl ? () => void downloadQrPreview() : downloadQr}
              >
                {renderingQrPreview ? <LoaderCircle className="animate-spin" /> : <Download />}
                {renderingQrPreview ? '正在生成…' : isUrl ? '下载二维码 + 参数图' : '下载二维码'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}

export default UrlParserTool
