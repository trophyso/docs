/**
 * Create a points trigger: on a points system's configure page, New trigger →
 * choose the Metric type → pick Workouts → set the points → Save. The new
 * trigger shows up as Inactive in the triggers table.
 * Used on features/points (Points triggers → Creating triggers).
 *
 * Records against its own "Stride XP" system, created before recording and
 * deleted afterwards.
 */
import { deleteStrideXp, openForRecording, setupStrideXp } from './create-system.mjs'

export const meta = {
  start: '/points',
  url: 'app.trophy.so/points',
  output: 'assets/features/points/create_trigger.mp4',
  async prepare(page) {
    const base = new URL(page.url()).origin
    const root = await setupStrideXp(page, base)
    await openForRecording(page, base, root + '/configure')
    // Open on the (empty) triggers table, so the new trigger is in view when it's saved
    await page.getByRole('button', { name: 'Add trigger' }).evaluate((el) => el.scrollIntoView({ block: 'end' }))
    await page.waitForTimeout(500)
  },
}

export default async function flow(run) {
  const { page } = run
  await run.click(page.getByRole('button', { name: 'New trigger' }), { after: 1200 })
  const form = page.locator('form:has(input[name=points])')
  const boxes = form.locator('[aria-haspopup=listbox]:visible')
  // Show the trigger types, then keep Metric
  await run.select(boxes.nth(0), 'Metric')
  await run.select(boxes.nth(1), 'Workouts')
  await run.type(form.locator('input[name=points]'), '10', { clear: true })
  await run.click(form.locator('button[type=submit]', { hasText: 'Save' }), { after: 1500 })
  // Saving can be slow on staging: wait for the new row, then point at its Inactive status
  const row = page.locator('tr', { hasText: 'Every 1 Workout' }).first()
  await row.waitFor({ timeout: 20000 })
  await run.show(row.getByText('Inactive', { exact: true }), { hold: 1500 })
}

export async function cleanup(page, base) {
  await deleteStrideXp(page, base)
}
