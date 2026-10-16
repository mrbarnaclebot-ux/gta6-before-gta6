import * as THREE from 'three'
import { range, rng } from '../city/rng'
import type { V3 } from './boids'
import { CAUSTICS, SEA_TIME_GLSL, underwaterLight } from './caustics'

/*
 * Eagle rays gliding in slow loops over the reefs: a procedural diamond with a whip tail,
 * 1 m across, whose wings flap in the vertex shader. No CC0 ray or turtle model was in
 * the asset set, so they are built here.
 */

function rayGeometry(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(1, 1, 16, 10).rotateX(-Math.PI / 2)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2
    const z = p.getZ(i)
    // Diamond: widest a little behind the head, narrowing to the tail root.
    const half = z > -0.05 ? (0.5 - z) / 0.55 : (z + 0.5) / 0.45
    const x = u * 0.5 * Math.pow(Math.max(half, 0), 0.8)
    p.setXYZ(i, x, 0.05 * (1 - u * u) * half, -z * 0.7)
  }
  const tail = new THREE.CylinderGeometry(0.004, 0.012, 0.9, 4)
    .rotateX(Math.PI / 2)
    .translate(0, 0, -0.8)
  tail.deleteAttribute('uv')
  g.deleteAttribute('uv')
  const merged = new THREE.BufferGeometry()
  const a = g.toNonIndexed()
  const b = tail.toNonIndexed()
  const pos = new Float32Array([...a.attributes.position.array, ...b.attributes.position.array])
  merged.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  merged.computeVertexNormals()
  return merged
}

const FLAP = /* glsl */ `
#include <begin_vertex>
{
  float span = abs(transformed.x);
  float phase = float(gl_InstanceID) * 2.4;
  transformed.y += sin(seaTime * 1.4 + phase - span * 2.5) * pow(span, 1.4) * 0.45;
}
`

function rayMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({
    color: 0x3a4148,
    roughness: 0.55,
    side: THREE.DoubleSide,
  })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.seaTime = CAUSTICS.seaTime
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n' + SEA_TIME_GLSL)
      .replace('#include <begin_vertex>', FLAP)
  }
  m.customProgramCacheKey = () => 'ray'
  return underwaterLight(m)
}

const UP = new THREE.Vector3(0, 1, 0)
const FORWARD = new THREE.Vector3(0, 0, 1)

interface Glide {
  center: V3
  radius: number
  speed: number
  phase: number
  size: number
}

/** One ray over every other reef, circling it a meter or two above the floor. */
export function buildRays(parent: THREE.Object3D, reefs: V3[]) {
  const r = rng(41)
  const glides: Glide[] = reefs
    .filter((_, i) => i % 2 === 0)
    .map((c) => ({
      center: { x: c.x, y: c.y + range(r, 1.2, 2.2), z: c.z },
      radius: range(r, 9, 16),
      speed: range(r, 0.6, 0.9) * (r() < 0.5 ? -1 : 1),
      phase: r() * Math.PI * 2,
      size: range(r, 1.2, 1.9),
    }))
  const mesh = new THREE.InstancedMesh(rayGeometry(), rayMaterial(), glides.length)
  mesh.frustumCulled = false
  parent.add(mesh)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const at = new THREE.Vector3()
  const scale = new THREE.Vector3()
  const bank = new THREE.Quaternion()
  let time = 0
  return {
    update(dt: number) {
      time += dt
      glides.forEach((g, i) => {
        const a = g.phase + (time * g.speed) / g.radius
        at.set(
          g.center.x + Math.cos(a) * g.radius,
          g.center.y + Math.sin(a * 2.3) * 0.4,
          g.center.z + Math.sin(a) * g.radius,
        )
        // Heading along the circle, banking a little into the turn.
        q.setFromAxisAngle(UP, -a + (g.speed > 0 ? 0 : Math.PI))
        q.multiply(bank.setFromAxisAngle(FORWARD, 0.15 * Math.sign(g.speed)))
        mesh.setMatrixAt(i, m.compose(at, q, scale.setScalar(g.size)))
      })
      mesh.instanceMatrix.needsUpdate = true
    },
  }
}
