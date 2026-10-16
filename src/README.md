# src

- `main.ts` title screen, settings, and loading screen wiring; lazy-loads the game and starts it on Play
- `game.ts` builds the scene and runs the fixed-step loop, the clock, and pause
- `physics.ts` Rapier init and the fixed timestep
- `settings.ts` display and control preferences (FOV, HUD scale, FPS, sensitivity, invert Y), saved in localStorage
- `look.ts` applies graphics settings and feeds shadows, sun glare, focus, and motion blur each frame
- `test-hook.ts` `window.__game` for Playwright and debugging
- `style.css` shared design tokens, the display font, and key caps (screen styles live in `ui`)
- Subfolders: `input`, `player`, `vehicle` (cars, and the enter and exit flow every vehicle shares), `boat` (speedboats, wake, marina), `combat`, `camera`, `render` (renderer, post chain, shadows, sky, graphics presets), `life` (people, traffic, carjacking, wanted level, death), `city` (pure seeded city plan), `land` (pure plan of the 2 km world around it), `world` (meshes and colliders for the city), `sea` (waves, foam, underwater light, sea life), `scenery` (meshes and colliders for the land), `ui` (menu, loading screen, HUD, maps, pause and settings menu)
