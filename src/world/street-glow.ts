import * as THREE from 'three'
import { CURB_H, type CityLayout } from '../city/layout'
import type { WorldCtx } from './blocks'
import { LAMP_HEIGHT, LAMP_REACH } from './props'

/*
 * Street lighting at night. Every lamp gets a pool of light on the ground: one
 * instanced additive quad, so 800 of them cost a single draw call. Only the few
 * lamps nearest the camera get a real point light, enough to light people and
 * cars walking under them.
 */

const POOL = 15
const REAL_LIGHTS = 4
const LAMP = new THREE.Color(1.0, 0.8, 0.55)

function poolTexture(): THREE.Texture {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(150,150,150,1)')
  grad.addColorStop(1, 'rgba(0,0,0,1)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

export interface StreetGlow {
  update(night: number, focus: THREE.Vector3): void
}

/** One instanced additive quad on the ground under every lamp head. */
function pools(heads: THREE.Vector3[]) {
  const material = new THREE.MeshBasicMaterial({
    map: poolTexture(),
    color: LAMP,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  const geo = new THREE.PlaneGeometry(POOL, POOL).rotateX(-Math.PI / 2)
  const pools = new THREE.InstancedMesh(geo, material, heads.length)
  const m = new THREE.Matrix4()
  heads.forEach((h, i) => pools.setMatrixAt(i, m.makeTranslation(h.x, CURB_H + 0.03, h.z)))
  pools.computeBoundingSphere()
  pools.visible = false
  return { mesh: pools, material }
}

export function buildStreetGlow(
  ctx: WorldCtx,
  c: CityLayout,
  lens: THREE.MeshStandardMaterial,
): StreetGlow {
  const heads = c.lights.map(
    (s) =>
      new THREE.Vector3(
        s.x + Math.sin(s.r) * LAMP_REACH,
        LAMP_HEIGHT,
        s.z + Math.cos(s.r) * LAMP_REACH,
      ),
  )
  const { mesh, material } = pools(heads)
  // Always in the scene, dark by day: adding lights later would recompile every shader.
  const lights = Array.from({ length: REAL_LIGHTS }, () => new THREE.PointLight(LAMP, 0, 24, 1.6))
  ctx.scene.add(mesh, ...lights)
  lens.emissive.copy(LAMP)
  let nearest: THREE.Vector3[] = []
  let frame = 0
  return {
    update(night, focus) {
      // Drawn for the first frames even by day, so its shader compiles while loading.
      mesh.visible = night > 0.01 || frame < 3
      material.color.copy(LAMP).multiplyScalar(0.4 * night)
      lens.emissiveIntensity = 0.05 + 9 * night
      // Re-sort a few times a second; lamps do not move.
      if (frame++ % 20 === 0) {
        nearest = [...heads]
          .sort((a, b) => a.distanceToSquared(focus) - b.distanceToSquared(focus))
          .slice(0, REAL_LIGHTS)
      }
      lights.forEach((l, i) => {
        l.position.copy(nearest[i] ?? focus).setY(LAMP_HEIGHT - 0.4)
        l.intensity = 90 * night
      })
    },
  }
}
