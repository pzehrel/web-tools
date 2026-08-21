import type { LoadedLottieProject, LottieDocument, LottieLayer, ResolvedImageAsset } from '../lottie-preview/types'

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob)
        resolve(blob)
      else
        reject(new Error('示例图片生成失败'))
    }, 'image/png')
  })
}

function demoImage(draw: (ctx: CanvasRenderingContext2D, size: number) => void): Promise<Blob> {
  const size = 72
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return Promise.reject(new Error('浏览器不支持 Canvas 2D'))
  draw(ctx, size)
  return canvasBlob(canvas)
}

function imageLayer(id: string, refId: string, ind: number, position: unknown, rotation: unknown): Record<string, unknown> {
  return {
    ddd: 0,
    ind,
    ty: 2,
    nm: id,
    refId,
    w: 72,
    h: 72,
    sr: 1,
    ks: {
      o: { a: 0, k: 100 },
      r: rotation,
      p: position,
      a: { a: 0, k: [36, 36, 0] },
      s: { a: 0, k: [100, 100, 100] },
    },
    ao: 0,
    ip: 0,
    op: 120,
    st: 0,
    bm: 0,
  }
}

/** Lottie 内置示例：火箭（位移动画）+ 星星（旋转动画），canvas 现场生成两张 72×72 素材图 */
export async function createDemoProject(): Promise<LoadedLottieProject> {
  const [rocket, star] = await Promise.all([
    demoImage((ctx) => {
      ctx.translate(36, 36)
      ctx.fillStyle = '#7457ff'
      ctx.beginPath()
      ctx.moveTo(0, -30)
      ctx.lineTo(19, 13)
      ctx.lineTo(7, 10)
      ctx.lineTo(0, 28)
      ctx.lineTo(-7, 10)
      ctx.lineTo(-19, 13)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#ffe16b'
      ctx.fillRect(-5, -7, 10, 18)
    }),
    demoImage((ctx) => {
      ctx.translate(36, 36)
      ctx.fillStyle = '#43d69e'
      ctx.beginPath()
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? 28 : 12
        const angle = -Math.PI / 2 + i * Math.PI / 5
        const x = Math.cos(angle) * radius
        const y = Math.sin(angle) * radius
        if (i === 0)
          ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#2f2d2a'
      ctx.fillRect(11, -4, 10, 8)
    }),
  ])

  const animation: LottieDocument = {
    v: '5.13.0',
    fr: 30,
    ip: 0,
    op: 120,
    w: 480,
    h: 320,
    nm: 'Lottie Atlas Demo',
    assets: [
      { id: 'demo_rocket', w: 72, h: 72, u: 'images/', p: 'rocket.png', e: 0 },
      { id: 'demo_star', w: 72, h: 72, u: 'images/', p: 'star.png', e: 0 },
    ],
    layers: [
      imageLayer(
        'Rocket',
        'demo_rocket',
        1,
        {
          a: 1,
          k: [
            { t: 0, s: [80, 230, 0], e: [400, 90, 0], i: { x: 0.7, y: 1 }, o: { x: 0.3, y: 0 } },
            { t: 119, s: [400, 90, 0] },
          ],
        },
        { a: 1, k: [{ t: 0, s: [-25], e: [25] }, { t: 60, s: [25], e: [-25] }, { t: 119, s: [-25] }] },
      ),
      imageLayer(
        'Star',
        'demo_star',
        2,
        { a: 0, k: [240, 160, 0] },
        { a: 1, k: [{ t: 0, s: [0], e: [360] }, { t: 119, s: [360] }] },
      ),
    ] as unknown as LottieLayer[],
  }

  const blobs = new Map<string, Blob>([['demo_rocket', rocket], ['demo_star', star]])
  const images = new Map<string, ResolvedImageAsset>()
  for (const asset of animation.assets ?? []) {
    const blob = blobs.get(asset.id)!
    images.set(asset.id, {
      assetId: asset.id,
      asset,
      blob,
      url: URL.createObjectURL(blob),
      sourceName: asset.p!,
    })
  }
  return {
    name: 'lottie-atlas-demo',
    animation,
    images,
    warnings: [],
    sourceBytes: rocket.size + star.size + JSON.stringify(animation).length,
  }
}
