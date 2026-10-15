import type * as THREE from 'three'

/** People and traffic cast shadows only this close to the player: each is 30k+ triangles per cascade. */
export const ACTOR_SHADOW_RANGE = 40

/**
 * Turns shadow casting on or off for every mesh under `root`, walking the tree only when
 * the state flips. Whoever swaps meshes under a root clears `userData.castShadow`.
 */
export function castShadows(root: THREE.Object3D, on: boolean): void {
  if (root.userData.castShadow === on) return
  root.userData.castShadow = on
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = on
  })
}
