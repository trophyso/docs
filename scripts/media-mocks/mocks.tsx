/**
 * Docs media mocks: example in-app UI and diagrams for the docs, drawn with
 * the website's Trophy Daylight components (web repo, src/components). Each
 * mock is rendered and screenshotted by render.mjs into the docs' assets.
 *
 * The app in every mock is "Stride", a made-up fitness app that earns XP.
 */
import { ArrowRightIcon, CaretUpIcon, LightningIcon } from '@phosphor-icons/react/ssr'
import { type ReactNode } from 'react'

import { FEATURE_ICON } from '@/components/icons/feature-icons'
import { BadgeCard } from '@/components/widgets/feature-hero-parts'
import { LeaderboardFeatureWidget } from '@/components/widgets/feature-hero/leaderboard'
import { SkyPanel } from '@/components/widgets/sky-panel'
import { WidgetFormToggle } from '@/components/widgets/widget-form-elements'
import { WIDGET_ICON } from '@/components/widgets/widget-icons'
import { cn } from '@/lib/utils'

const Points = FEATURE_ICON.points

/* ---------------------------------------------------------------------------
 * Frames
 * ------------------------------------------------------------------------ */

/** A sky panel with content on it; the screenshot is taken of this element */
function Shot({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div data-shot style={{ width }} className="pointer-events-none select-none">
      <SkyPanel>{children}</SkyPanel>
    </div>
  )
}

/** A strong glass card */
function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('dl-glass dl-glass--strong flex flex-col gap-4 rounded-2xl p-5', className)}>
      {children}
    </div>
  )
}

function Title({ children, end }: { children: ReactNode; end?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h3 className="font-display text-lg tracking-[-0.01em]">{children}</h3>
      {end}
    </div>
  )
}

function XP({ n, plus = true }: { n: number | string; plus?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 font-display text-base tabular-nums">
      {plus ? '+' : ''}
      {n}
      <Points size={14} aria-hidden className="text-primary" />
    </span>
  )
}

function Rows({ children }: { children: ReactNode }) {
  return <div className="flex flex-col divide-y divide-foreground/10">{children}</div>
}

/* ---------------------------------------------------------------------------
 * Points (features/points.mdx)
 * ------------------------------------------------------------------------ */

/** Ways to earn XP: the points system's triggers */
function PointsTriggers() {
  const triggers: [ReactNode, string, number][] = [
    [<WIDGET_ICON.barbell size={18} key="a" />, 'Complete a workout', 10],
    [<WIDGET_ICON.barbell size={18} key="b" />, 'Every 5 workouts', 50],
    [<FEATURE_ICON.streaks size={18} key="c" />, 'Keep a 7-day streak', 100],
    [<FEATURE_ICON.milestones size={18} key="d" />, 'Complete a milestone', 25],
  ]
  return (
    <Shot width={520}>
      <Card>
        <Title end={<span className="dl-label">XP</span>}>Ways to earn XP</Title>
        <Rows>
          {triggers.map(([icon, label, n]) => (
            <div key={label} className="flex items-center gap-3 py-2.5">
              <span className="flex size-8 flex-none items-center justify-center rounded-lg bg-foreground/5 text-muted-foreground">
                {icon}
              </span>
              <span className="flex-1 text-sm">{label}</span>
              <XP n={n} />
            </div>
          ))}
        </Rows>
      </Card>
    </Shot>
  )
}

/** Latest awards: the user's recent points events */
function PointsAwards() {
  const awards: [string, string, number][] = [
    ['Nov 19', 'Completed a workout', 10],
    ['Nov 18', 'Kept a 7-day streak', 100],
    ['Nov 18', 'Completed a workout', 10],
    ['Nov 17', 'Completed a milestone', 25],
    ['Nov 17', 'Completed a workout', 10],
  ]
  return (
    <Shot width={520}>
      <Card>
        <Title
          end={<span className="text-sm text-primary underline underline-offset-4">How do I earn XP?</span>}
        >
          Latest awards
        </Title>
        <Rows>
          {awards.map(([date, why, n], i) => (
            <div key={i} className="flex items-center gap-4 py-2.5">
              <span className="w-14 flex-none font-mono text-xs text-muted-foreground">{date}</span>
              <span className="flex-1 text-sm">{why}</span>
              <XP n={n} />
            </div>
          ))}
        </Rows>
      </Card>
    </Shot>
  )
}

/** Bars with labels underneath, in the points widget's style */
function Bars({
  values,
  labels,
  now,
  height = 132,
}: {
  values: number[]
  labels: string[]
  now?: number
  height?: number
}) {
  const max = Math.max(...values)
  return (
    <div>
      <div
        className="dl-w-bars"
        style={{ gridTemplateColumns: `repeat(${values.length}, 1fr)`, height }}
      >
        {values.map((v, i) => (
          <div
            key={i}
            className={cn('dl-w-bar', i === now && 'dl-w-bar--now')}
            style={{ height: `${Math.max(3, (v / max) * 100)}%` }}
          />
        ))}
      </div>
      <div
        className="mt-2 grid gap-1 text-center"
        style={{ gridTemplateColumns: `repeat(${labels.length}, 1fr)` }}
      >
        {labels.map((l) => (
          <span key={l} className="font-mono text-[11px] text-muted-foreground">
            {l}
          </span>
        ))}
      </div>
    </div>
  )
}

/** XP earned this week: the user points summary, by day */
function UserPointsSummary() {
  const week = [40, 60, 10, 80, 50, 125, 95]
  return (
    <Shot width={520}>
      <Card>
        <Title end={<span className="dl-label">This week</span>}>XP earned this week</Title>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-4xl tracking-[-0.03em]">460</span>
          <span className="text-sm text-muted-foreground">XP</span>
          <span className="ml-2 inline-flex items-center gap-0.5 font-mono text-xs text-positive">
            <CaretUpIcon size={12} weight="bold" aria-hidden />
            18% on last week
          </span>
        </div>
        <Bars values={week} labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']} now={6} />
      </Card>
    </Shot>
  )
}

/** All users: the points summary, as a distribution */
function PointsSummary() {
  const buckets = [1280, 860, 610, 420, 300, 190, 120, 70, 40, 20]
  const labels = ['0', '100', '200', '300', '400', '500', '600', '700', '800', '900+']
  return (
    <Shot width={560}>
      <Card>
        <Title end={<span className="dl-label">Users by total XP</span>}>All users</Title>
        <Bars values={buckets} labels={labels} now={3} height={150} />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2.5 rounded-sm bg-foreground" />
          You&apos;re in the top 25% with 340 XP
        </div>
      </Card>
    </Shot>
  )
}

/* ---------------------------------------------------------------------------
 * Milestones (features/milestones.mdx)
 * ------------------------------------------------------------------------ */

function UserMilestones() {
  return (
    <Shot width={600}>
      <Card>
        <Title end={<span className="dl-label">4 of 6</span>}>Your milestones</Title>
        <div className="grid grid-cols-3 gap-2.5">
          <BadgeCard badge={{ name: 'First workout', icon: 'barbell', earned: 'Oct 2, 2026' }} lit />
          <BadgeCard badge={{ name: '7-day streak', icon: 'fire', earned: 'Oct 9, 2026' }} lit />
          <BadgeCard badge={{ name: '10 workouts', icon: 'barbell', earned: 'Oct 21, 2026' }} lit />
          <BadgeCard badge={{ name: 'Early riser', icon: 'cloud-sun', earned: 'Nov 3, 2026' }} lit />
          <BadgeCard badge={{ name: '30-day streak', icon: 'fire', pct: 60, progress: '18 of 30 days' }} />
          <BadgeCard badge={{ name: '50 workouts', icon: 'crown', pct: 44, progress: '22 of 50' }} />
        </div>
      </Card>
    </Shot>
  )
}

/* ---------------------------------------------------------------------------
 * Users (features/users.mdx)
 * ------------------------------------------------------------------------ */

/** A preference center for legacy emails and push: one switch per type */
function NotificationPreferences() {
  const types: [string, string][] = [
    ['Milestone completed', 'Celebrate when you complete a milestone'],
    ['Progress recaps', 'A weekly summary of your progress'],
    ['Inactivity reminders', "A nudge when you haven't been active for a while"],
    ['Streak reminders', 'A reminder before your streak ends'],
  ]
  return (
    <Shot width={560}>
      <Card>
        <Title end={<span className="dl-label">Stride</span>}>Notifications</Title>
        <Rows>
          {types.map(([t, d]) => (
            <div key={t} className="flex items-center gap-4 py-3">
              <div className="flex-1">
                <p className="text-sm font-medium">{t}</p>
                <p className="text-[13px] text-muted-foreground">{d}</p>
              </div>
              <WidgetFormToggle enabled />
            </div>
          ))}
        </Rows>
      </Card>
    </Shot>
  )
}

/** Key attribute and custom attribute rows */
function KeyValues({ rows }: { rows: [string, string][] }) {
  return (
    <div className="flex flex-col divide-y divide-foreground/10 rounded-xl border border-border bg-background-raised">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between gap-4 px-3.5 py-2">
          <span className="font-mono text-xs text-muted-foreground">{k}</span>
          <span className="font-mono text-xs">{v}</span>
        </div>
      ))}
    </div>
  )
}

function Connector() {
  return (
    <div className="flex items-center justify-center text-muted-foreground">
      <ArrowRightIcon size={20} aria-hidden />
    </div>
  )
}

/** A user, their key attributes and their custom attributes */
function CustomUserAttributes() {
  return (
    <Shot width={760}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Card className="gap-3">
          <Title end={<span className="dl-label">Key attributes</span>}>User</Title>
          <KeyValues
            rows={[
              ['id', 'user-8f3a2c'],
              ['name', 'Maya Chen'],
              ['email', 'maya@example.com'],
              ['tz', 'Europe/London'],
            ]}
          />
        </Card>
        <Connector />
        <Card className="gap-3">
          <Title end={<span className="dl-label">Custom</span>}>Attributes</Title>
          <KeyValues
            rows={[
              ['plan', 'pro'],
              ['city', 'London'],
              ['goal', 'marathon'],
            ]}
          />
        </Card>
      </div>
    </Shot>
  )
}

/* ---------------------------------------------------------------------------
 * Events (features/events.mdx)
 * ------------------------------------------------------------------------ */

/** One event's attributes, and points triggers that only count some events */
function CustomEventAttributes() {
  const triggers: [string, string, number][] = [
    ['Cycling workouts', 'equipment = bike', 15],
    ['Treadmill workouts', 'equipment = treadmill', 10],
  ]
  return (
    <Shot width={760}>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Card className="gap-3">
          <Title end={<span className="font-mono text-xs text-muted-foreground">+1</span>}>
            <span className="font-mono text-base">workouts</span>
          </Title>
          <KeyValues
            rows={[
              ['equipment', 'bike'],
              ['duration', '45'],
              ['intensity', 'high'],
            ]}
          />
        </Card>
        <Connector />
        <div className="flex flex-col gap-3">
          {triggers.map(([name, rule, n]) => (
            <Card key={name} className="gap-2 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm font-medium">
                  <LightningIcon size={16} className="text-primary" aria-hidden />
                  {name}
                </span>
                <XP n={n} />
              </div>
              <span className="self-start rounded-md bg-foreground/5 px-2 py-1 font-mono text-[11px] text-muted-foreground">
                {rule}
              </span>
            </Card>
          ))}
        </div>
      </div>
    </Shot>
  )
}

/* ---------------------------------------------------------------------------
 * Leaderboards (features/leaderboards.mdx)
 * ------------------------------------------------------------------------ */

function LeaderboardHero() {
  return (
    <Shot width={560}>
      <LeaderboardFeatureWidget />
    </Shot>
  )
}

/* ---------------------------------------------------------------------------
 * Registry: mock name → component (outputs.mjs says where each is saved)
 * ------------------------------------------------------------------------ */

export const MOCKS: Record<string, { component: () => ReactNode }> = {
  'points-triggers': { component: PointsTriggers },
  'points-awards': { component: PointsAwards },
  'user-points-summary': { component: UserPointsSummary },
  'points-summary': { component: PointsSummary },
  'user-milestones': { component: UserMilestones },
  'notification-preferences': { component: NotificationPreferences },
  'custom-user-attributes': { component: CustomUserAttributes },
  'custom-event-attributes': { component: CustomEventAttributes },
  'leaderboard-hero': { component: LeaderboardHero },
}
