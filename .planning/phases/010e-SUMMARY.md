# Phase 10e summary: sound effects and music

Status: built and verified on branch `phase-10e-audio` (from `phase-10d-boats`). Not pushed. Code Reviewer and Designer passes have not run yet.

## What was built

### Files (`scripts/audio.mjs`, `public/assets/audio/`)

- The owner's Epidemic Sound downloads (82 MB raw, 69 files) became 81 game files, 23.2 MB in all, with a repeatable script: `node scripts/audio.mjs <download dir>` (ffmpeg via Homebrew; about a minute).
  - One-shots: silence trimmed, peak-normalised to -1 dBFS, mono 96 kbps.
  - Loops (engines, outboard, wake, swim, skid, siren): mono 96 kbps, two-pass `loudnorm` to -20 LUFS.
  - Ambience: 128 kbps stereo, `loudnorm` to -24 LUFS, cut to 37 s (underwater 22 s).
  - Music and radio: 128 kbps stereo, `loudnorm` to -16 LUFS.
  - Every loop is made seamless: its tail is crossfaded (equal power) into its head, then 0.1 s of wrap-around audio is added at both ends. The game loops between those points, so MP3 encoder padding never lands in the loop. A seam check (sample jump at the loop point against the file's typical jump) reads 0.4 to 2.4, which is no click.
  - Footsteps: the 10 to 20 s takes are sliced by onset detection (a 10 ms energy envelope crossing a threshold, picks near the median level, spread across the take). That gives 6 concrete walk, 4 concrete run, 5 sand, and 5 grass single steps. Multi-hit takes (jump efforts, grunts, casings, the map swish, the explosion) become numbered variants the same way.
- Before Play the page fetches about 60 KB of audio: three menu clicks and the concrete footsteps. Phase 11's budget allowed up to 1.5 MB. The e2e test checks this. After Play, the small one-shots (about 500 KB) load in the background. Loops load when first needed: ambience when you get near it, engines when a car is in reach. Music and radio stream through audio elements and are never decoded whole.
- **The flagged picks, judged by envelope, pitch track (zero crossings), and loudness:**
  - **Siren:** the "wail" take is really a pass-by, and its middle is a steady 1.12 kHz tone. The game loops that tone and sweeps its pitch with an LFO. A slow triangle makes the wail; a fast 3.3 Hz one makes the US yelp. It switches every 6.5 s. That answers "not a US yelp" without another download. The "close" alternative is a single rise, not a loop, so it is unused.
  - **Wanted sting (sci-fi alarm):** kept, but cut to its first pulse (0.75 s), low-passed at 5 kHz, and faded. It now reads as a sting, not a klaxon. The other downloaded alerts (ping, chime) are positive in mood, so they were wrong for it.
  - **Explosion:** the take is two different booms; both are kept as variants.
  - **Menu theme (Miami Heatwave, 156 BPM):** kept. The calmer alternatives named in the brief were never downloaded. The only other music is the radio songs, which have vocals. Its loop edit suits a sunny-coast title screen, and it plays at 75 percent of the music bus.

### Engine (`src/audio/`, see its README)

- **Mixer:** Web Audio buses Music, SFX, Ambience, and UI feed a master. The graph is built on the first click or key (the Play click at the latest). SFX and ambience pass through:
  - a shared low-pass (520 Hz under water),
  - a pause dimmer (30 percent while paused or the map is open),
  - a street-echo send, a ConvolverNode with a generated impulse (early slaps, then a darkening tail).
- While the tab is hidden, the context is suspended.
- **3D:** three's AudioListener rides the camera, and its output is routed into the SFX bus. PositionalAudio voices (equal-power panning) are used for traffic engines, the siren, impacts, screams, and explosions. A pool of 10 voices handles one-shots.
- **Settings:** a new Audio tab has Master, Music, Effects, Ambience, and Interface sliders plus Mute. It is saved in localStorage (`vice.audio.*`) and works on the title screen and in game.
- **Player** (`player-audio.ts`):
  - **Footsteps:** these come from the animation itself. The two foot bones are found by shape (`toes()` from the bone mapper), and a step plays when a foot sinks through the bottom of its swing (`steps.ts`). This works at any clip speed and on any rig. A rig without foot bones falls back to a cadence timer.
  - **Surface:** concrete on city pavement and roads outside it, grass on lawns and inland, sand by the coast (the same line as the terrain splat), and a splash when wading. Run steps use the run set on concrete.
  - **Variation:** each step is a random variant with ±6 percent pitch and ±15 percent volume.
  - **Jumps and landings:** a jump effort on take-off. On landing, a thud plus a scuff, louder and lower the harder the fall.
  - **Water:** a big or small splash entering the water (by fall or run speed), and a small one climbing out. A swim-stroke loop plays by swim speed at the surface. Under water, the beds switch to the underwater loop and everything else is low-passed.
- **Vehicles** (`vehicle-audio.ts`, `engine.ts`):
  - **Engine:** a pretend six-speed gearbox maps speed and throttle to rpm. Four recorded loops (idle, 2k, 4k, 5k) are crossfaded at equal power and each is pitched to the rpm. Off the throttle it is quieter. Revving at a standstill works.
  - **Tyres and crashes:** tyre squeal comes from sideways slip or the handbrake. A crash plays from a sudden velocity change (over about 3 g), scaled by how hard.
  - **Horn:** H loops the horn's steady middle while held and rings out on release.
  - **Doors and decks:** a door opens and shuts when getting in or out of a car. After a carjacking it only shuts. Boarding or leaving a boat makes a deck thud.
  - **Boat:** the outboard is pitched and swelled by speed and throttle, and a wake/hull-slap loop plays by speed.
- **Traffic** (`traffic-audio.ts`, `siren.ts`):
  - The nearest three traffic cars within 45 m each get a positional engine, pitched by speed. Voices are handed over as cars come and go.
  - With any stars, the nearest police cruiser (within 220 m) carries the siren, with a doppler shift.
  - A vehicle whose health hits zero explodes.
- **Combat** (`combat-audio.ts`):
  - **Shots:** one of three pistol shot variants with ±4 percent pitch. The echo send is 0.55 inside the city and 0.2 in the open.
  - **Reload, dry fire, casings:** a reload sound when one starts. A dry click on an empty gun with no reserve (the shooter now counts these). A shell casing tinkles 0.45 to 0.7 s after each shot.
  - **Impacts:** placed in 3D at the hit point, with a different sound for concrete, metal, and flesh. The shooter now records what each shot hit.
  - **Screams:** when gunfire sends more people running, the nearest one screams, at most once every 4.5 s.
- **Ambience** (`ambience.ts`, `ambience-mix.ts`): the beds crossfade over about a second as you move:
  - city traffic, which gives way to cicadas and distant traffic at night,
  - surf and gulls on the coast (fading the town out at sea),
  - the marina near the pier,
  - wind on the hills,
  - forest birds, which give way to night insects after dark,
  - the underwater hum.
  - Weights are normalised and equal-power, so crossings never swell. A bed loads the first time it is heard and is freed after 30 s of silence.
- **Music:**
  - The menu theme starts on the first click or key, plays through the loading screen, and fades out over 4 s once the world is on screen.
  - Chase music (WANTED, BLUE STEEL) fades in at 2 stars or more and fades out over 5 s when the level drops. It stands aside while the radio plays.
  - The wasted sting ducks the music for 4.5 s.
- **Radio** (`radio.ts`, `radio-player.ts`):
  - Three stations of two songs each, with names made up for this game: Ocean Drive FM, Bayside Beats, and Radio Calor.
  - Q and E step through the stations and Off. The radio plays only in a car or a boat.
  - Stations play on while you are away: coming back picks up where the playlist would be now.
  - A HUD-styled toast at top center shows the station name and the song.
- **UI sounds:**
  - Hover and focus tick in the menus, with select and back clicks. Esc closing a screen plays back. Sliders tick as they move, which previews the volume.
  - In game: map open and close swishes, a waypoint ping, the wanted-level-up sting, the wasted sting, a chime for each notification toast, and a select sound when the pause menu opens.
- **Credits:** `public/assets/CREDITS.md` and the Credits screen say "Epidemic Sound, owner subscription". Both list every music title and artist; CREDITS.md maps each sound file to its Epidemic title.

## Controls added

- **H:** horn, in a car.
- **Q / E:** previous or next radio station (including Off), in a car or boat.
- **Esc > Audio:** volume sliders and Mute.

## Checks

- **Vitest** (`src/audio/*.test.ts`):
  - bus volume persistence: round trip, junk, blocked storage, mute at the master;
  - rpm to pitch: idle, shifts, range, layer pitch, equal-power crossfade; plus boat, crash, and doppler;
  - surface selection;
  - the step detector: alternating feet, silence standing still;
  - ambience weights;
  - the radio state machine: the station cycle with Off, playing on while away, remembering spots.
- **E2E** (`e2e/audio.spec.ts`):
  1. Set the Music slider on the title screen and reload.
  2. Check that audio fetched before Play is under 1.5 MB (it is about 60 KB).
  3. Check that the slider kept its value.
  4. Press Play and check that the AudioContext is `running`, the setting reached the mixer, and there are no page errors.
- **A scripted headless run** (not committed) wrapped the mixer's and the 3D pool's `play` and counted events. Walking for 120 frames played 25 concrete footsteps. It also saw the jump, landing, shot, casing, concrete impact, panic scream, wanted sting, doors in and out, and the splash entering the ocean. The ambience beds and engine layers showed as sounding, and the radio streamed station 1, then station 2 after E.

## Known gaps

- Nothing was listened to by a human. Headless Chromium has no audio device, so levels and the mix are set by measurement and reasoning. The first owner listen will likely want gain tweaks; they live in one place per system (`LEVEL` constants and `gain` options).
- The menu and chase loops stream through an audio element's own `loop`, which can leave a few milliseconds of gap at the seam (marked `ponytail:` in `stream.ts`).
- The "RPM ramps" take (38 s) and the alternative close siren are unused.
- Traffic cars do not honk or crash audibly into each other. Police have no voice lines.
- Footsteps are not placed in 3D, and neither are other people's steps.
- The siren needs a visible police cruiser nearby. Wanted with no cruiser in range is silent apart from the chase music.
- The first click on the title screen is silent: the graph is built on that click, and its sound is still decoding.

## Screenshots (`.planning/phases/010e-screens/`)

- `audio-settings.jpg`: the new Audio tab on the title screen.
- `audio-radio.jpg`: tuning to Bayside Beats while driving, the station toast mid-fade.
- `audio-radio2.jpg`: the "Radio Off" toast on its glass panel.
- `audio-credits.jpg`: the Credits sheet with the Epidemic Sound entry and track list (caught mid-fade-in).

## Test results

- `pnpm lint`: clean.
- `pnpm test`: all unit tests pass, including 24 new audio tests.
- `pnpm build`: passes. The title-screen chunk is 24.9 kB with the audio boot.
- `pnpm test:e2e`: 10 passed (9.6 min), including the new audio test.
