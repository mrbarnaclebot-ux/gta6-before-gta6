import type { Mixer } from './mixer'

// Anything a player can point at or move to in the menus.
const ITEM = 'button, a.menu-item, .seg-opt, input[type="range"], .switch'
// Buttons that close a screen rather than open one.
const BACK = new Set(['resume', 'credits-close'])

/** Menu hover, select, and back clicks for the title screen and the settings menu. */
export function wireUiSounds(mixer: Mixer): void {
  let last: Element | null = null
  let lastAt = 0
  const hover = (el: Element | null) => {
    if (!el || el === last) return
    last = el
    // Arrowing fast through a list should tick, not buzz.
    if (performance.now() - lastAt < 45) return
    lastAt = performance.now()
    mixer.play('ui-hover', { bus: 'ui', gain: 0.5 })
  }
  document.addEventListener('pointerover', (e) => hover((e.target as Element).closest(ITEM)))
  document.addEventListener('focusin', (e) => hover((e.target as Element).closest(ITEM)))
  document.addEventListener('click', (e) => {
    const el = (e.target as Element).closest('button, a.menu-item, [role="tab"]')
    if (!el) return
    mixer.play(BACK.has(el.id) ? 'ui-back' : 'ui-select', { bus: 'ui', gain: 0.8 })
  })
  // A slider plays a soft tick as it moves, which also previews the new volume.
  let tickAt = 0
  document.addEventListener('input', (e) => {
    if ((e.target as HTMLInputElement).type !== 'range' || performance.now() - tickAt < 90) return
    tickAt = performance.now()
    mixer.play('ui-hover', { bus: 'ui', gain: 0.6 })
  })
  // Capture, so this sees the screen still open before the menu's own Esc handler closes it.
  const closesScreen = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    const open = ['pause', 'credits'].some((id) => document.getElementById(id)?.hidden === false)
    if (open) mixer.play('ui-back', { bus: 'ui', gain: 0.8 })
  }
  document.addEventListener('keydown', closesScreen, true)
}
