import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/** 两个入口分别构建：侧边栏（无图表库）与完整看板（ECharts 按需注册）。 */
export default defineConfig(({ mode }) => {
  const view = mode === 'dashboard' ? 'dashboard' : 'sidebar'
  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    base: './',
    plugins: [vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      target: 'es2022',
      outDir: fileURLToPath(new URL(`../dist/webview/${view}`, import.meta.url)),
      emptyOutDir: true,
      cssCodeSplit: false,
      assetsInlineLimit: 0,
      reportCompressedSize: false,
      rollupOptions: {
        input: fileURLToPath(new URL(`./src/${view}/main.ts`, import.meta.url)),
        output: {
          entryFileNames: `${view}.js`,
          inlineDynamicImports: true,
          assetFileNames: 'style[extname]',
        },
      },
    },
  }
})
