import type { LucideIcon } from 'lucide-react'
import { Film, Frame, Images, Link2, Type } from 'lucide-react'

export interface ToolMeta {
  /** 路由/锚点 id，kebab-case */
  id: string
  name: string
  description: string
  icon: LucideIcon
  /** ready = 可用；planned = 筹备中（占位展示） */
  status: 'ready' | 'planned' | 'hidden'
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
    id: 'url-qrcode',
    name: '链接解析',
    description: '拆解 URL 参数，和二维码互相转换',
    icon: Link2,
    status: 'ready',
    accentClass: 'bg-chart-3',
  },
  {
    id: 'frame-animation',
    name: '帧动画',
    description: '把多张图片连成动画播放',
    icon: Film,
    status: 'ready',
    accentClass: 'bg-chart-1',
  },
  {
    id: 'lottie-preview',
    name: 'Lottie 预览',
    description: '播放 Lottie 动画并优化图片素材',
    icon: Images,
    status: 'ready',
    accentClass: 'bg-chart-5',
  },
  {
    id: 'nine-patch',
    name: '点九图',
    description: '制作九宫格切片并生成 CSS',
    icon: Frame,
    status: 'ready',
    accentClass: 'bg-chart-4',
  },
  {
    id: 'font-toolkit',
    name: '字体工具箱',
    description: '字体预览、体检、子集化与格式转换',
    icon: Type,
    status: 'hidden',
    accentClass: 'bg-chart-2',
  },
]
