import type { Prisma } from '@prisma/client'
import { getExecutionLogPreview } from '@/lib/kanban/log-storage'
import prisma from '@/lib/prisma'
import type { KanbanExecutionsQueryInput } from '@/lib/validators'
import { parseJsonField } from '@/lib/services/tasks-service'

interface ExecutionSerializationBase {
    id: string
    configSnapshot: string
    logFile: string | null
}

type KanbanExecutionWithTask = Prisma.KanbanExecutionGetPayload<{
    include: {
        task: {
            select: {
                id: true
                name: true
                displayName: true
                column: true
            }
        }
    }
}>

export function buildKanbanExecutionWhere(
    query: Pick<KanbanExecutionsQueryInput, 'taskId' | 'status'>,
): Prisma.KanbanExecutionWhereInput {
    const where: Prisma.KanbanExecutionWhereInput = {}

    if (query.taskId) {
        where.taskId = query.taskId
    }

    if (query.status) {
        where.status = query.status
    }

    return where
}

export async function serializeKanbanExecution<T extends ExecutionSerializationBase>(
    execution: T,
    includePreview: boolean,
) {
    const logPreview = includePreview ? await getExecutionLogPreview(execution.logFile) : null

    return {
        ...execution,
        configSnapshot: parseJsonField<Record<string, unknown>>(execution.configSnapshot, {}),
        logPreview,
        logUrl: execution.logFile ? `/api/executions/${execution.id}/log` : null,
    }
}

export async function listKanbanExecutions(query: KanbanExecutionsQueryInput) {
    const where = buildKanbanExecutionWhere(query)
    const skip = (query.page - 1) * query.limit

    const [total, executions] = await prisma.$transaction([
        prisma.kanbanExecution.count({ where }),
        prisma.kanbanExecution.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: query.limit,
            include: {
                task: {
                    select: {
                        id: true,
                        name: true,
                        displayName: true,
                        column: true,
                    },
                },
            },
        }),
    ])

    const serializedExecutions = await Promise.all(
        executions.map((execution) => serializeKanbanExecution(execution, query.includePreview)),
    )

    return {
        executions: serializedExecutions,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(Math.ceil(total / query.limit), 1),
        },
    }
}

export async function getKanbanExecutionById(id: string, includePreview: boolean) {
    const execution = await prisma.kanbanExecution.findUnique({
        where: { id },
        include: {
            task: {
                select: {
                    id: true,
                    name: true,
                    displayName: true,
                    column: true,
                    sourcePath: true,
                },
            },
        },
    })

    if (!execution) {
        return null
    }

    return serializeKanbanExecution(execution, includePreview)
}

export type { KanbanExecutionWithTask }
