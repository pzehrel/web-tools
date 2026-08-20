import { Outlet } from 'react-router'
import { SiteActions } from '@/components/site-actions'

/** 全局布局：页面出口 + 右上角站点操作 */
export function RootLayout() {
  return (
    <>
      <Outlet />
      <SiteActions />
    </>
  )
}
