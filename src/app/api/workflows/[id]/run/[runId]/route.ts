import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface RouteParams {
    params: Promise<{ id: string; runId: string }>
}

// GET /api/workflows/[id]/run/[runId] - Get specific run details
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id, runId } = await params

        const run = await prisma.workflowRun.findFirst({
            where: { id: runId, workflowId: id },
            include: {
                stepRuns: { orderBy: { stepOrder: 'asc' } },
                workflow: {
                    include: { steps: { orderBy: { order: 'asc' } } },
                },
            },
        })

        if (!run) {
            return NextResponse.json({ error: 'Run not found' }, { status: 404 })
        }

        return NextResponse.json(run)
    } catch (error) {
        console.error('Failed to fetch run:', error)
        return NextResponse.json({ error: 'Failed to fetch run' }, { status: 500 })
    }
}

// PATCH /api/workflows/[id]/run/[runId] - Update run (complete step, cancel, etc)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { id, runId } = await params
        const body = await request.json()

        const run = await prisma.workflowRun.findFirst({
            where: { id: runId, workflowId: id },
            include: {
                stepRuns: { orderBy: { stepOrder: 'asc' } },
                workflow: { include: { steps: { orderBy: { order: 'asc' } } } },
            },
        })

        if (!run) {
            return NextResponse.json({ error: 'Run not found' }, { status: 404 })
        }

        // Handle step completion
        if (body.completeStep !== undefined) {
            const stepOrder = body.completeStep
            const stepOutput = body.output

            // Update current step run
            await prisma.workflowStepRun.updateMany({
                where: { runId, stepOrder },
                data: {
                    status: 'completed',
                    output: stepOutput,
                    completedAt: new Date(),
                },
            })

            // Check if there's a next step
            const nextStepOrder = stepOrder + 1
            const hasNextStep = run.workflow.steps.some((s) => s.order === nextStepOrder)

            if (hasNextStep) {
                // Move to next step
                await prisma.workflowStepRun.updateMany({
                    where: { runId, stepOrder: nextStepOrder },
                    data: { status: 'running', startedAt: new Date() },
                })

                await prisma.workflowRun.update({
                    where: { id: runId },
                    data: { currentStep: nextStepOrder },
                })
            } else {
                // Complete the run
                const outputs = run.stepRuns.map((sr) => ({
                    step: sr.stepOrder,
                    name: sr.stepName,
                    output: sr.stepOrder === stepOrder ? stepOutput : sr.output,
                }))

                await prisma.workflowRun.update({
                    where: { id: runId },
                    data: {
                        status: 'completed',
                        completedAt: new Date(),
                        outputs: JSON.stringify(outputs),
                    },
                })
            }
        }

        // Handle cancellation
        if (body.cancel) {
            await prisma.workflowRun.update({
                where: { id: runId },
                data: { status: 'cancelled', completedAt: new Date() },
            })

            await prisma.workflowStepRun.updateMany({
                where: { runId, status: { in: ['pending', 'running'] } },
                data: { status: 'skipped' },
            })
        }

        // Fetch updated run
        const updatedRun = await prisma.workflowRun.findFirst({
            where: { id: runId, workflowId: id },
            include: {
                stepRuns: { orderBy: { stepOrder: 'asc' } },
                workflow: { include: { steps: { orderBy: { order: 'asc' } } } },
            },
        })

        return NextResponse.json(updatedRun)
    } catch (error) {
        console.error('Failed to update run:', error)
        return NextResponse.json({ error: 'Failed to update run' }, { status: 500 })
    }
}
