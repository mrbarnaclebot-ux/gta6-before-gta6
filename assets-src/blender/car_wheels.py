"""One wheel: tyre, alloy or steel rim, and the brake disc seen through it. Axle along x,
rim face towards +x, origin at the hub, like the game's procedural wheel (wheel-model.ts),
so the right-hand wheels are the same mesh turned half round. No caliper: it would spin
with the wheel node."""

import math

from mathutils import Vector

from lib.geo import Geo, cyl, hexa, lathe, merge


def tyre(R, W, rim, segs, lod):
    sw, hw = R - rim, W / 2
    side = [(rim + 0.004, -hw * 0.80), (rim + 0.3 * sw, -hw * 0.97), (R - 0.3 * sw, -hw),
            (R - 0.07 * sw, -hw * 0.93), (R - 0.006, -hw * 0.8), (R, -hw * 0.68)]
    if lod:
        side = [side[0], side[2], side[4]]
    tread = [] if lod else [(R, -0.3 * hw), (R - 0.012, -0.27 * hw), (R - 0.012, -0.2 * hw),
                            (R, -0.17 * hw)]
    tread += [(r, -h) for r, h in reversed(tread)]
    outer = [(r, -h) for r, h in reversed(side)]
    return lathe(side + tread + outer, segs, 'tyre')


def barrel(rr, W, segs):
    """The rim's barrel as a thin closed shell, so its inside shows between the spokes."""
    hw = W / 2
    prof = [(rr - 0.01, -hw * 0.8), (rr + 0.004, -hw * 0.78), (rr + 0.004, hw * 0.6),
            (rr + 0.02, hw * 0.74), (rr + 0.012, hw * 0.82), (rr - 0.014, hw * 0.78),
            (rr - 0.022, hw * 0.6), (rr - 0.022, -hw * 0.78), (rr - 0.01, -hw * 0.8)]
    return lathe(prof, segs, 'rim')


def spoke(a, r0, r1, w0, w1, h0, h1, d, mat):
    """A tapered bar from radius r0 to r1 at angle a; its face drops from h0 to h1."""
    u = Vector((math.cos(a), 0, math.sin(a)))
    t = Vector((-math.sin(a), 0, math.cos(a)))
    e3 = Vector((0, -1, 0))  # u x t = -y, so (u, t, -y) is right-handed
    pts = []
    for r, w, h in ((r0, w0, h0), (r1, w1, h1)):
        for s in (-1, 1):
            for c in (-d / 2, d / 2):
                pts.append(u * r + t * s * w / 2 + e3 * (c - h))
    return hexa(pts, mat)


def spokes(style, rr, hf, lod):
    count, twin, w0, w1 = {'twin5': (5, 0.12, 0.03, 0.034), 'five': (5, 0, 0.055, 0.085),
                           'six': (6, 0, 0.05, 0.07)}[style]
    g = Geo()
    for i in range(count):
        a = 2 * math.pi * i / count
        for da in ((-twin, twin) if twin else (0,)):
            g.add(spoke(a + da, rr * 0.22, rr * 0.99, w0, w1, hf + 0.03, hf - 0.012, 0.035, 'rim'))
    return g


def steel(rr, hf, segs):
    """A pressed steel dish with a chrome cap, the police and fleet wheel."""
    dish = [(rr * 0.99, hf - 0.03), (rr * 0.8, hf - 0.02), (rr * 0.72, hf + 0.004),
            (rr * 0.55, hf + 0.004), (rr * 0.45, hf + 0.03), (rr * 0.3, hf + 0.032)]
    cap = [(rr * 0.3, hf + 0.03), (rr * 0.22, hf + 0.05), (0.0, hf + 0.058)]
    return merge(lathe(dish, segs, 'rim'), lathe(cap, segs // 2, 'chrome'))


def centre(rr, hf, segs, lod):
    g = lathe([(rr * 0.2, hf + 0.03), (rr * 0.15, hf + 0.045), (0.0, hf + 0.05)], segs // 2, 'rim')
    if lod:
        return g
    for i in range(5):
        a = 2 * math.pi * (i + 0.5) / 5
        nut = cyl(0.011, 0.02, 6, 'chrome').move(rr * 0.25 * math.cos(a), hf + 0.025,
                                                  rr * 0.25 * math.sin(a))
        g.add(nut)
    return g


def wheel(spec, lod=False):
    """spec: r (tyre radius), w (width), style, in metres."""
    R, W = spec['r'], spec['w']
    rr = R * spec.get('rim', 0.66)
    segs = 18 if lod else 40
    hf = W / 2 * 0.42
    g = tyre(R, W, rr, segs, lod)
    if lod:
        g.add(lathe([(rr, hf - 0.02), (rr * 0.5, hf), (0.0, hf + 0.03)], segs, 'rim'))
    else:
        g.add(barrel(rr, W, segs))
        disc = cyl(rr * 0.8, 0.024, 28, 'brake').move(0, -W * 0.12, 0)
        g.add(disc)
        if spec['style'] == 'steel':
            g.add(steel(rr, hf, segs))
        else:
            g.add(spokes(spec['style'], rr, hf, lod), centre(rr, hf, segs, lod))
    return g.rot((0, 0, 1), -90)
