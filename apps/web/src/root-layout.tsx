import { Outlet } from 'react-router'
import { SiteHeader } from '@/components/site-header'
import './site-layout.scss'

export function RootLayout() {
  return (
    <>
      <SiteHeader />
      <Outlet />
    </>
  )
}
