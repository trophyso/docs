/**
 * Create an environment: New environment → name (the key fills in) → Staging → Create.
 * The dashboard switches to the new environment and shows the non-production banner.
 * Used on platform/environments (Creating environments).
 *
 * The staging test org is multi-tenant, so the "Clone from" field the docs
 * mention isn't offered there.
 */
export const meta = {
  start: '/environments',
  url: 'app.trophy.so/environments',
  output: 'assets/platform/environments/create_environment.mp4',
}

export default async function flow(run) {
  const { page } = run
  await run.click(page.getByRole('button', { name: 'New environment' }))
  const dialog = page.locator('[role=dialog]:visible').first()
  const name = dialog.locator('input:visible').nth(0)
  await run.type(name, 'Pre-production')
  // The key fills in from the name when the name field loses focus
  await run.blur(name)
  await run.click(dialog.getByRole('button', { name: /^Staging/ }), { after: 700 })
  await run.click(dialog.getByRole('button', { name: 'Create environment' }), { after: 2500 })
}

let tenant = null
/** Put the selection back on Production (and the starting tenant), then delete the environment */
export async function cleanup(page, base) {
  const ctx = page.context()
  tenant ??= (await ctx.cookies(base)).find((c) => c.name === 'trophy_tenant')
  const host = new URL(base).hostname
  const cookie = (name, value) => ({ name, value, domain: host, path: '/', sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 31536000 })
  const restore = () => ctx.addCookies([cookie('trophy_env', 'production'), ...(tenant ? [cookie('trophy_tenant', tenant.value)] : [])])
  await restore()
  await page.goto(base + '/environments', { waitUntil: 'networkidle' })
  const row = page.locator('table tbody tr', { hasText: 'pre-production' }).first()
  if (await row.count()) {
    await row.locator('button').last().click()
    await page.locator('[role=menuitem]:visible', { hasText: 'Delete' }).first().click()
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
    await page.waitForTimeout(2000)
  }
  await restore()
  await page.goto(base + '/environments', { waitUntil: 'networkidle' })
}
