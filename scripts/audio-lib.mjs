// ffmpeg helpers for scripts/audio.mjs: trim, loudness, seamless loops, and step slicing.
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Seconds of audio a loop file carries past each end, so encoder padding never lands in the loop. */
export const LOOP_PAD = 0.1
const RATE = 44100
const tmp = mkdtempSync(join(tmpdir(), 'vice-audio-'))
let serial = 0
const scratch = () => join(tmp, `${serial++}.wav`)
export const cleanup = () => rmSync(tmp, { recursive: true, force: true })

function ffmpeg(args) {
  return execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...args], {
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 1 << 30,
  })
}

/** ffmpeg prints filter reports (loudnorm, volumedetect) on stderr. */
function report(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr)
  return r.stderr
}

export function duration(file) {
  const out = execFileSync('ffprobe', [
    ...['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
  ])
  return Number(String(out).trim())
}

/** Mono float samples at `sr`, high-passed so rumble does not read as a hit. */
export function pcm(file, sr) {
  const buf = ffmpeg(
    ['-i', file, '-ac', '1', '-ar', String(sr), '-af', 'highpass=f=80'].concat([
      '-f',
      'f32le',
      '-',
    ]),
  )
  return new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4)
}

/** Renders `src` through `filter` to a scratch WAV (mono or stereo at 44.1 kHz). */
export function render(src, filter, channels) {
  const out = scratch()
  const af = filter ? ['-af', filter] : []
  ffmpeg(['-i', src, ...af, '-ac', String(channels), '-ar', String(RATE), out])
  return out
}

/** Like render, but with a full filter graph over one input labelled [0:a], ending in [out]. */
export function graph(src, complex, channels) {
  const out = scratch()
  ffmpeg(
    ['-i', src, '-filter_complex', complex, '-map', '[out]'].concat([
      '-ac',
      String(channels),
      '-ar',
      String(RATE),
      out,
    ]),
  )
  return out
}

/** Gain filter that brings `wav` to a peak of `peak` dBFS: for short one-shots. */
function peakGain(wav, peak) {
  const text = report(['-i', wav, '-af', 'volumedetect', '-f', 'null', '-'])
  const max = Number(/max_volume: (-?[\d.]+) dB/.exec(text)[1])
  return `volume=${(peak - max).toFixed(2)}dB`
}

/** Two-pass linear loudnorm to `lufs`: for loops, ambience, and music (3 s and longer). */
function loudGain(wav, lufs) {
  const target = `I=${lufs}:TP=-1.5:LRA=20`
  const text = report(['-i', wav, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-'])
  const m = JSON.parse(text.slice(text.lastIndexOf('{'), text.lastIndexOf('}') + 1))
  const measured = `measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}`
  return `loudnorm=${target}:${measured}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`
}

/**
 * Normalises a scratch WAV and encodes the final MP3: to a peak of `level` dBFS with `peak`
 * (one-shots), otherwise to `level` LUFS.
 */
export function encode(wav, out, { kbps, level, channels, peak }) {
  const norm = peak ? peakGain(wav, level) : loudGain(wav, level)
  const codec = ['-c:a', 'libmp3lame', '-b:a', `${kbps}k`]
  ffmpeg(['-i', wav, '-af', `${norm},aresample=${RATE}`, '-ac', String(channels), ...codec, out])
}

/** Silence trimmed from both ends: the head below -50 dB, the tail below -62 dB so reverb tails stay. */
export const TRIM =
  'silenceremove=start_periods=1:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_threshold=-62dB,areverse'

/**
 * A seamless loop: `len` seconds from `from`, its last `xf` seconds crossfaded into its head
 * (equal power), then LOOP_PAD of wrap-around audio added at both ends. The game loops
 * between LOOP_PAD and duration - LOOP_PAD.
 */
export function loopGraph(from, len, xf) {
  const body = len - xf
  const p = LOOP_PAD
  return [
    `[0:a]atrim=${from}:${from + len},asetpts=N/SR/TB,asplit[a][b]`,
    `[a]atrim=${xf}:${len},asetpts=N/SR/TB[tail]`,
    `[b]atrim=0:${xf},asetpts=N/SR/TB[head]`,
    `[tail][head]acrossfade=d=${xf}:c1=qsin:c2=qsin,asplit=3[o1][o2][o3]`,
    `[o1]atrim=${body - p}:${body},asetpts=N/SR/TB[pre]`,
    `[o3]atrim=0:${p},asetpts=N/SR/TB[post]`,
    `[pre][o2][post]concat=n=3:v=0:a=1[out]`,
  ].join(';')
}

/** Step onsets: where the 10 ms energy envelope rises through a threshold, at least `gap` s apart. */
export function onsets(file, gap) {
  const sr = 22050
  const x = pcm(file, sr)
  const hop = Math.round(sr / 100)
  const env = []
  for (let i = 0; i + hop <= x.length; i += hop) {
    let s = 0
    for (let j = i; j < i + hop; j++) s += x[j] * x[j]
    env.push(10 * Math.log10(s / hop + 1e-12))
  }
  const sorted = [...env].sort((a, b) => a - b)
  const floor = sorted[Math.floor(env.length * 0.2)]
  const thr = floor + (sorted[env.length - 1] - floor) * 0.45
  const found = []
  for (let i = 0; i < env.length; i++) {
    if (env[i] <= thr || (env[i - 1] ?? -Infinity) > thr) continue
    if (found.length && i / 100 - found.at(-1).t < gap) continue
    found.push({ t: i / 100, db: Math.max(...env.slice(i, i + 8)) })
  }
  return found
}

/**
 * Picks `keep` clean hits from a multi-hit take: not the first or last, close to the median
 * level, with room before the next hit; spread across the take.
 */
export function pickHits(hits, keep, len) {
  const inner = hits.slice(1, -1).filter((h, i) => (hits[i + 2]?.t ?? Infinity) - h.t > len)
  const median = [...inner].sort((a, b) => a.db - b.db)[inner.length >> 1]?.db ?? 0
  const even = inner.filter((h) => Math.abs(h.db - median) < 3)
  const pool = even.length >= keep ? even : inner
  const step = pool.length / keep
  return Array.from({ length: Math.min(keep, pool.length) }, (_, i) => pool[Math.floor(i * step)])
}
