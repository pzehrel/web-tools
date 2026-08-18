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
})
