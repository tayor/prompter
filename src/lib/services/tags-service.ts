import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import type { z } from 'zod'
import type { createTagSchema, updateTagSchema } from '@/lib/validators'

export type CreateTagInput = z.infer<typeof createTagSchema>
export type UpdateTagInput = z.infer<typeof updateTagSchema>

export type TagWithCounts = Prisma.TagGetPayload<{
    include: {
        _count: {
            select: {
                prompts: true
                workflows: true
            }
        }
    }
}>

export interface CreateTagResult {
    tag: TagWithCounts | null
    alreadyExists: boolean
}

export type UpdateTagResult =
    | { status: 'conflict' }
    | { status: 'updated'; tag: TagWithCounts }

export type MergeTagsResult =
    | { status: 'target_not_found' }
    | { status: 'source_not_found' }
    | { status: 'no_source' }
    | {
        status: 'merged'
        mergedTag: TagWithCounts | null
        mergedCount: number
        newAssociations: {
            prompts: number
            workflows: number
        }
    }

export async function listTagsWithCounts() {
    return prisma.tag.findMany({
        include: {
            _count: {
                select: {
                    prompts: true,
                    workflows: true,
                },
            },
        },
        orderBy: { name: 'asc' },
    })
}

export async function createTagIfNotExists(data: CreateTagInput): Promise<CreateTagResult> {
    const existing = await prisma.tag.findUnique({ where: { name: data.name } })
    if (existing) {
        return { tag: null, alreadyExists: true }
    }

    const tag = await prisma.tag.create({
        data,
        include: {
            _count: { select: { prompts: true, workflows: true } },
        },
    })

    return { tag, alreadyExists: false }
}

export async function findTagWithRelations(id: string) {
    return prisma.tag.findUnique({
        where: { id },
        include: {
            prompts: {
                include: { prompt: { select: { id: true, title: true } } },
                take: 20,
            },
            workflows: {
                include: { workflow: { select: { id: true, name: true } } },
                take: 20,
            },
            _count: { select: { prompts: true, workflows: true } },
        },
    })
}

export async function updateTagIfNoDuplicate(id: string, data: UpdateTagInput): Promise<UpdateTagResult> {
    if (data.name) {
        const existing = await prisma.tag.findFirst({
            where: { name: data.name, NOT: { id } },
        })

        if (existing) {
            return { status: 'conflict' }
        }
    }

    const tag = await prisma.tag.update({
        where: { id },
        data,
        include: {
            _count: { select: { prompts: true, workflows: true } },
        },
    })

    return {
        status: 'updated',
        tag,
    }
}

export async function deleteTag(id: string) {
    await prisma.tag.delete({ where: { id } })
}

export async function mergeTags(sourceTagIds: string[], targetTagId: string): Promise<MergeTagsResult> {
    const targetTag = await prisma.tag.findUnique({ where: { id: targetTagId } })
    if (!targetTag) {
        return { status: 'target_not_found' }
    }

    const sourceTags = await prisma.tag.findMany({
        where: { id: { in: sourceTagIds } },
    })

    if (sourceTags.length !== sourceTagIds.length) {
        return { status: 'source_not_found' }
    }

    const actualSourceIds = sourceTagIds.filter((id) => id !== targetTagId)
    if (actualSourceIds.length === 0) {
        return { status: 'no_source' }
    }

    const promptAssociations = await prisma.tagsOnPrompts.findMany({
        where: { tagId: { in: actualSourceIds } },
    })

    const workflowAssociations = await prisma.tagsOnWorkflows.findMany({
        where: { tagId: { in: actualSourceIds } },
    })

    const existingPromptIds = new Set(
        (await prisma.tagsOnPrompts.findMany({
            where: { tagId: targetTagId },
            select: { promptId: true },
        })).map((association) => association.promptId),
    )

    const existingWorkflowIds = new Set(
        (await prisma.tagsOnWorkflows.findMany({
            where: { tagId: targetTagId },
            select: { workflowId: true },
        })).map((association) => association.workflowId),
    )

    const newPromptAssociations = promptAssociations
        .filter((association) => !existingPromptIds.has(association.promptId))
        .map((association) => ({ promptId: association.promptId, tagId: targetTagId }))

    const newWorkflowAssociations = workflowAssociations
        .filter((association) => !existingWorkflowIds.has(association.workflowId))
        .map((association) => ({ workflowId: association.workflowId, tagId: targetTagId }))

    if (newPromptAssociations.length > 0) {
        await prisma.tagsOnPrompts.createMany({ data: newPromptAssociations })
    }

    if (newWorkflowAssociations.length > 0) {
        await prisma.tagsOnWorkflows.createMany({ data: newWorkflowAssociations })
    }

    await prisma.tag.deleteMany({ where: { id: { in: actualSourceIds } } })

    const mergedTag = await prisma.tag.findUnique({
        where: { id: targetTagId },
        include: {
            _count: {
                select: {
                    prompts: true,
                    workflows: true,
                },
            },
        },
    })

    return {
        status: 'merged',
        mergedTag,
        mergedCount: actualSourceIds.length,
        newAssociations: {
            prompts: newPromptAssociations.length,
            workflows: newWorkflowAssociations.length,
        },
    }
}
