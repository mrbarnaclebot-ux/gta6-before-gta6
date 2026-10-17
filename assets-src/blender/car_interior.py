"""What shows through the glass: a dark tub up to the window line, seats with headrests,
the dash, a steering wheel on the left (US cars), and the headliner. The shell's inside
faces are culled, so without the tub and headliner the car would look hollow."""

import math

from mathutils import Matrix

from lib.geo import box, tube


def seat(x, y, z, w, lod):
    """One seat: cushion, reclined back, and headrest; y is the cushion top, z its front."""
    g = box(w, 0.12, 0.5, 'interior', bevel=0 if lod else 0.03, segs=1).move(x, y - 0.06, z - 0.25)
    back = box(w, 0.62, 0.13, 'interior', bevel=0 if lod else 0.035, segs=1)
    g.add(back.move(0, 0.31, 0).rot((1, 0, 0), -14).move(x, y, z - 0.52))
    if not lod:
        head = box(w * 0.5, 0.18, 0.1, 'interior', bevel=0.03, segs=1)
        g.add(head.move(0, 0.75, 0).rot((1, 0, 0), -14).move(x, y, z - 0.52))
    return g


def wheel(c):
    r, x, y, z = 0.19, 0.37, c['belt'] + 0.1, c['z1'] - 0.42
    path = [(x + r * math.cos(2 * math.pi * i / 16), y + r * math.sin(2 * math.pi * i / 16), z)
            for i in range(17)]
    g = tube(path, 0.018, 6, 'trim_black', caps=False)
    return g.transform(_tilt(y, z))


def _tilt(y, z):
    """Leans the wheel back 25 degrees about its own centre."""
    to = Matrix.Translation((0, y, z))
    return to @ Matrix.Rotation(math.radians(-25), 4, 'X') @ to.inverted()


def interior(sp, lod=False):
    c = sp['cabin']
    w = c['w']
    g = box(2 * w, c['belt'] - c['floor'], c['z1'] - c['z0'], 'interior')
    g.move(0, (c['belt'] + c['floor']) / 2, (c['z0'] + c['z1']) / 2)
    ra, rb = c['roof_z']
    g.add(box(2 * c['roof_w'], 0.02, rb - ra, 'interior').move(0, c['roof'] - 0.07, (ra + rb) / 2))
    g.add(box(2 * w, 0.14, 0.4, 'interior').move(0, c['belt'] + 0.05, c['z1'] - 0.2))
    rows = c['rows'] if not lod else c['rows'][:1]
    for k, z in enumerate(rows):
        if k == 0 or c.get('buckets', False):
            for x in (0.37, -0.37):
                g.add(seat(x, c['seat_y'], z, 0.5, lod))
        else:
            g.add(seat(0, c['seat_y'] + 0.02, z, 2 * w - 0.12, lod))
    if 'cargo' in c:
        z0, z1 = c['cargo']
        g.add(box(2 * w, c['roof'] - c['floor'] - 0.08, z1 - z0, 'interior')
              .move(0, (c['roof'] + c['floor'] - 0.08) / 2, (z0 + z1) / 2))
    if not lod:
        g.add(wheel(c))
    return g


def bed(sp):
    """The pickup's load bed: the inside of the boolean cut, as a cutter volume."""
    b = sp['bed']
    return box(2 * b['w'], 1.2, b['z1'] - b['z0'], 'bedliner').move(0, b['floor'] + 0.6,
                                                                      (b['z0'] + b['z1']) / 2)

