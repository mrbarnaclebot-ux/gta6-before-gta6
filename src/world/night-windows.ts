import * as THREE from 'three'
import { type Style } from '../city/lots'
import { rng } from '../city/rng'

/*
 * Lit windows at night: an emissive map over the facade UVs. It covers 16 x 16
 * windows, four times the facade tile each way, so the lit pattern repeats far
 * less often than the window texture itself.
 */

export const GLOW_BAYS = 16
export const GLOW_FLOORS = 16
const CELL = 16

/** Glass rect inside one bay/floor cell, matching facades.ts: x, y, w, h as fractions. */
const GLASS: Record<Style, [number, number, number, number]> = {
  deco: [0.11, 0.29, 0.78, 0.42],
  residential: [0.12, 0.18, 0.76, 0.74],
  glass: [0.0, 0.16, 1.0, 0.84],
}

// Mostly warm interiors, some cool office white and the odd TV-blue or pink lamp.
const TINTS = ['#ffcf8f', '#ffdcae', '#ffe9cc', '#fff3e2', '#d6e6ff', '#9fd0ff', '#ffb0d0']
const LIT: Record<Style, number> = { deco: 0.45, residential: 0.4, glass: 0.35 }

/** A '#rrggbb' color scaled toward black. */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * k))
  return `rgb(${c.join(',')})`
}

export function windowGlow(style: Style): THREE.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = GLOW_BAYS * CELL
  canvas.height = GLOW_FLOORS * CELL
  const g = canvas.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, canvas.width, canvas.height)
  const r = rng(style.length * 131 + 7)
  const [wx, wy, ww, wh] = GLASS[style]
  for (let fy = 0; fy < GLOW_FLOORS; fy++) {
    // Office floors tend to be lit or dark as a whole, and dimmer than homes.
    const office = style === 'glass'
    const floorLit = office ? (r() < LIT.glass ? 0.7 : 0.06) : LIT[style]
    for (let bx = 0; bx < GLOW_BAYS; bx++) {
      if (r() > floorLit) continue
      g.globalAlpha = office ? 0.2 + r() * 0.3 : 0.35 + r() * 0.65
      const tint = TINTS[Math.floor(r() * (office ? 5 : TINTS.length))]
      const y = (GLOW_FLOORS - fy - wy - wh) * CELL
      // Ceiling lights: brightest at the top of the window, dimmer toward the floor.
      const fade = g.createLinearGradient(0, y, 0, y + wh * CELL)
      fade.addColorStop(0, tint)
      fade.addColorStop(1, shade(tint, 0.35))
      g.fillStyle = fade
      g.fillRect((bx + wx) * CELL, y, ww * CELL, wh * CELL)
    }
  }
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
