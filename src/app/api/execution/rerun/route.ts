import { NextRequest, NextResponse } from 'next/server'
import { kanbanExecutionControlService } from '@/lib/kanban/execution-control-service'
import { kanbanExecutionEngine } from '@/lib/kanban/execution-engine'
import { ensureLocalhostRequest } from '@/lib/kanban/localhost-guard'
import { parseTaskConfig, requeueTask, serializeKanbanTask } from '@/lib/kanban/queue-operations'
import prisma from '@/lib/prisma'
import { kanbanTaskConfigSchema, retryKanbanExecutionSchema } from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function readRequestBody(request: NextRequest): Promise<unknown> {
    try {
        return await request.json()
    } catch {
        return {}
    }
}

// POST /api/execution/rerun - Requeue a completed task for another run
export async function POST(request: NextRequest) {
    const localhostError = ensureLocalhostRequest(request)
    if (localhostError) {
        return localhostError
    }

    try {
        const body = await readRequestBody(request)
        const data = retryKanbanExecutionSchema.parse(body)

        const task = await prisma.kanbanTask.findUnique({
            where: { id: data.taskId },
            select: {
                id: true,
                column: true,
                config: true,
            },
        })

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        if (task.column !== 'completed') {
            return NextResponse.json(
                { error: 'Rerun is only available for completed tasks' },
                { status: 409 },
            )
        }

        const parsedConfig = parseTaskConfig(task.config)
        const configValidation = kanbanTaskConfigSchema.safeParse(parsedConfig)
        if (!configValidation.success) {
            return NextResponse.json(
                { error: 'Task config is invalid for queueing' },
                { status: 400 },
            )
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
                return NextResponse.json(
                    { error: 'Rerun source execution does not match this task' },
                    { status: 409 },
                )
            }

            if (sourceExecution.status !== 'completed') {
                return NextResponse.json(
                    { error: 'Rerun source execution must be completed' },
                    { status: 409 },
                )
            }
        }

        const queueUpdate = await requeueTask(task.id, data.toFrontOfQueue)
        const updatedTask = await prisma.kanbanTask.findUnique({
            where: { id: task.id },
        })

        if (!updatedTask) {
            return NextResponse.json({ error: 'Task not found after rerun update' }, { status: 404 })
        }

        return NextResponse.json({
            task: serializeKanbanTask(updatedTask),
            queuePosition: queueUpdate.position,
            engineStatus: kanbanExecutionControlService.getStatus(Boolean(kanbanExecutionEngine.getRunningProcess())),
        })
    } catch (error) {
        console.error('Failed to rerun execution:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid execution rerun payload', details: error },
                { status: 400 },
            )
        }
        return NextResponse.json({ error: 'Failed to rerun execution' }, { status: 500 })
    }
}
