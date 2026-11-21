/**
 * Segment the Home analytics by user attributes: filter City → Leeds, then
 * Subscription Plan → Pro, and the charts redraw for each segment.
 * Used on data-sources/users (Segmented analytics).
 * Read-only, so no cleanup. Numbers come from src/fake-analytics.mjs.
 */
export const meta = {
  start: '/',
  url: 'app.trophy.so',
  output: 'assets/features/users/segmenting_analytics.mp4',
  fakeAnalytics: true,
  async prepare(page) {
    // Retention needs a range longer than the 14-day activation window
    await page.locator('button[aria-haspopup=listbox]:visible', { hasText: 'Last 14 days' }).first().click()
    await page.locator('[role=option]:visible', { hasText: 'Last 30 days' }).first().click()
    await page.waitForLoadState('networkidle')
    await page.mouse.move(2, 898) // no chart tooltip on the opening frame
    // The test org's attribute values are lowercase; show them as an app would
    await page.evaluate(() => {
      const names = { leeds: 'Leeds', london: 'London', pro: 'Pro' }
      const run = () => {
        for (const el of document.querySelectorAll('[role=option] *, [role=option], button[aria-haspopup=listbox] *')) {
          for (const n of el.childNodes) {
            if (n.nodeType === 3 && names[n.textContent.trim()]) n.textContent = names[n.textContent.trim()]
          }
        }
      }
      run()
      new MutationObserver(run).observe(document.body, { childList: true, subtree: true, characterData: true })
    })
  },
}

const filter = (page, label) => page.locator('button[aria-haspopup=listbox]:visible', { hasText: label }).first()

export default async function flow(run) {
  const { page } = run
  await run.select(filter(page, 'City'), 'Leeds', { after: 2200 })
  await run.select(filter(page, 'Subscription Plan'), 'Pro', { after: 2500 })
}
