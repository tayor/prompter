import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { updateWorkflowStepSchema } from '@/lib/validators'

interface RouteParams {
    params: Promise<{ id: string; stepId: string }>
}

// GET /api/workflows/[id]/steps/[stepId]
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id, stepId } = await params

        const step = await prisma.workflowStep.findUnique({
            where: { id: stepId },
            include: {
                prompt: { select: { id: true, title: true, content: true, variables: true } },
            },
        })

        if (!step || step.workflowId !== id) {
            return NextResponse.json({ error: 'Step not found' }, { status: 404 })
        }

        return NextResponse.json(step)
    } catch (error) {
        console.error('Failed to fetch step:', error)
        return NextResponse.json({ error: 'Failed to fetch step' }, { status: 500 })
    }
}

// PUT /api/workflows/[id]/steps/[stepId]
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const { id, stepId } = await params
        const body = await request.json()
        const data = updateWorkflowStepSchema.parse(body)

        const existingStep = await prisma.workflowStep.findUnique({
            where: { id: stepId },
            select: { workflowId: true },
        })

        if (!existingStep || existingStep.workflowId !== id) {
            return NextResponse.json({ error: 'Step not found' }, { status: 404 })
        }

        const updateData: Record<string, unknown> = { ...data }
        if (data.inputMapping !== undefined) {
            updateData.inputMapping = data.inputMapping ? JSON.stringify(data.inputMapping) : null
        }
        if (data.condition !== undefined) {
            updateData.condition = data.condition ? JSON.stringify(data.condition) : null
        }

        const step = await prisma.workflowStep.update({
            where: { id: stepId },
            data: updateData,
            include: {
                prompt: { select: { id: true, title: true, content: true } },
            },
        })

        return NextResponse.json(step)
    } catch (error) {
        console.error('Failed to update step:', error)
        return NextResponse.json({ error: 'Failed to update step' }, { status: 500 })
    }
}

// DELETE /api/workflows/[id]/steps/[stepId]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id, stepId } = await params

        const existingStep = await prisma.workflowStep.findUnique({
            where: { id: stepId },
            select: { workflowId: true },
        })

        if (!existingStep || existingStep.workflowId !== id) {
            return NextResponse.json({ error: 'Step not found' }, { status: 404 })
        }

        await prisma.workflowStep.delete({ where: { id: stepId } })

        // Re-order remaining steps
        const remainingSteps = await prisma.workflowStep.findMany({
            where: { workflowId: id },
            orderBy: { order: 'asc' },
        })

        await prisma.$transaction(
            remainingSteps.map((step, index) =>
                prisma.workflowStep.update({
                    where: { id: step.id },
                    data: { order: index },
                })
            )
        )

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete step:', error)
        return NextResponse.json({ error: 'Failed to delete step' }, { status: 500 })
    }
}
