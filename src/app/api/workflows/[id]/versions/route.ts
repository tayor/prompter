import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/workflows/[id]/versions - List all versions for a workflow
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        // Check if workflow exists
        const workflow = await prisma.workflow.findUnique({ where: { id } })
        if (!workflow) {
            return NextResponse.json(
                { error: 'Workflow not found' },
                { status: 404 }
            )
        }

        const versions = await prisma.workflowVersion.findMany({
            where: { workflowId: id },
            orderBy: { version: 'desc' },
        })

        return NextResponse.json(versions)
    } catch (error) {
        console.error('Failed to fetch workflow versions:', error)
        return NextResponse.json(
            { error: 'Failed to fetch workflow versions' },
            { status: 500 }
        )
    }
}

// POST /api/workflows/[id]/versions - Create a new version (snapshot)
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const body = await request.json()
        const { changeNote } = body

        // Get current workflow with steps
        const workflow = await prisma.workflow.findUnique({
            where: { id },
            include: {
                steps: {
                    orderBy: { order: 'asc' },
                },
            },
        })

        if (!workflow) {
            return NextResponse.json(
                { error: 'Workflow not found' },
                { status: 404 }
            )
        }

        // Get latest version number
        const latestVersion = await prisma.workflowVersion.findFirst({
            where: { workflowId: id },
            orderBy: { version: 'desc' },
        })

        // Create snapshot of workflow + steps
        const snapshot = {
            name: workflow.name,
            description: workflow.description,
            icon: workflow.icon,
            color: workflow.color,
            inputSchema: workflow.inputSchema,
            steps: workflow.steps.map(step => ({
                name: step.name,
                description: step.description,
                order: step.order,
                promptId: step.promptId,
                inlineContent: step.inlineContent,
                inputMapping: step.inputMapping,
                outputVariable: step.outputVariable,
                isOptional: step.isOptional,
                condition: step.condition,
                aiModelOverride: step.aiModelOverride,
                notes: step.notes,
                estimatedTokens: step.estimatedTokens,
                nextStepOnSuccess: step.nextStepOnSuccess,
                nextStepOnFailure: step.nextStepOnFailure,
            })),
        }

        // Create new version
        const version = await prisma.workflowVersion.create({
            data: {
                workflowId: id,
                version: (latestVersion?.version ?? 0) + 1,
                snapshot: JSON.stringify(snapshot),
                changeNote: changeNote ?? 'Manual snapshot',
            },
        })

        return NextResponse.json(version, { status: 201 })
    } catch (error) {
        console.error('Failed to create workflow version:', error)
        return NextResponse.json(
            { error: 'Failed to create workflow version' },
            { status: 500 }
        )
    }
}
