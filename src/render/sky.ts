import * as THREE from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import type { Quality } from '../settings'
import { acesFilmic, horizonColor, sunDirection } from './sky-analysis'

const HDRI_URL = '/assets/hdri/day_kloofendal_2k.hdr'
// Far enough up the sun ray that 200 m towers sit inside the shadow camera's depth range.
const SUN_DISTANCE = 400
const SHADOW_EXTENT = 70
const FOG_DENSITY = 0.0016
// Underwater: blue-green murk that hides everything past about 50 m.
const WATER_FOG = new THREE.Color(0x0e5f6a)
const WATER_DENSITY = 0.07

/** Daylight: HDRI sky and image-based lighting, a matching shadow-casting sun, and haze. */
export class Sky {
  readonly sun = new THREE.DirectionalLight(0xffe6c8, 4)
  /** Filled in by load(); shared by reference with the water shader. */
  readonly sunDir = new THREE.Vector3(0.4, 0.8, 0.3).normalize()
  /** Linear fog color; equals the backdrop below the horizon. */
  private readonly fogColor = new THREE.Color()
  private quality: Quality = 'high'
  private fog: THREE.FogExp2 | null = null
  private backdrop: THREE.Texture | null = null
  private underwater = false

  constructor(private readonly scene: THREE.Scene) {
    const cam = this.sun.shadow.camera
    cam.left = cam.bottom = -SHADOW_EXTENT
    cam.right = cam.top = SHADOW_EXTENT
    cam.near = 1
    cam.far = SUN_DISTANCE * 2
    this.sun.castShadow = true
    // Depth bias scales with the 800 m depth range: -0.0001 is about 8 cm.
    this.sun.shadow.bias = -0.0001
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
    const [r, g, b] = horizonColor(pixels, width, height)
    const fog = new THREE.Color(r, g, b).multiplyScalar(0.85)
    // Water past camera.far is clipped, so below the horizon the visible backdrop must
    // match fully fogged sea exactly; the sunlit ground below is for lighting only.
    const backdrop = hdr.clone()
    const backdropData = data.slice()
    paintLowerHalf(backdropData, width, height, fog.toArray())
    backdrop.source = new THREE.TextureSource({ data: backdropData, width, height })
    backdrop.needsUpdate = true
    paintLowerHalf(data, width, height, [r * 0.8, g * 0.74, b * 0.64])
    this.backdrop = backdrop
    this.scene.environment = hdr
    this.scene.environmentIntensity = 0.9
    this.fogColor.copy(fog)
    this.fog = new THREE.FogExp2(fog.clone(), FOG_DENSITY)
    this.scene.fog = this.fog
    this.applyFogColor()
  }

  setQuality(q: Quality): void {
    const size = q === 'high' ? 4096 : 1024
    this.sun.shadow.mapSize.set(size, size)
    this.sun.shadow.radius = q === 'high' ? 4 : 2
    this.sun.shadow.map?.dispose()
    this.sun.shadow.map = null
    this.quality = q
    this.applyFogColor()
  }

  /** Mutates the one fog rather than swapping it: materials keep their compiled fog uniforms. */
  setUnderwater(on: boolean): void {
    if (on === this.underwater) return
    this.underwater = on
    this.applyFogColor()
  }

  /**
   * Low renders straight to the screen, where three mixes fog in after tone mapping
   * while the backdrop is tone mapped. Give the fog the tone-mapped color there so
   * fully fogged sea still meets the backdrop without a band.
   */
  private applyFogColor(): void {
    const fog = this.fog
    if (!fog) return
    const color = this.underwater ? WATER_FOG : this.fogColor
    if (this.quality === 'high') fog.color.copy(color)
    else fog.color.fromArray(acesFilmic(color.toArray()))
    fog.density = this.underwater ? WATER_DENSITY : FOG_DENSITY
    // Underwater the backdrop is the fog color itself, so everything fades into it.
    this.scene.background = this.underwater ? fog.color : this.backdrop
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

/**
 * A "puresky" HDRI is nearly black below the horizon, which leaves every wall
 * facing away from the sun unlit. Painting the lower half as sunlit pale ground
 * gives image-based lighting the bounce light a bright city really has.
 */
function paintLowerHalf(data: Uint16Array, width: number, height: number, rgb: number[]): void {
  const half = rgb.map((v) => THREE.DataUtils.toHalfFloat(v))
  for (let y = Math.ceil(height / 2); y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      data[i] = half[0]
      data[i + 1] = half[1]
      data[i + 2] = half[2]
    }
  }
}

function halfToFloat(data: Uint16Array): Float32Array {
  const out = new Float32Array(data.length)
  for (let i = 0; i < data.length; i++) out[i] = THREE.DataUtils.fromHalfFloat(data[i])
  return out
}
