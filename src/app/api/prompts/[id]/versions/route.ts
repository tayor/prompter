import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/prompts/[id]/versions - List all versions for a prompt
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        // Check if prompt exists
        const prompt = await prisma.prompt.findUnique({ where: { id } })
        if (!prompt) {
            return NextResponse.json(
                { error: 'Prompt not found' },
                { status: 404 }
            )
        }

        const versions = await prisma.promptVersion.findMany({
            where: { promptId: id },
            orderBy: { version: 'desc' },
        })

        return NextResponse.json(versions)
    } catch (error) {
        console.error('Failed to fetch prompt versions:', error)
        return NextResponse.json(
            { error: 'Failed to fetch prompt versions' },
            { status: 500 }
        )
    }
}

// POST /api/prompts/[id]/versions - Create a new version manually
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const body = await request.json()
        const { changeNote } = body

        // Get current prompt
        const prompt = await prisma.prompt.findUnique({ where: { id } })
        if (!prompt) {
            return NextResponse.json(
                { error: 'Prompt not found' },
                { status: 404 }
            )
        }

        // Get latest version number
        const latestVersion = await prisma.promptVersion.findFirst({
            where: { promptId: id },
            orderBy: { version: 'desc' },
        })

        // Create new version with current content
        const version = await prisma.promptVersion.create({
            data: {
                promptId: id,
                version: (latestVersion?.version ?? 0) + 1,
                content: prompt.content,
                variables: prompt.variables,
                changeNote: changeNote ?? 'Manual snapshot',
            },
        })

        return NextResponse.json(version, { status: 201 })
    } catch (error) {
        console.error('Failed to create prompt version:', error)
        return NextResponse.json(
            { error: 'Failed to create prompt version' },
            { status: 500 }
        )
    }
}
