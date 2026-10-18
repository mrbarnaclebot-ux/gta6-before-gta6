"""Two-wheelers for the kerbside: a city bike and a Vespa-style scooter. Standing on
y = 0 (the scooter on its stand, the bike upright), centred between the axles, front +z."""

from lib.geo import Geo, box, cyl, sphere, torus, tube


def spoked(r, tyre, spokes):
    """A wheel in the yz plane (axle along x): tyre, rim, hub, and straight spokes."""
    g = torus(r - tyre, tyre, 20, 5, 'rubber')
    g.add(torus(r - tyre * 2.2, tyre * 0.45, 20, 3, 'metal_light'))
    g.add(cyl(0.025, 0.1, 8, 'metal_light').move(0, -0.05, 0))
    for k in range(spokes):
        g.add(box(2 * (r - tyre * 2.2), 0.006, 0.004, 'metal_light').rot((0, 1, 0), 180 * k / spokes))
    return g.rot((0, 0, 1), 90)


def bike():
    """City bike, 1.75 m long: diamond frame, upright bars, a sprung saddle."""
    rear, bb, seat = (0, 0.34, -0.53), (0, 0.3, -0.02), (0, 0.82, -0.2)
    head_t, head_b, front = (0, 0.95, 0.38), (0, 0.8, 0.42), (0, 0.34, 0.52)
    g = Geo()
    for a, b in ((bb, seat), (seat, head_t), (bb, head_b), (head_t, head_b)):
        g.add(tube([a, b], 0.018, 6, 'bike_paint'))
    for s in (-0.05, 0.05):
        g.add(tube([(s, *bb[1:]), (s, *rear[1:])], 0.012, 5, 'bike_paint'))
        g.add(tube([(s, *seat[1:]), (s, *rear[1:])], 0.012, 5, 'bike_paint'))
        g.add(tube([(s * 0.8, *head_b[1:]), (s, *front[1:])], 0.014, 5, 'bike_paint'))
    g.add(tube([head_t, (0, 1.03, 0.33)], 0.014, 6, 'metal_light'))
    g.add(tube([(-0.28, 1.05, 0.28), (-0.2, 1.04, 0.33), (0.2, 1.04, 0.33), (0.28, 1.05, 0.28)],
               0.011, 5, 'metal_light'))
    for s in (-1, 1):
        g.add(tube([(s * 0.2, 1.05, 0.29), (s * 0.3, 1.05, 0.27)], 0.017, 6, 'rubber'))
    g.add(tube([seat, (0, 0.95, -0.24)], 0.013, 6, 'metal_light'))
    g.add(box(0.16, 0.06, 0.26, 'seat_leather', bevel=0.025, segs=2).move(0, 0.99, -0.24))
    g.add(cyl(0.1, 0.008, 18, 'metal_light').rot((0, 0, 1), 90).move(0.06, *bb[1:]))
    for s in (-1, 1):
        g.add(box(0.02, 0.17, 0.025, 'metal_dark').move(s * 0.09, bb[1] - 0.08 * s, bb[2]))
        g.add(box(0.09, 0.02, 0.06, 'rubber').move(s * 0.13, bb[1] - 0.17 * s, bb[2]))
    for p in (rear, front):
        g.add(spoked(0.34, 0.022, 8).move(*p))
    g.add(box(0.06, 0.02, 0.3, 'bike_paint').move(0, 0.69, -0.55))
    return g


def scooter():
    """Vespa-style scooter, 1.8 m long: steel monocoque, leg shield, 10 inch wheels."""
    paint = 'scooter_paint'
    g = sphere(1.0, 14, 8, paint).scale(0.2, 0.2, 0.42).move(0, 0.48, -0.4)
    g.add(box(0.36, 0.05, 0.62, 'rubber').move(0, 0.27, 0.12))
    g.add(box(0.36, 0.1, 0.66, paint, bevel=0.03, segs=2).move(0, 0.22, 0.1))
    shield = box(0.42, 0.72, 0.06, paint, bevel=0.025, segs=2).rot((1, 0, 0), -12)
    g.add(shield.move(0, 0.62, 0.44))
    g.add(tube([(0, 0.3, 0.58), (0, 0.98, 0.47)], 0.03, 8, 'metal_dark'))
    g.add(box(0.5, 0.07, 0.12, paint, bevel=0.03, segs=2).move(0, 1.02, 0.46))
    g.add(cyl(0.065, 0.04, 16, 'light_head').rot((1, 0, 0), 90).move(0, 1.02, 0.52))
    for s in (-1, 1):
        g.add(tube([(s * 0.25, 1.02, 0.45), (s * 0.34, 1.02, 0.43)], 0.018, 6, 'rubber'))
        g.add(tube([(s * 0.2, 1.05, 0.44), (s * 0.27, 1.2, 0.4)], 0.006, 4, 'metal_light'))
        g.add(cyl(0.04, 0.01, 10, 'metal_light').rot((1, 0, 0), 90).move(s * 0.27, 1.22, 0.4))
    g.add(sphere(1.0, 14, 6, paint).scale(0.1, 0.09, 0.22).move(0, 0.33, 0.6))
    g.add(box(0.3, 0.1, 0.62, 'seat_leather', bevel=0.04, segs=2).move(0, 0.74, -0.3))
    g.add(box(0.12, 0.05, 0.03, 'light_tail').move(0, 0.6, -0.81))
    for z in (0.6, -0.6):
        g.add(torus(0.15, 0.05, 16, 5, 'rubber').rot((0, 0, 1), 90).move(0, 0.2, z))
        g.add(cyl(0.12, 0.09, 14, 'metal_light').rot((0, 0, 1), 90).move(0.045, 0.2, z))
    g.add(tube([(0.1, 0.2, -0.05), (0.18, 0.0, -0.1)], 0.012, 5, 'metal_dark'))
    return g

