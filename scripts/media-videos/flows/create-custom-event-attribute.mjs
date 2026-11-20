/**
 * Create a custom event attribute: Add event attribute → name → Create.
 * Used on data-sources/events (Custom event attributes → Creating attributes).
 * The button now lives on the Attributes page (Data sources → Attributes).
 */
export const meta = {
  start: '/attributes',
  url: 'app.trophy.so/attributes',
  output: 'assets/features/events/create_custom_event_attribute.mp4',
}

export default async function flow(run) {
  const { page } = run
  await run.click(page.getByRole('button', { name: 'Add event attribute' }))
  const dialog = page.locator('[role=dialog]:visible').first()
  await run.type(dialog.locator('input:visible').nth(0), 'Weight')
  // The key fills in from the name when the name field loses focus
  await run.blur(dialog.locator('input:visible').nth(0))
  // The new row shows up in the event attributes table as the camera zooms out
  await run.click(dialog.getByRole('button', { name: 'Create event attribute' }), { after: 1500 })
}

/** Remove the attribute again (only the row whose key is exactly "weight") */
export async function cleanup(page, base) {
  await page.goto(base + '/attributes', { waitUntil: 'networkidle' })
  await page.locator('table').first().waitFor()
  const row = page.locator('tr').filter({ has: page.getByText('weight', { exact: true }) }).first()
  if (!(await row.count())) return
  await row.locator('button').last().click()
  await page.locator('[role=menuitem]:visible', { hasText: /Delete|Archive/ }).first().click()
  await page.getByRole('button', { name: /^(Delete|Archive)$/ }).last().click()
  await page.waitForTimeout(1500)
}
