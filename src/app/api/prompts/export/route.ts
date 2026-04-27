import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

// GET /api/prompts/export - Export all prompts (no pagination limit)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const isFavorite = searchParams.get('isFavorite') === 'true'
        const ids = searchParams.get('ids') // comma-separated IDs to export

        const where: Record<string, unknown> = {}

        if (isFavorite) {
            where.isFavorite = true
        }

        if (ids) {
            where.id = { in: ids.split(',') }
        }

        const prompts = await prisma.prompt.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            include: {
                folder: {
                    select: { id: true, name: true, color: true },
                },
                tags: {
                    include: {
                        tag: {
                            select: { id: true, name: true, color: true },
                        },
                    },
                },
            },
        })

        return NextResponse.json({ prompts })
    } catch (error) {
        console.error('Failed to export prompts:', error)
        return NextResponse.json(
            { error: 'Failed to export prompts' },
            { status: 500 }
        )
    }
}

// GET /api/prompts/export/ids - Get all prompt IDs for select-all functionality
export async function POST(request: Request) {
    try {
        const body = await request.json().catch(() => ({}))
        const isFavorite = body.isFavorite

        const where: Record<string, unknown> = {}
        if (isFavorite) {
            where.isFavorite = true
        }

        const prompts = await prisma.prompt.findMany({
            where,
            select: { id: true },
        })

        return NextResponse.json({
            ids: prompts.map((p) => p.id),
            count: prompts.length
        })
    } catch (error) {
        console.error('Failed to get prompt IDs:', error)
        return NextResponse.json(
            { error: 'Failed to get prompt IDs' },
            { status: 500 }
        )
    }
}
