export interface LottieTransform {
  a?: unknown
  o?: unknown
  p?: unknown
  r?: unknown
  s?: unknown
  [key: string]: unknown
}

export interface LottieLayer {
  ty: number
  refId?: string
  ind?: number
  ip?: number
  op?: number
  st?: number
  sr?: number
  w?: number
  h?: number
  ks?: LottieTransform
  [key: string]: unknown
}

export interface LottieAsset {
  id: string
  w?: number
  h?: number
  u?: string
  p?: string
  e?: number
  pr?: string
  t?: string
  layers?: LottieLayer[]
  [key: string]: unknown
}

export interface LottieDocument {
  v?: string
  nm?: string
  fr: number
  ip: number
  op: number
  w: number
  h: number
  layers: LottieLayer[]
  assets?: LottieAsset[]
  [key: string]: unknown
}

export interface ResolvedImageAsset {
  assetId: string
  asset: LottieAsset
  blob: Blob
  url: string
  sourceName: string
}

export interface LoadedLottieProject {
  name: string
  animation: LottieDocument
  images: Map<string, ResolvedImageAsset>
  warnings: string[]
  sourceBytes: number
}

export interface AtlasOptions {
  maxSize: 1024 | 2048 | 4096
  padding: number
  extrude: number
  allowRotation: boolean
  allowTrim: boolean
  detectIdentical: boolean
  powerOfTwo: boolean
  square: boolean
  alphaThreshold: number
}

export interface AtlasOutput {
  id: string
  filename: string
  blob: Blob
  width: number
  height: number
  objectUrl: string
}

export interface OptimizedLottieResult {
  animation: LottieDocument
  previewAnimation: LottieDocument
  atlases: AtlasOutput[]
  sourceImageCount: number
  packedImageCount: number
  occupancy: number
}
