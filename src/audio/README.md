# audio

Sound effects, ambience, and music on the Web Audio API. Files come from `public/assets/audio`, made by `scripts/audio.mjs` (see `public/assets/CREDITS.md`).

Title screen (no three.js):

- `boot.ts` sets up the mixer, menu clicks, and the menu theme (from the first click or key); fades the theme out as play starts
- `mixer.ts` the graph: music, sfx, ambience, ui buses into a master; underwater low-pass, pause dimmer, street echo send; mute while the tab is hidden; one-shots
- `prefs.ts` bus volumes and mute, saved in localStorage; `bank.ts` fetches and decodes files on demand
- `loop.ts` gliding loops (engines, ambience, skid); `stream.ts` songs streamed by an audio element; `reverb.ts` the echo impulse
- `ui-sounds.ts` hover, select, and back in the menus; `catalog.ts` every file, the radio stations, and the preload list

In game (`game-audio.ts` builds and feeds these each frame, and plays the stings: wanted, wasted, map, waypoint, toasts):

- `space.ts` three's AudioListener on the camera and a pool of PositionalAudio voices
- `player-audio.ts` footsteps from the animation's foot bones (`steps.ts`) on the surface underfoot (`surface.ts`), jump, landing, splashes, swimming
- `vehicle-audio.ts` the player's car or boat: engine layers by rpm (`engine.ts`), skid, horn, crashes, doors
- `traffic-audio.ts` the nearest traffic engines, the siren (`siren.ts`), and wrecks exploding
- `combat-audio.ts` shots, reloads, dry fire, impacts, casings, panic screams
- `ambience.ts` background beds by place and time of day (`ambience-mix.ts`)
- `radio-player.ts` the car radio (`radio.ts` is its pure state)

Pure and unit-tested: `prefs`, `engine`, `surface` (`groundOf`), `steps`, `ambience-mix`, `radio`.
