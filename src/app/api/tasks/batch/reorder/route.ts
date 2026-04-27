import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { serializeKanbanTask } from '@/lib/services/tasks-service'
import { reorderKanbanColumnSchema } from '@/lib/validators'

// PATCH /api/tasks/batch/reorder - Reorder tasks within the queued column
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json()
        const data = reorderKanbanColumnSchema.parse(body)

        if (data.column !== 'queued') {
            return NextResponse.json(
                { error: 'Only the queued column supports manual reordering' },
                { status: 409 }
            )
        }

        const columnTasks = await prisma.kanbanTask.findMany({
            where: {
                column: data.column,
            },
            orderBy: [
                { position: 'asc' },
                { createdAt: 'asc' },
            ],
        })

        if (columnTasks.length !== data.tasks.length) {
            return NextResponse.json(
                { error: 'Reorder payload must include every task in the queued column' },
                { status: 400 }
            )
        }

        const taskIdsInColumn = new Set(columnTasks.map((task) => task.id))
        for (const task of data.tasks) {
            if (!taskIdsInColumn.has(task.id)) {
                return NextResponse.json(
                    { error: `Task ${task.id} is not in the queued column` },
                    { status: 400 }
                )
            }
        }

        const orderedPositions = data.tasks
            .map((task) => task.position)
            .sort((left, right) => left - right)

        for (let index = 0; index < orderedPositions.length; index += 1) {
            if (orderedPositions[index] !== index) {
                return NextResponse.json(
                    { error: 'Task positions must form a contiguous range starting at 0' },
                    { status: 400 }
                )
            }
        }

        const desiredOrder = [...data.tasks]
            .sort((left, right) => left.position - right.position)
            .map((task) => task.id)

        const nextPositionByTaskId = new Map<string, number>()
        desiredOrder.forEach((taskId, position) => {
            nextPositionByTaskId.set(taskId, position)
        })

        const changedTasks = columnTasks.filter((task) => {
            const nextPosition = nextPositionByTaskId.get(task.id)
            return nextPosition !== undefined && nextPosition !== task.position
        })

        if (changedTasks.length > 0) {
            const currentMinPosition = columnTasks.reduce(
                (minPosition, task) => Math.min(minPosition, task.position),
                0,
            )
            const temporaryStartPosition = currentMinPosition - changedTasks.length - 1

            await prisma.$transaction([
                ...changedTasks.map((task, index) =>
                    prisma.kanbanTask.update({
                        where: { id: task.id },
                        data: { position: temporaryStartPosition + index },
                    })
                ),
                ...changedTasks.map((task) => {
                    const nextPosition = nextPositionByTaskId.get(task.id)
                    if (nextPosition === undefined) {
                        throw new Error(`Missing next position for task ${task.id}`)
                    }

                    return prisma.kanbanTask.update({
                        where: { id: task.id },
                        data: { position: nextPosition },
                    })
                }),
            ])
        }

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
                    { position: 'asc' },
                    { createdAt: 'asc' },
                ],
            })

        return NextResponse.json({
            tasks: updatedTasks.map((task) => serializeKanbanTask(task)),
            meta: {
                column: data.column,
                requestedCount: data.tasks.length,
                reorderedCount: changedTasks.length,
                updatedCount: changedTasks.length,
            },
        })
    } catch (error) {
        console.error('Failed to batch reorder tasks:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid batch reorder payload', details: error },
                { status: 400 }
            )
        }
        return NextResponse.json({ error: 'Failed to reorder tasks' }, { status: 500 })
    }
}
