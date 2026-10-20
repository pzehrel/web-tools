import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { Seo } from '@/components/seo'
import { publicTools } from '@/tools'

function App() {
  return (
    <main className="home-directory">
      <Seo title={null} description="处理链接、预览动画、制作图片素材。" />
      <h1>全部工具</h1>
      <nav aria-label="工具索引" className="home-tools">
        {publicTools.map(tool => (
          <Link key={tool.id} to={`/tools/${tool.id}`}>
            <tool.icon className="size-8 text-primary" aria-hidden="true" />
            <h2>{tool.name}</h2>
            <p>{tool.description}</p>
            <span>
              打开工具
              <ChevronRight className="size-4" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </nav>
    </main>
  )
}

export default App
