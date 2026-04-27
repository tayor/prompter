import { NextResponse } from 'next/server'
import { resumeKanbanSchedule } from '@/lib/services/schedules-service'
import { kanbanScheduleParamsSchema } from '@/lib/validators'

interface RouteParams {
    params: Promise<{ id: string }>
}

// POST /api/schedules/[id]/resume - Resume a paused schedule
export async function POST(request: Request, { params }: RouteParams) {
    try {
        const { id } = kanbanScheduleParamsSchema.parse(await params)
        const schedule = await resumeKanbanSchedule(id)
        if (!schedule) {
            return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
        }

        return NextResponse.json(schedule)
    } catch (error) {
        console.error('Failed to resume schedule:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid schedule id', details: error },
                { status: 400 },
            )
        }
        return NextResponse.json({ error: 'Failed to resume schedule' }, { status: 500 })
    }
}
