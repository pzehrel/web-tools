import process from 'node:process'

// Node 22 原生加载 apps/server/.env；已由部署环境注入的变量优先级更高。
try {
  process.loadEnvFile()
}
catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
    throw error
}
