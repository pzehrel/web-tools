import { ExternalLink, Wrench, Zap } from 'lucide-react'

import { Seo } from '@/components/seo'
import { ToolCard } from '@/components/tool-card'
import { tools } from '@/tools'

function App() {
  return (
    <div className="mx-auto max-w-5xl px-4">
      <Seo
        title={null}
        description="纯前端实现的 Web 工具集合：二维码互转、URL 参数解析。所有工具在浏览器本地运行，不上传任何数据。"
      />
      {/* 顶栏：印章式 logo + 字标 */}
      <header className="flex h-24 items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-md border-2 border-border bg-primary shadow-hard-xs">
          <Wrench className="size-5 text-primary-foreground" />
        </div>
        <span className="text-lg font-black tracking-tight">Web Tools</span>
      </header>

      {/* Hero：大标题 + 贴纸徽章 */}
      <section className="py-12">
        <div className="inline-flex items-center gap-1.5 rounded-full border-2 border-border bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground shadow-hard-xs">
          <Zap className="size-3.5" />
          打开即用 · 无需安装
        </div>
        <h1 className="mt-4 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
          趁手的
          <span className="mx-1 inline-block -rotate-2 rounded-md border-2 border-border bg-primary px-2 text-primary-foreground shadow-hard-sm">
            网页小工具
          </span>
        </h1>
        <p className="mt-4 text-muted-foreground">
          所有工具都在浏览器本地运行，不上传任何数据。像从工具箱里拿扳手一样，拿来就用。
        </p>
      </section>

      {/* 工具网格 */}
      <section className="grid grid-cols-1 gap-5 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map(tool => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </section>

      <footer className="flex items-center justify-between border-t-2 border-border py-6 text-sm text-muted-foreground">
        <span>Web Tools — 趁手的网页小工具集合</span>
        <a
          href="https://github.com/pzehrel/web-tools"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 font-bold text-foreground hover:underline"
        >
          <ExternalLink className="size-4" />
          GitHub
        </a>
      </footer>
    </div>
  )
}

export default App
