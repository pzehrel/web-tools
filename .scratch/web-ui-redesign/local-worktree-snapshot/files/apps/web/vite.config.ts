// 载入 ssgOptions 的类型增强
import type {} from 'vite-react-ssg'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/postcss'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  css: {
    preprocessorOptions: {
      scss: {
        // Compile the review palette only for the development server.
        // 评审色板只在开发服务器中编译。
        additionalData: `$prototype-palette: ${command === 'serve'};`,
      },
    },
    // @tailwindcss/vite 只处理 .css 文件，本项目样式全部是 .scss，
    // 因此改用 PostCSS 版本：它在 sass 编译产物上运行
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  ssgOptions: {
    // 嵌套目录输出：/tools/url-qrcode -> /tools/url-qrcode/index.html，静态托管直出
    dirStyle: 'nested',
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
}))
