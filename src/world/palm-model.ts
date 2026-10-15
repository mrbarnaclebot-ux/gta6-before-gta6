import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { range, rng, type Rand } from '../city/rng'
import type { Part } from './instancing'

/*
 * Procedural palm, 1 m tall (instances scale it to height). The CC0 palms on
 * hand are low-poly and look out of place next to PBR materials, so this one
 * uses alpha-tested fronds painted on a canvas: soft leaflet silhouettes and
 * leafy shadows for a few hundred triangles per tree.
 */

const SEGMENTS = 6

function frondTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 128
  c.height = 512
  const g = c.getContext('2d')!
  const r = rng(11)
  g.lineCap = 'round'
  for (let i = 0; i < 70; i++) {
    const t = i / 70
    const y = 500 - t * 480
    const len = 62 * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)) ** 0.6
    for (const side of [-1, 1]) {
      const a = 0.62 + r() * 0.15
      g.strokeStyle = `hsl(${88 + r() * 22}, ${38 + r() * 18}%, ${22 + r() * 14}%)`
      g.lineWidth = 2.6 + r() * 1.2
      g.beginPath()
      g.moveTo(64, y)
      g.quadraticCurveTo(
        64 + side * len * 0.5,
        y - len * 0.45,
        64 + side * len * Math.sin(a),
        y - len * Math.cos(a) - 8,
      )
      g.stroke()
    }
  }
  g.strokeStyle = '#6d6a3a'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(64, 512)
  g.lineTo(64, 12)
  g.stroke()
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function barkTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 256
  const g = c.getContext('2d')!
  const r = rng(5)
  for (let y = 0; y < 256; y += 4) {
    const k = 0.8 + r() * 0.35 - (y % 16 === 0 ? 0.3 : 0)
    g.fillStyle = `rgb(${Math.round(128 * k)},${Math.round(116 * k)},${Math.round(98 * k)})`
    g.fillRect(0, y, 64, 4)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

/** Slightly curved, tapering trunk. Returns the geometry and the crown position. */
function trunk(lean: number, yaw: number) {
  const geo = new THREE.CylinderGeometry(0.017, 0.026, 1, 8, SEGMENTS, true).translate(0, 0.5, 0)
  const pos = geo.attributes.position
  const uv = geo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    pos.setX(i, pos.getX(i) + lean * y * y)
    uv.setY(i, uv.getY(i) * 24)
  }
  geo.rotateY(yaw).computeVertexNormals()
  const top = new THREE.Vector3(lean, 1, 0).applyAxisAngle(new THREE.Object3D().up, yaw)
  return { geo, top }
}

/** One arching frond: a strip along a drooping spine, folded into a shallow V. */
function frond(length: number, elevation: number, droop: number): THREE.BufferGeometry {
  const width = length * 0.32
  const verts: number[] = []
  const uvs: number[] = []
  const p = new THREE.Vector3()
  for (let s = 0; s <= SEGMENTS; s++) {
    const t = s / SEGMENTS
    const theta = elevation - droop * t * t
    for (const side of [-1, 0, 1]) {
      verts.push(side * width * 0.5, p.y + Math.abs(side) * width * 0.18, p.z)
      uvs.push((side + 1) / 2, t)
    }
    p.y += Math.sin(theta) * (length / SEGMENTS)
    p.z += Math.cos(theta) * (length / SEGMENTS)
  }
  const idx: number[] = []
  for (let s = 0; s < SEGMENTS; s++) {
    for (let k = 0; k < 2; k++) {
      const a = s * 3 + k
      idx.push(a, a + 1, a + 3, a + 1, a + 4, a + 3)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

function crown(r: Rand, top: THREE.Vector3): THREE.BufferGeometry {
  const fronds: THREE.BufferGeometry[] = []
  const count = 14 + Math.floor(r() * 5)
  for (let i = 0; i < count; i++) {
    const upper = i % 3 === 0
    const geo = frond(
      range(r, 0.3, 0.4),
      upper ? range(r, 0.7, 1.0) : range(r, 0.15, 0.45),
      range(r, 1.4, 2.2),
    )
    geo.rotateY((i / count) * Math.PI * 2 + range(r, -0.2, 0.2))
    fronds.push(geo.translate(top.x, top.y - 0.01, top.z))
  }
  return mergeGeometries(fronds)
}

/** A few palm variants sharing two materials; each variant is two instanceable parts. */
export function palmVariants(count: number): Part[][] {
  const leaves = new THREE.MeshStandardMaterial({
    map: frondTexture(),
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    roughness: 0.75,
  })
  const bark = new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 0.95 })
  return Array.from({ length: count }, (_, v) => {
    const r = rng(31 + v)
    const t = trunk(range(r, 0.04, 0.16), r() * Math.PI * 2)
    return [
      { geometry: t.geo, material: bark },
      { geometry: crown(r, t.top), material: leaves },
    ]
  })
}
