// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, relative } from 'node:path'

const root = resolve(__dirname, '..', '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const pkg = JSON.parse(read('package.json'))

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

describe('project hygiene', () => {
  // Validates: Requirements 13.5
  it('pins every dependency to an exact version', () => {
    const all = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(Object.keys(all).length).toBeGreaterThan(0)
    for (const [name, version] of Object.entries(all)) {
      expect(version, name).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/)
    }
  })

  // Validates: Requirements 13.1, 13.2
  it('does not list @supabase/supabase-js or qrcode.react', () => {
    const all = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(all).not.toHaveProperty('@supabase/supabase-js')
    expect(all).not.toHaveProperty('qrcode.react')
  })

  // Validates: Requirements 13.3
  it('has no supabase or qrcode.react text in src/ or index.html', () => {
    const self = join(root, 'src', 'test', 'project.test.js')
    const files = [...walk(join(root, 'src')), join(root, 'index.html')].filter(
      (f) => f !== self && /\.(jsx?|css|html|json|svg|md)$/.test(f),
    )
    const offenders = files.filter((f) =>
      /supabase|qrcode\.react/i.test(readFileSync(f, 'utf8')),
    )
    expect(offenders.map((f) => relative(root, f))).toEqual([])
  })

  // Validates: Requirements 13.6
  it('lists .env in .gitignore', () => {
    const lines = read('.gitignore').split(/\r?\n/).map((l) => l.trim())
    expect(lines).toContain('.env')
  })
})
