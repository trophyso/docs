/**
 * Add a breakdown attribute to a leaderboard: on the inactive "Test"
 * leaderboard's configure page, pick City under Breakdown attributes → Save changes.
 * Used on features/leaderboards (Ranking breakdowns).
 * "Test" has no breakdown attributes; cleanup removes City again and saves.
 */
const CONFIGURE = '/leaderboards/85d93269-9049-4452-ae1b-464731431a07/configure'

export const meta = {
  start: CONFIGURE,
  url: 'app.trophy.so/leaderboards',
  output: 'assets/features/leaderboards/breakdowns.mp4',
}

/** The Breakdown attributes field (label, + button, one row per attribute) */
const section = (page) => page.getByText('Select user attributes to breakdown rankings by').locator('xpath=../../../../..')

export default async function flow(run) {
  const { page } = run
  await run.select(section(page).locator('button[aria-haspopup=listbox]', { hasText: 'None selected' }), 'City')
  await run.click(page.getByRole('button', { name: 'Save changes' }), { after: 2500 })
}

/** Remove the breakdown attribute again so "Test" is back to none */
export async function cleanup(page, base) {
  await page.goto(base + CONFIGURE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const s = section(page)
  if (!(await s.locator('button[aria-haspopup=listbox]', { hasText: 'City' }).count())) return
  // Each attribute row ends with an × button; the first non-listbox button is the + (add)
  await s.locator('button:not([aria-haspopup])').last().click()
  await page.waitForTimeout(500)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.waitForTimeout(2000)
}
