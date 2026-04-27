import { NextRequest, NextResponse } from 'next/server'
import { createKanbanTask, listKanbanTasks, serializeKanbanTask } from '@/lib/services/tasks-service'
import { createKanbanTaskSchema, kanbanTasksQuerySchema } from '@/lib/validators'

// GET /api/tasks - List tasks with optional column/search filters
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const query = kanbanTasksQuerySchema.parse({
            column: searchParams.get('column') || undefined,
            q: searchParams.get('q') || undefined,
        })
        const tasks = await listKanbanTasks(query)

        return NextResponse.json({
            tasks: tasks.map((task) => serializeKanbanTask(task)),
        })
    } catch (error) {
        console.error('Failed to fetch tasks:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid task query parameters', details: error },
                { status: 400 }
            )
        }
        return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })
    }
}

// POST /api/tasks - Create a new kanban task
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const data = createKanbanTaskSchema.parse(body)
        const hasPosition = typeof body === 'object'
            && body !== null
            && Object.prototype.hasOwnProperty.call(body, 'position')

        const task = await createKanbanTask(data, hasPosition)

        return NextResponse.json(serializeKanbanTask(task), { status: 201 })
    } catch (error) {
        console.error('Failed to create task:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid task data', details: error },
                { status: 400 }
            )
        }
        return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })
    }
}
