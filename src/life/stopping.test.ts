import { describe, expect, it } from 'vitest'
import { BRAKE, HALF_LENGTH, lookAhead, stopLimit } from './stopping'

/** Drives a car along +z from z = 0 toward a person at `at`, as TrafficCar eases its speed. */
function approach(speed: number, at: number) {
  const car = { position: { x: 0, y: 0, z: 0 }, heading: 0, speed }
  const person = { x: 0, y: 0, z: at, r: 0.4 }
  const dt = 1 / 60
  for (let t = 0; t < 20; t += dt) {
    const limit = stopLimit(car, [person])
    car.speed += Math.max(-BRAKE * dt, Math.min(3 * dt, limit - car.speed))
    car.position.z += car.speed * dt
  }
  return { nose: car.position.z + HALF_LENGTH, speed: car.speed }
}

describe('traffic stopping', () => {
  it('stops short of a person in the lane from highway speed', () => {
    // The person steps out just inside the distance this driver looks ahead.
    const { nose, speed } = approach(24, lookAhead(24) - 0.5)
    expect(speed).toBeLessThan(0.05)
    expect(lookAhead(24) - 0.5 - 0.4 - nose).toBeGreaterThan(1)
  })

  it('stops short at town speed too', () => {
    const { nose } = approach(11, 30)
    expect(30 - 0.4 - nose).toBeGreaterThan(1)
  })

  it('ignores what is on another level, under a bridge', () => {
    const car = { position: { x: 0, y: 6, z: 0 }, heading: 0, speed: 20 }
    expect(stopLimit(car, [{ x: 0, y: 0, z: 10, r: 1 }])).toBe(Infinity)
  })
})
