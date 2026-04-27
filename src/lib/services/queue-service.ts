import type { KanbanColumn } from '@prisma/client'
import { DEFAULT_CLAUDE_MODEL } from '@/lib/model-defaults'
import { kanbanTaskConfigSchema } from '@/lib/validators'
import { parseJsonField } from '@/lib/services/tasks-service'

const KANBAN_TOOL_OPTIONS = new Set(['claude-cli', 'codex-cli', 'ollama', 'custom-bash', 'custom-command', 'custom'])

export interface RuntimeDefaultsSettings {
    defaults?: {
        model?: string
        tool?: string
    }
    execution?: {
        defaultTimeout?: number
        defaultRetryOnFail?: boolean
        defaultMaxRetries?: number
        defaultRetryDelay?: number
    }
}

export function applyQueueRuntimeDefaults(
    config: Record<string, unknown>,
    settings: RuntimeDefaultsSettings | null,
): Record<string, unknown> {
    const defaultModel = settings?.defaults?.model?.trim() || DEFAULT_CLAUDE_MODEL
    const configuredTool = settings?.defaults?.tool ?? asString(config.tool)
    const defaultTool = KANBAN_TOOL_OPTIONS.has(configuredTool) ? configuredTool : 'claude-cli'
    const defaultTimeout = settings?.execution?.defaultTimeout ?? 300
    const defaultRetryOnFail = settings?.execution?.defaultRetryOnFail ?? false
    const defaultMaxRetries = settings?.execution?.defaultMaxRetries ?? 0
    const defaultRetryDelay = settings?.execution?.defaultRetryDelay ?? 0

    return {
        ...config,
        tool: defaultTool,
        model: asString(config.model).trim().length > 0 ? asString(config.model).trim() : defaultModel,
        timeout: toBoundedInteger(config.timeout, defaultTimeout, 1, 3600),
        retryOnFail: typeof config.retryOnFail === 'boolean' ? config.retryOnFail : defaultRetryOnFail,
        maxRetries: toBoundedInteger(config.maxRetries, defaultMaxRetries, 0, 5),
        retryDelay: toBoundedInteger(config.retryDelay, defaultRetryDelay, 0, 3600),
        envVars: toStringRecord(config.envVars),
    }
}

export function getLifecycleTransitionError(from: KanbanColumn, to: KanbanColumn): string | null {
    if (from === 'running') {
        return 'Running tasks cannot be moved. Cancel the running task first.'
    }

    if (from === to) {
        if (from === 'queued') {
            return null
        }

        return `Transition from ${from} to ${to} is not allowed`
    }

    if (to === 'paused') {
        return null
    }

    if (from === 'backlog' && to === 'queued') {
        return null
    }

    if (from === 'queued' && to === 'backlog') {
        return null
    }

    if ((from === 'failed' || from === 'completed' || from === 'paused') && to === 'queued') {
        return null
    }

    return `Transition from ${from} to ${to} is not allowed`
}

export function getQueueValidationError(task: { id: string; config: string }): string | null {
    const parsedConfig = parseJsonField<Record<string, unknown> | null>(task.config, null)
    if (!parsedConfig) {
        return `Task ${task.id} has invalid config JSON`
    }

    const configValidation = kanbanTaskConfigSchema.safeParse(parsedConfig)
    if (!configValidation.success) {
        return `Task ${task.id} config is invalid for queueing`
    }

    return null
}

function asString(value: unknown): string {
    if (typeof value !== 'string') {
        return ''
    }

    return value
}

function toBoundedInteger(value: unknown, fallback: number, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return fallback
    }

    const rounded = Math.round(value)
    if (rounded < min) {
        return min
    }

    if (rounded > max) {
        return max
    }

    return rounded
}

function toStringRecord(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {}
    }

    const result: Record<string, string> = {}
    for (const [key, candidate] of Object.entries(value)) {
        if (typeof candidate !== 'string') {
            continue
        }

        const normalizedKey = key.trim()
        if (normalizedKey.length === 0) {
            continue
        }

        result[normalizedKey] = candidate
    }

    return result
}
