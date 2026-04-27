import { NextResponse } from 'next/server'
import { createTagIfNotExists, listTagsWithCounts } from '@/lib/services/tags-service'
import { createTagSchema } from '@/lib/validators'

// GET /api/tags - List all tags with counts
export async function GET() {
    try {
        const tags = await listTagsWithCounts()

        return NextResponse.json({ tags })
    } catch (error) {
        console.error('Failed to fetch tags:', error)
        return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
    }
}

// POST /api/tags - Create tag
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const data = createTagSchema.parse(body)

        const result = await createTagIfNotExists(data)
        if (result.alreadyExists) {
            return NextResponse.json({ error: 'Tag already exists' }, { status: 409 })
        }

        return NextResponse.json(result.tag, { status: 201 })
    } catch (error) {
        console.error('Failed to create tag:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json({ error: 'Invalid tag data' }, { status: 400 })
        }
        return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
    }
}
