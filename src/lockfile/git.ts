import { execCommand } from '../runner/exec.js'
import { parseNpmLockfile } from './npm.js'
import type { Graph } from '../types.js'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'

export async function loadLockfileFromGitRef(
  projectPath: string,
  ref: string
): Promise<Graph> {
  const tempDir = await mkdtemp(join(tmpdir(), 'dep-bisect-git-'))

  try {
    // Get the lockfile at the git ref
    const result = await execCommand('git', ['show', `${ref}:package-lock.json`], {
      cwd: projectPath,
      timeoutMs: 30000,
    })

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get lockfile from git ref ${ref}: ${result.stderr}`)
    }

    const lockfilePath = join(tempDir, 'package-lock.json')
    await import('node:fs/promises').then(fs => fs.writeFile(lockfilePath, result.stdout))

    return parseNpmLockfile(lockfilePath)
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }
}