"""2D curve helpers: smooth profiles through key points, and polylines with rounded corners."""

import math


def pchip(keys):
    """Monotone cubic through (x, y) keys: smooth, and never overshoots between keys,
    so a roof line stays flat where its keys are flat. Clamped outside the keys."""
    xs = [k[0] for k in keys]
    ys = [k[1] for k in keys]
    n = len(xs)
    h = [xs[i + 1] - xs[i] for i in range(n - 1)]
    d = [(ys[i + 1] - ys[i]) / h[i] for i in range(n - 1)]
    m = [d[0]] + [0.0] * (n - 2) + [d[-1]]
    for i in range(1, n - 1):
        if d[i - 1] * d[i] > 0:
            w1, w2 = 2 * h[i] + h[i - 1], h[i] + 2 * h[i - 1]
            m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i])

    def f(x):
        if x <= xs[0]:
            return ys[0]
        if x >= xs[-1]:
            return ys[-1]
        i = max(k for k in range(n - 1) if xs[k] <= x)
        t = (x - xs[i]) / h[i]
        t2, t3 = t * t, t * t * t
        return ((2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h[i] * m[i]
                + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h[i] * m[i + 1])

    return f


def _arc(a, p, b, r, segs):
    """segs + 1 points rounding corner p between a and b with radius r (clamped)."""
    ux, uy = a[0] - p[0], a[1] - p[1]
    vx, vy = b[0] - p[0], b[1] - p[1]
    la, lb = math.hypot(ux, uy), math.hypot(vx, vy)
    if la < 1e-6 or lb < 1e-6 or r <= 0 or segs == 0:
        return [p] * (segs + 1)
    ux, uy, vx, vy = ux / la, uy / la, vx / lb, vy / lb
    theta = math.acos(max(-1.0, min(1.0, ux * vx + uy * vy)))
    if theta > math.pi - 1e-3:
        return [p] * (segs + 1)
    t = min(r / math.tan(theta / 2), 0.45 * min(la, lb))
    s = (p[0] + ux * t, p[1] + uy * t)
    e = (p[0] + vx * t, p[1] + vy * t)
    bx, by = ux + vx, uy + vy
    bl = math.hypot(bx, by)
    dist = t / math.cos(theta / 2)
    c = (p[0] + bx / bl * dist, p[1] + by / bl * dist)
    a0 = math.atan2(s[1] - c[1], s[0] - c[0])
    a1 = math.atan2(e[1] - c[1], e[0] - c[0])
    da = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
    rr = math.hypot(s[0] - c[0], s[1] - c[1])
    return [(c[0] + rr * math.cos(a0 + da * k / segs), c[1] + rr * math.sin(a0 + da * k / segs))
            for k in range(segs + 1)]


def rounded(points, radii, segs):
    """A polyline whose inner corners are rounded. Returns (points, tags): each output point
    is tagged with the index of the input corner it came from, so faces between points can
    be told apart (a corner's arc, or the straight run between two corners)."""
    out, tags = [points[0]], [0]
    for i in range(1, len(points) - 1):
        arc = _arc(points[i - 1], points[i], points[i + 1], radii[i], segs[i])
        out += arc
        tags += [i] * len(arc)
    out.append(points[-1])
    tags.append(len(points) - 1)
    return out, tags
