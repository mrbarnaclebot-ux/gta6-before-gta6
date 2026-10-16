/**
 * Gamepad menu navigation over the plain DOM menus: the D-pad moves focus through the open
 * screen's controls, left and right change sliders, choices, and tabs, A clicks, B is Esc.
 */

const FOCUSABLE = 'button:not([disabled]), a[href], input, canvas[tabindex]'

/** The screen on top, if any: the credits, the settings or pause menu, the map, the title. */
export function openScreen(): HTMLElement | null {
  for (const id of ['credits', 'pause', 'worldmap', 'menu']) {
    const el = document.getElementById(id)
    if (el && !el.hidden && el.getClientRects().length) return el
  }
  return null
}

/** Controls in reading order; of a radio group only the checked option, as Tab does. */
function controls(screen: HTMLElement): HTMLElement[] {
  return [...screen.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    const radio = el instanceof HTMLInputElement && el.type === 'radio'
    return el.tabIndex >= 0 && el.getClientRects().length > 0 && (!radio || el.checked)
  })
}

/** Up and down: previous or next control, wrapping. */
export function moveFocus(screen: HTMLElement, step: 1 | -1): void {
  const list = controls(screen)
  if (!list.length) return
  const at = list.indexOf(document.activeElement as HTMLElement)
  const next = at < 0 ? list[0] : list[(at + step + list.length) % list.length]
  next.focus()
  next.scrollIntoView?.({ block: 'nearest' })
}

/** Left and right: nudge a slider, pick the neighbouring choice, or switch tab. */
export function adjust(step: 1 | -1): void {
  const el = document.activeElement
  if (el instanceof HTMLInputElement && el.type === 'range') {
    if (step > 0) el.stepUp()
    else el.stepDown()
    el.dispatchEvent(new Event('input', { bubbles: true }))
  } else if (el instanceof HTMLInputElement && el.type === 'radio') {
    const group = [...document.querySelectorAll<HTMLInputElement>(`input[name="${el.name}"]`)]
    const next = group[Math.max(0, Math.min(group.length - 1, group.indexOf(el) + step))]
    next.click()
    next.focus()
  } else if (el instanceof HTMLElement && el.getAttribute('role') === 'tab') {
    const key = step > 0 ? 'ArrowRight' : 'ArrowLeft'
    el.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, bubbles: true }))
  }
}

/** A: activate the focused control, or focus the first one. */
export function confirm(screen: HTMLElement): void {
  const el = document.activeElement
  if (el instanceof HTMLElement && screen.contains(el) && el !== screen) el.click()
  else moveFocus(screen, 1)
}

/** B: the same as Esc, which every screen already handles. */
export function back(): void {
  const at = (document.activeElement as HTMLElement | null) ?? document.body
  for (const type of ['keydown', 'keyup']) {
    at.dispatchEvent(new KeyboardEvent(type, { key: 'Escape', code: 'Escape', bubbles: true }))
  }
}
