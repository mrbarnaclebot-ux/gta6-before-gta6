# Phase 9 summary: main menu, loading screen, HUD, and map

Status: built and verified on branch `phase-09-ui` (from `phase-08-cinematic`). Not pushed. The Code Reviewer, Designer critique, and audit passes have not run yet.

## What was built

### One visual system (`src/style.css`)

- Shared tokens: ink colors, a sunset gradient (gold, coral, pink, violet), dark glass panels with blur, health and breath colors, and one screen-edge margin (`--edge`) that every HUD box uses.
- Display type: Anton (SIL OFL), self-hosted as one 19 KB latin woff2 in `public/assets/fonts`, preloaded. Body text stays on the system UI font.
- Key caps (`kbd`) look the same everywhere: light keys with a bottom lip.
- The pause menu title now uses Anton and the sunset gradient too.

### Main menu (`ui/menu.ts`, `menu.css`, `credits.css`)

- Full-bleed `menu.webp` with a slow 40 s Ken Burns drift. It is off under `prefers-reduced-motion`.
- A dark wash on the left carries the "VICE DEMO" wordmark and the list.
- Items: Play, Settings, Controls, Credits, Terms.
  - Settings opens the Phase 8 settings menu on Graphics; Controls opens it on the Controls tab. On the title screen it reads "Settings" and "Back".
  - Credits is a glass sheet. Terms links to `/terms.html`.
- Keyboard:
  - Play has focus on load.
  - Up and Down move through the list and wrap. Enter or Space activates the focused item.
  - Esc closes Settings or Credits and puts focus back where it was.
- Focus is shown three ways: white text, a gradient bar, and a highlight band. Hover moves focus.
- Phones and tablets (coarse pointer) get the "Built for a desktop with keyboard and mouse" notice as a visible pill. The key hints are hidden there.
- Portrait (390x844, 820x1180): the art shifts to frame the player and car. The menu sits low over a bottom wash.
- The engine chunk is prefetched 0.8 s after the menu loads, so Play rarely waits on the 2 MB (gzip) download. The menu itself is 17 KB of JS.

### Loading screen (`ui/loading.ts`, `load-progress.ts`, `loading.css`)

- After Play, the first slide is decoded before the screen shows and before anything heavy starts.
- Slides: `load_car`, `load_beach`, `load_police`, `load_swim`, `menu_night`.
  - They crossfade every 6.5 s with alternating push-ins.
  - Each slide is fetched one ahead of its turn.
- Tips rotate every 5.5 s: F for cars, right mouse to aim, M for the map, Esc for settings, swimming, wanted level, handbrake.
- Progress is real. `LoadProgress` weights five steps:

| Step | Weight | Source |
|---|---|---|
| Engine | 12% | dynamic import of `game.ts` |
| Physics | 6% | Rapier init |
| Files | 52% | `THREE.DefaultLoadingManager`; every glb, hdr, and texture loader here uses it |
| City | 18% | city, people, traffic, and HUD built |
| Shaders | 12% | the first frame is drawn |

- The bar never moves backwards when new files are queued mid-load. The status line names the current step, for example "Streaming the city 25 of 39".
- The screen fades out after the first rendered frame.

### HUD (`ui/hud.ts`, `hud-sync.ts`, `hud.css`, `hud-panels.css`, `death.css`)

- **Bottom left:** one glass frame holds a 240x156 rounded minimap. Under it is a GTA-style strip: health takes two thirds and breath one third. Both are always shown. Health pulses red under 25%.
- **Bottom right:** a weapon panel with an inline SVG pistol silhouette, "PISTOL", the magazine count in Anton, and the reserve. "Reloading" shows as a gradient chip above the panel.
- **Driving:** a round speedometer replaces the weapon panel. Its three-quarter ring fills toward 220 km/h with the sunset gradient.
- **Top right:** wanted stars on a dark glass pill, with the FPS chip when that setting is on.
- **Prompts:** "F Get in" is a key-cap chip low in the center.
- **Help toasts, top left:** they slide in, hold, and fade over 6 s. Each shows once per session:
  - at the start, M for the map and F for cars
  - the first time driving, swimming, or wanted
  - "You have arrived." when a waypoint is reached
- **Wasted:** the world turns grey under a `backdrop-filter`, a dark band slides in, and "WASTED" shows in red Anton with the hospital name.
- The Display HUD-scale setting now scales every HUD box, including the weapon panel and the toasts.

### Maps (`ui/map-paint.ts`, `map-icons.ts`, `minimap.ts`, `worldmap.ts`, `nav.ts`, `city/route.ts`)

- **Base map:** painted once at 1 px per meter (about 2440 px square). It shows sea, shallows, beach, land, buildings, parks, and the canal, with every road drawn over a dark casing. The minimap and the full map share it.
- **Shared markers:** hospital badge, parked-car glyph, waypoint pin, player arrow, and a cased pink route line.
- **Minimap:**
  - A rounded rectangle with the player below center, so more road ahead shows.
  - It turns with the camera, smoothed with a wrap-aware ease.
  - It zooms out in a car.
  - The north disc rides the rim.
  - It shows parked cars, hospitals, the red wanted search area, and the route. A far waypoint sticks to the edge.
- **Full map (M):**
  - It opens centered on the player and pauses the world.
  - Drag pans and the wheel zooms about the cursor. The view is clamped to the painted area.
  - A click sets a waypoint; clicking the waypoint again removes it.
  - It has a legend, district names (shown once zoomed in enough not to collide), and a hint bar.
  - M or Esc closes it. Esc never opens the pause menu over it, and losing pointer lock while it is open does not pause.
- **Route:** A* over the road-grid intersections, the same grid traffic drives, with a Manhattan heuristic. The last leg to the waypoint is a goal node, so the route found is a shortest one. It re-plans every 10 m the player moves and clears within 15 m of the waypoint.

## Controls

The keys from earlier phases, plus:

- **M:** map. Drag to pan, wheel to zoom, click to set or clear a waypoint, M or Esc to close.
- **On the title screen:** Up and Down to choose, Enter or Space to confirm, Esc to back out of Settings or Credits.

## Verification

- `pnpm build`: passes.
- `pnpm lint`: passes (eslint and prettier).
- `pnpm test`: 26 files, 86 tests pass. New: `city/route.test.ts` (snap, same block, shortest path, real city) and `ui/load-progress.test.ts`.
- `pnpm test:e2e`: 6 passed.
  - New fast test: main menu arrow keys, Settings, and Credits, with Esc and focus return.
  - The smoke test now starts Play with Enter on the focused button. It checks that the loading screen shows, that it reaches `aria-valuenow="100"` and hides, and that the menu hides.
  - It also opens the map with M, clicks a waypoint and checks the route, and closes it with M.
- Screenshots are in `.planning/phases/09-screens/`, from the production build (vite preview) in headless Chromium with SwiftShader:
  - menu, menu focus, credits, settings, loading at 1.5 s and 4 s (network throttled to 4 MB/s), and the HUD, each at desktop 1280x720, tablet 820x1180, and phone 390x844
  - map, map with waypoint, map zoomed, HUD with route, the F prompt, driving, wanted, and wasted, at the same three sizes

## Known gaps

- The Designer critique, audit, and Code Reviewer passes are still to run.
- The full map blurs past about 2x zoom, because the base is 1 px per meter. Tiles at 2 px/m are the upgrade if close zoom matters.
- The map has no keyboard pan or zoom; it is mouse only. Traffic and police cars are not drawn on the maps, only parked cars.
- The engine download cannot report bytes; it is one 12% step, which the menu prefetch usually finishes early. Shader compiles on the first frame block the page, so the bar holds at about 88% for that frame.
- The minimap and its health strip are greyed along with the world under the Wasted overlay rather than hidden.
- Touch play is still unsupported (out of scope); phones get the notice and a laid-out menu only.
- No paid generation was used in this phase; all art is the owner's existing Higgsfield output.
