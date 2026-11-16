// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

// Builds with BASE_PATH=/x/ into a scratch folder (so dist/ is untouched) and scans the output.
const root = resolve(__dirname, '..', '..')
const outDir = join(root, '.tmp-build-base')
const BASE = '/x/'

// URLs that are identifiers or library message text, never fetched at runtime.
const ALLOWED_URL = [
  /^https?:\/\/www\.w3\.org\//, // XML/SVG/MathML namespace identifiers
  /^https:\/\/react\.dev\/errors/, // React error message text
  /^https:\/\/bit\.ly\/wb-/, // Workbox dev message text
]

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

describe('build with BASE_PATH=/x/', () => {
  beforeAll(() => {
    rmSync(outDir, { recursive: true, force: true })
    const r = spawnSync('npm run build -- --outDir .tmp-build-base --emptyOutDir', {
      cwd: root,
      shell: true,
      env: { ...process.env, BASE_PATH: BASE, NODE_ENV: 'production' },
      encoding: 'utf8',
    })
    if (r.status !== 0) throw new Error(`build failed:\n${r.stdout}\n${r.stderr}`)
  }, 110000)

  afterAll(() => rmSync(outDir, { recursive: true, force: true }))

  // Validates: Requirements 16.1, 16.3, 17.5
  it('writes index.html', () => {
    expect(existsSync(join(outDir, 'index.html'))).toBe(true)
  })

  it('has no root-relative src/href outside the base path', () => {
    const html = readFileSync(join(outDir, 'index.html'), 'utf8')
    const bad = [...html.matchAll(/\b(?:src|href)="(\/[^"]*)"/g)]
      .map((m) => m[1])
      .filter((p) => !p.startsWith(BASE))
    expect(bad).toEqual([])
    expect(html).toContain(`href="${BASE}manifest.webmanifest"`)
  })

  it('sets manifest start_url and scope to the base path', () => {
    const m = JSON.parse(readFileSync(join(outDir, 'manifest.webmanifest'), 'utf8'))
    expect(m.start_url).toBe(BASE)
    expect(m.scope).toBe(BASE)
  })

  it('references no external http(s) URLs', () => {
    const offenders = []
    for (const file of walk(outDir)) {
      if (!/\.(html|css|js|svg|webmanifest|json)$/.test(file)) continue
      // Generated Workbox runtime is vendor code whose URLs are only comments/messages.
      if (/[\\/]workbox-[^\\/]*\.js$/.test(file)) continue
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(/https?:\/\/[^\s"'`)\\]+/g)) {
        if (!ALLOWED_URL.some((re) => re.test(m[0]))) offenders.push(`${file}: ${m[0]}`)
      }
    }
    expect(offenders).toEqual([])
  })
})
