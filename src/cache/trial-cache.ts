import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { Change } from '../types.js'

export interface CacheEntry {
  key: string
  outcome: 'pass' | 'fail' | 'unresolved'
  appliedChangeIds: string[]
  testCommand: string
  nodeVersion: string
  platform: string
  timestamp: number
}

export class TrialCache {
  private cache: Map<string, CacheEntry> = new Map()
  private cachePath: string
  private dirty = false

  constructor(cacheDir?: string) {
    const baseDir = cacheDir || join(homedir(), '.dep-bisect')
    this.cachePath = join(baseDir, 'cache.json')
  }

  async load(): Promise<void> {
    try {
      const content = await readFile(this.cachePath, 'utf-8')
      const data = JSON.parse(content) as CacheEntry[]
      for (const entry of data) {
        this.cache.set(entry.key, entry)
      }
    } catch {
      // Cache file doesn't exist or is invalid, start fresh
    }
  }

  async save(): Promise<void> {
    if (!this.dirty) return
    try {
      await mkdir(join(this.cachePath, '..'), { recursive: true })
      const data = Array.from(this.cache.values())
      await writeFile(this.cachePath, JSON.stringify(data, null, 2))
      this.dirty = false
    } catch {
      // Ignore save errors
    }
  }

  static generateKey(
    appliedChanges: Change[],
    testCommand: string,
    oracleType: string = 'exit-code'
  ): string {
    const changeIds = appliedChanges.map(c => c.id).sort().join(',')
    const input = `${changeIds}|${testCommand}|${oracleType}|${process.version}|${process.platform}`
    return createHash('sha256').update(input).digest('hex').slice(0, 16)
  }

  get(key: string): CacheEntry | undefined {
    return this.cache.get(key)
  }

  set(entry: CacheEntry): void {
    this.cache.set(entry.key, entry)
    this.dirty = true
  }

  has(key: string): boolean {
    return this.cache.has(key)
  }

  size(): number {
    return this.cache.size
  }
}