/**
 * Grant streak freezes to new users: switch on Streak freezes → starting and
 * maximum freeze counts → Save.
 * Used on features/streaks (Streak freezes → Granting freezes).
 * The org already has freezes on, so the page opens with them switched off
 * (not saved); cleanup saves the original settings back.
 */
import { assertProduction, field, restoreStreakSettings, saveButton, scrollTo, setSwitch, switches } from './_streak-settings.mjs'

export const meta = {
  start: '/streaks/configure',
  url: 'app.trophy.so/streaks/configure',
  output: 'assets/features/streaks/freeze_grants.mp4',
  async prepare(page) {
    await assertProduction(page)
    await setSwitch(page, 2, false) // Auto-earn freezes (its own video)
    await setSwitch(page, 1, false) // Streak freezes
    await scrollTo(page.getByText('Days off', { exact: true }).first(), 200)
    await page.mouse.move(2, 898) // no hover state on the opening frame
  },
}

export default async function flow(run) {
  const { page } = run
  await run.click(switches(page).nth(1))
  await run.type(field(page, 'streakFreezeStartCount'), '2', { clear: true })
  await run.type(field(page, 'streakFreezeMaxCount'), '4', { clear: true })
  await run.click(saveButton(page), { after: 2500 })
}

export const cleanup = restoreStreakSettings
