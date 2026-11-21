/**
 * Revert one change: on Feature dev's changes page, click ↺ on
 * Create metric "Steps" → Revert, and the change leaves the list.
 * Used on platform/environments (Reverting changes).
 * Records in the single-tenant "Staging [Old]" org with a temporary Feature
 * dev environment; see _environment-changes.mjs. The revert only touches
 * Feature dev, which teardown deletes.
 */
import { CHANGES, changeRow, seed, teardown } from './_environment-changes.mjs'

export const meta = {
  start: '/environments',
  url: 'app.trophy.so/environments/feature-dev/changes/qa',
  output: 'assets/platform/environments/reverting_changes.mp4',
  async prepare(page) {
    const base = new URL(page.url()).origin
    await seed(page, base)
    await page.goto(base + CHANGES, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    await page.mouse.move(2, 898)
  },
}

export default async function flow(run) {
  const { page } = run
  await run.click(changeRow(page, 'Create metric "Steps"').locator('button').last(), { after: 900 })
  await run.click(page.getByRole('button', { name: 'Revert', exact: true }).last(), { after: 2500 })
}

export const cleanup = teardown
