/**
 * The Blender house models (assets-src/blender/houses.py), by index: each one's main block
 * (w across the front, d deep, in meters), its floors, and what stands outside the block.
 * Every model's garage door is at x = w / 2 - 2.2, where the driveway meets it.
 */
export interface HouseDesign {
  name: string
  w: number
  d: number
  floors: 1 | 2
  /** A pool on a raised deck behind the house. */
  pool: boolean
  /** A low wall or picket fence along the front yard, 6 m out from the front wall. */
  frontWall: boolean
}

export const HOUSE_DESIGNS: HouseDesign[] = [
  { name: 'ranch', w: 14, d: 10, floors: 1, pool: false, frontWall: false },
  { name: 'mediterranean', w: 13, d: 10, floors: 2, pool: false, frontWall: false },
  { name: 'modern', w: 13, d: 11, floors: 2, pool: true, frontWall: false },
  { name: 'deco', w: 12, d: 10, floors: 1, pool: false, frontWall: true },
  { name: 'keywest', w: 12, d: 9, floors: 1, pool: false, frontWall: true },
  { name: 'spanish', w: 14, d: 11, floors: 2, pool: true, frontWall: true },
]

/**
 * The hillside villas' designs, picked by seed: the two with their own pool. The
 * Mediterranean, with a stand-in pool, looked small and plain on a villa's big terrace.
 */
export const VILLA_DESIGNS = [2, 5]
