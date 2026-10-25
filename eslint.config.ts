import antfu from '@antfu/eslint-config'

export default antfu(
  {
    react: true,
    typescript: true,
    stylistic: true,
    markdown: false,
    formatters: {
      markdown: true,
    },
    // drizzle-kit 生成的迁移与快照是构建产物，不做格式检查
    ignores: ['apps/server/drizzle/**', 'apps/server/drizzle-d1/**'],
  },
  {
    // shadcn/ui 组件文件会同时导出组件与 variants 常量
    files: ['apps/web/src/components/ui/**'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // 这些模块有意共置组件与共享常量/Hook，保持现有公开接口。
    // These modules intentionally colocate components with shared constants/hooks.
    files: [
      'apps/web/src/components/seo.tsx',
      'apps/web/src/components/stage-view-controls.tsx',
    ],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
)
