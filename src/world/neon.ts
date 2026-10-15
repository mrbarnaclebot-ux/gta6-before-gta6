import * as THREE from 'three'
import type { CityLayout } from '../city/layout'
import { buildingHeight, FLOOR_H, type Building } from '../city/lots'
import { addMerged, tinted, type WorldCtx } from './blocks'
import { groupByChunk } from './chunks'

/*
 * Miami Beach at night: neon tubes along art-deco eyebrows, corners, and roof
 * lines, plus a soft wash of their color on the wall around them. The wash is an
 * additive gradient quad just off the wall: no real lights, so hundreds of signs
 * cost two draw calls per chunk.
 */

const COLORS = [0xff2fa0, 0xc040ff, 0x22e0ff, 0x2affc0, 0x8a5cff, 0xff7a3a, 0xff3a6e]
const TUBE = 0.12
const WASH_H = 5

type Parts = { tubes: THREE.BufferGeometry[]; wash: THREE.BufferGeometry[] }
type Wash = 'both' | 'below' | 'none'

function scaleV(geo: THREE.BufferGeometry, k: number) {
  const uv = geo.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * k)
}

function tube(w: number, h: number, d: number, x: number, y: number, z: number, color: number) {
  return tinted(new THREE.BoxGeometry(w, h, d).translate(x, y, z), color)
}

/**
 * A tube ring around a w x d footprint at height y, with a color wash on the walls
 * around it: above and below, or only below for roof lines, so no glow hangs in the sky.
 */
function ring(p: Parts, b: Building, w: number, d: number, y: number, color: number, wash: Wash) {
  const [hw, hd] = [w / 2, d / 2]
  p.tubes.push(
    tube(w + TUBE, TUBE, TUBE, b.x, y, b.z - hd, color),
    tube(w + TUBE, TUBE, TUBE, b.x, y, b.z + hd, color),
    tube(TUBE, TUBE, d, b.x - hw, y, b.z, color),
    tube(TUBE, TUBE, d, b.x + hw, y, b.z, color),
  )
  if (wash === 'none') return
  // Quads face out of each wall, 6 cm off it; the gradient peaks at the tube.
  const sides: [number, number, number, number][] = [
    [b.x, b.z + b.d / 2 + 0.06, 0, b.w],
    [b.x, b.z - b.d / 2 - 0.06, Math.PI, b.w],
    [b.x + b.w / 2 + 0.06, b.z, Math.PI / 2, b.d],
    [b.x - b.w / 2 - 0.06, b.z, -Math.PI / 2, b.d],
  ]
  const h = wash === 'both' ? WASH_H : WASH_H / 2
  const center = wash === 'both' ? y : y - h / 2
  for (const [x, z, yaw, span] of sides) {
    const quad = new THREE.PlaneGeometry(span, h)
    // The gradient peaks at v = 0.5: a below-only quad uses its lower half.
    if (wash === 'below') scaleV(quad, 0.5)
    p.wash.push(tinted(quad.rotateY(yaw).translate(x, center, z), color))
  }
}

function corners(p: Parts, b: Building, h: number, color: number) {
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = b.x + sx * (b.w / 2 + 0.05)
      const z = b.z + sz * (b.d / 2 + 0.05)
      p.tubes.push(tube(TUBE, h - 1, TUBE, x, 0.75 + (h - 1) / 2, z, color))
    }
  }
}

/** Deco buildings get the full treatment; some towers get a roof-line ring. */
function dress(p: Parts, b: Building): void {
  const color = COLORS[b.seed % COLORS.length]
  const h = buildingHeight(b)
  if (b.style === 'deco') {
    // Along the outer edge of the first-floor eyebrow, like a hotel's canopy sign.
    const eyebrow = FLOOR_H.deco * 0.76 + 0.06
    ring(p, b, b.w + 0.95, b.d + 0.95, eyebrow, color, 'both')
    // Along the top of the 1.1 m parapet.
    ring(p, b, b.w + 0.1, b.d + 0.1, h + 1.0, color, b.floors > 2 ? 'below' : 'none')
    if (b.seed % 2 === 0) corners(p, b, h, COLORS[(b.seed >> 3) % COLORS.length])
    return
  }
  // Odd seeds never get a glass setback tier, so the ring always sits on the crown.
  if (b.style === 'residential' && b.seed % 3 === 0) {
    ring(p, b, b.w + 0.1, b.d + 0.1, h + 1.0, color, 'below')
  } else if (b.style === 'glass' && b.seed % 4 === 1) {
    ring(p, b, b.w + 0.5, b.d + 0.5, h + 1.5, color, 'below')
  }
}

/** A vertical falloff: brightest at the middle (the tube), fading to nothing above and below. */
function washTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 128)
  grad.addColorStop(0, 'rgba(0,0,0,1)')
  grad.addColorStop(0.42, 'rgba(90,90,90,1)')
  grad.addColorStop(0.5, 'rgba(255,255,255,1)')
  grad.addColorStop(0.62, 'rgba(70,70,70,1)')
  grad.addColorStop(1, 'rgba(0,0,0,1)')
  g.fillStyle = grad
  g.fillRect(0, 0, 4, 128)
  return new THREE.CanvasTexture(c)
}

export interface Neon {
  /** 0 by day (unlit tubes), 1 at night. */
  setNight(k: number): void
}

export function buildNeon(ctx: WorldCtx, c: CityLayout): Neon {
  const tubes = new THREE.MeshBasicMaterial({ vertexColors: true })
  const wash = new THREE.MeshBasicMaterial({
    vertexColors: true,
    map: washTexture(),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  })
  const meshes: THREE.Mesh[] = []
  // Draw everything for the first frames, even by day, so shaders compile while loading.
  let warm = 3
  const all = c.blocks.flatMap((b) => b.buildings)
  for (const list of groupByChunk(all).values()) {
    const p: Parts = { tubes: [], wash: [] }
    list.forEach((b) => dress(p, b))
    for (const [geos, mat] of [
      [p.tubes, tubes],
      [p.wash, wash],
    ] as const) {
      const mesh = addMerged(ctx, geos, mat, { cast: false, receive: false })
      if (mesh) meshes.push(mesh)
    }
  }
  return {
    setNight(k) {
      tubes.color.setScalar(5 * k)
      wash.color.setScalar(0.6 * k)
      // Unlit tubes by day are thin glass nobody notices; skip drawing them.
      for (const m of meshes) m.visible = k > 0.01 || warm > 0
      warm--
    },
  }
}
