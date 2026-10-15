import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { heightAt } from '../city/terrain'
import { rng, range } from '../city/rng'
import type { Spot } from '../city/layout'
import { gridRect } from '../land/grid'
import { fbm } from '../land/noise'
import type { Land } from '../land/plan'
import { beachHeight, coastX } from '../land/shape'
import type { WorldCtx } from '../world/blocks'
import { instanceByDistance } from '../world/lod-instances'

// Clumps are small: past this they are a few pixels and are not drawn at all.
const RANGE = 120
const STEP = 2.6

/** Sea-oat blades painted on a canvas: pale green stems with straw-colored tips. */
function bladeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 256
  const g = c.getContext('2d')!
  const r = rng(5)
  g.lineCap = 'round'
  for (let i = 0; i < 46; i++) {
    const x = 20 + r() * 88
    const lean = (r() - 0.5) * 70
    const top = 30 + r() * 110
    const grad = g.createLinearGradient(0, 256, 0, top)
    grad.addColorStop(0, `hsl(${80 + r() * 20}, 30%, ${30 + r() * 10}%)`)
    grad.addColorStop(1, `hsl(${50 + r() * 12}, 38%, ${44 + r() * 10}%)`)
    g.strokeStyle = grad
    g.lineWidth = 2 + r() * 2
    g.beginPath()
    g.moveTo(x, 256)
    g.quadraticCurveTo(x + lean * 0.3, (256 + top) / 2, x + lean, top)
    g.stroke()
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Three crossed cards, 1 m tall, normals leaning up so the clump lights like a tuft. */
function clump(): THREE.BufferGeometry {
  const cards = [0, 1, 2].map((k) => {
    const q = new THREE.PlaneGeometry(1.1, 1).translate(0, 0.5, 0).rotateY((k * Math.PI) / 3)
    const n = q.attributes.normal as THREE.BufferAttribute
    for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.4, 0.9, n.getZ(i) * 0.4)
    return q
  })
  return mergeGeometries(cards)
}

/** Spots on the dune crests, where the dunes stand proud of the plain beach slope. */
function spots(land: Land): Spot[] {
  const g = gridRect(land.ground)
  const r = rng(13)
  const out: Spot[] = []
  for (let z = g.z0 + 20; z < g.z1 - 20; z += STEP) {
    const coast = coastX(land.frame, z)
    for (let d = 6; d < 44; d += STEP) {
      const dune = beachHeight(d, z) - plainBeach(d)
      if (dune < 0.3 || fbm(z / 18, d / 9, 61, 2) < -0.1 || r() < 0.3) continue
      out.push({
        x: coast + d + range(r, -1, 1),
        z: z + range(r, -1, 1),
        s: range(r, 0.55, 1.1),
        r: r() * Math.PI * 2,
      })
    }
  }
  return out
}

/** The beach's slope without its dunes, for telling where a dune stands. */
const plainBeach = (d: number) => 0.05 - (0.75 * d) / 50

/** Dune grass on the crests, drawn near the camera only (no shadows, not in the water's mirror). */
export function plantDuneGrass(
  ctx: WorldCtx,
  land: Land,
): (eye: THREE.Vector3, reach?: number) => void {
  const material = new THREE.MeshStandardMaterial({
    map: bladeTexture(),
    alphaTest: 0.45,
    side: THREE.DoubleSide,
    roughness: 0.9,
  })
  const place = {
    scale: (s: Spot) => s.s,
    ground: (s: Spot) => heightAt(land, s.x, s.z),
    ranges: [RANGE],
    detail: true,
  }
  return instanceByDistance(ctx, [[{ geometry: clump(), material }], []], spots(land), place)
}
