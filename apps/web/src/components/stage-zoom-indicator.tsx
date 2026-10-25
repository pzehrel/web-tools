import { cn } from '@/lib/utils'

interface StageZoomIndicatorProps {
  placement?: 'canvas' | 'workspace'
  visible: boolean
  zoom: number
}

export function StageZoomIndicator({ placement = 'canvas', visible, zoom }: StageZoomIndicatorProps) {
  return (
    <span
      aria-hidden="true"
      data-stage-zoom-indicator
      className={cn(
        'pointer-events-none rounded-sm border border-border bg-background/90 px-2 py-0.5 font-mono text-[10px] font-medium tabular-nums transition-opacity duration-300',
        placement === 'canvas' ? 'absolute bottom-2 left-2 z-20' : 'canvas-workspace-zoom',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      {Math.round(zoom * 100)}
      %
    </span>
  )
}
