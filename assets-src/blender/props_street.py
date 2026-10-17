"""Street furniture: bench, bin, hydrant, planter, cafe set, AC unit, rooftop water tank.
Each is one Geo in metres, standing on y = 0, centred, its front (the side you use)
towards +z."""

import math

from lib.geo import Geo, box, cyl, extrude_x, lathe, merge, torus, tube


def bench():
    """Wooden slats on two cast-iron ends with armrests, 1.8 m long."""
    g = Geo()
    for k in range(4):
        g.add(box(1.8, 0.035, 0.09, 'wood_slat', bevel=0.008, segs=1).move(0, 0.44, 0.18 - k * 0.11))
    for k in range(3):
        slat = box(1.8, 0.09, 0.035, 'wood_slat', bevel=0.008, segs=1).move(0, 0.56 + k * 0.12, 0)
        g.add(slat.rot((1, 0, 0), -12).move(0, 0, -0.22))
    side = [(0.22, 0.0), (0.16, 0.0), (0.12, 0.4), (-0.18, 0.4), (-0.24, 0.0), (-0.3, 0.0),
            (-0.24, 0.42), (-0.32, 0.92), (-0.27, 0.92), (-0.17, 0.46), (0.2, 0.44)]
    for x in (-0.8, 0.8):
        g.add(extrude_x(side, x - 0.025, x + 0.025, 'metal_dark'))
        g.add(box(0.06, 0.04, 0.42, 'metal_dark').move(x, 0.66, 0.03))
    return g


def bin_():
    """Slatted round litter bin with a domed lid, 0.95 m tall."""
    g = lathe([(0.24, 0.0), (0.26, 0.05), (0.26, 0.82), (0.28, 0.84)], 16, 'metal_green')
    for k in range(16):
        a = 2 * math.pi * k / 16
        g.add(box(0.05, 0.74, 0.03, 'metal_green').rot((0, 1, 0), -math.degrees(a) + 90)
              .move(0.275 * math.cos(a), 0.45, 0.275 * math.sin(a)))
    g.add(lathe([(0.3, 0.84), (0.3, 0.88), (0.22, 0.95), (0.08, 0.97), (0.0, 0.97)], 16, 'metal_green'))
    g.add(box(0.2, 0.06, 0.04, 'metal_dark').move(0, 0.9, 0.3))
    return g


def hydrant():
    """Florida fire hydrant: yellow barrel, bonnet, two side outlets and a pumper nozzle."""
    prof = [(0.17, 0.0), (0.17, 0.06), (0.12, 0.08), (0.11, 0.1), (0.11, 0.55), (0.14, 0.57),
            (0.14, 0.62), (0.12, 0.63), (0.1, 0.72), (0.05, 0.76), (0.0, 0.77)]
    g = lathe(prof, 16, 'yellow_paint')
    g.add(cyl(0.025, 0.06, 6, 'metal_dark').move(0, 0.76, 0))
    for rot in (90, -90):
        nozzle = cyl(0.045, 0.12, 12, 'yellow_paint').rot((0, 0, 1), rot).move(0, 0.42, 0)
        cap = cyl(0.05, 0.03, 6, 'metal_light').rot((0, 0, 1), rot).move(0, 0.42, 0)
        g.add(nozzle, cap.move(-0.13 if rot == 90 else 0.13, 0, 0))
    pump = cyl(0.07, 0.14, 12, 'yellow_paint').rot((1, 0, 0), 90).move(0, 0.36, 0)
    g.add(pump, cyl(0.075, 0.03, 6, 'metal_light').rot((1, 0, 0), 90).move(0, 0.36, 0.14))
    return g


def palm_frond(a, length, droop):
    """One frond: a bent strip of quads from the crown, drawn both sides."""
    pts = []
    for k in range(5):
        t = k / 4
        r = length * t
        pts.append((r * math.cos(a), 0.05 + 0.25 * t - droop * t * t, r * math.sin(a)))
    w = [0.02, 0.12, 0.14, 0.1, 0.01]
    side = (-math.sin(a), 0, math.cos(a))
    v = [(x + s * wk * side[0], y, z + s * wk * side[2]) for (x, y, z), wk in zip(pts, w)
         for s in (-1, 1)]
    f = [(2 * k, 2 * k + 1, 2 * k + 3, 2 * k + 2) for k in range(4)]
    return Geo(v, f, 'leaf')


def planter():
    """Square concrete planter with soil and a small fan palm."""
    g = box(1.0, 0.6, 1.0, 'concrete', bevel=0.02, segs=1).move(0, 0.3, 0)
    g.add(box(0.86, 0.02, 0.86, 'soil').move(0, 0.6, 0))
    g.add(tube([(0, 0.55, 0), (0.04, 1.1, 0.02), (0.02, 1.55, 0)], 0.05, 6, 'bark'))
    for k in range(9):
        a = 2 * math.pi * k / 9 + 0.3
        g.add(palm_frond(a, 0.75, 0.45 + 0.1 * (k % 3)).move(0.02, 1.5, 0))
    return g


def chair(x, z, face):
    """Bistro chair: round seat, hoop back, four tube legs; `face` turns it (degrees)."""
    g = cyl(0.21, 0.04, 14, 'metal_dark').move(0, 0.45, 0)
    for a in (45, 135, 225, 315):
        r = math.radians(a)
        g.add(tube([(0.17 * math.cos(r), 0.45, 0.17 * math.sin(r)),
                    (0.22 * math.cos(r), 0.0, 0.22 * math.sin(r))], 0.012, 5, 'metal_dark'))
    hoop = [(0.18 * math.cos(math.radians(a)), 0.47 + 0.4 * math.sin(math.radians(a)) ** 0.5, -0.16)
            for a in range(0, 181, 20)]
    g.add(tube(hoop, 0.013, 5, 'metal_dark'))
    return g.rot((0, 1, 0), face).move(x, 0, z)


def cafe_set():
    """Round cafe table, two chairs, and a striped market umbrella."""
    g = cyl(0.36, 0.03, 20, 'metal_light').move(0, 0.72, 0)
    g.add(cyl(0.03, 0.72, 8, 'metal_dark'), cyl(0.25, 0.03, 16, 'metal_dark'))
    g.add(chair(0, 0.62, 180), chair(0, -0.62, 0))
    g.add(cyl(0.02, 1.78, 6, 'metal_light').move(0, 0.75, 0))
    n = 8
    for k in range(n):
        a0, a1 = 2 * math.pi * k / n, 2 * math.pi * (k + 1) / n
        v = [(0, 2.45, 0), (1.25 * math.cos(a1), 2.05, 1.25 * math.sin(a1)),
             (1.25 * math.cos(a0), 2.05, 1.25 * math.sin(a0))]
        g.add(Geo(v, [(0, 1, 2)], 'canvas_white' if k % 2 else 'canvas_red'))
    return g


def ac_unit():
    """Outdoor condenser: white cabinet, fan guard on top, fin grilles on the sides."""
    g = box(0.8, 0.7, 0.8, 'metal_white', bevel=0.02, segs=1).move(0, 0.35, 0)
    g.add(cyl(0.3, 0.02, 20, 'grille').move(0, 0.7, 0), torus(0.3, 0.012, 20, 4, 'metal_dark').move(0, 0.72, 0))
    for a in (0, 90):
        g.add(box(0.6, 0.012, 0.012, 'metal_dark').rot((0, 1, 0), a).move(0, 0.725, 0))
    for side in (0, 90, 180, 270):
        g.add(box(0.66, 0.5, 0.01, 'grille').move(0, 0.37, 0.401).rot((0, 1, 0), side))
    g.add(box(0.9, 0.08, 0.9, 'concrete').move(0, -0.02, 0))
    return g


def water_tank():
    """Rooftop tank: wooden staves with steel hoops and a conical lid on a steel stand."""
    g = lathe([(1.0, 1.5), (1.0, 3.9), (1.05, 3.95), (0.0, 4.5)], 20, 'tank_wood')
    g.add(cyl(1.0, 0.05, 20, 'metal_dark').move(0, 1.45, 0))
    for y in (1.8, 2.5, 3.2, 3.8):
        g.add(torus(1.01, 0.02, 20, 4, 'metal_dark').move(0, y, 0))
    for a in (45, 135, 225, 315):
        x, z = 0.75 * math.cos(math.radians(a)), 0.75 * math.sin(math.radians(a))
        g.add(box(0.12, 1.5, 0.12, 'metal_dark').move(x, 0.75, z))
    for a in (0, 90, 180, 270):
        r = math.radians(a)
        p, q = (0.75 * math.cos(r + 0.785), 0.75 * math.sin(r + 0.785)), \
               (0.75 * math.cos(r + 2.356), 0.75 * math.sin(r + 2.356))
        g.add(tube([(p[0], 0.2, p[1]), (q[0], 1.3, q[1])], 0.02, 4, 'metal_dark'))
    g.add(merge(*[box(0.04, 3.0, 0.04, 'metal_dark').move(s * 0.2, 2.6, 1.08) for s in (-1, 1)]))
    g.add(merge(*[box(0.4, 0.03, 0.03, 'metal_dark').move(0, 1.3 + 0.3 * k, 1.08) for k in range(10)]))
    return g

