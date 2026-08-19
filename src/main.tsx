import type { DataRouteObject, DOMRouterOpts } from 'react-router'
import { createBrowserRouter } from 'react-router'
import { ViteReactSSG } from 'vite-react-ssg'
import App from './App.tsx'
import { RootLayout } from './root-layout.tsx'
import FrameAnimationTool from './tools/frame-animation'
import NinePatchTool from './tools/nine-patch'
import QrCodeTool from './tools/qrcode-generator'
import UrlParserTool from './tools/url-parser'
import './index.scss'

/**
 * 路由 id 显式固定，供 hydrationData.loaderData 对齐使用。
 *
 * 背景：vite-react-ssg 会给每个路由包一层静态数据 loader，
 * 而 SSG 写入的 window.__staticRouterHydrationData.loaderData 是空对象，
 * React Router 据此认为「loader 还没跑完」→ 首渲染 HydrateFallback →
 * 与 SSR HTML 不一致 → React 放弃水合整树重渲染 → 页面上出现两份内容。
 * 这里显式声明每个路由的 loader 已有数据（null），让路由初始化即 hydrated。
 */
const ROUTE_IDS = ['root', 'home', 'qrcode-generator', 'url-parser', 'frame-animation', 'nine-patch', 'fallback'] as const

export const createRoot = ViteReactSSG({
  routes: [
    {
      id: 'root',
      element: <RootLayout />,
      children: [
        { id: 'home', path: '/', element: <App /> },
        { id: 'qrcode-generator', path: '/tools/qrcode-generator', element: <QrCodeTool /> },
        { id: 'url-parser', path: '/tools/url-parser', element: <UrlParserTool /> },
        { id: 'frame-animation', path: '/tools/frame-animation', element: <FrameAnimationTool /> },
        { id: 'nine-patch', path: '/tools/nine-patch', element: <NinePatchTool /> },
        { id: 'fallback', path: '*', element: <App /> },
      ],
    },
  ],
  customCreateRouter: (routes: DataRouteObject[], opts?: DOMRouterOpts) => createBrowserRouter(routes, {
    ...opts,
    hydrationData: {
      loaderData: Object.fromEntries(ROUTE_IDS.map(id => [id, null])),
      actionData: null,
      errors: null,
    },
  }),
})
