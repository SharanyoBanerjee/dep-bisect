import { describe, it, expect } from 'vitest'
import { parseNpmLockfile } from '../../src/lockfile/npm.js'
import { diffGraphs } from '../../src/graph/diff.js'
import type { ChangeKind } from '../../src/types.js'

describe('diffGraphs', () => {
  it('detects added, removed, and bumped packages', async () => {
    const goodGraph = await parseNpmLockfile('test/fixtures/lockfile-good.json')
    const badGraph = await parseNpmLockfile('test/fixtures/lockfile-bad.json')

    const changes = diffGraphs(goodGraph, badGraph)

    expect(changes.length).toBeGreaterThan(0)

    const lodashBump = changes.find(c => c.name === 'lodash' && c.kind === 'bumped')
    expect(lodashBump).toBeDefined()
    expect(lodashBump?.from).toBe('4.17.21')
    expect(lodashBump?.to).toBe('4.17.22')

    const expressBump = changes.find(c => c.name === 'express' && c.kind === 'bumped')
    expect(expressBump).toBeDefined()
    expect(expressBump?.from).toBe('4.18.2')
    expect(expressBump?.to).toBe('4.19.0')

    const cookieAdded = changes.find(c => c.name === 'cookie' && c.kind === 'added')
    expect(cookieAdded).toBeDefined()
    expect(cookieAdded?.to).toBe('0.6.0')

    const bodyParserAdded = changes.find(c => c.name === 'body-parser' && c.kind === 'added')
    expect(bodyParserAdded).toBeDefined()
    expect(bodyParserAdded?.to).toBe('1.20.2')
  })

  it('returns empty array for identical graphs', async () => {
    const graph = await parseNpmLockfile('test/fixtures/lockfile-good.json')
    const changes = diffGraphs(graph, graph)
    expect(changes).toHaveLength(0)
  })

  it('sorts changes by id deterministically', async () => {
    const goodGraph = await parseNpmLockfile('test/fixtures/lockfile-good.json')
    const badGraph = await parseNpmLockfile('test/fixtures/lockfile-bad.json')

    const changes = diffGraphs(goodGraph, badGraph)

    for (let i = 1; i < changes.length; i++) {
      const prev = changes[i - 1]
      const curr = changes[i]
      if (prev && curr) {
        expect(curr.id.localeCompare(prev.id)).toBeGreaterThanOrEqual(0)
      }
    }
  })
})