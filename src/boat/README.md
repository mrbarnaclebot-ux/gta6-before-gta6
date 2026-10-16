# boat

Speedboats and the marina: a floating hull on the live waves, its wake, and the docks.

- `harbor.ts` entry point: builds the marina, moors every boat, and owns the wake
- `hull.ts` pure hydrodynamics: buoyancy per hull point, thrust, drag, planing lift and trim, banking; `hull.test.ts` checks it
- `forces.ts` applies those forces to a Rapier body each fixed step, sampling `waveHeightAt` (via the sea's surface query) at six hull points, the keel ends, and the propeller
- `boat.ts` one boat (a `Vehicle`, like a car): dynamic body, mooring until first driven, sleeps out of sight
- `mooring.ts` slack mooring lines as horizontal springs
- `boat-model.ts` the generated speedboat scaled to 7.2 m with its waterline on y = 0; a white stand-in until it loads
- `nav-lights.ts` red, green, and white navigation lamps on every boat, bright at night
- `wake.ts` the foam trail laid on the waves behind the driven boat; `spray.ts` bow and prop droplets
- `marina.ts` plank decks, beams, piles with colliders, and bollards from the plan in `src/land/marina-plan.ts`; `dock-lights.ts` the low lamps along the pier, with light pools at night
