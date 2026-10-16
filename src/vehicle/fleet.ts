import { drivewaySpots, parkingSpots } from '../city/parking'
import type { WorldCtx } from '../world/blocks'
import type { City } from '../world/city'
import { Car } from './car'
import { PAINT_COUNT, type CarFactory } from './car-model'

// ponytail: a fixed dozen parked cars at the curbs and a few in residential driveways.
const PARKED = 12
const DRIVEWAYS = 6

/** Parks the seeded cars along the curbs and adds them to the scene. */
export function parkCars(ctx: WorldCtx, city: City, make: CarFactory): Car[] {
  const spots = [
    ...parkingSpots(city.layout, PARKED, PAINT_COUNT),
    ...drivewaySpots(city.layout, DRIVEWAYS, PAINT_COUNT),
  ]
  return spots.map((s) => {
    const car = new Car(ctx.physics, make(s.variant), s, city.water)
    ctx.scene.add(car.visual.root)
    return car
  })
}
