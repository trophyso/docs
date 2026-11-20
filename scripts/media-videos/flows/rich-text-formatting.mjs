/**
 * Rich text: write a line in a paragraph, select its last words and make them
 * bold and italic from the formatting menu. Used on features/emails (Text
 * formatting). Works on its own template, deleted again in cleanup; never saves.
 */
import { activeEditor, createTemplate, openEditorTop, removeTemplate } from './_emails-templates.mjs'

const NAME = 'Stride weekly digest'

export const meta = {
  start: '/emails/configure',
  url: 'app.trophy.so/emails/configure',
  output: 'assets/features/emails/rich_text_formatting.mp4',
  async prepare(page) {
    await createTemplate(page, page.url().replace(/\/emails\/configure.*/, ''), 'Recap emails', NAME)
    await openEditorTop(page)
  },
}

export default async function flow(run) {
  const { page } = run
  await run.click(page.getByText(/Stay on top of your progress/).first(), { after: 500 })
  await run.type(activeEditor(page), 'Log 3 more workouts this week to keep your streak alive', { clear: true, after: 500 })
  // Select "streak alive" from the keyboard; the formatting menu pops up over it
  await run.key('Shift+Alt+ArrowLeft', { after: 150 })
  await run.key('Shift+Alt+ArrowLeft', { after: 700 })
  const menu = page.locator('.tippy-box:visible button')
  await run.click(menu.nth(0), { after: 600 }) // bold
  await run.click(menu.nth(1), { after: 1000 }) // italic
}

export async function cleanup(page, base) {
  await removeTemplate(page, base, NAME)
}
