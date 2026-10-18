"""Houses: six Miami-style houses with a LOD1 each, all in one GLB so they share their
materials and textures.

Run: Blender -b --factory-startup -P assets-src/blender/houses.py [-- name ...]
Writes assets-src/models/houses/houses.glb and previews/house_<name>.png.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import house_designs_a as a  # noqa: E402
import house_designs_b as b  # noqa: E402
from lib import export, mats, preview, textures  # noqa: E402
from lib import scene as sc  # noqa: E402

# name: (builder, footprint w x d of the main block, floors)
HOUSES = {
    'ranch': (a.ranch, (14, 10), 1),
    'mediterranean': (a.mediterranean, (13, 10), 2),
    'modern': (a.modern, (13, 11), 2),
    'deco': (b.deco, (12, 10), 1),
    'keywest': (b.keywest, (12, 9), 1),
    'spanish': (b.spanish, (14, 11), 2),
}

WALLS = {'cream': 0xefe3cf, 'sand': 0xe6d2b5, 'white': 0xf2f0eb, 'grey': 0x9c9a96,
         'mint': 0xbfe2d2, 'yellow': 0xf2e1a4, 'coral': 0xefc9bb}


def materials():
    stucco = textures.stucco()
    tile_c, tile_n = textures.barrel_tiles()
    seam = textures.standing_seam()
    for name, color in WALLS.items():
        mats.define(f'stucco_{name}', color, rough=0.92, normal=stucco, normal_strength=0.6)
    mats.define('trim', 0xe6e3dc, rough=0.6)
    mats.define('plinth', 0xb9b1a4, rough=0.9, normal=stucco, normal_strength=0.6)
    mats.define('roof_ridge', 0xa4563a, rough=0.7)
    mats.define('roof_tile', 0xffffff, rough=0.75, base=tile_c, normal=tile_n)
    mats.define('roof_metal', 0xb9bdc1, rough=0.38, metal=0.8, normal=seam)
    mats.define('roof_flat', 0x9b9791, rough=0.95)
    mats.define('glass_house', 0x3b505d, rough=0.06, metal=0.3)
    mats.define('glass_block', 0xa8cdd4, rough=0.25)
    mats.define('glass_rail', 0x9fb8c0, rough=0.05, alpha=0.35, double=True)
    mats.define('frame_dark', 0x2d2a27, rough=0.4, metal=0.4)
    mats.define('door', 0x6b4630, rough=0.5)
    mats.define('door_panel', 0x5a3a27, rough=0.55)
    mats.define('brass', 0xb08d3c, rough=0.3, metal=1.0)
    mats.define('garage_door', 0xe9e6e0, rough=0.5)
    mats.define('seam', 0x77736c, rough=0.7)
    mats.define('shutter', 0x3f7f86, rough=0.6)
    mats.define('concrete', 0xd6d0c4, rough=0.85)
    mats.define('pool_water', 0x2fb6c8, rough=0.04)
    mats.define('pool_tile', 0x7fcfda, rough=0.3)
    mats.define('rail_metal', 0x1d1e20, rough=0.4, metal=0.6)
    mats.define('fence', 0xf2f0ea, rough=0.6)
    mats.define('wood', 0x8a6142, rough=0.7)


def build(name, lod):
    make, (w, d), floors = HOUSES[name]
    extras = None if lod else dict(width=w, depth=d, floors=floors, garage_x=w / 2 - 2.2)
    root = sc.empty(f'house_{name}' + ('_lod1' if lod else ''), extras=extras)
    sc.to_object(root.name + '_mesh', make(lod), root, smooth=35, uv=2.0)
    return root


def main(names):
    sc.reset()
    materials()
    roots, rows = [], []
    for name in HOUSES:
        if names and name not in names:
            continue
        pair = [build(name, False), build(name, True)]
        roots += pair
    file = 'houses/houses.glb'
    export.glb(file, roots)
    for r in roots:
        rows.append(export.stats(r, file))
    for lo, hi in zip(roots[::2], roots[1::2]):
        preview.sheet(lo.name, [(lo, 35), (lo, 160), (hi, 35)])
    return rows


if __name__ == '__main__':
    main(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
