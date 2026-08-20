/**
 * 任意协议 URL / 路径的解析与序列化。
 * 解析成树：协议、主机、端口、路径段、查询参数、hash。
 * 参数值（或路径段）本身是另一个 URL / 路径时递归解析为子树。
 */

export type UrlNodeKind = 'protocol' | 'host' | 'port' | 'segment' | 'param' | 'hash'

export interface UrlNode {
  id: string
  kind: UrlNodeKind
  /** 展示标签；param 的 label 即参数名（可编辑） */
  label: string
  /** 解码后的值（可编辑） */
  value: string
  /**
   * protocol: 是否带 `//`；param: 是否带 `=value`
   */
  flag: boolean
  /** 值是嵌套 URL / 路径时的子树 */
  children: UrlTree | null
}

export interface UrlTree {
  nodes: UrlNode[]
  leadingSlash: boolean
  trailingSlash: boolean
  hasQuery: boolean
  hasHash: boolean
}

const MAX_DEPTH = 8

/** 变量标记：值写成 `$$name` 即声明一个变量（name 需是合法 JS 标识符） */
const VAR_RE = /^\$\$([a-z_$]\w*)$/i

/** 值是变量标记时返回变量名，否则返回 null */
export function variableName(value: string): string | null {
  return VAR_RE.exec(value)?.[1] ?? null
}

/** 编码普通值；变量标记原样保留（$ 是 query 合法字符，且保证解析/序列化往返稳定） */
function encodeValue(value: string): string {
  return variableName(value) !== null ? value : encodeURIComponent(value)
}

let seq = 0
function nid() {
  return `n${seq++}`
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  }
  catch {
    return s
  }
}

/** 判断一段文本是否像另一个 URL 或路径（原始结构判断，不做解码） */
function looksLikeUrlRaw(raw: string): boolean {
  const s = raw.trim()
  if (!s)
    return false
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) // scheme://…
    return true
  if (/^[a-z][a-z0-9+.-]*:[^/]/i.test(s)) // mailto:… tel:…
    return true
  if (s.startsWith('/') && s.length > 1) // 绝对路径
    return true
  const qi = s.indexOf('?')
  if (qi > 0 && s.slice(qi + 1).includes('=')) // 路径 + 查询
    return true
  if (s.includes('&') && s.includes('=')) // 裸查询串 a=1&b=2
    return true
  return false
}

/**
 * 判断一段文本是否像另一个 URL 或路径（值得展开为子树）。
 * 文本可能整体被 percent-encode 过（粘贴自他处），逐层解码后再判。
 */
export function looksLikeUrl(raw: string): boolean {
  let s = raw.trim()
  for (let i = 0; i <= MAX_DEPTH; i++) {
    if (looksLikeUrlRaw(s))
      return true
    const next = safeDecode(s)
    if (next === s)
      return false
    s = next.trim()
  }
  return looksLikeUrlRaw(s)
}

/**
 * 值可能叠了多层 percent-encode：逐层解码，返回第一个「像 URL」的结果；
 * 一直不像则返回单层解码结果（与旧的展示行为一致，避免过度解码普通文本）
 */
function decodeToDisplay(raw: string): string {
  const first = safeDecode(raw)
  let s = first
  for (let i = 0; i < MAX_DEPTH; i++) {
    if (looksLikeUrlRaw(s))
      return s
    const next = safeDecode(s)
    if (next === s)
      break
    s = next
  }
  return looksLikeUrlRaw(s) ? s : first
}

function parseAny(raw: string, depth: number): UrlTree {
  const nodes: UrlNode[] = []
  let rest = raw.trim()

  // 协议：scheme:// 或 scheme:（如 mailto:、tel:）
  const protoMatch = rest.match(/^([a-z][a-z0-9+.-]*):(\/\/)?/i)
  if (protoMatch && (protoMatch[2] || protoMatch[1].length > 1)) {
    const hasSlashes = Boolean(protoMatch[2])
    nodes.push({
      id: nid(),
      kind: 'protocol',
      label: '协议',
      value: protoMatch[1],
      flag: hasSlashes,
      children: null,
    })
    rest = rest.slice(protoMatch[0].length)

    // authority（仅 scheme:// 形式）
    if (hasSlashes) {
      const authority = (rest.match(/^[^/?#]*/) ?? [''])[0]
      rest = rest.slice(authority.length)
      if (authority) {
        const colon = authority.lastIndexOf(':')
        const maybePort = colon > 0 ? authority.slice(colon + 1) : ''
        if (colon > 0 && !authority.includes(']') && /^\d+$/.test(maybePort)) {
          nodes.push({ id: nid(), kind: 'host', label: '主机', value: safeDecode(authority.slice(0, colon)), flag: false, children: null })
          nodes.push({ id: nid(), kind: 'port', label: '端口', value: maybePort, flag: false, children: null })
        }
        else {
          nodes.push({ id: nid(), kind: 'host', label: '主机', value: safeDecode(authority), flag: false, children: null })
        }
      }
    }
  }

  // 拆 hash、query
  let hashStr: string | null = null
  const hi = rest.indexOf('#')
  if (hi >= 0) {
    hashStr = rest.slice(hi + 1)
    rest = rest.slice(0, hi)
  }
  let queryStr: string | null = null
  const qi = rest.indexOf('?')
  if (qi >= 0) {
    queryStr = rest.slice(qi + 1)
    rest = rest.slice(0, qi)
  }
  else if (!rest.includes('/') && rest.includes('&') && rest.includes('=')) {
    // 裸查询串 a=1&b=2（无路径部分）：直接按 query 解析，避免整串当作路径段后值递归套娃
    queryStr = rest
    rest = ''
  }

  // 路径段
  const leadingSlash = rest.startsWith('/')
  const trailingSlash = rest.length > 1 && rest.endsWith('/')
  const segments = rest.split('/').filter(Boolean)
  segments.forEach((seg, i) => {
    const value = decodeToDisplay(seg)
    nodes.push({
      id: nid(),
      kind: 'segment',
      label: `路径 ${i + 1}`,
      value,
      flag: false,
      children: depth < MAX_DEPTH && looksLikeUrl(value) ? parseAny(value, depth + 1) : null,
    })
  })

  // 查询参数
  if (queryStr !== null) {
    for (const pair of queryStr.split('&')) {
      if (!pair)
        continue
      const eq = pair.indexOf('=')
      const key = eq >= 0 ? pair.slice(0, eq) : pair
      const value = eq >= 0 ? decodeToDisplay(pair.slice(eq + 1)) : ''
      nodes.push({
        id: nid(),
        kind: 'param',
        label: safeDecode(key),
        value,
        flag: eq >= 0,
        children: depth < MAX_DEPTH && looksLikeUrl(value) ? parseAny(value, depth + 1) : null,
      })
    }
  }

  // hash：可能是纯锚点，也可能是 SPA 的 hash 路由（#/path?a=1）
  let hashChildren: UrlTree | null = null
  if (hashStr !== null) {
    const hashValue = decodeToDisplay(hashStr)
    if (depth < MAX_DEPTH
      && (hashValue.startsWith('/') || hashValue.includes('?') || hashValue.includes('='))) {
      hashChildren = parseAny(hashValue, depth + 1)
    }
    nodes.push({
      id: nid(),
      kind: 'hash',
      label: '#',
      value: hashValue,
      flag: false,
      children: hashChildren,
    })
  }

  return { nodes, leadingSlash, trailingSlash, hasQuery: queryStr !== null, hasHash: hashStr !== null }
}

export function parseUrl(input: string): UrlTree {
  seq = 0
  let s = input.trim()
  // 整串被 percent-encode 过（本身解析不出结构）时逐层解码，直到能解析为止；
  // 已具备 URL 结构的输入原样解析（其内部编码由组件级解码处理，不能整体解码，否则嵌套参数会泄漏到顶层）
  for (let i = 0; i < MAX_DEPTH && !looksLikeUrlRaw(s); i++) {
    const next = safeDecode(s)
    if (next === s)
      break
    s = next.trim()
  }
  return parseAny(s, 0)
}

/**
 * 序列化回字符串。
 * 编码规则与解析对称：每一层对自己的组件编码一次，
 * 嵌套子树先独立序列化（其内部组件已编码一次），再由当前层整体编码一次，
 * 保证深层参数中的 ? & # = 不会泄漏到上一层。
 */
function build(tree: UrlTree): string {
  let out = ''
  const segs: string[] = []
  const params: UrlNode[] = []
  let hashNode: UrlNode | null = null

  for (const n of tree.nodes) {
    if (n.kind === 'protocol') {
      out += n.value + (n.flag ? '://' : ':')
    }
    else if (n.kind === 'host') {
      out += n.value
    }
    else if (n.kind === 'port') {
      out += `:${n.value}`
    }
    else if (n.kind === 'segment') {
      segs.push(n.children ? encodeURIComponent(build(n.children)) : encodeValue(n.value))
    }
    else if (n.kind === 'param') {
      params.push(n)
    }
    else if (n.kind === 'hash') {
      hashNode = n
    }
  }

  if (segs.length)
    out += (tree.leadingSlash ? '/' : '') + segs.join('/') + (tree.trailingSlash ? '/' : '')

  if (tree.hasQuery) {
    out += `?${params.map((p) => {
      const key = encodeURIComponent(p.label)
      if (!p.flag)
        return key
      const value = p.children ? encodeURIComponent(build(p.children)) : encodeValue(p.value)
      return `${key}=${value}`
    }).join('&')}`
  }

  if (tree.hasHash && hashNode) {
    // hash 本身不再被外层编码，其子级按普通 URL 规则序列化（内部组件已自行编码）
    out += `#${hashNode.children ? build(hashNode.children) : hashNode.value}`
  }

  return out
}

export function serializeUrl(tree: UrlTree): string {
  return build(tree)
}

/** 不可变更新某个节点的 label / value */
export function updateNode(tree: UrlTree, id: string, patch: Partial<Pick<UrlNode, 'label' | 'value'>>): UrlTree {
  return {
    ...tree,
    nodes: tree.nodes.map(n => (n.id === id
      ? { ...n, ...patch }
      : { ...n, children: n.children ? updateNode(n.children, id, patch) : null })),
  }
}

/** 设置节点值并按新值重解析子树（用于编辑嵌套 URL 的 base 部分） */
export function setNodeValue(tree: UrlTree, id: string, value: string): UrlTree {
  return {
    ...tree,
    nodes: tree.nodes.map(n => (n.id === id
      // param 原来可能没有 `=`（flag: false），一旦编辑值就进入 key=value 形态
      ? { ...n, value, flag: n.kind === 'param' ? true : n.flag, children: looksLikeUrl(value) ? parseAny(value, 0) : null }
      : { ...n, children: n.children ? setNodeValue(n.children, id, value) : null })),
  }
}

/** 删除某个节点（param / segment / hash），并修正空 query 标志 */
export function deleteNode(tree: UrlTree, id: string): UrlTree {
  const nodes = tree.nodes
    .filter(n => n.id !== id)
    .map(n => ({ ...n, children: n.children ? deleteNode(n.children, id) : null }))
  const hasQuery = tree.hasQuery && nodes.some(n => n.kind === 'param')
  const hasHash = tree.hasHash && nodes.some(n => n.kind === 'hash')
  return { ...tree, nodes, hasQuery, hasHash }
}

/** 在与某节点相同的层级、紧随其后插入 key=value（找不到时兜底追加到末尾） */
export function insertParamBelow(tree: UrlTree, afterId: string, label: string, value: string): UrlTree {
  const param: UrlNode = { id: nid(), kind: 'param', label, value, flag: true, children: null }
  const insert = (nodes: UrlNode[]): UrlNode[] => {
    const i = nodes.findIndex(n => n.id === afterId)
    if (i >= 0)
      return [...nodes.slice(0, i + 1), param, ...nodes.slice(i + 1)]
    return nodes.map(n => (n.children ? { ...n, children: { ...n.children, nodes: insert(n.children.nodes) } } : n))
  }
  return { ...tree, nodes: insert(tree.nodes), hasQuery: true }
}

/** 在指定节点（parentId 为 null 表示顶层）下追加一个参数 */
export function addParam(tree: UrlTree, parentId: string | null, label: string, value: string): UrlTree {
  const param: UrlNode = { id: nid(), kind: 'param', label, value, flag: true, children: null }
  if (parentId === null)
    return { ...tree, nodes: [...tree.nodes, param], hasQuery: true }
  return {
    ...tree,
    nodes: tree.nodes.map((n) => {
      if (n.id === parentId && n.children)
        return { ...n, children: { ...n.children, nodes: [...n.children.nodes, param], hasQuery: true } }
      return { ...n, children: n.children ? addParam(n.children, parentId, label, value) : null }
    }),
  }
}
