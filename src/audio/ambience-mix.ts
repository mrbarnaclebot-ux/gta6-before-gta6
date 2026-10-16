/*
 * Which background loops play where, as pure weights: city traffic by day and cicadas by
 * night, surf and gulls on the coast, the marina by the pier, wind up the hills, birds in
 * the forest, and only the deep hum under water.
 */

export type Bed = 'city' | 'night' | 'beach' | 'marina' | 'wind' | 'forest' | 'underwater'
export const BEDS: Bed[] = ['city', 'night', 'beach', 'marina', 'wind', 'forest', 'underwater']

export interface Place {
  /** Meters inland of where the beach starts; negative on the sand or out at sea. */
  inland: number
  /** Meters to the marina pier. */
  marina: number
  /** Meters above sea level. */
  height: number
  /** 0 to 1, how deep in the forest. */
  forest: number
  /** 0 by day, 1 at night. */
  night: number
  underwater: boolean
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** Loop volumes, 0 to 1. Overlapping beds share their loudness so crossings never swell. */
export function bedWeights(p: Place): Record<Bed, number> {
  const w: Record<Bed, number> = {
    city: 0,
    night: 0,
    beach: 0,
    marina: 0,
    wind: 0,
    forest: 0,
    underwater: 0,
  }
  if (p.underwater) return { ...w, underwater: 1 }
  const coast = 1 - smooth(10, 120, p.inland)
  // Out at sea the town falls away behind you.
  const offshore = smooth(-30, -220, p.inland)
  const marina = 1 - smooth(40, 110, p.marina)
  const hill = smooth(18, 55, p.height)
  const forest = p.forest * (1 - hill * 0.5)
  const land = (1 - coast * 0.6) * (1 - forest) * (1 - hill) * (1 - offshore)
  w.beach = coast * (1 - marina)
  w.marina = marina
  w.wind = hill * (1 - coast)
  w.forest = forest * (1 - p.night)
  w.city = land * (1 - p.night)
  // Cicadas take over from traffic at night, in town and in the trees.
  w.night = (land + forest) * p.night
  const total = Object.values(w).reduce((a, b) => a + b, 0)
  if (total > 1) for (const k of BEDS) w[k] /= total
  // Equal power: two half-weighted loops together sound as loud as one at full.
  for (const k of BEDS) w[k] = Math.sqrt(w[k])
  return w
}
