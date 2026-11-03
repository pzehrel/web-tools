import type { UrlWorkspaceSnapshot } from './url-records'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useUrlAutosave } from './use-url-autosave'

const hooks = vi.hoisted(() => ({
  refs: [] as { current: unknown }[],
  refIndex: 0,
  effects: [] as { dependencies: unknown[], cleanup?: () => void }[],
  effectIndex: 0,
}))

// 保留父工作区的 hook 状态，模拟依赖变化与卸载，使用假时钟验证防抖和补存。
vi.mock('react', () => ({
  useRef: (initial: unknown) => {
    const index = hooks.refIndex++
    hooks.refs[index] ??= { current: initial }
    return hooks.refs[index]
  },
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => (() => void) | void, dependencies: unknown[]) => {
    const index = hooks.effectIndex++
    // 测试中的 useCallback 返回新函数，只比较实际影响保存的快照依赖。
    const comparable = dependencies.filter(value => typeof value !== 'function')
    const previous = hooks.effects[index]
    if (previous && previous.dependencies.length === comparable.length
      && comparable.every((value, index) => Object.is(value, previous.dependencies[index]))) {
      return
    }
    previous?.cleanup?.()
    hooks.effects[index] = { dependencies: comparable, cleanup: effect() || undefined }
  },
}))

const records = {
  add: vi.fn<(snapshot: UrlWorkspaceSnapshot, name: string) => string | null>(),
  update: vi.fn<() => boolean>(),
  loading: false,
}
const select = vi.fn<(id: string) => void>()
const name = () => '测试记录'

function snapshot(text = '/first', activeTabId = 'one'): UrlWorkspaceSnapshot {
  return {
    tabs: [{ id: 'one', name: '链接 1', text, variables: { user: '中文' } }, { id: 'two', name: '链接 2', text: '', variables: {} }],
    activeTabId,
  }
}

function render(value: UrlWorkspaceSnapshot, selectedId: string | null = null) {
  hooks.refIndex = 0
  hooks.effectIndex = 0
  // eslint-disable-next-line react/rules-of-hooks -- 使用上方替换的 React 原语模拟工作区渲染。
  return useUrlAutosave(value, selectedId, select, records, name)
}

beforeEach(() => {
  vi.useFakeTimers()
  hooks.refs = []
  hooks.effects = []
  hooks.refIndex = 0
  hooks.effectIndex = 0
  records.add.mockReset().mockImplementation(value => value.tabs.some(tab => tab.text.trim()) ? 'new-record' : null)
  records.update.mockReset().mockReturnValue(true)
  select.mockReset()
  records.loading = false
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('useUrlAutosave', () => {
  it('连续输入只保存最终整组快照，自动选中新记录', () => {
    render(snapshot('/first'))
    vi.advanceTimersByTime(300)
    const latest = snapshot('/latest')
    render(latest)
    vi.advanceTimersByTime(399)
    expect(records.add).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(records.add).toHaveBeenCalledExactlyOnceWith(latest, '测试记录')
    expect(select).toHaveBeenCalledExactlyOnceWith('new-record')
  })

  it('切换链接后继续更新同一记录，并保留变量与空链接', () => {
    render(snapshot())
    vi.advanceTimersByTime(400)
    const next = snapshot('/edited', 'two')
    render(next, 'new-record')
    vi.advanceTimersByTime(400)
    expect(records.add).toHaveBeenCalledTimes(1)
    expect(records.update).toHaveBeenCalledExactlyOnceWith('new-record', { snapshot: next })
  })

  it('切换记录前立即补存，不让旧定时器覆盖另一条记录', () => {
    const first = snapshot('/edited')
    const autosave = render(first, 'first-record')
    autosave.flush()
    const second = snapshot('/second')
    render(second, 'second-record')
    vi.advanceTimersByTime(400)
    expect(records.update.mock.calls).toEqual([
      ['first-record', { snapshot: first }],
      ['second-record', { snapshot: second }],
    ])
  })

  it('删除或手动另存时取消待保存内容，隐藏与卸载均不重新创建', () => {
    const autosave = render(snapshot())
    autosave.cancel()
    window.dispatchEvent(new Event('pagehide'))
    for (const effect of hooks.effects)
      effect.cleanup?.()
    vi.advanceTimersByTime(1000)
    expect(records.add).not.toHaveBeenCalled()
  })

  it.each(['pagehide', 'visibilitychange', 'unmount'])('%s 时补存尚未到期的修改', (event) => {
    const value = snapshot('/pending')
    render(value, 'existing')
    if (event === 'unmount') {
      for (const effect of hooks.effects)
        effect.cleanup?.()
    }
    else if (event === 'visibilitychange') {
      Object.assign(document, { visibilityState: 'hidden' })
      document.dispatchEvent(new Event(event))
    }
    else {
      window.dispatchEvent(new Event(event))
    }
    expect(records.update).toHaveBeenCalledExactlyOnceWith('existing', { snapshot: value })
    vi.advanceTimersByTime(1000)
    expect(records.update).toHaveBeenCalledTimes(1)
  })

  it('首次保存失败导致记录不存在时，下次编辑重新创建记录', () => {
    records.update.mockReturnValue(false)
    const value = snapshot('/retry')
    render(value, 'failed-record')
    vi.advanceTimersByTime(400)
    expect(records.add).toHaveBeenCalledExactlyOnceWith(value, '测试记录')
    expect(select).toHaveBeenCalledWith('new-record')
  })

  it('等待存储首次加载完成后才保存，避免重复创建恢复中的记录', () => {
    records.loading = true
    const value = snapshot('/existing')
    render(value)
    vi.advanceTimersByTime(1000)
    expect(records.add).not.toHaveBeenCalled()
    records.loading = false
    render(value, 'existing')
    vi.advanceTimersByTime(400)
    expect(records.update).toHaveBeenCalledExactlyOnceWith('existing', { snapshot: value })
    expect(records.add).not.toHaveBeenCalled()
  })

  it('整组空白时不选中或创建记录', () => {
    render(snapshot('  '))
    vi.advanceTimersByTime(400)
    expect(select).not.toHaveBeenCalled()
  })
})
