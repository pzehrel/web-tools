import { ShieldCheck } from 'lucide-react'
import { Seo } from '@/components/seo'
import { ToolCard } from '@/components/tool-card'
import { tools } from '@/tools'

function App() {
  const visible = tools.filter(tool => tool.status !== 'hidden')
  const readyCount = visible.filter(tool => tool.status === 'ready').length

  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-4">
      <Seo
        title={null}
        description="纯前端实现的 Web 工具集合：URL 参数解析、二维码互转、Lottie 预览优化等。"
      />

      <header className="flex h-20 shrink-0 items-center border-b border-border pr-44">
        <h1 className="font-mono text-xl font-semibold tracking-tight">
          Web Tools
        </h1>
      </header>

      <main className="pb-10 sm:pb-14">
        <section className="grid gap-6 py-8 sm:py-10 lg:grid-cols-[1fr_18rem] lg:items-end lg:gap-12">
          <div>
            <p className="mb-4 text-sm text-primary">打开即用的浏览器工具集</p>
            <h2 className="font-mono text-3xl font-semibold leading-tight tracking-tight sm:text-4xl xl:text-5xl">
              趁手的网页小工具
            </h2>
            <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground sm:text-base">
              处理链接、预览动画、制作图片素材。少一点重复操作，多一点顺手。
            </p>
          </div>
          <div className="flex items-start gap-3 border-l-2 border-primary pl-4">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-medium">本地运行，数据不上传</p>
              <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                文件与计算都留在你的浏览器里。
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="tool-index-title">
          <div className="mb-5 flex items-center justify-between gap-4 border-t border-border pt-5">
            <h2 id="tool-index-title" className="font-mono text-sm font-semibold tracking-tight">工具目录</h2>
            <p className="text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">{String(readyCount).padStart(2, '0')}</span>
              {' '}
              款工具可用
            </p>
          </div>
          <nav aria-label="工具索引" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map(tool => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </nav>
        </section>
      </main>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-border py-5 text-xs text-muted-foreground">
        <span className="font-mono">Web Tools</span>
        <span>为日常工作，省一点时间。</span>
      </footer>
    </div>
  )
}

export default App
