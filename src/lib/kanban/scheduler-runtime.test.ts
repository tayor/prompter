import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    KanbanSchedulerRuntimeService,
    computeDueSchedules,
    computeNextCronOccurrence,
    computeNextRunAtForSchedule,
    isValidTimeZone,
    type SchedulerRuntimePrismaClient,
    type SchedulerScheduleSnapshot,
} from '@/lib/kanban/scheduler-runtime'

function makeSchedule(overrides: Partial<SchedulerScheduleSnapshot> = {}): SchedulerScheduleSnapshot {
    return {
        id: 'schedule-1',
        type: 'one_time',
        runAt: new Date('2026-04-22T10:00:00.000Z'),
        cronExpression: null,
        timezone: 'UTC',
        status: 'active',
        nextRunAt: null,
        lastRunAt: null,
        allowConcurrentRuns: false,
        skipIfTaskRunning: true,
        catchUpMissedRuns: false,
        updatedAt: new Date('2026-04-22T09:00:00.000Z'),
        taskId: 'task-1',
        task: {
            id: 'task-1',
            column: 'backlog',
            config: JSON.stringify({
                tool: 'claude-cli',
                model: 'claude-sonnet-4',
            }),
        },
        ...overrides,
    }
}

describe('computeDueSchedules', () => {
    it('includes due one-time and cron schedules, excluding non-due entries', () => {
        const now = new Date('2026-04-22T10:30:00.000Z')
        const schedules: SchedulerScheduleSnapshot[] = [
            makeSchedule({
                id: 'future',
                runAt: new Date('2026-04-22T11:00:00.000Z'),
            }),
            makeSchedule({
                id: 'one-time-due',
                runAt: new Date('2026-04-22T10:00:00.000Z'),
            }),
            makeSchedule({
                id: 'cron-due',
                type: 'cron',
                runAt: null,
                cronExpression: '*/15 * * * *',
                nextRunAt: new Date('2026-04-22T10:15:00.000Z'),
            }),
            makeSchedule({
                id: 'one-time-already-ran',
                runAt: new Date('2026-04-22T09:00:00.000Z'),
                lastRunAt: new Date('2026-04-22T09:01:00.000Z'),
            }),
        ]

        const due = computeDueSchedules(schedules, now)

        assert.deepEqual(
            due.map((entry) => entry.schedule.id),
            ['one-time-due', 'cron-due'],
        )
    })
})

describe('computeNextRunAtForSchedule', () => {
    it('respects catch-up policy for cron schedules', () => {
        const now = new Date('2026-04-22T10:35:00.000Z')
        const dueAt = new Date('2026-04-22T10:00:00.000Z')

        const skipMissedSchedule = makeSchedule({
            type: 'cron',
            runAt: null,
            cronExpression: '*/10 * * * *',
            catchUpMissedRuns: false,
        })
        const catchUpSchedule = makeSchedule({
            type: 'cron',
            runAt: null,
            cronExpression: '*/10 * * * *',
            catchUpMissedRuns: true,
        })

        const skipMissedNextRunAt = computeNextRunAtForSchedule(skipMissedSchedule, now, dueAt)
        const catchUpNextRunAt = computeNextRunAtForSchedule(catchUpSchedule, now, dueAt)

        assert.equal(skipMissedNextRunAt?.toISOString(), '2026-04-22T10:40:00.000Z')
        assert.equal(catchUpNextRunAt?.toISOString(), '2026-04-22T10:10:00.000Z')
    })
})

describe('computeNextCronOccurrence', () => {
    it('respects schedule timezone when calculating cron occurrences', () => {
        const fromDate = new Date('2026-04-22T12:00:00.000Z')

        const utcNextRun = computeNextCronOccurrence('0 9 * * *', fromDate, 'UTC')
        const newYorkNextRun = computeNextCronOccurrence('0 9 * * *', fromDate, 'America/New_York')

        assert.equal(utcNextRun?.toISOString(), '2026-04-23T09:00:00.000Z')
        assert.equal(newYorkNextRun?.toISOString(), '2026-04-22T13:00:00.000Z')
    })

    it('returns null for invalid timezone identifiers', () => {
        const nextRun = computeNextCronOccurrence('*/5 * * * *', new Date('2026-04-22T12:00:00.000Z'), 'Mars/Phobos')
        assert.equal(nextRun, null)
        assert.equal(isValidTimeZone('Mars/Phobos'), false)
    })
})

describe('KanbanSchedulerRuntimeService', () => {
    it('claims and dispatches due schedules by queueing and starting execution', async () => {
        const now = new Date('2026-04-22T10:30:00.000Z')
        const schedule = makeSchedule({
            id: 'dispatch-schedule',
            runAt: new Date('2026-04-22T10:00:00.000Z'),
        })

        const updateManyCalls: Array<{ where: unknown, data: unknown }> = []
        const queuedTaskIds: string[] = []
        const executionTriggers: string[] = []
        let markStartedCalls = 0

        const prismaClient = {
            kanbanSchedule: {
                findMany: async () => [schedule],
                updateMany: async (args) => {
                    updateManyCalls.push(args)
                    return { count: 1 }
                },
            },
            kanbanExecution: {
                count: async () => 0,
            },
        } satisfies SchedulerRuntimePrismaClient

        const runtime = new KanbanSchedulerRuntimeService({
            prismaClient,
            queueTask: async (taskId) => {
                queuedTaskIds.push(taskId)
                return { position: 0 }
            },
            executionControl: {
                markStarted() {
                    markStartedCalls += 1
                },
            },
            executionEngine: {
                async executeNextTask(trigger) {
                    executionTriggers.push(trigger ?? 'auto')
                    return { state: 'completed' }
                },
            },
            now: () => now,
        })

        const result = await runtime.dispatchDueSchedules()

        assert.equal(result.dueCount, 1)
        assert.equal(result.claimedCount, 1)
        assert.equal(result.dispatchedCount, 1)
        assert.equal(result.startedCount, 1)
        assert.deepEqual(queuedTaskIds, ['task-1'])
        assert.equal(markStartedCalls, 1)
        assert.deepEqual(executionTriggers, ['auto'])
        assert.equal(updateManyCalls.length, 1)

        const claimedScheduleData = updateManyCalls[0].data as { lastRunAt: Date, nextRunAt: Date | null }
        assert.equal(claimedScheduleData.lastRunAt.toISOString(), now.toISOString())
        assert.equal(claimedScheduleData.nextRunAt, null)
    })

    it('skips dispatch when a schedule lock is already claimed', async () => {
        const now = new Date('2026-04-22T10:30:00.000Z')
        const schedule = makeSchedule({
            id: 'locked-schedule',
            runAt: new Date('2026-04-22T10:00:00.000Z'),
        })

        let queuedCalls = 0
        let startCalls = 0

        const prismaClient = {
            kanbanSchedule: {
                findMany: async () => [schedule],
                updateMany: async () => ({ count: 0 }),
            },
            kanbanExecution: {
                count: async () => 0,
            },
        } satisfies SchedulerRuntimePrismaClient

        const runtime = new KanbanSchedulerRuntimeService({
            prismaClient,
            queueTask: async () => {
                queuedCalls += 1
                return { position: 0 }
            },
            executionControl: {
                markStarted() {
                    startCalls += 1
                },
            },
            executionEngine: {
                async executeNextTask() {
                    return { state: 'busy' }
                },
            },
            now: () => now,
        })

        const result = await runtime.dispatchDueSchedules()

        assert.equal(result.claimedCount, 0)
        assert.equal(result.dispatchedCount, 0)
        assert.equal(result.results.length, 1)
        assert.equal(result.results[0].outcome, 'skipped_lock')
        assert.equal(queuedCalls, 0)
        assert.equal(startCalls, 0)
    })

    it('applies schedule id filters when dispatching due schedules', async () => {
        const now = new Date('2026-04-22T10:30:00.000Z')
        const filteredSchedule = makeSchedule({
            id: 'filtered-schedule',
            runAt: new Date('2026-04-22T10:00:00.000Z'),
            taskId: null,
            task: null,
        })

        let findManyWhere: unknown = null

        const prismaClient = {
            kanbanSchedule: {
                findMany: async (args) => {
                    findManyWhere = args.where
                    return [filteredSchedule]
                },
                updateMany: async () => ({ count: 1 }),
            },
            kanbanExecution: {
                count: async () => 0,
            },
        } satisfies SchedulerRuntimePrismaClient

        const runtime = new KanbanSchedulerRuntimeService({
            prismaClient,
            now: () => now,
        })

        const result = await runtime.dispatchDueSchedules({
            scheduleIds: ['filtered-schedule'],
        })

        assert.deepEqual(findManyWhere, {
            status: 'active',
            id: { in: ['filtered-schedule'] },
        })
        assert.equal(result.dueCount, 1)
        assert.equal(result.results[0].outcome, 'skipped_no_task')
    })
})
