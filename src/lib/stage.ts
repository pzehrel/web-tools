/**
 * 画布舞台交互约定（点九图 / 帧动画等图像工具共用）：
 * - 滚轮 / 触控板捏合 / 触屏双指：缩放视图（只影响查看，不影响导出数据）
 * - 按住拖动：平移视野（滚轮被缩放占用后，靠它移动视野）
 * 设计规范见 docs/DESIGN.md「画布舞台」一节。
 */
import type { Dispatch, PointerEvent as ReactPointerEvent, RefObject, SetStateAction } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

/** 舞台缩放范围：滚轮 / 双指捏合共用 */
const MIN_ZOOM = 0.25
const MAX_ZOOM = 8

/** 指数缩放：每单位 delta 缩放固定倍率，手感均匀 */
export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
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
) {
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const setZoomRef = useRef(setZoom)
  setZoomRef.current = setZoom

  // 滚轮 / 触控板捏合
  useEffect(() => {
    const el = ref.current
    if (!el)
      return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      // 触控板捏合（ctrlKey）的 delta 更小更密，系数分开调
      const speed = e.ctrlKey ? 0.01 : 0.001
      setZoomRef.current(z => clampZoom(z * Math.exp(-e.deltaY * speed)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [ref])

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
      if (e.pointerType !== 'touch')
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
      if (touches.size === 2 && startDist > 0)
        setZoomRef.current(() => clampZoom(startZoom * distance() / startDist))
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
  }, [ref])
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
    resetPan,
    panHandlers: { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd },
  }
}
