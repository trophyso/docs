/**
 * Configure a push provider on Agentic messaging › Channels › Push: paste an
 * APNs signing key, fill in the Team ID, Key ID and Bundle ID, then Save configuration.
 * Used on agentic-messaging/channels (Push notifications).
 *
 * The credentials are placeholders (the dashboard only checks the fields are
 * filled in). Cleanup deletes the APNs configuration again, but only when it
 * still has this flow's Team ID, so it never removes a real one.
 */
const ROUTE = '/agentic-messaging/channels/push'
const TEAM_ID = '8K2J7N4QX9'

export const meta = {
  start: ROUTE,
  url: 'app.trophy.so/agentic-messaging/channels/push',
  output: 'assets/agentic-messaging/push_provider.mp4',
}

const KEY = `-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQgx8Jq2vR4mT0wLk9p
Zc3nH7bV1dE5sY6uQaFgW2iO8rKgCgYIKoZIzj0DAQehRANCAAT4mJ9kL2xVb7nQ
Rz5wP1cT8yH3uE6gA0dS4fK9jN2bM7vX1qW5eY8tC3oL6rU0iZ9hG4kD2sF7aP1n
-----END PRIVATE KEY-----`

const field = (page, placeholder) => page.locator(`[placeholder^="${placeholder}"]:visible`).first()

export default async function flow(run) {
  const { page } = run
  // Paste the key (as you would from the .p8 file) rather than typing it
  const key = field(page, '-----BEGIN PRIVATE KEY-----')
  await run.click(key, { after: 300 })
  await key.fill(KEY)
  await run.wait(900)
  await run.type(field(page, 'ABC123DEFG'), TEAM_ID)
  await run.type(field(page, 'DEF123GHIJ'), 'R3T6W9Y2B5')
  await run.type(field(page, 'com.example.app'), 'com.stride.app')
  await run.click(page.getByRole('button', { name: 'Save configuration' }).first(), { after: 2500 })
}

/** Delete the APNs configuration this flow saved */
export async function cleanup(page, base) {
  await page.goto(base + ROUTE, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1000)
  const teamId = field(page, 'ABC123DEFG')
  if ((await teamId.inputValue().catch(() => '')) !== TEAM_ID) return
  await page.getByRole('button', { name: 'Delete', exact: true }).first().click()
  await page.waitForTimeout(600)
  await page.getByRole('button', { name: /^(Delete|Confirm)$/ }).last().click()
  await page.waitForTimeout(2000)
  await page.reload({ waitUntil: 'networkidle' })
  if ((await field(page, 'ABC123DEFG').inputValue().catch(() => '')) === TEAM_ID) throw new Error('APNs configuration was not deleted')
}
