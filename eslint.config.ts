import antfu from '@antfu/eslint-config'

export default antfu(
  {
    react: true,
  },
  {
    // shadcn/ui 组件文件会同时导出组件与 variants 常量
    files: ['src/components/ui/**'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
)
