import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { rng, range } from '../city/rng'
import { keepCardNormals } from '../render/card-normals'
import { CAUSTICS, SEA_TIME_GLSL, underwaterLight } from './caustics'

/*
 * Procedural sea floor plants and corals, each about 1 m tall so a spot's size is its
 * height. Colors live in vertex colors (base darker, like ambient occlusion) and are
 * tinted per instance. Plants sway in the vertex shader, more toward their tips.
 */

/** A bent strip from the origin up to y = 1, `width` wide, leaning toward (lx, lz). */
function blade(width: number, segments: number, lx: number, lz: number, twist = 0) {
  const g = new THREE.PlaneGeometry(width, 1, 1, segments).translate(0, 0.5, 0)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i)
    const a = twist * y
    const x = p.getX(i) * (1 - 0.6 * y)
    p.setXYZ(i, x * Math.cos(a) + lx * y * y, y, x * Math.sin(a) + lz * y * y)
  }
  return g
}

function shade(g: THREE.BufferGeometry, base: number, tip: number): THREE.BufferGeometry {
  const p = g.attributes.position
  const box = new THREE.Box3().setFromBufferAttribute(p as THREE.BufferAttribute)
  const colors = new Float32Array(p.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) - box.min.y) / (box.max.y - box.min.y || 1)
    c.set(base)
      .lerp(new THREE.Color(tip), t)
      .toArray(colors, i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return g
}

const merged = (parts: THREE.BufferGeometry[]) => {
  const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)))
  g.computeVertexNormals()
  return g
}

/** Blade normals lean up, like a canopy's, so thin plants light from the sky above, not edge-on. */
function upright(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const n = g.attributes.normal
  const v = new THREE.Vector3()
  for (let i = 0; i < n.count; i++) {
    v.fromBufferAttribute(n, i).setY(0).normalize().multiplyScalar(0.5)
    n.setXYZ(i, v.x, 1, v.z)
  }
  g.normalizeNormals()
  return g
}

/** Five seagrass blades fanning out of one root. */
export function seagrass(): THREE.BufferGeometry {
  const r = rng(3)
  const parts = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 + r()
    return blade(0.045, 3, Math.cos(a) * 0.25, Math.sin(a) * 0.25).rotateY(r() * Math.PI)
  })
  return upright(shade(merged(parts), 0x2a4a1c, 0x9cc256))
}

/** Three tall twisting kelp ribbons. */
export function kelp(): THREE.BufferGeometry {
  const parts = [0, 2.1, 4.2].map((a) =>
    blade(0.06, 12, Math.cos(a) * 0.08, Math.sin(a) * 0.08, 2.5).translate(
      Math.cos(a) * 0.05,
      0,
      Math.sin(a) * 0.05,
    ),
  )
  return upright(shade(merged(parts), 0x4a3c14, 0xc8a84a))
}

/** A bumpy dome with grooves, like brain coral. */
function brain(): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(0.5, 4)
  const p = g.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const groove = 1 + 0.06 * Math.sin(v.x * 38 + Math.sin(v.z * 21) * 2) * Math.cos(v.z * 31)
    v.multiplyScalar(groove)
    // Flattened into a dome sitting on y = 0.
    p.setXYZ(i, v.x, (Math.max(v.y, -0.05) + 0.05) * 0.8, v.z)
  }
  return g
}

/** Branching staghorn: tapered cylinders forking up and out. */
function staghorn(): THREE.BufferGeometry {
  const r = rng(9)
  const parts: THREE.BufferGeometry[] = []
  const grow = (
    from: THREE.Vector3,
    dir: THREE.Vector3,
    len: number,
    rad: number,
    depth: number,
  ) => {
    const to = from.clone().addScaledVector(dir, len)
    const g = new THREE.CylinderGeometry(rad * 0.7, rad, len, 5, 1, true)
    g.translate(0, len / 2, 0).applyQuaternion(
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir),
    )
    parts.push(g.translate(from.x, from.y, from.z))
    if (depth === 0) return
    for (let k = 0; k < 3; k++) {
      const d = dir
        .clone()
        .add(new THREE.Vector3(range(r, -0.7, 0.7), range(r, 0, 0.5), range(r, -0.7, 0.7)))
        .normalize()
      grow(to, d, len * 0.72, rad * 0.7, depth - 1)
    }
  }
  grow(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), 0.3, 0.07, 3)
  return merged(parts)
}

/** A sea fan: a flat upright disc with a ragged rim on a short stalk. */
function fan(): THREE.BufferGeometry {
  const disc = new THREE.CircleGeometry(0.5, 28)
  const p = disc.attributes.position
  for (let i = 1; i < p.count; i++) {
    const a = Math.atan2(p.getY(i), p.getX(i))
    const k = 0.82 + 0.1 * Math.sin(a * 7) + 0.08 * Math.sin(a * 13 + 1)
    p.setXY(i, p.getX(i) * k * 1.1, p.getY(i) * k)
  }
  return merged([
    disc.translate(0, 0.55, 0),
    new THREE.CylinderGeometry(0.02, 0.03, 0.15, 4, 1, true).translate(0, 0.075, 0),
  ])
}

/** A cluster of open tubes, like tube sponges. */
function tubes(): THREE.BufferGeometry {
  const r = rng(5)
  return merged(
    Array.from({ length: 7 }, () => {
      const h = range(r, 0.35, 1)
      const g = new THREE.CylinderGeometry(0.07, 0.05, h, 8, 1, true).translate(0, h / 2, 0)
      return g.translate(range(r, -0.18, 0.18), 0, range(r, -0.18, 0.18))
    }),
  )
}

/** Brain, staghorn, fan, tubes: one geometry per CORAL_KINDS. */
export function corals(): THREE.BufferGeometry[] {
  return [brain(), staghorn(), fan(), tubes()].map((g) => {
    g.deleteAttribute('uv')
    g.deleteAttribute('normal')
    // Welded, so the domes and branches shade smooth instead of faceted.
    const smooth = mergeVertices(g)
    smooth.computeVertexNormals()
    return shade(smooth, 0x5a5048, 0xffffff)
  })
}

const SWAY = /* glsl */ `
#include <begin_vertex>
{
  vec3 root = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
  float h = max(position.y, 0.0);
  float ph = seaTime * swaySpeed + root.x * 0.31 + root.z * 0.23;
  transformed.x += sin(ph) * swayAmount * h * h;
  transformed.z += cos(ph * 0.83) * swayAmount * 0.7 * h * h;
}
`

/** Matte plant material that sways with the swell; `amount` is the tip's swing per meter of height. */
export function swayMaterial(amount: number, speed: number): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.seaTime = CAUSTICS.seaTime
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\n${SEA_TIME_GLSL}\nconst float swayAmount = ${amount.toFixed(3)};\nconst float swaySpeed = ${speed.toFixed(3)};`,
      )
      .replace('#include <begin_vertex>', SWAY)
  }
  m.customProgramCacheKey = () => `sway-${amount}-${speed}`
  return underwaterLight(keepCardNormals(m))
}
