/**
 * Create a leaderboard: New leaderboard → name (key fills in) → rank by the
 * Workouts metric → Create leaderboard, which opens its configure page →
 * make it repeat every month → Save changes.
 * Used on features/leaderboards (Creating leaderboards).
 */
const NAME = 'Monthly Workout Challenge'

export const meta = {
  start: '/leaderboards',
  url: 'app.trophy.so/leaderboards',
  output: 'assets/features/leaderboards/creating_leaderboards.mp4',
}

export default async function flow(run) {
  const { page } = run
  await run.click(page.getByRole('button', { name: 'New leaderboard' }))
  const dialog = page.locator('[role=dialog]:visible').first()
  const name = dialog.getByPlaceholder("e.g. 'Weekly Champions', 'Top Performers'")
  await run.type(name, NAME)
  // The key fills in from the name when the name field loses focus
  await run.blur(name)
  await run.select(dialog.locator('button[aria-haspopup=listbox]', { hasText: 'None selected' }), 'Workouts')
  await run.click(dialog.getByRole('button', { name: 'Create leaderboard' }), { after: 2500 })
  // The configure page opens: set it to repeat monthly
  await run.select(page.locator('button[aria-haspopup=listbox]:visible', { hasText: 'Never repeats' }).first(), 'Months')
  await run.click(page.getByRole('button', { name: 'Save changes' }), { after: 2500 })
}

/** Delete the leaderboard again, so the flow can be recorded again */
export async function cleanup(page, base) {
  await page.goto(base + '/leaderboards', { waitUntil: 'networkidle' })
  const row = page.locator('tr').filter({ has: page.getByText(NAME, { exact: true }) }).first()
  if (!(await row.count())) return
  await row.locator('button').last().click()
  await page.locator('[role=menuitem]:visible', { hasText: 'Delete' }).first().click()
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
  await page.waitForTimeout(1500)
}
