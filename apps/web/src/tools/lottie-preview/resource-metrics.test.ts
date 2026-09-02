import type { AtlasOutput, LoadedLottieProject, LottieAsset, OptimizedLottieResult, ResolvedImageAsset } from './types'

import { describe, expect, it } from 'vitest'
import { calculateLottieResourceMetrics } from './resource-metrics'

function image(asset: LottieAsset, size: number): ResolvedImageAsset {
  return {
    asset,
    assetId: asset.id,
    blob: new Blob([new Uint8Array(size)]),
    isAnimated: false,
    sourceName: asset.p ?? '',
    url: `blob:${asset.id}`,
  }
}

function project(...images: ResolvedImageAsset[]): LoadedLottieProject {
  return {
    animation: { assets: images.map(item => item.asset), fr: 24, h: 50, ip: 0, layers: [], op: 1, w: 100 },
    images: new Map(images.map(item => [item.assetId, item])),
    name: 'metrics',
    sourceBytes: 0,
    warnings: [],
  }
}

function optimizedResult(atlas: AtlasOutput): OptimizedLottieResult {
  const animation = { assets: [], fr: 24, h: 50, ip: 0, layers: [], op: 1, w: 100 }
  return {
    animation,
    atlases: [atlas],
    occupancy: 0.5,
    packedImageCount: 1,
    previewAnimation: animation,
    sourceImageCount: 1,
  }
}

describe('calculateLottieResourceMetrics', () => {
  const still = image({ id: 'still', h: 50, p: 'still.png', w: 100 }, 100)
  const sequence = image({ id: 'sequence', h: 10, p: 'frames/0.png', t: 'seq', w: 20 }, 50)

  it('estimates original RGBA decode and texture memory', () => {
    const metrics = calculateLottieResourceMetrics(project(still, sequence), null)

    expect(metrics).toMatchObject({
      activeTextureBytes: 5200 * 4,
      activeTextureCount: 2,
      optimizedResourceBytes: null,
      sourceDecodedBytes: 5200 * 4,
      sourceImageCount: 2,
      sourcePixels: 5200,
    })
  })

  it('counts an optimized image sequence as part of the atlas texture', () => {
    const atlas: AtlasOutput = {
      blob: new Blob([new Uint8Array(80)]),
      filename: 'atlas-1.png',
      height: 64,
      id: 'atlas',
      objectUrl: 'blob:atlas',
      width: 128,
    }
    const metrics = calculateLottieResourceMetrics(project(still, sequence), optimizedResult(atlas))

    expect(metrics.activeTextureCount).toBe(1)
    expect(metrics.activeTextureBytes).toBe(128 * 64 * 4)
    expect(metrics.optimizedResourceBytes).toBeGreaterThan(80)
  })

  it('keeps an animated image as a separate texture after optimization', () => {
    const animated = image({ id: 'animated', h: 10, p: 'animated.gif', w: 20 }, 50)
    animated.isAnimated = true
    const atlas: AtlasOutput = {
      blob: new Blob([new Uint8Array(80)]),
      filename: 'atlas-1.png',
      height: 64,
      id: 'atlas',
      objectUrl: 'blob:atlas',
      width: 128,
    }
    const metrics = calculateLottieResourceMetrics(project(still, animated), optimizedResult(atlas))

    expect(metrics.activeTextureCount).toBe(2)
    expect(metrics.activeTextureBytes).toBe((128 * 64 + 20 * 10) * 4)
    expect(metrics.optimizedResourceBytes).toBeGreaterThan(80 + 50)
  })
})
