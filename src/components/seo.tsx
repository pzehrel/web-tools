import { Head } from 'vite-react-ssg'

const SITE_NAME = 'Web Tools'
/** 站点正式域名（确定部署域名后替换，用于 canonical / og:url / sitemap / robots） */
export const SITE_URL = 'https://web-tools.pzehrel.workers.dev'

interface SeoProps {
  /** 页面名，会拼上站点名；首页传 null 直接用站点标语 */
  title: string | null
  description: string
  /** 以 / 开头的路径，用于 canonical 与 og:url */
  path?: string
}

/** 每页的 <head> 管理：title / description / OG / canonical，SSG 时直接写入静态 HTML */
export function Seo({ title, description, path = '/' }: SeoProps) {
  const fullTitle = title === null ? `${SITE_NAME} — 趁手的网页小工具` : `${title} · ${SITE_NAME}`
  const url = SITE_URL + path
  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={url} />
      <meta name="twitter:card" content="summary" />
      <link rel="canonical" href={url} />
    </Head>
  )
}
