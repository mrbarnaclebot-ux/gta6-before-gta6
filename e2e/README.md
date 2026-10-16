# e2e

Playwright specs that drive the real game in headless Chromium on SwiftShader. `pnpm test:e2e` runs them all against the dev server (about 12 minutes, three workers); CI runs only the `@smoke` tag against the production build.

- `helpers.ts` shared waits (`settle`), timeouts scaled for slow renderers, and the `window.__game` state types
- `smoke.spec.ts` title menu, walking, the map and a waypoint, swimming, driving a parked car, shooting
- `ci.spec.ts` the CI boot check: Low quality, play, walk
- `world.spec.ts` standing in each district, and nothing floating or sunk
- `life.spec.ts` people, traffic, the wanted level, death, the pause menu, and night
- `boats.spec.ts` carjacking a traffic car, then a boat from the marina
- `streaming.spec.ts` driving across collider tiles, and landing on loaded colliders after a long teleport
- `audio.spec.ts` audio settings persist, little audio before Play, and the sound starts after it
- `touch.spec.ts` a phone at 844x390: tap Play, walk with the stick, look, and fire at once, drive with the touch buttons, the map and pause by touch (the cheap walk check is `@smoke`)
- `gamepad.spec.ts` a stubbed `navigator.getGamepads`: menu D-pad, walking, jumping, a car, throttle, and pause
- `fingers.ts` multi-touch through the DevTools protocol (Playwright's touchscreen only taps)
