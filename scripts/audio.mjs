#!/usr/bin/env node
// Turns the raw Epidemic Sound downloads into the game's audio files in public/assets/audio.
// Usage: node scripts/audio.mjs <download dir with sfx/ and music/>   (needs ffmpeg on PATH)
// Short one-shots are peak-normalised; loops, ambience, and music get two-pass loudnorm.
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as a from './audio-lib.mjs'

const SRC = process.argv[2]
if (!SRC) throw new Error('Pass the download directory (it holds sfx/ and music/).')
const OUT = fileURLToPath(new URL('../public/assets/audio/', import.meta.url))
const sfx = (name) => join(SRC, 'sfx', `${name}.mp3`)
const music = (name) => join(SRC, 'music', `${name}.mp3`)

const MONO = { channels: 1, kbps: 96, level: -1, peak: true }
const LOOP = { channels: 1, kbps: 96, level: -20 }
const AMB = { channels: 2, kbps: 128, level: -24 }
const SONG = { channels: 2, kbps: 128, level: -16 }

/** One-shots: [output name, source, extra filter before the silence trim]. */
const SHOTS = [
  ['ui-hover', sfx('ui.hover')],
  ['ui-select', sfx('ui.select')],
  ['ui-back', sfx('ui.back')],
  ['ui-ping', sfx('ui.waypoint.ping')],
  // The sci-fi alarm, cut to its first pulse and darkened so it reads as a sting, not a klaxon.
  ['ui-wanted', sfx('ui.wanted.up'), 'atrim=0:0.75,lowpass=f=5000,afade=t=out:st=0.45:d=0.3'],
  ['ui-wasted', sfx('ui.wasted')],
  ['ui-chime', sfx('ui.mission.chime')],
  ['land', sfx('player.land.thud')],
  ['splash-big', sfx('water.splash.big')],
  ['splash-small', sfx('water.splash.small')],
  ['door-open', sfx('car.door.open')],
  ['door-close', sfx('car.door.close')],
  ['crash-1', sfx('car.crash.1')],
  ['crash-2', sfx('car.crash.2')],
  // The game loops 0.05 to 0.17 s of the trimmed file while H is held (HORN_LOOP in
  // src/audio/vehicle-audio.ts); TRIM starts it at the attack. Re-measure that if this changes.
  ['horn', sfx('car.horn'), 'atrim=0.05:0.7'],
  ['shot-1', sfx('pistol.shot.1')],
  ['shot-2', sfx('pistol.shot.2')],
  ['shot-3', sfx('pistol.shot.3')],
  // Sped up to fit the 1.6 s reload animation.
  ['reload', sfx('pistol.reload'), 'atempo=1.4'],
  ['dry', sfx('pistol.dryfire')],
  ['impact-concrete', sfx('bullet.impact.concrete')],
  ['impact-metal', sfx('bullet.impact.metal')],
  ['yank', sfx('carjack.door.yank'), 'atrim=0:1.3,afade=t=out:st=1:d=0.3'],
  ['scream', sfx('ped.panic.scream'), 'atrim=0:3.6,afade=t=out:st=2.4:d=1.2'],
]

/** Takes holding several separate hits: each becomes a numbered variant. [name, source, max s]. */
const VARIANTS = [
  ['jump', sfx('player.jump.effort'), 0.7],
  ['grunt', sfx('carjack.grunt'), 0.7],
  ['casing', sfx('pistol.casing.drop'), 0.6],
  ['ui-map', sfx('ui.map.open'), 0.6],
  ['explode', sfx('car.explosion'), 3],
]

/** Seamless loops: [name, source, from s, length s, crossfade s, format]. */
const LOOPS = [
  ['engine-idle', sfx('car.engine.idle.loop'), 0.5, 4, 0.5, LOOP],
  ['engine-2k', sfx('car.engine.rpm2k.loop'), 1, 4, 0.5, LOOP],
  ['engine-4k', sfx('car.engine.rpm4k.loop'), 1, 4, 0.5, LOOP],
  ['engine-5k', sfx('car.engine.rpm5k.loop'), 1, 4, 0.5, LOOP],
  ['outboard', sfx('boat.outboard.loop'), 5, 12, 1, LOOP],
  ['wake', sfx('boat.wake.loop'), 5, 14, 1.5, LOOP],
  ['swim', sfx('water.swim.loop'), 2, 12, 1, LOOP],
  ['skid', sfx('car.tyre.screech'), 0.2, 1.1, 0.3, LOOP],
  // A held tone from the wail take; the game sweeps its pitch into a wail or a US yelp.
  ['siren', sfx('police.siren.wail.loop'), 5.6, 5.2, 0.4, LOOP],
  ['amb-city', sfx('ambience.city.day.loop'), 10, 40, 3, AMB],
  ['amb-beach', sfx('ambience.beach.loop'), 10, 40, 3, AMB],
  ['amb-wind', sfx('ambience.wind.hill.loop'), 10, 40, 3, AMB],
  ['amb-forest', sfx('ambience.forest.day.loop'), 10, 40, 3, AMB],
  ['amb-night', sfx('ambience.night.city.loop'), 10, 40, 3, AMB],
  ['amb-marina', sfx('ambience.marina.loop'), 10, 40, 3, AMB],
  ['amb-underwater', sfx('ambience.underwater.loop'), 10, 25, 3, AMB],
]

/** Footsteps: [surface, sources, steps to keep, seconds per step, min gap between steps]. */
const STEPS = [
  ['concrete', [1, 2, 3].map((i) => sfx(`footstep.concrete.walk.${i}`)), 6, 0.36, 0.35],
  ['run', [1, 2, 3].map((i) => sfx(`footstep.concrete.run.${i}`)), 4, 0.22, 0.2],
  ['sand', [1, 2, 3].map((i) => sfx(`footstep.sand.${i}`)), 5, 0.36, 0.35],
  ['grass', [1, 2, 3].map((i) => sfx(`footstep.grass.${i}`)), 5, 0.36, 0.35],
]

/** Music streams. The menu and chase cues are Epidemic's own loop edits, kept whole. */
const SONGS = [
  ['music-menu', music('music.menu.loop'), false],
  ['music-chase', music('music.chase.loop'), false],
  ...[1, 2, 3].flatMap((s) =>
    [1, 2].map((t) => [`radio-${s}-${t}`, music(`radio.${s}.${t}`), true]),
  ),
]

const mp3 = (name) => join(OUT, `${name}.mp3`)
const cut = (t, len) =>
  `atrim=${Math.max(0, t - 0.015)}:${t - 0.015 + len},asetpts=N/SR/TB,afade=t=out:st=${len * 0.55}:d=${len * 0.45}`

function steps([surface, files, keep, len, gap]) {
  const per = Math.ceil(keep / files.length)
  const hits = files.flatMap((f) => a.pickHits(a.onsets(f, gap), per, len).map((h) => [f, h]))
  hits.slice(0, keep).forEach(([f, h], i) => {
    a.encode(a.render(f, cut(h.t, len), 1), mp3(`step-${surface}-${i + 1}`), { ...MONO, level: -3 })
  })
}

function variants([name, file, maxLen]) {
  // Quiet ring-outs between hits also cross the threshold; keep only the real hits.
  const all = a.onsets(file, 0.3)
  const top = Math.max(...all.map((h) => h.db))
  const hits = all.filter((h) => h.db > top - 15)
  hits.forEach((h, i) => {
    const len = Math.min(maxLen, (hits[i + 1]?.t ?? Infinity) - h.t - 0.03)
    a.encode(a.render(file, `${cut(h.t, len)},${a.TRIM}`, 1), mp3(`${name}-${i + 1}`), MONO)
  })
}

function main() {
  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })
  for (const [name, file, pre] of SHOTS) {
    a.encode(a.render(file, [pre, a.TRIM].filter(Boolean).join(','), 1), mp3(name), MONO)
  }
  VARIANTS.forEach(variants)
  STEPS.forEach(steps)
  for (const [name, file, from, len, xf, fmt] of LOOPS) {
    a.encode(a.graph(file, a.loopGraph(from, len, xf), fmt.channels), mp3(name), fmt)
  }
  for (const [name, file, trim] of SONGS)
    a.encode(a.render(file, trim && a.TRIM, 2), mp3(name), SONG)
  a.cleanup()
  summary()
}

function summary() {
  let total = 0
  for (const f of readdirSync(OUT).sort()) {
    const kb = statSync(join(OUT, f)).size / 1024
    total += kb
    console.log(
      `${f.padEnd(24)} ${a.duration(join(OUT, f)).toFixed(2).padStart(7)} s ${kb.toFixed(0).padStart(6)} KB`,
    )
  }
  console.log(`total ${(total / 1024).toFixed(2)} MB`)
}

main()
