"""Small tileable textures computed with numpy and handed to Blender as packed images.

Blender's procedural texture nodes do not survive glTF export, so every pattern is
computed here as plain pixels instead (no baking pass, the same bytes on every run).
Height fields become OpenGL-style normal maps, which is what glTF expects.
"""

import bpy
import numpy as np


def noise(size, falloff, seed):
    """Tileable fractal noise in 0..1: white noise filtered by 1 / f**falloff."""
    rng = np.random.default_rng(seed)
    white = rng.standard_normal((size, size))
    fy = np.fft.fftfreq(size)[:, None]
    fx = np.fft.rfftfreq(size)[None, :]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1
    field = np.fft.irfft2(np.fft.rfft2(white) / f ** falloff, s=(size, size))
    field -= field.min()
    return field / field.max()


def normal_from_height(h, strength):
    """Normal map pixels (0..1) from a height field; rows run along +v (image bottom first)."""
    du = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * 0.5
    dv = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * 0.5
    n = np.stack([-du * strength, -dv * strength, np.ones_like(h)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def image(name, rgb, non_color=False):
    """A packed RGB image from an (h, w, 3) array in 0..1."""
    h, w, _ = rgb.shape
    img = bpy.data.images.new(name, w, h, alpha=False)
    if non_color:
        img.colorspace_settings.name = 'Non-Color'
    rgba = np.concatenate([rgb, np.ones((h, w, 1))], axis=-1).astype(np.float32)
    img.pixels.foreach_set(rgba.ravel())
    img.file_format = 'PNG'
    img.pack()
    return img


def stucco(size=512):
    """Fine trowelled render: a soft lumpy height with grit on top."""
    h = noise(size, 1.6, 1) * 0.7 + noise(size, 0.6, 2) * 0.3
    return image('stucco_n', normal_from_height(h, 6.0), True)


def barrel_tiles(size=512, across=8, courses=6):
    """Clay barrel tiles over 2 x 2 m: colour and normal. u runs along the eave, v down
    the slope; each course overlaps the one below, so height ramps within a course."""
    u = (np.arange(size) + 0.5) / size
    uu, vv = np.meshgrid(u, u)
    fu = (uu * across) % 1.0
    fv = (vv * courses) % 1.0
    barrel = np.abs(np.sin(np.pi * fu)) ** 0.6
    h = barrel * 0.8 + (1 - fv) * 0.35
    tile = (np.floor(uu * across) * 7 + np.floor(vv * courses) * 13) % 11 / 10.0
    shade = 0.82 + 0.18 * tile + 0.12 * (noise(size, 1.2, 3) - 0.5)
    shade *= 0.55 + 0.45 * barrel
    shade *= np.where(fv < 0.06, 0.55, 1.0)
    base = np.array([0.72, 0.36, 0.22])
    rgb = np.clip(shade[..., None] * base, 0, 1)
    return image('tile_c', rgb), image('tile_n', normal_from_height(h, 9.0), True)


def standing_seam(size=256, panels=4):
    """Metal roof over 2 x 2 m: raised seams every 0.5 m down the slope, faint oil-canning."""
    u = (np.arange(size) + 0.5) / size
    uu, vv = np.meshgrid(u, u)
    fu = (uu * panels) % 1.0
    seam = np.clip(1 - np.abs(fu - 0.5) / 0.03, 0, 1) ** 0.5
    h = seam + 0.05 * noise(size, 1.0, 4)
    return image('metal_n', normal_from_height(h, 4.0), True)
