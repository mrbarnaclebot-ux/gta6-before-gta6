# Phase 6 summary: Life and gaps

Status: built and verified on branch `phase-06-life`. The Code Reviewer, Designer sign-off, and audit passes have not run yet.

## What was built

### Health, death, and respawn

- The player now takes fall damage. Landing faster than 14 m/s hurts: a two-story drop stings and a fall from a roof kills. Drowning works as before.
- Zero health plays the mannequin's `Death01` clip and shows a red "Wasted" screen naming the hospital.
  - Input is ignored while dead. The pistol and the "Get in" prompt hide.
  - A player who dies in a car is put out of it first.
- After 5 s the player wakes up at the nearest of four hospitals (one per district) with full health and breath and a full pistol. The wanted level clears.
- Each hospital has a lightbox sign with a red cross, which glows at night, and a red cross on the minimap.

### Pedestrians (`src/life/pedestrian.ts`, `crowd.ts`)

- There are 24 people, all clones of the player's mannequin. They wear 10 two-tone outfits and vary a little in height.
- They walk a loop around each block, mid-sidewalk, clear of lamp posts and palms. Some walk the beach promenade. Now and then one stops to chat (`Idle_Talking_Loop`).
- Walking and sprinting clips are time-scaled to their speed, so feet do not slide.
- Gunfire makes people within 45 m of the shooter, or 15 m of where the bullet lands, sprint away for 9 s. They run whichever way round the block leads away from the shot.
- They can be shot: 60 HP, with flinch and death clips. Hitting one at more than 14 km/h with the player's car knocks them down.
- People more than 170 m away, or dead for 25 s, respawn 30 to 130 m from the player.
- Their capsules stop bullets and the player but not cars. They sit in their own collision group, so the camera does not zoom in when someone walks past.

### Traffic (`src/life/lanes.ts`, `traffic-car.ts`, `traffic.ts`)

- Ten cars of the existing car model drive the right-hand inner lane. At each intersection they go straight on (twice as likely) or turn along a curve that joins the two lanes. There are no U-turns and no dead ends.
- Cars cruise at 40 km/h, slow to 18 km/h for turns, and brake for anything in their path: the player, any other car, or people.
- Two cars blocking each other in an intersection would wait forever. After 3 s one of them drives on.
- The cars are kinematic: they shove the player's car aside but are never knocked off their route.
- They can be shot. They smoke when damaged, and a wrecked car stops with its lights out.
- Headlights come on at night and brake lights light up when braking.
- Cars more than 260 m away respawn 60 to 220 m away, behind the camera when possible.

### Wanted level (`src/life/wanted.ts`, unit tested)

- A crime earns at least one star, up to five. The heat added per crime:
  - Gunfire with a witness within 40 m: +0.35.
  - Shooting a car: +0.25.
  - Hitting a person: +0.6.
  - Killing a person, or running one over: +1.
- With no police yet, "out of sight" means outside the search area around the last crime. The area's radius is 60 m plus 40 m per star.
- Outside it, the stars blink. After 6 s one star drops, then one more every 8 s.
- The HUD shows five stars, top right. The minimap shades the search area.

### Minimap (`src/ui/minimap.ts`)

- A round 168 px map in the bottom-left corner, with the health and breath bars under it.
- The whole map is painted once at 1 px per meter: sea, sand, paved land, canal, parks, building footprints, and roads.
- Each frame it is drawn turned so the camera's view points up.
- It shows a player arrow, an "N" marker on the rim, the hospital crosses, and the wanted search area.
- It zooms out while driving.

### Day and night (`src/render/daynight.ts`, `sky.ts`, `sky-dome.ts`)

- A full day takes 20 minutes and the game starts at 10:00. `?time=21.5` in the URL starts at another hour.
- The sun rises over the ocean, peaks 65 degrees up, and sets over the city. At 10:00 it sits where the tuned daytime HDRI has its sun, so the look of earlier phases is unchanged.
- The moon takes over the shadow-casting light at night, in a cool blue.
- A new sky dome replaces the static backdrop:
  - It blends the day HDRI with a night sky.
  - It turns the day sky so clouds and glare follow the sun, clamps away the sun painted in the HDRI, and draws a sharp sun or moon disk.
  - It adds an orange glow near the horizon at dusk.
  - Below the horizon it is exactly the fog color, so fogged sea meets the sky without a seam on both High and Low.
- At dusk the day sky dims and blushes pink, a warm hemisphere fill comes up, and the fog warms.
- At night the sky is a violet city-glow gradient, with the night HDRI's stars only high up. That HDRI has a treeline painted in its lower sky.
- Image-based lighting swaps to the night HDRI after dusk.
  - The night HDRI is graded violet-blue and upscaled to the day map's size, so both share one shader variant and dusk never recompiles every material.
- The water's body color and glints follow the sky and sun, so the sea goes dark blue at night instead of glowing turquoise. Underwater dims too.

### Night lights (`src/world/neon.ts`, `night-windows.ts`, `street-glow.ts`, `hospital-signs.ts`)

- Lit windows:
  - Every facade material has an emissive map covering a 16 by 16 window grid, four times the facade tile each way, so the lit pattern repeats rarely.
  - About 40% of homes are lit, in warm whites with the odd blue TV or pink lamp. Office floors light up as a whole.
  - Each window is brightest at the top, like a ceiling light.
- Neon (reference: `ingame-examples/image (1).png`):
  - Art-deco buildings get tubes along the first-floor eyebrow and the top of the parapet. Half of them get corner strips too.
  - Some towers get a roof-line ring.
  - The colors are pink, magenta, cyan, mint, violet, orange, and red.
  - Each tube casts a soft color wash on the wall around it. The wash is an additive gradient quad just off the wall, so it costs two draw calls per chunk.
  - Tubes and washes are hidden by day.
- Street lamps:
  - The lenses glow and bloom.
  - Every lamp throws a pool of light on the ground. All 800 pools are one instanced draw.
  - The four lamps nearest the camera get real point lights, so people and cars are lit as they pass under them.
- The player's car headlight is much stronger at night.
- All night-only meshes draw for the first frames even by day, so their shaders compile while loading. No hitch at dusk.

### Pause menu (`src/ui/pause.ts`)

- Esc opens it, and so does losing pointer lock (Esc in a real browser, or switching windows). The world freezes but keeps drawing.
- It holds a Resume button, which re-captures the mouse, a mouse sensitivity slider (0.3x to 3x), the graphics quality toggle (moved here from the HUD corner), and the full controls list.
- Sensitivity and quality are saved in localStorage (`vice.sensitivity`, `vice.quality`).
- A click on the game that re-captures the mouse no longer also fires a shot. This was a Phase 5 known gap.

### Fixes found along the way

- `surfaceAt` treated every road as endless, so points on the beach promenade in line with a cross street read as road height. Each road's extent is now checked.
- The first animation frame can be stamped before the loop's start time when a long task delays it. A negative frame step stalled the whole simulation for tens of frames in SwiftShader. The step is now clamped to 0 or more.

### Test hook

- `state()` adds `dead`, `wanted`, `wantedCooling`, `hours`, `night`, `paused`, and `sensitivity`.
- New helpers: `peds()`, `traffic()`, `hospitals()`, `hurt(n)`, `skipDeath()`, and `setTime(h)`.

## Controls

| Input | Action |
|---|---|
| Esc | Pause and resume |
| Mouse | Look; sensitivity is in the pause menu |

All other controls are unchanged, and the pause menu lists them all.

## Verification

- `pnpm install`: "Done in 198ms". No new dependencies.
- `pnpm lint`: "All matched files use Prettier code style!"
  - A one-off `max-lines: 300` plus `max-lines-per-function: 40` run over `src` passed. The only exceptions are `describe` blocks in test files, as in Phase 5.
- `pnpm test`: 14 files, 56 tests passed.
  - New: `wanted.test.ts` (7 tests), `lanes.test.ts`, `places.test.ts`, and `daynight.test.ts`.
- `pnpm build`: "built in 313ms". The game chunk is 5.40 MB (2.03 MB gzip).
- `pnpm test:e2e`: 5 passed (5.1 min). The new test opens `?quality=low` and checks:
  - People exist and traffic moves.
  - Shooting the nearest person earns a star, shows `#wanted`, and makes people flee.
  - Damage kills the player and shows `#death`. After `skipDeath()` the player is back at full health with no stars, within 2 m of a hospital.
  - Esc shows the pause menu and stops the clock. The sensitivity slider sets 2x and saves it to localStorage. A second Esc closes the menu.
  - `setTime(22)` turns night on.
  - The first two older tests got a 180 s timeout, because people and traffic slow SwiftShader to about 1 fps on High.
- Manual runs in headless Chromium on Metal (Apple M4, 1600x900, High) held 59 to 61 fps in every scene below, including night views of the whole skyline.
  - Wide city views reach about 2,400 draw calls and 11 M triangles.
- Screenshots in `.planning/phases/06-screens/`:
  - Day and dusk: `day-promenade-people`, `dusk-beach`, `blue-hour-neon`, `sunrise-drive`
  - Night: `night-deco-neon`, `night-canal-reflections`, `night-skyline-from-beach`, `night-rooftop`, `night-drive`
  - Gameplay: `traffic-stops-for-player`, `shot-fired-wanted-flee`, `wasted`, `hospital-respawn`, `pause-menu`
  - Other presets and widths: `low-preset-day`, `low-preset-night`, `mobile-pause` (390x844), `tablet-wasted` (820x1180)
  - SwiftShader: `smoke-night-swiftshader.png`, `smoke-pause-swiftshader.png`

## Known gaps

- No police. Pursuit was optional and is skipped, so nothing shoots back. The only damage sources are falls and drowning, plus the test hook.
- "Out of sight" is distance from the last crime, not line of sight.
- Traffic:
  - There are no traffic lights. Cars only stop for what is in front of them, and after a 3 s standoff they drive through each other.
  - Traffic cars are kinematic and cannot be carjacked.
  - A car abandoned in a lane holds up traffic behind it until the player moves away and those cars respawn.
- People:
  - They never cross streets and do not avoid each other.
  - They flee along their sidewalk loop, not freely.
  - They all share the mannequin body with tinted materials. No free rigged CC0 humans with this clip set exist in `public/assets`.
- The daytime image-based lighting still carries the HDRI's painted sun at its fixed 48 degree elevation. It turns with the sun's direction but does not sink with it, so glossy reflections near sunset show a highlight that is a little too high. The visible sky clamps it away.
- No wet-road reflections, LED-wrapped palms, or neon signs with lettering, all of which the night reference has.
  - Neon does not light the ground or characters. Only the four nearest street lamps are real lights.
- No time-of-day clock on the HUD, and the day length is not a setting.
- Hospitals are a sign in front of an ordinary building.
- Performance: traffic uses the full concept car model.
  - At about 2,400 draw calls in wide views, a mid laptop will likely drop below 60 fps on High. The Phase 7 perf pass should add LODs or a lighter traffic model.
  - The e2e suite now takes about 5 minutes in SwiftShader.
- No new assets were needed and none were missing.
  - Lit windows, neon, light pools, and the hospital sign are procedural on purpose, since there are no CC0 equivalents in `public/assets`.
  - No paid generation was used.
