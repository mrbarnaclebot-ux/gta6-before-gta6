import { describe, expect, it } from 'vitest'
import { mark, newRadio, OFF, spotAt, tune } from './radio'

describe('radio', () => {
  it('cycles through every station and Off, both ways', () => {
    const r = newRadio(3, 0)
    expect(r.station).toBe(0)
    expect([tune(r, 1), tune(r, 1), tune(r, 1), tune(r, 1)]).toEqual([1, 2, OFF, 0])
    expect([tune(r, -1), tune(r, -1)]).toEqual([OFF, 2])
  })

  it('keeps a station playing while away', () => {
    const durations = [100, 50]
    expect(spotAt({ track: 0, time: 10, at: 0 }, 30, durations)).toEqual({ track: 0, time: 40 })
    expect(spotAt({ track: 0, time: 90, at: 0 }, 20, durations)).toEqual({ track: 1, time: 10 })
    // Past the end of the playlist it wraps to the first song.
    expect(spotAt({ track: 1, time: 40, at: 0 }, 15, durations)).toEqual({ track: 0, time: 5 })
  })

  it('remembers where a station was left, but not for Off', () => {
    const r = newRadio(2, 0)
    mark(r, 1, 1, 33, 100)
    expect(r.spots[1]).toEqual({ track: 1, time: 33, at: 100 })
    mark(r, OFF, 0, 0, 100)
    expect(r.spots).toHaveLength(2)
  })
})
