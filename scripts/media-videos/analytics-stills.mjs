#!/usr/bin/env node
/**
 * Screenshot the dashboard's analytics pages for the docs, with realistic
 * numbers (see src/fake-analytics.mjs: staging has too little data).
 *
 *   node analytics-stills.mjs                 # every still, written into assets/
 *   node analytics-stills.mjs leaderboard     # only shots whose output contains "leaderboard"
 *   node analytics-stills.mjs --review        # write to out/stills/ instead of assets/
 *
 * Full pages are 1680×1050 at 2× (like the docs' other page stills). Card
 * shots crop to the card with the given label.
 */
import { mkdirSync } from 'node:fs'
import path from 'node:path'

import { BASE, docsRoot, here, openDashboard, signIn } from './capture.mjs'
import { fakeAnalytics } from './src/fake-analytics.mjs'

// Staging test org: Workouts metric, XP points system, Weekly Workout Champions
const METRIC = '/metrics/a62e1133-8396-4a23-bef6-858925bf4672'
const POINTS = '/points/1ce916a5-59b6-4f84-919e-db6ed712f0fc'
const LEADERBOARD = '/leaderboards/8e80160f-4f5a-458b-b9f1-92b0944cc17d'

/** route, range (toolbar option), then one or more shots: card label(s) or the full page */
const PAGES = [
  {
    route: LEADERBOARD,
    range: 'Last 30 days',
    shots: [
      { out: 'assets/features/leaderboards/analytics.png', page: true },
      { out: 'assets/features/leaderboards/total_unique_participants.png', cards: ['Total unique participants'] },
      { out: 'assets/features/leaderboards/active_users.png', cards: ['Active users'] },
      { out: 'assets/features/leaderboards/rank_changes.png', cards: ['Rank changes'] },
      { out: 'assets/features/leaderboards/score_distribution.png', cards: ['Workouts Distribution'] },
    ],
  },
  {
    route: '/',
    range: 'Last 3 months',
    shots: [
      { out: 'assets/platform/experimentation/charts.png', cards: ['14-day retention', 'Engagement'] },
      { out: 'assets/platform/experimentation/retention_chart.png', cards: ['14-day retention'] },
      { out: 'assets/platform/experimentation/engagement_chart.png', cards: ['Engagement'] },
    ],
  },
  {
    route: METRIC,
    range: 'Last 3 months',
    shots: [
      { out: 'assets/features/metrics/metric_analytics.png', page: true },
      { out: 'assets/features/metrics/achievement_completions.png', cards: ['Milestone completions'] },
      { out: 'assets/platform/experimentation/early_engagement_chart.png', cards: ['Average workouts in first 14 days'] },
    ],
  },
  {
    route: POINTS,
    range: 'Last 30 days',
    shots: [{ out: 'assets/features/points/points_analytics.png', page: true }],
  },
  {
    route: '/users',
    range: 'Last 30 days',
    shots: [{ out: 'assets/features/users/user_analytics.png', row: 'Daily active users' }],
  },
]

const args = process.argv.slice(2)
const review = args.includes('--review')
const filters = args.filter((a) => !a.startsWith('--'))
const outPath = (out) => (review ? path.join(here, 'out', 'stills', path.basename(out)) : path.join(docsRoot, out))
if (review) mkdirSync(path.join(here, 'out', 'stills'), { recursive: true })

/** The smallest bordered card that contains an element with exactly this text */
async function cardFor(page, label) {
  const handle = await page.evaluateHandle((label) => {
    const want = label.toLowerCase()
    const leaves = [...document.querySelectorAll('main *, [class*=page] *')].filter(
      (el) => el.offsetParent && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().toLowerCase() === want),
    )
    for (const leaf of leaves) {
      let n = leaf
      while (n && n !== document.body) {
        const s = getComputedStyle(n)
        const r = n.getBoundingClientRect()
        if (parseFloat(s.borderTopWidth) > 0 && parseFloat(s.borderTopLeftRadius) > 4 && r.height > 160) return n
        n = n.parentElement
      }
    }
    return null
  }, label)
  return handle.asElement()
}

/** Screenshot the union of several elements' boxes, with a small margin */
async function shootBoxes(page, elements, file) {
  const boxes = await Promise.all(elements.map((e) => e.boundingBox()))
  const pad = 2
  const x = Math.min(...boxes.map((b) => b.x)) - pad
  const y = Math.min(...boxes.map((b) => b.y)) - pad
  const w = Math.max(...boxes.map((b) => b.x + b.width)) - x + pad
  const h = Math.max(...boxes.map((b) => b.y + b.height)) - y + pad
  await page.screenshot({ path: file, clip: { x, y, width: w, height: h }, fullPage: true })
}

async function pickRange(page, option) {
  const button = page.locator('button[aria-haspopup=listbox]:visible', { hasText: /Last|All time|days|months/i }).first()
  if (!(await button.count())) return
  if ((await button.innerText()).trim() === option) return
  await button.click()
  const opt = page.locator('[role=option]:visible', { hasText: option }).first()
  if (!(await opt.count())) {
    const all = await page.locator('[role=option]:visible').allInnerTexts()
    throw new Error(`No range option "${option}". Options: ${all.join(', ')}`)
  }
  await opt.click()
}

const { ctx, page } = await openDashboard()
await fakeAnalytics(page)
await page.setViewportSize({ width: 1680, height: 1050 })
try {
  for (const p of PAGES) {
    const shots = p.shots.filter((s) => !filters.length || filters.some((f) => s.out.includes(f)))
    if (!shots.length) continue
    await page.goto(BASE + p.route, { waitUntil: 'networkidle' })
    if (/sign-in|accounts\./.test(page.url())) {
      if (!(await signIn(page))) throw new Error('Not signed in: ask the user to run node login.mjs')
      await page.goto(BASE + p.route, { waitUntil: 'networkidle' })
    }
    await page.addStyleTag({ content: 'nextjs-portal{display:none!important} *{caret-color:transparent!important}' })
    if (p.range) await pickRange(page, p.range)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2500) // chart entry animations
    for (const s of shots) {
      const file = outPath(s.out)
      if (s.page) {
        await page.evaluate(() => window.scrollTo(0, 0))
        await page.mouse.move(1, 1049)
        await page.screenshot({ path: file })
      } else if (s.row) {
        const card = await cardFor(page, s.row)
        if (!card) throw new Error(`No card "${s.row}" on ${p.route}`)
        const row = await card.evaluateHandle((c) => c.parentElement)
        await page.mouse.move(1, 1049) // no hover tooltips
        await page.waitForTimeout(300)
        await row.asElement().screenshot({ path: file })
      } else {
        const cards = []
        for (const label of s.cards) {
          const c = await cardFor(page, label)
          if (c) cards.push(c)
          if (c && s.any) break
        }
        if (!cards.length) throw new Error(`No card ${s.cards.join(' / ')} on ${p.route}`)
        await cards[0].scrollIntoViewIfNeeded()
        await page.mouse.move(1, 1049)
        await page.waitForTimeout(300)
        if (cards.length === 1) await cards[0].screenshot({ path: file })
        else await shootBoxes(page, cards, file)
      }
      console.log(`${s.out}${review ? ' (review)' : ''}`)
    }
  }
} finally {
  await ctx.close()
}
