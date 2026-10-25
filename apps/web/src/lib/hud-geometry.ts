// Geometry uses CSS pixels relative to the tool root; right/bottom are outer limits.
// 几何值采用相对工具根节点的 CSS 像素；right／bottom 表示外侧边界。
export interface HudRect { x: number, y: number, width: number, height: number }
export interface HudBounds { left: number, top: number, right: number, bottom: number }
export type HudEdge = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'
export const HUD_GAP = 12

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

// Constrain view-only HUD geometry; small viewports take precedence over minimum sizes.
// 约束仅用于查看的 HUD 几何；视口过小时，边界优先于最小尺寸。
export function fitHudRect(rect: HudRect, bounds: HudBounds): HudRect {
  const availableWidth = Math.max(1, bounds.right - bounds.left)
  const availableHeight = Math.max(1, bounds.bottom - bounds.top)
  const width = clamp(rect.width, Math.min(280, availableWidth), availableWidth)
  const height = clamp(rect.height, Math.min(180, Math.max(1, (availableHeight - HUD_GAP) / 2)), availableHeight)
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
  const minHeight = Math.min(180, Math.max(1, (bounds.bottom - bounds.top - HUD_GAP) / 2))
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

// Resizing stops at contact; moving can slide along the neighboring HUD without entering it.
// 缩放碰到邻居时停住；移动可沿邻居边缘滑动，不穿入其中。
export function updateHudRectUntilObstacle(base: HudRect, action: 'move' | HudEdge, dx: number, dy: number, bounds: HudBounds, obstacle: HudRect): HudRect {
  const start = fitHudRect(base, bounds)
  const target = updateHudRect(start, action, dx, dy, bounds)
  const obstacleLeft = obstacle.x - HUD_GAP
  const obstacleRight = obstacle.x + obstacle.width + HUD_GAP
  const obstacleTop = obstacle.y - HUD_GAP
  const obstacleBottom = obstacle.y + obstacle.height + HUD_GAP
  const contactTolerance = 0.05
  const overlaps = (rect: HudRect) => rect.x < obstacleRight - contactTolerance && rect.x + rect.width > obstacleLeft + contactTolerance
    && rect.y < obstacleBottom - contactTolerance && rect.y + rect.height > obstacleTop + contactTolerance

  // An existing overlap can come from a viewport change; allow a gesture to move out of it.
  if (overlaps(start))
    return target

  let enter = 0
  let exit = 1
  const clip = (from: number, to: number, limit: number, below: boolean) => {
    const origin = Math.abs(from - limit) <= contactTolerance ? limit : from
    const destination = Math.abs(to - limit) <= contactTolerance ? limit : to
    const delta = destination - origin
    if (delta === 0)
      return below ? origin < limit : origin > limit
    const crossing = (limit - origin) / delta
    if ((below && delta > 0) || (!below && delta < 0))
      exit = Math.min(exit, crossing)
    else
      enter = Math.max(enter, crossing)
    return enter < exit
  }

  const starts = { left: start.x, right: start.x + start.width, top: start.y, bottom: start.y + start.height }
  const ends = { left: target.x, right: target.x + target.width, top: target.y, bottom: target.y + target.height }
  if (!clip(starts.left, ends.left, obstacleRight, true)
    || !clip(starts.right, ends.right, obstacleLeft, false)
    || !clip(starts.top, ends.top, obstacleBottom, true)
    || !clip(starts.bottom, ends.bottom, obstacleTop, false)) {
    return target
  }

  const progress = Math.max(0, Math.min(1, enter))
  const contact = {
    x: start.x + (target.x - start.x) * progress,
    y: start.y + (target.y - start.y) * progress,
    width: start.width + (target.width - start.width) * progress,
    height: start.height + (target.height - start.height) * progress,
  }
  if (action !== 'move')
    return contact

  let blockedX = (target.x > start.x && Math.abs(contact.x + contact.width - obstacleLeft) <= contactTolerance)
    || (target.x < start.x && Math.abs(contact.x - obstacleRight) <= contactTolerance)
  let blockedY = (target.y > start.y && Math.abs(contact.y + contact.height - obstacleTop) <= contactTolerance)
    || (target.y < start.y && Math.abs(contact.y - obstacleBottom) <= contactTolerance)
  // At a corner, keep the dominant movement axis free instead of locking both axes.
  // 拐角处放行位移较大的方向，避免两个方向同时锁死。
  if (blockedX && blockedY) {
    if (Math.abs(target.x - contact.x) >= Math.abs(target.y - contact.y))
      blockedX = false
    else
      blockedY = false
  }
  return updateHudRect(contact, 'move', blockedX ? 0 : target.x - contact.x, blockedY ? 0 : target.y - contact.y, bounds)
}

export function separateHudRect(rect: HudRect, obstacle: HudRect, bounds: HudBounds): HudRect {
  const candidate = fitHudRect(rect, bounds)
  const overlap = (next: HudRect) => next.x < obstacle.x + obstacle.width + HUD_GAP
    && next.x + next.width + HUD_GAP > obstacle.x
    && next.y < obstacle.y + obstacle.height + HUD_GAP
    && next.y + next.height + HUD_GAP > obstacle.y
  if (!overlap(candidate))
    return candidate

  const regions: HudBounds[] = [
    { ...bounds, bottom: Math.min(bounds.bottom, obstacle.y - HUD_GAP) },
    { ...bounds, top: Math.max(bounds.top, obstacle.y + obstacle.height + HUD_GAP) },
    { ...bounds, right: Math.min(bounds.right, obstacle.x - HUD_GAP) },
    { ...bounds, left: Math.max(bounds.left, obstacle.x + obstacle.width + HUD_GAP) },
  ]
  const placements = regions.filter(region => region.right > region.left && region.bottom > region.top)
    .map((region) => {
      const width = Math.min(candidate.width, region.right - region.left)
      const height = Math.min(candidate.height, region.bottom - region.top)
      return {
        x: clamp(candidate.x, region.left, region.right - width),
        y: clamp(candidate.y, region.top, region.bottom - height),
        width,
        height,
      }
    })
  const fullSize = placements.filter(next => next.width === candidate.width && next.height === candidate.height)
  const options = fullSize.length ? fullSize : placements
  options.sort((a, b) => {
    const areaDifference = b.width * b.height - a.width * a.height
    if (!fullSize.length && areaDifference)
      return areaDifference
    return (a.x - candidate.x) ** 2 + (a.y - candidate.y) ** 2
      - (b.x - candidate.x) ** 2 - (b.y - candidate.y) ** 2
  })
  return options[0] ?? candidate
}
