import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createWorkflowStepSchema, reorderStepsSchema } from '@/lib/validators'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/workflows/[id]/steps - List workflow steps
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        const steps = await prisma.workflowStep.findMany({
            where: { workflowId: id },
            orderBy: { order: 'asc' },
            include: {
                prompt: { select: { id: true, title: true, content: true, variables: true } },
            },
        })

        return NextResponse.json({ steps })
    } catch (error) {
        console.error('Failed to fetch steps:', error)
        return NextResponse.json({ error: 'Failed to fetch steps' }, { status: 500 })
    }
}

// POST /api/workflows/[id]/steps - Create new step
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const body = await request.json()
        const data = createWorkflowStepSchema.parse(body)

        // Get max order for auto-ordering
        const maxOrder = await prisma.workflowStep.aggregate({
            where: { workflowId: id },
            _max: { order: true },
        })

        const step = await prisma.workflowStep.create({
            data: {
                ...data,
                workflowId: id,
                order: data.order ?? (maxOrder._max.order ?? -1) + 1,
                inputMapping: data.inputMapping ? JSON.stringify(data.inputMapping) : null,
                condition: data.condition ? JSON.stringify(data.condition) : null,
            },
            include: {
                prompt: { select: { id: true, title: true, content: true } },
            },
        })

        return NextResponse.json(step, { status: 201 })
    } catch (error) {
        console.error('Failed to create step:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json({ error: 'Invalid step data' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Failed to create step' }, { status: 500 })
    }
}

// PATCH /api/workflows/[id]/steps - Reorder steps
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const body = await request.json()
        const { steps } = reorderStepsSchema.parse(body)

        const workflow = await prisma.workflow.findUnique({
            where: { id },
            select: {
                steps: {
                    select: { id: true },
                },
            },
        })

        if (!workflow) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
        }

        if (steps.length !== workflow.steps.length) {
            return NextResponse.json(
                { error: 'Reorder payload must include every workflow step' },
                { status: 400 }
            )
        }

        const workflowStepIds = new Set(workflow.steps.map((step) => step.id))
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
            seenOrders.add(step.order)
            seenIds.add(step.id)
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

        const updatedSteps = await prisma.workflowStep.findMany({
            where: { workflowId: id },
            orderBy: { order: 'asc' },
            include: {
                prompt: { select: { id: true, title: true, content: true } },
            },
        })

        return NextResponse.json({ steps: updatedSteps })
    } catch (error) {
        console.error('Failed to reorder steps:', error)
        return NextResponse.json({ error: 'Failed to reorder steps' }, { status: 500 })
    }
}
