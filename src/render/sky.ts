import * as THREE from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import type { Quality } from '../settings'
import { horizonColor, sunDirection } from './sky-analysis'

const HDRI_URL = '/assets/hdri/day_kloofendal_2k.hdr'
const SUN_DISTANCE = 120
const SHADOW_EXTENT = 70

/** Daylight: HDRI sky and image-based lighting, a matching shadow-casting sun, and haze. */
export class Sky {
  readonly sun = new THREE.DirectionalLight(0xffe6c8, 4)
  private readonly sunDir = new THREE.Vector3(0.4, 0.8, 0.3).normalize()

  constructor(private readonly scene: THREE.Scene) {
    const cam = this.sun.shadow.camera
    cam.left = cam.bottom = -SHADOW_EXTENT
    cam.right = cam.top = SHADOW_EXTENT
    cam.near = 1
    cam.far = SUN_DISTANCE * 2.5
    this.sun.castShadow = true
    this.sun.shadow.bias = -0.0003
    this.sun.shadow.normalBias = 0.03
    scene.add(this.sun, this.sun.target)
  }

  async load(): Promise<void> {
    const hdr = await new HDRLoader().loadAsync(HDRI_URL)
    hdr.mapping = THREE.EquirectangularReflectionMapping
    const { data, width, height } = hdr.image as {
      data: Uint16Array
      width: number
      height: number
    }
    const pixels = halfToFloat(data)
    this.sunDir.fromArray(sunDirection(pixels, width, height))
    this.scene.background = hdr
    this.scene.environment = hdr
    this.scene.environmentIntensity = 0.65
    const [r, g, b] = horizonColor(pixels, width, height)
    this.scene.fog = new THREE.FogExp2(new THREE.Color(r, g, b).multiplyScalar(0.85), 0.0038)
  }

  setQuality(q: Quality): void {
    const size = q === 'high' ? 4096 : 1024
    this.sun.shadow.mapSize.set(size, size)
    this.sun.shadow.radius = q === 'high' ? 4 : 2
    this.sun.shadow.map?.dispose()
    this.sun.shadow.map = null
  }

  /** Keep the shadow frustum centered on the player so shadows stay sharp near them. */
  follow(focus: THREE.Vector3): void {
    // Snap to shadow texels so shadow edges do not shimmer while walking.
    const texel = (SHADOW_EXTENT * 2) / this.sun.shadow.mapSize.x
    const x = Math.round(focus.x / texel) * texel
    const z = Math.round(focus.z / texel) * texel
    this.sun.target.position.set(x, 0, z)
    this.sun.position.set(x, 0, z).addScaledVector(this.sunDir, SUN_DISTANCE)
  }
}

function halfToFloat(data: Uint16Array): Float32Array {
  const out = new Float32Array(data.length)
  for (let i = 0; i < data.length; i++) out[i] = THREE.DataUtils.fromHalfFloat(data[i])
  return out
}
