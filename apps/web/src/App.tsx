import { Seo } from '@/components/seo'
import { ToolRow } from '@/components/tool-card'
import { tools } from '@/tools'

function App() {
  const visible = tools.filter(tool => tool.status !== 'hidden')

  return (
    <div className="mx-auto min-h-dvh max-w-5xl px-4">
      <Seo
        title={null}
        description="纯前端实现的 Web 工具集合：URL 参数解析、二维码互转、Lottie 预览优化等。"
      />

      {/* 报头：字标 + 一句定位，发丝线与正文分割 */}
      <header className="flex h-20 items-end border-b border-border pb-4">
        <h1 className="font-mono text-xl font-semibold tracking-tight">
          Web Tools
        </h1>
        <p className="ml-4 hidden text-sm text-muted-foreground sm:block">
          浏览器本地运行 · 数据不上传
        </p>
      </header>

      {/* Hero：大标题 + 副题，纯排版 */}
      <section className="border-b border-border py-16 sm:py-20">
        <h2 className="max-w-2xl font-mono text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          趁手的网页小工具
        </h2>
        <p className="mt-4 max-w-prose text-muted-foreground">
          像从工具箱里拿扳手一样，拿来就用。所有计算都在你的浏览器里完成，没有后端，没有上传。
        </p>
      </section>

      {/* 工具索引：目录式整行条目，发丝线分割（hidden 工具不露出，直链可访问） */}
      <nav aria-label="工具索引" className="py-2">
        {visible.map((tool, i) => (
          <ToolRow key={tool.id} tool={tool} index={i + 1} />
        ))}
      </nav>

      {/* 页脚：极简 */}
      <footer className="mt-16 flex items-baseline justify-between border-t border-border py-6 text-sm text-muted-foreground">
        <span>Web Tools</span>
        <span className="font-mono text-xs">本地运行 / 无追踪</span>
      </footer>
    </div>
  )
}

export default App
