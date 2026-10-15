import * as THREE from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import type { Quality } from '../settings'
import { lighting, SUN_POWER } from './daynight'
import { acesFilmic, horizonColor, sunDirection } from './sky-analysis'
import { skyDome, type DomeUniforms } from './sky-dome'

const DAY_URL = '/assets/hdri/day_kloofendal_2k.hdr'
const NIGHT_URL = '/assets/hdri/night_dikhololo_1k.hdr'
// Far enough up the sun ray that 200 m towers sit inside the shadow camera's depth range.
const SUN_DISTANCE = 400
const SHADOW_EXTENT = 70
const FOG_DENSITY = 0.0016
// Underwater: blue-green murk that hides everything past about 50 m.
const WATER_FOG = new THREE.Color(0x0e5f6a)
const WATER_DENSITY = 0.07
const WATER_DARK = new THREE.Color()
// Night: a haze lit violet by the city.
const NIGHT_FOG = new THREE.Color(0.016, 0.018, 0.045)
const DUSK = new THREE.Color(1.0, 0.36, 0.12)
const DUSK_FOG = DUSK.clone().multiplyScalar(0.35)
// At sunset the day sky dims and blushes, and a warm fill stands in for the pink sky light.
const DUSK_SKY = new THREE.Color(1.0, 0.62, 0.6)
const DUSK_FILL = {
  sky: new THREE.Color(1.0, 0.55, 0.42),
  ground: new THREE.Color(0.32, 0.22, 0.36),
}
// The night HDRI glows orange at the horizon; city nights in the references read violet-blue.
const NIGHT_GRADE = [0.55, 0.5, 1.15]
const DAY_ENV = 0.9
const NIGHT_ENV = 0.6

/** What the rest of the world reads each frame to match the time of day. */
export interface Ambient {
  /** Toward the sun by day, the moon by night; shared by reference with the water shader. */
  readonly sunDir: THREE.Vector3
  /** That light's color, 1 for the noon sun, dimmer for the low sun and the moon: the water's glints. */
  readonly sunColor: THREE.Color
  /** 1 at full daylight, 0 at night. */
  day: number
  /** 0 by day, 1 once street lights and neon are on. */
  night: number
}

/** Sky, image-based light, a shadow-casting sun or moon, and haze, all driven by the time of day. */
export class Sky {
  readonly sun = new THREE.DirectionalLight(0xffe6c8, 4)
  /** Warm sky fill at dusk; always in the scene so it never forces a shader recompile. */
  private readonly fill = new THREE.HemisphereLight(DUSK_FILL.sky, DUSK_FILL.ground, 0)
  readonly ambient: Ambient = {
    sunDir: new THREE.Vector3(0.4, 0.8, 0.3).normalize(),
    sunColor: new THREE.Color(),
    day: 1,
    night: 0,
  }
  private readonly dome: { mesh: THREE.Mesh; uniforms: DomeUniforms }
  /** Linear fog color for the current time; the dome's color below the horizon. */
  private readonly fogColor = new THREE.Color()
  private dayFog = new THREE.Color()
  private quality: Quality = 'high'
  private fog: THREE.FogExp2 | null = null
  private env = { day: null as THREE.Texture | null, night: null as THREE.Texture | null }
  private hdriSunAzimuth = 0
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
    this.dome = skyDome()
    scene.add(this.sun, this.sun.target, this.dome.mesh, this.fill)
  }

  /** Loads both skies and prefilters their lighting now, so dusk does not hitch. */
  async load(gl: THREE.WebGLRenderer): Promise<void> {
    const loader = new HDRLoader()
    const [day, night] = await Promise.all([loader.loadAsync(DAY_URL), loader.loadAsync(NIGHT_URL)])
    const dayPixels = pixels(day)
    const [sx, , sz] = sunDirection(dayPixels.data, dayPixels.width, dayPixels.height)
    this.hdriSunAzimuth = Math.atan2(sz, sx)
    const [r, g, b] = horizonColor(dayPixels.data, dayPixels.width, dayPixels.height)
    this.dayFog.setRGB(r, g, b).multiplyScalar(0.85)
    // A "puresky" HDRI is nearly black below the horizon, which leaves every wall facing
    // away from the sun unlit. Sunlit pale ground gives the bounce light a bright city has.
    paintLowerHalf(day, [r * 0.8, g * 0.74, b * 0.64])
    // Same size as the day sky, so both prefiltered maps share one shader variant and
    // the switch at dusk does not recompile every material.
    grade(night, NIGHT_GRADE)
    upscale(night, dayPixels.width / (night.image as { width: number }).width)
    paintLowerHalf(night, [0.02, 0.018, 0.03])
    const pmrem = new THREE.PMREMGenerator(gl)
    this.env.day = pmrem.fromEquirectangular(day).texture
    this.env.night = pmrem.fromEquirectangular(night).texture
    pmrem.dispose()
    this.dome.uniforms.dayMap.value = day
    this.dome.uniforms.nightMap.value = night
    this.dome.mesh.visible = true
    this.fog = new THREE.FogExp2(new THREE.Color(), FOG_DENSITY)
    this.scene.fog = this.fog
  }

  /** Move the sun, moon, sky, haze, and image-based light to `hours` (0 to 24). */
  setTime(hours: number): void {
    const l = lighting(hours)
    const a = this.ambient
    a.day = l.day
    a.night = l.night
    a.sunDir.fromArray(l.light)
    a.sunColor.fromArray(l.color).multiplyScalar(1 / SUN_POWER)
    this.sun.color.fromArray(l.color).multiplyScalar(1 / Math.max(...l.color, 1e-6))
    this.sun.intensity = Math.max(...l.color)
    const u = this.dome.uniforms
    u.sunDir.value.copy(a.sunDir)
    u.dayTint.value
      .setScalar(1)
      .lerp(DUSK_SKY, l.dusk * 0.6)
      .multiplyScalar(l.day ** 1.5)
    u.night.value = 1 - l.day
    u.yaw.value = this.hdriSunAzimuth - Math.atan2(a.sunDir.z, a.sunDir.x)
    u.glow.value.copy(DUSK).multiplyScalar(l.dusk)
    this.fill.intensity = 1.4 * l.dusk
    u.sunDisk.value.fromArray(l.color).multiplyScalar(l.day > 0 ? 12 : 4)
    this.fogColor.copy(NIGHT_FOG).lerp(this.dayFog, l.day)
    this.fogColor.lerp(DUSK_FOG, l.dusk * 0.35)
    u.horizon.value.copy(this.fogColor)
    const byDay = l.day > 0.25
    this.scene.environment = byDay ? this.env.day : this.env.night
    this.scene.environmentRotation.y = byDay ? u.yaw.value : 0
    this.scene.environmentIntensity = byDay ? DAY_ENV * l.day * (1 - 0.45 * l.dusk) : NIGHT_ENV
    this.applyFogColor()
  }

  setQuality(q: Quality): void {
    // 2048 on High: 7 cm texels over the 140 m frustum, softened by a 2-texel filter.
    // 4096 looked the same through the filter and cost a few fps on an M4.
    const size = q === 'high' ? 2048 : 1024
    this.sun.shadow.mapSize.set(size, size)
    this.sun.shadow.radius = 2
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
   * while the sky is tone mapped. Give the fog the tone-mapped color there so fully
   * fogged sea still meets the sky without a band.
   */
  private applyFogColor(): void {
    const fog = this.fog
    if (!fog) return
    const color = this.underwater ? this.waterFog() : this.fogColor
    if (this.quality === 'high') fog.color.copy(color)
    else fog.color.fromArray(acesFilmic(color.toArray()))
    fog.density = this.underwater ? WATER_DENSITY : FOG_DENSITY
    this.dome.mesh.visible = !this.underwater
    // Underwater the backdrop is the fog color itself, so everything fades into it.
    this.scene.background = this.underwater ? fog.color : null
  }

  private waterFog(): THREE.Color {
    return WATER_DARK.copy(WATER_FOG).multiplyScalar(0.15 + 0.85 * this.ambient.day)
  }

  /** Keep the shadow frustum centered on the player so shadows stay sharp near them. */
  follow(focus: THREE.Vector3): void {
    // Snap to shadow texels so shadow edges do not shimmer while walking.
    const texel = (SHADOW_EXTENT * 2) / this.sun.shadow.mapSize.x
    const x = Math.round(focus.x / texel) * texel
    const z = Math.round(focus.z / texel) * texel
    this.sun.target.position.set(x, 0, z)
    this.sun.position.set(x, 0, z).addScaledVector(this.ambient.sunDir, SUN_DISTANCE)
  }
}

/** Multiply every pixel by an RGB grade. */
function grade(t: THREE.Texture, rgb: number[]): void {
  const { data } = t.image as { data: Uint16Array }
  const { toHalfFloat: to, fromHalfFloat: from } = THREE.DataUtils
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) data[i + c] = to(from(data[i + c]) * rgb[c])
  }
}

/** Nearest-neighbor upscale of a half-float RGBA texture by a whole factor. */
function upscale(t: THREE.Texture, k: number): void {
  const { data, width, height } = t.image as { data: Uint16Array; width: number; height: number }
  if (k <= 1) return
  const out = new Uint16Array(data.length * k * k)
  const w = width * k
  for (let y = 0; y < height * k; y++) {
    for (let x = 0; x < w; x++) {
      const src = (Math.floor(y / k) * width + Math.floor(x / k)) * 4
      out.set(data.subarray(src, src + 4), (y * w + x) * 4)
    }
  }
  t.image = { data: out, width: w, height: height * k }
}

function pixels(t: THREE.Texture) {
  const { data, width, height } = t.image as { data: Uint16Array; width: number; height: number }
  const out = new Float32Array(data.length)
  for (let i = 0; i < data.length; i++) out[i] = THREE.DataUtils.fromHalfFloat(data[i])
  return { data: out, width, height }
}

function paintLowerHalf(t: THREE.Texture, rgb: number[]): void {
  const { data, width, height } = t.image as { data: Uint16Array; width: number; height: number }
  const half = rgb.map((v) => THREE.DataUtils.toHalfFloat(v))
  for (let y = Math.ceil(height / 2); y < height; y++) {
    for (let x = 0; x < width; x++) data.set(half, (y * width + x) * 4)
  }
  t.needsUpdate = true
}
