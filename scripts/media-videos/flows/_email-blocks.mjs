/**
 * Shared by the legacy email editor block flows (smart blocks, adding and
 * arranging blocks). Each flow records in its own temporary milestone
 * template named "Stride …", created before recording and deleted in
 * cleanup; nothing is ever saved. Template creation, renaming, tidying and
 * removal come from _emails-templates.mjs. Not a flow itself.
 *
 * Editor layout: each top-level block is a row with a + button (shown on
 * hover; opens the block menu to insert after it) and a drag handle (click
 * for the block menu: Insert Block After, Copy, Duplicate, …; drag to move).
 * The block menu is a Headless UI panel with a "Search for a block..." field.
 */
import { createTemplate, removeTemplate } from './_emails-templates.mjs'

export const SECTION = 'Milestone completed emails'
export const HEADING = "That's impressive."

/** The editor row of the top-level block containing this exact text */
export const blockRow = (page, text) =>
  page.locator('div.max-w-full.flex-col > div > div.flex.gap-4.items-start', { has: page.getByText(text, { exact: true }) }).first()
/** The + button beside a block (visible on hover) */
export const plusOf = (page, text) => blockRow(page, text).locator(':scope > div.flex.items-center > button').first()
/** The drag handle beside a block (click: block menu; drag: move it) */
export const handleOf = (page, text) => blockRow(page, text).locator(':scope > div.flex.items-center > div > button').first()
/** An entry in the open block menu */
export const blockOption = (page, name) => page.locator('#headlessui-portal-root').getByText(name, { exact: true }).first()

/**
 * Before recording: create and rename the template, leaving the page on its
 * editor. Also hides the test org's throwaway milestones ("bf", "test") from
 * the preview Milestone picker. Display only.
 */
export async function openTemplate(page, name) {
  const base = new URL(page.url()).origin
  await createTemplate(page, base, SECTION, name)
  await page.evaluate(() => {
    if (window.__strideMilestones) return
    window.__strideMilestones = true
    const JUNK = /^(bf|test|Manual)$/
    const fix = () => {
      for (const o of document.querySelectorAll('[role=option]')) {
        if (JUNK.test(o.innerText.trim()) && o.style.display !== 'none') o.style.display = 'none'
      }
    }
    new MutationObserver(fix).observe(document.body, { childList: true, subtree: true })
  })
  // Let the "Template Renamed" toast go, so it isn't in the opening frame
  const toast = page.getByText('Template Renamed', { exact: true }).first()
  await toast.waitFor({ state: 'hidden', timeout: 12000 }).catch(async () => {
    await page.locator('div:has(> * :text-is("Template Renamed")) button, [role=status] button').last().click().catch(() => {})
    await toast.waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {})
  })
  await page.mouse.move(2, 898)
  await page.waitForTimeout(600)
}

/** Delete a block before recording, from its handle's menu (unsaved, like every change here) */
export async function deleteBlock(page, text) {
  await handleOf(page, text).click()
  await page.locator('[role=menuitem]:visible', { hasText: 'Delete' }).first().click()
  await page.getByText(text, { exact: true }).first().waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
  await page.mouse.move(2, 898)
  await page.waitForTimeout(500)
}

export async function removeBlocksTemplate(page, base, name) {
  await removeTemplate(page, base, name)
}
