import { range, type Rand } from '../city/rng'
import { heightAt } from '../city/terrain'
import { stand } from './footing'
import { gridRect } from './grid'
import type { Land } from './plan'
import { coastX } from './shape'

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

/** Where everything goes: towers at a steady spacing, umbrella clusters between them. */
export function beachProps(land: Land, r: Rand): BeachProp[] {
  const g = gridRect(land.ground)
  const out: BeachProp[] = []
  const on = (x: number, z: number, kind: BeachProp['kind']) =>
    stand((a, b) => heightAt(land, a, b), x, z, PROP_RADIUS[kind])
  for (let z = g.z0 + 110; z < g.z1 - 60; z += TOWER_GAP) {
    const tx = coastX(land.frame, z) + TOWER_D
    out.push({
      x: tx,
      y: on(tx, z, 'tower'),
      z,
      kind: 'tower',
      tint: out.length,
      yaw: Math.PI / 2,
    })
    for (let c = z + 30; c < z + TOWER_GAP - 30; c += range(r, 35, 60)) {
      const n = 2 + Math.floor(r() * 3)
      const d = range(r, 38, 50)
      for (let k = 0; k < n; k++) {
        const zz = c + k * 5.5
        const x = coastX(land.frame, zz) + d + range(r, -1, 1)
        out.push({
          x,
          y: on(x, zz, 'umbrella'),
          z: zz,
          kind: 'umbrella',
          tint: Math.floor(r() * 99),
          yaw: Math.PI / 2 + range(r, -0.3, 0.3),
        })
      }
    }
  }
  return out
}
