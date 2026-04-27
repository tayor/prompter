import { randomInt } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { kanbanExecutionControlService } from '@/lib/kanban/execution-control-service'
import { kanbanExecutionEngine } from '@/lib/kanban/execution-engine'
import { ensureLocalhostRequest } from '@/lib/kanban/localhost-guard'
import { getKanbanSettings } from '@/lib/kanban/settings-store'
import { DEFAULT_CLAUDE_MODEL } from '@/lib/model-defaults'
import { parseTaskConfig, requeueTask, serializeKanbanTask } from '@/lib/kanban/queue-operations'
import prisma from '@/lib/prisma'
import { kanbanFeelingLuckySchema, kanbanTaskConfigSchema } from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const KANBAN_TOOL_OPTIONS = new Set(['claude-cli', 'codex-cli', 'ollama', 'custom-bash', 'custom-command', 'custom'])

async function readRequestBody(request: NextRequest): Promise<unknown> {
    try {
        return await request.json()
    } catch {
        return {}
    }
}

// POST /api/queue/feeling-lucky - Random backlog pick to queued #1, optionally auto-start
export async function POST(request: NextRequest) {
    const localhostError = ensureLocalhostRequest(request)
    if (localhostError) {
        return localhostError
    }

    try {
        const body = await readRequestBody(request)
        const data = kanbanFeelingLuckySchema.parse(body)

        const sourceTasks = await prisma.kanbanTask.findMany({
            where: { column: data.sourceColumn },
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
            return NextResponse.json(
                { error: 'No tasks are available in backlog for feeling lucky' },
                { status: 404 },
            )
        }

        const luckyTask = sourceTasks[randomInt(sourceTasks.length)]
        const baseConfig = parseTaskConfig(luckyTask.config)
        const kanbanSettings = data.applyDefaults
            ? await getKanbanSettings()
            : null
        const candidateConfig = data.applyDefaults
            ? applyRuntimeDefaults(baseConfig, kanbanSettings)
            : baseConfig
        const validatedConfig = kanbanTaskConfigSchema.safeParse(candidateConfig)

        if (!validatedConfig.success) {
            return NextResponse.json(
                { error: 'Selected task config is invalid for queueing' },
                { status: 400 },
            )
        }

        if (data.applyDefaults) {
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

        if (data.autoStart) {
            kanbanExecutionControlService.markStarted()
            startResult = await kanbanExecutionEngine.executeNextTask('random')
        }

        const [updatedTask, queuedCount] = await Promise.all([
            prisma.kanbanTask.findUnique({
                where: { id: luckyTask.id },
            }),
            prisma.kanbanTask.count({
                where: { column: data.targetColumn },
            }),
        ])

        if (!updatedTask) {
            return NextResponse.json({ error: 'Task not found after feeling-lucky move' }, { status: 404 })
        }

        return NextResponse.json({
            task: serializeKanbanTask(updatedTask),
            queuePosition: queueResult.position,
            queuedCount,
            startResult,
            engineStatus: kanbanExecutionControlService.getStatus(Boolean(kanbanExecutionEngine.getRunningProcess())),
        })
    } catch (error) {
        console.error('Failed to run feeling-lucky flow:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid feeling-lucky payload', details: error },
                { status: 400 },
            )
        }
        return NextResponse.json({ error: 'Failed to run feeling-lucky flow' }, { status: 500 })
    }
}

function applyRuntimeDefaults(
    config: Record<string, unknown>,
    kanbanSettings: Awaited<ReturnType<typeof getKanbanSettings>> | null,
): Record<string, unknown> {
    const defaultModel = kanbanSettings?.defaults.model.trim() || DEFAULT_CLAUDE_MODEL
    const configuredTool = kanbanSettings?.defaults.tool ?? asString(config.tool)
    const defaultTool = KANBAN_TOOL_OPTIONS.has(configuredTool) ? configuredTool : 'claude-cli'
    const defaultTimeout = kanbanSettings?.execution.defaultTimeout ?? 300
    const defaultRetryOnFail = kanbanSettings?.execution.defaultRetryOnFail ?? false
    const defaultMaxRetries = kanbanSettings?.execution.defaultMaxRetries ?? 0
    const defaultRetryDelay = kanbanSettings?.execution.defaultRetryDelay ?? 0

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
