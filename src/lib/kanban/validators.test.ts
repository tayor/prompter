import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
    createKanbanTaskSchema,
    kanbanTaskConfigSchema,
    kanbanTaskDependenciesSchema,
    moveKanbanTasksSchema,
    reorderKanbanColumnSchema,
    kanbanColumnSchema,
    kanbanToolSchema,
    updateKanbanTaskSchema,
    kanbanExecutionsQuerySchema,
} from '@/lib/validators'

describe('createKanbanTaskSchema', () => {
    it('accepts valid task creation', () => {
        const result = createKanbanTaskSchema.safeParse({
            name: 'My Task',
            sourcePath: '/tmp/script.sh',
        })
        assert.ok(result.success)
        assert.equal(result.data.name, 'My Task')
        assert.equal(result.data.column, 'backlog')
        assert.equal(result.data.position, 0)
    })

    it('rejects empty name', () => {
        const result = createKanbanTaskSchema.safeParse({
            name: '',
            sourcePath: '/tmp/script.sh',
        })
        assert.ok(!result.success)
    })

    it('rejects missing sourcePath', () => {
        const result = createKanbanTaskSchema.safeParse({
            name: 'Task',
        })
        assert.ok(!result.success)
    })

    it('accepts all optional fields', () => {
        const result = createKanbanTaskSchema.safeParse({
            name: 'Full Task',
            sourcePath: '/tmp/script.sh',
            displayName: 'Display Name',
            description: 'A description',
            column: 'queued',
            position: 5,
            tags: ['tag1', 'tag2'],
            dependencies: ['dep-1'],
        })
        assert.ok(result.success)
        assert.equal(result.data.column, 'queued')
        assert.equal(result.data.position, 5)
    })

    it('defaults column to backlog', () => {
        const result = createKanbanTaskSchema.safeParse({
            name: 'Task',
            sourcePath: '/tmp/test.sh',
        })
        assert.ok(result.success)
        assert.equal(result.data.column, 'backlog')
    })
})

describe('kanbanTaskConfigSchema', () => {
    it('accepts valid config with defaults', () => {
        const result = kanbanTaskConfigSchema.safeParse({
            tool: 'claude-cli',
            model: 'claude-sonnet-4',
        })
        assert.ok(result.success)
        assert.equal(result.data.timeout, 300)
        assert.equal(result.data.retryOnFail, false)
        assert.equal(result.data.maxRetries, 0)
    })

    it('rejects timeout above 3600', () => {
        const result = kanbanTaskConfigSchema.safeParse({
            tool: 'claude-cli',
            model: 'claude-sonnet-4',
            timeout: 9999,
        })
        assert.ok(!result.success)
    })

    it('rejects timeout below 1', () => {
        const result = kanbanTaskConfigSchema.safeParse({
            tool: 'claude-cli',
            model: 'claude-sonnet-4',
            timeout: 0,
        })
        assert.ok(!result.success)
    })

    it('rejects maxRetries above 5', () => {
        const result = kanbanTaskConfigSchema.safeParse({
            tool: 'claude-cli',
            model: 'claude-sonnet-4',
            maxRetries: 10,
        })
        assert.ok(!result.success)
    })

    it('accepts custom env vars', () => {
        const result = kanbanTaskConfigSchema.safeParse({
            tool: 'claude-cli',
            model: 'claude-sonnet-4',
            envVars: { MY_VAR: 'value' },
        })
        assert.ok(result.success)
        assert.equal(result.data.envVars.MY_VAR, 'value')
    })

    it('rejects invalid env var key format', () => {
        const result = kanbanTaskConfigSchema.safeParse({
            tool: 'claude-cli',
            model: 'claude-sonnet-4',
            envVars: { '1BAD': 'value' },
        })
        assert.ok(!result.success)
    })
})

describe('kanbanTaskDependenciesSchema', () => {
    it('accepts valid dependencies', () => {
        const result = kanbanTaskDependenciesSchema.safeParse(['dep-1', 'dep-2'])
        assert.ok(result.success)
    })

    it('rejects duplicate dependencies', () => {
        const result = kanbanTaskDependenciesSchema.safeParse(['dep-1', 'dep-1'])
        assert.ok(!result.success)
    })

    it('rejects more than 100 dependencies', () => {
        const deps = Array.from({ length: 101 }, (_, i) => `dep-${i}`)
        const result = kanbanTaskDependenciesSchema.safeParse(deps)
        assert.ok(!result.success)
    })

    it('rejects empty string dependencies', () => {
        const result = kanbanTaskDependenciesSchema.safeParse([''])
        assert.ok(!result.success)
    })
})

describe('kanbanColumnSchema', () => {
    it('accepts all valid columns', () => {
        for (const col of ['backlog', 'queued', 'running', 'completed', 'failed', 'paused']) {
            assert.ok(kanbanColumnSchema.safeParse(col).success)
        }
    })

    it('rejects invalid column', () => {
        assert.ok(!kanbanColumnSchema.safeParse('invalid').success)
    })
})

describe('kanbanToolSchema', () => {
    it('accepts all valid tools', () => {
        for (const tool of ['claude-cli', 'codex-cli', 'ollama', 'custom-bash', 'custom-command', 'custom']) {
            assert.ok(kanbanToolSchema.safeParse(tool).success)
        }
    })

    it('rejects invalid tool', () => {
        assert.ok(!kanbanToolSchema.safeParse('invalid-tool').success)
    })
})

describe('moveKanbanTasksSchema', () => {
    it('accepts valid batch move', () => {
        const result = moveKanbanTasksSchema.safeParse({
            taskIds: ['t1', 't2'],
            toColumn: 'queued',
        })
        assert.ok(result.success)
    })

    it('rejects empty taskIds', () => {
        const result = moveKanbanTasksSchema.safeParse({
            taskIds: [],
            toColumn: 'queued',
        })
        assert.ok(!result.success)
    })
})

describe('reorderKanbanColumnSchema', () => {
    it('accepts valid reorder', () => {
        const result = reorderKanbanColumnSchema.safeParse({
            column: 'queued',
            tasks: [{ id: 't1', position: 0 }, { id: 't2', position: 1 }],
        })
        assert.ok(result.success)
    })

    it('rejects empty tasks', () => {
        const result = reorderKanbanColumnSchema.safeParse({
            column: 'queued',
            tasks: [],
        })
        assert.ok(!result.success)
    })
})

describe('updateKanbanTaskSchema', () => {
    it('accepts partial updates', () => {
        const result = updateKanbanTaskSchema.safeParse({
            name: 'Updated Name',
        })
        assert.ok(result.success)
    })

    it('accepts empty object', () => {
        const result = updateKanbanTaskSchema.safeParse({})
        assert.ok(result.success)
    })

    it('accepts nullable fields', () => {
        const result = updateKanbanTaskSchema.safeParse({
            displayName: null,
            description: null,
        })
        assert.ok(result.success)
    })
})

describe('kanbanExecutionsQuerySchema', () => {
    it('accepts empty query', () => {
        const result = kanbanExecutionsQuerySchema.safeParse({})
        assert.ok(result.success)
    })

    it('accepts taskId filter', () => {
        const result = kanbanExecutionsQuerySchema.safeParse({
            taskId: 'task-1',
        })
        assert.ok(result.success)
    })
})
