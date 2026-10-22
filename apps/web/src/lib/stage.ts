/**
 * 画布舞台交互约定（点九图 / 帧动画等图像工具共用）：
 * - 滚轮 / 触控板捏合 / 触屏双指：缩放视图（只影响查看，不影响导出数据）
 * - 按住拖动：平移视野（滚轮被缩放占用后，靠它移动视野）
 * 设计规范见 docs/DESIGN.md「画布舞台」一节。
 */
import type { Dispatch, PointerEvent as ReactPointerEvent, RefObject, SetStateAction } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

/** 舞台缩放范围：滚轮 / 双指捏合共用 */
const MIN_ZOOM = 0.01
const MAX_ZOOM = 8
const ZOOM_INDICATOR_HIDE_DELAY = 1200

/** 指数缩放：每单位 delta 缩放固定倍率，手感均匀 */
export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
}

/**
 * 把一组内容的联合矩形完整放进舞台。返回的是 100% 视图对应的基础比例，
 * 用户缩放应在此基础上继续相乘。
 */
export function calculateStageFitScale(
  stageWidth: number,
  stageHeight: number,
  contentWidth: number,
  contentHeight: number,
  inset = 8,
): number {
  if (stageWidth <= 0 || stageHeight <= 0 || contentWidth <= 0 || contentHeight <= 0)
    return 1
  const availableWidth = Math.max(1, stageWidth - inset * 2)
  const availableHeight = Math.max(1, stageHeight - inset * 2)
  return Math.min(availableWidth / contentWidth, availableHeight / contentHeight)
}

interface StageRect { left: number, top: number, right: number, bottom: number }

// Choose the largest useful rectangle that does not intersect a visible HUD.
// 选择不与可见 HUD 相交、且最适合完整展示内容的矩形。
export function calculateUnobstructedStageFit(
  viewport: StageRect,
  overlays: StageRect[],
  contentWidth: number,
  contentHeight: number,
  inset = 8,
  gap = 8,
): { scale: number, offset: { x: number, y: number } } {
  if (contentWidth <= 0 || contentHeight <= 0)
    return { scale: 1, offset: { x: 0, y: 0 } }

  const clipped = overlays.map(rect => ({
    left: Math.max(viewport.left, rect.left - gap),
    top: Math.max(viewport.top, rect.top - gap),
    right: Math.min(viewport.right, rect.right + gap),
    bottom: Math.min(viewport.bottom, rect.bottom + gap),
  })).filter(rect => rect.left < rect.right && rect.top < rect.bottom)
  const xs = [...new Set([viewport.left, viewport.right, ...clipped.flatMap(rect => [rect.left, rect.right])])].sort((a, b) => a - b)
  const ys = [...new Set([viewport.top, viewport.bottom, ...clipped.flatMap(rect => [rect.top, rect.bottom])])].sort((a, b) => a - b)
  let best: { rect: StageRect, scale: number, area: number } | null = null

  for (let left = 0; left < xs.length - 1; left++) {
    for (let right = left + 1; right < xs.length; right++) {
      for (let top = 0; top < ys.length - 1; top++) {
        for (let bottom = top + 1; bottom < ys.length; bottom++) {
          const rect = { left: xs[left], right: xs[right], top: ys[top], bottom: ys[bottom] }
          if (clipped.some(hud => rect.left < hud.right && rect.right > hud.left && rect.top < hud.bottom && rect.bottom > hud.top))
            continue
          const width = rect.right - rect.left
          const height = rect.bottom - rect.top
          const scale = calculateStageFitScale(width, height, contentWidth, contentHeight, inset)
          const area = width * height
          if (!best || scale > best.scale || (scale === best.scale && area > best.area))
            best = { rect, scale, area }
        }
      }
    }
  }

  const rect = best?.rect ?? viewport
  return {
    scale: best?.scale ?? calculateStageFitScale(viewport.right - viewport.left, viewport.bottom - viewport.top, contentWidth, contentHeight, inset),
    offset: {
      x: (rect.left + rect.right - viewport.left - viewport.right) / 2,
      y: (rect.top + rect.bottom - viewport.top - viewport.bottom) / 2,
    },
  }
}

// Measure only HUDs currently painted on the stage when the user resets the view.
// 用户重置视图时，仅测量当前实际显示在舞台上的 HUD。
export function measureUnobstructedStageFit(
  area: HTMLElement,
  overlays: Iterable<HTMLElement>,
  contentWidth: number,
  contentHeight: number,
  inset = 8,
) {
  const visibleRects = [...overlays].filter((node) => {
    const style = getComputedStyle(node)
    return style.display !== 'none' && style.visibility !== 'hidden'
  }).map(node => node.getBoundingClientRect())
  return calculateUnobstructedStageFit(area.getBoundingClientRect(), visibleRects, contentWidth, contentHeight, inset)
}

/** 监听舞台尺寸，为一个或多个内容的联合矩形计算“适配 = 100%”基础比例。 */
export function useStageFitScale(
  ref: RefObject<HTMLElement | null>,
  contentWidth: number,
  contentHeight: number,
  enabled = true,
  inset = 8,
): number {
  const [fitScale, setFitScale] = useState(1)

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) {
      setFitScale(1)
      return
    }

    const update = () => {
      setFitScale(calculateStageFitScale(el.clientWidth, el.clientHeight, contentWidth, contentHeight, inset))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [contentHeight, contentWidth, enabled, inset, ref])

  return fitScale
}

/**
 * Follow the fitted scale until manual wheel or pinch zoom. Stage and content size
 * changes keep the whole content visible while untouched. Changing resetKey clears
 * manual zoom and restores fit. resetToFit serves the reset-view button and may
 * accept a measured safe-area scale. Later fit changes still update untouched views.
 *
 * 自动适配缩放：用户未手动缩放（滚轮 / 捏合）时，zoom 始终跟随传入的适配值——
 * 内容加载、舞台尺寸变化都会重新完整展示内容；resetKey 变化（换内容）时
 * 清除手动标记回到适配。resetToFit 供「重置视图」按钮使用。
 * 重置可传入按无遮挡区域测得的比例；之后适配比例变化时，未手动缩放的视图仍会更新。
 */
export function useAutoFitZoom(
  fit: number,
  resetKey: unknown,
): [number, Dispatch<SetStateAction<number>>, (override?: number) => void] {
  const [zoom, setZoomState] = useState(fit)
  const [touched, setTouched] = useState(false)
  const fitRef = useRef(fit)
  const previousFitRef = useRef(fit)
  if (previousFitRef.current !== fit) {
    previousFitRef.current = fit
    fitRef.current = fit
  }

  /** 手动缩放入口：标记 touched 后不再自动适配 */
  const setZoom = useCallback<Dispatch<SetStateAction<number>>>((update) => {
    setTouched(true)
    setZoomState(update)
  }, [])

  useEffect(() => {
    if (!touched)
      setZoomState(clampZoom(fitRef.current))
  }, [fit, touched])

  // 换内容：回到适配视图（fit 可能尚未更新，交给上面的 effect 纠正）
  useEffect(() => {
    setTouched(false)
    setZoomState(clampZoom(fitRef.current))
  }, [resetKey])

  const resetToFit = useCallback((override?: number) => {
    if (override !== undefined)
      fitRef.current = override
    setTouched(false)
    setZoomState(clampZoom(fitRef.current))
  }, [])

  return [zoom, setZoom, resetToFit]
}

/**
 * 舞台缩放手势：滚轮 + 触控板捏合（浏览器里表现为 ctrl+wheel）+ 触屏双指。
 * 注意 React 的 onWheel 是 passive 监听，preventDefault 无效，必须挂原生监听。
 * 舞台需配 touch-none，否则触屏双指会被浏览器页面缩放接管。
 */
export function useStageZoom(
  ref: RefObject<HTMLElement | null>,
  zoom: number,
  setZoom: Dispatch<SetStateAction<number>>,
  enabled = true,
) {
  const [zoomIndicatorVisible, setZoomIndicatorVisible] = useState(false)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const setZoomRef = useRef(setZoom)
  setZoomRef.current = setZoom
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const hideIndicatorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const revealZoomIndicator = useCallback(() => {
    setZoomIndicatorVisible(true)
    if (hideIndicatorTimerRef.current)
      clearTimeout(hideIndicatorTimerRef.current)
    hideIndicatorTimerRef.current = setTimeout(() => {
      hideIndicatorTimerRef.current = null
      setZoomIndicatorVisible(false)
    }, ZOOM_INDICATOR_HIDE_DELAY)
  }, [])

  useEffect(() => () => {
    if (hideIndicatorTimerRef.current)
      clearTimeout(hideIndicatorTimerRef.current)
  }, [])

  // 滚轮 / 触控板捏合
  useEffect(() => {
    const el = ref.current
    if (!el)
      return
    const onWheel = (e: WheelEvent) => {
      if (!enabledRef.current)
        return
      e.preventDefault()
      // 触控板捏合（ctrlKey）的 delta 更小更密，系数分开调
      const speed = e.ctrlKey ? 0.01 : 0.001
      setZoomRef.current(z => clampZoom(z * Math.exp(-e.deltaY * speed)))
      revealZoomIndicator()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ref, revealZoomIndicator])

  // 触屏双指捏合：跟踪两个 touch 指针的距离比
  useEffect(() => {
    const el = ref.current
    if (!el)
      return
    const touches = new Map<number, { x: number, y: number }>()
    let startDist = 0
    let startZoom = 1
    const distance = () => {
      const [a, b] = [...touches.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    const onDown = (e: PointerEvent) => {
      if (!enabledRef.current || e.pointerType !== 'touch')
        return
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (touches.size === 2) {
        startDist = distance()
        startZoom = zoomRef.current
      }
    }
    const onMove = (e: PointerEvent) => {
      if (!touches.has(e.pointerId))
        return
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (touches.size === 2 && startDist > 0) {
        setZoomRef.current(() => clampZoom(startZoom * distance() / startDist))
        revealZoomIndicator()
      }
    }
    const onUp = (e: PointerEvent) => {
      touches.delete(e.pointerId)
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }, [ref, revealZoomIndicator])

  return { zoomIndicatorVisible }
}

/**
 * 按住拖动平移舞台视图：transform 偏移模型，任何缩放级别都可拖
 * （scroll 式平移在内容不溢出时滚动范围为 0，拖了没反应）。
 * 调用方把 offset 套到内容层的 transform 上；offset 非零时给「回到居中」入口（resetPan）。
 * guard 返回 true 时跳过：按下的是切线 / 缩边等其他交互元素
 * （事件冒泡顺序保证内层元素的 pointerdown 先于舞台执行，其拖拽快照已就位）；
 * 按下的是按钮等可点元素时也跳过，否则 pointer capture 会吞掉 click。
 */
export function useStagePan(ref: RefObject<HTMLElement | null>, guard: () => boolean) {
  const [panning, setPanning] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const guardRef = useRef(guard)
  guardRef.current = guard
  const offsetRef = useRef(offset)
  offsetRef.current = offset
  const panRef = useRef<{ pointerId: number, startX: number, startY: number, baseX: number, baseY: number } | null>(null)

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const el = ref.current
    // 已有进行中的平移（如双指场景的第二指）不覆盖，交给捏合缩放
    if (!el || e.button !== 0 || panRef.current || guardRef.current())
      return
    if ((e.target as HTMLElement).closest('button, a, input, label, [role="switch"]'))
      return
    panRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, baseX: offsetRef.current.x, baseY: offsetRef.current.y }
    el.setPointerCapture(e.pointerId)
    setPanning(true)
  }, [ref])

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const pan = panRef.current
    if (!pan || pan.pointerId !== e.pointerId)
      return
    setOffset({ x: pan.baseX + e.clientX - pan.startX, y: pan.baseY + e.clientY - pan.startY })
  }, [])

  const onPointerEnd = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    if (panRef.current?.pointerId !== e.pointerId)
      return
    panRef.current = null
    setPanning(false)
  }, [])

  const resetPan = useCallback(() => setOffset({ x: 0, y: 0 }), [])

  return {
    panning,
    offset,
    setOffset,
    resetPan,
    panHandlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd },
  }
}
