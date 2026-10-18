"""glTF-safe materials: one Principled BSDF each, with plain inputs or image maps only.

Materials are declared once per family (`define`) and looked up by name when a mesh is
made, so a Geo only carries names. The names reach the game as glTF material names, which
is how integration finds the paint, glass, and lamps.
"""

import bpy

_specs = {}


def clear():
    _specs.clear()


def linear(hex_rgb):
    """sRGB hex to linear floats (Principled colours are linear)."""
    out = []
    for shift in (16, 8, 0):
        c = ((hex_rgb >> shift) & 255) / 255
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return (*out, 1.0)


def define(name, color=0xffffff, rough=0.5, metal=0.0, emit=None, power=1.0, alpha=1.0,
           double=False, base=None, normal=None, normal_strength=1.0, coat=0.0):
    """`base` and `normal` are bpy images; `emit` an sRGB hex for the emission colour;
    `coat` a clear coat weight (exported as KHR_materials_clearcoat)."""
    _specs[name] = dict(color=color, rough=rough, metal=metal, emit=emit, power=power,
                        alpha=alpha, double=double, base=base, normal=normal,
                        normal_strength=normal_strength, coat=coat)


def get(name):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    if name not in _specs:
        raise KeyError(f'material {name} was never defined')
    return _build(name, **_specs[name])


def _image(nt, img, non_color):
    node = nt.nodes.new('ShaderNodeTexImage')
    node.image = img
    if non_color:
        img.colorspace_settings.name = 'Non-Color'
    return node


def _build(name, color, rough, metal, emit, power, alpha, double, base, normal, normal_strength,
           coat):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = linear(color)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if coat:
        bsdf.inputs['Coat Weight'].default_value = coat
        bsdf.inputs['Coat Roughness'].default_value = 0.04
    if base is not None:
        tex = _image(nt, base, False)
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if normal is not None:
        tex = _image(nt, normal, True)
        nmap = nt.nodes.new('ShaderNodeNormalMap')
        nmap.inputs['Strength'].default_value = normal_strength
        nt.links.new(tex.outputs['Color'], nmap.inputs['Color'])
        nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    if emit is not None:
        bsdf.inputs['Emission Color'].default_value = linear(emit)
        bsdf.inputs['Emission Strength'].default_value = power
    if alpha < 1:
        bsdf.inputs['Alpha'].default_value = alpha
        m.surface_render_method = 'BLENDED'
    m.use_backface_culling = not double
    m.diffuse_color = linear(color)
    return m
