import { NextResponse } from 'next/server'
import { createWorkflowFromTemplate, listWorkflowTemplates } from '@/lib/services/templates-service'

// GET /api/templates - Get workflow templates
export async function GET() {
    try {
        const templates = await listWorkflowTemplates()

        return NextResponse.json({ templates })
    } catch (error) {
        console.error('Failed to fetch templates:', error)
        return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 })
    }
}

// POST /api/templates - Create workflow from template
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { templateId, name } = body

        if (!templateId) {
            return NextResponse.json({ error: 'Template ID required' }, { status: 400 })
        }

        const workflow = await createWorkflowFromTemplate(templateId, name)
        if (!workflow) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 })
        }

        return NextResponse.json(workflow, { status: 201 })
    } catch (error) {
        console.error('Failed to create from template:', error)
        return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 })
    }
}
