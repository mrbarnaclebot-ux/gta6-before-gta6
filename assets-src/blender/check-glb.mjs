// Checks the Blender library after compression: every top-level node of each built GLB must
// keep its size (world bounds, so node transforms and Meshopt's moved scale are included)
// and its triangle count from source to public/assets. Run after compress-assets.mjs:
//   node assets-src/blender/check-glb.mjs
import { getBounds, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

// The sports car and cruiser are built but not shipped (compress-assets.mjs UNSHIPPED).
const FILES = [
  ...['sedan', 'suv', 'pickup', 'van'].map((c) => `vehicle/car_${c}.glb`),
  'houses/houses.glb',
  'props/street_kit.glb',
  'props/awnings.glb',
  'props/lifeguard_tower.glb',
]
// Meshopt quantizes positions to 16 bits; a centimetre is far more than that loses here.
const TOLERANCE = 0.01

await MeshoptDecoder.ready
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder })

function triangles(node) {
  let n = 0
  node.traverse((child) => {
    for (const prim of child.getMesh()?.listPrimitives() ?? []) {
      const index = prim.getIndices()
      n += (index ? index.getCount() : prim.getAttribute('POSITION').getCount()) / 3
    }
  })
  return n
}

async function roots(path) {
  const doc = await io.read(path)
  const out = new Map()
  for (const node of doc.getRoot().getDefaultScene().listChildren()) {
    const { min, max } = getBounds(node)
    out.set(node.getName(), { min, max, tris: triangles(node) })
  }
  return out
}

let failures = 0
for (const file of FILES) {
  const before = await roots(`assets-src/models/${file}`)
  const after = await roots(`public/assets/models/${file}`)
  for (const [name, src] of before) {
    const out = after.get(name)
    const drift = out
      ? Math.max(
          ...[0, 1, 2]
            .flatMap((i) => [src.min[i] - out.min[i], src.max[i] - out.max[i]])
            .map(Math.abs),
        )
      : Infinity
    const ok = drift <= TOLERANCE && out.tris === src.tris
    if (!ok) failures++
    const size = out ? out.max.map((v, i) => (v - out.min[i]).toFixed(2)).join(' x ') : 'missing'
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${file} ${name}: ${size} m, ${out?.tris ?? 0} tris`)
  }
}
if (failures) {
  console.error(`${failures} node(s) changed size or triangle count in compression`)
  process.exit(1)
}
