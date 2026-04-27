import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    resolveTaskDependencyEligibility,
    resolveQueuedTaskEligibility,
} from '@/lib/kanban/dependency-resolver'
import type { ParsedKanbanTask } from '@/lib/kanban/types'

function makeTask(overrides: Partial<ParsedKanbanTask> = {}): ParsedKanbanTask {
    return {
        id: 'task-1',
        name: 'Task 1',
        displayName: null,
        description: null,
        sourcePath: '/tmp/script.sh',
        sourceHash: null,
        column: 'queued',
        position: 0,
        tags: [],
        dependencies: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        config: {
            tool: 'claude-cli',
            model: 'claude-sonnet-4',
            envVars: {},
            timeout: 300,
            retryOnFail: false,
            maxRetries: 0,
            retryDelay: 0,
        },
        ...overrides,
    }
}

describe('resolveTaskDependencyEligibility', () => {
    it('returns eligible when task has no dependencies', () => {
        const task = makeTask({ dependencies: [] })
        const taskById = new Map([[task.id, task]])
        const result = resolveTaskDependencyEligibility(task, taskById)
        assert.equal(result.state, 'eligible')
        assert.equal(result.taskId, 'task-1')
    })

    it('returns eligible when all dependencies are completed', () => {
        const dep = makeTask({ id: 'dep-1', column: 'completed' })
        const task = makeTask({ dependencies: ['dep-1'] })
        const taskById = new Map([
            [dep.id, dep],
            [task.id, task],
        ])
        const result = resolveTaskDependencyEligibility(task, taskById)
        assert.equal(result.state, 'eligible')
        assert.deepEqual(result.completedDependencyIds, ['dep-1'])
    })

    it('returns waiting when a dependency is pending', () => {
        const dep = makeTask({ id: 'dep-1', column: 'queued' })
        const task = makeTask({ dependencies: ['dep-1'] })
        const taskById = new Map([
            [dep.id, dep],
            [task.id, task],
        ])
        const result = resolveTaskDependencyEligibility(task, taskById)
        assert.equal(result.state, 'waiting')
        assert.deepEqual(result.pendingDependencyIds, ['dep-1'])
    })

    it('returns blocked when a dependency has failed', () => {
        const dep = makeTask({ id: 'dep-1', column: 'failed' })
        const task = makeTask({ dependencies: ['dep-1'] })
        const taskById = new Map([
            [dep.id, dep],
            [task.id, task],
        ])
        const result = resolveTaskDependencyEligibility(task, taskById)
        assert.equal(result.state, 'blocked')
        assert.deepEqual(result.failedDependencyIds, ['dep-1'])
        assert.ok(result.reason?.includes('failed'))
    })

    it('returns blocked when a dependency is missing', () => {
        const task = makeTask({ dependencies: ['nonexistent'] })
        const taskById = new Map([[task.id, task]])
        const result = resolveTaskDependencyEligibility(task, taskById)
        assert.equal(result.state, 'blocked')
        assert.deepEqual(result.missingDependencyIds, ['nonexistent'])
    })

    it('failed takes priority over missing', () => {
        const dep = makeTask({ id: 'dep-1', column: 'failed' })
        const task = makeTask({ dependencies: ['dep-1', 'missing-dep'] })
        const taskById = new Map([
            [dep.id, dep],
            [task.id, task],
        ])
        const result = resolveTaskDependencyEligibility(task, taskById)
        assert.equal(result.state, 'blocked')
        assert.deepEqual(result.failedDependencyIds, ['dep-1'])
        assert.deepEqual(result.missingDependencyIds, ['missing-dep'])
    })
})

describe('resolveQueuedTaskEligibility', () => {
    it('returns null nextTask when no queued tasks', () => {
        const result = resolveQueuedTaskEligibility([])
        assert.equal(result.nextTask, null)
        assert.equal(result.eligible.length, 0)
    })

    it('returns first eligible queued task by position', () => {
        const task1 = makeTask({ id: 't1', position: 0, dependencies: [] })
        const task2 = makeTask({ id: 't2', position: 1, dependencies: [] })
        const result = resolveQueuedTaskEligibility([task1, task2])
        assert.equal(result.nextTask?.id, 't1')
        assert.equal(result.eligible.length, 2)
    })

    it('skips waiting tasks and picks first eligible', () => {
        const dep = makeTask({ id: 'dep', column: 'running', position: 0 })
        const task1 = makeTask({ id: 't1', position: 0, dependencies: ['dep'] })
        const task2 = makeTask({ id: 't2', position: 1, dependencies: [] })
        const result = resolveQueuedTaskEligibility([dep, task1, task2])
        assert.equal(result.nextTask?.id, 't2')
        assert.equal(result.waiting.length, 1)
        assert.equal(result.eligible.length, 1)
    })

    it('categorizes blocked tasks correctly', () => {
        const failedDep = makeTask({ id: 'failed-dep', column: 'failed' })
        const task = makeTask({ id: 't1', position: 0, dependencies: ['failed-dep'] })
        const result = resolveQueuedTaskEligibility([failedDep, task])
        assert.equal(result.nextTask, null)
        assert.equal(result.blocked.length, 1)
        assert.equal(result.eligible.length, 0)
    })

    it('ignores non-queued tasks for selection', () => {
        const completed = makeTask({ id: 't1', column: 'completed', position: 0 })
        const queued = makeTask({ id: 't2', column: 'queued', position: 0, dependencies: [] })
        const result = resolveQueuedTaskEligibility([completed, queued])
        assert.equal(result.nextTask?.id, 't2')
    })
})
