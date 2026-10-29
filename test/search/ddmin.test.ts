import { describe, it, expect } from 'vitest'
import { ddmin } from '../../src/search/ddmin.js'
import type { Unit, Outcome } from '../../src/types.js'

function createUnits(count: number): Unit[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `unit:${i + 1}`,
    root: `pkg${i + 1}`,
    changes: [{ id: `change:${i + 1}`, name: `pkg${i + 1}`, kind: 'bumped' as const, path: `pkg${i + 1}`, from: '1.0.0', to: '2.0.0' }]
  }))
}

describe('ddmin', () => {
  it('finds single culprit in the middle', async () => {
    const units = createUnits(8)
    const culpritIndex = 3
    
    const test = async (unitIds: string[]): Promise<Outcome> => {
      return unitIds.includes(`unit:${culpritIndex + 1}`) ? 'fail' : 'pass'
    }

    const result = await ddmin({ units, test })
    expect(result.culpritUnitIds).toEqual([`unit:${culpritIndex + 1}`])
  })

  it('finds single culprit at the start', async () => {
    const units = createUnits(8)
    const culpritIndex = 0
    
    const test = async (unitIds: string[]): Promise<Outcome> => {
      return unitIds.includes(`unit:${culpritIndex + 1}`) ? 'fail' : 'pass'
    }

    const result = await ddmin({ units, test })
    expect(result.culpritUnitIds).toEqual([`unit:${culpritIndex + 1}`])
  })

  it('finds single culprit at the end', async () => {
    const units = createUnits(8)
    const culpritIndex = 7
    
    const test = async (unitIds: string[]): Promise<Outcome> => {
      return unitIds.includes(`unit:${culpritIndex + 1}`) ? 'fail' : 'pass'
    }

    const result = await ddmin({ units, test })
    expect(result.culpritUnitIds).toEqual([`unit:${culpritIndex + 1}`])
  })

  it('finds interacting pair (both must be present to fail)', async () => {
    const units = createUnits(8)
    const culpritIndices = [2, 5]
    
    const test = async (unitIds: string[]): Promise<Outcome> => {
      const has2 = unitIds.includes('unit:3')
      const has5 = unitIds.includes('unit:6')
      return (has2 && has5) ? 'fail' : 'pass'
    }

    const result = await ddmin({ units, test })
    expect(result.culpritUnitIds.sort()).toEqual(['unit:3', 'unit:6'].sort())
  })

  it('handles unresolved outcomes by trying another split', async () => {
    const units = createUnits(8)
    let callCount = 0
    
    const test = async (unitIds: string[]): Promise<Outcome> => {
      callCount++
      // First call returns unresolved, then normal behavior
      if (callCount === 1) return 'unresolved'
      return unitIds.includes('unit:4') ? 'fail' : 'pass'
    }

    const result = await ddmin({ units, test })
    expect(result.culpritUnitIds).toEqual(['unit:4'])
  })

  it('handles all pass (no culprit)', async () => {
    const units = createUnits(4)
    
    const test = async (_unitIds: string[]): Promise<Outcome> => {
      return 'pass'
    }

    const result = await ddmin({ units, test, minGranularity: 1 })
    expect(result.culpritUnitIds).toEqual([])
  }, { timeout: 5000 })

  it('handles all fail (everything fails) - returns 1-minimal subset', async () => {
    const units = createUnits(4)
    
    const test = async (_unitIds: string[]): Promise<Outcome> => {
      return 'fail'
    }

    const result = await ddmin({ units, test, minGranularity: 1 })
    // ddmin returns a 1-minimal failing subset (single element when all fail)
    expect(result.culpritUnitIds.length).toBe(1)
    expect(units.map(u => u.id)).toContain(result.culpritUnitIds[0])
  }, { timeout: 5000 })

  it('reports trial count', async () => {
    const units = createUnits(8)
    let trialCount = 0
    
    const test = async (unitIds: string[]): Promise<Outcome> => {
      trialCount++
      return unitIds.includes('unit:4') ? 'fail' : 'pass'
    }

    const result = await ddmin({ units, test })
    expect(result.trials).toBeGreaterThan(0)
  })
})