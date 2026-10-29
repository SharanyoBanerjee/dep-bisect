import type { BisectResult, TrialResult, CulpritResult, Unit, BaselineResult } from '../types.js'

function isCulpritResult(result: BisectResult): result is BisectResult & { status: 'culprit'; culprit: CulpritResult; baseline: BaselineResult } {
  return result.status === 'culprit'
}

function isInconclusiveResult(result: BisectResult): result is BisectResult & { status: 'inconclusive'; reason: string; baseline: BaselineResult } {
  return result.status === 'inconclusive'
}

function isNoFailureResult(result: BisectResult): result is BisectResult & { status: 'no-failure'; baseline: BaselineResult } {
  return result.status === 'no-failure'
}

function isBaselineInvalidResult(result: BisectResult): result is BisectResult & { status: 'baseline-invalid'; reason: string; baseline: BaselineResult } {
  return result.status === 'baseline-invalid'
}

function isErrorResult(result: BisectResult): result is BisectResult & { status: 'error'; message: string; baseline: BaselineResult } {
  return result.status === 'error'
}

export function printTerminalReport(result: BisectResult, goodSource: string, badSource: string, units: Unit[]): void {
  const totalChanges = units.reduce((sum, u) => sum + u.changes.length, 0)
  console.log(`${totalChanges} packages changed, grouped into ${units.length} units\n`)

  if (isCulpritResult(result)) {
    printBaseline(result.baseline)
    printTrials(result.trials)
    printCulprit(result.culprit)
    printSummary(result.trials.length, result.cacheHits, result.durationMs)
  } else if (isInconclusiveResult(result)) {
    printBaseline(result.baseline)
    printTrials(result.trials)
    console.log('\nInconclusive')
    console.log(`  ${result.reason}`)
    printSummary(result.trials.length, result.cacheHits, result.durationMs)
  } else if (isNoFailureResult(result)) {
    printBaseline(result.baseline)
    printTrials(result.trials)
    console.log('\nNo culprit found (all units pass)')
    printSummary(result.trials.length, result.cacheHits, result.durationMs)
  } else if (isBaselineInvalidResult(result)) {
    console.log('\nBaseline invalid')
    console.log(`  ${result.reason}`)
    if (result.baseline.goodOutput) {
      console.log('  Last good output:')
      console.log('  ' + result.baseline.goodOutput.split('\n').slice(-10).join('\n  '))
    }
    if (result.baseline.badOutput) {
      console.log('  Last bad output:')
      console.log('  ' + result.baseline.badOutput.split('\n').slice(-10).join('\n  '))
    }
  } else if (isErrorResult(result)) {
    console.log('\nError')
    console.log(`  ${result.message}`)
  }
}

function printBaseline(baseline: { goodPasses: number; badFails: number }): void {
  console.log(`baseline  good passes ${baseline.goodPasses}   bad fails ${baseline.badFails}`)
}

function printTrials(trials: TrialResult[]): void {
  console.log('\ntrial  units        result      time')
  for (const trial of trials) {
    const unitsStr = trial.appliedUnitIds.join(',')
    const resultStr = trial.outcome === 'fail' ? 'FAIL' : trial.outcome === 'pass' ? 'pass' : 'unresolved'
    const timeStr = trial.cacheHit ? '(cache)' : `${trial.durationMs}ms`
    console.log(`  ${String(trial.trialNumber).padStart(2)}    ${unitsStr.padEnd(12)} ${resultStr.padEnd(10)} ${timeStr}`)
  }
}

function printCulprit(culprit: CulpritResult): void {
  console.log('\nCulprit')
  console.log(`  ${culprit.name}  ${culprit.from} -> ${culprit.to}        via ${culprit.via.join(', ')}`)
  if (culprit.firstBadVersion) {
    console.log(`  first bad version   ${culprit.firstBadVersion}`)
  }
  if (culprit.failingTests.length > 0) {
    console.log(`  failing test        ${culprit.failingTests.join(', ')}`)
  }
  if (culprit.flags.length > 0) {
    console.log(`  flags               ${culprit.flags.join(', ')}`)
  }
  console.log(`  confirmed by install: ${culprit.confirmedByInstall ? 'yes' : 'no'}`)
}

function printSummary(trials: number, cacheHits: number, durationMs: number): void {
  const minutes = Math.floor(durationMs / 60000)
  const seconds = Math.floor((durationMs % 60000) / 1000)
  const timeStr = minutes > 0 ? `${minutes}m${seconds}s` : `${seconds}s`
  console.log(`\n${trials} trials, ${timeStr}, ${cacheHits} cache hit${cacheHits !== 1 ? 's' : ''}`)
}

interface CulpritJson {
  name: string
  from: string
  to: string
  firstBadVersion?: string
  via: string[]
  failingTests: string[]
  flags: string[]
  confirmedByInstall: boolean
}

export function generateJsonReport(result: BisectResult, goodSource: string, badSource: string): string {
  const json: Record<string, unknown> = {
    status: result.status,
    good: goodSource,
    bad: badSource,
  }

  if (isCulpritResult(result)) {
    const baselineObj = { goodPasses: result.baseline.goodPasses, badFails: result.baseline.badFails }
    json['baseline'] = baselineObj
    const culprit: CulpritJson = {
      name: result.culprit.name,
      from: result.culprit.from,
      to: result.culprit.to,
      firstBadVersion: result.culprit.firstBadVersion,
      via: result.culprit.via,
      failingTests: result.culprit.failingTests,
      flags: result.culprit.flags,
      confirmedByInstall: result.culprit.confirmedByInstall,
    }
    json['culprit'] = culprit
    json['trials'] = result.trials.length
    json['cacheHits'] = result.cacheHits
    json['durationMs'] = result.durationMs
  } else if (isInconclusiveResult(result)) {
    json['baseline'] = { goodPasses: result.baseline.goodPasses, badFails: result.baseline.badFails }
    json['reason'] = result.reason
    json['trials'] = result.trials.length
    json['cacheHits'] = result.cacheHits
    json['durationMs'] = result.durationMs
  } else if (isNoFailureResult(result)) {
    json['baseline'] = { goodPasses: result.baseline.goodPasses, badFails: result.baseline.badFails }
    json['trials'] = result.trials.length
    json['cacheHits'] = result.cacheHits
    json['durationMs'] = result.durationMs
  } else if (isBaselineInvalidResult(result)) {
    json['reason'] = result.reason
    json['baseline'] = { goodPasses: result.baseline.goodPasses, badFails: result.baseline.badFails }
  } else if (isErrorResult(result)) {
    json['message'] = result.message
  }

  return JSON.stringify(json, null, 2)
}

export function generateMarkdownReport(result: BisectResult, _goodSource: string, _badSource: string): string {
  if (!isCulpritResult(result)) {
    const reason = isInconclusiveResult(result) ? result.reason : isBaselineInvalidResult(result) ? result.reason : isErrorResult(result) ? result.message : 'No details available'
    return `# dep-bisect: ${result.status}\n\n${reason}`
  }

  const { culprit } = result
  let md = `### dep-bisect: culprit found\n`
  md += `**${culprit.name}** \`${culprit.from} -> ${culprit.to}\``
  if (culprit.firstBadVersion) {
    md += ` (first bad: \`${culprit.firstBadVersion}\`)`
  }
  md += '\n\n'

  md += '| Check | Result |\n|---|---|\n'
  if (culprit.failingTests.length > 0) {
    md += `| Failing test | \`${culprit.failingTests.join('`, `')}\` |\n`
  }
  if (culprit.flags.length > 0) {
    md += `| Flags | ${culprit.flags.join(', ')} |\n`
  }
  md += '\n'

  md += `**Suggested fix:** \`npm pkg set overrides.${culprit.name}=${culprit.from}\`\n`
  md += `Confirmed with a real install (${culprit.confirmedByInstall ? 'yes' : 'no'}). `
  md += `${result.trials.length} trials in ${formatDuration(result.durationMs)}.\n`

  return md
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return minutes > 0 ? `${minutes}m${seconds}s` : `${seconds}s`
}