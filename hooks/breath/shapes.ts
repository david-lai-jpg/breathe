// The animation styles: pulse, ripples, dots and wave ported from legacy/breathe.sh, the rest picked
// from a prototype gallery. Each turns a breath's progress (0..1000) into rows of text, the shape
// centred in `width` cells. Pure: `bun test` covers it.

export type Style = 'pulse' | 'ripples' | 'dots' | 'wave' | 'horizon' | 'meter' | 'tide' | 'halftone'

export const STYLES: readonly Style[] = ['pulse', 'ripples', 'dots', 'wave', 'horizon', 'meter', 'tide', 'halftone']

export const isStyle = (value: unknown): value is Style =>
  typeof value === 'string' && (STYLES as readonly string[]).includes(value)

/** The style for a turn: the setting, or at random, never the one just shown. */
export function pickStyle(setting: Style | 'random', last: Style | undefined, random: () => number = Math.random): Style {
  if (setting !== 'random') return setting
  const pool = STYLES.filter(s => s !== last)
  return pool[Math.floor(random() * pool.length)] ?? 'pulse'
}

/** Rows the shape is drawn on, as breathe.sh drew it (its rows 2..8); the middle row is 3. */
export const ART_ROWS = 7
const MID = 3

const HBLK = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'] as const
const RIPPLE = ['━', '─', '╌', '┈'] as const
const PULSE_RATIO = [200, 600, 1000, 600, 200] as const
const RIPPLE_RATIO = [1000, 750, 500, 250] as const
const HORIZON_FADE = ['┈', '╌', '─'] as const
const PARTIAL = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉'] as const
const HALFTONE = [' ', '·', '∙', '•', '●'] as const

// [row, column factor]: the column is -1000..1000 from the centre, scaled to the box
const DOTS: readonly (readonly [number, number])[] = [
  [3, 0], [3, 70], [3, -80],
  [2, 150], [4, -160], [2, -220], [4, 230], [3, 300], [3, -310],
  [1, 250], [5, -260], [1, -400], [5, 410], [2, 450], [4, -460],
  [2, -530], [4, 540], [3, 600], [3, -620],
  [0, 400], [6, -420], [0, -600], [6, 620], [1, 700], [5, -710],
  [1, -800], [5, 810], [2, 850], [4, -860],
  [0, 900], [6, -910], [0, -950], [6, 960],
]

/** The shape's widest extent: the band less a margin, at most 60 cells. */
export const boxWidth = (width: number): number => Math.min(60, Math.max(4, width - 4))

/** Half the shape's current width in cells; never 0 while any breath is in. */
export function scaledHalf(progress: number, width: number): number {
  const maxHalf = Math.floor(boxWidth(width) / 2)
  const half = Math.floor((maxHalf * progress) / 1000)
  return half < 1 && progress > 0 ? 1 : half
}

/** A pulse bar's half: `░▒▓███` on the left, mirrored on the right, `h` cells each. */
function pulseBar(h: number): string {
  const fill = '█'.repeat(Math.max(0, h - 3))
  const left = (h >= 3 ? '░' : '') + (h >= 2 ? '▒' : '') + '▓' + fill
  const right = fill + '▓' + (h >= 2 ? '▒' : '') + (h >= 3 ? '░' : '')
  return left + right
}

type Grid = string[][]

const blank = (width: number): Grid => Array.from({ length: ART_ROWS }, () => Array<string>(width).fill(' '))

/** Writes `text` into `grid[row]` centred, clipped to the grid. */
function centred(grid: Grid, row: number, text: string): void {
  const line = grid[row]
  if (!line) return
  const width = line.length
  const chars = [...text]
  const start = Math.floor((width - chars.length) / 2)
  chars.forEach((ch, i) => {
    const col = start + i
    if (col >= 0 && col < width) line[col] = ch
  })
}

function pulse(grid: Grid, half: number): void {
  PULSE_RATIO.forEach((ratio, i) => {
    const h = Math.min(32, Math.floor((half * ratio) / 1000))
    if (h > 0) centred(grid, MID - 2 + i, pulseBar(h))
  })
}

function ripples(grid: Grid, half: number): void {
  RIPPLE_RATIO.forEach((ratio, dist) => {
    const rw = Math.min(64, Math.floor((half * ratio) / 1000))
    if (rw <= 0) return
    const line = RIPPLE[dist]!.repeat(rw * 2)
    centred(grid, MID - dist, line)
    if (dist > 0) centred(grid, MID + dist, line)
  })
}

function dots(grid: Grid, progress: number, width: number): void {
  if (progress <= 0) return
  const centre = Math.floor(width / 2)
  const maxHalf = Math.floor(boxWidth(width) / 2)
  for (const [row, dcol] of DOTS) {
    const abs = Math.abs(dcol)
    if (abs > progress) continue
    const col = centre + Math.trunc((dcol * maxHalf) / 1000)
    const ch = abs < 150 ? '✦' : abs < 500 ? '•' : '·'
    const line = grid[row]
    if (line && col >= 0 && col < width) line[col] = ch
  }
}

function wave(grid: Grid, half: number): void {
  if (half <= 0) return
  const sh2 = half * half
  for (let rowIdx = 0; rowIdx < 3; rowIdx++) {
    const rowBase = rowIdx * 8
    let text = ''
    let any = false
    for (let x = -half; x <= half; x++) {
      const total = Math.floor((24 * (sh2 - x * x)) / sh2)
      const rowH = Math.max(0, Math.min(8, total - rowBase))
      text += HBLK[rowH]
      if (rowH > 0) any = true
    }
    if (any) centred(grid, MID + 2 - rowIdx, text)
  }
}

function horizon(grid: Grid, half: number): void {
  if (half <= 0) {
    centred(grid, MID, '·')
    return
  }
  const n = half * 2
  centred(grid, MID, Array.from({ length: n }, (_, i) => HORIZON_FADE[Math.min(i, n - 1 - i)] ?? '━').join(''))
}

/** A capsule that fills left to right in eighths of a cell. */
function meter(grid: Grid, progress: number, width: number): void {
  const inner = boxWidth(width) - 2
  const fill = (inner * progress) / 1000
  const full = Math.floor(fill)
  const bar = ('█'.repeat(full) + PARTIAL[Math.floor((fill - full) * 8)]).padEnd(inner)
  centred(grid, MID - 1, '▁'.repeat(inner))
  centred(grid, MID, '▕' + bar + '▏')
  centred(grid, MID + 1, '▔'.repeat(inner))
}

/** Water that rises with the breath; its surface calms as it rises and is a flat brim when full. */
function tide(grid: Grid, progress: number, width: number, elapsedMs: number): void {
  const span = boxWidth(width)
  const left = Math.floor((width - span) / 2)
  const k = progress / 1000
  const swell = 2.4 * Math.sqrt(1 - k)
  for (let c = 0; c < span; c++) {
    const col = left + c
    if (col < 0 || col >= width) continue
    const ripple = (Math.sin(c * 0.3 + elapsedMs / 900) + 0.4 * Math.sin(c * 0.11 - elapsedMs / 1700)) / 1.4
    // in eighths of a row: a shallow layer at rest, all 7 rows (56) at the top of the breath
    const level = 5 + k * 51 + swell * ripple
    grid.forEach((line, row) => {
      const eighths = Math.round(Math.max(0, Math.min(8, level - (ART_ROWS - 1 - row) * 8)))
      if (eighths > 0) line[col] = HBLK[eighths]!
    })
  }
}

/** A staggered grid of dots that swell from the centre, like a print halftone. */
function halftone(grid: Grid, progress: number, width: number): void {
  const centreCol = (width - 1) / 2
  const reach = 0.6 + (13 * progress) / 1000
  const half = boxWidth(width) / 2
  grid.forEach((line, row) => {
    for (let col = Math.max(0, Math.ceil(centreCol - half)); col <= Math.min(width - 1, centreCol + half); col++) {
      if ((Math.round(col - centreCol) + row) % 2) continue
      // a cell is about twice as tall as it is wide, so a column counts 0.47 of a row
      const dot = Math.min(4, Math.ceil(((reach - Math.hypot((col - centreCol) * 0.47, row - MID)) / 2.4) * 4))
      if (dot > 0) line[col] = HALFTONE[dot]!
    }
  })
}

/**
 * One frame: `rows` strings, each at most `width` cells with the shape centred.
 * Fewer than 7 rows shows the middle of the picture; more pads it top and bottom.
 * `elapsedMs` (time since the band mounted) moves the tide's surface; the other styles ignore it.
 */
export function frame(style: Style, progress: number, width: number, rows: number = ART_ROWS, elapsedMs: number = 0): string[] {
  const grid = blank(Math.max(1, width))
  const half = scaledHalf(progress, width)
  switch (style) {
    case 'pulse': pulse(grid, half); break
    case 'ripples': ripples(grid, half); break
    case 'dots': dots(grid, progress, width); break
    case 'wave': wave(grid, half); break
    case 'horizon': horizon(grid, half); break
    case 'meter': meter(grid, progress, width); break
    case 'tide': tide(grid, progress, width, elapsedMs); break
    case 'halftone': halftone(grid, progress, width); break
  }
  const lines = grid.map(line => line.join('').trimEnd() || ' ')
  if (rows >= ART_ROWS) {
    const above = Math.floor((rows - ART_ROWS) / 2)
    return [...Array<string>(above).fill(' '), ...lines, ...Array<string>(rows - ART_ROWS - above).fill(' ')]
  }
  const skip = Math.floor((ART_ROWS - rows) / 2)
  return lines.slice(skip, skip + rows)
}

/** `text` centred in `width` cells (left padding only). */
export const centre = (text: string, width: number): string => {
  const pad = Math.floor((width - [...text].length) / 2)
  return ' '.repeat(Math.max(0, pad)) + text
}
