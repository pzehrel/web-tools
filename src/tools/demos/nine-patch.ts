/**
 * 点九图内置示例图（96×96，建议切片 24）：
 * 粗描边圆角徽章 + 中心圆点，四角是圆弧、四边是直线段，
 * 切片后拉伸 / 平铺的效果一眼可辨。仅在客户端生成（canvas 无 SSG 环境）。
 */
export function createDemoImage(): { name: string, url: string, width: number, height: number } | null {
  const size = 96
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return null

  const inset = 8
  const r = 18
  const x0 = inset
  const y0 = inset
  const x1 = size - inset
  const y1 = size - inset
  ctx.beginPath()
  ctx.moveTo(x0 + r, y0)
  ctx.lineTo(x1 - r, y0)
  ctx.arcTo(x1, y0, x1, y0 + r, r)
  ctx.lineTo(x1, y1 - r)
  ctx.arcTo(x1 - r, y1, x1, y1, r)
  ctx.lineTo(x0 + r, y1)
  ctx.arcTo(x0, y1, x0, y1 - r, r)
  ctx.lineTo(x0, y0 + r)
  ctx.arcTo(x0, y0 + r, x0, y0, r)
  ctx.closePath()
  ctx.fillStyle = '#fff3d6'
  ctx.fill()
  ctx.lineWidth = 8
  ctx.strokeStyle = '#33302b'
  ctx.stroke()

  // 中心圆点：落在内容区，用于观察 fill 开 / 关的差别
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, 10, 0, Math.PI * 2)
  ctx.fillStyle = '#e2622b'
  ctx.fill()
  // 边上小刻度：让 repeat / round / space 的平铺单元可数
  ctx.fillStyle = '#33302b'
  ctx.fillRect(size / 2 - 2, y0 - 4, 4, 8)
  ctx.fillRect(size / 2 - 2, y1 - 4, 4, 8)
  ctx.fillRect(x0 - 4, size / 2 - 2, 8, 4)
  ctx.fillRect(x1 - 4, size / 2 - 2, 8, 4)

  return { name: 'demo.png', url: canvas.toDataURL('image/png'), width: size, height: size }
}
