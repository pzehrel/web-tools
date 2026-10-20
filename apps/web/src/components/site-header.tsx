import { ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router'
import { SiteActions } from '@/components/site-actions'
import { publicTools, tools } from '@/tools'

export function SiteHeader() {
  const location = useLocation()
  const menuRef = useRef<HTMLDetailsElement>(null)
  const pathname = location.pathname.replace(/\/+$/, '') || '/'
  const current = tools.find(tool => pathname === `/tools/${tool.id}`)

  useEffect(() => {
    menuRef.current?.removeAttribute('open')
  }, [location.pathname])

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target))
        menuRef.current?.removeAttribute('open')
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <div className="site-brand-group">
          {current && (
            <Link className="site-icon-action" to="/" aria-label="返回首页" title="返回首页">
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
          )}
          <Link className={`site-brand ${current ? 'is-tool' : ''}`} to="/" aria-label="Web Tools 首页">Web Tools</Link>
          {current?.status === 'ready' && <h1>{current.name}</h1>}
        </div>
        <div className="site-header-actions">
          {current && (
            <details
              ref={menuRef}
              className="site-tool-menu"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  menuRef.current?.removeAttribute('open')
                  menuRef.current?.querySelector('summary')?.focus()
                }
              }}
            >
              <summary aria-label="切换工具">
                <span>切换工具</span>
                <ChevronDown className="size-4" aria-hidden="true" />
              </summary>
              <nav aria-label="切换工具">
                {publicTools.map(tool => (
                  <Link
                    key={tool.id}
                    to={`/tools/${tool.id}`}
                    aria-current={tool.id === current.id ? 'page' : undefined}
                    onClick={() => menuRef.current?.removeAttribute('open')}
                  >
                    <tool.icon className="size-4" aria-hidden="true" />
                    <span>{tool.name}</span>
                    <ChevronRight className="size-3" aria-hidden="true" />
                  </Link>
                ))}
              </nav>
            </details>
          )}
          <SiteActions />
        </div>
      </div>
    </header>
  )
}
