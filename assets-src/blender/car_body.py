"""The car shell: a loft of cross-sections along the car, from side and plan profiles.

Each section runs from the roof (or hood) crown down the side to the floor: roof edge,
glass top, glass base, shoulder, door bulge, rocker, floor. Faces are tagged by which run
of the section they lie on, which is how glass, pillars, seals, shut lines, and two-tone
paint are told apart without any texture. Origin: centre between the axles, on the ground.
"""

import math

from lib.curve import pchip, rounded
from lib.geo import Geo, flipped, loft, welded

# Corner radius and arc segments (LOD0) per section corner, crown first: crown, roof edge,
# glass top, glass base, shoulder, bulge, cladding line, rocker, floor edge, keel.
RADII = [0, 0.14, 0.02, 0.01, 0.025, 0.30, 0.0, 0.05, 0.04, 0]
SEGS = [0, 4, 1, 1, 2, 3, 0, 2, 1, 0]
GAP = 0.006  # half-width of a panel shut line
END = 0.04  # how far the closing rings reach past the last section


def curves(sp):
    return {k: pchip(sp[k]) for k in ('top', 'belt', 'bottom', 'plan')}


def cabin_height(sp, cv):
    return max(cv['top'](z) - cv['belt'](z) for z in frange(sp['rear'], sp['front'], 0.05))


def frange(a, b, step):
    n = max(1, int(round((b - a) / step)))
    return [a + (b - a) * i / n for i in range(n + 1)]


def stations(sp, step):
    """Even steps plus every boundary a material changes at, so edges land exactly there,
    and every roof-line key, so steps like a pickup's cab back stay sharp. The two closing
    rings add END, so the shell's length matches front - rear."""
    a, b = sp['rear'] + END, sp['front'] - END
    zs = frange(a, b, step) + [z for z, _ in sp['top']]
    for key in ('windscreen', 'backlight', 'side', 'two_tone'):
        zs += list(sp.get(key) or ())
    for p in sp['pillars']:
        zs += list(p)
    for g in sp['gaps'] + sp['lids'] if step < 0.1 else ():
        zs += [g - GAP, g + GAP]
    zs = sorted(z for z in zs if a <= z <= b)
    out = [zs[0]]
    for z in zs[1:]:
        if z - out[-1] > 0.004:
            out.append(z)
    return out


def section(sp, cv, z, ch, lod):
    """Half section at z (x >= 0), crown to keel, and each point's corner tag."""
    yt, yh, yb, w = cv['top'](z), cv['belt'](z), cv['bottom'](z), cv['plan'](z)
    ys = yb + sp['sill']
    yw = ys + 0.45 * (yh - ys)
    k = max(0.0, min(1.0, (yt - yh) / ch))
    x5, y5 = w - 0.045, yh + 0.012
    y6 = max(y5 + 0.004, yt - 0.07 * k - 0.004)
    x6 = x5 - sp['tumble'] * (y6 - y5) / ch
    x7, y7 = x6 - 0.03 - 0.04 * k, yt - 0.012 - 0.02 * k
    yc = min(yb + sp.get('clad', 0.0), yw - 0.01) if sp.get('clad') else ys + 0.02
    xc = w - 0.006 if sp.get('clad') else w - 0.03
    pts = [(0, yt), (x7, y7), (x6, y6), (x5, y5), (w - 0.006, yh), (w, yw), (xc, yc),
           (w - 0.035, ys), (w - 0.13, yb), (0, yb)]
    radii = list(RADII)
    radii[1] = 0.05 + RADII[1] * k
    segs = [max(1, s // 2) if lod and s else s for s in SEGS]
    return rounded(pts, radii, segs)


def region(t0, t1):
    hi, lo = max(t0, t1), min(t0, t1)
    if hi <= 1:
        return 'top'
    if (lo, hi) in ((1, 2), (2, 2)):
        return 'rail'
    if (lo, hi) == (2, 3):
        return 'side'
    if (lo, hi) == (3, 3):
        return 'seal'
    if lo >= 7 and hi >= 8:
        return 'under'
    if lo >= 6:
        return 'clad'
    return 'lower'


def inside(r, z):
    return bool(r) and r[0] <= z <= r[1]


def face_mat(sp, reg, z, y, yb):
    """Material for one face of the shell from its run of the section and where it is."""
    tone = 'paint_white' if inside(sp.get('two_tone'), z) else 'paint'
    if any(abs(z - g) < GAP for g in sp['gaps']) and reg in ('lower', 'seal', 'side'):
        if y > yb + sp['sill'] * 0.5:
            return 'trim_black'
    if any(abs(z - g) < GAP for g in sp['lids']) and reg in ('top', 'rail'):
        return 'trim_black'
    if reg == 'top':
        glass = inside(sp['windscreen'], z) or inside(sp['backlight'], z)
        return 'glass' if glass else tone
    if reg == 'rail':
        return sp.get('rail', tone)
    if reg in ('side', 'seal') and inside(sp['side'], z):
        if any(inside(p, z) for p in sp['pillars']):
            return 'trim_black'
        return 'glass' if reg == 'side' else 'trim_black'
    if reg == 'under' or (reg == 'clad' and sp.get('clad')):
        return 'trim_black'
    return tone


def half_shell(sp, lod):
    cv = curves(sp)
    ch = cabin_height(sp, cv)
    zs = stations(sp, 0.2 if lod else 0.055)
    secs = [section(sp, cv, z, ch, lod) for z in zs]
    tags = secs[0][1]
    rings = [[(x, y, z) for x, y in pts] for z, (pts, _) in zip(zs, secs)]
    rings = closing(rings, sp, cv, -1) + rings + closing(rings, sp, cv, 1)
    g = loft(rings, 'paint', closed=False, cap_start=True, cap_end=True)
    n = len(tags)
    for f in range(len(g.faces) - 2):
        k, i = divmod(f, n - 1)
        vs = [g.verts[j] for j in g.faces[f]]
        z = sum(v.z for v in vs) / 4
        y = sum(v.y for v in vs) / 4
        g.mats[f] = face_mat(sp, region(tags[i], tags[i + 1]), z, y, cv['bottom'](z))
    return g


def closing(rings, sp, cv, end):
    """Two rings past each end, shrunk towards the section's middle: rounded bumper edges."""
    ring = rings[-1] if end > 0 else rings[0]
    z = ring[0][2]
    mid = (cv['top'](z) + cv['bottom'](z)) / 2
    out = []
    for s, d in ((0.975, END * 0.55), (0.9, END)):
        out.append([(x * s, mid + (y - mid) * s, z + end * d) for x, y, _ in ring])
    return out if end > 0 else out[::-1]


def shell(sp, lod=False):
    """The whole shell, both halves welded on the centre line."""
    g = half_shell(sp, lod)
    return welded(g.mirror_x(), 1e-4)


def arch_cutter(sp, lod):
    """Two cylinders across the car at the axles; the hole they leave is the wheel well."""
    r = sp['wheel']['r'] + sp['arch']
    n = 24 if lod else 48
    g = Geo()
    for z in (sp['wheelbase'] / 2, -sp['wheelbase'] / 2):
        c = cylinder_x(r, 3.0, n, 'well').move(0, sp['wheel']['r'] + 0.02, z)
        g.add(c)
    return g


def cylinder_x(r, length, n, mat):
    # Clockwise seen from +x, so the faces point out (see geo.loft).
    pts = [(r * math.cos(2 * math.pi * i / n), -r * math.sin(2 * math.pi * i / n)) for i in range(n)]
    rings = [[(-length / 2, y, z) for y, z in pts], [(length / 2, y, z) for y, z in pts]]
    return loft(rings, mat, closed=True, cap_start=True, cap_end=True)


def arch_lips(sp, surf, lod):
    """A rolled lip round each arch, sitting on the panel (found by rays from the side)."""
    from mathutils import Vector
    r = sp['wheel']['r'] + sp['arch']
    cy = sp['wheel']['r'] + 0.02
    w = sp.get('lip', 0.035)
    sec = [(0.0, -0.03), (0.0, 0.004), (0.01, 0.01), (w - 0.01, 0.008), (w, -0.02)]
    g = Geo()
    for zc in (sp['wheelbase'] / 2, -sp['wheelbase'] / 2):
        rings = []
        for i in range(13 if lod else 33):
            a = math.radians(-12 + 204 * i / (12 if lod else 32))
            rad = Vector((0, math.sin(a), math.cos(a)))
            p = Vector((0, cy, zc)) + rad * (r + 0.004)
            h = surf.hit(Vector((3.0, p.y, p.z)), Vector((-1, 0, 0)))
            if h is None:
                continue
            base = Vector((h[0].x, p.y, p.z))
            rings.append([base + rad * a_ + Vector((b_, 0, 0)) for a_, b_ in sec])
        if len(rings) > 1:
            g.add(loft(rings, sp.get('lip_mat', 'paint'), closed=False))
    g = flipped(g)
    return g.mirror_x()
