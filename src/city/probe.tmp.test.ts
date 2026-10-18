import { it } from 'vitest'
import { generateCity } from './layout'
import { area, bounds, centroid } from './polygon'
it('probe', () => {
  const c = generateCity(7, 1000)
  const pl = c.blocks.flatMap((b) => b.plazas.map((p) => ({ d: b.district, a: area(p), c: centroid(p) }))).sort((a, b) => b.a - a.a)
  console.log('plazas', pl.filter(p=>p.d!=='beachfront').slice(0, 5).map((p) => `${p.d} ${p.a.toFixed(0)} ${p.c.x.toFixed(0)},${p.c.z.toFixed(0)}`).join(' | '))
  console.log('decks', pl.filter(p=>p.d==='beachfront').slice(0, 3).map((p) => `${p.a.toFixed(0)} ${p.c.x.toFixed(0)},${p.c.z.toFixed(0)}`).join(' | '))
  const lots = c.blocks.flatMap((b) => b.parking.map((p) => bounds(p)))
  console.log('lots', lots.slice(0, 5).map((r) => `${((r.x0+r.x1)/2).toFixed(0)},${((r.z0+r.z1)/2).toFixed(0)} ${(r.x1-r.x0).toFixed(0)}x${(r.z1-r.z0).toFixed(0)}`).join(' | '))
  console.log('islands', c.islands.map((f) => { const p = centroid(f.curb); return `${p.x.toFixed(0)},${p.z.toFixed(0)}` }).join(' | '))
})
