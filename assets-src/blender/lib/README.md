# lib

Helpers shared by every asset family. Builders work on `Geo` (plain vertex, face, and material-name lists in game axes) and only `scene.py` turns them into Blender objects.

- `geo.py` the `Geo` type and primitives: box, hexa, lathe, cylinder, sphere, torus, loft, sweep, tube, prism, extrude along x, bevel, weld, subset
- `curve.py` monotone cubic profiles through key points, polylines with rounded corners (car sections)
- `drape.py` details drawn flat and shot onto a curved surface (lamps, grilles, lettering), superellipse discs, grids, text
- `mats.py` glTF-safe Principled materials, declared by name and built on first use
- `textures.py` tileable numpy textures: stucco normal, clay barrel tiles, standing seams
- `scene.py` Geo to Blender objects (axes, box and slope UVs, smoothing), node trees, booleans, splitting by material, bounds and triangle counts
- `export.py` GLB export of node trees and the STATS lines
- `preview.py` Eevee preview renders and the side-by-side preview sheets
