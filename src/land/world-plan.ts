import type { Flora } from './flora'
import type { Land } from './plan'
import type { SeaData } from '../sea/sea-plan'

// The city core is 1 km square; the land plan grows the world around it to about 2 x 2 km.
export const WORLD_SEED = 7
export const WORLD_SIZE = 1000

export interface WorldPlan {
  land: Land
  flora: Flora
  sea: SeaData
  /** Terrain splat inputs per grid vertex (splat.ts). */
  splat: Float32Array
}

let pending: Promise<WorldPlan> | null = null

/** Same plan on the main thread: for browsers where the worker fails. */
async function planHere(): Promise<WorldPlan> {
  const { makePlan } = await import('./make-plan')
  return makePlan(WORLD_SEED, WORLD_SIZE)
}

function planInWorker(): Promise<WorldPlan> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./plan-worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<WorldPlan>) => {
      worker.terminate()
      resolve(e.data)
    }
    worker.onerror = (e) => {
      worker.terminate()
      reject(e)
    }
    worker.postMessage({ seed: WORLD_SEED, size: WORLD_SIZE })
  })
}

/**
 * The seeded land plan and flora (about a second of work), generated once in a worker. The
 * title screen starts it so Play rarely waits; later calls get the same promise.
 */
export function planWorld(): Promise<WorldPlan> {
  pending ??= planInWorker().catch(planHere)
  return pending
}
