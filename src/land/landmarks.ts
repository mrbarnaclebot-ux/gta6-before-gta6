import { heightAt } from '../city/terrain'
import { EAST_X, LANES } from './highway'
import { HILL_ROAD_Z } from './hillside'
import type { Land } from './plan'
import { closest, offset, type P3 } from './polyline'

/** Road surfaces sit this far above their centerline (see scenery/bridges.ts LIFT). */
const SURFACE = 0.05

/** Named spots outside the city for tests, the perf probe, and debugging: feet positions. */
export function outerLandmarks(land: Land): Record<string, P3> {
  const named = (name: string) => land.paths.find((p) => p.name === name)!
  const ground = (x: number, z: number): P3 => ({ x, y: heightAt(land, x, z), z })
  // On the verge of a residential street, between the curb and the front yards.
  const street = named('Street 2 South')
  const verge = offset(street.pts, -(street.width / 2 + 2))[24]
  const trail = named('forest trail')
  const t = trail.pts[Math.floor(trail.pts.length * 0.45)]
  // The outbound lane on top of the Hill Road flyover.
  const hw = named('highway')
  const lane = offset(hw.pts, LANES[1])
  const top = lane[closest(lane, { x: EAST_X, z: HILL_ROAD_Z }).i]
  return {
    residential: ground(verge.x, verge.z),
    hillside: ground(land.lookout.x + 30, land.lookout.z),
    forest: ground(t.x, t.z),
    flyover: { x: top.x, y: top.y + SURFACE, z: top.z },
  }
}
