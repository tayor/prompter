import type { Prisma } from '@prisma/client'
import { computeNextCronOccurrence } from '@/lib/kanban/scheduler-runtime'
import prisma from '@/lib/prisma'
import {
    createKanbanScheduleSchema,
    type CreateKanbanScheduleInput,
    type KanbanSchedulesQueryInput,
    type UpdateKanbanScheduleInput,
} from '@/lib/validators'

const KANBAN_SCHEDULE_INCLUDE = {
    task: {
        select: {
            id: true,
            name: true,
            displayName: true,
            column: true,
        },
    },
} satisfies Prisma.KanbanScheduleInclude

type KanbanScheduleWithTask = Prisma.KanbanScheduleGetPayload<{ include: typeof KANBAN_SCHEDULE_INCLUDE }>

interface NextRunAtComputationInput {
    type: CreateKanbanScheduleInput['type']
    timezone: string
    runAt?: Date
    cronExpression?: string
    nextRunAt?: Date
}

export function buildKanbanScheduleWhere(
    query: Pick<KanbanSchedulesQueryInput, 'taskId' | 'type' | 'status' | 'dueBefore'>,
): Prisma.KanbanScheduleWhereInput {
    const where: Prisma.KanbanScheduleWhereInput = {}

    if (query.taskId) {
        where.taskId = query.taskId
    }

    if (query.type) {
        where.type = query.type
    }

    if (query.status) {
        where.status = query.status
    }

    if (query.dueBefore) {
        where.OR = [
            { nextRunAt: { lte: query.dueBefore } },
            {
                nextRunAt: null,
                runAt: { lte: query.dueBefore },
            },
        ]
    }

    return where
}

export async function listKanbanSchedules(query: KanbanSchedulesQueryInput) {
    const where = buildKanbanScheduleWhere(query)
    const skip = (query.page - 1) * query.limit

    const [total, schedules] = await prisma.$transaction([
        prisma.kanbanSchedule.count({ where }),
        prisma.kanbanSchedule.findMany({
            where,
            orderBy: [
                { nextRunAt: 'asc' },
                { runAt: 'asc' },
                { createdAt: 'asc' },
            ],
            skip,
            take: query.limit,
            include: KANBAN_SCHEDULE_INCLUDE,
        }),
    ])

    return {
        schedules,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(Math.ceil(total / query.limit), 1),
        },
    }
}

export async function createKanbanSchedule(data: CreateKanbanScheduleInput) {
    const computedNextRunAt = computeNextRunAtDefaults(data, new Date())

    return prisma.kanbanSchedule.create({
        data: {
            name: data.name ?? null,
            type: data.type,
            runAt: data.runAt ?? null,
            cronExpression: data.cronExpression ?? null,
            timezone: data.timezone,
            status: data.status,
            nextRunAt: data.nextRunAt ?? computedNextRunAt,
            allowConcurrentRuns: data.allowConcurrentRuns,
            skipIfTaskRunning: data.skipIfTaskRunning,
            catchUpMissedRuns: data.catchUpMissedRuns,
            taskId: data.taskId ?? null,
        },
        include: KANBAN_SCHEDULE_INCLUDE,
    })
}

export async function getKanbanScheduleById(id: string) {
    return prisma.kanbanSchedule.findUnique({
        where: { id },
        include: KANBAN_SCHEDULE_INCLUDE,
    })
}

export async function updateKanbanSchedule(id: string, data: UpdateKanbanScheduleInput) {
    const existing = await getKanbanScheduleById(id)
    if (!existing) {
        return null
    }

    const mergedSchedule = mergeScheduleForValidation(existing, data)
    const updateData: Prisma.KanbanScheduleUncheckedUpdateInput = {}

    if (data.name !== undefined) {
        updateData.name = data.name
    }
    if (data.type !== undefined) {
        updateData.type = data.type
    }
    if (data.runAt !== undefined) {
        updateData.runAt = data.runAt
    }
    if (data.cronExpression !== undefined) {
        updateData.cronExpression = data.cronExpression
    }
    if (data.timezone !== undefined) {
        updateData.timezone = data.timezone
    }
    if (data.status !== undefined) {
        updateData.status = data.status
    }
    if (data.lastRunAt !== undefined) {
        updateData.lastRunAt = data.lastRunAt
    }
    if (data.taskId !== undefined) {
        updateData.taskId = data.taskId
    }
    if (data.allowConcurrentRuns !== undefined) {
        updateData.allowConcurrentRuns = data.allowConcurrentRuns
    }
    if (data.skipIfTaskRunning !== undefined) {
        updateData.skipIfTaskRunning = data.skipIfTaskRunning
    }
    if (data.catchUpMissedRuns !== undefined) {
        updateData.catchUpMissedRuns = data.catchUpMissedRuns
    }

    if (data.nextRunAt !== undefined) {
        updateData.nextRunAt = data.nextRunAt
    } else if (shouldRecomputeNextRunAt(data)) {
        updateData.nextRunAt = computeNextRunAtDefaults(mergedSchedule, new Date())
    }

    return prisma.kanbanSchedule.update({
        where: { id },
        data: updateData,
        include: KANBAN_SCHEDULE_INCLUDE,
    })
}

export async function deleteKanbanSchedule(id: string): Promise<boolean> {
    const existing = await prisma.kanbanSchedule.findUnique({
        where: { id },
        select: { id: true },
    })

    if (!existing) {
        return false
    }

    await prisma.kanbanSchedule.delete({
        where: { id },
    })

    return true
}

export async function pauseKanbanSchedule(id: string) {
    const existing = await prisma.kanbanSchedule.findUnique({
        where: { id },
        select: { id: true },
    })
    if (!existing) {
        return null
    }

    return prisma.kanbanSchedule.update({
        where: { id },
        data: { status: 'paused' },
        include: KANBAN_SCHEDULE_INCLUDE,
    })
}

export async function resumeKanbanSchedule(id: string, resumedAt = new Date()) {
    const existing = await getKanbanScheduleById(id)
    if (!existing) {
        return null
    }

    const nextRunAt = existing.nextRunAt
        ?? (existing.type === 'one_time'
            ? (existing.lastRunAt ? null : existing.runAt)
            : (existing.cronExpression
                ? computeNextCronOccurrence(existing.cronExpression, resumedAt, existing.timezone)
                : null))

    return prisma.kanbanSchedule.update({
        where: { id },
        data: {
            status: 'active',
            nextRunAt,
        },
        include: KANBAN_SCHEDULE_INCLUDE,
    })
}

export async function markKanbanScheduleRunNow(id: string, runNowAt: Date) {
    const existing = await prisma.kanbanSchedule.findUnique({
        where: { id },
        select: { id: true },
    })
    if (!existing) {
        return null
    }

    return prisma.kanbanSchedule.update({
        where: { id },
        data: {
            status: 'active',
            nextRunAt: runNowAt,
        },
        include: KANBAN_SCHEDULE_INCLUDE,
    })
}

function mergeScheduleForValidation(
    existing: KanbanScheduleWithTask,
    update: UpdateKanbanScheduleInput,
): CreateKanbanScheduleInput {
    return createKanbanScheduleSchema.parse({
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
}

function shouldRecomputeNextRunAt(update: UpdateKanbanScheduleInput): boolean {
    return update.type !== undefined
        || update.runAt !== undefined
        || update.cronExpression !== undefined
}

function computeNextRunAtDefaults(input: NextRunAtComputationInput, now: Date): Date | null {
    if (input.nextRunAt) {
        return input.nextRunAt
    }

    if (input.type === 'one_time') {
        return input.runAt ?? null
    }

    if (!input.cronExpression) {
        return null
    }

    return computeNextCronOccurrence(input.cronExpression, now, input.timezone)
}
