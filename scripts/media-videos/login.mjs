#!/usr/bin/env node
/**
 * Sign in to the dashboard once, in a visible browser, and keep the session
 * in a Chromium profile for capture.mjs. The dashboard uses Clerk (email
 * codes, 2FA, bot checks), so a person signs in; agents should ask the user
 * to run this rather than handle credentials.
 *
 *   node login.mjs   → sign in, pick the org/environment, the window closes itself
 *
 * Pre-fills the form from STAGING_EMAIL / STAGING_PASSWORD in .env (gitignored).
 * Env: PROFILE_DIR (default ~/.trophy-docs-media/profile), DASHBOARD_URL.
 */
import { mkdir } from 'node:fs/promises'

import { BASE, PROFILE_DIR, chromium, signIn } from './capture.mjs'

await mkdir(PROFILE_DIR, { recursive: true })
const ctx = await chromium.launchPersistentContext(PROFILE_DIR, { headless: false, viewport: { width: 1440, height: 900 } })
const page = ctx.pages()[0] ?? (await ctx.newPage())
await page.goto(BASE)
// Pre-fill from .env when it's there; finish any email code or check by hand
if (process.env.STAGING_EMAIL) await signIn(page).catch(() => {})
console.log(`Sign in to ${BASE} in the browser window if needed (waiting up to 15 minutes)…`)
const deadline = Date.now() + 15 * 60 * 1000
const host = new URL(BASE).host
while (Date.now() < deadline) {
  await page.waitForTimeout(3000)
  const url = page.url()
  if (url.includes(host) && !/sign-in|sign-up|login|accounts\./.test(url) && (await page.locator('nav, aside').count())) break
}
await page.waitForTimeout(3000)
await ctx.close()
console.log(`Signed in. Profile saved to ${PROFILE_DIR}`)
