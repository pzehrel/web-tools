import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useEffect } from 'react'
import { useSearchParams } from 'react-router'

const variants = ['F', 'D', 'E'] as const
const names = { F: '完整功能布局', D: '上一轮 D', E: '上一轮 E' }

export function PrototypeSwitcher({ state }: { state: string }) {
  const [params, setParams] = useSearchParams()
  const current = params.get('variant') || 'F'
  const index = Math.max(0, variants.findIndex(key => key === current))
  const changeVariant = (offset: number) => {
    const next = new URLSearchParams(params)
    next.set('variant', variants[(index + offset + variants.length) % variants.length])
    setParams(next, { replace: true, preventScrollReset: true })
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (current === 'F' && window.location.pathname.startsWith('/tools/'))
        return
      if (event.target instanceof Element && event.target.closest('input, textarea, select, [contenteditable], [role="slider"], [role="tab"]'))
        return
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        changeVariant(event.key === 'ArrowLeft' ? -1 : 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!import.meta.env.DEV)
    return null

  return (
    <aside className="prototype-switcher" aria-label="设计原型切换">
      <button type="button" onClick={() => changeVariant(-1)} aria-label="上一个设计方向"><ArrowLeft size={18} /></button>
      <div>
        <strong>{`${variants[index]} · ${names[variants[index]]}`}</strong>
        <output>{state}</output>
      </div>
      <button type="button" onClick={() => changeVariant(1)} aria-label="下一个设计方向"><ArrowRight size={18} /></button>
    </aside>
  )
}
