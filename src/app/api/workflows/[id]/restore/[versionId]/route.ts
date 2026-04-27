import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface RouteParams {
    params: Promise<{ id: string; versionId: string }>
}

interface WorkflowSnapshot {
    name: string
    description: string | null
    icon: string | null
    color: string | null
    inputSchema: string | null
    steps: Array<{
        name: string
        description: string | null
        order: number
        promptId: string | null
        inlineContent: string | null
        inputMapping: string | null
        outputVariable: string
        isOptional: boolean
        condition: string | null
        aiModelOverride: string | null
        notes: string | null
        estimatedTokens: number | null
        nextStepOnSuccess: string | null
        nextStepOnFailure: string | null
    }>
}

// POST /api/workflows/[id]/restore/[versionId] - Restore a workflow version
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id, versionId } = await params

        // Get the version to restore
        const version = await prisma.workflowVersion.findUnique({
            where: { id: versionId },
        })

        if (!version || version.workflowId !== id) {
            return NextResponse.json(
                { error: 'Version not found' },
                { status: 404 }
            )
        }

        // Check workflow exists
        const workflow = await prisma.workflow.findUnique({
            where: { id },
            include: { steps: true },
        })

        if (!workflow) {
            return NextResponse.json(
                { error: 'Workflow not found' },
                { status: 404 }
            )
        }

        // Parse snapshot
        let snapshot: WorkflowSnapshot
        try {
            snapshot = JSON.parse(version.snapshot) as WorkflowSnapshot
        } catch {
            return NextResponse.json(
                { error: 'Invalid workflow snapshot' },
                { status: 400 }
            )
        }

        const result = await prisma.$transaction(async (tx) => {
            // Get latest version number for creating backup
            const latestVersion = await tx.workflowVersion.findFirst({
                where: { workflowId: id },
                orderBy: { version: 'desc' },
            })

            // Create backup version before restoring
            const backupSnapshot = {
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

            await tx.workflowVersion.create({
                data: {
                    workflowId: id,
                    version: (latestVersion?.version ?? 0) + 1,
                    snapshot: JSON.stringify(backupSnapshot),
                    changeNote: `Before restoring to version ${version.version}`,
                },
            })

            // Delete existing steps
            await tx.workflowStep.deleteMany({
                where: { workflowId: id },
            })

            // Update workflow
            await tx.workflow.update({
                where: { id },
                data: {
                    name: snapshot.name,
                    description: snapshot.description,
                    icon: snapshot.icon,
                    color: snapshot.color,
                    inputSchema: snapshot.inputSchema,
                },
            })

            // Recreate steps from snapshot
            if (snapshot.steps && snapshot.steps.length > 0) {
                await tx.workflowStep.createMany({
                    data: snapshot.steps.map(step => ({
                        workflowId: id,
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
                })
            }

            // Create version after restore
            await tx.workflowVersion.create({
                data: {
                    workflowId: id,
                    version: (latestVersion?.version ?? 0) + 2,
                    snapshot: version.snapshot,
                    changeNote: `Restored from version ${version.version}`,
                },
            })

            // Fetch complete updated workflow
            return tx.workflow.findUnique({
                where: { id },
                include: {
                    steps: { orderBy: { order: 'asc' } },
                    folder: true,
                    tags: { include: { tag: true } },
                },
            })
        })

        return NextResponse.json({
            success: true,
            workflow: result,
            restoredFromVersion: version.version,
        })
    } catch (error) {
        console.error('Failed to restore workflow version:', error)
        return NextResponse.json(
            { error: 'Failed to restore workflow version' },
            { status: 500 }
        )
    }
}
