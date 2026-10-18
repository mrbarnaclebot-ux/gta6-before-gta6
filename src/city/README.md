# city

Pure, seeded city plan: plain data, no three.js or physics. `src/world` turns it into meshes and colliders.

- `layout.ts` entry point `generateCity(seed, size)`: the street network, its faces sorted into blocks (with districts, parks, and lots), walks, and traffic islands, the canal and its bridges, medians, junction plans, driveways, greenery, and the spawn; `lawnsOf` lists every lawn
- `street-plan.ts` the hand-drawn streets on a broken grid: uneven spacing, a downtown superblock, short streets, Hill Road and Palm Avenue in from the west, Central Avenue, the diagonal boulevard, the curving coast road, the beachfront alley, the canal, and the city's edge
- `streets.ts` what each street kind is like across (half width, sidewalk, curb radius, speed) and the avenue and street lane layouts
- `network.ts` the planar graph: street lines cut into segments at junctions, and the faces they enclose
- `faces.ts` a face's curb line (rounded corners) and lot line from its sides' centerlines
- `polygon.ts` ring helpers: area, containment, inset, clipping, rect fitting
- `junctions.ts` traffic control per junction (lights, all-way stop, none), each street's mouth, signal phases, and where crosswalks and stop bars sit
- `medians.ts` the planted avenue medians, stopping short of turn bays and humps
- `curbs.ts` a face's curb broken into runs along each street; lamps, palms, furniture, and driveways are placed along them
- `lots.ts`, `cells.ts`, `massing.ts` what stands on a lot: cells set back from the street and fitted to cut lots, gardens, plazas, parking lots, beachfront hotels with pool decks; then heights, corner towers, podiums with towers, and neighbours that never match
- `parking.ts` curbside bays in the streets' parking lanes and cars in the lots and drives; `parking-lots.ts` lot bays, their paint, and driveways
- `promenade.ts` the lawn strips where the beach promenade widens
- `signal-posts.ts` where mast-arm traffic signals and stop signs stand
- `canal-bridge.ts` the humped street bridges over the canal: which streets, and their rise
- `greenery.ts` palm, bush, and streetlight spots on sidewalks, medians, islands, plazas, lawns, and sand
- `terrain.ts` ground, water, and walkable surface heights (sidewalks, lawns, and roads found through a grid index)
- `furniture.ts` street furniture spots along the curb runs; `shops.ts` ground-floor shop slots facing streets
- `rng.ts` seeded random numbers (Mulberry32) and pick/range helpers
- `*.test.ts` determinism and layout invariants: buildings on their lots and off every road, sidewalk, median, and the canal
