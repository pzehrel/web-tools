import type { ReactNode } from 'react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

import { Button } from './button'

interface PopConfirmProps {
  trigger: ReactNode
  triggerAriaLabel: string
  triggerTitle?: string
  triggerClassName?: string
  title: string
  description?: string
  confirmLabel?: string
  onConfirm: () => void
}

/** 锚定在操作按钮旁的轻量二次确认，优先向上展开，空间不足时自动翻到下方。 */
function PopConfirm({
  trigger,
  triggerAriaLabel,
  triggerTitle,
  triggerClassName,
  title,
  description,
  confirmLabel = '删除',
  onConfirm,
}: PopConfirmProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const dialogId = useId()
  const titleId = useId()
  const descriptionId = useId()

  useLayoutEffect(() => {
    if (!open)
      return
    const triggerElement = triggerRef.current
    const panelElement = panelRef.current
    if (!triggerElement || !panelElement)
      return

    const gap = 8
    const edge = 8
    const triggerRect = triggerElement.getBoundingClientRect()
    const panelRect = panelElement.getBoundingClientRect()
    const left = Math.min(
      window.innerWidth - panelRect.width - edge,
      Math.max(edge, triggerRect.right - panelRect.width),
    )
    const above = triggerRect.top - panelRect.height - gap
    const top = above >= edge
      ? above
      : Math.min(window.innerHeight - panelRect.height - edge, triggerRect.bottom + gap)

    panelElement.style.left = `${left}px`
    panelElement.style.top = `${top}px`
    panelElement.style.visibility = 'visible'
  }, [open])

  useEffect(() => {
    if (!open)
      return

    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target))
        setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    const close = () => setOpen(false)

    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        title={triggerTitle}
        aria-label={triggerAriaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={() => setOpen(value => !value)}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={dialogId}
          ref={panelRef}
          role="alertdialog"
          aria-modal="false"
          aria-labelledby={titleId}
          aria-describedby={description ? descriptionId : undefined}
          className="fixed z-[80] w-64 max-w-[calc(100vw-1rem)] rounded-md border-2 border-border bg-popover p-3 text-popover-foreground shadow-hard-sm invisible"
        >
          <p id={titleId} className="text-sm font-black">{title}</p>
          {description && <p id={descriptionId} className="mt-1 text-xs text-muted-foreground">{description}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" autoFocus onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => {
                setOpen(false)
                onConfirm()
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export { PopConfirm }
