import { Command } from 'commander'
import { parseNpmLockfile } from '../lockfile/npm.js'
import { diffGraphs } from '../graph/diff.js'
import { groupChanges } from '../graph/group.js'
import type { Graph, Unit } from '../types.js'

async function loadGraph(source: string): Promise<Graph> {
  if (source.endsWith('.json') || source.includes('package-lock')) {
    return parseNpmLockfile(source)
  }
  throw new Error(`Unsupported source: ${source}. Only package-lock.json files supported in v0.1.`)
}

function printUnits(units: Unit[]): void {
  console.log(`${units.length} units:`)
  for (const unit of units) {
    console.log(`  ${unit.root} (${unit.changes.length} changes)`)
    for (const change of unit.changes) {
      const from = change.from ? `${change.from} -> ` : ''
      const to = change.to || ''
      console.log(`    ${change.kind.padEnd(7)} ${change.name} ${from}${to}  [${change.path}]`)
    }
  }
}

export const diffCommand = new Command('diff')
  .description('Show grouped differences between two lockfiles')
  .argument('<good>', 'good lockfile (package-lock.json or git ref)')
  .argument('<bad>', 'bad lockfile (package-lock.json or git ref)')
  .action(async (good: string, bad: string) => {
    try {
      const goodGraph = await loadGraph(good)
      const badGraph = await loadGraph(bad)

      const changes = diffGraphs(goodGraph, badGraph)
      const units = groupChanges(changes, goodGraph, badGraph)

      console.log(`${changes.length} packages changed, grouped into ${units.length} units\n`)
      printUnits(units)
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  })