import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'

export function ToolHeader({ title, description }: { title: string, description: string }) {
  return (
    <header className="flex min-h-16 items-center gap-3 border-b border-border py-3 pr-44">
      <Button asChild variant="outline" size="icon" className="shrink-0">
        <Link to="/" aria-label="返回首页">
          <ArrowLeft className="size-5" />
        </Link>
      </Button>
      <div className="min-w-0">
        <h1 className="font-mono text-base font-semibold tracking-tight sm:text-lg">{title}</h1>
        <p className="hidden truncate text-sm text-muted-foreground md:block" title={description}>{description}</p>
      </div>
    </header>
  )
}
