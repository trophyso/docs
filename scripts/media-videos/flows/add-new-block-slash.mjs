/**
 * Add a block with the / key: press / → search the block menu → pick one.
 * Used on features/emails (Using the editor → Adding blocks).
 * Records in its own temporary milestone template (see _email-blocks.mjs);
 * deleted again in cleanup, never saved.
 */
import { activeEditor } from './_emails-templates.mjs'
import { blockOption, openTemplate, removeBlocksTemplate } from './_email-blocks.mjs'

const NAME = 'Stride milestone email'

export const meta = {
  start: '/emails/configure',
  url: 'app.trophy.so/emails/templates',
  output: 'assets/features/emails/add_new_block_slash.mp4',
  prepare: (page) => openTemplate(page, NAME),
}

export default async function flow(run) {
  const { page } = run
  // The hint at the bottom of the email: press / anywhere to open the block menu
  await run.hover(page.getByText('to add a block').first(), { after: 700 })
  await run.key('/', { after: 1000 })
  await run.type(page.getByPlaceholder('Search for a block...'), 'head', { after: 700 })
  await run.click(blockOption(page, 'Header 2'), { after: 900 })
  // The new heading lands at the end of the email, open for editing: write it
  if (!(await activeEditor(page).count())) await run.click(page.getByText('Enter some text...').first(), { after: 500 })
  await run.type(activeEditor(page), 'Your next goal: 20 workouts', { after: 1500 })
}

export async function cleanup(page, base) {
  await removeBlocksTemplate(page, base, NAME)
}
