/**
 * Shared by the legacy email editor flows (designing emails, variables,
 * variations, rich text, event attributes): create a temporary email template
 * named "Stride …" before recording, tidy the page, and remove the template
 * again. The "Trophy default" templates can't be edited and other templates
 * belong to the test org, so the editor flows work on their own copy and never
 * press Save. Not a flow itself.
 *
 * "Add template" creates a template straight away (named after the type, e.g.
 * "Recap email 3", with the default content) and opens its editor.
 */
export const CONFIGURE = '/emails/configure'

/** Several agents share the signed-in profile; never write to another environment */
export async function assertProduction(page) {
  const env = page.locator('button:visible', { hasText: 'Production' })
  if (!(await env.count())) throw new Error('Dashboard is not on the Production environment: not touching email templates')
}

/** The ⋮ menu button on a template card on /emails/configure, by the template's exact name */
const menuOf = (page, name) =>
  page
    .locator('h4:visible', { hasText: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) })
    .first()
    .locator('xpath=ancestor::div[.//button[@aria-haspopup="menu"]][1]')
    .locator('button[aria-haspopup=menu]')
    .first()

/** The "Add template" button of a section ("Recap emails", …) */
export const addTemplateIn = (page, section) =>
  page
    .locator('h2:visible, h3:visible', { hasText: section })
    .first()
    .locator('xpath=ancestor::*[.//button[contains(., "Add template")]][1]')
    .getByRole('button', { name: 'Add template' })
    .first()

/**
 * Make the page read like the Stride app: the test org is called "test",
 * which shows up in the default copy ("keep moving forward on test!"), and
 * its metric list is full of API test metrics. Replaces the org name in the
 * rendered email and hides test metrics from metric pickers. Re-applies as
 * the page re-renders. Display only: nothing is saved.
 */
export async function tidyEditor(page) {
  await page.addStyleTag({ content: '*{caret-color:transparent!important} nextjs-portal{display:none!important}' })
  await page.evaluate(() => {
    if (window.__strideTidy) return
    window.__strideTidy = true
    const KEEP = /^(Workouts|Lessons|Words|Pages|Highest .*|Lowest .*)$/
    const rename = (root) => {
      if (!root) return
      const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const v = n.nodeValue
        if (v.trim() === 'test') n.nodeValue = v.replace('test', 'Stride')
        else if (/\b(on|at) test\b/.test(v)) n.nodeValue = v.replace(/\b(on|at) test\b/g, '$1 Stride')
      }
    }
    const fix = () => {
      rename(document.querySelector('main') ?? document.body)
      // Template previews on the configure page are srcdoc iframes
      for (const f of document.querySelectorAll('iframe')) {
        try {
          rename(f.contentDocument?.body)
          if (!f.__strideTidy) {
            f.__strideTidy = true
            f.addEventListener('load', () => rename(f.contentDocument?.body))
          }
        } catch {}
      }
      // Metric pickers: only the Stride metrics, once each
      for (const list of document.querySelectorAll('[role=listbox]')) {
        const options = [...list.querySelectorAll('[role=option]')]
        if (!options.some((o) => o.innerText.trim() === 'Workouts')) continue
        const seen = new Set()
        for (const o of options) {
          const t = o.innerText.trim()
          const hide = !KEEP.test(t) || seen.has(t)
          seen.add(t)
          if (hide && o.style.display !== 'none') o.style.display = 'none'
        }
      }
    }
    fix()
    new MutationObserver(fix).observe(document.body, { childList: true, subtree: true, characterData: true })
  })
}

/**
 * Create a template in a section and rename it. Leaves the page on the new
 * template's editor, tidied; returns its URL.
 */
export async function createTemplate(page, base, section, name) {
  await page.goto(base + CONFIGURE, { waitUntil: 'networkidle' })
  await assertProduction(page)
  await addTemplateIn(page, section).click()
  await page.waitForURL(/\/emails\/templates\//, { timeout: 20000 })
  await page.waitForLoadState('networkidle')
  await page.getByText('to add a block').first().waitFor({ timeout: 20000 })
  await page.waitForTimeout(1000)
  await renameTemplate(page, name)
  await tidyEditor(page)
  await page.waitForTimeout(800)
  return page.url()
}

/** Rename the template open in the editor (the pencil next to its name) */
export async function renameTemplate(page, name) {
  const input = page.locator('[role=dialog] input:visible').first()
  for (let i = 0; i < 3 && !(await input.isVisible()); i++) {
    await page.locator('h1:visible button').last().click()
    await input.waitFor({ timeout: 4000 }).catch(() => {})
  }
  await input.fill(name)
  await page.getByRole('button', { name: 'Confirm' }).click()
  await page.locator('h1:visible', { hasText: name }).first().waitFor()
  // Let the "Template Renamed" toast go before recording starts
  await page.getByText('Template Renamed').first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
}

/** Delete every template with this exact name (only ever our own "Stride …" ones) */
export async function removeTemplate(page, base, name) {
  await page.goto(base + CONFIGURE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  for (let i = 0; i < 5; i++) {
    if (!(await menuOf(page, name).count())) return
    await assertProduction(page)
    await menuOf(page, name).click()
    await page.waitForTimeout(500)
    await page.locator('[role=menuitem]:visible', { hasText: 'Delete' }).first().click()
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
    await page.waitForTimeout(2000)
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForTimeout(800)
  }
  throw new Error(`Could not remove the "${name}" email template`)
}

/** The block editor that's open (only the selected block is editable) */
export const activeEditor = (page) => page.locator('[contenteditable=true]:visible').first()

/** Scroll the editor back to the top of the email, nothing selected */
export async function openEditorTop(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.overflow-y-auto')) el.scrollTop = 0
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(500)
}
