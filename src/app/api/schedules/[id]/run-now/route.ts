import { NextRequest, NextResponse } from 'next/server'
import { ensureLocalhostRequest } from '@/lib/kanban/localhost-guard'
import { kanbanSchedulerRuntimeService } from '@/lib/kanban/scheduler-runtime'
import { getKanbanScheduleById, markKanbanScheduleRunNow } from '@/lib/services/schedules-service'
import { controlKanbanScheduleSchema, kanbanScheduleParamsSchema } from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteParams {
    params: Promise<{ id: string }>
}

async function readRequestBody(request: NextRequest): Promise<unknown> {
    try {
        return await request.json()
    } catch {
        return {}
    }
}

// POST /api/schedules/[id]/run-now - Force a schedule to run immediately
export async function POST(request: NextRequest, { params }: RouteParams) {
    const localhostError = ensureLocalhostRequest(request)
    if (localhostError) {
        return localhostError
    }

    try {
        const { id } = kanbanScheduleParamsSchema.parse(await params)
        const body = await readRequestBody(request)
        const payload = typeof body === 'object' && body !== null
            ? body as Record<string, unknown>
            : {}
        const control = controlKanbanScheduleSchema.parse({
            action: 'run-now',
            at: payload.at,
        })

        const schedule = await markKanbanScheduleRunNow(id, control.at ?? new Date())
        if (!schedule) {
            return NextResponse.json({ error: 'Schedule not found' }, { status: 404 })
        }

        const summary = await kanbanSchedulerRuntimeService.dispatchDueSchedules({
            trigger: 'manual',
            limit: 1,
            scheduleIds: [id],
        })
        const refreshedSchedule = await getKanbanScheduleById(id)

        return NextResponse.json({
            schedule: refreshedSchedule ?? schedule,
            summary,
        })
    } catch (error) {
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid schedule run-now payload', details: error },
                { status: 400 },
            )
        }
        console.error('Failed to run schedule now:', error)
        return NextResponse.json({ error: 'Failed to run schedule now' }, { status: 500 })
    }
}
