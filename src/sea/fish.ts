import * as THREE from 'three'
import { rng, pick, range, type Rand } from '../city/rng'
import { makeSchool, stepSchool, type BoidWorld, type School, type V3 } from './boids'
import { fishGeometry, fishMaterial } from './fish-model'

/** Silver baitfish in big schools, yellow grunts, and blue tangs: tint, size, school size, speed. */
const SPECIES = [
  { n: 40, size: 0.24, speed: 0.95, tints: [0xd8e2ea, 0xc0ced8] },
  { n: 14, size: 0.42, speed: 0.7, tints: [0xffd23f, 0xf2b53a] },
  { n: 12, size: 0.32, speed: 0.6, tints: [0x3f7fe8, 0x2e6bd0] },
]
// Schools farther than this from the camera stop swimming and are hidden.
const SIM_RANGE = 120

interface Swimmer {
  school: School
  size: number
  /** Each fish's color, picked once: RGB per fish. */
  colors: Float32Array
  awake: boolean
}

const UP = new THREE.Vector3(0, 1, 0)
const f = new THREE.Vector3()
const side = new THREE.Vector3()
const up = new THREE.Vector3()
const m = new THREE.Matrix4()

/** Writes a school's fish into the mesh from instance `at` on. */
function pose(s: Swimmer, mesh: THREE.InstancedMesh, at: number): void {
  const { pos, vel, n } = s.school
  for (let i = 0; i < n; i++) {
    f.fromArray(vel, i * 3).normalize()
    side.crossVectors(UP, f).normalize()
    up.crossVectors(f, side)
    m.makeBasis(side, up, f).scale(side.setScalar(s.size))
    m.setPosition(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
    mesh.setMatrixAt(at + i, m)
  }
  mesh.instanceColor!.array.set(s.colors, at * 3)
}

/** Two schools per reef: baitfish, then grunts or tangs in turn. */
function schools(reefs: V3[], r: Rand): Swimmer[] {
  const color = new THREE.Color()
  return reefs.flatMap((reef, k) =>
    [0, 1 + (k % 2)].map((kind) => {
      const sp = SPECIES[kind]
      const home = {
        x: reef.x + range(r, -6, 6),
        y: reef.y + range(r, 1.3, 2.4),
        z: reef.z + range(r, -6, 6),
      }
      const school = makeSchool(sp.n, home, r, sp.speed, 7)
      const colors = new Float32Array(sp.n * 3)
      for (let i = 0; i < sp.n; i++) color.set(pick(r, sp.tints)).toArray(colors, i * 3)
      return { school, size: sp.size, colors, awake: false }
    }),
  )
}

/**
 * The fish of every reef in one instanced mesh, simulated only near the camera. Awake schools
 * are packed at the front and `count` stops there, so far schools cost nothing to draw.
 */
export function buildFish(parent: THREE.Object3D, reefs: V3[], world: Omit<BoidWorld, 'threat'>) {
  const r = rng(23)
  const swimmers = schools(reefs, r)
  const total = swimmers.reduce((n, s) => n + s.school.n, 0)
  const mesh = new THREE.InstancedMesh(fishGeometry(), fishMaterial(), total)
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3)
  mesh.count = 0
  mesh.frustumCulled = false
  parent.add(mesh)
  const boids: BoidWorld = { ...world, threat: null }
  return {
    mesh,
    swimmers,
    /** `threat` is the swimmer the fish flee, or null when nobody is in the water. */
    update(dt: number, eye: THREE.Vector3, threat: V3 | null) {
      boids.threat = threat
      let at = 0
      for (const s of swimmers) {
        const h = s.school.home
        s.awake = Math.hypot(h.x - eye.x, h.y - eye.y, h.z - eye.z) < SIM_RANGE
        if (!s.awake) continue
        stepSchool(s.school, boids, Math.min(dt, 1 / 20))
        pose(s, mesh, at)
        at += s.school.n
      }
      mesh.count = at
      mesh.visible = at > 0
      mesh.instanceMatrix.needsUpdate = mesh.instanceColor!.needsUpdate = at > 0
    },
  }
}
