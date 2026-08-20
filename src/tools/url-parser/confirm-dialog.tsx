import { useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description: string
  /** 确认按钮文案，如「删除」「清空」 */
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}

/** 二次确认弹窗：原生 <dialog> 实现，用于删除 / 清空等不可撤销操作 */
export function ConfirmDialog({ open, title, description, confirmLabel, onConfirm, onClose }: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog)
      return
    if (open) {
      if (!dialog.open)
        dialog.showModal()
    }
    else if (dialog.open) {
      dialog.close()
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      // Esc 关闭时同步外部状态
      onClose={onClose}
      // 点击描边 / 背板区域（事件目标是 dialog 本身）时关闭
      onClick={e => e.target === dialogRef.current && onClose()}
      className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-lg border-2 border-border bg-popover p-5 text-popover-foreground shadow-hard-lg backdrop:bg-black/50"
    >
      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onConfirm()
            onClose()
          }}
        >
          <h2 className="text-base font-black tracking-tight">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              取消
            </Button>
            <Button type="submit" variant="destructive" size="sm">
              {confirmLabel}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  )
}
