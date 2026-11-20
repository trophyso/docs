/**
 * The video's timeline, shared by the composition, Root (length) and make.mjs
 * (review stills). Plain JS so Node can import it.
 *
 * "Capture time" is the recording's clock. "Output time" is the video's,
 * after dead stretches (spinners, page loads, pauses between actions) are
 * sped up. Animations (camera, cursor) run on output time so they always move
 * at the same speed; capture time is only used to pick which frame to show.
 */

export const INTRO = 0.8 // seconds on the first frame, zoomed out, before anything moves
export const OUTRO = 3.4 // after the last action: hold (1.1) + zoom out (0.9) + a beat on the full view
export const LOOP = 0.5 // final cross-fade back to the opening frame, for a seamless loop

// When the camera and cursor act around an action (also used by the composition)
export const LEAD = 0.6 // start moving in this long before an action
export const MOVE = 0.55 // cursor travel time
export const HOLD = 1.1 // stay on an action this long after it

// Speed ramps
const SPEEDUP = 3 // dead stretches play this many times faster
const EDGE = 0.3 // real-time margin kept at each end of a sped-up stretch
const MIN_DEAD = 0.9 // only stretches longer than this (before edges) are sped up

const endOf = (e) => e.end ?? e.t

/** When something is happening, in capture time: around each action */
function busyWindows(events) {
  const windows = events.map((e) =>
    e.type === 'move'
      ? [e.t - LEAD - 0.2, e.t + MOVE + 0.2]
      : [e.t - LEAD - MOVE - 0.2, endOf(e) + 0.7],
  )
  windows.sort((a, b) => a[0] - b[0])
  const merged = []
  for (const w of windows) {
    const last = merged[merged.length - 1]
    if (last && w[0] <= last[1]) last[1] = Math.max(last[1], w[1])
    else merged.push([...w])
  }
  return merged
}

/**
 * Piecewise-linear capture → output mapping. Each segment covers
 * [c0, c1] of capture time at a speed (1 = real time).
 */
function segments(manifest) {
  const busy = busyWindows(manifest.events)
  const end = Math.max(manifest.duration, ...manifest.events.map(endOf))
  const segs = []
  let cursor = 0
  const addGap = (a, b) => {
    if (b <= a) return
    if (b - a > MIN_DEAD + 2 * EDGE) {
      segs.push([a, a + EDGE, 1], [a + EDGE, b - EDGE, SPEEDUP], [b - EDGE, b, 1])
    } else segs.push([a, b, 1])
  }
  for (const [a, b] of busy) {
    const start = Math.max(a, cursor)
    if (start > cursor) addGap(cursor, start)
    if (b > start) segs.push([start, b, 1])
    cursor = Math.max(cursor, b)
  }
  addGap(cursor, end)
  return segs
}

export function buildTimeline(manifest) {
  const segs = segments(manifest)
  const outStart = []
  let acc = 0
  for (const [a, b, speed] of segs) {
    outStart.push(acc)
    acc += (b - a) / speed
  }
  const captureEnd = segs.length ? segs[segs.length - 1][1] : 0

  /** Capture seconds → output seconds (from the end of the intro) */
  const toOut = (c) => {
    if (c <= 0) return c
    for (let i = 0; i < segs.length; i++) {
      const [a, b, speed] = segs[i]
      if (c <= b) return outStart[i] + (c - a) / speed
    }
    return acc + (c - captureEnd)
  }
  /** Output seconds (from the end of the intro) → capture seconds */
  const toCapture = (o) => {
    if (o <= 0) return o
    for (let i = 0; i < segs.length; i++) {
      const [a, b, speed] = segs[i]
      const o1 = outStart[i] + (b - a) / speed
      if (o <= o1) return a + (o - outStart[i]) * speed
    }
    return captureEnd + (o - acc)
  }

  const events = manifest.events.map((e) => ({
    ...e,
    t: toOut(e.t),
    ...(e.end !== undefined ? { end: toOut(e.end) } : {}),
  }))
  const lastAction = Math.max(...events.map(endOf))
  return {
    toOut,
    toCapture,
    /** The actions, in output time */
    events,
    lastAction,
    /** Total video length in seconds */
    length: INTRO + lastAction + OUTRO + LOOP,
  }
}
