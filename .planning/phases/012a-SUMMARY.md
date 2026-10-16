# Phase 12a: Mobile touch and gamepad controls

Branch `phase-12a-controls`, from `main` (live at https://gta6beforegta6.xyz). Not pushed, Railway untouched.

## What was built

- **One action layer** (`src/input/input.ts`). Keyboard and mouse, the gamepad, and touch each hold actions under their own source, so letting go of a key never drops a pad button. Sticks feed analog axes: `move()` for walking and swimming (keys plus sticks, never past length 1), `drive()` for throttle, steer, and handbrake. Game code (player, car, combat, audio, menus) reads only actions and these two calls, so no game logic is duplicated. The last device used is written to `<html data-input>` and switches prompts, tips, the menu footer, and the Controls tab.
- **Gamepad** (`gamepad.ts`, `pad-map.ts`, `pad-menu.ts`). The standard Gamepad API is polled every frame, with hot-plug (unplugging lets go of everything). Radial deadzone 0.18 and a 1.6 power curve on both sticks.
- **Touch** (`touch.ts`, `src/ui/touch.css`). A floating thumbstick on the left half, drag to look on the right half (no pointer lock on touch), context buttons 56 to 76 px (the top Map and Pause buttons are 48 px) placed inside the safe-area insets. Each finger is its own pointer with pointer capture, so moving, looking, and firing work at once. Dragging from Fire or Aim also turns the camera. `touch-action: none` on the canvas and controls, `pan-x pan-y` on the page, `user-scalable=no` and `viewport-fit=cover`, iOS `gesturestart` refused, and no text selection, callouts, or tap highlight.
- **Menus by touch.** Settings sliders, choices, and switches already worked by tap. The map gets pinch to zoom, tap to set a waypoint, drag to pan, and a Close button. Pause opens from its button. Short landscape screens get a compact title menu (Terms fits at 390 px), a one-row pause header, and a compact map legend.
- **Portrait.** A full-screen "Turn your device sideways to play" notice on coarse-pointer devices. Turning the phone upright mid-game also pauses it.
- **Mobile defaults.** The first visit on a touch device starts on Low with dynamic resolution (it shows as Custom). The renderer already draws at one pixel per CSS pixel and never at the device pixel ratio, which is the pixel-ratio cap: 844x390 is about 330k pixels even on a 3x phone. Pointer lock is skipped on touch (it is missing on iOS). On Play, Android gets fullscreen and a landscape lock, both optional and guarded. A failed orientation lock or fullscreen request is ignored.
- **HUD on touch.** The minimap moves top left at 150x98, tips sit beside it, the wanted stars and FPS sit left of the Map and Pause buttons, and the weapon and speedometer move top right at 78 %. The F prompt is hidden: the Use button names the action itself ("Get in", "Board", "Take car") and lights up when something is in reach.
- **Removed:** the "Built for a desktop" note. The menu footer now shows hints for the device in use and reads "Keyboard and mouse, gamepad, or touch".
- **Perf script:** `VIEWPORT=844x390 node scripts/perf.mjs ...` measures a phone-sized window with touch and mobile emulation.

## Controls

| Action | Keyboard and mouse | Gamepad | Touch |
|---|---|---|---|
| Move, steer | W A S D | Left stick | Thumbstick (left half) |
| Look | Mouse | Right stick | Drag on the right half |
| Run | Shift | Hold B (or L3) | Run (toggle) |
| Jump, surface, climb out | Space | A | Jump / Climb |
| Dive | Ctrl or C | Hold B in water | Dive |
| Get in or out | F | Y | Get in / Exit |
| Aim | Right mouse | LT | Aim (toggle) |
| Fire | Left mouse | RT | Fire |
| Reload | R | X | Reload |
| Gas, brake, reverse | W S | RT LT | Thumbstick up, down |
| Handbrake | Space | A | Brake |
| Horn | H | L3 | Horn |
| Radio | Q E | LB RB | none |
| Map | M | Back | Map |
| Pause | Esc | Start | Pause button |
| Menus | Arrows, Enter, Esc | D-pad, A, B (Start resumes) | Tap |

Decision on B: hold B to run on foot and hold B to dive in water. On foot B acts as sprint, in water it takes you down, and the same thumb stays on the face buttons. L3 also runs on foot and is the horn in a car. On a pad, prompts show the button in a key cap (`Y`). Tips write buttons in brackets as plain text (`[Back]`), with no glyphs and no logos.

## Tests

Final runs: `pnpm build` passes. `pnpm lint` passes. `pnpm test` has 47 files and 172 tests passing. `pnpm test:e2e` has 15 passing in 16.9 min.

The first full e2e run had 2 of 15 tests time out from CPU contention: the swim test and the boat ride. Both passed when run alone (3.9 min). Following the Phase 11 precedent, their timeouts went up: swim from 180 to 300 s, boats from 420 to 600 s.

- Vitest: `src/input/analog.test.ts` (deadzone, curve, trigger, thumbstick vector, clamp) and `src/input/pad-map.test.ts` (button and axis mapping by context).
- Playwright `e2e/touch.spec.ts` at 844x390 with `hasTouch` and `isMobile`, using multi-touch through CDP (`e2e/fingers.ts`):
  - `@smoke`: tap Play, then walk with the stick.
  - Phone defaults are in effect. Walk, look, and fire with three fingers at once. Get in a car with the Use button and drive with the stick.
  - The map: open it, tap a waypoint, close it. Pause and the Controls tab (Touch labels), then Resume.
- Playwright `e2e/gamepad.spec.ts`: `navigator.getGamepads` is stubbed in `addInitScript`. The pad works the title menu with the D-pad, then A starts the game, the stick walks, A jumps, Y gets in a car, RT gives throttle, Start pauses, the D-pad reaches the Controls tab (Gamepad labels), and Start resumes.

## Screenshots

`.planning/phases/012a-screens/`: these were taken headless on the M4 GPU with touch emulation at 844x390 DSF 3 unless named otherwise. `phone-menu`, `phone-walk-near-car` (Use lit as "Get in"), `phone-drive`, `phone-swim`, `phone-map`, `phone-pause-controls`, `phone-portrait` (390x844), `phone-932-swim` (932x430), and `tablet-swim` (1180x820). The last two were taken before the swimming Use button moved up beside Climb.

## Performance (M4 standing in for a phone, 844x390 DSF 3, dev server, vsync on)

| Preset | spawn | downtown | beach | shore | marina | hillside | forest | highway drive |
|---|---|---|---|---|---|---|---|---|
| Low | 60 | 60 | 60 | 60 | 60 | 60 | 60 | 60 (p99 16.8 ms, max 33 ms) |
| Medium | 60 | 60 | 60 | 60 | 60 | 60 | 60 | 60 (p99 16.8 ms, max 33 ms) |

The CPU time per frame is 3.7 to 6.4 ms. The JS heap is about 330 MB in the dev build. Every scene hit the 60 fps vsync cap at this size, so these numbers show the M4 has headroom. They do not predict a phone: a phone GPU is several times slower, and that is why touch devices start on Low with dynamic resolution.

## Known gaps

- Not tried on a real iPhone or Android device; only Chromium touch emulation. iOS Safari ignores `user-scalable=no` (touch-action and `gesturestart` cover pinch). iPhone Safari has no element fullscreen, so its browser bars stay.
- The pad cannot pan or set a waypoint on the full map (B or Back closes it). Waypoints need a mouse or touch.
- There are no radio buttons on touch (radio stays on the car's last station).
- The D-pad does not auto-repeat in menus. Hold the left stick past the rim to step once per push.
- Low on a phone shows jagged edges (no SMAA), and visual quality on phones is left to 12b.
- Memory on iOS is not measured. Low reduces draw distance, shadow maps, and the water mirror, but the JS heap is about 330 MB in dev.
