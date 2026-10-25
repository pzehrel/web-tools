import type { RefObject } from 'react'
import { useEffect } from 'react'

interface CanvasLayoutObserverOptions {
  areaRef: RefObject<HTMLElement | null>
  emptyStateRef?: RefObject<HTMLElement | null>
  workspaceSelector: string
  hudSelector: string
  workspaceAttributes?: readonly string[]
  onChange: () => void
}

/**
 * Recalculate the safe canvas layout when its stage or fixed HUD geometry changes.
 * 舞台、空状态或固定 HUD 的几何变化会更新布局；浮动 HUD 不移动当前内容。
 */
export function useCanvasLayoutObserver({
  areaRef,
  emptyStateRef,
  workspaceSelector,
  hudSelector,
  workspaceAttributes = [],
  onChange,
}: CanvasLayoutObserverOptions): void {
  const workspaceAttributeKey = workspaceAttributes.join('\0')

  useEffect(() => {
    const area = areaRef.current
    if (!area)
      return

    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(onChange)
    }
    const resizeObserver = new ResizeObserver(update)
    const mutationObserver = new MutationObserver(update)
    resizeObserver.observe(area)
    if (emptyStateRef?.current)
      resizeObserver.observe(emptyStateRef.current)

    const workspace = area.closest(workspaceSelector)
    if (workspace) {
      workspace.querySelectorAll<HTMLElement>(hudSelector).forEach((hud) => {
        if (hud.classList.contains('canvas-floating-hud'))
          return
        resizeObserver.observe(hud)
        mutationObserver.observe(hud, { attributes: true, attributeFilter: ['style'] })
      })
      if (workspaceAttributeKey) {
        mutationObserver.observe(workspace, {
          attributes: true,
          attributeFilter: workspaceAttributeKey.split('\0'),
        })
      }
    }

    return () => {
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [areaRef, emptyStateRef, workspaceSelector, hudSelector, workspaceAttributeKey, onChange])
}
