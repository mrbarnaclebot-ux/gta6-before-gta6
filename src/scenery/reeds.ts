import * as THREE from 'three'
import { SEA_LEVEL, type Grounded } from '../city/layout'
import { range, rng } from '../city/rng'
import { heightAt } from '../city/terrain'
import { seaward } from '../land/coast'
import { stand } from '../land/footing'
import { LAKE, lakeShore } from '../land/lake'
import { fbm, smoothstep } from '../land/noise'
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

type Rand = () => number

/** A reed clump at (x, z): its height, a lean with the wind, and a tint from green to straw. */
function reed(land: Land, x: number, z: number, r: Rand): Grounded {
  const s = range(r, 1.1, 2.7)
  const ground = (a: number, b: number) => heightAt(land, a, b)
  const lean = range(r, 0, 0.12)
  const a = r() * Math.PI * 2
  const up: [number, number, number] = [Math.cos(a) * lean, 1, Math.sin(a) * lean]
  const v = r()
  const tint = (Math.round(205 + 50 * v) << 16) | (Math.round(225 + 30 * v) << 8) | 205
  return { x, z, y: stand(ground, x, z, CLUMP_FOOT * s, 0.1), s, r: r() * Math.PI * 2, up, tint }
}

/**
 * Reed beds in patches along both river banks: where the patch noise is high, clumps are
 * scattered across the band from the shallows to the mud, thick in the middle of a bed and
 * thinning at its ends; elsewhere the bank is open.
 */
function riverReeds(land: Land, r: Rand): Grounded[] {
  const river = land.waterways.river
  const out: Grounded[] = []
  for (const side of [-1, 1]) {
    for (let i = 1; i + 1 < river.pts.length; i++) {
      const bed = fbm(river.pts[i].x / 42, river.pts[i].z / 42, 71 + side, 3)
      if (bed < -0.05 || r() < 0.2) continue
      const [a, b] = [river.pts[i - 1], river.pts[i + 1]]
      const len = Math.hypot(b.x - a.x, b.z - a.z)
      const [tx, tz] = [(b.x - a.x) / len, (b.z - a.z) / len]
      const thick = smoothstep(-0.05, 0.4, bed)
      const n = 1 + Math.floor(5 * thick * r())
      for (let k = 0; k < n; k++) {
        // Out into the water as far as the bed is thick, and back up the mud.
        const d = (river.half[i] + range(r, -3 * thick - 0.5, 5)) * side
        const along = range(r, -2, 2)
        const x = river.pts[i].x - tz * d + tx * along
        out.push(reed(land, x, river.pts[i].z + tx * d + tz * along, r))
      }
    }
  }
  // Only where the water is shallow enough to root, and upriver of the beach.
  return out.filter((s) => s.y > SEA_LEVEL - 0.6 && seaward(land.frame.coast, s.x, s.z) < -10)
}

/** Patches of reeds round the lake: in the shallows and on the bank, with open shore between. */
function lakeReeds(land: Land, r: Rand): Grounded[] {
  const out: Grounded[] = []
  for (const p of lakeShore(LAKE, STEP)) {
    if (fbm(p.x / 30, p.z / 30, 73, 2) < 0 || r() < 0.3) continue
    for (let k = 0, n = 1 + Math.floor(r() * 3); k < n; k++) {
      const f = range(r, 0.9, 1.04)
      out.push(reed(land, LAKE.x + (p.x - LAKE.x) * f, LAKE.z + (p.z - LAKE.z) * f, r))
    }
  }
  return out
}

/** The river's reed beds and the lake's. */
export function reedSpots(land: Land): Grounded[] {
  const r = rng(29)
  return [...riverReeds(land, r), ...lakeReeds(land, r)]
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
  const spots = reedSpots(land)
  // Two builds of clump, so the beds are not one shape repeated: a few tall stems, and a thick tussock.
  const tall = spots.filter((_, k) => k % 3 === 0)
  const thick = spots.filter((_, k) => k % 3 !== 0)
  const kinds = [
    instanceByDistance(ctx, [[{ geometry: clump(2, 0.7, 1.15), material }], []], tall, place),
    instanceByDistance(ctx, [[{ geometry: clump(4, 1.5, 0.85), material }], []], thick, place),
  ]
  return (eye, reach) => kinds.forEach((update) => update(eye, reach))
}
