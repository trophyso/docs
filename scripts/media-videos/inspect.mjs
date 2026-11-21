#!/usr/bin/env node
/**
 * Look at a dashboard page before writing a flow: saves a screenshot and
 * prints the visible buttons, links, inputs, listboxes and any open dialog,
 * after optionally clicking through some elements by their text.
 *
 *   node inspect.mjs /attributes
 *   node inspect.mjs /attributes --click "New attribute"
 *   node inspect.mjs /metrics --click "New metric" --click "Cancel"
 *   node inspect.mjs /leaderboards/<id> --fake-analytics   (realistic analytics numbers)
 *   → out/inspect.png
 */
import path from 'node:path'

import { BASE, here, openDashboard, signIn } from './capture.mjs'
import { fakeAnalytics } from './src/fake-analytics.mjs'

const args = process.argv.slice(2)
const route = args[0] ?? '/'
const clicks = args.flatMap((a, i) => (a === '--click' ? [args[i + 1]] : []))

const { ctx, page } = await openDashboard()
if (args.includes('--fake-analytics')) await fakeAnalytics(page, { log: true })
try {
  await page.goto(BASE + route, { waitUntil: 'networkidle' })
  if (/sign-in|accounts\./.test(page.url()) && !(await signIn(page))) throw new Error('Not signed in: ask the user to run node login.mjs')
  if (!page.url().endsWith(route)) await page.goto(BASE + route, { waitUntil: 'networkidle' })
  for (const text of clicks) {
    const target = page.locator('button:visible, a:visible, [role=menuitem]:visible, [role=option]:visible', { hasText: text }).first()
    await target.click({ timeout: 8000 })
    await page.waitForTimeout(1200)
  }
  await page.waitForTimeout(800)
  const shot = path.join(here, 'out', 'inspect.png')
  await page.screenshot({ path: shot })
  const info = await page.evaluate(() => {
    const vis = (el) => !!el.offsetParent && el.getBoundingClientRect().width > 0
    const label = (el) => (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 60)
    const pick = (sel) => [...document.querySelectorAll(sel)].filter(vis).map((el) => {
      const r = el.getBoundingClientRect()
      const extra = [el.disabled && 'disabled', el.getAttribute('role'), el.getAttribute('type'), el.value && `value="${el.value}"`].filter(Boolean).join(' ')
      return `${label(el) || '(no text)'}${extra ? ` [${extra}]` : ''} @${Math.round(r.x)},${Math.round(r.y)}`
    })
    const dialog = [...document.querySelectorAll('[role=dialog], [role=alertdialog], [data-headlessui-state] [class*=dialog], .fixed.inset-0')].filter(vis).map((d) => d.innerText.replace(/\s+/g, ' ').slice(0, 400))
    return {
      url: location.pathname,
      buttons: pick('button'),
      links: pick('a[href^="/"]').slice(0, 40),
      inputs: pick('input, textarea'),
      listboxes: pick('[aria-haspopup=listbox]'),
      options: pick('[role=option]'),
      dialog,
    }
  })
  console.log(JSON.stringify(info, null, 2))
  console.log(`Screenshot → ${path.relative(process.cwd(), shot)}`)
} finally {
  await ctx.close()
}
