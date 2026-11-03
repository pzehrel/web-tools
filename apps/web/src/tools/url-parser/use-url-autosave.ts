import type { UrlWorkspaceSnapshot, useUrlRecords } from './url-records'
import { useCallback, useEffect, useRef } from 'react'

type RecordStore = ReturnType<typeof useUrlRecords>

export function useUrlAutosave(
  snapshot: UrlWorkspaceSnapshot,
  selectedId: string | null,
  setSelectedId: (id: string) => void,
  records: Pick<RecordStore, 'add' | 'update'> & { loading?: boolean },
  defaultName: (snapshot: UrlWorkspaceSnapshot) => string,
) {
  const pendingRef = useRef<{ snapshot: UrlWorkspaceSnapshot, id: string | null } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestRef = useRef({ selectedId, setSelectedId, records, defaultName })
  latestRef.current = { selectedId, setSelectedId, records, defaultName }

  const cancel = useCallback(() => {
    if (timerRef.current !== null)
      clearTimeout(timerRef.current)
    timerRef.current = null
    pendingRef.current = null
  }, [])

  const flush = useCallback(() => {
    const pending = pendingRef.current
    cancel()
    if (!pending)
      return
    const { records, setSelectedId, defaultName } = latestRef.current
    if (pending.id && records.update(pending.id, { snapshot: pending.snapshot }))
      return
    const id = records.add(pending.snapshot, defaultName(pending.snapshot))
    if (id)
      setSelectedId(id)
  }, [cancel])

  const loading = records.loading ?? false
  useEffect(() => {
    if (loading)
      return
    pendingRef.current = { snapshot, id: latestRef.current.selectedId }
    timerRef.current = setTimeout(flush, 400)
    return () => {
      if (timerRef.current !== null)
        clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [snapshot, loading, flush])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden')
        flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      flush()
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [flush])

  return { flush, cancel }
}
