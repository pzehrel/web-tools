import { cn } from '@/lib/utils'

interface StageZoomIndicatorProps {
  visible: boolean
  zoom: number
}

export function StageZoomIndicator({ visible, zoom }: StageZoomIndicatorProps) {
  return (
    <span
      aria-hidden="true"
      data-stage-zoom-indicator
      className={cn(
        'pointer-events-none absolute bottom-2 left-2 z-20 rounded-sm border-2 border-border bg-background/90 px-2 py-0.5 font-mono text-[10px] font-black shadow-hard-xs transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0',
      )}
    >
      {Math.round(zoom * 100)}
      %
    </span>
  )
}
