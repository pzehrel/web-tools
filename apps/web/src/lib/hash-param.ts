/**
 * 页面内容与 URL hash 双向同步。
 *
 * 为什么用 hash 而不是 query：内容可能很长（如嵌套 URL），
 * hash 不进服务器日志 / CDN 缓存键，SSG 站点的 canonical 也保持干净。
 * 同步用 replaceState，输入过程不产生历史记录。
 */

/** 从 URL hash 读取初始内容：支持 `#key=value` 和裸 `#value` 两种形式 */
export function readHashParam(key: string): string | null {
  const hash = window.location.hash.slice(1)
  if (!hash)
    return null
  const prefix = `${key}=`
  const raw = hash.startsWith(prefix) ? hash.slice(prefix.length) : hash
  try {
    return decodeURIComponent(raw)
  }
  catch {
    return raw
  }
}

/** 把内容写入 URL hash（replaceState），内容为空时清除 hash */
export function writeHashParam(key: string, value: string): void {
  const url = new URL(window.location.href)
  url.hash = value ? `${key}=${encodeURIComponent(value)}` : ''
  window.history.replaceState(null, '', url)
}
