#!/usr/bin/env node
/**
 * Pull frames from an existing docs video, to see what it showed before
 * scripting its replacement. Playwright's Chromium can't decode H.264, so this
 * uses an installed Chrome/Brave/Edge (or CHROME_PATH).
 *
 *   node frames.mjs ../../assets/features/metrics/create_new_metric.mp4 [count=6]
 *   → out/old/<video>/f00.png … and a printed duration/size
 */
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { chromium, here } from './capture.mjs'

const [file, countArg] = process.argv.slice(2)
if (!file) throw new Error('Usage: node frames.mjs <video.mp4> [count]')
const count = Number(countArg ?? 6)
const browsers = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
].filter(Boolean)
const executablePath = browsers.find((b) => existsSync(b))
if (!executablePath) throw new Error('Needs Chrome, Brave or Edge (H.264), or set CHROME_PATH')

const src = path.resolve(file)
const outDir = path.join(here, 'out', 'old', path.basename(src, path.extname(src)))
await mkdir(outDir, { recursive: true })
const browser = await chromium.launch({ executablePath })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
// Open the video file itself (a page made with setContent can't load file:// media)
await page.goto(pathToFileURL(src).href)
const video = page.locator('video')
await video.waitFor()
const meta = await video.evaluate(
  (v) => new Promise((r) => (v.readyState >= 1 ? r() : (v.onloadedmetadata = r))).then(() => ({ d: v.duration, w: v.videoWidth, h: v.videoHeight })),
)
console.log(`${path.basename(src)}: ${meta.d.toFixed(1)}s, ${meta.w}×${meta.h}`)
for (let i = 0; i < count; i++) {
  const t = (meta.d * (i + 0.5)) / count
  await video.evaluate((v, t) => new Promise((r) => { v.controls = false; v.pause(); v.onseeked = r; v.currentTime = t }), t)
  await video.screenshot({ path: path.join(outDir, `f${String(i).padStart(2, '0')}.png`) })
}
console.log(`Frames → ${path.relative(here, outDir)}/`)
await browser.close()
