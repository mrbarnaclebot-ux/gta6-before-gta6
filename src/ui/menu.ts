import type { Tab } from './pause'

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T

interface MenuActions {
  play: () => void
  /** Opens the settings menu on a tab. */
  settings: (tab: Tab) => void
}

/** Title screen: Play, Settings, Controls, Credits, and Terms, by mouse or arrow keys. */
export class MainMenu {
  readonly root = $('menu')
  private readonly items = [...this.root.querySelectorAll<HTMLElement>('.menu-item')]
  private readonly credits = $('credits')
  /** The item to return focus to when a sub-screen closes. */
  private last: HTMLElement = $('play')

  constructor(a: MenuActions) {
    $('play').addEventListener('click', a.play)
    const open = (id: string, tab: Tab) =>
      $(id).addEventListener('click', () => {
        this.last = $(id)
        a.settings(tab)
      })
    open('menu-settings', 'graphics')
    open('menu-controls', 'controls')
    $('menu-credits').addEventListener('click', () => this.showCredits(true))
    $('credits-close').addEventListener('click', () => this.showCredits(false))
    for (const item of this.items) item.addEventListener('mouseenter', () => item.focus())
    document.addEventListener('keydown', (e) => {
      const at = document.activeElement
      if (!this.root.hidden && (at === document.body || this.root.contains(at))) this.onKey(e)
    })
    this.items[0].focus()
  }

  /** Back from a sub-screen: focus where the player left off. */
  refocus(): void {
    if (!this.root.hidden) this.last.focus()
  }

  private showCredits(on: boolean): void {
    this.credits.hidden = !on
    if (on) {
      this.last = $('menu-credits')
      $('credits-close').focus()
    } else this.refocus()
  }

  /** Up and down move through the list, wrapping; Esc closes the credits. */
  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && !this.credits.hidden) return this.showCredits(false)
    if (!this.credits.hidden) return
    const step = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const at = this.items.indexOf(document.activeElement as HTMLElement)
    const n = this.items.length
    this.items[at < 0 ? 0 : (at + step + n) % n].focus()
  }
}
