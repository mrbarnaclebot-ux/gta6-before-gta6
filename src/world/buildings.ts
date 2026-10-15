import * as THREE from 'three'
import type { CityLayout } from '../city/layout'
import { FLOOR_H, type Building, type Style } from '../city/lots'
import { RAPIER } from '../physics'
import { addMerged, metricBox, tinted, type WorldCtx } from './blocks'
import { groupByChunk } from './chunks'
import { facadeMaterial, tileSize } from './facades'
import { pbr } from './materials'

// Miami: mostly white and cream, with art-deco pastels; glass tints stay subtle.
const WALLS: Record<Style, number[]> = {
  deco: [0xf6f3ec, 0xf6f3ec, 0xf3e6c8, 0xf3c4b8, 0xb8e2cf, 0xbcd6ef, 0xf5d29e, 0xd8c8ec],
  residential: [0xf7f5f0, 0xf1eee6, 0xe9e6df, 0xf3ead9, 0xe2e6ea],
  glass: [0xffffff, 0xdcebf2, 0xd5e9df, 0xece4d6, 0xcdd8ea],
}
const ACCENTS = [0xffffff, 0x9fd4c4, 0xf0a9a0, 0x8cc4e0, 0xf3cf8a]

interface Parts {
  facade: Record<Style, THREE.BufferGeometry[]>
  trim: THREE.BufferGeometry[]
  roof: THREE.BufferGeometry[]
  /** Boxes the player collides with: each tier and each rooftop core. */
  solids: THREE.Box3[]
}

/** Four facade walls (no top or bottom) with UVs in window-grid tiles, so windows land on floors. */
function walls(b: Building, w: number, d: number, y0: number, y1: number) {
  const h = y1 - y0
  const t = tileSize(FLOOR_H[b.style])
  const geo = new THREE.BoxGeometry(w, h, d)
  const uv = geo.attributes.uv as THREE.BufferAttribute
  const spans = [d, d, w, w, w, w]
  const shift = (b.seed % 4) / 4
  spans.forEach((span, face) => {
    for (let i = face * 4; i < face * 4 + 4; i++) {
      uv.setXY(i, shift + (uv.getX(i) * span) / t.u, (y0 + uv.getY(i) * h) / t.v)
    }
  })
  const idx = Array.from(geo.index!.array)
  geo.setIndex([...idx.slice(0, 12), ...idx.slice(24)])
  return geo.translate(b.x, y0 + h / 2, b.z)
}

const box = (b: Building, w: number, h: number, d: number, x: number, y: number, z: number) =>
  metricBox(w, h, d).translate(b.x + x, y + h / 2, b.z + z)

/** A w x d block from y0 to y1, offset (x, z) from the footprint center, that the player cannot walk through. */
function solid(p: Parts, b: Building, w: number, d: number, y0: number, y1: number, x = 0, z = 0) {
  const min = new THREE.Vector3(b.x + x - w / 2, y0, b.z + z - d / 2)
  p.solids.push(new THREE.Box3(min, new THREE.Vector3(b.x + x + w / 2, y1, b.z + z + d / 2)))
}

/** Stone plinth so facades do not look sunk into the sidewalk. */
function plinth(b: Building, p: Parts, w: number, d: number, color: number) {
  p.trim.push(tinted(box(b, w + 0.16, 0.75, d + 0.16, 0, 0, 0), color))
}

/** A 1.1 m parapet ring and a gravel roof on top of a w x d tier ending at height `top`. */
function crownParts(b: Building, p: Parts, w: number, d: number, top: number, color: number) {
  const t = 0.3
  p.trim.push(
    tinted(box(b, w, 1.1, t, 0, top, (d - t) / 2), color),
    tinted(box(b, w, 1.1, t, 0, top, -(d - t) / 2), color),
    tinted(box(b, t, 1.1, d - 2 * t, (w - t) / 2, top, 0), color),
    tinted(box(b, t, 1.1, d - 2 * t, -(w - t) / 2, top, 0), color),
  )
  p.roof.push(box(b, w - 2 * t, 0.12, d - 2 * t, 0, top, 0))
  solid(p, b, w, d, top, top + 0.12)
  solid(p, b, w, t, top, top + 1.1, 0, (d - t) / 2)
  solid(p, b, w, t, top, top + 1.1, 0, -(d - t) / 2)
  solid(p, b, t, d, top, top + 1.1, (w - t) / 2, 0)
  solid(p, b, t, d, top, top + 1.1, -(w - t) / 2, 0)
}

function decoParts(b: Building, p: Parts, wall: number, accent: number) {
  const fh = FLOOR_H.deco
  const h = b.floors * fh
  p.facade[b.style].push(tinted(walls(b, b.w, b.d, 0, h), wall))
  solid(p, b, b.w, b.d, 0, h)
  plinth(b, p, b.w, b.d, 0xd9d3c7)
  // Art-deco "eyebrow" sun shades over every window band.
  for (let i = 0; i < b.floors; i++) {
    p.trim.push(tinted(box(b, b.w + 0.9, 0.12, b.d + 0.9, 0, i * fh + fh * 0.76, 0), accent))
  }
  crownParts(b, p, b.w, b.d, h, wall)
  if (b.seed % 3 === 0) {
    const side = b.seed % 2 ? 1 : -1
    // Straddles the side wall so above the roof it grows out of the parapet, not beside it.
    p.trim.push(tinted(box(b, 1.2, h * 0.5 + 5, 3.2, (side * b.w) / 2, h * 0.5, 0), accent))
  }
}

function residentialParts(b: Building, p: Parts, wall: number) {
  const fh = FLOOR_H.residential
  const h = b.floors * fh
  p.facade[b.style].push(tinted(walls(b, b.w, b.d, 0, h), wall))
  solid(p, b, b.w, b.d, 0, h)
  plinth(b, p, b.w, b.d, 0xcfcac0)
  const alongX = b.seed % 2 === 0
  for (let i = 1; i < b.floors; i++) {
    const [w, d] = alongX ? [b.w + 0.1, b.d + 2.6] : [b.w + 2.6, b.d + 0.1]
    p.trim.push(tinted(box(b, w, 0.22, d, 0, i * fh - 0.11, 0), 0xf8f7f4))
  }
  crownParts(b, p, b.w, b.d, h, wall)
  p.trim.push(tinted(box(b, b.w * 0.35, 3.2, b.d * 0.35, 0, h, 0), wall))
  solid(p, b, b.w * 0.35, b.d * 0.35, h, h + 3.2)
}

function glassParts(b: Building, p: Parts, wall: number) {
  const fh = FLOOR_H.glass
  const h = b.floors * fh
  const setback = b.floors >= 25 && b.seed % 2 === 0 && b.w > 18 && b.d > 18
  const split = setback ? Math.round(b.floors * 0.6) * fh : h
  p.facade.glass.push(tinted(walls(b, b.w, b.d, 0, split), wall))
  solid(p, b, b.w, b.d, 0, split)
  plinth(b, p, b.w, b.d, 0x5a5c5e)
  let [w, d] = [b.w, b.d]
  if (setback) {
    crownParts(b, p, w, d, split, 0xe8e8e4)
    ;[w, d] = [w - 6, d - 6]
    p.facade.glass.push(tinted(walls(b, w, d, split, h), wall))
    solid(p, b, w, d, split, h)
  }
  p.trim.push(tinted(box(b, w + 0.4, 1.6, d + 0.4, 0, h, 0), 0xdedfdd))
  solid(p, b, w + 0.4, d + 0.4, h, h + 1.6)
  p.trim.push(tinted(box(b, w * 0.4, 4, d * 0.4, 0, h + 1.6, 0), 0xdedfdd))
  solid(p, b, w * 0.4, d * 0.4, h, h + 5.6)
  if (b.seed % 3 === 0) p.trim.push(tinted(box(b, 0.6, 14, 0.6, 0, h + 5.6, 0), 0xdedfdd))
}

function partsFor(list: Building[]): Parts {
  const p: Parts = {
    facade: { deco: [], residential: [], glass: [] },
    trim: [],
    roof: [],
    solids: [],
  }
  for (const b of list) {
    const wall = WALLS[b.style][b.tint % WALLS[b.style].length]
    if (b.style === 'deco') decoParts(b, p, wall, ACCENTS[(b.tint >> 3) % ACCENTS.length])
    else if (b.style === 'residential') residentialParts(b, p, wall)
    else glassParts(b, p, wall)
  }
  return p
}

/** All buildings, merged per 250 m chunk and per material, with box colliders for each solid part. */
export function buildBuildings(ctx: WorldCtx, c: CityLayout): void {
  const styles: Style[] = ['deco', 'residential', 'glass']
  const facades = new Map(styles.map((s) => [s, facadeMaterial(s)]))
  const trim = pbr('white_stucco', 0.5, { vertexColors: true })
  // Light membrane roofs, like the cool roofs all over Miami.
  const roof = pbr('white_stucco', 0.25, { color: 0xc4c2bd })
  const all = c.blocks.flatMap((b) => b.buildings)
  for (const list of groupByChunk(all).values()) {
    const p = partsFor(list)
    for (const style of styles) addMerged(ctx, p.facade[style], facades.get(style)!)
    addMerged(ctx, p.trim, trim)
    addMerged(ctx, p.roof, roof)
    for (const s of p.solids) {
      const half = s.getSize(new THREE.Vector3()).multiplyScalar(0.5)
      const at = s.getCenter(new THREE.Vector3())
      const desc = RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z)
      ctx.physics.createCollider(desc.setTranslation(at.x, at.y, at.z))
    }
  }
}
