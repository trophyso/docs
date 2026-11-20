# Docs dashboard videos

Scripted walkthrough videos for the docs: Playwright records a flow against
the staging dashboard, and Remotion renders a 1920×1080 MP4 in the Screen
Studio style (smooth cursor, auto-zoom, Daylight frame).

```
npm install
node login.mjs                 # once: sign in to staging in a visible browser
node make.mjs <flow>           # capture → stills → MP4 → copy into assets/
```

Flows live in `flows/`. The full guide (writing flows, reviewing, gotchas,
safety) is the agent skill at
[`.claude/skills/docs-dashboard-videos/SKILL.md`](../../.claude/skills/docs-dashboard-videos/SKILL.md).
