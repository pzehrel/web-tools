import type { StoreItem } from './types'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ items: new Map<string, unknown>() }))

vi.mock('./index', () => ({
  createToolStore: () => ({
    list: async (toolId: string) => [...state.items.values()]
      .filter((item: unknown) => (item as StoreItem).toolId === toolId)
      .map((item: unknown) => {
        const { payload: _payload, ...summary } = item as StoreItem
        return summary
      }),
  }),
}))

const { saveContentRecord } = await import('./content-record')

function createItem(id: string, payload: Blob, meta: { name: string }): StoreItem {
  return { id, toolId: 'test', payload, meta, createdAt: Date.now(), updatedAt: Date.now() }
}

async function save(item: StoreItem): Promise<void> {
  state.items.set(item.id, item)
}

describe('content addressed local records', () => {
  beforeEach(() => state.items.clear())

  it('reuses the record for identical bytes and preserves its creation time', async () => {
    const original = await saveContentRecord('test', new Blob(['same']), { name: 'first' }, null, false, createItem, save)
    const createdAt = (state.items.get(original.id) as StoreItem).createdAt
    const repeat = await saveContentRecord('test', new Blob(['same']), { name: 'repeat' }, null, true, createItem, save)

    expect(repeat).toEqual({ id: original.id, saved: false })
    expect(state.items.size).toBe(1)
    expect((state.items.get(original.id) as StoreItem).meta.name).toBe('first')

    await saveContentRecord('test', new Blob(['same']), { name: 'edited' }, null, false, createItem, save)
    expect(state.items.size).toBe(1)
    expect((state.items.get(original.id) as StoreItem).createdAt).toBe(createdAt)
    expect((state.items.get(original.id) as StoreItem).meta.name).toBe('edited')
  })

  it('updates the current project when its content changes', async () => {
    const original = await saveContentRecord('test', new Blob(['before']), { name: 'first' }, null, false, createItem, save)
    const updated = await saveContentRecord('test', new Blob(['after']), { name: 'second' }, original.id, false, createItem, save)

    expect(updated.id).toBe(original.id)
    expect(state.items.size).toBe(1)
    expect((state.items.get(original.id) as StoreItem).meta.name).toBe('second')
  })
})
