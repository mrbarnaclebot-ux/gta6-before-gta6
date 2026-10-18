import { heightAt } from '../city/terrain'
import { seaNormal, seaward } from './coast'
import { EAST_X, LANES } from './highway'
import { HILL_ROAD_Z } from './hillside'
import { LAKE, lakeJetty } from './lake'
import type { Land } from './plan'
import { closest, offset, type P2, type P3 } from './polyline'

/** Road surfaces sit this far above their centerline (see scenery/bridges.ts LIFT). */
const SURFACE = 0.05

/** The coast line's point nearest p, moved `d` meters along the way to sea (negative: inland). */
function offCoast(land: Land, p: P2, d: number): P2 {
  const at = closest(land.frame.coast.line, p).at
  const n = seaNormal(land.frame.coast, at.x, at.z)
  return { x: at.x + n.x * d, z: at.z + n.z * d }
}

/** Named spots outside the city for tests, the perf probe, and debugging: feet positions. */
export function outerLandmarks(land: Land): Record<string, P3> {
  const named = (name: string) => land.paths.find((p) => p.name === name)!
  const ground = (p: P2): P3 => ({ x: p.x, y: heightAt(land, p.x, p.z), z: p.z })
  // On the verge of a residential street, between the curb and the front yards.
  const street = named('Street 2 South')
  const verge = offset(street.pts, -(street.width / 2 + 2))[24]
  const trail = named('forest trail')
  const t = trail.pts[Math.floor(trail.pts.length * 0.45)]
  // The outbound lane on top of the Hill Road flyover.
  const hw = named('highway')
  const lane = offset(hw.pts, LANES[1])
  const top = lane[closest(lane, { x: EAST_X, z: HILL_ROAD_Z }).i]
  // The river's east bank a little upstream of the beach, and Palm Avenue's deck over it.
  const river = land.waterways.river
  const mouth = river.pts.findIndex((p) => seaward(land.frame.coast, p.x, p.z) > -60)
  const bank = offset(river.pts, -(river.half[mouth] + 12))[mouth]
  const over = (q: P2) => closest(river.pts, q).d
  const span = named('Palm Avenue').pts.reduce((a, q) => (over(q) < over(a) ? q : a))
  const north = land.waterways.channels.quays[0]
  const dock = lakeJetty(LAKE).dock
  return {
    residential: ground(verge),
    hillside: ground({ x: land.lookout.x + 30, z: land.lookout.z }),
    forest: ground(t),
    flyover: { x: top.x, y: top.y + SURFACE, z: top.z },
    northCoast: ground(offCoast(land, { x: -1150, z: -1000 }, -18)),
    westBeach: ground(offCoast(land, { x: -1640, z: 150 }, 40)),
    riverMouth: ground(bank),
    riverBridge: { x: span.x, y: span.y + SURFACE, z: span.z },
    lake: { ...dock, y: dock.y + 0.02 },
    // Inland of where the west breakwater's rubble begins, 6 m in from the shore.
    canalMouth: ground({ x: north.x0 - 2.5, z: north.z0 + 12 }),
  }
}
