import { NextRequest, NextResponse } from 'next/server'
import { kanbanExecutionControlService } from '@/lib/kanban/execution-control-service'
import { kanbanExecutionEngine } from '@/lib/kanban/execution-engine'
import { ensureLocalhostRequest } from '@/lib/kanban/localhost-guard'
import { DEFAULT_TERMINATION_GRACE_SECONDS } from '@/lib/kanban/types'
import prisma from '@/lib/prisma'
import { cancelKanbanExecutionSchema } from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function readRequestBody(request: NextRequest): Promise<unknown> {
    try {
        return await request.json()
    } catch {
        return {}
    }
}

// POST /api/execution/cancel - Cancel currently running task process
export async function POST(request: NextRequest) {
    const localhostError = ensureLocalhostRequest(request)
    if (localhostError) {
        return localhostError
    }

    try {
        const body = await readRequestBody(request)
        const data = cancelKanbanExecutionSchema.parse(body)

        const runningExecution = await prisma.kanbanExecution.findFirst({
            where: { status: 'running' },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                taskId: true,
            },
        })

        if (!runningExecution && (data.executionId || data.taskId)) {
            return NextResponse.json(
                { error: 'No running execution matches the provided identifiers' },
                { status: 409 }
            )
        }

        if (runningExecution && data.executionId && data.executionId !== runningExecution.id) {
            return NextResponse.json(
                { error: 'executionId does not match the current running execution' },
                { status: 409 }
            )
        }

        if (runningExecution && data.taskId && data.taskId !== runningExecution.taskId) {
            return NextResponse.json(
                { error: 'taskId does not match the current running task' },
                { status: 409 }
            )
        }

        const gracePeriodSeconds = data.signal === 'SIGKILL' ? 0 : DEFAULT_TERMINATION_GRACE_SECONDS
        const cancellation = await kanbanExecutionEngine.cancelRunningExecution(gracePeriodSeconds)

        return NextResponse.json({
            ...cancellation,
            signal: data.signal,
            executionId: runningExecution?.id ?? null,
            taskId: runningExecution?.taskId ?? null,
            engineStatus: kanbanExecutionControlService.getStatus(Boolean(kanbanExecutionEngine.getRunningProcess())),
        })
    } catch (error) {
        console.error('Failed to cancel execution:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid execution cancel payload', details: error },
                { status: 400 }
            )
        }
        return NextResponse.json({ error: 'Failed to cancel execution' }, { status: 500 })
    }
}
