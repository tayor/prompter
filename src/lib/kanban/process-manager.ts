import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createReadStream } from 'node:fs'
import type { BuiltKanbanCommand } from '@/lib/kanban/command-builder'

export interface ProcessRunOptions {
    timeoutMs: number
    gracePeriodMs: number
    onStdout?: (chunk: string) => void
    onStderr?: (chunk: string) => void
    onSpawn?: (metadata: { pid: number | null, startedAt: Date }) => void
}

export interface ProcessRunResult {
    pid: number | null
    startedAt: Date
    completedAt: Date
    durationMs: number
    exitCode: number | null
    signal: NodeJS.Signals | null
    timedOut: boolean
    cancelled: boolean
    cancelSignal: NodeJS.Signals | null
    stdout: string
    stderr: string
    error?: string
}

export interface RunningProcessSnapshot {
    pid: number | null
    startedAt: Date
    command: string
    args: string[]
    cwd: string
}

interface RunningProcessState {
    child: ChildProcessWithoutNullStreams
    command: BuiltKanbanCommand
    startedAt: Date
    timeoutHandle?: NodeJS.Timeout
    timedOut: boolean
    cancelled: boolean
    cancelSignal: NodeJS.Signals | null
    cancelPromise: Promise<boolean> | null
}

export class KanbanProcessManager {
    private runningProcess: RunningProcessState | null = null

    public isRunning(): boolean {
        return this.runningProcess !== null
    }

    public getRunningProcess(): RunningProcessSnapshot | null {
        if (!this.runningProcess) {
            return null
        }

        return {
            pid: this.runningProcess.child.pid ?? null,
            startedAt: this.runningProcess.startedAt,
            command: this.runningProcess.command.command,
            args: this.runningProcess.command.args,
            cwd: this.runningProcess.command.cwd,
        }
    }

    public async run(command: BuiltKanbanCommand, options: ProcessRunOptions): Promise<ProcessRunResult> {
        if (this.runningProcess) {
            throw new Error('A kanban task process is already running')
        }

        const startedAt = new Date()
        const stdoutChunks: string[] = []
        const stderrChunks: string[] = []
        let processError: string | undefined

        return await new Promise<ProcessRunResult>((resolve) => {
            const child = spawn(command.command, command.args, {
                cwd: command.cwd,
                env: command.env,
                shell: false,
                stdio: ['pipe', 'pipe', 'pipe'],
            })

            const state: RunningProcessState = {
                child,
                command,
                startedAt,
                timedOut: false,
                cancelled: false,
                cancelSignal: null,
                cancelPromise: null,
            }

            this.runningProcess = state

            if (options.timeoutMs > 0) {
                state.timeoutHandle = setTimeout(() => {
                    void this.cancel(options.gracePeriodMs, true)
                }, options.timeoutMs)
            }

            child.stdout.setEncoding('utf8')
            child.stderr.setEncoding('utf8')

            child.stdout.on('data', (chunk: string) => {
                stdoutChunks.push(chunk)
                options.onStdout?.(chunk)
            })

            child.stderr.on('data', (chunk: string) => {
                stderrChunks.push(chunk)
                options.onStderr?.(chunk)
            })

            child.on('spawn', () => {
                options.onSpawn?.({
                    pid: child.pid ?? null,
                    startedAt,
                })
            })

            child.on('error', (error: Error) => {
                processError = error.message
            })

            child.on('close', (exitCode, signal) => {
                if (state.timeoutHandle) {
                    clearTimeout(state.timeoutHandle)
                }

                this.runningProcess = null

                const completedAt = new Date()
                resolve({
                    pid: child.pid ?? null,
                    startedAt,
                    completedAt,
                    durationMs: completedAt.getTime() - startedAt.getTime(),
                    exitCode,
                    signal,
                    timedOut: state.timedOut,
                    cancelled: state.cancelled,
                    cancelSignal: state.cancelSignal,
                    stdout: stdoutChunks.join(''),
                    stderr: stderrChunks.join(''),
                    error: processError,
                })
            })

            if (command.stdinFilePath) {
                const input = createReadStream(command.stdinFilePath)
                input.on('error', (error) => {
                    const message = `Failed to read stdin file "${command.stdinFilePath}": ${error.message}`
                    stderrChunks.push(`${message}\n`)
                    options.onStderr?.(`${message}\n`)
                    child.stdin.end()
                })
                input.pipe(child.stdin)
            } else {
                child.stdin.end()
            }
        })
    }

    public async cancel(gracePeriodMs: number, timedOut = false): Promise<boolean> {
        const state = this.runningProcess
        if (!state) {
            return false
        }

        if (state.cancelPromise) {
            return state.cancelPromise
        }

        state.cancelled = true
        state.timedOut = state.timedOut || timedOut
        state.cancelSignal = 'SIGTERM'

        state.cancelPromise = (async () => {
            if (state.child.exitCode !== null || state.child.signalCode !== null) {
                return false
            }

            state.child.kill('SIGTERM')
            const exitedGracefully = await waitForExit(state.child, gracePeriodMs)

            if (!exitedGracefully && state.child.exitCode === null && state.child.signalCode === null) {
                state.cancelSignal = 'SIGKILL'
                state.child.kill('SIGKILL')
            }

            return true
        })()

        return state.cancelPromise
    }
}

function waitForExit(child: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) {
            resolve(true)
            return
        }

        const onClose = () => {
            clearTimeout(timeoutHandle)
            resolve(true)
        }

        const timeoutHandle = setTimeout(() => {
            child.off('close', onClose)
            resolve(false)
        }, timeoutMs)

        child.once('close', onClose)
    })
}
