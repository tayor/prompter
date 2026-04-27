import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface RouteParams {
    params: Promise<{ id: string }>
}

// POST /api/prompts/[id]/duplicate - Duplicate prompt
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        const duplicate = await prisma.$transaction(async (tx) => {
            const prompt = await tx.prompt.findUnique({
                where: { id },
                include: {
                    tags: true,
                },
            })

            if (!prompt) {
                return null
            }

            const createdDuplicate = await tx.prompt.create({
                data: {
                    title: `${prompt.title} (Copy)`,
                    content: prompt.content,
                    description: prompt.description,
                    variables: prompt.variables,
                    aiModel: prompt.aiModel,
                    category: prompt.category,
                    folderId: prompt.folderId,
                    tags: {
                        create: prompt.tags.map((t) => ({ tagId: t.tagId })),
                    },
                },
            })

            await tx.promptVersion.create({
                data: {
                    promptId: createdDuplicate.id,
                    version: 1,
                    content: createdDuplicate.content,
                    variables: createdDuplicate.variables,
                    changeNote: `Duplicated from "${prompt.title}"`,
                },
            })

            return tx.prompt.findUnique({
                where: { id: createdDuplicate.id },
                include: {
                    folder: true,
                    tags: { include: { tag: true } },
                },
            })
        })

        if (!duplicate) {
            return NextResponse.json(
                { error: 'Prompt not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(duplicate, { status: 201 })
    } catch (error) {
        console.error('Failed to duplicate prompt:', error)
        return NextResponse.json(
            { error: 'Failed to duplicate prompt' },
            { status: 500 }
        )
    }
}
