/**
 * 字体引擎封装：基于 fonteditor-core（浏览器端解析 / 子集化 / 格式转换）。
 *
 * woff2 编解码走 wasm。fonteditor-core 的 package exports 未暴露 woff2 目录，
 * 所以 wasm 复制到了 public/wasm/ 下，按静态资源路径加载。
 */
import type { TTF } from 'fonteditor-core'
import { deflateSync, inflateSync } from 'fflate'
import { createFont, woff2 } from 'fonteditor-core'

const WOFF2_WASM_PATH = '/wasm/woff2.wasm'

export type FontFormat = 'ttf' | 'otf' | 'woff' | 'woff2'

export interface FontCharsetStats {
  /** 字体里映射了 unicode 的 glyph 数 */
  mappedGlyphs: number
  /** 中日韩统一表意文字（含扩展 A）glyph 数 */
  hanGlyphs: number
  /** 覆盖的码点集合 */
  codePoints: Set<number>
}

export interface FontCheckReport {
  familyName: string
  subfamilyName: string
  format: FontFormat
  unitsPerEm: number
  /** OS/2 usWeightClass */
  weightClass: number
  glyphCount: number
  charset: FontCharsetStats
  /** 逐字符集的缺字统计 */
  coverage: Array<{ label: string, total: number, covered: number, missing: string }>
}

export interface SubsetResult {
  format: FontFormat
  buffer: ArrayBuffer
  /** 实际保留的 glyph 数 */
  glyphCount: number
}

/** 探测字体格式（按魔数） */
export function detectFormat(buffer: ArrayBuffer): FontFormat | null {
  const u8 = new Uint8Array(buffer, 0, 4)
  if (u8[0] === 0x77 && u8[1] === 0x4F && u8[2] === 0x46 && u8[3] === 0x32)
    return 'woff2'
  if (u8[0] === 0x77 && u8[1] === 0x4F && u8[2] === 0x46 && u8[3] === 0x46)
    return 'woff'
  if (u8[0] === 0x74 && u8[1] === 0x74 && u8[2] === 0x63 && u8[3] === 0x66)
    return 'ttc' as never // TTC 集合字体暂不支持，调用方会提示
  if (u8[0] === 0x00 && u8[1] === 0x01 && u8[2] === 0x00 && u8[3] === 0x00)
    return 'ttf'
  if (u8[0] === 0x4F && u8[1] === 0x54 && u8[2] === 0x54 && u8[3] === 0x4F)
    return 'otf'
  if (u8[0] === 0x74 && u8[1] === 0x72 && u8[2] === 0x75 && u8[3] === 0x65)
    return 'ttf'
  return null
}

let woff2Ready: Promise<void> | null = null

/** 初始化 woff2 wasm（幂等） */
export function ensureWoff2(): Promise<void> {
  if (!woff2Ready) {
    woff2Ready = woff2.init(WOFF2_WASM_PATH).then(() => undefined)
  }
  return woff2Ready
}

function isHan(cp: number): boolean {
  return (cp >= 0x4E00 && cp <= 0x9FFF) || (cp >= 0x3400 && cp <= 0x4DBF)
}

/** 按 glyph 维度统计汉字 glyph 数 */
function countHanGlyphs(data: TTF.TTFObject): number {
  let han = 0
  for (const glyph of data.glyf) {
    if (glyph.unicode && glyph.unicode.length > 0 && glyph.unicode.some(isHan))
      han++
  }
  return han
}

function inflateWrapper(data: number[]): number[] {
  return Array.from(inflateSync(new Uint8Array(data)))
}

function deflateWrapper(data: number[]): number[] {
  return Array.from(deflateSync(new Uint8Array(data)))
}

export interface ParsedFont {
  font: ReturnType<typeof createFont>
  data: TTF.TTFObject
  format: FontFormat
  /** 原始文件字节（子集化时重新 read 用） */
  rawBuffer: ArrayBuffer
  /** 原始文件大小（字节） */
  rawSize: number
}

/** 解析字体（woff2 输入会先等待 wasm 初始化） */
export async function parseFont(buffer: ArrayBuffer, format: FontFormat): Promise<ParsedFont> {
  if (format === 'woff2')
    await ensureWoff2()
  const font = createFont(buffer, {
    type: format,
    hinting: true,
    kerning: true,
    compound2simple: true,
    // woff 解压：fflate 的 inflate 返回 Uint8Array，这里按 fonteditor 预期的 number[] 协议包装
    inflate: format === 'woff' ? inflateWrapper : undefined,
  })
  const data = font.get()
  return { font, data, format, rawBuffer: buffer, rawSize: buffer.byteLength }
}

/** 统计字符集覆盖情况 */
export function buildCharsetStats(data: TTF.TTFObject): FontCharsetStats {
  const codePoints = new Set<number>()
  for (const glyph of data.glyf) {
    if (!glyph.unicode)
      continue
    for (const cp of glyph.unicode)
      codePoints.add(cp)
  }
  return { mappedGlyphs: codePoints.size, hanGlyphs: countHanGlyphs(data), codePoints }
}

/** 体检报告 */
export function buildCheckReport(
  parsed: ParsedFont,
  charsetGroups: Array<{ label: string, chars: string }>,
): FontCheckReport {
  const { data } = parsed
  const stats = buildCharsetStats(data)
  const coverage = charsetGroups.map(({ label, chars }) => {
    const unique = [...new Set([...chars])]
    const missing = unique.filter(ch => !stats.codePoints.has(ch.codePointAt(0)!))
    return { label, total: unique.length, covered: unique.length - missing.length, missing: missing.join('') }
  })
  const os2 = (data as any).OS2 as { usWeightClass?: number } | undefined
  return {
    familyName: data.name.fontFamily || '未知',
    subfamilyName: data.name.fontSubfamily || '',
    format: parsed.format,
    unitsPerEm: data.head.unitsPerEm || 1000,
    weightClass: os2?.usWeightClass ?? 400,
    glyphCount: data.glyf.length,
    charset: stats,
    coverage,
  }
}

export interface SubsetOptions {
  /** 要保留的码点集合 */
  codePoints: Set<number>
  outputFormat: FontFormat
  /** 保留 hinting（Windows 渲染清晰度相关） */
  hinting: boolean
  /** 保留 kerning（字偶间距） */
  kerning: boolean
}

/** 子集化并输出目标格式 */
export async function subsetFont(parsed: ParsedFont, options: SubsetOptions): Promise<SubsetResult> {
  if (options.outputFormat === 'woff2')
    await ensureWoff2()
  const sub = createFont(parsed.rawBuffer, {
    type: parsed.format,
    hinting: true,
    kerning: true,
    compound2simple: true,
    inflate: parsed.format === 'woff' ? inflateWrapper : undefined,
  })
  const keep = new Set(options.codePoints)
  const data = sub.get()
  const glyphs = data.glyf.filter((glyph) => {
    if (!glyph.unicode || glyph.unicode.length === 0)
      return false
    return glyph.unicode.some(cp => keep.has(cp))
  })
  data.glyf = glyphs
  sub.set(data)
  const buffer = sub.write({
    type: options.outputFormat,
    toBuffer: false,
    hinting: options.hinting,
    kerning: options.kerning,
    deflate: options.outputFormat === 'woff' ? deflateWrapper : undefined,
  }) as ArrayBuffer
  return { format: options.outputFormat, buffer, glyphCount: glyphs.length }
}

/** 全量格式转换（不做子集化） */
export async function convertFont(buffer: ArrayBuffer, from: FontFormat, to: FontFormat): Promise<SubsetResult> {
  if (from === 'woff2' || to === 'woff2')
    await ensureWoff2()
  const font = createFont(buffer, {
    type: from,
    hinting: true,
    kerning: true,
    inflate: from === 'woff' ? inflateWrapper : undefined,
  })
  const out = font.write({
    type: to,
    toBuffer: false,
    hinting: true,
    kerning: true,
    deflate: to === 'woff' ? deflateWrapper : undefined,
  }) as ArrayBuffer
  return { format: to, buffer: out, glyphCount: font.get().glyf.length }
}

/** 用 FontFace API 在页面里注册字体用于预览；返回注销函数 */
export async function registerPreviewFont(family: string, buffer: ArrayBuffer): Promise<() => void> {
  const face = new FontFace(family, buffer)
  await face.load()
  document.fonts.add(face)
  return () => document.fonts.delete(face)
}
