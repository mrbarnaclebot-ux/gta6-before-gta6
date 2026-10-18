"""Three of the six houses: ranch, Mediterranean, modern. Local space: the main block's
footprint centred on the origin, ground at y = 0, front (street side) towards +z, the
garage door centred at x = w / 2 - 2.2 (where the game's driveway meets the house)."""

from house_parts import arch_window, column, door, garage, openings, walls, window
from house_roofs import deck_around, flat, hip, pool, railing, shed, steps
from lib.geo import box


def win(w, h, style='trim', panes=None):
    return lambda lod: window(w, h, style, lod, panes)


def ranch(lod):
    """Single-storey ranch: tile hip roof, shuttered windows, a column porch, one garage."""
    W, D, H = 14, 10, 3.0
    g = walls(-7, 7, -5, 5, H, 'stucco_cream')
    g.add(hip(W, D, H + 0.22, 0.45, 0.6, 'roof_tile'))
    g.add(openings([
        ('front', -4.7, 0.95, win(1.6, 1.4, 'shutter')),
        ('front', -1.2, 0.15, lambda l: door(1.0, 2.2, 'panel', l)),
        ('front', 1.2, 0.95, win(1.1, 1.4, 'shutter')),
        ('front', 4.8, 0.0, lambda l: garage(2.7, 2.3, l)),
        ('left', -2.6, 1.0, win(1.0, 1.2)), ('right', 2.0, 1.0, win(1.4, 1.3)),
        ('right', -2.2, 1.0, win(1.4, 1.3)),
        ('rear', -4.5, 1.0, win(1.4, 1.3)), ('rear', 0.0, 0.15, lambda l: door(2.4, 2.2, 'glass', l)),
        ('rear', 4.4, 1.2, win(0.9, 1.0)),
    ], 0, 0, W, D, lod))
    g.add(box(4.9, 0.45, 2.4, 'concrete').move(-1.0, -0.075, 6.2))
    for x in (-3.2, 1.2):
        g.add(column(x, 7.1, 2.75, lod=lod))
    g.add(shed(-3.6, 1.6, 5.0, 7.5, 3.0, 2.75, 'roof_tile'))
    return g


def mediterranean(lod):
    """Two storeys under tile: an entry tower with arched door, a balustraded balcony."""
    W, D, H = 13, 10, 6.0
    g = walls(-6.5, 6.5, -5, 5, H, 'stucco_sand')
    g.add(walls(-2.2, 0.8, 5, 6.2, H + 0.6, 'stucco_sand'))
    g.add(hip(W, D, H + 0.22, 0.42, 0.55, 'roof_tile'))
    g.add(hip(3.0, 1.2, H + 0.82, 0.7, 0.35, 'roof_tile').move(-0.7, 0, 5.6))
    g.add(openings([
        ('front', -0.7, 0.15, lambda l: arch_door(l)),
        ('front', -0.7, 3.6, lambda l: arch_window(1.0, 1.3, l)),
    ], -0.7, 5.6, 3.0, 1.2, lod))
    g.add(openings([
        ('front', -4.4, 0.9, lambda l: arch_window(1.2, 1.4, l)),
        ('front', 4.3, 0.0, lambda l: garage(2.7, 2.3, l)),
        ('front', -4.4, 3.15, lambda l: door(1.6, 2.2, 'glass', l)),
        ('front', 2.3, 3.8, win(1.0, 1.3)), ('front', 4.5, 3.8, win(1.0, 1.3)),
        ('left', 1.5, 1.0, win(1.2, 1.3)), ('left', 1.5, 3.8, win(1.2, 1.3)),
        ('left', -2.5, 3.8, win(1.2, 1.3)),
        ('right', 2.0, 1.0, win(1.4, 1.3)), ('right', -2.0, 3.8, win(1.4, 1.3)),
        ('rear', -3.5, 0.15, lambda l: door(2.4, 2.2, 'glass', l)), ('rear', 2.5, 1.0, win(1.4, 1.3)),
        ('rear', -3.5, 3.8, win(1.4, 1.3)), ('rear', 2.5, 3.8, win(1.4, 1.3)),
    ], 0, 0, W, D, lod))
    g.add(box(4.0, 0.2, 1.4, 'concrete').move(-4.4, 3.0, 5.7))
    for x0, x1, z0, z1 in ((-6.3, -2.5, 6.3, 6.3), (-6.3, -6.3, 5.0, 6.3)):
        g.add(railing((x0, 3.1, z0), (x1, 3.1, z1), 0.95, 'baluster', lod))
    g.add(steps(-0.7, 6.2, 2.0, 0.15, 1))
    return g


def arch_door(lod):
    """Double doors under a half-round fanlight."""
    return door(1.8, 2.3, 'double', lod).add(arch_window(1.8, 0.01, lod).move(0, 2.35, 0))


def modern(lod):
    """Flat-roofed white boxes: the upper floor cantilevers over a glazed ground floor;
    a raised deck and pool behind."""
    g = walls(-6.5, 2.6, -5.5, 4.5, 3.2, 'stucco_white')
    g.add(walls(2.6, 6.5, -5.5, 5.5, 3.2, 'stucco_grey'))
    g.add(walls(-6.5, 6.5, -4.5, 5.5, 6.4, 'stucco_white', y0=3.2))
    g.add(flat(-6.5, 6.5, -4.5, 5.5, 6.4, 0.35, 'stucco_white', lod))
    g.add(flat(-6.5, 6.5, -5.5, -4.5, 3.2, 0.1, 'stucco_grey', lod))
    g.add(openings([('front', 0.0, 0.15, win(8.4, 2.7, 'dark', 6)),
                    ('rear', 0.0, 0.15, win(8.0, 2.6, 'dark', 5))], -1.95, -0.5, 9.1, 10, lod))
    g.add(openings([('front', 4.3 - 4.55, 0.0, lambda l: garage(2.6, 2.4, l))], 4.55, 0, 3.9, 11, lod))
    g.add(openings([
        ('front', -1.6, 4.0, win(8.6, 1.5, 'dark', 6)),
        ('rear', 0.0, 4.0, win(10.0, 1.6, 'dark', 6)),
        ('left', 0.5, 4.2, win(2.4, 1.3, 'dark')), ('right', 0.5, 4.2, win(2.4, 1.3, 'dark')),
    ], 0, 0.5, 13, 10, lod))
    if not lod:
        for k in range(14):
            g.add(box(0.06, 2.8, 0.08, 'wood').move(3.0 + k * 0.24, 4.85, 5.56))
    hole = (-1.0, -8.6, 7.5, 3.4)
    g.add(deck_around(-6.5, 6.5, -11.0, -5.5, hole, 0.3))
    g.add(pool(*hole, 0.3, lod))
    g.add(railing((-6.3, 3.3, -5.4), (6.3, 3.3, -5.4), 1.0, 'glass', lod))
    return g
