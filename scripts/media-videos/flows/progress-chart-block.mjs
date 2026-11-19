/**
 * Add the Progress Chart smart block and pick its metric:
 * hover a block → + → Progress Chart → Metric: Workouts.
 * Used on features/emails (Block types → Smart blocks → Progress Chart).
 * Records in its own temporary milestone template (see _email-blocks.mjs);
 * deleted again in cleanup, never saved.
 */
import { HEADING, blockOption, openTemplate, plusOf, removeBlocksTemplate } from './_email-blocks.mjs'

const NAME = 'Stride progress update'

export const meta = {
  start: '/emails/configure',
  url: 'app.trophy.so/emails/templates',
  output: 'assets/features/emails/progress_chart_block.mp4',
  prepare: (page) => openTemplate(page, NAME),
}

export default async function flow(run) {
  const { page } = run
  await run.hover(page.getByText(HEADING, { exact: true }).first(), { after: 500 })
  await run.click(plusOf(page, HEADING), { after: 900 })
  await run.click(blockOption(page, 'Progress Chart'), { after: 1200 })
  // Selecting the block opens its settings: choose the metric to chart
  await run.click(page.getByText('this week', { exact: true }).first(), { after: 900 })
  const metric = page.locator('button[aria-haspopup=listbox]:visible', { hasText: 'Admin API Test' }).first()
  await run.select(metric, 'Workouts', { after: 1500 })
  // Close the settings to see the chart as it will look in the email
  await run.key('Escape', { after: 1800 })
}

export async function cleanup(page, base) {
  await removeBlocksTemplate(page, base, NAME)
}
