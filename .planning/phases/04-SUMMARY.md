# Phase 4 summary: Driving

Status: built and verified on branch `phase-04-driving`. The Code Reviewer, Designer sign-off, and audit passes have not run yet.

## Leftover Phase 1 fixes

- Space on a focused Play button now starts the game. `Input` ignores key events whose target is a button, link, or form field, on both key-down and key-up. Browsers click a button on key-up, so blocking only key-down was not enough. Key-ups still release held actions, so no key gets stuck.
- The Graphics toggle blurs itself after a click. Game keys would otherwise be ignored while it holds focus.
- `Input.reset()` clears held keys, queued presses, and mouse motion. `main.ts` calls it right before the title hides, so title-screen input no longer leaks into the first game frame.

## What was built

- Cars (`src/vehicle/car.ts`): a Rapier `DynamicRayCastVehicleController` on a dynamic box chassis.
  - Mass is 1250 kg, with a lowered center of mass so the car does not roll in corners.
  - Four spring rays sit at the model's hub positions. Stiffness is 32 with matched damping, and the static sag is solved so the wheels sit on the ground at rest.
  - The car is rear-wheel drive: 2600 N per rear wheel, about 0 to 100 km/h in 7 s. Quadratic drag caps the top speed near 200 km/h.
  - The handbrake locks the rear wheels and drops their grip, so the rear slides out.
  - Parked cars brake and cost nothing while their bodies sleep.
- Pure rules (`src/vehicle/drive.ts`, unit tested):
  - W brakes first while rolling backward, then accelerates. S brakes while rolling forward, then reverses, capped at 9 m/s.
  - Engine braking slows the car when no pedal is pressed.
  - The steering lock is 0.6 rad at walking pace and narrows as speed rises. The wheel turns at a hand-like rate instead of snapping.
  - Also covered: the chase field of view (55 to 73 degrees), drag, and flooding.
- Deep water: once water stands more than 0.55 m above the cabin floor, the engine floods. It stays dead for good, the HUD shows "Engine flooded", and water damping slows the car as it sinks. This finishes the Phase 3 item.
- Model (`src/vehicle/car-model.ts`): Khronos CarConcept glb (CC-BY 4.0, credited in CREDITS.md), loaded once and cloned so geometry is shared.
  - The body's roughly 90 meshes are merged into one mesh per material. This cut the whole frame from about 1,970 draw calls to 1,050 with cars in view.
  - The transmission glass is replaced by tinted clearcoat glass. Transmission re-renders the scene every frame.
  - There are six paint variants in a Miami palette: pearl white, turquoise, hot pink, black, carmine, and sunset orange. The source paint was fully metallic, which made every color look like tinted chrome, so the variants use metalness 0.5 and roughness 0.32 under a clear coat.
  - A procedural box-car fallback is used if the glb fails to load.
- Wheels: each wheel has a pivot at its hub. Each frame it follows the suspension length, spins with `wheelRotation`, and steers with `wheelSteering`.
- Lights:
  - The headlight and brake-light materials are per car.
  - Brake lights glow while braking or on the handbrake (bright enough for bloom). Tail lights glow softly while you drive.
  - One shadowless SpotLight follows the driven car. It always stays in the scene, so the shaders never recompile.
- Parked cars (`src/city/parking.ts`, unit tested): 12 seeded curbside spots, all on dry road, with right-hand traffic. The first spot is the one nearest the spawn, so a car is in view right away.
- Getting in and out (`src/vehicle/driving.ts`, `exit.ts`):
  - F enters the nearest car within 3.6 m, on foot only.
  - The mannequin sits in the concept car's central seat and plays the `Driving_Loop` clip.
  - F gets you out. The exit tries the left door, the right door, behind, in front, and the roof, and checks that the capsule fits each spot. A ray finds the ground, so you can step out onto the curb or into water and swim.
- Chase camera: the existing orbit camera gained a car rig (higher pivot, 7.2 m back).
  - After 1.2 s without mouse input it swings back behind the car, and faster at higher speed. A parked car never swings it.
  - The FOV widens with speed.
  - The wall probe ignores the driven car instead of the player.
- HUD: a speedometer (km/h, bottom right) shows only while driving. A centered "F Get in" prompt shows next to a car. The title-screen controls line lists F and the handbrake.
- Test hook:
  - `state()` adds `mode: 'driving'`, `speed` (m/s), and `stalled`. `position` follows the car while you drive.
  - `landmarks().car` is the driver's door of the first parked car.
  - `cars()` lists every car's position.
  - `teleport()` moves the car while you drive.

## Controls

| Key | On foot | Driving |
|---|---|---|
| W / S | walk | throttle / brake, then reverse |
| A / D | strafe | steer |
| Space | jump | handbrake |
| F | get in a nearby car | get out |
| Mouse | orbit | look around; the camera recenters after 1.2 s |

## Verification

- `pnpm install`: up to date, with no new dependencies.
- `pnpm lint`: clean. A one-off `max-lines-per-function: 40` run passed, and every file is under 300 lines.
- `pnpm test`: 8 files, 34 tests passed. This adds `drive.test.ts`, `parking.test.ts`, and a chase-yaw test in `orbit-math.test.ts`.
- `pnpm build`: passes. The game chunk is 5.35 MB (2.0 MB gzip).
- `pnpm test:e2e`: 3 passed. The new test presses Space on the focused Play button, which checks fix (a). It then walks to the car, checks the prompt, presses F, and asserts `driving` and that the speedometer shows. After holding W it asserts speed > 0 (4.9 m/s under SwiftShader). Finally it presses F and asserts `walking`. It runs on `?quality=low` with a 180 s timeout because SwiftShader is slow.
- Manual runs in headless Chromium on Metal (Apple M4, 1600x900, High) held 60 fps while driving. Checked:
  - Acceleration: 8, 16, 23, 30, and 35 m/s at 2 s intervals.
  - A handbrake turn at 115 km/h.
  - Braking into reverse.
  - Hitting a palm trunk.
  - Driving off the beach into the sea until the engine floods, then getting out into the water.
  - The Low preset, plus mobile (390x844) and tablet (820x1180) widths.
- Screenshots in `.planning/phases/04-screens/`:
  - `get-in-prompt`, `seated-side`, `parked-teal`
  - `chase-107kmh`, `handbrake`, `brake-lights`
  - `into-sea`, `flooded`
  - `low-preset`, `mobile`, `tablet`
  - `smoke-drive-swiftshader.png`

## Known gaps

- No traffic, no car damage or deformation, no car sounds, no doors opening, and no enter or exit animation. Getting in and out is instant.
- A flipped car cannot be righted. Get out and take another one.
- While you are in the car your breath and health are frozen, so a sunken car does not drown you.
- After you get out, the avatar keeps its pre-drive heading instead of facing away from the door.
- The headlight is tuned for daytime (dim). The Phase 6 night cycle should raise it. This is marked with a `ponytail:` comment.
- There are a fixed 12 parked cars, and they never respawn. A car driven away stays where you leave it.
- Each car still has about 200k triangles. With many cars in view this is the largest cost after the city, so a LOD or a simplified distant mesh is a Phase 7 candidate.
- Handling is tuned by feel on one machine and is fairly grippy. Drift tuning is basic.
- During development, one e2e run reported the car landmark's ground at 0.30 instead of 0.02. It passed anyway, and I could not reproduce it in later runs.
- No paid generation was used or needed.
