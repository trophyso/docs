/**
 * Copy a metric's API key from its configure tab (the Workouts metric).
 * Used on getting-started/quickstart (Integrate the metric into your backend).
 * The key field is disabled once a metric is active, so prepare makes it
 * read-only instead (same look) to show the key being selected and copied.
 * Nothing is saved, so no cleanup.
 */
export const meta = {
  start: '/metrics/a62e1133-8396-4a23-bef6-858925bf4672/configure', // Workouts
  url: 'app.trophy.so/metrics',
  output: 'assets/quick-start/copy_metric_key.mp4',
  async prepare(page) {
    await page.locator('input[name=key]').evaluate((el) => {
      const cs = getComputedStyle(el)
      for (const p of ['backgroundColor', 'color', 'borderColor', 'opacity']) el.style[p] = cs[p]
      el.disabled = false
      el.readOnly = true
    })
  },
}

export default async function flow(run) {
  const { page } = run
  const key = page.locator('input[name=key]')
  await run.click(key, { after: 300 })
  await key.selectText()
  await run.key('Meta+c', { after: 300 })
  await run.show(key, { hold: 1500 })
}
