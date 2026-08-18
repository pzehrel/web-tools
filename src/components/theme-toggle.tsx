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
 * 全局主题切换：跟随系统 / 浅色 / 深色，位于页面右上角并随页面滚动；
 * top-7 + h-10 与各页 h-24 的 header 中线对齐（28 + 20 = 48 = 96 / 2）；
 * 横向用与页面相同的版心容器（max-w-5xl + px-4）右对齐，而非贴视口边缘
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    // 主题偏好存在 localStorage，SSG 与客户端首渲必然不同，仅客户端渲染
    <ClientOnly>
      {() => (
        <div className="pointer-events-none absolute inset-x-0 top-7 z-50">
          <div className="mx-auto flex max-w-5xl justify-end px-4">
            <div
              role="radiogroup"
              aria-label="主题"
              className="pointer-events-auto flex h-10 overflow-hidden rounded-md border-2 border-border bg-card shadow-hard-sm"
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
          </div>
        </div>
      )}
    </ClientOnly>
  )
}
