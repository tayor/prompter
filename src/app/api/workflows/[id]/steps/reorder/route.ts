import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { reorderStepsSchema } from '@/lib/validators'

interface RouteParams {
    params: Promise<{ id: string }>
}

// PUT /api/workflows/[id]/steps/reorder - Reorder steps
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const body = await request.json()
        const { steps } = reorderStepsSchema.parse(body)

        // Check workflow exists
        const workflow = await prisma.workflow.findUnique({
            where: { id },
            select: {
                id: true,
                steps: {
                    select: { id: true },
                },
            },
        })

        if (!workflow) {
            return NextResponse.json(
                { error: 'Workflow not found' },
                { status: 404 }
            )
        }

        if (steps.length !== workflow.steps.length) {
            return NextResponse.json(
                { error: 'Reorder payload must include every workflow step' },
                { status: 400 }
            )
        }

        const workflowStepIds = new Set(workflow.steps.map((s) => s.id))
        const seenIds = new Set<string>()
        const seenOrders = new Set<number>()

        for (const step of steps) {
            if (seenIds.has(step.id)) {
                return NextResponse.json(
                    { error: `Duplicate step ID in payload: ${step.id}` },
                    { status: 400 }
                )
            }

            if (!workflowStepIds.has(step.id)) {
                return NextResponse.json(
                    { error: `Step ${step.id} does not belong to this workflow` },
                    { status: 400 }
                )
            }

            if (seenOrders.has(step.order)) {
                return NextResponse.json(
                    { error: `Duplicate order value in payload: ${step.order}` },
                    { status: 400 }
                )
            }

            seenIds.add(step.id)
            seenOrders.add(step.order)
        }

        if (steps.length > 0) {
            await prisma.$transaction([
                ...steps.map((step, index) =>
                    prisma.workflowStep.update({
                        where: { id: step.id },
                        data: { order: -(index + 1) },
                    })
                ),
                ...steps.map((step) =>
                    prisma.workflowStep.update({
                        where: { id: step.id },
                        data: { order: step.order },
                    })
                ),
            ])
        }

        // Fetch updated workflow
        const updated = await prisma.workflow.findUnique({
            where: { id },
            include: {
                steps: { orderBy: { order: 'asc' } },
            },
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error('Failed to reorder steps:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid reorder data', details: error },
                { status: 400 }
            )
        }
        return NextResponse.json(
            { error: 'Failed to reorder steps' },
            { status: 500 }
        )
    }
}
