import type { LoadedLottieProject, LottieAsset, LottieDocument, ResolvedImageAsset } from './types'

import { describe, expect, it } from 'vitest'
import { countAtlasOptimizableImages, isAtlasOptimizableImage } from './atlas-optimizer'
import { createPreviewAnimation, isPreviewImageAsset } from './import-files'

function resolvedImage(asset: LottieAsset, url: string): ResolvedImageAsset {
  return {
    asset,
    assetId: asset.id,
    blob: new Blob(),
    isAnimated: false,
    sourceName: asset.p ?? '',
    url,
  }
}

function projectWith(...images: ResolvedImageAsset[]): LoadedLottieProject {
  const animation: LottieDocument = {
    assets: images.map(image => image.asset),
    fr: 24,
    h: 100,
    ip: 0,
    layers: [],
    op: 2,
    w: 100,
  }
  return {
    animation,
    images: new Map(images.map(image => [image.assetId, image])),
    name: 'test',
    sourceBytes: 0,
    warnings: [],
  }
}

describe('lottie image sequence assets', () => {
  const stillAsset: LottieAsset = { id: 'still', h: 100, p: 'still.png', w: 100 }
  const sequenceAsset: LottieAsset = { id: 'sequence', h: 100, p: 'frame-0.png', t: 'seq', w: 100 }

  it('loads sequence images for preview and includes them in atlas optimization', () => {
    const still = resolvedImage(stillAsset, 'blob:still')
    const sequence = resolvedImage(sequenceAsset, 'blob:sequence')
    const project = projectWith(still, sequence)

    expect(isPreviewImageAsset(sequenceAsset)).toBe(true)
    expect(isAtlasOptimizableImage(sequence)).toBe(true)
    expect(countAtlasOptimizableImages(project)).toBe(2)
  })

  it('rewrites a sequence image path to its local preview URL', () => {
    const project = projectWith(resolvedImage(sequenceAsset, 'blob:sequence'))
    const preview = createPreviewAnimation(project)

    expect(preview.assets?.[0]).toMatchObject({ e: 1, p: 'blob:sequence', t: 'seq', u: '' })
    expect(project.animation.assets?.[0]).toMatchObject({ p: 'frame-0.png', t: 'seq' })
    expect(project.animation.assets?.[0]).not.toHaveProperty('e')
  })

  it('keeps animated images out of atlas optimization', () => {
    const animated = resolvedImage(stillAsset, 'blob:animated')
    animated.isAnimated = true

    expect(isPreviewImageAsset(stillAsset)).toBe(true)
    expect(isAtlasOptimizableImage(animated)).toBe(false)
  })
})

describe('safe transient preview', () => {
  it('replaces unresolved image URLs without changing the original project', () => {
    const project = projectWith()
    project.animation.assets = [
      { id: 'remote', w: 10, h: 10, u: 'https://example.invalid/', p: 'image.png' },
      { id: 'missing', w: 10, h: 10, p: 'missing.png' },
    ]
    const preview = createPreviewAnimation(project)
    for (const asset of preview.assets ?? []) {
      expect(asset.p).toMatch(/^data:image\/png;base64,/)
      expect(asset.u).toBe('')
      expect(asset.e).toBe(1)
    }
    expect(project.animation.assets[0].u).toBe('https://example.invalid/')
    expect(project.animation.assets[1].p).toBe('missing.png')
  })
})
