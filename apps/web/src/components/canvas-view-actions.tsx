import type { StageViewSettings } from '@/components/stage-view-controls'
import { RotateCcw } from 'lucide-react'
import { StageViewControls } from '@/components/stage-view-controls'
import { Button } from '@/components/ui/button'

interface CanvasViewActionsProps {
  className: string
  hasContent: boolean
  settings: StageViewSettings
  onReset: () => void
  resetLabel: string
  resetTitle?: string
  resetVariant?: 'ghost' | 'outline'
  resetClassName?: string
}

export function CanvasViewActions({ className, hasContent, settings, onReset, resetLabel, resetTitle = resetLabel, resetVariant = 'ghost', resetClassName }: CanvasViewActionsProps) {
  return (
    <div className={className} aria-label="画布视图">
      <Button
        type="button"
        variant={resetVariant}
        size="icon-sm"
        className={resetClassName}
        title={resetTitle}
        aria-label={resetLabel}
        disabled={!hasContent}
        onClick={onReset}
      >
        <RotateCcw />
      </Button>
      <StageViewControls hasContent={hasContent} settings={settings} />
    </div>
  )
}
