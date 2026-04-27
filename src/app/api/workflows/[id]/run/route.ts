import { NextRequest, NextResponse } from 'next/server'
import { trackAnalyticsAction } from '@/lib/services/analytics-service'
import { listWorkflowRuns, startWorkflowRun } from '@/lib/services/workflows-service'

interface RouteParams {
    params: Promise<{ id: string }>
}

// POST /api/workflows/[id]/run - Start a new workflow run
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const body = await request.json()
        const fullRun = await startWorkflowRun(id, body.inputs)
        if (!fullRun) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
        }
        await trackAnalyticsAction('workflow', id, 'run')

        return NextResponse.json(fullRun, { status: 201 })
    } catch (error) {
        console.error('Failed to start workflow run:', error)
        return NextResponse.json({ error: 'Failed to start run' }, { status: 500 })
    }
}

// GET /api/workflows/[id]/run - Get runs for a workflow
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const runs = await listWorkflowRuns(id)

        return NextResponse.json({ runs })
    } catch (error) {
        console.error('Failed to fetch runs:', error)
        return NextResponse.json({ error: 'Failed to fetch runs' }, { status: 500 })
    }
}
