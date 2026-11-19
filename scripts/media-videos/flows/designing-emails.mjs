/**
 * Designing an email: add a recap template, name it, then rewrite its
 * headline and intro in the block editor. Used on features/emails (Designing
 * emails, and Creating a new template → Design your new template).
 * Works on its own template, deleted again in cleanup; never saves.
 */
import { activeEditor, addTemplateIn, removeTemplate, tidyEditor } from './_emails-templates.mjs'

const NAME = 'Stride weekly digest'
let created, renamed // the default name "Add template" gave the template, e.g. "Recap email 3"

export const meta = {
  start: '/emails/configure',
  url: 'app.trophy.so/emails/configure',
  output: 'assets/features/emails/designing_emails.mp4',
  async prepare(page) {
    await tidyEditor(page)
    // Bring the Recap section into view, so the video opens on it
    await page.locator('h2:visible, h3:visible', { hasText: 'Recap emails' }).first().evaluate((h) => {
      h.style.scrollMarginTop = '24px'
      h.scrollIntoView({ block: 'start' })
    })
  },
}

export default async function flow(run) {
  const { page } = run
  // "Add template" creates the template and opens it in the editor
  await run.click(addTemplateIn(page, 'Recap emails'), { after: 600 })
  await page.waitForURL(/\/emails\/templates\//, { timeout: 20000 })
  await page.getByText('to add a block').first().waitFor({ timeout: 20000 })
  await tidyEditor(page)
  created = (await page.locator('h1:visible').first().innerText()).trim()
  await page.waitForLoadState('networkidle')
  await run.wait(1200)

  // Name it
  // The pencil only responds once the editor has settled; retry like a person would
  // (the dialog element itself has no size, so check its input)
  const dialog = page.locator('[role=dialog]').last()
  for (let i = 0; i < 3 && !(await dialog.locator('input:visible').count()); i++) {
    await run.click(page.locator('h1:visible button').last(), { after: 900 })
  }
  await run.type(dialog.locator('input:visible').first(), NAME, { clear: true })
  await run.click(dialog.getByRole('button', { name: 'Confirm' }), { after: 1000 })
  renamed = true

  // Rewrite the headline, then the intro paragraph
  await run.click(page.locator('h1:visible', { hasText: /weekly report is in/ }).first(), { after: 500 })
  await run.type(activeEditor(page), 'Your week on Stride', { clear: true })
  await run.click(page.getByText(/Stay on top of your progress/).first(), { after: 500 })
  await run.type(activeEditor(page), 'Here is how your training stacked up this week.', { clear: true, after: 1200 })
}

export async function cleanup(page, base) {
  await removeTemplate(page, base, NAME)
  // Only if the flow stopped before renaming it (otherwise the name may be reused)
  if (created && !renamed) await removeTemplate(page, base, created)
  created = renamed = undefined
}
