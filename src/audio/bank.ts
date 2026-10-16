import { urls, type Sound } from './catalog'

/**
 * Downloads and decodes sound files on demand. Files can be fetched before there is an
 * AudioContext (browsers only allow one after a click), and decode once there is.
 */
export class Bank {
  private readonly raw = new Map<string, Promise<ArrayBuffer>>()
  private readonly decoded = new Map<Sound, AudioBuffer[]>()
  private readonly pending = new Map<Sound, Promise<void>>()

  constructor(private readonly ctx: () => BaseAudioContext | null) {}

  /** Starts the downloads only. */
  prefetch(sound: Sound): void {
    for (const url of urls(sound)) this.fetch(url)
  }

  /** The decoded variants, or null while they load (the first call starts the load). */
  get(sound: Sound): AudioBuffer[] | null {
    const ready = this.decoded.get(sound)
    if (ready) return ready.length ? ready : null
    if (!this.pending.has(sound) && this.ctx()) this.pending.set(sound, this.load(sound))
    return null
  }

  /** Frees a big buffer nobody has heard for a while (ambience); it reloads when needed. */
  unload(sound: Sound): void {
    if (!this.decoded.has(sound)) return
    this.decoded.delete(sound)
    this.pending.delete(sound)
  }

  private fetch(url: string): Promise<ArrayBuffer> {
    let got = this.raw.get(url)
    if (!got) {
      got = fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${url}: ${r.status}`)
        return r.arrayBuffer()
      })
      this.raw.set(url, got)
    }
    return got
  }

  private async load(sound: Sound): Promise<void> {
    const ctx = this.ctx()!
    try {
      const buffers = await Promise.all(
        urls(sound).map(async (url) => {
          // Decoding takes the bytes; forget them so a later reload fetches afresh.
          const bytes = await this.fetch(url)
          this.raw.delete(url)
          return ctx.decodeAudioData(bytes)
        }),
      )
      this.decoded.set(sound, buffers)
    } catch (err) {
      // A missing or undecodable file leaves the game silent there, not broken.
      console.warn(`sound ${sound} failed to load`, err)
      this.decoded.set(sound, [])
    }
  }
}
