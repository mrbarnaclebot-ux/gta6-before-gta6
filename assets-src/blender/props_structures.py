"""Bigger props: three shop-front awnings, a kiosk, a bus shelter, and a Miami Beach
lifeguard tower.

Awnings hang on a wall: origin at the middle of their top mounting edge on the wall face,
reaching out towards +z and down. Everything else stands on y = 0, front towards +z."""

import math

from lib.drape import text
from lib.geo import Geo, box, cyl, extrude_x, loft, tube


def awning_striped(w=3.0, out=1.1, drop=0.6, stripe=0.25):
    """Canvas awning in red and white stripes with a scalloped valance and side cheeks."""
    g = Geo()
    n = int(round(w / stripe))
    for k in range(n):
        x0, x1 = -w / 2 + w * k / n, -w / 2 + w * (k + 1) / n
        mat = 'canvas_red' if k % 2 == 0 else 'canvas_white'
        g.add(Geo([(x0, 0, 0), (x1, 0, 0), (x1, -drop, out), (x0, -drop, out)], [(0, 1, 2, 3)], mat))
        lobe = [(x1 - (x1 - x0) * i / 6, -drop - 0.2 - 0.07 * math.sin(math.pi * i / 6), out)
                for i in range(7)]
        g.add(Geo([(x0, -drop, out), (x1, -drop, out)] + lobe[:-1] + [(x0, -drop - 0.2, out)],
                  [tuple(range(9))], mat))
    for x in (-w / 2, w / 2):
        g.add(Geo([(x, 0, 0), (x, -drop, out), (x, -drop - 0.2, out)], [(0, 1, 2)], 'canvas_red'))
        g.add(tube([(x * 0.98, -drop - 0.15, 0), (x * 0.98, -drop, out)], 0.012, 5, 'metal_dark'))
    g.add(tube([(-w / 2, 0.02, 0.03), (w / 2, 0.02, 0.03)], 0.025, 6, 'metal_dark'))
    return g


def awning_dome(w=2.6, out=1.0, drop=0.9):
    """A barrel (quarter-round) awning in navy canvas over curved ribs, open underneath."""
    arc = [(out * math.sin(math.pi / 2 * k / 8), -drop + drop * math.cos(math.pi / 2 * k / 8))
           for k in range(9)]
    g = loft([[(x, y, z) for z, y in arc] for x in (-w / 2, w / 2)], 'canvas_navy', closed=False)
    for x in (-w / 2, w / 2):
        g.add(Geo([(x, y, z) for z, y in arc] + [(x, -drop, 0.0)], [tuple(range(10))], 'canvas_navy'))
    for x in (-w / 2, 0, w / 2):
        g.add(tube([(x, y + 0.01, z + 0.01) for z, y in arc], 0.012, 5, 'metal_dark'))
    return g.add(box(w, 0.16, 0.012, 'canvas_navy').move(0, -drop - 0.08, out))


def awning_flat(w=3.2, out=1.3):
    """Modern steel canopy: a thin slab held by two tie rods, two downlights under it."""
    g = box(w, 0.12, out, 'metal_dark', bevel=0.01, segs=1).move(0, -0.06, out / 2)
    for x in (-w / 2 + 0.3, w / 2 - 0.3):
        g.add(tube([(x, 0.9, 0.0), (x, 0.0, out - 0.08)], 0.012, 5, 'metal_light'))
        g.add(cyl(0.05, 0.01, 10, 'lamp_warm').move(x * 0.5, -0.125, out * 0.55))
    return g


def kiosk():
    """A street kiosk: a booth with a serving hatch, counter, sign band and striped awning."""
    g = box(2.2, 2.4, 2.0, 'kiosk_paint', bevel=0.03, segs=1).move(0, 1.2, 0)
    g.add(Geo([(-0.8, 1.0, 1.005), (0.8, 1.0, 1.005), (0.8, 2.0, 1.005), (-0.8, 2.0, 1.005)],
              [(0, 1, 2, 3)], 'glass_dark'))
    g.add(box(1.9, 0.05, 0.35, 'metal_light').move(0, 0.98, 1.15))
    g.add(box(2.4, 0.12, 2.2, 'metal_white').move(0, 2.46, 0))
    g.add(box(2.3, 0.3, 0.02, 'ad').move(0, 2.25, 1.02))
    g.add(awning_striped(2.2, 0.7, 0.35, 0.275).move(0, 2.08, 1.0))
    g.add(box(2.24, 0.12, 2.04, 'metal_dark').move(0, 0.06, 0))
    return g


def bus_shelter():
    """Bus shelter, 3.6 m: steel frame, glass back and one glass end, a lit advert panel,
    a bench, and a roof that tips back to drain."""
    g = Geo()
    for x in (-1.75, 1.75):
        for z in (-0.65, 0.55):
            g.add(box(0.08, 2.45, 0.08, 'metal_dark').move(x, 1.225, z))
    g.add(box(3.4, 1.9, 0.02, 'glass_clear').move(0, 1.25, -0.65))
    g.add(box(0.02, 1.9, 1.1, 'glass_clear').move(-1.75, 1.25, -0.05))
    g.add(box(0.12, 1.8, 1.2, 'metal_dark').move(1.75, 1.2, -0.05))
    g.add(box(0.02, 1.6, 1.0, 'ad').move(1.82, 1.2, -0.05), box(0.02, 1.6, 1.0, 'ad').move(1.68, 1.2, -0.05))
    roof = box(3.8, 0.1, 1.6, 'metal_white', bevel=0.02, segs=1).rot((1, 0, 0), -3).move(0, 2.5, -0.05)
    g.add(roof)
    g.add(box(2.2, 0.05, 0.4, 'wood_slat').move(-0.3, 0.46, -0.4))
    for x in (-1.2, 0.6):
        g.add(box(0.05, 0.44, 0.3, 'metal_dark').move(x, 0.22, -0.45))
    g.add(box(0.6, 0.18, 0.04, 'ad').move(-1.0, 2.25, 0.56))
    return g


def lifeguard_tower():
    """Miami Beach lifeguard tower: a bright cabin on stilts with a wrap-round deck and
    railing, a ramp down the back to the sand, a sloping roof, and a flag. Front (+z) to sea."""
    deck_y = 1.7
    g = Geo()
    for x in (-1.4, 1.4):
        for z in (-1.4, 1.4):
            g.add(box(0.16, deck_y + 0.5, 0.16, 'wood_light').move(x, (deck_y - 0.5) / 2, z))
    g.add(box(3.2, 0.14, 3.2, 'wood_light').move(0, deck_y - 0.07, 0))
    cabin = [(0.9, deck_y), (0.9, deck_y + 2.35), (-1.3, deck_y + 2.68), (-1.3, deck_y)]
    g.add(extrude_x(cabin, -1.1, 1.1, 'tower_pink'))
    g.add(box(2.24, 0.35, 2.24, 'tower_yellow').move(0, deck_y + 0.9, -0.2))
    for side, (x, z, rot) in {'front': (0, 0.91, 0), 'left': (1.11, -0.2, 90),
                              'right': (-1.11, -0.2, -90)}.items():
        pane = Geo([(-0.75, 0, 0), (0.75, 0, 0), (0.75, 0.7, 0), (-0.75, 0.7, 0)], [(0, 1, 2, 3)],
                   'glass_dark')
        g.add(pane.rot((0, 1, 0), rot).move(x, deck_y + 1.2, z))
    roof = extrude_x([(1.4, deck_y + 2.28), (1.4, deck_y + 2.43), (-1.6, deck_y + 2.88),
                      (-1.6, deck_y + 2.73)], -1.5, 1.5, 'tower_teal')
    g.add(roof)
    sign = text('LIFEGUARD', 0.14, 'tower_teal').move(0, deck_y + 2.03, 0.91)
    g.add(sign)
    g.add(railings(deck_y))
    ramp_len = 3.6
    ang = math.degrees(math.atan2(deck_y, ramp_len))
    ramp = box(1.0, 0.08, math.hypot(deck_y, ramp_len), 'wood_light').rot((1, 0, 0), -ang)
    g.add(ramp.move(0.9, deck_y / 2, -1.6 - ramp_len / 2))
    for x in (0.42, 1.38):
        g.add(tube([(x, deck_y + 0.9, -1.6), (x, 0.9, -1.6 - ramp_len)], 0.025, 5, 'trim'))
    g.add(tube([(-1.0, deck_y + 2.6, 0.6), (-1.0, deck_y + 4.0, 0.6)], 0.025, 5, 'metal_light'))
    g.add(Geo([(-1.0, deck_y + 3.95, 0.6), (-1.0, deck_y + 3.95, 1.3), (-1.0, deck_y + 3.5, 1.3),
               (-1.0, deck_y + 3.5, 0.6)], [(0, 1, 2, 3)], 'flag'))
    return g


def railings(deck_y):
    """Posts and two rails round the front and sides of the deck, open at the ramp."""
    g = Geo()
    run = [(-1.55, -1.55), (-1.55, 1.55), (1.55, 1.55), (1.55, -1.0)]
    for (x0, z0), (x1, z1) in zip(run, run[1:]):
        for y in (deck_y + 0.5, deck_y + 0.95):
            g.add(tube([(x0, y, z0), (x1, y, z1)], 0.025, 5, 'trim'))
        n = max(1, int(math.hypot(x1 - x0, z1 - z0) / 0.75))
        for k in range(n + 1):
            x, z = x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n
            g.add(box(0.07, 0.95, 0.07, 'trim').move(x, deck_y + 0.475, z))
    return g

