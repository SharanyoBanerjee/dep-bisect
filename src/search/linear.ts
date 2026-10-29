import type { Unit, Change, Graph, Outcome, BaselineResult, TrialResult } from '../types.js'
import { execCommand } from '../runner/exec.js'
import { installInWorkspace, installLockfile } from '../candidate/install.js'
import { createWorkspace } from '../runner/workspace.js'

export interface LinearSearchOptions {
  goodLockfile: string
  badLockfile: string
  projectPath: string
  testCommand: string
  units: Unit[]
  goodGraph: Graph
  badGraph: Graph
  baselineRuns?: number
}

export async function runBaseline(
  goodLockfile: string,
  badLockfile: string,
  projectPath: string,
  testCommand: string,
  runs: number = 3
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

function applyChangesFromUnits(units: Unit[], unitIds: string[]): Change[] {
  const changes: Change[] = []
  for (const unit of units) {
    if (unitIds.includes(unit.id)) {
      changes.push(...unit.changes)
    }
  }
  return changes
}

export async function linearSearch(options: LinearSearchOptions): Promise<{
  culpritUnit: Unit | null
  trials: TrialResult[]
  baseline: BaselineResult
}> {
  const { goodLockfile, badLockfile, projectPath, testCommand, units, baselineRuns = 3 } = options

  const baseline = await runBaseline(goodLockfile, badLockfile, projectPath, testCommand, baselineRuns)

  if (baseline.goodPasses !== baselineRuns) {
    throw new Error(`Baseline invalid: good state failed ${baselineRuns - baseline.goodPasses}/${baselineRuns} runs`)
  }

  if (baseline.badFails !== baselineRuns) {
    throw new Error(`Baseline invalid: bad state passed ${baselineRuns - baseline.badFails}/${baselineRuns} runs`)
  }

  const workspace = await createWorkspace(projectPath)
  const trials: TrialResult[] = []
  let culpritUnit: Unit | null = null
  let trialNumber = 1

  try {
    for (const unit of units) {
      const startTime = Date.now()
      const changes = applyChangesFromUnits(units, [unit.id])

      const installResult = await installInWorkspace(workspace.path, goodLockfile, badLockfile, changes)
      
      let outcome: Outcome = 'unresolved'
      let testOutput = ''
      
      if (installResult.exitCode === 0) {
        const testResult = await execCommand('sh', ['-c', testCommand], { cwd: workspace.path, timeoutMs: 120000 })
        testOutput = testResult.stdout + testResult.stderr
        outcome = testResult.exitCode === 0 ? 'pass' : 'fail'
      } else {
        testOutput = installResult.stdout + installResult.stderr
      }

      const durationMs = Date.now() - startTime

      trials.push({
        trialNumber: trialNumber++,
        appliedUnitIds: [unit.id],
        outcome,
        durationMs,
        cacheHit: false,
        output: testOutput
      })

      if (outcome === 'fail') {
        culpritUnit = unit
        break
      }
    }
  } finally {
    await workspace.cleanup()
  }

  return { culpritUnit, trials, baseline }
}