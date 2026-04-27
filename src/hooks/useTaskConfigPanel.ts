'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { z } from 'zod'
import { parseKanbanSettingsPayload } from '@/lib/kanban/settings-defaults'
import {
    kanbanColumnSchema,
    kanbanModelProviderSchema,
    kanbanTaskConfigSchema,
    kanbanToolSchema,
    updateKanbanTaskSchema,
    type KanbanModelProvider,
    type KanbanTool,
    type UpdateKanbanTaskInput,
} from '@/lib/validators'

const modelDiscoveryResponseSchema = z.object({
    provider: kanbanModelProviderSchema,
    models: z.array(z.string()),
    options: z.array(z.object({
        value: z.string(),
        label: z.string(),
    })).default([]),
    source: z.enum(['cli', 'fallback']),
})

const taskResponseSchema = z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    displayName: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    sourcePath: z.string().min(1),
    sourceHash: z.string().nullable().optional(),
    column: kanbanColumnSchema,
    position: z.number(),
    config: z.record(z.string(), z.unknown()).default({}),
    dependencies: z.array(z.string()).default([]),
    createdAt: z.string(),
    updatedAt: z.string(),
})

const taskListResponseSchema = z.object({
    tasks: z.array(taskResponseSchema),
})

const TOOL_PROVIDER_MAP: Partial<Record<KanbanTool, KanbanModelProvider>> = {
    'claude-cli': 'claude',
    'codex-cli': 'codex',
    'ollama': 'ollama',
}

export const TASK_TOOL_OPTIONS: Array<{ value: KanbanTool, label: string, description: string }> = [
    {
        value: 'claude-cli',
        label: 'Claude CLI',
        description: 'Run with the Claude CLI',
    },
    {
        value: 'codex-cli',
        label: 'Codex CLI',
        description: 'Run with the Codex CLI',
    },
    {
        value: 'ollama',
        label: 'Ollama',
        description: 'Run locally with Ollama models',
    },
    {
        value: 'custom-bash',
        label: 'Custom Bash',
        description: 'Run using custom bash mode',
    },
    {
        value: 'custom-command',
        label: 'Custom Command',
        description: 'Run using an explicit command template',
    },
    {
        value: 'custom',
        label: 'Custom Tool',
        description: 'Use external runtime integration',
    },
]

interface TaskExecutionDefaults {
    timeout: number
    retryOnFail: boolean
    maxRetries: number
    retryDelay: number
}

export type TaskConfigTask = z.infer<typeof taskResponseSchema>
export type TaskConfigModelSource = z.infer<typeof modelDiscoveryResponseSchema.shape.source>

export interface TaskConfigEnvVarRow {
    id: string
    key: string
    value: string
}

export interface TaskConfigFormValues {
    tool: KanbanTool
    model: string
    prompt: string
    additionalArgs: string
    envVars: TaskConfigEnvVarRow[]
    timeout: number
    retryOnFail: boolean
    maxRetries: number
    retryDelay: number
    workingDirectory: string
}

interface UseTaskConfigPanelOptions {
    taskId: string | null
    onSaved?: (task: TaskConfigTask) => void
}

export interface UseTaskConfigPanelResult {
    task: TaskConfigTask | null
    loading: boolean
    saving: boolean
    error: string | null
    provider: KanbanModelProvider | null
    modelOptions: string[]
    modelSource: TaskConfigModelSource | null
    modelsLoading: boolean
    formValues: TaskConfigFormValues
    selectedDependencies: string[]
    dependencyOptions: TaskConfigTask[]
    updateField: <K extends keyof TaskConfigFormValues>(key: K, value: TaskConfigFormValues[K]) => void
    updateEnvVar: (rowId: string, field: 'key' | 'value', value: string) => void
    addEnvVar: () => void
    removeEnvVar: (rowId: string) => void
    toggleDependency: (taskId: string, selected: boolean) => void
    save: () => Promise<boolean>
    reload: () => Promise<void>
    refreshModels: () => Promise<void>
}

const DEFAULT_EXECUTION_DEFAULTS: TaskExecutionDefaults = {
    timeout: 300,
    retryOnFail: false,
    maxRetries: 0,
    retryDelay: 0,
}

export function useTaskConfigPanel({
    taskId,
    onSaved,
}: UseTaskConfigPanelOptions): UseTaskConfigPanelResult {
    const [task, setTask] = useState<TaskConfigTask | null>(null)
    const [allTasks, setAllTasks] = useState<TaskConfigTask[]>([])
    const [executionDefaults, setExecutionDefaults] = useState<TaskExecutionDefaults>(DEFAULT_EXECUTION_DEFAULTS)
    const [formValues, setFormValues] = useState<TaskConfigFormValues>(() => createDefaultFormValues())
    const [selectedDependencies, setSelectedDependencies] = useState<string[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [modelOptions, setModelOptions] = useState<string[]>([])
    const [modelSource, setModelSource] = useState<TaskConfigModelSource | null>(null)
    const [modelsLoading, setModelsLoading] = useState(false)

    const provider = useMemo(
        () => TOOL_PROVIDER_MAP[formValues.tool] ?? null,
        [formValues.tool]
    )

    const dependencyOptions = useMemo(
        () => allTasks.filter((candidate) => candidate.id !== taskId),
        [allTasks, taskId]
    )

    const hydrateFromTask = useCallback((taskRecord: TaskConfigTask) => {
        setTask(taskRecord)
        setFormValues(normalizeTaskConfig(taskRecord.config, executionDefaults))
        setSelectedDependencies(
            taskRecord.dependencies
                .filter((dependencyId) => dependencyId !== taskRecord.id)
                .filter((dependencyId, index, values) => values.indexOf(dependencyId) === index)
        )
    }, [executionDefaults])

    const loadExecutionDefaults = useCallback(async () => {
        try {
            const response = await fetch('/api/settings', { cache: 'no-store' })
            if (!response.ok) {
                return
            }

            const payload = await response.json() as { kanban?: unknown }
            const kanbanSettings = parseKanbanSettingsPayload(payload.kanban)
            setExecutionDefaults({
                timeout: kanbanSettings.execution.defaultTimeout,
                retryOnFail: kanbanSettings.execution.defaultRetryOnFail,
                maxRetries: kanbanSettings.execution.defaultMaxRetries,
                retryDelay: kanbanSettings.execution.defaultRetryDelay,
            })
        } catch {
            // noop
        }
    }, [])

    const reload = useCallback(async () => {
        if (!taskId) {
            setTask(null)
            setAllTasks([])
            setFormValues(createDefaultFormValues(executionDefaults))
            setSelectedDependencies([])
            setError(null)
            return
        }

        setLoading(true)
        setError(null)

        try {
            const [taskResponse, taskListResponse] = await Promise.all([
                fetch(`/api/tasks/${taskId}`, { cache: 'no-store' }),
                fetch('/api/tasks', { cache: 'no-store' }),
            ])

            if (!taskResponse.ok) {
                throw new Error('Failed to load selected task')
            }
            if (!taskListResponse.ok) {
                throw new Error('Failed to load task dependencies')
            }

            const [taskPayload, taskListPayload] = await Promise.all([
                taskResponse.json(),
                taskListResponse.json(),
            ])

            const parsedTask = taskResponseSchema.safeParse(taskPayload)
            if (!parsedTask.success) {
                throw new Error('Invalid selected task payload')
            }

            const parsedTaskList = taskListResponseSchema.safeParse(taskListPayload)
            if (!parsedTaskList.success) {
                throw new Error('Invalid tasks payload')
            }

            setAllTasks(parsedTaskList.data.tasks)
            hydrateFromTask(parsedTask.data)
        } catch (loadError) {
            setError(getErrorMessage(loadError, 'Failed to load task configuration'))
        } finally {
            setLoading(false)
        }
    }, [executionDefaults, hydrateFromTask, taskId])

    const loadModels = useCallback(async (refresh = false) => {
        if (!provider) {
            setModelOptions([])
            setModelSource(null)
            return
        }

        setModelsLoading(true)
        setError(null)

        try {
            const query = refresh ? '?refresh=true' : ''
            const response = await fetch(`/api/models/${provider}${query}`, { cache: 'no-store' })

            if (!response.ok) {
                throw new Error('Failed to load models')
            }

            const payload = await response.json()
            const parsedPayload = modelDiscoveryResponseSchema.safeParse(payload)

            if (!parsedPayload.success) {
                throw new Error('Invalid model discovery payload')
            }

            setModelOptions(parsedPayload.data.models)
            setModelSource(parsedPayload.data.source)
        } catch (loadError) {
            setModelOptions([])
            setModelSource(null)
            setError(getErrorMessage(loadError, 'Failed to load model options'))
        } finally {
            setModelsLoading(false)
        }
    }, [provider])

    const refreshModels = useCallback(async () => {
        await loadModels(true)
    }, [loadModels])

    useEffect(() => {
        void loadExecutionDefaults()
    }, [loadExecutionDefaults])

    useEffect(() => {
        void reload()
    }, [reload])

    useEffect(() => {
        void loadModels(false)
    }, [loadModels])

    const updateField = useCallback(<K extends keyof TaskConfigFormValues>(
        key: K,
        value: TaskConfigFormValues[K]
    ) => {
        setFormValues((previous) => ({
            ...previous,
            [key]: value,
        }))
    }, [])

    const updateEnvVar = useCallback((rowId: string, field: 'key' | 'value', value: string) => {
        setFormValues((previous) => ({
            ...previous,
            envVars: previous.envVars.map((row) => (
                row.id === rowId
                    ? {
                        ...row,
                        [field]: value,
                    }
                    : row
            )),
        }))
    }, [])

    const addEnvVar = useCallback(() => {
        setFormValues((previous) => ({
            ...previous,
            envVars: [
                ...previous.envVars,
                {
                    id: createEnvVarRowId(),
                    key: '',
                    value: '',
                },
            ],
        }))
    }, [])

    const removeEnvVar = useCallback((rowId: string) => {
        setFormValues((previous) => {
            const nextRows = previous.envVars.filter((row) => row.id !== rowId)
            return {
                ...previous,
                envVars: nextRows.length > 0
                    ? nextRows
                    : [{ id: createEnvVarRowId(), key: '', value: '' }],
            }
        })
    }, [])

    const toggleDependency = useCallback((dependencyTaskId: string, selected: boolean) => {
        setSelectedDependencies((previous) => {
            if (selected) {
                if (previous.includes(dependencyTaskId)) {
                    return previous
                }
                return [...previous, dependencyTaskId]
            }

            return previous.filter((id) => id !== dependencyTaskId)
        })
    }, [])

    const save = useCallback(async (): Promise<boolean> => {
        if (!taskId) {
            setError('Task id is required')
            return false
        }

        setSaving(true)
        setError(null)

        try {
            const configCandidate = {
                tool: formValues.tool,
                model: formValues.model.trim(),
                prompt: toOptionalString(formValues.prompt),
                additionalArgs: toOptionalString(formValues.additionalArgs),
                envVars: toEnvVarsRecord(formValues.envVars),
                timeout: clampInteger(formValues.timeout, 1, 3600),
                retryOnFail: formValues.retryOnFail,
                maxRetries: formValues.retryOnFail
                    ? clampInteger(formValues.maxRetries, 0, 5)
                    : 0,
                retryDelay: formValues.retryOnFail
                    ? clampInteger(formValues.retryDelay, 0, 3600)
                    : 0,
                workingDirectory: toOptionalString(formValues.workingDirectory),
            }

            const parsedConfig = kanbanTaskConfigSchema.safeParse(configCandidate)
            if (!parsedConfig.success) {
                throw new Error(parsedConfig.error.issues[0]?.message || 'Task config is invalid')
            }

            const payload: UpdateKanbanTaskInput = {
                config: parsedConfig.data,
                dependencies: selectedDependencies
                    .filter((dependencyId) => dependencyId !== taskId)
                    .filter((dependencyId, index, values) => (
                        dependencyId.trim().length > 0 && values.indexOf(dependencyId) === index
                    )),
            }

            const parsedPayload = updateKanbanTaskSchema.safeParse(payload)
            if (!parsedPayload.success) {
                throw new Error(parsedPayload.error.issues[0]?.message || 'Update payload is invalid')
            }

            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsedPayload.data),
            })

            if (!response.ok) {
                throw new Error(await readErrorMessage(response, 'Failed to save task configuration'))
            }

            const updatedPayload = await response.json()
            const parsedTask = taskResponseSchema.safeParse(updatedPayload)
            if (!parsedTask.success) {
                throw new Error('Saved task payload was invalid')
            }

            setAllTasks((previous) => previous.map((candidate) => (
                candidate.id === parsedTask.data.id
                    ? parsedTask.data
                    : candidate
            )))
            hydrateFromTask(parsedTask.data)
            onSaved?.(parsedTask.data)
            return true
        } catch (saveError) {
            setError(getErrorMessage(saveError, 'Failed to save task configuration'))
            return false
        } finally {
            setSaving(false)
        }
    }, [formValues, hydrateFromTask, onSaved, selectedDependencies, taskId])

    return {
        task,
        loading,
        saving,
        error,
        provider,
        modelOptions,
        modelSource,
        modelsLoading,
        formValues,
        selectedDependencies,
        dependencyOptions,
        updateField,
        updateEnvVar,
        addEnvVar,
        removeEnvVar,
        toggleDependency,
        save,
        reload,
        refreshModels,
    }
}

function normalizeTaskConfig(
    config: Record<string, unknown>,
    executionDefaults: TaskExecutionDefaults,
): TaskConfigFormValues {
    const safeTool = kanbanToolSchema.safeParse(config.tool)
    const normalizedEnvRows = toEnvVarRows(config.envVars)
    const fallbackValues = createDefaultFormValues(executionDefaults)

    return {
        tool: safeTool.success ? safeTool.data : fallbackValues.tool,
        model: typeof config.model === 'string' ? config.model : fallbackValues.model,
        prompt: typeof config.prompt === 'string' ? config.prompt : fallbackValues.prompt,
        additionalArgs: typeof config.additionalArgs === 'string'
            ? config.additionalArgs
            : fallbackValues.additionalArgs,
        envVars: normalizedEnvRows,
        timeout: normalizeNumber(config.timeout, fallbackValues.timeout),
        retryOnFail: typeof config.retryOnFail === 'boolean'
            ? config.retryOnFail
            : fallbackValues.retryOnFail,
        maxRetries: normalizeNumber(config.maxRetries, fallbackValues.maxRetries),
        retryDelay: normalizeNumber(config.retryDelay, fallbackValues.retryDelay),
        workingDirectory: typeof config.workingDirectory === 'string'
            ? config.workingDirectory
            : fallbackValues.workingDirectory,
    }
}

function createDefaultFormValues(executionDefaults: TaskExecutionDefaults = DEFAULT_EXECUTION_DEFAULTS): TaskConfigFormValues {
    return {
        tool: 'claude-cli',
        model: '',
        prompt: '',
        additionalArgs: '',
        envVars: [{ id: createEnvVarRowId(), key: '', value: '' }],
        timeout: executionDefaults.timeout,
        retryOnFail: executionDefaults.retryOnFail,
        maxRetries: executionDefaults.maxRetries,
        retryDelay: executionDefaults.retryDelay,
        workingDirectory: '',
    }
}

function normalizeNumber(value: unknown, fallback: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return fallback
    }

    return Math.trunc(value)
}

function toEnvVarRows(value: unknown): TaskConfigEnvVarRow[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return [{ id: createEnvVarRowId(), key: '', value: '' }]
    }

    const envRows = Object.entries(value)
        .filter(([, candidate]) => typeof candidate === 'string')
        .map(([key, candidate]) => ({
            id: createEnvVarRowId(),
            key,
            value: candidate as string,
        }))

    if (envRows.length === 0) {
        return [{ id: createEnvVarRowId(), key: '', value: '' }]
    }

    return envRows
}

function toEnvVarsRecord(rows: TaskConfigEnvVarRow[]): Record<string, string> {
    const envVars: Record<string, string> = {}

    for (const row of rows) {
        const key = row.key.trim()
        if (key.length === 0) {
            continue
        }

        envVars[key] = row.value
    }

    return envVars
}

function createEnvVarRowId(): string {
    return `env-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function toOptionalString(value: string): string | undefined {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : undefined
}

function clampInteger(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
        return min
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

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
    try {
        const payload = await response.json() as { error?: unknown }
        if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
            return payload.error
        }
    } catch {
        // noop
    }

    return fallback
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message
    }
    return fallback
}
