import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    applyQueueRuntimeDefaults,
    getLifecycleTransitionError,
    getQueueValidationError,
} from '@/lib/services/queue-service'

describe('applyQueueRuntimeDefaults', () => {
    it('applies default model and tool when config is empty', () => {
        const result = applyQueueRuntimeDefaults({}, null)
        assert.equal(result.tool, 'claude-cli')
        assert.ok(typeof result.model === 'string' && result.model.length > 0)
        assert.equal(result.timeout, 300)
        assert.equal(result.retryOnFail, false)
        assert.equal(result.maxRetries, 0)
    })

    it('preserves existing model when set', () => {
        const result = applyQueueRuntimeDefaults({ model: 'gpt-4' }, null)
        assert.equal(result.model, 'gpt-4')
    })

    it('uses settings defaults when provided', () => {
        const result = applyQueueRuntimeDefaults({}, {
            defaults: { model: 'custom-model', tool: 'codex-cli' },
            execution: { defaultTimeout: 600 },
        })
        assert.equal(result.model, 'custom-model')
        assert.equal(result.tool, 'codex-cli')
        assert.equal(result.timeout, 600)
    })

    it('clamps timeout to bounds', () => {
        const result = applyQueueRuntimeDefaults({ timeout: 9999 }, null)
        assert.equal(result.timeout, 3600)

        const result2 = applyQueueRuntimeDefaults({ timeout: -1 }, null)
        assert.equal(result2.timeout, 1)
    })

    it('normalizes envVars to string record', () => {
        const result = applyQueueRuntimeDefaults({ envVars: { KEY: 'val', BAD: 123 } }, null)
        assert.deepEqual(result.envVars, { KEY: 'val' })
    })
})

describe('getLifecycleTransitionError', () => {
    it('allows backlog → queued', () => {
        assert.equal(getLifecycleTransitionError('backlog', 'queued'), null)
    })

    it('allows queued → backlog', () => {
        assert.equal(getLifecycleTransitionError('queued', 'backlog'), null)
    })

    it('blocks running → any', () => {
        const err = getLifecycleTransitionError('running', 'queued')
        assert.ok(err)
        assert.ok(err!.includes('Running'))
    })

    it('allows completed → queued', () => {
        assert.equal(getLifecycleTransitionError('completed', 'queued'), null)
    })

    it('allows failed → queued', () => {
        assert.equal(getLifecycleTransitionError('failed', 'queued'), null)
    })

    it('allows any → paused', () => {
        assert.equal(getLifecycleTransitionError('backlog', 'paused'), null)
        assert.equal(getLifecycleTransitionError('completed', 'paused'), null)
    })

    it('blocks same-column transition (except queued)', () => {
        const err = getLifecycleTransitionError('backlog', 'backlog')
        assert.ok(err)
    })

    it('allows queued → queued (reorder)', () => {
        assert.equal(getLifecycleTransitionError('queued', 'queued'), null)
    })

    it('blocks invalid transitions', () => {
        const err = getLifecycleTransitionError('backlog', 'completed')
        assert.ok(err)
    })
})

describe('getQueueValidationError', () => {
    it('returns null for valid config', () => {
        const err = getQueueValidationError({
            id: 'task-1',
            config: JSON.stringify({ tool: 'claude-cli', model: 'claude-sonnet-4' }),
        })
        assert.equal(err, null)
    })

    it('returns error for invalid JSON config', () => {
        const err = getQueueValidationError({ id: 'task-1', config: 'bad-json' })
        assert.ok(err)
        assert.ok(err!.includes('invalid config'))
    })

    it('returns error for config missing required fields', () => {
        const err = getQueueValidationError({
            id: 'task-1',
            config: JSON.stringify({ tool: 'invalid-tool' }),
        })
        assert.ok(err)
    })
})
