import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import type {
    CreateKanbanTaskInput,
    KanbanTasksQueryInput,
    UpdateKanbanTaskInput,
} from '@/lib/validators'

export interface KanbanTaskWithJsonFields {
    config: string
    dependencies: string
}

export function parseJsonField<T>(value: string, fallback: T): T {
    try {
        return JSON.parse(value) as T
    } catch {
        return fallback
    }
}

export function serializeKanbanTask<T extends KanbanTaskWithJsonFields>(task: T) {
    return {
        ...task,
        config: parseJsonField<Record<string, unknown>>(task.config, {}),
        dependencies: parseJsonField<string[]>(task.dependencies, []),
    }
}

export function buildKanbanTaskWhere(
    query: Pick<KanbanTasksQueryInput, 'column' | 'q'>,
): Prisma.KanbanTaskWhereInput {
    const where: Prisma.KanbanTaskWhereInput = {}

    if (query.column) {
        where.column = query.column
    }

    if (query.q) {
        where.OR = [
            { name: { contains: query.q } },
            { displayName: { contains: query.q } },
            { description: { contains: query.q } },
            { sourcePath: { contains: query.q } },
        ]
    }

    return where
}

export async function listKanbanTasks(query: Pick<KanbanTasksQueryInput, 'column' | 'q'>) {
    const where = buildKanbanTaskWhere(query)

    return prisma.kanbanTask.findMany({
        where,
        orderBy: [
            { column: 'asc' },
            { position: 'asc' },
            { createdAt: 'asc' },
        ],
    })
}

export async function createKanbanTask(data: CreateKanbanTaskInput, hasPosition: boolean) {
    let position = data.position

    if (!hasPosition) {
        const lastTask = await prisma.kanbanTask.findFirst({
            where: { column: data.column },
            orderBy: { position: 'desc' },
            select: { position: true },
        })

        position = (lastTask?.position ?? -1) + 1
    }

    return prisma.kanbanTask.create({
        data: {
            name: data.name,
            displayName: data.displayName,
            description: data.description,
            sourcePath: data.sourcePath,
            sourceHash: data.sourceHash,
            column: data.column,
            position,
            config: JSON.stringify(data.config ?? {}),
            dependencies: JSON.stringify(data.dependencies),
        },
    })
}

export async function getKanbanTaskById(id: string) {
    return prisma.kanbanTask.findUnique({ where: { id } })
}

export async function updateKanbanTask(id: string, data: UpdateKanbanTaskInput) {
    const existing = await prisma.kanbanTask.findUnique({ where: { id } })
    if (!existing) {
        return null
    }

    const updateData: Record<string, unknown> = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.displayName !== undefined) updateData.displayName = data.displayName
    if (data.description !== undefined) updateData.description = data.description
    if (data.sourcePath !== undefined) updateData.sourcePath = data.sourcePath
    if (data.sourceHash !== undefined) updateData.sourceHash = data.sourceHash
    if (data.column !== undefined) updateData.column = data.column
    if (data.position !== undefined) updateData.position = data.position

    if (data.config !== undefined) {
        const existingConfig = parseJsonField<Record<string, unknown>>(existing.config, {})
        updateData.config = JSON.stringify({
            ...existingConfig,
            ...data.config,
        })
    }

    if (data.dependencies !== undefined) {
        updateData.dependencies = JSON.stringify(data.dependencies)
    }

    return prisma.kanbanTask.update({
        where: { id },
        data: updateData,
    })
}

export async function deleteKanbanTask(id: string): Promise<boolean> {
    const task = await prisma.kanbanTask.findUnique({
        where: { id },
        select: { id: true },
    })

    if (!task) {
        return false
    }

    await prisma.kanbanTask.delete({ where: { id } })
    return true
}
