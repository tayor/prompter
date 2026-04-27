import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { updateWorkflowById } from '@/lib/services/workflows-service'
import { updateWorkflowSchema } from '@/lib/validators'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/workflows/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        const workflow = await prisma.workflow.findUnique({
            where: { id },
            include: {
                folder: true,
                tags: { include: { tag: true } },
                steps: {
                    orderBy: { order: 'asc' },
                    include: { prompt: { select: { id: true, title: true, content: true } } },
                },
                runs: {
                    orderBy: { startedAt: 'desc' },
                    take: 10,
                    include: {
                        stepRuns: { orderBy: { stepOrder: 'asc' } },
                    },
                },
                _count: { select: { steps: true, runs: true } },
            },
        })

        if (!workflow) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
        }

        return NextResponse.json(workflow)
    } catch (error) {
        console.error('Failed to fetch workflow:', error)
        return NextResponse.json({ error: 'Failed to fetch workflow' }, { status: 500 })
    }
}

// PUT /api/workflows/[id]
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const body = await request.json()
        const updated = await updateWorkflowById(id, updateWorkflowSchema.parse(body))
        if (!updated) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
        }

        return NextResponse.json(updated)
    } catch (error) {
        console.error('Failed to update workflow:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json({ error: 'Invalid workflow data' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Failed to update workflow' }, { status: 500 })
    }
}

// DELETE /api/workflows/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        await prisma.workflow.delete({ where: { id } })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete workflow:', error)
        return NextResponse.json({ error: 'Failed to delete workflow' }, { status: 500 })
    }
}
