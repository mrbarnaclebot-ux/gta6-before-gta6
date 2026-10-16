# Phase 10d summary: boats and carjacking

Status: built and verified on branch `phase-10d-boats` (from `phase-10c-ocean`). Not pushed. The Code Reviewer's three blockers are fixed (see Review fixes); the Designer pass has not run yet.

## What was built

### Boats (`src/boat/`, see its README)

- **The model:** the owner's AssetHub speedboat (Tripo 3.1).
  - Shrunk with gltf-transform to `public/assets/models/vehicle/boat.glb`: WebP textures at 2048 px, welded. It went from 3.7 MB to 1.5 MB.
  - It is credited in `CREDITS.md` as owner-generated.
  - The code normalizes it: 7.2 m long, bow at +z (measured from the vertex profile), waterline on boat-space y = 0.
  - A white stand-in hull shows until it loads after the first frame, like the car bodies.
- **Physics:** each boat is a dynamic Rapier box hull (1.6 t).
  - **Buoyancy:** sampled at six hull points against the live waves. It uses the same `waveHeightAt` as swimming, through `city.water`.
  - **Damping:** each point has a spring and 0.8 of critical damping, so the hull settles instead of porpoising.
  - **Drag:** along the hull, heavy while plowing and slick on the plane. The keel resists sideways slip at the bow and the stern, so the boat carves.
  - **Planing:** lift grows with speed (up to 30 percent of the weight). The bow rears to about 5 degrees over the hump near 7 m/s, then settles to about 2 to 3 degrees on the plane. Top speed is about 17 to 20 m/s (33 to 39 knots).
  - **Steering:** the outboard swings 0.45 rad to steer, and its lower unit acts as a rudder at speed. The hull banks into turns, about 7 degrees at full lock on the plane. The boat bounces over the swell and the surf.
  - **Land:** thrust only bites while the propeller is underwater. A boat that reaches the sand beaches there; it cannot drive up it.
  - **Rest:** moored boats hang on slack spring lines until first driven. Boats out of sight with nobody aboard sleep.
- **Marina** (`src/land/marina-plan.ts`, `src/boat/marina.ts`, `src/boat/dock-lights.ts`):
  - A 140 m pier runs east from the beach 190 m south of the spawn, out past the surf, and ends in a 44 m T-head.
  - The deck is grey weathered planks (Poly Haven `wood_planks_grey`, CC0), on edge beams and round piles down to the seabed. Deck, piles, and lamp posts all have colliders.
  - Bollards stand at every berth. Low lamps light the pier at night (bloomed globes, pools of light clipped to the deck, no real lights).
  - Six boats are moored: four along the pier and two at the T-head. One is anchored off the spawn beach and one sits in the canal.
  - Lifeguard towers and umbrellas are kept off the pier. They are drawn from the same random sequence, so every other prop stays where it was.
- **Getting in and out:** cars and boats now share one `Vehicle` interface (`src/vehicle/vehicle.ts`), so the F flow in `Driving` is the same for both.
  - Reach is measured to the hull or body footprint (2 m), not the center. A boat can also be boarded from the water.
  - The exit finder prefers dry ground: stepping off at the marina puts you on the pier. At sea it puts you treading water at the surface, and from there you swim or drown as before.
- **Wake and spray** (`wake.ts`, `spray.ts`):
  - The wake is a foam ribbon laid on the live waves. Its V arms spread at 0.3 times the speed and its prop wash fades over 3 s. The foam is the 10c lace texture, sampled stretched along the trail for streaks and fine for bubbles, and lit like the scene.
  - Bow and prop spray are droplets in the existing particle pool, colored by the sun (warm at dusk). Both sleep when nobody is boating.
- **Camera and HUD:**
  - The chase camera has a boat rig: 2.3 m up and 10.5 m back.
  - The speedometer reads knots in a boat (dial to 50) and km/h in a car.
  - The F prompt says "Board" for a boat and "Take car" for a car you can jack.
  - There is a first-time boat tip.
- **Not built:** there is no engine sound, because the game has no audio yet. Police boats were out of scope.

### Carjacking (`src/life/carjack.ts`, `src/life/carjack-rules.ts`)

- **When:** press F near a traffic car going under 3 m/s, within 3.6 m of its center, when no parked car or boat is in reach.
  - Standing in a car's lane already makes it stop.
  - A slow car also waits for a player who walks within 4.5 m of it.
- **The sequence:**
  1. The car is held. The player walks to the driver's door (up to 3 s, then snaps there).
  2. A driver is borrowed from the pedestrian pool: one off screen if any, else the farthest away. They appear in the seat, stagger out (the hit clip) while the player plays the Interact clip, and are hauled clear over 1.3 s.
  3. The driver flees in a straight line, using the pedestrian run and flee state. After the usual flee time they vanish and the crowd recycles them.
- **The car changes hands:**
  - The traffic car's kinematic body leaves the physics world, and the car leaves the traffic pool. A fresh traffic car of the same kind takes its slot and spawns out of sight.
  - The same visual (model, paint, wheels) becomes a normal raycast `Car` in `driving.cars`. Stolen cars and the parked fleet now share the Driving flow.
  - Bullets follow the new bodies through `combat.swap`, which deletes the old collider handle before Rapier can reuse it.
  - Traffic cars made after the bodies load now get the real body at once (`CarModels.dress`).
- **Wanted level:**
  - Plus 1 star if a visible pedestrian or a police car within 30 m sees it.
  - A police cruiser can be stolen too, and that is always plus 2.
- **Aborts** cleanly if the player dies mid-sequence.

## Controls

- **F:** board or step off a boat; get in or out of a car; take a stopped traffic car.
- **In a boat:** W throttle, S reverse, A and D steer.
- Everything else is unchanged.

## Test hook additions

- **`state()`:**
  - `vehicle`: car, boat, or null
  - `pitch` and `roll` of the driven vehicle, in degrees
  - `carjack`: walk, pull, or null
- **Helpers:**
  - `boats()`
  - `landmarks().marina`: on the T-head beside a boat with open water ahead
  - `traffic()` now includes `heading`

## Verification

### Gates

- **`pnpm install`:** works. No new dependencies.
- **`pnpm build`:** passes.
- **`pnpm lint`:** passes. Every file is under 300 lines and every new function under 40.
- **`pnpm test`:** 34 files, 124 tests pass. New:
  - `src/boat/hull.test.ts`:
    - the hull floats at its waterline, with damping and a depth cap
    - plowing, then planing, and a 17 to 23 m/s top speed
    - trim over the hump
    - thrust, reverse, dead engine, and banking direction
  - `src/life/carjack-rules.test.ts`:
    - eligibility by speed, range, and wreck
    - a slow driver waits, and anyone waited for can reach the door
    - the crimes: plus 1 when seen, plus 2 for a police car
    - the oldest stolen car of the same kind is scrapped at the cap
  - `src/land/marina-plan.test.ts`:
    - boats float clear of the seabed
    - the deck starts just above the sand
    - piles stay clear of the hulls
    - no props stand on the pier
- **`pnpm test:e2e`:** 9 passed in 9.6 min (rerun after the review fixes: 9 passed in 9.6 min, boats spec 5.4 min). New `e2e/boats.spec.ts`, one page:
  1. Stand in a cruising car's lane until it stops.
  2. F at the door: the pull phase is seen, then driving a car, which moves, then out.
  3. Board the T-head boat and drive 15+ m. It stays within 0.8 m of sea level. Stopped dead, F leaves the player swimming more than 1.5 m from the hull.
- **Workers:** local e2e now runs 3 at a time (`playwright.config.ts`). With 5 parallel SwiftShader workers, the long life and world specs timed out at 300 s, and the 10c branch did the same under that load. Those two specs also got more time (420 s and 480 s); at 3 workers they ran 4.3 and 4.4 min. CI is unchanged at 1 worker.

### Performance (`scripts/perf.mjs`, 1920x1080 at DSF2, Apple M4, Chrome on Metal)

There is a new `marina` scene: from the T-head back along the pier to the city.

| Scene | Medium fps / draws | High fps / draws |
|---|---|---|
| spawn | 59.9 / 548 | 43.8 / 489 |
| beach | 60 / 863 | 37.4 / 1093 |
| shore | 60 / 222 | 58.7 / 193 |
| canal | 60.1 / 433 | 48.4 / 471 |
| marina | 60 / 826 | 40.9 / 1165 |

- **Medium holds 60 everywhere.**
- **High** reads lower than the 10c table. Back-to-back A/B runs against a 10c worktree on the same machine were within thermal noise of each other: 50.3 vs 46.4 and 43.7 vs 40.5 at the spawn. Hiding every boat changed nothing measurable. Boat shadows are limited to 80 m.
- **Download:** the boat (1.5 MB) and the deck textures (0.7 MB) are new.

### Screenshots (`.planning/phases/010d-screens/`, JPEG)

Dev build, Medium, headless Chrome on the Metal GPU, 1920x1080.

- `day-marina-pier`, `day-marina-boats`: the pier, piles, bollards, lamps, and moored boats
- `day-boat-chase`, `day-boat-planing-wake`: planing at about 30 knots, bow up, V wake and prop wash, bow spray
- `sunset-boat-chase`, `sunset-boat-planing-wake`: the same at 17:36
- `night-marina`, `night-marina-out`: the lit pier against the neon skyline
- `day-carjack-pull`: mid-sequence, with the driver hauled out beside the door and one star; `day-carjack-drive` after
- `mobile-day-boat-chase`: 390 px wide; the knots dial and minimap fit
- `e2e-carjack-swiftshader`: the e2e run's own frame of the pull, headless SwiftShader
- Review fixes (High): `fix-exit-deep-water` (stepped off a stopped boat at sea, swimming beside it), `fix-camera-by-boat` (camera turned toward the hull stops at the player, not in the cockpit), `fix-after-9-thefts` (the 9th stolen sports car, wheels drawn), `night-boat-nav-lamps`, `day-boat-nav-lamps`

### What I tuned from the screenshots

- **The wake:**
  - It was invisible at first: the strip was back-facing. It is double-sided now.
  - It then read as cow spots: one coarse lace sample. It is now two samples, one stretched along the trail.
  - A grey veil read as a slab at dusk; it was removed.
  - The trail now starts at the stern.
- **Spray:** it was big soft balls that read as bokeh, and at low frame rates it emitted at most one per frame. Emission is now accumulated, the droplets are small, and they are sun-colored.
- **Deck:** the first texture (a varnished floor) read orange-red. It became sun-bleached grey planks.
- **Night:** the pier was pitch black; it got the dock lamps. Their light pools first spilled over the water, so they are clipped to the deck and dimmed.
- **Porpoising:** buoyancy damping went from 0.5 to 0.8 of critical.

## Review fixes

- **Stepping off a stopped boat at sea** left the player standing on its windshield: the dry-ground pass also tried the roof spot, and its ray hit the boat's own hull. The roof is now tried only once no side has room (`src/vehicle/exit.ts`). `e2e/boats.spec.ts` now stops the boat dead before F and checks the swimmer is more than 1.5 m from the hull. Live: mode `swimming`, 1.82 m from the hull's center.
- **The camera inside the cockpit:** the hull collider stops at 0.85 m, under the windshield and console. Each boat now carries a second, camera-only box over them (y 0.85 to 1.5, z -2 to 1.2, measured off the model's vertices). It is a sensor, so only the camera probe sees it: every gameplay query (the player controller, ledges, exits, car wheel rays) passes `SOLID` (`src/physics.ts`), and bullets, the aim ray, and traffic already skipped sensors. The camera now ignores the whole driven body, not just its first collider.
- **Stolen cars piling up:** after 7 sports thefts the replacement traffic cars had no wheels (the 120-hub pool was full) and every stolen car stayed in physics for the session. Now at most 4 stolen cars per kind stay in play. The 5th theft scraps the oldest (its body and vehicle controller leave the physics world), and its visual becomes the replacement traffic car, so the number of car visuals and wheel hubs stops growing. Live: 9 sports thefts in a row, the car count goes 18, 19, 20, 21, 22, then stays at 22; no "Wheel pool full" warning, no page errors. `scrapFor` has a Vitest check.
- **Navigation lamps:** a red and green bicolor lamp on the bow tip and a white all-round lamp on a short stern pole. They are one unlit mesh per boat, dim by day and bloomed at night.
- **Small notes taken:** the `Combat.swap` comment now says why the stale handle is safe (Rapier handles are generational); `crowd.borrow`'s pop is marked `ponytail:`; `buildDockLights` lost its pool builder to a helper.
- **Not taken:** the wake's per-frame closures (fine until profiling says otherwise), the traffic hold direction, the spray sprite, and the marina draw calls (see Known gaps).

## Known gaps

- **No audio:** there is no engine sound (the game has none yet).
- **Bow wave:** there is no displaced bow wave or hull-water interaction in the water shader. The wake is a foam ribbon on top of the waves, and the chase camera sits above the wake, so most of the V shows when the camera is turned.
- **Spray:** the droplets are round camera-facing points using the smoke sprite; real spray would need streaked or velocity-stretched sprites (review note, not taken).
- **Fleeing drivers:** they run in a straight line, ignoring buildings, and then vanish. Walking back to the nearest sidewalk loop would be nicer (`ponytail:` note in `pedestrian.ts`).
- **Stolen cars:** at most 4 per kind stay in play; the 5th theft scraps the oldest even if it is in view (`ponytail:` note in `carjack-rules.ts`).
- **Traffic hold:** a slow driver within 4.5 m of a walking player stops whichever way the player faces (review note, not taken).
- **Marina draw calls:** about 1120 at High on the T-head. The boat glb is already a single mesh (one draw per pass), so merging it would not help; the count comes from elsewhere (not profiled yet).
- **Lamp pools:** they light the deck, not the player (no real lights).
- **Minimap:** boats show as car icons.
- **Water in the cockpit:** none was seen in testing. There is no depth mask, so a very steep crest could show through the hull.
- **High preset:** see Performance. Medium is the gate and holds 60.
- **Paid tools:** no AssetHub, Higgsfield, or fal credits were spent. The boat is the owner's existing AssetHub generation; the deck texture is CC0 from Poly Haven.
- **Process:** the Code Reviewer pass ran (fixes below); the Designer critique and audit passes are still to run.
- **Mobile:** at 390 px the minimap and speedometer overlap the wake; the game is desktop-first.
