import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createElement } from 'react'
import { render, screen } from '@testing-library/react'
import { contrastRatio } from '../lib/contrast.js'
import Landing from '../components/Landing.jsx'

const root = resolve(__dirname, '..', '..')
const css = readFileSync(join(root, 'src', 'index.css'), 'utf8')
const html = readFileSync(join(root, 'index.html'), 'utf8')

function rootVars() {
  const block = css.match(/:root\s*{([^}]*)}/)[1]
  const vars = {}
  for (const m of block.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) vars[m[1]] = m[2].trim()
  const resolveVar = (v) => {
    const ref = v.match(/^var\(--([\w-]+)\)$/)
    return ref ? resolveVar(vars[ref[1]]) : v
  }
  return Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, resolveVar(v)]))
}

describe('palette contrast', () => {
  const v = rootVars()

  // Validates: Requirements 11.2, 11.7
  it.each([
    ['paper', 'bg'],
    ['muted', 'bg'],
    ['paper', 'surface'],
    ['muted', 'surface'],
    ['on-accent', 'accent'],
  ])('text %s on %s is at least 4.5:1', (fg, bg) => {
    expect(contrastRatio(v[fg], v[bg])).toBeGreaterThanOrEqual(4.5)
  })

  // Validates: Requirements 11.7, 11.8
  it.each([
    ['focus', 'bg'],
    ['focus', 'surface'],
    ['border-strong', 'bg'],
    ['border-strong', 'surface'],
  ])('UI/focus color %s against %s is at least 3:1', (fg, bg) => {
    expect(contrastRatio(v[fg], v[bg])).toBeGreaterThanOrEqual(3)
  })
})

describe('index.css rules', () => {
  // Validates: Requirements 10.5, 11.8
  it('has safe-area, reduced-motion and focus-visible rules', () => {
    expect(css).toMatch(/env\(safe-area-inset-top\)/)
    expect(css).toMatch(/env\(safe-area-inset-bottom\)/)
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/)
    expect(css).toMatch(/:focus-visible\s*{[^}]*outline:\s*3px/)
  })
})

describe('index.html metadata', () => {
  // Validates: Requirements 11.9, 11.12
  it('has title, description, theme-color and favicon', () => {
    expect(html).toMatch(/<html[^>]*lang="en"/)
    expect(html).toMatch(/<title>Lilim<\/title>/)
    const desc = html.match(/<meta\s+name="description"\s+content="([^"]*)"/)
    expect(desc).not.toBeNull()
    expect(desc[1].length).toBeGreaterThanOrEqual(1)
    expect(desc[1].length).toBeLessThanOrEqual(160)
    expect(html).toMatch(/<meta\s+name="theme-color"\s+content="#[0-9a-fA-F]{3,8}"/)
    expect(html).toMatch(/<link\s+rel="icon"[^>]*href="\/favicon\.svg"/)
    expect(html).toMatch(/viewport-fit=cover/)
  })
})

describe('Landing', () => {
  // Validates: Requirements 12.6, 11.9
  it('renders the Lilim title and a short privacy line', () => {
    render(createElement(Landing, { onStart: () => {} }))
    expect(screen.getByRole('heading', { name: 'Lilim' })).toBeInTheDocument()
    const line = screen.getByText('Your photos stay on this device. Nothing is uploaded.')
    expect(line).toBeVisible()
    expect(line.textContent.length).toBeLessThanOrEqual(120)
  })
})
