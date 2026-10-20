// Geometry uses CSS pixels relative to the tool root; right/bottom are outer limits.
// 几何值采用相对工具根节点的 CSS 像素；right／bottom 表示外侧边界。
export interface HudRect { x: number, y: number, width: number, height: number }
export interface HudBounds { left: number, top: number, right: number, bottom: number }
export type HudEdge = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

// Constrain view-only HUD geometry; small viewports take precedence over minimum sizes.
// 约束仅用于查看的 HUD 几何；视口过小时，边界优先于最小尺寸。
export function fitHudRect(rect: HudRect, bounds: HudBounds): HudRect {
  const availableWidth = Math.max(1, bounds.right - bounds.left)
  const availableHeight = Math.max(1, bounds.bottom - bounds.top)
  const width = clamp(rect.width, Math.min(280, availableWidth), availableWidth)
  const height = clamp(rect.height, Math.min(180, availableHeight), availableHeight)
  return {
    x: clamp(rect.x, bounds.left, bounds.right - width),
    y: clamp(rect.y, bounds.top, bounds.bottom - height),
    width,
    height,
  }
}

// Resize against the opposite edge; pointer deltas are viewport pixels, not preview pixels.
// 调整大小时固定对边；指针位移采用视口像素，不采用预览内容的逻辑像素。
export function updateHudRect(rect: HudRect, action: 'move' | HudEdge, dx: number, dy: number, bounds: HudBounds): HudRect {
  const base = fitHudRect(rect, bounds)
  if (action === 'move')
    return fitHudRect({ ...base, x: base.x + dx, y: base.y + dy }, bounds)
  let { x, y, width, height } = base
  const minWidth = Math.min(280, bounds.right - bounds.left)
  const minHeight = Math.min(180, bounds.bottom - bounds.top)
  if (action.includes('e'))
    width = clamp(base.width + dx, minWidth, bounds.right - base.x)
  if (action.includes('w')) {
    x = clamp(base.x + dx, bounds.left, base.x + base.width - minWidth)
    width = base.x + base.width - x
  }
  if (action.includes('s'))
    height = clamp(base.height + dy, minHeight, bounds.bottom - base.y)
  if (action.includes('n')) {
    y = clamp(base.y + dy, bounds.top, base.y + base.height - minHeight)
    height = base.y + base.height - y
  }
  return { x, y, width, height }
}
