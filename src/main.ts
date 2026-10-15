import './style.css'
import { Input } from './input/input'

const canvas = document.getElementById('view') as HTMLCanvasElement
const title = document.getElementById('title') as HTMLElement
const play = document.getElementById('play') as HTMLButtonElement
const status = document.getElementById('status') as HTMLElement

const input = new Input(canvas)

play.addEventListener('click', async () => {
  play.disabled = true
  status.textContent = 'Loading the city...'
  input.lockPointer()
  try {
    // Lazy so the title screen paints before three.js and the physics WASM download.
    const { startGame } = await import('./game')
    await startGame(canvas, input)
    title.hidden = true
    canvas.focus()
  } catch (err) {
    console.error(err)
    status.textContent = 'Could not start. Your browser may not support WebGL2.'
    play.disabled = false
  }
})
