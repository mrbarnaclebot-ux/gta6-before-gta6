# life

The living city: people on the sidewalks, traffic in the lanes, the wanted level, and dying and waking up in hospital.

- `life.ts` entry point: wires the crowd, traffic, wanted level, and death to the player
- `wanted.ts` pure wanted-level rules: crimes add heat, stars cool outside the search area
- `lanes.ts` pure traffic routes: right-hand lanes, turns through intersections
- `highway-traffic.ts` drives a car along the highway lane graph (`src/land/lane-graph.ts`)
- `places.ts` pure sidewalk walking loops and hospital respawn spots
- `pedestrian.ts`, `crowd.ts` one person (the generated man or woman, walk, flee, die) and the recycled pool of them
- `outfit.ts` dyes a person's clothes another hue, leaving skin alone, so one texture dresses many
- `traffic-car.ts`, `traffic.ts` one kinematic AI car and the recycled pool that stops for obstacles (and for a player walking up to a slow car); traffic has its own collision group, which the camera's wall probe sees
- `stopping.ts` pure speed limit that stops a driver short of what is ahead, looking farther the faster it goes
- `carjack.ts` F beside a stopped traffic car: walk to the door, haul the driver out (they flee), take the car; `carjack-rules.ts` pure eligibility and what crime it is
- `*.test.ts` checks for the pure rules
