import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    parseJsonField,
    serializeKanbanTask,
    buildKanbanTaskWhere,
} from '@/lib/services/tasks-service'

describe('parseJsonField', () => {
    it('parses valid JSON', () => {
        assert.deepEqual(parseJsonField('{"key":"value"}', {}), { key: 'value' })
    })

    it('returns fallback for invalid JSON', () => {
        assert.deepEqual(parseJsonField('bad', { default: true }), { default: true })
    })

    it('parses arrays', () => {
        assert.deepEqual(parseJsonField('[1,2,3]', []), [1, 2, 3])
    })
})

describe('serializeKanbanTask', () => {
    it('parses config and dependencies from JSON strings', () => {
        const task = {
            id: 'test',
            config: '{"tool":"claude-cli"}',
            dependencies: '["dep-1"]',
        }
        const result = serializeKanbanTask(task)
        assert.deepEqual(result.config, { tool: 'claude-cli' })
        assert.deepEqual(result.dependencies, ['dep-1'])
    })

    it('handles invalid JSON with fallbacks', () => {
        const task = { config: 'invalid', dependencies: 'invalid' }
        const result = serializeKanbanTask(task)
        assert.deepEqual(result.config, {})
        assert.deepEqual(result.dependencies, [])
    })
})

describe('buildKanbanTaskWhere', () => {
    it('returns empty where for no filters', () => {
        const where = buildKanbanTaskWhere({})
        assert.deepEqual(where, {})
    })

    it('includes column filter', () => {
        const where = buildKanbanTaskWhere({ column: 'queued' })
        assert.equal(where.column, 'queued')
    })

    it('includes text search filter', () => {
        const where = buildKanbanTaskWhere({ q: 'test' })
        assert.ok(where.OR)
        assert.ok(Array.isArray(where.OR))
    })

    it('includes both column and text search', () => {
        const where = buildKanbanTaskWhere({ column: 'backlog', q: 'script' })
        assert.equal(where.column, 'backlog')
        assert.ok(where.OR)
    })
})
