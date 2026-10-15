# life

The living city: people on the sidewalks, traffic in the lanes, the wanted level, and dying and waking up in hospital.

- `life.ts` entry point: wires the crowd, traffic, wanted level, and death to the player
- `wanted.ts` pure wanted-level rules: crimes add heat, stars cool outside the search area
- `lanes.ts` pure traffic routes: right-hand lanes, turns through intersections
- `places.ts` pure sidewalk walking loops and hospital respawn spots
- `pedestrian.ts`, `crowd.ts` one person (the generated man or woman, walk, flee, die) and the recycled pool of them
- `outfit.ts` dyes a person's clothes another hue, leaving skin alone, so one texture dresses many
- `traffic-car.ts`, `traffic.ts` one kinematic AI car and the recycled pool that stops for obstacles
- `*.test.ts` checks for the pure rules
