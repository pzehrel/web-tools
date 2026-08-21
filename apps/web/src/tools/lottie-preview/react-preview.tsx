import type { LottieComponentProps, LottieRefCurrentProps } from 'lottie-react'
import type { ComponentType } from 'react'
import type { LottieDocument } from './types'

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface LottieReactPreviewProps {
  animation: LottieDocument
  currentFrame: number
  direction: 1 | -1
  fit: 'meet' | 'slice'
  loop: boolean
  onDurationChange: (frames: number) => void
  onError: (message: string) => void
  onFrameChange: (frame: number) => void
  playing: boolean
  renderer: 'canvas' | 'svg'
  seekToken: number
  speed: number
}

type LottieReactComponent = ComponentType<Omit<LottieComponentProps, 'renderer'> & {
  renderer: 'canvas' | 'svg'
}>

const LottieComponent = lazy(async () => {
  const module = await import('lottie-react')
  return { default: module.default as unknown as LottieReactComponent }
})

export function LottieReactPreview({
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
}: LottieReactPreviewProps) {
  const [readyConfiguration, setReadyConfiguration] = useState<{
    animation: LottieDocument
    fit: 'meet' | 'slice'
    loop: boolean
    renderer: 'canvas' | 'svg'
  } | null>(null)
  const lottieRef = useRef<LottieRefCurrentProps | null>(null)
  const frameRef = useRef(currentFrame)
  const playingRef = useRef(playing)
  const pauseTimerRef = useRef(0)
  const initializedRef = useRef(false)
  const revealedConfigurationRef = useRef<{
    animation: LottieDocument
    fit: 'meet' | 'slice'
    loop: boolean
    renderer: 'canvas' | 'svg'
  } | null>(null)
  const activeConfigurationRef = useRef<{
    animation: LottieDocument
    fit: 'meet' | 'slice'
    loop: boolean
    renderer: 'canvas' | 'svg'
  } | null>(null)

  frameRef.current = currentFrame
  playingRef.current = playing

  const activeConfiguration = activeConfigurationRef.current
  if (activeConfiguration?.animation !== animation
    || activeConfiguration.fit !== fit
    || activeConfiguration.loop !== loop
    || activeConfiguration.renderer !== renderer) {
    activeConfigurationRef.current = { animation, fit, loop, renderer }
    initializedRef.current = false
  }

  const ready = readyConfiguration?.animation === animation
    && readyConfiguration.fit === fit
    && readyConfiguration.loop === loop
    && readyConfiguration.renderer === renderer
  const animationData = useMemo(() => structuredClone(animation), [animation])

  useEffect(() => {
    return () => {
      window.clearTimeout(pauseTimerRef.current)
    }
  }, [])

  const markReady = useCallback(() => {
    const revealedConfiguration = revealedConfigurationRef.current
    if (revealedConfiguration?.animation !== animation
      || revealedConfiguration.fit !== fit
      || revealedConfiguration.loop !== loop
      || revealedConfiguration.renderer !== renderer) {
      const nextConfiguration = { animation, fit, loop, renderer }
      revealedConfigurationRef.current = nextConfiguration
      setReadyConfiguration(nextConfiguration)
    }
  }, [animation, fit, loop, renderer])

  const handleDOMLoaded = useCallback(() => {
    const item = lottieRef.current
    if (!item)
      return
    window.clearTimeout(pauseTimerRef.current)
    initializedRef.current = true
    item.setSpeed(speed)
    item.setDirection(direction)
    const duration = Math.max(1, Math.floor(item.getDuration(true) ?? 1))
    onDurationChange(duration)
    const targetFrame = Math.min(frameRef.current, duration - 1)
    item.goToAndPlay(targetFrame, true)
    if (playingRef.current) {
      item.play()
    }
    else {
      pauseTimerRef.current = window.setTimeout(() => {
        const currentItem = lottieRef.current
        if (!currentItem || playingRef.current)
          return
        currentItem.pause()
        currentItem.goToAndStop(targetFrame, true)
        markReady()
        onFrameChange(targetFrame)
      }, 50)
    }
  }, [direction, markReady, onDurationChange, onFrameChange, speed])

  const handleEnterFrame: NonNullable<LottieComponentProps['onEnterFrame']> = useCallback((event) => {
    if (!initializedRef.current || !playingRef.current)
      return
    markReady()
    if (event && 'currentTime' in event && typeof event.currentTime === 'number')
      onFrameChange(event.currentTime)
  }, [markReady, onFrameChange])

  useEffect(() => {
    lottieRef.current?.setSpeed(speed)
  }, [speed])

  useEffect(() => {
    lottieRef.current?.setDirection(direction)
  }, [direction])

  useEffect(() => {
    const item = lottieRef.current
    if (!item)
      return
    if (playing)
      item.play()
    else
      item.pause()
  }, [playing])

  useEffect(() => {
    const item = lottieRef.current
    if (!item)
      return
    item.goToAndStop(frameRef.current, true)
    if (playingRef.current)
      item.play()
  }, [seekToken])

  return (
    <div className="relative size-full">
      <Suspense
        fallback={(
          <div className="flex size-full items-center justify-center text-xs font-bold text-muted-foreground">
            正在加载 lottie-react…
          </div>
        )}
      >
        <LottieComponent
          key={`${fit}-${renderer}`}
          animationData={animationData}
          autoplay={false}
          loop={loop}
          lottieRef={lottieRef}
          onDOMLoaded={handleDOMLoaded}
          onEnterFrame={handleEnterFrame}
          onDataFailed={() => onError('Lottie 数据加载失败')}
          renderer={renderer}
          rendererSettings={{ preserveAspectRatio: `xMidYMid ${fit}` }}
          className={ready ? 'size-full opacity-100 [&>canvas]:size-full! [&>svg]:size-full!' : 'size-full opacity-0 [&>canvas]:size-full! [&>svg]:size-full!'}
          aria-label="lottie-react 动画预览画布"
        />
      </Suspense>
      {!ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-bold text-muted-foreground">
          准备渲染…
        </div>
      )}
    </div>
  )
}
