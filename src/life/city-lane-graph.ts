import { endOf, leaves } from '../city/junctions'
import { SECTION } from '../city/streets'
import type { LaneEdge } from '../land/lane-graph'
import { connector, turnOf, variants, ways, type City, type Serves, type Way } from './city-lanes'
import { TURN_SPEED } from './lanes'

/*
 * Wires the city's lanes into one directed graph (see city-lanes.ts): every lane variant
 * that ends at a junction is joined to the start of each way out of it that its maneuver
 * serves, through a connector curve. Edges that lead only to dead ends are dropped.
 */

const serves = (s: Serves, turn: string) =>
  turn !== 'hairpin' && (s === 'all' || (s === 'left' ? turn === 'left' : turn !== 'left'))

/** The heading a way arrives at its far junction with, and the one it leaves its near one by. */
function headings(c: City, w: Way) {
  const s = c.net.segments[w.seg]
  const arriving = leaves(s, !w.fwd)
  return { arrive: { x: -arriving.x, z: -arriving.z }, leave: leaves(s, w.fwd) }
}

/** The city lane graph. */
export function cityLaneGraph(c: City): LaneEdge[] {
  const all = ways(c)
  const out = new Map<number, Way[]>()
  for (const w of all) out.set(w.from, [...(out.get(w.from) ?? []), w])
  const exits = (w: Way) => (out.get(w.to) ?? []).filter((o) => o.seg !== w.seg)
  const edges: LaneEdge[] = []
  const lanes = all.map((w) => {
    const h = headings(c, w)
    const left = exits(w).some((o) => turnOf(h.arrive, headings(c, o).leave) === 'left')
    return variants(c, w, left).map((v) => {
      const plan = c.junctions[w.to]
      const held = plan.control === 'signal' || plan.control === 'stop'
      const end = endOf(c.junctions, c.net, w.seg, !w.fwd)
      const stop = held
        ? { junction: w.to, phase: end.phase, signal: plan.control === 'signal' }
        : undefined
      const limit = SECTION[c.net.segments[w.seg].kind].speed
      return { ...v, id: edges.push({ pts: v.pts, limit, next: [], stop }) - 1 }
    })
  })
  all.forEach((w, k) => {
    const h = headings(c, w)
    for (const v of lanes[k]) {
      const order = exits(w)
        .map((o) => ({ o, turn: turnOf(h.arrive, headings(c, o).leave) }))
        .filter((x) => serves(v.serves, x.turn) && lanes[all.indexOf(x.o)].length)
        .sort((a, b) => +(a.turn !== 'straight') - +(b.turn !== 'straight'))
      for (const { o, turn } of order) {
        const to = lanes[all.indexOf(o)]
        const pts = connector(c, v.pts, to[0].pts, turn)
        const limit = turn === 'straight' ? SECTION[c.net.segments[o.seg].kind].speed : TURN_SPEED
        const id = edges.push({ pts, limit, next: to.map((t) => t.id) }) - 1
        edges[v.id].next.push(id)
      }
    }
  })
  return prune(edges)
}

/** Drops edges that lead only to dead ends or that nothing leads into, renumbering the rest. */
function prune(edges: LaneEdge[]): LaneEdge[] {
  const alive = edges.map(() => true)
  for (let changed = true; changed;) {
    changed = false
    const fed = edges.map(() => false)
    edges.forEach((e, i) => alive[i] && e.next.forEach((n) => (fed[n] = true)))
    edges.forEach((e, i) => {
      if (alive[i] && (!fed[i] || !e.next.some((n) => alive[n]))) {
        alive[i] = false
        changed = true
      }
    })
  }
  const index = new Map<number, number>()
  edges.forEach((_, i) => alive[i] && index.set(i, index.size))
  return edges
    .filter((_, i) => alive[i])
    .map((e) => ({ ...e, next: e.next.filter((n) => alive[n]).map((n) => index.get(n)!) }))
}
