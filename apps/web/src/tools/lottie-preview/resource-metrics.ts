import type { LoadedLottieProject, OptimizedLottieResult, ResolvedImageAsset } from './types'

import { isAtlasOptimizableImage } from './atlas-optimizer'

export interface LottieResourceMetrics {
  activeTextureBytes: number
  activeTextureCount: number
  optimizedResourceBytes: number | null
  sourceDecodedBytes: number
  sourceImageCount: number
  sourcePixels: number
}

function imagePixels(image: ResolvedImageAsset): number {
  const width = image.asset.w ?? 0
  const height = image.asset.h ?? 0
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    return 0
  return width * height
}

function isExternalUnoptimizedImage(image: ResolvedImageAsset): boolean {
  return !isAtlasOptimizableImage(image)
    && image.asset.e !== 1
    && !image.asset.p?.startsWith('data:')
}

export function calculateLottieResourceMetrics(project: LoadedLottieProject, optimized: OptimizedLottieResult | null): LottieResourceMetrics {
  const sourceImages = [...project.images.values()]
  const sourcePixels = sourceImages.reduce((total, image) => total + imagePixels(image), 0)

  if (!optimized) {
    return {
      activeTextureBytes: sourcePixels * 4,
      activeTextureCount: sourceImages.length,
      optimizedResourceBytes: null,
      sourceDecodedBytes: sourcePixels * 4,
      sourceImageCount: sourceImages.length,
      sourcePixels,
    }
  }

  const unoptimizedImages = sourceImages.filter(image => !isAtlasOptimizableImage(image))
  const atlasPixels = optimized.atlases.reduce((total, atlas) => total + atlas.width * atlas.height, 0)
  const unoptimizedPixels = unoptimizedImages.reduce((total, image) => total + imagePixels(image), 0)
  const animationBytes = new TextEncoder().encode(JSON.stringify(optimized.animation, null, 2)).byteLength
  const atlasBytes = optimized.atlases.reduce((total, atlas) => total + atlas.blob.size, 0)
  const externalImageBytes = sourceImages
    .filter(isExternalUnoptimizedImage)
    .reduce((total, image) => total + image.blob.size, 0)

  return {
    activeTextureBytes: (atlasPixels + unoptimizedPixels) * 4,
    activeTextureCount: optimized.atlases.length + unoptimizedImages.length,
    optimizedResourceBytes: animationBytes + atlasBytes + externalImageBytes,
    sourceDecodedBytes: sourcePixels * 4,
    sourceImageCount: sourceImages.length,
    sourcePixels,
  }
}
