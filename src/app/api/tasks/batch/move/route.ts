import type { KanbanColumn } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getLifecycleTransitionError, getQueueValidationError } from '@/lib/services/queue-service'
import { serializeKanbanTask } from '@/lib/services/tasks-service'
import { moveKanbanTasksSchema } from '@/lib/validators'

// PATCH /api/tasks/batch/move - Move multiple tasks between board columns
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json()
        const data = moveKanbanTasksSchema.parse(body)

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
                return NextResponse.json(
                    { error: `Task not found: ${taskId}` },
                    { status: 404 }
                )
            }
            orderedSelectedTasks.push(task)
        }

        if (data.fromColumn && orderedSelectedTasks.some((task) => task.column !== data.fromColumn)) {
            return NextResponse.json(
                { error: `One or more tasks are not in ${data.fromColumn}` },
                { status: 400 }
            )
        }

        for (const task of orderedSelectedTasks) {
            const transitionError = getLifecycleTransitionError(task.column, data.toColumn)
            if (transitionError) {
                return NextResponse.json(
                    { error: transitionError, taskId: task.id },
                    { status: 409 }
                )
            }
        }

        if (data.toColumn === 'queued') {
            for (const task of orderedSelectedTasks) {
                if (task.column === 'queued') {
                    continue
                }

                const queueValidationError = getQueueValidationError(task)
                if (queueValidationError) {
                    return NextResponse.json(
                        { error: queueValidationError, taskId: task.id },
                        { status: 400 }
                    )
                }
            }
        }

        const affectedColumns = Array.from(new Set<KanbanColumn>([
            data.toColumn,
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
            if (!selectedTaskIds.has(task.id)) {
                const bucket = tasksByColumn.get(task.column)
                if (bucket) {
                    bucket.push(task)
                }
            }
        }

        const targetTasks = tasksByColumn.get(data.toColumn) ?? []
        const insertionPosition = Math.min(
            Math.max(data.position ?? targetTasks.length, 0),
            targetTasks.length,
        )

        targetTasks.splice(insertionPosition, 0, ...orderedSelectedTasks)
        tasksByColumn.set(data.toColumn, targetTasks)

        const nextState = new Map<string, { column: KanbanColumn, position: number }>()
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

        return NextResponse.json({
            tasks: updatedTasks.map((task) => serializeKanbanTask(task)),
            meta: {
                requestedCount: orderedSelectedTasks.length,
                movedCount,
                updatedCount: changedTasks.length,
                affectedColumns,
            },
        })
    } catch (error) {
        console.error('Failed to batch move tasks:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid batch move payload', details: error },
                { status: 400 }
            )
        }
        return NextResponse.json({ error: 'Failed to move tasks' }, { status: 500 })
    }
}
