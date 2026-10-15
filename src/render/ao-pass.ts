import type * as THREE from 'three'
import { N8AOPostPass } from 'n8ao'

/** Half-resolution ambient occlusion tuned for the city's scale. */
export function aoPass(
  scene: THREE.Scene,
  camera: THREE.Camera,
  w: number,
  h: number,
): N8AOPostPass {
  const ao = new N8AOPostPass(scene, camera, w, h)
  ao.configuration.aoRadius = 1.6
  ao.configuration.distanceFalloff = 0.6
  ao.configuration.intensity = 2.2
  ao.configuration.halfRes = true
  ao.setQualityMode('Medium')
  // The transparent sea would switch on N8AO's transparency mode: two more scene renders a
  // frame, each re-drawing the water's reflection. AO on the water itself is invisible.
  // Auto-detect goes off first so a sea added after this pass cannot switch it back on.
  ao.autoDetectTransparency = false
  ao.configuration.transparencyAware = false
  return ao
}
