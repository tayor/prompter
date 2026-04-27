import { NextRequest, NextResponse } from 'next/server'
import { deleteTag, findTagWithRelations, updateTagIfNoDuplicate } from '@/lib/services/tags-service'
import { updateTagSchema } from '@/lib/validators'

interface RouteParams {
    params: Promise<{ id: string }>
}

// GET /api/tags/[id]
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        const tag = await findTagWithRelations(id)

        if (!tag) {
            return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
        }

        return NextResponse.json(tag)
    } catch (error) {
        console.error('Failed to fetch tag:', error)
        return NextResponse.json({ error: 'Failed to fetch tag' }, { status: 500 })
    }
}

// PUT /api/tags/[id]
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params
        const body = await request.json()
        const data = updateTagSchema.parse(body)

        const result = await updateTagIfNoDuplicate(id, data)
        if (result.status === 'conflict') {
            return NextResponse.json({ error: 'Tag name already exists' }, { status: 409 })
        }

        return NextResponse.json(result.tag)
    } catch (error) {
        console.error('Failed to update tag:', error)
        return NextResponse.json({ error: 'Failed to update tag' }, { status: 500 })
    }
}

// DELETE /api/tags/[id]
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params

        await deleteTag(id)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete tag:', error)
        return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 })
    }
}
