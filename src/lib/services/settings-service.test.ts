import assert from 'node:assert/strict'
import { describe, it, after } from 'node:test'
import { prisma } from '@/lib/prisma'
import {
    getSettingsWithKanban,
    updateSettingsWithKanban,
    resetPromptUsageCounts,
} from '@/lib/services/settings-service'

after(async () => {
    await prisma.$disconnect()
})

describe('getSettingsWithKanban', () => {
    it('returns settings with kanban section', async () => {
        const settings = await getSettingsWithKanban()
        assert.ok(settings)
        assert.ok('theme' in settings)
        assert.ok('kanban' in settings)
        assert.ok(settings.kanban.server)
    })

    it('creates default settings if none exist', async () => {
        await prisma.settings.deleteMany({})
        const settings = await getSettingsWithKanban()
        assert.equal(settings.theme, 'system')
        assert.equal(settings.editorFontSize, 14)
    })
})

describe('updateSettingsWithKanban', () => {
    it('updates prompt settings', async () => {
        const result = await updateSettingsWithKanban({ theme: 'dark' })
        assert.equal(result.theme, 'dark')
    })

    it('updates kanban settings simultaneously', async () => {
        const result = await updateSettingsWithKanban({
            kanban: { watchDirectory: '~/test-scripts' },
        })
        assert.equal(result.kanban.watchDirectory, '~/test-scripts')
    })
})

describe('resetPromptUsageCounts', () => {
    it('resets all prompt usage counts to zero', async () => {
        // Create a prompt with usage
        const prompt = await prisma.prompt.create({
            data: {
                title: 'Usage Test Prompt',
                content: 'Test content',
                usageCount: 42,
            },
        })

        const result = await resetPromptUsageCounts()
        assert.ok(result.count >= 1)

        const updated = await prisma.prompt.findUnique({ where: { id: prompt.id } })
        assert.equal(updated!.usageCount, 0)

        // Cleanup
        await prisma.promptVersion.deleteMany({ where: { promptId: prompt.id } })
        await prisma.prompt.delete({ where: { id: prompt.id } })
    })
})
