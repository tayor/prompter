import fs from 'node:fs'
import { randomInt } from 'node:crypto'
import path from 'node:path'
import { Prisma, type KanbanColumn } from '@prisma/client'
import yaml from 'js-yaml'
import { z } from 'zod'
import { kanbanExecutionControlService } from '@/lib/kanban/execution-control-service'
import { kanbanExecutionEngine } from '@/lib/kanban/execution-engine'
import { getExecutionLogPreview } from '@/lib/kanban/log-storage'
import {
    computeNextCronOccurrence,
    isValidTimeZone,
    kanbanSchedulerRuntimeService,
} from '@/lib/kanban/scheduler-runtime'
import {
    listQueuedTasks,
    parseTaskConfig,
    requeueTask,
    reorderQueuedTasks,
} from '@/lib/kanban/queue-operations'
import { getKanbanSettings } from '@/lib/kanban/settings-store'
import { DEFAULT_TERMINATION_GRACE_SECONDS } from '@/lib/kanban/types'
import prisma from '@/lib/prisma'
import {
    applyQueueRuntimeDefaults,
    buildPrompterExportData,
    createKanbanTask,
    createFolder,
    createPromptWithVersion,
    createTagIfNotExists,
    createWorkflow,
    createWorkflowFromTemplate,
    deleteKanbanTask,
    deleteAdminByUsername,
    deleteFolderAndReassign,
    deletePromptById,
    deleteTag,
    deleteWorkflowById,
    findPromptById,
    findFolderById,
    findTagWithRelations,
    getAnalyticsReport,
    getAnalyticsTrends,
    getKanbanExecutionById,
    getKanbanTaskById,
    getLifecycleTransitionError,
    getPromptDetails,
    getQueueValidationError,
    getSettingsWithKanban,
    getWorkflowById,
    getWorkflowRunById,
    importPrompterData,
    incrementPromptUsage,
    listAdmins,
    listAnalyticsActivity,
    listFoldersWithTree,
    listKanbanExecutions,
    listKanbanSchedules,
    listKanbanTasks,
    listPromptVersions,
    listPrompts,
    listTagsWithCounts,
    listWorkflowRuns,
    listWorkflows,
    listWorkflowTemplates,
    mergeTags,
    moveFolder,
    resetPromptUsageCounts,
    restorePromptVersion,
    searchPromptsAndWorkflows,
    serializeKanbanTask,
    startWorkflowRun,
    pauseKanbanSchedule,
    resumeKanbanSchedule,
    createKanbanSchedule,
    deleteKanbanSchedule,
    getKanbanScheduleById,
    markKanbanScheduleRunNow,
    trackAnalyticsAction,
    updateKanbanTask,
    updateKanbanSchedule,
    updateFolder,
    updatePromptWithVersion,
    updateSettingsWithKanban,
    updateTagIfNoDuplicate,
    updateWorkflowById,
    updateWorkflowRunById,
    upsertAdminCredentials,
    discoverKanbanModels,
} from '@/lib/services'
import {
    cancelKanbanExecutionSchema,
    createFolderSchema,
    createKanbanScheduleSchema,
    createKanbanTaskSchema,
    createPromptSchema,
    createTagSchema,
    createWorkflowSchema,
    discoverKanbanModelsQuerySchema,
    importDataSchema,
    kanbanExecutionParamsSchema,
    kanbanExecutionStatusQuerySchema,
    kanbanScheduleParamsSchema,
    kanbanSchedulesQuerySchema,
    kanbanExecutionsQuerySchema,
    kanbanFeelingLuckySchema,
    kanbanModelProviderParamsSchema,
    kanbanTaskConfigSchema,
    kanbanTaskParamsSchema,
    kanbanTasksQuerySchema,
    mergeTagsSchema,
    moveKanbanTasksSchema,
    moveFolderSchema,
    reorderKanbanColumnSchema,
    retryKanbanExecutionSchema,
    searchQuerySchema,
    shuffleQueuedTasksSchema,
    startKanbanExecutionSchema,
    startWorkflowRunSchema,
    stopKanbanExecutionSchema,
    updateFolderSchema,
    updateKanbanModelConfigSchema,
    updateKanbanTaskSchema,
    updateKanbanScheduleSchema,
    updatePromptSchema,
    updateSettingsSchema,
    updateStepRunSchema,
    updateTagSchema,
    updateWorkflowSchema,
} from '@/lib/validators'
import {
    getOptionValue,
    getOptionValues,
    hasFlag,
    parseBooleanOption,
    parseCommandArgs,
    parseIntegerOption,
    parseJsonValue,
    readDataPayload,
    readStructuredDataFile,
    requirePositional,
    splitCsvValues,
} from './command-args'
import { getCliProjectRoot } from './bootstrap'
import { CliError, conflictError, notFoundError, unexpectedError, validationError } from './errors'
import type { CliCommand, CliCommandContext, CliCommandResult } from './types'

const SEARCH_TYPE_SCHEMA = z.enum(['all', 'prompts', 'workflows'])

const ANALYTICS_OPTIONS_SCHEMA = z.object({
    type: z.enum(['dashboard', 'top-prompts', 'top-workflows', 'activity', 'all']).default('all'),
    days: z.coerce.number().int().positive().default(30),
    limit: z.coerce.number().int().positive().default(10),
})

const ANALYTICS_ACTIVITY_SCHEMA = z.object({
    limit: z.coerce.number().int().positive().default(10),
})

const EXPORT_OPTIONS_SCHEMA = z.object({
    format: z.enum(['json', 'yaml']).default('json'),
    prompts: z.coerce.boolean().default(true),
    workflows: z.coerce.boolean().default(true),
    folders: z.coerce.boolean().default(true),
    tags: z.coerce.boolean().default(true),
})

const ADMIN_CREDENTIALS_SCHEMA = z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
})

type CliKanbanSchedule = Awaited<ReturnType<typeof createKanbanSchedule>>

const SCHEDULE_NAIVE_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?)?$/
const SCHEDULE_EXPLICIT_TIMEZONE_PATTERN = /(Z|[+-]\d{2}(?::?\d{2})?)$/i
const SCHEDULE_TIMEZONE_PARTS_CACHE = new Map<string, Intl.DateTimeFormat>()

export const coreDomainCommands: CliCommand[] = [
    {
        name: 'prompt',
        description: 'Manage prompts (list/get/create/update/delete/use/versions/history/restore)',
        run: runPromptCommand,
    },
    {
        name: 'workflow',
        description: 'Manage workflows (list/get/create/update/delete)',
        run: runWorkflowCommand,
    },
    {
        name: 'run',
        description: 'Manage workflow runs (start/list/get/complete/cancel)',
        run: runRunCommand,
    },
    {
        name: 'task',
        description: 'Manage kanban tasks (list/get/create/update/delete/move/reorder)',
        run: runTaskCommand,
    },
    {
        name: 'execution',
        description: 'Manage kanban execution (start/stop/status/cancel/retry/rerun/list/get/log)',
        run: runExecutionCommand,
    },
    {
        name: 'queue',
        description: 'Manage queue actions (list/shuffle/full/single/feeling-lucky)',
        run: runQueueCommand,
    },
    {
        name: 'schedule',
        description: 'Manage schedules (create/list/get/update/delete/pause/resume/run-now)',
        run: runScheduleCommand,
    },
    {
        name: 'model',
        description: 'Manage model discovery and defaults (list/discover/get/update/config)',
        run: runModelCommand,
    },
    {
        name: 'folder',
        description: 'Manage folders (list/get/create/update/move/delete)',
        run: runFolderCommand,
    },
    {
        name: 'tag',
        description: 'Manage tags (list/get/create/update/merge/delete)',
        run: runTagCommand,
    },
    {
        name: 'search',
        description: 'Search prompts and workflows',
        run: runSearchCommand,
    },
    {
        name: 'template',
        description: 'Manage workflow templates (list/instantiate)',
        run: runTemplateCommand,
    },
    {
        name: 'settings',
        description: 'Manage settings (get/update/reset-usage)',
        run: runSettingsCommand,
    },
    {
        name: 'analytics',
        description: 'Manage analytics (report/activity/trends/track)',
        run: runAnalyticsCommand,
    },
    {
        name: 'import',
        description: 'Import prompter data from JSON or YAML',
        run: runImportCommand,
    },
    {
        name: 'export',
        description: 'Export prompter data as JSON or YAML',
        run: runExportCommand,
    },
    {
        name: 'admin',
        description: 'Manage admin users (list/upsert/delete/doctor)',
        run: runAdminCommand,
    },
]

export async function runPromptCommand(context: CliCommandContext): Promise<CliCommandResult> {
    return withCliErrorHandling('Prompt command failed', async () => {
        const parsedArgs = parseCommandArgs(context.args)
        const subcommand = parsedArgs.positionals[0] ?? 'list'

        switch (subcommand) {
            case 'list': {
                const query = parseSearchQueryFromOptions(parsedArgs)
                const result = await listPrompts(query)
                return {
                    data: result,
                    message: `Found ${result.pagination.total} prompts.`,
                }
            }
            case 'get': {
                const promptId = requirePositional(parsedArgs, 1, 'prompt id')
                const prompt = await getPromptDetails(promptId)
                if (!prompt) {
                    throw notFoundError(`Prompt "${promptId}" not found.`)
                }

                return { data: prompt }
            }
            case 'create': {
                const payload = readObjectPayload(readDataPayload(parsedArgs), 'prompt payload')
                const prompt = await createPromptWithVersion(createPromptSchema.parse(payload))
                return {
                    data: prompt,
                    message: `Created prompt "${prompt.title}" (${prompt.id}).`,
                }
            }
            case 'update': {
                const promptId = requirePositional(parsedArgs, 1, 'prompt id')
                const payload = readObjectPayload(readDataPayload(parsedArgs), 'prompt payload')
                const changeNote = typeof payload.changeNote === 'string' ? payload.changeNote : undefined
                const updatePayload = { ...payload }
                delete updatePayload.changeNote

                const prompt = await updatePromptWithVersion(
                    promptId,
                    updatePromptSchema.parse(updatePayload),
                    { changeNote }
                )

                if (!prompt) {
                    throw notFoundError(`Prompt "${promptId}" not found.`)
                }

                return {
                    data: prompt,
                    message: `Updated prompt "${prompt.title}" (${prompt.id}).`,
                }
            }
            case 'delete': {
                const promptId = requirePositional(parsedArgs, 1, 'prompt id')
                const deleted = await deletePromptById(promptId)
                if (!deleted) {
                    throw notFoundError(`Prompt "${promptId}" not found.`)
                }

                return {
                    data: { success: true, id: promptId },
                    message: `Deleted prompt "${promptId}".`,
                }
            }
            case 'use': {
                const promptId = requirePositional(parsedArgs, 1, 'prompt id')
                const prompt = await incrementPromptUsage(promptId)
                return {
                    data: prompt,
                    message: `Incremented usage for prompt "${promptId}".`,
                }
            }
            case 'versions':
            case 'history': {
                const promptId = requirePositional(parsedArgs, 1, 'prompt id')
                const limit = parseIntegerOption(parsedArgs, 'limit') ?? 20
                if (limit <= 0 || limit > 100) {
                    throw validationError('Option "--limit" must be between 1 and 100.')
                }

                const prompt = await findPromptById(promptId)
                if (!prompt) {
                    throw notFoundError(`Prompt "${promptId}" not found.`)
                }

                const versions = await listPromptVersions(promptId, limit)
                return {
                    data: { versions },
                    message: `Found ${versions.length} versions for prompt "${promptId}".`,
                }
            }
            case 'restore': {
                const promptId = requirePositional(parsedArgs, 1, 'prompt id')
                const versionId = requirePositional(parsedArgs, 2, 'version id')

                const prompt = await findPromptById(promptId)
                if (!prompt) {
                    throw notFoundError(`Prompt "${promptId}" not found.`)
                }

                const restored = await restorePromptVersion(promptId, versionId)
                if (!restored) {
                    throw notFoundError(`Version "${versionId}" not found for prompt "${promptId}".`)
                }

                return {
                    data: restored,
                    message: `Restored prompt "${promptId}" from version ${restored.restoredFromVersion}.`,
                }
            }
            default:
                throw validationError(
                    `Unknown prompt subcommand "${subcommand}". Expected one of: list, get, create, update, delete, use, versions (history), restore.`
                )
        }
    })
}

export async function runWorkflowCommand(context: CliCommandContext): Promise<CliCommandResult> {
    return withCliErrorHandling('Workflow command failed', async () => {
        const parsedArgs = parseCommandArgs(context.args)
        const subcommand = parsedArgs.positionals[0] ?? 'list'

        switch (subcommand) {
            case 'list': {
                const query = parseSearchQueryFromOptions(parsedArgs)
                const result = await listWorkflows(query)
                return {
                    data: result,
                    message: `Found ${result.pagination.total} workflows.`,
                }
            }
            case 'get': {
                const workflowId = requirePositional(parsedArgs, 1, 'workflow id')
                const workflow = await getWorkflowById(workflowId)
                if (!workflow) {
                    throw notFoundError(`Workflow "${workflowId}" not found.`)
                }

                return { data: workflow }
            }
            case 'create': {
                const payload = readObjectPayload(readDataPayload(parsedArgs), 'workflow payload')
                const workflow = await createWorkflow(createWorkflowSchema.parse(payload))
                return {
                    data: workflow,
                    message: `Created workflow "${workflow.name}" (${workflow.id}).`,
                }
            }
            case 'update': {
                const workflowId = requirePositional(parsedArgs, 1, 'workflow id')
                const payload = readObjectPayload(readDataPayload(parsedArgs), 'workflow payload')
                const workflow = await updateWorkflowById(
                    workflowId,
                    updateWorkflowSchema.parse(payload)
                )
                if (!workflow) {
                    throw notFoundError(`Workflow "${workflowId}" not found.`)
                }

                return {
                    data: workflow,
                    message: `Updated workflow "${workflow.name}" (${workflow.id}).`,
                }
            }
            case 'delete': {
                const workflowId = requirePositional(parsedArgs, 1, 'workflow id')
                const deleted = await deleteWorkflowById(workflowId)
                if (!deleted) {
                    throw notFoundError(`Workflow "${workflowId}" not found.`)
                }

                return {
                    data: { success: true, id: workflowId },
                    message: `Deleted workflow "${workflowId}".`,
                }
            }
            default:
                throw validationError(
                    `Unknown workflow subcommand "${subcommand}". Expected one of: list, get, create, update, delete.`
                )
        }
    })
}

export async function runRunCommand(context: CliCommandContext): Promise<CliCommandResult> {
    return withCliErrorHandling('Run command failed', async () => {
        const parsedArgs = parseCommandArgs(context.args)
        const subcommand = parsedArgs.positionals[0] ?? 'list'

        switch (subcommand) {
            case 'start': {
                const workflowId = requirePositional(parsedArgs, 1, 'workflow id')
                const rawInputs = getOptionValue(parsedArgs, 'inputs')
                const parsedInputs = rawInputs === undefined
                    ? undefined
                    : parseJsonValue<unknown>(rawInputs, '--inputs')

                const validated = startWorkflowRunSchema.parse({
                    inputs: parsedInputs,
                })

                const run = await startWorkflowRun(workflowId, validated.inputs)
                if (!run) {
                    throw notFoundError(`Workflow "${workflowId}" not found.`)
                }

                return {
                    data: run,
                    message: `Started workflow run "${run.id}".`,
                }
            }
            case 'list': {
                const workflowId = requirePositional(parsedArgs, 1, 'workflow id')
                const limit = parseIntegerOption(parsedArgs, 'limit') ?? 20
                if (limit <= 0) {
                    throw validationError('Option "--limit" must be greater than 0.')
                }

                const runs = await listWorkflowRuns(workflowId, limit)
                return {
                    data: { runs },
                    message: `Found ${runs.length} runs for workflow "${workflowId}".`,
                }
            }
            case 'get': {
                const workflowId = requirePositional(parsedArgs, 1, 'workflow id')
                const runId = requirePositional(parsedArgs, 2, 'run id')
                const run = await getWorkflowRunById(workflowId, runId)
                if (!run) {
                    throw notFoundError(`Run "${runId}" not found for workflow "${workflowId}".`)
                }

                return { data: run }
            }
            case 'complete': {
                const workflowId = requirePositional(parsedArgs, 1, 'workflow id')
                const runId = requirePositional(parsedArgs, 2, 'run id')
                const step = parseIntegerOption(parsedArgs, 'step')
                if (step === undefined || step < 0) {
                    throw validationError('Option "--step" must be a non-negative integer.')
                }

                const output = updateStepRunSchema.parse({
                    output: getOptionValue(parsedArgs, 'output'),
                }).output

                const run = await updateWorkflowRunById(workflowId, runId, {
                    completeStep: step,
                    output,
                })
                if (!run) {
                    throw notFoundError(`Run "${runId}" not found for workflow "${workflowId}".`)
                }

                return {
                    data: run,
                    message: `Completed step ${step} for run "${runId}".`,
                }
            }
            case 'cancel': {
                const workflowId = requirePositional(parsedArgs, 1, 'workflow id')
                const runId = requirePositional(parsedArgs, 2, 'run id')
                const run = await updateWorkflowRunById(workflowId, runId, { cancel: true })
                if (!run) {
                    throw notFoundError(`Run "${runId}" not found for workflow "${workflowId}".`)
                }

                return {
                    data: run,
                    message: `Cancelled run "${runId}".`,
                }
            }
            default:
                throw validationError(
                    `Unknown run subcommand "${subcommand}". Expected one of: start, list, get, complete, cancel.`
                )
        }
    })
}

export async function runTaskCommand(context: CliCommandContext): Promise<CliCommandResult> {
    return withCliErrorHandling('Task command failed', async () => {
        const parsedArgs = parseCommandArgs(context.args)
        const subcommand = parsedArgs.positionals[0] ?? 'list'

        switch (subcommand) {
            case 'list': {
                const query = kanbanTasksQuerySchema.parse({
                    column: getOptionValue(parsedArgs, 'column') ?? undefined,
                    q: getOptionValue(parsedArgs, 'q') ?? getOptionValue(parsedArgs, 'query') ?? undefined,
                })
                const tasks = await listKanbanTasks(query)
                const serializedTasks = tasks.map((task) => serializeKanbanTask(task))

                return {
                    data: { tasks: serializedTasks },
                    message: `Found ${serializedTasks.length} tasks.`,
                }
            }
            case 'get': {
                const taskId = requirePositional(parsedArgs, 1, 'task id')
                const { id } = kanbanTaskParamsSchema.parse({ id: taskId })
                const task = await getKanbanTaskById(id)
                if (!task) {
                    throw notFoundError(`Task "${id}" not found.`)
                }

                return { data: serializeKanbanTask(task) }
            }
            case 'create': {
                const payload = readObjectPayload(readDataPayload(parsedArgs), 'task payload')
                const data = createKanbanTaskSchema.parse(payload)
                const hasPosition = Object.prototype.hasOwnProperty.call(payload, 'position')
                const task = await createKanbanTask(data, hasPosition)

                return {
                    data: serializeKanbanTask(task),
                    message: `Created task "${task.displayName ?? task.name}" (${task.id}).`,
                }
            }
            case 'update': {
                const taskId = requirePositional(parsedArgs, 1, 'task id')
                const { id } = kanbanTaskParamsSchema.parse({ id: taskId })
                const payload = readObjectPayload(readDataPayload(parsedArgs), 'task payload')
                const data = updateKanbanTaskSchema.parse(payload)
                const task = await updateKanbanTask(id, data)

                if (!task) {
                    throw notFoundError(`Task "${id}" not found.`)
                }

                return {
                    data: serializeKanbanTask(task),
                    message: `Updated task "${task.displayName ?? task.name}" (${task.id}).`,
                }
            }
            case 'delete': {
                const taskId = requirePositional(parsedArgs, 1, 'task id')
                const { id } = kanbanTaskParamsSchema.parse({ id: taskId })
                const deleted = await deleteKanbanTask(id)

                if (!deleted) {
                    throw notFoundError(`Task "${id}" not found.`)
                }

                return {
                    data: { success: true, id },
                    message: `Deleted task "${id}".`,
                }
            }
            case 'move':
            case 'batch-move': {
                const request = parseTaskMoveRequest(parsedArgs)
                const result = await executeTaskBatchMove(request)

                return {
                    data: result,
                    message: `Moved ${result.meta.movedCount} tasks.`,
                }
            }
            case 'reorder':
            case 'batch-reorder': {
                const request = parseTaskReorderRequest(parsedArgs)
                const result = await executeTaskBatchReorder(request)

                return {
                    data: result,
                    message: `Reordered queued tasks (${result.meta.reorderedCount} changed).`,
                }
            }
            default:
                throw validationError(
                    `Unknown task subcommand "${subcommand}". Expected one of: list, get, create, update, delete, move, reorder.`
                )
        }
    })
}

export async function runExecutionCommand(context: CliCommandContext): Promise<CliCommandResult> {
    return withCliErrorHandling('Execution command failed', async () => {
        const parsedArgs = parseCommandArgs(context.args)
        const subcommand = parsedArgs.positionals[0] ?? 'status'

        switch (subcommand) {
            case 'start': {
                const request = parseExecutionStartRequest(parsedArgs)
                if (request.taskId) {
                    throw validationError('taskId-targeted starts are not supported by the current execution engine.')
                }

                kanbanExecutionControlService.markStarted()

                if (!request.startIfIdle) {
                    return {
                        data: {
                            status: kanbanExecutionControlService.getStatus(Boolean(kanbanExecutionEngine.getRunningProcess())),
                            message: 'Execution engine started without triggering an immediate run',
                        },
                        message: 'Execution engine started.',
                    }
                }

                const result = await kanbanExecutionEngine.executeNextTask(request.trigger)
                return {
                    data: {
                        ...result,
                        engineStatus: kanbanExecutionControlService.getStatus(Boolean(kanbanExecutionEngine.getRunningProcess())),
                    },
                    message: `Execution start completed with state "${result.state}".`,
                }
            }
            case 'stop': {
                const request = parseExecutionStopRequest(parsedArgs)
                const runningProcess = kanbanExecutionEngine.getRunningProcess()
                kanbanExecutionControlService.markStopped()

                const cancellation = request.graceful
                    ? null
                    : await kanbanExecutionEngine.cancelRunningExecution(0)

                return {
                    data: {
                        status: kanbanExecutionControlService.getStatus(Boolean(kanbanExecutionEngine.getRunningProcess())),
                        stopped: true,
                        graceful: request.graceful,
                        reason: request.reason ?? null,
                        runningProcess,
                        cancellation,
                    },
                    message: 'Execution engine stopped.',
                }
            }
            case 'status': {
                const query = kanbanExecutionStatusQuerySchema.parse({
                    includeQueue: readBooleanOption(parsedArgs, 'includeQueue', 'queue') ?? undefined,
                    includeHistory: readBooleanOption(parsedArgs, 'includeHistory', 'history') ?? undefined,
                    includeLogs: readBooleanOption(parsedArgs, 'includeLogs', 'logs') ?? undefined,
                })
                const status = await buildExecutionStatusPayload(query)
                return { data: status }
            }
            case 'cancel': {
                const request = parseExecutionCancelRequest(parsedArgs)
                const runningExecution = await prisma.kanbanExecution.findFirst({
                    where: { status: 'running' },
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        taskId: true,
                    },
                })

                if (!runningExecution && (request.executionId || request.taskId)) {
                    throw conflictError('No running execution matches the provided identifiers.')
                }
                if (runningExecution && request.executionId && request.executionId !== runningExecution.id) {
                    throw conflictError('executionId does not match the current running execution.')
                }
                if (runningExecution && request.taskId && request.taskId !== runningExecution.taskId) {
                    throw conflictError('taskId does not match the current running task.')
                }

                const gracePeriodSeconds = request.signal === 'SIGKILL' ? 0 : DEFAULT_TERMINATION_GRACE_SECONDS
                const cancellation = await kanbanExecutionEngine.cancelRunningExecution(gracePeriodSeconds)

                return {
                    data: {
                        ...cancellation,
                        signal: request.signal,
                        executionId: runningExecution?.id ?? null,
                        taskId: runningExecution?.taskId ?? null,
                        engineStatus: kanbanExecutionControlService.getStatus(Boolean(kanbanExecutionEngine.getRunningProcess())),
                    },
                    message: cancellation.message,
                }
            }
            case 'retry': {
                const request = parseRetryExecutionRequest(parsedArgs)
                const result = await requeueExecutionTask('retry', request)
                return {
                    data: result,
                    message: `Queued task "${request.taskId}" for retry.`,
                }
            }
            case 'rerun': {
                const request = parseRetryExecutionRequest(parsedArgs)
                const result = await requeueExecutionTask('rerun', request)
                return {
                    data: result,
                    message: `Queued task "${request.taskId}" for rerun.`,
                }
            }
            case 'list':
            case 'history': {
                const query = kanbanExecutionsQuerySchema.parse({
                    taskId: getOptionValue(parsedArgs, 'taskId') ?? undefined,
                    status: getOptionValue(parsedArgs, 'status') ?? undefined,
                    page: getOptionValue(parsedArgs, 'page') ?? undefined,
                    limit: getOptionValue(parsedArgs, 'limit') ?? undefined,
                    includePreview: readBooleanOption(parsedArgs, 'includePreview', 'preview') ?? undefined,
                })
                const result = await listKanbanExecutions(query)
                return {
                    data: result,
                    message: `Found ${result.pagination.total} executions.`,
                }
            }
            case 'get':
            case 'detail': {
                const executionId = requirePositional(parsedArgs, 1, 'execution id')
                const { id } = kanbanExecutionParamsSchema.parse({ id: executionId })
                const includePreview = readBooleanOption(parsedArgs, 'includePreview', 'preview') ?? true
                const execution = await getKanbanExecutionById(id, includePreview)

                if (!execution) {
                    throw notFoundError(`Execution "${id}" not found.`)
                }

                return { data: execution }
            }
            case 'log': {
                const executionId = requirePositional(parsedArgs, 1, 'execution id')
                const { id } = kanbanExecutionParamsSchema.parse({ id: executionId })
                const lines = parseIntegerOption(parsedArgs, 'lines') ?? 200
                if (lines <= 0) {
                    throw validationError('Option "--lines" must be greater than 0.')
                }

                const execution = await prisma.kanbanExecution.findUnique({
                    where: { id },
                    select: {
                        id: true,
                        logFile: true,
                    },
                })
                if (!execution) {
                    throw notFoundError(`Execution "${id}" not found.`)
                }
                if (!execution.logFile) {
                    throw notFoundError(`Execution "${id}" log is unavailable.`)
                }

                const preview = await getExecutionLogPreview(execution.logFile, { lines })
                if (preview === null) {
                    throw notFoundError(`Execution "${id}" log is unavailable.`)
                }

                return {
                    raw: preview,
                    data: {
                        executionId: id,
                        lines,
                        log: preview,
                    },
                }
            }
            default:
                throw validationError(
                    `Unknown execution subcommand "${subcommand}". Expected one of: start, stop, status, cancel, retry, rerun, list, get, log.`
                )
        }
    })
}

export async function runQueueCommand(context: CliCommandContext): Promise<CliCommandResult> {
    return withCliErrorHandling('Queue command failed', async () => {
        const parsedArgs = parseCommandArgs(context.args)
        const subcommand = parsedArgs.positionals[0] ?? 'list'

        switch (subcommand) {
            case 'list': {
                const column = z.enum(['queued', 'backlog']).parse(
                    getOptionValue(parsedArgs, 'column') ?? 'queued'
                )
                const tasks = column === 'queued'
                    ? await listQueuedTasks()
                    : await prisma.kanbanTask.findMany({
                        where: { column: 'backlog' },
                        orderBy: [
                            { position: 'asc' },
                            { createdAt: 'asc' },
                        ],
                    })

                return {
                    data: {
                        column,
                        tasks: tasks.map((task) => serializeKanbanTask(task)),
                    },
                    message: `Found ${tasks.length} ${column} tasks.`,
                }
            }
            case 'shuffle': {
                const mode = shuffleQueuedTasksSchema.parse({
                    mode: getOptionValue(parsedArgs, 'mode') ?? 'full',
                }).mode
                const result = await shuffleQueue(mode)
                return {
                    data: result,
                    message: result.meta.changed ? 'Queue shuffled.' : 'Queue order unchanged.',
                }
            }
            case 'full': {
                const result = await shuffleQueue('full')
                return {
                    data: result,
                    message: result.meta.changed ? 'Queue shuffled.' : 'Queue order unchanged.',
                }
            }
            case 'single': {
                const result = await singleShuffleQueue()
                return {
                    data: result,
                    message: result.meta.changed
                        ? `Promoted task "${result.meta.promotedTaskId}".`
                        : 'Queue order unchanged.',
                }
            }
            case 'feeling-lucky':
            case 'lucky': {
                const request = parseFeelingLuckyRequest(parsedArgs)
                const result = await executeFeelingLucky(request)
                return {
                    data: result,
                    message: `Queued task "${result.task.id}" from ${request.sourceColumn}.`,
                }
            }
            default:
                throw validationError(
                    `Unknown queue subcommand "${subcommand}". Expected one of: list, shuffle, full, single, feeling-lucky.`
                )
        }
    })
}

export async function runScheduleCommand(context: CliCommandContext): Promise<CliCommandResult> {
    return withCliErrorHandling('Schedule command failed', async () => {
        const parsedArgs = parseCommandArgs(context.args)
        const subcommand = parsedArgs.positionals[0] ?? 'list'
        const includeIntrospection = readBooleanOption(parsedArgs, 'preview', 'includePreview') ?? true
        const introspectionAt = new Date()

        switch (subcommand) {
            case 'list': {
                const query = kanbanSchedulesQuerySchema.parse({
                    taskId: getOptionValue(parsedArgs, 'taskId') ?? undefined,
                    type: getOptionValue(parsedArgs, 'type') ?? undefined,
                    status: getOptionValue(parsedArgs, 'status') ?? undefined,
                    dueBefore: getOptionValue(parsedArgs, 'dueBefore') ?? undefined,
                    page: getOptionValue(parsedArgs, 'page') ?? undefined,
                    limit: getOptionValue(parsedArgs, 'limit') ?? undefined,
                })
                const result = await listKanbanSchedules(query)

                return {
                    data: {
                        ...result,
                        schedules: result.schedules.map((schedule) =>
                            serializeScheduleWithIntrospection(schedule, includeIntrospection, introspectionAt)
                        ),
                    },
                    message: `Found ${result.pagination.total} schedules.`,
                }
            }
            case 'get': {
                const scheduleId = requirePositional(parsedArgs, 1, 'schedule id')
                const { id } = kanbanScheduleParamsSchema.parse({ id: scheduleId })
                const schedule = await getKanbanScheduleById(id)
                if (!schedule) {
                    throw notFoundError(`Schedule "${id}" not found.`)
                }

                return {
                    data: serializeScheduleWithIntrospection(schedule, includeIntrospection, introspectionAt),
                }
            }
            case 'create': {
                const payload = readObjectPayload(readDataPayload(parsedArgs), 'schedule payload')
                const data = parseScheduleCreateRequest(payload)
                const schedule = await createKanbanSchedule(data)

                return {
                    data: serializeScheduleWithIntrospection(schedule, includeIntrospection, introspectionAt),
                    message: `Created schedule "${schedule.name ?? schedule.id}" (${schedule.id}).`,
                }
            }
            case 'update': {
                const scheduleId = requirePositional(parsedArgs, 1, 'schedule id')
                const { id } = kanbanScheduleParamsSchema.parse({ id: scheduleId })
                const existingSchedule = await getKanbanScheduleById(id)
                if (!existingSchedule) {
                    throw notFoundError(`Schedule "${id}" not found.`)
                }

                const payload = readObjectPayload(readDataPayload(parsedArgs), 'schedule payload')
                const data = parseScheduleUpdateRequest(payload, existingSchedule.timezone)
                validateMergedScheduleRequest(existingSchedule, data)

                const schedule = await updateKanbanSchedule(id, data)
                if (!schedule) {
                    throw notFoundError(`Schedule "${id}" not found.`)
                }

                return {
                    data: serializeScheduleWithIntrospection(schedule, includeIntrospection, introspectionAt),
                    message: `Updated schedule "${schedule.id}".`,
                }
            }
            case 'delete': {
                const scheduleId = requirePositional(parsedArgs, 1, 'schedule id')
                const { id } = kanbanScheduleParamsSchema.parse({ id: scheduleId })
                const deleted = await deleteKanbanSchedule(id)
                if (!deleted) {
                    throw notFoundError(`Schedule "${id}" not found.`)
                }

                return {
                    data: { success: true, id },
                    message: `Deleted schedule "${id}".`,
                }
            }
            case 'pause': {
                const scheduleId = requirePositional(parsedArgs, 1, 'schedule id')
                const { id } = kanbanScheduleParamsSchema.parse({ id: scheduleId })
                const schedule = await pauseKanbanSchedule(id)
                if (!schedule) {
                    throw notFoundError(`Schedule "${id}" not found.`)
                }

                return {
                    data: serializeScheduleWithIntrospection(schedule, includeIntrospection, introspectionAt),
                    message: `Paused schedule "${id}".`,
                }
            }
            case 'resume': {
                const scheduleId = requirePositional(parsedArgs, 1, 'schedule id')
                const { id } = kanbanScheduleParamsSchema.parse({ id: scheduleId })
                const schedule = await resumeKanbanSchedule(id)
                if (!schedule) {
                    throw notFoundError(`Schedule "${id}" not found.`)
                }

                return {
                    data: serializeScheduleWithIntrospection(schedule, includeIntrospection, introspectionAt),
                    message: `Resumed schedule "${id}".`,
                }
            }
            case 'run-now': {
                const scheduleId = requirePositional(parsedArgs, 1, 'schedule id')
                const { id } = kanbanScheduleParamsSchema.parse({ id: scheduleId })
                const runNowAtValue = pickOptionValue(parsedArgs, 'at')
                const runNowTimezone = readScheduleTimezone(pickOptionValue(parsedArgs, 'timezone'), 'UTC')
                const runNowAt = runNowAtValue
                    ? parseScheduleDateValue(runNowAtValue, runNowTimezone, 'at', false)
                    : new Date()

                const updatedSchedule = await markKanbanScheduleRunNow(id, runNowAt)
                if (!updatedSchedule) {
                    throw notFoundError(`Schedule "${id}" not found.`)
                }

                const summary = await kanbanSchedulerRuntimeService.dispatchDueSchedules({
                    trigger: 'manual',
                    limit: 1,
                    scheduleIds: [id],
                })
                const refreshedSchedule = await getKanbanScheduleById(id)

                return {
                    data: {
                        schedule: serializeScheduleWithIntrospection(
                            refreshedSchedule ?? updatedSchedule,
                            includeIntrospection,
                            introspectionAt,
                        ),
                        summary,
                    },
                    message: `Run-now processed with ${summary.dispatchedCount} dispatch(es).`,
                }
            }
            default:
                throw validationError(
                    `Unknown schedule subcommand "${subcommand}". Expected one of: create, list, get, update, delete, pause, resume, run-now.`
                )
        }
    })
}

export async function runModelCommand(context: CliCommandContext): Promise<CliCommandResult> {
    return withCliErrorHandling('Model command failed', async () => {
        const parsedArgs = parseCommandArgs(context.args)
        const subcommand = parsedArgs.positionals[0] ?? 'list'

        switch (subcommand) {
            case 'list':
            case 'discover': {
                const providerValue = parsedArgs.positionals[1] ?? getOptionValue(parsedArgs, 'provider')
                const query = discoverKanbanModelsQuerySchema.parse({
                    refresh: readBooleanOption(parsedArgs, 'refresh') ?? undefined,
                })

                if (providerValue) {
                    const provider = kanbanModelProviderParamsSchema.parse({ provider: providerValue }).provider
                    const payload = await discoverKanbanModels(provider, { refresh: query.refresh })
                    return {
                        data: payload,
                        message: `Discovered ${payload.models.length} models for ${provider}.`,
                    }
                }

                const providers = ['claude', 'codex', 'ollama'] as const
                const payload = await Promise.all(
                    providers.map((provider) => discoverKanbanModels(provider, { refresh: query.refresh }))
                )

                return {
                    data: {
                        providers: payload,
                    },
                    message: `Discovered models for ${payload.length} providers.`,
                }
            }
            case 'get': {
                const settings = await getSettingsWithKanban()
                return {
                    data: {
                        defaultTool: settings.kanban.defaults.tool,
                        defaultModel: settings.kanban.defaults.model,
                    },
                }
            }
            case 'update':
            case 'set': {
                const result = await updateModelConfig(parsedArgs)
                return {
                    data: result,
                    message: 'Model defaults updated.',
                }
            }
            case 'config': {
                const configSubcommand = parsedArgs.positionals[1] ?? 'get'
                if (configSubcommand === 'get') {
                    const settings = await getSettingsWithKanban()
                    return {
                        data: {
                            defaultTool: settings.kanban.defaults.tool,
                            defaultModel: settings.kanban.defaults.model,
                        },
                    }
                }
                if (configSubcommand === 'update' || configSubcommand === 'set') {
                    const result = await updateModelConfig(parsedArgs)
                    return {
                        data: result,
                        message: 'Model defaults updated.',
                    }
                }

                throw validationError(
                    `Unknown model config subcommand "${configSubcommand}". Expected one of: get, update, set.`
                )
            }
            default:
                throw validationError(
                    `Unknown model subcommand "${subcommand}". Expected one of: list, discover, get, update, set, config.`
                )
        }
    })
}

export async function runFolderCommand(context: CliCommandContext): Promise<CliCommandResult> {
    return withCliErrorHandling('Folder command failed', async () => {
        const parsedArgs = parseCommandArgs(context.args)
        const subcommand = parsedArgs.positionals[0] ?? 'list'

        switch (subcommand) {
            case 'list': {
                const result = await listFoldersWithTree()
                return {
                    data: result,
                    message: `Found ${result.flat.length} folders.`,
                }
            }
            case 'get': {
                const folderId = requirePositional(parsedArgs, 1, 'folder id')
                const folder = await findFolderById(folderId)
                if (!folder) {
                    throw notFoundError(`Folder "${folderId}" not found.`)
                }

                return { data: folder }
            }
            case 'create': {
                const payload = readObjectPayload(readDataPayload(parsedArgs), 'folder payload')
                const folder = await createFolder(createFolderSchema.parse(payload))
                return {
                    data: folder,
                    message: `Created folder "${folder.name}" (${folder.id}).`,
                }
            }
            case 'update': {
                const folderId = requirePositional(parsedArgs, 1, 'folder id')
                const payload = readObjectPayload(readDataPayload(parsedArgs), 'folder payload')
                const folder = await updateFolder(folderId, updateFolderSchema.parse(payload))
                return {
                    data: folder,
                    message: `Updated folder "${folder.name}" (${folder.id}).`,
                }
            }
            case 'move': {
                const folderId = requirePositional(parsedArgs, 1, 'folder id')
                const parentIdValue = hasFlag(parsedArgs, 'root')
                    ? null
                    : (getOptionValue(parsedArgs, 'parentId')
                        ?? getOptionValue(parsedArgs, 'parent'))

                const moveRequest = moveFolderSchema.parse({
                    parentId: parentIdValue ?? null,
                })

                const moveResult = await moveFolder(folderId, moveRequest.parentId)
                if (moveResult.status === 'folder_not_found') {
                    throw notFoundError(`Folder "${folderId}" not found.`)
                }
                if (moveResult.status === 'parent_not_found') {
                    throw notFoundError(`Parent folder "${moveRequest.parentId}" not found.`)
                }
                if (moveResult.status === 'circular_reference') {
                    throw validationError('Cannot move folder into itself or one of its descendants.')
                }

                return {
                    data: moveResult.folder,
                    message: `Moved folder "${folderId}".`,
                }
            }
            case 'delete': {
                const folderId = requirePositional(parsedArgs, 1, 'folder id')
                const deleted = await deleteFolderAndReassign(folderId)
                if (!deleted) {
                    throw notFoundError(`Folder "${folderId}" not found.`)
                }

                return {
                    data: { success: true, id: folderId },
                    message: `Deleted folder "${folderId}".`,
                }
            }
            default:
                throw validationError(
                    `Unknown folder subcommand "${subcommand}". Expected one of: list, get, create, update, move, delete.`
                )
        }
    })
}

export async function runTagCommand(context: CliCommandContext): Promise<CliCommandResult> {
    return withCliErrorHandling('Tag command failed', async () => {
        const parsedArgs = parseCommandArgs(context.args)
        const subcommand = parsedArgs.positionals[0] ?? 'list'

        switch (subcommand) {
            case 'list': {
                const tags = await listTagsWithCounts()
                return {
                    data: { tags },
                    message: `Found ${tags.length} tags.`,
                }
            }
            case 'get': {
                const tagId = requirePositional(parsedArgs, 1, 'tag id')
                const tag = await findTagWithRelations(tagId)
                if (!tag) {
                    throw notFoundError(`Tag "${tagId}" not found.`)
                }

                return { data: tag }
            }
            case 'create': {
                const payload = readObjectPayload(readDataPayload(parsedArgs), 'tag payload')
                const result = await createTagIfNotExists(createTagSchema.parse(payload))
                if (result.alreadyExists) {
                    throw conflictError('Tag already exists.')
                }

                return {
                    data: result.tag,
                    message: `Created tag "${result.tag?.name}".`,
                }
            }
            case 'update': {
                const tagId = requirePositional(parsedArgs, 1, 'tag id')
                const payload = readObjectPayload(readDataPayload(parsedArgs), 'tag payload')
                const result = await updateTagIfNoDuplicate(tagId, updateTagSchema.parse(payload))
                if (result.status === 'conflict') {
                    throw conflictError('Tag name already exists.')
                }

                return {
                    data: result.tag,
                    message: `Updated tag "${result.tag.name}" (${result.tag.id}).`,
                }
            }
            case 'merge': {
                const targetTagId = getOptionValue(parsedArgs, 'target')
                    ?? getOptionValue(parsedArgs, 'targetTagId')
                const sourceTagIds = splitCsvValues([
                    ...getOptionValues(parsedArgs, 'source'),
                    ...getOptionValues(parsedArgs, 'sourceTagIds'),
                ])
                const mergeRequest = mergeTagsSchema.parse({
                    targetTagId,
                    sourceTagIds,
                })

                const result = await mergeTags(mergeRequest.sourceTagIds, mergeRequest.targetTagId)
                if (result.status === 'target_not_found') {
                    throw notFoundError(`Target tag "${mergeRequest.targetTagId}" not found.`)
                }
                if (result.status === 'source_not_found') {
                    throw notFoundError('One or more source tags were not found.')
                }
                if (result.status === 'no_source') {
                    throw validationError('No valid source tags to merge.')
                }

                return {
                    data: result,
                    message: `Merged ${result.mergedCount} tags into "${mergeRequest.targetTagId}".`,
                }
            }
            case 'delete': {
                const tagId = requirePositional(parsedArgs, 1, 'tag id')
                await deleteTag(tagId)
                return {
                    data: { success: true, id: tagId },
                    message: `Deleted tag "${tagId}".`,
                }
            }
            default:
                throw validationError(
                    `Unknown tag subcommand "${subcommand}". Expected one of: list, get, create, update, merge, delete.`
                )
        }
    })
}

export async function runSearchCommand(context: CliCommandContext): Promise<CliCommandResult> {
    return withCliErrorHandling('Search command failed', async () => {
        const parsedArgs = parseCommandArgs(context.args)

        const firstPositional = parsedArgs.positionals[0]
        const isQuerySubcommand = firstPositional === 'query'
        const positionalQuery = isQuerySubcommand
            ? parsedArgs.positionals[1]
            : firstPositional

        const query = parseSearchQueryFromOptions(parsedArgs, positionalQuery)
        const type = SEARCH_TYPE_SCHEMA.parse(getOptionValue(parsedArgs, 'type') ?? 'all')
        const result = await searchPromptsAndWorkflows(query, type)

        return {
            data: result,
            message: `Found ${result.pagination.total} matching items.`,
        }
    })
}

export async function runTemplateCommand(context: CliCommandContext): Promise<CliCommandResult> {
    return withCliErrorHandling('Template command failed', async () => {
        const parsedArgs = parseCommandArgs(context.args)
        const subcommand = parsedArgs.positionals[0] ?? 'list'

        switch (subcommand) {
            case 'list': {
                const templates = await listWorkflowTemplates()
                return {
                    data: { templates },
                    message: `Found ${templates.length} templates.`,
                }
            }
            case 'instantiate':
            case 'create': {
                const templateId = requirePositional(parsedArgs, 1, 'template id')
                const name = getOptionValue(parsedArgs, 'name')
                const workflow = await createWorkflowFromTemplate(templateId, name)
                if (!workflow) {
                    throw notFoundError(`Template "${templateId}" not found.`)
                }

                return {
                    data: workflow,
                    message: `Created workflow "${workflow.name}" from template.`,
                }
            }
            default:
                throw validationError(
                    `Unknown template subcommand "${subcommand}". Expected one of: list, instantiate, create.`
                )
        }
    })
}

export async function runSettingsCommand(context: CliCommandContext): Promise<CliCommandResult> {
    return withCliErrorHandling('Settings command failed', async () => {
        const parsedArgs = parseCommandArgs(context.args)
        const subcommand = parsedArgs.positionals[0] ?? 'get'

        switch (subcommand) {
            case 'get': {
                const settings = await getSettingsWithKanban()
                return { data: settings }
            }
            case 'update': {
                const payload = readObjectPayload(readDataPayload(parsedArgs), 'settings payload')
                const settings = await updateSettingsWithKanban(updateSettingsSchema.parse(payload))
                return {
                    data: settings,
                    message: 'Settings updated.',
                }
            }
            case 'reset-usage': {
                const result = await resetPromptUsageCounts()
                return {
                    data: {
                        success: true,
                        count: result.count,
                    },
                    message: result.message,
                }
            }
            default:
                throw validationError(
                    `Unknown settings subcommand "${subcommand}". Expected one of: get, update, reset-usage.`
                )
        }
    })
}

export async function runAnalyticsCommand(context: CliCommandContext): Promise<CliCommandResult> {
    return withCliErrorHandling('Analytics command failed', async () => {
        const parsedArgs = parseCommandArgs(context.args)
        const subcommand = parsedArgs.positionals[0] ?? 'report'

        switch (subcommand) {
            case 'report': {
                const options = ANALYTICS_OPTIONS_SCHEMA.parse({
                    type: getOptionValue(parsedArgs, 'type') ?? 'all',
                    days: getOptionValue(parsedArgs, 'days') ?? 30,
                    limit: getOptionValue(parsedArgs, 'limit') ?? 10,
                })

                const report = await getAnalyticsReport(options)
                return { data: report }
            }
            case 'activity': {
                const options = ANALYTICS_ACTIVITY_SCHEMA.parse({
                    limit: getOptionValue(parsedArgs, 'limit') ?? 10,
                })

                const activity = await listAnalyticsActivity(options.limit)
                return { data: activity }
            }
            case 'trends': {
                const trends = await getAnalyticsTrends()
                return { data: trends }
            }
            case 'track': {
                const entityType = requirePositional(parsedArgs, 1, 'entity type')
                const entityId = requirePositional(parsedArgs, 2, 'entity id')
                const action = requirePositional(parsedArgs, 3, 'action')
                const rawMetadata = getOptionValue(parsedArgs, 'metadata')
                const metadata = rawMetadata
                    ? parseJsonValue<unknown>(rawMetadata, '--metadata')
                    : undefined

                const metadataObject = metadata === undefined
                    ? undefined
                    : readObjectPayload(metadata, 'metadata')

                const event = await trackAnalyticsAction(entityType, entityId, action, metadataObject)
                return {
                    data: event,
                    message: 'Tracked analytics action.',
                }
            }
            default:
                throw validationError(
                    `Unknown analytics subcommand "${subcommand}". Expected one of: report, activity, trends, track.`
                )
        }
    })
}

export async function runImportCommand(context: CliCommandContext): Promise<CliCommandResult> {
    return withCliErrorHandling('Import command failed', async () => {
        const parsedArgs = parseCommandArgs(context.args)
        const firstPositional = parsedArgs.positionals[0]
        const isDataSubcommand = firstPositional === 'data'
        const filePath = getOptionValue(parsedArgs, 'file')
            ?? getOptionValue(parsedArgs, 'input')
            ?? (isDataSubcommand ? parsedArgs.positionals[1] : firstPositional)

        if (!filePath) {
            throw validationError('Import requires a file path via --file <path> or positional argument.')
        }

        const formatOption = getOptionValue(parsedArgs, 'format')
        const format = formatOption ? z.enum(['json', 'yaml']).parse(formatOption) : undefined
        const payload = importDataSchema.parse(readStructuredDataFile(filePath, format))
        const result = await importPrompterData(payload)

        return {
            data: result,
            message: result.success
                ? 'Import completed successfully.'
                : 'Import completed with validation or write errors.',
        }
    })
}

export async function runExportCommand(context: CliCommandContext): Promise<CliCommandResult> {
    return withCliErrorHandling('Export command failed', async () => {
        const parsedArgs = parseCommandArgs(context.args)
        const formatOption = getOptionValue(parsedArgs, 'format') ?? 'json'
        const options = EXPORT_OPTIONS_SCHEMA.parse({
            format: formatOption,
            prompts: parseBooleanOption(parsedArgs, 'prompts') ?? true,
            workflows: parseBooleanOption(parsedArgs, 'workflows') ?? true,
            folders: parseBooleanOption(parsedArgs, 'folders') ?? true,
            tags: parseBooleanOption(parsedArgs, 'tags') ?? true,
        })

        const exportPayload = await buildPrompterExportData({
            includePrompts: options.prompts,
            includeWorkflows: options.workflows,
            includeFolders: options.folders,
            includeTags: options.tags,
        })

        const renderedOutput = options.format === 'yaml'
            ? yaml.dump(exportPayload, {
                indent: 2,
                lineWidth: 120,
                noRefs: true,
            })
            : JSON.stringify(exportPayload, null, 2)

        const outputPath = getOptionValue(parsedArgs, 'output') ?? getOptionValue(parsedArgs, 'file')
        if (outputPath) {
            const absolutePath = path.resolve(getCliProjectRoot(), outputPath)
            fs.writeFileSync(absolutePath, renderedOutput, 'utf8')
            return {
                data: {
                    outputPath: absolutePath,
                    format: options.format,
                    sizeBytes: Buffer.byteLength(renderedOutput, 'utf8'),
                },
                message: `Export written to ${absolutePath}.`,
            }
        }

        if (options.format === 'yaml') {
            return {
                raw: renderedOutput,
                data: exportPayload,
            }
        }

        return { data: exportPayload }
    })
}

export async function runAdminCommand(context: CliCommandContext): Promise<CliCommandResult> {
    return withCliErrorHandling('Admin command failed', async () => {
        const parsedArgs = parseCommandArgs(context.args)
        const subcommand = parsedArgs.positionals[0] ?? 'list'

        switch (subcommand) {
            case 'list': {
                const admins = await listAdmins()
                return {
                    data: { admins },
                    message: `Found ${admins.length} admin accounts.`,
                }
            }
            case 'upsert':
            case 'create':
            case 'set-password': {
                const username = getOptionValue(parsedArgs, 'username') ?? parsedArgs.positionals[1]
                const password = getOptionValue(parsedArgs, 'password')
                const credentials = ADMIN_CREDENTIALS_SCHEMA.parse({ username, password })
                const result = await upsertAdminCredentials(credentials.username, credentials.password)

                return {
                    data: result,
                    message: result.created
                        ? `Created admin "${credentials.username}".`
                        : `Updated password for admin "${credentials.username}".`,
                }
            }
            case 'delete': {
                const username = requirePositional(parsedArgs, 1, 'admin username')
                const result = await deleteAdminByUsername(username)

                if (result === 'not_found') {
                    throw notFoundError(`Admin "${username}" not found.`)
                }
                if (result === 'last_admin') {
                    throw conflictError('Cannot delete the last admin account.')
                }

                return {
                    data: { success: true, username },
                    message: `Deleted admin "${username}".`,
                }
            }
            case 'doctor': {
                if (!context.bootstrap) {
                    throw validationError('CLI bootstrap state is unavailable.')
                }

                const readinessPayload = {
                    status: 'ok',
                    projectRoot: context.bootstrap.projectRoot,
                    nodeVersion: context.bootstrap.nodeVersion,
                    databaseUrl: context.bootstrap.databaseUrl,
                    databasePath: context.bootstrap.databasePath ?? '(non-file database)',
                }

                return {
                    raw: [
                        'Environment checks passed.',
                        `Project root: ${readinessPayload.projectRoot}`,
                        `Node version: ${readinessPayload.nodeVersion}`,
                        `Database URL: ${readinessPayload.databaseUrl}`,
                        `Database path: ${readinessPayload.databasePath}`,
                    ].join('\n'),
                    data: readinessPayload,
                    message: 'Environment checks passed.',
                }
            }
            default:
                throw validationError(
                    `Unknown admin subcommand "${subcommand}". Expected one of: list, upsert, create, set-password, delete, doctor.`
                )
        }
    })
}

function parseTaskMoveRequest(parsedArgs: ReturnType<typeof parseCommandArgs>) {
    const payload = readOptionalObjectPayload(parsedArgs, 'task move payload')
    if (payload) {
        return moveKanbanTasksSchema.parse(payload)
    }

    const taskIds = splitCsvValues([
        ...parsedArgs.positionals.slice(1),
        ...getOptionValues(parsedArgs, 'taskIds'),
        ...getOptionValues(parsedArgs, 'taskId'),
    ])

    return moveKanbanTasksSchema.parse({
        taskIds,
        fromColumn: pickOptionValue(parsedArgs, 'fromColumn', 'from') ?? undefined,
        toColumn: pickOptionValue(parsedArgs, 'toColumn', 'to'),
        position: parseIntegerOption(parsedArgs, 'position'),
    })
}

function parseTaskReorderRequest(parsedArgs: ReturnType<typeof parseCommandArgs>) {
    const payload = readOptionalObjectPayload(parsedArgs, 'task reorder payload')
    if (payload) {
        return reorderKanbanColumnSchema.parse(payload)
    }

    const taskIds = splitCsvValues([
        ...parsedArgs.positionals.slice(1),
        ...getOptionValues(parsedArgs, 'taskIds'),
        ...getOptionValues(parsedArgs, 'taskId'),
    ])

    if (taskIds.length === 0) {
        throw validationError('Reorder requires task IDs via --taskIds/--taskId or positional values.')
    }

    return reorderKanbanColumnSchema.parse({
        column: pickOptionValue(parsedArgs, 'column') ?? 'queued',
        tasks: taskIds.map((id, position) => ({ id, position })),
    })
}

async function executeTaskBatchMove(data: z.infer<typeof moveKanbanTasksSchema>) {
    const selectedTasks = await prisma.kanbanTask.findMany({
        where: {
            id: {
                in: data.taskIds,
            },
        },
    })

    const selectedById = new Map(selectedTasks.map((task) => [task.id, task]))
    const orderedSelectedTasks = []

    for (const taskId of data.taskIds) {
        const task = selectedById.get(taskId)
        if (!task) {
            throw notFoundError(`Task not found: ${taskId}`)
        }
        orderedSelectedTasks.push(task)
    }

    if (data.fromColumn && orderedSelectedTasks.some((task) => task.column !== data.fromColumn)) {
        throw validationError(`One or more tasks are not in ${data.fromColumn}.`)
    }

    for (const task of orderedSelectedTasks) {
        const transitionError = getLifecycleTransitionError(task.column, data.toColumn)
        if (transitionError) {
            throw conflictError(`${transitionError} (task: ${task.id}).`)
        }
    }

    if (data.toColumn === 'queued') {
        for (const task of orderedSelectedTasks) {
            if (task.column === 'queued') {
                continue
            }

            const queueValidationError = getQueueValidationError(task)
            if (queueValidationError) {
                throw validationError(`${queueValidationError} (task: ${task.id}).`)
            }
        }
    }

    const affectedColumns = Array.from(new Set<KanbanColumn>([
        data.toColumn as KanbanColumn,
        ...orderedSelectedTasks.map((task) => task.column),
    ]))

    const affectedTasks = await prisma.kanbanTask.findMany({
        where: {
            column: {
                in: affectedColumns,
            },
        },
        orderBy: [
            { column: 'asc' },
            { position: 'asc' },
            { createdAt: 'asc' },
        ],
    })

    const selectedTaskIds = new Set(orderedSelectedTasks.map((task) => task.id))
    const tasksByColumn = new Map<KanbanColumn, typeof affectedTasks>()
    for (const column of affectedColumns) {
        tasksByColumn.set(column, [])
    }

    for (const task of affectedTasks) {
        if (selectedTaskIds.has(task.id)) {
            continue
        }

        const bucket = tasksByColumn.get(task.column)
        if (bucket) {
            bucket.push(task)
        }
    }

    const targetTasks = tasksByColumn.get(data.toColumn as KanbanColumn) ?? []
    const insertionPosition = Math.min(
        Math.max(data.position ?? targetTasks.length, 0),
        targetTasks.length,
    )

    targetTasks.splice(insertionPosition, 0, ...orderedSelectedTasks)
    tasksByColumn.set(data.toColumn as KanbanColumn, targetTasks)

    const nextState = new Map<string, { column: KanbanColumn; position: number }>()
    for (const [column, columnTasks] of tasksByColumn) {
        columnTasks.forEach((task, position) => {
            nextState.set(task.id, { column, position })
        })
    }

    const changedTasks = affectedTasks.filter((task) => {
        const nextTaskState = nextState.get(task.id)
        if (!nextTaskState) {
            return false
        }

        return task.column !== nextTaskState.column || task.position !== nextTaskState.position
    })

    if (changedTasks.length > 0) {
        const currentMinPosition = affectedTasks.reduce(
            (minPosition, task) => Math.min(minPosition, task.position),
            0,
        )
        const temporaryStartPosition = currentMinPosition - changedTasks.length - 1

        await prisma.$transaction([
            ...changedTasks.map((task, index) => {
                const nextTaskState = nextState.get(task.id)
                if (!nextTaskState) {
                    throw new Error(`Missing next state for task ${task.id}`)
                }

                return prisma.kanbanTask.update({
                    where: { id: task.id },
                    data: {
                        column: nextTaskState.column,
                        position: temporaryStartPosition + index,
                    },
                })
            }),
            ...changedTasks.map((task) => {
                const nextTaskState = nextState.get(task.id)
                if (!nextTaskState) {
                    throw new Error(`Missing next state for task ${task.id}`)
                }

                return prisma.kanbanTask.update({
                    where: { id: task.id },
                    data: {
                        column: nextTaskState.column,
                        position: nextTaskState.position,
                    },
                })
            }),
        ])
    }

    const movedCount = orderedSelectedTasks.reduce((count, task) => {
        const nextTaskState = nextState.get(task.id)
        if (!nextTaskState || nextTaskState.column === task.column) {
            return count
        }

        return count + 1
    }, 0)

    const changedTaskIds = changedTasks.map((task) => task.id)
    const updatedTasks = changedTaskIds.length === 0
        ? []
        : await prisma.kanbanTask.findMany({
            where: {
                id: {
                    in: changedTaskIds,
                },
            },
            orderBy: [
                { column: 'asc' },
                { position: 'asc' },
                { createdAt: 'asc' },
            ],
        })

    return {
        tasks: updatedTasks.map((task) => serializeKanbanTask(task)),
        meta: {
            requestedCount: orderedSelectedTasks.length,
            movedCount,
            updatedCount: changedTasks.length,
            affectedColumns,
        },
    }
}

async function executeTaskBatchReorder(data: z.infer<typeof reorderKanbanColumnSchema>) {
    if (data.column !== 'queued') {
        throw conflictError('Only the queued column supports manual reordering.')
    }

    const orderedPositions = data.tasks
        .map((task) => task.position)
        .sort((left, right) => left - right)
    for (let index = 0; index < orderedPositions.length; index += 1) {
        if (orderedPositions[index] !== index) {
            throw validationError('Task positions must form a contiguous range starting at 0.')
        }
    }

    const desiredOrder = [...data.tasks]
        .sort((left, right) => left.position - right.position)
        .map((task) => task.id)

    let reorderResult: Awaited<ReturnType<typeof reorderQueuedTasks>>
    try {
        reorderResult = await reorderQueuedTasks(desiredOrder)
    } catch (error) {
        if (error instanceof Error && error.message.includes('queued')) {
            throw validationError(error.message)
        }
        throw error
    }

    const changedTaskIds = reorderResult.changedTaskIds
    const updatedTasks = changedTaskIds.length === 0
        ? []
        : await prisma.kanbanTask.findMany({
            where: {
                id: {
                    in: changedTaskIds,
                },
            },
            orderBy: [
                { position: 'asc' },
                { createdAt: 'asc' },
            ],
        })

    return {
        tasks: updatedTasks.map((task) => serializeKanbanTask(task)),
        meta: {
            column: data.column,
            requestedCount: data.tasks.length,
            reorderedCount: changedTaskIds.length,
            updatedCount: changedTaskIds.length,
        },
    }
}

function parseScheduleCreateRequest(payload: Record<string, unknown>) {
    const timezone = readScheduleTimezone(payload.timezone, 'UTC')
    const normalizedPayload = normalizeSchedulePayloadDateFields(payload, timezone, false)
    const data = createKanbanScheduleSchema.parse(normalizedPayload)
    validateScheduleTiming(data.type, data.cronExpression ?? null, data.timezone)
    return data
}

function parseScheduleUpdateRequest(payload: Record<string, unknown>, fallbackTimezone: string) {
    const timezone = readScheduleTimezone(payload.timezone, fallbackTimezone)
    const normalizedPayload = normalizeSchedulePayloadDateFields(payload, timezone, true)
    const data = updateKanbanScheduleSchema.parse(normalizedPayload)
    return data
}

function validateMergedScheduleRequest(
    existing: CliKanbanSchedule,
    update: z.infer<typeof updateKanbanScheduleSchema>,
) {
    const mergedSchedule = createKanbanScheduleSchema.parse({
        name: update.name === undefined ? existing.name ?? undefined : update.name ?? undefined,
        type: update.type ?? existing.type,
        runAt: update.runAt === undefined ? existing.runAt ?? undefined : update.runAt ?? undefined,
        cronExpression: update.cronExpression === undefined
            ? existing.cronExpression ?? undefined
            : update.cronExpression ?? undefined,
        timezone: update.timezone ?? existing.timezone,
        status: update.status ?? existing.status,
        nextRunAt: update.nextRunAt === undefined ? existing.nextRunAt ?? undefined : update.nextRunAt ?? undefined,
        taskId: update.taskId === undefined ? existing.taskId ?? undefined : update.taskId ?? undefined,
        allowConcurrentRuns: update.allowConcurrentRuns ?? existing.allowConcurrentRuns,
        skipIfTaskRunning: update.skipIfTaskRunning ?? existing.skipIfTaskRunning,
        catchUpMissedRuns: update.catchUpMissedRuns ?? existing.catchUpMissedRuns,
    })

    validateScheduleTiming(
        mergedSchedule.type,
        mergedSchedule.cronExpression ?? null,
        mergedSchedule.timezone,
    )
}

function serializeScheduleWithIntrospection(
    schedule: CliKanbanSchedule,
    includeIntrospection: boolean,
    referenceAt: Date,
) {
    if (!includeIntrospection) {
        return schedule
    }

    return {
        ...schedule,
        introspection: buildScheduleIntrospection(schedule, referenceAt),
    }
}

function buildScheduleIntrospection(schedule: CliKanbanSchedule, referenceAt: Date) {
    const timezoneValid = isValidTimeZone(schedule.timezone)
    const dueAt = computeScheduleDueAt(schedule, referenceAt, timezoneValid)
    const nextRunPreviewAt = schedule.type === 'cron'
        ? (schedule.cronExpression && timezoneValid
            ? computeNextCronOccurrence(schedule.cronExpression, referenceAt, schedule.timezone)
            : null)
        : (schedule.lastRunAt ? null : (schedule.nextRunAt ?? schedule.runAt))

    return {
        referenceAt: referenceAt.toISOString(),
        dueAt: dueAt?.toISOString() ?? null,
        nextRunPreviewAt: nextRunPreviewAt?.toISOString() ?? null,
        isDue: Boolean(dueAt && dueAt.getTime() <= referenceAt.getTime()),
        timezone: schedule.timezone,
        timezoneValid,
        cronValid: schedule.type === 'cron' ? Boolean(nextRunPreviewAt) : null,
    }
}

function computeScheduleDueAt(
    schedule: CliKanbanSchedule,
    referenceAt: Date,
    timezoneValid: boolean,
): Date | null {
    if (schedule.status !== 'active') {
        return null
    }

    if (schedule.type === 'one_time') {
        if (schedule.nextRunAt) {
            return schedule.nextRunAt
        }

        if (schedule.lastRunAt) {
            return null
        }

        return schedule.runAt
    }

    if (!schedule.cronExpression || !timezoneValid) {
        return null
    }

    if (schedule.nextRunAt) {
        return schedule.nextRunAt
    }

    const seedDate = schedule.catchUpMissedRuns && schedule.lastRunAt
        ? schedule.lastRunAt
        : referenceAt

    return computeNextCronOccurrence(schedule.cronExpression, seedDate, schedule.timezone)
}

function validateScheduleTiming(
    type: z.infer<typeof createKanbanScheduleSchema>['type'],
    cronExpression: string | null | undefined,
    timezone: string,
) {
    if (!isValidTimeZone(timezone)) {
        throw validationError(`Invalid timezone "${timezone}".`)
    }

    if (type !== 'cron' || !cronExpression) {
        return
    }

    const nextRunPreview = computeNextCronOccurrence(cronExpression, new Date(), timezone)
    if (!nextRunPreview) {
        throw validationError(`Invalid cronExpression "${cronExpression}" for timezone "${timezone}".`)
    }
}

function normalizeSchedulePayloadDateFields(
    payload: Record<string, unknown>,
    timezone: string,
    allowNullDates: boolean,
): Record<string, unknown> {
    const normalizedPayload: Record<string, unknown> = { ...payload }

    if (Object.prototype.hasOwnProperty.call(normalizedPayload, 'runAt')) {
        normalizedPayload.runAt = parseScheduleDateValue(
            normalizedPayload.runAt,
            timezone,
            'runAt',
            allowNullDates,
        )
    }

    if (Object.prototype.hasOwnProperty.call(normalizedPayload, 'nextRunAt')) {
        normalizedPayload.nextRunAt = parseScheduleDateValue(
            normalizedPayload.nextRunAt,
            timezone,
            'nextRunAt',
            allowNullDates,
        )
    }

    if (Object.prototype.hasOwnProperty.call(normalizedPayload, 'lastRunAt')) {
        normalizedPayload.lastRunAt = parseScheduleDateValue(
            normalizedPayload.lastRunAt,
            timezone,
            'lastRunAt',
            allowNullDates,
        )
    }

    return normalizedPayload
}

function readScheduleTimezone(candidate: unknown, fallbackTimezone: string): string {
    if (candidate !== undefined && candidate !== null && typeof candidate !== 'string') {
        throw validationError('timezone must be a string.')
    }

    const baseTimezone = typeof fallbackTimezone === 'string' ? fallbackTimezone.trim() : ''
    const candidateTimezone = typeof candidate === 'string' ? candidate.trim() : ''
    const timezone = candidateTimezone.length > 0 ? candidateTimezone : baseTimezone

    if (!timezone) {
        throw validationError('timezone is required.')
    }
    if (!isValidTimeZone(timezone)) {
        throw validationError(`Invalid timezone "${timezone}".`)
    }

    return timezone
}

function parseScheduleDateValue(
    value: unknown,
    timezone: string,
    fieldLabel: string,
    allowNull: false,
): Date
function parseScheduleDateValue(
    value: unknown,
    timezone: string,
    fieldLabel: string,
    allowNull: boolean,
): Date | null
function parseScheduleDateValue(
    value: unknown,
    timezone: string,
    fieldLabel: string,
    allowNull: boolean,
): Date | null {
    if (value === undefined) {
        return null
    }

    if (value === null) {
        if (allowNull) {
            return null
        }
        throw validationError(`Field "${fieldLabel}" cannot be null.`)
    }

    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            throw validationError(`Field "${fieldLabel}" must be a valid date.`)
        }
        return value
    }

    if (typeof value !== 'string') {
        throw validationError(`Field "${fieldLabel}" must be a date string.`)
    }

    const trimmedValue = value.trim()
    if (!trimmedValue) {
        if (allowNull) {
            return null
        }
        throw validationError(`Field "${fieldLabel}" must not be empty.`)
    }

    const parsedDate = parseScheduleDateString(trimmedValue, timezone)
    if (!parsedDate) {
        throw validationError(`Field "${fieldLabel}" must be a valid date for timezone "${timezone}".`)
    }

    return parsedDate
}

function parseScheduleDateString(value: string, timezone: string): Date | null {
    if (SCHEDULE_EXPLICIT_TIMEZONE_PATTERN.test(value)) {
        return parseAbsoluteDate(value)
    }

    const naiveMatch = SCHEDULE_NAIVE_DATETIME_PATTERN.exec(value)
    if (naiveMatch) {
        return parseNaiveDateInTimezone(naiveMatch, timezone)
    }

    return parseAbsoluteDate(value)
}

function parseAbsoluteDate(value: string): Date | null {
    const parsedDate = new Date(value)
    if (Number.isNaN(parsedDate.getTime())) {
        return null
    }
    return parsedDate
}

interface ScheduleDateParts {
    year: number
    month: number
    day: number
    hour: number
    minute: number
    second: number
    millisecond: number
}

function parseNaiveDateInTimezone(match: RegExpExecArray, timezone: string): Date | null {
    const year = Number.parseInt(match[1], 10)
    const month = Number.parseInt(match[2], 10)
    const day = Number.parseInt(match[3], 10)
    const hour = Number.parseInt(match[4] ?? '0', 10)
    const minute = Number.parseInt(match[5] ?? '0', 10)
    const second = Number.parseInt(match[6] ?? '0', 10)
    const millisecond = Number.parseInt((match[7] ?? '0').padEnd(3, '0'), 10)

    if (month < 1 || month > 12 || day < 1 || day > 31) {
        return null
    }
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
        return null
    }
    if (millisecond < 0 || millisecond > 999) {
        return null
    }

    const utcDate = new Date(Date.UTC(year, month - 1, day))
    if (
        utcDate.getUTCFullYear() !== year
        || utcDate.getUTCMonth() !== month - 1
        || utcDate.getUTCDate() !== day
    ) {
        return null
    }

    return resolveNaiveDateInTimezone({
        year,
        month,
        day,
        hour,
        minute,
        second,
        millisecond,
    }, timezone)
}

function resolveNaiveDateInTimezone(parts: ScheduleDateParts, timezone: string): Date | null {
    let candidateUtcMs = scheduleDatePartsToUtcMs(parts)

    for (let attempt = 0; attempt < 6; attempt += 1) {
        const candidateDate = new Date(candidateUtcMs)
        const candidateParts = getScheduleDatePartsInTimezone(candidateDate, timezone)
        const deltaMs = scheduleDatePartsToUtcMs(parts) - scheduleDatePartsToUtcMs(candidateParts)
        if (deltaMs === 0) {
            break
        }

        candidateUtcMs += deltaMs
    }

    const resolvedDate = new Date(candidateUtcMs)
    const resolvedParts = getScheduleDatePartsInTimezone(resolvedDate, timezone)
    if (!areScheduleDatePartsEqual(resolvedParts, parts)) {
        return null
    }

    return resolvedDate
}

function getScheduleDatePartsInTimezone(date: Date, timezone: string): ScheduleDateParts {
    let formatter = SCHEDULE_TIMEZONE_PARTS_CACHE.get(timezone)
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        })
        SCHEDULE_TIMEZONE_PARTS_CACHE.set(timezone, formatter)
    }

    const partsMap: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {}
    for (const part of formatter.formatToParts(date)) {
        partsMap[part.type] = part.value
    }

    return {
        year: Number.parseInt(partsMap.year ?? '0', 10),
        month: Number.parseInt(partsMap.month ?? '0', 10),
        day: Number.parseInt(partsMap.day ?? '0', 10),
        hour: Number.parseInt(partsMap.hour ?? '0', 10),
        minute: Number.parseInt(partsMap.minute ?? '0', 10),
        second: Number.parseInt(partsMap.second ?? '0', 10),
        millisecond: date.getUTCMilliseconds(),
    }
}

function scheduleDatePartsToUtcMs(parts: ScheduleDateParts): number {
    return Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
        parts.millisecond,
    )
}

function areScheduleDatePartsEqual(left: ScheduleDateParts, right: ScheduleDateParts): boolean {
    return left.year === right.year
        && left.month === right.month
        && left.day === right.day
        && left.hour === right.hour
        && left.minute === right.minute
        && left.second === right.second
        && left.millisecond === right.millisecond
}

function parseExecutionStartRequest(parsedArgs: ReturnType<typeof parseCommandArgs>) {
    const payload = readOptionalObjectPayload(parsedArgs, 'execution start payload')
    if (payload) {
        return startKanbanExecutionSchema.parse(payload)
    }

    return startKanbanExecutionSchema.parse({
        taskId: pickOptionValue(parsedArgs, 'taskId'),
        trigger: pickOptionValue(parsedArgs, 'trigger'),
        startIfIdle: readBooleanOption(parsedArgs, 'startIfIdle') ?? undefined,
    })
}

function parseExecutionStopRequest(parsedArgs: ReturnType<typeof parseCommandArgs>) {
    const payload = readOptionalObjectPayload(parsedArgs, 'execution stop payload')
    if (payload) {
        return stopKanbanExecutionSchema.parse(payload)
    }

    return stopKanbanExecutionSchema.parse({
        graceful: readBooleanOption(parsedArgs, 'graceful') ?? undefined,
        reason: pickOptionValue(parsedArgs, 'reason'),
    })
}

function parseExecutionCancelRequest(parsedArgs: ReturnType<typeof parseCommandArgs>) {
    const payload = readOptionalObjectPayload(parsedArgs, 'execution cancel payload')
    if (payload) {
        return cancelKanbanExecutionSchema.parse(payload)
    }

    return cancelKanbanExecutionSchema.parse({
        taskId: pickOptionValue(parsedArgs, 'taskId'),
        executionId: pickOptionValue(parsedArgs, 'executionId'),
        signal: pickOptionValue(parsedArgs, 'signal'),
    })
}

function parseRetryExecutionRequest(parsedArgs: ReturnType<typeof parseCommandArgs>) {
    const payload = readOptionalObjectPayload(parsedArgs, 'execution retry payload')
    if (payload) {
        return retryKanbanExecutionSchema.parse(payload)
    }

    return retryKanbanExecutionSchema.parse({
        taskId: pickOptionValue(parsedArgs, 'taskId', 'id') ?? parsedArgs.positionals[1],
        fromExecutionId: pickOptionValue(parsedArgs, 'fromExecutionId', 'executionId'),
        toFrontOfQueue: readBooleanOption(parsedArgs, 'toFrontOfQueue', 'front') ?? undefined,
    })
}

async function buildExecutionStatusPayload(query: z.infer<typeof kanbanExecutionStatusQuerySchema>) {
    const runningProcess = kanbanExecutionEngine.getRunningProcess()
    const [runningExecution, queuedTasks, executionHistory, runningCount] = await Promise.all([
        prisma.kanbanExecution.findFirst({
            where: { status: 'running' },
            orderBy: { createdAt: 'desc' },
            include: {
                task: {
                    select: {
                        id: true,
                        name: true,
                        column: true,
                        position: true,
                    },
                },
            },
        }),
        query.includeQueue
            ? prisma.kanbanTask.findMany({
                where: { column: 'queued' },
                orderBy: [
                    { position: 'asc' },
                    { createdAt: 'asc' },
                ],
                select: {
                    id: true,
                    name: true,
                    position: true,
                    column: true,
                },
            })
            : Promise.resolve(null),
        query.includeHistory
            ? prisma.kanbanExecution.findMany({
                orderBy: { createdAt: 'desc' },
                take: 20,
                include: {
                    task: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            })
            : Promise.resolve(null),
        prisma.kanbanExecution.count({
            where: { status: 'running' },
        }),
    ])

    const runningLogPreview = query.includeLogs && runningExecution?.logFile
        ? await getExecutionLogPreview(runningExecution.logFile, { lines: 20 })
        : null

    return {
        status: kanbanExecutionControlService.getStatus(Boolean(runningProcess)),
        stopped: kanbanExecutionControlService.isStopped(),
        runningProcess,
        runningExecution,
        singleSlotInvariant: runningCount <= 1,
        ...(query.includeQueue ? { queue: queuedTasks ?? [] } : {}),
        ...(query.includeHistory ? { history: executionHistory ?? [] } : {}),
        ...(query.includeLogs
            ? {
                logs: {
                    available: true,
                    eventStreamUrl: '/api/executions/events',
                    runningExecutionLogUrl: runningExecution?.id ? `/api/executions/${runningExecution.id}/log` : null,
                    runningExecutionPreview: runningLogPreview,
                },
            }
            : {}),
    }
}

async function requeueExecutionTask(
    mode: 'retry' | 'rerun',
    data: z.infer<typeof retryKanbanExecutionSchema>,
) {
    const task = await prisma.kanbanTask.findUnique({
        where: { id: data.taskId },
        select: {
            id: true,
            column: true,
            config: true,
        },
    })
    if (!task) {
        throw notFoundError('Task not found.')
    }

    const expectedColumn = mode === 'retry' ? 'failed' : 'completed'
    if (task.column !== expectedColumn) {
        throw conflictError(
            mode === 'retry'
                ? 'Retry is only available for failed tasks.'
                : 'Rerun is only available for completed tasks.'
        )
    }

    const parsedConfig = parseTaskConfig(task.config)
    const configValidation = kanbanTaskConfigSchema.safeParse(parsedConfig)
    if (!configValidation.success) {
        throw validationError('Task config is invalid for queueing.')
    }

    if (data.fromExecutionId) {
        const sourceExecution = await prisma.kanbanExecution.findUnique({
            where: { id: data.fromExecutionId },
            select: {
                id: true,
                taskId: true,
                status: true,
            },
        })

        if (!sourceExecution || sourceExecution.taskId !== task.id) {
            throw conflictError(
                mode === 'retry'
                    ? 'Retry source execution does not match this task.'
                    : 'Rerun source execution does not match this task.'
            )
        }

        if (mode === 'retry' && sourceExecution.status !== 'failed' && sourceExecution.status !== 'cancelled') {
            throw conflictError('Retry source execution must be failed or cancelled.')
        }

        if (mode === 'rerun' && sourceExecution.status !== 'completed') {
            throw conflictError('Rerun source execution must be completed.')
        }
    }

    const queueUpdate = await requeueTask(task.id, data.toFrontOfQueue)
    const updatedTask = await prisma.kanbanTask.findUnique({
        where: { id: task.id },
    })
    if (!updatedTask) {
        throw notFoundError('Task not found after queue update.')
    }

    return {
        task: serializeKanbanTask(updatedTask),
        queuePosition: queueUpdate.position,
        engineStatus: kanbanExecutionControlService.getStatus(Boolean(kanbanExecutionEngine.getRunningProcess())),
    }
}

async function shuffleQueue(mode: z.infer<typeof shuffleQueuedTasksSchema>['mode']) {
    const queuedTasks = await listQueuedTasks()
    if (queuedTasks.length <= 1) {
        return {
            tasks: queuedTasks.map((task) => serializeKanbanTask(task)),
            meta: {
                mode,
                changed: false,
                shuffledCount: 0,
            },
        }
    }

    const desiredOrder = mode === 'weighted'
        ? weightedShuffle(queuedTasks.map((task) => ({
            id: task.id,
            weight: getTaskWeight(task.config),
        })))
        : fullShuffle(queuedTasks.map((task) => task.id))

    const reorderResult = await reorderQueuedTasks(desiredOrder)
    const updatedTasks = await listQueuedTasks()

    return {
        tasks: updatedTasks.map((task) => serializeKanbanTask(task)),
        meta: {
            mode,
            changed: reorderResult.changedTaskIds.length > 0,
            shuffledCount: reorderResult.changedTaskIds.length,
        },
    }
}

async function singleShuffleQueue() {
    const queuedTasks = await listQueuedTasks()
    if (queuedTasks.length <= 1) {
        return {
            tasks: queuedTasks.map((task) => serializeKanbanTask(task)),
            meta: {
                changed: false,
                promotedTaskId: null,
            },
        }
    }

    const promotedIndex = randomInt(1, queuedTasks.length)
    const promotedTaskId = queuedTasks[promotedIndex].id
    const desiredOrder = [
        promotedTaskId,
        ...queuedTasks
            .filter((task) => task.id !== promotedTaskId)
            .map((task) => task.id),
    ]

    const reorderResult = await reorderQueuedTasks(desiredOrder)
    const updatedTasks = await listQueuedTasks()

    return {
        tasks: updatedTasks.map((task) => serializeKanbanTask(task)),
        meta: {
            changed: reorderResult.changedTaskIds.length > 0,
            promotedTaskId,
        },
    }
}

function parseFeelingLuckyRequest(parsedArgs: ReturnType<typeof parseCommandArgs>) {
    const payload = readOptionalObjectPayload(parsedArgs, 'feeling-lucky payload')
    if (payload) {
        return kanbanFeelingLuckySchema.parse(payload)
    }

    return kanbanFeelingLuckySchema.parse({
        sourceColumn: pickOptionValue(parsedArgs, 'sourceColumn'),
        targetColumn: pickOptionValue(parsedArgs, 'targetColumn'),
        autoStart: readBooleanOption(parsedArgs, 'autoStart') ?? undefined,
        applyDefaults: readBooleanOption(parsedArgs, 'applyDefaults') ?? undefined,
    })
}

async function executeFeelingLucky(request: z.infer<typeof kanbanFeelingLuckySchema>) {
    const sourceTasks = await prisma.kanbanTask.findMany({
        where: { column: request.sourceColumn },
        orderBy: [
            { position: 'asc' },
            { createdAt: 'asc' },
        ],
        select: {
            id: true,
            config: true,
        },
    })

    if (sourceTasks.length === 0) {
        throw notFoundError(`No tasks are available in ${request.sourceColumn} for feeling-lucky.`)
    }

    const luckyTask = sourceTasks[randomInt(sourceTasks.length)]
    const baseConfig = parseTaskConfig(luckyTask.config)
    const kanbanSettings = request.applyDefaults ? await getKanbanSettings() : null
    const candidateConfig = request.applyDefaults
        ? applyQueueRuntimeDefaults(baseConfig, kanbanSettings)
        : baseConfig
    const validatedConfig = kanbanTaskConfigSchema.safeParse(candidateConfig)
    if (!validatedConfig.success) {
        throw validationError('Selected task config is invalid for queueing.')
    }

    if (request.applyDefaults) {
        await prisma.kanbanTask.update({
            where: { id: luckyTask.id },
            data: {
                config: JSON.stringify({
                    ...baseConfig,
                    ...validatedConfig.data,
                }),
            },
        })
    }

    const queueResult = await requeueTask(luckyTask.id, true)
    let startResult: Awaited<ReturnType<typeof kanbanExecutionEngine.executeNextTask>> | null = null
    if (request.autoStart) {
        kanbanExecutionControlService.markStarted()
        startResult = await kanbanExecutionEngine.executeNextTask('random')
    }

    const [updatedTask, queuedCount] = await Promise.all([
        prisma.kanbanTask.findUnique({
            where: { id: luckyTask.id },
        }),
        prisma.kanbanTask.count({
            where: { column: request.targetColumn },
        }),
    ])

    if (!updatedTask) {
        throw notFoundError('Task not found after feeling-lucky move.')
    }

    return {
        task: serializeKanbanTask(updatedTask),
        queuePosition: queueResult.position,
        queuedCount,
        startResult,
        engineStatus: kanbanExecutionControlService.getStatus(Boolean(kanbanExecutionEngine.getRunningProcess())),
    }
}

async function updateModelConfig(parsedArgs: ReturnType<typeof parseCommandArgs>) {
    const payload = readOptionalObjectPayload(parsedArgs, 'model config payload')
    const config = updateKanbanModelConfigSchema.parse(
        payload ?? {
            defaultTool: pickOptionValue(parsedArgs, 'defaultTool', 'tool') ?? undefined,
            defaultModel: normalizeDefaultModelValue(pickOptionValue(parsedArgs, 'defaultModel', 'model')),
        }
    )

    const defaultsUpdate: {
        tool?: z.infer<typeof updateKanbanModelConfigSchema>['defaultTool']
        model?: string
    } = {}
    if (config.defaultTool !== undefined) {
        defaultsUpdate.tool = config.defaultTool
    }
    if (config.defaultModel !== undefined) {
        if (config.defaultModel === null) {
            throw validationError('defaultModel cannot be null for kanban defaults.')
        }
        defaultsUpdate.model = config.defaultModel
    }

    if (defaultsUpdate.tool === undefined && defaultsUpdate.model === undefined) {
        throw validationError('Model config update requires --defaultTool and/or --defaultModel.')
    }

    const nextSettings = await updateSettingsWithKanban({
        kanban: {
            defaults: defaultsUpdate,
        },
    })

    return {
        defaultTool: nextSettings.kanban.defaults.tool,
        defaultModel: nextSettings.kanban.defaults.model,
        ignored: config.availableModels ? ['availableModels'] : [],
    }
}

function fullShuffle(taskIds: string[]): string[] {
    const shuffledTaskIds = [...taskIds]

    for (let index = shuffledTaskIds.length - 1; index > 0; index -= 1) {
        const randomIndex = randomInt(index + 1)
        const swapTarget = shuffledTaskIds[randomIndex]
        shuffledTaskIds[randomIndex] = shuffledTaskIds[index]
        shuffledTaskIds[index] = swapTarget
    }

    return shuffledTaskIds
}

interface WeightedTask {
    id: string
    weight: number
}

function weightedShuffle(tasks: WeightedTask[]): string[] {
    const pool = tasks.map((task) => ({ ...task }))
    const orderedTaskIds: string[] = []

    while (pool.length > 0) {
        const totalWeight = pool.reduce((sum, task) => sum + task.weight, 0)
        let roll = randomInt(totalWeight)

        let selectedIndex = 0
        for (let index = 0; index < pool.length; index += 1) {
            roll -= pool[index].weight
            if (roll < 0) {
                selectedIndex = index
                break
            }
        }

        orderedTaskIds.push(pool[selectedIndex].id)
        pool.splice(selectedIndex, 1)
    }

    return orderedTaskIds
}

function getTaskWeight(rawConfig: string): number {
    const parsedConfig = parseTaskConfig(rawConfig)
    const candidate = parsedConfig.weight

    if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
        return 1
    }

    const rounded = Math.round(candidate)
    if (rounded < 1) {
        return 1
    }
    if (rounded > 10) {
        return 10
    }

    return rounded
}

function normalizeDefaultModelValue(value: string | undefined): string | null | undefined {
    if (value === undefined) {
        return undefined
    }

    const normalizedValue = value.trim()
    if (normalizedValue.length === 0) {
        return undefined
    }

    if (normalizedValue === 'none' || normalizedValue === 'null') {
        return null
    }

    return normalizedValue
}

function readOptionalObjectPayload(
    parsedArgs: ReturnType<typeof parseCommandArgs>,
    label: string,
): Record<string, unknown> | null {
    const hasPayloadOption = hasFlag(parsedArgs, 'data')
        || hasFlag(parsedArgs, 'file')
        || getOptionValue(parsedArgs, 'data') !== undefined
        || getOptionValue(parsedArgs, 'file') !== undefined

    if (!hasPayloadOption) {
        return null
    }

    return readObjectPayload(readDataPayload(parsedArgs), label)
}

function pickOptionValue(
    parsedArgs: ReturnType<typeof parseCommandArgs>,
    ...optionNames: string[]
): string | undefined {
    for (const optionName of optionNames) {
        const optionValue = getOptionValue(parsedArgs, optionName)
        if (optionValue !== undefined) {
            return optionValue
        }
    }

    return undefined
}

function readBooleanOption(
    parsedArgs: ReturnType<typeof parseCommandArgs>,
    ...optionNames: string[]
): boolean | undefined {
    for (const optionName of optionNames) {
        const hasOption = hasFlag(parsedArgs, optionName) || getOptionValue(parsedArgs, optionName) !== undefined
        if (!hasOption) {
            continue
        }

        return parseBooleanOption(parsedArgs, optionName)
    }

    return undefined
}

function parseSearchQueryFromOptions(parsedArgs: ReturnType<typeof parseCommandArgs>, q?: string) {
    return searchQuerySchema.parse({
        q: q ?? getOptionValue(parsedArgs, 'q') ?? undefined,
        folderId: getOptionValue(parsedArgs, 'folderId') ?? undefined,
        tagId: getOptionValue(parsedArgs, 'tagId') ?? undefined,
        aiModel: getOptionValue(parsedArgs, 'aiModel') ?? undefined,
        isFavorite: getOptionValue(parsedArgs, 'isFavorite') ?? undefined,
        isArchived: getOptionValue(parsedArgs, 'isArchived') ?? undefined,
        sort: getOptionValue(parsedArgs, 'sort') ?? 'updated',
        order: getOptionValue(parsedArgs, 'order') ?? 'desc',
        page: getOptionValue(parsedArgs, 'page') ?? 1,
        limit: getOptionValue(parsedArgs, 'limit') ?? 20,
    })
}

function readObjectPayload(payload: unknown, label: string): Record<string, unknown> {
    if (!isRecord(payload)) {
        throw validationError(`Expected ${label} to be a JSON object.`)
    }

    return payload
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function withCliErrorHandling(
    fallbackMessage: string,
    runner: () => Promise<CliCommandResult>
): Promise<CliCommandResult> {
    try {
        return await runner()
    } catch (error) {
        throw toCliHandledError(error, fallbackMessage)
    }
}

function toCliHandledError(error: unknown, fallbackMessage: string): CliError {
    if (error instanceof CliError) {
        return error
    }

    if (error instanceof z.ZodError) {
        return validationError('Invalid command arguments.', error.flatten())
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
            return notFoundError('Requested resource was not found.')
        }
        if (error.code === 'P2002') {
            return conflictError('The resource already exists.')
        }
    }

    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return notFoundError((error as Error).message)
    }
    if (['EACCES', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) {
        return conflictError((error as Error).message)
    }

    if (error instanceof Error) {
        return unexpectedError(`${fallbackMessage}: ${error.message}`)
    }

    return unexpectedError(fallbackMessage)
}
