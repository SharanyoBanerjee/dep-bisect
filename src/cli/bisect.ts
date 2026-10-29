import { Command } from 'commander'
import { dirname } from 'node:path'
import { parseNpmLockfile } from '../lockfile/npm.js'
import { loadLockfileFromGitRef } from '../lockfile/git.js'
import { diffGraphs } from '../graph/diff.js'
import { groupChanges } from '../graph/group.js'
import { ddmin } from '../search/ddmin.js'
import { TrialCache } from '../cache/trial-cache.js'
import { printTerminalReport, generateJsonReport } from '../report/terminal.js'
import { createWorkspace } from '../runner/workspace.js'
import { installLockfile } from '../candidate/install.js'
import { execCommand } from '../runner/exec.js'
import { installInWorkspace } from '../candidate/install.js'
import type { Graph, Unit, Change, Outcome, TrialResult, BaselineResult, BisectResult, CulpritResult } from '../types.js'

async function loadGraph(source: string, projectPath: string): Promise<Graph> {
  if (source.endsWith('.json') || source.includes('package-lock')) {
    return parseNpmLockfile(source)
  }
  // Assume it's a git ref
  return loadLockfileFromGitRef(projectPath, source)
}

function applyChangesFromUnits(units: Unit[], unitIds: string[]): Change[] {
  const changes: Change[] = []
  for (const unit of units) {
    if (unitIds.includes(unit.id)) {
      changes.push(...unit.changes)
    }
  }
  return changes
}

async function runBaseline(
  goodLockfile: string,
  badLockfile: string,
  projectPath: string,
  testCommand: string,
  runs: number
): Promise<BaselineResult> {
  let goodPasses = 0
  let badFails = 0
  let goodOutput = ''
  let badOutput = ''

  const workspace = await createWorkspace(projectPath)

  try {
    for (let i = 0; i < runs; i++) {
      const installResult = await installLockfile(workspace.path, goodLockfile)
      if (installResult.exitCode === 0) {
        const testResult = await execCommand('sh', ['-c', testCommand], { cwd: workspace.path, timeoutMs: 120000 })
        if (testResult.exitCode === 0) {
          goodPasses++
        } else {
          goodOutput = testResult.stderr || testResult.stdout
        }
      } else {
        goodOutput = installResult.stderr || installResult.stdout
      }
    }

    for (let i = 0; i < runs; i++) {
      const installResult = await installLockfile(workspace.path, badLockfile)
      if (installResult.exitCode === 0) {
        const testResult = await execCommand('sh', ['-c', testCommand], { cwd: workspace.path, timeoutMs: 120000 })
        if (testResult.exitCode !== 0) {
          badFails++
        } else {
          badOutput = testResult.stderr || testResult.stdout
        }
      } else {
        badOutput = installResult.stderr || installResult.stdout
      }
    }
  } finally {
    await workspace.cleanup()
  }

  return { goodPasses, badFails, goodOutput, badOutput }
}

export const bisectCommand = new Command('bisect')
  .description('Find which dependency update broke your build')
  .requiredOption('--good <path>', 'good lockfile (package-lock.json)')
  .requiredOption('--bad <path>', 'bad lockfile (package-lock.json)')
  .requiredOption('--test <command>', 'test command to run')
  .option('--runs <number>', 'baseline runs', '3')
  .option('--json', 'output JSON report')
  .action(async (options) => {
    const startTime = Date.now()
    let cacheHits = 0

    try {
      const runs = parseInt(options.runs, 10)
      const projectPath = dirname(options.good)
      const goodGraph = await loadGraph(options.good, projectPath)
      const badGraph = await loadGraph(options.bad, projectPath)

      const changes = diffGraphs(goodGraph, badGraph)
      const units = groupChanges(changes, goodGraph, badGraph)

      // Run baseline
      const baseline = await runBaseline(options.good, options.bad, dirname(options.good), options.test, runs)

      if (baseline.goodPasses !== runs) {
        const result: BisectResult = {
          status: 'baseline-invalid',
          reason: `Good state failed ${runs - baseline.goodPasses}/${runs} runs`,
          baseline,
        }
        if (options.json) {
          console.log(generateJsonReport(result, options.good, options.bad))
        } else {
          printTerminalReport(result, options.good, options.bad, units)
        }
        process.exit(3)
      }

      if (baseline.badFails !== runs) {
        const result: BisectResult = {
          status: 'baseline-invalid',
          reason: `Bad state passed ${runs - baseline.badFails}/${runs} runs`,
          baseline,
        }
        if (options.json) {
          console.log(generateJsonReport(result, options.good, options.bad))
        } else {
          printTerminalReport(result, options.good, options.bad, units)
        }
        process.exit(3)
      }

      // Load cache
      const cache = new TrialCache()
      await cache.load()

      // Run ddmin search
      let trialNumber = 0
      const trials: TrialResult[] = []

      const testFn = async (unitIds: string[]): Promise<Outcome> => {
        trialNumber++
        const changesToApply = applyChangesFromUnits(units, unitIds)
        const cacheKey = TrialCache.generateKey(changesToApply, options.test)

        const cached = cache.get(cacheKey)
        if (cached) {
          cacheHits++
          trials.push({
            trialNumber,
            appliedUnitIds: unitIds,
            outcome: cached.outcome,
            durationMs: 0,
            cacheHit: true,
          })
          return cached.outcome
        }

        const workspace = await createWorkspace(dirname(options.good))
        let outcome: Outcome = 'unresolved'

        try {
          const installResult = await installInWorkspace(workspace.path, options.good, options.bad, changesToApply)
          
          if (installResult.exitCode === 0) {
            const testResult = await execCommand('sh', ['-c', options.test], { cwd: workspace.path, timeoutMs: 120000 })
            outcome = testResult.exitCode === 0 ? 'pass' : 'fail'
          }
        } finally {
          await workspace.cleanup()
        }

        trials.push({
          trialNumber,
          appliedUnitIds: unitIds,
          outcome,
          durationMs: 0, // TODO: track actual duration
          cacheHit: false,
        })

        cache.set({
          key: cacheKey,
          outcome,
          appliedChangeIds: changesToApply.map(c => c.id),
          testCommand: options.test,
          nodeVersion: process.version,
          platform: process.platform,
          timestamp: Date.now(),
        })

        return outcome
      }

      const ddminResult = await ddmin({ units, test: testFn })

      // Save cache
      await cache.save()

      // Build culprit result
      let result: BisectResult
      if (ddminResult.culpritUnitIds.length === 0) {
        result = {
          status: 'no-failure',
          trials,
          cacheHits,
          durationMs: Date.now() - startTime,
          baseline,
        }
      } else {
        // Get the culprit unit details
        const culpritUnitIds = ddminResult.culpritUnitIds
        const culpritUnits = units.filter(u => culpritUnitIds.includes(u.id))
        const culpritChanges = culpritUnits.flatMap(u => u.changes)
        
        const culprit: CulpritResult = {
          name: culpritChanges[0]?.name || 'unknown',
          from: culpritChanges[0]?.from || '',
          to: culpritChanges[0]?.to || '',
          via: culpritUnits.map(u => u.root),
          failingTests: [],
          flags: [],
          confirmedByInstall: true, // TODO: verify with real install
        }

        result = {
          status: 'culprit',
          culprit,
          trials,
          cacheHits,
          durationMs: Date.now() - startTime,
          baseline,
        }
      }

      if (options.json) {
        console.log(generateJsonReport(result, options.good, options.bad))
      } else {
        printTerminalReport(result, options.good, options.bad, units)
      }

      if (result.status !== 'culprit') {
        process.exit(1)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const result: BisectResult = {
        status: 'error',
        message,
        trials: [],
        cacheHits: 0,
        durationMs: Date.now() - startTime,
        baseline: { goodPasses: 0, badFails: 0 },
      }
      
      if (options.json) {
        console.log(generateJsonReport(result, options.good, options.bad))
      } else {
        printTerminalReport(result, options.good, options.bad, [])
      }
      process.exit(2)
    }
  })