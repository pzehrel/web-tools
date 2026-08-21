/**
 * 环境变量集中读取与校验。
 * 全部有本地开发友好的默认值；生产（Docker）通过 env 覆盖。
 */
import process from 'node:process'

function int(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(value ?? '', 10)
  return Number.isFinite(n) ? n : fallback
}

export const env = {
  /** HTTP 端口 */
  port: int(process.env.PORT, 8787),
  /** Postgres 连接串（调试时可指向内网 dev 机器） */
  databaseUrl: process.env.DATABASE_URL
    ?? 'postgres://webtools:webtools@localhost:5432/webtools',
  /** 文件存储根目录（FsBlobStore） */
  dataDir: process.env.DATA_DIR ?? './data/files',
  /**
   * 信任的反代层数（X-Forwarded-For 解析用）。
   * Docker 部署通常在反代之后，设为 1。
   */
  trustProxy: int(process.env.TRUST_PROXY, 0),
} as const
