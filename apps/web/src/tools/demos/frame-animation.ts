/**
 * 帧动画示例：8 帧弹跳点动画，canvas 现场生成 PNG
 * （canvas 只有客户端可用，仅在用户点击「试试示例」时调用）。
 * 返回 File[]，直接走工具的正常导入流程（自然排序 + 生成 objectURL）。
 */
export async function createDemoFrames(): Promise<File[] | null> {
  const size = 96
  const count = 8
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return null

  const files: File[] = []
  for (let frame = 0; frame < count; frame++) {
    ctx.clearRect(0, 0, size, size)
    for (let dot = 0; dot < 3; dot++) {
      const phase = (frame / count + dot / 3) % 1
      const lift = Math.sin(phase * Math.PI * 2)
      const x = size / 2 + (dot - 1) * 24
      const y = size * 0.62 - lift * 14
      ctx.beginPath()
      ctx.arc(x, y, 10, 0, Math.PI * 2)
      ctx.fillStyle = dot === 0 ? '#43d69e' : dot === 1 ? '#7457ff' : '#e2622b'
      ctx.fill()
      ctx.lineWidth = 4
      ctx.strokeStyle = '#2f2d2a'
      ctx.stroke()
    }
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
    if (!blob)
      return null
    files.push(new File([blob], `demo-frame-${String(frame + 1).padStart(2, '0')}.png`, { type: 'image/png' }))
  }
  return files
}
