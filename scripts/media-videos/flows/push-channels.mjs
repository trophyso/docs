/**
 * The push channels page: open the Channels tab and scroll through the APNs,
 * FCM and Expo forms. Used on features/push-notifications (Sending push
 * notifications → Set up channels). Read-only: nothing is typed or saved,
 * since these are real channel credentials.
 */
import { CONFIGURE } from './_push-templates.mjs'

export const meta = {
  start: CONFIGURE,
  url: 'app.trophy.so/push/channels',
  output: 'assets/features/push/push_channels.mp4',
}

/**
 * Scroll a heading (matched by a regex) near the top of the page, slowly and
 * eased: the browser's own smooth scroll is fast enough over this long form
 * to smear into double images under the video's motion blur
 */
async function scrollTo(page, text, ms = 1100) {
  await page.getByText(text).filter({ visible: true }).first().evaluate(
    (h, ms) =>
      new Promise((done) => {
        let box = h.parentElement
        while (box && !(box.scrollHeight > box.clientHeight + 10 && /(auto|scroll)/.test(getComputedStyle(box).overflowY))) box = box.parentElement
        if (!box) return done()
        const from = box.scrollTop
        const to = Math.min(box.scrollHeight - box.clientHeight, from + h.getBoundingClientRect().top - box.getBoundingClientRect().top - 24)
        const t0 = performance.now()
        const step = (now) => {
          const p = Math.min(1, (now - t0) / ms)
          box.scrollTop = from + (to - from) * (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2)
          if (p < 1) requestAnimationFrame(step)
          else done()
        }
        requestAnimationFrame(step)
      }),
    ms,
  )
  await page.waitForTimeout(200)
}

export default async function flow(run) {
  const { page } = run
  await run.click(page.locator('a:visible', { hasText: 'Channels' }).first(), { after: 1500 })
  await run.hover(page.locator('textarea:visible').first(), { after: 1200 })
  await page.mouse.move(1400, 880)
  await scrollTo(page, /^Firebase Cloud Messaging/)
  await run.hover(page.locator('textarea:visible').nth(1), { after: 1200 })
  await page.mouse.move(1400, 880)
  await scrollTo(page, /^Expo push/i)
  await run.hover(page.getByPlaceholder('my-expo-project'), { after: 1500 })
}
