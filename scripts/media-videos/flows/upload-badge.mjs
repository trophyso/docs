/**
 * Add a badge to a milestone: open the milestone → upload a badge image → Save.
 * Used on features/milestones (Using badges).
 * prepare() creates the "100 workouts" milestone off camera; cleanup deletes it.
 */
import { fileURLToPath } from 'node:url'

const NAME = '100 workouts'
const BADGE = fileURLToPath(new URL('../fixtures/100-workouts-badge.png', import.meta.url))

export const meta = {
  start: '/milestones',
  url: 'app.trophy.so/milestones',
  output: 'assets/features/achievements/upload_badge.mp4',
  /** Create the milestone to add a badge to, before recording starts */
  async prepare(page) {
    await page.locator('button:visible', { hasText: 'New milestone' }).first().click()
    await page.getByPlaceholder('Enter a name').fill(NAME)
    await page.getByPlaceholder('Enter a description').fill('Complete 100 workouts in Stride')
    await page.locator('button[aria-haspopup=listbox]:visible', { hasText: 'None selected' }).first().click()
    await page.locator('[role=option]:visible', { hasText: 'Workouts' }).first().click()
    await page.locator('input[type=number]:visible').first().fill('100')
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await page.locator('tr').filter({ has: page.getByText(NAME, { exact: true }) }).first().waitFor()
    // Reload so the "Milestone saved" toast isn't in the opening frames
    await page.reload({ waitUntil: 'networkidle' })
  },
}

export default async function flow(run) {
  const { page } = run
  await run.click(page.locator('tr').filter({ has: page.getByText(NAME, { exact: true }) }).first().getByText(NAME, { exact: true }))
  await run.upload(page.getByText('Click to upload').first(), page.locator('input[type=file]').first(), BADGE, { after: 800 })
  // Point at the uploaded badge preview (image, file name, Remove image)
  await run.show(page.locator('img[alt="Uploaded image"]').locator('xpath=..'), { hold: 1800 })
  // Let the "Image uploaded!" toast clear first: it sits on top of the Save button
  await page.getByText('Image uploaded!').waitFor({ state: 'hidden', timeout: 15000 }).catch(() => {})
  // The badge shows up in the milestone's row as the panel closes
  await run.click(page.getByRole('button', { name: 'Save', exact: true }), { after: 2500 })
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
