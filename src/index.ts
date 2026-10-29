export { parseNpmLockfile } from './lockfile/npm.js'
export { diffGraphs } from './graph/diff.js'
export { groupChanges } from './graph/group.js'
export { createWorkspace, writeLockfile, generateTrialId } from './runner/workspace.js'
export { execCommand, execShell } from './runner/exec.js'
export { applyChangesToLockfile, installInWorkspace } from './candidate/install.js'
export { runBaseline, linearSearch } from './search/linear.js'
export { exitCodeOracle } from './oracle/exit-code.js'
export type {
  PkgNode,
  Graph,
  Change,
  ChangeKind,
  Unit,
  Outcome,
  Candidate,
  Oracle,
  BaselineResult,
  TrialResult,
  CulpritResult,
  BisectResult,
  Workspace,
  LinearSearchOptions
} from './types.js'