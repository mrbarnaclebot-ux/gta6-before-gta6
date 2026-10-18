"""Eevee preview renders: the asset on light concrete under the game's own day sky, with a
low sun, from a three-quarter view, so each model can be judged before it ships."""

import math
import os

import bpy
from mathutils import Vector

from . import scene as sc

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HDRI = os.path.join(HERE, '..', 'hdri', 'day_kloofendal_2k.hdr')
PREVIEWS = os.path.join(HERE, 'previews')


def _world():
    w = bpy.data.worlds.new('sky')
    w.use_nodes = True
    nt = w.node_tree
    env = nt.nodes.new('ShaderNodeTexEnvironment')
    env.image = bpy.data.images.load(HDRI, check_existing=True)
    bg = nt.nodes['Background']
    bg.inputs['Strength'].default_value = 0.8
    nt.links.new(env.outputs['Color'], bg.inputs['Color'])
    bpy.context.scene.world = w


def _stage():
    """Ground plane and sun, made once per render and removed after."""
    made = []
    me = bpy.data.meshes.new('_ground')
    s = 400
    me.from_pydata([(-s, -s, 0), (s, -s, 0), (s, s, 0), (-s, s, 0)], [], [(0, 1, 2, 3)])
    mat = bpy.data.materials.new('_ground')
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.32, 0.31, 0.29, 1)
    bsdf.inputs['Roughness'].default_value = 0.85
    me.materials.append(mat)
    made.append(bpy.data.objects.new('_ground', me))
    sun = bpy.data.objects.new('_sun', bpy.data.lights.new('_sun', 'SUN'))
    sun.data.energy = 4.5
    sun.data.angle = math.radians(1.5)
    sun.rotation_euler = (math.radians(50), 0, math.radians(-35))
    made.append(sun)
    for o in made:
        bpy.context.scene.collection.objects.link(o)
    return made


def _camera(lo, hi, yaw, pitch, lens):
    cam = bpy.data.objects.new('_cam', bpy.data.cameras.new('_cam'))
    cam.data.lens = lens
    bpy.context.scene.collection.objects.link(cam)
    center = sc.G2B @ ((lo + hi) / 2)
    radius = (hi - lo).length / 2
    fov = 2 * math.atan(18 / lens)
    dist = radius / math.sin(fov / 2) * 1.02
    # yaw 0 looks at the asset's front (game +z, Blender -y) from ahead; positive swings left.
    d = Vector((math.sin(math.radians(yaw)) * math.cos(math.radians(pitch)),
                -math.cos(math.radians(yaw)) * math.cos(math.radians(pitch)),
                math.sin(math.radians(pitch))))
    cam.location = center + d * dist
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = cam
    return cam


def render(root, path, yaw=35, pitch=16, lens=60, size=(1200, 760)):
    """Renders `root`'s tree alone to `path` (PNG)."""
    scene = bpy.context.scene
    keep = set(sc.tree(root))
    hidden = [o for o in scene.objects if o not in keep]
    for o in hidden:
        o.hide_render = True
    lo, hi = sc.bounds(root)
    if not scene.world or scene.world.name != 'sky':
        _world()
    made = _stage() + [_camera(lo, hi, yaw, pitch, lens)]
    scene.render.engine = 'BLENDER_EEVEE'
    scene.eevee.taa_render_samples = 48
    scene.eevee.use_raytracing = True
    scene.render.resolution_x, scene.render.resolution_y = size
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.compression = 100
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    for o in made:
        bpy.data.objects.remove(o)
    for o in hidden:
        o.hide_render = False


def sheet(name, views, size=(560, 360)):
    """Renders each (root, yaw) view and lays them side by side in previews/<name>.png:
    one small file per asset instead of one large file per view."""
    import numpy as np
    tiles = []
    for i, (root, yaw) in enumerate(views):
        tmp = os.path.join(bpy.app.tempdir, f'_view{i}.png')
        render(root, tmp, yaw=yaw, size=size)
        img = bpy.data.images.load(tmp)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(size[1], size[0], 4)
        tiles.append(px)
        bpy.data.images.remove(img)
    out = bpy.data.images.new('_sheet', size[0] * len(tiles), size[1])
    out.pixels = np.concatenate(tiles, axis=1).ravel()
    os.makedirs(PREVIEWS, exist_ok=True)
    out.filepath_raw = os.path.join(PREVIEWS, f'{name}.png')
    out.file_format = 'PNG'
    out.save()
    bpy.data.images.remove(out)
