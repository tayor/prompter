import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { KanbanSchedulerRunnerService } from '@/lib/kanban/scheduler-runner'

function createDispatchSummary() {
    return {
        processedAt: new Date(),
        evaluatedCount: 0,
        dueCount: 0,
        claimedCount: 0,
        dispatchedCount: 0,
        startedCount: 0,
        results: [],
    }
}

describe('KanbanSchedulerRunnerService', () => {
    it('starts polling and reconciles schedules immediately', async () => {
        let dispatchCalls = 0
        let intervalCallback: (() => void | Promise<void>) | null = null
        let clearIntervalCalls = 0
        let unrefCalls = 0

        const fakeIntervalHandle = {
            unref() {
                unrefCalls += 1
            },
        } as unknown as ReturnType<typeof setInterval>

        const runner = new KanbanSchedulerRunnerService({
            schedulerRuntime: {
                async dispatchDueSchedules() {
                    dispatchCalls += 1
                    return createDispatchSummary()
                },
            },
            setIntervalFn: (callback, intervalMs) => {
                intervalCallback = callback
                assert.equal(intervalMs, 1_000)
                return fakeIntervalHandle
            },
            clearIntervalFn: () => {
                clearIntervalCalls += 1
            },
            pollIntervalMs: 1_000,
        })

        await runner.ensureStarted()
        assert.equal(runner.isRunning(), true)
        assert.equal(dispatchCalls, 1)
        assert.equal(unrefCalls, 1)
        assert.ok(intervalCallback)

        await runner.ensureStarted()
        assert.equal(dispatchCalls, 2)

        await intervalCallback?.()
        assert.equal(dispatchCalls, 3)

        runner.stop()
        assert.equal(runner.isRunning(), false)
        assert.equal(clearIntervalCalls, 1)
    })
})
