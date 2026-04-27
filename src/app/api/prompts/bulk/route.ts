import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const bulkOperationSchema = z.object({
    promptIds: z.array(z.string()).min(1),
    operation: z.enum(['delete', 'addTags', 'removeTags', 'moveToFolder', 'favorite', 'unfavorite', 'archive', 'unarchive']),
    tagIds: z.array(z.string()).optional(),
    folderId: z.string().nullable().optional(),
})

// POST /api/prompts/bulk - Perform bulk operations on prompts
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { promptIds, operation, tagIds, folderId } = bulkOperationSchema.parse(body)

        const result: { success: number; failed: number } = { success: 0, failed: 0 }

        switch (operation) {
            case 'delete': {
                const deleteResult = await prisma.prompt.deleteMany({
                    where: { id: { in: promptIds } },
                })
                result.success = deleteResult.count
                break
            }

            case 'addTags': {
                if (!tagIds || tagIds.length === 0) {
                    return NextResponse.json({ error: 'tagIds required for addTags operation' }, { status: 400 })
                }

                for (const promptId of promptIds) {
                    try {
                        for (const tagId of tagIds) {
                            await prisma.tagsOnPrompts.upsert({
                                where: { promptId_tagId: { promptId, tagId } },
                                create: { promptId, tagId },
                                update: {},
                            })
                        }
                        result.success++
                    } catch {
                        result.failed++
                    }
                }
                break
            }

            case 'removeTags': {
                if (!tagIds || tagIds.length === 0) {
                    return NextResponse.json({ error: 'tagIds required for removeTags operation' }, { status: 400 })
                }

                await prisma.tagsOnPrompts.deleteMany({
                    where: {
                        promptId: { in: promptIds },
                        tagId: { in: tagIds },
                    },
                })
                result.success = promptIds.length
                break
            }

            case 'moveToFolder': {
                const updateResult = await prisma.prompt.updateMany({
                    where: { id: { in: promptIds } },
                    data: { folderId: folderId ?? null },
                })
                result.success = updateResult.count
                break
            }

            case 'favorite': {
                const updateResult = await prisma.prompt.updateMany({
                    where: { id: { in: promptIds } },
                    data: { isFavorite: true },
                })
                result.success = updateResult.count
                break
            }

            case 'unfavorite': {
                const updateResult = await prisma.prompt.updateMany({
                    where: { id: { in: promptIds } },
                    data: { isFavorite: false },
                })
                result.success = updateResult.count
                break
            }

            case 'archive': {
                const updateResult = await prisma.prompt.updateMany({
                    where: { id: { in: promptIds } },
                    data: { isArchived: true },
                })
                result.success = updateResult.count
                break
            }

            case 'unarchive': {
                const updateResult = await prisma.prompt.updateMany({
                    where: { id: { in: promptIds } },
                    data: { isArchived: false },
                })
                result.success = updateResult.count
                break
            }

            default:
                return NextResponse.json({ error: 'Unknown operation' }, { status: 400 })
        }

        return NextResponse.json({
            operation,
            ...result,
            total: promptIds.length,
        })
    } catch (error) {
        console.error('Bulk operation failed:', error)
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid request', details: error.issues }, { status: 400 })
        }
        return NextResponse.json({ error: 'Bulk operation failed' }, { status: 500 })
    }
}
