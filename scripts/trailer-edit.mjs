// Trailer edit: node scripts/trailer-edit.mjs <frames-dir> <cards-dir> <audio-dir> <out.mp4>
// Cuts the shots from trailer.mjs to the song's bar grid, lays the cards from trailer-cards.mjs
// over them, and mixes the song, voice lines, and game sounds. <audio-dir> holds song57.wav
// (the 57 s Epidemic Sound edit of "I Won't Stop Now") and vo1.mp3 to vo3.mp3. Needs ffmpeg.
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const [FRAMES, CARDS, AUDIO, OUT] = process.argv.slice(2)
const SFX = fileURLToPath(new URL('../public/assets/audio/', import.meta.url))
const TMP = `${OUT}.parts`
mkdirSync(TMP, { recursive: true })
const FPS = 30
const BAR = 2.342
// The song starts at 0:03 and its first downbeat lands 1.19 s in.
const bar = (n) => +(4.19 + n * BAR).toFixed(3)
const GRADE = 'eq=contrast=1.05:saturation=1.12,vignette=angle=PI/6'

// [shot, slot start, slot end, in-point (s into the shot), extras]
// `x` dissolves into the shot over x seconds (cold open); `card` overlays [png, from, to].
const COLD = [
  ['rating', 0, 3],
  ['c1-skyline-sea', 3, bar(1), 0, { x: 0.6 }],
  ['c2-rooftop', bar(1), bar(2), 0.1, { x: 0.4 }],
  ['c3-beach-aerial', bar(2), bar(3), 0.1, { x: 0.4 }],
  ['c4-marina', bar(3), bar(4), 0.2, { x: 0.4, card: ['presents', 0.5, 2.1] }],
]
const CUTS = [
  ['m1-towers', bar(4), bar(5), 0.2],
  ['m2-beach-walk', bar(5), bar(6), 0.2],
  ['m3-speedboat', bar(6), bar(7), 0.2],
  ['m4-highway', bar(7), bar(8), 0.2],
  ['m5-lookout', bar(8), bar(9), 0.2],
  ['m6-canal', bar(9), bar(10), 0.2],
  ['m7-night-aerial', bar(10), bar(11), 0.2],
  ['m8-night-traffic', bar(11), bar(12), 0.3],
  ['m9-shore-dusk', bar(12), bar(13), 0.2],
  ['a1-carjack', bar(13), bar(14.5), 0.4, { card: ['chyron', 0.3, 3.4] }],
  ['a2-shoot', bar(14.5), bar(15.5), 0.1, { phone: true, card: ['social', 0.15, 2.3] }],
  ['a3-flyover-chase', bar(15.5), bar(16.5), 0.1],
  ['a4-boat-low', bar(16.5), bar(17), 0],
  ['a5-night-highway', bar(17), bar(17.5), 0],
  ['a6-police-patrol', bar(17.5), bar(18), 0.4],
  ['w1-coast-sunset', bar(18), bar(19), 0.2],
]
const END = bar(19)
const TOTAL = 60

const ff = (args) =>
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', ...args], { stdio: 'inherit' })
const enc = [
  '-c:v',
  'libx264',
  '-crf',
  '14',
  '-preset',
  'veryfast',
  '-pix_fmt',
  'yuv420p',
  '-r',
  `${FPS}`,
]

/** A card overlay that fades in and out, timed in the clip's seconds. */
const fadeCard = ([, from, to]) =>
  `format=rgba,fade=t=in:st=${from}:d=0.35:alpha=1,fade=t=out:st=${to - 0.35}:d=0.35:alpha=1`

/** One shot trimmed to its slot (plus the dissolve overlap) as an intermediate clip. */
function clip([shot, start, end, from = 0, extra = {}], i) {
  const secs = end - start + (extra.x ?? 0)
  const frames = Math.round(secs * FPS)
  const out = `${TMP}/${String(i).padStart(2, '0')}.mp4`
  if (shot === 'rating') {
    ff([
      '-loop',
      '1',
      '-framerate',
      `${FPS}`,
      '-i',
      `${CARDS}/rating.png`,
      '-vf',
      `format=yuv420p,setsar=1,fade=t=in:st=0.2:d=0.4,fade=t=out:st=${secs - 0.6}:d=0.6`,
      '-frames:v',
      `${frames}`,
      ...enc,
      out,
    ])
    return { out, secs }
  }
  const input = [
    '-framerate',
    `${FPS}`,
    '-start_number',
    `${Math.round(from * FPS) + 1}`,
    '-i',
    `${FRAMES}/${shot}/%04d.jpg`,
  ]
  // A phone clip: the middle 9:16 sharp over a blurred, darkened copy of the frame.
  let v = extra.phone
    ? `[0]${GRADE},split[a][b];[a]scale=1920:1080,boxblur=24,eq=brightness=-0.12[bg];[b]crop=608:1080[fg];[bg][fg]overlay=(W-w)/2:0`
    : `[0]${GRADE}`
  const args = [...input]
  if (extra.card) {
    args.push('-loop', '1', '-framerate', `${FPS}`, '-i', `${CARDS}/${extra.card[0]}.png`)
    v += `[v];[1]${fadeCard(extra.card)}[c];[v][c]overlay=shortest=1`
  }
  ff([
    ...args,
    '-filter_complex',
    `${v},setsar=1,format=yuv420p`,
    '-frames:v',
    `${frames}`,
    ...enc,
    out,
  ])
  return { out, secs }
}

/** The logo on black: the glow blooms, the wordmark settles from a slight zoom, the line fades in. */
function endCard(i) {
  const secs = TOTAL - END
  const out = `${TMP}/${String(i).padStart(2, '0')}.mp4`
  const loop = (png) => [
    '-loop',
    '1',
    '-framerate',
    `${FPS}`,
    '-t',
    `${secs}`,
    '-i',
    `${CARDS}/${png}.png`,
  ]
  const zoom = `scale=w='trunc(1920*(1+0.06*pow(max(0,1-t/4),2))/2)*2':h=-2:eval=frame,crop=1920:1080`
  ff([
    '-f',
    'lavfi',
    '-t',
    `${secs}`,
    '-i',
    `color=c=black:s=1920x1080:r=${FPS}`,
    ...loop('logo'),
    ...loop('endtext'),
    '-filter_complex',
    `[1]format=rgba,split[l][g];[g]gblur=sigma=28,colorchannelmixer=aa=1.6,fade=t=in:st=0.6:d=1.6:alpha=1[glow];` +
      `[l]fade=t=in:st=1.4:d=1.0:alpha=1[logo];[2]format=rgba,fade=t=in:st=3.2:d=0.8:alpha=1[txt];` +
      `[0][glow]overlay[a];[a][logo]overlay,${zoom}[b];[b][txt]overlay,fade=t=out:st=${secs - 1.1}:d=1.0,setsar=1,format=yuv420p`,
    '-frames:v',
    `${Math.round(secs * FPS)}`,
    ...enc,
    out,
  ])
  return { out, secs }
}

const cold = COLD.map((s, i) => ({ ...clip(s, i), x: s[4]?.x ?? 0, start: s[1] }))
const cuts = CUTS.map((s, i) => clip(s, i + COLD.length))
const end = endCard(COLD.length + CUTS.length)

// Dissolves chain the cold open (each finishes on its shot's slot start); then hard cuts.
const chain = cold.slice(1).map((c, i) => {
  const t = i === 0 ? 'fadeblack' : 'dissolve'
  const into = i === cold.length - 2 ? 'cold' : `x${i}`
  return `[${i ? `x${i - 1}` : 0}][${i + 1}]xfade=transition=${t}:duration=${c.x}:offset=${(c.start - c.x).toFixed(3)}[${into}]`
})
const parts = [...cold, ...cuts, end]
const concat = parts
  .slice(cold.length)
  .map((_, i) => `[${cold.length + i}]`)
  .join('')
const video = `${chain.join(';')};[cold]${concat}concat=n=${parts.length - cold.length + 1}:v=1:a=0,format=yuv420p[v]`

/** Piecewise-linear envelope over [[t, value], ...] as an ffmpeg expression in t. */
function env(points) {
  let e = `${points.at(-1)[1]}`
  for (let i = points.length - 2; i >= 0; i--) {
    const [t0, v0] = points[i]
    const [t1, v1] = points[i + 1]
    e = `if(lt(t,${t1}),${v0}+(${v1 - v0})*(t-${t0})/${t1 - t0 || 1},${e})`
  }
  return `if(lt(t,${points[0][0]}),${points[0][1]},${e})`
}

const open = bar(4) - 3 // song seconds where the montage opens the low-pass
const vo3 = bar(15.5) - 0.5
const shot = bar(14.5) - 0.1
const sounds = [
  // [file, at (s on the timeline), volume, seconds to keep]
  [`${AUDIO}/vo1.mp3`, 3.7, 1.5],
  [`${AUDIO}/vo2.mp3`, bar(1) + 0.35, 1.5],
  [`${AUDIO}/vo3.mp3`, vo3, 1.5],
  [`${SFX}amb-beach.mp3`, 0, 0.0, 14],
  [`${SFX}door-open.mp3`, bar(13) + 0.25, 0.7],
  [`${SFX}scream.mp3`, bar(13) + 0.9, 0.5],
  [`${SFX}shot-1.mp3`, shot + 0.5, 0.8],
  [`${SFX}shot-2.mp3`, shot + 1.3, 0.8],
  [`${SFX}shot-3.mp3`, shot + 1.9, 0.8],
  [`${SFX}outboard.mp3`, bar(16.5), 0.5, BAR / 2],
  [`${SFX}engine-5k.mp3`, bar(17), 0.45, BAR / 2],
  [`${SFX}siren.mp3`, bar(17.5), 0.35, BAR / 2],
]
const duck = [
  [0, 1],
  [vo3 - 3.2, 1],
  [vo3 - 3, 0.6],
  [vo3 + 0.8, 0.6],
  [vo3 + 1.2, 1],
]
let audio =
  `[a0]asplit[lo][hi];[lo]lowpass=f=520,volume='${env([
    [0, 0.45],
    [open - 0.15, 0.45],
    [open + 0.05, 0],
  ])}':eval=frame[lo2];` +
  `[hi]volume='${env([
    [0, 0],
    [open - 0.15, 0],
    [open + 0.05, 0.9],
  ])}*(${env(duck)})':eval=frame[hi2];` +
  `[lo2][hi2]amix=inputs=2:normalize=0,adelay=3000:all=1[song];`
const ins = sounds.map(([file, at, vol, keep], i) => {
  const gain = file.endsWith('amb-beach.mp3')
    ? `volume='${env([
        [0, 0],
        [1.5, 0.45],
        [11.5, 0.45],
        [13.6, 0.05],
      ])}':eval=frame`
    : `volume=${vol}`
  audio += `[a${i + 1}]${keep ? `atrim=0:${keep},afade=t=out:st=${keep - 0.2}:d=0.2,` : ''}${gain},adelay=${Math.round(at * 1000)}:all=1[s${i}];`
  return ['-i', file]
})
audio +=
  `[song]${sounds.map((_, i) => `[s${i}]`).join('')}amix=inputs=${sounds.length + 1}:normalize=0:duration=longest,` +
  `atrim=0:${TOTAL},afade=t=out:st=${TOTAL - 1.2}:d=1.2,alimiter=limit=0.9,aresample=48000[a]`
const audioIns = [['-i', `${AUDIO}/song57.wav`], ...ins].flat()
// Video inputs are 0..n-1; audio inputs follow, renamed a0.. in the graph.
const n = parts.length
const rename = Array.from(
  { length: sounds.length + 1 },
  (_, i) => `[${n + i}:a]anull[a${i}];`,
).join('')
ff([
  ...parts.flatMap((p) => ['-i', p.out]),
  ...audioIns,
  '-filter_complex',
  `${video};${rename}${audio}`,
  '-map',
  '[v]',
  '-map',
  '[a]',
  '-c:v',
  'libx264',
  '-crf',
  '18',
  '-preset',
  'slow',
  '-pix_fmt',
  'yuv420p',
  '-r',
  `${FPS}`,
  '-c:a',
  'aac',
  '-b:a',
  '192k',
  '-movflags',
  '+faststart',
  '-t',
  `${TOTAL}`,
  OUT,
])
console.log(`wrote ${OUT}`)
