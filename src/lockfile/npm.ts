import { readFile } from 'node:fs/promises'
import type { Graph, PkgNode } from '../types.js'

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

function normalizePath(pkgPath: string): string {
  if (pkgPath === '') return 'ROOT'
  return pkgPath.replace(/^node_modules\//, '')
}

export async function parseNpmLockfile(lockfilePath: string): Promise<Graph> {
  const content = await readFile(lockfilePath, 'utf-8')
  const lockfile = JSON.parse(content) as LockfileV3

  if (lockfile.lockfileVersion !== 3) {
    throw new Error(`Expected lockfileVersion 3, got ${lockfile.lockfileVersion}`)
  }

  const graph = new Map<string, PkgNode>()

  for (const [pkgPath, pkgInfo] of Object.entries(lockfile.packages)) {
    const normalizedPath = normalizePath(pkgPath)

    const parents: string[] = []
    if (normalizedPath !== 'ROOT') {
      const pathParts = normalizedPath.split('/')
      for (let i = 1; i < pathParts.length; i++) {
        const parentPath = pathParts.slice(0, i).join('/')
        parents.push(parentPath === '' ? 'ROOT' : parentPath)
      }
    }

    const node: PkgNode = {
      name: pkgInfo.version ? (lockfile.packages['']?.version ? lockfile.name : normalizedPath.split('/').pop() || 'unknown') : 'unknown',
      version: pkgInfo.version || '0.0.0',
      integrity: pkgInfo.integrity || '',
      resolved: pkgInfo.resolved || '',
      path: normalizedPath,
      parents
    }

    if (normalizedPath === 'ROOT') {
      node.name = lockfile.name
      node.version = lockfile.version
    } else {
      const nameFromPath = normalizedPath.split('/').pop()
      if (nameFromPath) {
        node.name = nameFromPath.startsWith('@')
          ? `${normalizedPath.split('/').slice(-2).join('/')}`
          : nameFromPath
      }
    }

    graph.set(normalizedPath, node)
  }

  return graph
}