import type { ToolMeta } from '@/tools'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router'

import { cn } from '@/lib/utils'

interface ToolCardProps {
  tool: ToolMeta
}

export function ToolCard({ tool }: ToolCardProps) {
  const ready = tool.status === 'ready'
  const Icon = tool.icon
  const className = cn(
    'flex min-w-0 flex-col gap-4 rounded-[calc(var(--radius)+2px)] border border-border bg-card p-5 transition-colors duration-150 motion-reduce:transition-none',
    ready
      ? 'group cursor-pointer hover:border-primary hover:bg-secondary/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
      : 'text-muted-foreground',
  )
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-9 items-center justify-center bg-secondary text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <span className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-primary">
          {ready
            ? (
                <>
                  打开
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </>
              )
            : <span>筹备中</span>}
        </span>
      </div>
      <div>
        <h3 className="font-mono text-lg font-semibold tracking-tight group-hover:text-primary">
          {tool.name}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{tool.description}</p>
      </div>
    </>
  )

  return ready
    ? <Link to={`/tools/${tool.id}`} className={className}>{content}</Link>
    : <div aria-disabled="true" className={className}>{content}</div>
}
