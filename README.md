# Vice Demo (gta6-before-gta6)

A browser open-world demo set in a sunny Miami-like coastal city. Three.js, Rapier physics, plain DOM HUD.

## Commands

- `scripts/setup.sh` - install dependencies and the Playwright Chromium
- `pnpm dev` - run locally at http://localhost:5173
- `pnpm build` - type check and production build to `dist/`
- `pnpm test` - Vitest unit tests for pure logic
- `pnpm test:e2e` - Playwright smoke test (starts its own dev server)
- `pnpm lint` / `pnpm format` - ESLint plus Prettier

## Controls

WASD move, Shift run, Space jump, mouse look (click the view to lock the mouse, or drag), Esc releases the mouse. The top-right button switches Graphics High/Low; `?quality=low` in the URL forces Low.

## Layout

- `src/input` keyboard and mouse, key bindings
- `src/player` character controller, movement math, animated avatar
- `src/camera` third-person orbit camera with collision
- `src/render` renderer, post-processing, HDRI sky and sun
- `src/world` PBR materials, static colliders, Phase 1 test block
- `src/ui` HUD
- `public/assets` free-licensed models, textures, HDRIs (see `CREDITS.md`)

Spec: `.planning/PROJECT.md`. Phase notes: `.planning/phases/`.
