import { z } from 'zod'

// ============================================
// PROMPT VALIDATORS
// ============================================

export const createPromptSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200),
    content: z.string().min(1, 'Content is required'),
    description: z.string().optional(),
    variables: z.array(z.string()).optional(),
    aiModel: z.string().optional(),
    category: z.enum(['system', 'user', 'assistant']).default('user'),
    folderId: z.string().optional(),
    tagIds: z.array(z.string()).optional(),
})

export const updatePromptSchema = createPromptSchema.partial()

// ============================================
// WORKFLOW VALIDATORS
// ============================================

export const inputSchemaItemSchema = z.object({
    name: z.string().min(1),
    type: z.enum(['text', 'textarea', 'select', 'number']),
    required: z.boolean().default(true),
    options: z.array(z.string()).optional(), // For select type
    defaultValue: z.string().optional(),
})

export const createWorkflowSchema = z.object({
    name: z.string().min(1, 'Name is required').max(200),
    description: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
    isTemplate: z.boolean().default(false),
    folderId: z.string().optional(),
    tagIds: z.array(z.string()).optional(),
    inputSchema: z.array(inputSchemaItemSchema).optional(),
})

export const updateWorkflowSchema = createWorkflowSchema.partial()

// ============================================
// WORKFLOW STEP VALIDATORS
// ============================================

export const conditionSchema = z.object({
    field: z.string(),
    operator: z.enum(['equals', 'notEquals', 'contains', 'notContains', 'isEmpty', 'isNotEmpty']),
    value: z.string().optional(),
})

export const createWorkflowStepSchema = z.object({
    name: z.string().min(1, 'Step name is required'),
    description: z.string().optional(),
    order: z.number().int().min(0),
    promptId: z.string().optional(),
    inlineContent: z.string().optional(),
    inputMapping: z.record(z.string(), z.string()).optional(),
    outputVariable: z.string().min(1, 'Output variable is required'),
    isOptional: z.boolean().default(false),
    condition: conditionSchema.optional(),
    aiModelOverride: z.string().optional(),
    notes: z.string().optional(),
    estimatedTokens: z.number().int().optional(),
    nextStepOnSuccess: z.string().optional(),
    nextStepOnFailure: z.string().optional(),
})

export const updateWorkflowStepSchema = createWorkflowStepSchema.partial()

export const reorderStepsSchema = z.object({
    steps: z.array(z.object({
        id: z.string(),
        order: z.number().int().min(0),
    })),
})

// ============================================
// KANBAN VALIDATORS
// ============================================

const KANBAN_ID_MAX_LENGTH = 191
const KANBAN_PATH_MAX_LENGTH = 4_096
const KANBAN_ARG_STRING_MAX_LENGTH = 24_000
const KANBAN_PROMPT_MAX_LENGTH = 20_000
const KANBAN_MODEL_MAX_LENGTH = 256
const KANBAN_ENV_KEY_MAX_LENGTH = 128
const KANBAN_ENV_VALUE_MAX_LENGTH = 8_192
const KANBAN_CRON_EXPRESSION_MAX_LENGTH = 255
const KANBAN_TIMEZONE_MAX_LENGTH = 100

export const kanbanColumnSchema = z.enum(['backlog', 'queued', 'running', 'completed', 'failed', 'paused'])

export const kanbanToolSchema = z.enum(['claude-cli', 'codex-cli', 'ollama', 'custom-bash', 'custom-command', 'custom'])

export const kanbanExecutionTriggerSchema = z.enum(['manual', 'auto', 'retry', 'random'])
export const kanbanExecutionStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled'])
export const kanbanScheduleTypeSchema = z.enum(['one_time', 'cron'])
export const kanbanScheduleStatusSchema = z.enum(['active', 'paused'])

export const kanbanModelProviderSchema = z.enum(['claude', 'codex', 'ollama'])

export const kanbanTaskDependenciesSchema = z.array(z.string().min(1))
    .max(100)
    .refine((dependencies) => new Set(dependencies).size === dependencies.length, 'Dependencies must be unique')

export const kanbanTaskModelConfigSchema = z.object({
    tool: kanbanToolSchema.default('claude-cli'),
    model: z.string().min(1, 'Model is required').max(KANBAN_MODEL_MAX_LENGTH),
    prompt: z.string().max(KANBAN_PROMPT_MAX_LENGTH).optional(),
    additionalArgs: z.string().max(KANBAN_ARG_STRING_MAX_LENGTH).optional(),
    customCommand: z.string().max(KANBAN_ARG_STRING_MAX_LENGTH).optional(),
})

export const kanbanTaskExecutionConfigSchema = z.object({
    envVars: z.record(
        z.string().min(1).max(KANBAN_ENV_KEY_MAX_LENGTH).regex(/^[A-Za-z_][A-Za-z0-9_]*$/),
        z.string().max(KANBAN_ENV_VALUE_MAX_LENGTH),
    ).default({}),
    timeout: z.number().int().min(1).max(3600).default(300),
    retryOnFail: z.boolean().default(false),
    maxRetries: z.number().int().min(0).max(5).default(0),
    retryDelay: z.number().int().min(0).max(3600).default(0),
    workingDirectory: z.string().min(1).max(KANBAN_PATH_MAX_LENGTH).optional(),
})

export const kanbanTaskConfigSchema = z.object({
    ...kanbanTaskModelConfigSchema.shape,
    ...kanbanTaskExecutionConfigSchema.shape,
    weight: z.number().int().min(1).max(10).optional(),
})

export const updateKanbanTaskConfigSchema = kanbanTaskConfigSchema.partial()

export const createKanbanTaskSchema = z.object({
    name: z.string().min(1, 'Task name is required').max(200),
    displayName: z.string().max(200).optional(),
    description: z.string().optional(),
    sourcePath: z.string().min(1, 'Source path is required').max(KANBAN_PATH_MAX_LENGTH),
    sourceHash: z.string().optional(),
    column: kanbanColumnSchema.default('backlog'),
    position: z.number().int().min(0).default(0),
    tags: z.array(z.string()).default([]),
    config: kanbanTaskConfigSchema.optional(),
    dependencies: kanbanTaskDependenciesSchema.default([]),
})

export const updateKanbanTaskSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    displayName: z.string().max(200).nullable().optional(),
    description: z.string().nullable().optional(),
    sourcePath: z.string().min(1).max(KANBAN_PATH_MAX_LENGTH).optional(),
    sourceHash: z.string().nullable().optional(),
    column: kanbanColumnSchema.optional(),
    position: z.number().int().min(0).optional(),
    tags: z.array(z.string()).optional(),
    config: updateKanbanTaskConfigSchema.optional(),
    dependencies: kanbanTaskDependenciesSchema.optional(),
})

export const kanbanTaskParamsSchema = z.object({
    id: z.string().min(1, 'Task id is required').max(KANBAN_ID_MAX_LENGTH),
})

export const kanbanExecutionParamsSchema = z.object({
    id: z.string().min(1, 'Execution id is required').max(KANBAN_ID_MAX_LENGTH),
})

export const kanbanTasksQuerySchema = z.object({
    column: kanbanColumnSchema.optional(),
    q: z.string().max(200).optional(),
})

export const kanbanExecutionsQuerySchema = z.object({
    taskId: z.string().min(1).max(KANBAN_ID_MAX_LENGTH).optional(),
    status: kanbanExecutionStatusSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    includePreview: z.coerce.boolean().default(true),
})

export const kanbanScheduleRunPolicySchema = z.object({
    allowConcurrentRuns: z.boolean().default(false),
    skipIfTaskRunning: z.boolean().default(true),
    catchUpMissedRuns: z.boolean().default(false),
})

export const createKanbanScheduleSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    type: kanbanScheduleTypeSchema,
    runAt: z.coerce.date().optional(),
    cronExpression: z.string().min(1).max(KANBAN_CRON_EXPRESSION_MAX_LENGTH).optional(),
    timezone: z.string().min(1).max(KANBAN_TIMEZONE_MAX_LENGTH).default('UTC'),
    status: kanbanScheduleStatusSchema.default('active'),
    nextRunAt: z.coerce.date().optional(),
    taskId: z.string().min(1).max(KANBAN_ID_MAX_LENGTH).optional(),
    ...kanbanScheduleRunPolicySchema.shape,
})
    .superRefine((value, ctx) => {
        if (value.type === 'one_time') {
            if (!value.runAt) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'runAt is required for one-time schedules',
                    path: ['runAt'],
                })
            }
            if (value.cronExpression) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'cronExpression is not allowed for one-time schedules',
                    path: ['cronExpression'],
                })
            }
        }

        if (value.type === 'cron') {
            if (!value.cronExpression) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'cronExpression is required for cron schedules',
                    path: ['cronExpression'],
                })
            }
            if (value.runAt) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'runAt is not allowed for cron schedules',
                    path: ['runAt'],
                })
            }
        }
    })

export const updateKanbanScheduleSchema = z.object({
    name: z.string().min(1).max(200).nullable().optional(),
    type: kanbanScheduleTypeSchema.optional(),
    runAt: z.coerce.date().nullable().optional(),
    cronExpression: z.string().min(1).max(KANBAN_CRON_EXPRESSION_MAX_LENGTH).nullable().optional(),
    timezone: z.string().min(1).max(KANBAN_TIMEZONE_MAX_LENGTH).optional(),
    status: kanbanScheduleStatusSchema.optional(),
    nextRunAt: z.coerce.date().nullable().optional(),
    lastRunAt: z.coerce.date().nullable().optional(),
    taskId: z.string().min(1).max(KANBAN_ID_MAX_LENGTH).nullable().optional(),
    ...kanbanScheduleRunPolicySchema.partial().shape,
})

export const kanbanScheduleParamsSchema = z.object({
    id: z.string().min(1, 'Schedule id is required').max(KANBAN_ID_MAX_LENGTH),
})

export const kanbanSchedulesQuerySchema = z.object({
    taskId: z.string().min(1).max(KANBAN_ID_MAX_LENGTH).optional(),
    type: kanbanScheduleTypeSchema.optional(),
    status: kanbanScheduleStatusSchema.optional(),
    dueBefore: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const controlKanbanScheduleSchema = z.object({
    action: z.enum(['activate', 'pause', 'run-now']),
    at: z.coerce.date().optional(),
})

export const moveKanbanTaskSchema = z.object({
    taskId: z.string().min(1).max(KANBAN_ID_MAX_LENGTH),
    fromColumn: kanbanColumnSchema.optional(),
    toColumn: kanbanColumnSchema,
    position: z.number().int().min(0),
})

export const moveKanbanTasksSchema = z.object({
    taskIds: z.array(z.string().min(1).max(KANBAN_ID_MAX_LENGTH)).min(1),
    fromColumn: kanbanColumnSchema.optional(),
    toColumn: kanbanColumnSchema,
    position: z.number().int().min(0).optional(),
})
    .refine((value) => new Set(value.taskIds).size === value.taskIds.length, {
        message: 'Task IDs must be unique',
        path: ['taskIds'],
    })

export const reorderKanbanColumnSchema = z.object({
    column: kanbanColumnSchema,
    tasks: z.array(z.object({
        id: z.string().min(1).max(KANBAN_ID_MAX_LENGTH),
        position: z.number().int().min(0),
    })).min(1),
})
    .superRefine((value, ctx) => {
        const taskIds = value.tasks.map((task) => task.id)
        if (new Set(taskIds).size !== taskIds.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Task IDs must be unique',
                path: ['tasks'],
            })
        }

        const positions = value.tasks.map((task) => task.position)
        if (new Set(positions).size !== positions.length) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Task positions must be unique',
                path: ['tasks'],
            })
        }
    })

export const startKanbanExecutionSchema = z.object({
    taskId: z.string().min(1).max(KANBAN_ID_MAX_LENGTH).optional(),
    trigger: kanbanExecutionTriggerSchema.default('manual'),
    startIfIdle: z.boolean().default(true),
})

export const stopKanbanExecutionSchema = z.object({
    graceful: z.boolean().default(true),
    reason: z.string().max(500).optional(),
})

export const cancelKanbanExecutionSchema = z.object({
    taskId: z.string().min(1).max(KANBAN_ID_MAX_LENGTH).optional(),
    executionId: z.string().min(1).max(KANBAN_ID_MAX_LENGTH).optional(),
    signal: z.enum(['SIGTERM', 'SIGKILL']).default('SIGTERM'),
})

export const retryKanbanExecutionSchema = z.object({
    taskId: z.string().min(1).max(KANBAN_ID_MAX_LENGTH),
    fromExecutionId: z.string().min(1).max(KANBAN_ID_MAX_LENGTH).optional(),
    toFrontOfQueue: z.boolean().default(true),
})

export const kanbanExecutionStatusQuerySchema = z.object({
    includeQueue: z.coerce.boolean().optional(),
    includeHistory: z.coerce.boolean().optional(),
    includeLogs: z.coerce.boolean().optional(),
})

export const shuffleQueuedTasksSchema = z.object({
    mode: z.enum(['full', 'weighted']).default('full'),
})

export const singleShuffleQueuedTaskSchema = z.object({
    column: z.enum(['queued']).default('queued'),
})

export const kanbanFeelingLuckySchema = z.object({
    sourceColumn: z.enum(['backlog']).default('backlog'),
    targetColumn: z.enum(['queued']).default('queued'),
    autoStart: z.boolean().default(true),
    applyDefaults: z.boolean().default(true),
})

export const kanbanModelProviderParamsSchema = z.object({
    provider: kanbanModelProviderSchema,
})

export const discoverKanbanModelsQuerySchema = z.object({
    refresh: z.coerce.boolean().default(false),
})

export const updateKanbanModelConfigSchema = z.object({
    defaultTool: kanbanToolSchema.optional(),
    defaultModel: z.string().min(1).nullable().optional(),
    availableModels: z.object({
        claude: z.array(z.string().min(1)).optional(),
        codex: z.array(z.string().min(1)).optional(),
        ollama: z.array(z.string().min(1)).optional(),
    }).optional(),
})

export const kanbanServerSettingsSchema = z.object({
    host: z.string().min(1).default('127.0.0.1'),
    port: z.number().int().min(1).max(65535).default(3741),
})

export const kanbanExecutionSettingsSchema = z.object({
    defaultTimeout: z.number().int().min(1).max(3600).default(300),
    defaultRetryOnFail: z.boolean().default(false),
    defaultMaxRetries: z.number().int().min(0).max(5).default(0),
    defaultRetryDelay: z.number().int().min(0).max(3600).default(0),
    gracePeriod: z.number().int().min(1).max(120).default(10),
    maxLogFileSize: z.string().regex(/^\d+(KB|MB|GB)$/i, 'Use size values like 10MB').default('10MB'),
    maxTotalLogStorage: z.string().regex(/^\d+(KB|MB|GB)$/i, 'Use size values like 1GB').default('1GB'),
    liveLogLineLimit: z.number().int().min(100).max(5000).default(1000),
})

export const kanbanNotificationSettingsSchema = z.object({
    inApp: z.boolean().default(true),
    desktop: z.boolean().default(true),
    sound: z.boolean().default(false),
    onTaskCompleted: z.boolean().default(true),
    onTaskFailed: z.boolean().default(true),
    onQueueEmpty: z.boolean().default(true),
    onDependencyBlocked: z.boolean().default(true),
    onScriptChanged: z.boolean().default(true),
})

export const kanbanUiSettingsSchema = z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    highContrast: z.boolean().default(false),
    terminalFontSize: z.number().int().min(10).max(24).default(14),
    autoScrollLogs: z.boolean().default(true),
    autoSelectRunningLog: z.boolean().default(true),
})

export const kanbanDefaultsSettingsSchema = z.object({
    tool: kanbanToolSchema.default('claude-cli'),
    model: z.string().min(1),
})

export const kanbanSettingsSchema = z.object({
    server: kanbanServerSettingsSchema.default({ host: '127.0.0.1', port: 3741 }),
    watchDirectory: z.string().min(1),
    recognizedExtensions: z.array(z.string().regex(/^\.[a-z0-9]+$/i)).min(1),
    execution: kanbanExecutionSettingsSchema,
    defaults: kanbanDefaultsSettingsSchema,
    notifications: kanbanNotificationSettingsSchema,
    ui: kanbanUiSettingsSchema,
})

export const updateKanbanSettingsSchema = z.object({
    server: kanbanServerSettingsSchema.partial().optional(),
    watchDirectory: z.string().min(1).optional(),
    recognizedExtensions: z.array(z.string().regex(/^\.[a-z0-9]+$/i)).min(1).optional(),
    execution: kanbanExecutionSettingsSchema.partial().optional(),
    defaults: kanbanDefaultsSettingsSchema.partial().optional(),
    notifications: kanbanNotificationSettingsSchema.partial().optional(),
    ui: kanbanUiSettingsSchema.partial().optional(),
})

// ============================================
// FOLDER VALIDATORS
// ============================================

export const createFolderSchema = z.object({
    name: z.string().min(1, 'Folder name is required').max(100),
    icon: z.string().optional(),
    color: z.string().optional(),
    parentId: z.string().optional(),
})

export const updateFolderSchema = createFolderSchema.partial()

export const moveFolderSchema = z.object({
    parentId: z.string().nullable(),
})

// ============================================
// TAG VALIDATORS
// ============================================

export const createTagSchema = z.object({
    name: z.string().min(1, 'Tag name is required').max(50),
    color: z.string().optional(),
})

export const updateTagSchema = createTagSchema.partial()

export const mergeTagsSchema = z.object({
    sourceTagIds: z.array(z.string()).min(1),
    targetTagId: z.string(),
})

// ============================================
// SETTINGS VALIDATORS
// ============================================

export const updateSettingsSchema = z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    defaultAiModel: z.string().nullable().optional(),
    sidebarCollapsed: z.boolean().optional(),
    editorFontSize: z.number().int().min(10).max(24).optional(),
    autoSaveInterval: z.number().int().min(5).max(300).optional(),
    kanban: updateKanbanSettingsSchema.optional(),
})

// ============================================
// WORKFLOW RUN VALIDATORS
// ============================================

export const startWorkflowRunSchema = z.object({
    inputs: z.record(z.string(), z.string()).optional(),
})

export const updateStepRunSchema = z.object({
    output: z.string(),
})

// ============================================
// SEARCH VALIDATORS
// ============================================

export const searchQuerySchema = z.object({
    q: z.string().optional(),
    folderId: z.string().optional(),
    tagId: z.string().optional(),
    aiModel: z.string().optional(),
    isFavorite: z.coerce.boolean().optional(),
    isArchived: z.coerce.boolean().optional(),
    sort: z.enum(['created', 'updated', 'usage', 'rating', 'title', 'name']).default('updated'),
    order: z.enum(['asc', 'desc']).default('desc'),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
})

// ============================================
// IMPORT/EXPORT VALIDATORS
// ============================================

export const importDataSchema = z.object({
    version: z.string().optional(),
    exportedAt: z.string().optional(),
    folders: z.array(z.object({
        id: z.string(),
        name: z.string(),
        icon: z.string().nullable().optional(),
        color: z.string().nullable().optional(),
        parentId: z.string().nullable().optional(),
    })).optional(),
    tags: z.array(z.object({
        id: z.string(),
        name: z.string(),
        color: z.string().nullable().optional(),
    })).optional(),
    prompts: z.array(z.object({
        id: z.string().optional(),
        title: z.string(),
        content: z.string(),
        description: z.string().nullable().optional(),
        variables: z.union([z.string(), z.array(z.string())]).nullable().optional(),
        aiModel: z.string().nullable().optional(),
        category: z.string().optional(),
        folderId: z.string().nullable().optional(),
        tags: z.array(z.object({
            id: z.string(),
            name: z.string().optional(),
        })).optional(),
    })).optional(),
    workflows: z.array(z.object({
        id: z.string().optional(),
        name: z.string(),
        description: z.string().nullable().optional(),
        icon: z.string().nullable().optional(),
        color: z.string().nullable().optional(),
        inputSchema: z.string().nullable().optional(),
        isTemplate: z.boolean().optional(),
        folderId: z.string().nullable().optional(),
        tags: z.array(z.object({
            id: z.string(),
            name: z.string().optional(),
        })).optional(),
        steps: z.array(z.object({
            id: z.string().optional(),
            name: z.string(),
            description: z.string().nullable().optional(),
            order: z.number().int().min(0),
            promptId: z.string().nullable().optional(),
            inlineContent: z.string().nullable().optional(),
            inputMapping: z.string().nullable().optional(),
            outputVariable: z.string().optional(),
            isOptional: z.boolean().optional(),
            condition: z.string().nullable().optional(),
            aiModelOverride: z.string().nullable().optional(),
            notes: z.string().nullable().optional(),
            estimatedTokens: z.number().int().nullable().optional(),
            nextStepOnSuccess: z.string().nullable().optional(),
            nextStepOnFailure: z.string().nullable().optional(),
        })).optional(),
    })).optional(),
})

// Type exports
export type CreatePromptInput = z.infer<typeof createPromptSchema>
export type UpdatePromptInput = z.infer<typeof updatePromptSchema>
export type CreateWorkflowInput = z.infer<typeof createWorkflowSchema>
export type UpdateWorkflowInput = z.infer<typeof updateWorkflowSchema>
export type CreateWorkflowStepInput = z.infer<typeof createWorkflowStepSchema>
export type UpdateWorkflowStepInput = z.infer<typeof updateWorkflowStepSchema>
export type KanbanColumn = z.infer<typeof kanbanColumnSchema>
export type KanbanTool = z.infer<typeof kanbanToolSchema>
export type KanbanExecutionTrigger = z.infer<typeof kanbanExecutionTriggerSchema>
export type KanbanExecutionStatus = z.infer<typeof kanbanExecutionStatusSchema>
export type KanbanScheduleType = z.infer<typeof kanbanScheduleTypeSchema>
export type KanbanScheduleStatus = z.infer<typeof kanbanScheduleStatusSchema>
export type KanbanModelProvider = z.infer<typeof kanbanModelProviderSchema>
export type KanbanTaskDependenciesInput = z.infer<typeof kanbanTaskDependenciesSchema>
export type KanbanTaskModelConfigInput = z.infer<typeof kanbanTaskModelConfigSchema>
export type KanbanTaskExecutionConfigInput = z.infer<typeof kanbanTaskExecutionConfigSchema>
export type KanbanTaskConfigInput = z.infer<typeof kanbanTaskConfigSchema>
export type UpdateKanbanTaskConfigInput = z.infer<typeof updateKanbanTaskConfigSchema>
export type CreateKanbanTaskInput = z.infer<typeof createKanbanTaskSchema>
export type UpdateKanbanTaskInput = z.infer<typeof updateKanbanTaskSchema>
export type KanbanTaskParamsInput = z.infer<typeof kanbanTaskParamsSchema>
export type KanbanExecutionParamsInput = z.infer<typeof kanbanExecutionParamsSchema>
export type KanbanTasksQueryInput = z.infer<typeof kanbanTasksQuerySchema>
export type KanbanExecutionsQueryInput = z.infer<typeof kanbanExecutionsQuerySchema>
export type KanbanScheduleRunPolicyInput = z.infer<typeof kanbanScheduleRunPolicySchema>
export type CreateKanbanScheduleInput = z.infer<typeof createKanbanScheduleSchema>
export type UpdateKanbanScheduleInput = z.infer<typeof updateKanbanScheduleSchema>
export type KanbanScheduleParamsInput = z.infer<typeof kanbanScheduleParamsSchema>
export type KanbanSchedulesQueryInput = z.infer<typeof kanbanSchedulesQuerySchema>
export type ControlKanbanScheduleInput = z.infer<typeof controlKanbanScheduleSchema>
export type MoveKanbanTaskInput = z.infer<typeof moveKanbanTaskSchema>
export type MoveKanbanTasksInput = z.infer<typeof moveKanbanTasksSchema>
export type ReorderKanbanColumnInput = z.infer<typeof reorderKanbanColumnSchema>
export type StartKanbanExecutionInput = z.infer<typeof startKanbanExecutionSchema>
export type StopKanbanExecutionInput = z.infer<typeof stopKanbanExecutionSchema>
export type CancelKanbanExecutionInput = z.infer<typeof cancelKanbanExecutionSchema>
export type RetryKanbanExecutionInput = z.infer<typeof retryKanbanExecutionSchema>
export type KanbanExecutionStatusQueryInput = z.infer<typeof kanbanExecutionStatusQuerySchema>
export type ShuffleQueuedTasksInput = z.infer<typeof shuffleQueuedTasksSchema>
export type SingleShuffleQueuedTaskInput = z.infer<typeof singleShuffleQueuedTaskSchema>
export type KanbanFeelingLuckyInput = z.infer<typeof kanbanFeelingLuckySchema>
export type KanbanModelProviderParamsInput = z.infer<typeof kanbanModelProviderParamsSchema>
export type DiscoverKanbanModelsQueryInput = z.infer<typeof discoverKanbanModelsQuerySchema>
export type UpdateKanbanModelConfigInput = z.infer<typeof updateKanbanModelConfigSchema>
export type KanbanServerSettingsInput = z.infer<typeof kanbanServerSettingsSchema>
export type KanbanExecutionSettingsInput = z.infer<typeof kanbanExecutionSettingsSchema>
export type KanbanNotificationSettingsInput = z.infer<typeof kanbanNotificationSettingsSchema>
export type KanbanUiSettingsInput = z.infer<typeof kanbanUiSettingsSchema>
export type KanbanDefaultsSettingsInput = z.infer<typeof kanbanDefaultsSettingsSchema>
export type KanbanSettingsInput = z.infer<typeof kanbanSettingsSchema>
export type UpdateKanbanSettingsInput = z.infer<typeof updateKanbanSettingsSchema>
export type CreateFolderInput = z.infer<typeof createFolderSchema>
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>
export type CreateTagInput = z.infer<typeof createTagSchema>
export type UpdateTagInput = z.infer<typeof updateTagSchema>
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>
export type SearchQueryInput = z.infer<typeof searchQuerySchema>
export type ImportDataInput = z.infer<typeof importDataSchema>
