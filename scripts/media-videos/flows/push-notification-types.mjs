/**
 * The four types of legacy push notification: hover each section's "?" on
 * /push/configure to show what it's for, scrolling down between them. Used
 * on features/push-notifications (Types of push notifications). Read-only.
 */
import { CONFIGURE, helpOf, scrollToSection } from './_push-templates.mjs'

export const meta = {
  start: CONFIGURE,
  url: 'app.trophy.so/push/configure',
  output: 'assets/features/push/push_notification_types.mp4',
}

const SECTIONS = [
  'Milestone completed notifications',
  'Recap notifications',
  'Reactivation notifications',
  'Streak reminder notifications',
]

export default async function flow(run) {
  const { page } = run
  for (const [i, section] of SECTIONS.entries()) {
    if (i > 0) {
      // Move the real mouse off the "?" first so the last tooltip closes
      await page.mouse.move(1400, 880)
      await scrollToSection(page, section)
    }
    await run.hover(helpOf(page, section), { after: 1800 })
  }
}
