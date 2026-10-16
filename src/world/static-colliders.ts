import type RAPIER_NS from '@dimforge/rapier3d-compat'
import type { PhysicsWorld } from '../physics'
import { ringPlan, tileIndex, tileKey, type P, type Tile } from './rings'

type Desc = RAPIER_NS.ColliderDesc
type Collider = RAPIER_NS.Collider

/** Tile side: about one city block; 40k trunk colliders split into a few hundred tiles. */
export const COLLIDER_TILE = 128
// Load a tile once a focus is this close to it, drop it past UNLOAD (hysteresis).
// Only the player and the camera are foci, so people, traffic, and bullets past about 180 m
// from them meet no trunks or buildings.
const RADIUS = { load: 180, unload: 260 }
/** Tiles this close are built at once whatever the budget: nothing to fall through after a teleport. */
const NOW = 48
/** Colliders created per frame for tiles further out, so streaming never costs a long frame. */
const BUDGET = 400
// Re-plan when a focus has moved this far: often enough at highway speed, rare on foot.
const REPLAN = 8

interface ColliderTile extends Tile {
  descs: Desc[]
  live: Collider[]
}

/**
 * Small static colliders (trunks, rocks, lamp posts, buildings, houses) exist only in tiles
 * near the player and the camera. Big ones (the terrain, roads, sea walls) stay global.
 */
export class StaticColliders {
  private readonly tiles = new Map<string, ColliderTile>()
  private readonly loaded = new Set<string>()
  private queue: string[] = []
  private last: P[] = []

  constructor(private readonly physics: PhysicsWorld) {}

  /** Registers a fixed collider; it is created when its tile streams in. */
  add(desc: Desc): void {
    const { x, z } = desc.translation
    const i = tileIndex(x, COLLIDER_TILE)
    const j = tileIndex(z, COLLIDER_TILE)
    const key = tileKey(i, j)
    let t = this.tiles.get(key)
    if (!t) this.tiles.set(key, (t = { key, i, j, descs: [], live: [] }))
    t.descs.push(desc)
  }

  /** Colliders alive now, and how many tiles are in. */
  get stats() {
    let live = 0
    for (const k of this.loaded) live += this.tiles.get(k)!.live.length
    return { colliders: live, tiles: this.loaded.size, queued: this.queue.length }
  }

  /** Live streamed colliders within r meters (in plan) of (x, z): for tests. */
  countNear(x: number, z: number, r: number): number {
    let n = 0
    for (const k of this.loaded) {
      for (const c of this.tiles.get(k)!.live) {
        const t = c.translation()
        if (Math.hypot(t.x - x, t.z - z) < r) n++
      }
    }
    return n
  }

  /** True while tiles in range are still waiting to be built. */
  get busy(): boolean {
    return this.queue.length > 0
  }

  /** Call every frame, before the physics step, with where the player and camera are. */
  update(foci: P[]): void {
    const moved = foci.some((p, k) => !this.last[k] || dist(p, this.last[k]) > REPLAN)
    if (moved) this.replan(foci)
    let budget = BUDGET
    while (this.queue.length && budget > 0) {
      const t = this.tiles.get(this.queue.shift()!)!
      this.build(t)
      budget -= t.descs.length
    }
  }

  private replan(foci: P[]): void {
    this.last = foci.map((p) => ({ x: p.x, z: p.z }))
    const plan = ringPlan(this.tiles.values(), this.loaded, foci, COLLIDER_TILE, RADIUS)
    for (const key of plan.unload) this.drop(this.tiles.get(key)!)
    this.queue = []
    for (const { key, d } of plan.load) {
      if (d <= NOW) this.build(this.tiles.get(key)!)
      else this.queue.push(key)
    }
  }

  private build(t: ColliderTile): void {
    if (this.loaded.has(t.key)) return
    t.live = t.descs.map((d) => this.physics.createCollider(d))
    this.loaded.add(t.key)
  }

  private drop(t: ColliderTile): void {
    for (const c of t.live) this.physics.removeCollider(c, false)
    t.live = []
    this.loaded.delete(t.key)
  }
}

const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.z - b.z)
