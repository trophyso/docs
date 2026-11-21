/**
 * Realistic analytics for docs captures.
 *
 * The staging org has almost no events, so its analytics pages fall back to
 * grey placeholder charts with a "No Data" callout. Every analytics page loads
 * its numbers from a Next.js server action called from the browser, so we let
 * each action request through, then rewrite its response (row `1:` of the RSC
 * payload is plain JSON) before the page sees it. The real response already
 * has the right dates, labels and structure; we fill in the values.
 *
 * Numbers describe the docs' fictional fitness app (workouts, XP, ~6,200
 * MAUs, matching the sidebar usage card). They're seeded from the request, so
 * the same page and filters always show the same numbers, and filtering by a
 * user attribute shows a smaller, slightly different segment.
 *
 *   import { fakeAnalytics } from './src/fake-analytics.mjs'
 *   await fakeAnalytics(page) // before page.goto
 */

// ---------- Seeded randomness and series helpers ----------

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
  return h >>> 0
}

function rng(seed) {
  let a = seed || 1
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const round = (v, dp = 0) => Math.round(v * 10 ** dp) / 10 ** dp

/** Is this x a calendar date (daily series) rather than a number bucket? */
const isDate = (x) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x)

/**
 * A smooth trend from `from` to `to` across `n` points, with optional weekly
 * seasonality (weekends lower for daily dates) and a little noise.
 */
function trend(xs, { from, to, noise = 0.04, weekly = 0, dp = 0, r }) {
  const n = Math.max(xs.length - 1, 1)
  // Over a few months a full weekly swing reads as a comb in a small chart
  const swing = xs.length > 35 ? weekly * 0.35 : weekly
  let drift = 0
  return xs.map((x, i) => {
    const t = i / n
    const eased = t * t * (3 - 2 * t) * 0.6 + t * 0.4
    let v = from + (to - from) * eased
    if (swing && isDate(x)) {
      const day = new Date(x + 'T12:00:00Z').getUTCDay()
      if (day === 0 || day === 6) v *= 1 - swing
      else if (day === 1) v *= 1 + swing * 0.4
    }
    drift = drift * 0.8 + (r() - 0.5) * noise * 0.6
    return round(v * (1 + drift), dp)
  })
}

/** Dates for a series whose real response came back empty */
function datesFor(series, fallback) {
  const xs = series.flatMap((s) => (s.data || []).map((d) => d.x))
  if (xs.length) return [...new Set(xs)]
  return fallback
}

function fill(line, values, xs) {
  line.data = xs.map((x, i) => ({ x, value: values[i] }))
  return line
}

/** Two lines, Trophy above Control, for retention and engagement charts */
function trophyVsControl(proto, xs, { trophy, control, dp, r }) {
  // Rates (retention) shift with the filtered segment, so segments compare
  if (dp >= 3 && segmentLift) {
    trophy = { ...trophy, from: trophy.from + segmentLift, to: trophy.to + segmentLift }
    control = { ...control, from: control.from + segmentLift * 0.6, to: control.to + segmentLift * 0.6 }
  }
  const base = { ...(proto || {}) }
  const t = fill({ ...base, label: 'Trophy' }, trend(xs, { ...trophy, dp, r, noise: 0.05 }), xs)
  const c = fill({ ...base, label: 'Control' }, trend(xs, { ...control, dp, r, noise: 0.05 }), xs)
  const avg = (l) => l.data.reduce((a, d) => a + d.value, 0) / Math.max(l.data.length, 1)
  t.displayValue = round(avg(t), dp + 2)
  c.displayValue = round(avg(c), dp + 2)
  delete t.percentChange
  delete c.percentChange
  return [t, c]
}

const sum = (vals) => vals.reduce((a, v) => a + v, 0)

// ---------- One transform per analytics response shape ----------

const TRANSFORMS = [
  {
    name: 'leaderboard',
    match: (d) => 'participants' in d && 'scoreDistribution' in d,
    apply(d, { r, scale }) {
      const xs = datesFor([...d.participants, ...d.activeUsers, ...d.rankChanges], [])
      const participants = trend(xs, { from: 820 * scale, to: 1460 * scale, noise: 0.01, r })
      for (let i = 1; i < participants.length; i++) participants[i] = Math.max(participants[i], participants[i - 1])
      const active = trend(xs, { from: 210 * scale, to: 290 * scale, weekly: 0.22, noise: 0.05, r })
      const changes = trend(xs, { from: 980 * scale, to: 1540 * scale, weekly: 0.24, noise: 0.05, r })
      fill(d.participants[0], participants, xs)
      d.participants[0].displayValue = participants.at(-1)
      d.participants[0].percentChange = 0.22
      fill(d.activeUsers[0], active, xs)
      d.activeUsers[0].displayValue = round(sum(active) / xs.length)
      d.activeUsers[0].percentChange = 0.14
      fill(d.rankChanges[0], changes, xs)
      d.rankChanges[0].displayValue = sum(changes)
      d.rankChanges[0].percentChange = 0.31
      const buckets = [
        ['0', 64], ['1', 118], ['2', 176], ['3', 214], ['4', 188],
        ['5', 141], ['6-7', 96], ['8-10', 52], ['11-15', 19], ['16+', 6],
      ]
      d.scoreDistribution = buckets.map(([label, v]) => ({ label, value: round(v * scale * (0.9 + r() * 0.2)) }))
    },
  },
  {
    name: 'home',
    match: (d) => 'metricFunnels' in d && 'discoveryPaths' in d,
    apply(d, { r, scale }) {
      const xs = datesFor(d.users, [])
      const users = trend(xs, { from: 1480 * scale, to: 1790 * scale, weekly: 0.22, r })
      fill(d.users[0], users, xs)
      d.users[0].displayValue = round(5230 * scale)
      d.users[0].percentChange = 0.08
      const rx = datesFor(d.retention, xs)
      d.retention = trophyVsControl(d.retention[0], rx, {
        trophy: { from: 0.41, to: 0.47 }, control: { from: 0.32, to: 0.33 }, dp: 3, r,
      })
      const ex = datesFor(d.engagement, xs)
      d.engagement = trophyVsControl(d.engagement[0], ex, {
        trophy: { from: 22, to: 26, weekly: 0.12 }, control: { from: 18.5, to: 19.5, weekly: 0.12 }, dp: 1, r,
      })
      d.metricRetention = metricRetention(d.metricRetention, r)
      d.metricFunnels = funnel(d.metricFunnels, r)
      d.topUsers = topUsers(r)
      d.discoveryPaths = [
        { path: 'Workouts → Lessons', users: round(1840 * scale), retention: 0.58 },
        { path: 'Workouts', users: round(1520 * scale), retention: 0.46 },
        { path: 'Lessons → Workouts', users: round(910 * scale), retention: 0.52 },
        { path: 'Lessons', users: round(640 * scale), retention: 0.34 },
      ]
    },
  },
  {
    name: 'metric',
    match: (d) => 'counts' in d && 'achievementCompletions' in d,
    apply(d, { r, scale }) {
      const xs = datesFor(d.counts, [])
      const counts = trend(xs, { from: 2080 * scale, to: 2640 * scale, weekly: 0.24, r })
      fill(d.counts[0], counts, xs)
      d.counts[0].displayValue = sum(counts)
      d.counts[0].percentChange = 0.12
      const users = trend(xs, { from: 1120 * scale, to: 1380 * scale, weekly: 0.22, r })
      fill(d.users[0], users, xs)
      d.users[0].displayValue = round(3940 * scale)
      d.users[0].percentChange = 0.07
      const rate = trend(xs, { from: 0.62, to: 0.67, noise: 0.03, dp: 3, r })
      fill(d.dauMetricRate[0], rate, xs)
      d.dauMetricRate[0].displayValue = round(sum(rate) / xs.length, 3)
      d.metricRetention = metricRetention(d.metricRetention, r)
      d.retention = trophyVsControl(d.retention[0], datesFor(d.retention, xs), {
        trophy: { from: 0.43, to: 0.49 }, control: { from: 0.33, to: 0.34 }, dp: 3, r,
      })
      d.engagement = trophyVsControl(d.engagement[0], datesFor(d.engagement, xs), {
        trophy: { from: 2.1, to: 2.5, weekly: 0.1 }, control: { from: 1.7, to: 1.8, weekly: 0.1 }, dp: 2, r,
      })
      d.earlyEngagement = trophyVsControl(d.earlyEngagement?.[0], datesFor(d.earlyEngagement || [], xs), {
        // Workouts in a user's first 14 days (the card shows a whole number)
        trophy: { from: 8.2, to: 9.6 }, control: { from: 6.1, to: 6.4 }, dp: 2, r,
      })
      d.funnel = funnel(d.funnel, r)
      // Matches the milestone user counts in the docs' check_user_completions.png
      d.achievementCompletions = [
        { label: '10 workouts', Completions: round(2614 * scale) },
        { label: '20 workouts', Completions: round(1208 * scale) },
        { label: '30 workouts', Completions: round(377 * scale) },
      ]
    },
  },
  {
    name: 'points',
    match: (d) => 'totalPoints' in d && 'pointsSource' in d,
    apply(d, { r, scale }) {
      const xs = datesFor(d.totalPoints, [])
      const regular = trend(xs, { from: 38000 * scale, to: 46500 * scale, weekly: 0.2, r })
      // Boosted points jump at weekends (a "Double XP weekend" boost)
      const boosted = xs.map((x, i) => {
        const day = isDate(x) ? new Date(x + 'T12:00:00Z').getUTCDay() : 1
        const weekend = day === 0 || day === 6
        return round((weekend ? 16000 : 3200) * scale * (0.85 + r() * 0.3) * (1 + i / xs.length / 3))
      })
      const lines = d.totalPoints.length ? d.totalPoints : [{ label: 'Boosted' }, { label: 'Regular' }]
      const boostedLine = lines.find((l) => /boost/i.test(l.label)) ?? lines[0]
      const regularLine = lines.find((l) => l !== boostedLine) ?? { label: 'Regular' }
      fill(boostedLine, boosted, xs)
      boostedLine.displayValue = sum(boosted)
      fill(regularLine, regular, xs)
      regularLine.displayValue = sum(regular)
      regularLine.percentChange = 0.12
      d.totalPoints = [boostedLine, regularLine]
      const histogram = (counts) =>
        // Only label and Users: every other numeric key is drawn as another bar
        counts.map(([label, users]) => ({ label, Users: round(users * scale * (0.92 + r() * 0.16)) }))
      d.mostPointsEarned = {
        average: round(1840 * scale),
        data: histogram([
          ['0', 140], ['1-9', 260], ['10-99', 1180], ['100-999', 2960], ['1000-9999', 1530], ['10000-48210', 170],
        ]),
      }
      d.averagePoints14Days = {
        average: round(412 * scale),
        data: histogram([['0', 210], ['1-9', 390], ['10-99', 1620], ['100-999', 2240], ['1000-6120', 310]]),
      }
      const share = { Workouts: 0.64, Streak: 0.21 }
      const total = sum(regular) + sum(boosted)
      d.pointsSource = d.pointsSource.map((s, i) => ({
        ...s,
        'Points earned': round(total * (share[s.label] ?? 0.15 / (i + 1))),
      }))
    },
  },
  {
    name: 'users',
    match: (d) => 'dailyActiveUsers' in d && 'newUsers' in d,
    apply(d, { r, scale }) {
      const xs = datesFor([...d.dailyActiveUsers, ...d.newUsers], [])
      const dau = trend(xs, { from: 1460 * scale, to: 1810 * scale, weekly: 0.22, r })
      fill(d.dailyActiveUsers[0], dau, xs)
      d.dailyActiveUsers[0].displayValue = dau.at(-1)
      const mau = trend(xs, { from: 5890 * scale, to: 6248 * scale, noise: 0.004, r })
      if (mau.length) mau[mau.length - 1] = round(6248 * scale) // the sidebar usage card's number
      fill(d.monthlyActiveUsers[0], mau, xs)
      d.monthlyActiveUsers[0].displayValue = mau.at(-1)
      const fresh = trend(xs, { from: 118 * scale, to: 164 * scale, weekly: 0.18, noise: 0.15, r })
      fill(d.newUsers[0], fresh, xs)
      d.newUsers[0].displayValue = sum(fresh)
    },
  },
  {
    name: 'emails',
    match: (d) => 'emailMetrics' in d && 'unsubscribes' in d,
    apply(d, { r, scale }) {
      const xs = datesFor(d.emails, [])
      const sent = trend(xs, { from: 610 * scale, to: 780 * scale, weekly: 0.15, noise: 0.1, r })
      fill(d.emails[0], sent, xs)
      d.emails[0].displayValue = sum(sent)
      d.emails[0].percentChange = 0.09
      // A handful a day, varying day to day (a smooth trend would round to a flat line)
      const unsub = xs.map(() => Math.max(0, round((3.4 + (r() - 0.5) * 3) * scale)))
      fill(d.unsubscribes[0], unsub, xs)
      d.unsubscribes[0].displayValue = sum(unsub)
      d.unsubscribes[0].percentChange = -0.06
      d.retention = trophyVsControl(d.retention[0], datesFor(d.retention, xs), {
        trophy: { from: 0.42, to: 0.48 }, control: { from: 0.32, to: 0.33 }, dp: 3, r,
      })
      d.engagement = trophyVsControl(d.engagement[0], datesFor(d.engagement, xs), {
        trophy: { from: 22, to: 25.5, weekly: 0.12 }, control: { from: 18.5, to: 19.5, weekly: 0.12 }, dp: 1, r,
      })
      const row = (label, recipients, open, click, reengage) => {
        const opens = round(recipients * open * (0.94 + r() * 0.12))
        const clicks = round(recipients * click * (0.85 + r() * 0.3))
        return {
          label, recipients,
          opens, clicks,
          opensWithBots: round(opens * 1.18), clicksWithBots: round(clicks * 1.35),
          reengages: round(opens * reengage * (0.9 + r() * 0.2)),
        }
      }
      const weeks = weekLabels(xs)
      const rows = {
        // Newest week first, with volume growing toward the present
        achievement: weeks.map((w, i) => row(w, round((1380 - i * 38) * scale * (0.92 + r() * 0.16)), 0.44, 0.021, 0.42)),
        recap: weeks.map((w, i) => row(w, round((3420 - i * 64) * scale * (0.96 + r() * 0.08)), 0.39, 0.014, 0.36)),
        reactivation: [['Inactive 3 Days', 520], ['Inactive 7 Days', 410], ['Inactive 14 Days', 330], ['Inactive 30 Days', 260]]
          .map(([l, n], i) => row(l, round(n * scale), 0.33 - i * 0.04, 0.018 - i * 0.003, 0.28 - i * 0.05)),
        streak: [['2 day streak', 840], ['7 day streak', 610], ['14 day streak', 380], ['30 day streak', 190], ['100 day streak', 42]]
          .map(([l, n], i) => row(l, round(n * scale), 0.47 + i * 0.03, 0.024 + i * 0.002, 0.5 + i * 0.04)),
        agentic: [row('All', round(3120 * scale), 0.52, 0.034, 0.55)],
      }
      d.emailMetrics = d.emailMetrics.map((m) => ({ ...m, data: rows[m.emailType] ?? m.data }))
    },
  },
  {
    name: 'email-counts',
    match: (d) => d.recap && 'sent' in d.recap && 'scheduled' in d.recap,
    apply(d, { scale }) {
      // About three months of sends, in line with the weekly tables
      const counts = { achievement: 14920, recap: 38610, reactivation: 5840, streak: 8270, agentic: 16480 }
      for (const [k, v] of Object.entries(d)) {
        if (v && typeof v === 'object' && 'sent' in v) {
          d[k] = { sent: round((counts[k] ?? 5000) * scale), scheduled: round((counts[k] ?? 5000) * 0.04 * scale), notSent: round((counts[k] ?? 5000) * 0.01 * scale) }
        }
      }
    },
  },
]

function metricRetention(lines, r) {
  const src = lines?.length ? lines : [{ label: 'Workouts', data: [] }]
  return src.map((l, li) => {
    const xs = l.data?.length ? l.data.map((d) => d.x) : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
    // Retention climbs with the amount of activity on day one, then levels off
    const vals = xs.map((x) => round(Math.min(94, 31 + 58 * (1 - Math.exp(-x / (3.2 + li))) + (r() - 0.5) * 3)))
    return { ...l, displayValue: vals[Math.min(4, vals.length - 1)], data: xs.map((x, i) => ({ x, value: vals[i] })) }
  })
}

function funnel(rows, r) {
  if (!rows?.length) return rows
  const keys = Object.keys(rows[0]).filter((k) => k !== 'label')
  return rows.map((row, i) => {
    const out = { label: row.label }
    keys.forEach((k, ki) => {
      const n = Number(row.label) || i + 1
      out[k] = round(Math.max(0.02, 0.94 * Math.exp(-(n - 1) / (3.4 + ki * 1.3)) * (0.96 + r() * 0.08)), 3)
    })
    return out
  })
}

function topUsers(r) {
  const people = ['maya.r', 'dev.p', 'jess.m', 'leo.t', 'priya.s', 'tom.w', 'sam.k', 'mei.l']
  return people.slice(0, 6).map((p, i) => ({
    metricName: i % 3 === 2 ? 'Lessons' : 'Workouts',
    user: `${p}@example.com`,
    metricValue: round((i % 3 === 2 ? 64 : 48) - i * 4 - r() * 3),
  }))
}

/** Weekly rows (newest first) for the weeks in the range, up to this week and at most 13 */
function weekLabels(xs) {
  const today = new Date().toISOString().slice(0, 10)
  const days = xs.filter((x) => isDate(x) && x <= today)
  if (!days.length) return ['This week']
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const start = new Date(days[0] + 'T00:00:00Z')
  const end = new Date(days.at(-1) + 'T00:00:00Z')
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7)) // back to Monday
  const out = []
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 7)) {
    const e = new Date(d)
    e.setUTCDate(e.getUTCDate() + 6)
    out.push(`${fmt(d)} - ${fmt(e)}`)
  }
  return out.reverse().slice(0, 13)
}

// ---------- RSC response rewriting ----------

/** The user attribute filters in a request (its last argument), one entry per filter */
function filtersOf(args) {
  const last = args.at(-1)
  if (last === '$undefined' || last == null || typeof last !== 'object') return []
  if (Array.isArray(last)) return last.map((f) => JSON.stringify(f))
  if ('current' in last) return [] // a date range, not filters
  return Object.entries(last).map((e) => JSON.stringify(e))
}

/**
 * Each filter keeps its own share of users (e.g. Leeds ≈ 30%, Pro ≈ 40%), and
 * shares multiply, so adding a filter always narrows the segment.
 */
let segmentLift = 0 // set per response in rewrite()

const segmentScale = (filters) => filters.reduce((s, f) => s * (0.24 + rng(hash(f))() * 0.26), 1)

export function rewrite(body, postData = '') {
  const lines = body.split('\n')
  let args = []
  try {
    args = JSON.parse(postData)
  } catch {}
  const filters = filtersOf(args)
  const scale = segmentScale(filters)
  // Each filter value nudges retention up or down by a few points
  segmentLift = filters.reduce((s, f) => s + (rng(hash(f) + 7)() - 0.4) * 0.16, 0)
  let changed = null
  const out = lines.map((line) => {
    const m = line.match(/^([0-9a-f]+):(\{.*)$/s)
    if (!m || m[1] === '0') return line
    let data
    try {
      data = JSON.parse(m[2])
    } catch {
      return line
    }
    const t = TRANSFORMS.find((x) => x.match(data))
    if (!t) return line
    const seed = hash(t.name + JSON.stringify(args.at(-1) ?? ''))
    t.apply(data, { r: rng(seed), scale })
    changed = t.name
    return `${m[1]}:${JSON.stringify(data)}`
  })
  return { body: out.join('\n'), changed }
}

/** Install on a page before navigating. Logs which responses were rewritten when `log` is set. */
export async function fakeAnalytics(page, { log = false } = {}) {
  await page.route(
    (url) => !/\.(js|css|png|jpg|svg|woff2?)(\?|$)/.test(url.pathname),
    async (route) => {
      const req = route.request()
      if (req.method() !== 'POST' || !req.headers()['next-action']) return route.fallback()
      const res = await route.fetch()
      const text = await res.text()
      const { body, changed } = rewrite(text, req.postData() || '')
      if (log && changed) console.log(`fake analytics: ${changed}`)
      await route.fulfill({ response: res, body })
    },
  )
}
