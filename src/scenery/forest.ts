import * as THREE from 'three'
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Grounded } from '../city/layout'
import { surfaceAt } from '../city/terrain'
import { forestAt } from '../land/districts'
import type { Flora } from '../land/flora'
import type { Land } from '../land/plan'
import { GARDEN_TRUNK, ROCK_SPREAD, TRUNK } from '../land/plant'
import { RAPIER } from '../physics'
import { matteCard } from '../render/card-normals'
import { swaying } from '../render/foliage'
import type { WorldCtx } from '../world/blocks'
import { impostor } from '../world/impostor'
import { modelParts, type Part } from '../world/instancing'
import { thinCards } from './thin-cards'
import { instanceByDistance } from '../world/lod-instances'

/*
 * The trees, bushes, and rocks outside the city. Trees are Poly Haven scans baked into
 * card trees (a few thousand triangles); past NEAR they become 4-triangle impostors, so
 * the forest reads dense from the hills at one draw call per chunk and variant.
 */

const DIR = '/assets/models/vegetation/'
const TREES = {
  conifers: ['fir_a.glb', 'fir_b.glb'],
  broadleaf: ['jacaranda.glb', 'island_tree_01.glb'],
  garden: ['island_tree_02.glb', 'tree_small_02.glb'],
}
// One file, one node per bush (scripts/compress-assets.mjs merges them: they share textures).
const BUSHES = ['bush_a', 'bush_b', 'bush_c', 'bush_d']
const ROCKS = ['rocks_moss_01.glb', 'rocks_moss_02.glb']
/**
 * Full card trees within NEAR (times the render distance's plant reach), the same cards on
 * a trunk of a few hundred triangles within MID, impostors beyond.
 */
const NEAR = 60
const MID = 130
const BUSH_RANGE = 120
/** Impostor chunks: about a ninth of the map each. */
const FAR_CHUNK = 800
/** Deep in the woods at ground level, trunks hide everything past this: it is not drawn. */
const WOODS_SIGHT = 350
const ROCK_RANGE = 450

type Update = (eye: THREE.Vector3, reach?: number, cap?: number) => void
type Load = (url: string) => Promise<GLTF>

/** Splits spots across variants by index, so neighbors rarely match. */
const share = <T>(spots: T[], n: number, i: number) => spots.filter((_, k) => k % n === i)

// The baked cards are unlit albedo seen in full sun; in game they also catch the bright sky,
// so they read pale. Deeper, warmer greens, closer to the reference shots.
const LEAF_TONE = new THREE.Color(0.5, 0.66, 0.36)

// No flutter on tree cards: thousands of them per tree made it the forest's biggest cost.
const LEAVES = { bend: 0.012, flutter: 0, translucent: 0.35 }
const BARK = { bend: 0.012, flutter: 0, translucent: 0 }
// The island tree's scanned bark is a cool pale grey that read blue-white among the browns.
const BARK_TONE: Record<string, THREE.Color> = {
  island_tree_01: new THREE.Color(0.7, 0.64, 0.56),
}

/**
 * Makes every leaf card in a loaded model matte and deeper green, and sets leaves and bark
 * swaying in the wind (once per file).
 */
function toneLeaves(scene: THREE.Object3D) {
  const done = new Set<THREE.Material>()
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh
    const mat = mesh.material as THREE.MeshStandardMaterial | undefined
    if (!mat || done.has(mat)) return
    if (mat.name !== 'foliage_cards') {
      if (mat.name in BARK_TONE) mat.color.copy(BARK_TONE[mat.name])
      done.add(swaying(mat, BARK))
      return
    }
    const m = swaying(matteCard(mat), LEAVES)
    m.color.copy(LEAF_TONE)
    done.add(m)
    mesh.material = m
  })
}

/**
 * A tree file holds `bark`, `lite` (the same trunk, far simpler), and `foliage` (the cards).
 * Near: bark and every card. Mid: the lite trunk and half the cards, grown to fill in. The
 * impostor is baked from the lite trunk with every card.
 */
function treeLevels(scene: THREE.Object3D): { near: Part[]; mid: Part[]; bake: Part[] } {
  toneLeaves(scene)
  const height = new THREE.Box3().setFromObject(scene).max.y
  const parts = (name: string) => modelParts(scene.getObjectByName(name)!, true, height)
  const [bark, lite, cards] = [parts('bark'), parts('lite'), parts('foliage')]
  const thin = cards.map((p) => ({ ...p, geometry: thinCards(p.geometry) }))
  return { near: [...bark, ...cards], mid: [...lite, ...thin], bake: [...lite, ...cards] }
}

/**
 * Far impostors drawn a little fuller than the tree: two cards show less of the crown than
 * the cards they stand in for, and the hillside showed through between them.
 */
const fuller = (parts: Part[]) =>
  parts.map((p) => ({ ...p, geometry: p.geometry.clone().scale(1.3, 1.08, 1.3) }))

async function trees(ctx: WorldCtx, gl: THREE.WebGLRenderer, load: Load, flora: Flora) {
  const updates: Update[] = []
  for (const [kind, files] of Object.entries(TREES) as [keyof typeof TREES, string[]][]) {
    const models = await Promise.all(files.map((f) => load(DIR + f)))
    models.forEach((m, i) => {
      const { near, mid, bake } = treeLevels(m.scene)
      const place = {
        scale: (s: Grounded) => s.s,
        ranges: [NEAR, MID],
        shadowLevels: 1,
        farChunk: FAR_CHUNK,
      }
      const spots = share(flora[kind], models.length, i)
      updates.push(instanceByDistance(ctx, [near, mid, fuller(impostor(gl, bake))], spots, place))
    })
  }
  return updates
}

async function bushes(ctx: WorldCtx, load: Load, flora: Flora) {
  const file = await load(DIR + 'bushes.glb')
  toneLeaves(file.scene)
  const place = { scale: (s: Grounded) => s.s, ranges: [BUSH_RANGE] }
  return BUSHES.map((name, i) => {
    const spots = share(flora.bushes, BUSHES.length, i)
    const parts = modelParts(file.scene.getObjectByName(name)!, true)
    return instanceByDistance(ctx, [parts, []], spots, place)
  })
}

async function rocks(ctx: WorldCtx, load: Load, flora: Flora) {
  const models = await Promise.all(ROCKS.map((f) => load(DIR + f)))
  const variants: Part[][] = models.flatMap((m) => m.scene.children.map((c) => modelParts(c)))
  const place = { scale: (s: Grounded) => s.s, ranges: [ROCK_RANGE] }
  return variants.map((parts, i) =>
    instanceByDistance(ctx, [parts, []], share(flora.rocks, variants.length, i), place),
  )
}

/** Trunks and big rocks block the way; bushes do not. */
function colliders(ctx: WorldCtx, flora: Flora) {
  const trunk = (t: Grounded, radius: number) => {
    const desc = RAPIER.ColliderDesc.cylinder(2, radius)
    ctx.colliders.add(desc.setTranslation(t.x, t.y + 2, t.z))
  }
  for (const t of flora.conifers) trunk(t, Math.max(0.2, TRUNK * t.s))
  // The broadleaves fork low into thick limbs: the camera should stop short of them.
  for (const t of flora.broadleaf) trunk(t, 0.05 * t.s)
  for (const t of flora.garden) trunk(t, GARDEN_TRUNK * t.s)
  for (const r of flora.rocks.filter((q) => q.s > 0.8)) {
    const body = RAPIER.ColliderDesc.cylinder(r.s / 2, r.s * ROCK_SPREAD * 0.55)
    ctx.colliders.add(body.setTranslation(r.x, r.y + r.s / 2, r.z))
  }
}

/** Plants the forest, the copses, the gardens, the undergrowth, and the rocks. */
export async function buildForest(
  ctx: WorldCtx,
  gl: THREE.WebGLRenderer,
  load: Load,
  land: Land,
  flora: Flora,
): Promise<Update> {
  const updates = [
    ...(await trees(ctx, gl, load, flora)),
    ...(await bushes(ctx, load, flora)),
    ...(await rocks(ctx, load, flora)),
  ]
  colliders(ctx, flora)
  return (eye, reach) => {
    const low = eye.y - surfaceAt(land, eye.x, eye.z) < 20
    const cap = low && forestAt(eye.x, eye.z) > 0.6 ? WOODS_SIGHT : Infinity
    updates.forEach((u) => u(eye, reach, cap))
  }
}
