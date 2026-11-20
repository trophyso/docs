/**
 * Event attributes in email charts: add a Progress Chart block and filter it
 * to workouts with the Equipment attribute "bike". Used on data-sources/events
 * (Email customization). Works on its own template, deleted again in cleanup;
 * never saves.
 */
import { createTemplate, removeTemplate } from './_emails-templates.mjs'

const NAME = 'Stride weekly digest'

export const meta = {
  start: '/emails/configure',
  url: 'app.trophy.so/emails/configure',
  output: 'assets/features/events/using_attributes_in_email_charts.mp4',
  async prepare(page) {
    await createTemplate(page, page.url().replace(/\/emails\/configure.*/, ''), 'Recap emails', NAME)
    // New blocks go at the end of the email: start there
    await page.getByText('to add a block').first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(600)
  },
}

export default async function flow(run) {
  const { page } = run
  // "/" opens the block menu
  await run.key('/', { after: 600 })
  const menu = page.locator('[role=dialog]').last()
  await run.type(menu.locator('input:visible').first(), 'Progress')
  await run.click(menu.getByText('Progress Chart', { exact: true }).first(), { after: 1200 })
  const lists = page.locator('main button[aria-haspopup=listbox]:visible')
  await run.select(lists.nth(0), 'Workouts')
  await run.select(lists.nth(1), 'Equipment')
  const value = page.locator('main input[placeholder="Enter a value"]:visible').first()
  await run.type(value, 'bike')
  await run.blur(value, { after: 500 })
  // Click off the block (the blank strip beside "Press / to add a block") to see the chart it renders
  const hint = page.getByText('to add a block').last()
  const b = await hint.boundingBox()
  await page.mouse.click(b.x + b.width + 260, b.y + b.height / 2)
  await run.wait(1200)
  const chart = page.locator('text=this week').last().locator('xpath=ancestor::div[.//*[contains(text(), "2 weeks ago")]][1]')
  await run.show(chart, { hold: 2000 })
}

export async function cleanup(page, base) {
  await removeTemplate(page, base, NAME)
}
