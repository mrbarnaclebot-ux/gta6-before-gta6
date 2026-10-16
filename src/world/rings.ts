/*
 * Square world tiles that stream in rings around a few focus points (the player, the camera):
 * a tile loads once any focus comes within `load` meters of it and unloads only past
 * `unload`, so driving along a tile border does not load and drop the same tile every frame.
 */

export type P = { x: number; z: number }

export interface Tile {
  key: string
  i: number
  j: number
}

export const tileIndex = (v: number, size: number) => Math.floor(v / size)
export const tileKey = (i: number, j: number) => `${i},${j}`

/** Distance from p to the nearest point of tile (i, j); 0 inside it. */
export function tileDistance(i: number, j: number, size: number, p: P): number {
  const dx = Math.max(i * size - p.x, 0, p.x - (i + 1) * size)
  const dz = Math.max(j * size - p.z, 0, p.z - (j + 1) * size)
  return Math.hypot(dx, dz)
}

const nearest = (t: Tile, size: number, foci: P[]) =>
  Math.min(...foci.map((p) => tileDistance(t.i, t.j, size, p)))

/**
 * Which tiles to load (nearest first, with their distance) and which to drop, given what is
 * loaded now. Requires load <= unload.
 */
export function ringPlan(
  tiles: Iterable<Tile>,
  loaded: ReadonlySet<string>,
  foci: P[],
  size: number,
  radius: { load: number; unload: number },
): { load: { key: string; d: number }[]; unload: string[] } {
  const load: { key: string; d: number }[] = []
  const unload: string[] = []
  for (const t of tiles) {
    const d = nearest(t, size, foci)
    if (!loaded.has(t.key) && d <= radius.load) load.push({ key: t.key, d })
    else if (loaded.has(t.key) && d > radius.unload) unload.push(t.key)
  }
  load.sort((a, b) => a.d - b.d)
  return { load, unload }
}
