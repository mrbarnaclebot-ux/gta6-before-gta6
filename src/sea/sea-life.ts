import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { RAPIER } from '../physics'
import type { WorldCtx } from '../world/blocks'
import { DETAIL_LAYER, instanceParts, modelParts, type Part } from '../world/instancing'
import type { V3 } from './boids'
import { underwaterLight } from './caustics'
import { buildFish } from './fish'
import { buildRays } from './rays'
import type { ReefPlan } from './reef-plan'
import { corals, kelp, seagrass, swayMaterial } from './seabed-models'

const ROCKS = '/assets/models/vegetation/rocks_moss_01.glb'
const CORAL_TINTS = [0xff7f6e, 0xffa347, 0xb57edc, 0xf2e86d, 0x5fd3c6, 0xe85d8a, 0xff9fb0]
// Past this the sea life is hidden and stops swimming: nobody sees the reefs from inland.
const SHOW_RANGE = 320

type Load = (url: string) => Promise<GLTF>

const tinted = <T extends { tint?: number }>(spots: T[], tints: number[]) =>
  spots.map((s, i) => ({ ...s, tint: tints[(i * 5 + 3) % tints.length] }))

/** Seagrass, kelp, corals, and rocks on the floor; surf rocks collide. */
async function seabed(ctx: WorldCtx, plan: ReefPlan, load: Load): Promise<void> {
  const one = (s: { s: number }) => s.s
  const grass: Part = { geometry: seagrass(), material: swayMaterial(0.16, 1.3) }
  instanceParts(ctx, [grass], plan.grass, { scale: one })
  const weed: Part = { geometry: kelp(), material: swayMaterial(0.09, 0.7) }
  instanceParts(ctx, [weed], plan.kelp, { scale: one })
  const coralMat = underwaterLight(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide }),
  )
  corals().forEach((geometry, kind) => {
    const spots = tinted(
      plan.coral.filter((c) => c.kind === kind),
      CORAL_TINTS,
    )
    instanceParts(ctx, [{ geometry, material: coralMat }], spots, { scale: one })
  })
  const variants = (await load(ROCKS)).scene.children.slice(0, 3).map((c) => modelParts(c))
  variants.flat().forEach((p) => underwaterLight(p.material))
  const algae = tinted([...plan.rocks, ...plan.surfRocks], [0x8a9a78, 0x9a9070, 0x7f8f84])
  variants.forEach((parts, k) => {
    const spots = algae.filter((_, i) => i % variants.length === k)
    instanceParts(ctx, parts, spots, { scale: one })
  })
  for (const r of plan.surfRocks) {
    const body = RAPIER.ColliderDesc.cylinder(r.s / 2, r.s * 0.45)
    ctx.physics.createCollider(body.setTranslation(r.x, r.y + r.s / 2, r.z))
  }
}

/** Every sea creature and plant; returns the per-frame update. */
export async function buildSeaLife(
  ctx: WorldCtx,
  plan: ReefPlan,
  load: Load,
  world: { floor: (x: number, z: number) => number; surface: number },
) {
  const group = new THREE.Group()
  ctx.scene.add(group)
  await seabed({ ...ctx, scene: group as unknown as THREE.Scene }, plan, load)
  const fish = buildFish(group, plan.reefs, world)
  const rays = buildRays(group, plan.reefs)
  // Detail layer: the sea mirror and the sun's shadow map skip it all.
  group.traverse((o) => o.layers.set(DETAIL_LAYER))
  const near = (eye: THREE.Vector3) =>
    plan.reefs.some((r) => Math.hypot(r.x - eye.x, r.z - eye.z) < SHOW_RANGE)
  return {
    fish,
    reefs: plan.reefs,
    update(dt: number, eye: THREE.Vector3, threat: V3 | null) {
      group.visible = near(eye)
      if (!group.visible) return
      fish.update(dt, eye, threat)
      rays.update(dt)
    },
  }
}
