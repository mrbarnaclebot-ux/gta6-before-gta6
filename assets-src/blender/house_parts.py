"""House openings and placement: windows, doors, and garage doors drawn flat-on (facing
+z, origin at the bottom centre of the opening on the wall face), then put on a wall.
Windows are framed glass set back behind a proud surround, so no wall is ever cut."""

import math

from lib.drape import FACING
from lib.geo import Geo, box, merge, tube


def quad(w, h, z, mat, y0=0.0):
    """A w x h rectangle facing +z, bottom centre at (0, y0, z)."""
    v = [(-w / 2, y0, z), (w / 2, y0, z), (w / 2, y0 + h, z), (-w / 2, y0 + h, z)]
    return Geo(v, [(0, 1, 2, 3)], mat)


def bar(w, h, d, x, y, z, mat):
    """A box by its size and bottom-centre-back position (z is its back face)."""
    return box(w, h, d, mat).move(x, y + h / 2, z + d / 2)


def frame(w, h, t, d, mat):
    """Four bars round a w x h opening."""
    return merge(bar(w + 2 * t, t, d, 0, -t, 0, mat), bar(w + 2 * t, t, d, 0, h, 0, mat),
                 bar(t, h, d, -w / 2 - t / 2, 0, 0, mat), bar(t, h, d, w / 2 + t / 2, 0, 0, mat))


def window(w, h, style='trim', lod=False, panes=None):
    """styles: trim (white surround and sill), dark (slim bronze frame), shutter (trim plus
    shutters), deco (dark frame under a thin eyebrow ledge)."""
    g = quad(w, h, 0.03, 'glass_house')
    if lod:
        return g
    fmat = 'frame_dark' if style in ('dark', 'deco') else 'trim'
    g.add(frame(w, h, 0.06, 0.09, fmat))
    n = panes or (2 if w > 1.3 else 1)
    for k in range(1, n):
        g.add(bar(0.05, h, 0.07, -w / 2 + w * k / n, 0, 0, fmat))
    if style in ('trim', 'shutter'):
        g.add(frame(w + 0.12, h + 0.12, 0.12, 0.05, 'trim'))
        g.add(bar(w + 0.42, 0.07, 0.17, 0, -0.25, 0, 'trim'))
    if style == 'shutter':
        for s in (-1, 1):
            g.add(bar(w / 2 + 0.04, h + 0.1, 0.04, s * (w * 0.75 + 0.3), -0.05, 0, 'shutter'))
    if style == 'deco':
        g.add(bar(w + 0.7, 0.08, 0.5, 0, h + 0.25, 0, 'trim'))
    return g


def arch_window(w, h, lod=False):
    """A round-headed window: h is the height to the springing line, then a half circle."""
    r, n = w / 2, 6 if lod else 12
    arc = [(r * math.cos(math.pi * i / n), h + r * math.sin(math.pi * i / n)) for i in range(n + 1)]
    pts = [(r, 0.0), (r, h)] + arc[1:] + [(-r, 0.0)]
    g = Geo([(x, y, 0.03) for x, y in pts], [tuple(range(len(pts)))], 'glass_house')
    if lod:
        return g
    outline = [(x * 1.06, y * 1.0 + (0.04 if y > h else 0.0), 0.05) for x, y in pts]
    g.add(tube(outline + [outline[0]], 0.06, 6, 'trim'))
    g.add(bar(0.05, h + r, 0.07, 0, 0, 0, 'frame_dark'))
    g.add(bar(w + 0.42, 0.07, 0.17, 0, -0.1, 0, 'trim'))
    return g


def porthole(r, lod=False):
    """A round art-deco window; origin at its bottom like the others."""
    n = 10 if lod else 20
    ring = [(r * math.cos(2 * math.pi * i / n), r + r * math.sin(2 * math.pi * i / n), 0.03)
            for i in range(n)]
    g = Geo(ring, [tuple(range(n))], 'glass_house')
    if not lod:
        g.add(tube([(x, y, 0.06) for x, y, _ in ring + ring[:1]], 0.06, 6, 'trim'))
    return g


def door(w, h, style='panel', lod=False):
    """Front doors: panel (painted wood), double (two leaves), glass (bronze framed)."""
    if style == 'glass':
        g = quad(w, h, 0.03, 'glass_house')
        return g if lod else g.add(frame(w, h, 0.06, 0.09, 'frame_dark'),
                                   bar(0.05, h, 0.07, 0, 0, 0, 'frame_dark'))
    g = bar(w, h, 0.05, 0, 0, 0.0, 'door')
    if lod:
        return g
    g.add(frame(w, h, 0.12, 0.1, 'trim'))
    leaves = 2 if style == 'double' else 1
    for k in range(leaves):
        cx = -w / 2 + w * (k + 0.5) / leaves
        for y in (0.25, h * 0.55):
            g.add(bar(w / leaves - 0.3, h * 0.3, 0.02, cx, y, 0.05, 'door_panel'))
        g.add(bar(0.03, 0.18, 0.06, cx + (0.35 if k == 0 else -0.35) * w / leaves, 1.0, 0.05,
                  'brass'))
    return g


def garage(w, h, lod=False):
    """A sectional door: four panels with dark joints, in a trim surround."""
    g = bar(w, h, 0.05, 0, 0, 0, 'garage_door')
    if lod:
        return g
    for k in range(1, 4):
        g.add(bar(w, 0.025, 0.01, 0, h * k / 4, 0.05, 'seam'))
    return g.add(frame(w, h, 0.14, 0.08, 'trim'))


def on_wall(g, side, cx, cz, w, d, u, y):
    """Places a flat-on detail on one wall of the w x d box centred at (cx, cz): `u` is
    across the wall as seen from outside (left to right), `y` its height."""
    g.transform(FACING[side])
    pos = {'front': (cx + u, y, cz + d / 2), 'rear': (cx - u, y, cz - d / 2),
           'left': (cx + w / 2, y, cz - u), 'right': (cx - w / 2, y, cz + u)}[side]
    return g.move(*pos)


def openings(spec, cx, cz, w, d, lod):
    """A list of (side, u, y, maker) for one wall box, turned into geometry."""
    g = Geo()
    for side, u, y, make in spec:
        g.add(on_wall(make(lod), side, cx, cz, w, d, u, y))
    return g


def walls(x0, x1, z0, z1, y1, mat, y0=-0.6):
    """A wall block from x0..x1, z0..z1, up to y1; it starts below ground (the pad slopes),
    with a plinth band round its foot when it stands on the ground."""
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    g = box(x1 - x0, y1 - y0, z1 - z0, mat).move(cx, (y0 + y1) / 2, cz)
    if y0 < 0:
        g.add(box(x1 - x0 + 0.06, 0.95, z1 - z0 + 0.06, 'plinth').move(cx, y0 + 0.475, cz))
    return g


def column(x, z, h, r=0.16, lod=False):
    """A round porch column with a square base and capital."""
    g = Geo()
    shaft = tube([(x, 0.0, z), (x, h, z)], r, 8 if lod else 14, 'trim')
    g.add(shaft)
    if not lod:
        g.add(box(2.6 * r, 0.2, 2.6 * r, 'trim').move(x, 0.1, z),
              box(2.6 * r, 0.16, 2.6 * r, 'trim').move(x, h - 0.08, z))
    return g

