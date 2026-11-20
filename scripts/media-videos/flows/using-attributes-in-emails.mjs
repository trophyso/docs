/**
 * Event attributes in email variables: insert a Workouts variable filtered to
 * the Equipment attribute "bike". Used on data-sources/events (Email
 * customization). Works on its own template, deleted again in cleanup; never saves.
 */
import { activeEditor, createTemplate, openEditorTop, removeTemplate } from './_emails-templates.mjs'

const NAME = 'Stride weekly digest'

export const meta = {
  start: '/emails/configure',
  url: 'app.trophy.so/emails/configure',
  output: 'assets/features/events/using_attributes_in_emails.mp4',
  async prepare(page) {
    await createTemplate(page, page.url().replace(/\/emails\/configure.*/, ''), 'Recap emails', NAME)
    await openEditorTop(page)
  },
}

export default async function flow(run) {
  const { page } = run
  await run.click(page.getByText(/Stay on top of your progress/).first(), { after: 500 })
  await run.type(activeEditor(page), 'Bike workouts so far: @', { clear: true, after: 900 })
  const dialog = page.locator('[role=dialog]').last()
  const lists = dialog.locator('button[aria-haspopup=listbox]')
  await run.select(lists.nth(0), 'Metric')
  await run.select(lists.nth(1), 'Workouts')
  await run.select(lists.nth(2), 'Equipment')
  await run.type(dialog.locator('input:visible').first(), 'bike')
  await run.select(lists.nth(3), 'Current total')
  await run.click(dialog.getByRole('button', { name: 'Insert variable' }), { after: 400 })
  await run.show(activeEditor(page), { hold: 1500 })
}

export async function cleanup(page, base) {
  await removeTemplate(page, base, NAME)
}
