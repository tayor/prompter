import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface RouteParams {
    params: Promise<{ id: string }>
}

// POST /api/workflows/[id]/duplicate - Clone a workflow with all steps
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        const result = await prisma.$transaction(async (tx) => {
            const workflow = await tx.workflow.findUnique({
                where: { id },
                include: {
                    steps: { orderBy: { order: 'asc' } },
                    tags: true,
                },
            })

            if (!workflow) {
                return null
            }

            const duplicate = await tx.workflow.create({
                data: {
                    name: `${workflow.name} (Copy)`,
                    description: workflow.description,
                    icon: workflow.icon,
                    color: workflow.color,
                    isTemplate: false,
                    isFavorite: false,
                    isArchived: false,
                    runCount: 0,
                    inputSchema: workflow.inputSchema,
                    folderId: workflow.folderId,
                },
            })

            const stepIdMap = new Map<string, string>()
            for (const step of workflow.steps) {
                const createdStep = await tx.workflowStep.create({
                    data: {
                        workflowId: duplicate.id,
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
                        nextStepOnSuccess: null,
                        nextStepOnFailure: null,
                    },
                    select: { id: true },
                })
                stepIdMap.set(step.id, createdStep.id)
            }

            for (const step of workflow.steps) {
                const duplicatedStepId = stepIdMap.get(step.id)
                if (!duplicatedStepId) {
                    continue
                }

                const nextStepOnSuccess = step.nextStepOnSuccess
                    ? stepIdMap.get(step.nextStepOnSuccess) ?? null
                    : null
                const nextStepOnFailure = step.nextStepOnFailure
                    ? stepIdMap.get(step.nextStepOnFailure) ?? null
                    : null

                if (nextStepOnSuccess || nextStepOnFailure) {
                    await tx.workflowStep.update({
                        where: { id: duplicatedStepId },
                        data: {
                            nextStepOnSuccess,
                            nextStepOnFailure,
                        },
                    })
                }
            }

            if (workflow.tags.length > 0) {
                await tx.tagsOnWorkflows.createMany({
                    data: workflow.tags.map((tag) => ({
                        workflowId: duplicate.id,
                        tagId: tag.tagId,
                    })),
                })
            }

            return tx.workflow.findUnique({
                where: { id: duplicate.id },
                include: {
                    steps: { orderBy: { order: 'asc' } },
                    folder: true,
                    tags: { include: { tag: true } },
                },
            })
        })

        if (!result) {
            return NextResponse.json(
                { error: 'Workflow not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(result, { status: 201 })
    } catch (error) {
        console.error('Failed to duplicate workflow:', error)
        return NextResponse.json(
            { error: 'Failed to duplicate workflow' },
            { status: 500 }
        )
    }
}
