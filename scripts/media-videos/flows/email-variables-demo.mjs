/**
 * Email variables: type @ in a paragraph, pick the user's name in the
 * variable editor, insert it and carry on typing. Used on features/emails
 * (Email variables). Works on its own template, deleted again in cleanup;
 * never saves.
 */
import { activeEditor, createTemplate, openEditorTop, removeTemplate } from './_emails-templates.mjs'

const NAME = 'Stride weekly digest'

export const meta = {
  start: '/emails/configure',
  url: 'app.trophy.so/emails/configure',
  output: 'assets/features/emails/email_variables_demo.mp4',
  async prepare(page) {
    await createTemplate(page, page.url().replace(/\/emails\/configure.*/, ''), 'Recap emails', NAME)
    await openEditorTop(page)
  },
}

export default async function flow(run) {
  const { page } = run
  await run.click(page.getByText(/Stay on top of your progress/).first(), { after: 500 })
  // Typing @ opens the variable editor
  await run.type(activeEditor(page), 'Great work this week, @', { clear: true, after: 900 })
  const dialog = page.locator('[role=dialog]').last()
  const lists = dialog.locator('button[aria-haspopup=listbox]')
  await run.select(lists.nth(0), 'User')
  await run.select(lists.nth(1), 'Name')
  await run.click(dialog.getByRole('button', { name: 'Insert variable' }), { after: 400 })
  // Carry on typing after the variable (the caret is already there)
  await page.keyboard.type('! Keep moving on Stride.', { delay: 75 })
  await run.show(activeEditor(page), { hold: 1200 })
}

export async function cleanup(page, base) {
  await removeTemplate(page, base, NAME)
}
