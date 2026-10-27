/* eslint-disable no-template-curly-in-string -- 测试 JS 模板源码，需要断言字面量插值标记。 */
import type { UrlTree } from './url-tree'

import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { generateCode, resolveUrlVariables } from './url-code'
import { parseUrl, serializeUrl } from './url-tree'

function queryTree(value: string | UrlTree): UrlTree {
  return {
    leadingSlash: false,
    trailingSlash: false,
    hasQuery: true,
    hasHash: false,
    nodes: [{ id: 'param', kind: 'param', label: 'next', value: typeof value === 'string' ? value : '', flag: true, children: typeof value === 'string' ? null : value }],
  }
}

describe('resolveUrlVariables', () => {
  it('无变量时使用原序列化结果', () => {
    const tree = parseUrl('https://a.com/中文?q=空 格#/route?x=1')
    expect(resolveUrlVariables(tree, {})).toEqual({ names: [], missing: [], text: serializeUrl(tree) })
  })

  it('路径、query、hash 按首次出现顺序去重', () => {
    const tree = parseUrl('/$$id?x=$$value&repeat=$$id#$$value')
    expect(resolveUrlVariables(tree, { id: 'a/b', value: ' x&y ' })).toEqual({
      names: ['id', 'value'],
      missing: [],
      text: '/a/b?x= x&y &repeat=a/b# x&y ',
    })
  })

  it('任意变量缺失或只有空白时不返回文本', () => {
    const tree = parseUrl('/$$first?x=$$second&repeat=$$first')
    expect(resolveUrlVariables(tree, { second: ' \n\t' })).toEqual({ names: ['first', 'second'], missing: ['first', 'second'], text: null })
  })

  it.each(['\uD800', '\uDC00', 'before\uD800after'])('嵌套变量含孤立代理项时按缺少可用值处理：%j', (value) => {
    const tree = queryTree(queryTree('$$value'))
    expect(resolveUrlVariables(tree, { value })).toEqual({ names: ['value'], missing: ['value'], text: null })
  })

  it('完整代理对在多层嵌套中正确编码', () => {
    const tree = queryTree(queryTree(queryTree('$$value')))
    const value = '\uD83D\uDE00'
    expect(resolveUrlVariables(tree, { value })).toEqual({ names: ['value'], missing: [], text: `?next=${encodeURIComponent(`?next=${encodeURIComponent(`?next=${value}`)}`)}` })
  })

  it('不经过编码边界的运行时字符串保持原样', () => {
    const value = '\uD800'
    expect(resolveUrlVariables(queryTree('$$value'), { value }).text).toBe(`?next=${value}`)
  })

  it('变量值不递归解析，也不转义为模板源码', () => {
    const tree = queryTree('$$value')
    const value = '/path?x=$$other&raw=${danger}`\\'
    expect(resolveUrlVariables(tree, { value }).text).toBe(`?next=${value}`)
  })

  it('嵌套 query 每过边界多编码一次，hash 子树不增加边界', () => {
    const inner = parseUrl('/$$path?x=$$query#$$hash')
    const tree = queryTree(queryTree(inner))
    const values = { path: 'a/b', query: 'x&y=中文', hash: '$$literal' }
    const expected = `?next=${encodeURIComponent(`?next=${encodeURIComponent(`/a/b?x=x&y=中文#$$literal`)}`)}`
    expect(resolveUrlVariables(tree, values).text).toBe(expected)
    expect(generateCode(tree).code).toContain('${encodeURIComponent(encodeURIComponent(path))}')
    expect(generateCode(tree).code).toContain('${encodeURIComponent(encodeURIComponent(hash))}')
    expect(generateCode(tree).code).not.toContain('${encodeURIComponent(encodeURIComponent(encodeURIComponent(hash)))}')
  })

  it('嵌套路径边界编码，hash 路由保持自身变量层级', () => {
    const tree = parseUrl(`/${encodeURIComponent('/$$value?x=$$value')}#/$$hash?x=$$value`)
    const values = { value: 'a/b&x=1', hash: 'route/name' }
    expect(resolveUrlVariables(tree, values).text).toBe(`/${encodeURIComponent('/a/b&x=1?x=a/b&x=1')}#/route/name?x=a/b&x=1`)
  })

  it('特殊对象键只读取自身字符串值', () => {
    const tree = parseUrl('?a=$$__proto__&b=$$constructor&c=$$toString')
    expect(resolveUrlVariables(tree, {}).missing).toEqual(['__proto__', 'constructor', 'toString'])
    const values: Record<string, string> = JSON.parse('{"__proto__":"proto","constructor":"ctor","toString":"string"}')
    expect(resolveUrlVariables(tree, values).text).toBe('?a=proto&b=ctor&c=string')
  })

  it('仅整值变量参与求值，协议、主机、标签和无值参数不参与', () => {
    const tree = parseUrl('https://$$host/$$valid?$$key=prefix$$ignored&flag&x=$$valid')
    expect(resolveUrlVariables(tree, { valid: 'ok' }).names).toEqual(['valid'])
    expect(resolveUrlVariables(tree, { valid: 'ok' }).text).toBe('https://$$host/ok?%24%24key=prefix%24%24ignored&flag&x=ok')
  })
})

describe('generateCode', () => {
  it('编码 JSON 内的 URL 和百分号保持原文，代码与序列化结果一致', () => {
    const json = JSON.stringify({ token: 'demo%2Bpart%2F', redirect: 'https://example.org/?a=1&b=2', literal: '$$value' })
    const tree = parseUrl(`demoapp://example.com/open?data=${encodeURIComponent(json)}&id=$$id`)
    const expected = `demoapp://example.com/open?data=${encodeURIComponent(json)}&id=42`
    expect(runInNewContext(generateCode(tree).code, { id: '42' })).toBe(expected)
    expect(resolveUrlVariables(tree, { id: '42' })).toEqual({ names: ['id'], missing: [], text: expected })
  })

  it('保持普通变量的上一版 JS 模板', () => {
    const tree = parseUrl('/pages/aaa?b=$$x')
    expect(generateCode(tree).code).toBe('`/pages/aaa?b=${x}`')
    expect(generateCode(queryTree(parseUrl('/inner?x=$$y'))).code).toBe('`?next=%2Finner%3Fx%3D${encodeURIComponent(y)}`')
  })

  it('静态内容按模板字面量转义，求值保留原文', () => {
    const tree = parseUrl('/x?value=$$x#raw`\\${literal}')
    expect(generateCode(tree).code).toBe('`/x?value=${x}#raw\\`\\\\\\${literal}`')
    expect(resolveUrlVariables(tree, { x: 'ok' }).text).toBe('/x?value=ok#raw`\\${literal}')
  })

  it('生成代码在多层编码和转义场景中与运行时求值一致', () => {
    const tree = queryTree(queryTree(parseUrl('/$$path?x=$$query#raw`\\\\${literal}')))
    const values = { path: 'a/b', query: '中文&x=1' }
    expect(runInNewContext(generateCode(tree).code, values)).toBe(resolveUrlVariables(tree, values).text)
  })

  it.each(['class', 'default', 'await', 'this', 'null', 'encodeURIComponent'])('变量 %s 生成可执行表达式', (name) => {
    const tree = queryTree(queryTree(queryTree(`$$${name}`)))
    const variables = { [name]: 'a/b&中文' }
    expect(runInNewContext(generateCode(tree).code, { variables })).toBe(resolveUrlVariables(tree, variables).text)
  })

  it('保留字和内建编码函数同名变量使用局部映射', () => {
    const tree = queryTree(parseUrl('/$$class?x=$$default&encode=$$encodeURIComponent'))
    const { code, tokens } = generateCode(tree)
    expect(code).toBe('(({ "class": _urlVar0, "default": _urlVar1, "encodeURIComponent": _urlVar2 }) => `?next=%2F${encodeURIComponent(_urlVar0)}%3Fx%3D${encodeURIComponent(_urlVar1)}%26encode%3D${encodeURIComponent(_urlVar2)}`)(variables)')
    expect(tokens.map(token => token.text).join('')).toBe(code)
    expect(resolveUrlVariables(tree, { class: 'a/b', default: 'x&y', encodeURIComponent: '% ' }).text)
      .toBe(`?next=${encodeURIComponent('/a/b?x=x&y&encode=% ')}`)
  })
})
