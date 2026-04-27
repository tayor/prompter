import { NextRequest, NextResponse } from 'next/server'
import { ensureLocalhostRequest } from '@/lib/kanban/localhost-guard'
import { getKanbanExecutionById } from '@/lib/services/execution-service'
import { kanbanExecutionParamsSchema } from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/executions/[id] - Get execution details
export async function GET(request: NextRequest, { params }: RouteParams) {
    const localhostError = ensureLocalhostRequest(request)
    if (localhostError) {
        return localhostError
    }

    try {
        const { id } = kanbanExecutionParamsSchema.parse(await params)
        const includePreview = new URL(request.url).searchParams.get('includePreview') !== 'false'
        const execution = await getKanbanExecutionById(id, includePreview)

        if (!execution) {
            return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
        }

        return NextResponse.json(execution)
    } catch (error) {
        console.error('Failed to fetch execution:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid execution id', details: error },
                { status: 400 },
            )
        }
        return NextResponse.json({ error: 'Failed to fetch execution' }, { status: 500 })
    }
}
