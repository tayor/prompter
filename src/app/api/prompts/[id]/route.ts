import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { deletePromptById, updatePromptWithVersion } from '@/lib/services/prompts-service'
import { updatePromptSchema } from '@/lib/validators'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/prompts/[id] - Get single prompt
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        const prompt = await prisma.prompt.findUnique({
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

        if (!prompt) {
            return NextResponse.json(
                { error: 'Prompt not found' },
                { status: 404 }
            )
        }

        return NextResponse.json(prompt)
    } catch (error) {
        console.error('Failed to fetch prompt:', error)
        return NextResponse.json(
            { error: 'Failed to fetch prompt' },
            { status: 500 }
        )
    }
}

// PUT /api/prompts/[id] - Update prompt
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const body = await request.json()
        const changeNote = typeof body === 'object'
            && body !== null
            && 'changeNote' in body
            && typeof body.changeNote === 'string'
            ? body.changeNote
            : undefined
        const { tagIds, ...data } = updatePromptSchema.parse(body)
        const updatedPrompt = await updatePromptWithVersion(
            id,
            { ...data, ...(tagIds !== undefined ? { tagIds } : {}) },
            { changeNote },
        )

        if (!updatedPrompt) {
            return NextResponse.json(
                { error: 'Prompt not found' },
                { status: 404 }
            )
        }

        const promptResponse = { ...updatedPrompt, versions: undefined }
        return NextResponse.json(promptResponse)
    } catch (error) {
        console.error('Failed to update prompt:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid prompt data' },
                { status: 400 }
            )
        }
        return NextResponse.json(
            { error: 'Failed to update prompt' },
            { status: 500 }
        )
    }
}

// DELETE /api/prompts/[id] - Delete prompt
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const deleted = await deletePromptById(id)
        if (!deleted) {
            return NextResponse.json(
                { error: 'Prompt not found' },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete prompt:', error)
        return NextResponse.json(
            { error: 'Failed to delete prompt' },
            { status: 500 }
        )
    }
}
