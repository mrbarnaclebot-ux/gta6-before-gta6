import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { heightAt } from '../city/terrain'
import { rng, range } from '../city/rng'
import type { Grounded } from '../city/layout'
import { stand } from '../land/footing'
import { gridRect } from '../land/grid'
import { fbm } from '../land/noise'
import type { Land } from '../land/plan'
import { sandAt, seaward } from '../land/coast'
import { duneHeight, wildness } from '../land/shape'
import { keepCardNormals } from '../render/card-normals'
import type { WorldCtx } from '../world/blocks'
import { instanceByDistance } from '../world/lod-instances'

// Alpha-tested cards are costly overdraw at 4K (a third of the High beach frame at 120 m
// and this density): drawn to 75 m, a clump every 3.2 m at most, with gaps.
const RANGE = 75
const STEP = 3.2
/** A clump's base radius per meter of height. */
export const CLUMP_FOOT = 0.2

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

/** Spots on the dune crests of every sandy shore, where the dunes stand proud of the plain beach slope. */
export function duneGrassSpots(land: Land): Grounded[] {
  const g = gridRect(land.ground)
  const r = rng(13)
  const sand = (x: number, z: number) => heightAt(land, x, z)
  const { coast } = land.frame
  const out: Grounded[] = []
  for (let z = g.z0 + 20; z < g.z1 - 20; z += STEP) {
    for (let x = g.x0 + 20; x < g.x1 - 20; x += STEP) {
      const d = seaward(coast, x, z)
      if (d < 4 || d > 36 || sandAt(coast, x, z) < 0.7) continue
      const dune = duneHeight(d, x, z, wildness(land.frame, x, z))
      if (dune < 0.3 || fbm(x / 18, z / 18, 61, 2) < -0.1 || r() < 0.4) continue
      const px = x + range(r, -1, 1)
      const pz = z + range(r, -1, 1)
      const s = range(r, 0.55, 1.1)
      out.push({ x: px, y: stand(sand, px, pz, CLUMP_FOOT * s), z: pz, s, r: r() * Math.PI * 2 })
    }
  }
  return out
}

/** Dune grass on the crests, drawn near the camera only (no shadows, not in the water's mirror). */
export function plantDuneGrass(
  ctx: WorldCtx,
  land: Land,
): (eye: THREE.Vector3, reach?: number) => void {
  const material = keepCardNormals(
    new THREE.MeshStandardMaterial({
      map: bladeTexture(),
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      roughness: 0.9,
    }),
  )
  const place = { scale: (s: Grounded) => s.s, ranges: [RANGE], detail: true }
  const parts = [[{ geometry: clump(), material }], []]
  return instanceByDistance(ctx, parts, duneGrassSpots(land), place)
}
