/**
 * Shared by the streak settings flows (freeze grants, freeze accumulation,
 * streak personalization): the staging org's original streak settings, and a
 * cleanup that puts them back and saves. Not a flow itself.
 *
 * The switches on /streaks/configure are, in order: Allow streak
 * personalization, Streak freezes, Auto-earn freezes (only shown while
 * freezes are on).
 */
export const ROUTE = '/streaks/configure'

/** The test org's settings before any recording (Production environment) */
export const ORIGINAL = {
  personalization: true,
  freezes: true,
  autoEarn: true,
  streakFreezeStartCount: '1',
  streakFreezeMaxCount: '2',
  streakFreezeAutoEarnInterval: '7',
  streakFreezeAutoEarnAmount: '1',
}

export const switches = (page) => page.getByRole('switch')
export const field = (page, name) => page.locator(`input[name=${name}]`)
export const saveButton = (page) => page.getByRole('button', { name: 'Save', exact: true })

/** Several agents share the signed-in profile; never write to another environment */
export async function assertProduction(page) {
  const env = page.locator('button[id^="headlessui-menu-button"]:visible', { hasText: 'Production' })
  if (!(await env.count())) throw new Error('Dashboard is not on the Production environment: not touching streak settings')
}

/** Flip a switch (client side only) so the video opens with it off */
export async function setSwitch(page, index, on) {
  const sw = switches(page).nth(index)
  if ((await sw.getAttribute('aria-checked')) !== String(on)) {
    await sw.click()
    await page.waitForTimeout(300)
    return true
  }
  return false
}

/**
 * Scroll the dashboard's content pane so `locator` sits `offset` px from the
 * top, adding blank space below the form when the page is too short to scroll
 * that far (fields appear below once a section is switched on)
 */
export async function scrollTo(locator, offset = 120) {
  await locator.evaluate((el, offset) => {
    let pane = el.parentElement
    while (pane && !/auto|scroll/.test(getComputedStyle(pane).overflowY)) pane = pane.parentElement
    if (!pane) return
    const spacer = document.createElement('div')
    spacer.style.cssText = 'height:600px;flex-shrink:0'
    pane.appendChild(spacer)
    pane.scrollTop += el.getBoundingClientRect().top - pane.getBoundingClientRect().top - offset
  }, offset)
}

/** Put every streak setting the flows touch back to ORIGINAL, saving if anything changed */
export async function restoreStreakSettings(page, base) {
  await page.goto(base + ROUTE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await assertProduction(page)
  let changed = false
  changed = (await setSwitch(page, 0, ORIGINAL.personalization)) || changed
  changed = (await setSwitch(page, 1, ORIGINAL.freezes)) || changed
  changed = (await setSwitch(page, 2, ORIGINAL.autoEarn)) || changed
  for (const name of ['streakFreezeStartCount', 'streakFreezeMaxCount', 'streakFreezeAutoEarnInterval', 'streakFreezeAutoEarnAmount']) {
    const input = field(page, name)
    if ((await input.inputValue()) !== ORIGINAL[name]) {
      await input.fill(ORIGINAL[name])
      changed = true
    }
  }
  if (!changed) return
  await saveButton(page).click()
  await page.waitForTimeout(2500)
}
