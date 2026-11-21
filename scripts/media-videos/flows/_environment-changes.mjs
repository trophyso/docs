/**
 * Shared setup for the environment change-tracking videos (viewing and
 * reverting changes).
 *
 * The usual test org (Runnr) is multi-tenant, and the dashboard skips change
 * tracking for multi-tenant orgs, so these record in the single-tenant
 * "Staging [Old]" org instead. Never touches its real environments' data:
 *
 * - `seed` creates an empty "Feature dev" (Development) environment and adds
 *   two metrics and an attribute to it. Its nearest higher environment is QA,
 *   so View changes lists them as 3 Added against QA. QA isn't written to.
 * - Reverting in a Development environment doesn't propagate anywhere
 *   (Development environments all share the lowest priority).
 * - Copying would: a copy into a Staging environment propagates to every
 *   Development environment, including the org's real Charlie-Dev and
 *   Jason-Dev. So there's no copying flow here.
 * - `teardown` deletes Feature dev, then puts the dashboard back on
 *   Production in the Runnr org, where every other flow records.
 */
export const ORG = 'Staging [Old]'
export const HOME_ORG = 'Runnr'
export const DEV = { name: 'Feature dev', key: 'feature-dev' }
export const TARGET = 'qa'
export const CHANGES = `/environments/${DEV.key}/changes/${TARGET}`

/** The things Feature dev adds, so they show up as changes */
const METRICS = ['Steps', 'Yoga sessions']
const ATTRIBUTE = 'Fitness goal'

/** Switch the active organization with the org switcher at the top of the sidebar */
export async function switchOrg(page, base, name) {
  await page.goto(base + '/environments', { waitUntil: 'networkidle' })
  await page.locator('[aria-label="Open organization switcher"]').first().click()
  await page.waitForTimeout(1000)
  // The current org is the popover's header (it has a Manage button); others are listed below it
  const current = page.locator('button:visible', { hasText: 'Manage' }).first().locator('xpath=..')
  if ((await current.innerText().catch(() => '')).includes(name)) {
    await page.keyboard.press('Escape')
    return
  }
  await page.locator(`text="${name}" >> visible=true`).first().click()
  await page.waitForTimeout(4000)
}

/** Select an environment the way the selector does: by cookie */
export async function useEnvironment(page, base, key) {
  const host = new URL(base).hostname
  await page.context().addCookies([
    { name: 'trophy_env', value: key, domain: host, path: '/', sameSite: 'Lax', expires: Math.floor(Date.now() / 1000) + 31536000 },
  ])
}

const envRow = (page, key) => page.locator('table tbody tr', { has: page.getByText(key, { exact: true }) }).first()

async function createDevEnvironment(page, base) {
  await useEnvironment(page, base, 'production')
  await page.goto(base + '/environments', { waitUntil: 'networkidle' })
  if (await envRow(page, DEV.key).count()) return
  await page.getByRole('button', { name: 'New environment' }).click()
  const dialog = page.locator('[role=dialog]:visible').first()
  const name = dialog.locator('input:visible').nth(0)
  await name.fill(DEV.name)
  await name.evaluate((el) => el.blur())
  await page.waitForTimeout(500)
  await dialog.getByRole('button', { name: /^Development/ }).click()
  await dialog.getByRole('button', { name: 'Create environment' }).click()
  await page.waitForTimeout(3000)
}

async function createMetric(page, base, name) {
  await page.goto(base + '/metrics', { waitUntil: 'networkidle' })
  if (await page.locator('table tbody tr', { hasText: name }).count()) return
  await page.locator('button:visible, a:visible', { hasText: 'New metric' }).first().click()
  const dialog = page.locator('[role=dialog]:visible').first()
  const input = dialog.locator('input:visible').nth(0)
  await input.fill(name)
  await input.evaluate((el) => el.blur())
  await page.waitForTimeout(600)
  await dialog.locator('button', { hasText: 'Create metric' }).first().click()
  await page.waitForTimeout(2500)
}

async function createAttribute(page, base, name) {
  await page.goto(base + '/attributes', { waitUntil: 'networkidle' })
  if (await page.locator('table tbody tr', { hasText: name }).count()) return
  await page.getByRole('button', { name: 'Add user attribute' }).click()
  const dialog = page.locator('[role=dialog]:visible').first()
  const input = dialog.locator('input:visible').nth(0)
  await input.fill(name)
  await input.evaluate((el) => el.blur())
  await page.waitForTimeout(600)
  await dialog.getByRole('button', { name: 'Create user attribute' }).click()
  await page.waitForTimeout(2500)
}

/** A row of the changes table, by its "Change" text */
export const changeRow = (page, text) => page.locator('table tbody tr', { hasText: text }).first()

/** Revert one change (its ↺ button, then Revert in the confirmation) */
async function revert(page, row) {
  await row.locator('button').last().click()
  await page.getByRole('button', { name: 'Revert', exact: true }).last().click()
  await page.waitForTimeout(2500)
}

/**
 * Switch to the single-tenant org and give Feature dev its changes.
 * A new environment starts as a copy of Production, with a few badge-only
 * differences from QA; keep one (a points level) as the "Updated" example
 * and revert the rest, so the list reads 3 Added, 1 Updated.
 */
export async function seed(page, base) {
  await switchOrg(page, base, ORG)
  await createDevEnvironment(page, base)
  await useEnvironment(page, base, DEV.key)
  for (const m of METRICS) await createMetric(page, base, m)
  await createAttribute(page, base, ATTRIBUTE)
  await page.goto(base + CHANGES, { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)
  const updated = page.locator('table tbody tr', { has: page.getByText('Updated', { exact: true }) })
  const texts = await updated.allInnerTexts()
  const keep = texts.find((t) => t.includes('points level')) ?? texts[0]
  for (const t of texts) {
    if (t === keep) continue
    const name = t.match(/"[^"]+"/)?.[0]
    if (name) await revert(page, changeRow(page, name))
  }
}

/** Delete Feature dev and go back to Production in the Runnr org */
export async function teardown(page, base) {
  await switchOrg(page, base, ORG)
  await useEnvironment(page, base, 'production')
  await page.goto(base + '/environments', { waitUntil: 'networkidle' })
  const r = envRow(page, DEV.key)
  if (await r.count()) {
    await r.locator('button').last().click()
    await page.locator('[role=menuitem]:visible', { hasText: 'Delete' }).first().click()
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
    await page.waitForTimeout(2500)
  }
  await switchOrg(page, base, HOME_ORG)
  await useEnvironment(page, base, 'production')
}
