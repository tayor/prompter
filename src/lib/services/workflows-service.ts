import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import type { CreateWorkflowInput, UpdateWorkflowInput } from '@/lib/validators'
import { searchQuerySchema } from '@/lib/validators'

export type WorkflowListQuery = z.infer<typeof searchQuerySchema>

export function parseWorkflowListQuery(searchParams: URLSearchParams): WorkflowListQuery {
    return searchQuerySchema.parse({
        q: searchParams.get('q') ?? undefined,
        folderId: searchParams.get('folderId') ?? undefined,
        tagId: searchParams.get('tagId') ?? undefined,
        isFavorite: searchParams.get('isFavorite') ?? undefined,
        isArchived: searchParams.get('isArchived') ?? undefined,
        sort: searchParams.get('sort') ?? 'updated',
        order: searchParams.get('order') ?? 'desc',
        page: searchParams.get('page') ?? 1,
        limit: searchParams.get('limit') ?? 20,
    })
}

export function buildWorkflowWhere(query: WorkflowListQuery): Prisma.WorkflowWhereInput {
    const where: Prisma.WorkflowWhereInput = {}

    if (query.q) {
        where.OR = [
            { name: { contains: query.q } },
            { description: { contains: query.q } },
        ]
    }

    if (query.folderId) {
        where.folderId = query.folderId
    }

    if (query.isFavorite !== undefined) {
        where.isFavorite = query.isFavorite
    }

    if (query.isArchived !== undefined) {
        where.isArchived = query.isArchived
    } else {
        where.isArchived = false
    }

    if (query.tagId) {
        where.tags = { some: { tagId: query.tagId } }
    }

    return where
}

export function getWorkflowListOrderBy(
    sort: WorkflowListQuery['sort'],
    order: WorkflowListQuery['order'],
): Prisma.WorkflowOrderByWithRelationInput {
    const orderByField = sort === 'created'
        ? 'createdAt'
        : sort === 'usage'
            ? 'runCount'
            : sort === 'name'
                ? 'name'
                : 'updatedAt'

    return { [orderByField]: order } as Prisma.WorkflowOrderByWithRelationInput
}

export async function listWorkflows(query: WorkflowListQuery) {
    const where = buildWorkflowWhere(query)
    const orderBy = getWorkflowListOrderBy(query.sort, query.order)
    const skip = (query.page - 1) * query.limit
    const take = query.limit

    const [workflows, total] = await Promise.all([
        prisma.workflow.findMany({
            where,
            orderBy,
            skip,
            take,
            include: {
                folder: true,
                tags: { include: { tag: true } },
                _count: { select: { steps: true, runs: true } },
            },
        }),
        prisma.workflow.count({ where }),
    ])

    return {
        workflows,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    }
}

export async function createWorkflow(input: CreateWorkflowInput) {
    const { tagIds, inputSchema, ...data } = input

    return prisma.workflow.create({
        data: {
            ...data,
            inputSchema: inputSchema ? JSON.stringify(inputSchema) : null,
            tags: tagIds?.length
                ? { create: tagIds.map((tagId: string) => ({ tagId })) }
                : undefined,
        },
        include: {
            folder: true,
            tags: { include: { tag: true } },
            steps: { orderBy: { order: 'asc' } },
            _count: { select: { steps: true, runs: true } },
        },
    })
}

export async function getWorkflowById(id: string) {
    return prisma.workflow.findUnique({
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
}

export async function updateWorkflowById(id: string, input: UpdateWorkflowInput) {
    const { tagIds, inputSchema, ...data } = input
    return prisma.$transaction(async (tx) => {
        const existing = await tx.workflow.findUnique({ where: { id }, select: { id: true } })
        if (!existing) {
            return null
        }

        const updateData: Prisma.WorkflowUpdateInput = {}
        if (data.name !== undefined) {
            updateData.name = data.name
        }
        if (data.description !== undefined) {
            updateData.description = data.description
        }
        if (data.icon !== undefined) {
            updateData.icon = data.icon
        }
        if (data.color !== undefined) {
            updateData.color = data.color
        }
        if (data.isTemplate !== undefined) {
            updateData.isTemplate = data.isTemplate
        }
        if (data.folderId !== undefined) {
            updateData.folder = { connect: { id: data.folderId } }
        }
        if (inputSchema !== undefined) {
            updateData.inputSchema = inputSchema ? JSON.stringify(inputSchema) : null
        }

        await tx.workflow.update({
            where: { id },
            data: updateData,
        })

        if (tagIds !== undefined) {
            await tx.tagsOnWorkflows.deleteMany({ where: { workflowId: id } })
            if (tagIds.length > 0) {
                await tx.tagsOnWorkflows.createMany({
                    data: tagIds.map((tagId) => ({ workflowId: id, tagId })),
                })
            }
        }

        return tx.workflow.findUnique({
            where: { id },
            include: {
                folder: true,
                tags: { include: { tag: true } },
                steps: { orderBy: { order: 'asc' } },
                _count: { select: { steps: true, runs: true } },
            },
        })
    })
}

export async function deleteWorkflowById(id: string): Promise<boolean> {
    const existing = await prisma.workflow.findUnique({ where: { id }, select: { id: true } })
    if (!existing) {
        return false
    }

    await prisma.workflow.delete({ where: { id } })
    return true
}

export async function startWorkflowRun(workflowId: string, inputs?: Record<string, string>) {
    const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
        include: { steps: { orderBy: { order: 'asc' } } },
    })

    if (!workflow) {
        return null
    }

    const hasSteps = workflow.steps.length > 0

    const run = await prisma.workflowRun.create({
        data: {
            workflowId,
            status: hasSteps ? 'running' : 'completed',
            inputs: inputs ? JSON.stringify(inputs) : null,
            currentStep: 0,
            ...(hasSteps ? {} : { completedAt: new Date(), outputs: JSON.stringify([]) }),
        },
    })

    if (hasSteps) {
        await prisma.workflowStepRun.createMany({
            data: workflow.steps.map((step) => ({
                runId: run.id,
                stepOrder: step.order,
                stepName: step.name,
                status: step.order === 0 ? 'running' : 'pending',
            })),
        })
    }

    await prisma.workflow.update({
        where: { id: workflowId },
        data: { runCount: { increment: 1 } },
    })

    return prisma.workflowRun.findUnique({
        where: { id: run.id },
        include: {
            stepRuns: { orderBy: { stepOrder: 'asc' } },
            workflow: {
                include: { steps: { orderBy: { order: 'asc' } } },
            },
        },
    })
}

export async function listWorkflowRuns(workflowId: string, take = 20) {
    return prisma.workflowRun.findMany({
        where: { workflowId },
        orderBy: { startedAt: 'desc' },
        take,
        include: {
            stepRuns: { orderBy: { stepOrder: 'asc' } },
        },
    })
}

export async function getWorkflowRunById(workflowId: string, runId: string) {
    return prisma.workflowRun.findFirst({
        where: { id: runId, workflowId },
        include: {
            stepRuns: { orderBy: { stepOrder: 'asc' } },
            workflow: {
                include: { steps: { orderBy: { order: 'asc' } } },
            },
        },
    })
}

export interface UpdateWorkflowRunInput {
    completeStep?: number
    output?: string
    cancel?: boolean
}

export async function updateWorkflowRunById(
    workflowId: string,
    runId: string,
    input: UpdateWorkflowRunInput
) {
    const run = await prisma.workflowRun.findFirst({
        where: { id: runId, workflowId },
        include: {
            stepRuns: { orderBy: { stepOrder: 'asc' } },
            workflow: { include: { steps: { orderBy: { order: 'asc' } } } },
        },
    })

    if (!run) {
        return null
    }

    if (input.completeStep !== undefined) {
        const stepOrder = input.completeStep
        const stepOutput = input.output

        await prisma.workflowStepRun.updateMany({
            where: { runId, stepOrder },
            data: {
                status: 'completed',
                output: stepOutput,
                completedAt: new Date(),
            },
        })

        const nextStepOrder = stepOrder + 1
        const hasNextStep = run.workflow.steps.some((step) => step.order === nextStepOrder)

        if (hasNextStep) {
            await prisma.workflowStepRun.updateMany({
                where: { runId, stepOrder: nextStepOrder },
                data: { status: 'running', startedAt: new Date() },
            })

            await prisma.workflowRun.update({
                where: { id: runId },
                data: { currentStep: nextStepOrder },
            })
        } else {
            const outputs = run.stepRuns.map((stepRun) => ({
                step: stepRun.stepOrder,
                name: stepRun.stepName,
                output: stepRun.stepOrder === stepOrder ? stepOutput : stepRun.output,
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

    if (input.cancel) {
        await prisma.workflowRun.update({
            where: { id: runId },
            data: { status: 'cancelled', completedAt: new Date() },
        })

        await prisma.workflowStepRun.updateMany({
            where: { runId, status: { in: ['pending', 'running'] } },
            data: { status: 'skipped' },
        })
    }

    return prisma.workflowRun.findFirst({
        where: { id: runId, workflowId },
        include: {
            stepRuns: { orderBy: { stepOrder: 'asc' } },
            workflow: { include: { steps: { orderBy: { order: 'asc' } } } },
        },
    })
}
