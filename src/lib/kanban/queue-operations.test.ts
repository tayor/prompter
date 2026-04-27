import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    parseJsonField,
    parseTaskConfig,
    serializeKanbanTask,
} from '@/lib/kanban/queue-operations'

describe('parseJsonField', () => {
    it('parses valid JSON string', () => {
        assert.deepEqual(parseJsonField('{"a":1}', {}), { a: 1 })
    })

    it('returns fallback for invalid JSON', () => {
        assert.deepEqual(parseJsonField('not-json', { fallback: true }), { fallback: true })
    })

    it('parses JSON arrays', () => {
        assert.deepEqual(parseJsonField('["a","b"]', []), ['a', 'b'])
    })

    it('returns fallback for empty string', () => {
        assert.deepEqual(parseJsonField('', null), null)
    })
})

describe('parseTaskConfig', () => {
    it('parses valid config JSON', () => {
        const config = parseTaskConfig('{"tool":"claude-cli","model":"test"}')
        assert.equal(config.tool, 'claude-cli')
        assert.equal(config.model, 'test')
    })

    it('returns empty object for invalid JSON', () => {
        const config = parseTaskConfig('invalid')
        assert.deepEqual(config, {})
    })
})

describe('serializeKanbanTask', () => {
    it('deserializes config and dependencies from JSON strings', () => {
        const task = {
            id: 'task-1',
            name: 'Test Task',
            config: '{"tool":"claude-cli"}',
            dependencies: '["dep-1","dep-2"]',
        }
        const serialized = serializeKanbanTask(task)
        assert.deepEqual(serialized.config, { tool: 'claude-cli' })
        assert.deepEqual(serialized.dependencies, ['dep-1', 'dep-2'])
        assert.equal(serialized.id, 'task-1')
    })

    it('handles invalid JSON gracefully', () => {
        const task = {
            config: 'bad-json',
            dependencies: 'also-bad',
        }
        const serialized = serializeKanbanTask(task)
        assert.deepEqual(serialized.config, {})
        assert.deepEqual(serialized.dependencies, [])
    })
})
