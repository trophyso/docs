/**
 * Invite a team member: organization switcher → Manage → Members → Invite →
 * email → Send invitations. Used on account/members (Invite your team).
 *
 * Invites only coach@example.com, so nobody real gets an email; cleanup
 * revokes the invitation. Real teammates' emails and photos in the members
 * list are swapped for placeholders before recording.
 */
export const meta = {
  start: '/metrics',
  url: 'app.trophy.so/metrics',
  output: 'assets/account/members/add_new_member.mp4',
  prepare: maskTeammates,
}

const EMAIL = 'coach@example.com'

export default async function flow(run) {
  const { page } = run
  await run.click(page.getByRole('button', { name: 'Open organization switcher' }), { after: 700 })
  await run.click(page.getByRole('button', { name: 'Manage' }), { after: 1500 })
  await run.click(page.locator('button:visible', { hasText: /^Members$/ }).first(), { after: 1500 })
  await run.click(page.getByRole('button', { name: 'Invite', exact: true }), { after: 1000 })
  await run.type(page.locator('input[placeholder^="example@email.com"]:visible'), EMAIL)
  await run.click(page.getByRole('button', { name: 'Send invitations' }), { after: 2500 })
}

/** Swap teammates' real emails and photos for placeholders (Clerk re-renders, so keep watching) */
export async function maskTeammates(page) {
  await page.evaluate(() => {
    const swaps = { 'jason.louro@trophy.so': 'jordan@runnr.app', 'jason@trophy.so': 'sam@runnr.app' }
    const avatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#6b7a3a"/><text x="20" y="26" font-family="Helvetica,Arial" font-size="17" fill="#fff" text-anchor="middle">J</text></svg>')
    const fix = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let n; (n = walker.nextNode()); ) {
        for (const [from, to] of Object.entries(swaps)) {
          if (n.nodeValue.includes(from)) n.nodeValue = n.nodeValue.replace(from, to)
          if (!n.nodeValue.includes(to)) continue
          // The avatar sits in the same row
          let row = n.parentElement
          for (let i = 0; i < 6 && row && !row.querySelector('img'); i++) row = row.parentElement
          const img = row?.querySelector('img')
          if (img && img.getAttribute('src') !== avatar) {
            img.removeAttribute('srcset')
            img.setAttribute('src', avatar)
          }
        }
      }
    }
    fix()
    new MutationObserver(fix).observe(document.body, { childList: true, subtree: true, characterData: true })
  })
}

/** Revoke the example.com invitation */
export async function cleanup(page, base) {
  await page.goto(base + '/metrics', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Open organization switcher' }).click()
  await page.getByRole('button', { name: 'Manage' }).click()
  await page.locator('button:visible', { hasText: /^Members$/ }).first().click()
  await page.getByRole('tab', { name: /Invitations/ }).click()
  await page.waitForTimeout(1500)
  for (let i = 0; i < 3; i++) {
    const row = page.locator('tr:visible', { hasText: EMAIL }).first()
    if (!(await row.count())) break
    await row.getByRole('menuitem', { name: 'Open menu' }).click()
    await page.locator('[role=menuitem]:visible', { hasText: /Revoke/ }).first().click()
    await page.waitForTimeout(2000)
  }
  await page.goto(base + '/metrics', { waitUntil: 'networkidle' })
}
