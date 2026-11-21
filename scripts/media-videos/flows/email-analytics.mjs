/**
 * Email analytics: over the last 3 months, scroll from the charts down to the
 * Milestone emails table, point at a week's open and click rates, then on to
 * the Recap emails table.
 * Used on features/emails (Email analytics).
 * Read-only, so no cleanup. Numbers come from src/fake-analytics.mjs.
 */
export const meta = {
  start: '/emails',
  url: 'app.trophy.so/emails',
  output: 'assets/features/emails/email_analytics.mp4',
  fakeAnalytics: true,
  async prepare(page) {
    // Weekly table rows need a range of a few months
    await page.locator('button[aria-haspopup=listbox]:visible', { hasText: 'Last 14 days' }).first().click()
    await page.locator('[role=option]:visible', { hasText: 'Last 3 months' }).first().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1500)
    await page.mouse.move(2, 898) // no chart tooltip on the opening frame
  },
}

/**
 * Scroll smoothly, like a trackpad, until `target` sits `top` px from the top
 * of the window. Measured, so the hover that follows doesn't jump the page.
 */
async function scrollTo(page, target, top = 120) {
  await page.mouse.move(900, 600)
  for (let i = 0; i < 200; i++) {
    const b = await target.boundingBox()
    const left = b.y - top
    if (Math.abs(left) < 6) break
    await page.mouse.wheel(0, Math.sign(left) * Math.min(24, Math.abs(left)))
    await page.waitForTimeout(16)
  }
  await page.mouse.move(2, 898)
  await page.waitForTimeout(500)
}

const heading = (page, title) => page.getByText(title, { exact: true }).first()

/** A cell in the table under the card titled `title` */
const cell = (page, title, row, col) =>
  page
    .locator('div', { has: page.getByText(title, { exact: true }) })
    .filter({ has: page.locator('table') })
    .last()
    .locator('tbody tr')
    .nth(row)
    .locator('td')
    .nth(col)

export default async function flow(run) {
  const { page } = run
  await run.wait(600)
  await scrollTo(page, heading(page, 'Milestone emails'))
  await run.hover(cell(page, 'Milestone emails', 1, 2), { after: 1400 })
  await scrollTo(page, heading(page, 'Recap emails'))
  await run.hover(cell(page, 'Recap emails', 0, 2), { after: 1600 })
}
