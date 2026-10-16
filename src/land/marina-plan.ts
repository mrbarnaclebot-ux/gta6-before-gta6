import type { Rect } from '../city/layout'
import { SEA_LEVEL } from '../city/layout'
import { heightAt } from '../city/terrain'
import type { Land } from './plan'
import { coastX } from './shape'

/** A boat's mooring: its waterline spot and heading (yaw 0 faces +z). */
export interface BoatSpot {
  x: number
  y: number
  z: number
  yaw: number
}

export interface MarinaPlan {
  /** Deck slabs in plan; each stands from the water up to `deckY`. */
  decks: Rect[]
  deckY: number
  piles: { x: number; z: number }[]
  bollards: { x: number; z: number }[]
  /** Boats tied up at the docks, then one anchored off the beach and one in the canal. */
  boats: BoatSpot[]
  /** A spot on the T-head beside a boat with open water ahead of it, for tests. */
  dock: { x: number; y: number; z: number }
  /** The strip of beach the pier crosses: props keep out of it. */
  zone: Rect
}

/** The pier runs east into the sea south of the spawn beach, out past the surf. */
const PIER_Z = -150
const PIER_HALF = 1.6
const END = 545
/** The T-head across the pier's end. */
const HEAD = { depth: 3.4, half: 22 }
const DECK_Y = 0.25
/** Boat center to deck edge: a 1.25 m half beam, clear of the piles on the edge. */
const OFF_EDGE = 1.55
const ALONGSIDE = PIER_HALF + OFF_EDGE
const PILE_GAP = 4

/** The marina: a pier with a T-head, boats on both sides, and two boats elsewhere. */
export function planMarina(land: Land): MarinaPlan {
  const ground = (x: number, z: number) => heightAt(land, x, z)
  // The deck starts where the sand falls below it, so one walks straight on from the beach.
  let start = coastX(land.frame, PIER_Z)
  while (ground(start, PIER_Z) > DECK_Y - 0.15) start += 1
  const pier: Rect = { x0: start, x1: END, z0: PIER_Z - PIER_HALF, z1: PIER_Z + PIER_HALF }
  const head: Rect = {
    x0: END,
    x1: END + HEAD.depth,
    z0: PIER_Z - HEAD.half,
    z1: PIER_Z + HEAD.half,
  }
  const boats: BoatSpot[] = []
  const tie = (x: number, z: number, yaw: number) => boats.push({ x, y: SEA_LEVEL, z, yaw })
  for (const x of [478, 512]) for (const s of [-1, 1]) tie(x, PIER_Z + s * ALONGSIDE, Math.PI / 2)
  for (const s of [-1, 1]) tie(head.x1 + OFF_EDGE, PIER_Z + s * 12, s > 0 ? 0 : Math.PI)
  // One anchored off the spawn beach, one in the canal between its bridges.
  const mid = land.zRoads[Math.floor(land.zRoads.length / 2)]
  tie(472, mid + 22, -2.2)
  tie((land.canal.x0 + land.canal.x1) / 2 + 6, mid + 45, 0)
  return {
    decks: [pier, head],
    deckY: DECK_Y,
    piles: [...edgePiles(pier, 'x'), ...edgePiles(head, 'z')],
    bollards: boats.slice(0, 6).map((b) => bollard(b, pier, head)),
    boats,
    dock: { x: head.x1 - 0.6, y: DECK_Y, z: boats[4].z },
    zone: { x0: start - 12, x1: END, z0: PIER_Z - 8, z1: PIER_Z + 8 },
  }
}

/** Piles along both long edges of a deck, every few meters. */
function edgePiles(r: Rect, along: 'x' | 'z'): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = []
  const [a0, a1] = along === 'x' ? [r.x0, r.x1] : [r.z0, r.z1]
  for (let a = a0 + 1; a <= a1; a += PILE_GAP) {
    for (const edge of along === 'x' ? [r.z0, r.z1] : [r.x0, r.x1]) {
      out.push(along === 'x' ? { x: a, z: edge } : { x: edge, z: a })
    }
  }
  return out
}

/** The bollard on the deck edge nearest a moored boat. */
function bollard(b: BoatSpot, pier: Rect, head: Rect): { x: number; z: number } {
  if (b.x > head.x1) return { x: head.x1 - 0.3, z: b.z }
  return { x: b.x, z: b.z < PIER_Z ? pier.z0 + 0.3 : pier.z1 - 0.3 }
}

/** True inside the marina's beach strip. */
export const inMarina = (zone: Rect, x: number, z: number) =>
  x > zone.x0 && x < zone.x1 && z > zone.z0 && z < zone.z1
