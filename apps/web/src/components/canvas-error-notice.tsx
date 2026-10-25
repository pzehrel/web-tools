import { TriangleAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function CanvasErrorNotice({ message, onDismiss }: { message: string, onDismiss: () => void }) {
  return (
    <div className="canvas-error-region">
      <div className="canvas-error-notice" role="alert">
        <TriangleAlert className="size-4 shrink-0 text-destructive" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">处理失败</p>
          <p className="mt-1 break-words text-muted-foreground">{message}</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="关闭错误提示" onClick={onDismiss}>
          <X />
        </Button>
      </div>
    </div>
  )
}
