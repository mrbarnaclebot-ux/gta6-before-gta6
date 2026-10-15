// n8ao ships no type definitions; this covers only what the renderer uses.
declare module 'n8ao' {
  import type { Pass } from 'postprocessing'
  import type { Camera, Scene } from 'three'

  export class N8AOPostPass extends Pass {
    constructor(scene: Scene, camera: Camera, width?: number, height?: number)
    configuration: {
      aoRadius: number
      distanceFalloff: number
      intensity: number
      halfRes: boolean
      gammaCorrection: boolean
    }
    setQualityMode(mode: 'Performance' | 'Low' | 'Medium' | 'High' | 'Ultra'): void
  }
}
