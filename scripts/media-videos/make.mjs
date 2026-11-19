#!/usr/bin/env node
/**
 * Make a docs video end to end: capture the flow, render review stills,
 * render the MP4, and copy it to the flow's docs asset (meta.output).
 *
 *   node make.mjs <flow>                 capture + stills + render + copy
 *   node make.mjs <flow> --stills-only   capture + stills (iterate on the flow)
 *   node make.mjs <flow> --no-capture    reuse the last capture (iterate on the look)
 *   node make.mjs <flow> --no-copy       don't touch the docs asset
 *
 * Stills land in out/<flow>/: one just after each click, one per typed
 * field, three through the final zoom out, and the last frame. Look at them
 * before trusting the MP4.
 */
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { bundle } from '@remotion/bundler'
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer'

import { capture, docsRoot, here, loadFlow } from './capture.mjs'

const [name, ...flags] = process.argv.slice(2)
if (!name) throw new Error('Usage: node make.mjs <flow> [--stills-only] [--no-capture] [--no-copy]')
const has = (f) => flags.includes(f)
const { meta = {} } = await loadFlow(name)

if (!has('--no-capture')) await capture(name)
const manifest = JSON.parse(await readFile(path.join(here, 'public/captures', name, 'manifest.json'), 'utf8'))

const t = Date.now()
const serveUrl = await bundle({ entryPoint: path.join(here, 'src/index.ts') })
const inputProps = { name }
const composition = await selectComposition({ serveUrl, id: 'walkthrough', inputProps })
const { fps, durationInFrames } = composition
const { buildTimeline, INTRO, HOLD } = await import('./src/timeline.mjs')
// Event times after speed ramps, i.e. when they happen in the video
const timeline = buildTimeline(manifest)
const events = timeline.events

// Review stills: just after each click, at the end of each typed field,
// through the final zoom out (which starts HOLD after the last action and
// takes ~0.9s), and the last frame (after the loop cross-fade starts)
const outDir = path.join(here, 'out', name)
await mkdir(outDir, { recursive: true })
const moments = [
  ...events.filter((e) => e.type === 'click').map((e, i) => [`click-${i + 1}`, e.t + 0.35]),
  ...events.filter((e) => e.type === 'type').map((e, i) => [`typed-${i + 1}`, e.end + 0.1]),
  ...[0.25, 0.5, 0.75].map((p, i) => [`outro-${i + 1}`, timeline.lastAction + HOLD + 0.9 * p]),
  ['before-loop', timeline.lastAction + HOLD + 1.6],
]
const stills = [
  ...moments.map(([label, s]) => [label, Math.min(durationInFrames - 1, Math.round((s + INTRO) * fps))]),
  ['last', durationInFrames - 1],
]
for (const [label, frame] of stills) {
  const output = path.join(outDir, `${label}.png`)
  await renderStill({ serveUrl, composition, inputProps, frame, output, imageFormat: 'png' })
}
console.log(`Stills: ${stills.map(([l]) => `out/${name}/${l}.png`).join(', ')}`)
if (has('--stills-only')) process.exit(0)

const video = path.join(outDir, `${name}.mp4`)
await renderMedia({ serveUrl, composition, inputProps, codec: 'h264', crf: 18, outputLocation: video })
console.log(`Rendered ${(durationInFrames / fps).toFixed(1)}s → out/${name}/${name}.mp4 (${((Date.now() - t) / 1000).toFixed(0)}s)`)

if (meta.output && !has('--no-copy')) {
  await copyFile(video, path.join(docsRoot, meta.output))
  console.log(`Copied → ${meta.output}`)
}
