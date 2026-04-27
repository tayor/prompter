import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { moveFolderSchema } from '@/lib/validators'

interface RouteParams {
    params: Promise<{ id: string }>
}

// POST /api/folders/[id]/move - Move folder to new parent
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const body = await request.json()
        const { parentId } = moveFolderSchema.parse(body)

        // Check folder exists
        const folder = await prisma.folder.findUnique({ where: { id } })
        if (!folder) {
            return NextResponse.json(
                { error: 'Folder not found' },
                { status: 404 }
            )
        }

        // Prevent moving folder into itself
        if (parentId === id) {
            return NextResponse.json(
                { error: 'Cannot move folder into itself' },
                { status: 400 }
            )
        }

        // Check parent exists if specified
        if (parentId) {
            const parent = await prisma.folder.findUnique({ where: { id: parentId } })
            if (!parent) {
                return NextResponse.json(
                    { error: 'Parent folder not found' },
                    { status: 404 }
                )
            }

            // Prevent circular reference - check if new parent is a descendant
            const isDescendant = await checkIsDescendant(id, parentId)
            if (isDescendant) {
                return NextResponse.json(
                    { error: 'Cannot move folder into its own descendant' },
                    { status: 400 }
                )
            }
        }

        // Update folder
        const updated = await prisma.folder.update({
            where: { id },
            data: { parentId },
            include: {
                parent: true,
                children: true,
            },
        })

        return NextResponse.json(updated)
    } catch (error) {
        console.error('Failed to move folder:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid move data', details: error },
                { status: 400 }
            )
        }
        return NextResponse.json(
            { error: 'Failed to move folder' },
            { status: 500 }
        )
    }
}

// Helper to check if targetId is a descendant of folderId
async function checkIsDescendant(folderId: string, targetId: string): Promise<boolean> {
    const folder = await prisma.folder.findUnique({
        where: { id: targetId },
        select: { parentId: true },
    })

    if (!folder) return false
    if (folder.parentId === folderId) return true
    if (folder.parentId) {
        return checkIsDescendant(folderId, folder.parentId)
    }
    return false
}
