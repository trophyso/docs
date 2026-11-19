/**
 * Add a block right after another from its block menu: click a block's
 * handle → Insert Block After → Paragraph, then write it.
 * Used on features/emails (Using the editor → Adding blocks).
 * Records in its own temporary milestone template (see _email-blocks.mjs);
 * deleted again in cleanup, never saved.
 */
import { activeEditor } from './_emails-templates.mjs'
import { HEADING, blockOption, handleOf, openTemplate, removeBlocksTemplate } from './_email-blocks.mjs'

const NAME = 'Stride workout milestone'

export const meta = {
  start: '/emails/configure',
  url: 'app.trophy.so/emails/templates',
  output: 'assets/features/emails/add_new_block_by_block_menu.mp4',
  prepare: (page) => openTemplate(page, NAME),
}

export default async function flow(run) {
  const { page } = run
  await run.hover(page.getByText(HEADING, { exact: true }).first(), { after: 400 })
  await run.click(handleOf(page, HEADING), { after: 700 })
  await run.click(page.locator('[role=menuitem]:visible', { hasText: 'Insert Block After' }).first(), { after: 900 })
  await run.click(blockOption(page, 'Paragraph'), { after: 900 })
  // The new paragraph is empty: click into it and write
  await run.click(page.getByText('Enter some text...').first(), { after: 500 })
  await run.type(activeEditor(page), 'Ten workouts down. Your next run is waiting.', { after: 1500 })
}

export async function cleanup(page, base) {
  await removeBlocksTemplate(page, base, NAME)
}
