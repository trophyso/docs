/**
 * Balance a points system with the preview tool: on the configure page, type
 * expected usage (workouts, streak length) into the Preview panel and watch
 * the estimated points update.
 * Used on features/points (Balancing points).
 *
 * Records against its own "Stride XP" system (10 XP per workout, 50 XP per
 * 7-day streak), created before recording and deleted afterwards. The preview
 * itself saves nothing.
 */
import { deleteStrideXp, openForRecording, setupStrideXp } from './create-system.mjs'

export const meta = {
  start: '/points',
  url: 'app.trophy.so/points',
  output: 'assets/features/points/points_preview.mp4',
  async prepare(page) {
    const base = new URL(page.url()).origin
    const root = await setupStrideXp(page, base, {
      triggers: [
        { type: 'Metric', metric: 'Workouts', threshold: 1, points: 10 },
        { type: 'Streak', days: 7, points: 50 },
      ],
    })
    await openForRecording(page, base, root + '/configure')
  },
}

/** The Preview panel's number field on the row labelled `label` */
const previewField = (page, label) =>
  page.locator(`xpath=//*[normalize-space(text())="Preview"]/following::*[normalize-space(text())="${label}"][1]/following::input[1]`)

export default async function flow(run) {
  const { page } = run
  await run.type(previewField(page, 'Workouts'), '12', { after: 900 })
  await run.type(previewField(page, 'Streak length'), '14', { after: 900 })
  await run.type(previewField(page, 'Workouts'), '20', { after: 1500 })
}

export async function cleanup(page, base) {
  await deleteStrideXp(page, base)
}
