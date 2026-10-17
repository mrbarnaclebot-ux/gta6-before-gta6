"""Props: street kit, shop awnings, and the lifeguard tower, one GLB per group.

Run: Blender -b --factory-startup -P assets-src/blender/props.py
Writes assets-src/models/props/{street_kit,awnings,lifeguard_tower}.glb and
previews/prop_<name>.png.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import props_street as st  # noqa: E402
import props_structures as ps  # noqa: E402
import props_vehicles as pv  # noqa: E402
from lib import export, mats, preview  # noqa: E402
from lib import scene as sc  # noqa: E402
from lib.geo import box  # noqa: E402

GROUPS = {
    'props/street_kit.glb': {
        'bench': st.bench, 'bin': st.bin_, 'hydrant': st.hydrant, 'planter': st.planter,
        'cafe_set': st.cafe_set, 'ac_unit': st.ac_unit, 'water_tank': st.water_tank,
        'bike': pv.bike, 'scooter': pv.scooter, 'kiosk': ps.kiosk, 'bus_shelter': ps.bus_shelter,
    },
    'props/awnings.glb': {
        'awning_striped': ps.awning_striped, 'awning_dome': ps.awning_dome,
        'awning_flat': ps.awning_flat,
    },
    'props/lifeguard_tower.glb': {'lifeguard_tower': ps.lifeguard_tower},
}

# name: (sRGB colour, roughness, metalness, extra Principled settings)
MATERIALS = {
    'wood_slat': (0x9a6b44, 0.6, 0.0, {}), 'wood_light': (0xd9c3a0, 0.7, 0.0, {}),
    'metal_dark': (0x202226, 0.45, 0.7, {}), 'metal_light': (0xb8bbbf, 0.3, 1.0, {}),
    'metal_green': (0x22473a, 0.5, 0.4, {}), 'metal_white': (0xe8e8e4, 0.4, 0.2, {}),
    'yellow_paint': (0xe8b81e, 0.5, 0.0, {}), 'grille': (0x1a1b1d, 0.6, 0.5, {}),
    'concrete': (0xcfc8bb, 0.85, 0.0, {}), 'soil': (0x3b2a1e, 1.0, 0.0, {}),
    'bark': (0x6f5a46, 0.9, 0.0, {}), 'leaf': (0x41702c, 0.6, 0.0, {'double': True}),
    'canvas_red': (0xb3262a, 0.8, 0.0, {'double': True}),
    'canvas_white': (0xece6da, 0.8, 0.0, {'double': True}),
    'canvas_navy': (0x1f3557, 0.8, 0.0, {'double': True}),
    'tank_wood': (0x7b5a3c, 0.85, 0.0, {}), 'rubber': (0x151516, 0.9, 0.0, {}),
    'bike_paint': (0x2a9d8f, 0.35, 0.3, {'coat': 0.5}),
    'scooter_paint': (0x9fd8cb, 0.3, 0.0, {'coat': 1.0}),
    'seat_leather': (0x5a3a28, 0.55, 0.0, {}),
    'light_head': (0xe8eef2, 0.1, 0.0, {'emit': 0xfff2dd, 'power': 0.3}),
    'light_tail': (0x7a0b0b, 0.1, 0.0, {'emit': 0xff2010, 'power': 0.15}),
    'kiosk_paint': (0xe9765b, 0.5, 0.0, {}),
    'ad': (0xf2efe6, 0.4, 0.0, {'emit': 0xfff6e8, 'power': 0.5}),
    'glass_clear': (0xbfd3d8, 0.05, 0.0, {'alpha': 0.25, 'double': True}),
    'glass_dark': (0x2b3a44, 0.08, 0.3, {}),
    'lamp_warm': (0xfff0d0, 0.3, 0.0, {'emit': 0xffc27a, 'power': 2.0}),
    'tower_pink': (0xf29bb5, 0.6, 0.0, {}), 'tower_yellow': (0xf6d55c, 0.6, 0.0, {}),
    'tower_teal': (0x2fb5a8, 0.55, 0.0, {}), 'trim': (0xf2f0ea, 0.6, 0.0, {}),
    'flag': (0xd42a1e, 0.7, 0.0, {'double': True}),
}


def materials():
    for name, (color, rough, metal, extra) in MATERIALS.items():
        mats.define(name, color, rough=rough, metal=metal, **extra)


def main():
    rows = []
    for file, makers in GROUPS.items():
        sc.reset()
        materials()
        roots = []
        for name, make in makers.items():
            root = sc.empty(name)
            sc.to_object(name + '_mesh', make(), root, smooth=35, uv=1.0)
            roots.append(root)
        export.glb(file, roots)
        for r in roots:
            rows.append(export.stats(r, file))
            wall = backdrop(r) if r.name.startswith('awning') else None
            preview.sheet(f'prop_{r.name}', [(r, 35)], size=(640, 420))
            if wall:
                r.location.z -= 2.6
                bpy.data.objects.remove(wall)
    return rows


def backdrop(root):
    """Hangs an awning 2.6 m up on a temporary shop wall for its preview."""
    root.location.z += 2.6
    wall = box(4.0, 3.3, 0.2, 'concrete').move(0, -0.95, -0.1)
    return sc.to_object('_wall', wall, root)


if __name__ == '__main__':
    main()
