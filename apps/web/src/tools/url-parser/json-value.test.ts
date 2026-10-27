import { describe, expect, it } from 'vitest'
import { parseJsonContainer, parseJsonField, replaceJsonField } from './json-value'

describe('编码 JSON 参数编辑', () => {
  it('识别对象与数组，不把原始值当成容器', () => {
    expect(parseJsonContainer('{"name":"demo"}')).toEqual({ name: 'demo' })
    expect(parseJsonContainer('[1,true,null]')).toEqual([1, true, null])
    for (const text of ['null', '123', 'true', '"text"', '{invalid}'])
      expect(parseJsonContainer(text)).toBeNull()
  })

  it('字符串字段保留文本，其他字段保留 JSON 类型', () => {
    expect(parseJsonField('false', 'true')).toBe('false')
    expect(parseJsonField('42', 1)).toBe(42)
    expect(parseJsonField('false', true)).toBe(false)
    expect(parseJsonField('null', null)).toBeNull()
    expect(() => parseJsonField('invalid', 1)).toThrow()
  })

  it('嵌套数组和对象不可变更新，保留特殊键', () => {
    const original = JSON.parse('{"__proto__":"before","items":[1,2]}')
    const next = replaceJsonField(original, '__proto__', 'after')
    expect(Object.hasOwn(next, '__proto__')).toBe(true)
    expect(JSON.stringify(next)).toBe('{"__proto__":"after","items":[1,2]}')
    expect(Object.getOwnPropertyDescriptor(original, '__proto__')?.value).toBe('before')
    expect(replaceJsonField([1, 2], '1', 3)).toEqual([1, 3])
  })
})
