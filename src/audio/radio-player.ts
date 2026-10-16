import type { Input } from '../input/input'
import { STATIONS } from './catalog'
import type { Mixer } from './mixer'
import { mark, newRadio, OFF, spotAt, tune } from './radio'
import { Stream } from './stream'

const LEVEL = 0.8
const TOAST_MS = 3500
const now = () => performance.now() / 1000
const durations = (s: number) => STATIONS[s].tracks.map((t) => t.seconds)

/** The car radio: Q and E step through the stations and Off, only in a car or a boat. */
export class RadioPlayer {
  readonly state = newRadio(STATIONS.length, now())
  private readonly stream: Stream
  private readonly toastEl = document.getElementById('radio') as HTMLElement
  private toastTimer = 0
  private track = 0
  private aboard = false
  private level = -1

  constructor(mixer: Mixer) {
    this.stream = new Stream(mixer)
    this.stream.el.addEventListener('ended', () => this.nextSong())
  }

  /** Whether a station is on and heard: the chase music stands aside for it. */
  get playing(): boolean {
    return this.aboard && this.state.station !== OFF
  }

  /** `duck` 0 to 1 lowers the radio (under the wasted sting). */
  update(aboard: boolean, input: Input, duck: number): void {
    const step = input.consume('radioNext') ? 1 : input.consume('radioPrev') ? -1 : 0
    if (aboard !== this.aboard) {
      this.aboard = aboard
      if (aboard) this.tuneIn(true)
      else this.leave()
    } else if (aboard && step) {
      this.leave()
      tune(this.state, step)
      this.tuneIn(true)
    }
    const level = this.playing ? LEVEL * duck : 0
    if (level !== this.level) this.stream.fadeTo(level, level > this.level ? 0.6 : 0.4)
    this.level = level
  }

  private tuneIn(toast: boolean): void {
    const s = this.state.station
    if (s === OFF) return this.toast('Radio Off', '')
    const { track, time } = spotAt(this.state.spots[s], now(), durations(s))
    this.play(s, track, time)
    if (toast) this.toast(STATIONS[s].name, songLine(s, track))
  }

  private play(station: number, track: number, time: number): void {
    this.track = track
    this.stream.load(STATIONS[station].tracks[track].file, false)
    this.stream.el.currentTime = time
    this.level = -1
  }

  /** Remember where this station was, so it plays on while we are gone. */
  private leave(): void {
    const s = this.state.station
    if (s === OFF || !this.stream.src) return
    mark(this.state, s, this.track, this.stream.el.currentTime, now())
  }

  private nextSong(): void {
    const s = this.state.station
    if (s === OFF) return
    const next = (this.track + 1) % STATIONS[s].tracks.length
    mark(this.state, s, next, 0, now())
    this.play(s, next, 0)
  }

  /** The station name, styled like the HUD, top center for a few seconds. */
  private toast(name: string, song: string): void {
    this.toastEl.querySelector('.radio-name')!.textContent = name
    this.toastEl.querySelector('.radio-song')!.textContent = song
    this.toastEl.hidden = false
    // Restart the fade animation for a quick second press.
    this.toastEl.classList.remove('on')
    void this.toastEl.offsetWidth
    this.toastEl.classList.add('on')
    clearTimeout(this.toastTimer)
    this.toastTimer = window.setTimeout(() => (this.toastEl.hidden = true), TOAST_MS)
  }
}

function songLine(station: number, track: number): string {
  const t = STATIONS[station].tracks[track]
  return `${t.title} - ${t.artist}`
}
