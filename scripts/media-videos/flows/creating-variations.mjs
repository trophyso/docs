/**
 * Text variations: add two variations to the email's headline, so each email
 * picks one at random. Used on features/emails (Text variations). Works on its
 * own template, deleted again in cleanup; never saves.
 */
import { activeEditor, createTemplate, openEditorTop, removeTemplate } from './_emails-templates.mjs'

const NAME = 'Stride weekly digest'

export const meta = {
  start: '/emails/configure',
  url: 'app.trophy.so/emails/configure',
  output: 'assets/features/emails/creating_variations.mp4',
  async prepare(page) {
    await createTemplate(page, page.url().replace(/\/emails\/configure.*/, ''), 'Recap emails', NAME)
    await openEditorTop(page)
  },
}

export default async function flow(run) {
  const { page } = run
  // The intro paragraph (the headline already has variations in the default template)
  await run.click(page.getByText(/Stay on top of your progress/).first(), { after: 500 })
  const editors = page.locator('[contenteditable=true]:visible')
  for (const text of ['Another strong week on Stride. Keep it up!', 'Your training is paying off. Here is your week.']) {
    // Leaving the text first settles the block, so the button doesn't move under the click
    await run.blur(activeEditor(page), { after: 400 })
    const add = page.getByRole('button', { name: 'Add Variation' }).first()
    const before = await editors.count()
    await run.click(add, { after: 500 })
    // A click right after editing a variation can be swallowed; press the button from the keyboard instead
    if ((await editors.count()) === before) {
      await add.focus()
      await page.keyboard.press('Enter')
      await run.wait(500)
    }
    await run.type(editors.last(), text)
  }
  await run.blur(editors.last(), { after: 1200 })
}

export async function cleanup(page, base) {
  await removeTemplate(page, base, NAME)
}
