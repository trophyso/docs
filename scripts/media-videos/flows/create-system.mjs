/**
 * Create a points system: New points system → name it → Create, then add a
 * description on the configure page it opens and save.
 * Used on features/points (Creating points systems).
 *
 * Also exports the helpers the other points flows use to set up (and remove)
 * their own "Stride XP" system, so they never touch the test org's XP, Coins
 * or Energy systems.
 */
export const meta = {
  start: '/points',
  url: 'app.trophy.so/points',
  output: 'assets/features/points/create_system.mp4',
}

export default async function flow(run) {
  const { page } = run
  await run.click(page.getByRole('button', { name: 'New points system' }))
  const dialog = page.locator('[role=dialog]:visible').first()
  const name = dialog.locator('input:visible').nth(0)
  await run.type(name, 'Stride XP')
  // The key fills in from the name when the name field loses focus
  await run.blur(name)
  // Creating the system opens its configure page
  await run.click(dialog.getByRole('button', { name: 'Create points system' }), { after: 2500 })
  await page.waitForURL(/\/configure/)
  await page.waitForLoadState('networkidle')
  const save = page.locator('button[type=submit]:visible', { hasText: 'Save' }).first()
  await run.type(page.locator('input[name=description]:visible'), 'Earned by completing workouts in Stride')
  await run.click(save, { after: 2000 })
}

/** Delete the points system again, so the flow can be recorded again */
export async function cleanup(page, base) {
  await deleteStrideXp(page, base)
}

/* ---------- Shared by the other points flows ---------- */

export const STRIDE_KEY = 'stride-xp'

/** Delete the "Stride XP" points system (and its triggers, levels, boosts) if it exists */
export async function deleteStrideXp(page, base) {
  await page.goto(base + '/points', { waitUntil: 'networkidle' })
  const row = page.locator('tr', { hasText: STRIDE_KEY }).first()
  if (!(await row.count())) return
  await row.locator('button').last().click()
  await page.locator('[role=menuitem]:visible', { hasText: 'Delete' }).first().click()
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
  await page.waitForTimeout(1500)
}

/**
 * Create a fresh "Stride XP" system with optional triggers and levels, before
 * recording. Returns the system's dashboard path, e.g. /points/<id>.
 *   triggers: [{ type: 'Metric', metric: 'Workouts', threshold: 1, points: 10 }
 *              | { type: 'Streak', days: 7, points: 50 }]
 *   levels:   [{ name: 'Bronze', key: 'bronze', points: 100 }]
 */
export async function setupStrideXp(page, base, { triggers = [], levels = [] } = {}) {
  await deleteStrideXp(page, base)
  await page.getByRole('button', { name: 'New points system' }).click()
  const dialog = page.locator('[role=dialog]:visible').first()
  await dialog.locator('input').nth(0).fill('Stride XP')
  await dialog.locator('input').nth(0).blur()
  await page.waitForTimeout(500)
  await dialog.getByRole('button', { name: 'Create points system' }).click()
  await page.waitForURL(/\/configure/)
  await page.waitForLoadState('networkidle')
  const id = page.url().match(/points\/([0-9a-f-]{36})/)[1]
  const root = `/points/${id}`

  for (const t of triggers) {
    await page.goto(base + root + '/configure/new', { waitUntil: 'networkidle' })
    const form = page.locator('form:has(input[name=points])')
    await form.locator('input[name=points]').waitFor()
    await page.waitForTimeout(800)
    const boxes = form.locator('[aria-haspopup=listbox]:visible')
    if (t.type !== 'Metric') {
      await boxes.nth(0).click()
      await page.locator('[role=option]:visible', { hasText: t.type }).first().click()
      await page.waitForTimeout(500)
    }
    if (t.type === 'Metric') {
      await boxes.nth(1).click()
      await page.locator('[role=option]:visible', { hasText: t.metric }).first().click()
      if (t.threshold) await form.locator('input[name=threshold]').fill(String(t.threshold))
    }
    // A streak trigger's first number field is its length in days
    if (t.type === 'Streak') await form.locator('input[type=number]:visible').first().fill(String(t.days))
    await form.locator('input[name=points]').fill(String(t.points))
    await page.waitForTimeout(300)
    await form.locator('button[type=submit]', { hasText: 'Save' }).click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
  }

  for (const l of levels) {
    await page.goto(base + root + '/levels/new', { waitUntil: 'networkidle' })
    await page.locator('input[name=name]:visible').fill(l.name)
    await page.locator('input[name=name]:visible').blur()
    await page.waitForTimeout(300)
    await page.locator('input[name=key]:visible').fill(l.key)
    await page.locator('input[name=points]:visible').fill(String(l.points))
    await page.waitForTimeout(300)
    await page.locator('button[type=submit]:visible', { hasText: 'Save' }).last().click()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)
  }
  return root
}

/**
 * Go to a page after setup, without toasts from the setup, and re-apply the
 * recording styles capture.mjs adds to the start page (no caret, no Next.js
 * dev overlay), since navigating drops them. Clicking into a number field
 * selects its value, so typing replaces a prefilled 0 instead of giving "012".
 */
export async function openForRecording(page, base, route) {
  await page.goto(base + route, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: '*{caret-color:transparent!important} nextjs-portal{display:none!important}' })
  await page.evaluate(() =>
    document.addEventListener('click', (e) => {
      if (e.target instanceof HTMLInputElement && e.target.type === 'number') e.target.select()
    }),
  )
  await page.waitForTimeout(800)
}
