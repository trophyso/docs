/**
 * Set the experimentation control ratio: drag the slider → Save changes.
 * Used on platform/experimentation (Control ratio).
 * The org's ratio is 0%; cleanup sets it back to 0% and saves.
 */
const RATIO = 20 // % shown at the end of the drag

const slider = (page) => page.locator('input[name=controlRatio]')
// The Experimentation section's Save (the first one saves Configuration)
const saveButton = (page) => page.getByRole('button', { name: 'Save changes' }).last()

async function assertProduction(page) {
  const env = page.locator('button[id^="headlessui-menu-button"]:visible', { hasText: 'Production' })
  if (!(await env.count())) throw new Error('Dashboard is not on the Production environment: not touching settings')
}

/**
 * Invisible markers over the slider's thumb (at 0%) and at RATIO%, so
 * run.drag can move the cursor between two points on one <input type=range>
 */
async function addMarkers(page) {
  await slider(page).evaluate((el, ratio) => {
    const r = el.getBoundingClientRect()
    const thumb = 18 // px, the thumb's diameter
    const x = (v) => r.left + thumb / 2 + ((r.width - thumb) * v) / 100
    for (const [id, v] of [['ratio-from', Number(el.value)], ['ratio-to', ratio]]) {
      const m = document.createElement('div')
      m.id = id
      m.style.cssText = `position:fixed;left:${x(v) - 9}px;top:${r.top + r.height / 2 - 9}px;width:18px;height:18px;pointer-events:none`
      document.body.appendChild(m)
    }
  }, RATIO)
}

export const meta = {
  start: '/settings',
  url: 'app.trophy.so/settings',
  output: 'assets/platform/experimentation/control_ratio.mp4',
  async prepare(page) {
    await assertProduction(page)
    await addMarkers(page)
  },
}

export default async function flow(run) {
  const { page } = run
  await run.drag(page.locator('#ratio-from'), page.locator('#ratio-to'), { steps: 30, after: 700 })
  await run.click(saveButton(page), { after: 2500 })
}

/** Put the control ratio back to 0% and save */
export async function cleanup(page, base) {
  await page.goto(base + '/settings', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await assertProduction(page)
  if ((await slider(page).inputValue()) === '0') return
  await slider(page).focus()
  await page.keyboard.press('Home')
  await page.waitForTimeout(300)
  await saveButton(page).click()
  await page.waitForTimeout(2500)
}
