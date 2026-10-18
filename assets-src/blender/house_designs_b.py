"""The other three houses: art deco, Key West, Spanish. Same local space as
house_designs_a.py (front towards +z, garage door centred at x = w / 2 - 2.2)."""

from house_designs_a import win
from house_parts import arch_window, column, door, garage, openings, porthole, quad, walls
from house_roofs import deck_around, flat, gable, hip, low_wall, picket, pool, railing, shed, steps
from lib.geo import box


def front_line(d):
    """Garden walls stand 2 m inside the curb, which is 8 m in front of every house's
    front wall (src/land/residential.ts); they leave the driveway (x = garage +- 1.7) open."""
    return d / 2 + 6.0


def deco(lod):
    """Single-storey art deco: flat roof behind a parapet, a raised centre bay with a fin,
    eyebrow ledges, a porthole, glass blocks, and a low garden wall."""
    W, D, H = 12, 10, 3.6
    g = walls(-6, 6, -5, 5, H, 'stucco_mint')
    g.add(flat(-6, 6, -5, 5, H, 0.5, 'stucco_mint', lod))
    g.add(walls(-1.6, 1.6, 5.0, 5.3, 4.9, 'stucco_mint'))
    g.add(box(0.3, 1.1, 1.0, 'stucco_mint').move(0, 5.45, 4.85))
    if not lod:
        for k in range(3):
            g.add(box(4.0, 0.05, 0.05, 'trim').move(-3.9, 3.0 + 0.16 * k, 5.02))
            g.add(box(0.05, 0.05, 3.0, 'trim').move(6.02, 3.0 + 0.16 * k, 3.5))
    g.add(openings([
        ('front', 0.35, 0.15, lambda l: door(1.0, 2.3, 'panel', l)),
        ('front', -0.85, 1.0, lambda l: porthole(0.38, l)),
        ('front', 1.15, 0.3, lambda l: quad(0.3, 2.2, 0.02, 'glass_block')),
    ], 0, 2.65, 3.2, 5.3, lod))
    g.add(openings([
        ('front', -3.9, 0.95, win(1.8, 1.3, 'deco', 3)),
        ('front', 3.8, 0.0, lambda l: garage(2.6, 2.3, l)),
        ('left', 0.0, 1.0, win(1.6, 1.3, 'deco', 2)), ('right', 1.5, 1.0, win(1.6, 1.3, 'deco', 2)),
        ('right', -2.5, 1.0, win(1.0, 1.3, 'deco')),
        ('rear', -3.0, 0.15, lambda l: door(2.4, 2.3, 'glass', l)), ('rear', 2.5, 1.0, win(1.8, 1.3, 'deco', 3)),
    ], 0, 0, W, D, lod))
    z = front_line(D)
    g.add(low_wall((-6.5, 0, z), (-0.6, 0, z), 0.75, 'stucco_mint', lod))
    g.add(low_wall((0.8, 0, z), (2.1, 0, z), 0.75, 'stucco_mint', lod))
    g.add(box(1.2, 0.3, z - 5.3, 'concrete').move(0.1, -0.09, (z + 5.3) / 2))
    return g


def keywest(lod):
    """Key West cottage: raised floor, standing-seam metal gable, a deep front porch with
    white balusters, tall shuttered windows, and a picket fence."""
    W, D, F = 12, 9, 0.6
    g = walls(-6, 6, -4.5, 4.5, 3.6, 'stucco_yellow')
    g.add(box(12.1, 0.12, 9.1, 'trim').move(0, F, 0))
    g.add(gable(W, D, 3.82, 0.62, 0.5, 'roof_metal', 'stucco_yellow'))
    g.add(box(8.4, F + 0.4, 2.4, 'wood').move(-1.8, (F - 0.4) / 2, 5.7))
    for x in (-5.85, -3.0, -0.6, 2.25):
        g.add(box(0.16, 2.9, 0.16, 'trim').move(x, F + 1.45, 6.75))
    for x0, x1 in ((-5.85, -2.5), (-1.1, 2.25)):
        g.add(railing((x0, F, 6.75), (x1, F, 6.75), 0.9, 'baluster', lod))
    g.add(steps(-1.8, 6.9, 1.3, 0.15, 4))
    g.add(shed(-6.2, 2.6, 4.5, 7.1, 3.55, 2.95, 'roof_metal'))
    g.add(openings([
        ('front', -1.8, F, lambda l: door(1.0, 2.2, 'panel', l)),
        ('front', -4.4, F + 0.5, win(1.0, 1.9, 'shutter', 1)),
        ('front', 0.6, F + 0.5, win(1.0, 1.9, 'shutter', 1)),
        ('front', 3.8, 0.0, lambda l: garage(2.6, 2.3, l)),
        ('left', -1.0, F + 0.5, win(1.0, 1.7, 'shutter', 1)), ('right', 1.0, F + 0.5, win(1.0, 1.7, 'shutter', 1)),
        ('right', -2.5, F + 0.5, win(1.0, 1.7, 'shutter', 1)),
        ('rear', -3.0, F + 0.5, win(1.0, 1.7, 'shutter', 1)), ('rear', 0.0, F, lambda l: door(1.0, 2.2, 'glass', l)),
        ('rear', 3.0, F + 0.5, win(1.0, 1.7, 'shutter', 1)),
    ], 0, 0, W, D, lod))
    z = front_line(D)
    g.add(picket((-6.5, 0, z), (-2.6, 0, z), lod=lod), picket((-1.0, 0, z), (2.0, 0, z), lod=lod))
    return g


def spanish(lod):
    """Spanish revival L: a two-storey tile-roofed block, a garage wing with a roof terrace,
    arched openings, a tiled entry porch, a garden wall, and a pool behind."""
    g = walls(-7, 1.5, -5.5, 5.5, 6.0, 'stucco_coral')
    g.add(hip(8.5, 11, 6.22, 0.42, 0.55, 'roof_tile').move(-2.75, 0, 0))
    g.add(walls(1.5, 7, -5.5, 3.5, 3.2, 'stucco_coral'))
    g.add(flat(1.5, 7, -5.5, 3.5, 3.2, 0.12, 'stucco_coral', lod))
    for a, b in (((1.7, 3.5), (6.85, 3.35)), ((6.85, 3.35), (6.85, -5.35)), ((6.85, -5.35), (1.7, -5.35))):
        g.add(railing((a[0], 3.32, a[1]), (b[0], 3.32, b[1]), 1.0, 'bars', lod))
    g.add(openings([('front', 0.55, 0.0, lambda l: garage(2.7, 2.3, l))], 4.25, -1.0, 5.5, 9, lod))
    g.add(openings([
        ('front', 1.0, 0.15, lambda l: door(1.8, 2.3, 'double', l)),
        ('front', -2.6, 0.9, lambda l: arch_window(1.2, 1.4, l)),
        ('front', -2.6, 3.7, win(1.1, 1.4)), ('front', 1.0, 3.7, win(1.1, 1.4)),
        ('left', 1.0, 3.3, lambda l: door(1.6, 2.2, 'glass', l)),
        ('right', 2.5, 1.0, win(1.3, 1.3)), ('right', -2.0, 3.7, win(1.3, 1.3)),
        ('rear', 0.0, 0.15, lambda l: door(2.4, 2.2, 'glass', l)), ('rear', 3.0, 3.7, win(1.3, 1.3)),
        ('rear', -3.0, 3.7, win(1.3, 1.3)),
    ], -2.75, 0, 8.5, 11, lod))
    for x in (-2.6, 1.0):
        g.add(railing((x - 0.7, 3.55, 5.85), (x + 0.7, 3.55, 5.85), 0.6, 'bars', lod))
    g.add(box(3.4, 0.45, 1.8, 'concrete').move(-1.75, -0.075, 6.4))
    for x in (-3.2, -0.3):
        g.add(column(x, 7.1, 2.75, lod=lod))
    g.add(shed(-3.6, 0.1, 5.5, 7.4, 3.05, 2.8, 'roof_tile'))
    hole = (-2.75, -9.2, 6.5, 3.2)
    g.add(deck_around(-7, 1.5, -11.5, -5.5, hole, 0.3), pool(*hole, 0.3, lod))
    z = front_line(11)
    g.add(low_wall((-7.5, 0, z), (-2.3, 0, z), 0.9, 'stucco_coral', lod))
    g.add(low_wall((-1.2, 0, z), (2.6, 0, z), 0.9, 'stucco_coral', lod))
    return g

