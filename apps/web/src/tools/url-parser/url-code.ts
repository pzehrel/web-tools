/**
 * 代码预览：把 URL 树生成为 JS 模板字符串。
 * 与序列化规则一致：变量（值写成 `$$name`）原样插入所在位置，不参与自身层级的编码。
 * encodeURIComponent 只包裹对应的变量：变量每穿过一层「作为参数值 / 路径段的嵌套 URL」
 * 就多叠一层 encodeURIComponent（hash 边界不算，hash 不被外层编码）；
 * 嵌套层的静态内容在生成期预编码为字面量。例如：
 *   /pages/aaa?b=$$x       → `/pages/aaa?b=${x}`
 *   /a?next=/inner?x=$$y   → `/a?next=%2Finner%3Fx%3D${encodeURIComponent(y)}`
 *   两层嵌套里的 $$z        → `${encodeURIComponent(encodeURIComponent(z))}`
 */

import type { UrlNode, UrlTree } from './url-tree'
import { serializeUrl, variableName } from './url-tree'

export type CodeTokenKind = 'static' | 'interp' | 'var'

export interface CodeToken {
  text: string
  kind: CodeTokenKind
  /** 嵌套层级，用于着色（与参数树深度一致） */
  depth: number
}

/** 转义模板字符串字面量中的 \ ` ${ */
function escapeTpl(s: string): string {
  return s.replace(/[\\`]/g, '\\$&').replace(/\$\{/g, '\\${')
}

/** 把文本编码 n 次（n = 穿过的嵌套编码边界数）；逐次调用与运行时多层包裹结果一致 */
function encodeN(text: string, n: number): string {
  for (let i = 0; i < n; i++)
    text = encodeURIComponent(text)
  return text
}

/** 子树（不含自身静态文本）是否含变量；有子树的节点其 value 不参与序列化，需跳过 */
function treeHasVar(tree: UrlTree): boolean {
  return tree.nodes.some(n =>
    (n.children === null
      && (n.kind === 'param' || n.kind === 'segment' || n.kind === 'hash')
      && variableName(n.value) !== null)
    || (n.children !== null && treeHasVar(n.children)),
  )
}

/** 静态文本：先按所在层级预编码，再转义模板字面量 */
function pushStatic(tokens: CodeToken[], depth: number, encodes: number, text: string) {
  if (text)
    tokens.push({ text: escapeTpl(encodeN(text, encodes)), kind: 'static', depth })
}

/**
 * 变量插值：encodeURIComponent 只包变量本身，层数 = 穿过的嵌套编码边界数
 * （与序列化时 `$$name` 原样插入、不参与自身层级编码一致）
 */
function emitVar(name: string, depth: number, encodes: number, tokens: CodeToken[]) {
  tokens.push({ text: `\${${'encodeURIComponent('.repeat(encodes)}`, kind: 'interp', depth })
  tokens.push({ text: name, kind: 'var', depth })
  tokens.push({ text: `${')'.repeat(encodes)}}`, kind: 'interp', depth })
}

/**
 * 参数值 / 路径段：静态内容内联已编码文本；含变量的子树直接展开
 * （静态部分预编码 encodes+1 次，变量多叠一层 encodeURIComponent）
 */
function emitEncodedValue(node: UrlNode, depth: number, encodes: number, tokens: CodeToken[]) {
  if (node.children) {
    if (treeHasVar(node.children))
      buildTokens(node.children, depth + 1, encodes + 1, tokens)
    else
      pushStatic(tokens, depth, encodes + 1, serializeUrl(node.children))
    return
  }
  const name = variableName(node.value)
  if (name !== null)
    emitVar(name, depth, encodes, tokens)
  else
    pushStatic(tokens, depth, encodes + 1, node.value)
}

/**
 * 与 url-tree 的 build() 同构，区别是变量处生成插值。
 * encodes = 当前子树内容被外层嵌套边界编码的次数（结构分隔符按此预编码，
 * 参数名 / 静态值自身再 +1；hash 边界不增加）
 */
function buildTokens(tree: UrlTree, depth: number, encodes: number, tokens: CodeToken[]) {
  let head = ''
  const segs: UrlNode[] = []
  const params: UrlNode[] = []
  let hashNode: UrlNode | null = null
  for (const n of tree.nodes) {
    if (n.kind === 'protocol')
      head += n.value + (n.flag ? '://' : ':')
    else if (n.kind === 'host')
      head += n.value
    else if (n.kind === 'port')
      head += `:${n.value}`
    else if (n.kind === 'segment')
      segs.push(n)
    else if (n.kind === 'param')
      params.push(n)
    else if (n.kind === 'hash')
      hashNode = n
  }
  pushStatic(tokens, depth, encodes, head)

  segs.forEach((seg, i) => {
    pushStatic(tokens, depth, encodes, i === 0 ? (tree.leadingSlash ? '/' : '') : '/')
    emitEncodedValue(seg, depth, encodes, tokens)
    if (i === segs.length - 1 && tree.trailingSlash)
      pushStatic(tokens, depth, encodes, '/')
  })

  if (tree.hasQuery) {
    pushStatic(tokens, depth, encodes, '?')
    params.forEach((p, i) => {
      if (i > 0)
        pushStatic(tokens, depth, encodes, '&')
      pushStatic(tokens, depth, encodes + 1, p.label)
      if (p.flag) {
        pushStatic(tokens, depth, encodes, '=')
        emitEncodedValue(p, depth, encodes, tokens)
      }
    })
  }

  if (tree.hasHash && hashNode) {
    pushStatic(tokens, depth, encodes, '#')
    if (hashNode.children) {
      // hash 不被外层编码：进入 hash 子树不增加编码边界
      if (treeHasVar(hashNode.children))
        buildTokens(hashNode.children, depth + 1, encodes, tokens)
      else
        pushStatic(tokens, depth, encodes, serializeUrl(hashNode.children))
    }
    else {
      const name = variableName(hashNode.value)
      if (name !== null)
        emitVar(name, depth + 1, encodes, tokens)
      else
        pushStatic(tokens, depth, encodes, hashNode.value)
    }
  }
}

/** 生成代码预览：code 为完整模板字符串；tokens 用于按层级着色渲染 */
export function generateCode(tree: UrlTree): { code: string, tokens: CodeToken[] } {
  const tokens: CodeToken[] = [{ text: '`', kind: 'static', depth: 0 }]
  buildTokens(tree, 0, 0, tokens)
  tokens.push({ text: '`', kind: 'static', depth: 0 })
  return { tokens, code: tokens.map(t => t.text).join('') }
}
