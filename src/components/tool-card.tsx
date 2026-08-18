import type { ToolMeta } from '@/tools'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { cn } from '@/lib/utils'

interface ToolCardProps {
  tool: ToolMeta
}

/**
 * 首页工具卡片：可交互时整体「抬起」，筹备中的工具降低存在感。
 * 新工具页可复用此卡片的视觉语言作为页面头部。
 */
export function ToolCard({ tool }: ToolCardProps) {
  const Icon = tool.icon
  const ready = tool.status === 'ready'

  return (
    <Link
      to={ready ? `/tools/${tool.id}` : '#'}
      onClick={ready ? undefined : e => e.preventDefault()}
      aria-disabled={!ready}
      className={cn(
        'group flex flex-col gap-4 rounded-lg border-2 border-border bg-card p-5 transition-all',
        ready
          ? 'shadow-hard-sm cursor-pointer hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard active:translate-x-0.5 active:translate-y-0.5 active:shadow-hard-xs'
          : 'cursor-not-allowed opacity-60',
      )}
    >
      <div className="flex items-start justify-between">
        <div
          className={cn(
            'flex size-12 items-center justify-center rounded-md border-2 border-border',
            tool.accentClass,
          )}
        >
          <Icon className="size-6 text-foreground" />
        </div>
        {!ready && (
          <span className="rounded-full border-2 border-border bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
            筹备中
          </span>
        )}
      </div>
      <div className="flex-1">
        <h3 className="font-bold">{tool.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
      </div>
      {ready && (
        <div className="flex items-center gap-1 text-sm font-bold text-primary">
          打开工具
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      )}
    </Link>
  )
}
