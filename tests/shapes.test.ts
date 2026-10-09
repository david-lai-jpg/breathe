import { describe, expect, test } from 'bun:test'
import { ART_ROWS, STYLES, boxWidth, centre, frame, pickStyle, scaledHalf } from '../hooks/breath/shapes.ts'

const width = (line: string) => [...line].length

describe('shapes', () => {
  test('the box is the band less a margin, at most 60', () => {
    expect(boxWidth(80)).toBe(60)
    expect(boxWidth(40)).toBe(36)
    expect(boxWidth(2)).toBe(4)
  })

  test('a breath just begun still shows one cell', () => {
    expect(scaledHalf(0, 80)).toBe(0)
    expect(scaledHalf(1, 80)).toBe(1)
    expect(scaledHalf(1000, 80)).toBe(30)
  })

  test.each(['pulse', 'ripples', 'dots', 'wave'] as const)('%s: empty at the bottom of the breath', style => {
    const empty = frame(style, 0, 80)
    expect(empty).toHaveLength(ART_ROWS)
    expect(empty.every(line => line.trim() === '')).toBe(true)
  })

  test.each(STYLES)('%s: within the box at 1000, rows as asked', style => {
    const full = frame(style, 1000, 80)
    expect(full).toHaveLength(ART_ROWS)
    expect(full.some(line => line.trim() !== '')).toBe(true)
    for (const line of full) {
      expect(width(line)).toBeLessThanOrEqual(80)
      // centred: at least the margin of blank cells on the left
      if (line.trim()) expect(line.length - line.trimStart().length).toBeGreaterThanOrEqual(10)
    }
  })

  test('pulse grows with the breath and mirrors', () => {
    const half = frame('pulse', 500, 80)
    const full = frame('pulse', 1000, 80)
    const mid = (f: string[]) => f[3]!.trim()
    expect(width(mid(half))).toBeLessThan(width(mid(full)))
    expect(width(mid(full))).toBe(60)
    expect(mid(full)).toBe([...mid(full)].reverse().join(''))
    expect(mid(full).startsWith('░▒▓█')).toBe(true)
  })

  test('ripples: the middle row is the widest, dashed rows fade outwards', () => {
    const f = frame('ripples', 1000, 80)
    expect(width(f[3]!.trim())).toBe(60)
    expect(f[3]!.trim()).toMatch(/^━+$/)
    expect(f[0]!.trim()).toMatch(/^┈+$/)
    expect(width(f[0]!.trim())).toBeLessThan(width(f[2]!.trim()))
  })

  test('dots: the centre star shows first, the far ones last', () => {
    const early = frame('dots', 100, 80).join('\n')
    const late = frame('dots', 1000, 80).join('\n')
    expect(early).toContain('✦')
    expect(early).not.toContain('·')
    expect(late).toContain('·')
  })

  test('wave: three rows of blocks, the peak in the middle', () => {
    const f = frame('wave', 1000, 80)
    expect(f[5]!.trim()).toMatch(/^[▁▂▃▄▅▆▇█]+$/)
    expect(f[3]!.trim()).toContain('█')
    expect(f[3]!.trim().length).toBeLessThan(f[5]!.trim().length)
  })

  test('horizon: a dot at rest, one line that grows to the box', () => {
    expect(frame('horizon', 0, 80)[3]!.trim()).toBe('·')
    const half = frame('horizon', 500, 80)[3]!.trim()
    const full = frame('horizon', 1000, 80)[3]!.trim()
    expect(width(half)).toBeLessThan(width(full))
    expect(width(full)).toBe(60)
    expect(frame('horizon', 1000, 80).filter(line => line.trim()).length).toBe(1)
  })

  test('meter: an empty capsule at rest that fills from the left', () => {
    const bar = (p: number) => frame('meter', p, 80)[3]!.trim()
    expect(bar(0)).toMatch(/^▕ +▏$/)
    expect(bar(1000)).toBe('▕' + '█'.repeat(58) + '▏')
    expect(bar(500).startsWith('▕█')).toBe(true)
    expect(bar(500).endsWith(' ▏')).toBe(true)
  })

  test('tide: rises with the breath and is a flat container one row below the top', () => {
    const filled = (f: string[]) => f.join('').split('').filter(ch => ch !== ' ').length
    expect(filled(frame('tide', 600, 80, ART_ROWS, 0))).toBeGreaterThan(filled(frame('tide', 200, 80, ART_ROWS, 0)))
    const full = frame('tide', 1000, 80, ART_ROWS, 12345)
    expect(full[0]!.trim()).toBe('')
    expect(full.slice(1).every(line => line.trim() === '█'.repeat(60))).toBe(true)
  })

  test('tide: the surface moves with time below the top', () => {
    expect(frame('tide', 500, 80, ART_ROWS, 0)).not.toEqual(frame('tide', 500, 80, ART_ROWS, 1500))
  })

  test('halftone: one dot at rest, the dots swell outwards', () => {
    expect(frame('halftone', 0, 80).join('').trim()).toBe('·')
    const count = (p: number) => frame('halftone', p, 80).join('').split('').filter(ch => ch !== ' ').length
    expect(count(500)).toBeGreaterThan(count(100))
    expect(count(1000)).toBeGreaterThan(count(500))
    expect(frame('halftone', 1000, 80)[3]).toContain('●')
  })

  test('fewer rows show the middle of the picture; more pad it', () => {
    const three = frame('pulse', 1000, 80, 3)
    expect(three).toHaveLength(3)
    expect(three[1]!.trim()).toBe(frame('pulse', 1000, 80)[3]!.trim())
    const eleven = frame('pulse', 1000, 80, 11)
    expect(eleven).toHaveLength(11)
    expect(eleven[0]).toBe(' ')
  })

  test('a narrow band clips instead of throwing', () => {
    for (const style of STYLES) {
      const f = frame(style, 1000, 6)
      expect(f.every(line => width(line) <= 6)).toBe(true)
    }
  })

  test('random picks a style other than the last', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) seen.add(pickStyle('random', 'pulse', Math.random))
    expect(seen.has('pulse')).toBe(false)
    expect(seen.size).toBe(STYLES.length - 1)
    expect(pickStyle('wave', 'wave')).toBe('wave')
  })

  test('centre pads on the left only', () => {
    expect(centre('ab', 10)).toBe('    ab')
    expect(centre('abc', 2)).toBe('abc')
  })
})
