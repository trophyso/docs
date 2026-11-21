/**
 * View an environment's changes: from Feature dev, open the environment
 * selector → View changes, which lists what Feature dev has that QA doesn't.
 * (Switching the target to Staging would show badge-only differences that
 * every copy of Production has, so the video stays on QA.)
 * Used on platform/environments (Viewing changes).
 * Records in the single-tenant "Staging [Old]" org with a temporary Feature
 * dev environment; see _environment-changes.mjs. Read-only apart from that setup.
 */
import { DEV, seed, teardown } from './_environment-changes.mjs'

export const meta = {
  start: '/environments',
  url: 'app.trophy.so/environments',
  output: 'assets/platform/environments/viewing_changes.mp4',
  async prepare(page) {
    const base = new URL(page.url()).origin
    await seed(page, base)
    await page.goto(base + '/environments', { waitUntil: 'networkidle' })
    await page.mouse.move(2, 898)
  },
}

export default async function flow(run) {
  const { page } = run
  // The selector shows the environment's change count before its name
  await run.click(page.getByRole('button', { name: new RegExp(`${DEV.name}$`) }).first(), { after: 700 })
  await run.click(page.locator('[role=menuitem]:visible', { hasText: 'View changes' }).first(), { after: 3000 })
}

export const cleanup = teardown
