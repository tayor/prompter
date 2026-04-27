import { DEFAULT_CLAUDE_MODEL } from '@/lib/model-defaults'
import {
    kanbanSettingsSchema,
    updateKanbanSettingsSchema,
    type KanbanSettingsInput,
    type UpdateKanbanSettingsInput,
} from '@/lib/validators'

export const DEFAULT_KANBAN_SETTINGS: KanbanSettingsInput = {
    server: {
        host: '127.0.0.1',
        port: 3741,
    },
    watchDirectory: '~/scripts',
    recognizedExtensions: ['.sh', '.bash', '.py', '.js', '.ts', '.zsh'],
    execution: {
        defaultTimeout: 300,
        defaultRetryOnFail: false,
        defaultMaxRetries: 0,
        defaultRetryDelay: 0,
        gracePeriod: 10,
        maxLogFileSize: '10MB',
        maxTotalLogStorage: '1GB',
        liveLogLineLimit: 1000,
    },
    defaults: {
        tool: 'claude-cli',
        model: DEFAULT_CLAUDE_MODEL,
    },
    notifications: {
        inApp: true,
        desktop: true,
        sound: false,
        onTaskCompleted: true,
        onTaskFailed: true,
        onQueueEmpty: true,
        onDependencyBlocked: true,
        onScriptChanged: true,
    },
    ui: {
        theme: 'system',
        highContrast: false,
        terminalFontSize: 14,
        autoScrollLogs: true,
        autoSelectRunningLog: true,
    },
}

export function cloneDefaultKanbanSettings(): KanbanSettingsInput {
    return kanbanSettingsSchema.parse(DEFAULT_KANBAN_SETTINGS)
}

export function mergeKanbanSettings(
    baseSettings: KanbanSettingsInput,
    update: UpdateKanbanSettingsInput,
): KanbanSettingsInput {
    return kanbanSettingsSchema.parse({
        ...baseSettings,
        ...update,
        server: update.server
            ? { ...baseSettings.server, ...update.server }
            : baseSettings.server,
        execution: update.execution
            ? { ...baseSettings.execution, ...update.execution }
            : baseSettings.execution,
        defaults: update.defaults
            ? { ...baseSettings.defaults, ...update.defaults }
            : baseSettings.defaults,
        notifications: update.notifications
            ? { ...baseSettings.notifications, ...update.notifications }
            : baseSettings.notifications,
        ui: update.ui
            ? { ...baseSettings.ui, ...update.ui }
            : baseSettings.ui,
    })
}

export function parseKanbanSettingsPayload(payload: unknown): KanbanSettingsInput {
    const defaults = cloneDefaultKanbanSettings()
    const parsedUpdate = updateKanbanSettingsSchema.safeParse(payload)
    if (!parsedUpdate.success) {
        return defaults
    }

    return mergeKanbanSettings(defaults, parsedUpdate.data)
}
