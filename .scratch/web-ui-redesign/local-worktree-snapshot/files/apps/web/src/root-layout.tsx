import { lazy, Suspense } from 'react'
import { Outlet, useLocation } from 'react-router'
import { SiteActions } from '@/components/site-actions'

// Load throwaway variants only in development; production keeps the normal outlet.
// 仅在开发模式载入临时原型；生产环境保留正常页面出口。
const UiPrototype = import.meta.env.DEV ? lazy(() => import('./ui-redesign.prototype')) : null

/** 全局布局：页面出口 + 右上角站点操作 */
export function RootLayout() {
  const location = useLocation()
  if (UiPrototype && new URLSearchParams(location.search).has('variant')) {
    return (
      <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">正在打开设计原型…</div>}>
        <UiPrototype />
      </Suspense>
    )
  }

  return (
    <>
      <Outlet />
      <SiteActions />
    </>
  )
}
