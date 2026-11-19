/**
 * Add the Achievements Unlocked smart block, then preview it with a
 * milestone: hover a block → + → Achievements Unlocked → Preview Variables
 * Milestone: 10 workouts → Update variables.
 * Used on features/emails (Block types → Smart blocks → Achievements Unlocked).
 * Records in its own temporary milestone template (see _email-blocks.mjs);
 * deleted again in cleanup, never saved.
 */
import { activeEditor } from './_emails-templates.mjs'
import { HEADING, blockOption, deleteBlock, openTemplate, plusOf, removeBlocksTemplate } from './_email-blocks.mjs'

const NAME = 'Stride milestone unlocked'

export const meta = {
  start: '/emails/configure',
  url: 'app.trophy.so/emails/templates',
  output: 'assets/features/emails/achievements_unlocked_block.mp4',
  async prepare(page) {
    await openTemplate(page, NAME)
    // The default milestone template already has one inside its card: start without it
    await deleteBlock(page, 'Keep Going')
    // The default subject reads "Congratulations on !" once a milestone is previewed
    // (a staging data gap), so give this draft a plain subject. Unsaved, like the rest.
    await page.getByText(/^Congratulations on .*User Name!$/).first().click()
    await activeEditor(page).fill('You unlocked a new Stride milestone')
    await page.keyboard.press('Escape')
    await page.mouse.move(2, 898)
    await page.waitForTimeout(600)
  },
}

export default async function flow(run) {
  const { page } = run
  await run.hover(page.getByText(HEADING, { exact: true }).first(), { after: 500 })
  await run.click(plusOf(page, HEADING), { after: 900 })
  await run.click(blockOption(page, 'Achievements Unlocked'), { after: 1200 })
  // It shows the milestone that triggered the email: pick one to preview
  await run.select(page.locator('button[aria-haspopup=listbox]:visible', { hasText: 'None selected' }).first(), '10 workouts')
  await run.click(page.getByRole('button', { name: 'Update variables' }), { after: 2000 })
}

export async function cleanup(page, base) {
  await removeBlocksTemplate(page, base, NAME)
}
