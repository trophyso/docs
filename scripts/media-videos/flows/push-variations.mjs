/**
 * Add a variation to a push notification's body: open the body, Add
 * Variation, type it. Used on features/push-notifications (Using
 * variations). Works on a temporary "Stride streak reminder" template, since
 * the Trophy default templates can't be edited; nothing is saved.
 */
import { createTemplate, openForRecording, removeTemplate } from './_push-templates.mjs'

const NAME = 'Stride streak reminder'

export const meta = {
  start: '/push/configure',
  url: 'app.trophy.so/push/templates',
  output: 'assets/features/push/push_variations.mp4',
  async prepare(page) {
    const base = new URL(page.url()).origin
    await openForRecording(page, await createTemplate(page, base, 'Streak reminder notifications', NAME))
  },
}

export default async function flow(run) {
  const { page } = run
  // Open the body for editing: it already has a few variations
  await run.click(page.getByText("We know you've been busy, but don't let it end!", { exact: true }).first())
  // Leaving the editor hides its "Press @" hint and shifts the button up, which
  // would swallow the click; blur first so the layout settles
  await run.blur(page.locator('.ProseMirror-focused').first(), { after: 500 })
  await run.click(page.getByRole('button', { name: 'Add Variation' }).filter({ visible: true }).first())
  // The new, empty variation
  const empty = page.locator('.ProseMirror:visible').filter({ hasNotText: /\S/ }).first()
  await run.type(empty, 'Lace up for a quick run and keep your streak alive!', { after: 1800 })
}

/** Delete the temporary template (the edit above is never saved) */
export async function cleanup(page, base) {
  await removeTemplate(page, base, NAME)
}
