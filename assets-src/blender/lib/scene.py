"""Turns Geo data into Blender objects and node trees, and clears the scene between assets."""

import math

import bpy
from mathutils import Matrix, Vector

from . import mats

# Game axes (x left, y up, z forward) to Blender axes; the glTF exporter's +Y-up switch maps
# Blender (x, y, z) to glTF (x, z, -y), which lands back on the game axes.
G2B = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def reset():
    """An empty scene with no leftover meshes, materials, or images from the last asset."""
    for coll in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.images,
                 bpy.data.curves, bpy.data.lights, bpy.data.cameras, bpy.data.worlds):
        for block in list(coll):
            coll.remove(block)
    mats.clear()


def empty(name, parent=None, at=(0, 0, 0), extras=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = G2B @ Vector(at)
    for k, v in (extras or {}).items():
        obj[k] = v
    return obj


# Materials whose faces get slope UVs (u along the eave, v down the slope: roof tiles and
# seams line up on every face of a hip roof) or one 0..1 square per face (window panes,
# so an interior-mapping shader can find the pane's corners).
SLOPE_UV = {'roof_tile', 'roof_metal'}
UNIT_UV = {'glass_house'}


def _slope_frame(n):
    down = Vector((n.x, n.y, 0))
    if down.length < 1e-4:
        return None
    down.normalize()
    eave = Vector((-down.y, down.x, 0))
    return eave, eave.cross(n).normalized()


def box_uv(me, tile):
    """Box projection in metres: each face takes the plane it faces most; `tile` m per repeat."""
    uv = me.uv_layers.new(name='UVMap').data
    names = [m.name if m else '' for m in me.materials]
    for poly in me.polygons:
        name = names[poly.material_index] if names else ''
        loops = list(poly.loop_indices)
        cos = [me.vertices[me.loops[li].vertex_index].co for li in loops]
        if name in UNIT_UV and len(loops) == 4:
            for li, c in zip(loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
                uv[li].uv = c
            continue
        frame = _slope_frame(poly.normal) if name in SLOPE_UV else None
        if frame:
            for li, co in zip(loops, cos):
                uv[li].uv = (co.dot(frame[0]) / 2.0, co.dot(frame[1]) / 2.0)
            continue
        k = max(range(3), key=lambda i: abs(poly.normal[i]))
        axes = [i for i in range(3) if i != k]
        for li, co in zip(loops, cos):
            uv[li].uv = (co[axes[0]] / tile, co[axes[1]] / tile)


def to_object(name, geo, parent=None, at=(0, 0, 0), smooth=None, uv=None, rot_y=0.0):
    """One mesh object from a Geo in game axes, given in the parent's frame. `at` becomes
    the node's origin (the vertices are stored relative to it); `smooth` is the auto-smooth angle in degrees (None = flat); `uv` the box
    projection tile in metres; `rot_y` turns the node about the vertical axis."""
    origin = Vector(at)
    me = bpy.data.meshes.new(name)
    me.from_pydata([G2B @ (v - origin) for v in geo.verts], [], geo.faces)
    names = sorted(set(geo.mats), key=str)
    for n in names:
        me.materials.append(mats.get(n))
    for poly, m in zip(me.polygons, geo.mats):
        poly.material_index = names.index(m)
    me.validate()
    if smooth is not None:
        me.shade_smooth()
        me.set_sharp_from_angle(angle=math.radians(smooth))
    if uv:
        box_uv(me, uv)
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = G2B @ origin
    obj.rotation_euler = (0, 0, math.radians(rot_y))
    return obj


def instance(name, source, parent=None, at=(0, 0, 0), rot_y=0.0):
    """Another node sharing `source`'s mesh (exported once, drawn at many places)."""
    obj = bpy.data.objects.new(name, source.data)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    obj.location = G2B @ Vector(at)
    obj.rotation_euler = (0, 0, math.radians(rot_y))
    return obj


def tree(root):
    out = [root]
    for c in root.children:
        out += tree(c)
    return out


def tris(root):
    return sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
               for o in tree(root) if o.type == 'MESH')


def bounds(root):
    """World-space box of a node tree in game axes: (min, max) Vectors."""
    bpy.context.view_layer.update()
    b2g = G2B.inverted()
    pts = [b2g @ (o.matrix_world @ Vector(c)) for o in tree(root) if o.type == 'MESH'
           for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    return lo, hi


def cut(obj, cutter_geo):
    """Boolean difference with a closed Geo; the cut faces take the cutter's materials."""
    cutter = to_object('_cutter', cutter_geo)
    mod = obj.modifiers.new('cut', 'BOOLEAN')
    mod.object = cutter
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.material_mode = 'TRANSFER'
    bpy.context.view_layer.update()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    obj.modifiers.remove(mod)
    old = obj.data
    obj.data = me
    bpy.data.meshes.remove(old)
    me.name = obj.name
    bpy.data.objects.remove(cutter)
    for m in cutter_geo.mats:
        if m not in [s.name for s in me.materials if s]:
            me.materials.append(mats.get(m))


def split(obj, names, new_name):
    """Moves the faces drawn with materials in `names` into a new sibling object."""
    import bmesh
    other = obj.copy()
    other.data = obj.data.copy()
    other.name = other.data.name = new_name
    bpy.context.scene.collection.objects.link(other)
    for o, drop_named in ((obj, True), (other, False)):
        bm = bmesh.new()
        bm.from_mesh(o.data)
        slots = [s.name if s else '' for s in o.data.materials]
        doomed = [f for f in bm.faces if (slots[f.material_index] in names) == drop_named]
        bmesh.ops.delete(bm, geom=doomed, context='FACES')
        bm.to_mesh(o.data)
        bm.free()
        _drop_unused_slots(o)
    return other


def _drop_unused_slots(o):
    me = o.data
    used = sorted({p.material_index for p in me.polygons})
    keep = [me.materials[i] for i in used]
    remap = {old: new for new, old in enumerate(used)}
    idx = [remap[p.material_index] for p in me.polygons]
    me.materials.clear()
    for m in keep:
        me.materials.append(m)
    for p, i in zip(me.polygons, idx):
        p.material_index = i
