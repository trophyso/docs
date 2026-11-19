#!/usr/bin/env node
/**
 * Render the docs media mocks (mocks.tsx) and screenshot them into assets/.
 *
 * The mocks reuse the website's React components and Trophy Daylight styles,
 * so this needs the web repo checked out next to the docs (or WEB_REPO set)
 * with its dependencies installed. Nothing is installed here.
 *
 *   node scripts/media-mocks/render.mjs              # every mock
 *   node scripts/media-mocks/render.mjs points-awards # one or more by name
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const docsRoot = path.resolve(here, '../..')
const WEB = path.resolve(process.env.WEB_REPO ?? path.join(docsRoot, '../web'))
const req = createRequire(path.join(WEB, 'package.json'))
const out = path.join(here, '.build')
await mkdir(out, { recursive: true })

// 1. Bundle the mocks. "@/..." resolves into the web repo's src, like its tsconfig.
const esbuild = req('esbuild')
const shims = {
  'next/link': `import { forwardRef, createElement } from 'react'; export default forwardRef(function Link({ href, ...p }, ref) { return createElement('a', { href: typeof href === 'string' ? href : '#', ref, ...p }) })`,
  'next/image': `import { createElement } from 'react'; export default function Image({ src, fill, priority, ...p }) { return createElement('img', { src: typeof src === 'string' ? src : src?.src, ...p }) }`,
}
await esbuild.build({
  entryPoints: [path.join(here, 'entry.tsx')],
  outfile: path.join(out, 'bundle.js'),
  bundle: true,
  format: 'iife',
  jsx: 'automatic',
  logLevel: 'warning',
  nodePaths: [path.join(WEB, 'node_modules')],
  define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [
    {
      name: 'web-aliases',
      setup(build) {
        build.onResolve({ filter: /^@\// }, (args) =>
          build.resolve('./' + args.path.slice(2), { resolveDir: path.join(WEB, 'src'), kind: args.kind }),
        )
        build.onResolve({ filter: /^next\/(link|image)$/ }, (args) => ({ path: args.path, namespace: 'shim' }))
        build.onLoad({ filter: /.*/, namespace: 'shim' }, (args) => ({
          contents: shims[args.path],
          loader: 'js',
          resolveDir: path.join(WEB, 'node_modules'),
        }))
      },
    },
  ],
})

// 2. The web's stylesheet, with Tailwind scanning the mocks as well as the web's components.
const jiti = req('jiti')(WEB)
const baseConfig = jiti(path.join(WEB, 'tailwind.config.ts'))
const twConfig = {
  ...(baseConfig.default ?? baseConfig),
  content: [path.join(WEB, 'src/**/*.{js,jsx,ts,tsx}'), path.join(here, '*.tsx')],
}
const postcss = req('postcss')
const cssEntry = path.join(WEB, 'src/styles/tailwind.css')
const css = await postcss([req('postcss-import')(), req('tailwindcss')(twConfig), req('autoprefixer')()]).process(
  await readFile(cssEntry, 'utf8'),
  { from: cssEntry },
)
await writeFile(path.join(out, 'styles.css'), css.css)

// 3. The page: Daylight fonts and the afternoon sky, the docs' accent.
await writeFile(
  path.join(out, 'index.html'),
  `<!doctype html>
<html lang="en" data-sky="afternoon">
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300..800&family=Funnel+Sans:wght@300..800&family=Spline+Sans+Mono:wght@300..700&display=block" rel="stylesheet">
<link rel="stylesheet" href="styles.css">
<style>
  :root { --font-funnel-display: 'Funnel Display'; --font-funnel-sans: 'Funnel Sans'; --font-spline-sans-mono: 'Spline Sans Mono'; }
  body { margin: 0; padding: 40px; background: transparent; }
</style>
</head>
<body class="font-sans text-foreground antialiased">
<div id="root"></div>
<script src="bundle.js"></script>
</body>
</html>
`,
)

// 4. Screenshot each mock at 2x into the docs' assets.
const { MOCK_OUTPUTS } = await import(pathToFileURL(path.join(here, 'outputs.mjs')).href)
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(MOCK_OUTPUTS)
const { chromium } = req('playwright')
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 2 })
for (const name of names) {
  const target = MOCK_OUTPUTS[name]
  if (!target) throw new Error(`Unknown mock "${name}"`)
  await page.goto(pathToFileURL(path.join(out, 'index.html')).href + '?m=' + name)
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(400)
  const shot = page.locator('[data-shot]').first()
  await shot.screenshot({ path: path.join(docsRoot, target), omitBackground: true })
  console.log(`${name} → ${target}`)
}
await browser.close()
