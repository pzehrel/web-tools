/**
 * SSG 构建入口。
 * 不使用 vite-react-ssg 自带的 CLI：它的 yargs 命令在部分 Node 版本（如 v24）下
 * 对异步 handler 是 fire-and-forget，进程会在构建启动前静默退出。
 * 直接 await build() 可以保证进程存活到构建结束。
 * ssgOptions 已在 vite.config.ts 中配置（dirStyle: 'nested'）。
 */
import { build } from 'vite-react-ssg/node'

await build({}, {})
