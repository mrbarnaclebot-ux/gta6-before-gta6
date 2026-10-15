# ui

Plain DOM menus and HUD over the canvas. Markup lives in `index.html`; these files drive and style it. Shared tokens (colors, glass, the Anton display font, key caps) are in `src/style.css`.

- `menu.ts` title screen: Play, Settings, Controls, Credits, Terms; arrow keys and Enter
- `loading.ts` loading screen: art slideshow, tips, and the progress bar; `load-progress.ts` is its pure step math
- `hud.ts` per-frame HUD: wanted stars, health and breath, speedometer, weapon and ammo, crosshair, prompt, help toasts, death screen
- `hud-sync.ts` builds the HUD, maps, and pause menu, feeds them game state each frame, and handles the M and Esc keys
- `minimap.ts` rounded, rotating minimap, bottom left; `worldmap.ts` the full-screen map on M
- `map-paint.ts` the city painted once to a canvas both maps draw from; `map-icons.ts` their markers
- `nav.ts` the waypoint and its road route (A* in `src/city/route.ts`)
- `pause.ts` settings menu: Esc in game, Settings on the title screen; Graphics, Display, and Controls tabs
- `settings-rows.ts` every settings row: label, cost hint, and control kind
- `settings-panel.ts` renders rows as segmented choices, switches, and sliders, and reports changes
- CSS: `menu.css`, `credits.css`, `loading.css`, `hud.css` (frame), `hud-panels.css` (weapon, speedometer, prompt, toasts), `death.css`, `worldmap.css`, `pause.css`, `settings.css`
