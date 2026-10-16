import type { P2 as P } from '../land/polyline'
import type { RoadGraph } from '../land/road-graph'
import { route } from '../land/route-search'

// Re-plan after the player has moved this far, in meters: often enough to follow turns.
const REROUTE = 10
// Close enough to the waypoint to call it reached.
const ARRIVE = 15

/** The waypoint and the road route to it, kept fresh as the player moves. */
export class Nav {
  target: P | null = null
  /** Road points from near the player to the waypoint, ending at the waypoint itself. */
  path: P[] = []
  private from: P | null = null

  constructor(private readonly roads: RoadGraph) {}

  set(target: P | null): void {
    this.target = target && { x: target.x, z: target.z }
    this.from = null
    this.path = []
  }

  /** Re-plans when the player has moved. Returns true the frame the waypoint is reached. */
  update(p: P): boolean {
    const t = this.target
    if (!t) return false
    if (Math.hypot(p.x - t.x, p.z - t.z) < ARRIVE) {
      this.set(null)
      return true
    }
    if (this.from && Math.hypot(p.x - this.from.x, p.z - this.from.z) < REROUTE) return false
    this.from = { x: p.x, z: p.z }
    this.path = [...route(this.roads, p, t), t]
    return false
  }
}
