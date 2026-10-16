import * as THREE from 'three'
import { heightAt } from '../city/terrain'
import type { MarinaPlan } from '../land/marina-plan'
import type { Land } from '../land/plan'
import { RAPIER } from '../physics'
import { underwaterLight } from '../sea/caustics'
import { addMerged, rectBox, rectCollider, type WorldCtx } from '../world/blocks'

const DECK_THICK = 0.3
const PILE_R = 0.17
const STRINGER = 0.25

const loader = new THREE.TextureLoader()
function deckTexture(name: string, srgb: boolean): THREE.Texture {
  const t = loader.load(`/assets/textures/wood_planks_grey/${name}.jpg`)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  // Five 20 cm planks per tile, running across the pier (along z on its meter UVs).
  t.repeat.set(1, 1)
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** The docks: plank decks on a beam, round piles down to the seabed, and white bollards. */
export function buildMarina(ctx: WorldCtx, land: Land, plan: MarinaPlan): void {
  const top = plan.deckY
  const deck = new THREE.MeshStandardMaterial({
    map: deckTexture('diff', true),
    normalMap: deckTexture('nor_gl', false),
    roughnessMap: deckTexture('rough', false),
    // The scan is dark, wet-looking timber; lifted toward sun-bleached grey.
    color: new THREE.Color(1.55, 1.5, 1.42),
  })
  const timber = underwaterLight(
    new THREE.MeshStandardMaterial({ color: 0x5b4c3d, roughness: 0.85 }),
  )
  addMerged(
    ctx,
    plan.decks.map((r) => rectBox(r, top - DECK_THICK, top)),
    deck,
  )
  for (const r of plan.decks) rectCollider(ctx, r, top - DECK_THICK, top)
  // The beam under each deck edge hides the gap between the planks and the piles.
  const beams = plan.decks.flatMap((r) => {
    const long = r.x1 - r.x0 > r.z1 - r.z0
    const edges = long
      ? [
          { ...r, z1: r.z0 + STRINGER },
          { ...r, z0: r.z1 - STRINGER },
        ]
      : [
          { ...r, x1: r.x0 + STRINGER },
          { ...r, x0: r.x1 - STRINGER },
        ]
    return edges.map((e) => rectBox(e, top - DECK_THICK - 0.3, top - DECK_THICK))
  })
  addMerged(ctx, beams, timber)
  addMerged(
    ctx,
    plan.piles.map((p) => pile(ctx, land, p, top)),
    timber,
  )
  const white = new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.4, metalness: 0.1 })
  addMerged(
    ctx,
    plan.bollards.flatMap((b) => bollard(b, top)),
    white,
  )
}

/** One pile from below the seabed to the deck top, with its collider. */
function pile(ctx: WorldCtx, land: Land, p: { x: number; z: number }, top: number) {
  const floor = heightAt(land, p.x, p.z) - 0.5
  const h = top + 0.1 - floor
  const desc = RAPIER.ColliderDesc.cylinder(h / 2, PILE_R).setTranslation(p.x, floor + h / 2, p.z)
  ctx.physics.createCollider(desc)
  return new THREE.CylinderGeometry(PILE_R, PILE_R * 1.1, h, 10).translate(p.x, floor + h / 2, p.z)
}

/** A short mooring post with a cap, standing on the deck edge. */
function bollard(b: { x: number; z: number }, top: number): THREE.BufferGeometry[] {
  return [
    new THREE.CylinderGeometry(0.11, 0.13, 0.35, 12).translate(b.x, top + 0.175, b.z),
    new THREE.CylinderGeometry(0.16, 0.16, 0.06, 12).translate(b.x, top + 0.38, b.z),
  ]
}
