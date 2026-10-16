// Page side of trailer.mjs, run in the game page: window.__trailer sets up each shot and
// moves the camera each frame. Self-contained, since Playwright serialises it into the page.
//
// Cameras (shot.cam.mode):
//   path   keys [{eye, target, fov?}], eased from the first to the last
//   orbit  around center from angle `from` to `to` (radians, 0 looks from +Z) at radius and height
//   track  follows the subject: offset and look as [right, up, ahead] in its heading
//   game   the game's own follow camera, turned to yaw and pitch at the start
// Setups (shot.setup.kind): walk, car, boat, carjack, shoot; keys [{at, down|up: code}] fire on time.
export function installTrailer() {
  const G = window.__game
  const view = document.getElementById('view')
  const key = (code, down) =>
    window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }))
  const tap = (code) => (key(code, true), setTimeout(() => key(code, false), 50))
  const mouse = (button, down) =>
    (down ? view : window).dispatchEvent(
      new MouseEvent(down ? 'mousedown' : 'mouseup', { button, bubbles: true }),
    )
  const held = new Set()
  const hold = (code, down) => {
    if (held.has(code) === down) return
    if (down) held.add(code)
    else held.delete(code)
    key(code, down)
  }
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a))
  const ease = (u) => u * u * (3 - 2 * u)
  const lerp = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k)
  const basis = (h) => ({ f: [Math.sin(h), 0, Math.cos(h)], r: [-Math.cos(h), 0, Math.sin(h)] })
  const local = (p, h, [r, u, f]) => {
    const b = basis(h)
    return [p[0] + b.r[0] * r + b.f[0] * f, p[1] + u, p[2] + b.r[2] * r + b.f[2] * f]
  }
  let S = null

  function subject() {
    const s = G.state()
    const p = s.position
    if (S.subject === 'traffic') {
      const c = G.traffic().find((t) => t.id === S.carId)
      if (c) return { p: [c.x, c.y, c.z], h: c.heading }
    }
    if (s.vehicle) return { p: [p.x, p.y, p.z], h: s.heading }
    return { p: [p.x, p.y, p.z], h: S.cam.heading ?? 0 }
  }

  const cameras = {
    path(c, u) {
      const k = c.keys
      const x = (c.linear ? u : ease(u)) * (k.length - 1)
      const i = Math.min(k.length - 2, Math.floor(x))
      const a = k[i]
      const b = k[i + 1]
      return {
        eye: lerp(a.eye, b.eye, x - i),
        target: lerp(a.target, b.target, x - i),
        fov: (a.fov ?? 45) + ((b.fov ?? a.fov ?? 45) - (a.fov ?? 45)) * (x - i),
      }
    },
    orbit(c, u) {
      const a = c.from + (c.to - c.from) * (c.linear ? u : ease(u))
      const [x, y, z] = c.center
      return {
        eye: [x + Math.sin(a) * c.radius, y + c.height, z + Math.cos(a) * c.radius],
        target: [x, y + (c.lookUp ?? 0), z],
        fov: c.fov ?? 45,
      }
    },
    track(c) {
      const { p, h } = subject()
      // The heading eases too, so a twitch of the steering does not whip the camera.
      S.h = S.h === undefined ? h : S.h + wrap(h - S.h) * (c.turn ?? 0.15)
      const want = local(p, S.h, c.offset)
      const k = c.smooth ?? 0.25
      S.eye = S.eye ? lerp(S.eye, want, k) : want
      return { eye: S.eye, target: local(p, S.h, c.look ?? [0, 1, 6]), fov: c.fov ?? 50 }
    },
  }

  /** Steer along road points: A or D toward a point `ahead` points on, W below `speed` m/s. */
  function autopilot(a) {
    const s = G.state()
    if (s.mode !== 'driving') return
    const p = s.position
    const pts = a.pts
    let best = a.i ?? 0
    for (let j = best; j < Math.min(pts.length, best + 40); j++)
      if (
        Math.hypot(pts[j].x - p.x, pts[j].z - p.z) <
        Math.hypot(pts[best].x - p.x, pts[best].z - p.z)
      )
        best = j
    a.i = best
    const t = pts[Math.min(pts.length - 1, best + (a.ahead ?? 6))]
    const err = wrap(Math.atan2(t.x - p.x, t.z - p.z) - s.heading)
    hold('KeyA', err > (a.dead ?? 0.03))
    hold('KeyD', err < -(a.dead ?? 0.03))
    hold('KeyW', s.speed < a.speed)
  }

  function headingAt(pts, i) {
    const a = pts[i]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    return Math.atan2(b.x - a.x, b.z - a.z)
  }

  const setups = {
    walk(u) {
      G.teleport(u.at[0], u.at[1] ?? G.ground(u.at[0], u.at[2]) + 0.3, u.at[2])
      G.setCameraYaw(u.yaw ?? 0)
      return () => true
    },
    car(u) {
      const door = G.landmarks().car
      G.teleport(door.x, door.y + 0.2, door.z)
      let polls = 0
      return () => {
        const s = G.state()
        if (s.mode === 'driving') {
          if (!S.placed) {
            const road = u.road && G.lane(u.road, u.side ?? 0)
            const near = (q) => Math.hypot(q.x - u.fromNear[0], q.z - u.fromNear[1])
            const i =
              road && u.fromNear
                ? road.indexOf(road.reduce((a, b) => (near(b) < near(a) ? b : a)))
                : (u.from ?? 0)
            const at = road ? road[i] : { x: u.at[0], y: u.at[1], z: u.at[2] }
            G.teleport(at.x, at.y + 0.6, at.z, road ? headingAt(road, i) : u.heading)
            if (road) S.pilot = { pts: road, i, speed: u.speed ?? 20, ahead: u.ahead }
            S.placed = true
          }
          return true
        }
        // F a second after each teleport, once the game has moved the player there; retry every 2 s.
        const d = G.landmarks().car
        if (++polls % 8 === 0) G.teleport(d.x, d.y + 0.2, d.z)
        if (polls % 8 === 4) tap('KeyF')
        return false
      }
    },
    boat(u) {
      const dock = G.landmarks().marina
      G.teleport(dock.x, dock.y + 0.3, dock.z)
      G.setCameraYaw(u.yaw ?? 0)
      let polls = 0
      return () => {
        const s = G.state()
        if (s.vehicle === 'boat') return true
        if (++polls % 8 === 0) G.teleport(dock.x, dock.y + 0.3, dock.z)
        if (polls % 8 === 4) tap('KeyF')
        return false
      }
    },
    carjack() {
      // A traffic car stops for someone standing in the road ahead of it (as e2e/boats.spec.ts).
      let wait = 0
      return () => {
        let c = G.traffic().find((t) => t.id === S.carId)
        if (!c || wait++ > 40) {
          c = G.traffic().find((t) => t.speed > 8)
          if (!c) return false
          S.carId = c.id
          wait = 0
          const x = c.x + Math.sin(c.heading) * 22
          const z = c.z + Math.cos(c.heading) * 22
          G.teleport(x, G.ground(x, z) + 0.2, z)
          return false
        }
        if (c.speed > 0.3) return false
        const x = c.x + Math.cos(c.heading) * 2.4 + Math.sin(c.heading) * 1.5
        const z = c.z - Math.sin(c.heading) * 2.4 + Math.cos(c.heading) * 1.5
        G.teleport(x, G.ground(x, z) + 0.2, z)
        G.setCameraYaw(c.heading + 2.2)
        S.jack = { x: c.x, y: c.y, z: c.z, h: c.heading }
        return true
      }
    },
    shoot(u) {
      const r = G.landmarks().range
      G.teleport(r.x, r.y + 0.3, r.z)
      G.setCameraYaw(u.yaw ?? 0)
      return () => true
    },
  }

  window.__trailer = {
    setup(shot) {
      S = { shot, cam: shot.cam, subject: shot.cam.subject }
      G.film(null)
      for (const c of held) hold(c, false)
      if (shot.hour !== undefined) G.setTime(shot.hour)
      const u = shot.setup ?? {}
      if (u.kind) S.ready = setups[u.kind](u)
      else {
        // A film shot: the player waits near the camera, so streaming covers the view.
        const at = u.at ?? shot.cam.keys?.[0]?.target ?? shot.cam.center
        G.teleport(at[0], (u.at?.[1] ?? G.ground(at[0], at[2])) + 0.3, at[2])
        S.ready = () => true
      }
      if (cameras[shot.cam.mode]) G.film(cameras[shot.cam.mode](shot.cam, 0))
    },
    ready: () => S.ready(),
    start(shot) {
      if (shot.hour !== undefined) G.setTime(shot.hour)
      if (S.subject === 'traffic' && S.carId === undefined) {
        const near = shot.cam.near
        const cars = G.traffic().filter(
          (t) => t.speed > 4 && (shot.cam.police ?? t.police) === t.police,
        )
        cars.sort(
          (a, b) =>
            Math.hypot(a.x - near[0], a.z - near[2]) - Math.hypot(b.x - near[0], b.z - near[2]),
        )
        S.carId = cars[0]?.id
      }
      if (shot.cam.mode === 'game') {
        G.film(null)
        if (shot.cam.yaw !== undefined) G.setCameraYaw(shot.cam.yaw)
        if (shot.cam.pitch !== undefined) G.setCameraPitch(shot.cam.pitch)
      }
      S.events = [...(shot.setup?.keys ?? [])]
    },
    step(t) {
      const u = t / S.shot.secs
      for (const e of S.events.filter((e) => e.at <= t)) {
        S.events.splice(S.events.indexOf(e), 1)
        if (e.down) hold(e.down, true)
        if (e.up) hold(e.up, false)
        if (e.tap) tap(e.tap)
        if (e.mouse !== undefined) mouse(e.mouse, e.press !== false)
        if (e.aim !== undefined) {
          const d = G.dummies()[e.aim]
          G.aimAt(d.x, d.y, d.z)
        }
      }
      if (S.pilot) autopilot(S.pilot)
      if (S.cam.mode === 'game') return
      if (S.cam.mode === 'jack') {
        const j = S.jack
        const c = S.cam
        G.film({
          eye: local([j.x, j.y, j.z], j.h, c.offset),
          target: local([j.x, j.y, j.z], j.h, c.look),
          fov: c.fov ?? 45,
        })
        return
      }
      G.film(cameras[S.cam.mode](S.cam, Math.max(0, Math.min(1, u))))
    },
    end() {
      for (const c of held) hold(c, false)
      mouse(0, false)
      mouse(2, false)
      S.pilot = null
      if (G.state().mode === 'driving') tap('KeyF')
      G.film(null)
    },
  }
}
