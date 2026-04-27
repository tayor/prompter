import { NextRequest, NextResponse } from 'next/server'
import { kanbanExecutionControlService } from '@/lib/kanban/execution-control-service'
import { kanbanExecutionEngine } from '@/lib/kanban/execution-engine'
import { ensureLocalhostRequest } from '@/lib/kanban/localhost-guard'
import { stopKanbanExecutionSchema } from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function readRequestBody(request: NextRequest): Promise<unknown> {
    try {
        return await request.json()
    } catch {
        return {}
    }
}

// POST /api/execution/stop - Stop engine scheduling; optionally force-cancel active process
export async function POST(request: NextRequest) {
    const localhostError = ensureLocalhostRequest(request)
    if (localhostError) {
        return localhostError
    }

    try {
        const body = await readRequestBody(request)
        const data = stopKanbanExecutionSchema.parse(body)

        const runningProcess = kanbanExecutionEngine.getRunningProcess()
        kanbanExecutionControlService.markStopped()

        const cancellation = data.graceful
            ? null
            : await kanbanExecutionEngine.cancelRunningExecution(0)

        return NextResponse.json({
            status: kanbanExecutionControlService.getStatus(Boolean(kanbanExecutionEngine.getRunningProcess())),
            stopped: true,
            graceful: data.graceful,
            reason: data.reason ?? null,
            runningProcess,
            cancellation,
        })
    } catch (error) {
        console.error('Failed to stop execution engine:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid execution stop payload', details: error },
                { status: 400 }
            )
        }
        return NextResponse.json({ error: 'Failed to stop execution engine' }, { status: 500 })
    }
}
