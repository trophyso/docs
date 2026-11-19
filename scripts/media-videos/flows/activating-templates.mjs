/**
 * Activate a push template: ⋮ → Activate for → Workouts Milestones; the card
 * turns Active and shows its milestone types. Used on
 * features/push-notifications (Sending push notifications → Activate
 * templates). Uses a temporary "Stride milestone" template, which cleanup
 * deactivates and deletes, so the Trophy default templates stay as they were.
 */
import { CONFIGURE, createTemplate, domClickTarget, menuOf, openForRecording, removeTemplate } from './_push-templates.mjs'

const NAME = 'Stride milestone'

export const meta = {
  start: CONFIGURE,
  url: 'app.trophy.so/push/configure',
  output: 'assets/features/push/activating_templates.mp4',
  async prepare(page) {
    const base = new URL(page.url()).origin
    await createTemplate(page, base, 'Milestone completed notifications', NAME)
    await openForRecording(page, base + CONFIGURE)
    // Open with the new template's card high enough that its menu and the
    // "Activate for" submenu open downwards, fully in view
    await page.getByText(NAME, { exact: true }).first().evaluate((el) => {
      el.style.scrollMarginTop = '300px'
      el.scrollIntoView({ block: 'start' })
    })
    await page.waitForTimeout(500)
  },
}

export default async function flow(run) {
  const { page } = run
  await run.click(menuOf(page, NAME))
  await run.hover(page.locator('[role=menuitem]:visible', { hasText: 'Activate for' }).first(), { after: 600 })
  // Hovering opens the submenu and keeps the real mouse on its trigger
  const item = page.locator('[role=menuitem]:visible', { hasText: 'Workouts Milestones' }).first()
  await run.click(domClickTarget(item), { after: 2000 })
}

/** Deactivate and delete the temporary template */
export async function cleanup(page, base) {
  await removeTemplate(page, base, NAME)
}
