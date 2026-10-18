import type { CityLayout, Rect } from '../city/layout'
import { planChannels, type Channels } from './channels'
import type { CoastField } from './coast'
import { CELL, type HeightGrid } from './grid'
import { carveLake, LAKE } from './lake'
import { carveRiver, planRiver, type River } from './river'

/*
 * Every waterway cut into the ground after the roads: the canal's channels and breakwaters,
 * the river and its valley, and the lake's basin. Roads keep the heights they were laid at,
 * so where one crosses a waterway it stands on a bridge.
 */

export const CANAL_FLOOR = -4
/** Breakwater crest height, and how steeply its rubble sides fall (rise over run). */
const MOLE = { top: 1.2, slope: 1.3 }

export interface Waterways {
  river: River
  channels: Channels
}

export function planWaterways(c: CityLayout, coast: CoastField): Waterways {
  return { river: planRiver(), channels: planChannels(c, coast) }
}

/** Calls `f` with each grid vertex within `pad` of the rect and its distance outside it. */
function around(g: HeightGrid, r: Rect, pad: number, f: (k: number, out: number) => void) {
  const i0 = Math.max(0, Math.floor((r.x0 - pad - g.x0) / CELL))
  const i1 = Math.min(g.nx, Math.ceil((r.x1 + pad - g.x0) / CELL))
  const j0 = Math.max(0, Math.floor((r.z0 - pad - g.z0) / CELL))
  const j1 = Math.min(g.nz, Math.ceil((r.z1 + pad - g.z0) / CELL))
  for (let i = i0; i <= i1; i++) {
    for (let j = j0; j <= j1; j++) {
      const x = g.x0 + i * CELL
      const z = g.z0 + j * CELL
      const out = Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1))
      if (out <= pad) f(i * (g.nz + 1) + j, out)
    }
  }
}

/** Cuts the waterways into the stamped ground. */
export function carveWaterways(g: HeightGrid, w: Waterways): void {
  const { quays, moles, dredged } = w.channels
  for (const m of moles) {
    around(g, m, 12, (k, out) => {
      g.h[k] = Math.max(g.h[k], MOLE.top - out * MOLE.slope)
    })
  }
  // The quay walls (scenery/quays.ts) are a cell wide, covering the slope up from the floor.
  for (const q of quays) around(g, q, 0, (k) => (g.h[k] = CANAL_FLOOR))
  for (const d of dredged) around(g, d, 0, (k) => (g.h[k] = Math.min(g.h[k], CANAL_FLOOR)))
  carveRiver(g, w.river)
  carveLake(g, LAKE)
}
