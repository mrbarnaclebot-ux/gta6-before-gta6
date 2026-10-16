# vehicle

Cars: a Rapier raycast-vehicle per car, a generated body (sports car or police sedan) with our own wheels on top, and getting in and out of anything (boats share the flow).

- `vehicle.ts` what a car and a boat have in common, so one F flow drives both
- `driving.ts` who is in control (on foot, in a car, or in a boat); F to get in and out (a boat also from the water); hands F to carjacking when nothing of the player's own is in reach; turns stolen traffic cars into cars; seats the driver; hides parked cars past 150 m, boats past 300 m
- `car.ts` one car: chassis body, four spring-ray wheels, flooding, bullet damage, wheel and lamp visuals
- `drive.ts` pure rules: pedals, steering lock by speed, drag, chase FOV, flooding
- `car-model.ts` hands out cars with a box body at once, then swaps in the generated bodies after the first frame
- `car-specs.ts` measured sizes, wheel hubs, seats, and paints for each body
- `car-paint.ts` the body shader: repaints the baked texture and lights the lamps it finds by color
- `wheel-model.ts` the procedural tire and five-spoke alloy
- `wheel-batch.ts` every wheel of one car kind as two instanced meshes, synced before each scene render
- `fleet.ts` parks the seeded cars from `src/city/parking.ts`
- `exit.ts` finds a free spot beside a vehicle to stand after getting out: dry ground first (a pier beside a boat), else treading water
- `drive.test.ts`, `wheel-batch.test.ts` Vitest checks for the pure rules and the wheel batch
