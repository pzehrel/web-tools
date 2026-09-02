/**
 * 能力探测：前端 HTTP 驱动构造/首请求时调用。
 * 200 = 服务 + 数据库均可用；数据库不可达时 503。
 * ping 由组合根注入（pg 用 execute，d1 用 run），本路由保持运行时无关。
 */
export async function health(ping: () => Promise<unknown>): Promise<Response> {
  try {
    await ping()
    return Response.json({ ok: true })
  }
  catch {
    return Response.json({ ok: false }, { status: 503 })
  }
}
