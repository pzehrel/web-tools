import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import type { HudBounds, HudEdge, HudRect } from './hud-geometry'
import { Frame, Move } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { fitHudRect, updateHudRect } from './hud-geometry'

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

function hudBounds(node: HTMLElement): HudBounds {
  const root = node.closest('.nine-patch-workspace') ?? node.parentElement!
  const rect = root.getBoundingClientRect()
  const mobile = rect.width <= 700
  const toolbar = root.querySelector('.nine-toolbar')?.getBoundingClientRect()
  const left = mobile ? 12 : (toolbar ? toolbar.left - rect.left : 264)
  const top = mobile ? 12 : (toolbar ? toolbar.bottom - rect.top + 8 : 60)
  return { left, top, right: Math.max(left + 1, rect.width - 12), bottom: Math.max(top + 1, rect.height - (mobile ? 60 : 12)) }
}

function readHudRect(node: HTMLElement): HudRect {
  const root = node.closest('.nine-patch-workspace') ?? node.parentElement!
  const parent = root.getBoundingClientRect()
  const rect = node.getBoundingClientRect()
  return { x: rect.left - parent.left, y: rect.top - parent.top, width: rect.width, height: rect.height }
}

function releaseHudPointer(active: { owner: HTMLElement, pointerId: number } | null) {
  if (active?.owner.hasPointerCapture(active.pointerId))
    active.owner.releasePointerCapture(active.pointerId)
}

// Outer HUD gestures never change the logical stretch dimensions or output parameters.
// 外层 HUD 手势不改变内部拉伸逻辑尺寸，也不改变输出参数。
export function NineFloatingHud({ className, title, controls, children }: { className: string, title: string, controls?: ReactNode, children: ReactNode }) {
  const hudRef = useRef<HTMLElement>(null)
  const [rect, setRect] = useState<HudRect | null>(null)
  const dragRef = useRef<{ pointerId: number, owner: HTMLElement, x: number, y: number, base: HudRect, action: 'move' | HudEdge } | null>(null)

  useEffect(() => {
    const node = hudRef.current
    if (!node?.parentElement)
      return
    const observer = new ResizeObserver(() => {
      const active = dragRef.current
      dragRef.current = null
      releaseHudPointer(active)
      const bounds = hudBounds(node)
      setRect(current => current ? fitHudRect(current, bounds) : null)
    })
    observer.observe(node.parentElement)
    return () => {
      observer.disconnect()
      const active = dragRef.current
      dragRef.current = null
      releaseHudPointer(active)
    }
  }, [])

  const begin = (event: PointerEvent<HTMLElement>, action: 'move' | HudEdge) => {
    if (event.button !== 0 || !event.isPrimary || !hudRef.current || dragRef.current)
      return
    const target = event.target as HTMLElement
    if (action === 'move' && target.closest('button, input, select, a') && !target.closest('[data-hud-drag]'))
      return
    event.preventDefault()
    event.stopPropagation()
    const base = fitHudRect(readHudRect(hudRef.current), hudBounds(hudRef.current))
    dragRef.current = { pointerId: event.pointerId, owner: event.currentTarget, x: event.clientX, y: event.clientY, base, action }
    setRect(base)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const end = (event: PointerEvent<HTMLElement>) => {
    const active = dragRef.current
    if (!active || active.pointerId !== event.pointerId)
      return
    dragRef.current = null
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
    const bounds = hudBounds(hudRef.current)
    const current = readHudRect(hudRef.current)
    setRect(updateHudRect(current, action, delta[0], delta[1], bounds))
  }

  return (
    <section
      ref={hudRef}
      className={className}
      aria-label={title}
      data-hud-custom={Boolean(rect)}
      style={rect ? { left: rect.x, top: rect.y, width: rect.width, height: rect.height, right: 'auto', bottom: 'auto', maxWidth: 'none' } : undefined}
      onPointerMove={(event) => {
        const active = dragRef.current
        if (!active || active.pointerId !== event.pointerId || !hudRef.current)
          return
        event.preventDefault()
        setRect(updateHudRect(active.base, active.action, event.clientX - active.x, event.clientY - active.y, hudBounds(hudRef.current)))
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      <header onPointerDown={event => begin(event, 'move')}>
        <h2>
          <button type="button" className="nine-hud-drag" data-hud-drag aria-label={`移动${title} HUD`} title="拖动移动 HUD；方向键微调，Shift 加速" onKeyDown={event => keyboard(event, 'move')}>
            <Move />
            {title}
          </button>
        </h2>
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
            releaseHudPointer(active)
            setRect(null)
          }}
        >
          <Frame />
        </Button>
      </header>
      {children}
      {edges.map(({ edge, label }) => (
        <button
          key={edge}
          type="button"
          className="nine-hud-resize"
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
