import * as THREE from 'three'
import { CURB_H, type CityLayout } from '../city/layout'
import { signalPosts, stopSigns, type SignalPost } from '../city/signal-posts'
import { lightAt, signalClock, type Light } from '../life/signals'
import { RAPIER } from '../physics'
import { addMerged, tinted, type WorldCtx } from './blocks'

/*
 * Mast-arm traffic signals with yellow heads, as hung over Miami's junctions, and stop signs.
 * Poles, arms, heads, and sign posts are one merged mesh; the lenses are one instanced mesh
 * whose colors follow the lights (life/signals.ts); the sign faces are another.
 */

const POLE_H = 6.6
const ARM_Y = 6.2
const HEAD = { w: 0.42, h: 1.15, d: 0.32, y: 5.45 }
const LENS = { r: 0.12, gap: 0.36 }
const SIGN = { r: 0.38, y: 2.3 }
const GALV = 0x8d9296
const YELLOW = 0xd8ae1e

/** Lens colors: lit (bright enough to bloom), then off. Red, amber, green, top to bottom. */
const LIT = [
  new THREE.Color(5, 0.35, 0.2),
  new THREE.Color(5, 2.6, 0.25),
  new THREE.Color(0.35, 4.2, 1.6),
]
const OFF = [
  new THREE.Color(0.14, 0.03, 0.03),
  new THREE.Color(0.14, 0.1, 0.02),
  new THREE.Color(0.03, 0.12, 0.07),
]
const LIGHTS: Light[] = ['red', 'amber', 'green']

/** A post's pieces in its own frame (facing +z, arm to its right along -x), then placed. */
function postPieces(p: SignalPost): THREE.BufferGeometry[] {
  const m = new THREE.Matrix4().makeRotationY(p.yaw).setPosition(p.x, CURB_H, p.z)
  const pole = new THREE.CylinderGeometry(0.12, 0.16, POLE_H, 10).translate(0, POLE_H / 2, 0)
  const arm = new THREE.CylinderGeometry(0.07, 0.1, p.arm, 8)
    .rotateZ(Math.PI / 2)
    .translate(-p.arm / 2, ARM_Y, 0)
  const parts = [tinted(pole, GALV), tinted(arm, GALV)]
  for (const d of p.heads) {
    const head = new THREE.BoxGeometry(HEAD.w, HEAD.h, HEAD.d).translate(-d, HEAD.y, 0)
    const plate = new THREE.BoxGeometry(HEAD.w + 0.34, HEAD.h + 0.3, 0.03).translate(
      -d,
      HEAD.y,
      -HEAD.d / 2 - 0.02,
    )
    const hanger = new THREE.CylinderGeometry(0.03, 0.03, ARM_Y - HEAD.y - HEAD.h / 2, 5).translate(
      -d,
      (ARM_Y + HEAD.y + HEAD.h / 2) / 2,
      0,
    )
    parts.push(tinted(head, YELLOW), tinted(plate, 0x1a1a1a), tinted(hanger, GALV))
  }
  return parts.map((g) => g.applyMatrix4(m))
}

/** A red octagon with a white rim and STOP across it. */
function stopTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#f2f2f2'
  g.fillRect(0, 0, 128, 128)
  g.fillStyle = '#c4161c'
  g.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4
    g.lineTo(64 + 58 * Math.cos(a), 64 + 58 * Math.sin(a))
  }
  g.fill()
  g.fillStyle = '#ffffff'
  g.font = 'bold 40px Arial, sans-serif'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.fillText('STOP', 64, 67)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function pole(ctx: WorldCtx, x: number, z: number, h: number, r: number) {
  ctx.colliders.add(RAPIER.ColliderDesc.cylinder(h / 2, r).setTranslation(x, CURB_H + h / 2, z))
}

/** Stop signs: posts and backs into the merged mesh, the faces as one instanced mesh. */
function buildStopSigns(ctx: WorldCtx, c: CityLayout, parts: THREE.BufferGeometry[]) {
  const signs = stopSigns(c)
  const face = new THREE.CircleGeometry(SIGN.r, 8, Math.PI / 8).translate(0, SIGN.y, 0.03)
  const material = new THREE.MeshStandardMaterial({ map: stopTexture(), roughness: 0.5 })
  const mesh = new THREE.InstancedMesh(face, material, signs.length)
  const m = new THREE.Matrix4()
  signs.forEach((s, i) => {
    m.makeRotationY(s.yaw).setPosition(s.x, CURB_H, s.z)
    mesh.setMatrixAt(i, m)
    const post = new THREE.CylinderGeometry(0.035, 0.035, SIGN.y + 0.3, 6).translate(
      0,
      (SIGN.y + 0.3) / 2,
      0,
    )
    const back = new THREE.CircleGeometry(SIGN.r, 8, Math.PI / 8)
      .rotateY(Math.PI)
      .translate(0, SIGN.y, 0.02)
    parts.push(tinted(post.applyMatrix4(m), GALV), tinted(back.applyMatrix4(m), 0x9a9a9a))
    pole(ctx, s.x, s.z, SIGN.y, 0.05)
  })
  mesh.castShadow = true
  ctx.scene.add(mesh)
}

/** Traffic signals and stop signs; returns the per-frame update that changes the lights. */
export function buildSignals(ctx: WorldCtx, c: CityLayout): () => void {
  const posts = signalPosts(c)
  const parts = posts.flatMap(postPieces)
  for (const p of posts) pole(ctx, p.x, p.z, POLE_H, 0.16)
  buildStopSigns(ctx, c, parts)
  const metal = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.55,
    metalness: 0.4,
  })
  addMerged(ctx, parts, metal)
  const heads = posts.flatMap((p) => p.heads.map((d) => ({ p, d })))
  const lens = new THREE.CircleGeometry(LENS.r, 12)
  const lenses = new THREE.InstancedMesh(lens, new THREE.MeshBasicMaterial(), heads.length * 3)
  const m = new THREE.Matrix4()
  heads.forEach(({ p, d }, i) => {
    for (let k = 0; k < 3; k++) {
      const local = new THREE.Matrix4().makeTranslation(
        -d,
        HEAD.y + LENS.gap * (1 - k),
        HEAD.d / 2 + 0.005,
      )
      m.makeRotationY(p.yaw).setPosition(p.x, CURB_H, p.z).multiply(local)
      lenses.setMatrixAt(i * 3 + k, m)
      lenses.setColorAt(i * 3 + k, OFF[k])
    }
  })
  ctx.scene.add(lenses)
  const shown: (Light | null)[] = heads.map(() => null)
  return () => {
    heads.forEach(({ p }, i) => {
      const light = lightAt(p.junction, p.phase, signalClock.t)
      if (shown[i] === light) return
      shown[i] = light
      for (let k = 0; k < 3; k++)
        lenses.setColorAt(i * 3 + k, LIGHTS[k] === light ? LIT[k] : OFF[k])
      lenses.instanceColor!.needsUpdate = true
    })
  }
}
