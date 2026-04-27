import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    parseSearchParams,
    getPromptSearchOrderBy,
    getWorkflowSearchOrderBy,
} from '@/lib/services/search-service'

describe('parseSearchParams', () => {
    it('returns defaults for empty search params', () => {
        const { query, type } = parseSearchParams(new URLSearchParams())
        assert.equal(query.page, 1)
        assert.equal(query.limit, 20)
        assert.equal(type, 'all')
    })

    it('parses type from search params', () => {
        const { type } = parseSearchParams(new URLSearchParams({ type: 'prompts' }))
        assert.equal(type, 'prompts')
    })

    it('defaults invalid type to all', () => {
        const { type } = parseSearchParams(new URLSearchParams({ type: 'invalid' }))
        assert.equal(type, 'all')
    })

    it('parses all query params', () => {
        const { query } = parseSearchParams(new URLSearchParams({
            q: 'hello',
            sort: 'created',
            order: 'asc',
            page: '2',
            limit: '10',
        }))
        assert.equal(query.q, 'hello')
        assert.equal(query.sort, 'created')
        assert.equal(query.order, 'asc')
        assert.equal(query.page, 2)
        assert.equal(query.limit, 10)
    })
})

describe('getPromptSearchOrderBy', () => {
    it('returns updatedAt by default', () => {
        assert.deepEqual(getPromptSearchOrderBy('updated', 'desc'), { updatedAt: 'desc' })
    })

    it('returns createdAt for created', () => {
        assert.deepEqual(getPromptSearchOrderBy('created', 'asc'), { createdAt: 'asc' })
    })

    it('returns usageCount for usage', () => {
        assert.deepEqual(getPromptSearchOrderBy('usage', 'desc'), { usageCount: 'desc' })
    })

    it('returns title for title', () => {
        assert.deepEqual(getPromptSearchOrderBy('title', 'asc'), { title: 'asc' })
    })
})

describe('getWorkflowSearchOrderBy', () => {
    it('returns updatedAt by default', () => {
        assert.deepEqual(getWorkflowSearchOrderBy('updated', 'desc'), { updatedAt: 'desc' })
    })

    it('returns createdAt for created', () => {
        assert.deepEqual(getWorkflowSearchOrderBy('created', 'asc'), { createdAt: 'asc' })
    })

    it('returns runCount for usage', () => {
        assert.deepEqual(getWorkflowSearchOrderBy('usage', 'desc'), { runCount: 'desc' })
    })

    it('returns name for name', () => {
        assert.deepEqual(getWorkflowSearchOrderBy('name', 'asc'), { name: 'asc' })
    })
})
