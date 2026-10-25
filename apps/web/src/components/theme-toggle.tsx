import type { ThemePreference } from '@/lib/theme'
import { Monitor, Moon, Sun } from 'lucide-react'
import { ClientOnly } from 'vite-react-ssg'
import { useTheme } from '@/lib/theme'

const OPTIONS: { value: ThemePreference, label: string, icon: typeof Sun }[] = [
  { value: 'system', label: '跟随系统', icon: Monitor },
  { value: 'light', label: '浅色', icon: Sun },
  { value: 'dark', label: '深色', icon: Moon },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const index = OPTIONS.findIndex(option => option.value === theme)
  const current = OPTIONS[index]
  const next = OPTIONS[(index + 1) % OPTIONS.length]
  const Icon = current.icon
  const description = `当前主题：${current.label}；点击切换为${next.label}`

  return (
    // Render stored preference after hydration to keep the static and initial client trees aligned.
    // 水合后再显示已存偏好，保证静态页面与客户端首棵树一致。
    <ClientOnly>
      {() => (
        <button
          type="button"
          aria-label={description}
          title={description}
          onClick={() => setTheme(next.value)}
          className="site-icon-action text-muted-foreground"
        >
          <Icon className="size-3.5" aria-hidden="true" />
        </button>
      )}
    </ClientOnly>
  )
}
