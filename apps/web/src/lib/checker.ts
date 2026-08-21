/**
 * 画布棋盘格：全站画布工具（帧动画 / 点九图 / Lottie）共用同一套配色与格纹。
 * 配色的目的是看清透明素材的边界：格子间保持足够的明度对比，
 * 且整套与素材色错开（浅色素材用深底、绿色素材用品红底……）。
 * 每套配色区分亮 / 暗主题版本，跟随站点主题切换。
 */
export interface CheckerPalette {
  name: string
  /** 亮色主题下的两格颜色 */
  light: { a: string, b: string }
  /** 暗色主题下的两格颜色 */
  dark: { a: string, b: string }
}

/** 固定 4 套棋盘配色（a = 格 A，b = 格 B） */
export const CHECKER_PALETTES: CheckerPalette[] = [
  {
    name: '浅灰',
    light: { a: '#ffffff', b: '#dcdcdc' },
    dark: { a: '#2e2e2e', b: '#1f1f1f' },
  },
  {
    name: '深灰',
    light: { a: '#2e2e2e', b: '#1f1f1f' },
    dark: { a: '#f0f0f0', b: '#d2d2d2' },
  },
  {
    name: '品红',
    light: { a: '#f5d7e8', b: '#e89ac6' },
    dark: { a: '#5c2040', b: '#3d1229' },
  },
  {
    name: '青绿',
    light: { a: '#d7f0e5', b: '#8fd4b8' },
    dark: { a: '#14503c', b: '#0b3325' },
  },
  {
    name: '天蓝',
    light: { a: '#d9e9fa', b: '#8fc0ef' },
    dark: { a: '#1b4266', b: '#0f2a44' },
  },
  {
    name: '琥珀',
    light: { a: '#faeed3', b: '#eec784' },
    dark: { a: '#5c4318', b: '#3a2a0c' },
  },
]

/** conic-gradient 四象限拼格（background 简写值，含 16px 格子尺寸） */
export function checkerBackground(a: string, b: string): string {
  return `conic-gradient(${b} 25%, ${a} 0 50%, ${b} 0 75%, ${a} 0) 0 0 / 16px 16px`
}

/** 棋盘格图像部分（仅 background-image 可用的值） */
export function checkerGradient(a: string, b: string): string {
  return `conic-gradient(${b} 25%, ${a} 0 50%, ${b} 0 75%, ${a} 0)`
}

/** 默认棋盘格背景样式（各画布工具统一使用，浅灰套 · 亮色主题） */
export const DEFAULT_CHECKER_STYLE = {
  backgroundColor: CHECKER_PALETTES[0].light.a,
  backgroundImage: checkerGradient(CHECKER_PALETTES[0].light.a, CHECKER_PALETTES[0].light.b),
  backgroundSize: '16px 16px',
} as const
