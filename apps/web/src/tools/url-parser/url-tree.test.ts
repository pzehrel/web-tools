import type { UrlNode } from './url-tree'

import { describe, expect, it } from 'vitest'
import {
  addParam,
  baseOfTree,
  canMoveNode,
  deleteNode,
  findInsertedId,
  insertParamBelow,
  looksLikeUrl,
  mergeBaseEdit,
  moveNode,
  parseUrl,
  serializeUrl,
  setNodeValue,
  suffixOfTree,
  variableName,
} from './url-tree'

/** 解析 → 序列化应无损往返（编码可能规范化，但解码后语义一致） */
function roundTrip(input: string): string {
  return serializeUrl(parseUrl(input))
}

/** 按文档顺序找第一个 label 匹配的节点（含子树） */
function findByLabel(nodes: UrlNode[], label: string): UrlNode | null {
  for (const n of nodes) {
    if (n.label === label)
      return n
    if (n.children) {
      const found = findByLabel(n.children.nodes, label)
      if (found)
        return found
    }
  }
  return null
}

describe('parseUrl / serializeUrl', () => {
  it('完整 URL：协议、主机、端口、路径、参数、hash', () => {
    const tree = parseUrl('https://a.com:8080/p/x?foo=1&bar=2#sec')
    expect(tree.nodes.map(n => n.kind)).toEqual([
      'protocol',
      'host',
      'port',
      'segment',
      'segment',
      'param',
      'param',
      'hash',
    ])
    expect(roundTrip('https://a.com:8080/p/x?foo=1&bar=2#sec'))
      .toBe('https://a.com:8080/p/x?foo=1&bar=2#sec')
  })

  it('无 scheme 的授权链接（mailto / tel）', () => {
    // mailto 的 @ 会被 encodeURIComponent 编码为 %40，语义等价（mailto RFC 允许）
    expect(decodeURIComponent(roundTrip('mailto:a@b.com'))).toBe('mailto:a@b.com')
    expect(decodeURIComponent(roundTrip('tel:+8613800000000'))).toBe('tel:+8613800000000')
  })

  it('绝对路径与相对路径', () => {
    expect(roundTrip('/api/v1/users?active=true')).toBe('/api/v1/users?active=true')
    expect(roundTrip('reports/2026/q1?mode=full')).toBe('reports/2026/q1?mode=full')
  })

  it('裸查询串（无路径）', () => {
    const tree = parseUrl('a=1&b=2')
    expect(tree.nodes.filter(n => n.kind === 'param').map(n => n.label)).toEqual(['a', 'b'])
    expect(roundTrip('a=1&b=2')).toBe('?a=1&b=2')
  })

  it('无值参数（flag=false）与空值参数区分', () => {
    const tree = parseUrl('?flag&empty=')
    const [flag, empty] = tree.nodes.filter(n => n.kind === 'param')
    expect(flag.flag).toBe(false)
    expect(empty.flag).toBe(true)
    expect(empty.value).toBe('')
  })

  it('嵌套 URL 参数值递归展开为子树', () => {
    const tree = parseUrl('https://a.com/cb?redirect=https://b.com/ok?x=1')
    const redirect = tree.nodes.find(n => n.label === 'redirect')!
    expect(redirect.children).not.toBeNull()
    expect(redirect.children!.nodes.some(n => n.label === 'x')).toBe(true)
  })

  it('嵌套参数编码不泄漏：序列化后外层 query 结构保持', () => {
    const out = roundTrip('https://a.com/cb?redirect=https://b.com/ok?x=1&y=2')
    const query = out.split('?')[1]!
    // 外层只有 redirect 和 state 两个参数位（redirect 值整体被编码）
    expect(query).toMatch(/^[^?]*redirect=[^&]*(&|$)/)
  })

  it('多层 percent-encode 叠加时逐层解开', () => {
    const nested = 'https://b.com/ok?x=1'
    const once = encodeURIComponent(nested)
    const twice = encodeURIComponent(once)
    const tree = parseUrl(`https://a.com/cb?redirect=${twice}`)
    const redirect = tree.nodes.find(n => n.label === 'redirect')!
    expect(redirect.children).not.toBeNull()
  })

  it('hash 路由（SPA）解析为子树', () => {
    const tree = parseUrl('https://a.com/p#/detail?id=1')
    const hash = tree.nodes.find(n => n.kind === 'hash')!
    expect(hash.children).not.toBeNull()
    expect(hash.children!.nodes.some(n => n.kind === 'segment')).toBe(true)
    expect(hash.children!.nodes.some(n => n.label === 'id')).toBe(true)
  })

  it('纯锚点 hash 不展开子树', () => {
    const tree = parseUrl('https://a.com/p#section-2')
    const hash = tree.nodes.find(n => n.kind === 'hash')!
    expect(hash.children).toBeNull()
    expect(hash.value).toBe('section-2')
  })

  it('非 ASCII 值往返一致', () => {
    expect(roundTrip('https://a.com/s?kw=分享卡片')).toBe('https://a.com/s?kw=%E5%88%86%E4%BA%AB%E5%8D%A1%E7%89%87')
  })

  it('整串被编码的输入先解再析', () => {
    const raw = encodeURIComponent('https://a.com/p?x=1')
    const tree = parseUrl(raw)
    expect(tree.nodes.some(n => n.kind === 'protocol')).toBe(true)
  })
})

describe('looksLikeUrl / variableName', () => {
  it('识别 URL / 路径 / 裸查询', () => {
    expect(looksLikeUrl('https://a.com')).toBe(true)
    expect(looksLikeUrl('/abs/path')).toBe(true)
    expect(looksLikeUrl('a=1&b=2')).toBe(true)
    expect(looksLikeUrl('p/x?q=1')).toBe(true)
  })

  it('普通文本不是 URL', () => {
    expect(looksLikeUrl('hello world')).toBe(false)
    expect(looksLikeUrl('')).toBe(false)
    expect(looksLikeUrl('普通中文')).toBe(false)
  })

  it('变量标记', () => {
    expect(variableName('$$uid')).toBe('uid')
    expect(variableName('$$my_var2')).toBe('my_var2')
    expect(variableName('$uid')).toBeNull()
    expect(variableName('$$1abc')).toBeNull()
    expect(variableName('plain')).toBeNull()
  })
})

describe('baseOfTree / suffixOfTree', () => {
  it('base 只含协议主机路径，suffix 含参数与 hash', () => {
    const tree = parseUrl('https://a.com:8080/p?x=1&y=2#/route')
    expect(baseOfTree(tree)).toBe('https://a.com:8080/p')
    expect(suffixOfTree(tree)).toBe('?x=1&y=2#/route')
  })

  it('base + suffix 拼回等于原串（无空隙）', () => {
    const input = 'https://a.com/p?x=1#/route?from=banner'
    const tree = parseUrl(input)
    expect(baseOfTree(tree) + suffixOfTree(tree)).toBe(input)
  })
})

describe('mergeBaseEdit', () => {
  it('只改 base：旧参数 + 旧 hash 原样保留', () => {
    expect(mergeBaseEdit('https://b.com/q', '?keep=1#/old')).toBe('https://b.com/q?keep=1#/old')
  })

  it('手动输入 hash 视为显式替换（修复的 bug：曾整体丢弃）', () => {
    expect(mergeBaseEdit('https://a.com/p#/route?x=1', '?keep=1#/old')).toBe('https://a.com/p?keep=1#/route?x=1')
  })

  it('手动粘贴的 query 剥离（参数已展开为行，避免重复）', () => {
    expect(mergeBaseEdit('https://a.com/p?drop=2', '?keep=1#/old')).toBe('https://a.com/p?keep=1#/old')
  })
})

describe('setNodeValue', () => {
  it('普通值编辑后不残留旧子树', () => {
    const tree = parseUrl('https://a.com/cb?redirect=https://b.com/ok?x=1')
    const redirect = tree.nodes.find(n => n.label === 'redirect')!
    const next = setNodeValue(tree, redirect.id, 'plain')
    const after = parseUrl(serializeUrl(next))
    expect(after.nodes.find(n => n.label === 'redirect')!.children).toBeNull()
  })

  it('值改成 URL 后展开子树', () => {
    const tree = parseUrl('https://a.com/cb?redirect=plain')
    const redirect = tree.nodes.find(n => n.label === 'redirect')!
    const next = setNodeValue(tree, redirect.id, 'https://b.com/ok?x=1')
    const after = parseUrl(serializeUrl(next))
    expect(after.nodes.find(n => n.label === 'redirect')!.children).not.toBeNull()
  })
})

describe('addParam / insertParamBelow', () => {
  it('addParam(parentId=null) 追加到顶层 query', () => {
    const tree = parseUrl('https://a.com/p?x=1')
    const next = addParam(tree, null, 'key', 'value')
    const labels = parseUrl(serializeUrl(next)).nodes.filter(n => n.kind === 'param').map(n => n.label)
    expect(labels).toEqual(['x', 'key'])
  })

  it('addParam 到嵌套 URL 内部（修复的 bug：曾插到同级）', () => {
    const tree = parseUrl('https://a.com/cb?redirect=https://b.com/ok')
    const redirect = tree.nodes.find(n => n.label === 'redirect')!
    const next = addParam(tree, redirect.id, 'key', 'value')
    const out = serializeUrl(next)
    // key=value 必须出现在嵌套 URL 内部（编码后的 ?key=value），而不是外层 &key=value
    expect(out).toContain(encodeURIComponent('https://b.com/ok?key=value'))
    expect(out).not.toMatch(/&key=value/)
  })

  it('insertParamBelow 插入到目标紧后方（同层）', () => {
    const tree = parseUrl('https://a.com/p?a=1&b=2')
    const a = tree.nodes.find(n => n.label === 'a')!
    const next = insertParamBelow(tree, a.id, 'key', 'value')
    const labels = parseUrl(serializeUrl(next)).nodes.filter(n => n.kind === 'param').map(n => n.label)
    expect(labels).toEqual(['a', 'key', 'b'])
  })
})

describe('findInsertedId', () => {
  /** 模拟组件里的完整流程：改树 → 序列化 → 重解析 → diff 定位 */
  function locate(prevInput: string, mutate: (tree: ReturnType<typeof parseUrl>) => ReturnType<typeof parseUrl>): { label: string, value: string } | null {
    const prevTree = parseUrl(prevInput)
    const nextInput = serializeUrl(mutate(prevTree))
    const id = findInsertedId(prevTree.nodes, parseUrl(nextInput).nodes)
    if (!id)
      return null
    const found = (function find(nodes: UrlNode[]): UrlNode | null {
      for (const n of nodes) {
        if (n.id === id)
          return n
        if (n.children) {
          const f = find(n.children.nodes)
          if (f)
            return f
        }
      }
      return null
    })(parseUrl(nextInput).nodes)
    return found ? { label: found.label, value: found.value } : null
  }

  it('顶层插入：定位到新 key 而非已有行（id 位移陷阱）', () => {
    const r = locate('https://a.com/p?a=1&b=2', t => insertParamBelow(t, t.nodes.find(n => n.label === 'b')!.id, 'key', 'value'))
    expect(r).toEqual({ label: 'key', value: 'value' })
  })

  it('嵌套 URL 内插入：容器 value 已变化，不得误判容器为新节点（修复的 bug）', () => {
    const r = locate(
      'https://a.com/cb?redirect=https://b.com/ok&state=1',
      (t) => {
        const redirect = t.nodes.find(n => n.label === 'redirect')!
        return addParam(t, redirect.id, 'key', 'value')
      },
    )
    expect(r).toEqual({ label: 'key', value: 'value' })
  })

  it('值原本不展开的行插入首个参数后展开：取子树第一个 param', () => {
    // redirect 值是纯路径（无 query），不展开；插入参数后展开
    const r = locate(
      'https://a.com/cb?redirect=/plain/path',
      (t) => {
        const redirect = t.nodes.find(n => n.label === 'redirect')!
        return addParam(t, redirect.id, 'key', 'value')
      },
    )
    expect(r).toEqual({ label: 'key', value: 'value' })
  })
})

describe('deleteNode', () => {
  it('删除参数后修正 hasQuery（最后一个参数删除后无 ? 残留）', () => {
    const tree = parseUrl('https://a.com/p?x=1')
    const x = tree.nodes.find(n => n.label === 'x')!
    const out = serializeUrl(deleteNode(tree, x.id))
    expect(out).toBe('https://a.com/p')
  })

  it('删除嵌套 URL 参数连带其全部子参数', () => {
    const tree = parseUrl('https://a.com/cb?redirect=https://b.com/ok?x=1&keep=1')
    const redirect = tree.nodes.find(n => n.label === 'redirect')!
    const out = serializeUrl(deleteNode(tree, redirect.id))
    expect(decodeURIComponent(out)).toBe('https://a.com/cb?keep=1')
  })
})

describe('moveNode / canMoveNode', () => {
  it('参数拖到普通值参数后：移动到同层并排在其后', () => {
    // a 拖到 b 上：a 移到 b 的位置后面（b 原本在 a 之后）
    const tree = parseUrl('https://a.com/p?a=1&b=2')
    const a = tree.nodes.find(n => n.label === 'a')!
    const b = tree.nodes.find(n => n.label === 'b')!
    const out = serializeUrl(moveNode(tree, a.id, b.id))
    expect(out).toBe('https://a.com/p?b=2&a=1')
  })

  it('参数拖到嵌套 URL 的 key 上：移入该 URL（连同子参数）', () => {
    const tree = parseUrl('https://a.com/cb?redirect=https://b.com/ok&state=1')
    const redirect = tree.nodes.find(n => n.label === 'redirect')!
    const state = tree.nodes.find(n => n.label === 'state')!
    expect(canMoveNode(tree, state.id, redirect.id)).toBe(true)
    const out = serializeUrl(moveNode(tree, state.id, redirect.id))
    expect(decodeURIComponent(out)).toBe('https://a.com/cb?redirect=https://b.com/ok?state=1')
  })

  it('嵌套 URL 拖到根：整体替换根树，不保留原根的其他参数（设计行为）', () => {
    const tree = parseUrl('https://a.com/cb?redirect=https://b.com/ok?x=1&state=1')
    const redirect = tree.nodes.find(n => n.label === 'redirect')!
    const next = moveNode(tree, redirect.id, null)
    expect(serializeUrl(next)).toBe('https://b.com/ok?x=1')
  })

  it('uRL 拖入自己子树：父子旋转，双方参数保留', () => {
    const tree = parseUrl('https://a.com/cb?redirect=https://b.com/ok?x=1&state=1')
    const redirect = tree.nodes.find(n => n.label === 'redirect')!
    const x = findByLabel([redirect], 'x')!
    const out = serializeUrl(moveNode(tree, redirect.id, x.id))
    // 旋转后 x 成为容器，redirect（含 state）成为其子参数
    const decoded = decodeURIComponent(out)
    expect(decoded).toContain('x=')
    expect(decoded).toContain('redirect=')
  })

  it('目标 URL 已有另一个 hash 时拒绝移入（一个 URL 只能有一个 hash）', () => {
    // 外层 hash 拖到嵌套 URL 的 key 上，而嵌套 URL 值里自带 hash（编码的 %23）→ 拒绝
    const tree = parseUrl(`https://a.com/p?redirect=${encodeURIComponent('https://b.com/ok#/nested')}&state=1#/outer`)
    const hash = tree.nodes.find(n => n.kind === 'hash')!
    const redirect = tree.nodes.find(n => n.label === 'redirect')!
    // 前置：嵌套 URL 里确实已有 hash
    expect(redirect.children!.nodes.some(n => n.kind === 'hash')).toBe(true)
    expect(canMoveNode(tree, hash.id, redirect.id)).toBe(false)
  })

  it('hash 移动到同层普通参数后仍合法（仍是该层唯一 hash）', () => {
    const tree = parseUrl('https://a.com/p?x=1#/route')
    const x = tree.nodes.find(n => n.label === 'x')!
    const hash = tree.nodes.find(n => n.kind === 'hash')!
    expect(canMoveNode(tree, hash.id, x.id)).toBe(true)
  })

  it('不能把节点拖到自己身上', () => {
    const tree = parseUrl('https://a.com/p?x=1')
    const x = tree.nodes.find(n => n.label === 'x')!
    expect(canMoveNode(tree, x.id, x.id)).toBe(false)
  })
})
