import { NextRequest, NextResponse } from 'next/server'
import { deleteKanbanTask, getKanbanTaskById, serializeKanbanTask, updateKanbanTask } from '@/lib/services/tasks-service'
import { kanbanTaskParamsSchema, updateKanbanTaskSchema } from '@/lib/validators'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/tasks/[id] - Get a single task
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = kanbanTaskParamsSchema.parse(await params)
        const task = await getKanbanTaskById(id)

        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        return NextResponse.json(serializeKanbanTask(task))
    } catch (error) {
        console.error('Failed to fetch task:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid task id', details: error },
                { status: 400 }
            )
        }
        return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 })
    }
}

// PATCH /api/tasks/[id] - Update task fields/config/dependencies
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = kanbanTaskParamsSchema.parse(await params)
        const body = await request.json()
        const data = updateKanbanTaskSchema.parse(body)
        const task = await updateKanbanTask(id, data)
        if (!task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        return NextResponse.json(serializeKanbanTask(task))
    } catch (error) {
        console.error('Failed to update task:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid task data', details: error },
                { status: 400 }
            )
        }
        return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })
    }
}

// DELETE /api/tasks/[id] - Delete task
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = kanbanTaskParamsSchema.parse(await params)
        const deleted = await deleteKanbanTask(id)
        if (!deleted) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete task:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid task id', details: error },
                { status: 400 }
            )
        }
        return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })
    }
}
