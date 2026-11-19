#!/usr/bin/env node
/**
 * Capture a dashboard walkthrough for a docs video.
 *
 * Runs a flow (flows/<name>.mjs) against the dashboard in Playwright, records
 * Chrome's screencast frames at 2x, and logs every action (where the cursor
 * goes, what is clicked, what is typed). The Remotion composition (src/)
 * turns the frames and the log into the video. Usually run through make.mjs.
 *
 *   node capture.mjs <flow>
 *
 * Env: PROFILE_DIR (signed-in profile; default ~/.trophy-docs-media/profile,
 * create it with `node login.mjs`), DASHBOARD_URL (default staging),
 * WEB_REPO (for Playwright; default ../web next to the docs).
 * Output: public/captures/<flow>/{frames/*.jpg, manifest.json}
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const here = path.dirname(fileURLToPath(import.meta.url))
export const docsRoot = path.resolve(here, '../..')
const WEB = path.resolve(process.env.WEB_REPO ?? path.join(docsRoot, '../web'))
export const { chromium } = createRequire(path.join(WEB, 'package.json'))('playwright')

// Optional staging credentials (STAGING_EMAIL, STAGING_PASSWORD) from a gitignored .env
try {
  process.loadEnvFile(path.join(here, '.env'))
} catch {}

export const BASE = process.env.DASHBOARD_URL ?? 'https://staging-app.trophy.so'
export const PROFILE_DIR = process.env.PROFILE_DIR ?? path.join(os.homedir(), '.trophy-docs-media', 'profile')
const VIEWPORT = { width: 1440, height: 900 }
const SCALE = 2

/**
 * Tidy the dashboard for recording, and keep it tidy as React re-renders:
 * hide the staging-only org id badge and the multi-tenant selector (the test
 * org's tenants use real company names), and give the sidebar's usage card a
 * realistic number.
 */
const TIDY = () => {
  const run = () => {
    for (const el of document.querySelectorAll('body *')) {
      const text = (el.textContent || '').trim()
      if (el.children.length === 0 && /^org_[A-Za-z0-9]{10,}$/.test(text)) {
        let n = el
        while (n.parentElement && (n.parentElement.textContent || '').trim() === text) n = n.parentElement
        n.style.display = 'none'
      }
      if (el.children.length === 0 && text === '0 MAUs') {
        el.textContent = '6,248 MAUs'
        const bar = el.parentElement?.parentElement?.querySelector('[style*="width"]')
        if (bar) bar.style.width = '62%'
      }
    }
    for (const el of document.querySelectorAll('button, [aria-haspopup]')) {
      if ((el.textContent || '').trim() === 'Customer A') {
        const n = el.parentElement && el.parentElement.children.length === 1 ? el.parentElement : el
        n.style.display = 'none'
      }
    }
  }
  const start = () => {
    run()
    new MutationObserver(run).observe(document.body, { childList: true, subtree: true, characterData: true })
  }
  if (document.body) start()
  else document.addEventListener('DOMContentLoaded', start)
}

/**
 * Fill Clerk's sign-in form from STAGING_EMAIL / STAGING_PASSWORD. Returns
 * true once the dashboard loads. Email codes or bot checks need a person:
 * then run login.mjs (visible browser) instead.
 */
export async function signIn(page) {
  const { STAGING_EMAIL: email, STAGING_PASSWORD: password } = process.env
  if (!email || !password) return false
  const identifier = page.locator('input[name=identifier], input[type=email]').first()
  await identifier.waitFor({ timeout: 15000 }).catch(() => {})
  if (!(await identifier.count())) return false
  await identifier.fill(email)
  const pw = page.locator('input[type=password]').first()
  if (!(await pw.isVisible().catch(() => false))) await page.keyboard.press('Enter')
  await pw.waitFor({ timeout: 15000 }).catch(() => {})
  if (!(await pw.count())) return false
  await pw.fill(password)
  await page.keyboard.press('Enter')
  await page.waitForURL((u) => !/sign-in|sign-up|accounts\./.test(u.toString()), { timeout: 30000 }).catch(() => {})
  return !/sign-in|sign-up|accounts\./.test(page.url())
}

/**
 * One browser at a time per profile: Chromium can't open a profile twice, so
 * parallel captures and inspections (e.g. several agents) queue here.
 */
async function lockProfile() {
  const lock = `${PROFILE_DIR}.lock`
  const deadline = Date.now() + 30 * 60 * 1000
  let announced = false
  for (;;) {
    try {
      mkdirSync(lock)
      writeFileSync(`${lock}/pid`, String(process.pid))
      const release = () => rmSync(lock, { recursive: true, force: true })
      process.on('exit', release)
      return release
    } catch {
      // A lock left by a process that's gone is stale
      try {
        const pid = Number(readFileSync(`${lock}/pid`, 'utf8'))
        process.kill(pid, 0)
      } catch {
        rmSync(lock, { recursive: true, force: true })
        continue
      }
      if (Date.now() > deadline) throw new Error(`Gave up waiting for the browser profile lock (${lock})`)
      if (!announced) console.log('Waiting for the browser profile (another capture is running)…')
      announced = true
      await new Promise((r) => setTimeout(r, 2000))
    }
  }
}

/** Open the signed-in dashboard (headless, 2x). Close it with ctx.close() to free the profile. */
export async function openDashboard({ headless = true } = {}) {
  const release = await lockProfile()
  const ctx = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    colorScheme: 'light',
    // Without this the screencast sends CSS-pixel frames, not 2x
    args: [`--force-device-scale-factor=${SCALE}`],
  })
  await ctx.addInitScript(TIDY)
  const close = ctx.close.bind(ctx)
  ctx.close = async () => {
    try {
      await close()
    } finally {
      release()
    }
  }
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  return { ctx, page }
}

export async function loadFlow(name) {
  return import(pathToFileURL(path.join(here, 'flows', `${name}.mjs`)).href)
}

export async function capture(name) {
  const { default: flow, meta = {}, cleanup } = await loadFlow(name)
  const outDir = path.join(here, 'public', 'captures', name)
  await rm(outDir, { recursive: true, force: true })
  await mkdir(path.join(outDir, 'frames'), { recursive: true })

  const { ctx, page } = await openDashboard()
  try {
    // Start from a clean slate in case an earlier run stopped before cleanup
    if (cleanup) await cleanup(page, BASE)

    // Load the starting page before recording, so the video opens on it
    await page.goto(BASE + (meta.start ?? '/'), { waitUntil: 'networkidle' })
    if (/sign-in|accounts\./.test(page.url())) {
      if (!(await signIn(page))) throw new Error(`Not signed in. Ask the user to run: node login.mjs (profile: ${PROFILE_DIR})`)
      await page.goto(BASE + (meta.start ?? '/'), { waitUntil: 'networkidle' })
    }
    await page.addStyleTag({ content: '*{caret-color:transparent!important} nextjs-portal{display:none!important}' })
    if (meta.prepare) await meta.prepare(page)
    await page.waitForTimeout(1200)

    // Screencast: every repaint, as a JPEG with its wall-clock time
    const cdp = await ctx.newCDPSession(page)
    const frames = []
    const writes = []
    let n = 0
    cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
      const file = `frames/${String(n++).padStart(5, '0')}.jpg`
      frames.push({ file, t: metadata.timestamp })
      writes.push(writeFile(path.join(outDir, file), Buffer.from(data, 'base64')))
      cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
    })
    await cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 95,
      maxWidth: VIEWPORT.width * SCALE,
      maxHeight: VIEWPORT.height * SCALE,
    })
    const t0 = Date.now() / 1000
    const now = () => Date.now() / 1000 - t0
    const events = []

    const box = async (locator) => {
      await locator.scrollIntoViewIfNeeded().catch(() => {})
      const b = await locator.boundingBox()
      if (!b) throw new Error(`Not visible: ${locator}`)
      return { x: b.x, y: b.y, w: b.width, h: b.height }
    }
    /**
     * Click like a person; if an overlay intercepts it, click where it is
     * drawn. Then park the real (invisible) mouse in a corner, so hover-only
     * UI like "Enter all required fields" tooltips doesn't linger on screen;
     * the drawn cursor is separate and stays where the click was.
     */
    const press = async (locator, b) => {
      try {
        await locator.click({ timeout: 4000 })
      } catch {
        await page.mouse.click(b.x + b.w / 2, b.y + b.h / 2)
      }
      await page.mouse.move(2, VIEWPORT.height - 2)
    }

    /** The flow's API: each action waits like a person would and is logged */
    const run = {
      page,
      wait: (ms) => page.waitForTimeout(ms),
      /** Move to an element and click it */
      async click(locator, { pause = 700, after = 900 } = {}) {
        const b = await box(locator)
        events.push({ type: 'move', t: now(), target: b })
        await page.waitForTimeout(pause)
        events.push({ type: 'click', t: now(), target: b })
        await press(locator, b)
        await page.waitForTimeout(after)
      },
      /** Click into a field and type, keystroke by keystroke */
      async type(locator, text, { delay = 75, after = 600, clear = false } = {}) {
        const b = await box(locator)
        events.push({ type: 'move', t: now(), target: b })
        await page.waitForTimeout(600)
        events.push({ type: 'click', t: now(), target: b })
        await press(locator, b)
        if (clear) await locator.fill('')
        const start = now()
        await locator.pressSequentially(text, { delay })
        events.push({ type: 'type', t: start, end: now(), target: b, text })
        await page.waitForTimeout(after)
      },
      /** Pick an option from a custom (Headless UI) listbox: open it, then click the option */
      async select(listboxButton, option, { after = 700 } = {}) {
        await run.click(listboxButton, { after: 500 })
        const opt = page.locator('[role=option]:visible', { hasText: option }).first()
        await run.click(opt, { pause: 500, after })
      },
      /**
       * Take focus off a field without focusing another, so blur-triggered
       * auto-fill happens (e.g. keys from names) without a selected-text
       * highlight in the next field, which Tab would cause
       */
      async blur(locator, { after = 900 } = {}) {
        await locator.evaluate((el) => el.blur())
        await page.waitForTimeout(after)
      },
      /** Move the cursor onto an element and rest there (tooltips, hover menus) */
      async hover(locator, { after = 900 } = {}) {
        const b = await box(locator)
        events.push({ type: 'move', t: now(), target: b })
        await page.waitForTimeout(600)
        await locator.hover().catch(() => page.mouse.move(b.x + b.w / 2, b.y + b.h / 2))
        events.push({ type: 'focus', t: now(), end: now() + after / 1000, target: b })
        await page.waitForTimeout(after)
      },
      /** Drag one element onto another (reordering blocks, rows) */
      async drag(from, to, { after = 900, steps = 25 } = {}) {
        const a = await box(from)
        const b = await box(to)
        events.push({ type: 'move', t: now(), target: a })
        await page.waitForTimeout(600)
        events.push({ type: 'click', t: now(), target: a })
        await page.mouse.move(a.x + a.w / 2, a.y + a.h / 2)
        await page.mouse.down()
        events.push({ type: 'move', t: now(), target: b })
        await page.mouse.move(b.x + b.w / 2, b.y + b.h / 2, { steps })
        await page.waitForTimeout(250)
        await page.mouse.up()
        events.push({ type: 'click', t: now(), target: b })
        await page.mouse.move(2, VIEWPORT.height - 2)
        await page.waitForTimeout(after)
      },
      /**
       * Upload a file: the cursor clicks the visible trigger (an upload area or
       * button) while the file goes into the (often hidden) <input type=file>
       */
      async upload(trigger, fileInput, filePath, { after = 1200 } = {}) {
        const b = await box(trigger)
        events.push({ type: 'move', t: now(), target: b })
        await page.waitForTimeout(700)
        events.push({ type: 'click', t: now(), target: b })
        await fileInput.setInputFiles(filePath)
        await page.waitForTimeout(after)
      },
      /** A key press (Tab, Enter, Escape…), no cursor movement */
      async key(key, { after = 500 } = {}) {
        await page.keyboard.press(key)
        await page.waitForTimeout(after)
      },
      /** Point the camera at an element without clicking (e.g. the result) */
      async show(locator, { hold = 1500 } = {}) {
        const b = await box(locator)
        events.push({ type: 'focus', t: now(), end: now() + hold / 1000, target: b })
        await page.waitForTimeout(hold)
      },
    }

    await page.waitForTimeout(meta.leadIn ?? 800)
    await flow(run)
    await page.waitForTimeout(meta.tail ?? 1500)
    await cdp.send('Page.stopScreencast')
    await Promise.all(writes)

    const manifest = {
      name,
      viewport: VIEWPORT,
      scale: SCALE,
      url: meta.url ?? 'app.trophy.so',
      duration: now(),
      frames: frames.map((f) => ({ file: f.file, t: Math.max(0, f.t - t0) })),
      events,
    }
    await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
    console.log(`Captured ${frames.length} frames, ${events.length} actions, ${manifest.duration.toFixed(1)}s`)
    return manifest
  } finally {
    // Undo what the flow created, so it can be recorded again
    if (cleanup) await cleanup(page, BASE).catch((e) => console.warn('Cleanup failed:', e.message))
    await ctx.close()
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const name = process.argv[2]
  if (!name) throw new Error('Usage: node capture.mjs <flow>')
  await capture(name)
}
