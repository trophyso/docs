/**
 * Create a custom user attribute: Add user attribute → name → Create.
 * Used on data-sources/users (Custom user attributes → Creating attributes).
 */
export const meta = {
  start: '/attributes',
  url: 'app.trophy.so/attributes',
  output: 'assets/features/users/create_custom_user_attribute.mp4',
}

export default async function flow(run) {
  const { page } = run
  await run.click(page.getByRole('button', { name: 'Add user attribute' }))
  const dialog = page.locator('[role=dialog]:visible').first()
  await run.type(dialog.locator('input:visible').nth(0), 'Fitness goal')
  // The key fills in from the name when the name field loses focus
  await run.blur(dialog.locator('input:visible').nth(0))
  // The new row shows up in the table as the camera zooms back out
  await run.click(dialog.getByRole('button', { name: 'Create user attribute' }), { after: 1500 })
}

/** Remove the attribute again so the flow can be re-recorded */
export async function cleanup(page, base) {
  await page.goto(base + '/attributes', { waitUntil: 'networkidle' })
  const row = page.locator('tr', { hasText: 'fitness-goal' }).first()
  if (!(await row.count())) return
  await row.locator('button').last().click()
  await page.locator('[role=menuitem]:visible', { hasText: /Delete|Archive/ }).first().click()
  await page.getByRole('button', { name: /^(Delete|Archive)$/ }).last().click()
  await page.waitForTimeout(1500)
}
