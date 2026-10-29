import { describe, it, expect } from 'vitest'
import { parseNpmLockfile } from '../../src/lockfile/npm.js'
import type { Graph } from '../../src/types.js'

describe('parseNpmLockfile', () => {
  it('parses a valid package-lock.json v3', async () => {
    const graph = await parseNpmLockfile('test/fixtures/lockfile-good.json')

    expect(graph).toBeInstanceOf(Map)
    expect(graph.size).toBeGreaterThan(0)

    const root = graph.get('ROOT')
    expect(root).toBeDefined()
    expect(root?.name).toBe('test-project')
    expect(root?.version).toBe('1.0.0')

    const lodash = graph.get('lodash')
    expect(lodash).toBeDefined()
    expect(lodash?.name).toBe('lodash')
    expect(lodash?.version).toBe('4.17.21')

    const express = graph.get('express')
    expect(express).toBeDefined()
    expect(express?.name).toBe('express')
    expect(express?.version).toBe('4.18.2')
  })

  it('throws on non-v3 lockfile', async () => {
    await expect(parseNpmLockfile('test/fixtures/lockfile-v2.json')).rejects.toThrow()
  })
})