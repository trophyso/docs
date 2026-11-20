/**
 * Rearrange blocks by dragging a block's handle: move the heading below
 * the card.
 * Used on features/emails (Using the editor → Arranging blocks).
 * Records in its own temporary milestone template (see _email-blocks.mjs);
 * deleted again in cleanup, never saved.
 */
import { HEADING, blockRow, handleOf, openTemplate, removeBlocksTemplate } from './_email-blocks.mjs'

const NAME = 'Stride run milestone'

export const meta = {
  start: '/emails/configure',
  url: 'app.trophy.so/emails/templates',
  output: 'assets/features/emails/arranging_blocks.mp4',
  prepare: (page) => openTemplate(page, NAME),
}

export default async function flow(run) {
  const { page } = run
  await run.hover(page.getByText(HEADING, { exact: true }).first(), { after: 400 })
  // Drop it on the lower part of the card (its "Keep Going" button row) to land after it
  const card = blockRow(page, 'Keep Going')
  await run.drag(handleOf(page, HEADING), card.getByText('Keep Going', { exact: true }).first(), { after: 1800 })
}

export async function cleanup(page, base) {
  await removeBlocksTemplate(page, base, NAME)
}
