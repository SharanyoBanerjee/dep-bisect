import type { Unit, Outcome } from '../types.js'

export interface DDMINOptions {
  units: Unit[]
  test: (unitIds: string[]) => Promise<Outcome>
  minGranularity?: number
}

export interface DDMinResult {
  culpritUnitIds: string[]
  trials: number
}

function chunkArray<T>(array: T[], n: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += n) {
    chunks.push(array.slice(i, i + n))
  }
  return chunks
}

export async function ddmin(options: DDMINOptions): Promise<DDMinResult> {
  const { units, test, minGranularity = 1 } = options
  const unitIds = units.map(u => u.id)
  let granularity = Math.max(2, Math.ceil(unitIds.length / 2))
  let trials = 0

  const runTest = async (ids: string[]): Promise<Outcome> => {
    trials++
    return test(ids)
  }

  let currentSubset = unitIds

  // First check if the full set fails
  const fullOutcome = await runTest(currentSubset)
  if (fullOutcome === 'pass') {
    return { culpritUnitIds: [], trials }
  }
  // If unresolved, continue searching

  while (granularity >= minGranularity) {
    const chunks = chunkArray(currentSubset, granularity)
    let foundSmaller = false

    // Try each chunk
    for (const chunk of chunks) {
      // Skip if chunk is the same as currentSubset (no reduction)
      if (chunk.length === currentSubset.length) continue
      
      const outcome = await runTest(chunk)
      if (outcome === 'fail') {
        currentSubset = chunk
        foundSmaller = true
        break
      }
      if (outcome === 'unresolved') {
        continue
      }
    }

    if (foundSmaller) {
      // Found a smaller failing subset - continue with SAME granularity to minimize further
      continue
    }

    // Try complements
    for (const chunk of chunks) {
      const complement = currentSubset.filter(id => !chunk.includes(id))
      if (complement.length === 0 || complement.length === currentSubset.length) continue
      
      const outcome = await runTest(complement)
      if (outcome === 'fail') {
        currentSubset = complement
        foundSmaller = true
        break
      }
      if (outcome === 'unresolved') {
        continue
      }
    }

    if (foundSmaller) {
      // Found a smaller failing subset via complement - continue with SAME granularity
      continue
    }

    // Neither chunks nor complements failed - check if current subset still fails
    const currentOutcome = await runTest(currentSubset)
    if (currentOutcome !== 'fail') {
      return { culpritUnitIds: [], trials }
    }
    
    if (granularity === minGranularity) {
      break
    }
    granularity = Math.max(minGranularity, Math.floor(granularity / 2))
  }

  // Final verification: test each individual element to find 1-minimal set
  const minimalSubset: string[] = []
  for (const id of currentSubset) {
    const outcome = await runTest([id])
    if (outcome === 'fail') {
      minimalSubset.push(id)
    }
  }

  // If no individual element fails but the subset fails, return the current subset
  // (this handles interacting pairs where multiple elements are needed together)
  return {
    culpritUnitIds: minimalSubset.length > 0 ? minimalSubset : currentSubset,
    trials
  }
}