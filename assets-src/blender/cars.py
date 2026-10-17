"""Cars: sports, police, sedan, SUV, pickup, van. One GLB each with a LOD0 and a LOD1 tree.

Run: Blender -b --factory-startup -P assets-src/blender/cars.py [-- name ...]
Writes assets-src/models/vehicle/car_<name>.glb and previews/car_<name>[_lod1].png.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import car_body  # noqa: E402
import car_details as det  # noqa: E402
from car_interior import bed, interior  # noqa: E402
from car_specs import SPECS  # noqa: E402
from car_wheels import wheel  # noqa: E402
from lib import export, mats, preview  # noqa: E402
from lib import scene as sc  # noqa: E402
from lib.drape import Surface  # noqa: E402
from lib.geo import Geo  # noqa: E402


def materials(sp):
    w = sp['wheel']
    mats.define('paint', sp['paint'], rough=0.32, metal=0.35, coat=1.0)
    mats.define('paint_white', 0xeeeeea, rough=0.3, coat=1.0)
    mats.define('trim_black', 0x111214, rough=0.55)
    mats.define('well', 0x0b0b0c, rough=0.9)
    mats.define('grille', 0x0c0d0e, rough=0.4, metal=0.4)
    mats.define('chrome', 0xd8d8d8, rough=0.1, metal=1.0)
    mats.define('glass', 0x141b20, rough=0.03, alpha=0.72, double=True)
    mats.define('light_head', 0xb4bcc2, rough=0.1, metal=0.7, emit=0xfff2dd, power=0.2)
    mats.define('light_tail', 0x7a0b0b, rough=0.1, emit=0xff2010, power=0.15)
    mats.define('light_indicator', 0xd98b1f, rough=0.12)
    mats.define('light_reverse', 0xdedede, rough=0.08)
    mats.define('lightbar_red', 0x9c0f0f, rough=0.15, emit=0xff1a10, power=1.0)
    mats.define('lightbar_blue', 0x0f2a9c, rough=0.15, emit=0x2050ff, power=1.0)
    mats.define('plate', 0xe9e6da, rough=0.45)
    mats.define('interior', 0x202124, rough=0.85)
    mats.define('bedliner', 0x1e1f21, rough=0.95)
    mats.define('tyre', 0x161617, rough=0.9)
    mats.define('rim', w['color'], rough=0.28, metal=1.0)
    mats.define('brake', 0x6a6a6a, rough=0.45, metal=1.0)


def bolt_ons(sp, surf, lod):
    """Shell details that share the body node: lips, grille, plates, handles, mirrors."""
    g = Geo().add(car_body.arch_lips(sp, surf, lod), det.grille(sp, surf, lod),
                  det.plates(sp, surf), det.mirrors(sp, surf), det.patches(sp, surf, lod))
    if not lod:
        g.add(det.handles(sp, surf), det.exhausts(sp))
    if 'lettering' in sp and not lod:
        g.add(det.lettering(sp, surf))
    if 'push_bar' in sp:
        g.add(det.push_bar(sp))
    if 'lightbar' in sp:
        g.add(det.lightbar(sp, lod))
    if 'rails' in sp:
        g.add(det.rails(sp))
    return g


def join(target, geo, smooth):
    """Merges a Geo into an existing mesh object (materials and all)."""
    part = sc.to_object('_part', geo, target.parent, smooth=smooth)
    with bpy.context.temp_override(active_object=target, selected_editable_objects=[target, part]):
        bpy.ops.object.join()


def body(sp, root, sfx, lod):
    shell = car_body.shell(sp, lod)
    surf = Surface(shell)
    obj = sc.to_object('body' + sfx, shell, root, smooth=40)
    cutter = car_body.arch_cutter(sp, lod)
    if 'bed' in sp:
        cutter.add(bed(sp))
    sc.cut(obj, cutter)
    obj.data.set_sharp_from_angle(angle=0.7)
    join(obj, bolt_ons(sp, surf, lod), 40)
    sc.split(obj, {'glass'}, 'glass' + sfx)
    return surf


def wheels(sp, root, sfx, lod):
    w = sp['wheel']
    hub = (w['x'], w['r'], sp['wheelbase'] / 2)
    fl = sc.to_object('wheel_fl' + sfx, wheel(w, lod).move(*hub), root, smooth=50, at=hub)
    # Right-hand wheels share the mesh, turned half round so the rim faces out.
    for name, x, z, rot in (('wheel_fr', -1, 1, 180), ('wheel_rl', 1, -1, 0),
                            ('wheel_rr', -1, -1, 180)):
        sc.instance(name + sfx, fl, root, at=(x * w['x'], w['r'], z * sp['wheelbase'] / 2),
                    rot_y=rot)


def extras(sp):
    """Numbers integration needs, stored on the root node (glTF extras)."""
    w = sp['wheel']
    return dict(wheel_radius=w['r'], wheel_width=w['w'], wheel_x=w['x'],
                wheel_front=sp['wheelbase'] / 2, wheel_rear=-sp['wheelbase'] / 2,
                seat=[0.37, sp['cabin']['seat_y'], sp['cabin']['rows'][0] - 0.3])


def build(sp, lod):
    sfx = '_lod1' if lod else ''
    root = sc.empty(sp['name'] + sfx, extras=None if lod else extras(sp))
    surf = body(sp, root, sfx, lod)
    sc.to_object('lights_head' + sfx, det.heads(sp, surf, lod), root, smooth=40)
    sc.to_object('lights_tail' + sfx, det.tails(sp, surf, lod), root, smooth=40)
    sc.to_object('interior' + sfx, interior(sp, lod), root, smooth=30)
    wheels(sp, root, sfx, lod)
    return root


def main(names):
    rows = []
    for sp in SPECS:
        if names and sp['name'] not in names:
            continue
        sc.reset()
        materials(sp)
        roots = [build(sp, False), build(sp, True)]
        file = f"vehicle/car_{sp['name']}.glb"
        export.glb(file, roots)
        rows += [export.stats(r, file) for r in roots]
        preview.sheet(f"car_{sp['name']}", [(roots[0], 38), (roots[0], 150), (roots[1], 38)])
    return rows


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    main(argv)
