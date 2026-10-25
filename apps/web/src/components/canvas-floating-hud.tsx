import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import type { HudBounds, HudEdge, HudRect } from '@/lib/hud-geometry'
import { Frame, Move } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { fitHudRect, HUD_GAP, separateHudRect, updateHudRect, updateHudRectUntilObstacle } from '@/lib/hud-geometry'

const edges: { edge: HudEdge, label: string }[] = [
  { edge: 'n', label: '上边' },
  { edge: 'ne', label: '右上角' },
  { edge: 'e', label: '右边' },
  { edge: 'se', label: '右下角' },
  { edge: 's', label: '下边' },
  { edge: 'sw', label: '左下角' },
  { edge: 'w', label: '左边' },
  { edge: 'nw', label: '左上角' },
]

interface CanvasHudGeometry {
  workspaceSelector: string
  toolbarSelector: string
  otherHudSelector: string
  topPriority: boolean
  boundsBottomSelector?: string
  mobileTopInset?: number
}

function hudBounds(node: HTMLElement, geometry: CanvasHudGeometry): HudBounds {
  const root = node.closest(geometry.workspaceSelector) ?? node.parentElement!
  const rect = root.getBoundingClientRect()
  const mobile = rect.width <= 700
  const toolbar = root.querySelector(geometry.toolbarSelector)?.getBoundingClientRect()
  const lowerHud = !mobile && geometry.boundsBottomSelector ? root.querySelector(geometry.boundsBottomSelector)?.getBoundingClientRect() : null
  const left = mobile ? 12 : (toolbar ? toolbar.left - rect.left : 264)
  const top = mobile ? (geometry.mobileTopInset ?? 12) : (toolbar ? toolbar.bottom - rect.top + 8 : 60)
  const bottom = lowerHud ? Math.min(rect.height - 12, lowerHud.top - rect.top - 8) : rect.height - (mobile ? 60 : 12)
  return { left, top, right: Math.max(left + 1, rect.width - 12), bottom: Math.max(top + 1, bottom) }
}

function readHudRect(node: HTMLElement, geometry: CanvasHudGeometry): HudRect {
  const root = node.closest(geometry.workspaceSelector) ?? node.parentElement!
  const parent = root.getBoundingClientRect()
  const rect = node.getBoundingClientRect()
  return { x: rect.left - parent.left, y: rect.top - parent.top, width: rect.width, height: rect.height }
}

function otherHudRect(node: HTMLElement, geometry: CanvasHudGeometry): HudRect | null {
  const root = node.closest(geometry.workspaceSelector)
  if (!root || root.getBoundingClientRect().width <= 700)
    return null
  const other = root.querySelector<HTMLElement>(geometry.otherHudSelector)
  return other ? readHudRect(other, geometry) : null
}

function sameRect(a: HudRect, b: HudRect) {
  return Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5
    && Math.abs(a.width - b.width) < 0.5 && Math.abs(a.height - b.height) < 0.5
}

function constrainedHudRect(node: HTMLElement, rect: HudRect, bounds: HudBounds, geometry: CanvasHudGeometry, viewportResize = false): HudRect {
  let next = fitHudRect(rect, bounds)
  const other = otherHudRect(node, geometry)
  if (!other)
    return next
  if (viewportResize && bounds.right - bounds.left < next.width + other.width + HUD_GAP) {
    next = fitHudRect({
      ...next,
      y: geometry.topPriority ? bounds.top : next.y,
      height: Math.min(next.height, (bounds.bottom - bounds.top - HUD_GAP) / 2),
    }, bounds)
  }
  return geometry.topPriority ? next : separateHudRect(next, other, bounds)
}

function gestureHudRect(node: HTMLElement, base: HudRect, action: 'move' | HudEdge, dx: number, dy: number, bounds: HudBounds, geometry: CanvasHudGeometry): HudRect {
  const other = otherHudRect(node, geometry)
  return other
    ? updateHudRectUntilObstacle(base, action, dx, dy, bounds, other)
    : updateHudRect(base, action, dx, dy, bounds)
}

function releaseHudPointer(active: { owner: HTMLElement, pointerId: number } | null) {
  if (active?.owner.hasPointerCapture(active.pointerId))
    active.owner.releasePointerCapture(active.pointerId)
}

// Outer HUD gestures never change the logical stretch dimensions or output parameters.
// 外层 HUD 手势不改变内部拉伸逻辑尺寸，也不改变输出参数。
export function CanvasFloatingHud({ className, title, controls, children, workspaceSelector, toolbarSelector, otherHudSelector, topPriority, boundsBottomSelector, mobileTopInset }: { className: string, title: string, controls?: ReactNode, children: ReactNode } & CanvasHudGeometry) {
  const geometry = useMemo(() => ({ workspaceSelector, toolbarSelector, otherHudSelector, topPriority, boundsBottomSelector, mobileTopInset }), [boundsBottomSelector, mobileTopInset, otherHudSelector, toolbarSelector, topPriority, workspaceSelector])
  const hudRef = useRef<HTMLElement>(null)
  const [rect, setRect] = useState<HudRect | null>(null)
  const manuallyAdjustedRef = useRef(false)
  const dragRef = useRef<{ pointerId: number, owner: HTMLElement, x: number, y: number, base: HudRect, action: 'move' | HudEdge, bounds: HudBounds, obstacle: HudRect | null } | null>(null)
  const dragFrameRef = useRef(0)
  const resetFrameRef = useRef(0)

  useEffect(() => {
    const node = hudRef.current
    if (!node?.parentElement)
      return
    const root = node.closest(geometry.workspaceSelector)
    let previousMobile = (root ?? node.parentElement).getBoundingClientRect().width <= 700
    const reconcile = (viewportResize: boolean) => {
      if (dragRef.current)
        return
      const workspace = node.closest(geometry.workspaceSelector)
      if (viewportResize && workspace && workspace.getBoundingClientRect().width <= 700) {
        manuallyAdjustedRef.current = false
        setRect(null)
        return
      }
      const current = readHudRect(node, geometry)
      const next = constrainedHudRect(node, current, hudBounds(node, geometry), geometry, viewportResize)
      setRect((previous) => {
        if (previous && sameRect(previous, next))
          return previous
        if (!previous && sameRect(current, next))
          return null
        return next
      })
    }
    const observer = new ResizeObserver(() => {
      const active = dragRef.current
      dragRef.current = null
      cancelAnimationFrame(dragFrameRef.current)
      dragFrameRef.current = 0
      releaseHudPointer(active)
      const mobile = (root ?? node.parentElement!).getBoundingClientRect().width <= 700
      if (mobile !== previousMobile) {
        previousMobile = mobile
        manuallyAdjustedRef.current = false
        setRect(null)
        return
      }
      if (!manuallyAdjustedRef.current) {
        setRect(null)
        return
      }
      reconcile(true)
    })
    observer.observe(node.parentElement)
    const other = root?.querySelector<HTMLElement>(geometry.otherHudSelector)
    const siblingObserver = new MutationObserver(() => {
      if (dragRef.current || other?.dataset.hudCustom === 'true')
        return
      if (!manuallyAdjustedRef.current && other?.style.length === 0) {
        setRect(null)
        return
      }
      reconcile(false)
    })
    if (!geometry.topPriority && other)
      siblingObserver.observe(other, { attributes: true, attributeFilter: ['style'] })
    const rootObserver = new MutationObserver(() => reconcile(true))
    if (root)
      rootObserver.observe(root, { attributes: true, attributeFilter: ['class', 'style'] })
    return () => {
      observer.disconnect()
      siblingObserver.disconnect()
      rootObserver.disconnect()
      cancelAnimationFrame(resetFrameRef.current)
      cancelAnimationFrame(dragFrameRef.current)
      dragFrameRef.current = 0
      const active = dragRef.current
      dragRef.current = null
      releaseHudPointer(active)
    }
  }, [geometry])

  const begin = (event: PointerEvent<HTMLElement>, action: 'move' | HudEdge) => {
    if (event.button !== 0 || !event.isPrimary || !hudRef.current || dragRef.current)
      return
    const target = event.target as HTMLElement
    if (action === 'move' && target.closest('button, input, select, a') && !target.closest('[data-hud-drag]'))
      return
    event.preventDefault()
    event.stopPropagation()
    const bounds = hudBounds(hudRef.current, geometry)
    const base = fitHudRect(readHudRect(hudRef.current, geometry), bounds)
    const obstacle = otherHudRect(hudRef.current, geometry)
    cancelAnimationFrame(resetFrameRef.current)
    dragRef.current = { pointerId: event.pointerId, owner: event.currentTarget, x: event.clientX, y: event.clientY, base, action, bounds, obstacle }
    setRect(base)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const end = (event: PointerEvent<HTMLElement>) => {
    const active = dragRef.current
    if (!active || active.pointerId !== event.pointerId)
      return
    dragRef.current = null
    cancelAnimationFrame(dragFrameRef.current)
    dragFrameRef.current = 0
    setRect(active.base)
    releaseHudPointer(active)
  }

  const keyboard = (event: KeyboardEvent<HTMLElement>, action: 'move' | HudEdge) => {
    if (!hudRef.current || event.altKey || event.ctrlKey || event.metaKey)
      return
    const step = event.shiftKey ? 32 : 8
    const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key]
    if (!delta)
      return
    event.preventDefault()
    event.stopPropagation()
    manuallyAdjustedRef.current = true
    const bounds = hudBounds(hudRef.current, geometry)
    const current = readHudRect(hudRef.current, geometry)
    setRect(gestureHudRect(hudRef.current, current, action, delta[0], delta[1], bounds, geometry))
  }

  return (
    <section
      ref={hudRef}
      className={`canvas-floating-hud ${className}`}
      aria-label={title}
      data-hud-custom={Boolean(rect)}
      style={rect ? { left: rect.x, top: rect.y, width: rect.width, height: rect.height, right: 'auto', bottom: 'auto', maxWidth: 'none' } : undefined}
      onPointerMove={(event) => {
        const active = dragRef.current
        if (!active || active.pointerId !== event.pointerId || !hudRef.current)
          return
        event.preventDefault()
        manuallyAdjustedRef.current = true
        const dx = event.clientX - active.x
        const dy = event.clientY - active.y
        active.base = active.obstacle
          ? updateHudRectUntilObstacle(active.base, active.action, dx, dy, active.bounds, active.obstacle)
          : updateHudRect(active.base, active.action, dx, dy, active.bounds)
        active.x = event.clientX
        active.y = event.clientY
        if (!dragFrameRef.current) {
          dragFrameRef.current = requestAnimationFrame(() => {
            dragFrameRef.current = 0
            if (dragRef.current)
              setRect(dragRef.current.base)
          })
        }
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      <header onPointerDown={event => begin(event, 'move')}>
        <h2>{title}</h2>
        {controls}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={!rect}
          title="重置 HUD 位置与大小"
          aria-label={`重置${title} HUD 位置与大小`}
          onClick={() => {
            const active = dragRef.current
            dragRef.current = null
            cancelAnimationFrame(dragFrameRef.current)
            dragFrameRef.current = 0
            manuallyAdjustedRef.current = false
            releaseHudPointer(active)
            setRect(null)
            cancelAnimationFrame(resetFrameRef.current)
            resetFrameRef.current = requestAnimationFrame(() => {
              const node = hudRef.current
              if (!node)
                return
              const current = readHudRect(node, geometry)
              const next = constrainedHudRect(node, current, hudBounds(node, geometry), geometry)
              if (!sameRect(current, next))
                setRect(next)
            })
          }}
        >
          <Frame />
        </Button>
        <button type="button" className="canvas-hud-drag" data-hud-drag aria-label={`移动${title} HUD`} title="拖动移动 HUD；方向键微调，Shift 加速" onKeyDown={event => keyboard(event, 'move')}>
          <Move />
        </button>
      </header>
      {children}
      {edges.map(({ edge, label }) => (
        <button
          key={edge}
          type="button"
          className="canvas-hud-resize"
          data-hud-resize={edge}
          title={`拖动${label}调整 HUD 大小；右下手柄支持方向键微调，Shift 加速`}
          tabIndex={edge === 'se' ? 0 : -1}
          aria-label={`调整 HUD 大小：${label}`}
          onPointerDown={event => begin(event, edge)}
          onKeyDown={edge === 'se' ? event => keyboard(event, edge) : undefined}
        />
      ))}
    </section>
  )
}
