import type { ThemePreference } from '@/lib/theme'
import { Monitor, Moon, Sun } from 'lucide-react'
import { ClientOnly } from 'vite-react-ssg'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/utils'

const OPTIONS: { value: ThemePreference, label: string, icon: typeof Sun }[] = [
  { value: 'system', label: '跟随系统', icon: Monitor },
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    // Render stored preference after hydration to keep the static and initial client trees aligned.
    // 水合后再显示已存偏好，保证静态页面与客户端首棵树一致。
    <ClientOnly>
      {() => (
        <div
          role="radiogroup"
          aria-label="主题"
          className="theme-toggle"
          onKeyDown={(event) => {
            const index = OPTIONS.findIndex(option => option.value === theme)
            let next = index
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
              next = (index + 1) % OPTIONS.length
            else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
              next = (index + OPTIONS.length - 1) % OPTIONS.length
            else if (event.key === 'Home')
              next = 0
            else if (event.key === 'End')
              next = OPTIONS.length - 1
            else
              return
            event.preventDefault()
            setTheme(OPTIONS[next].value)
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus()
          }}
        >
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              tabIndex={theme === value ? 0 : -1}
              title={label}
              aria-label={label}
              onClick={() => setTheme(value)}
              className={cn(
                'site-icon-action',
                theme === value
                  ? 'bg-secondary text-secondary-foreground'
                  : 'text-muted-foreground',
              )}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
      )}
    </ClientOnly>
  )
}
