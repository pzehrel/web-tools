import type { Dispatch, SetStateAction } from 'react'
import { Palette, Scan } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'

import { Button } from '@/components/ui/button'
import { CHECKER_PALETTES, checkerBackground } from '@/lib/checker'
import { cn } from '@/lib/utils'

type StageBackground = 'checker' | 'solid'

export const STAGE_BOUNDARY_CLASS = 'outline-2 outline-dashed outline-primary -outline-offset-2'

export interface StageViewSettings {
  background: string
  backgroundOpen: boolean
  checkerBackground: string
  checkerIndex: number
  isDark: boolean
  setBackgroundOpen: Dispatch<SetStateAction<boolean>>
  setCheckerIndex: Dispatch<SetStateAction<number>>
  setShowBounds: Dispatch<SetStateAction<boolean>>
  setSolidIndex: Dispatch<SetStateAction<number>>
  setStageBackground: Dispatch<SetStateAction<StageBackground>>
  showBounds: boolean
  solidIndex: number
  stageBackground: StageBackground
}

function subscribeDarkClass(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

function readIsDark(): boolean {
  return document.documentElement.classList.contains('dark')
}

function useIsDarkTheme(): boolean {
  return useSyncExternalStore(subscribeDarkClass, readIsDark, () => false)
}

export function useStageViewSettings(): StageViewSettings {
  const [stageBackground, setStageBackground] = useState<StageBackground>('checker')
  const [backgroundOpen, setBackgroundOpen] = useState(false)
  const [checkerIndex, setCheckerIndex] = useState(0)
  const [solidIndex, setSolidIndex] = useState(0)
  const [showBounds, setShowBounds] = useState(true)
  const isDark = useIsDarkTheme()
  const checkerColors = isDark ? CHECKER_PALETTES[checkerIndex].dark : CHECKER_PALETTES[checkerIndex].light
  const solidColor = isDark ? CHECKER_PALETTES[solidIndex].dark.a : CHECKER_PALETTES[solidIndex].light.a
  const currentCheckerBackground = checkerBackground(checkerColors.a, checkerColors.b)

  return {
    background: stageBackground === 'checker' ? currentCheckerBackground : solidColor,
    backgroundOpen,
    checkerBackground: currentCheckerBackground,
    checkerIndex,
    isDark,
    setBackgroundOpen,
    setCheckerIndex,
    setShowBounds,
    setSolidIndex,
    setStageBackground,
    showBounds,
    solidIndex,
    stageBackground,
  }
}

export function StageViewControls({ hasContent, settings }: { hasContent: boolean, settings: StageViewSettings }) {
  if (!hasContent)
    return null

  const activePalette = settings.stageBackground === 'checker' ? settings.checkerIndex : settings.solidIndex

  return (
    <>
      <div className="absolute top-2 left-2 z-30 flex gap-1.5">
        <Button
          type="button"
          variant={settings.showBounds ? 'default' : 'outline'}
          size="icon-sm"
          title={`${settings.showBounds ? '隐藏' : '显示'}边界（仅影响画布查看，不影响导出）`}
          aria-label={`${settings.showBounds ? '隐藏' : '显示'}边界`}
          aria-pressed={settings.showBounds}
          data-stage-boundary-toggle
          onClick={() => settings.setShowBounds(value => !value)}
        >
          <Scan />
        </Button>
        <Button
          type="button"
          variant={settings.backgroundOpen ? 'secondary' : 'outline'}
          size="icon-sm"
          title="画布背景"
          aria-label="画布背景"
          aria-expanded={settings.backgroundOpen}
          data-stage-background-toggle
          onClick={() => settings.setBackgroundOpen(value => !value)}
        >
          <Palette />
        </Button>
      </div>
      {settings.backgroundOpen && (
        <div
          className="absolute top-12 left-2 z-30 w-56 rounded-md border border-border bg-background/95 p-2"
          role="dialog"
          aria-label="画布背景设置"
          data-stage-background-panel
        >
          <div className="flex overflow-hidden rounded-md border border-border" role="radiogroup" aria-label="画布背景">
            {([
              ['checker', '棋盘格'],
              ['solid', '纯色'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={settings.stageBackground === value}
                onClick={() => settings.setStageBackground(value)}
                className={cn(
                  'flex flex-1 items-center justify-center px-1 py-1.5 text-xs font-bold whitespace-nowrap transition-colors',
                  settings.stageBackground === value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-secondary',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className="mt-2 grid grid-cols-6 items-center gap-2"
            role="radiogroup"
            aria-label={settings.stageBackground === 'checker' ? '棋盘配色' : '纯色配色'}
          >
            {CHECKER_PALETTES.map((palette, index) => {
              const colors = settings.isDark ? palette.dark : palette.light
              return (
                <button
                  key={palette.name}
                  type="button"
                  role="radio"
                  aria-checked={activePalette === index}
                  title={palette.name}
                  aria-label={palette.name}
                  onClick={() => {
                    if (settings.stageBackground === 'checker')
                      settings.setCheckerIndex(index)
                    else
                      settings.setSolidIndex(index)
                  }}
                  className={cn(
                    'aspect-square w-full rounded-sm border-2 transition-colors duration-150',
                    activePalette === index
                      ? 'border-primary ring-2 ring-ring/50'
                      : 'border-border hover:border-foreground',
                  )}
                  style={{ background: settings.stageBackground === 'checker' ? checkerBackground(colors.a, colors.b) : colors.a }}
                />
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
