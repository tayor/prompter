import { NextRequest, NextResponse } from 'next/server'
import { ensureLocalhostRequest } from '@/lib/kanban/localhost-guard'
import { listKanbanExecutions } from '@/lib/services/execution-service'
import { kanbanExecutionsQuerySchema } from '@/lib/validators'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/executions - List execution history
export async function GET(request: NextRequest) {
    const localhostError = ensureLocalhostRequest(request)
    if (localhostError) {
        return localhostError
    }

    try {
        const { searchParams } = new URL(request.url)
        const query = kanbanExecutionsQuerySchema.parse({
            taskId: searchParams.get('taskId') || undefined,
            status: searchParams.get('status') || undefined,
            page: searchParams.get('page') || undefined,
            limit: searchParams.get('limit') || undefined,
            includePreview: searchParams.get('includePreview') || undefined,
        })
        const result = await listKanbanExecutions(query)

        return NextResponse.json(result)
    } catch (error) {
        console.error('Failed to fetch executions:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid execution query parameters', details: error },
                { status: 400 },
            )
        }
        return NextResponse.json({ error: 'Failed to fetch executions' }, { status: 500 })
    }
}
