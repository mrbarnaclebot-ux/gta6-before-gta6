import { makePlan } from './make-plan'

// Plain data only (typed arrays and objects), posted back as a structured clone.
self.onmessage = (e: MessageEvent<{ seed: number; size: number }>) => {
  self.postMessage(makePlan(e.data.seed, e.data.size))
}
