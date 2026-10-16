// Rebuilds the GPU-compressed assets in public/assets from the sources in assets-src:
//   node scripts/compress-assets.mjs [textures] [models] [hdri]
// Textures: each PBR set becomes three KTX2 files (Basis ETC1S, mipmapped); the terrain's four
// layers become two KTX2 array textures (color with roughness in alpha, and normals).
// Models: every glb gets Meshopt geometry compression (quantized, reordered); JPEG textures
// become WebP, and plant textures are capped at 1024 px (cards seen from metres away).
// HDRIs: only the sky half ships (src/render/sky.ts paints the ground half itself).
// Needs basisu (brew install basis_universal), ffmpeg, and cwebp/dwebp (brew install webp).
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTTextureWebP } from '@gltf-transform/extensions'
import { dedup, meshopt, prune } from '@gltf-transform/functions'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { MeshoptEncoder } from 'meshoptimizer'

const SRC = 'assets-src'
const OUT = 'public/assets'
// Ground layers in shader order (src/scenery/terrain-textures.ts): grass, dirt, rock, sand.
const TERRAIN = ['rocky_terrain_02', 'forest_ground_04', 'aerial_rocks_02', 'coast_sand_01']
// Sets used as plain material maps (src/world/materials.ts, src/boat/marina.ts).
const SETS = [
  'asphalt_02',
  'concrete_pavement_02',
  'coast_sand_01',
  'aerial_grass_rock',
  'white_stucco',
  'wood_planks_grey',
]
// ETC1S quality 1 to 255 (higher is better and bigger). Normals get basisu's normal-map tuning.
const Q = '255'
const tmp = mkdtempSync(join(tmpdir(), 'gta6-ktx-'))

const basisu = (args) => execFileSync('basisu', ['-ktx2', '-mipmap', '-etc1s', '-q', Q, ...args])

/** One map. TextureLoader flipped the JPEGs on upload; KTX2 cannot be flipped, so bake it in. */
function map(set, name, kind) {
  const out = join(OUT, 'textures', set, `${name}.ktx2`)
  mkdirSync(dirname(out), { recursive: true })
  const color = kind === 'color' ? ['-srgb'] : kind === 'normal' ? ['-normal_map'] : ['-linear']
  basisu([...color, '-y_flip', join(SRC, 'textures', set, `${name}.jpg`), '-output_file', out])
}

/** The terrain arrays: data textures were never flipped, so neither are these. */
function terrain() {
  const rgba = TERRAIN.map((set, i) => {
    const png = join(tmp, `layer${i}.png`)
    const dir = join(SRC, 'textures', set)
    const args = [
      '-y',
      '-loglevel',
      'error',
      '-i',
      join(dir, 'diff.jpg'),
      '-i',
      join(dir, 'rough.jpg'),
    ]
    execFileSync('ffmpeg', [...args, '-filter_complex', '[1]format=gray[a];[0][a]alphamerge', png])
    return png
  })
  const normals = TERRAIN.map((set) => join(SRC, 'textures', set, 'nor_gl.jpg'))
  const out = join(OUT, 'textures')
  basisu([
    '-srgb',
    '-tex_type',
    '2darray',
    ...rgba,
    '-output_file',
    join(out, 'terrain_albedo.ktx2'),
  ])
  basisu([
    '-normal_map',
    '-tex_type',
    '2darray',
    ...normals,
    '-output_file',
    join(out, 'terrain_normal.ktx2'),
  ])
}

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

const PLANT_MAX = 1024

/** Re-encodes one glb texture as WebP, shrunk to `max` px; skipped when it would not help. */
function toWebp(doc, texture, max) {
  const [w, h] = texture.getSize()
  const mime = texture.getMimeType()
  if (mime === 'image/webp' && Math.max(w, h) <= max) return
  const src = join(tmp, `in.${mime.split('/')[1]}`)
  writeFileSync(src, texture.getImage())
  const png = join(tmp, 'in.png')
  if (mime === 'image/webp') execFileSync('dwebp', ['-quiet', src, '-o', png])
  const k = Math.min(1, max / Math.max(w, h))
  const out = join(tmp, 'out.webp')
  const size = ['-resize', String(Math.round(w * k)), String(Math.round(h * k))]
  const input = mime === 'image/webp' ? png : src
  execFileSync('cwebp', ['-quiet', '-q', '85', '-alpha_q', '100', ...size, input, '-o', out])
  texture.setImage(new Uint8Array(readFileSync(out))).setMimeType('image/webp')
  doc.createExtension(EXTTextureWebP)
}

async function models() {
  await MeshoptEncoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
  })
  for (const file of walk(join(SRC, 'models')).filter((f) => f.endsWith('.glb'))) {
    const doc = await io.read(file)
    const max = file.includes('vegetation') ? PLANT_MAX : 4096
    for (const t of doc.getRoot().listTextures()) toWebp(doc, t, max)
    await doc.transform(dedup(), prune(), meshopt({ encoder: MeshoptEncoder }))
    const out = file.replace(SRC, OUT)
    mkdirSync(dirname(out), { recursive: true })
    await io.write(out, doc)
    console.log(out, statSync(file).size, '->', statSync(out).size)
  }
}

/** Byte length of one new-style RLE RGBE scanline starting at `at`. */
function scanline(buf, at, width) {
  let p = at + 4
  for (let c = 0; c < 4; c++) {
    for (let n = 0; n < width;) {
      const count = buf[p++]
      if (count > 128) {
        n += count - 128
        p++
      } else {
        n += count
        p += count
      }
    }
  }
  return p - at
}

/** Keeps the top half of a Radiance .hdr: the sky above the horizon. */
function skyHalf(name) {
  const buf = readFileSync(join(SRC, 'hdri', name))
  const text = buf.toString('latin1')
  const res = /-Y (\d+) \+X (\d+)\n/.exec(text)
  const [height, width] = [+res[1], +res[2]]
  let p = res.index + res[0].length
  const start = p
  for (let y = 0; y < height / 2; y++) p += scanline(buf, p, width)
  const head = text.slice(0, res.index) + `-Y ${height / 2} +X ${width}\n`
  const out = Buffer.concat([Buffer.from(head, 'latin1'), buf.subarray(start, p)])
  writeFileSync(join(OUT, 'hdri', name), out)
  console.log(name, buf.length, '->', out.length)
}

const want = process.argv.slice(2)
if (!want.length || want.includes('hdri')) {
  mkdirSync(join(OUT, 'hdri'), { recursive: true })
  for (const f of readdirSync(join(SRC, 'hdri'))) skyHalf(f)
}
if (!want.length || want.includes('textures')) {
  for (const set of SETS) {
    map(set, 'diff', 'color')
    map(set, 'nor_gl', 'normal')
    map(set, 'rough', 'data')
  }
  terrain()
  console.log('textures done')
}
if (!want.length || want.includes('models')) await models()
