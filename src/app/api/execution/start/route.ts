import { NextRequest, NextResponse } from 'next/server'
import { kanbanExecutionControlService } from '@/lib/kanban/execution-control-service'
import { kanbanExecutionEngine } from '@/lib/kanban/execution-engine'
import { ensureLocalhostRequest } from '@/lib/kanban/localhost-guard'
import { startKanbanExecutionSchema } from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function readRequestBody(request: NextRequest): Promise<unknown> {
    try {
        return await request.json()
    } catch {
        return {}
    }
}

// POST /api/execution/start - Start execution engine and optionally run next queued task
export async function POST(request: NextRequest) {
    const localhostError = ensureLocalhostRequest(request)
    if (localhostError) {
        return localhostError
    }

    try {
        const body = await readRequestBody(request)
        const data = startKanbanExecutionSchema.parse(body)

        if (data.taskId) {
            return NextResponse.json(
                { error: 'taskId-targeted starts are not supported by the current execution engine' },
                { status: 400 }
            )
        }

        kanbanExecutionControlService.markStarted()

        if (!data.startIfIdle) {
            return NextResponse.json({
                status: kanbanExecutionControlService.getStatus(Boolean(kanbanExecutionEngine.getRunningProcess())),
                message: 'Execution engine started without triggering an immediate run',
            })
        }

        const result = await kanbanExecutionEngine.executeNextTask(data.trigger)

        return NextResponse.json(
            {
                ...result,
                engineStatus: kanbanExecutionControlService.getStatus(Boolean(kanbanExecutionEngine.getRunningProcess())),
            },
            { status: result.state === 'busy' ? 409 : 200 }
        )
    } catch (error) {
        console.error('Failed to start execution:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid execution start payload', details: error },
                { status: 400 }
            )
        }
        return NextResponse.json({ error: 'Failed to start execution' }, { status: 500 })
    }
}
