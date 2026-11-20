/**
 * Restore a user's lost streak: the streak card's ⋮ menu → Restore streak →
 * Restore. Used on features/streaks (Managing streaks → Restoring a user's
 * streak).
 *
 * Changes real (staging) user data: the test user rw1028t-t2, whose 1-day
 * streak was lost. Cleanup resets it to 0 again with the card's Reset streak
 * action, which puts the user back to a lost, restorable streak.
 */
import { assertProduction, scrollTo } from './_streak-settings.mjs'

const USER = '/users/db41e3d9-2916-4080-bbf2-813d927be076/streak' // rw1028t-t2

const streakCard = (page) => page.getByText(/^\d+ days?$/).first()
const menuButton = (page) => page.locator('button[id^="headlessui-menu-button"]:visible').last()

export const meta = {
  start: USER,
  url: 'app.trophy.so/users',
  output: 'assets/features/streaks/restoring_streaks.mp4',
  async prepare(page) {
    await assertProduction(page)
    await scrollTo(streakCard(page), 60)
  },
}

export default async function flow(run) {
  const { page } = run
  await run.click(menuButton(page), { after: 600 })
  await run.click(page.locator('[role=menuitem]:visible', { hasText: 'Restore streak' }).first())
  await run.click(page.getByRole('button', { name: 'Restore', exact: true }).last(), { after: 1500 })
  // The streak length goes from 0 back to the length the user lost
  await run.show(streakCard(page), { hold: 1500 })
}

/** Put the test user's streak back to 0 (lost, restorable), as before the recording */
export async function cleanup(page, base) {
  await page.goto(base + USER, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await assertProduction(page)
  if (/^0 day/.test(await streakCard(page).innerText())) return
  await menuButton(page).click()
  await page.locator('[role=menuitem]:visible', { hasText: 'Reset streak' }).first().click()
  await page.getByRole('button', { name: /^Reset( streak)?$/ }).last().click()
  await page.waitForTimeout(2000)
}
