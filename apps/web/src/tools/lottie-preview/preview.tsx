import type { AnimationItem, RendererType } from 'lottie-web'
import type { LottieDocument } from './types'

import { useEffect, useRef, useState } from 'react'

interface LottiePreviewProps {
  animation: LottieDocument | null
  currentFrame: number
  direction: 1 | -1
  fit: 'meet' | 'slice'
  loop: boolean
  onDurationChange: (frames: number) => void
  onError: (message: string) => void
  onFrameChange: (frame: number) => void
  playing: boolean
  renderer: Extract<RendererType, 'canvas' | 'svg'>
  seekToken: number
  speed: number
}

export function LottiePreview({
  animation,
  currentFrame,
  direction,
  fit,
  loop,
  onDurationChange,
  onError,
  onFrameChange,
  playing,
  renderer,
  seekToken,
  speed,
}: LottiePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<AnimationItem | null>(null)
  const [readyConfiguration, setReadyConfiguration] = useState<{
    animation: LottieDocument
    fit: 'meet' | 'slice'
    renderer: Extract<RendererType, 'canvas' | 'svg'>
  } | null>(null)
  const frameRef = useRef(currentFrame)
  const playingRef = useRef(playing)
  const loopRef = useRef(loop)
  const speedRef = useRef(speed)
  const directionRef = useRef(direction)
  const durationCallbackRef = useRef(onDurationChange)
  const errorCallbackRef = useRef(onError)
  const frameCallbackRef = useRef(onFrameChange)

  frameRef.current = currentFrame
  playingRef.current = playing
  loopRef.current = loop
  speedRef.current = speed
  directionRef.current = direction
  durationCallbackRef.current = onDurationChange
  errorCallbackRef.current = onError
  frameCallbackRef.current = onFrameChange

  const ready = readyConfiguration?.animation === animation
    && readyConfiguration.fit === fit
    && readyConfiguration.renderer === renderer

  useEffect(() => {
    const container = containerRef.current
    if (!container || !animation)
      return
    let cancelled = false
    let item: AnimationItem | null = null
    let removeListeners: Array<() => void> = []
    let readinessTimer = 0
    let pauseTimer = 0

    void import('lottie-web').then(({ default: lottie }) => {
      if (cancelled)
        return
      item = lottie.loadAnimation({
        animationData: structuredClone(animation),
        autoplay: false,
        container,
        loop: loopRef.current,
        renderer,
        rendererSettings: {
          clearCanvas: true,
          progressiveLoad: true,
          preserveAspectRatio: `xMidYMid ${fit}`,
        },
      })
      animationRef.current = item
      item.setSpeed(speedRef.current)
      item.setDirection(directionRef.current)
      let initialized = false
      let revealed = false
      const onLoaded = () => {
        if (!item || initialized || cancelled)
          return
        if (!container.firstElementChild) {
          readinessTimer = window.setTimeout(onLoaded, 16)
          return
        }
        initialized = true
        durationCallbackRef.current(Math.max(1, Math.floor(item.getDuration(true))))
        const targetFrame = Math.min(frameRef.current, item.totalFrames - 1)
        item.goToAndPlay(targetFrame, true)
        if (playingRef.current) {
          item.play()
        }
        else {
          pauseTimer = window.setTimeout(() => {
            if (!item || cancelled || playingRef.current)
              return
            item.pause()
            item.goToAndStop(targetFrame, true)
            revealed = true
            setReadyConfiguration({ animation, fit, renderer })
            frameCallbackRef.current(targetFrame)
          }, 50)
        }
      }
      const onEnterFrame = (event: { currentTime: number }) => {
        if (!initialized || !playingRef.current)
          return
        if (!revealed) {
          revealed = true
          setReadyConfiguration({ animation, fit, renderer })
        }
        frameCallbackRef.current(event.currentTime)
      }
      const onDataFailed = () => errorCallbackRef.current('Lottie 数据加载失败')
      removeListeners = [
        item.addEventListener('DOMLoaded', onLoaded),
        item.addEventListener('enterFrame', onEnterFrame),
        item.addEventListener('data_failed', onDataFailed),
      ]
      if (item.isLoaded)
        readinessTimer = window.setTimeout(onLoaded, 500)
    }).catch(() => errorCallbackRef.current('lottie-web 加载失败'))

    return () => {
      cancelled = true
      window.clearTimeout(readinessTimer)
      window.clearTimeout(pauseTimer)
      for (const removeListener of removeListeners)
        removeListener()
      if (item)
        item.destroy()
      if (animationRef.current === item)
        animationRef.current = null
      container.replaceChildren()
    }
  }, [animation, fit, renderer])

  useEffect(() => {
    const item = animationRef.current
    if (!item)
      return
    item.setLoop(loop)
  }, [loop])

  useEffect(() => {
    const item = animationRef.current
    if (!item)
      return
    item.setSpeed(speed)
  }, [speed])

  useEffect(() => {
    const item = animationRef.current
    if (!item)
      return
    item.setDirection(direction)
  }, [direction])

  useEffect(() => {
    const item = animationRef.current
    if (!item)
      return
    if (playing)
      item.play()
    else
      item.pause()
  }, [playing])

  useEffect(() => {
    const item = animationRef.current
    if (!item)
      return
    item.goToAndStop(frameRef.current, true)
    if (playingRef.current)
      item.play()
  }, [seekToken])

  return (
    <div className="relative size-full">
      <div
        ref={containerRef}
        className={ready
          ? 'size-full opacity-100 [&>canvas]:size-full! [&>svg]:size-full!'
          : 'size-full opacity-0 [&>canvas]:size-full! [&>svg]:size-full!'}
        aria-label="lottie-web 动画预览画布"
      />
      {!ready && animation && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-bold text-muted-foreground">
          准备渲染…
        </div>
      )}
    </div>
  )
}
