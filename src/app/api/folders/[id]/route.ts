import { NextRequest, NextResponse } from 'next/server'
import { deleteFolderAndReassign, findFolderById, updateFolder } from '@/lib/services/folders-service'
import { updateFolderSchema } from '@/lib/validators'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/folders/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        const folder = await findFolderById(id)

        if (!folder) {
            return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
        }

        return NextResponse.json(folder)
    } catch (error) {
        console.error('Failed to fetch folder:', error)
        return NextResponse.json({ error: 'Failed to fetch folder' }, { status: 500 })
    }
}

// PUT /api/folders/[id]
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const body = await request.json()
        const data = updateFolderSchema.parse(body)

        const folder = await updateFolder(id, data)

        return NextResponse.json(folder)
    } catch (error) {
        console.error('Failed to update folder:', error)
        return NextResponse.json({ error: 'Failed to update folder' }, { status: 500 })
    }
}

// DELETE /api/folders/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        const deleted = await deleteFolderAndReassign(id)
        if (!deleted) {
            return NextResponse.json({ error: 'Folder not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete folder:', error)
        return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 })
    }
}
