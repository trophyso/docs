/**
 * The four legacy email types: scroll the Emails → Configure page through its
 * sections (milestone, recap, reactivation, streak reminder emails).
 * Used on features/emails (Types of emails). Changes nothing.
 */
import { tidyEditor } from './_emails-templates.mjs'

export const meta = {
  start: '/emails/configure',
  url: 'app.trophy.so/emails/configure',
  output: 'assets/features/emails/email_types.mp4',
  // The test org is called "test", which shows in the template previews
  prepare: (page) => tidyEditor(page),
}

const SECTIONS = ['Milestone completed emails', 'Recap emails', 'Reactivation emails', 'Streak reminder emails']

export default async function flow(run) {
  const { page } = run
  for (const [i, section] of SECTIONS.entries()) {
    const heading = page.locator('h2:visible, h3:visible', { hasText: section }).first()
    if (i > 0) {
      await heading.evaluate((h) => {
        h.style.scrollMarginTop = '24px'
        h.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
      await run.wait(900)
    }
    await run.show(heading, { hold: 1700 })
  }
}
