import type { LucideIcon } from 'lucide-react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useRef } from 'react'
import { cn } from '@/lib/utils'

interface CanvasOption<T extends string | number> {
  value: T
  label: ReactNode
  icon?: LucideIcon
}

export function CanvasOptionGroup<T extends string | number>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T
  options: CanvasOption<T>[]
  onChange: (value: T) => void
  label: string
  className?: string
}) {
  const buttonsRef = useRef<(HTMLButtonElement | null)[]>([])

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = (index + 1) % options.length
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = (index - 1 + options.length) % options.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = options.length - 1
        break
      default:
        return
    }
    event.preventDefault()
    onChange(options[nextIndex].value)
    buttonsRef.current[nextIndex]?.focus()
  }

  return (
    <div className={cn('flex overflow-hidden rounded-md border border-border', className)} role="radiogroup" aria-label={label}>
      {options.map((opt, index) => {
        const Icon = opt.icon
        return (
          <button
            key={String(opt.value)}
            ref={(node) => { buttonsRef.current[index] = node }}
            type="button"
            role="radio"
            aria-checked={value === opt.value}
            tabIndex={value === opt.value ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={event => handleKeyDown(event, index)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 px-1 py-1.5 text-xs font-medium whitespace-nowrap transition-colors',
              value === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-background hover:bg-secondary',
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
