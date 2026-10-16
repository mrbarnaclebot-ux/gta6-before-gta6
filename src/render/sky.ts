import * as THREE from 'three'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { lighting, SUN_POWER } from './daynight'
import { acesFilmic, horizonColor, sunDirection } from './sky-analysis'
import { skyDome, type DomeUniforms } from './sky-dome'

const DAY_URL = '/assets/hdri/day_kloofendal_2k.hdr'
const NIGHT_URL = '/assets/hdri/night_dikhololo_1k.hdr'
// Underwater: blue-green murk that hides everything past about 50 m.
const WATER_FOG = new THREE.Color(0x147a84)
const WATER_DENSITY = 0.055
const WATER_DARK = new THREE.Color()
const ABSORB = new THREE.Color()
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
// Hours between which the night sky must be on hand: it loads a while before dusk.
const NIGHT_FROM = 15
const NIGHT_UNTIL = 8
const NIGHT_RETRY_MS = 30_000
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
  /** Post-processing on: fog mixes in before tone mapping. */
  private post = true
  /** Haze thickness, set by the render distance. */
  private fogDensity = 0.0016
  private fog: THREE.FogExp2 | null = null
  private env = { day: null as THREE.Texture | null, night: null as THREE.Texture | null }
  private hdriSunAzimuth = 0
  private underwater = false
  private gl: THREE.WebGLRenderer | null = null
  private nightAsked = false
  private dayWidth = 0
  private hours = 12
  private waterDepth = 0

  constructor(private readonly scene: THREE.Scene) {
    this.dome = skyDome()
    scene.add(this.sun, this.sun.target, this.dome.mesh, this.fill)
  }

  /**
   * Loads the day sky and prefilters its lighting. The night sky waits until the clock nears
   * dusk (see setTime): most sessions never need it in their first minutes.
   */
  async load(gl: THREE.WebGLRenderer): Promise<void> {
    this.gl = gl
    const day = withGround(await new HDRLoader().loadAsync(DAY_URL))
    const dayPixels = pixels(day)
    const [sx, , sz] = sunDirection(dayPixels.data, dayPixels.width, dayPixels.height)
    this.hdriSunAzimuth = Math.atan2(sz, sx)
    const [r, g, b] = horizonColor(dayPixels.data, dayPixels.width, dayPixels.height)
    this.dayFog.setRGB(r, g, b).multiplyScalar(0.85)
    // A "puresky" HDRI is nearly black below the horizon, which leaves every wall facing
    // away from the sun unlit. Sunlit pale ground gives the bounce light a bright city has.
    paintLowerHalf(day, [r * 0.8, g * 0.74, b * 0.64])
    const pmrem = new THREE.PMREMGenerator(gl)
    this.env.day = this.env.night = pmrem.fromEquirectangular(day).texture
    pmrem.dispose()
    this.dome.uniforms.dayMap.value = this.dome.uniforms.nightMap.value = day
    this.dayWidth = dayPixels.width
    this.dome.mesh.visible = true
    this.fog = new THREE.FogExp2(new THREE.Color(), this.fogDensity)
    this.scene.fog = this.fog
  }

  /** Fetches and prefilters the night sky once; until then the day sky stands in, dimmed. */
  private loadNight(): void {
    if (this.nightAsked || !this.gl) return
    this.nightAsked = true
    const gl = this.gl
    void new HDRLoader()
      .loadAsync(NIGHT_URL)
      .then((sky) => {
        const night = withGround(sky)
        // Same size as the day sky, so both prefiltered maps share one shader variant and
        // the switch at dusk does not recompile every material.
        grade(night, NIGHT_GRADE)
        upscale(night, this.dayWidth / (night.image as { width: number }).width)
        paintLowerHalf(night, [0.02, 0.018, 0.03])
        const pmrem = new THREE.PMREMGenerator(gl)
        this.env.night = pmrem.fromEquirectangular(night).texture
        pmrem.dispose()
        this.dome.uniforms.nightMap.value = night
        this.setTime(this.hours)
      })
      .catch((e: unknown) => {
        // The dimmed day sky keeps standing in. setTime runs every frame, so wait before retrying.
        console.warn('night sky failed to load', e)
        setTimeout(() => (this.nightAsked = false), NIGHT_RETRY_MS)
      })
  }

  /** Move the sun, moon, sky, haze, and image-based light to `hours` (0 to 24). */
  setTime(hours: number): void {
    this.hours = hours
    if (hours >= NIGHT_FROM || hours < NIGHT_UNTIL) this.loadNight()
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
    u.sunLight.value.copy(this.sun.color).multiplyScalar(this.sun.intensity)
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

  /** `post`: the post chain tone maps, so fog stays linear. `density`: haze for the render distance. */
  setOutput(post: boolean, density: number): void {
    this.post = post
    this.fogDensity = density
    this.applyFogColor()
  }

  /**
   * Mutates the one fog rather than swapping it: materials keep their compiled fog uniforms.
   * `depth`: meters below the surface; the murk darkens and thickens deeper down.
   */
  setUnderwater(on: boolean, depth = 0): void {
    if (on === this.underwater && (!on || Math.abs(depth - this.waterDepth) < 0.05)) return
    this.underwater = on
    this.waterDepth = depth
    this.applyFogColor()
  }

  /**
   * Without post-processing the renderer draws straight to the screen, where three mixes fog in after tone mapping
   * while the sky is tone mapped. Give the fog the tone-mapped color there so fully
   * fogged sea still meets the sky without a band.
   */
  private applyFogColor(): void {
    const fog = this.fog
    if (!fog) return
    const color = this.underwater ? this.waterFog() : this.fogColor
    if (this.post) fog.color.copy(color)
    else fog.color.fromArray(acesFilmic(color.toArray()))
    fog.density = this.underwater ? WATER_DENSITY * (1 + this.waterDepth * 0.03) : this.fogDensity
    this.dome.mesh.visible = !this.underwater
    // Underwater the backdrop is the fog color itself, so everything fades into it.
    this.scene.background = this.underwater ? fog.color : null
  }

  /** Blue-green near the surface; red goes first with depth, then green, so it deepens to blue. */
  private waterFog(): THREE.Color {
    const d = this.waterDepth
    WATER_DARK.copy(WATER_FOG).multiplyScalar(0.15 + 0.85 * this.ambient.day)
    return WATER_DARK.multiply(
      ABSORB.setRGB(Math.exp(-d * 0.12), Math.exp(-d * 0.045), Math.exp(-d * 0.03)),
    )
  }
}

/**
 * The HDRIs ship as their sky half only (scripts/compress-assets.mjs): the ground half is
 * painted over anyway (paintLowerHalf). This doubles the height back, ground left empty.
 */
function withGround(t: THREE.Texture): THREE.Texture {
  const { data, width, height } = t.image as { data: Uint16Array; width: number; height: number }
  const out = new Uint16Array(data.length * 2)
  out.set(data)
  t.image = { data: out, width, height: height * 2 }
  return t
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
