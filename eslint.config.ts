import antfu from '@antfu/eslint-config'

export default antfu(
  {
    react: true,
    stylistic: true,
    markdown: false,
    formatters: {
      markdown: true,
    },
  },
  {
    // shadcn/ui 组件文件会同时导出组件与 variants 常量
    files: ['apps/web/src/components/ui/**'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
)
