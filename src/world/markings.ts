import * as THREE from 'three'
import { humpRise, humpSpan } from '../city/canal-bridge'
import { ROAD_HALF, type CityLayout, type Rect, type Road } from '../city/layout'
import { wornPaint } from '../render/road-wear'
import type { WorldCtx } from './blocks'

const WHITE = new THREE.Color(0xe8e6df)
const YELLOW = new THREE.Color(0xd9a520)
const LANE = 3.6
const EDGE = ROAD_HALF - 0.6
const CROSSWALK = 4

/** Road-local rect: u along the road, v across it (offset from the centerline). */
type Quad = [u0: number, u1: number, v0: number, v1: number, color: THREE.Color]

function dashes(a: number, b: number, v: number, out: Quad[]) {
  for (let u = a + 1.5; u + 3 <= b; u += 9) out.push([u, u + 3, v - 0.07, v + 0.07, WHITE])
}

/** Paint for one stretch of road between two intersections, right-hand traffic. */
function segment(a: number, b: number, axis: Road['axis']): Quad[] {
  const out: Quad[] = []
  const s = a + CROSSWALK + 1
  const e = b - CROSSWALK - 1
  out.push([s, e, -0.22, -0.1, YELLOW], [s, e, 0.1, 0.22, YELLOW])
  out.push([s, e, -EDGE - 0.08, -EDGE + 0.08, WHITE], [s, e, EDGE - 0.08, EDGE + 0.08, WHITE])
  for (const v of [-LANE, LANE]) dashes(s, e, v, out)
  for (let v = -EDGE + 0.4; v < EDGE - 0.3; v += 1.2) {
    out.push(
      [a + 0.6, a + CROSSWALK, v, v + 0.6, WHITE],
      [b - CROSSWALK, b - 0.6, v, v + 0.6, WHITE],
    )
  }
  // Stop lines cover only the lanes arriving at each end.
  const startIn = axis === 'x' ? -1 : 1
  out.push([s - 0.5, s, Math.min(0, startIn * EDGE), Math.max(0, startIn * EDGE), WHITE])
  out.push([e, e + 0.5, Math.min(0, -startIn * EDGE), Math.max(0, -startIn * EDGE), WHITE])
  return out
}

function quadsFor(road: Road, cross: number[]): Quad[] {
  const stops = cross.filter((c) => c > road.from && c < road.to)
  const out: Quad[] = []
  for (let i = 0; i + 1 < stops.length; i++) {
    out.push(...segment(stops[i] + ROAD_HALF, stops[i + 1] - ROAD_HALF, road.axis))
  }
  return out
}

/** Paint on an x-road over the canal's hump, cut into meter pieces so it follows the rise. */
function onHumps(quads: { road: Road; q: Quad }[], canal: Rect) {
  const span = humpSpan(canal)
  return quads.flatMap(({ road, q }) => {
    const [u0, u1, v0, v1, color] = q
    if (road.axis !== 'x' || u1 <= span.x0 || u0 >= span.x1) return [{ road, q }]
    const n = Math.ceil(u1 - u0)
    return Array.from({ length: n }, (_, i) => ({
      road,
      q: [u0 + ((u1 - u0) * i) / n, u0 + ((u1 - u0) * (i + 1)) / n, v0, v1, color] as Quad,
    }))
  })
}

function toGeometry(quads: { road: Road; q: Quad }[], canal: Rect): THREE.BufferGeometry {
  const pos = new Float32Array(quads.length * 12)
  const col = new Float32Array(quads.length * 12)
  const idx: number[] = []
  quads.forEach(({ road, q: [u0, u1, v0, v1, color] }, i) => {
    const corners = [
      [u0, v0],
      [u1, v0],
      [u1, v1],
      [u0, v1],
    ]
    corners.forEach(([u, v], k) => {
      const [x, z] = road.axis === 'x' ? [u, road.at + v] : [road.at + v, u]
      const rise = road.axis === 'x' ? humpRise(canal, x) : 0
      pos.set([x, 0.004 + rise, z], (i * 4 + k) * 3)
      color.toArray(col, (i * 4 + k) * 3)
    })
    const o = i * 4
    // Wind counter-clockwise seen from above whichever way u and v map to x and z.
    if (road.axis === 'x') idx.push(o, o + 2, o + 1, o, o + 3, o + 2)
    else idx.push(o, o + 1, o + 2, o, o + 2, o + 3)
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

/** Lane lines, center lines, crosswalks, and stop lines for every road, in one draw call. */
export function buildMarkings(ctx: WorldCtx, c: CityLayout): void {
  const quads = c.roads.flatMap((road) =>
    quadsFor(road, road.axis === 'x' ? c.xRoads : c.zRoads).map((q) => ({ road, q })),
  )
  const material = wornPaint(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.75,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  )
  const mesh = new THREE.Mesh(toGeometry(onHumps(quads, c.canal), c.canal), material)
  mesh.receiveShadow = true
  ctx.scene.add(mesh)
}
