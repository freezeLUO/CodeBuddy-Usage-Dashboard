/** @type {import('tailwindcss').Config} */
export default {
  content: ['./webview/src/**/*.{vue,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--vscode-font-family)', 'Segoe UI', 'PingFang SC', 'sans-serif'],
        mono: ['var(--vscode-editor-font-family)', 'Consolas', 'monospace'],
      },
    },
  },
  corePlugins: {
    preflight: true,
  },
  plugins: [],
}
