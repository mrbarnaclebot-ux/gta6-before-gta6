import * as THREE from 'three'

/** Vertices per leaf card in the baked tree files: two triangles, not indexed. */
const CARD = 6

/**
 * Every `keep`-th leaf card, each grown about its center by `grow` so the crown keeps its
 * outline: the middle distance gets a fraction of the foliage triangles and overdraw.
 * Returns the geometry unchanged if it is not made of whole cards.
 */
export function thinCards(geo: THREE.BufferGeometry, keep = 2, grow = 1.35): THREE.BufferGeometry {
  const pos = geo.attributes.position
  if (geo.index || pos.count % CARD) return geo
  const cards = pos.count / CARD
  const kept = Math.ceil(cards / keep)
  const out = new THREE.BufferGeometry()
  for (const [name, a] of Object.entries(geo.attributes)) {
    const n = a.itemSize * CARD
    const data = new Float32Array(kept * n)
    for (let c = 0, k = 0; c < cards; c += keep, k++) {
      for (let v = 0; v < CARD; v++)
        for (let i = 0; i < a.itemSize; i++)
          data[k * n + v * a.itemSize + i] = a.getComponent(c * CARD + v, i)
    }
    out.setAttribute(name, new THREE.BufferAttribute(data, a.itemSize))
  }
  const p = out.attributes.position
  const center = new THREE.Vector3()
  const v = new THREE.Vector3()
  for (let k = 0; k < kept; k++) {
    center.set(0, 0, 0)
    for (let i = 0; i < CARD; i++) center.add(v.fromBufferAttribute(p, k * CARD + i))
    center.divideScalar(CARD)
    for (let i = 0; i < CARD; i++) {
      v.fromBufferAttribute(p, k * CARD + i)
        .sub(center)
        .multiplyScalar(grow)
        .add(center)
      p.setXYZ(k * CARD + i, v.x, v.y, v.z)
    }
  }
  return out
}
