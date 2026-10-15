import { parkingSpots } from '../city/parking'
import type { WorldCtx } from '../world/blocks'
import type { City } from '../world/city'
import { Car } from './car'
import { PAINT_COUNT, type CarFactory } from './car-model'

// ponytail: a fixed dozen parked cars; traffic and despawning arrive in Phase 6.
const PARKED = 12

/** Parks the seeded cars along the curbs and adds them to the scene. */
export function parkCars(ctx: WorldCtx, city: City, make: CarFactory): Car[] {
  return parkingSpots(city.layout, PARKED, PAINT_COUNT).map((s) => {
    const car = new Car(ctx.physics, make(s.variant), { ...s, y: 0 }, city.water)
    ctx.scene.add(car.visual.root)
    return car
  })
}
