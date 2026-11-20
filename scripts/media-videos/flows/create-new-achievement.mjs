/**
 * Create a milestone: New milestone → name + description → Metric trigger on
 * Workouts → metric total → Create. Used on features/milestones (Creating milestones).
 * Slots into the test org's existing 10/20/30 workouts milestones.
 */
export const meta = {
  start: '/milestones',
  url: 'app.trophy.so/milestones',
  output: 'assets/features/achievements/create_new_achievement.mp4',
}

const NAME = '50 workouts'

export default async function flow(run) {
  const { page } = run
  await run.click(page.locator('button:visible', { hasText: 'New milestone' }).first())
  await run.type(page.getByPlaceholder('Enter a name'), NAME)
  await run.type(page.getByPlaceholder('Enter a description'), 'Complete 50 workouts in Stride')
  await run.select(page.locator('button[aria-haspopup=listbox]:visible', { hasText: 'None selected' }).first(), 'Workouts')
  await run.type(page.locator('input[type=number]:visible').first(), '50', { clear: true })
  // The new row shows up in the Workouts table as the panel closes
  await run.click(page.getByRole('button', { name: 'Create', exact: true }), { after: 2500 })
}

/** Delete the milestone again, so the flow can be recorded again */
export async function cleanup(page, base) {
  await page.goto(base + '/milestones', { waitUntil: 'networkidle' })
  const row = page.locator('tr').filter({ has: page.getByText(NAME, { exact: true }) }).first()
  if (!(await row.count())) return
  await row.locator('button').last().click()
  await page.locator('[role=menuitem]:visible', { hasText: 'Delete' }).first().click()
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
  await page.waitForTimeout(1500)
}
