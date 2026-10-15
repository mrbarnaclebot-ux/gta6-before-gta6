import * as THREE from 'three'

/*
 * Small procedural sprites drawn on a canvas once at startup. CREDITS.md has no
 * free muzzle-flash, smoke, or bullet-hole textures, and these are tiny.
 */

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  draw(canvas.getContext('2d')!, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function radial(g: CanvasRenderingContext2D, x: number, y: number, r: number, stops: string[]) {
  const grad = g.createRadialGradient(x, y, 0, x, y, r)
  stops.forEach((c, i) => grad.addColorStop(i / (stops.length - 1), c))
  g.fillStyle = grad
  g.beginPath()
  g.arc(x, y, r, 0, Math.PI * 2)
  g.fill()
}

/** Soft round dot for sparks and dust. */
export function dotTexture(): THREE.Texture {
  return canvasTexture(64, (g, s) =>
    radial(g, s / 2, s / 2, s / 2, [
      'rgba(255,255,255,1)',
      'rgba(255,255,255,0.5)',
      'rgba(255,255,255,0)',
    ]),
  )
}

/** Lumpy smoke puff: overlapping soft blobs, so it does not read as a perfect circle. */
export function smokeTexture(): THREE.Texture {
  return canvasTexture(128, (g, s) => {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const d = s * 0.14 * Math.random()
      const r = s * (0.18 + Math.random() * 0.14)
      radial(g, s / 2 + Math.cos(a) * d, s / 2 + Math.sin(a) * d, r, [
        'rgba(255,255,255,0.35)',
        'rgba(255,255,255,0)',
      ])
    }
  })
}

/** Muzzle flash seen from the side: a hot core with five uneven flame petals. */
export function flashTexture(): THREE.Texture {
  return canvasTexture(128, (g, s) => {
    const c = s / 2
    g.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 5; i++) {
      g.save()
      g.translate(c, c)
      g.rotate((i / 5) * Math.PI * 2 + Math.random() * 0.4)
      g.scale(1, 0.22)
      radial(g, s * 0.2, 0, s * (0.2 + Math.random() * 0.1), [
        'rgba(255,230,170,0.9)',
        'rgba(255,140,40,0.5)',
        'rgba(255,90,0,0)',
      ])
      g.restore()
    }
    radial(g, c, c, s * 0.22, ['rgba(255,255,240,1)', 'rgba(255,200,110,0.8)', 'rgba(255,120,0,0)'])
  })
}

/**
 * Bullet strike: a black pit, a pale ring of chipped material, and a faint scorch,
 * so it reads on dark asphalt and on white stucco alike.
 */
export function holeTexture(): THREE.Texture {
  return canvasTexture(64, (g, s) => {
    const c = s / 2
    radial(g, c, c, s / 2, ['rgba(60,56,50,0.5)', 'rgba(60,56,50,0.25)', 'rgba(60,56,50,0)'])
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2
      const r = 6 + Math.random() * 7
      radial(g, c + Math.cos(a) * r, c + Math.sin(a) * r, 4 + Math.random() * 4, [
        'rgba(214,208,196,0.8)',
        'rgba(214,208,196,0)',
      ])
    }
    radial(g, c, c, 7, ['rgba(5,5,5,1)', 'rgba(15,14,12,0.95)', 'rgba(30,28,26,0)'])
  })
}
