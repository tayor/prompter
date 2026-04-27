import { NextResponse } from 'next/server'
import { createFolder, listFoldersWithTree } from '@/lib/services/folders-service'
import { createFolderSchema } from '@/lib/validators'

// GET /api/folders - List all folders as tree
export async function GET() {
    try {
        const result = await listFoldersWithTree()
        return NextResponse.json(result)
    } catch (error) {
        console.error('Failed to fetch folders:', error)
        return NextResponse.json(
            { error: 'Failed to fetch folders' },
            { status: 500 }
        )
    }
}

// POST /api/folders - Create folder
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const data = createFolderSchema.parse(body)

        const folder = await createFolder(data)

        return NextResponse.json(folder, { status: 201 })
    } catch (error) {
        console.error('Failed to create folder:', error)
        if (error instanceof Error && error.name === 'ZodError') {
            return NextResponse.json(
                { error: 'Invalid folder data', details: error },
                { status: 400 }
            )
        }
        return NextResponse.json(
            { error: 'Failed to create folder' },
            { status: 500 }
        )
    }
}
