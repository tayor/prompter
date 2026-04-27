import { NextRequest, NextResponse } from 'next/server'
import {
    deleteKanbanSchedule,
    getKanbanScheduleById,
    updateKanbanSchedule,
} from '@/lib/services/schedules-service'
import { kanbanScheduleParamsSchema, updateKanbanScheduleSchema } from '@/lib/validators'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/schedules/[id] - Get a single schedule
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = kanbanScheduleParamsSchema.parse(await params)
        const schedule = await getKanbanScheduleById(id)

        if (!schedule) {
            return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
        }

        return NextResponse.json(schedule)
    } catch (error) {
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid schedule id', details: error },
                { status: 400 },
            )
        }
        console.error('Failed to fetch schedule:', error)
        return NextResponse.json({ error: 'Failed to fetch schedule' }, { status: 500 })
    }
}

// PATCH /api/schedules/[id] - Update schedule fields
export async function PATCH(request: Request, { params }: RouteParams) {
    try {
        const { id } = kanbanScheduleParamsSchema.parse(await params)
        const body = await request.json()
        const data = updateKanbanScheduleSchema.parse(body)
        const schedule = await updateKanbanSchedule(id, data)

        if (!schedule) {
            return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
        }

        return NextResponse.json(schedule)
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

        console.error('Failed to update schedule:', error)
        return NextResponse.json({ error: 'Failed to update schedule' }, { status: 500 })
    }
}

// DELETE /api/schedules/[id] - Delete schedule
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = kanbanScheduleParamsSchema.parse(await params)
        const deleted = await deleteKanbanSchedule(id)
        if (!deleted) {
            return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid schedule id', details: error },
                { status: 400 },
            )
        }
        console.error('Failed to delete schedule:', error)
        return NextResponse.json({ error: 'Failed to delete schedule' }, { status: 500 })
    }
}
