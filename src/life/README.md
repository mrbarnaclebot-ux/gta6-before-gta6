# life

The living city: people on the sidewalks, traffic in the lanes, the wanted level, and dying and waking up in hospital.

- `life.ts` entry point: wires the crowd, traffic, wanted level, and death to the player
- `wanted.ts` pure wanted-level rules: crimes add heat, stars cool outside the search area
- `lanes.ts` what a traffic car follows: waypoints, stops, drivers
- `city-lanes.ts`, `city-lane-graph.ts` pure city lane graph: right-hand lanes per street segment ending at the stop bars, left-turn lanes on avenues, connector curves through junctions, no U-turns or dead ends
- `signals.ts` pure traffic light timing (two phases per junction) and the shared signal clock
- `highway-traffic.ts` drives a car along a lane graph: the highway's (`src/land/lane-graph.ts`) or the city's
- `places.ts` pure sidewalk walking loops round blocks and the promenade, and hospital respawn spots; `crossings.ts` the crosswalks linking the loops
- `pedestrian.ts`, `crowd.ts` one person (the generated man or woman, walk, cross at crosswalks waiting for the lights, flee, die) and the recycled pool of them
- `outfit.ts` dyes a person's clothes another hue, leaving skin alone, so one texture dresses many
- `traffic-car.ts`, `traffic.ts` one kinematic AI car and the recycled pool: it holds at red lights and halts at stop signs, and stops for obstacles (and for a player walking up to a slow car); traffic has its own collision group, which the camera's wall probe sees
- `stopping.ts` pure speed limit that stops a driver short of what is ahead, looking farther the faster it goes
- `carjack.ts` F beside a stopped traffic car: walk to the door, haul the driver out (they flee), take the car; `carjack-rules.ts` pure eligibility and what crime it is
- `*.test.ts` checks for the pure rules
