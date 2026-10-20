/**
 * Full-function F study. Every tool has a complete interface; production stays separate.
 * 完整功能 F 原型；每个工具提供完整界面，正式页面仍独立。
 */
import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { PrototypeSwitcher } from '@/components/prototype-switcher'
import { Seo } from '@/components/seo'
import { ThemeToggle } from '@/components/theme-toggle'
import { tools } from '@/tools'
import FontFullPrototype from './ui-redesign-font-full.prototype'
import FramesFullPrototype from './ui-redesign-frames-full.prototype'
import LottieFullPrototype from './ui-redesign-lottie-full.prototype'
import NineFullPrototype from './ui-redesign-nine-full.prototype'
import ShineFullPrototype from './ui-redesign-shine-full.prototype'
import UrlTreePrototype from './ui-redesign-url.prototype'
import './ui-redesign-workspace.prototype.scss'

const names: Record<string, string> = { 'url-qrcode': 'URL 与二维码', 'frame-animation': '帧动画', 'lottie-preview': 'Lottie 预览', 'nine-patch': '点九图', 'css-shine': 'CSS 扫光', 'font-toolkit': '字体工具箱' }
const visibleTools = tools.filter(item => item.status === 'ready')

export default function CompletePrototypeWorkspace() {
  const location = useLocation()
  const navigate = useNavigate()
  const menuRef = useRef<HTMLDetailsElement>(null)
  const rawId = location.pathname.split('/')[2] || ''
  const id = rawId === 'url-parser' || rawId === 'qrcode-generator' ? 'url-qrcode' : rawId
  const tool = tools.find(item => item.id === id)
  const canvas = ['frame-animation', 'lottie-preview', 'nine-patch'].includes(id)
  const title = names[id] || '全部工具'
  const href = (path: string) => `${path}?variant=F`
  useEffect(() => {
    menuRef.current?.removeAttribute('open')
  }, [location.pathname])
  useEffect(() => {
    if (rawId === 'url-parser' || rawId === 'qrcode-generator')
      void navigate(`/tools/url-qrcode${location.search}${location.hash}`, { replace: true })
  }, [rawId, location.search, location.hash, navigate])
  const component = id === 'url-qrcode'
    ? <UrlTreePrototype />
    : id === 'frame-animation'
      ? <FramesFullPrototype />
      : id === 'lottie-preview'
        ? <LottieFullPrototype />
        : id === 'nine-patch'
          ? <NineFullPrototype />
          : id === 'css-shine' ? <ShineFullPrototype /> : <FontFullPrototype />
  return (
    <div className={`ui-prototype variant-F complete-prototype ${canvas ? 'is-canvas' : ''}`}>
      <Seo title={tool ? title : null} description={tool?.description || '处理链接、预览动画、制作图片素材。'} path={tool ? `/tools/${id}` : '/'} />
      <header className={`proto-header ${tool ? 'is-tool' : 'is-home'}`}>
        <div className={canvas ? 'proto-canvas-toolbar' : 'complete-brand-group'}>
          {tool && (
            <Link className="proto-home-link" to={href('/')} aria-label="返回首页" title="返回首页">
              <ArrowLeft size={14} />
              <span>返回首页</span>
            </Link>
          )}
          <Link className="proto-brand" to={href('/')} aria-label="Web Tools 首页">Web Tools</Link>
          {tool && <h1>{title}</h1>}
        </div>
        <div className="proto-header-end">

          <details ref={menuRef} className="proto-tool-menu">
            <summary>
              {tool ? '切换工具' : '工具'}
              <ChevronDown size={14} />
            </summary>
            <nav aria-label="切换工具">
              {visibleTools.map(item => (
                <Link key={item.id} to={href(`/tools/${item.id}`)}>
                  <item.icon size={15} />
                  <span>{names[item.id]}</span>
                  <ChevronRight size={13} />
                </Link>
              ))}
            </nav>
          </details>
          <ThemeToggle />
          <a className="complete-github" href="https://github.com/pzehrel/web-tools" target="_blank" rel="noreferrer" aria-label="GitHub" title="GitHub">
            <svg aria-hidden="true" width={16} height={16} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.335-1.756-1.335-1.756-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
            </svg>
          </a>
        </div>
      </header>
      {tool
        ? component
        : (
            <main className="reference-home">
              <div className="reference-home-title"><h1>全部工具</h1></div>
              <nav className="reference-tools" aria-label="工具目录">
                {visibleTools.map(item => (
                  <Link key={item.id} to={href(`/tools/${item.id}`)}>
                    <div className="reference-tool-icon"><item.icon size={34} strokeWidth={1.8} /></div>
                    <h2>{names[item.id]}</h2>
                    <p>{item.description}</p>
                    <span className="reference-tool-open">
                      打开工具
                      <ChevronRight size={17} />
                    </span>
                  </Link>
                ))}
              </nav>
            </main>
          )}
      <PrototypeSwitcher state={`${title} · 完整功能界面 · 独立演示记录`} />
    </div>
  )
}
