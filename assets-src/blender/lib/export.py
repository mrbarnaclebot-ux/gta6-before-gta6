"""GLB export of whole node trees, and the numbers the README records for each asset."""

import json
import os

import bpy

from . import scene as sc

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = os.path.normpath(os.path.join(HERE, '..', 'models'))


def glb(path, roots):
    """Writes the roots and everything under them to assets-src/models/<path>."""
    out = os.path.join(MODELS, path)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for r in roots:
        for o in sc.tree(r):
            o.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_extras=True,
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_cameras=False,
        export_lights=False,
        export_animations=False,
    )
    print('EXPORTED', out, os.path.getsize(out))
    return out


def stats(root, file):
    """One STATS line per asset: name, file, triangles, and size in metres (w, h, d)."""
    lo, hi = sc.bounds(root)
    size = hi - lo
    row = dict(name=root.name, file=file, tris=sc.tris(root),
               size=[round(size.x, 2), round(size.y, 2), round(size.z, 2)],
               min=[round(c, 2) for c in lo], max=[round(c, 2) for c in hi])
    print('STATS', json.dumps(row))
    return row
