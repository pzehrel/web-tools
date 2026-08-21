import jsQR from 'jsqr'
import QRCode from 'qrcode'

/** 文本转二维码，返回 PNG dataURL。level 越低冗余越少、码点越疏，长内容建议用 'L' */
export async function encodeQr(text: string, level: 'L' | 'M' | 'Q' | 'H' = 'M'): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 320,
    errorCorrectionLevel: level,
  })
}

/** 从图片文件中识别二维码内容，识别不到返回 null */
export async function decodeQr(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx)
    return null
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const result = jsQR(imageData.data, imageData.width, imageData.height)
  return result?.data ?? null
}
