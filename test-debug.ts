import { parseNpmLockfile } from './src/lockfile/npm.js'
import { diffGraphs } from './src/graph/diff.js'

const good = await parseNpmLockfile('test/fixtures/lockfile-good.json')
const bad = await parseNpmLockfile('test/fixtures/lockfile-bad.json')

console.log('Good keys:', [...good.keys()].sort())
console.log('Bad keys:', [...bad.keys()].sort())

const changes = diffGraphs(good, bad)
console.log('Changes:')
for (const c of changes) {
  console.log(' ', c.id, c.name, c.kind, c.from, '->', c.to, '[', c.path, ']')
}