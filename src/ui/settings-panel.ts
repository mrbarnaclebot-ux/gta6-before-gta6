import type { Row } from './settings-rows'

export type Value = string | number | boolean
export type Values = Record<string, Value>

const ids = (key: string) => `aria-labelledby="${key}-label" aria-describedby="${key}-hint"`

// Rows are built from constant text in settings-rows.ts, never from user input.
function control(row: Row): string {
  const { key } = row
  if (row.kind === 'choice') {
    const opts = row.options
      .map(
        (o) =>
          `<label class="seg-opt"><input type="radio" name="${key}" value="${o.value}" /><span>${o.label}</span></label>`,
      )
      .join('')
    return `<div class="seg" id="${key}" role="radiogroup" ${ids(key)}>${opts}</div>`
  }
  if (row.kind === 'toggle') {
    return `<label class="switch"><input type="checkbox" role="switch" id="${key}" ${ids(key)} /><span class="switch-track" aria-hidden="true"></span><span class="switch-state" aria-hidden="true"></span></label>`
  }
  const { min, max, step } = row
  return `<div class="range"><input type="range" id="${key}" min="${min}" max="${max}" step="${step}" ${ids(key)} /><output for="${key}"></output></div>`
}

function rowHtml(row: Row): string {
  return `<div class="row row-${row.kind}">
    <div class="row-text"><span class="row-label" id="${row.key}-label">${row.label}</span>
    <span class="row-hint" id="${row.key}-hint">${row.hint}</span></div>
    <div class="row-control">${control(row)}</div></div>`
}

/** Reads the changed control's key and new value from an input event. */
function readInput(rows: Row[], input: HTMLInputElement): [string, Value] | null {
  const key = input.type === 'radio' ? input.name : input.id
  const row = rows.find((r) => r.key === key)
  if (!row) return null
  if (row.kind === 'toggle') return [key, input.checked]
  if (row.kind === 'range') return [key, Number(input.value)]
  return [key, input.value]
}

/**
 * Renders settings rows into `host` and reports each change through `onChange`.
 * Returns `show`, which puts the controls in step with the given values.
 */
export function settingsRows(
  host: HTMLElement,
  rows: Row[],
  onChange: (key: string, value: Value) => void,
): (values: Values) => void {
  host.insertAdjacentHTML('beforeend', rows.map(rowHtml).join(''))
  host.addEventListener('input', (e) => {
    const change = readInput(rows, e.target as HTMLInputElement)
    if (change) onChange(...change)
  })
  return (values) => {
    for (const row of rows) {
      const v = values[row.key]
      if (v === undefined) continue
      if (row.kind === 'choice') {
        for (const r of host.querySelectorAll<HTMLInputElement>(`input[name="${row.key}"]`)) {
          r.checked = r.value === v
        }
        continue
      }
      const input = host.querySelector<HTMLInputElement>(`#${row.key}`)!
      if (row.kind === 'toggle') {
        input.checked = v as boolean
        input.parentElement!.querySelector('.switch-state')!.textContent = v ? 'On' : 'Off'
      } else {
        input.value = String(v)
        input.parentElement!.querySelector('output')!.value = row.format(v as number)
      }
    }
  }
}
