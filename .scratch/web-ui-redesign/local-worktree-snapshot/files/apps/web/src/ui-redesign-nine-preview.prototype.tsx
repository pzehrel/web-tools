/**
 * Throwaway stretch preview: resize independently from the source canvas.
 * 临时拉伸预览：独立调整预览尺寸，不改变源图、切片或画布视图。
 */
import type { KeyboardEvent, PointerEvent } from 'react'
import { RotateCcw, ScanLine } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

type Edge = 'e' | 's' | 'se'

export function NineStretchPreview({ asset, bounds, width, onWidthChange }: {
  asset: string
  bounds: number[]
  width: number
  onWidthChange: (width: number) => void
}) {
  const [viewport, setViewport] = useState(() => ({ width: window.innerWidth, height: window.innerHeight }))
  const [height, setHeight] = useState(() => window.innerWidth <= 700 ? 100 : 160)
  const dragRef = useRef<{ x: number, y: number, width: number, height: number, edge: Edge } | null>(null)
  const mobile = viewport.width <= 700
  const maxWidth = Math.max(120, Math.min(640, viewport.width - (mobile ? 56 : 340)))
  const maxHeight = Math.max(64, Math.min(mobile ? 140 : 400, viewport.height - 220))
  const shownWidth = Math.min(width, maxWidth)
  const shownHeight = Math.min(height, maxHeight)
  const resize = (nextWidth: number, nextHeight: number) => {
    onWidthChange(Math.round(Math.max(120, Math.min(maxWidth, nextWidth))))
    setHeight(Math.round(Math.max(64, Math.min(maxHeight, nextHeight))))
  }
  const reset = () => resize(300, mobile ? 100 : 160)

  useEffect(() => {
    const update = () => setViewport({ width: window.innerWidth, height: window.innerHeight })
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  useEffect(() => {
    if (width > maxWidth)
      onWidthChange(maxWidth)
  }, [width, maxWidth, onWidthChange])

  const start = (event: PointerEvent<HTMLButtonElement>, edge: Edge) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, width: shownWidth, height: shownHeight, edge }
  }
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const current = dragRef.current
    if (!current)
      return
    event.stopPropagation()
    resize(
      current.width + (current.edge !== 's' ? event.clientX - current.x : 0),
      current.height + (current.edge !== 'e' ? event.clientY - current.y : 0),
    )
  }
  const stop = (event: PointerEvent<HTMLButtonElement>) => {
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const keyboardResize = (event: KeyboardEvent<HTMLButtonElement>, edge: Edge) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key))
      return
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Home') {
      reset()
      return
    }
    const step = event.shiftKey ? 10 : 1
    resize(
      shownWidth + (edge !== 's' ? (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0) : 0),
      shownHeight + (edge !== 'e' ? (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0) : 0),
    )
  }

  return (
    <aside className="floating-nine-preview" aria-label="拉伸预览">
      <header>
        <h2>
          <ScanLine size={14} />
          拉伸预览
        </h2>
        <output aria-label="预览尺寸">{`${shownWidth} × ${shownHeight}`}</output>
        <Button variant="ghost" size="icon-sm" aria-label="重置预览尺寸" onClick={reset}><RotateCcw size={14} /></Button>
      </header>
      <div className="nine-stretch-area">
        <div
          className={`nine-stretch-box ${asset ? 'has-asset' : 'is-demo'}`}
          style={{ width: shownWidth, height: shownHeight }}
        >
          <div
            className="nine-stretch-render"
            style={asset
              ? {
                  borderStyle: 'solid',
                  borderColor: 'transparent',
                  borderWidth: 24,
                  borderImage: `url("${asset}") ${bounds.join(' ')} fill / ${bounds.map(value => `${value}px`).join(' ')} stretch`,
                }
              : undefined}
          >
            {!asset && <span>内容随容器拉伸</span>}
          </div>
          {(['e', 's', 'se'] as const).map(edge => (
            <button
              key={edge}
              type="button"
              className={`nine-resize-handle edge-${edge}`}
              aria-label={edge === 'e' ? '调整预览宽度' : edge === 's' ? '调整预览高度' : '调整预览尺寸'}
              title="拖拽调整；方向键微调，Shift 加速"
              onPointerDown={event => start(event, edge)}
              onPointerMove={move}
              onPointerUp={stop}
              onPointerCancel={stop}
              onLostPointerCapture={() => { dragRef.current = null }}
              onKeyDown={event => keyboardResize(event, edge)}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}
