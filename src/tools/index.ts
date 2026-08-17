import type { LucideIcon } from 'lucide-react'
import { Binary, Braces, Clock, Palette, QrCode, Regex } from 'lucide-react'

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
    id: 'json-formatter',
    name: 'JSON 格式化',
    description: '格式化、校验、压缩 JSON 数据',
    icon: Braces,
    status: 'planned',
    accentClass: 'bg-chart-1',
  },
  {
    id: 'qrcode-generator',
    name: '二维码生成',
    description: '文本、链接一键生成二维码',
    icon: QrCode,
    status: 'planned',
    accentClass: 'bg-chart-2',
  },
  {
    id: 'timestamp-converter',
    name: '时间戳转换',
    description: 'Unix 时间戳与日期时间互转',
    icon: Clock,
    status: 'planned',
    accentClass: 'bg-chart-3',
  },
  {
    id: 'color-converter',
    name: '颜色转换',
    description: 'HEX、RGB、HSL、OKLCH 互转',
    icon: Palette,
    status: 'planned',
    accentClass: 'bg-chart-4',
  },
  {
    id: 'regex-tester',
    name: '正则测试',
    description: '实时匹配、高亮、替换正则表达式',
    icon: Regex,
    status: 'planned',
    accentClass: 'bg-chart-5',
  },
  {
    id: 'base64-codec',
    name: 'Base64 编解码',
    description: '文本与文件的 Base64 编码解码',
    icon: Binary,
    status: 'planned',
    accentClass: 'bg-chart-1',
  },
]
