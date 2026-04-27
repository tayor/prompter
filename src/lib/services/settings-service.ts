import { z } from 'zod'
import { ensureKanbanScriptWatcherStarted } from '@/lib/kanban/script-watcher'
import { getKanbanSettings, updateKanbanSettings } from '@/lib/kanban/settings-store'
import prisma from '@/lib/prisma'
import { updateSettingsSchema } from '@/lib/validators'

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>

export async function getSettingsWithKanban() {
    let settings = await prisma.settings.findUnique({
        where: { id: 'settings' },
    })

    if (!settings) {
        settings = await prisma.settings.create({
            data: {
                id: 'settings',
                theme: 'system',
                editorFontSize: 14,
                autoSaveInterval: 30,
            },
        })
    }

    const kanbanSettings = await getKanbanSettings()

    return {
        ...settings,
        kanban: kanbanSettings,
    }
}

export async function updateSettingsWithKanban(data: UpdateSettingsInput) {
    const { kanban, ...settingsUpdate } = data

    const [settings, kanbanSettings] = await Promise.all([
        prisma.settings.upsert({
            where: { id: 'settings' },
            update: settingsUpdate,
            create: {
                id: 'settings',
                ...settingsUpdate,
            },
        }),
        kanban
            ? updateKanbanSettings(kanban)
            : getKanbanSettings(),
    ])

    if (kanban) {
        await ensureKanbanScriptWatcherStarted()
    }

    return {
        ...settings,
        kanban: kanbanSettings,
    }
}

export async function resetPromptUsageCounts() {
    const result = await prisma.prompt.updateMany({
        data: { usageCount: 0 },
    })

    return {
        count: result.count,
        message: `Reset usage counts for ${result.count} prompts`,
    }
}
