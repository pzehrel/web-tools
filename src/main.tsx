import type { DataRouteObject, DOMRouterOpts, HydrationState } from 'react-router'
import { createBrowserRouter } from 'react-router'
import { ViteReactSSG } from 'vite-react-ssg'
import App from './App.tsx'
import { RootLayout } from './root-layout.tsx'
import QrCodeTool from './tools/qrcode-generator'
import UrlParserTool from './tools/url-parser'
import './index.scss'

export const createRoot = ViteReactSSG({
  routes: [
    {
      element: <RootLayout />,
      children: [
        { path: '/', element: <App /> },
        { path: '/tools/qrcode-generator', element: <QrCodeTool /> },
        { path: '/tools/url-parser', element: <UrlParserTool /> },
        { path: '*', element: <App /> },
      ],
    },
  ],
  // vite-react-ssg 默认不带 hydrationData 建 router，水合时客户端首渲与 SSR HTML 不一致，
  // 导致页面上出现第二份内容。这里把 SSG 写入 window 的水合数据传给路由。
  customCreateRouter: (routes: DataRouteObject[], opts?: DOMRouterOpts) => createBrowserRouter(routes, {
    ...opts,
    hydrationData: (window as unknown as Record<string, unknown>).__staticRouterHydrationData as HydrationState,
  }),
})
