import type { UrlWorkspaceSnapshot } from './url-records'
import type { StoreItem, StoreItemSummary } from '@/lib/storage/types'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUrlRecords } from './url-records'

const mocks = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  refIndex: 0,
  states: [] as unknown[],
  stateIndex: 0,
  items: [] as StoreItemSummary[],
  save: vi.fn<(item: StoreItem) => Promise<void>>(),
  remove: vi.fn<(id: string) => Promise<void>>(),
  refresh: vi.fn<() => Promise<void>>(),
}))

// 只替换 hook 所需的 React 原语，保留跨渲染 ref，不引入浏览器测试依赖。
vi.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useRef: (initial: unknown) => {
    const index = mocks.refIndex++
    mocks.refs[index] ??= { current: initial }
    return mocks.refs[index]
  },
  useState: (initial: unknown) => {
    const index = mocks.stateIndex++
    if (!(index in mocks.states))
      mocks.states[index] = typeof initial === 'function' ? initial() : initial
    return [mocks.states[index], (next: unknown) => {
      mocks.states[index] = typeof next === 'function' ? next(mocks.states[index]) : next
    }]
  },
}))

vi.mock('@/lib/react/use-tool-store', () => ({
  useToolStore: () => ({ items: mocks.items, save: mocks.save, remove: mocks.remove, refresh: mocks.refresh }),
}))

function renderRecords() {
  mocks.refIndex = 0
  mocks.stateIndex = 0
  // eslint-disable-next-line react/rules-of-hooks -- 此处使用上方替换的 hook 原语验证存储行为。
  return useUrlRecords()
}

function stored(payload: string, overrides: Partial<StoreItemSummary> = {}): StoreItemSummary {
  return { id: 'saved', toolId: 'url-parser', payload, meta: { name: '已保存' }, createdAt: 10, updatedAt: 20, size: 3, hasBlob: false, ...overrides }
}

function snapshot(): UrlWorkspaceSnapshot {
  return {
    tabs: [
      { id: 'tab-1', name: '登录', text: 'https://a.com?uid=$$id', variables: JSON.parse('{"id":"中文","__proto__":"原型"}') },
      { id: 'tab-2', name: '留白', text: '  ', variables: {} },
      { id: 'tab-3', name: '详情', text: '/details?id=$$id', variables: { id: '123' } },
    ],
    activeTabId: 'tab-3',
  }
}

async function flushWrites() {
  for (let i = 0; i < 12; i++)
    await Promise.resolve()
}

beforeEach(() => {
  mocks.refs = []
  mocks.refIndex = 0
  mocks.states = []
  mocks.stateIndex = 0
  mocks.items = []
  mocks.save.mockReset().mockResolvedValue(undefined)
  mocks.remove.mockReset().mockResolvedValue(undefined)
  mocks.refresh.mockReset().mockResolvedValue(undefined)
})

describe('useUrlRecords', () => {
  it('旧纯文本恢复为稳定的单个 Tab，保留名称与时间', () => {
    mocks.items = [stored('  https://a.com?x=1  ')]
    const first = renderRecords().items[0]
    const second = renderRecords().items[0]
    expect(first).toEqual({ id: 'saved', name: '已保存', time: 20, snapshot: { tabs: [{ id: 'legacy-saved', name: '二维码 1', text: '  https://a.com?x=1  ', variables: {} }], activeTabId: 'legacy-saved' } })
    expect(first.snapshot).toEqual(second.snapshot)
  })

  it.each([
    '{"tabs":[],"activeTabId":"x"}',
    '{"version":1,"snapshot":{"tabs":[],"activeTabId":"x"}}',
    '{"format":"web-tools:url-parser","version":2,"snapshot":{}}',
    '{"format":"web-tools:url-parser","version":1,"snapshot":{"tabs":[{"id":"x","name":"x","text":"a","variables":{}}],"activeTabId":"unknown"}}',
    '{"format":"web-tools:url-parser","version":1,"snapshot":{"tabs":[{"id":"x","name":"x","text":"a","variables":{}}],"activeTabId":"x"},"content":"普通 JSON"}',
    '"JSON string"',
  ])('普通或无效 JSON 内容保持原文：%s', (payload) => {
    mocks.items = [stored(payload)]
    expect(renderRecords().items[0].snapshot.tabs[0].text).toBe(payload)
  })

  it('整组保存与读取保留标题、顺序、空 Tab、变量及选中项', async () => {
    const value = snapshot()
    const id = renderRecords().add(value, '组合二维码')
    expect(id).toBeTypeOf('string')
    await flushWrites()
    const saved = mocks.save.mock.calls[0][0]
    expect(saved.meta).toEqual({ name: '组合二维码' })
    expect(JSON.parse(saved.payload as string)).toEqual({ format: 'web-tools:url-parser', version: 1, snapshot: value })
    mocks.items = [stored(saved.payload as string, { ...saved, payload: saved.payload as string })]
    const restored = renderRecords().items[0]
    expect(restored.snapshot).toEqual(value)
    expect(Object.hasOwn(restored.snapshot.tabs[0].variables, '__proto__')).toBe(true)
  })

  it('整组空白或没有 Tab 时不新增，也不覆盖已有内容', async () => {
    mocks.items = [stored('/existing')]
    const records = renderRecords()
    const empty = { tabs: [{ id: 'empty', name: '空白', text: ' \n ', variables: { id: 'filled' } }], activeTabId: 'empty' }
    expect(records.add(empty, '空')).toBeNull()
    expect(records.add({ tabs: [], activeTabId: '' }, '')).toBeNull()
    records.update('saved', { snapshot: empty })
    await flushWrites()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('更新旧记录保留 createdAt 和额外元数据，去掉派生大小', async () => {
    mocks.items = [stored('/old', { meta: { name: '旧名', extra: true } })]
    renderRecords().update('saved', { snapshot: snapshot(), name: '新名' })
    await flushWrites()
    const saved = mocks.save.mock.calls[0][0]
    expect(saved.createdAt).toBe(10)
    expect(saved.meta).toEqual({ name: '新名', extra: true })
    expect(saved).not.toHaveProperty('size')
    expect(saved).not.toHaveProperty('hasBlob')
    expect(JSON.parse(saved.payload as string).snapshot).toEqual(snapshot())
  })

  it('读取旧记录后无变化更新不迁移或刷新时间', async () => {
    mocks.items = [stored('/old')]
    const records = renderRecords()
    records.update('saved', { name: '已保存', snapshot: records.items[0].snapshot })
    await flushWrites()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('更新后的写入完成前保持 saving，持久化成功后才显示 saved', async () => {
    let finishSave: () => void = () => {}
    mocks.save.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishSave = resolve
    }))
    mocks.items = [stored('/old')]
    renderRecords().update('saved', { name: '新名称' })
    expect(renderRecords()).toHaveProperty('writeStatus', 'saving')
    await flushWrites()
    expect(renderRecords()).toHaveProperty('writeStatus', 'saving')
    finishSave()
    await flushWrites()
    expect(renderRecords()).toHaveProperty('writeStatus', 'saved')
  })

  it('更新持久化失败后显示 error', async () => {
    let failSave: (error: Error) => void = () => {}
    mocks.save.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => {
      failSave = reject
    }))
    mocks.items = [stored('/old')]
    renderRecords().update('saved', { name: '新名称' })
    expect(renderRecords()).toHaveProperty('writeStatus', 'saving')
    await flushWrites()
    failSave(new Error('storage unavailable'))
    await flushWrites()
    expect(renderRecords()).toHaveProperty('writeStatus', 'error')
  })

  it('整轮写入结束后保留失败，下一轮成功能恢复 saved', async () => {
    let finishSave: () => void = () => {}
    mocks.items = [stored('/one'), stored('/two', { id: 'second' })]
    mocks.save.mockRejectedValueOnce(new Error('storage unavailable'))
    mocks.save.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishSave = resolve
    }))
    const records = renderRecords()
    expect(records).toHaveProperty('writeStatus', 'idle')
    records.update('saved', { name: '第一项' })
    records.update('second', { name: '第二项' })
    await flushWrites()
    expect(renderRecords()).toHaveProperty('writeStatus', 'saving')
    finishSave()
    await flushWrites()
    expect(renderRecords()).toHaveProperty('writeStatus', 'error')
    renderRecords().update('saved', { name: '再次保存' })
    expect(renderRecords()).toHaveProperty('writeStatus', 'saving')
    await flushWrites()
    expect(renderRecords()).toHaveProperty('writeStatus', 'saved')
    renderRecords().update('saved', { name: '再次保存' })
    expect(renderRecords()).toHaveProperty('writeStatus', 'saved')
  })

  it('保存后立即重命名与更换快照按顺序写入，保留 createdAt', async () => {
    let finishFirst: () => void = () => {}
    mocks.save.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finishFirst = resolve
    }))
    const records = renderRecords()
    const id = records.add(snapshot(), '初始')!
    const next = { ...snapshot(), activeTabId: 'tab-1' }
    records.update(id, { name: '新名' })
    records.update(id, { snapshot: next })
    await flushWrites()
    expect(mocks.save).toHaveBeenCalledTimes(1)
    finishFirst()
    await flushWrites()
    expect(mocks.save).toHaveBeenCalledTimes(3)
    const [initial, renamed, updated] = mocks.save.mock.calls.map(([item]) => item)
    expect(renamed.meta.name).toBe('新名')
    expect(updated.meta.name).toBe('新名')
    expect(updated.createdAt).toBe(initial.createdAt)
    expect(JSON.parse(updated.payload as string).snapshot.activeTabId).toBe('tab-1')
  })

  it('保存未刷新时 clear 仍会在保存后删除新记录', async () => {
    const records = renderRecords()
    const id = records.add(snapshot(), '新建')!
    records.clear()
    await flushWrites()
    expect(mocks.remove).toHaveBeenCalledWith(id)
    expect(mocks.save.mock.invocationCallOrder[0]).toBeLessThan(mocks.remove.mock.invocationCallOrder[0])
  })

  it('写入失败不展示未保存记录，也不保留可更新的伪记录', async () => {
    mocks.save.mockRejectedValueOnce(new Error('storage unavailable'))
    const records = renderRecords()
    const id = records.add(snapshot(), '失败')!
    await flushWrites()
    const next = renderRecords()
    expect(next.items).toEqual([])
    next.update(id, { name: '不会写入' })
    await flushWrites()
    expect(mocks.save).toHaveBeenCalledTimes(1)
  })
})
