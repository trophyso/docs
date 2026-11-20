/**
 * Grant streak freezes over time: switch on Auto-earn freezes → earn interval
 * and earn amount → Save.
 * Used on features/streaks (Streak freezes → Granting freezes).
 * The org already has auto-earn on, so the page opens with it switched off
 * (not saved); cleanup saves the original settings back.
 */
import { assertProduction, field, restoreStreakSettings, saveButton, scrollTo, setSwitch, switches } from './_streak-settings.mjs'

export const meta = {
  start: '/streaks/configure',
  url: 'app.trophy.so/streaks/configure',
  output: 'assets/features/streaks/freeze_accumulation.mp4',
  async prepare(page) {
    await assertProduction(page)
    await setSwitch(page, 2, false) // Auto-earn freezes
    await scrollTo(page.getByText('Days off', { exact: true }).first(), 60)
    await page.mouse.move(2, 898) // no hover state on the opening frame
  },
}

export default async function flow(run) {
  const { page } = run
  await run.click(switches(page).nth(2))
  await run.type(field(page, 'streakFreezeAutoEarnInterval'), '7', { clear: true })
  await run.type(field(page, 'streakFreezeAutoEarnAmount'), '2', { clear: true })
  await run.click(saveButton(page), { after: 2500 })
}

export const cleanup = restoreStreakSettings
