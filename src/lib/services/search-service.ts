import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { searchQuerySchema } from '@/lib/validators'

export type SearchQuery = z.infer<typeof searchQuerySchema>
export type SearchType = 'all' | 'prompts' | 'workflows'

export function parseSearchParams(searchParams: URLSearchParams): { query: SearchQuery; type: SearchType } {
    const query = searchQuerySchema.parse({
        q: searchParams.get('q') || undefined,
        folderId: searchParams.get('folderId') || undefined,
        tagId: searchParams.get('tagId') || undefined,
        aiModel: searchParams.get('aiModel') || undefined,
        isFavorite: searchParams.get('isFavorite') || undefined,
        isArchived: searchParams.get('isArchived') || undefined,
        sort: searchParams.get('sort') || undefined,
        order: searchParams.get('order') || undefined,
        page: searchParams.get('page') || undefined,
        limit: searchParams.get('limit') || undefined,
    })

    const rawType = searchParams.get('type') || 'all'
    const type = rawType === 'prompts' || rawType === 'workflows' ? rawType : 'all'

    return { query, type }
}

export function getPromptSearchOrderBy(sort: string, order: 'asc' | 'desc'): Prisma.PromptOrderByWithRelationInput {
    switch (sort) {
        case 'created':
            return { createdAt: order }
        case 'usage':
            return { usageCount: order }
        case 'title':
            return { title: order }
        case 'updated':
        default:
            return { updatedAt: order }
    }
}

export function getWorkflowSearchOrderBy(sort: string, order: 'asc' | 'desc'): Prisma.WorkflowOrderByWithRelationInput {
    switch (sort) {
        case 'created':
            return { createdAt: order }
        case 'usage':
            return { runCount: order }
        case 'name':
            return { name: order }
        case 'updated':
        default:
            return { updatedAt: order }
    }
}

export async function searchPromptsAndWorkflows(query: SearchQuery, type: SearchType) {
    const skip = (query.page - 1) * query.limit
    const textSearch = query.q ? { contains: query.q } : undefined

    const results: {
        prompts?: unknown[]
        workflows?: unknown[]
        total: { prompts: number; workflows: number }
    } = {
        total: { prompts: 0, workflows: 0 },
    }

    if (type === 'all' || type === 'prompts') {
        const promptWhere: Prisma.PromptWhereInput = {
            isArchived: query.isArchived ?? false,
            ...(query.isFavorite !== undefined && { isFavorite: query.isFavorite }),
            ...(query.folderId && { folderId: query.folderId }),
            ...(query.aiModel && { aiModel: query.aiModel }),
            ...(query.tagId && {
                tags: { some: { tagId: query.tagId } },
            }),
            ...(textSearch && {
                OR: [
                    { title: textSearch },
                    { content: textSearch },
                    { description: textSearch },
                ],
            }),
        }

        const promptOrderBy = getPromptSearchOrderBy(query.sort, query.order)

        const [prompts, promptCount] = await Promise.all([
            prisma.prompt.findMany({
                where: promptWhere,
                orderBy: promptOrderBy,
                skip: type === 'prompts' ? skip : 0,
                take: type === 'prompts' ? query.limit : 10,
                include: {
                    folder: true,
                    tags: { include: { tag: true } },
                },
            }),
            prisma.prompt.count({ where: promptWhere }),
        ])

        results.prompts = prompts
        results.total.prompts = promptCount
    }

    if (type === 'all' || type === 'workflows') {
        const workflowWhere: Prisma.WorkflowWhereInput = {
            isArchived: query.isArchived ?? false,
            ...(query.isFavorite !== undefined && { isFavorite: query.isFavorite }),
            ...(query.folderId && { folderId: query.folderId }),
            ...(query.tagId && {
                tags: { some: { tagId: query.tagId } },
            }),
            ...(textSearch && {
                OR: [
                    { name: textSearch },
                    { description: textSearch },
                ],
            }),
        }

        const workflowOrderBy = getWorkflowSearchOrderBy(query.sort, query.order)

        const [workflows, workflowCount] = await Promise.all([
            prisma.workflow.findMany({
                where: workflowWhere,
                orderBy: workflowOrderBy,
                skip: type === 'workflows' ? skip : 0,
                take: type === 'workflows' ? query.limit : 10,
                include: {
                    folder: true,
                    tags: { include: { tag: true } },
                    _count: { select: { steps: true } },
                },
            }),
            prisma.workflow.count({ where: workflowWhere }),
        ])

        results.workflows = workflows
        results.total.workflows = workflowCount
    }

    return {
        ...results,
        query: query.q,
        pagination: {
            page: query.page,
            limit: query.limit,
            total: results.total.prompts + results.total.workflows,
        },
    }
}
