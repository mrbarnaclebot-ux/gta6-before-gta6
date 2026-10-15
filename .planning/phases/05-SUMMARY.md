# Phase 5 summary: Shooting

Status: built and verified on branch `phase-05-shooting`. The Code Reviewer, Designer sign-off, and audit passes have not run yet.

## What was built

- Pure rules (`src/combat/weapon.ts`, `damage.ts`, unit tested):
  - The pistol holds 12 rounds plus a 96-round reserve.
  - Shots are at least 0.22 s apart. Clicking faster queues one shot instead of dropping it.
  - A reload takes 1.6 s, the length of the `Pistol_Reload` clip. An empty magazine starts reloading by itself.
  - Damage is 25 per hit up to 25 m. It falls to 40% at 120 m and to zero past 200 m.
  - Hits 1.5 m or more above a target's feet count as head shots and do double damage.
  - Cars start smoking below 40% health and are wrecked at zero.
- Input: right mouse aims, left mouse fires, R reloads. Releasing a button anywhere counts, so it cannot stick. The context menu is suppressed on the canvas.
  - Without pointer lock, holding the right button and dragging still turns the camera.
  - Clicks and R presses made while driving or swimming are dropped, so they do not fire later.
- Aim camera (`follow-camera.ts`): while aiming, the camera eases in to 2.5 m behind the player and 0.72 m to the right of the shoulder.
  - The field of view narrows by 13 degrees and mouse sensitivity drops 40%.
  - `aimAt(point)` turns the camera so the screen center lands on a world point. Tests use it.
- Aim animation (`src/player/aim-pose.ts`): an upper-body layer drawn from the mannequin's pistol clips. It replaces the spine, arms, and head on top of any leg clip, so you can walk while aiming.
  - It blends `Pistol_Aim_Neutral` with `_Up` or `_Down` by the camera pitch. The clips' arm angles were measured at +69 and -79 degrees.
  - `Pistol_Shoot` is added on top as a recoil kick at any aim pitch.
  - `Pistol_Reload` fades in and out.
  - It samples the clips directly instead of using a second AnimationMixer. A second mixer only writes a bone when its own output changes, so a held aim pose lost to the walk cycle.
  - While the gun is raised (aiming, or for 1.2 s after a hip-fire shot), the body faces where the camera looks and walks instead of running.
- Hitscan (`shooter.ts`): a Rapier `castRayAndGetNormal` from the crosshair that ignores the player's capsule.
  - The ray starts level with the player's chest instead of at the camera, so nothing between the camera and the player can be hit.
  - Hits are looked up by collider handle in a target map that holds the dummies and the cars.
- Target dummies (`dummy.ts`): three clones of the player's mannequin with crash-test yellow paint, standing on the beach east of the spawn and facing it.
  - Each has 100 HP and a capsule collider.
  - A hit plays `Hit_Chest`. Zero HP plays `Death01` and turns off the collider. After 6 s the dummy stands up again with full health.
- Cars (`car.ts`): 240 HP, about ten close shots.
  - Below 40% the engine bay puffs grey smoke. At zero, thick black smoke rises and the engine dies.
  - The HUD shows "Engine destroyed". The headlights and tail lights go dark like a flooded car.
- Effects (`effects.ts`, `particles.ts`, `decals.ts`, `textures.ts`), all pooled and in the scene from the first frame, so no shader recompiles mid-game:
  - Muzzle flash: an additive star sprite with HDR color, so bloom catches it, and a 50 ms warm PointLight that lights the shooter.
  - Particles: one custom points shader that sizes particles in world space, with three pools (sparks, dust, smoke).
    - Sparks are additive, fall under gravity, and are bright enough to bloom.
    - Dust puffs come from both the muzzle and the impact point.
  - Bullet holes: 96 decals in one instanced mesh, drawn as a dark pit inside a pale chipped ring. They read on dark asphalt, glass, and white stucco.
  - Sparks fly on metal (cars) and world hits. Dummies get dust only.
- Pistol model (`gun.ts`): a procedural gunmetal and polymer compact pistol (about 200 triangles) in the right hand bone.
  - Its hold rotation was computed from the hand bone's frame in the neutral aim pose, not tuned by eye.
  - It is hidden while driving or swimming.
- HUD: a crosshair drawn with CSS gradients appears while the gun is raised, with a red X hit marker for 0.18 s after a hit.
  - The magazine and reserve show bottom right while on foot. The magazine count turns red when empty, and a "Reloading" tag shows during a reload.
  - The title-screen controls line lists aim, fire, and reload.
- Test hook:
  - `state()` adds `ammo` (the rounds in the magazine), `reserve`, `reloading`, `aiming`, and `shots`.
  - New: `dummies()` (chest point and health), `aimAt(x, y, z)`, and `landmarks().range` (the spawn, facing the dummies).

## Controls

| Input | On foot |
|---|---|
| Right mouse (hold) | Aim over the shoulder |
| Left mouse | Fire (hip fire works too; the body turns to the crosshair) |
| R | Reload |

Driving and swimming controls are unchanged. You cannot shoot from a car or in water.

## Verification

- `pnpm install`: up to date. No new dependencies.
- `pnpm lint`: "All matched files use Prettier code style!"
  - A one-off `max-lines-per-function: 40` plus `max-lines: 300` run over `src` passed.
- `pnpm test`: 10 files, 40 tests passed. This adds `weapon.test.ts` and `damage.test.ts`.
- `pnpm build`: "built in 311ms". The game chunk is 5.37 MB (2.0 MB gzip).
- `pnpm test:e2e`: 4 passed (2.6 min).
  - The new test opens `?quality=low` and teleports to the range.
  - It holds the right mouse button and asserts `aiming` and that the crosshair shows.
  - It calls `aimAt` on the middle dummy and clicks, then asserts that the dummy's health dropped (100 to 75) and that one round was spent.
- Manual runs in headless Chromium on Metal (Apple M4, 1600x900, High) held 60 fps while shooting. Checked:
  - Aiming and firing at a dummy, a two-shot head-shot kill and the dummy getting back up, and strafing while aiming.
  - Bullet holes on the road and on a glass facade, and shooting a parked car until it smoked and was wrecked.
  - The Low preset, plus mobile (390x844) and tablet (820x1180) widths.
- Screenshots in `.planning/phases/05-screens/`:
  - `aim-dummy`, `muzzle-flash-hit`, `dummy-down`, `strafe-aim`
  - `car-wrecked-smoke`, `wall-bullet-hole`, `road-bullet-holes`
  - `low-preset`, `mobile`, `tablet`
  - `smoke-shoot-swiftshader.png`

## Known gaps

- There is no free pistol model in `public/assets`, so the gun is procedural.
- There are no free muzzle-flash, smoke, or bullet-hole textures there either, so those are drawn on a canvas at startup.
- No paid generation was used.
- There is no gunfire sound. The spec allows simple sound effects, so it is a candidate for Phase 6 or 7.
- There are no ammo pickups. Once the 96-round reserve is gone, the pistol is empty until the page reloads.
- Shooting from a car (drive-bys) is not supported.
- Cars do not explode. A wrecked car only smokes and loses its engine, as the scope allowed. Pistol hits do not push cars.
- Bullet holes are flat quads that only land on static world geometry.
  - They can overhang corners.
  - Holes on cars and dummies are skipped, because those move.
  - This is marked with a `ponytail:` comment.
- A click that recaptures the mouse after Esc also fires a shot.
- While aiming, the legs play the forward walk clip even when strafing or backing up. There are no strafe clips.
- The shoulder camera is tuned for desktop widths. On a narrow phone viewport the player is pushed off screen, but mobile is out of scope.
- The ray starts at the camera's line of sight. A wall right in front of the gun but off that line does not block the shot.
- Dummies are the only things that react to being shot. Pedestrians who flee arrive in Phase 6.
