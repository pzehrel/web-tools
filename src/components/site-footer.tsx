import { ExternalLink } from 'lucide-react'

/** 全站页脚：品牌行 + GitHub 链接（挂在 RootLayout，所有页面共用） */
export function SiteFooter() {
  return (
    <footer className="mx-auto mt-16 flex w-full max-w-5xl items-center justify-between border-t-2 border-border px-4 py-6 text-sm text-muted-foreground">
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
  )
}
