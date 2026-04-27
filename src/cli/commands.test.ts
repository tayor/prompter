import assert from 'node:assert/strict'
import test from 'node:test'
import {
    runAdminCommand,
    runExecutionCommand,
    runExportCommand,
    runModelCommand,
    runPromptCommand,
    runQueueCommand,
    runScheduleCommand,
    runSearchCommand,
    runTaskCommand,
} from '@/cli/commands'
import { CliError } from '@/cli/errors'
import type { CliCommandContext } from '@/cli/types'

function buildContext(args: string[]): CliCommandContext {
    return {
        args,
        options: {
            json: false,
            quiet: true,
            output: 'json',
        },
    }
}

function isMissingKanbanTableError(error: unknown): boolean {
    return error instanceof CliError
        && error.kind === 'unexpected'
        && error.message.includes('no such table: main.Kanban')
}

test('runPromptCommand list returns paginated prompt data', async () => {
    const result = await runPromptCommand(buildContext(['list', '--limit', '1']))
    const payload = result.data as { prompts: unknown[]; pagination: { limit: number } }

    assert.ok(Array.isArray(payload.prompts))
    assert.equal(payload.pagination.limit, 1)
})

test('runSearchCommand returns combined search results', async () => {
    const result = await runSearchCommand(buildContext(['query', '--q', 'test', '--type', 'all', '--limit', '1']))
    const payload = result.data as { total: { prompts: number; workflows: number } }

    assert.ok(typeof payload.total.prompts === 'number')
    assert.ok(typeof payload.total.workflows === 'number')
})

test('runExportCommand supports yaml output rendering', async () => {
    const result = await runExportCommand(buildContext(['data', '--format', 'yaml', '--prompts=false', '--workflows=false']))

    assert.equal(typeof result.raw, 'string')
    assert.ok(result.raw?.includes('version:'))
})

test('runAdminCommand list returns admin collection payload', async () => {
    const result = await runAdminCommand(buildContext(['list']))
    const payload = result.data as { admins: unknown[] }

    assert.ok(Array.isArray(payload.admins))
})

test('runPromptCommand create validates missing payload input', async () => {
    await assert.rejects(
        () => runPromptCommand(buildContext(['create'])),
        (error: unknown) =>
            error instanceof CliError
            && error.kind === 'validation'
            && error.message.includes('Provide payload')
    )
})

test('runTaskCommand supports task CRUD plus move/reorder operations', async (t) => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
    const createdTaskIds: string[] = []
    let shouldCleanup = true

    const createTask = async (name: string) => {
        const result = await runTaskCommand(buildContext([
            'create',
            '--data',
            JSON.stringify({
                name,
                sourcePath: `/tmp/${name}.sh`,
                column: 'backlog',
                config: {
                    tool: 'claude-cli',
                    model: 'claude-sonnet-4',
                },
            }),
        ]))
        const task = result.data as { id: string }
        createdTaskIds.push(task.id)
        return task
    }

    try {
        const firstTask = await createTask(`cli-kanban-task-a-${suffix}`)
        const secondTask = await createTask(`cli-kanban-task-b-${suffix}`)

        const getResult = await runTaskCommand(buildContext(['get', firstTask.id]))
        const getPayload = getResult.data as { id: string }
        assert.equal(getPayload.id, firstTask.id)

        const updateResult = await runTaskCommand(buildContext([
            'update',
            firstTask.id,
            '--data',
            JSON.stringify({ displayName: `Updated ${suffix}` }),
        ]))
        const updatePayload = updateResult.data as { displayName: string | null }
        assert.equal(updatePayload.displayName, `Updated ${suffix}`)

        const moveResult = await runTaskCommand(buildContext([
            'move',
            '--taskIds',
            `${firstTask.id},${secondTask.id}`,
            '--toColumn',
            'queued',
        ]))
        const movePayload = moveResult.data as {
            meta: { requestedCount: number; movedCount: number }
        }
        assert.equal(movePayload.meta.requestedCount, 2)
        assert.ok(movePayload.meta.movedCount >= 1)

        const queuedListResult = await runTaskCommand(buildContext(['list', '--column', 'queued']))
        const queuedListPayload = queuedListResult.data as { tasks: Array<{ id: string }> }
        assert.ok(queuedListPayload.tasks.some((task) => task.id === firstTask.id))
        assert.ok(queuedListPayload.tasks.some((task) => task.id === secondTask.id))

        const reorderResult = await runTaskCommand(buildContext([
            'reorder',
            '--data',
            JSON.stringify({
                column: 'queued',
                tasks: queuedListPayload.tasks.map((task, position) => ({
                    id: task.id,
                    position,
                })),
            }),
        ]))
        const reorderPayload = reorderResult.data as { meta: { column: string } }
        assert.equal(reorderPayload.meta.column, 'queued')
    } catch (error) {
        if (isMissingKanbanTableError(error)) {
            shouldCleanup = false
            t.skip('Kanban tables are not present in the current test database.')
            return
        }
        throw error
    } finally {
        if (!shouldCleanup) {
            return
        }

        await Promise.all(
            createdTaskIds.map(async (taskId) => {
                try {
                    await runTaskCommand(buildContext(['delete', taskId]))
                } catch {
                    // no-op cleanup
                }
            })
        )
    }
})

test('runExecutionCommand status returns runtime invariant metadata', async (t) => {
    try {
        const result = await runExecutionCommand(buildContext(['status']))
        const payload = result.data as {
            status: string
            singleSlotInvariant: boolean
        }

        assert.ok(['running', 'idle', 'stopped'].includes(payload.status))
        assert.equal(typeof payload.singleSlotInvariant, 'boolean')
    } catch (error) {
        if (isMissingKanbanTableError(error)) {
            t.skip('Kanban tables are not present in the current test database.')
            return
        }
        throw error
    }
})

test('runQueueCommand list returns queue collection payload', async (t) => {
    try {
        const result = await runQueueCommand(buildContext(['list']))
        const payload = result.data as { column: string; tasks: unknown[] }

        assert.equal(payload.column, 'queued')
        assert.ok(Array.isArray(payload.tasks))
    } catch (error) {
        if (isMissingKanbanTableError(error)) {
            t.skip('Kanban tables are not present in the current test database.')
            return
        }
        throw error
    }
})

test('runModelCommand discover returns provider model payload', async () => {
    const result = await runModelCommand(buildContext(['discover', 'claude']))
    const payload = result.data as {
        provider: string
        models: unknown[]
        source: string
    }

    assert.equal(payload.provider, 'claude')
    assert.ok(Array.isArray(payload.models))
    assert.ok(['cli', 'fallback'].includes(payload.source))
})

test('runScheduleCommand list validates pagination options before database calls', async () => {
    await assert.rejects(
        () => runScheduleCommand(buildContext(['list', '--page', '0'])),
        (error: unknown) =>
            error instanceof CliError
            && error.kind === 'validation'
            && error.message.includes('Invalid command arguments')
    )
})

test('runScheduleCommand create validates timezone names', async () => {
    await assert.rejects(
        () => runScheduleCommand(buildContext([
            'create',
            '--data',
            JSON.stringify({
                type: 'one_time',
                runAt: '2026-04-22T10:00:00',
                timezone: 'Mars/Phobos',
            }),
        ])),
        (error: unknown) =>
            error instanceof CliError
            && error.kind === 'validation'
            && error.message.includes('Invalid timezone')
    )
})

test('runScheduleCommand create validates cron expression syntax', async () => {
    await assert.rejects(
        () => runScheduleCommand(buildContext([
            'create',
            '--data',
            JSON.stringify({
                type: 'cron',
                cronExpression: 'bad-cron',
                timezone: 'UTC',
            }),
        ])),
        (error: unknown) =>
            error instanceof CliError
            && error.kind === 'validation'
            && error.message.includes('Invalid cronExpression')
    )
})

test('runScheduleCommand run-now requires a schedule id', async () => {
    await assert.rejects(
        () => runScheduleCommand(buildContext(['run-now'])),
        (error: unknown) =>
            error instanceof CliError
            && error.kind === 'validation'
            && error.message.includes('Missing required schedule id')
    )
})
