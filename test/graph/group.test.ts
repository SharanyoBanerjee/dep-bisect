import { describe, it, expect } from 'vitest'
import { parseNpmLockfile } from '../../src/lockfile/npm.js'
import { diffGraphs } from '../../src/graph/diff.js'
import { groupChanges } from '../../src/graph/group.js'
import type { Unit } from '../../src/types.js'

describe('groupChanges', () => {
  it('groups changes by root dependency', async () => {
    const goodGraph = await parseNpmLockfile('test/fixtures/lockfile-good.json')
    const badGraph = await parseNpmLockfile('test/fixtures/lockfile-bad.json')

    const changes = diffGraphs(goodGraph, badGraph)
    const units = groupChanges(changes, goodGraph, badGraph)

    expect(units.length).toBeGreaterThan(0)

    const lodashUnit = units.find(u => u.root === 'lodash')
    expect(lodashUnit).toBeDefined()
    if (lodashUnit) {
      expect(lodashUnit.changes.length).toBe(1)
      expect(lodashUnit.changes[0]?.name).toBe('lodash')
    }

    const expressUnit = units.find(u => u.root === 'express')
    expect(expressUnit).toBeDefined()
    if (expressUnit) {
      expect(expressUnit.changes.length).toBe(1)
      expect(expressUnit.changes[0]?.name).toBe('express')
    }

    const cookieUnit = units.find(u => u.root === 'cookie')
    expect(cookieUnit).toBeDefined()
    if (cookieUnit) {
      expect(cookieUnit.changes.length).toBe(1)
    }

    const bodyParserUnit = units.find(u => u.root === 'body-parser')
    expect(bodyParserUnit).toBeDefined()
    if (bodyParserUnit) {
      expect(bodyParserUnit.changes.length).toBe(1)
    }
  })

  it('sorts units by root name', async () => {
    const goodGraph = await parseNpmLockfile('test/fixtures/lockfile-good.json')
    const badGraph = await parseNpmLockfile('test/fixtures/lockfile-bad.json')

    const changes = diffGraphs(goodGraph, badGraph)
    const units = groupChanges(changes, goodGraph, badGraph)

    for (let i = 1; i < units.length; i++) {
      const prev = units[i - 1]
      const curr = units[i]
      if (prev && curr) {
        expect(curr.root.localeCompare(prev.root)).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('sorts changes within each unit', async () => {
    const goodGraph = await parseNpmLockfile('test/fixtures/lockfile-good.json')
    const badGraph = await parseNpmLockfile('test/fixtures/lockfile-bad.json')

    const changes = diffGraphs(goodGraph, badGraph)
    const units = groupChanges(changes, goodGraph, badGraph)

    for (const unit of units) {
      for (let i = 1; i < unit.changes.length; i++) {
        const prev = unit.changes[i - 1]
        const curr = unit.changes[i]
        if (prev && curr) {
          expect(curr.id.localeCompare(prev.id)).toBeGreaterThanOrEqual(0)
        }
      }
    }
  })
})