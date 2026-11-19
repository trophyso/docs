/**
 * Copy a webhook's signing secret: the webhook's ⋮ menu → Copy secret.
 * Used on webhooks/quickstart and webhooks/security.
 * The secret only goes to the clipboard (a "Secret copied" toast shows), so
 * no secret is ever on screen. Never click Regenerate secret. No cleanup:
 * nothing changes.
 */
export const meta = {
  start: '/developers/webhooks',
  url: 'app.trophy.so/developers/webhooks',
  output: 'assets/webhooks/copy_secret.mp4',
}

export default async function flow(run) {
  const { page } = run
  const row = page.locator('tr', { hasText: 'StreakEvents' }).first()
  await run.click(row.locator('button[aria-haspopup=menu]'), { after: 600 })
  await run.click(page.locator('[role=menuitem]:visible', { hasText: /^Copy secret$/ }).first(), { after: 2500 })
}
