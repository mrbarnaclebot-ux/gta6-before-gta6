# vehicle

Cars: a Rapier raycast-vehicle per car, a Blender body (sports, police, sedan, SUV, pickup, van; `assets-src/blender`) with its wheels batched per kind, and getting in and out of anything (boats share the flow).

- `vehicle.ts` what a car and a boat have in common, so one F flow drives both
- `driving.ts` who is in control (on foot, in a car, or in a boat); F to get in and out (a boat also from the water); hands F to carjacking when nothing of the player's own is in reach; turns stolen traffic cars into cars; seats the driver; hides parked cars past 150 m, boats past 300 m
- `car.ts` one car: chassis body, four spring-ray wheels, flooding, bullet damage, wheel and lamp visuals
- `drive.ts` pure rules: pedals, steering lock by speed, drag, chase FOV, flooding
- `car-model.ts` hands out cars with a box body at once, then swaps in the Blender bodies after the first frame: each glb baked into one opaque mesh and one glass mesh per level of detail (near and past 70 m)
- `car-specs.ts` each kind's size, wheel hubs, seat, and paints in meters (checked against the glbs by `car-model.test.ts`); which civilian kind a variant is
- `car-paint.ts` the body shader: repaints the `paint` parts, clear coat with flakes, and lights the head, tail, and light-bar lamps; the shared tinted glass
- `wheel-model.ts` the procedural tire and alloy the box-bodied cars roll on until the glbs load
- `wheel-batch.ts` every wheel of one car kind as instanced meshes per level of detail, synced before each scene render
- `fleet.ts` parks the seeded cars from `src/city/parking.ts`, every civilian kind
- `exit.ts` finds a free spot beside a vehicle to stand after getting out: dry ground first (a pier beside a boat), else treading water
- `drive.test.ts`, `wheel-batch.test.ts` Vitest checks for the pure rules and the wheel batch
