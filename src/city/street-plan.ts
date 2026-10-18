import type { P2 } from '../land/polyline'
import type { Rect } from './layout'
import type { StreetLine } from './network'
import type { StreetKind } from './streets'

/*
 * The city's streets, drawn by hand on a broken grid. North-south and east-west streets
 * at uneven spacing make blocks of different sizes; one gap in a street makes a downtown
 * superblock; two short streets split blocks. Avenues: Hill Road and Palm Avenue run in
 * from the west (they continue outside the city), Central Avenue runs north to south, a
 * diagonal boulevard cuts from the south edge to the canal, and the coast road curves
 * along the beach. An alley runs behind the beachfront hotels. Coordinates are for a
 * 1000 m city and scale with `half`.
 */

/** Where the coast road bows inland from the beach line: 0 at the city's ends, about 40 m mid-city. */
export function coastBow(z: number, land: Rect, k: number): number {
  const t = (z - land.z0) / (land.z1 - land.z0)
  return 36 * k * Math.sin(Math.PI * t) ** 2 * (1 + 0.25 * Math.sin(2 * Math.PI * t))
}

/** East-west streets: z, kind, and x span (null runs to the coast road). */
type Cross = [z: number, kind: StreetKind, from: number | 'exit', to: number | null]
const CROSS: Cross[] = [
  [-500, 'street', -500, null],
  [-400, 'street', -500, null],
  [-300, 'avenue', 'exit', null],
  [-255, 'street', 100, 200],
  [-210, 'street', -500, null],
  [-120, 'street', -500, null],
  [0, 'street', -500, null],
  [50, 'street', -200, -110],
  [100, 'street', -500, null],
  [200, 'street', -500, null],
  [300, 'avenue', 'exit', null],
  [410, 'street', -500, null],
  [500, 'street', -500, null],
]

/** North-south streets: x, kind, and z spans. */
type Long = [x: number, kind: StreetKind, spans: [number, number][]]
const LONG: Long[] = [
  [-500, 'street', [[-500, 500]]],
  [
    -410,
    'street',
    [
      [-500, -120],
      [0, 500],
    ],
  ],
  [-300, 'street', [[-500, 500]]],
  [-200, 'avenue', [[-500, 500]]],
  [-110, 'street', [[-500, 500]]],
  [0, 'street', [[-500, 500]]],
  [100, 'street', [[-500, 500]]],
  [200, 'street', [[-500, 500]]],
  [255, 'alley', [[-500, 500]]],
]

/** The diagonal boulevard: from the south edge street to the canal-side street. */
const DIAGONAL: [P2, P2] = [
  { x: -450, z: 500 },
  { x: 0, z: 50 },
]

const line = (name: string, kind: StreetKind, pts: P2[]): StreetLine => ({ name, kind, pts })

/** The coast road's line: through the beach road's ends, bowing inland, with a vertex at every cross street. */
function coastRoad(land: Rect, beachX: number, k: number): P2[] {
  const zs = new Set<number>([land.z0, land.z1, ...CROSS.map((c) => c[0] * k)])
  for (let z = land.z0; z < land.z1; z += 8 * k) zs.add(z)
  return [...zs]
    .filter((z) => z >= land.z0 && z <= land.z1)
    .sort((a, b) => a - b)
    .map((z) => ({ x: beachX - coastBow(z, land, k), z }))
}

/** The four sides of the paved city, so faces stop at its edge. */
function edges(land: Rect): StreetLine[] {
  const c = [
    { x: land.x0, z: land.z0 },
    { x: land.x1, z: land.z0 },
    { x: land.x1, z: land.z1 },
    { x: land.x0, z: land.z1 },
  ]
  return c.map((p, i) => line(`edge ${i}`, 'edge', [p, c[(i + 1) % 4]]))
}

/** Every street line of the city, plus the canal and the outer edge. */
export function streetPlan(half: number, land: Rect, canal: Rect, beachX: number): StreetLine[] {
  const k = half / 500
  const coast = coastRoad(land, beachX, k)
  const coastX = (z: number) => coast.find((p) => Math.abs(p.z - z) < 1e-6)!.x
  const cross = CROSS.map(([z, kind, from, to]) =>
    line(`${kind} z ${z}`, kind, [
      { x: from === 'exit' ? land.x0 : from * k, z: z * k },
      { x: to === null ? coastX(z * k) : to * k, z: z * k },
    ]),
  )
  const long = LONG.flatMap(([x, kind, spans]) =>
    spans.map(([z0, z1]) =>
      line(`${kind} x ${x}`, kind, [
        { x: x * k, z: z0 * k },
        { x: x * k, z: z1 * k },
      ]),
    ),
  )
  const mid = (canal.x0 + canal.x1) / 2
  return [
    ...edges(land),
    line('canal', 'canal', [
      { x: mid, z: land.z0 },
      { x: mid, z: land.z1 },
    ]),
    line('coast road', 'avenue', coast),
    line(
      'diagonal',
      'avenue',
      DIAGONAL.map((p) => ({ x: p.x * k, z: p.z * k })),
    ),
    ...long,
    ...cross,
  ]
}
