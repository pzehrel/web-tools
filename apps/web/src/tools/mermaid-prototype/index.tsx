import { lazy, Suspense } from 'react'
import { ClientOnly, Head } from 'vite-react-ssg'
import { Seo } from '@/components/seo'

const Editor = lazy(() => import('./editor.prototype'))

export default function MermaidPrototypePage() {
  return (
    <>
      <Seo title="Mermaid 交互原型" description="仅用于体验画布与代码工作流的可丢弃原型。" path="/tools/mermaid-prototype" />
      <Head><meta name="robots" content="noindex,nofollow" /></Head>
      <ClientOnly>{() => (<Suspense fallback={<p className="p-6">正在加载 Mermaid 交互原型…</p>}><Editor /></Suspense>)}</ClientOnly>
    </>
  )
}
