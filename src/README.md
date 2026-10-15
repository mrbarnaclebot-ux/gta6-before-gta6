# src

- `main.ts` title screen wiring; lazy-loads the game on Play
- `game.ts` builds the scene and runs the fixed-step loop, the clock, and pause
- `physics.ts` Rapier init and the fixed timestep
- `settings.ts` graphics quality and mouse sensitivity, saved in localStorage
- `test-hook.ts` `window.__game` for Playwright and debugging
- `style.css` title screen and HUD styles
- Subfolders: `input`, `player`, `vehicle`, `combat`, `camera`, `render` (renderer, sky, day and night), `life` (people, traffic, wanted level, death), `city` (pure seeded map plan), `world` (meshes and colliders for it), `ui` (HUD, minimap, pause menu)
