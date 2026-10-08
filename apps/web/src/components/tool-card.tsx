import type { ToolMeta } from '@/tools'
import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { cn } from '@/lib/utils'

interface ToolRowProps {
  tool: ToolMeta
  /** 目录序号，首页从 01 开始编号 */
  index: number
}

/**
 * 首页工具条目：目录索引式整行布局，用上下发丝线分割，
 * 不做卡片。悬停整行出现浅灰洗刷与箭头位移；
 * 筹备中的工具降低存在感且不可进入。
 */
export function ToolRow({ tool, index }: ToolRowProps) {
  const ready = tool.status === 'ready'

  return (
    <Link
      to={ready ? `/tools/${tool.id}` : '#'}
      onClick={ready ? undefined : e => e.preventDefault()}
      aria-disabled={!ready}
      className={cn(
        'group grid grid-cols-[3rem_1fr_auto] items-baseline gap-4 border-b border-border py-5 transition-colors duration-150',
        ready
          ? 'cursor-pointer hover:bg-muted/60'
          : 'cursor-not-allowed opacity-55',
      )}
    >
      <span className="font-mono text-sm tabular-nums text-muted-foreground">
        {String(index).padStart(2, '0')}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-x-3">
          <h3 className="font-mono text-base font-semibold tracking-tight">
            {tool.name}
          </h3>
          {!ready && (
            <span className="text-xs text-muted-foreground">筹备中</span>
          )}
        </span>
        <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
      </span>
      {ready
        ? (
            <span className="text-muted-foreground transition-transform duration-150 group-hover:translate-x-1">
              <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          )
        : <span aria-hidden="true" />}
    </Link>
  )
}
