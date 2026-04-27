import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    buildKanbanExecutionWhere,
    serializeKanbanExecution,
} from '@/lib/services/execution-service'

describe('buildKanbanExecutionWhere', () => {
    it('returns empty where for no filters', () => {
        const where = buildKanbanExecutionWhere({})
        assert.deepEqual(where, {})
    })

    it('includes taskId filter', () => {
        const where = buildKanbanExecutionWhere({ taskId: 'task-1' })
        assert.equal(where.taskId, 'task-1')
    })

    it('includes status filter', () => {
        const where = buildKanbanExecutionWhere({ status: 'completed' })
        assert.equal(where.status, 'completed')
    })

    it('includes both filters', () => {
        const where = buildKanbanExecutionWhere({ taskId: 'task-1', status: 'failed' })
        assert.equal(where.taskId, 'task-1')
        assert.equal(where.status, 'failed')
    })
})

describe('serializeKanbanExecution', () => {
    it('parses configSnapshot from JSON string', async () => {
        const execution = {
            id: 'exec-1',
            configSnapshot: '{"tool":"claude-cli","model":"test"}',
            logFile: null,
        }
        const result = await serializeKanbanExecution(execution, false)
        assert.deepEqual(result.configSnapshot, { tool: 'claude-cli', model: 'test' })
        assert.equal(result.logPreview, null)
        assert.equal(result.logUrl, null)
    })

    it('includes logUrl when logFile is present', async () => {
        const execution = {
            id: 'exec-2',
            configSnapshot: '{}',
            logFile: 'test.log',
        }
        const result = await serializeKanbanExecution(execution, false)
        assert.equal(result.logUrl, '/api/executions/exec-2/log')
    })

    it('handles invalid configSnapshot JSON gracefully', async () => {
        const execution = {
            id: 'exec-3',
            configSnapshot: 'bad-json',
            logFile: null,
        }
        const result = await serializeKanbanExecution(execution, false)
        assert.deepEqual(result.configSnapshot, {})
    })
})
