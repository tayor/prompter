import { NextRequest, NextResponse } from 'next/server'
import { createKanbanSchedule, listKanbanSchedules } from '@/lib/services/schedules-service'
import { createKanbanScheduleSchema, kanbanSchedulesQuerySchema } from '@/lib/validators'

// GET /api/schedules - List schedules with optional filters
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const query = kanbanSchedulesQuerySchema.parse({
            taskId: searchParams.get('taskId') || undefined,
            type: searchParams.get('type') || undefined,
            status: searchParams.get('status') || undefined,
            dueBefore: searchParams.get('dueBefore') || undefined,
            page: searchParams.get('page') || undefined,
            limit: searchParams.get('limit') || undefined,
        })
        const result = await listKanbanSchedules(query)

        return NextResponse.json(result)
    } catch (error) {
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid schedule query parameters', details: error },
                { status: 400 },
            )
        }
        console.error('Failed to fetch schedules:', error)
        return NextResponse.json({ error: 'Failed to fetch schedules' }, { status: 500 })
    }
}

// POST /api/schedules - Create a schedule
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const data = createKanbanScheduleSchema.parse(body)
        const schedule = await createKanbanSchedule(data)

        return NextResponse.json(schedule, { status: 201 })
    } catch (error) {
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid schedule data', details: error },
                { status: 400 },
            )
        }

        if (error instanceof Error && error.message.toLowerCase().includes('foreign key')) {
            return NextResponse.json(
                { error: 'Invalid taskId for schedule' },
                { status: 400 },
            )
        }

        console.error('Failed to create schedule:', error)
        return NextResponse.json({ error: 'Failed to create schedule' }, { status: 500 })
    }
}
