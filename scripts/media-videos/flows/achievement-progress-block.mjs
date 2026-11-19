/**
 * Add the Achievement Progress Chart smart block and pick its metric:
 * hover a block → + → Achievement Progress Chart → Metric: Workouts.
 * Used on features/emails (Block types → Smart blocks → Achievement Progress Chart).
 * Records in its own temporary milestone template (see _email-blocks.mjs);
 * deleted again in cleanup, never saved.
 *
 * NOT RENDERED YET: on staging the block shows "No milestones found" for
 * every metric (Workouts, Lessons, Words, Pages), with or without a preview
 * user, so the result would be an empty chart. Re-run once the test org's
 * milestones show up in this block; consider closing the settings with
 * Escape at the end, as progress-chart-block does.
 */
import { HEADING, blockOption, openTemplate, plusOf, removeBlocksTemplate } from './_email-blocks.mjs'

const NAME = 'Stride milestone progress'

export const meta = {
  start: '/emails/configure',
  url: 'app.trophy.so/emails/templates',
  output: 'assets/features/emails/achievement_progress_block.mp4',
  prepare: (page) => openTemplate(page, NAME),
}

export default async function flow(run) {
  const { page } = run
  await run.hover(page.getByText(HEADING, { exact: true }).first(), { after: 500 })
  await run.click(plusOf(page, HEADING), { after: 900 })
  await run.click(blockOption(page, 'Achievement Progress Chart'), { after: 1200 })
  // Selecting the block opens its settings: choose the metric to chart milestones for
  const metric = page.locator('button[aria-haspopup=listbox]:visible', { hasText: 'Admin API Test' }).first()
  if (!(await metric.count())) await run.click(page.getByText('No milestones found').first(), { after: 900 })
  await run.select(metric, 'Workouts', { after: 1800 })
}

export async function cleanup(page, base) {
  await removeBlocksTemplate(page, base, NAME)
}
