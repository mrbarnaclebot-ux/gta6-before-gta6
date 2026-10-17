# Phase 13a summary: bugs and a play-through sweep

Status: built and verified on branch `phase-13a-bugs` (from `main`). Not pushed, not deployed. Code Reviewer and Designer have not reviewed it yet.

## The three known bugs

### 1. Roof billboards had no colliders
- `billboardColliders()` in `src/world/billboards.ts` gives every board fixed boxes matching its steel: the picture with its frame, the catwalk, and the two legs. Pole boards get the pole, now under the pole (it sat 0.4 m off before). The boxes turn with the board.
- They go through `ctx.colliders`, so they stream in 128 m tiles like the other small colliders.
- The player can still walk under the catwalk between the legs (2 m clear), as on a real roof board.
- Check: `src/world/billboards.test.ts` runs the player's capsule and character controller (same settings as `player.ts`) at a leg of a turned board. It stops at the leg; with the leg boxes removed the test fails. In game, holding W into a leg stops the player 0.5 m short of it (`billboard-leg-blocks.jpg`).

### 2. The camera ended up inside a traffic car stopped behind the player
There were two causes, and both are fixed:
- **The camera could not see traffic.** People and traffic shared collision group 2, which the camera's wall probe skips on purpose so people do not yank it around. Traffic now has its own group (`TRAFFIC_GROUPS` in `src/physics.ts`), which the probe sees. A car stopped behind the player now pulls the camera in front of it, as a wall would.
- **Highway traffic could not stop in time.** Drivers looked a fixed 30 m ahead. At highway speed (24 m/s) they need about 40 m, so they rolled into the player and pushed him along the deck. In one trace a car shoved him 23 m. The speed limit now lives in `src/life/stopping.ts`, and a driver looks as far ahead as its speed needs (`lookAhead`). Cars now stop with their nose about 2 m short of the player.
- Check: `src/life/stopping.test.ts` brakes a car from 24 m/s and from town speed toward a person who appears just inside its look-ahead. Both stop more than 1 m short. With the old fixed 30 m, the highway case fails.
- Checked in game on the flyover deck for 30 s: the camera was inside no car's box in any frame (0 of 300 samples), and the nearest a car came was 4.4 m (center to player). That was measured on foot. Driving behind braking traffic (the highway and city drives) and aiming downtown were checked by eye in the play-through screenshots. In aiming the camera is close to the shoulder anyway.

### 3. Bark shards near trunks
- **Cause:** the broadleaf trunks (`jacaranda`, `island_tree_01`) were simplified offline by position only. Thin limbs collapsed into flat, two-sided ribbons, which showed as pale shards in and under the crowns. It was not the leaf cards, the thinned MID cards, or the impostors: with the cards hidden the ribbons were still there.
- **Fix:** `scripts/bark-lod.mjs` (new, committed this time) rebuilds a tree's `bark` and `lite` trunks from its Poly Haven scan:
  - It welds the scan's split vertices.
  - It simplifies with the normals weighted, so a limb stays round until it is dropped whole.
  - Prune drops the small twig islands.
  - Then `compress-assets.mjs models`.
- Triangles:
  - jacaranda 1,025 → 3,708 (bark) and 161 → 1,332 (lite)
  - island_tree_01 1,024 → 3,000 (bark) and 782 → 899 (lite)
- The scans are cached in the git-ignored `assets-src/.polyhaven`.
- The firs and garden trees did not show the problem and were left alone.
- The island tree's scanned bark is a cool pale grey that read blue-white among the browns. It gets a warm tint (`BARK_TONE` in `src/scenery/forest.ts`), which also reaches its impostors.
- Uncapped A/B in the forest: 60.5 / 65.5 fps on `main`, 61.4 / 62.7 on the branch. That is within noise.

## The play-through

The scripted play-through ran in headless Chromium on the M4's GPU (Metal), at 1920x1080 on Medium, against the dev server. The console was watched the whole time.
- **Autopilot:** a small autopilot drove a real car with synthetic keys along each road's lane, braking for traffic. The driving numbers are its log: arrival, largest distance off the lane, and worst pitch and roll.
- **Walk and run:** 2.1 and 6.4 m/s; a jump.
- **The highway:** the whole loop at up to 26 m/s, 169 s, over both flyover interchanges. At most 1.4 m off the lane. The game's day/night cycle ran through dusk and night on the way.
- **The ramps:**
  - The off-ramp and on-ramp at the Hill Road interchange.
  - Hill Road.
  - Hillside Drive, all switchbacks to the summit: 219 s, at most 2.3 m off the lane.
  - The forest trail to the residential cul-de-sac: 145 s, worst pitch 22 degrees (the trail allows 30% grades).
- **City and residential streets:**
  - A 2.4 km loop of the city grid.
  - Palm Avenue to its end.
  - Street 2 South and Street 4 North.
- **Swim and dive:** off the beach, and a deep dive at the ocean landmark. Underwater view, breath, and surfacing all worked.
- **Boats:**
  - A canal boat up the canal.
  - A marina boat out to sea and around.
- **Carjack:** a traffic car stopped for the player, he pulled the driver out (she fled), and he drove off with one star.
- **Shooting:** aimed and fired at a pedestrian (hit, two stars).
- **Map:** M, a click set a waypoint with a 9-point route, and the route showed on the minimap.
- **Pause:** opened with Esc, the Graphics and Display tabs worked, and it resumed.
- **Day and night:** downtown and the beach at 22:00, with neon and lit windows.

### What it found and what was fixed
| # | Fault | Fix |
|---|---|---|
| 1 | Billboards had no colliders | Above |
| 2 | Camera inside a stopped traffic car; highway cars shoving the player | Above |
| 3 | Bark shards; blue-white island tree bark | Above |
| 4 | Every cul-de-sac street ran on to the circle's middle: an asphalt tongue into the grass island. The forest trail also ended in the island's middle. | `deadEnd()` in `src/land/residential.ts` ends each street, and Palm Avenue, where it meets its turning ring. The trail now meets the ring's north side. The GPS still joins each street to its ring (the land tests, including the GPS connectivity check, pass). Screens: `culdesac-before.jpg`, `culdesac-after.jpg`. |
| 5 | Boats squeezed under the 30 cm-high canal bridges: the boat sat inside the road slab with the camera on the deck | The bridge decks are solid to the canal floor (`src/world/canal.ts`, marked `ponytail:`). A boat now stops at the bridge. `canal-bridge-before.jpg`, `canal-bridge-after.jpg`. |
| 6 | People walked through bus shelters (and brushed benches): the shelter stood across the line they walk 3 m in from the curb. The ground-gap probe found people "inside" props downtown. | Shelters stand 1.75 m in, benches, bins and news boxes 2.1 m. No palm or light stands along a shelter's length, and no parking meter under its roof (`src/city/furniture.ts`). A new test checks every item stays curbward of the walking line. After the fix, 80 samples downtown found nobody inside anything. `busstop-before.jpg`, `busstop-after.jpg`. |
| 7 | `THREE.BufferGeometry.toNonIndexed(): already non-indexed` warned twice on every load | The fish fins (`src/sea/fish-model.ts`) skip the call when already flat. The console is now empty from load through the whole play-through. |

### Found and not fixed (with reasons)
- **The canal cannot be sailed end to end, or out to sea.** The interior bridges are 30 cm above the water, and the canal is walled at both ends. Opening the canal and raising the bridges is Phase 13b's brief. For now a boat stops cleanly at each bridge.
- **Two traffic cars can clip for a moment when they cross at a junction.** Seen once in 30 s near the flyover exit: 0.6 m apart for under a second. There are no traffic lights or yield rules: this is the existing `ponytail:` in `traffic.ts`.
  - Predicting crossing cars risks two-way deadlocks, and the existing unstick timer does not break those. It holds a stuck car at 0 while it "ignores" cars, so it never moves.
  - Junction logic belongs with 13c's turn lanes and stop bars.
- **Two people on the same walking loop can overlap** when one overtakes the other.
- **One bush stands on the edge of Street 2 North where it leaves Palm Avenue,** found by a scan of all 32,000 bushes against every road. The other flora is clear.
- **The marina landmark stands the player on a bollard.** This is test placement only.
- **Skipped on owner request:** the phone radio banner over the tip toast, and the silent first click on the title screen.

## Measurements (M4, 1920x1080 at DSF2, `scripts/perf.mjs`, production builds on `vite preview`)

**The machine was shared during this phase.** Other agents' headless Chromium runs (another worktree) and a busy desktop Chrome were using the CPU and GPU the whole time. Main-thread work per frame was 15 to 26 ms, against 3 to 6 ms in 12b. Even `main` measured 37 to 60 fps, against 60 in every scene in 12b. So the absolute gate (Medium holds 60) **could not be verified in this session**. What was measured is `main` against this branch, back to back on the same machine:

| Scene (Medium) | main fps | branch fps | draw calls main / branch |
|---|---|---|---|
| spawn | 47.0 | 47.7 | 452 / 461 |
| downtown | 55.4 | 55.4 | 454 / 392 |
| beach | 37.4 | 38.5 | 796 / 739 |
| shore | 59.6 | 60 | 262 / 265 |
| canal | 47.6 | 53.4 | 458 / 407 |
| marina | 44.4 | 48.8 | 752 / 752 |
| hillside | 53.8 | 47.0 | 705 / 703 |
| flyover | 57.0 | 55.4 | 541 / 576 |
| residential | 56.4 | 57.6 | 371 / 372 |
| forest | 55.4 | 50.4 | 384 / 383 |
| forest-hill | 60 | 60 | 332 / 390 |
| underwater | 60 | 60 | 103 / 103 |
| downtown-night | 55.6 | 48.8 | 554 / 543 |
| drive, 86 s | 56.3 (6 frames over 50 ms) | 54.4 (1 frame over 50 ms) | |

The scenes that dropped were re-run as uncapped A/B rounds, alternating builds:

| Scene (uncapped fps) | main | branch |
|---|---|---|
| hillside | 50.6, 44.7 | 56.1, 49.4 |
| forest | 60.5, 65.5 | 61.4, 62.7 |
| forest-hill | 68.2, 63.0 | 69.2, 69.1 |
| residential | 62.2, 59.7 | 61.2, 59.0 |
| downtown-night | 58.5, 55.7, 54.2, 50.9 | 46.3, 49.9, 47.7, 56.5 |

Each pair swings by 5 to 12 fps between rounds, and neither build wins consistently. **There is no measurable regression.** The extra trunk triangles only draw within 60 m, and the new colliders are about 200 small boxes, streamed.

**Load size:**
- Cold transfer: 26.7 MB on `main`, 26.6 MB on the branch.
- `vite preview` serves no Brotli, so both are above the 24.0 MB measured behind Caddy in 12b.
- The rebuilt trees add 18 KB in total, well inside the phase's 5 MB budget.

**Errors:** no page errors in either perf run, nor in the play-through.

## Controls
Unchanged.

## Known gaps
- The 60 fps gate needs a re-run on a quiet machine before the Ship step (`NOWARM=1 node scripts/perf.mjs <url> <dir> medium 2`).
- The canal is still closed (13b), and junctions have no right of way (13c).
- The old position-only trunks remain on the firs and garden trees. They showed no shards, but `bark-lod.mjs` can redo them if they ever do.
- The broadleaf trunk ends that the scan leaves open (where its separate branch mesh would continue) show as cut stumps when seen from below the crown.

## Screenshots (`.planning/phases/013a-screens/`, 1920x1080, Medium)
- **Bark:**
  - `bark-island-before.jpg` / `-after.jpg`
  - `bark-forest-before.jpg` / `-after.jpg`
  - `bark-jacaranda-before.jpg` / `-after.jpg`
- **Billboards:** `billboard-leg-blocks.jpg`, the player stopped at a roof board's leg.
- **Camera:** `camera-traffic-before.jpg` (a police car pushed up to the player, camera on its roof) and `camera-traffic-after.jpg` (a car stopped 4.4 m back, camera in front of it).
- **Cul-de-sacs:** `culdesac-before.jpg` / `-after.jpg`, and `culdesac-palm-avenue-after.jpg`.
- **Canal:** `canal-bridge-before.jpg` (boat under the road slab) and `canal-bridge-after.jpg`.
- **Bus stops:** `busstop-before.jpg` / `-after.jpg`.
- **Play-through contact sheets:**
  - `play-highway1.jpg`, `play-highway2.jpg`
  - `play-ramps-hill-trail-1..4.jpg`
  - `play-city-residential-1..3.jpg`
  - `play-swim.jpg`, `play-dive.jpg`
  - `play-boat-sea.jpg`
  - `play-carjack.jpg`
  - `play-shoot.jpg`
  - `play-map-pause.jpg`
  - `play-settings-night.jpg`
- **Perf scenes:** `perf-scenes-branch.jpg`, from the branch's perf run.

## Gates
- `pnpm build`: built.
- `pnpm lint`: clean (eslint and prettier).
- `pnpm test`: 53 files, 187 tests passed. New: billboard colliders (3), traffic stopping (3), and furniture walking-line clearance (1).
- `pnpm test:e2e`: 15 passed (18.0 min). No files were edited while it ran.
