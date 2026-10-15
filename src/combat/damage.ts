/*
 * Pure damage rules: range falloff, headshots, health, and car condition.
 */

export const PISTOL_DAMAGE = 25
export const MAX_RANGE = 200
const FALLOFF_START = 25
const FALLOFF_END = 120
const FAR_FACTOR = 0.4
/** Hits this high above a body's feet count as head shots on a 1.8 m mannequin. */
export const HEAD_HEIGHT = 1.5

export interface Health {
  hp: number
  readonly max: number
}

/** Full damage up close, easing down to 40% at long range, nothing past MAX_RANGE. */
export function damageAt(distance: number, aboveFeet = 0): number {
  if (distance > MAX_RANGE) return 0
  const t = Math.min(1, Math.max(0, (distance - FALLOFF_START) / (FALLOFF_END - FALLOFF_START)))
  const head = aboveFeet >= HEAD_HEIGHT ? 2 : 1
  return PISTOL_DAMAGE * (1 - t * (1 - FAR_FACTOR)) * head
}

/** Applies damage. Returns true only on the hit that takes health to zero. */
export function hurt(h: Health, amount: number): boolean {
  if (h.hp <= 0) return false
  h.hp = Math.max(0, h.hp - amount)
  return h.hp === 0
}

export type CarCondition = 'intact' | 'smoking' | 'wrecked'

/** Cars smoke below 40% health and lose the engine at zero. */
export function carCondition(h: Health): CarCondition {
  if (h.hp <= 0) return 'wrecked'
  return h.hp < h.max * 0.4 ? 'smoking' : 'intact'
}
