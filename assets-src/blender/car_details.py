"""Everything laid on or bolted to the shell: lamps, grille, plates, handles, mirrors,
exhausts, and the police light bar and lettering. Lamps are built for the car's left
side and mirrored, so both sides always match."""

from mathutils import Vector

from lib.drape import disc, grid, place, text
from lib.geo import Geo, box, cyl, merge, tube


def lamp(surf, side, at, d, mats, offset=0.005, segs=24):
    g = disc(d['a'], d['b'], mats, n=d.get('n', 3.0), segs=segs, skew=d.get('skew', 0.0),
             tilt=d.get('tilt', 0.0))
    return place(g, surf, side, at, offset)


def heads(sp, surf, lod):
    """Headlamps (lens in a dark bezel) and amber indicators."""
    d = sp['head']
    at = (d['x'], d['y'], 0)
    rings = ['light_head', 'trim_black'] if lod else ['light_head', 'light_head', 'trim_black']
    g = lamp(surf, 'front', at, d, rings, segs=12 if lod else 28)
    if 'ind' in sp:
        i = sp['ind']
        g.add(lamp(surf, 'front', (i['x'], i['y'], 0), i, ['light_indicator'], 0.006, 12))
    return g.mirror_x()


def tails(sp, surf, lod):
    d = sp['tail']
    at = (d['x'], d['y'], 0)
    rings = ['light_tail'] * 2 + ['trim_black']
    g = lamp(surf, 'rear', at, d, rings[1:] if lod else rings, segs=12 if lod else 28)
    if not lod and 'reverse' in d:
        r = d['reverse']
        g.add(lamp(surf, 'rear', (r['x'], r['y'], 0), r, ['light_reverse'], 0.008, 12))
    g.mirror_x()
    if 'bar' in d:
        b = d['bar']
        g.add(lamp(surf, 'rear', (0, b['y'], 0), b, ['light_tail'], 0.005, 24))
    return g


def grille(sp, surf, lod):
    d = sp['grille']
    g = lamp(surf, 'front', (0, d['y'], 0), d, ['grille'] * 2 + [d.get('rim', 'chrome')],
             0.004, 16 if lod else 32)
    if not lod:
        for k in range(d.get('slats', 0)):
            y = d['y'] - d['b'] * 0.6 + d['b'] * 1.2 * k / max(1, d['slats'] - 1)
            g.add(place(grid(d['a'] * 1.7, 0.012, 12, 1, 'chrome'), surf, 'front', (0, y, 0), 0.01))
    return g


def patches(sp, surf, lod):
    """Flat-coloured panels: intakes, diffusers, vents, cladding; mirrored when off-centre."""
    g = Geo()
    for p in sp.get('patches', ()):
        at = (p.get('x', 0.0), p['y'], p.get('z', 0.0))
        one = lamp(surf, p['side'], at, p, p['mats'], p.get('offset', 0.004), 12 if lod else 24)
        g.add(one.mirror_x() if p.get('x') else one)
    return g


def plates(sp, surf):
    g = Geo()
    for side, y in (('front', sp['plate'][0]), ('rear', sp['plate'][1])):
        if y is not None:
            g.add(place(grid(0.52, 0.115, 6, 1, 'plate'), surf, side, (0, y, 0), 0.008))
    return g


def handles(sp, surf):
    g = Geo()
    for z in sp['handles']:
        h = grid(0.15, 0.028, 4, 1, sp.get('handle_mat', 'chrome'))
        g.add(place(h, surf, 'left', (0, sp['handle_y'], z), 0.01))
    return g.mirror_x()


def mirrors(sp, surf):
    """Door mirrors on short stalks, housing in paint, glass on the back."""
    m = sp['mirror']
    h = surf.hit(Vector((3, m['y'], m['z'])), Vector((-1, 0, 0)))
    x = h[0].x if h else sp['plan'][0][1]
    housing = box(0.19, 0.11, 0.09, 'paint', bevel=0.03, segs=2).move(x + 0.11, m['y'] + 0.04,
                                                                      m['z'])
    glass = box(0.16, 0.085, 0.01, 'chrome').move(x + 0.11, m['y'] + 0.04, m['z'] - 0.046)
    stalk = box(0.06, 0.03, 0.05, 'trim_black').move(x + 0.02, m['y'] + 0.01, m['z'])
    return merge(housing, glass, stalk).mirror_x()


def exhausts(sp):
    g = Geo()
    for x in sp.get('exhaust', ()):
        pipe = cyl(0.04, 0.2, 14, 'chrome').rot((1, 0, 0), 90)
        g.add(pipe.move(x, sp['exhaust_y'], sp['rear'] - 0.05))
    return g


def lightbar(sp, lod):
    """Roof bar: red on the driver's (left) half, blue on the right, on two feet."""
    lb = sp['lightbar']
    w, y, z = lb['w'], lb['y'], lb['z']
    g = box(w, 0.035, 0.3, 'trim_black', bevel=0.01, segs=1).move(0, y + 0.0175, z)
    for s, mat in ((1, 'lightbar_red'), (-1, 'lightbar_blue')):
        lens = box(w / 2 - 0.03, 0.08, 0.26, mat, bevel=0 if lod else 0.02)
        g.add(lens.move(s * (w / 4 + 0.005), y + 0.075, z))
    for s in (1, -1):
        g.add(box(0.06, 0.06, 0.1, 'trim_black').move(s * w * 0.42, y - 0.025, z))
    return g


def push_bar(sp):
    pb = sp['push_bar']
    z, y0, y1, x = pb['z'], pb['y0'], pb['y1'], pb['x']
    g = Geo()
    for s in (1, -1):
        g.add(tube([(s * x, y0, z - 0.12), (s * x, y0, z), (s * x, y1, z)], 0.025, 8, 'trim_black'))
    for y in (y0 + 0.05, y1 - 0.03):
        g.add(tube([(-x - 0.03, y, z), (x + 0.03, y, z)], 0.02, 8, 'trim_black'))
    return g


def lettering(sp, surf):
    """Door lettering, laid on both front doors."""
    lt = sp['lettering']
    g = place(text(lt['text'], lt['size'], 'trim_black'), surf, 'left', (0, lt['y'], lt['z']),
              0.006)
    g.add(place(text(lt['text'], lt['size'], 'trim_black'), surf, 'right',
                (0, lt['y'], lt['z']), 0.006))
    return g


def rails(sp):
    """Roof rails: a bar each side on two feet."""
    r = sp['rails']
    g = Geo()
    for z in (r['z0'], r['z1']):
        g.add(box(0.05, r['h'], 0.12, 'trim_black').move(r['x'], r['y'] + r['h'] / 2, z))
    g.add(tube([(r['x'], r['y'] + r['h'], r['z0'] - 0.05), (r['x'], r['y'] + r['h'], r['z1'] + 0.05)],
               0.022, 8, 'trim_black'))
    return g.mirror_x()
