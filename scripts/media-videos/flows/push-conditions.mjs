/**
 * Add a condition to a push notification's body: open the body, Add
 * Condition, "Has active streak is False", type the text for that case. Used
 * on features/push-notifications (Using conditions). Works on a temporary
 * "Stride streak reminder" template, since the Trophy default templates
 * can't be edited; nothing is saved.
 */
import { createTemplate, openForRecording, removeTemplate } from './_push-templates.mjs'

const NAME = 'Stride streak reminder'

export const meta = {
  start: '/push/configure',
  url: 'app.trophy.so/push/templates',
  output: 'assets/features/push/push_conditions.mp4',
  async prepare(page) {
    const base = new URL(page.url()).origin
    await openForRecording(page, await createTemplate(page, base, 'Streak reminder notifications', NAME))
  },
}

export default async function flow(run) {
  const { page } = run
  await run.click(page.getByText("We know you've been busy, but don't let it end!", { exact: true }).first())
  await run.click(page.getByRole('button', { name: 'Add Condition' }).filter({ visible: true }).first())
  // New condition: "if Has active streak is True"; switch it to False
  await run.select(page.getByRole('button', { name: 'True', exact: true }).first(), 'False')
  const empty = page.locator('.ProseMirror:visible').filter({ hasNotText: /\S/ }).first()
  await run.type(empty, 'Start a new streak with a quick 10-minute run!', { after: 1800 })
}

/** Delete the temporary template (the edit above is never saved) */
export async function cleanup(page, base) {
  await removeTemplate(page, base, NAME)
}
