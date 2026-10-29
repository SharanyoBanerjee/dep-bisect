import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'

export interface ExecResult {
  exitCode: number | null
  stdout: string
  stderr: string
  timedOut: boolean
  killed: boolean
}

export interface ExecOptions {
  cwd?: string
  timeoutMs?: number
  env?: Record<string, string>
  onStdout?: (chunk: string) => void
  onStderr?: (chunk: string) => void
}

function killProcessTree(pid: number, signal: NodeJS.Signals = 'SIGKILL'): void {
  try {
    process.kill(-pid, signal)
  } catch {
    try {
      process.kill(pid, signal)
    } catch {
      // process already dead
    }
  }
}

export async function execCommand(
  command: string,
  args: string[],
  options: ExecOptions = {}
): Promise<ExecResult> {
  const {
    cwd = process.cwd(),
    timeoutMs = 120000,
    env = {},
    onStdout,
    onStderr
  } = options

  const trialId = randomUUID()
  const mergedEnv = {
    ...process.env,
    ...env,
    DEP_BISECT_TRIAL_ID: trialId
  }

  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let killed = false
    let exited = false

    const child = spawn(command, args, {
      cwd,
      env: mergedEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true
    })

    const timeoutHandle = setTimeout(() => {
      if (!exited) {
        timedOut = true
        killed = true
        killProcessTree(child.pid!)
        child.kill('SIGKILL')
      }
    }, timeoutMs)

    child.stdout?.on('data', (chunk: Buffer) => {
      const str = chunk.toString()
      stdout += str
      onStdout?.(str)
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      const str = chunk.toString()
      stderr += str
      onStderr?.(str)
    })

    child.on('error', (err) => {
      if (!exited) {
        exited = true
        clearTimeout(timeoutHandle)
        resolve({
          exitCode: null,
          stdout,
          stderr: stderr + '\n' + err.message,
          timedOut: false,
          killed: false
        })
      }
    })

    child.on('close', (code, _signal) => {
      if (!exited) {
        exited = true
        clearTimeout(timeoutHandle)
        resolve({
          exitCode: code,
          stdout,
          stderr,
          timedOut,
          killed
        })
      }
    })

    child.unref()
  })
}

export async function execShell(
  command: string,
  options: ExecOptions = {}
): Promise<ExecResult> {
  return execCommand('sh', ['-c', command], options)
}