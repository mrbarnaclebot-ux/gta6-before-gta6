import * as THREE from 'three'
import { SEA_LEVEL } from '../city/layout'
import { NORMALS } from './water'

// Fog hides everything past about 50 m, so the underside only has to cover the play area.
const EXTENT = 4000
const RIPPLE = 5

/**
 * The surface seen from below: three's Water is single-sided and invisible
 * from underneath, so a bright rippled sheet stands in. The reflective top is
 * hidden while the camera is under, which also skips its reflection render.
 */
export function buildUnderwater(
  scene: THREE.Scene,
  surface: THREE.Object3D,
  isWater: (x: number, z: number) => boolean,
) {
  // The normal map's green channel doubles as a ripple pattern for the alpha.
  const ripples = new THREE.TextureLoader().load(NORMALS)
  ripples.wrapS = ripples.wrapT = THREE.RepeatWrapping
  ripples.repeat.setScalar(EXTENT / RIPPLE)
  ripples.anisotropy = 8
  const under = new THREE.Mesh(
    new THREE.PlaneGeometry(EXTENT, EXTENT).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color: 0xa8f0e6,
      alphaMap: ripples,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
    }),
  )
  under.position.set(surface.position.x, SEA_LEVEL, surface.position.z)
  under.visible = false
  scene.add(under)

  return {
    get active() {
      return under.visible
    },
    update(camera: THREE.Camera, dt: number) {
      ripples.offset.x += dt * 0.02
      const p = camera.position
      const below = p.y < SEA_LEVEL && isWater(p.x, p.z)
      surface.visible = !below
      under.visible = below
    },
  }
}
