/*
 * Traffic light timing, pure. Every signalized junction runs the same two-phase cycle:
 * the main line green, amber, all red, then the cross street the same. Each junction starts
 * at its own offset, so the city's lights do not all change at once.
 */

export type Light = 'green' | 'amber' | 'red'

export const TIMING = { green: 14, amber: 3, clear: 2 }
export const CYCLE = 2 * (TIMING.green + TIMING.amber + TIMING.clear)

/** Seconds into the cycle at junction `id`, time `t`. */
const phaseTime = (id: number, t: number) => (((t + id * 7.31) % CYCLE) + CYCLE) % CYCLE

/** The light that traffic of `phase` (0 the main line, 1 the cross street) sees at junction `id`. */
export function lightAt(id: number, phase: 0 | 1, t: number): Light {
  const half = CYCLE / 2
  const u = (phaseTime(id, t) - phase * half + CYCLE) % CYCLE
  if (u < TIMING.green) return 'green'
  if (u < TIMING.green + TIMING.amber) return 'amber'
  return 'red'
}

/** People may step out across a street of `phase` when its traffic has a red that lasts `need` seconds more. */
export function mayCross(id: number, phase: 0 | 1, t: number, need: number): boolean {
  return lightAt(id, phase, t) === 'red' && lightAt(id, phase, t + need) === 'red'
}

/** Seconds of signal time, advanced by the living city each frame; lights and people read it. */
export const signalClock = { t: 0 }
