# vehicle

Cars: a Rapier raycast-vehicle per car, the CarConcept model on top, and getting in and out.

- `driving.ts` who is in control (on foot or in a car); F to get in and out; seats the driver
- `car.ts` one car: chassis body, four spring-ray wheels, flooding, bullet damage, wheel and lamp visuals
- `drive.ts` pure rules: pedals, steering lock by speed, drag, chase FOV, flooding
- `car-model.ts` loads the glb once, merges the body per material, paints, box-car fallback
- `fleet.ts` parks the seeded cars from `src/city/parking.ts`
- `exit.ts` finds a free spot beside the car to stand after getting out
- `drive.test.ts` Vitest checks for the pure rules
