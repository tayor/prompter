import prisma from '@/lib/prisma'
import { updateKanbanSettingsSchema, type KanbanSettingsInput, type UpdateKanbanSettingsInput } from '@/lib/validators'
import {
    cloneDefaultKanbanSettings,
    mergeKanbanSettings,
    parseKanbanSettingsPayload,
} from '@/lib/kanban/settings-defaults'

export const KANBAN_SETTINGS_KEY = 'kanban-settings'
const LEGACY_KANBAN_SETTINGS_KEYS = [
    KANBAN_SETTINGS_KEY,
    'kanban:settings',
    'kanbanSettings',
    'config',
    'settings',
]

export async function getKanbanSettings(): Promise<KanbanSettingsInput> {
    const row = await prisma.kanbanAppConfig.findFirst({
        where: {
            key: { in: LEGACY_KANBAN_SETTINGS_KEYS },
        },
        select: {
            key: true,
            value: true,
        },
        orderBy: {
            updatedAt: 'desc',
        },
    })

    const settings = row
        ? parseKanbanSettingsPayload(parseStoredSettingsValue(row.value))
        : cloneDefaultKanbanSettings()
    const serializedSettings = JSON.stringify(settings)

    if (!row || row.key !== KANBAN_SETTINGS_KEY || row.value !== serializedSettings) {
        await prisma.kanbanAppConfig.upsert({
            where: { key: KANBAN_SETTINGS_KEY },
            update: { value: serializedSettings },
            create: {
                key: KANBAN_SETTINGS_KEY,
                value: serializedSettings,
            },
        })
    }

    return settings
}

export async function updateKanbanSettings(update: UpdateKanbanSettingsInput): Promise<KanbanSettingsInput> {
    const parsedUpdate = updateKanbanSettingsSchema.parse(update)
    const currentSettings = await getKanbanSettings()
    const nextSettings = mergeKanbanSettings(currentSettings, parsedUpdate)
    const serializedSettings = JSON.stringify(nextSettings)

    await prisma.kanbanAppConfig.upsert({
        where: { key: KANBAN_SETTINGS_KEY },
        update: { value: serializedSettings },
        create: {
            key: KANBAN_SETTINGS_KEY,
            value: serializedSettings,
        },
    })

    return nextSettings
}

function parseStoredSettingsValue(rawValue: string): unknown {
    try {
        return JSON.parse(rawValue)
    } catch {
        return rawValue
    }
}
