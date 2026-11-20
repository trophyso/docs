/**
 * Add the Streak smart block to an email: hover a block → + → Streak.
 * Used on features/emails (Block types → Smart blocks → Streak).
 * Records in its own temporary milestone template (see _email-blocks.mjs);
 * deleted again in cleanup, never saved.
 */
import { HEADING, blockOption, openTemplate, plusOf, removeBlocksTemplate } from './_email-blocks.mjs'

const NAME = 'Stride streak milestone'

export const meta = {
  start: '/emails/configure',
  url: 'app.trophy.so/emails/templates',
  output: 'assets/features/emails/streak_block.mp4',
  prepare: (page) => openTemplate(page, NAME),
}

export default async function flow(run) {
  const { page } = run
  await run.hover(page.getByText(HEADING, { exact: true }).first(), { after: 500 })
  await run.click(plusOf(page, HEADING), { after: 900 })
  await run.click(blockOption(page, 'Streak'), { after: 1500 })
  // The streak calendar renders in place, below the heading
  await run.show(page.locator('div.flex.gap-4.items-start', { has: page.getByText(/^sun$/i) }).last(), { hold: 1800 })
}

export async function cleanup(page, base) {
  await removeBlocksTemplate(page, base, NAME)
}
