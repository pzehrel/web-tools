import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'

import type { LoadedLottieProject } from './types'
import { createLottieArchive } from './records'

describe('lottie records', () => {
  it('packs data.json and referenced local image assets into a restorable zip', async () => {
    const animation = {
      fr: 30,
      ip: 0,
      op: 60,
      w: 320,
      h: 180,
      layers: [{ ty: 2, refId: 'image_0' }],
      assets: [{ id: 'image_0', u: 'images/', p: 'dot.png', w: 8, h: 8 }],
    }
    const asset = animation.assets[0]
    const project: LoadedLottieProject = {
      name: 'demo',
      animation,
      images: new Map([['image_0', {
        assetId: 'image_0',
        asset,
        blob: new Blob(['image'], { type: 'image/png' }),
        isAnimated: false,
        url: 'blob:test',
        // 内置项目可能只有文件名；归档路径应以 asset.u + asset.p 为准。
        sourceName: 'dot.png',
      }]]),
      warnings: [],
      sourceBytes: 5,
    }

    const archive = unzipSync(new Uint8Array(await (await createLottieArchive(project)).arrayBuffer()))
    expect(Object.keys(archive).sort()).toEqual(['data.json', 'images/dot.png'])
    expect(new TextDecoder().decode(archive['images/dot.png'])).toBe('image')
    expect(JSON.parse(new TextDecoder().decode(archive['data.json']))).toMatchObject({ w: 320, h: 180, fr: 30 })
  })
})
