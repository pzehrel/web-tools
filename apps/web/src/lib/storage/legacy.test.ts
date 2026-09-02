import { describe, expect, it } from 'vitest'

import { legacyToStoreItems, LEGACY_TOOL_ID, parseLegacyUrlRecords } from './legacy'

describe('parseLegacyUrlRecords', () => {
  it('解析合法记录', () => {
    const raw = JSON.stringify([
      { id: 'a', name: '示例', text: 'https://a.com', time: 100 },
    ])
    expect(parseLegacyUrlRecords(raw)).toEqual([
      { id: 'a', name: '示例', text: 'https://a.com', time: 100 },
    ])
  })

  it('旧自动历史没有 name 字段时补空串', () => {
    const raw = JSON.stringify([{ id: 'a', text: 'https://a.com', time: 100 }])
    expect(parseLegacyUrlRecords(raw)).toEqual([
      { id: 'a', name: '', text: 'https://a.com', time: 100 },
    ])
  })

  it('null / 坏 JSON / 非数组 / 缺字段都返回空数组', () => {
    expect(parseLegacyUrlRecords(null)).toEqual([])
    expect(parseLegacyUrlRecords('not json')).toEqual([])
    expect(parseLegacyUrlRecords('{}')).toEqual([])
    expect(parseLegacyUrlRecords(JSON.stringify([{ id: 1, text: 'x', time: 1 }]))).toEqual([])
    expect(parseLegacyUrlRecords(JSON.stringify([{ id: 'a', time: 1 }]))).toEqual([])
  })
})

describe('legacyToStoreItems', () => {
  it('转换为 StoreItem：payload 为 text，name 进 meta，时间沿用', () => {
    const items = legacyToStoreItems(
      JSON.stringify([{ id: 'a', name: 'n', text: 'https://a.com', time: 100 }]),
      null,
    )
    expect(items).toEqual([
      {
        id: 'a',
        toolId: LEGACY_TOOL_ID,
        payload: 'https://a.com',
        meta: { name: 'n' },
        createdAt: 100,
        updatedAt: 100,
      },
    ])
  })

  it('二维码记录并入并按 text 去重（URL 侧优先）', () => {
    const items = legacyToStoreItems(
      JSON.stringify([{ id: 'a', text: 'same', time: 100 }]),
      JSON.stringify([
        { id: 'b', text: 'same', time: 50 },
        { id: 'c', text: 'unique', time: 60 },
      ]),
    )
    expect(items.map(i => i.id)).toEqual(['a', 'c'])
  })

  it('两边都为空时返回空数组', () => {
    expect(legacyToStoreItems(null, null)).toEqual([])
  })
})
