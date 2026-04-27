import { kanbanSchedulerRuntimeService, type KanbanSchedulerRuntimeService, type SchedulerDispatchSummary } from '@/lib/kanban/scheduler-runtime'

const DEFAULT_SCHEDULER_POLL_INTERVAL_MS = 15_000
const MIN_SCHEDULER_POLL_INTERVAL_MS = 1_000

type SchedulerIntervalHandle = ReturnType<typeof setInterval>

type SchedulerSetInterval = (callback: () => void | Promise<void>, ms: number) => SchedulerIntervalHandle
type SchedulerClearInterval = (interval: SchedulerIntervalHandle) => void

interface KanbanSchedulerRunnerOptions {
    schedulerRuntime?: Pick<KanbanSchedulerRuntimeService, 'dispatchDueSchedules'>
    setIntervalFn?: SchedulerSetInterval
    clearIntervalFn?: SchedulerClearInterval
    pollIntervalMs?: number
}

export class KanbanSchedulerRunnerService {
    private readonly schedulerRuntime: Pick<KanbanSchedulerRuntimeService, 'dispatchDueSchedules'>
    private readonly setIntervalFn: SchedulerSetInterval
    private readonly clearIntervalFn: SchedulerClearInterval
    private readonly pollIntervalMs: number
    private interval: SchedulerIntervalHandle | null = null
    private reconcilePromise: Promise<void> | null = null

    public constructor(options: KanbanSchedulerRunnerOptions = {}) {
        this.schedulerRuntime = options.schedulerRuntime ?? kanbanSchedulerRuntimeService
        this.setIntervalFn = options.setIntervalFn ?? ((callback, ms) => setInterval(callback, ms))
        this.clearIntervalFn = options.clearIntervalFn ?? ((interval) => clearInterval(interval))
        this.pollIntervalMs = normalizePollInterval(options.pollIntervalMs)
    }

    public async ensureStarted(): Promise<void> {
        if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') {
            return
        }

        if (!this.interval) {
            this.interval = this.setIntervalFn(() => this.reconcileDueSchedules(), this.pollIntervalMs)
            this.interval.unref?.()
        }

        await this.reconcileDueSchedules()
    }

    public stop(): void {
        if (!this.interval) {
            return
        }

        this.clearIntervalFn(this.interval)
        this.interval = null
    }

    public isRunning(): boolean {
        return this.interval !== null
    }

    private async reconcileDueSchedules(): Promise<void> {
        if (this.reconcilePromise) {
            await this.reconcilePromise
            return
        }

        this.reconcilePromise = this.schedulerRuntime
            .dispatchDueSchedules()
            .then((summary) => {
                logSchedulerSummary(summary)
            })
            .catch((error) => {
                console.error('Failed to reconcile scheduled tasks:', error)
            })
            .finally(() => {
                this.reconcilePromise = null
            })

        await this.reconcilePromise
    }
}

function normalizePollInterval(pollIntervalMs: number | undefined): number {
    if (!pollIntervalMs || !Number.isFinite(pollIntervalMs)) {
        return DEFAULT_SCHEDULER_POLL_INTERVAL_MS
    }

    return Math.max(Math.round(pollIntervalMs), MIN_SCHEDULER_POLL_INTERVAL_MS)
}

function logSchedulerSummary(summary: SchedulerDispatchSummary): void {
    if (summary.dueCount === 0) {
        return
    }

    console.info('Kanban scheduler processed due schedules:', {
        dueCount: summary.dueCount,
        claimedCount: summary.claimedCount,
        dispatchedCount: summary.dispatchedCount,
        startedCount: summary.startedCount,
    })
}

const globalForKanbanSchedulerRunner = globalThis as unknown as {
    kanbanSchedulerRunnerService: KanbanSchedulerRunnerService | undefined
}

export const kanbanSchedulerRunnerService = globalForKanbanSchedulerRunner.kanbanSchedulerRunnerService
    ?? new KanbanSchedulerRunnerService()

if (process.env.NODE_ENV !== 'production') {
    globalForKanbanSchedulerRunner.kanbanSchedulerRunnerService = kanbanSchedulerRunnerService
}

export async function ensureKanbanSchedulerRunnerStarted(): Promise<void> {
    await kanbanSchedulerRunnerService.ensureStarted()
}
