import * as THREE from 'three'
import type { MarinaPlan } from '../land/marina-plan'
import { RAPIER } from '../physics'
import { poolTexture } from '../world/street-glow'
import { addMerged, type WorldCtx } from '../world/blocks'

const POST = 1.05
const WARM = new THREE.Color(1, 0.78, 0.5)

/**
 * Low lamps along the pier: dark posts with warm globes that bloom at night, and a pool of
 * light on the planks under each. No real lights: the boardwalk reads lit at no shader cost.
 */
export function buildDockLights(ctx: WorldCtx, plan: MarinaPlan) {
  const top = plan.deckY
  const posts = plan.lamps.map((l) =>
    new THREE.CylinderGeometry(0.05, 0.07, POST, 8).translate(l.x, top + POST / 2, l.z),
  )
  for (const l of plan.lamps) {
    const post = RAPIER.ColliderDesc.cylinder(POST / 2, 0.08).setTranslation(
      l.x,
      top + POST / 2,
      l.z,
    )
    ctx.physics.createCollider(post)
  }
  const iron = new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.5, metalness: 0.6 })
  addMerged(ctx, posts, iron)
  const glass = new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: WARM, roughness: 0.3 })
  const globes = plan.lamps.map((l) =>
    new THREE.SphereGeometry(0.13, 12, 8).translate(l.x, top + POST + 0.1, l.z),
  )
  addMerged(ctx, globes, glass, { cast: false, receive: false })
  const { pool, pools } = buildPools(ctx, plan)
  return (night: number) => {
    glass.emissiveIntensity = 0.2 + 5 * night
    pool.opacity = 0.3 * night
    pools.visible = night > 0.01
  }
}

/** The warm light on the planks under each lamp, as additive quads (no real lights). */
function buildPools(ctx: WorldCtx, plan: MarinaPlan) {
  const pool = new THREE.MeshBasicMaterial({
    map: poolTexture(),
    color: WARM,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  })
  const quads = plan.lamps.map(({ pool: r }) =>
    new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0)
      .rotateX(-Math.PI / 2)
      .translate((r.x0 + r.x1) / 2, plan.deckY + 0.02, (r.z0 + r.z1) / 2),
  )
  return { pool, pools: addMerged(ctx, quads, pool, { cast: false, receive: false })! }
}
