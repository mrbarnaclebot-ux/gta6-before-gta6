import { planSeaData } from '../sea/sea-plan'
import { canopyGrid } from './canopy'
import { generateFlora } from './flora'
import { generateLand } from './plan'
import { splatGrid } from './splat'
import type { WorldPlan } from './world-plan'

/** All the pure world data, about a second of work: run in plan-worker.ts. */
export function makePlan(seed: number, size: number): WorldPlan {
  const land = generateLand(seed, size)
  const flora = generateFlora(land)
  const trees = [...flora.conifers, ...flora.broadleaf, ...flora.garden]
  const splat = splatGrid(land, canopyGrid(land.ground, trees))
  return { land, flora, sea: planSeaData(land), splat }
}
