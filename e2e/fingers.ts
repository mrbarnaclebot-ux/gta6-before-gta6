import type { CDPSession, Page } from '@playwright/test'

type Point = { x: number; y: number }

/**
 * Multi-touch through the DevTools protocol: Playwright's touchscreen only taps, and the
 * game needs a held thumbstick, a drag, and a button press at the same time.
 */
export class Fingers {
  private readonly down = new Map<number, Point>()
  private next = 1

  private constructor(private readonly cdp: CDPSession) {}

  static async on(page: Page): Promise<Fingers> {
    return new Fingers(await page.context().newCDPSession(page))
  }

  private send(type: 'touchStart' | 'touchMove' | 'touchEnd') {
    const touchPoints = [...this.down].map(([id, p]) => ({ id, x: p.x, y: p.y }))
    return this.cdp.send('Input.dispatchTouchEvent', { type, touchPoints })
  }

  /** A new finger lands; returns its id. */
  async start(p: Point): Promise<number> {
    const id = this.next++
    this.down.set(id, p)
    await this.send('touchStart')
    return id
  }

  /** Slides a finger to `to` in `steps` moves, so the page sees a drag, not a jump. */
  async move(id: number, to: Point, steps = 4): Promise<void> {
    const from = this.down.get(id)!
    for (let i = 1; i <= steps; i++) {
      const t = i / steps
      this.down.set(id, { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t })
      await this.send('touchMove')
    }
  }

  /** Lifts one finger. The protocol diffs the point list, so the others stay down. */
  async end(id: number): Promise<void> {
    this.down.delete(id)
    await this.send(this.down.size ? 'touchMove' : 'touchEnd')
  }

  async tap(p: Point): Promise<void> {
    await this.end(await this.start(p))
  }
}
