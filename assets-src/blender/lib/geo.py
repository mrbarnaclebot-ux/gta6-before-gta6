"""Mesh data as plain Python: vertices, faces, and one material name per face.

Builders stay pure functions that return a Geo; pieces compose with `add` and move with
`transform`, and only `scene.to_object` touches Blender. Game axes are used throughout:
x left, y up, z forward (glTF +Z), metres. `scene.to_object` turns them into Blender axes,
so the glTF exporter's +Y-up conversion hands the game exactly these coordinates.
"""

import math

import bmesh
from mathutils import Matrix, Vector


class Geo:
    def __init__(self, verts=(), faces=(), mat=None):
        self.verts = [Vector(v) for v in verts]
        self.faces = [tuple(f) for f in faces]
        self.mats = [mat] * len(self.faces)

    def add(self, *others):
        for o in others:
            n = len(self.verts)
            self.verts += [v.copy() for v in o.verts]
            self.faces += [tuple(i + n for i in f) for f in o.faces]
            self.mats += o.mats
        return self

    def copy(self):
        return Geo().add(self)

    def paint(self, mat):
        self.mats = [mat] * len(self.faces)
        return self

    def transform(self, m):
        m = m.to_4x4() if len(m) == 3 else m
        self.verts = [m @ v for v in self.verts]
        if m.determinant() < 0:
            self.faces = [tuple(reversed(f)) for f in self.faces]
        return self

    def move(self, x=0.0, y=0.0, z=0.0):
        return self.transform(Matrix.Translation((x, y, z)))

    def rot(self, axis, deg):
        return self.transform(Matrix.Rotation(math.radians(deg), 4, axis))

    def scale(self, x=1.0, y=1.0, z=1.0):
        return self.transform(Matrix.Diagonal((x, y, z, 1.0)))

    def mirror_x(self):
        """Adds the mirror image across x = 0 (cars and houses are built one side at a time)."""
        return self.add(self.copy().scale(-1, 1, 1))

    def tris(self):
        return sum(len(f) - 2 for f in self.faces)


def merge(*geos):
    return Geo().add(*geos)


def box(sx, sy, sz, mat, bevel=0.0, segs=2):
    """A box centred on the origin; `bevel` rounds every edge."""
    hx, hy, hz = sx / 2, sy / 2, sz / 2
    v = [(x, y, z) for x in (-hx, hx) for y in (-hy, hy) for z in (-hz, hz)]
    f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    g = Geo(v, f, mat)
    return bevelled(g, bevel, segs) if bevel > 0 else g


def hexa(corners, mat):
    """A six-sided block from 8 corners indexed i*4 + j*2 + k over a right-handed basis
    (i, j, k each 0 or 1), like `box` but with any shape: spokes, posts, legs."""
    f = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return Geo(corners, f, mat)


def ring(r, n, y=0.0, start=0.0):
    """n points on a circle in the xz plane (around +y)."""
    return [Vector((r * math.cos(start + 2 * math.pi * i / n), y,
                    r * math.sin(start + 2 * math.pi * i / n))) for i in range(n)]


def lathe(profile, n, mat, cap_bottom=False, cap_top=False):
    """Revolves (radius, height) points around +y. Radius 0 points close the shape."""
    rings = [ring(r, n, y) for r, y in profile]
    return loft(rings, mat, closed=True, cap_start=cap_bottom, cap_end=cap_top)


def sphere(r, n, rings, mat):
    """A UV sphere centred on the origin (scale it for ellipsoids)."""
    prof = [(r * math.sin(math.pi * k / rings), -r * math.cos(math.pi * k / rings))
            for k in range(rings + 1)]
    return welded(lathe(prof, n, mat), 1e-6)


def torus(R, r, n, m, mat):
    """A ring of radius R around +y, tube radius r."""
    rings = []
    for i in range(n + 1):
        a = 2 * math.pi * i / n
        u = Vector((math.cos(a), 0, math.sin(a)))
        rings.append([u * (R + r * math.cos(-2 * math.pi * j / m))
                      + Vector((0, r * math.sin(-2 * math.pi * j / m), 0)) for j in range(m)])
    return welded(loft(rings, mat), 1e-6)


def cyl(r, h, n, mat, caps=True, r_top=None):
    """A cylinder (or cone frustum) around +y from y = 0 to y = h."""
    return lathe([(r, 0.0), (r if r_top is None else r_top, h)], n, mat, caps, caps)


def loft(rings, mat, closed=True, cap_start=False, cap_end=False):
    """Skins rings of equal length into quads; caps are single n-gons.

    Faces point along (next ring) x (ring order): rings clockwise when seen from
    where the loft is heading face outward.
    """
    g = Geo(mat=mat)
    n = len(rings[0])
    for r in rings:
        g.verts += [Vector(p) for p in r]
    span = n if closed else n - 1
    for k in range(len(rings) - 1):
        a, b = k * n, (k + 1) * n
        for i in range(span):
            j = (i + 1) % n
            g.faces.append((a + i, b + i, b + j, a + j))
    if cap_start:
        g.faces.append(tuple(range(n)))
    if cap_end:
        last = (len(rings) - 1) * n
        g.faces.append(tuple(reversed(range(last, last + n))))
    g.mats = [mat] * len(g.faces)
    return g


def extrude_x(section, x0, x1, mat):
    """A (z, y) polygon swept along x from x0 to x1, faces outward whatever its winding."""
    area = sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(section, section[1:] + section[:1]))
    pts = [(-z, y) for z, y in section]
    if area > 0:  # (-z, y) mirrors the winding; prism wants counter-clockwise
        pts.reverse()
    g = prism(pts, x1 - x0, mat)
    return g.transform(Matrix.Rotation(math.pi / 2, 4, 'Y')).move(x0, 0, 0)


def frame_along(path, i, up=Vector((0, 1, 0))):
    """Tangent frame at path[i]: (side, normal, tangent) with a stable up reference."""
    a = path[max(i - 1, 0)]
    b = path[min(i + 1, len(path) - 1)]
    t = (Vector(b) - Vector(a)).normalized()
    ref = up if abs(t.dot(up)) < 0.95 else Vector((1, 0, 0))
    side = t.cross(ref).normalized()
    return side, side.cross(t).normalized(), t


def sweep(section, path, mat, closed=True, caps=True):
    """Moves a 2D section (side, up) along a 3D path: rails, tubes, frames, mouldings."""
    rings = []
    for i, p in enumerate(path):
        side, nrm, _ = frame_along(path, i)
        rings.append([Vector(p) + side * a + nrm * b for a, b in section])
    return loft(rings, mat, closed=closed, cap_start=caps, cap_end=caps)


def tube(path, r, n, mat, caps=True):
    sec = [(r * math.cos(2 * math.pi * i / n), r * math.sin(2 * math.pi * i / n)) for i in range(n)]
    return sweep(sec, path, mat, caps=caps)


def prism(poly, depth, mat, bevel=0.0, segs=1):
    """A 2D polygon (x, y) extruded along +z from 0 to depth; counter-clockwise polygon."""
    n = len(poly)
    v = [(x, y, 0.0) for x, y in poly] + [(x, y, depth) for x, y in poly]
    f = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
    f += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    g = Geo(v, f, mat)
    return bevelled(g, bevel, segs) if bevel > 0 else g


def to_bmesh(g):
    bm = bmesh.new()
    names = sorted(set(g.mats), key=str)
    vs = [bm.verts.new(v) for v in g.verts]
    for f, m in zip(g.faces, g.mats):
        try:
            face = bm.faces.new([vs[i] for i in f])
        except ValueError:
            continue  # duplicate face from a degenerate loft step
        face.material_index = names.index(m)
    bm.normal_update()
    return bm, names


def from_bmesh(bm, names):
    g = Geo()
    index = {v: i for i, v in enumerate(bm.verts)}
    g.verts = [v.co.copy() for v in bm.verts]
    g.faces = [tuple(index[v] for v in f.verts) for f in bm.faces]
    g.mats = [names[f.material_index] for f in bm.faces]
    bm.free()
    return g


def bevelled(g, width, segs=2, angle=30.0):
    """Rounds every edge sharper than `angle` degrees, keeping per-face materials."""
    bm, names = to_bmesh(g)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    edges = [e for e in bm.edges if e.is_manifold and e.calc_face_angle(0) > math.radians(angle)]
    bmesh.ops.bevel(bm, geom=edges, offset=width, segments=segs, profile=0.5,
                    affect='EDGES', clamp_overlap=True)
    return from_bmesh(bm, names)


def subset(g, keep):
    """The faces whose material passes `keep`, with only the vertices they use."""
    out, index = Geo(), {}
    for f, m in zip(g.faces, g.mats):
        if not keep(m):
            continue
        for i in f:
            if i not in index:
                index[i] = len(out.verts)
                out.verts.append(g.verts[i].copy())
        out.faces.append(tuple(index[i] for i in f))
        out.mats.append(m)
    return out


def flipped(g):
    g.faces = [tuple(reversed(f)) for f in g.faces]
    return g


def welded(g, dist=1e-4):
    bm, names = to_bmesh(g)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    return from_bmesh(bm, names)
