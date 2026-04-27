import type { KanbanColumn, KanbanExecutionStatus, KanbanTask } from '@prisma/client'

export const DEFAULT_TASK_TIMEOUT_SECONDS = 300
export const DEFAULT_TERMINATION_GRACE_SECONDS = 10
const MAX_ENV_VAR_KEY_LENGTH = 128
const MAX_ENV_VAR_VALUE_LENGTH = 8_192

export type KanbanToolMode =
    | 'claude-cli'
    | 'codex-cli'
    | 'ollama'
    | 'custom-bash'
    | 'custom-command'
    | 'custom'

export interface KanbanTaskRuntimeConfig {
    tool: KanbanToolMode
    model: string
    prompt?: string
    additionalArgs?: string
    customCommand?: string
    envVars: Record<string, string>
    timeout: number
    gracePeriod: number
    retryOnFail: boolean
    maxRetries: number
    retryDelay: number
    workingDirectory?: string
}

export interface ParsedKanbanTask {
    id: string
    name: string
    sourcePath: string
    column: KanbanColumn
    position: number
    dependencies: string[]
    config: KanbanTaskRuntimeConfig
    raw: KanbanTask
}

export interface KanbanExecutionStartMetadata {
    status: 'running'
    startedAt: Date
    pid: number | null
    logFile: string | null
    command: string
    args: string[]
    cwd: string
}

export interface KanbanExecutionCompletionMetadata {
    status: 'completed'
    completedAt: Date
    durationMs: number
    exitCode: number
    logFile: string | null
    logPersistenceError?: string
    stdout: string
    stderr: string
}

export interface KanbanExecutionFailureMetadata {
    status: Extract<KanbanExecutionStatus, 'failed' | 'cancelled'>
    completedAt: Date
    durationMs: number
    exitCode: number | null
    logFile: string | null
    logPersistenceError?: string
    signal: NodeJS.Signals | null
    timedOut: boolean
    cancelled: boolean
    reason: string
    stdout: string
    stderr: string
}

export interface KanbanBlockedTaskMetadata {
    taskId: string
    blockedByTaskIds: string[]
    reason: string
    detectedAt: Date
}

export function parseKanbanTaskRecord(task: KanbanTask): ParsedKanbanTask {
    return {
        id: task.id,
        name: task.name,
        sourcePath: task.sourcePath,
        column: task.column,
        position: task.position,
        dependencies: parseTaskDependencies(task.dependencies),
        config: parseTaskConfig(task.config),
        raw: task,
    }
}

export function parseTaskDependencies(rawDependencies: string): string[] {
    const parsed = safeJsonParse<unknown[]>(rawDependencies, [])

    if (!Array.isArray(parsed)) {
        return []
    }

    const uniqueDependencies = new Set<string>()
    for (const value of parsed) {
        if (typeof value !== 'string') {
            continue
        }

        const dependencyId = value.trim()
        if (dependencyId.length > 0) {
            uniqueDependencies.add(dependencyId)
        }
    }

    return Array.from(uniqueDependencies)
}

export function parseTaskConfig(rawConfig: string): KanbanTaskRuntimeConfig {
    const parsed = safeJsonParse<Record<string, unknown>>(rawConfig, {})
    const envVars = normalizeEnvVars(parsed.envVars)

    return {
        tool: normalizeToolMode(parsed.tool),
        model: toStringValue(parsed.model),
        prompt: toOptionalStringValue(parsed.prompt),
        additionalArgs: toOptionalStringValue(parsed.additionalArgs),
        customCommand: toOptionalStringValue(parsed.customCommand),
        envVars,
        timeout: normalizeInteger(parsed.timeout, DEFAULT_TASK_TIMEOUT_SECONDS, 1, 3600),
        gracePeriod: normalizeInteger(parsed.gracePeriod, DEFAULT_TERMINATION_GRACE_SECONDS, 1, 120),
        retryOnFail: Boolean(parsed.retryOnFail),
        maxRetries: normalizeInteger(parsed.maxRetries, 0, 0, 10),
        retryDelay: normalizeInteger(parsed.retryDelay, 0, 0, 3600),
        workingDirectory: toOptionalStringValue(parsed.workingDirectory),
    }
}

function normalizeToolMode(value: unknown): KanbanToolMode {
    if (typeof value !== 'string') {
        return 'claude-cli'
    }

    switch (value) {
        case 'claude-cli':
        case 'codex-cli':
        case 'ollama':
        case 'custom-bash':
        case 'custom-command':
        case 'custom':
            return value
        default:
            return 'claude-cli'
    }
}

function normalizeEnvVars(value: unknown): Record<string, string> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {}
    }

    const envVars: Record<string, string> = {}
    for (const [key, candidate] of Object.entries(value)) {
        if (typeof candidate !== 'string') {
            continue
        }

        const normalizedKey = key.trim()
        if (
            normalizedKey.length === 0
            || normalizedKey.length > MAX_ENV_VAR_KEY_LENGTH
            || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalizedKey)
            || candidate.length > MAX_ENV_VAR_VALUE_LENGTH
        ) {
            continue
        }

        envVars[normalizedKey] = candidate
    }

    return envVars
}

function normalizeInteger(
    value: unknown,
    fallback: number,
    min: number,
    max: number,
): number {
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

function toStringValue(value: unknown): string {
    if (typeof value !== 'string') {
        return ''
    }
    return value.trim()
}

function toOptionalStringValue(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined
    }

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : undefined
}

function safeJsonParse<T>(input: string, fallback: T): T {
    try {
        return JSON.parse(input) as T
    } catch {
        return fallback
    }
}
