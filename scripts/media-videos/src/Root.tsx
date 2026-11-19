import { Composition, staticFile } from 'remotion'

import { buildTimeline } from './timeline.mjs'
import { type Manifest, Walkthrough } from './Walkthrough'

const FPS = 60

type Props = { name: string; manifest?: Manifest }

/**
 * One composition for every flow: pass the flow's name as a prop and its
 * capture (public/captures/<name>/manifest.json) sets the length.
 *   npx remotion studio src/index.ts  → pick "walkthrough", set props { "name": "..." }
 */
export function Root() {
  return (
    <Composition
      id="walkthrough"
      component={Walkthrough as unknown as React.FC<Props>}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={FPS}
      defaultProps={{ name: 'create-new-metric' } as Props}
      calculateMetadata={async ({ props }) => {
        const res = await fetch(staticFile(`captures/${props.name}/manifest.json`))
        const manifest = (await res.json()) as Manifest
        // The length comes from the actions after speed ramps, not the
        // capture: dead time is compressed and the final zoom out and loop
        // cross-fade always get their full time
        return { durationInFrames: Math.ceil(buildTimeline(manifest).length * FPS), props: { ...props, manifest } }
      }}
    />
  )
}
