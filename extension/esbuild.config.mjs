import * as esbuild from 'esbuild'

const watch = process.argv.includes('--watch')
const production = process.env.NODE_ENV === 'production'

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  outfile: 'dist/extension.js',
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['vscode'],
  sourcemap: production ? false : 'linked',
  minify: production,
  logLevel: 'info',
}

if (watch) {
  const context = await esbuild.context(options)
  await context.watch()
  console.log('[esbuild] watching src/extension.ts')
} else {
  await esbuild.build(options)
}
