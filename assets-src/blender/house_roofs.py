"""Roofs, pools, railings, and garden walls for the houses. Roofs are closed solids with a
fascia and a soffit, so the eaves read from below and the edge has thickness."""

import math

from mathutils import Matrix, Vector

from lib.geo import Geo, box, merge, prism, tube


def outward(g):
    """Turns every face of a convex solid to face away from its centre."""
    c = sum(g.verts, Vector()) / len(g.verts)
    out = []
    for f in g.faces:
        p = [g.verts[i] for i in f]
        n = (p[1] - p[0]).cross(p[2] - p[0])
        mid = sum(p, Vector()) / len(p)
        out.append(f if n.dot(mid - c) >= 0 else tuple(reversed(f)))
    g.faces = out
    return g


def by_normal(g, mat, other='trim'):
    """Slopes (faces looking up) get `mat`, everything else (fascia, soffit, rake) `other`."""
    for k, f in enumerate(g.faces):
        p = [g.verts[i] for i in f]
        n = (p[1] - p[0]).cross(p[2] - p[0]).normalized()
        g.mats[k] = mat if n.y > 0.3 else other
    return g


def hip(w, d, y0, pitch, over, mat, fascia=0.22):
    """Hip roof over a w x d box; eaves at y0 (top of the fascia), ridge along the long side."""
    X, Z = w / 2 + over, d / 2 + over
    run = min(X, Z)
    top = y0 + pitch * run
    lx, lz = X - run, Z - run
    corners = [(-X, -Z), (X, -Z), (X, Z), (-X, Z)]
    v = [(x, y0 - fascia, z) for x, z in corners] + [(x, y0, z) for x, z in corners]
    v += [(-lx, top, -lz), (lx, top, lz)] if lz > lx else [(-lx, top, 0), (lx, top, 0)]
    a, b = 8, 9
    if lz > lx:
        f = [(4, 5, a), (5, 6, b, a), (6, 7, b), (7, 4, a, b)]
    else:
        f = [(4, 5, b, a), (5, 6, b), (6, 7, a, b), (7, 4, a)]
    f = [tuple(dict.fromkeys(face)) for face in f]
    g = outward(Geo(v, f, mat))
    rim = outward(Geo(v[:8], [(0, 1, 2, 3), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6),
                              (3, 0, 4, 7)], 'trim'))
    ends = (a, a, b, b) if lz > lx else (a, b, b, a)
    lines = [(v[a], v[b])] + [(v[4 + k], v[e]) for k, e in enumerate(ends)]
    return merge(g, rim, *[cap(p, q, mat) for p, q in lines if p != q])


def cap(p, q, mat):
    """Half-round ridge or hip tiles along a roof line."""
    cap_mat = 'roof_ridge' if mat == 'roof_tile' else 'trim'
    return tube([Vector(p) + Vector((0, 0.03, 0)), Vector(q) + Vector((0, 0.03, 0))], 0.09, 6,
                cap_mat)


def extrude_x(section, x0, x1, mat):
    """A (z, y) polygon swept along x from x0 to x1, faces outward whatever its winding."""
    area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(section, section[1:] + section[:1]))
    pts = [(-z, y) for z, y in section]
    if area > 0:  # (-z, y) mirrors the winding; prism wants counter-clockwise
        pts.reverse()
    g = prism(pts, x1 - x0, mat)
    return g.transform(Matrix.Rotation(math.pi / 2, 4, 'Y')).move(x0, 0, 0)


def gable(w, d, y0, pitch, over, mat, wall_mat, fascia=0.22):
    """Gable roof (ridge along x) plus the stucco gable triangles under it."""
    X, Z = w / 2 + over, d / 2 + over
    ridge = y0 + pitch * Z
    t = fascia
    sec = [(Z, y0 - t), (Z, y0), (0, ridge), (-Z, y0), (-Z, y0 - t), (0, ridge - t * 1.3)]
    g = by_normal(extrude_x(sec, -X, X, mat), mat)
    g.add(cap((-X, ridge, 0), (X, ridge, 0), mat))
    tri = [(d / 2, y0 - t), (0, ridge - t * 1.3 - 0.02), (-d / 2, y0 - t)]
    return g.add(extrude_x(tri, -w / 2, w / 2, wall_mat))


def shed(x0, x1, z0, z1, y_back, y_front, mat, fascia=0.15):
    """A lean-to (porch) roof from the wall at z0 down to y_front at z1."""
    sec = [(z0, y_back - fascia), (z0, y_back), (z1, y_front), (z1, y_front - fascia)]
    return by_normal(extrude_x(sec, x0, x1, mat), mat)


def flat(x0, x1, z0, z1, y, parapet, wall_mat, lod=False):
    """Flat roof: membrane, a parapet wall all round, and a coping on top."""
    w, d, t = x1 - x0, z1 - z0, 0.2
    cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
    g = box(w - 0.1, 0.1, d - 0.1, 'roof_flat').move(cx, y + 0.05, cz)
    for (sx, sz, px, pz) in ((w, t, cx, z1 - t / 2), (w, t, cx, z0 + t / 2),
                             (t, d, x1 - t / 2, cz), (t, d, x0 + t / 2, cz)):
        g.add(box(sx, parapet, sz, wall_mat).move(px, y + parapet / 2, pz))
        if not lod:
            g.add(box(sx + 0.1, 0.06, sz + 0.1, 'trim').move(px, y + parapet + 0.03, pz))
    return g


def pool(cx, cz, w, d, deck, lod=False):
    """Raised pool: water a little under the coping, tiled sides, on a deck `deck` m high
    (the yard is the game's own ground, so the basin stays above it)."""
    top = deck
    g = Geo()
    for (sx, sz, px, pz) in ((w + 0.6, 0.3, cx, cz + d / 2 + 0.15), (w + 0.6, 0.3, cx, cz - d / 2 - 0.15),
                             (0.3, d, cx + w / 2 + 0.15, cz), (0.3, d, cx - w / 2 - 0.15, cz)):
        g.add(box(sx, 0.08, sz, 'concrete').move(px, top + 0.04, pz))
    water = Geo([(cx - w / 2, top - 0.12, cz + d / 2), (cx + w / 2, top - 0.12, cz + d / 2),
                 (cx + w / 2, top - 0.12, cz - d / 2), (cx - w / 2, top - 0.12, cz - d / 2)],
                [(0, 1, 2, 3)], 'pool_water')
    g.add(water)
    inner = box(w, 0.4, d, 'pool_tile').move(cx, top - 0.2, cz)
    inner.faces = [tuple(reversed(f)) for f in inner.faces]
    return g.add(inner)


def deck_around(x0, x1, z0, z1, hole, h, mat='concrete'):
    """A raised slab x0..x1, z0..z1 with a rectangular hole (cx, cz, w, d) for the pool."""
    cx, cz, w, d = hole
    w, d = w + 0.6, d + 0.6
    parts = [(x0, x1, cz + d / 2, z1), (x0, x1, z0, cz - d / 2),
             (x0, cx - w / 2, cz - d / 2, cz + d / 2), (cx + w / 2, x1, cz - d / 2, cz + d / 2)]
    return merge(*[box(b - a, h + 0.3, f - e, mat).move((a + b) / 2, (h - 0.3) / 2, (e + f) / 2)
                   for a, b, e, f in parts if b - a > 0.01 and f - e > 0.01])


def railing(p0, p1, h, style, lod=False):
    """A straight railing from p0 to p1 (x, y, z) on the floor at their y: balusters (stone
    or white), bars (black metal), or glass panels."""
    p0, p1 = Vector(p0), Vector(p1)
    L = (p1 - p0).length
    mat = {'baluster': 'trim', 'bars': 'rail_metal', 'glass': 'rail_metal'}[style]
    g = box(L, 0.08 if style == 'baluster' else 0.05, 0.12 if style == 'baluster' else 0.05,
            mat).move(L / 2, h, 0)
    if style == 'glass':
        g.add(box(L - 0.1, h - 0.1, 0.02, 'glass_rail').move(L / 2, h / 2, 0))
    elif not lod:
        step = 0.16 if style == 'baluster' else 0.12
        n = max(1, int(L / step))
        size = 0.07 if style == 'baluster' else 0.022
        for k in range(n + 1):
            g.add(box(size, h, size, mat).move(L * k / n, h / 2, 0))
        if style == 'baluster':
            g.add(box(L, 0.08, 0.12, mat).move(L / 2, 0.08, 0))
    ang = math.atan2(-(p1.z - p0.z), p1.x - p0.x)
    return g.transform(Matrix.Rotation(ang, 4, 'Y')).move(*p0)


def low_wall(p0, p1, h, mat, lod=False):
    """A garden wall with a coping, and pillars with caps at both ends."""
    p0, p1 = Vector(p0), Vector(p1)
    L = (p1 - p0).length
    g = box(L, h + 0.4, 0.2, mat).move(L / 2, (h - 0.4) / 2, 0)
    if not lod:
        g.add(box(L, 0.06, 0.28, 'trim').move(L / 2, h + 0.03, 0))
        for x in (0, L):
            g.add(box(0.45, h + 0.6, 0.45, mat).move(x, (h - 0.2) / 2 + 0.1, 0))
            g.add(box(0.55, 0.08, 0.55, 'trim').move(x, h + 0.24, 0))
    ang = math.atan2(-(p1.z - p0.z), p1.x - p0.x)
    return g.transform(Matrix.Rotation(ang, 4, 'Y')).move(*p0)


def picket(p0, p1, h=0.95, lod=False):
    """White picket fence: two rails and a picket every 15 cm."""
    p0, p1 = Vector(p0), Vector(p1)
    L = (p1 - p0).length
    g = merge(*[box(L, 0.06, 0.04, 'fence').move(L / 2, y, -0.03) for y in (0.25, h - 0.2)])
    if not lod:
        n = int(L / 0.15)
        for k in range(n + 1):
            g.add(box(0.08, h, 0.022, 'fence').move(L * k / n, h / 2, 0))
    ang = math.atan2(-(p1.z - p0.z), p1.x - p0.x)
    return g.transform(Matrix.Rotation(ang, 4, 'Y')).move(*p0)


def steps(cx, z, w, rise, n, run=0.32):
    """n steps down from height rise * n at z towards +z."""
    return merge(*[box(w, rise * (n - k), run, 'concrete').move(cx, rise * (n - k) / 2, z + run * (k + 0.5))
                   for k in range(n)])
