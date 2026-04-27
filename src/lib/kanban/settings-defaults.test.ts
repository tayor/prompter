import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    DEFAULT_KANBAN_SETTINGS,
    cloneDefaultKanbanSettings,
    mergeKanbanSettings,
    parseKanbanSettingsPayload,
} from '@/lib/kanban/settings-defaults'

describe('cloneDefaultKanbanSettings', () => {
    it('returns a deep copy matching the default structure', () => {
        const settings = cloneDefaultKanbanSettings()
        assert.deepEqual(settings.server, DEFAULT_KANBAN_SETTINGS.server)
        assert.deepEqual(settings.execution, DEFAULT_KANBAN_SETTINGS.execution)
        assert.deepEqual(settings.defaults, DEFAULT_KANBAN_SETTINGS.defaults)
    })

    it('returns independent copies', () => {
        const a = cloneDefaultKanbanSettings()
        const b = cloneDefaultKanbanSettings()
        a.server.port = 9999
        assert.notEqual(a.server.port, b.server.port)
    })
})

describe('mergeKanbanSettings', () => {
    it('overrides top-level fields', () => {
        const base = cloneDefaultKanbanSettings()
        const merged = mergeKanbanSettings(base, { watchDirectory: '~/custom' })
        assert.equal(merged.watchDirectory, '~/custom')
    })

    it('deep-merges nested sections', () => {
        const base = cloneDefaultKanbanSettings()
        const merged = mergeKanbanSettings(base, { server: { port: 4000 } })
        assert.equal(merged.server.port, 4000)
        assert.equal(merged.server.host, '127.0.0.1')
    })

    it('preserves unaffected sections', () => {
        const base = cloneDefaultKanbanSettings()
        const merged = mergeKanbanSettings(base, { defaults: { model: 'gpt-4' } })
        assert.equal(merged.defaults.model, 'gpt-4')
        assert.equal(merged.defaults.tool, 'claude-cli')
        assert.deepEqual(merged.execution, base.execution)
    })
})

describe('parseKanbanSettingsPayload', () => {
    it('parses valid payload and merges with defaults', () => {
        const settings = parseKanbanSettingsPayload({ watchDirectory: '~/scripts2' })
        assert.equal(settings.watchDirectory, '~/scripts2')
        assert.equal(settings.server.host, '127.0.0.1')
    })

    it('returns defaults for invalid payload', () => {
        const settings = parseKanbanSettingsPayload('garbage')
        assert.deepEqual(settings, cloneDefaultKanbanSettings())
    })

    it('returns defaults for null payload', () => {
        const settings = parseKanbanSettingsPayload(null)
        assert.deepEqual(settings, cloneDefaultKanbanSettings())
    })
})
