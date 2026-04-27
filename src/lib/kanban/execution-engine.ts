import type { KanbanExecutionTrigger } from '@prisma/client'
import prisma from '@/lib/prisma'
import { buildKanbanCommand } from '@/lib/kanban/command-builder'
import { resolveQueuedTaskEligibility } from '@/lib/kanban/dependency-resolver'
import { appendExecutionLogChunk, createExecutionLogFile, type KanbanLogStream } from '@/lib/kanban/log-storage'
import { KanbanProcessManager, type ProcessRunResult } from '@/lib/kanban/process-manager'
import { emitKanbanRealtimeEvent } from '@/lib/kanban/realtime-events'
import {
    DEFAULT_TERMINATION_GRACE_SECONDS,
    type KanbanBlockedTaskMetadata,
    type KanbanExecutionCompletionMetadata,
    type KanbanExecutionFailureMetadata,
    type KanbanExecutionStartMetadata,
    type ParsedKanbanTask,
    parseKanbanTaskRecord,
} from '@/lib/kanban/types'

type KanbanPrismaClient = Pick<typeof prisma, 'kanbanTask' | 'kanbanExecution'>
const PROCESS_INTERRUPTED_ERROR = 'Process interrupted by runtime restart'

type ExecuteTaskState = 'busy' | 'idle' | 'blocked' | 'completed' | 'failed' | 'cancelled'

export interface ExecuteNextTaskResult {
    state: ExecuteTaskState
    taskId?: string
    executionId?: string
    blockedTasks: KanbanBlockedTaskMetadata[]
    startMetadata?: KanbanExecutionStartMetadata
    completionMetadata?: KanbanExecutionCompletionMetadata
    failureMetadata?: KanbanExecutionFailureMetadata
    message?: string
}

export interface CancelRunningExecutionResult {
    cancelled: boolean
    pid: number | null
    message: string
}

export interface InterruptedExecutionRecoveryResult {
    recoveredExecutions: number
    recoveredTasks: number
}

interface KanbanExecutionEngineOptions {
    prismaClient?: KanbanPrismaClient
    processManager?: KanbanProcessManager
    now?: () => Date
}

class ExecutionSlotLock {
    private locked = false

    public tryAcquire(): boolean {
        if (this.locked) {
            return false
        }

        this.locked = true
        return true
    }

    public release(): void {
        this.locked = false
    }
}

export class KanbanExecutionEngine {
    private readonly slotLock = new ExecutionSlotLock()
    private readonly prismaClient: KanbanPrismaClient
    private readonly processManager: KanbanProcessManager
    private readonly now: () => Date

    public constructor(options: KanbanExecutionEngineOptions = {}) {
        this.prismaClient = options.prismaClient ?? prisma
        this.processManager = options.processManager ?? new KanbanProcessManager()
        this.now = options.now ?? (() => new Date())
    }

    public async executeNextTask(trigger: KanbanExecutionTrigger = 'auto'): Promise<ExecuteNextTaskResult> {
        if (!this.slotLock.tryAcquire()) {
            return {
                state: 'busy',
                blockedTasks: [],
                message: 'Execution slot is locked',
            }
        }

        try {
            if (this.processManager.isRunning()) {
                return {
                    state: 'busy',
                    blockedTasks: [],
                    message: 'A task process is already running',
                }
            }

            const runningCount = await this.prismaClient.kanbanExecution.count({
                where: { status: 'running' },
            })

            if (runningCount > 0) {
                return {
                    state: 'busy',
                    blockedTasks: [],
                    message: 'Running.count > 0, execution slot unavailable',
                }
            }

            const taskRecords = await this.prismaClient.kanbanTask.findMany({
                orderBy: [
                    { position: 'asc' },
                    { createdAt: 'asc' },
                ],
            })

            const tasks = taskRecords.map(parseKanbanTaskRecord)
            const eligibility = resolveQueuedTaskEligibility(tasks)
            const blockedTasks = this.toBlockedMetadata(eligibility.blocked)
            const queuedCount = tasks.filter((task) => task.column === 'queued').length

            if (!eligibility.nextTask) {
                if (blockedTasks.length > 0) {
                    emitKanbanRealtimeEvent({
                        type: 'dependency:blocked',
                        payload: {
                            blockedCount: blockedTasks.length,
                            queuedCount,
                            blockedTasks: blockedTasks.map((blockedTask) => ({
                                taskId: blockedTask.taskId,
                                blockedByTaskIds: blockedTask.blockedByTaskIds,
                                reason: blockedTask.reason,
                                detectedAt: blockedTask.detectedAt.toISOString(),
                            })),
                        },
                    })
                } else {
                    emitKanbanRealtimeEvent({
                        type: 'queue:empty',
                        payload: {
                            queuedCount,
                            message: 'No queued tasks are eligible',
                        },
                    })
                }

                return {
                    state: blockedTasks.length > 0 ? 'blocked' : 'idle',
                    blockedTasks,
                    message: blockedTasks.length > 0
                        ? 'Queued tasks are dependency-blocked'
                        : 'No queued tasks are eligible',
                }
            }

            return await this.runTaskLifecycle(eligibility.nextTask, trigger, blockedTasks)
        } finally {
            this.slotLock.release()
        }
    }

    public async cancelRunningExecution(
        gracePeriodSeconds = DEFAULT_TERMINATION_GRACE_SECONDS,
    ): Promise<CancelRunningExecutionResult> {
        const running = this.processManager.getRunningProcess()
        if (!running) {
            return {
                cancelled: false,
                pid: null,
                message: 'No running process to cancel',
            }
        }

        const cancelled = await this.processManager.cancel(gracePeriodSeconds * 1000)
        return {
            cancelled,
            pid: running.pid,
            message: cancelled
                ? 'Cancellation requested with SIGTERM (SIGKILL fallback on grace timeout)'
                : 'Process already exited before cancellation',
        }
    }

    public getRunningProcess() {
        return this.processManager.getRunningProcess()
    }

    private async runTaskLifecycle(
        task: ParsedKanbanTask,
        trigger: KanbanExecutionTrigger,
        blockedTasks: KanbanBlockedTaskMetadata[],
    ): Promise<ExecuteNextTaskResult> {
        const execution = await this.prismaClient.kanbanExecution.create({
            data: {
                taskId: task.id,
                status: 'pending',
                trigger,
                configSnapshot: JSON.stringify(task.config),
            },
        })

        const startedAt = this.now()
        let logFile: string | null = null
        let logPersistenceError: string | null = null

        try {
            const createdLogFile = await createExecutionLogFile(execution.id, startedAt)
            logFile = createdLogFile.logFile
        } catch (error) {
            logPersistenceError = getErrorMessage(error)
        }

        const command = buildKanbanCommand(task)

        await Promise.all([
            this.prismaClient.kanbanTask.update({
                where: { id: task.id },
                data: { column: 'running' },
            }),
            this.prismaClient.kanbanExecution.update({
                where: { id: execution.id },
                data: {
                    status: 'running',
                    startedAt,
                    logFile,
                },
            }),
        ])

        let pid: number | null = null
        let logWriteQueue: Promise<void> = Promise.resolve()

        const startMetadata: KanbanExecutionStartMetadata = {
            status: 'running',
            startedAt,
            pid,
            logFile,
            command: command.command,
            args: command.args,
            cwd: command.cwd,
        }

        const enqueueLogWrite = (stream: KanbanLogStream, chunk: string): void => {
            emitKanbanRealtimeEvent({
                type: 'execution:log',
                executionId: execution.id,
                taskId: task.id,
                payload: {
                    stream,
                    data: chunk,
                },
            })

            const targetLogFile = logFile
            if (!targetLogFile || chunk.length === 0 || logPersistenceError) {
                return
            }

            logWriteQueue = logWriteQueue
                .then(() => appendExecutionLogChunk(targetLogFile, stream, chunk))
                .catch((error) => {
                    logPersistenceError = getErrorMessage(error)
                })
        }

        emitKanbanRealtimeEvent({
            type: 'execution:started',
            executionId: execution.id,
            taskId: task.id,
            payload: {
                trigger,
                startedAt: startedAt.toISOString(),
                command: command.displayCommand,
                logFile,
                logPersistenceError,
            },
        })
        emitKanbanRealtimeEvent({
            type: 'engine:status',
            executionId: execution.id,
            taskId: task.id,
            payload: {
                status: 'running',
                executionId: execution.id,
                taskId: task.id,
            },
        })

        try {
            const processResult = await this.processManager.run(command, {
                timeoutMs: task.config.timeout * 1000,
                gracePeriodMs: task.config.gracePeriod * 1000,
                onStdout: (chunk) => {
                    enqueueLogWrite('stdout', chunk)
                },
                onStderr: (chunk) => {
                    enqueueLogWrite('stderr', chunk)
                },
                onSpawn: (spawnMetadata) => {
                    pid = spawnMetadata.pid
                    startMetadata.pid = pid
                },
            })

            await logWriteQueue

            if (startMetadata.pid === null) {
                startMetadata.pid = processResult.pid
            }

            return await this.finalizeExecutionOutcome({
                task,
                executionId: execution.id,
                processResult,
                startMetadata,
                blockedTasks,
                logFile,
                logPersistenceError,
            })
        } catch (error) {
            await logWriteQueue

            const completedAt = this.now()
            const reason = getErrorMessage(error)
            const failureMetadata: KanbanExecutionFailureMetadata = {
                status: 'failed',
                completedAt,
                durationMs: completedAt.getTime() - startedAt.getTime(),
                exitCode: null,
                logFile,
                logPersistenceError: logPersistenceError ?? undefined,
                signal: null,
                timedOut: false,
                cancelled: false,
                reason,
                stdout: '',
                stderr: '',
            }

            await this.persistFailure(execution.id, task.id, failureMetadata, startMetadata.pid)
            emitKanbanRealtimeEvent({
                type: 'execution:failed',
                executionId: execution.id,
                taskId: task.id,
                payload: {
                    taskName: task.raw.displayName || task.name,
                    status: failureMetadata.status,
                    reason: failureMetadata.reason,
                    completedAt: failureMetadata.completedAt.toISOString(),
                    durationMs: failureMetadata.durationMs,
                    exitCode: failureMetadata.exitCode,
                },
            })
            emitKanbanRealtimeEvent({
                type: 'engine:status',
                executionId: execution.id,
                taskId: task.id,
                payload: {
                    status: 'idle',
                },
            })

            return {
                state: 'failed',
                taskId: task.id,
                executionId: execution.id,
                blockedTasks,
                startMetadata,
                failureMetadata,
                message: reason,
            }
        }
    }

    private async finalizeExecutionOutcome(params: {
        task: ParsedKanbanTask
        executionId: string
        processResult: ProcessRunResult
        startMetadata: KanbanExecutionStartMetadata
        blockedTasks: KanbanBlockedTaskMetadata[]
        logFile: string | null
        logPersistenceError: string | null
    }): Promise<ExecuteNextTaskResult> {
        const {
            task,
            executionId,
            processResult,
            startMetadata,
            blockedTasks,
            logFile,
            logPersistenceError,
        } = params

        if (isSuccessfulProcessResult(processResult)) {
            const completionMetadata: KanbanExecutionCompletionMetadata = {
                status: 'completed',
                completedAt: processResult.completedAt,
                durationMs: processResult.durationMs,
                exitCode: processResult.exitCode,
                logFile,
                logPersistenceError: logPersistenceError ?? undefined,
                stdout: processResult.stdout,
                stderr: processResult.stderr,
            }

            await Promise.all([
                this.prismaClient.kanbanTask.update({
                    where: { id: task.id },
                    data: { column: 'completed' },
                }),
                this.prismaClient.kanbanExecution.update({
                    where: { id: executionId },
                    data: {
                        status: 'completed',
                        pid: startMetadata.pid,
                        completedAt: completionMetadata.completedAt,
                        durationMs: completionMetadata.durationMs,
                        exitCode: completionMetadata.exitCode,
                        error: null,
                    },
                }),
            ])
            emitKanbanRealtimeEvent({
                type: 'execution:completed',
                executionId,
                taskId: task.id,
                payload: {
                    taskName: task.raw.displayName || task.name,
                    completedAt: completionMetadata.completedAt.toISOString(),
                    durationMs: completionMetadata.durationMs,
                    exitCode: completionMetadata.exitCode,
                },
            })
            emitKanbanRealtimeEvent({
                type: 'engine:status',
                executionId,
                taskId: task.id,
                payload: {
                    status: 'idle',
                },
            })

            return {
                state: 'completed',
                taskId: task.id,
                executionId,
                blockedTasks,
                startMetadata,
                completionMetadata,
            }
        }

        const status = processResult.cancelled && !processResult.timedOut ? 'cancelled' : 'failed'
        const reason = buildFailureReason(processResult, task.config.timeout)
        const failureMetadata: KanbanExecutionFailureMetadata = {
            status,
            completedAt: processResult.completedAt,
            durationMs: processResult.durationMs,
            exitCode: processResult.exitCode,
            logFile,
            logPersistenceError: logPersistenceError ?? undefined,
            signal: processResult.signal,
            timedOut: processResult.timedOut,
            cancelled: processResult.cancelled,
            reason,
            stdout: processResult.stdout,
            stderr: processResult.stderr,
        }

        await this.persistFailure(executionId, task.id, failureMetadata, startMetadata.pid)
        emitKanbanRealtimeEvent({
            type: 'execution:failed',
            executionId,
            taskId: task.id,
            payload: {
                taskName: task.raw.displayName || task.name,
                status: failureMetadata.status,
                reason: failureMetadata.reason,
                completedAt: failureMetadata.completedAt.toISOString(),
                durationMs: failureMetadata.durationMs,
                exitCode: failureMetadata.exitCode,
                signal: failureMetadata.signal,
                timedOut: failureMetadata.timedOut,
                cancelled: failureMetadata.cancelled,
            },
        })
        emitKanbanRealtimeEvent({
            type: 'engine:status',
            executionId,
            taskId: task.id,
            payload: {
                status: 'idle',
            },
        })

        return {
            state: status,
            taskId: task.id,
            executionId,
            blockedTasks,
            startMetadata,
            failureMetadata,
            message: reason,
        }
    }

    private async persistFailure(
        executionId: string,
        taskId: string,
        failureMetadata: KanbanExecutionFailureMetadata,
        pid: number | null,
    ): Promise<void> {
        const nextTaskColumn = failureMetadata.status === 'cancelled' ? 'queued' : 'failed'

        await Promise.all([
            this.prismaClient.kanbanTask.update({
                where: { id: taskId },
                data: { column: nextTaskColumn },
            }),
            this.prismaClient.kanbanExecution.update({
                where: { id: executionId },
                data: {
                    status: failureMetadata.status,
                    pid,
                    completedAt: failureMetadata.completedAt,
                    durationMs: failureMetadata.durationMs,
                    exitCode: failureMetadata.exitCode,
                    error: failureMetadata.reason,
                },
            }),
        ])
    }

    private toBlockedMetadata(
        blocked: ReturnType<typeof resolveQueuedTaskEligibility>['blocked'],
    ): KanbanBlockedTaskMetadata[] {
        const detectedAt = this.now()

        return blocked.map((entry) => ({
            taskId: entry.taskId,
            blockedByTaskIds: entry.failedDependencyIds.length > 0
                ? entry.failedDependencyIds
                : entry.missingDependencyIds,
            reason: entry.reason ?? 'Task is dependency-blocked',
            detectedAt,
        }))
    }
}

function isSuccessfulProcessResult(result: ProcessRunResult): result is ProcessRunResult & { exitCode: 0 } {
    return result.exitCode === 0
        && result.signal === null
        && !result.cancelled
        && !result.timedOut
        && !result.error
}

function buildFailureReason(result: ProcessRunResult, timeoutSeconds: number): string {
    if (result.timedOut) {
        return `Timeout after ${timeoutSeconds}s`
    }

    if (result.error) {
        return result.error
    }

    if (result.cancelled) {
        const cancelSignal = result.cancelSignal ?? 'SIGTERM'
        return `Cancelled (${cancelSignal})`
    }

    if (result.signal) {
        return `Process terminated by signal ${result.signal}`
    }

    if (result.exitCode !== null) {
        return `Process exited with code ${result.exitCode}`
    }

    return 'Process failed without an exit code'
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message
    }
    return 'Unknown execution error'
}

export async function recoverInterruptedKanbanExecutions(): Promise<InterruptedExecutionRecoveryResult> {
    const interruptedAt = new Date()
    const runningExecutions = await prisma.kanbanExecution.findMany({
        where: { status: 'running' },
        select: {
            id: true,
            startedAt: true,
        },
    })

    for (const execution of runningExecutions) {
        const durationMs = execution.startedAt
            ? Math.max(interruptedAt.getTime() - execution.startedAt.getTime(), 0)
            : null

        await prisma.kanbanExecution.update({
            where: { id: execution.id },
            data: {
                status: 'failed',
                completedAt: interruptedAt,
                durationMs,
                exitCode: null,
                error: PROCESS_INTERRUPTED_ERROR,
            },
        })
    }

    const recoveredTaskUpdate = await prisma.kanbanTask.updateMany({
        where: { column: 'running' },
        data: { column: 'failed' },
    })

    return {
        recoveredExecutions: runningExecutions.length,
        recoveredTasks: recoveredTaskUpdate.count,
    }
}

const globalForKanbanExecutionEngine = globalThis as unknown as {
    kanbanExecutionEngine: KanbanExecutionEngine | undefined
}

export const kanbanExecutionEngine = globalForKanbanExecutionEngine.kanbanExecutionEngine ?? new KanbanExecutionEngine()

if (process.env.NODE_ENV !== 'production') {
    globalForKanbanExecutionEngine.kanbanExecutionEngine = kanbanExecutionEngine
}
