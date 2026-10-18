"""Details laid onto a curved surface: lamps, grilles, badges, and lettering are drawn flat,
then every vertex is shot along a direction onto the body and lifted off it a few
millimetres, so they hug the panels without cutting into them."""

import math

import bpy
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

from .geo import Geo, subset


class Surface:
    def __init__(self, geo):
        self.tree = BVHTree.FromPolygons([tuple(v) for v in geo.verts], geo.faces)

    def hit(self, origin, direction):
        loc, nrm, _, _ = self.tree.ray_cast(Vector(origin), Vector(direction).normalized())
        if loc is None:
            return None
        if nrm.dot(direction) > 0:
            nrm = -nrm
        return loc, nrm


def drape(g, surf, direction, offset):
    """Moves each vertex of `g` onto `surf` along `direction` (rays start 3 m back), then
    `offset` metres out along the surface normal. Faces with a vertex that misses (hangs
    past the panel's edge) are dropped."""
    d = Vector(direction).normalized()
    missed = set()
    for i, v in enumerate(g.verts):
        h = surf.hit(v - d * 3.0, d)
        if h:
            g.verts[i] = h[0] + h[1] * offset
        else:
            missed.add(i)
    if not missed:
        return g
    out = Geo()
    out.verts, out.faces, out.mats = g.verts, g.faces, g.mats
    keep = [k for k, f in enumerate(g.faces) if not missed.intersection(f)]
    out.faces = [g.faces[k] for k in keep]
    out.mats = [g.mats[k] for k in keep]
    return subset(out, lambda m: True)


def superellipse(a, b, n, t):
    c, s = math.cos(t), math.sin(t)
    return (a * math.copysign(abs(c) ** (2 / n), c), b * math.copysign(abs(s) ** (2 / n), s))


def disc(a, b, mats, n=4.0, segs=24, skew=0.0, tilt=0.0):
    """A flat rounded-rectangle patch facing +z in the xy plane: half-size a x b, squareness
    n (2 = ellipse). `mats` names each ring from the centre out, e.g. lens, lens, bezel.
    `skew` shears y by x (swept lamps), `tilt` turns it (degrees)."""
    rings = len(mats)
    g = Geo()
    g.verts.append(Vector((0, 0, 0)))
    for k in range(1, rings + 1):
        f = (k / rings) ** 0.8
        for i in range(segs):
            x, y = superellipse(a * f, b * f, n, 2 * math.pi * i / segs)
            g.verts.append(Vector((x, y + skew * x, 0)))
    for i in range(segs):
        j = (i + 1) % segs
        g.faces.append((0, 1 + i, 1 + j))
        g.mats.append(mats[0])
    for k in range(1, rings):
        a0, b0 = 1 + (k - 1) * segs, 1 + k * segs
        for i in range(segs):
            j = (i + 1) % segs
            g.faces.append((a0 + i, b0 + i, b0 + j, a0 + j))
            g.mats.append(mats[k])
    return g.rot((0, 0, 1), tilt) if tilt else g


def grid(w, h, nu, nv, mat):
    """A flat w x h rectangle facing +z, split nu x nv so it can bend over a curved panel."""
    g = Geo(mat=mat)
    for j in range(nv + 1):
        for i in range(nu + 1):
            g.verts.append(Vector((-w / 2 + w * i / nu, -h / 2 + h * j / nv, 0)))
    for j in range(nv):
        for i in range(nu):
            a = j * (nu + 1) + i
            g.faces.append((a, a + 1, a + nu + 2, a + nu + 1))
    g.mats = [mat] * len(g.faces)
    return g


def text(body, size, mat, bold=False):
    """Lettering as a flat mesh facing +z, centred on the origin, `size` m tall capitals."""
    cu = bpy.data.curves.new('_text', 'FONT')
    cu.body = body
    cu.size = size / 0.72
    cu.resolution_u = 2
    cu.align_x, cu.align_y = 'CENTER', 'CENTER'
    if bold:
        cu.offset = 0.004
    obj = bpy.data.objects.new('_text', cu)
    bpy.context.scene.collection.objects.link(obj)
    me = obj.to_mesh()
    g = Geo([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons], mat)
    obj.to_mesh_clear()
    bpy.data.objects.remove(obj)
    bpy.data.curves.remove(cu)
    return g


# Turns a +z-facing flat detail to face each side of a car (front +z, left +x).
FACING = {
    'front': Matrix.Identity(4),
    'rear': Matrix.Rotation(math.pi, 4, 'Y'),
    'left': Matrix.Rotation(math.pi / 2, 4, 'Y'),
    'right': Matrix.Rotation(-math.pi / 2, 4, 'Y'),
}
RAY = {'front': (0, 0, -1), 'rear': (0, 0, 1), 'left': (-1, 0, 0), 'right': (1, 0, 0)}


def place(g, surf, side, at, offset=0.004):
    """Faces a flat detail to `side`, centres it on `at` (only the two in-plane coordinates
    matter), and drapes it onto the surface."""
    g.transform(FACING[side])
    d = Vector(RAY[side])
    pos = Vector(at) - d * 4.0
    g.move(*pos)
    return drape(g, surf, d, offset)
