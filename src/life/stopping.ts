/*
 * How fast a traffic driver may go and still stop short of what is in front: the player, a
 * person, another car. Pure, so the braking can be checked without a scene.
 */

/** Something a driver must not hit: its ground position and rough radius. */
export interface Obstacle {
  x: number
  y: number
  z: number
  r: number
}

/** Hardest a traffic car brakes, m/s^2 (TrafficCar eases its speed toward the limit at this). */
export const BRAKE = 7
/** Nearest a driver looks; at speed it looks as far as it needs to stop (see `lookAhead`). */
const LOOK = 30
const HALF_WIDTH = 1.0
export const HALF_LENGTH = 2.4
/** Room left between the stopped car's nose and the obstacle's edge. */
export const STOP_MARGIN = 1.5
// Things farther apart than this in height are on different levels: a bridge and the road under it.
const LEVEL = 3
/** The limit asks for half the braking the car has, so it never runs out of road. */
const EASY = BRAKE

/**
 * How far ahead a driver at speed `v` looks: far enough that its limit curve starts above
 * the speed it is doing. At highway speed a fixed 30 m left too little road to stop, and
 * cars rolled into the player and shoved him along.
 */
export const lookAhead = (v: number) =>
  Math.max(LOOK, (v * v) / EASY + HALF_LENGTH + STOP_MARGIN + 2)

/** Top speed that still stops short of the nearest obstacle in this car's path. */
export function stopLimit(
  car: { position: { x: number; y: number; z: number }; heading: number; speed: number },
  list: Obstacle[],
): number {
  const fx = Math.sin(car.heading)
  const fz = Math.cos(car.heading)
  const look = lookAhead(car.speed)
  let limit = Infinity
  for (const o of list) {
    if (Math.abs(o.y - car.position.y) > LEVEL) continue
    const dx = o.x - car.position.x
    const dz = o.z - car.position.z
    const ahead = dx * fx + dz * fz
    if (ahead <= 0 || ahead > look || Math.abs(dx * fz - dz * fx) > HALF_WIDTH + o.r) continue
    const gap = ahead - HALF_LENGTH - o.r - STOP_MARGIN
    limit = Math.min(limit, gap <= 0 ? 0 : Math.sqrt(EASY * gap))
  }
  return limit
}
