/**
 * Manage roles: organization switcher → Manage → Members → open a member's
 * role menu to show the Member / Admin choice. Used on account/members
 * (Manage user roles).
 *
 * Nothing is changed: the menu is only opened and the cursor rests on Admin
 * without clicking, so existing members keep their roles. Real
 * teammates' emails and photos are swapped for placeholders before recording.
 */
import { maskTeammates } from './add-new-member.mjs'

export const meta = {
  start: '/metrics',
  url: 'app.trophy.so/metrics',
  output: 'assets/account/members/manage_roles.mp4',
  prepare: maskTeammates,
}

export default async function flow(run) {
  const { page } = run
  await run.click(page.getByRole('button', { name: 'Open organization switcher' }), { after: 700 })
  await run.click(page.getByRole('button', { name: 'Manage' }), { after: 1500 })
  await run.click(page.locator('button:visible', { hasText: /^Members$/ }).first(), { after: 1800 })
  // The teammate's role menu (not the signed-in admin's own row)
  const role = page.locator('tr:visible', { hasText: 'jordan@runnr.app' }).locator('button[aria-haspopup=listbox]')
  await run.click(role, { after: 600 })
  // Rest on Admin without picking it; the video ends with the menu open
  await run.hover(page.locator('[role=option]:visible', { hasText: /^Admin$/ }).first(), { after: 1400 })
}
