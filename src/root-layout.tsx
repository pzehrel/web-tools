import { Outlet } from 'react-router'
import { ThemeToggle } from '@/components/theme-toggle'

/** 全局布局：页面出口 + 主题切换 */
export function RootLayout() {
  return (
    <>
      <Outlet />
      <ThemeToggle />
    </>
  )
}
