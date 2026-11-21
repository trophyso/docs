---
name: docs-dashboard-videos
description: Create or update the docs' dashboard walkthrough videos (the looping MP4s in assets/, e.g. create_new_metric.mp4) with a scripted Playwright capture of the Trophy dashboard and a Remotion render in the Screen Studio style (smooth cursor, auto-zoom, Daylight frame). Use whenever a docs video needs recording, re-recording after a UI change, or a new walkthrough is wanted. Not for still screenshots or mock UI images (see scripts/media-mocks).
---

# Docs dashboard videos

Every walkthrough video in the docs is a **flow script** (about 20 lines) in
`scripts/media-videos/flows/`. One command records it against the staging
dashboard and renders a polished 1920×1080 MP4 into the docs asset. A UI
change means re-running the command, not re-recording by hand.

```
cd scripts/media-videos
node make.mjs <flow> --stills-only   # capture + review stills (~25s)
node make.mjs <flow> --no-capture    # re-render the last capture (~30s at 60fps with motion blur)
node make.mjs <flow>                 # capture + stills + MP4 + copy into assets/ (~50s)
```

Working examples: `flows/create-new-metric.mjs`, `flows/create-custom-user-attribute.mjs`.

## How it works

1. **`capture.mjs`** opens the signed-in dashboard in Playwright (1440×900 CSS
   pixels at 2×), records Chrome's screencast frames (2880×1800 JPEGs), and
   logs every action the flow takes (`move`, `click`, `type`, `focus`) with
   timestamps and the target element's box. It hides staging-only UI as the
   page renders (see "Tidy" below) and runs the flow's `cleanup` before and
   after recording.
2. **`src/timeline.mjs`** maps capture time to video time:
   - **Speed ramps:** dead stretches (spinners, page loads, pauses longer than about 1.5s) play at 3×, with 0.3s of real time kept at each edge.
   - **Output time:** every animation runs on video time, so the camera and cursor always move at the same speed. Capture time is only used to pick which frame to show.
   - **Length:** the video runs `INTRO` + last action + `OUTRO` + `LOOP`, set by the actions, not the capture.
3. **`src/Walkthrough.tsx`** (Remotion, 60fps, motion blur) builds a 1920×1080 stage:
   - **Framing:** the afternoon-sky background, with the frames inside a browser window labeled `app.trophy.so`.
   - **Camera:** it zooms the **whole stage** (background, window chrome and page together, like Screen Studio). Consecutive actions are **grouped** into one framing when they happen close together and their combined area can still be zoomed into, so filling a form is one zoom in, a steady hold and one zoom out. Every move is a timed ease that always finishes.
   - **Cursor:** drawn from the log, since the capture has no real cursor.
     - It eases along a gentle arc and settles into each target with only a barely-there overshoot (kept subtle on purpose; don't make it springier).
     - It turns into an I-beam over fields it will type in and a hand over buttons it clicks.
     - It hides while typing.
     - Each click gets a press and an olive ripple.
   - **Loop:** the last 0.5s cross-fades back to the opening frame, so the docs' looping `<video>` has no visible seam.
4. **`make.mjs`** bundles once, renders review stills, renders the H.264
   MP4 (CRF 18), and copies it to the flow's `meta.output`.

## Setup (once per machine)

- The **web repo** must be checked out next to the docs (`../web`, or set
  `WEB_REPO`) with `node_modules` installed. Playwright and its Chromium come
  from there; nothing is installed for them here.
- `cd scripts/media-videos && npm install` (Remotion is pinned. Its packages
  must all be the same version, so bump them together).
- **Sign in:** staging uses Clerk (email codes, bot checks), so a person signs
  in once and the session is kept in a Chromium profile:
  - The default profile is `~/.trophy-docs-media/profile`. Override it with `PROFILE_DIR`.
  - **Ask the user to run `node login.mjs`.** It opens a visible window and closes it once the dashboard loads.
  - If `scripts/media-videos/.env` (gitignored) has `STAGING_EMAIL` and `STAGING_PASSWORD`, `login.mjs` pre-fills the form. `capture.mjs` also uses them to sign in headless when the saved session has expired.
  - Agents may be blocked from writing `.env` files or copying profiles. If so, ask the user to do it; don't route around the block.
- The dashboard is `https://staging-app.trophy.so` (`staging.trophy.so` does
  **not** resolve). Override with `DASHBOARD_URL`.

## Writing a flow

```js
// flows/create-thing.mjs
export const meta = {
  start: '/things',                 // route the video opens on (loaded before recording starts)
  url: 'app.trophy.so/things',      // shown in the window's address bar (never the staging host)
  output: 'assets/features/things/create_thing.mp4', // docs asset to replace
}

export default async function flow(run) {
  const { page } = run
  await run.click(page.getByRole('button', { name: 'New thing' }))
  const dialog = page.locator('[role=dialog]:visible').first()
  await run.type(dialog.locator('input:visible').nth(0), 'Morning runs')
  await run.blur(dialog.locator('input:visible').nth(0)) // auto-filled fields (keys) fill in on blur
  // End on the click that produces the result; the camera zooms out to show it
  await run.click(dialog.getByRole('button', { name: 'Create thing' }), { after: 1500 })
}

/** Required when the flow creates or changes anything: undo it */
export async function cleanup(page, base) {
  await page.goto(base + '/things', { waitUntil: 'networkidle' })
  const row = page.locator('tr', { hasText: 'morning-runs' }).first()
  if (!(await row.count())) return
  await row.locator('button').last().click()                       // the row's ⋮ menu
  await page.locator('[role=menuitem]:visible', { hasText: 'Delete' }).first().click()
  await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
  await page.waitForTimeout(1500)
}
```

**The `run` API** (each step is paced like a person and logged for the camera):

| Call | Does |
|---|---|
| `run.click(locator, { pause = 700, after = 900 })` | Cursor glides to the element, clicks, waits `after` ms |
| `run.type(locator, text, { delay = 75, after = 600, clear })` | Clicks into a field and types key by key |
| `run.select(listboxButton, 'Option text')` | Opens a custom listbox and clicks the option |
| `run.blur(locator, { after = 900 })` | Takes focus off a field without focusing another, triggering blur auto-fill (e.g. keys from names). Use it instead of Tab, which leaves the next field's text highlighted. |
| `run.key('Enter' \| 'Escape' \| …, { after })` | Presses a key, without moving the cursor |
| `run.show(locator, { hold = 1500 })` | Points the camera at a small result without clicking. A wide target, like a table row or a whole form, gets the full view instead, so don't `show` one: it only lengthens the ending. |
| `run.wait(ms)` | Pause |

Optional `meta` fields:
- `leadIn` / `tail` (ms): idle time at the start and end of the capture.
- `prepare(page)`: runs after the start page loads, before recording. Use it to edit page text for realistic data.
- `fakeAnalytics: true`: fill analytics pages with realistic numbers (see "Analytics" below).

**Find selectors first, don't guess.** `node inspect.mjs <route> [--click "Button text" …] [--fake-analytics]`:
- saves `out/inspect.png`
- prints every visible button, link, input (with placeholder and value), listbox, listbox option and open dialog, with positions and `disabled` state

## Analytics

Staging has too few events for analytics, so its analytics pages show grey
placeholder charts and a "No Data" callout. `src/fake-analytics.mjs` fixes that
in the browser:
- Every analytics page loads its numbers from a Next.js server action. The script lets each action request through, then rewrites row `1:` of the RSC response (plain JSON) before the page sees it. The real response already has the right dates, labels and shape; only the values change.
- One transform per response shape: Home, metric, points system, leaderboard, Users, Emails (legacy) and the email send counts. Unknown shapes pass through untouched. When the app changes a shape, update its transform.
- The numbers describe the fictional fitness app: about 6,200 MAUs, matching the sidebar usage card. Milestone completions match `check_user_completions.png`. They're seeded from the request, so the same page always shows the same numbers.
- Filtering by a user attribute gives a smaller segment with its own retention, and each extra filter narrows it further.
- Retention charts need a range longer than the 14-day activation window plus 3 days, so pick **Last 30 days** or **Last 3 months** in `prepare`.

Flows opt in with `meta.fakeAnalytics` (see `flows/segmenting-analytics.mjs` and `flows/email-analytics.mjs`).

The analytics **stills** come from `node analytics-stills.mjs [name filter] [--review]`. It writes full pages (1680×1050 at 2×) and single-card crops straight into `assets/`, or into `out/stills/` with `--review`. The shot list is at the top of the file.

Read that output, then write the flow. To see what the **old** video showed, run
`node frames.mjs ../../assets/<path>.mp4 [count]`. It writes frames to `out/old/<name>/`.

## Review before replacing

1. `node make.mjs <flow> --stills-only`, then **look at every still** in `out/<flow>/`:
   - `click-N.png`: just after each click
   - `typed-N.png`: after each typed field
   - `outro-1..3.png`: 25%, 50% and 75% of the way through the final zoom-out. They should step smoothly toward the full view, with some motion blur.
   - `before-loop.png`: fully zoomed out on the result, before the loop fade
   - `last.png`: the final frame, which has cross-faded back to the opening state
2. Check that:
   - the right things are clicked and typed
   - nothing is cut off by the zoom
   - no stray tooltips or staging-only UI appear
   - the result is visible at the end
3. Make the full video. Optionally check the encoded file with `node frames.mjs out/<flow>/<flow>.mp4 8`.
4. In the MDX page:
   - make sure the `<video>` uses `className="w-full aspect-video"` (the output is 16:9)
   - remove the asset from the page's `{/* TODO(media): … */}` marker
5. Run `npm run mint:validate` from the docs root.

## Gotchas already solved (don't rediscover them)

**Capture and video**
- **Low-resolution frames:** without `--force-device-scale-factor=2`, the screencast sends 1440-wide frames even with `deviceScaleFactor: 2`. `openDashboard()` sets it.
- **Can't read MP4s:** Playwright's Chromium can't decode H.264, so it can't play or seek the docs MP4s. `frames.mjs` uses an installed Chrome, Brave or Edge, and opens the file with `page.goto(file://…)`. A page built with `setContent` can't load `file://` media and just hangs.
- **No ffmpeg or ffprobe** on the dev machine. `mdls -name kMDItemDurationSeconds` gives duration and size, but only after Spotlight indexes the file. Use `frames.mjs` instead.
- **Video length comes from the actions, not the capture:** clicking a submit that navigates can block until the next page loads, and the capture's idle tail is shorter than the zoom-out needs. The timeline compresses dead time, sets the length from the last action, and holds the last frame if needed. Don't "fix" pacing by adding `run.wait`.
- **Grouping is measured from when the cursor sets off, not from the click.** Measuring from clicks split a dialog into two framings, which cut off the Create button and then jumped to it.
- **Camera moves must finish:** an earlier per-frame smoothing never fully settled, and a near-1× zoom on a wide target made the ending stall halfway and then zoom again. The camera now uses fixed eased transitions plus `MIN_ZOOM`. Keep it that way.

**Forms**
- **Key fields** (metric key, attribute key) fill in from the name **when the name field blurs**. Type the name, then `run.blur(nameField)`. Never type into the key: typing before the auto-fill appends to it, giving `flashcards-flippedflashcards-flipped`. Tab works but leaves the key text highlighted in blue.
- **Submit buttons start disabled** until required fields are valid, so Playwright's click waits up to 30s and times out. `inspect.mjs` shows `disabled`.

**Selectors**
- **Selects** are Headless UI listboxes (`button[aria-haspopup=listbox]` → `[role=option]`), not `<select>`. Use `run.select`.
- **Checkboxes** have sr-only labels, so use `page.getByRole('checkbox', { name })`.
- **Overlay divs intercept clicks** in some editors. `run.click` falls back to a mouse click at the element's position automatically.
- **Confirm dialogs** (Delete, Remove) often have no `role=dialog`. Use `page.getByRole('button', { name: 'Delete', exact: true }).last()`.
- **Hidden duplicates:** many labels exist twice (a hidden mobile copy), so always use `:visible`, `>> visible=true` or role selectors. Plain `text=` can match the hidden copy and time out.

**Display and data**
- **Hover tooltips**, like "Enter all required fields…" on a disabled button, linger while saving. `run.click` parks the real mouse in a corner after each click. The drawn cursor is unaffected.
- **Tidy:** handled by `capture.mjs`'s init script, which re-applies on every re-render:
  - hides the staging-only `org_…` ID badge
  - hides the tenant selector (the test org's tenants use real company names and logos)
  - sets the sidebar usage card to 6,248 MAUs
  - never shows `staging-app` in the address bar (`meta.url` is drawn instead)
- **Staging analytics are placeholders** unless you use `fakeAnalytics` (see "Analytics"). Without it, analytics pages show skeleton charts ("Not enough data", fake 25k/6k figures).
- **Environment change tracking** (View changes, Copy all, Revert) is switched off for multi-tenant orgs, and the usual test org (Runnr) is multi-tenant. `flows/_environment-changes.mjs` records in the single-tenant "Staging [Old]" org instead, with a temporary "Feature dev" environment, and switches back to Runnr in teardown.
  - Never copy into a Staging environment there: a copy propagates to every Development environment, including the org's real Charlie-Dev and Jason-Dev.
  - Reverting in a Development environment is safe, since Development environments share the lowest priority and nothing is downstream.
- **Scrolling:** `box()` jumps the page with `scrollIntoViewIfNeeded`, which looks abrupt. For a visible scroll, wheel in small steps until the target is in place first (`scrollTo` in `flows/email-analytics.mjs`), so the following action doesn't jump.
- **Test org data** to build flows around:
  - metrics: Workouts, Lessons
  - attributes: Plan, Subscription Plan, City
  - leaderboards: Weekly Workout Champions, and an inactive "Test" one that's fully editable
  - points systems: XP, Coins, Energy
  - Use the fictional fitness app's language (Stride, XP, workouts) for anything you type.

## Safety

- **Every flow that creates or edits something needs `cleanup`.** It runs before the capture (in case a previous run died) and after it. Confirm the data is gone afterwards: `node inspect.mjs <route>`.
- Only touch things the flow created. Don't edit or delete existing test data unless the user said so.
  - Email sender and domain setup is real configuration. The org sends from `notifications@mail.buildwithtrophy.com`, verified by DNS records on `buildwithtrophy.com`. Leave it alone.
- Never commit captures or renders. `public/captures/`, `out/`, `node_modules/` and `.env` are gitignored, and the folder is in `.mintignore`.

## Tuning the look

Constants at the top of `src/Walkthrough.tsx`:

| Constant | Controls |
|---|---|
| `ZOOM` | Max zoom of the whole stage. It also shrinks to fit wide groups. |
| `MIN_ZOOM` | A framing that would zoom less than this gets the full stage instead, so the camera never stalls halfway |
| `GROUP_GAP` / `PADDING` | How close in time actions must be to share a framing, and the breathing room around it |
| `TRANS` | Duration of every camera move. Each move is a timed ease that always finishes; a move interrupted by the next blends into it. |
| `CURSOR` | Cursor size in page pixels; it zooms with the stage |
| `CURSOR_OVERSHOOT` | How far past a target the cursor drifts before settling (0.012; 0 = none). Keep it low: springier reads as bouncy |
| `CURSOR_ARC` | How much the cursor's path bows sideways (0.05 of the distance) |
| `BLUR` | Motion blur shutter angle and samples. More samples is smoother but slower to render. |

`src/timeline.mjs` (plain JS, shared with `make.mjs`):

| Constant | Controls |
|---|---|
| `INTRO` | Hold on the first frame before playing |
| `OUTRO` | Time after the last action: `HOLD` + zoom-out + a beat on the full view |
| `LOOP` | Length of the closing cross-fade back to the opening frame |
| `LEAD` / `MOVE` / `HOLD` | When the camera reacts before an action, the cursor's travel time, and how long the camera stays after |
| `SPEEDUP` / `EDGE` / `MIN_DEAD` | The speed ramps: how much faster, real-time margins, and the shortest stretch worth speeding up |

The frame rate (60) is in `src/Root.tsx`.

Preview live with `npm run studio`: pick the `walkthrough` composition and set the props to `{ "name": "<flow>" }`. Change the look once, then re-run `--no-capture` for every flow to keep the videos consistent.

## Licensing note

Remotion is free for individuals and small companies; larger companies need a
company license (remotion.dev/license). Check before adding new uses.
