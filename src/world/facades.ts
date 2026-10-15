import * as THREE from 'three'
import { BAY, type Style } from '../city/lots'
import { rng, type Rand } from '../city/rng'
import { GLOW_BAYS, GLOW_FLOORS, windowGlow } from './night-windows'

/*
 * Procedural PBR facade textures. No CC0 window texture fit Miami, so each style
 * is painted on canvases: albedo, roughness+metalness, and a height map turned
 * into a normal map so window recesses catch light. One tile is 4 bays by 4 floors.
 */

export const TILE_BAYS = 4
export const TILE_FLOORS = 4
const PX = 512
const CELL = PX / 4

interface Paint {
  albedo: string
  rough: number
  metal: number
  height: number
}

interface Layers {
  albedo: CanvasRenderingContext2D
  orm: CanvasRenderingContext2D
  height: CanvasRenderingContext2D
}

function layers(): Layers {
  const make = () => {
    const c = document.createElement('canvas')
    c.width = c.height = PX
    return c.getContext('2d', { willReadFrequently: true })!
  }
  return { albedo: make(), orm: make(), height: make() }
}

/** Paints a rect into all three layers. x, y, w, h are fractions of one bay/floor cell. */
function rect(l: Layers, bx: number, fy: number, r: [number, number, number, number], p: Paint) {
  // Canvas y grows downward; floors count up from the bottom of the tile.
  const x = (bx + r[0]) * CELL
  const y = (TILE_FLOORS - fy - r[1] - r[3]) * CELL
  const [w, h] = [r[2] * CELL, r[3] * CELL]
  l.albedo.fillStyle = p.albedo
  l.albedo.fillRect(x, y, w, h)
  // ORM layout three.js reads: green = roughness, blue = metalness.
  l.orm.fillStyle = `rgb(255,${Math.round(p.rough * 255)},${Math.round(p.metal * 255)})`
  l.orm.fillRect(x, y, w, h)
  const v = Math.round(p.height * 255)
  l.height.fillStyle = `rgb(${v},${v},${v})`
  l.height.fillRect(x, y, w, h)
}

const shade = (r: Rand, base: [number, number, number], spread: number) => {
  const k = 1 + (r() - 0.5) * spread
  return `rgb(${base.map((c) => Math.min(255, Math.round(c * k))).join(',')})`
}

const WALL: Paint = { albedo: '#f3efe7', rough: 0.88, metal: 0, height: 0.6 }
const FRAME: Paint = { albedo: '#d7dad8', rough: 0.45, metal: 0.3, height: 0.5 }

function glass(r: Rand, base: [number, number, number], metal: number): Paint {
  return { albedo: shade(r, base, 0.25), rough: 0.05 + r() * 0.05, metal, height: 0.25 }
}

/** Interior blinds or curtains behind some windows break up the repetition. */
function blinds(
  l: Layers,
  r: Rand,
  bx: number,
  fy: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (r() > 0.35) return
  const drop = h * (0.2 + r() * 0.6)
  const tone: [number, number, number] = r() < 0.5 ? [214, 205, 188] : [170, 172, 168]
  rect(l, bx, fy, [x, y + h - drop, w, drop], {
    albedo: shade(r, tone, 0.1),
    rough: 0.9,
    metal: 0,
    height: 0.25,
  })
}

function deco(l: Layers, r: Rand, bx: number, fy: number) {
  rect(l, bx, fy, [0, 0, 1, 1], WALL)
  rect(l, bx, fy, [0.08, 0.26, 0.84, 0.48], FRAME)
  rect(l, bx, fy, [0.11, 0.29, 0.78, 0.42], glass(r, [112, 142, 150], 0.7))
  rect(l, bx, fy, [0.49, 0.29, 0.02, 0.42], FRAME)
  blinds(l, r, bx, fy, 0.11, 0.29, 0.78, 0.42)
  rect(l, bx, fy, [0.06, 0.22, 0.88, 0.04], { ...WALL, albedo: '#e4e0d8', height: 0.75 })
}

function residential(l: Layers, r: Rand, bx: number, fy: number) {
  rect(l, bx, fy, [0, 0, 1, 1], { ...WALL, albedo: '#f1eee8' })
  rect(l, bx, fy, [0.1, 0.16, 0.8, 0.78], FRAME)
  rect(l, bx, fy, [0.12, 0.18, 0.76, 0.74], glass(r, [96, 122, 138], 0.7))
  rect(l, bx, fy, [0.495, 0.18, 0.01, 0.74], FRAME)
  blinds(l, r, bx, fy, 0.12, 0.18, 0.76, 0.74)
  rect(l, bx, fy, [0, 0, 1, 0.1], { ...WALL, albedo: '#e8e5df', height: 0.7 })
}

function curtainWall(l: Layers, r: Rand, bx: number, fy: number) {
  const mullion: Paint = { albedo: '#aeb4b8', rough: 0.35, metal: 0.85, height: 0.55 }
  rect(l, bx, fy, [0, 0.16, 1, 0.84], glass(r, [96, 132, 150], 0.9))
  rect(l, bx, fy, [0, 0, 1, 0.16], {
    albedo: shade(r, [52, 66, 76], 0.1),
    rough: 0.12,
    metal: 0.8,
    height: 0.35,
  })
  rect(l, bx, fy, [0, 0, 0.025, 1], mullion)
  rect(l, bx, fy, [0.5, 0.16, 0.012, 0.84], mullion)
  rect(l, bx, fy, [0, 0.15, 1, 0.02], mullion)
}

const PAINTERS: Record<Style, typeof deco> = { deco, residential, glass: curtainWall }

/** Height map to tangent-space normal map (OpenGL convention, +Y up). */
function normalFrom(height: CanvasRenderingContext2D, strength: number): ImageData {
  const src = height.getImageData(0, 0, PX, PX).data
  const out = new ImageData(PX, PX)
  const h = (x: number, y: number) => src[(((y + PX) % PX) * PX + ((x + PX) % PX)) * 4] / 255
  for (let y = 0; y < PX; y++) {
    for (let x = 0; x < PX; x++) {
      const dx = (h(x + 1, y) - h(x - 1, y)) * strength
      const dy = (h(x, y - 1) - h(x, y + 1)) * strength
      const len = Math.hypot(dx, dy, 1)
      const i = (y * PX + x) * 4
      out.data.set(
        [
          ((-dx / len) * 0.5 + 0.5) * 255,
          ((-dy / len) * 0.5 + 0.5) * 255,
          (1 / len) * 0.5 * 255 + 127.5,
          255,
        ],
        i,
      )
    }
  }
  return out
}

function texture(source: HTMLCanvasElement, srgb: boolean): THREE.Texture {
  const t = new THREE.CanvasTexture(source)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

function canvasOf(data: ImageData): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = PX
  c.getContext('2d')!.putImageData(data, 0, 0)
  return c
}

/** One facade material per style, tinted per building through vertex colors. */
export function facadeMaterial(style: Style): THREE.MeshStandardMaterial {
  const l = layers()
  const r = rng(style.length * 97)
  for (let bx = 0; bx < TILE_BAYS; bx++) {
    for (let fy = 0; fy < TILE_FLOORS; fy++) PAINTERS[style](l, r, bx, fy)
  }
  const orm = texture(l.orm.canvas, false)
  const glow = windowGlow(style)
  glow.repeat.set(TILE_BAYS / GLOW_BAYS, TILE_FLOORS / GLOW_FLOORS)
  return new THREE.MeshStandardMaterial({
    map: texture(l.albedo.canvas, true),
    roughnessMap: orm,
    metalnessMap: orm,
    normalMap: texture(canvasOf(normalFrom(l.height, 6)), false),
    // Lit windows; the day and night cycle raises the intensity after dusk.
    emissiveMap: glow,
    emissive: 0xffffff,
    emissiveIntensity: 0,
    // The maps hold the real values; these scalars just pass them through.
    roughness: 1,
    metalness: 1,
    vertexColors: true,
  })
}

/** Facade UV scale: meters per texture tile, horizontally and vertically. */
export const tileSize = (floorHeight: number) => ({
  u: BAY * TILE_BAYS,
  v: floorHeight * TILE_FLOORS,
})
