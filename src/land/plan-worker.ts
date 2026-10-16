import { generateFlora } from './flora'
import { generateLand } from './plan'

// The land plan and its flora are pure data: built here, posted back as a structured clone.
self.onmessage = (e: MessageEvent<{ seed: number; size: number }>) => {
  const land = generateLand(e.data.seed, e.data.size)
  self.postMessage({ land, flora: generateFlora(land) })
}
