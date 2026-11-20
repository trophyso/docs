/**
 * Create a new metric: New metric → name it → Create metric.
 * Used on getting-started/quickstart and data-sources/metrics.
 * The name matches the quickstart's example key, flashcards-flipped.
 */
export const meta = {
  start: '/metrics',
  url: 'app.trophy.so/metrics',
  output: 'assets/features/metrics/create_new_metric.mp4',
}

export default async function flow(run) {
  const { page } = run
  await run.click(page.locator('button:visible, a:visible', { hasText: 'New metric' }).first())
  const dialog = page.locator('[role=dialog]:visible').first()
  const inputs = dialog.locator('input:visible')
  await run.type(inputs.nth(0), 'Flashcards flipped')
  // The key fills in from the name when the name field loses focus
  await run.blur(inputs.nth(0))
  await run.click(dialog.locator('button', { hasText: 'Create metric' }).first(), { after: 2500 })
}

/** Delete the metric again, so the flow can be recorded again */
export async function cleanup(page, base) {
  await page.goto(base + '/metrics', { waitUntil: 'networkidle' })
  const row = page.locator('table tbody tr', { hasText: 'flashcards-flipped' }).first()
  if (!(await row.count())) return
  await row.locator('button').last().click()
  await page.locator('[role=menuitem]:visible', { hasText: 'Delete' }).first().click()
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
  await page.waitForTimeout(1500)
}
