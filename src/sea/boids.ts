/*
 * Fish schools as boids: cohesion, alignment, and separation inside a school, a pull back
 * to the school's home on the reef, the seabed and surface as soft walls, and a panic that
 * scatters the school when the player swims close, then fades so it regroups.
 */

export interface V3 {
  x: number
  y: number
  z: number
}

export interface School {
  n: number
  /** x, y, z per fish. */
  pos: Float32Array
  vel: Float32Array
  home: V3
  /** Meters the school may roam from home before it is pulled back. */
  range: number
  /** Cruising speed in m/s. */
  speed: number
  /** 0 calm to 1 fleeing; decays over a few seconds. */
  panic: number
}

export interface BoidWorld {
  /** Seabed height at (x, z). */
  floor: (x: number, z: number) => number
  /** Water surface height. */
  surface: number
  /** Something to flee (the swimmer), or null. */
  threat: V3 | null
}

const VIEW = 1.8
const PERSONAL = 0.5
const SCARE = 5
const CLEARANCE = 0.6

/** Builds a school of `n` fish around `home`, all heading the same way. */
export function makeSchool(
  n: number,
  home: V3,
  rand: () => number,
  speed = 0.9,
  range = 8,
): School {
  const pos = new Float32Array(n * 3)
  const vel = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    pos[i * 3] = home.x + (rand() - 0.5) * 3
    pos[i * 3 + 1] = home.y + (rand() - 0.5) * 1.5
    pos[i * 3 + 2] = home.z + (rand() - 0.5) * 3
    vel[i * 3] = speed
    vel[i * 3 + 2] = (rand() - 0.5) * 0.2
  }
  return { n, pos, vel, home, range, speed, panic: 0 }
}

// Scratch sums per axis: offset to neighbors (cohesion), their velocity (alignment), push (separation).
const center = [0, 0, 0]
const heading = [0, 0, 0]
const push = [0, 0, 0]
const d = [0, 0, 0]

/** Neighbor steering for fish i: toward the group, along its heading, away from fish too close. */
function flock(s: School, i: number, calm: number, out: number[]): void {
  const { pos, vel, n } = s
  center.fill(0)
  heading.fill(0)
  push.fill(0)
  let k = 0
  for (let j = 0; j < n; j++) {
    if (j === i) continue
    for (let a = 0; a < 3; a++) d[a] = pos[j * 3 + a] - pos[i * 3 + a]
    const d2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2]
    if (d2 > VIEW * VIEW) continue
    k++
    const w = d2 < PERSONAL * PERSONAL ? 1 / Math.max(d2, 0.01) : 0
    for (let a = 0; a < 3; a++) {
      center[a] += d[a]
      heading[a] += vel[j * 3 + a]
      push[a] -= d[a] * w
    }
  }
  for (let a = 0; a < 3; a++) {
    const align = k ? (heading[a] / k - vel[i * 3 + a]) * 1.1 : 0
    out[a] = (k ? (center[a] * 0.8 * calm) / k : 0) + align + push[a] * 0.25
  }
}

/** Steering away from the reef edge, the seabed, the surface, and the threat. */
function bounds(s: School, i: number, w: BoidWorld, out: number[]): void {
  const x = s.pos[i * 3],
    y = s.pos[i * 3 + 1],
    z = s.pos[i * 3 + 2]
  const hx = s.home.x - x,
    hy = s.home.y - y,
    hz = s.home.z - z
  const hd = Math.hypot(hx, hy, hz)
  const pull = hd > s.range ? (hd - s.range) / s.range + 0.2 : 0.05
  out[0] += (hx / (hd || 1)) * pull
  out[1] += (hy / (hd || 1)) * pull
  out[2] += (hz / (hd || 1)) * pull
  const low = w.floor(x, z) + CLEARANCE
  if (y < low + 0.5) out[1] += (low + 0.5 - y) * 4
  if (y > w.surface - 0.5) out[1] -= (y - w.surface + 0.5) * 4
  if (!w.threat) return
  const tx = x - w.threat.x,
    ty = y - w.threat.y,
    tz = z - w.threat.z
  const td = Math.hypot(tx, ty, tz)
  if (td > SCARE) return
  s.panic = 1
  const f = (8 * (SCARE - td)) / SCARE / (td || 1)
  out[0] += tx * f
  out[1] += ty * f * 0.5
  out[2] += tz * f
}

/** One step of every fish in the school. */
export function stepSchool(s: School, w: BoidWorld, dt: number): void {
  s.panic = Math.max(0, s.panic - dt * 0.35)
  // A panicked school stops holding together, so it scatters instead of fleeing as one blob.
  const calm = 1 - 0.85 * s.panic
  const steer = [0, 0, 0]
  const top = s.speed * (1 + 2.2 * s.panic)
  for (let i = 0; i < s.n; i++) {
    flock(s, i, calm, steer)
    bounds(s, i, w, steer)
    const v = s.vel
    let vx = v[i * 3] + steer[0] * dt * 2
    let vy = (v[i * 3 + 1] + steer[1] * dt * 2) * 0.98
    let vz = v[i * 3 + 2] + steer[2] * dt * 2
    const sp = Math.hypot(vx, vy, vz) || 1
    const clamped = Math.min(Math.max(sp, s.speed * 0.5), top)
    vx *= clamped / sp
    vy *= clamped / sp
    vz *= clamped / sp
    v[i * 3] = vx
    v[i * 3 + 1] = vy
    v[i * 3 + 2] = vz
    s.pos[i * 3] += vx * dt
    s.pos[i * 3 + 2] += vz * dt
    // Never through the seabed, whatever the steering says.
    const floor = w.floor(s.pos[i * 3], s.pos[i * 3 + 2]) + 0.15
    s.pos[i * 3 + 1] = Math.max(s.pos[i * 3 + 1] + vy * dt, floor)
  }
}
