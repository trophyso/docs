/**
 * Turn on streak personalization: Allow streak personalization → Save.
 * Used on features/streaks (Streak personalization).
 * The org already has it on, so the page opens with it switched off (not
 * saved); cleanup saves the original settings back.
 */
import { assertProduction, restoreStreakSettings, saveButton, scrollTo, setSwitch, switches } from './_streak-settings.mjs'

export const meta = {
  start: '/streaks/configure',
  url: 'app.trophy.so/streaks/configure',
  output: 'assets/features/streaks/streak_personalization.mp4',
  async prepare(page) {
    await assertProduction(page)
    await setSwitch(page, 0, false) // Allow streak personalization
    await scrollTo(page.getByText('Evaluation mode', { exact: true }).first(), 40)
    await page.mouse.move(2, 898) // no hover state on the opening frame
  },
}

export default async function flow(run) {
  const { page } = run
  // Rest on the label first, so the camera frames the whole row, not just the switch
  await run.hover(page.getByText('Allow streak personalization', { exact: true }).first(), { after: 300 })
  await run.click(switches(page).nth(0))
  await run.click(saveButton(page), { after: 2500 })
}

export const cleanup = restoreStreakSettings
