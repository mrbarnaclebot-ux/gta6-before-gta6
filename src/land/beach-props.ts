import { range, type Rand } from '../city/rng'
import { heightAt } from '../city/terrain'
import { stand } from './footing'
import { inMarina, planMarina } from './marina-plan'
import type { Land } from './plan'
import { shoreline, type Shore } from './coast'
import { wildness } from './shape'

const TOWER_GAP = 160
const TOWER_D = 34
/** Footprint radius: a tower's stilts stand 1.3 m off center each way; loungers reach about 2 m. */
export const PROP_RADIUS = { tower: 1.85, umbrella: 2 }

export type BeachProp = {
  x: number
  y: number
  z: number
  kind: 'tower' | 'umbrella'
  tint: number
  yaw: number
}

export type { Shore } from './coast'

/** Points every `gap` meters along the coast line where the shore is sandy. */
export function sandyShore(land: Land, gap: number): Shore[] {
  let next = 0
  return shoreline(land.frame.coast).filter((p) => {
    if (p.s < next || p.sand < 0.9) return false
    next = p.s + gap
    return true
  })
}

/** Where everything goes: towers along every beach, umbrella clusters between them near town. */
export function beachProps(land: Land, r: Rand): BeachProp[] {
  const out: BeachProp[] = []
  const on = (x: number, z: number, kind: BeachProp['kind']) =>
    stand((a, b) => heightAt(land, a, b), x, z, PROP_RADIUS[kind])
  // Facing the sea: yaw pi/2 faces +x.
  const facing = (s: Shore) => Math.atan2(s.nx, s.nz)
  const shore = sandyShore(land, TOWER_GAP / 4)
  shore.forEach((s, k) => {
    if (k % 4 === 0) {
      const x = s.x + s.nx * TOWER_D
      const z = s.z + s.nz * TOWER_D
      out.push({ x, y: on(x, z, 'tower'), z, kind: 'tower', tint: out.length, yaw: facing(s) })
      return
    }
    if (wildness(land.frame, s.x, s.z) > 0.5 || r() < 0.35) return
    const d = range(r, 38, 48)
    const n = 2 + Math.floor(r() * 3)
    for (let i = 0; i < n; i++) {
      // Along the shore: the sea's normal turned a quarter.
      const x = s.x + s.nx * (d + range(r, -1, 1)) - s.nz * i * 5.5
      const z = s.z + s.nz * (d + range(r, -1, 1)) + s.nx * i * 5.5
      const yaw = facing(s) + range(r, -0.3, 0.3)
      out.push({ x, y: on(x, z, 'umbrella'), z, kind: 'umbrella', tint: Math.floor(r() * 99), yaw })
    }
  })
  const { zone } = planMarina(land)
  return out.filter((p) => !inMarina(zone, p.x, p.z))
}
