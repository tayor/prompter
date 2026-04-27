import { NextRequest, NextResponse } from 'next/server'
import { createWorkflowSchema } from '@/lib/validators'
import { createWorkflow, listWorkflows, parseWorkflowListQuery } from '@/lib/services/workflows-service'

// GET /api/workflows - List all workflows with filters
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const query = parseWorkflowListQuery(searchParams)
        const result = await listWorkflows(query)

        return NextResponse.json(result)
    } catch (error) {
        console.error('Failed to fetch workflows:', error)
        return NextResponse.json({ error: 'Failed to fetch workflows' }, { status: 500 })
    }
}

// POST /api/workflows - Create new workflow
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const data = createWorkflowSchema.parse(body)
        const workflow = await createWorkflow(data)

        return NextResponse.json(workflow, { status: 201 })
    } catch (error) {
        console.error('Failed to create workflow:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json({ error: 'Invalid workflow data' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 })
    }
}
