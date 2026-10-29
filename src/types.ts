export type PkgNode = {
  name: string
  version: string
  integrity: string
  resolved: string
  path: string
  parents: string[]
}

export type Graph = Map<string, PkgNode>

export type ChangeKind = 'added' | 'removed' | 'bumped'

export type Change = {
  id: string
  name: string
  from?: string
  to?: string
  kind: ChangeKind
  path: string
}

export type Unit = {
  id: string
  root: string
  changes: Change[]
}

export type Outcome = 'pass' | 'fail' | 'unresolved'

export type Candidate = {
  appliedChanges: Change[]
  goodGraph: Graph
  badGraph: Graph
}

export type Oracle = (candidate: Candidate) => Promise<Outcome>

export type BaselineResult = {
  goodPasses: number
  badFails: number
  goodOutput?: string
  badOutput?: string
}

export type TrialResult = {
  trialNumber: number
  appliedUnitIds: string[]
  outcome: Outcome
  durationMs: number
  cacheHit: boolean
  output?: string
}

export type CulpritResult = {
  name: string
  from: string
  to: string
  firstBadVersion?: string
  via: string[]
  failingTests: string[]
  flags: string[]
  confirmedByInstall: boolean
}

export type BisectResult =
  | { status: 'culprit'; culprit: CulpritResult; trials: TrialResult[]; cacheHits: number; durationMs: number; baseline: BaselineResult }
  | { status: 'inconclusive'; reason: string; trials: TrialResult[]; cacheHits: number; durationMs: number; baseline: BaselineResult }
  | { status: 'no-failure'; trials: TrialResult[]; cacheHits: number; durationMs: number; baseline: BaselineResult }
  | { status: 'baseline-invalid'; reason: string; baseline: BaselineResult }
  | { status: 'error'; message: string; trials: TrialResult[]; cacheHits: number; durationMs: number; baseline: BaselineResult }

export interface Workspace {
  path: string
  cleanup: () => Promise<void>
}

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