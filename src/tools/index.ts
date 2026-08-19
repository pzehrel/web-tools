import type { LucideIcon } from 'lucide-react'
import { Film, Frame, Link2, QrCode } from 'lucide-react'

export interface ToolMeta {
  /** 路由/锚点 id，kebab-case */
  id: string
  name: string
  description: string
  icon: LucideIcon
  /** ready = 可用；planned = 筹备中（占位展示） */
  status: 'ready' | 'planned'
  /**
   * 图标装饰色，使用 chart-1 ~ chart-5 主题令牌对应的 Tailwind 类，
   * 保证换肤时随主题联动
   */
  accentClass: `bg-chart-${1 | 2 | 3 | 4 | 5}`
}

/**
 * 工具注册表：新工具在这里登记即可出现在首页。
 * 后续接入路由时以 id 作为路径。
 */
export const tools: ToolMeta[] = [
  {
    id: 'qrcode-generator',
    name: '二维码工具',
    description: '文字与二维码互转，支持历史记录',
    icon: QrCode,
    status: 'ready',
    accentClass: 'bg-chart-2',
  },
  {
    id: 'url-parser',
    name: 'URL 解析',
    description: '任意协议 URL / 路径拆成树，嵌套参数递归展开、可编辑',
    icon: Link2,
    status: 'ready',
    accentClass: 'bg-chart-3',
  },
  {
    id: 'frame-animation',
    name: '帧动画预览',
    description: '导入多张图片逐帧播放，帧率 / 方向 / 循环 / 缩放可调',
    icon: Film,
    status: 'ready',
    accentClass: 'bg-chart-1',
  },
  {
    id: 'nine-patch',
    name: '点九图工具',
    description: '拖动四条切线定义九宫格，预览 border-image 并导出 CSS',
    icon: Frame,
    status: 'ready',
    accentClass: 'bg-chart-4',
  },
]
