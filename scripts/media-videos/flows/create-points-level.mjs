/**
 * Add a points level: on a points system's Levels tab, New level → name it
 * (the key fills in) → set the points threshold → Save. The new level joins
 * the existing ones in the table.
 * Used on features/points (Points levels → Configuring levels).
 *
 * Records against its own "Stride XP" system (with Bronze and Silver levels),
 * created before recording and deleted afterwards.
 */
import { deleteStrideXp, openForRecording, setupStrideXp } from './create-system.mjs'

export const meta = {
  start: '/points',
  url: 'app.trophy.so/points',
  output: 'assets/features/points/create_points_level.mp4',
  async prepare(page) {
    const base = new URL(page.url()).origin
    const root = await setupStrideXp(page, base, {
      levels: [
        { name: 'Bronze', key: 'bronze', points: 100 },
        { name: 'Silver', key: 'silver', points: 500 },
      ],
    })
    await openForRecording(page, base, root + '/levels')
  },
}

export default async function flow(run) {
  const { page } = run
  await run.click(page.locator('a:visible, button:visible', { hasText: 'New level' }).first(), { after: 1200 })
  const name = page.locator('input[name=name]:visible')
  await run.type(name, 'Gold')
  // The key fills in from the name when the name field loses focus
  await run.blur(name)
  await run.type(page.locator('input[name=description]:visible'), 'Reached after 1,000 XP of workouts')
  await run.type(page.locator('input[name=points]:visible'), '1000', { clear: true })
  await run.click(page.locator('button[type=submit]:visible', { hasText: 'Save' }).last(), { after: 2500 })
}

export async function cleanup(page, base) {
  await deleteStrideXp(page, base)
}
