/*
 * Loading progress as pure data: the steps between Play and the first frame, each
 * weighted by about how long it takes on a mid laptop. The files step fills as the
 * three.js loading manager reports glb, hdr, and texture downloads.
 */

export type Step = 'code' | 'physics' | 'files' | 'world' | 'shaders'

const STEPS: { step: Step; weight: number; label: string }[] = [
  { step: 'code', weight: 0.12, label: 'Loading the engine' },
  { step: 'physics', weight: 0.06, label: 'Starting physics' },
  { step: 'files', weight: 0.52, label: 'Streaming the city' },
  { step: 'world', weight: 0.18, label: 'Building the city' },
  { step: 'shaders', weight: 0.12, label: 'Compiling shaders' },
]

export class LoadProgress {
  private readonly done = new Set<Step>()
  private loaded = 0
  private total = 0
  /** Highest value shown so far: more files can be queued mid-load, but the bar never goes back. */
  private shown = 0

  finish(step: Step): void {
    this.done.add(step)
  }

  files(loaded: number, total: number): void {
    this.loaded = loaded
    this.total = total
  }

  /** 0 to 1. */
  get value(): number {
    let v = 0
    for (const { step, weight } of STEPS) {
      if (this.done.has(step)) v += weight
      else if (step === 'files' && this.total > 0) v += (weight * this.loaded) / this.total
    }
    this.shown = Math.max(this.shown, Math.min(1, v))
    return this.shown
  }

  /** What the first unfinished step is doing, for the status line. */
  get status(): string {
    const next = STEPS.find(({ step }) => !this.done.has(step))
    if (!next) return 'Ready'
    if (next.step !== 'files' || this.total === 0) return next.label
    return `${next.label} ${this.loaded} of ${this.total}`
  }
}
