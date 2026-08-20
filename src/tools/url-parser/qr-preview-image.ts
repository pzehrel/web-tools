import type { UrlNode, UrlTree } from './url-tree'
import { serializeUrl } from './url-tree'

interface PreviewLine {
  depth: number
  text: string
}

interface DrawLine extends PreviewLine {
  color: string
}

const WIDTH = 1400
const PADDING = 56
const HEADER_HEIGHT = 72
const QR_SIZE = 500
const COLUMN_GAP = 56
const LINE_HEIGHT = 40
const MAX_DRAW_LINES = 300

function paramNodes(tree: UrlTree): UrlNode[] {
  return tree.nodes.filter(node => node.kind === 'param' || node.kind === 'hash')
}

function hasParams(tree: UrlTree): boolean {
  return paramNodes(tree).length > 0
}

function baseOfTree(tree: UrlTree): string {
  return serializeUrl({
    ...tree,
    hasQuery: false,
    hasHash: false,
    nodes: tree.nodes.filter(node => node.kind !== 'param' && node.kind !== 'hash'),
  })
}

function collectLines(tree: UrlTree, depth: number, lastFlags: boolean[], lines: PreviewLine[]) {
  const nodes = paramNodes(tree)
  nodes.forEach((node, index) => {
    const isLast = index === nodes.length - 1
    const prefix = `${lastFlags.map(last => (last ? '   ' : '│  ')).join('')}${isLast ? '└─' : '├─'}`
    const key = node.kind === 'param' ? (node.label || '（空）') : '#'
    const expandable = node.children !== null && hasParams(node.children)
    const hasEquals = node.kind !== 'param' || node.flag
    const value = expandable ? baseOfTree(node.children!) : (node.value || '（空）')
    lines.push({ depth, text: `${prefix}${key}${hasEquals ? ' = ' : ''}${value}` })
    if (expandable)
      collectLines(node.children!, depth + 1, [...lastFlags, isLast], lines)
  })
}

function resolveColor(token: string): string {
  const rootStyle = getComputedStyle(document.documentElement)
  const value = rootStyle.getPropertyValue(token).trim()
  if (!value)
    return rootStyle.color
  const probe = document.createElement('span')
  probe.style.color = value
  probe.style.position = 'fixed'
  probe.style.pointerEvents = 'none'
  probe.style.opacity = '0'
  document.body.append(probe)
  const color = getComputedStyle(probe).color
  probe.remove()
  return color
}

function wrapLine(ctx: CanvasRenderingContext2D, line: PreviewLine, maxWidth: number): PreviewLine[] {
  if (ctx.measureText(line.text).width <= maxWidth)
    return [line]

  const continuation = '   '.repeat(line.depth + 1)
  const rows: PreviewLine[] = []
  let current = ''
  for (const char of line.text) {
    const next = current + char
    if (current && ctx.measureText(next).width > maxWidth) {
      rows.push({ ...line, text: current })
      current = continuation + char
    }
    else {
      current = next
    }
  }
  if (current)
    rows.push({ ...line, text: current })
  return rows
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('二维码图片加载失败'))
    image.src = src
  })
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob)
        resolve(blob)
      else
        reject(new Error('参数预览图片生成失败'))
    }, 'image/png')
  })
}

/** 生成「二维码 + URL 参数树」PNG，颜色跟随当前主题令牌。 */
export async function renderQrParameterPreview(qrDataUrl: string, tree: UrlTree): Promise<Blob> {
  const foreground = resolveColor('--popover-foreground')
  const background = resolveColor('--popover')
  const border = resolveColor('--border')
  const muted = resolveColor('--muted-foreground')
  const depthColors = ['--chart-4', '--chart-2', '--chart-3'].map(resolveColor)

  const measureCanvas = document.createElement('canvas')
  const measureCtx = measureCanvas.getContext('2d')
  if (!measureCtx)
    throw new Error('浏览器不支持图片生成')
  measureCtx.font = '600 27px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'

  const textX = PADDING + QR_SIZE + COLUMN_GAP
  const textWidth = WIDTH - textX - PADDING
  const previewLines: PreviewLine[] = [{ depth: 0, text: baseOfTree(tree) }]
  collectLines(tree, 0, [], previewLines)

  const drawLines: DrawLine[] = []
  for (const line of previewLines) {
    for (const wrapped of wrapLine(measureCtx, line, textWidth)) {
      if (drawLines.length >= MAX_DRAW_LINES)
        break
      drawLines.push({
        ...wrapped,
        color: depthColors[wrapped.depth % depthColors.length],
      })
    }
    if (drawLines.length >= MAX_DRAW_LINES)
      break
  }
  if (drawLines.length === MAX_DRAW_LINES)
    drawLines[MAX_DRAW_LINES - 1] = { depth: 0, text: '… 其余参数已省略', color: muted }

  const bodyY = PADDING + HEADER_HEIGHT
  const previewHeight = Math.max(LINE_HEIGHT, drawLines.length * LINE_HEIGHT)
  const height = Math.max(bodyY + QR_SIZE + PADDING, bodyY + previewHeight + PADDING)
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx)
    throw new Error('浏览器不支持图片生成')

  ctx.fillStyle = background
  ctx.fillRect(0, 0, WIDTH, height)
  ctx.strokeStyle = border
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, WIDTH - 4, height - 4)

  ctx.fillStyle = foreground
  ctx.font = '900 36px ui-sans-serif, system-ui, sans-serif'
  ctx.fillText('URL 参数预览', PADDING, PADDING + 36)

  const qrImage = await loadImage(qrDataUrl)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(qrImage, PADDING, bodyY, QR_SIZE, QR_SIZE)
  ctx.strokeStyle = border
  ctx.lineWidth = 4
  ctx.strokeRect(PADDING, bodyY, QR_SIZE, QR_SIZE)

  ctx.font = '600 27px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
  ctx.textBaseline = 'top'
  drawLines.forEach((line, index) => {
    ctx.fillStyle = line.color
    ctx.fillText(line.text, textX, bodyY + index * LINE_HEIGHT)
  })

  return canvasBlob(canvas)
}
