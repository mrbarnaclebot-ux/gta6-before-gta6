import { drivewaySpots, parkingSpots } from '../city/parking'
import type { WorldCtx } from '../world/blocks'
import type { City } from '../world/city'
import { Car } from './car'
import type { CarFactory } from './car-model'
import { civilian, VARIANTS } from './car-specs'

// ponytail: a fixed dozen parked cars at the curbs and a few in residential driveways.
const PARKED = 12
const DRIVEWAYS = 6

/** Parks the seeded cars (every civilian kind, by variant) along the curbs and adds them to the scene. */
export function parkCars(ctx: WorldCtx, city: City, make: CarFactory): Car[] {
  const spots = [
    ...parkingSpots(city.layout, PARKED, VARIANTS),
    ...drivewaySpots(city.layout, DRIVEWAYS, VARIANTS),
  ]
  return spots.map((s) => {
    const car = new Car(ctx.physics, make(s.variant, civilian(s.variant)), s, city.water)
    ctx.scene.add(car.visual.root)
    return car
  })
}
