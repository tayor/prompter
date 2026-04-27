import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import type { CreatePromptInput, UpdatePromptInput } from '@/lib/validators'
import { searchQuerySchema } from '@/lib/validators'

export type PromptListQuery = z.infer<typeof searchQuerySchema>

export function parsePromptListQuery(searchParams: URLSearchParams): PromptListQuery {
    return searchQuerySchema.parse({
        q: searchParams.get('q') ?? undefined,
        folderId: searchParams.get('folderId') ?? undefined,
        tagId: searchParams.get('tagId') ?? undefined,
        aiModel: searchParams.get('aiModel') ?? undefined,
        isFavorite: searchParams.get('isFavorite') ?? undefined,
        isArchived: searchParams.get('isArchived') ?? undefined,
        sort: searchParams.get('sort') ?? 'updated',
        order: searchParams.get('order') ?? 'desc',
        page: searchParams.get('page') ?? 1,
        limit: searchParams.get('limit') ?? 20,
    })
}

export function buildPromptWhere(query: PromptListQuery): Prisma.PromptWhereInput {
    const where: Prisma.PromptWhereInput = {}

    if (query.q) {
        where.OR = [
            { title: { contains: query.q } },
            { content: { contains: query.q } },
            { description: { contains: query.q } },
        ]
    }

    if (query.folderId) {
        where.folderId = query.folderId
    }

    if (query.aiModel) {
        where.aiModel = query.aiModel
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

export function getPromptListOrderBy(
    sort: PromptListQuery['sort'],
    order: PromptListQuery['order'],
): Prisma.PromptOrderByWithRelationInput {
    const orderByField = sort === 'created'
        ? 'createdAt'
        : sort === 'usage'
            ? 'usageCount'
            : sort === 'rating'
                ? 'rating'
                : sort === 'title'
                    ? 'title'
                    : 'updatedAt'

    return { [orderByField]: order } as Prisma.PromptOrderByWithRelationInput
}

export async function listPrompts(query: PromptListQuery) {
    const where = buildPromptWhere(query)
    const orderBy = getPromptListOrderBy(query.sort, query.order)
    const skip = (query.page - 1) * query.limit
    const take = query.limit

    const [prompts, total] = await Promise.all([
        prisma.prompt.findMany({
            where,
            orderBy,
            skip,
            take,
            include: {
                folder: true,
                tags: { include: { tag: true } },
            },
        }),
        prisma.prompt.count({ where }),
    ])

    return {
        prompts,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    }
}

export async function createPromptWithVersion(input: CreatePromptInput) {
    const { tagIds, ...data } = input

    const prompt = await prisma.prompt.create({
        data: {
            ...data,
            variables: data.variables ? JSON.stringify(data.variables) : null,
            tags: tagIds?.length
                ? { create: tagIds.map((tagId: string) => ({ tagId })) }
                : undefined,
        },
        include: {
            folder: true,
            tags: { include: { tag: true } },
        },
    })

    await prisma.promptVersion.create({
        data: {
            promptId: prompt.id,
            version: 1,
            content: prompt.content,
            variables: prompt.variables,
            changeNote: 'Initial version',
        },
    })

    return prompt
}

export async function findPromptById(id: string) {
    return prisma.prompt.findUnique({ where: { id } })
}

export async function getPromptDetails(id: string) {
    return prisma.prompt.findUnique({
        where: { id },
        include: {
            folder: true,
            tags: { include: { tag: true } },
            versions: {
                orderBy: { version: 'desc' },
                take: 5,
            },
        },
    })
}

export async function listPromptVersions(promptId: string, take = 20) {
    return prisma.promptVersion.findMany({
        where: { promptId },
        orderBy: { version: 'desc' },
        take,
    })
}

export async function restorePromptVersion(promptId: string, versionId: string) {
    const version = await prisma.promptVersion.findFirst({
        where: { id: versionId, promptId },
    })
    if (!version) {
        return null
    }

    return prisma.$transaction(async (tx) => {
        const prompt = await tx.prompt.findUnique({ where: { id: promptId } })
        if (!prompt) {
            return null
        }

        const latestVersion = await tx.promptVersion.findFirst({
            where: { promptId },
            orderBy: { version: 'desc' },
        })

        await tx.promptVersion.create({
            data: {
                promptId,
                version: (latestVersion?.version ?? 0) + 1,
                content: prompt.content,
                variables: prompt.variables,
                changeNote: `Before restoring to version ${version.version}`,
            },
        })

        const updatedPrompt = await tx.prompt.update({
            where: { id: promptId },
            data: {
                content: version.content,
                variables: version.variables,
            },
            include: {
                folder: true,
                tags: { include: { tag: true } },
            },
        })

        await tx.promptVersion.create({
            data: {
                promptId,
                version: (latestVersion?.version ?? 0) + 2,
                content: version.content,
                variables: version.variables,
                changeNote: `Restored from version ${version.version}`,
            },
        })

        return {
            success: true,
            prompt: updatedPrompt,
            restoredFromVersion: version.version,
        }
    })
}

export async function updatePromptWithVersion(
    id: string,
    input: UpdatePromptInput,
    options: { changeNote?: string } = {}
) {
    const { tagIds, ...data } = input
    const existing = await prisma.prompt.findUnique({ where: { id } })
    if (!existing) {
        return null
    }

    const updateData: Prisma.PromptUpdateInput = {}
    if (data.title !== undefined) {
        updateData.title = data.title
    }
    if (data.content !== undefined) {
        updateData.content = data.content
    }
    if (data.description !== undefined) {
        updateData.description = data.description
    }
    if (data.aiModel !== undefined) {
        updateData.aiModel = data.aiModel
    }
    if (data.category !== undefined) {
        updateData.category = data.category
    }
    if (data.folderId !== undefined) {
        updateData.folder = { connect: { id: data.folderId } }
    }
    if (data.variables !== undefined) {
        updateData.variables = JSON.stringify(data.variables)
    }

    const contentChanged = data.content !== undefined && data.content !== existing.content

    const prompt = await prisma.prompt.update({
        where: { id },
        data: updateData,
        include: {
            folder: true,
            tags: { include: { tag: true } },
        },
    })

    if (tagIds !== undefined) {
        await prisma.tagsOnPrompts.deleteMany({ where: { promptId: id } })
        if (tagIds.length > 0) {
            await prisma.tagsOnPrompts.createMany({
                data: tagIds.map((tagId) => ({ promptId: id, tagId })),
            })
        }
    }

    if (contentChanged) {
        const latestVersion = await prisma.promptVersion.findFirst({
            where: { promptId: id },
            orderBy: { version: 'desc' },
        })

        await prisma.promptVersion.create({
            data: {
                promptId: id,
                version: (latestVersion?.version ?? 0) + 1,
                content: prompt.content,
                variables: prompt.variables,
                changeNote: options.changeNote ?? 'Updated content',
            },
        })
    }

    return prisma.prompt.findUnique({
        where: { id },
        include: {
            folder: true,
            tags: { include: { tag: true } },
            versions: {
                orderBy: { version: 'desc' },
                take: 5,
            },
        },
    })
}

export async function deletePromptById(id: string): Promise<boolean> {
    const prompt = await prisma.prompt.findUnique({
        where: { id },
        select: { id: true },
    })

    if (!prompt) {
        return false
    }

    await prisma.prompt.delete({ where: { id } })
    return true
}

export async function incrementPromptUsage(id: string) {
    return prisma.prompt.update({
        where: { id },
        data: {
            usageCount: { increment: 1 },
            lastUsedAt: new Date(),
        },
    })
}
