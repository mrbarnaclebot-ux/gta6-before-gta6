import * as THREE from 'three'
import { CSM } from 'three/examples/jsm/csm/CSM.js'
import { describe, expect, it } from 'vitest'
import { CSM_UNIFORMS, CsmMaterials, cascadeRanges } from './csm-materials'

const ranges = (v: THREE.Vector2[]) => v.map((r) => [r.x, r.y])

function csmFor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, maxFar: number, n = 3) {
  const csm = new CSM({ camera, parent: scene, cascades: n, maxFar, mode: 'practical' })
  csm.updateFrustums()
  return csm
}

describe('CSM materials', () => {
  it('turns breaks into the [start, end] pairs the shader reads', () => {
    expect(ranges(cascadeRanges([0.2, 0.5, 1]))).toEqual([
      [0, 0.2],
      [0.2, 0.5],
      [0.5, 1],
    ])
  })

  // three reuses a cached program without re-running onBeforeCompile, so the uniforms a
  // compiled program holds must follow a rebuilt CSM (a live Medium to High switch).
  it('keeps compiled uniforms in step with a rebuilt CSM', () => {
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 3000)
    const mat = new THREE.MeshStandardMaterial()
    scene.add(new THREE.Mesh(new THREE.BoxGeometry(), mat))
    const materials = new CsmMaterials()
    materials.use(csmFor(scene, camera, 100), scene)
    const shader = { uniforms: {} } as THREE.WebGLProgramParametersWithUniforms
    mat.onBeforeCompile(shader, {} as THREE.WebGLRenderer)
    const compiled = shader.uniforms as typeof CSM_UNIFORMS

    const high = csmFor(scene, camera, 150, 4)
    materials.use(high, scene)
    expect(mat.defines?.CSM_CASCADES).toBe(4)
    expect(compiled.shadowFar.value).toBe(150)
    expect(ranges(compiled.CSM_cascades.value)).toEqual(ranges(cascadeRanges(high.breaks)))

    materials.release()
    expect(mat.defines?.USE_CSM).toBeUndefined()
  })
})
