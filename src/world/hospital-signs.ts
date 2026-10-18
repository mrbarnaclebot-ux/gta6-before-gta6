import * as THREE from 'three'
import { CURB_H } from '../city/layout'
import { RAPIER } from '../physics'
import type { WorldCtx } from './blocks'

const POST_H = 3.2
const PANEL = 1.4

/** White panel with a red cross, lit from inside at night. */
function signTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#f4f6f7'
  g.fillRect(0, 0, 128, 128)
  g.fillStyle = '#d3202f'
  g.fillRect(48, 18, 32, 92)
  g.fillRect(18, 48, 92, 32)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** A lightbox sign at each hospital's respawn point; returns the panel material for night glow. */
export function buildHospitalSigns(
  ctx: WorldCtx,
  spots: { x: number; z: number; yaw: number }[],
): THREE.MeshStandardMaterial {
  const map = signTexture()
  const panel = new THREE.MeshStandardMaterial({
    map,
    emissiveMap: map,
    emissive: 0xffffff,
    emissiveIntensity: 0.1,
    roughness: 0.35,
  })
  const post = new THREE.MeshStandardMaterial({ color: 0x9a9fa3, metalness: 0.8, roughness: 0.4 })
  const postGeo = new THREE.CylinderGeometry(0.06, 0.06, POST_H, 8).translate(0, POST_H / 2, 0)
  const panelGeo = new THREE.BoxGeometry(PANEL, PANEL, 0.16).translate(0, POST_H + PANEL / 2, 0)
  for (const s of spots) {
    // On the curb side of the respawn point, a little along the street, facing it.
    const out = { x: Math.sin(s.yaw), z: Math.cos(s.yaw) }
    const at = new THREE.Vector3(
      s.x + out.x * 0.7 + out.z * 2,
      CURB_H,
      s.z + out.z * 0.7 - out.x * 2,
    )
    for (const [geo, mat] of [
      [postGeo, post],
      [panelGeo, panel],
    ] as const) {
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.copy(at)
      mesh.rotation.y = s.yaw
      mesh.castShadow = true
      ctx.scene.add(mesh)
    }
    const desc = RAPIER.ColliderDesc.cylinder(POST_H / 2, 0.1)
    ctx.physics.createCollider(desc.setTranslation(at.x, at.y + POST_H / 2, at.z))
  }
  return panel
}
