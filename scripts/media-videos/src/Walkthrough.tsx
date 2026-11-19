/**
 * A dashboard walkthrough, Screen Studio style, built from a capture's
 * manifest (capture.mjs): the frames in a browser window on the Daylight
 * afternoon sky, a camera that zooms the whole stage onto each group of
 * actions and back out, a cursor that reacts to what it's over, speed ramps
 * through dead time (timeline.mjs), motion blur, and a cross-fade back to the
 * opening frame so the docs' looping <video> has no visible seam.
 */
import { CameraMotionBlur } from '@remotion/motion-blur'
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

import { buildTimeline, HOLD, INTRO, LEAD, LOOP, MOVE } from './timeline.mjs'

export { INTRO, OUTRO } from './timeline.mjs'

export type Box = { x: number; y: number; w: number; h: number }
export type CaptureEvent =
  | { type: 'move' | 'click'; t: number; target: Box }
  | { type: 'type' | 'focus'; t: number; end: number; target: Box; text?: string }
export type Manifest = {
  name: string
  viewport: { width: number; height: number }
  url: string
  duration: number
  frames: { file: string; t: number }[]
  events: CaptureEvent[]
}

/* ---------------------------------------------------------------------------
 * Look
 * ------------------------------------------------------------------------ */

const OUT = { width: 1920, height: 1080 }
const TOOLBAR = 40
const SCREEN_W = 1472
const CURSOR = 32 // cursor size in page pixels (it zooms with the stage)
const CURSOR_OVERSHOOT = 0.012 // how far past a target the cursor drifts before settling (fraction of the move); 0 = none
const CURSOR_ARC = 0.05 // how much the path bows sideways (fraction of the distance)

const ZOOM = 1.5 // how far the camera zooms the stage in on a group of actions
const MIN_ZOOM = 1.3 // anything that would zoom less than this gets the full stage instead
const GROUP_GAP = 2.2 // actions this close (s) whose area still zooms past MIN_ZOOM share one framing
const PADDING = 20 // page pixels of breathing room around a framed group
const TRANS = 0.9 // every camera move takes exactly this long, eased in and out
const BLUR = { shutterAngle: 180, samples: 6 } // motion blur on camera moves and the cursor

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2)
const center = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })
const endOf = (e: CaptureEvent) => ('end' in e ? e.end : e.t)
const union = (a: Box, b: Box): Box => {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }
}
const sameBox = (a: Box, b: Box) => Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2 && Math.abs(a.w - b.w) < 2

/** Where the window and page sit on the 1920×1080 stage */
function layout(m: Manifest) {
  const { width: W, height: H } = m.viewport
  const base = SCREEN_W / W
  const screenH = H * base
  const winH = screenH + TOOLBAR
  const winLeft = (OUT.width - SCREEN_W) / 2
  const winTop = (OUT.height - winH) / 2
  return { base, screenH, winW: SCREEN_W, winH, winLeft, winTop, pageTop: winTop + TOOLBAR }
}

/** Work each video's timeline, framing and camera out once, not per frame */
const cache = new Map<string, ReturnType<typeof plan>>()
function planFor(m: Manifest) {
  const key = `${m.name}:${m.duration}:${m.events.length}`
  if (!cache.has(key)) cache.set(key, plan(m))
  return cache.get(key)!
}

/* ---------------------------------------------------------------------------
 * Camera: on the stage, in output time
 * ------------------------------------------------------------------------ */

type Camera = { z: number; x: number; y: number }
const OVERVIEW: Camera = { z: 1, x: OUT.width / 2, y: OUT.height / 2 }

function contain(c: Camera): Camera {
  const hw = OUT.width / 2 / c.z
  const hh = OUT.height / 2 / c.z
  return { z: c.z, x: clamp(c.x, hw, OUT.width - hw), y: clamp(c.y, hh, OUT.height - hh) }
}

/** Between two cameras: zoom eases on a log scale so in and out feel even */
function mix(a: Camera, b: Camera, p: number): Camera {
  const e = easeInOut(clamp(p, 0, 1))
  return { z: Math.exp(Math.log(a.z) + (Math.log(b.z) - Math.log(a.z)) * e), x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }
}
const sameCam = (a: Camera, b: Camera) => Math.abs(a.z - b.z) < 1e-3 && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5

function plan(m: Manifest) {
  const timeline = buildTimeline(m)
  const events = timeline.events as CaptureEvent[]
  const L = layout(m)

  /** How far the stage can zoom onto a page-space box */
  const zoomFor = (b: Box) => Math.min(ZOOM, (OUT.width * 0.92) / (b.w * L.base), (OUT.height * 0.8) / (b.h * L.base))

  // Group consecutive actions into framings: one zoom while a form is filled
  type Group = { start: number; end: number; box: Box }
  const groups: Group[] = []
  let lastMove: CaptureEvent | null = null
  for (const e of events) {
    if (e.type === 'move') {
      lastMove = e
      continue
    }
    // An action starts when the cursor sets off toward it, not when it clicks
    const begins = lastMove && sameBox(lastMove.target, e.target) ? lastMove.t : e.t
    const g = groups[groups.length - 1]
    if (g && begins - g.end <= GROUP_GAP && zoomFor(union(g.box, e.target)) >= MIN_ZOOM) {
      g.box = union(g.box, e.target)
      g.end = endOf(e)
    } else groups.push({ start: e.type === 'focus' ? e.t - 0.2 : e.t, end: endOf(e), box: { ...e.target } })
  }
  const framings = groups.map((g) => {
    const box = { x: g.box.x - PADDING, y: g.box.y - PADDING, w: g.box.w + 2 * PADDING, h: g.box.h + 2 * PADDING }
    const z = zoomFor(box)
    const c = center(box)
    return {
      from: g.start - LEAD - MOVE,
      to: g.end + HOLD,
      camera: z < MIN_ZOOM ? OVERVIEW : contain({ z, x: L.winLeft + c.x * L.base, y: L.pageTop + c.y * L.base }),
    }
  })
  const target = (t: number) => {
    const f = framings.filter((f) => t >= f.from && t <= f.to).pop()
    return f ? f.camera : OVERVIEW
  }

  // Each change of target starts a fresh TRANS-long eased move from wherever
  // the camera is, so every move finishes and an interrupted one blends on
  const moves: { start: number; from: Camera; to: Camera }[] = [{ start: -INTRO, from: OVERVIEW, to: OVERVIEW }]
  for (let t = -INTRO; t <= timeline.length; t += 1 / 120) {
    const last = moves[moves.length - 1]
    const want = target(t)
    if (!sameCam(want, last.to)) moves.push({ start: t, from: mix(last.from, last.to, (t - last.start) / TRANS), to: want })
  }
  const camera = (t: number) => {
    let i = moves.length - 1
    while (i > 0 && moves[i].start > t) i--
    return contain(mix(moves[i].from, moves[i].to, (t - moves[i].start) / TRANS))
  }

  return { timeline, events, layout: L, camera }
}

/* ---------------------------------------------------------------------------
 * Cursor: glides, settles, changes shape, hides while typing
 * ------------------------------------------------------------------------ */

type Shape = 'arrow' | 'pointer' | 'text'

function cursorAt(m: Manifest, events: CaptureEvent[], t: number) {
  const { width: W, height: H } = m.viewport
  let pos = { x: W * 0.72, y: H * 0.78 }
  let shape: Shape = 'arrow'
  let opacity = 1
  const moves = events.filter((e) => e.type === 'move')
  for (const [i, e] of moves.entries()) {
    if (t < e.t) break
    const to = center(e.target)
    const p = clamp((t - e.t) / MOVE, 0, 1)
    // Eased travel along a gentle arc, with a barely-there overshoot as it settles in
    const ease = easeInOut(p) + CURSOR_OVERSHOOT * Math.sin(Math.PI * clamp((p - 0.55) / 0.45, 0, 1))
    const dx = to.x - pos.x
    const dy = to.y - pos.y
    const len = Math.hypot(dx, dy) || 1
    const arc = Math.sin(Math.PI * p) * len * CURSOR_ARC
    pos = { x: pos.x + dx * ease - (dy / len) * arc, y: pos.y + dy * ease + (dx / len) * arc }
    // On arrival: an I-beam over a field it will type in, a hand over anything it clicks
    const next = moves[i + 1]?.t ?? Infinity
    const typesHere = events.some((x) => x.type === 'type' && x.t >= e.t && x.t < next && sameBox(x.target, e.target))
    const click = events.find((x) => x.type === 'click' && x.t >= e.t && x.t < next)
    shape = p < 0.85 ? 'arrow' : typesHere ? 'text' : 'pointer'
    // Back to the arrow shortly after clicking a button (whatever it was over may be gone)
    if (shape === 'pointer' && click && t > click.t + 0.45) shape = 'arrow'
  }
  // Hide while typing, until the next move
  for (const e of events) {
    if (e.type !== 'type') continue
    const next = moves.find((x) => x.t > e.t)?.t ?? Infinity
    if (t >= e.t + 0.1 && t < next) opacity = Math.min(opacity, 1 - clamp((t - e.t - 0.1) / 0.15, 0, 1))
    if (t >= next && t < next + 0.15) opacity = Math.min(opacity, (t - next) / 0.15)
  }
  return { ...pos, shape, opacity }
}

function Cursor({ x, y, shape, press, opacity }: { x: number; y: number; shape: Shape; press: number; opacity: number }) {
  const k = CURSOR / 24
  // Hotspots in the 24×24 box: the arrow's tip, the finger's tip, the I-beam's middle
  const hot = { arrow: [3, 2], pointer: [9.2, 2.6], text: [12, 12] }[shape]
  return (
    <svg
      width={CURSOR}
      height={CURSOR}
      viewBox="0 0 24 24"
      style={{
        position: 'absolute',
        left: x - hot[0] * k,
        top: y - hot[1] * k,
        opacity,
        transform: `scale(${1 - 0.18 * press})`,
        transformOrigin: `${hot[0] * k}px ${hot[1] * k}px`,
        filter: 'drop-shadow(0 1px 1.5px rgba(0,0,0,0.35))',
      }}
    >
      {shape === 'arrow' ? (
        <path d="M3 2 L3 19.5 L7.6 15.4 L10.6 22 L13.6 20.7 L10.7 14.2 L17 14.2 Z" fill="#16161d" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
      ) : shape === 'pointer' ? (
        <path
          d="M9.2 2.6c.9 0 1.6.7 1.6 1.6V10l.2-.2c.5-.5 1.4-.6 2-.1.3.3.5.7.5 1.1.5-.5 1.4-.6 2-.1.3.3.5.7.5 1.1.5-.4 1.3-.4 1.8.1.3.3.5.8.5 1.2v4.4c0 2.7-2.2 4.9-4.9 4.9h-1.3c-1.7 0-3.2-.9-4.1-2.3l-3.2-5c-.5-.7-.3-1.7.4-2.2.6-.4 1.5-.3 2 .3l.9 1.1V4.2c0-.9.7-1.6 1.6-1.6z"
          fill="#fff"
          stroke="#16161d"
          strokeWidth={1.3}
          strokeLinejoin="round"
        />
      ) : (
        <g fill="none" strokeLinecap="round">
          <path d="M9 4h1.5c.8 0 1.5.6 1.5.6s.7-.6 1.5-.6H15M12 4.6v14.8M9 20h1.5c.8 0 1.5-.6 1.5-.6s.7.6 1.5.6H15" stroke="#fff" strokeWidth={3.4} />
          <path d="M9 4h1.5c.8 0 1.5.6 1.5.6s.7-.6 1.5-.6H15M12 4.6v14.8M9 20h1.5c.8 0 1.5-.6 1.5-.6s.7.6 1.5.6H15" stroke="#16161d" strokeWidth={1.5} />
        </g>
      )}
    </svg>
  )
}

function Ripple({ x, y, p }: { x: number; y: number; p: number }) {
  const r = (CURSOR / 22) * (6 + 22 * p)
  return (
    <div
      style={{
        position: 'absolute',
        left: x - r,
        top: y - r,
        width: r * 2,
        height: r * 2,
        borderRadius: '50%',
        background: 'rgba(92, 105, 20, 0.28)',
        border: '2px solid rgba(92, 105, 20, 0.55)',
        opacity: 1 - p,
      }}
    />
  )
}

/* ---------------------------------------------------------------------------
 * Window chrome
 * ------------------------------------------------------------------------ */

function Toolbar({ url }: { url: string }) {
  return (
    <div style={{ height: TOOLBAR, background: '#ecebe6', borderBottom: '1px solid #e1ded7', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, position: 'relative' }}>
      {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
        <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />
      ))}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          height: 24,
          padding: '0 14px',
          borderRadius: 8,
          background: '#f6f5f1',
          border: '1px solid #e1ded7',
          display: 'flex',
          alignItems: 'center',
          fontFamily: '"Funnel Sans", system-ui, sans-serif',
          fontSize: 13,
          color: '#4a4954',
        }}
      >
        {url}
      </div>
    </div>
  )
}

/** The latest captured frame at or before capture time c */
function frameAt(m: Manifest, c: number) {
  let lo = 0
  let hi = m.frames.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (m.frames[mid].t <= c) lo = mid
    else hi = mid - 1
  }
  return m.frames[lo]
}

/* ---------------------------------------------------------------------------
 * The stage at an output time (seconds after the intro; negative during it)
 * ------------------------------------------------------------------------ */

function Stage({ m, t }: { m: Manifest; t: number }) {
  const { timeline, events, layout: L, camera } = planFor(m)
  const { width: W, height: H } = m.viewport
  const cam = camera(t)
  const at = Math.max(0, t)
  const cursor = cursorAt(m, events, at)
  const shot = frameAt(m, timeline.toCapture(at))
  const clicks = events.filter((e) => e.type === 'click')
  const ripples = clicks.filter((c) => at >= c.t && at - c.t < 0.45)
  const press = clicks.reduce((acc, c) => {
    const d = at - c.t
    if (d < -0.08 || d > 0.2) return acc
    return Math.max(acc, d < 0 ? 1 + d / 0.08 : 1 - d / 0.2)
  }, 0)
  return (
    <AbsoluteFill style={{ background: '#cfd2a0' }}>
      {/* Background, window and page zoom together */}
      <div
        style={{
          position: 'absolute',
          width: OUT.width,
          height: OUT.height,
          transformOrigin: '0 0',
          transform: `translate(${OUT.width / 2}px, ${OUT.height / 2}px) scale(${cam.z}) translate(${-cam.x}px, ${-cam.y}px)`,
          background:
            'radial-gradient(120% 90% at 20% 0%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 55%), linear-gradient(160deg, #e8d9a1 0%, #cfd2a0 50%, #b6c79b 100%)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: L.winLeft,
            top: L.winTop,
            width: L.winW,
            height: L.winH,
            borderRadius: 16,
            overflow: 'hidden',
            background: '#f6f5f1',
            boxShadow: '0 1px 2px rgba(42,36,51,0.08), 0 24px 60px -12px rgba(42,36,51,0.35)',
            border: '1px solid rgba(22,22,29,0.08)',
          }}
        >
          <Toolbar url={m.url} />
          <div style={{ position: 'relative', width: L.winW, height: L.screenH, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', width: W, height: H, transformOrigin: '0 0', transform: `scale(${L.base})` }}>
              <Img src={staticFile(`captures/${m.name}/${shot.file}`)} style={{ width: W, height: H, display: 'block' }} />
              {ripples.map((c) => (
                <Ripple key={c.t} x={cursor.x} y={cursor.y} p={(at - c.t) / 0.45} />
              ))}
              <Cursor x={cursor.x} y={cursor.y} shape={cursor.shape} press={press} opacity={cursor.opacity} />
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}

/** The scene at the current frame, with the closing cross-fade to the opening frame */
function Scene({ m }: { m: Manifest }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const T = frame / fps
  const { timeline } = planFor(m)
  const fade = clamp((T - (timeline.length - LOOP)) / LOOP, 0, 1)
  return (
    <AbsoluteFill>
      <Stage m={m} t={T - INTRO} />
      {fade > 0 ? (
        <AbsoluteFill style={{ opacity: easeInOut(fade) }}>
          <Stage m={m} t={-INTRO} />
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  )
}

export function Walkthrough({ manifest }: { manifest: Manifest }) {
  return (
    <CameraMotionBlur shutterAngle={BLUR.shutterAngle} samples={BLUR.samples}>
      <Scene m={manifest} />
    </CameraMotionBlur>
  )
}
