import * as THREE from 'three'
import type { CSM } from 'three/examples/jsm/csm/CSM.js'

type Lit = THREE.Material & { defines?: Record<string, unknown> }
type Saved = Pick<THREE.Material, 'onBeforeCompile' | 'customProgramCacheKey'>

function isLit(m: THREE.Material): m is Lit {
  const f = m as unknown as Record<string, boolean>
  return !!(
    f.isMeshStandardMaterial ||
    f.isMeshLambertMaterial ||
    f.isMeshPhongMaterial ||
    f.isMeshToonMaterial
  )
}

/**
 * Every lit material must be set up for cascaded shadows, or it would add up the light of
 * every cascade. CSM's own setup replaces onBeforeCompile; this keeps the material's own
 * patch (car paint, outfits) running first and its own program cache key.
 */
export class CsmMaterials {
  private readonly saved = new Map<Lit, Saved>()

  constructor(private readonly csm: CSM) {}

  /** Sets up any lit material in the scene not seen yet; cheap when there is nothing new. */
  adopt(scene: THREE.Object3D): void {
    scene.traverse((o) => {
      const mat = (o as THREE.Mesh).material
      if (!mat) return
      for (const m of Array.isArray(mat) ? mat : [mat]) {
        if (isLit(m) && !this.saved.has(m)) this.setup(m)
      }
    })
  }

  private setup(m: Lit): void {
    const own = {
      onBeforeCompile: m.onBeforeCompile,
      customProgramCacheKey: m.customProgramCacheKey,
    }
    const key = m.customProgramCacheKey()
    this.saved.set(m, own)
    this.csm.setupMaterial(m)
    const csmHook = m.onBeforeCompile
    m.onBeforeCompile = (shader, renderer) => {
      own.onBeforeCompile.call(m, shader, renderer)
      csmHook.call(m, shader, renderer)
    }
    m.customProgramCacheKey = () => key + '+csm'
    m.needsUpdate = true
  }

  /** Puts every material back as it was, for single-map shadows. */
  release(): void {
    for (const [m, own] of this.saved) {
      Object.assign(m, own)
      for (const d of ['USE_CSM', 'CSM_CASCADES', 'CSM_FADE']) delete m.defines?.[d]
      m.needsUpdate = true
    }
    this.saved.clear()
  }
}
