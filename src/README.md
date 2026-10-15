# src

- `main.ts` title screen wiring; lazy-loads the game on Play
- `game.ts` builds the scene and runs the fixed-step loop
- `physics.ts` Rapier init and the fixed timestep
- `settings.ts` graphics quality, saved in localStorage
- `test-hook.ts` `window.__game` for Playwright and debugging
- `style.css` title screen and HUD styles
- Subfolders: `input`, `player`, `camera`, `render`, `world`, `ui`
