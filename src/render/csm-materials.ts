import * as THREE from 'three'
import type { CSM } from 'three/examples/jsm/csm/CSM.js'

type Lit = THREE.Material & { defines?: Record<string, unknown> }

function isLit(m: THREE.Material): m is Lit {
  const f = m as unknown as Record<string, boolean>
  return !!(
    f.isMeshStandardMaterial ||
    f.isMeshLambertMaterial ||
    f.isMeshPhongMaterial ||
    f.isMeshToonMaterial
  )
}

/** Cascade splits as the CSM shader reads them: [start, end] of each cascade, 0..1 of shadowFar. */
export function cascadeRanges(breaks: number[], out: THREE.Vector2[] = []): THREE.Vector2[] {
  out.length = breaks.length
  breaks.forEach((end, i) => (out[i] ??= new THREE.Vector2()).set(breaks[i - 1] ?? 0, end))
  return out
}

/**
 * The CSM uniforms every lit program reads. three reuses a material's compiled program, and
 * the uniforms it was compiled with, whenever the cache key matches, without calling
 * onBeforeCompile again; per-program uniforms from three's CSM.setupMaterial would stay tied
 * to the first CSM built. One shared set, refilled from the current CSM, cannot go stale.
 */
export const CSM_UNIFORMS = {
  CSM_cascades: { value: [] as THREE.Vector2[] },
  cameraNear: { value: 0.1 },
  shadowFar: { value: 0 },
}

const hooked = new WeakSet<THREE.Material>()

/** Hands every compile of `m` the shared CSM uniforms, after its own patch (car paint, outfits). */
function hook(m: Lit): void {
  if (hooked.has(m)) return
  hooked.add(m)
  const own = m.onBeforeCompile
  // The default key is the hook's source text, which the wrapper below would make the same for all.
  const key = m.customProgramCacheKey()
  m.onBeforeCompile = (shader, renderer) => {
    own.call(m, shader, renderer)
    Object.assign(shader.uniforms, CSM_UNIFORMS)
  }
  m.customProgramCacheKey = () => key
}

/**
 * Every lit material must be set up for cascaded shadows, or it would add up the light of
 * every cascade. The CSM defines pick the program (they are part of three's program key);
 * the uniforms are shared (see CSM_UNIFORMS).
 */
export class CsmMaterials {
  private readonly on = new Set<Lit>()
  private csm: CSM | null = null

  /** Sets up every lit material in the scene for `csm`. */
  use(csm: CSM, scene: THREE.Object3D): void {
    this.release()
    this.csm = csm
    this.adopt(scene)
    this.sync()
  }

  /** Sets up any lit material in the scene not seen yet; cheap when there is nothing new. */
  adopt(scene: THREE.Object3D): void {
    const csm = this.csm
    if (!csm) return
    scene.traverse((o) => {
      const mat = (o as THREE.Mesh).material
      if (!mat) return
      for (const m of Array.isArray(mat) ? mat : [mat]) {
        if (!isLit(m) || this.on.has(m)) continue
        hook(m)
        m.defines = { ...m.defines, USE_CSM: 1, CSM_CASCADES: csm.cascades }
        if (csm.fade) m.defines.CSM_FADE = ''
        m.needsUpdate = true
        this.on.add(m)
      }
    })
  }

  /** Copies the current CSM's splits and reach into the shared uniforms. */
  sync(): void {
    const csm = this.csm
    if (!csm) return
    const camera = csm.camera as THREE.PerspectiveCamera
    cascadeRanges(csm.breaks, CSM_UNIFORMS.CSM_cascades.value)
    CSM_UNIFORMS.cameraNear.value = camera.near
    CSM_UNIFORMS.shadowFar.value = Math.min(camera.far, csm.maxFar)
  }

  /** Takes every material off cascaded shadows, for single-map shadows. */
  release(): void {
    for (const m of this.on) {
      for (const d of ['USE_CSM', 'CSM_CASCADES', 'CSM_FADE']) delete m.defines?.[d]
      m.needsUpdate = true
    }
    this.on.clear()
    this.csm = null
  }
}
