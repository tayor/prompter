import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getKanbanSettings, updateKanbanSettings, KANBAN_SETTINGS_KEY } from '@/lib/kanban/settings-store'
import { DEFAULT_KANBAN_SETTINGS } from '@/lib/kanban/settings-defaults'
import { prisma } from '@/lib/prisma'

describe('getKanbanSettings', () => {
    it('returns default settings when no row exists', async () => {
        await prisma.kanbanAppConfig.deleteMany({ where: { key: KANBAN_SETTINGS_KEY } })
        const settings = await getKanbanSettings()
        assert.equal(settings.server.host, DEFAULT_KANBAN_SETTINGS.server.host)
        assert.equal(settings.server.port, DEFAULT_KANBAN_SETTINGS.server.port)
    })

    it('persists default settings to the database after first call', async () => {
        await prisma.kanbanAppConfig.deleteMany({ where: { key: KANBAN_SETTINGS_KEY } })
        await getKanbanSettings()
        const row = await prisma.kanbanAppConfig.findUnique({ where: { key: KANBAN_SETTINGS_KEY } })
        assert.ok(row)
        assert.ok(row.value.includes(DEFAULT_KANBAN_SETTINGS.server.host))
    })
})

describe('updateKanbanSettings', () => {
    it('merges partial update and persists', async () => {
        const updated = await updateKanbanSettings({ watchDirectory: '~/new-scripts' })
        assert.equal(updated.watchDirectory, '~/new-scripts')
        assert.equal(updated.server.host, DEFAULT_KANBAN_SETTINGS.server.host)

        const row = await prisma.kanbanAppConfig.findUnique({ where: { key: KANBAN_SETTINGS_KEY } })
        assert.ok(row)
        assert.ok(row.value.includes('~/new-scripts'))
    })

    it('deeply merges nested sections', async () => {
        const updated = await updateKanbanSettings({
            execution: { defaultTimeout: 600 },
        })
        assert.equal(updated.execution.defaultTimeout, 600)
        assert.equal(updated.execution.defaultRetryOnFail, false)
    })
})
