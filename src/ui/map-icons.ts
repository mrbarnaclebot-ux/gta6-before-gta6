/* Map markers in screen pixels, shared by the minimap and the full map so both read alike. */

type G = CanvasRenderingContext2D
type Pt = { x: number; y: number }

export const WAYPOINT = '#ff4fa0'
const OUTLINE = 'rgba(10, 8, 20, 0.85)'

/** White badge with a red cross. */
export function hospitalIcon(g: G, x: number, y: number, s = 1): void {
  g.save()
  g.translate(x, y)
  g.scale(s, s)
  g.fillStyle = OUTLINE
  g.beginPath()
  g.roundRect(-8, -8, 16, 16, 4)
  g.fill()
  g.fillStyle = '#f4f6f8'
  g.beginPath()
  g.roundRect(-6.5, -6.5, 13, 13, 3)
  g.fill()
  g.fillStyle = '#d6283c'
  g.fillRect(-1.6, -4.6, 3.2, 9.2)
  g.fillRect(-4.6, -1.6, 9.2, 3.2)
  g.restore()
}

/** A small top-down car pointing along `angle` (0 is up on screen). */
export function carIcon(g: G, x: number, y: number, angle: number): void {
  g.save()
  g.translate(x, y)
  g.rotate(angle)
  g.fillStyle = OUTLINE
  g.beginPath()
  g.roundRect(-4.5, -7.5, 9, 15, 3)
  g.fill()
  g.fillStyle = '#8fd8ff'
  g.beginPath()
  g.roundRect(-3.2, -6.2, 6.4, 12.4, 2)
  g.fill()
  g.fillStyle = 'rgba(10, 8, 20, 0.7)'
  g.fillRect(-2.4, -3.6, 4.8, 2.2)
  g.restore()
}

/** A pin whose tip sits on the waypoint. */
export function waypointIcon(g: G, x: number, y: number): void {
  g.save()
  g.translate(x, y)
  g.beginPath()
  g.moveTo(0, 0)
  g.bezierCurveTo(-3, -6, -9, -10, -9, -17)
  g.arc(0, -17, 9, Math.PI, 0)
  g.bezierCurveTo(9, -10, 3, -6, 0, 0)
  g.fillStyle = WAYPOINT
  g.strokeStyle = OUTLINE
  g.lineWidth = 2
  g.fill()
  g.stroke()
  g.beginPath()
  g.arc(0, -17, 3.4, 0, Math.PI * 2)
  g.fillStyle = '#fff'
  g.fill()
  g.restore()
}

/** The player: a white arrowhead pointing along `angle` (0 is up on screen). */
export function playerArrow(g: G, x: number, y: number, angle: number, s = 1): void {
  g.save()
  g.translate(x, y)
  g.rotate(angle)
  g.scale(s, s)
  g.beginPath()
  g.moveTo(0, -9)
  g.lineTo(7, 8)
  g.lineTo(0, 4)
  g.lineTo(-7, 8)
  g.closePath()
  g.fillStyle = '#ffffff'
  g.strokeStyle = OUTLINE
  g.lineWidth = 2
  g.lineJoin = 'round'
  g.stroke()
  g.fill()
  g.restore()
}

/** The GPS line: a dark casing under a bright stroke, like the roads. */
export function routeLine(g: G, pts: Pt[], width: number): void {
  if (pts.length < 2) return
  g.save()
  g.beginPath()
  g.moveTo(pts[0].x, pts[0].y)
  for (const p of pts.slice(1)) g.lineTo(p.x, p.y)
  g.lineJoin = 'round'
  g.lineCap = 'round'
  g.strokeStyle = OUTLINE
  g.lineWidth = width + 3
  g.stroke()
  g.strokeStyle = WAYPOINT
  g.lineWidth = width
  g.stroke()
  g.restore()
}
