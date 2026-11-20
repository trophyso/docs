/**
 * Switch environments from the selector at the top of the sidebar:
 * Production → Staging (the non-production banner appears) → back to Production.
 * Used on platform/environments (Switching between environments).
 *
 * The selected environment and tenant live in cookies in the shared browser
 * profile, so cleanup always puts them back to Production and the starting tenant.
 */
export const meta = {
  start: '/environments',
  url: 'app.trophy.so/environments',
  output: 'assets/platform/environments/switching_environments.mp4',
}

const selector = (page, name) => page.getByRole('button', { name, exact: true }).first()
const option = (page, name) => page.locator('[role=menuitem]:visible', { hasText: new RegExp(`^${name}$`) }).first()

export default async function flow(run) {
  const { page } = run
  await run.click(selector(page, 'Production'), { after: 700 })
  await run.click(option(page, 'Staging'), { after: 2500 })
  await run.click(selector(page, 'Staging'), { after: 700 })
  await run.click(option(page, 'Production'), { after: 2500 })
}

let tenant = null
/** Leave the dashboard on Production and the tenant it started on */
export async function cleanup(page, base) {
  const ctx = page.context()
  const jar = await ctx.cookies(base)
  tenant ??= jar.find((c) => c.name === 'trophy_tenant')
  const host = new URL(base).hostname
  const cookie = (name, value) => ({ name, value, domain: host, path: '/', sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 31536000 })
  await ctx.addCookies([cookie('trophy_env', 'production'), ...(tenant ? [cookie('trophy_tenant', tenant.value)] : [])])
  await page.goto(base + '/environments', { waitUntil: 'networkidle' })
}
