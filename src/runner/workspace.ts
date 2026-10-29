import { mkdtemp, rm, cp, copyFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

export interface Workspace {
  path: string
  cleanup: () => Promise<void>
}

export async function createWorkspace(projectPath: string): Promise<Workspace> {
  const prefix = join(tmpdir(), 'dep-bisect-')
  const tempDir = await mkdtemp(prefix)

  const projectName = projectPath.split('/').pop() || 'project'
  const workspacePath = join(tempDir, projectName)

  await cp(projectPath, workspacePath, {
    recursive: true,
    filter: (src) => !src.includes('node_modules') && !src.includes('.git')
  })

  return {
    path: workspacePath,
    cleanup: async () => {
      try {
        await rm(tempDir, { recursive: true, force: true })
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

export async function writeLockfile(workspacePath: string, lockfileContent: string): Promise<void> {
  const lockfilePath = join(workspacePath, 'package-lock.json')
  await copyFile(lockfilePath, lockfilePath + '.bak')
  await rm(lockfilePath).catch(() => {})
  await import('node:fs/promises').then(fs => fs.writeFile(lockfilePath, lockfileContent))
}

export function generateTrialId(): string {
  return randomBytes(8).toString('hex')
}