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

/**
 * 全局主题切换：跟随系统 / 浅色 / 深色。
 * 外层位置由 SiteActions 统一管理。
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    // 主题偏好存在 localStorage，SSG 与客户端首渲必然不同，仅客户端渲染
    <ClientOnly>
      {() => (
        <div
          role="radiogroup"
          aria-label="主题"
          className="flex h-10 overflow-hidden rounded-md border-2 border-border bg-card shadow-hard-sm"
        >
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              title={label}
              onClick={() => setTheme(value)}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 px-2.5 text-xs font-bold transition-colors',
                'not-last:border-r-2 not-last:border-border',
                theme === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-secondary hover:text-foreground',
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
