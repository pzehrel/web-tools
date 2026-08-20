import { Outlet } from 'react-router'
import { SiteFooter } from '@/components/site-footer'
import { ThemeToggle } from '@/components/theme-toggle'

/** 全局布局：页面出口 + 主题切换 + 页脚 */
export function RootLayout() {
  return (
    <>
      <Outlet />
      <ThemeToggle />
      <SiteFooter />
    </>
  )
}
