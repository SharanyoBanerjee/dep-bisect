import type { Change } from '../types.js'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execCommand } from '../runner/exec.js'

interface LockfileV3 {
  name: string
  version: string
  lockfileVersion: 3
  packages: Record<string, LockfilePackage>
  dependencies?: Record<string, string>
}

interface LockfilePackage {
  version: string
  integrity?: string
  resolved?: string
  dependencies?: Record<string, string>
  dev?: boolean
  optional?: boolean
}

function denormalizePath(path: string): string {
  if (path === 'ROOT') return ''
  return `node_modules/${path}`
}

export async function applyChangesToLockfile(
  goodLockfilePath: string,
  badLockfilePath: string,
  changes: Change[],
  outputPath: string
): Promise<void> {
  const goodContent = await readFile(goodLockfilePath, 'utf-8')
  const badContent = await readFile(badLockfilePath, 'utf-8')

  const goodLockfile = JSON.parse(goodContent) as LockfileV3
  const badLockfile = JSON.parse(badContent) as LockfileV3

  const resultLockfile: LockfileV3 = {
    ...goodLockfile,
    packages: { ...goodLockfile.packages }
  }

  for (const change of changes) {
    const denormPath = denormalizePath(change.path)

    if (change.kind === 'added' || change.kind === 'bumped') {
      const badPkg = badLockfile.packages[denormPath]
      if (badPkg) {
        resultLockfile.packages[denormPath] = { ...badPkg }
      }
    } else if (change.kind === 'removed') {
      delete resultLockfile.packages[denormPath]
    }
  }

  await writeFile(outputPath, JSON.stringify(resultLockfile, null, 2))
}

export async function installInWorkspace(
  workspacePath: string,
  goodLockfilePath: string,
  badLockfilePath: string,
  changes: Change[]
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const tempLockfile = join(workspacePath, 'package-lock.json.tmp')
  await applyChangesToLockfile(goodLockfilePath, badLockfilePath, changes, tempLockfile)

  const targetLockfile = join(workspacePath, 'package-lock.json')
  await import('node:fs/promises').then(fs => fs.copyFile(tempLockfile, targetLockfile))

  const result = await execCommand('npm', ['ci', '--ignore-scripts'], {
    cwd: workspacePath,
    timeoutMs: 300000
  })

  return {
    exitCode: result.exitCode ?? -1,
    stdout: result.stdout,
    stderr: result.stderr
  }
}

export async function installLockfile(
  workspacePath: string,
  lockfilePath: string
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const targetLockfile = join(workspacePath, 'package-lock.json')
  await import('node:fs/promises').then(fs => fs.copyFile(lockfilePath, targetLockfile))

  const result = await execCommand('npm', ['ci', '--ignore-scripts'], {
    cwd: workspacePath,
    timeoutMs: 300000
  })

  return {
    exitCode: result.exitCode ?? -1,
    stdout: result.stdout,
    stderr: result.stderr
  }
}