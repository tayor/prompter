import { NextRequest, NextResponse } from 'next/server'
import { kanbanExecutionControlService } from '@/lib/kanban/execution-control-service'
import { kanbanExecutionEngine } from '@/lib/kanban/execution-engine'
import { ensureLocalhostRequest } from '@/lib/kanban/localhost-guard'
import { getExecutionLogPreview } from '@/lib/kanban/log-storage'
import prisma from '@/lib/prisma'
import { kanbanExecutionStatusQuerySchema } from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/execution/status - Report engine/process status with optional queue/history detail
export async function GET(request: NextRequest) {
    const localhostError = ensureLocalhostRequest(request)
    if (localhostError) {
        return localhostError
    }

    try {
        const { searchParams } = new URL(request.url)
        const query = kanbanExecutionStatusQuerySchema.parse({
            includeQueue: searchParams.get('includeQueue') ?? undefined,
            includeHistory: searchParams.get('includeHistory') ?? undefined,
            includeLogs: searchParams.get('includeLogs') ?? undefined,
        })

        const runningProcess = kanbanExecutionEngine.getRunningProcess()
        const [runningExecution, queuedTasks, executionHistory, runningCount] = await Promise.all([
            prisma.kanbanExecution.findFirst({
                where: { status: 'running' },
                orderBy: { createdAt: 'desc' },
                include: {
                    task: {
                        select: {
                            id: true,
                            name: true,
                            column: true,
                            position: true,
                        },
                    },
                },
            }),
            query.includeQueue
                ? prisma.kanbanTask.findMany({
                    where: { column: 'queued' },
                    orderBy: [
                        { position: 'asc' },
                        { createdAt: 'asc' },
                    ],
                    select: {
                        id: true,
                        name: true,
                        position: true,
                        column: true,
                    },
                })
                : Promise.resolve(null),
            query.includeHistory
                ? prisma.kanbanExecution.findMany({
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    include: {
                        task: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                })
                : Promise.resolve(null),
            prisma.kanbanExecution.count({
                where: { status: 'running' },
            }),
        ])

        const runningLogPreview = query.includeLogs && runningExecution?.logFile
            ? await getExecutionLogPreview(runningExecution.logFile, { lines: 20 })
            : null

        return NextResponse.json({
            status: kanbanExecutionControlService.getStatus(Boolean(runningProcess)),
            stopped: kanbanExecutionControlService.isStopped(),
            runningProcess,
            runningExecution,
            singleSlotInvariant: runningCount <= 1,
            ...(query.includeQueue ? { queue: queuedTasks ?? [] } : {}),
            ...(query.includeHistory ? { history: executionHistory ?? [] } : {}),
            ...(query.includeLogs
                ? {
                    logs: {
                        available: true,
                        eventStreamUrl: '/api/executions/events',
                        runningExecutionLogUrl: runningExecution?.id ? `/api/executions/${runningExecution.id}/log` : null,
                        runningExecutionPreview: runningLogPreview,
                    },
                }
                : {}),
        })
    } catch (error) {
        console.error('Failed to fetch execution status:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid execution status query', details: error },
                { status: 400 }
            )
        }
        return NextResponse.json({ error: 'Failed to fetch execution status' }, { status: 500 })
    }
}
