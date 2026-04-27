import type { KanbanColumn, KanbanTask } from '@prisma/client'
import prisma from '@/lib/prisma'

export interface KanbanTaskWithJsonFields {
    config: string
    dependencies: string
}

interface QueueTaskState {
    id: string
    column: KanbanColumn
    position: number
}

export function parseJsonField<T>(value: string, fallback: T): T {
    try {
        return JSON.parse(value) as T
    } catch {
        return fallback
    }
}

export function parseTaskConfig(rawConfig: string): Record<string, unknown> {
    return parseJsonField<Record<string, unknown>>(rawConfig, {})
}

export function serializeKanbanTask<T extends KanbanTaskWithJsonFields>(task: T) {
    return {
        ...task,
        config: parseJsonField<Record<string, unknown>>(task.config, {}),
        dependencies: parseJsonField<string[]>(task.dependencies, []),
    }
}

export async function reorderQueuedTasks(taskIdsInOrder: string[]): Promise<{ changedTaskIds: string[] }> {
    const queuedTasks = await prisma.kanbanTask.findMany({
        where: { column: 'queued' },
        orderBy: [
            { position: 'asc' },
            { createdAt: 'asc' },
        ],
        select: {
            id: true,
            column: true,
            position: true,
        },
    })

    if (queuedTasks.length !== taskIdsInOrder.length) {
        throw new Error('Reorder payload must include every task in the queued column')
    }

    const queuedTaskIds = new Set(queuedTasks.map((task) => task.id))
    for (const taskId of taskIdsInOrder) {
        if (!queuedTaskIds.has(taskId)) {
            throw new Error(`Task ${taskId} is not in the queued column`)
        }
    }

    return persistQueuedState(queuedTasks, taskIdsInOrder)
}

export async function requeueTask(taskId: string, toFront: boolean): Promise<{ position: number }> {
    const [task, queuedTasks] = await Promise.all([
        prisma.kanbanTask.findUnique({
            where: { id: taskId },
            select: {
                id: true,
                column: true,
                position: true,
            },
        }),
        prisma.kanbanTask.findMany({
            where: { column: 'queued' },
            orderBy: [
                { position: 'asc' },
                { createdAt: 'asc' },
            ],
            select: {
                id: true,
                column: true,
                position: true,
            },
        }),
    ])

    if (!task) {
        throw new Error(`Task not found: ${taskId}`)
    }

    const queueWithoutTaskIds = queuedTasks
        .filter((queuedTask) => queuedTask.id !== taskId)
        .map((queuedTask) => queuedTask.id)
    const desiredQueueOrder = toFront
        ? [taskId, ...queueWithoutTaskIds]
        : [...queueWithoutTaskIds, taskId]

    await persistQueuedState([...queuedTasks, task], desiredQueueOrder)

    return {
        position: desiredQueueOrder.indexOf(taskId),
    }
}

async function persistQueuedState(
    queueStateCandidates: QueueTaskState[],
    desiredQueueOrder: string[],
): Promise<{ changedTaskIds: string[] }> {
    const queueStateById = new Map<string, QueueTaskState>()
    for (const task of queueStateCandidates) {
        queueStateById.set(task.id, task)
    }

    for (const taskId of desiredQueueOrder) {
        if (!queueStateById.has(taskId)) {
            throw new Error(`Missing queue state for task ${taskId}`)
        }
    }

    const queuedPositions = Array.from(queueStateById.values())
        .filter((task) => task.column === 'queued')
        .map((task) => task.position)
    const currentMinPosition = queuedPositions.length > 0
        ? Math.min(...queuedPositions)
        : 0

    const nextPositionByTaskId = new Map<string, number>()
    desiredQueueOrder.forEach((taskId, position) => {
        nextPositionByTaskId.set(taskId, position)
    })

    const changedTasks = Array.from(queueStateById.values()).filter((task) => {
        const nextPosition = nextPositionByTaskId.get(task.id)
        if (nextPosition === undefined) {
            return false
        }

        return task.column !== 'queued' || task.position !== nextPosition
    })

    if (changedTasks.length === 0) {
        return { changedTaskIds: [] }
    }

    const temporaryStartPosition = currentMinPosition - changedTasks.length - 1

    await prisma.$transaction([
        ...changedTasks.map((task, index) =>
            prisma.kanbanTask.update({
                where: { id: task.id },
                data: {
                    column: 'queued',
                    position: temporaryStartPosition + index,
                },
            })
        ),
        ...changedTasks.map((task) => {
            const nextPosition = nextPositionByTaskId.get(task.id)
            if (nextPosition === undefined) {
                throw new Error(`Missing next position for task ${task.id}`)
            }

            return prisma.kanbanTask.update({
                where: { id: task.id },
                data: {
                    column: 'queued',
                    position: nextPosition,
                },
            })
        }),
    ])

    return {
        changedTaskIds: changedTasks.map((task) => task.id),
    }
}

export async function listQueuedTasks(): Promise<KanbanTask[]> {
    return prisma.kanbanTask.findMany({
        where: { column: 'queued' },
        orderBy: [
            { position: 'asc' },
            { createdAt: 'asc' },
        ],
    })
}
