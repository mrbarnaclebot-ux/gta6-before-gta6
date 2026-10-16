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
  tints: number[]
  first: number
  awake: boolean
}

const UP = new THREE.Vector3(0, 1, 0)
const f = new THREE.Vector3()
const side = new THREE.Vector3()
const up = new THREE.Vector3()
const m = new THREE.Matrix4()
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0)

function pose(s: Swimmer, mesh: THREE.InstancedMesh): void {
  const { pos, vel, n } = s.school
  for (let i = 0; i < n; i++) {
    f.fromArray(vel, i * 3).normalize()
    side.crossVectors(UP, f).normalize()
    up.crossVectors(f, side)
    m.makeBasis(side, up, f).scale(side.setScalar(s.size))
    m.setPosition(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2])
    mesh.setMatrixAt(s.first + i, m)
  }
}

function hide(s: Swimmer, mesh: THREE.InstancedMesh): void {
  for (let i = 0; i < s.school.n; i++) mesh.setMatrixAt(s.first + i, HIDDEN)
}

/** Two schools per reef: baitfish, then grunts or tangs in turn. */
function schools(reefs: V3[], r: Rand): Swimmer[] {
  let total = 0
  return reefs.flatMap((reef, k) =>
    [0, 1 + (k % 2)].map((kind) => {
      const sp = SPECIES[kind]
      const home = {
        x: reef.x + range(r, -6, 6),
        y: reef.y + range(r, 1.3, 2.4),
        z: reef.z + range(r, -6, 6),
      }
      const school = makeSchool(sp.n, home, r, sp.speed, 7)
      const swimmer = { school, size: sp.size, tints: sp.tints, first: total, awake: false }
      total += sp.n
      return swimmer
    }),
  )
}

/** The fish of every reef in one instanced mesh, simulated only near the camera. */
export function buildFish(parent: THREE.Object3D, reefs: V3[], world: Omit<BoidWorld, 'threat'>) {
  const r = rng(23)
  const swimmers = schools(reefs, r)
  const total = swimmers.reduce((n, s) => n + s.school.n, 0)
  const mesh = new THREE.InstancedMesh(fishGeometry(), fishMaterial(), total)
  const color = new THREE.Color()
  for (const s of swimmers) {
    for (let i = 0; i < s.school.n; i++) mesh.setColorAt(s.first + i, color.set(pick(r, s.tints)))
    hide(s, mesh)
  }
  mesh.frustumCulled = false
  parent.add(mesh)
  const boids: BoidWorld = { ...world, threat: null }
  return {
    mesh,
    swimmers,
    /** `threat` is the swimmer the fish flee, or null when nobody is in the water. */
    update(dt: number, eye: THREE.Vector3, threat: V3 | null) {
      boids.threat = threat
      let any = false
      for (const s of swimmers) {
        const h = s.school.home
        const near = Math.hypot(h.x - eye.x, h.y - eye.y, h.z - eye.z) < SIM_RANGE
        if (near) {
          stepSchool(s.school, boids, Math.min(dt, 1 / 20))
          pose(s, mesh)
        } else if (s.awake) hide(s, mesh)
        s.awake = near
        any ||= near
      }
      mesh.visible = any
      mesh.instanceMatrix.needsUpdate = any
    },
  }
}
