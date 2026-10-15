# ui

Plain DOM HUD over the canvas. Markup lives in `index.html`; these files drive and style it.

- `hud.ts` per-frame HUD: wanted stars, health and breath, speedometer, ammo, crosshair, death screen
- `hud-sync.ts` builds the HUD, minimap, and pause menu and feeds them game state each frame
- `minimap.ts` rotating minimap canvas, bottom left
- `pause.ts` Esc pause menu and its settings
- `hud.css`, `death.css`, `pause.css` styles for each; `src/style.css` holds the base and title screen
