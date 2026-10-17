import * as THREE from 'three'
import { SEA_LEVEL, type Grounded } from '../city/layout'
import { range, rng } from '../city/rng'
import { heightAt } from '../city/terrain'
import { seaward } from '../land/coast'
import { stand } from '../land/footing'
import { LAKE, lakeShore } from '../land/lake'
import { fbm } from '../land/noise'
import type { Land } from '../land/plan'
import { keepCardNormals } from '../render/card-normals'
import type { WorldCtx } from '../world/blocks'
import { instanceByDistance } from '../world/lod-instances'
import { clump, CLUMP_FOOT } from './dune-grass'

/*
 * Reed beds along the river's banks and round the lake's shore: tall crossed cards of
 * straight stems with dark seed heads, standing in the shallows and on the mud.
 */

const RANGE = 90
const STEP = 1.7

/** Reed stems on a canvas: green-grey at the foot, straw above, a brown head on some. */
function reedTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 256
  const g = c.getContext('2d')!
  const r = rng(9)
  g.lineCap = 'round'
  for (let i = 0; i < 38; i++) {
    const x = 14 + r() * 100
    const lean = (r() - 0.5) * 22
    const top = 6 + r() * 70
    const grad = g.createLinearGradient(0, 256, 0, top)
    grad.addColorStop(0, `hsl(${85 + r() * 15}, 28%, ${26 + r() * 8}%)`)
    grad.addColorStop(1, `hsl(${50 + r() * 12}, 30%, ${36 + r() * 9}%)`)
    g.strokeStyle = grad
    g.lineWidth = 1.6 + r() * 1.6
    g.beginPath()
    g.moveTo(x, 256)
    g.lineTo(x + lean, top)
    g.stroke()
    if (r() < 0.45) {
      g.fillStyle = `hsl(${25 + r() * 10}, 40%, ${20 + r() * 8}%)`
      g.fillRect(x + lean - 2.5, top, 5, 22 + r() * 10)
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Spots along a line of points: a clump every few meters where the bed is not broken. */
function along(land: Land, pts: { x: number; z: number }[], out: Grounded[], r: () => number) {
  const ground = (x: number, z: number) => heightAt(land, x, z)
  for (const p of pts) {
    if (fbm(p.x / 24, p.z / 24, 71, 2) < -0.3 || r() < 0.12) continue
    const x = p.x + range(r, -1.2, 1.2)
    const z = p.z + range(r, -1.2, 1.2)
    const s = range(r, 1.5, 2.4)
    out.push({ x, z, y: stand(ground, x, z, CLUMP_FOOT * s, 0.1), s, r: r() * Math.PI * 2 })
  }
}

/** Both banks of the river at the waterline, and the lake's shore. */
export function reedSpots(land: Land): Grounded[] {
  const r = rng(29)
  const out: Grounded[] = []
  const river = land.waterways.river
  for (const side of [-1, 1]) {
    const bank: { x: number; z: number }[] = []
    for (let i = 1; i + 1 < river.pts.length; i++) {
      const [a, b] = [river.pts[i - 1], river.pts[i + 1]]
      const len = Math.hypot(b.x - a.x, b.z - a.z)
      for (const d of [river.half[i] - 1.5, river.half[i] + 1]) {
        const p = river.pts[i]
        bank.push({
          x: p.x - ((b.z - a.z) / len) * d * side,
          z: p.z + ((b.x - a.x) / len) * d * side,
        })
      }
    }
    along(land, bank, out, r)
  }
  // Only where the water is shallow enough to root, and upriver of the beach.
  const kept = out.filter((s) => s.y > SEA_LEVEL - 0.6 && seaward(land.frame.coast, s.x, s.z) < -10)
  const lake: Grounded[] = []
  along(
    land,
    lakeShore(LAKE, STEP).flatMap((p) => [
      p,
      { x: LAKE.x + (p.x - LAKE.x) * 0.96, z: LAKE.z + (p.z - LAKE.z) * 0.96 },
    ]),
    lake,
    r,
  )
  return [...kept, ...lake]
}

/** The reed beds, drawn near the camera only (no shadows, not in the sea's mirror). */
export function plantReeds(
  ctx: WorldCtx,
  land: Land,
): (eye: THREE.Vector3, reach?: number) => void {
  const material = keepCardNormals(
    new THREE.MeshStandardMaterial({
      map: reedTexture(),
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.9,
    }),
  )
  const place = { scale: (s: Grounded) => s.s, ranges: [RANGE], detail: true }
  return instanceByDistance(ctx, [[{ geometry: clump(), material }], []], reedSpots(land), place)
}
