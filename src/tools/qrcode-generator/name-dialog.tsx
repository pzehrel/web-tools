import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'

interface NameDialogProps {
  open: boolean
  title: string
  /** 弹窗打开时的初始名称（重命名时回填） */
  initialName?: string
  onSubmit: (name: string) => void
  onClose: () => void
}

/** 命名弹窗：原生 <dialog> 实现，名称为可选项，留空也可以提交 */
export function NameDialog({ open, title, initialName = '', onSubmit, onClose }: NameDialogProps) {
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
      {/* 打开时才挂载表单，用初始值初始化名称，关闭即重置 */}
      {open && (
        <NameForm
          title={title}
          initialName={initialName}
          onSubmit={onSubmit}
          onClose={onClose}
        />
      )}
    </dialog>
  )
}

interface NameFormProps {
  title: string
  initialName: string
  onSubmit: (name: string) => void
  onClose: () => void
}

function NameForm({ title, initialName, onSubmit, onClose }: NameFormProps) {
  const [name, setName] = useState(initialName)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit(name.trim())
        onClose()
      }}
    >
      <h2 className="text-base font-black tracking-tight">{title}</h2>
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="名称（可选）"
        maxLength={30}
        className="mt-4 h-9 w-full rounded-md border-2 border-border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          取消
        </Button>
        <Button type="submit" size="sm">
          确定
        </Button>
      </div>
    </form>
  )
}
