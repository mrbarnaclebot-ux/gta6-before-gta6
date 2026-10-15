import { PRESETS, presetOf, type Graphics, type Preset } from '../render/graphics'
import type { Prefs } from '../settings'
import { settingsRows, type Value } from './settings-panel'
import { CONTROL_ROWS, DISPLAY_ROWS, GRAPHICS_ROWS, PRESET_ROW } from './settings-rows'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

// A lost pointer lock and the Esc key-down can both arrive for one Esc press.
const DEBOUNCE_MS = 100

/** What the menu reports. The title screen sets these first; the game replaces them on start. */
export interface PauseHooks {
  onGraphics: (g: Graphics) => void
  onPref: <K extends keyof Prefs>(name: K, value: Prefs[K]) => void
  /** `fromClick`: the Resume click is a user gesture, so the game can re-lock the mouse. */
  onResume: (fromClick: boolean) => void
  /** Whether losing the mouse should open the menu: not before the game, not over the map. */
  autoOpen: () => boolean
}

export type Tab = 'graphics' | 'display' | 'controls'

/** Esc menu: resume, and the Graphics, Display, and Controls settings tabs. Also Settings on the title screen. */
export class PauseMenu {
  open = false
  /** In game it reads Paused and Resume; on the title screen, Settings and Back. */
  playing = false
  private openedAt = 0
  private readonly root = $('pause')
  private readonly resume = $<HTMLButtonElement>('resume')
  private readonly tabs = [...this.root.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  private readonly showGraphics: (v: Record<string, Value>) => void
  private select: (tab: HTMLButtonElement) => void = () => {}
  graphics: Graphics

  constructor(
    o: { graphics: Graphics; prefs: Prefs },
    public hooks: PauseHooks,
  ) {
    this.graphics = o.graphics
    this.showGraphics = settingsRows(
      $('tab-graphics'),
      [PRESET_ROW, ...GRAPHICS_ROWS],
      (key, v) => {
        const g = this.graphics
        const next =
          key !== 'preset' ? { ...g, [key]: v } : v === 'custom' ? g : PRESETS[v as Preset]
        this.setGraphics({ ...next })
        this.hooks.onGraphics(this.graphics)
      },
    )
    this.setGraphics(o.graphics)
    const prefs = { ...o.prefs }
    const onPref = (key: string, v: Value) => {
      Object.assign(prefs, { [key]: v })
      showPrefs(prefs as unknown as Record<string, Value>)
      this.hooks.onPref(key as keyof Prefs, v as never)
    }
    const showPrefs = (v: Record<string, Value>) => [display, controls].forEach((show) => show(v))
    const display = settingsRows($('tab-display'), DISPLAY_ROWS, onPref)
    const controls = settingsRows($('control-rows'), CONTROL_ROWS, onPref)
    showPrefs(prefs as unknown as Record<string, Value>)
    this.wireTabs()
    this.resume.addEventListener('click', () => this.hide(true))
    // Losing the mouse (Esc in a locked browser, or switching windows) pauses the game.
    document.addEventListener('pointerlockchange', () => {
      if (!document.pointerLockElement && !this.open && this.hooks.autoOpen()) this.show()
    })
  }

  /** Shows these settings, and the preset they match (or Custom). */
  setGraphics(g: Graphics): void {
    this.graphics = g
    this.showGraphics({ ...g, preset: presetOf(g) } as unknown as Record<string, Value>)
  }

  /** Esc: open, or close if it has been open a moment. */
  toggle(): void {
    if (!this.open) return this.show()
    if (performance.now() - this.openedAt > DEBOUNCE_MS) this.hide(false)
  }

  show(tab?: Tab): void {
    this.open = true
    this.openedAt = performance.now()
    $('pause-title').textContent = this.playing ? 'Paused' : 'Settings'
    this.resume.textContent = this.playing ? 'Resume' : 'Back'
    if (tab) this.select($<HTMLButtonElement>(`tab-btn-${tab}`))
    this.root.hidden = false
    this.resume.focus()
  }

  hide(fromClick: boolean): void {
    this.open = false
    this.root.hidden = true
    this.resume.blur()
    this.hooks.onResume(fromClick)
  }

  /** Tabs per the ARIA pattern: click or arrow keys switch, only the active tab is tabbable. */
  private wireTabs(): void {
    const select = (this.select = (tab: HTMLButtonElement) => {
      for (const t of this.tabs) {
        const on = t === tab
        t.setAttribute('aria-selected', String(on))
        t.tabIndex = on ? 0 : -1
        $(t.getAttribute('aria-controls')!).hidden = !on
      }
    })
    this.tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab))
      tab.addEventListener('keydown', (e) => {
        const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
        if (!step) return
        const next = this.tabs[(i + step + this.tabs.length) % this.tabs.length]
        select(next)
        next.focus()
      })
    })
    select(this.tabs[0])
  }
}
