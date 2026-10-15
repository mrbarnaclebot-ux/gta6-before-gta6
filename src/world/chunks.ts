/**
 * Static world content is grouped into square chunks so each merged or instanced
 * mesh has a tight bounding sphere and three.js can frustum-cull whole chunks.
 */
export const CHUNK = 250

export function groupByChunk<T extends { x: number; z: number }>(items: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>()
  for (const item of items) {
    const key = `${Math.floor(item.x / CHUNK)},${Math.floor(item.z / CHUNK)}`
    const list = out.get(key)
    if (list) list.push(item)
    else out.set(key, [item])
  }
  return out
}
