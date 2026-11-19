/**
 * Shared by the legacy push notification flows: create a temporary push
 * template (named "Stride …") before recording, and remove it again. The
 * "Trophy default" templates can't be edited, so the editor flows work on
 * their own copy. Not a flow itself.
 *
 * "Add template" creates a template straight away (named after the type, e.g.
 * "Streak notification", with the default content) and opens its editor.
 */
export const CONFIGURE = '/push/configure'

/** Several agents share the signed-in profile; never write to another environment */
export async function assertProduction(page) {
  const env = page.locator('button:visible', { hasText: 'Production' })
  if (!(await env.count())) throw new Error('Dashboard is not on the Production environment: not touching push templates')
}

/** The card for a template on /push/configure, by its exact name */
export const cardOf = (page, name) =>
  page.getByText(name, { exact: true }).filter({ visible: true }).first().locator('xpath=ancestor::div[.//button][1]')

/** The card's ⋮ menu button */
export const menuOf = (page, name) => cardOf(page, name).locator('button').first()

/** The "?" icon (with a tooltip) next to a section heading, e.g. "Recap notifications" */
export const helpOf = (page, section) => page.locator('h2:visible', { hasText: section }).first().locator('svg').first()

/** Scroll the configure page smoothly so a section heading sits near the top */
export async function scrollToSection(page, section, { after = 900 } = {}) {
  await page.locator('h2:visible', { hasText: section }).first().evaluate((h) => {
    h.style.scrollMarginTop = '24px'
    h.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
  await page.waitForTimeout(after)
}

/**
 * Create a template in a section ("Streak reminder notifications", …) and
 * rename it. Leaves the page on the new template's editor; returns its URL.
 */
export async function createTemplate(page, base, section, name) {
  await page.goto(base + CONFIGURE, { waitUntil: 'networkidle' })
  await assertProduction(page)
  const heading = page.locator('h2:visible', { hasText: section }).first()
  const row = heading.locator('xpath=ancestor::*[.//button[contains(., "Add template")]][1]')
  await row.getByRole('button', { name: 'Add template' }).first().click()
  await page.waitForURL(/\/push\/templates\//, { timeout: 20000 })
  await page.waitForLoadState('networkidle')
  // The editor fills in after a spinner; wait for the notification preview
  await page.locator('.ProseMirror, text=/now/').first().waitFor({ timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1500)
  // The pencil next to the template's name (inside the h1, after the back link)
  const pencil = page.locator('h1:visible button')
  const input = page.locator('[role=dialog] input:visible').first()
  for (let i = 0; i < 3 && !(await input.isVisible()); i++) {
    await pencil.first().click()
    await input.waitFor({ timeout: 4000 }).catch(() => {})
  }
  if (!(await input.isVisible())) await page.screenshot({ path: 'out/push-rename-failed.png' })
  await input.fill(name)
  await page.getByRole('button', { name: 'Confirm' }).click()
  await page.getByText(name, { exact: true }).first().waitFor()
  return page.url()
}

/** Open a page again for recording, re-applying capture's style tag (a goto drops it) */
export async function openForRecording(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: '*{caret-color:transparent!important} nextjs-portal{display:none!important}' })
  await page.waitForTimeout(800)
}

/** Deactivate (if active) and delete every template with this exact name */
export async function removeTemplate(page, base, name) {
  await page.goto(base + CONFIGURE, { waitUntil: 'networkidle' })
  // The cards render after the page settles; don't decide "nothing to remove" too early
  await page.getByText('Trophy default', { exact: true }).first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(1000)
  for (let i = 0; i < 5; i++) {
    if (!(await page.getByText(name, { exact: true }).filter({ visible: true }).count())) return
    await assertProduction(page)
    await menuOf(page, name).click()
    await page.waitForTimeout(500)
    const deactivate = page.locator('[role=menuitem]:visible', { hasText: 'Deactivate' })
    if (await deactivate.count()) {
      await deactivate.first().click()
      await page.waitForTimeout(1500)
      await menuOf(page, name).click()
      await page.waitForTimeout(500)
    }
    await page.locator('[role=menuitem]:visible', { hasText: 'Delete' }).first().click()
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
    await page.waitForTimeout(2000)
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByText('Trophy default', { exact: true }).first().waitFor({ timeout: 20000 })
    await page.waitForTimeout(1000)
  }
  throw new Error(`Could not remove the "${name}" push template`)
}

/**
 * A stand-in for a submenu item that run.click can glide to and "click". The
 * "Activate for" submenu closes as soon as the real mouse leaves its trigger,
 * so a real click on an item never lands; this logs the item's box for the
 * drawn cursor and clicks it in the page instead.
 */
export const domClickTarget = (locator) => ({
  scrollIntoViewIfNeeded: () => locator.scrollIntoViewIfNeeded(),
  boundingBox: () => locator.boundingBox(),
  click: () => locator.evaluate((el) => el.click()),
  toString: () => String(locator),
})
