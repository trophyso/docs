/**
 * Create a global points boost: on a points system's Boosts tab, New boost →
 * name it → set the multiplier → pick an end date → Create. The boost shows
 * up in the table.
 * Used on features/points (Points boosts → Creating boosts).
 *
 * Records against its own "Stride XP" system, created before recording and
 * deleted afterwards.
 */
import { deleteStrideXp, openForRecording, setupStrideXp } from './create-system.mjs'

export const meta = {
  start: '/points',
  url: 'app.trophy.so/points',
  output: 'assets/features/points/create_points_boost.mp4',
  async prepare(page) {
    const base = new URL(page.url()).origin
    const root = await setupStrideXp(page, base)
    await openForRecording(page, base, root + '/boosts')
  },
}

export default async function flow(run) {
  const { page } = run
  await run.click(page.locator('a:visible, button:visible', { hasText: 'New boost' }).first(), { after: 1200 })
  await run.type(page.locator('input[name=name]:visible'), '2X XP - All users - Holiday 2026')
  await run.type(page.locator('input[name=multiplier]:visible'), '2', { clear: true })
  // Open the end date calendar and pick the 28th (this month's, or next month's if it's already past)
  await run.click(page.locator('input[placeholder="Select end date"]:visible'), { after: 700 })
  const day = page.locator('button:visible:not([disabled])').filter({ hasText: /^28$/ }).first()
  await run.click(day, { after: 900 })
  await run.click(page.locator('button[type=submit]:visible', { hasText: 'Create' }).last(), { after: 2500 })
}

export async function cleanup(page, base) {
  await deleteStrideXp(page, base)
}
