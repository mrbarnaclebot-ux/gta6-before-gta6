# Trailer 1 plan

A 60 second trailer for GTA 6 BEFORE GTA 6, modelled on Rockstar's GTA VI Trailer 1 (youtube QdBZY2fkU-0, 1:30).

## What the reference trailer does

| Time | Section | Technique |
|---|---|---|
| 0:00-0:04 | Rating card on black | Sets the "real game" tone before a single frame of footage |
| 0:04-0:16 | Cold open | Slow sunset aerials (highway, fence) intercut with a quiet two-line exchange: "Do you know why you're here?" / "Bad luck, I guess." No music beat yet |
| 0:16-0:21 | Aerial establishing | Yacht wake, beach crowd, skyline; "ROCKSTAR GAMES PRESENTS" in small spaced caps, then a beat of black |
| 0:21-0:48 | Music montage | The song kicks in. One shot per bar at first: low-angle towers and palms, golden marsh, beach crowd, speedboat by the port cranes, night drive, street traffic, club, night aerial, neon strip |
| 0:48-1:05 | Social feed satire | Vertical phone clips with handles and captions mocking the world |
| 1:05-1:15 | News satire | Live news chyrons over chaos: aerial crash, dirt-bike gang, mugshot |
| 1:15-1:25 | The story beat | The two leads: heist masks, muscle car, motel. Line: "The only way we're going to get through this is by sticking together" |
| 1:25-1:31 | Logo | Neon "VI" glows on from black, the full wordmark builds, "COMING 2025", publisher mark |

What makes it work: golden-hour and neon colour throughout, almost no camera shake, real-world satire as the comedy, cuts locked to the downbeat once the song starts, and one emotional line before the logo.

## Our version (60 s, 1920x1080, 30 fps)

Music: "I Won't Stop Now" by Nikki Gee (Epidemic Sound), a 57 s edit that starts at 0:03 and fades out under the logo. Downbeats fall every 2.342 s from 0:04.19. The track is low-passed under the cold open and opens up on the montage, which stands in for the reference trailer's quiet intro.
Voice: three Epidemic Sound text-to-speech lines (Shaundria, Mike).

| Time | Shot | Source in our game |
|---|---|---|
| 0:00-0:03 | "May contain content inappropriate for friends" card | Rendered HTML card |
| 0:03-0:06.5 | Skyline from the sea at sunset, slow push. VO: "So. Do you know why you're here?" | Film camera at the ocean, 17.6 h |
| 0:06.5-0:08.9 | Rooftop, sun behind the towers. VO: "Couldn't wait for GTA 6... I guess." | Rooftop landmark, player on the ledge |
| 0:08.9-0:11.2 | Beach and boulevard aerial drift | Film camera over the beach |
| 0:11.2-0:13.6 | Marina aerial, "A WEEKEND PROJECT PRESENTS" | Film camera over the pier |
| 0:13.6-0:34.6 | Montage, one shot per bar: towers looking up, walking the beach, speedboat wake, highway traffic, hill lookout at sunset, neon canal, night aerial, night street, palms at the shore | Mixed film and tracking cameras |
| 0:34.6-0:46.4 | Action with satire: carjack under a "VICE NEWS LIVE" chyron, beach target practice as a social post, the flyover drive with VO "The only way we get through this wait... is together.", then half-bar cuts of boats and cars | Gameplay with the native chase camera, plus tracking cameras |
| 0:46.4-0:48.7 | Wide sunset over the whole coast | Film camera high over the sea |
| 0:48.7-0:57 | Logo on black: glow builds, wordmark settles | public/assets/ui/logo.webp |
| 0:57-1:00 | "PLAY FREE IN YOUR BROWSER", fade out | Rendered HTML card |

## How it is made

1. Capture: `scripts/trailer.mjs` drives the real game in headless Chromium on the Metal GPU at the Ultra preset with the HUD hidden. Playwright's fake clock steps time 1/30 s per captured frame, so every shot is smooth 30 fps no matter how slow the render. The camera is set each frame through `window.__game.film()`, a small override added to the test hook. Gameplay shots press real keys; a page-side autopilot steers cars along road points.
2. Graphics: title cards, the chyron, the social post, and the end card are HTML pages screenshotted to transparent PNGs in the game's own font (Anton) and colours.
3. Edit: ffmpeg cuts the shots to the bar grid, adds a light grade and crossfades in the cold open, overlays the graphics, and mixes the song, voice, and ambience into an H.264 MP4 with AAC audio.

## Risks

- The world is simpler than Vice City up close, so shots favour golden hour, night neon, and distance, where the lighting carries the image.
- Gameplay shots depend on traffic and physics; each one is re-captured until it reads cleanly.
- Licence: Epidemic Sound music and voice in a trailer shared with friends, the same decision already taken for the game audio.
