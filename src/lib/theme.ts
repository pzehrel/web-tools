import { useCallback, useEffect, useState } from 'react'

/** 主题偏好：跟随系统 / 强制浅色 / 强制深色 */
export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'web-tools:theme'
const MEDIA_QUERY = '(prefers-color-scheme: dark)'

function load(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark' || raw === 'system')
      return raw
  }
  catch {
    // localStorage 不可用时按系统主题处理
  }
  return 'system'
}

/**
 * 全局主题：偏好存 localStorage，system 时跟随 prefers-color-scheme 并监听变化。
 * 实际生效的 .dark class 挂在 <html> 上，与 src/index.scss 的 .dark 色板对应。
 */
export function useTheme() {
  const [theme, setTheme] = useState<ThemePreference>(load)

  useEffect(() => {
    const media = window.matchMedia(MEDIA_QUERY)
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', dark)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  const updateTheme = useCallback((next: ThemePreference) => {
    setTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    }
    catch {
      // 存储不可用时仅本次会话生效
    }
  }, [])

  return { theme, setTheme: updateTheme }
}
