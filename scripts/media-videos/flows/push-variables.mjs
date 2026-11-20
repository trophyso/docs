/**
 * Insert a variable into a push notification: type "@" in the title, pick
 * User → Name, Insert variable. Used on features/push-notifications (Using
 * variables). Works on a temporary "Stride streak reminder" template, since
 * the Trophy default templates can't be edited; nothing is saved.
 */
import { createTemplate, openForRecording, removeTemplate } from './_push-templates.mjs'

const NAME = 'Stride streak reminder'

export const meta = {
  start: '/push/configure',
  url: 'app.trophy.so/push/templates',
  output: 'assets/features/push/push_variables.mp4',
  async prepare(page) {
    const base = new URL(page.url()).origin
    await openForRecording(page, await createTemplate(page, base, 'Streak reminder notifications', NAME))
  },
}

export default async function flow(run) {
  const { page } = run
  // Open the title for editing, then type "@" at the end of it
  await run.click(page.getByText('Your streak is waiting', { exact: true }).first())
  await run.type(page.locator('.ProseMirror:visible').first(), ', @', { delay: 110 })
  const dialog = page.locator('[role=dialog]:visible').first()
  await run.select(dialog.locator('button[aria-haspopup]').nth(0), 'User')
  await run.select(dialog.locator('button[aria-haspopup]').nth(1), 'Name')
  await run.click(dialog.getByRole('button', { name: 'Insert variable' }), { after: 1800 })
}

/** Delete the temporary template (the edit above is never saved) */
export async function cleanup(page, base) {
  await removeTemplate(page, base, NAME)
}
